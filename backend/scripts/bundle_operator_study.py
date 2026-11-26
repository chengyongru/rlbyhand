"""Rebuild the lesson's public summary and a spreadsheet of all held-out predictions."""
import csv
import json
from pathlib import Path

from verify_operator_pairs import DEFAULT_DIR, SEEDS, verify


def bundle(directory=DEFAULT_DIR):
    stats = verify(directory)['seeds']
    data = {s: json.loads((directory / f'seed-{s}.json').read_text()) for s in SEEDS}
    primary = data[SEEDS[0]]
    runs = []
    for s, log in data.items():
        m = stats[str(s)]
        if [r['before'] for r in log['test']] != [r['before'] for r in primary['test']]:
            raise ValueError('Frozen model predictions differ across seeds')
        runs.append(dict(seed=s, before=m['before_correct'], after=m['after_correct'],
                         improved=m['wrong_to_right'], regressed=m['right_to_wrong'],
                         p_value=m['mcnemar_p'], ci_pp=[100*x for x in m['bootstrap_ci95']],
                         curve=log['curve']))
    with (directory / 'test-pairs.csv').open('w', newline='') as f:
        writer = csv.writer(f, lineterminator='\n')
        writer.writerow(['id','a','b','c','target','gold','before',*(f'after_{s}' for s in SEEDS)])
        for i, r in enumerate(primary['test']):
            a,b,c,t = (r[k] for k in ('a','b','c','target'))
            gold = ['+','-','*'][(a+b+c, a-b+c, a*b+c).index(t)]
            writer.writerow([i+1,a,b,c,t,gold,r['before'],*(d['test'][i]['after'] for d in data.values())])
    public = Path(__file__).resolve().parents[2] / 'frontend/public/operator-results.json'
    payload = json.dumps(dict(n=len(primary['test']), primarySeed=SEEDS[0], runs=runs,
                              examples=primary['test']), separators=(',', ':'))
    public.write_text(payload + '\n')
    # Single-file handout for a classroom without a dev server or an internet connection.
    assets = public.parent
    html = (assets / 'operator-study.html').read_text()
    html = html.replace('<link rel="stylesheet" href="./operator-study.css" />',
                        '<style>' + (assets / 'operator-study.css').read_text() + '</style>')
    html = html.replace('<script type="module" src="./operator-study.js"></script>',
                        '<script id="embedded-results" type="application/json">' + payload.replace('<', '\\u003c')
                        + '</script><script type="module">' + (assets / 'operator-study.js').read_text() + '</script>')
    html = html.replace('<a href="./">← 课程首页</a> / ', 'LLM RL Lab / ')
    (directory / 'classroom.html').write_text(html)


if __name__ == '__main__':
    bundle()
