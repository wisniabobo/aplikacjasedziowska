#!/usr/bin/env python3
"""
Zamienia OCR zadań II etapu (kazusy) i opisów kryteriów oceny na public/data/casus/*.json.

Użycie: python3 -I tools/ocr/parse_casus.py <katalog_ocr> <repo>
"""
import json
import os
import re
import sys

sys.argv = [sys.argv[0], sys.argv[1], sys.argv[2]]
OCR_DIR, REPO = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
# wspólne narzędzia (słownik do korekty diakrytyków, łączenie linii)
_src = open(os.path.join(HERE, 'parse_exams.py'), encoding='utf-8').read().split('def main():')[0]
exec(compile(_src, 'parse_exams', 'exec'))

OUT = os.path.join(REPO, 'public/data/casus')
os.makedirs(OUT, exist_ok=True)

HEAD_RE = re.compile(r'^(ZADANIE|Zadanie|KAZUS|Kazus|Kryteria oceny|KRYTERIA OCENY|Opis kryteriów)\s*(nr\s*)?([0-9IVX]+|z prawa\s+\w+|\w+)?', re.I)
AREA_RE = re.compile(r'prawa\s+(prywatnego|publicznego|karnego|cywilnego|administracyjnego)', re.I)


def doc_paragraphs(ocr):
    paras = []
    for pk in sorted(ocr['pages']):
        lines = page_lines(ocr['pages'][pk]) if ocr.get('source') == 'ocr' else [
            {'x': 0, 'y': i, 'h': 1, 'conf': 1, 't': o['t']} for i, o in enumerate(ocr['pages'][pk])]
        prev = None
        for ln in lines:
            t = ln['t'].strip()
            if not t or is_noise(ln, t):
                continue
            if re.fullmatch(r'[-–\s]*\d{1,2}[-–\s]*', t):
                continue
            new_para = prev is None
            if prev is not None and ocr.get('source') == 'ocr':
                gap = ln['y'] - prev['y']
                if gap > max(prev['h'], ln['h']) * 2.1 or (ln['x'] - prev['x'] > 0.025 and prev['t'].rstrip().endswith(('.', ':', ';'))):
                    new_para = True
            if re.match(r'^(\d+[\.\)]|[a-z]\)|[–-]\s)', t):
                new_para = True
            if new_para or not paras:
                paras.append(t)
            else:
                paras[-1] = join(paras[-1], t)
            prev = ln
    return [fix_text(p) for p in paras if len(p) > 1]


def split_tasks(paras):
    tasks = []
    for p in paras:
        if HEAD_RE.match(p) and len(p) < 120:
            area = AREA_RE.search(p)
            tasks.append({'title': p.rstrip('.:'), 'area': area.group(1).lower() if area else None, 'paragraphs': []})
        elif tasks:
            tasks[-1]['paragraphs'].append(p)
        else:
            tasks.append({'title': 'Wprowadzenie', 'area': None, 'paragraphs': [p]})
    return tasks


def main():
    manifest = json.load(open(os.path.join(REPO, 'scripts/sources/kssip-manifest.json'), encoding='utf-8'))
    index = []
    for e in manifest['exams']:
        if not e.get('tasks'):
            continue
        tp = os.path.join(OCR_DIR, f"{e['id']}__tasks.json")
        if not os.path.exists(tp):
            continue
        tasks = split_tasks(doc_paragraphs(json.load(open(tp))))
        criteria = []
        for i, url in enumerate(e.get('criteria', [])):
            cp = os.path.join(OCR_DIR, f"{e['id']}__criteria{i}.json")
            if os.path.exists(cp):
                criteria.append({'source': manifest['base'] + url, 'parts': split_tasks(doc_paragraphs(json.load(open(cp))))})
        doc = {
            'id': e['id'],
            'year': e['year'],
            'kind': e['kind'],
            'label': e['label'].replace('Konkurs na', 'II etap – konkurs na'),
            'durationMin': 180,
            'tasks': tasks,
            'criteria': criteria,
            'source': {'page': manifest['base'] + e['page'], 'tasks': manifest['base'] + e['tasks']},
        }
        json.dump(doc, open(os.path.join(OUT, f"{e['id']}.json"), 'w', encoding='utf-8'), ensure_ascii=False)
        index.append({'id': e['id'], 'year': e['year'], 'kind': e['kind'], 'label': doc['label'],
                      'tasks': [t['title'] for t in tasks if t['title'] != 'Wprowadzenie'], 'hasCriteria': bool(criteria)})
        print(e['id'], len(tasks), [t['title'][:40] for t in tasks], 'kryteria:', len(criteria))
    index.sort(key=lambda x: -x['year'])
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


main()
