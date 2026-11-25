const byId = (id) => document.getElementById(id);
const symbols = ['+', '-', '*'];
const count = (value, max = Infinity) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const percent = (correct, total) => `${(correct * 100 / total).toFixed(1)}%`;
const signed = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;

function validResults({ n, primarySeed, runs, examples }) {
  return count(n) && n > 0 && Array.isArray(runs) && runs.some((r) => r.seed === primarySeed)
    && runs.every((r) => Number.isSafeInteger(r.seed)
      && [r.before, r.after, r.improved, r.regressed].every((v) => count(v, n))
      && Number.isFinite(r.p_value) && r.p_value >= 0 && r.p_value <= 1
      && Array.isArray(r.ci_pp) && r.ci_pp.length === 2 && r.ci_pp.every(Number.isFinite)
      && Array.isArray(r.curve) && r.curve.every((p) => count(p.step) && count(p.total) && p.total > 0 && count(p.correct, p.total)))
    && Array.isArray(examples) && examples.every((e) => [e.a, e.b, e.c, e.target].every(Number.isFinite)
      && symbols.includes(e.before) && symbols.includes(e.after));
}

function el(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function svgNode(tag, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderCurve(curve) {
  const container = byId('curve');
  if (!curve.length) {
    container.textContent = '这个种子没有验证集记录。';
    return;
  }
  const points = [...curve].sort((a, b) => a.step - b.step);
  const first = points[0].step, last = points[points.length - 1].step;
  const x = (step) => first === last ? 260 : 44 + 444 * (step - first) / (last - first);
  const y = (ratio) => 158 - 140 * ratio;
  const svg = svgNode('svg', { viewBox: '0 0 520 190', class: 'chart', role: 'img', 'aria-label': '验证集正确率随训练步数的变化，数值见下方验证记录' });
  for (const ratio of [0, .5, 1]) {
    svg.append(svgNode('line', { x1: 44, y1: y(ratio), x2: 488, y2: y(ratio), stroke: '#d4d4d8' }),
      svgNode('text', { x: 38, y: y(ratio) + 4, 'text-anchor': 'end', 'font-size': 12 }, `${100 * ratio}%`));
  }
  for (const step of new Set([first, last])) {
    svg.append(svgNode('text', { x: x(step), y: 180, 'text-anchor': 'middle', 'font-size': 12 }, `步 ${step}`));
  }
  const coords = points.map((p) => [x(p.step), y(p.correct / p.total)]);
  svg.append(svgNode('polyline', { points: coords.map((xy) => xy.join(',')).join(' '), fill: 'none', stroke: '#1d4ed8', 'stroke-width': 2.5 }));
  const table = el('table', '');
  const header = table.createTHead().insertRow();
  for (const label of ['训练步', '验证答对 / 总题数', '正确率']) header.append(el('th', label));
  const body = table.createTBody();
  points.forEach((p, i) => {
    svg.append(svgNode('circle', { cx: coords[i][0], cy: coords[i][1], r: 3.5, fill: '#1d4ed8' }));
    const row = body.insertRow();
    for (const value of [p.step, `${p.correct} / ${p.total}`, percent(p.correct, p.total)]) row.insertCell().textContent = value;
  });
  const details = el('details', '');
  details.append(el('summary', `查看 ${points.length} 条验证记录`), table);
  container.replaceChildren(svg, details);
}

function renderRun(n, run) {
  byId('cohort').textContent = `种子 ${run.seed} · 两次作答使用相同的 ${n} 道题。`;
  for (const side of ['before', 'after']) {
    byId(`${side}-score`).textContent = percent(run[side], n);
    byId(`${side}-count`).textContent = `答对 ${run[side]} / ${n}`;
  }
  byId('delta').textContent = signed((run.after - run.before) * 100 / n);
  byId('transitions').textContent = `纠正（错 → 对）${run.improved} 题；退步（对 → 错）${run.regressed} 题；对错不变 ${n - run.improved - run.regressed} 题。`;
  byId('uncertainty').textContent = `正确率差的 95% 置信区间：[${run.ci_pp.map(signed).join(', ')}] 个百分点；McNemar 配对检验 p 值：${Number(run.p_value.toPrecision(3))}。`;
  renderCurve(run.curve);
}

function outcome({ a, b, c }, op) {
  return (op === '+' ? a + b : op === '-' ? a - b : a * b) + c;
}

function renderExamples(examples) {
  const selected = new Map();
  for (const e of examples) {
    const before = outcome(e, e.before), after = outcome(e, e.after);
    const wasCorrect = before === e.target, isCorrect = after === e.target;
    const kind = wasCorrect === isCorrect ? '对错不变' : isCorrect ? '纠正' : '退步';
    if (!selected.has(kind)) selected.set(kind, { e, before, after });
  }
  const container = byId('examples');
  for (const kind of ['纠正', '退步', '对错不变']) {
    const item = selected.get(kind);
    const card = el('article', '');
    card.className = 'example';
    card.append(el('h3', kind));
    if (item) {
      const { e, before, after } = item;
      card.append(el('code', `(${e.a} ? ${e.b}) + ${e.c} = ${e.target}`),
        el('p', `训练前选 ${e.before}，得 ${before}（${before === e.target ? '对' : '错'}）；训练后选 ${e.after}，得 ${after}（${after === e.target ? '对' : '错'}）。`));
    } else card.append(el('p', '样例列表中没有这一类题。'));
    container.append(card);
  }
}

async function load() {
  const status = byId('status');
  const embedded = byId('embedded-results');
  try {
    let data;
    if (embedded) {
      data = JSON.parse(embedded.textContent);
    } else {
      const response = await fetch('./operator-results.json', { cache: 'no-cache' });
      // A static host may serve its index page with HTTP 200 for a missing file.
      if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
        status.textContent = '暂无可用的实验结果。请确认同目录有 operator-results.json，再刷新此页。';
        return;
      }
      data = await response.json();
    }
    if (!validResults(data)) throw new Error('invalid results');
    const select = byId('seed');
    for (const { seed } of data.runs) select.add(new Option(`${seed}${seed === data.primarySeed ? '（主种子）' : ''}`, seed));
    select.value = String(data.primarySeed);
    const update = () => renderRun(data.n, data.runs[select.selectedIndex]);
    select.addEventListener('change', update);
    update();
    renderExamples(data.examples);
    status.hidden = true;
    byId('results').hidden = false;
  } catch {
    status.textContent = embedded
      ? '内嵌实验结果格式有误或不完整，未显示任何成绩。'
      : '无法读取实验结果：请检查同目录的 operator-results.json 是否可访问、数据是否完整，然后刷新此页。未显示任何成绩。';
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
else load();
