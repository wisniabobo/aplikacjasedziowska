#!/usr/bin/env python3
"""
Odczyt kluczy odpowiedzi KSSiP z siatki tabeli.

Wykrywa linie poziome i pionowe tabeli na zeskanowanej stronie, wycina każdą komórkę
(numer / odpowiedź / podstawa prawna) i rozpoznaje ją osobno przez macOS Vision.
Dzięki temu numer pytania, litera i podstawa prawna są zawsze z tego samego wiersza.

Użycie:
  python3 -I tools/ocr/key_grid.py <katalog_png> <katalog_wyjściowy> <ocr_bin> <id> [<id> ...]
Wynik: <katalog_wyjściowy>/<id>__keygrid.json  ({"rows": [{"n":..,"letter":..,"basis":..}], ...})
"""
import json
import os
import re
import subprocess
import sys
import tempfile

import fitz

PNG_DIR, OUT_DIR, OCR_BIN = sys.argv[1], sys.argv[2], sys.argv[3]
IDS = sys.argv[4:]


def load_gray(path):
    pix = fitz.Pixmap(path)
    if pix.n != 1:
        pix = fitz.Pixmap(fitz.csGRAY, pix)
    return pix.width, pix.height, pix.samples


def runs(flags, min_gap=4):
    """Zamienia listę booli na środki ciągłych odcinków True."""
    out = []
    start = None
    for i, f in enumerate(flags + [False]):
        if f and start is None:
            start = i
        elif not f and start is not None:
            out.append((start, i - 1))
            start = None
    merged = []
    for a, b in out:
        if merged and a - merged[-1][1] <= min_gap:
            merged[-1] = (merged[-1][0], b)
        else:
            merged.append((a, b))
    return merged


def detect_grid(w, h, px):
    """Zwraca (kąt, linie_poziome[y'], linie_pionowe[x']) po korekcie pochylenia skanu."""
    import math
    # Tylko piksele należące do długich poziomych odcinków (linie tabeli, nie tekst).
    pts = []
    for y in range(h):
        row = y * w
        run = 0
        for x in range(w):
            if px[row + x] < 170:
                run += 1
            else:
                if run >= 28:
                    pts.extend((xx, y) for xx in range(x - run, x, 4))
                run = 0
        if run >= 28:
            pts.extend((xx, y) for xx in range(w - run, w, 4))
    if len(pts) < 300:
        return None

    def score(a):
        t = math.tan(math.radians(a))
        hist = {}
        for x, y in pts:
            b = int(y - x * t)
            hist[b] = hist.get(b, 0) + 1
        return sum(v * v for v in hist.values()), hist

    best = (0, 0.0, None)
    for i in range(-30, 31):
        a = i * 0.1
        sc, hist = score(a)
        if sc > best[0]:
            best = (sc, a, hist)
    base = best[1]
    for i in range(-5, 6):
        a = base + i * 0.02
        sc, hist = score(a)
        if sc > best[0]:
            best = (sc, a, hist)
    _, angle, hist = best
    t = math.tan(math.radians(angle))
    # linie poziome: biny, w których długie odcinki pokrywają znaczną część najdłuższej linii
    ys = sorted(hist)
    peak = max(hist[b] + hist.get(b - 1, 0) + hist.get(b + 1, 0) for b in ys)
    strong = [b for b in ys if hist[b] + hist.get(b - 1, 0) + hist.get(b + 1, 0) > peak * 0.45]
    hl = []
    for b in strong:
        if hl and b - hl[-1][-1] <= 3:
            hl[-1].append(b)
        else:
            hl.append([b])
    hl = [sum(g) / len(g) for g in hl]
    if len(hl) < 3:
        return None
    top, bot = hl[0], hl[-1]
    # linie pionowe: próbkujemy co 4. wiersz, ale każdą kolumnę (cienkie linie)
    vhist = {}
    rows_sampled = 0
    for y in range(int(max(0, top)), int(min(h, bot + w * abs(t) + 1)), 4):
        row = y * w
        any_row = False
        for x in range(w):
            if px[row + x] < 160:
                yp = y - x * t
                if top + 2 <= yp <= bot - 2:
                    b = int(x + y * t)
                    vhist[b] = vhist.get(b, 0) + 1
                    any_row = True
        rows_sampled += 1
    xs = sorted(vhist)
    vstrong = [b for b in xs if vhist[b] + vhist.get(b - 1, 0) + vhist.get(b + 1, 0) > rows_sampled * 0.85]
    vl = []
    for b in vstrong:
        if vl and b - vl[-1][-1] <= 4:
            vl[-1].append(b)
        else:
            vl.append([b])
    vl = [sum(g) / len(g) for g in vl]
    if len(vl) < 3:
        return None
    return angle, hl, vl


def crop(path, rect, scale, out):
    doc = fitz.open(path)
    page = doc[0]
    pix = page.get_pixmap(clip=fitz.Rect(*rect), matrix=fitz.Matrix(scale, scale))
    pix.save(out)


def ocr(paths):
    if not paths:
        return {}
    tmp = tempfile.mktemp(suffix='.json')
    res = {}
    for i in range(0, len(paths), 400):
        subprocess.run([OCR_BIN, tmp] + paths[i:i + 400], check=True)
        res.update(json.load(open(tmp)))
    return res


def text_of(obs):
    obs = sorted(obs, key=lambda o: (round(o['y'], 2), o['x']))
    return ' '.join(o['t'].strip() for o in obs).strip()


NUM_FIX = str.maketrans({'l': '1', 'I': '1', 'i': '1', 'S': '5', 's': '5', 'O': '0', 'o': '0', 'B': '8', 'Z': '2', '|': '1'})


def glyph_features(path, size=16):
    """Wektor cech znaku: binaryzacja, usunięcie linii tabeli, przycięcie do znaku, skalowanie do 16×16."""
    pix = fitz.Pixmap(path)
    if pix.n != 1:
        pix = fitz.Pixmap(fitz.csGRAY, pix)
    w, h, px = pix.width, pix.height, pix.samples
    dark = [[px[y * w + x] < 128 for x in range(w)] for y in range(h)]
    cols = [x for x in range(w) if sum(dark[y][x] for y in range(h)) < h * 0.7]
    rws = [y for y in range(h) if sum(dark[y][x] for x in range(w)) < w * 0.7]
    pts = [(x, y) for y in rws for x in cols if dark[y][x]]
    # odrzucamy drobny szum przy krawędziach
    if len(pts) < 15:
        return None
    xs = sorted(p[0] for p in pts)
    ys = sorted(p[1] for p in pts)
    x0, x1 = xs[int(len(xs) * 0.01)], xs[int(len(xs) * 0.99)]
    y0, y1 = ys[int(len(ys) * 0.01)], ys[int(len(ys) * 0.99)]
    bw, bh = max(1, x1 - x0 + 1), max(1, y1 - y0 + 1)
    grid = [0.0] * (size * size)
    for x, y in pts:
        if x0 <= x <= x1 and y0 <= y <= y1:
            gx = min(size - 1, (x - x0) * size // bw)
            gy = min(size - 1, (y - y0) * size // bh)
            grid[gy * size + gx] += 1
    tot = sum(grid) or 1
    return [v / tot for v in grid]


def median(vals, default):
    vals = sorted(vals)
    return vals[len(vals) // 2] if vals else default


def process(exam_id):
    import math
    kdir = os.path.join(PNG_DIR, f'{exam_id}__key')
    ocr_path = os.path.join(OUT_DIR, f'{exam_id}__key.json')
    if not os.path.isdir(kdir) or not os.path.exists(ocr_path):
        return None
    page_ocr = json.load(open(ocr_path))['pages']
    tmpdir = tempfile.mkdtemp(prefix=f'grid-{exam_id}-')
    rows = []
    cells = []
    for pfile in sorted(os.listdir(kdir)):
        if not pfile.endswith('.png'):
            continue
        pk = pfile[:-4]
        path = os.path.join(kdir, pfile)
        w, h, px = load_gray(path)
        grid = detect_grid(w, h, px)
        if not grid:
            continue
        angle, hl, _ = grid
        t = math.tan(math.radians(angle))
        obs = [o for o in page_ocr.get(pk, []) if o['t'].strip()]
        num_obs = [o for o in obs if re.fullmatch(r'[0-9lIS]{1,3}\s*[\.,]?', o['t'].strip())]
        let_obs = [o for o in obs if re.fullmatch(r'[ABCD8]\.?', o['t'].strip())]
        num_x = median([o['x'] for o in num_obs], 0.06)
        let_x = median([o['x'] for o in let_obs if o['x'] > num_x + 0.03], num_x + 0.1)
        page_rows = {}
        for o in obs:
            cx = (o['x'] + o['w'] / 2) * w
            cy = (o['y'] + o['h'] / 2) * h
            yp = cy - cx * t
            r = next((i for i in range(len(hl) - 1) if hl[i] < yp < hl[i + 1]), None)
            if r is None:
                continue
            page_rows.setdefault(r, []).append(o)
        for r in range(len(hl) - 1):
            if hl[r + 1] - hl[r] < 14:
                continue
            items = sorted(page_rows.get(r, []), key=lambda o: o['x'])
            num_t, letter_t, rest = '', '', []
            for o in items:
                tt = o['t'].strip()
                if not num_t and not letter_t and not rest and re.fullmatch(r'[0-9lIiSsOoBZ|]{1,3}\s*[\.,]?', tt) and o['x'] < let_x - 0.01:
                    num_t = tt
                elif not letter_t and not rest and re.fullmatch(r'[ABCD8]\.?', tt):
                    letter_t = tt
                elif re.fullmatch(r'([0-9]{1,3})\s*[\.,]?\s*([ABCD])', tt) and not num_t:
                    mm = re.fullmatch(r'([0-9]{1,3})\s*[\.,]?\s*([ABCD])', tt)
                    num_t, letter_t = mm.group(1), mm.group(2)
                else:
                    rest.append(o)
            basis_t = ' '.join(o['t'].strip() for o in sorted(rest, key=lambda o: (round(o['y'], 3), o['x'])))
            if re.search(r'KLUCZ|Numer|Prawid|Podstawa|odpowied|kolejny|Odpowied', num_t + ' ' + basis_t):
                continue
            row = {'page': pk, 'row': r, 'numText': num_t, 'letterText': letter_t, 'basis': basis_t}
            has_num = re.fullmatch(r'\s*[0-9lIiSsOoBZ|]{1,3}\s*[\.,]?\s*', num_t) is not None
            has_letter = re.fullmatch(r'[ABCD8]\.?', letter_t.strip()) is not None
            starts_basis = re.match(r'^(art|argument|§|Art)', basis_t.strip()) is not None
            if not has_num and not has_letter and not starts_basis:
                # fałszywa linia tabeli (np. podkreślenie tekstu) – dokładamy podstawę do poprzedniego wiersza
                if basis_t and rows and rows[-1]['page'] == pk:
                    rows[-1]['basis'] = (rows[-1]['basis'] + ' ' + basis_t).strip()
                continue
            rows.append(row)
            if True:
                xc = let_x + 0.01
                y0 = (hl[r] + xc * w * t + 3) / h
                y1 = (hl[r + 1] + xc * w * t - 3) / h
                k = 72 / 250
                out = os.path.join(tmpdir, f'{pk}_{r:03d}.png')
                crop(path, ((let_x - 0.035) * w * k, y0 * h * k, (let_x + 0.065) * w * k, y1 * h * k), 4, out)
                cells.append((row, out))
    # Klasyfikacja liter: wzorce z wierszy, w których OCR rozpoznał literę, potem najbliższy sąsiad.
    feats = {}
    for row, path in cells:
        feats[id(row)] = glyph_features(path)
    labeled = []
    for row, path in cells:
        lt = row['letterText'].strip().upper().replace('8', 'B').rstrip('.')
        if lt in ('A', 'B', 'C', 'D') and feats[id(row)] is not None:
            labeled.append((lt, feats[id(row)]))
    for row, path in cells:
        lt = row['letterText'].strip().upper().replace('8', 'B').rstrip('.')
        f = feats[id(row)]
        if f is None or not labeled:
            continue
        dists = sorted((sum(abs(a - b) for a, b in zip(f, g)), l) for l, g in labeled)
        top = [l for _, l in dists[:5]]
        guess = max(set(top), key=top.count)
        if lt not in ('A', 'B', 'C', 'D'):
            row['letterText'] = guess
            row['template'] = True
        elif guess != lt and top.count(guess) >= 4:
            row['conflict'] = guess
    # Numeracja: numery odczytane przez OCR są kotwicami; wiersze między kotwicami uzgadniamy.
    for row in rows:
        row['p'] = None
        m = re.match(r'^\s*([0-9lIiSsOoBZ|]{1,3})\s*[\.,]?\s*$', row['numText'])
        if m:
            fixed = m.group(1).translate(NUM_FIX)
            if fixed.isdigit():
                row['p'] = int(fixed)
    # kotwice muszą rosnąć – odrzucamy odczyty niepasujące do sąsiadów
    anchors = [i for i, r in enumerate(rows) if r['p'] is not None]
    last_good = 0
    for k, i in enumerate(anchors):
        nxt_vals = [rows[j]['p'] for j in anchors[k + 1:k + 4] if rows[j]['p'] is not None]
        p_val = rows[i]['p']
        ok = p_val > last_good and (not nxt_vals or p_val < max(nxt_vals))
        if ok:
            last_good = p_val
        else:
            rows[i]['p'] = None
    cleaned = []
    seg_start_n = 0
    pending = []

    def flush(next_n):
        expected = next_n - seg_start_n - 1
        seg = list(pending)
        while len(seg) > expected >= 0:
            # nadmiarowy wiersz: najpierw bez litery, potem bez „art.” na początku podstawy
            cand = [r for r in seg if not re.fullmatch(r'[ABCD8]\.?', r['letterText'].strip())] or \
                   [r for r in seg if not re.match(r'^(art|Art|argument)', r['basis'])] or [seg[-1]]
            drop = cand[-1]
            idx = cleaned.index(drop) if drop in cleaned else -1
            seg.remove(drop)
            if idx > 0:
                cleaned[idx - 1]['basis'] = (cleaned[idx - 1]['basis'] + ' ' + drop['basis']).strip()
                cleaned.pop(idx)
        uncertain = len(seg) != expected
        for j, r in enumerate(seg):
            r['n'] = seg_start_n + 1 + j
            if uncertain:
                r['uncertain'] = True
                r['inferred'] = True
            elif r['p'] is None:
                r['inferred'] = True

    for r in rows:
        if r['p'] is not None and r['p'] > seg_start_n:
            flush(r['p'])
            pending.clear()
            r['n'] = r['p']
            cleaned.append(r)
            seg_start_n = r['p']
        else:
            pending.append(r)
            cleaned.append(r)
    flush(seg_start_n + len(pending) + 1)
    rows[:] = [r for r in cleaned if 'n' in r]

    for row in rows:
        lt = row['letterText'].strip().upper().replace('8', 'B').rstrip('.')
        row['letter'] = lt if lt in ('A', 'B', 'C', 'D') else None
    out = {'id': exam_id, 'rows': rows}
    json.dump(out, open(os.path.join(OUT_DIR, f'{exam_id}__keygrid.json'), 'w'), ensure_ascii=False, indent=0)
    missing = [r['n'] for r in rows if r['letter'] is None]
    unc = [r['n'] for r in rows if r.get('uncertain')]
    return f"{exam_id}: wierszy {len(rows)} (ostatni nr {rows[-1]['n'] if rows else 0}), bez litery {len(missing)} {missing[:12]}, niepewne {len(unc)} {unc[:12]}, konflikty {[r['n'] for r in rows if r.get('conflict')]}"


for eid in IDS:
    print(process(eid), flush=True)
