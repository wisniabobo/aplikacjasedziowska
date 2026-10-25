#!/usr/bin/env python3
"""
Parsuje wyniki OCR (macOS Vision, zob. ocr.swift) oficjalnych testów KSSiP
i kluczy odpowiedzi do public/data/exams/<id>.json.

Użycie:
  python3 -I tools/ocr/parse_exams.py <katalog_ocr> <repo>

Katalog OCR zawiera pliki <id>__test.json i <id>__key.json wygenerowane przez ocr_all.py.
Poprawki ręczne (po weryfikacji ze skanem) są w tools/ocr/corrections.json.
"""
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

OCR_DIR = sys.argv[1]
REPO = sys.argv[2]
ACTS_DIR = os.path.join(REPO, 'public/data/acts')
OUT_DIR = os.path.join(REPO, 'public/data/exams')
MANIFEST = json.load(open(os.path.join(REPO, 'scripts/sources/kssip-manifest.json'), encoding='utf-8'))
CORR_PATH = os.path.join(REPO, 'tools/ocr/corrections.json')
CORRECTIONS = json.load(open(CORR_PATH, encoding='utf-8')) if os.path.exists(CORR_PATH) else {}

SUP = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')

# ---------------------------------------------------------------- słownik z tekstów ustaw
WORD_RE = re.compile(r"[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+")
vocab = Counter()
act_articles = {}
for fn in os.listdir(ACTS_DIR):
    if not fn.endswith('.json') or fn in ('index.json', 'updated.json'):
        continue
    doc = json.load(open(os.path.join(ACTS_DIR, fn), encoding='utf-8'))
    slug = fn[:-5]
    act_articles[slug] = {a['num'] for a in doc['articles']}
    for a in doc['articles']:
        for ln in a['lines']:
            for w in WORD_RE.findall(ln['text']):
                vocab[w.lower()] += 1
        if a.get('title'):
            for w in WORD_RE.findall(a['title']):
                vocab[w.lower()] += 1
# Słowa częste w pytaniach, a rzadkie w ustawach.
for w in ('zgodnie', 'prawidłowa', 'odpowiedź', 'który', 'która', 'które', 'których', 'można', 'jest', 'są', 'się',
          'ustawą', 'kodeksem', 'konstytucją', 'traktatem', 'konwencją', 'wyłącznie', 'również', 'także', 'również'):
    vocab[w] += 1000

CONF = {
    'l': ['ł'], 't': ['ł'], 'a': ['ą'], 'e': ['ę'], 'o': ['ó'], 's': ['ś'], 'c': ['ć'], 'n': ['ń'],
    'z': ['ż', 'ź'], 'ł': ['l'], 'ą': ['a'], 'ę': ['e'], 'ó': ['o'], 'i': ['ł', 'l'], '1': ['l', 'ł'],
}


def candidates(word, depth=2):
    out = {word}
    frontier = {word}
    for _ in range(depth):
        nxt = set()
        for w in frontier:
            for i, ch in enumerate(w):
                for rep in CONF.get(ch, []):
                    nxt.add(w[:i] + rep + w[i + 1:])
        out |= nxt
        frontier = nxt
    return out


def match_case(src, dst):
    if src.isupper() and len(src) > 1:
        return dst.upper()
    if src[:1].isupper():
        return dst[:1].upper() + dst[1:]
    return dst


fix_cache = {}


def fix_word(w):
    lw = w.lower()
    if len(lw) < 3 or vocab.get(lw, 0) > 0:
        return w
    if lw in fix_cache:
        return match_case(w, fix_cache[lw]) if fix_cache[lw] else w
    best, best_n = None, 0
    for c in candidates(lw):
        n = vocab.get(c, 0)
        if n > best_n:
            best, best_n = c, n
    fix_cache[lw] = best
    return match_case(w, best) if best else w


def fix_text(s):
    s = unicodedata.normalize('NFC', s)
    s = re.sub(r'^Zgodnie\s+[^\sA-Za-ząćęłńóśźż]{1,2}\s*(?=ustaw|Kodeks|Konstytuc|Traktat|Konwencj|z\s)', 'Zgodnie z ', s)
    s = re.sub(r'^Zgodnie\s+z\.\s+', 'Zgodnie z ', s)
    s = s.replace('„ ', '„').replace(' ”', '”').replace('“', '”')
    s = re.sub(r'\s+([,.;:)])', r'\1', s)
    s = re.sub(r'([(„])\s+', r'\1', s)
    return WORD_RE.sub(lambda m: fix_word(m.group(0)), s).strip()


# ---------------------------------------------------------------- linie z OCR
WATERMARK_RE = re.compile(r'(N?[ALI]?ABÓR\s*KSS|KSSi[PDA]\b.*KSS|ABÓR KSS|OMINCIVA|RIDL\b)')


CONFUSABLES = str.maketrans({
    'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X',
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'к': 'k', 'і': 'i',
    'ä': 'a', 'ö': 'ó', 'ü': 'u', 'é': 'ć', 'è': 'e', 'ë': 'e', 'ï': 'i', 'î': 'i', 'â': 'a', 'ô': 'ó', 'ÿ': 'y',
})


def normalize_ocr(t):
    return t.translate(CONFUSABLES)


def page_lines(page):
    """Łączy obserwacje Vision w linie (po środku wysokości) i sortuje."""
    obs = [o for o in page if o['t'].strip() and not WATERMARK_RE.search(o['t']) and not (o['c'] < 0.45 and len(o['t']) < 30)]
    obs.sort(key=lambda o: (o['y'] + o['h'] / 2, o['x']))
    lines = []
    for o in obs:
        cy = o['y'] + o['h'] / 2
        if lines and abs(lines[-1]['cy'] - cy) < max(o['h'], lines[-1]['h']) * 0.45:
            lines[-1]['parts'].append(o)
            n = len(lines[-1]['parts'])
            lines[-1]['cy'] = (lines[-1]['cy'] * (n - 1) + cy) / n
        else:
            lines.append({'cy': cy, 'h': o['h'], 'parts': [o]})
    out = []
    for ln in lines:
        parts = sorted(ln['parts'], key=lambda o: o['x'])
        out.append({
            'x': parts[0]['x'],
            'y': ln['cy'],
            'h': ln['h'],
            'conf': min(p['c'] for p in parts),
            'parts': parts,
            't': normalize_ocr(' '.join(p['t'].strip() for p in parts)),
        })
    return out


QNUM_RE = re.compile(r'^(\d{1,3})\s*[\.,;:]\s*(.*)$')
OPT_RE = re.compile(r'^([ABC8])\s*[\.\),:;]\s*(.*)$')


def norm_option_letter(ch, expected):
    ch = ch.upper()
    if ch == '8':
        ch = 'B'
    return ch if ch in 'ABC' else expected


def is_noise(ln, text):
    t = text.strip()
    if re.fullmatch(r'[-–\s]*\d{1,2}[-–\s]*', t):  # numer strony
        return True
    if re.fullmatch(r'(Strona|str\.)\s*\d+\s*(z|/)\s*\d+', t, re.I):
        return True
    if ln['x'] > 0.88 and len(t) < 25:  # pieczątki, dopiski na marginesie
        return True
    if ln['conf'] < 0.35 and len(t) < 12:
        return True
    return False


NUM_FIX = str.maketrans({'l': '1', 'I': '1', 'i': '1', 'S': '5', 's': '5', 'O': '0', 'o': '0', 'B': '8', 'Z': '2', 'z': '2'})
QNUM_LOOSE = re.compile(r'^([0-9lIiSsOoBZz]{1,3})\s*[\.,;:]\s*(.*)$')


def qnum(text, expected):
    m = QNUM_LOOSE.match(text)
    if not m:
        return None
    raw = m.group(1)
    if not any(ch.isdigit() for ch in raw) and not (expected == 1 and raw in ('l', 'I')):
        return None  # „B.” to odpowiedź, nie pytanie nr 8
    fixed = raw.translate(NUM_FIX)
    if not fixed.isdigit():
        return None
    n = int(fixed)
    if raw.isdigit() or n == expected:
        return n, m.group(2).strip()
    return None


def all_lines(ocr):
    out = []
    for pk in sorted(ocr['pages']):
        for ln in page_lines(ocr['pages'][pk]):
            text = ln['t'].strip()
            if not is_noise(ln, text):
                ln['t'] = text
                ln['page'] = pk
                out.append(ln)
    return out


def parse_test(ocr):
    lines = all_lines(ocr)
    start = None
    for i, ln in enumerate(lines):
        r = qnum(ln['t'], 1)
        if r and r[0] == 1:
            for nxt in lines[i + 1:i + 10]:
                mo = OPT_RE.match(nxt['t'])
                if mo and mo.group(1) == 'A' and nxt['x'] > ln['x'] - 0.02:
                    start = i
                    break
        if start is not None:
            break
    if start is None:
        return []
    q_x = lines[start]['x']
    opt_xs = sorted(l['x'] for l in lines[start:] if OPT_RE.match(l['t']) and l['x'] > q_x - 0.02)
    opt_x = opt_xs[len(opt_xs) // 2] if opt_xs else q_x + 0.045
    questions = []
    cur = None
    cur_field = None
    expected = 1
    for ln in lines[start:]:
        text = ln['t']
        r = qnum(text, expected)
        new_q = None
        if r and abs(ln['x'] - q_x) < 0.05 and expected <= r[0] <= expected + 2 and (cur is None or cur_field == 'C' or r[0] == expected):
            new_q = r
        elif cur is not None and cur_field == 'C' and cur['a'][2] and ln['x'] < opt_x - 0.006:
            # numer pytania nie został rozpoznany przez OCR – nowe pytanie rozpoznajemy po wcięciu
            stripped = re.sub(r'^[0-9lIiSsOo]{1,3}\s*[\.,;:]\s*', '', text)
            new_q = (expected, stripped)
        if new_q:
            cur = {'n': new_q[0], 'q': new_q[1], 'a': ['', '', '']}
            questions.append(cur)
            cur_field = 'q'
            expected = new_q[0] + 1
            continue
        if cur is None:
            continue
        mo = OPT_RE.match(text)
        want = 'A' if cur_field == 'q' else ('B' if cur_field == 'A' else 'C')
        if mo and ln['x'] > q_x - 0.02 and cur_field != 'C':
            letter = norm_option_letter(mo.group(1), want)
            if letter == want:
                cur_field = letter
                cur['a']['ABC'.index(letter)] = mo.group(2).strip()
                continue
        if cur_field == 'q':
            cur['q'] = join(cur['q'], text)
        elif cur_field in ('A', 'B', 'C'):
            i = 'ABC'.index(cur_field)
            cur['a'][i] = join(cur['a'][i], text)
    return questions


INLINE_RE = re.compile(r'\s([ABC])[\.\)]\s')


def split_inline(q):
    """Odpowiedzi zlane w jedną linię („… A. x, B. y, C. z”) rozdzielamy na trzy pola."""
    if not q['a'][0]:
        m = re.search(r'\sA[\.\)]\s(.+?)\sB[\.\)]\s(.+?)\sC[\.\)]\s(.+)$', q['q'])
        if m:
            q['q'] = q['q'][:m.start()].strip()
            q['a'] = [m.group(1).strip(), m.group(2).strip(), m.group(3).strip()]
            return q
    for i, nxt in ((0, 'B'), (1, 'C')):
        if q['a'][i] and not q['a'][i + 1]:
            m = re.search(rf'\s{nxt}[\.\)]\s', ' ' + q['a'][i])
            if m:
                full = ' ' + q['a'][i]
                head, tail = full[:m.start()].strip(), full[m.end():].strip()
                q['a'][i] = head
                if i == 0 and not q['a'][2]:
                    m2 = re.search(r'\sC[\.\)]\s', ' ' + tail)
                    if m2:
                        t2 = ' ' + tail
                        q['a'][1], q['a'][2] = t2[:m2.start()].strip(), t2[m2.end():].strip()
                        continue
                q['a'][i + 1] = tail
    return q


def join(a, b):
    if not a:
        return b
    if a.endswith('-') and b[:1].islower():
        return a[:-1] + b
    return a + ' ' + b


PNG_DIR = os.environ.get('OCR_PNG_DIR')
OCR_BIN = os.environ.get('OCR_BIN')


def median(vals, default):
    vals = sorted(vals)
    return vals[len(vals) // 2] if vals else default


def parse_key_text(ocr):
    """Klucz z warstwą tekstową (linie w kolejności)."""
    rows = {}
    n = None
    for pk in sorted(ocr['pages']):
        for o in ocr['pages'][pk]:
            t = o['t'].strip()
            if not t:
                continue
            m = re.fullmatch(r'(\d{1,3})\.?', t)
            if m:
                n = int(m.group(1))
                rows[n] = [None, '']
                continue
            if n is None:
                continue
            if re.fullmatch(r'[ABC]', t) and rows[n][0] is None:
                rows[n][0] = t
            elif rows[n][0] is not None or t.startswith('art'):
                rows[n][1] = (rows[n][1] + ' ' + t).strip()
    return {k: (v[0], v[1], v[0] is not None) for k, v in rows.items()}


def reocr_letters(exam_id, cells):
    """Ponowny OCR wyciętych komórek z literą odpowiedzi (Vision gubi pojedyncze litery)."""
    if not (PNG_DIR and OCR_BIN and cells):
        return {}
    import subprocess
    import tempfile
    import fitz
    tmp = tempfile.mkdtemp(prefix='keycells-')
    paths = {}
    for i, (key, pk, x0, y0, x1, y1) in enumerate(cells):
        img = os.path.join(PNG_DIR, f'{exam_id}__key', f'{pk}.png')
        if not os.path.exists(img):
            continue
        doc = fitz.open(img)
        page = doc[0]
        w, h = page.rect.width, page.rect.height
        clip = fitz.Rect(max(0, x0) * w, max(0, y0) * h, min(1, x1) * w, min(1, y1) * h)
        pix = page.get_pixmap(clip=clip, matrix=fitz.Matrix(4, 4))
        out = os.path.join(tmp, f'c{i}.png')
        pix.save(out)
        paths[out] = key
    if not paths:
        return {}
    res_path = os.path.join(tmp, 'res.json')
    subprocess.run([OCR_BIN, res_path] + list(paths), check=True)
    res = json.load(open(res_path))
    found = {}
    for img, obs in res.items():
        txt = ' '.join(o['t'] for o in obs).strip().upper().replace('8', 'B')
        m = re.search(r'\b([ABC])\b', txt) or re.fullmatch(r'([ABC])\.?', txt)
        if m:
            found[paths[img]] = m.group(1)
    return found


def parse_key(ocr, exam_id=''):
    """Zwraca {n: (litera, podstawa)} z tabeli klucza."""
    if ocr.get('source') == 'text':
        return parse_key_text(ocr)
    all_obs = []
    for pk in sorted(ocr['pages']):
        for o in ocr['pages'][pk]:
            if o['t'].strip() and not WATERMARK_RE.search(o['t']):
                all_obs.append((pk, o))
    num_x = median([o['x'] for _, o in all_obs if re.fullmatch(r'\d{1,3}\.?', o['t'].strip())], 0.08)
    let_x = median([o['x'] for _, o in all_obs if re.fullmatch(r'[ABC]\.?', o['t'].strip())], num_x + 0.09)
    bas_x = median([o['x'] for _, o in all_obs if o['t'].strip().lower().startswith('art')], let_x + 0.07)
    rows = []  # (pk, y, num|None, letter|None, h)
    basis = []
    for pk, o in all_obs:
        t = o['t'].strip()
        cy = o['y'] + o['h'] / 2
        if o['y'] < 0.12 and re.search(r'KLUCZ|Numer|Prawid|Podstawa|odpowied|kolejny|pytania|Odpowied', t):
            continue
        if abs(o['x'] - num_x) < 0.035 and len(t) <= 5:
            mm = re.match(r'^([0-9lIiSs]{1,3})\s*[\.,]?\s*([ABC])?$', t)
            num = None
            letter = None
            if mm:
                raw = mm.group(1).translate(NUM_FIX)
                num = int(raw) if raw.isdigit() else None
                letter = mm.group(2)
            rows.append([pk, cy, num, letter, o['h']])
        elif abs(o['x'] - let_x) < 0.04 and re.fullmatch(r'[ABC8]\.?', t):
            rows.append([pk, cy, None, 'B' if t[0] == '8' else t[0], o['h']])
        elif o['x'] >= bas_x - 0.05:
            basis.append((pk, o['y'], cy, t))
    # scalanie wierszy o tym samym y
    rows.sort(key=lambda r: (r[0], r[1]))
    merged = []
    for r in rows:
        if merged and merged[-1][0] == r[0] and abs(merged[-1][1] - r[1]) < max(r[4], 0.008) * 0.8:
            m = merged[-1]
            m[2] = m[2] if m[2] is not None else r[2]
            m[3] = m[3] if m[3] is not None else r[3]
        else:
            merged.append(list(r))
    # numeracja: uzupełniamy brakujące numery na podstawie kolejności
    prev = 0
    for r in merged:
        r.append(r[2] is not None and prev < r[2] <= prev + 3)  # r[5] – numer odczytany przez OCR
        if r[2] is None or r[2] != prev + 1:
            if r[2] is None or not (prev < r[2] <= prev + 3):
                r[2] = prev + 1
        prev = r[2]
    out = {}
    cells = []
    for i, r in enumerate(merged):
        pk, cy = r[0], r[1]
        nxt = merged[i + 1] if i + 1 < len(merged) else None
        hi = nxt[1] if nxt and nxt[0] == pk else 2.0
        lo = cy - 0.012
        b = [t for (bpk, y, by, t) in sorted(basis) if bpk == pk and lo <= by < hi - 0.004]
        out[r[2]] = (r[3], ' '.join(b), bool(r[5]) and r[3] is not None)
        if r[3] is None:
            cells.append((r[2], pk, let_x - 0.03, cy - 0.013, let_x + 0.06, cy + 0.013))
    if cells:
        fixed = reocr_letters(exam_id, cells)
        for n, letter in fixed.items():
            out[n] = (letter, out[n][1], False)
    return out


# ---------------------------------------------------------------- podstawa prawna → odnośniki
ACT_PATTERNS = [
    (r'\bk\.?\s?p\.?\s?c\b', 'kpc'), (r'\bk\.?\s?c\b', 'kc'), (r'\bk\.?\s?r\.?\s?o\b', 'kro'),
    (r'\bk\.?\s?p\.?\s?k\b', 'kpk'), (r'\bk\.?\s?p\.?\s?s\.?\s?w\b', 'kpsw'), (r'\bk\.?\s?k\.?\s?s\b', 'kks'),
    (r'\bk\.?\s?k\b', 'kk'), (r'\bk\.?\s?w\b', 'kw'), (r'\bk\.?\s?p\.?\s?a\b', 'kpa'), (r'\bk\.?\s?s\.?\s?h\b', 'ksh'),
    (r'\bp\.?\s?p\.?\s?s\.?\s?a\b', 'ppsa'), (r'\bk\.?\s?p\b', 'kp'),
    (r'Konstytucj', 'konstytucja'), (r'ustroju sądów powszechnych|u\.?s\.?p\b', 'usp'), (r'Sądzie Najwyższym', 'sn'),
    (r'o prokuraturze', 'prok'), (r'księgach wieczystych', 'ukwh'), (r'kosztach sądowych w sprawach cywilnych', 'uksc'),
    (r'Krajowym Rejestrze Sądowym', 'krs'), (r'samorządzie gminnym', 'usg'), (r'Rzeczniku Praw Obywatelskich', 'rpo'),
    (r'Rzeczniku Praw Dziecka', 'rpd'), (r'ochronie zwierząt', 'ochrona-zwierzat'),
    (r'rozwiązywania z pracownikami', 'zwolnienia-grupowe'), (r'skardze na naruszenie prawa strony', 'przewleklosc'),
    (r'\bTFUE\b|funkcjonowaniu Unii', 'tfue'), (r'\bTUE\b|Traktatu o Unii', 'tue'),
    (r'Konwencji o Ochronie Praw|EKPC|Konwencji o ochronie praw', 'ekpc'),
    (r'Krajowej Szkole Sądownictwa', 'kssip'),
]
COMPILED = [(re.compile(p, re.I), slug) for p, slug in ACT_PATTERNS]


def resolve_article(slug, raw):
    arts = act_articles.get(slug)
    raw = raw.replace("'", '¹').replace('’', '¹').replace('`', '¹')
    if arts is None:
        return raw
    if raw in arts:
        return raw
    m = re.match(r'^(\d+)([a-z]{0,3})$', raw)
    if m:
        digits, letters = m.group(1), m.group(2)
        for cut in range(1, min(3, len(digits))):
            base, sup = digits[:-cut], digits[-cut:]
            cand = base + letters + sup.translate(SUP)
            if cand in arts:
                return cand
            cand = base + sup.translate(SUP)
            if cand in arts:
                return cand
    return raw


def parse_basis(text):
    refs = []
    if not text:
        return refs
    # dzielimy po „art.”
    for seg in re.split(r'(?=\bart\.)', text):
        m = re.match(r'art\.\s*([0-9]+[a-z]{0,3}[¹²³⁴⁵⁶⁷⁸⁹\']*)', seg)
        if not m:
            continue
        slug = None
        for rx, s in COMPILED:
            if rx.search(seg):
                slug = s
                break
        if slug is None:
            # odwołanie do aktu z dalszej części tekstu („art. 5 i art. 7 kc”)
            for rx, s in COMPILED:
                if rx.search(text[text.find(seg):]):
                    slug = s
                    break
        if slug is None:
            continue
        num = resolve_article(slug, m.group(1))
        refs.append({'act': slug, 'art': num})
    uniq = []
    for r in refs:
        if r not in uniq:
            uniq.append(r)
    return uniq


Q_ACT = [
    (r'Kodeks(?:em|u)? postępowania cywilnego', 'kpc'), (r'Kodeks(?:em|u)? rodzinn', 'kro'),
    (r'Kodeks(?:em|u)? postępowania karnego', 'kpk'), (r'Kodeks(?:em|u)? karn(?:ym|ego) skarbow', 'kks'),
    (r'Kodeks(?:em|u)? postępowania w sprawach o wykroczenia', 'kpsw'), (r'Kodeks(?:em|u)? wykroczeń', 'kw'),
    (r'Kodeks(?:em|u)? postępowania administracyjnego', 'kpa'), (r'Kodeks(?:em|u)? spółek handlowych', 'ksh'),
    (r'Kodeks(?:em|u)? karn', 'kk'), (r'Kodeks(?:em|u)? pracy', 'kp'), (r'Kodeks(?:em|u)? cywiln', 'kc'),
    (r'ustroju sądów powszechnych', 'usp'), (r'o prokuraturze', 'prok'), (r'Sądzie Najwyższym', 'sn'),
    (r'księgach wieczystych', 'ukwh'), (r'kosztach sądowych w sprawach cywilnych', 'uksc'),
    (r'Krajowym Rejestrze Sądowym', 'krs'), (r'samorządzie gminnym', 'usg'),
    (r'postępowaniu przed sądami administracyjnymi', 'ppsa'), (r'Traktat(?:em|u)? o funkcjonowaniu', 'tfue'),
    (r'Traktat(?:em|u)? o Unii', 'tue'), (r'Konwencj[aąi] o [Oo]chronie [Pp]raw', 'ekpc'),
    (r'Rzeczniku Praw Obywatelskich', 'rpo'), (r'Rzeczniku Praw Dziecka', 'rpd'), (r'ochronie zwierząt', 'ochrona-zwierzat'),
    (r'Konstytucj', 'konstytucja'),
]
Q_ACT_RE = [(re.compile(p), s) for p, s in Q_ACT]


def question_act(q):
    head = q[:160]
    for rx, slug in Q_ACT_RE:
        if rx.search(head):
            return slug
    return None


def load_grid(exam_id):
    path = os.path.join(OCR_DIR, f'{exam_id}__keygrid.json')
    if not os.path.exists(path):
        return {}
    out = {}
    for r in json.load(open(path))['rows']:
        out[r['n']] = r
    return out


def fix_basis(text):
    t = text.replace('$', '§').replace('Ş', '§')
    t = re.sub(r'(?<=\d) 8 (?=\d)', ' § ', t)  # „157 8 2” → „157 § 2”
    t = re.sub(r'\s+', ' ', t)
    return t.strip()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    index = []
    report = []
    for e in MANIFEST['exams']:
        tp = os.path.join(OCR_DIR, f"{e['id']}__test.json")
        kp = os.path.join(OCR_DIR, f"{e['id']}__key.json")
        if not (os.path.exists(tp) and os.path.exists(kp)):
            continue
        qs = [split_inline(q) for q in parse_test(json.load(open(tp))) if q['n'] <= 150]
        key = parse_key(json.load(open(kp)), e['id'])
        corr = CORRECTIONS.get(e['id'], {})
        out_q = []
        missing_key = []
        grid = load_grid(e['id'])
        for q in qs:
            n = q['n']
            a_letter, a_basis, a_anchored = key.get(n, (None, '', False))
            g = grid.get(n)
            g_ok = bool(g and g.get('letter') and not g.get('uncertain') and not g.get('conflict'))
            g_letter = g.get('letter') if g and not g.get('uncertain') else None
            status = None
            letter = None
            if a_letter and g_letter and a_letter == g_letter:
                letter, status = a_letter, 'zgodne'
            elif g_ok:
                letter, status = g_letter, 'siatka'
            elif a_letter:
                letter, status = a_letter, 'ocr-kotwica' if a_anchored else 'ocr'
            elif g_letter:
                letter, status = g_letter, 'siatka-konflikt'
            basis = (g.get('basis') if g and g.get('basis', '').strip().lower().startswith(('art', 'argument')) else '') or a_basis
            c = corr.get(str(n), {})
            if 'correct' in c:
                letter, status = c['correct'], 'ręcznie'
            if letter is None:
                missing_key.append(n)
            basis = fix_basis(c.get('basis', basis))
            refs = parse_basis(basis)
            qtext = c.get('q', fix_text(q['q']))
            qa = question_act(qtext)
            ba = refs[0]['act'] if refs else None
            act_mismatch = bool(qa and ba and qa != ba and not any(r['act'] == qa for r in refs))
            if letter is None:
                verified = False
            elif status in ('zgodne', 'siatka', 'ręcznie'):
                verified = True
            elif status == 'ocr-kotwica':
                verified = not act_mismatch
            else:
                verified = bool(qa and ba and qa == ba)
            item = {
                'n': n,
                'q': qtext,
                'a': c.get('a', [fix_text(x) for x in q['a']]),
                'correct': letter,
                'keyVerified': bool(verified),
                'keySource': status,
                'basis': basis,
                'refs': refs,
            }
            if c.get('cancelled'):
                item['cancelled'] = True
            out_q.append(item)
        bad = [q['n'] for q in out_q if not q['q'] or any(not a for a in q['a'])]
        nums = {q['n'] for q in out_q}
        expected_total = max(nums) if nums else 0
        gaps = [n for n in range(1, expected_total + 1) if n not in nums]
        nver = sum(1 for q in out_q if q['keyVerified'])
        report.append(f"{e['id']}: pytań {len(out_q)}, luki {gaps[:6]}, niepełne {len(bad)} {bad[:6]}, bez klucza {len(missing_key)}, zweryfikowane {nver}")
        exam = {
            'id': e['id'],
            'year': e['year'],
            'kind': e['kind'],
            'label': e['label'],
            'durationMin': 150,
            'source': {
                'page': MANIFEST['base'] + e['page'],
                'test': MANIFEST['base'] + e['test'],
                'key': MANIFEST['base'] + e['key'],
            },
            'questions': out_q,
        }
        json.dump(exam, open(os.path.join(OUT_DIR, f"{e['id']}.json"), 'w', encoding='utf-8'), ensure_ascii=False)
        index.append({'id': e['id'], 'year': e['year'], 'kind': e['kind'], 'label': e['label'], 'count': len(out_q),
                      'withKey': sum(1 for q in out_q if q['correct']), 'verified': nver})
    index.sort(key=lambda x: (-x['year'], x['kind']))
    json.dump(index, open(os.path.join(OUT_DIR, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n'.join(report))


if __name__ == '__main__':
    main()
