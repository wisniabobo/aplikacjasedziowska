import fitz, glob, os, subprocess, sys, json
from concurrent.futures import ThreadPoolExecutor
SP = sys.argv[1]
raw = os.path.join(SP, 'raw/kssip'); png = os.path.join(SP, 'png'); out = os.path.join(SP, 'ocr')
os.makedirs(out, exist_ok=True)
def job(f):
    name = os.path.basename(f)[:-4]
    dst = os.path.join(out, name + '.json')
    if os.path.exists(dst): return name + ' (cached)'
    d = fitz.open(f)
    if sum(len(p.get_text().strip()) for p in d) > 200 * d.page_count:  # has text layer
        res = {f'p{i:03d}': [{'t': l, 'x': 0, 'y': j, 'w': 0, 'h': 0, 'c': 1} for j, l in enumerate(p.get_text().split('\n'))] for i, p in enumerate(d)}
        json.dump({'source': 'text', 'pages': res}, open(dst, 'w')); return name + ' (text)'
    pdir = os.path.join(png, name); os.makedirs(pdir, exist_ok=True)
    imgs = []
    for i, p in enumerate(d):
        ip = os.path.join(pdir, f'p{i:03d}.png')
        if not os.path.exists(ip):
            p.get_pixmap(dpi=250, colorspace=fitz.csGRAY).save(ip)
        imgs.append(ip)
    tmp = dst + '.tmp'
    subprocess.run([os.path.join(SP, 'tools/ocr'), tmp] + imgs, check=True)
    r = json.load(open(tmp)); os.remove(tmp)
    pages = {os.path.basename(k)[:-4]: v for k, v in r.items()}
    json.dump({'source': 'ocr', 'pages': pages}, open(dst, 'w'))
    return name + f' ({len(imgs)} p)'
files = sorted(glob.glob(os.path.join(raw, '*.pdf')))
files = [f for f in files if '__report' not in f]
with ThreadPoolExecutor(4) as ex:
    for r in ex.map(job, files): print(r, flush=True)
print('DONE')
