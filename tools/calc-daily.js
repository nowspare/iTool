/* Calculators + everyday utilities */
(() => {
'use strict';
const { el, tool, ui, copy, store } = window.UH;
const $ = ui;

/* ---------- expression engine (no eval) ---------- */
function calc(src){
  const s = String(src).replace(/\s+/g, '');
  let i = 0;
  const FN = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, abs: Math.abs, exp: Math.exp };
  const peek = () => s[i];
  const num = () => { const st = i; while (i < s.length && /[0-9.eE]/.test(s[i])) i++; if (st === i) throw new Error('bad number'); const v = parseFloat(s.slice(st, i)); if (isNaN(v)) throw new Error('bad number'); return v; };
  const primary = () => {
    if (peek() === '('){ i++; const v = expr(); if (s[i++] !== ')') throw new Error('missing )'); return v; }
    if (peek() === '-'){ i++; return -primary(); }
    if (peek() === '+'){ i++; return primary(); }
    const m = /^(sqrt|sin|cos|tan|log|ln|abs|exp)\(/.exec(s.slice(i));
    if (m){ i += m[0].length; const v = expr(); if (s[i++] !== ')') throw new Error('missing )'); return FN[m[1]](v); }
    return num();
  };
  const power = () => { let v = primary(); while (peek() === '^'){ i++; v = Math.pow(v, primary()); } return v; };
  const postfix = () => { let v = power(); while (s[i] === '!'){ i++; let f = 1; for (let k = 2; k <= v; k++) f *= k; v = f; } return v; };
  const term = () => {
    let v = postfix();
    while (peek() === '*' || peek() === '/' || peek() === '%'){
      const op = s[i++]; const r = postfix();
      if ((op === '/' || op === '%') && r === 0) throw new Error('division by zero');
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  };
  const expr = () => { let v = term(); while (peek() === '+' || peek() === '-'){ const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; } return v; };
  const out = expr();
  if (i < s.length) throw new Error('unexpected "' + s[i] + '"');
  return out;
}

tool({
  id: 'calc-standard', cat: 'calc', name: 'Standard Calculator',
  desc: 'Keyboard-friendly arithmetic with parenthesis and percent.',
  keywords: 'calculator basic arithmetic',
  render(w){
    const disp = el('div', { class: 'disp', text: '0' });
    let buf = '';
    const show = () => { disp.textContent = buf || '0'; };
    const press = k => {
      if (k === 'C'){ buf = ''; }
      else if (k === '⌫'){ buf = buf.slice(0, -1); }
      else if (k === '='){ try { const v = calc(buf); buf = String(+v.toPrecision(14)); } catch (e) { buf = 'Error'; } }
      else if (k === '±'){ buf = buf.startsWith('-') ? buf.slice(1) : '-' + buf; }
      else buf += k;
      show();
    };
    const keys = ['C','(',')','/','7','8','9','*','4','5','6','-','1','2','3','+','0','.','%','='];
    const pad = el('div', { class: 'pad' }, ...keys.map(k =>
      el('button', { type: 'button', class: (k === '=' ? 'eq' : /[+\-*/%()]/.test(k) ? 'op' : ''), onclick: () => press(k) }, k)));
    const kd = e => {
      if (!w.isConnected) return removeEventListener('keydown', kd);
      if (/^[0-9.+\-*/%()]$/.test(e.key)){ press(e.key); e.preventDefault(); }
      else if (e.key === 'Enter'){ press('='); e.preventDefault(); }
      else if (e.key === 'Backspace'){ press('⌫'); e.preventDefault(); }
      else if (e.key === 'Escape'){ press('C'); }
    };
    addEventListener('keydown', kd);
    w.addEventListener('uh:unmount', () => removeEventListener('keydown', kd));
    w.append(disp, pad, $.hint('Keys 0-9, operators, Enter =, Backspace, Esc clear.'));
  }
});

tool({
  id: 'calc-sci', cat: 'calc', name: 'Scientific Calculator',
  desc: 'sqrt, trig, log, powers, factorial — one expression at a time.',
  keywords: 'scientific calculator trig log power factorial',
  render(w){
    const ta = $.in('expression', '2^10 + sqrt(144)');
    const out = $.out();
    const go = () => { try { out.textContent = String(calc(ta.value)); } catch (e) { out.textContent = 'Error: ' + e.message; } };
    const insert = s => { ta.value += s; ta.focus(); };
    const fns = ['sqrt(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', 'abs(', 'exp(', '^', '!', 'pi'];
    w.append(ta, $.row(...fns.map(f => $.btn(f, () => insert(f === 'pi' ? '3.141592653589793' : f)))),
      $.row($.btn('=', go, true), $.btn('Clear', () => { ta.value = ''; out.textContent = ''; })),
      out, $.hint('Trig works in radians.'));
    ta.onkeydown = e => { if (e.key === 'Enter') go(); };
  }
});

tool({
  id: 'calc-percent', cat: 'calc', name: 'Percentage Calculator',
  desc: 'X% of Y, X is what % of Y, percentage change.',
  keywords: 'percent percentage increase decrease',
  render(w){
    const out = $.out();
    const mk = (a, b, fn) => {
      const A = $.in('value', '', 'number'), B = $.in('value', '', 'number');
      const calcBtn = $.btn('Calculate', () => {
        const x = +A.value, y = +B.value;
        if (isNaN(x) || isNaN(y)) { out.textContent = 'Enter both values.'; return; }
        out.textContent = fn(x, y);
      });
      return el('div', { class: 'col', style: { borderBottom: '1px solid var(--line)', paddingBottom: '14px' } },
        el('p', { class: 'fl', text: a }), $.row(A, el('span', { class: 'hint', text: b }), B, calcBtn));
    };
    w.append(
      mk('What is', '% of', (x, y) => `${x}% of ${y} = ${(x / 100 * y).toFixed(4).replace(/\.?0+$/, '')}`),
      mk('X is what percent of', '', (x, y) => y === 0 ? 'Divide by zero.' : `${x} is ${(x / y * 100).toFixed(4).replace(/\.?0+$/, '')}% of ${y}`),
      mk('Percent change from', 'to', (x, y) => x === 0 ? 'Start value is zero.' : `${((y - x) / Math.abs(x) * 100).toFixed(4)}% ${y >= x ? 'increase' : 'decrease'}`),
      out);
  }
});

tool({
  id: 'calc-age', cat: 'calc', name: 'Age Calculator',
  desc: 'Exact age in years, months, days — plus total days lived.',
  keywords: 'age birthday years old',
  render(w){
    const d = el('input', { class: 'in', type: 'date' });
    const out = $.out();
    const go = () => {
      if (!d.value) return;
      const b = new Date(d.value + 'T00:00:00'), now = new Date();
      if (b > now) { out.textContent = 'Date is in the future.'; return; }
      let y = now.getFullYear() - b.getFullYear();
      let m = now.getMonth() - b.getMonth();
      let dd = now.getDate() - b.getDate();
      if (dd < 0){ m--; dd += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
      if (m < 0){ y--; m += 12; }
      const days = Math.floor((now - b) / 86400000);
      out.textContent = `${y} years, ${m} months, ${dd} days\n${days.toLocaleString()} days total\n${(days / 7).toFixed(1)} weeks\n${Math.floor(days / 365.25)} years\nnext birthday in ${Math.ceil(((new Date(now.getFullYear(), b.getMonth(), b.getDate()) - now) / 86400000 + 365) % 365)} days`;
    };
    d.onchange = go;
    w.append($.label('Date of birth', d), $.btn('Calculate', go, true), out);
  }
});

tool({
  id: 'date-diff', cat: 'calc', name: 'Date Difference',
  desc: 'Days, weeks, months and business days between two dates.',
  keywords: 'date difference days between duration',
  render(w){
    const a = el('input', { class: 'in', type: 'date' });
    const b = el('input', { class: 'in', type: 'date' });
    const out = $.out();
    const go = () => {
      if (!a.value || !b.value) return;
      const d1 = new Date(a.value + 'T00:00:00'), d2 = new Date(b.value + 'T00:00:00');
      const sign = d2 < d1 ? -1 : 1;
      const [lo, hi] = sign > 0 ? [d1, d2] : [d2, d1];
      const days = Math.round((hi - lo) / 86400000);
      let biz = 0;
      for (let d = new Date(lo); d < hi; d.setDate(d.getDate() + 1)){
        const wd = d.getDay(); if (wd !== 0 && wd !== 6) biz++;
      }
      let months = (hi.getFullYear() - lo.getFullYear()) * 12 + (hi.getMonth() - lo.getMonth());
      if (hi.getDate() < lo.getDate()) months--;
      out.textContent = `${sign < 0 ? '−' : ''}${days} days\n${(days / 7).toFixed(2)} weeks\n${months} full months\n${biz.toLocaleString()} weekdays\n${days * 24} hours`;
    };
    [a, b].forEach(x => x.onchange = go);
    w.append($.split($.label('From', a), $.label('To', b)), $.btn('Calculate', go, true), out);
  }
});

tool({
  id: 'time-calc', cat: 'calc', name: 'Time Calculator',
  desc: 'Add or subtract hours and minutes.',
  keywords: 'time add subtract hours minutes duration',
  render(w){
    const h = $.in('hh', '1', 'number'), m = $.in('mm', '30', 'number');
    const base = el('input', { class: 'in', type: 'time', value: '09:00' });
    const op = $.sel([{ v: 1, t: 'Add' }, { v: -1, t: 'Subtract' }], 1);
    const out = $.out();
    const go = () => {
      const [bh, bm] = base.value.split(':').map(Number);
      const total = bh * 60 + bm + (+op.value) * ((+h.value || 0) * 60 + (+m.value || 0));
      const norm = ((total % 1440) + 1440) % 1440;
      out.textContent = `${String(Math.floor(norm / 60)).padStart(2, '0')}:${String(norm % 60).padStart(2, '0')}\n(${Math.floor(total / 60)}h ${total % 60}m from midnight)`;
    };
    w.append($.row($.label('Base time', base), $.label('Operation', op), $.label('Hours', h), $.label('Minutes', m)), $.btn('Calculate', go, true), out);
  }
});

tool({
  id: 'discount', cat: 'calc', name: 'Discount Calculator',
  desc: 'Sale price, amount saved, and effective percentage.',
  keywords: 'discount sale price percent off',
  render(w){
    const p = $.in('price', '', 'number'), d = $.in('discount %', '', 'number');
    const tax = $.in('tax %', '0', 'number');
    const out = $.out();
    const go = () => {
      const price = +p.value, disc = +d.value;
      if (isNaN(price) || isNaN(disc)) return;
      const saved = price * disc / 100;
      const sub = price - saved;
      const t = sub * (+tax.value || 0) / 100;
      out.textContent = `original    ${price.toFixed(2)}\ndiscount    −${saved.toFixed(2)} (${disc}%)\nsubtotal    ${sub.toFixed(2)}\ntax         +${t.toFixed(2)}\ntotal       ${(sub + t).toFixed(2)}`;
    };
    [p, d, tax].forEach(x => x.oninput = go);
    w.append($.row($.label('Price', p), $.label('Discount %', d), $.label('Tax %', tax)), out);
  }
});

tool({
  id: 'gst', cat: 'calc', name: 'GST / VAT Calculator',
  desc: 'Add or extract tax at any rate, with split CGST/SGST.',
  keywords: 'gst vat tax inclusive exclusive',
  render(w){
    const amt = $.in('amount', '', 'number');
    const rate = $.in('rate %', '18', 'number');
    const mode = $.sel([{ v: 'add', t: 'Add tax to amount' }, { v: 'remove', t: 'Extract tax from amount' }], 'add');
    const out = $.out();
    const go = () => {
      const a = +amt.value, r = +rate.value;
      if (isNaN(a) || isNaN(r)) return;
      const net = mode.value === 'add' ? a : a / (1 + r / 100);
      const tax = mode.value === 'add' ? a * r / 100 : a - net;
      out.textContent = `net        ${net.toFixed(2)}\ntax @ ${r}%  ${tax.toFixed(2)}\ngross      ${(net + tax).toFixed(2)}\n\nCGST @ ${(r / 2)}%  ${(tax / 2).toFixed(2)}\nSGST @ ${(r / 2)}%  ${(tax / 2).toFixed(2)}`;
    };
    [amt, rate].forEach(x => x.oninput = go); mode.onchange = go;
    w.append($.row($.label('Amount', amt), $.label('Rate %', rate), $.label('Mode', mode)), out);
  }
});

tool({
  id: 'unit-convert', cat: 'calc', name: 'Unit Converter',
  desc: 'Length, mass, volume, area, speed, data and temperature.',
  keywords: 'unit convert length weight volume area speed data',
  render(w){
    const UNITS = {
      Length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254, nmi: 1852 },
      Mass: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237, oz: 0.028349523125, st: 6.35029318 },
      Volume: { L: 1, mL: 0.001, m3: 1000, gal_us: 3.785411784, qt: 0.946352946, pt: 0.473176473, cup: 0.2365882365, floz: 0.0295735295625 },
      Area: { m2: 1, km2: 1e6, cm2: 1e-4, ha: 10000, acre: 4046.8564224, ft2: 0.09290304, in2: 0.00064516 },
      Speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, knot: 0.514444, 'ft/s': 0.3048 },
      Data: { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4, bit: 0.125 },
      Time: { s: 1, ms: 0.001, min: 60, h: 3600, day: 86400, week: 604800, year: 31557600 }
    };
    const kind = $.sel(Object.keys(UNITS).concat('Temperature'), 'Length');
    const from = $.sel([], ''), to = $.sel([], '');
    const val = $.in('value', '1', 'number');
    const out = $.out();
    const fillUnits = () => {
      const list = kind.value === 'Temperature' ? ['C', 'F', 'K'] : Object.keys(UNITS[kind.value]);
      from.replaceChildren(...list.map(u => el('option', { value: u }, u)));
      to.replaceChildren(...list.map(u => el('option', { value: u, selected: u !== list[0] }, u)));
    };
    const convertTemp = (v, a, b) => {
      const c = a === 'C' ? v : a === 'F' ? (v - 32) * 5 / 9 : v - 273.15;
      return b === 'C' ? c : b === 'F' ? c * 9 / 5 + 32 : c + 273.15;
    };
    const go = () => {
      const v = +val.value; if (isNaN(v)) { out.textContent = ''; return; }
      const r = kind.value === 'Temperature' ? convertTemp(v, from.value, to.value)
        : v * UNITS[kind.value][from.value] / UNITS[kind.value][to.value];
      out.textContent = `${v} ${from.value} = ${(+r.toPrecision(12))} ${to.value}`;
    };
    kind.onchange = () => { fillUnits(); go(); };
    [from, to].forEach(s => s.onchange = go); val.oninput = go;
    fillUnits(); go();
    w.append($.row($.label('Category', kind), $.label('From', from), $.label('To', to), $.label('Value', val)), out);
  }
});

tool({
  id: 'bmi', cat: 'calc', name: 'BMI Calculator',
  desc: 'Body mass index with WHO category bands.',
  keywords: 'bmi body mass index weight height',
  render(w){
    const kg = $.in('weight kg', '', 'number'), cm = $.in('height cm', '', 'number');
    const out = $.out();
    const go = () => {
      const w = +kg.value, h = +cm.value / 100;
      if (!w || !h) return;
      const bmi = w / (h * h);
      const band = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal range' : bmi < 30 ? 'Overweight' : bmi < 35 ? 'Obesity I' : bmi < 40 ? 'Obesity II' : 'Obesity III';
      out.textContent = `BMI        ${bmi.toFixed(1)}\ncategory   ${band}\nhealthy range for your height  ${(18.5 * h * h).toFixed(1)}–${(24.9 * h * h).toFixed(1)} kg`;
    };
    [kg, cm].forEach(x => x.oninput = go);
    w.append($.row($.label('Weight (kg)', kg), $.label('Height (cm)', cm)), out);
  }
});

tool({
  id: 'loan', cat: 'calc', name: 'Loan Calculator',
  desc: 'Monthly payment, total interest, and full amortization table.',
  keywords: 'loan mortgage emi payment interest amortization',
  render(w){
    const P = $.in('principal', '250000', 'number');
    const R = $.in('annual rate %', '6.5', 'number');
    const N = $.in('term (years)', '20', 'number');
    const out = $.out();
    const table = el('div', { class: 'diff' });
    const go = () => {
      const p = +P.value, r = +R.value / 100 / 12, n = +N.value * 12;
      if (!p || !n) return;
      const pay = r === 0 ? p / n : p * r / (1 - Math.pow(1 + r, -n));
      out.textContent = `monthly payment  ${pay.toFixed(2)}\ntotal paid       ${(pay * n).toFixed(2)}\ntotal interest   ${(pay * n - p).toFixed(2)}`;
      let bal = p; const rows = ['  #    payment     interest   principal      balance'];
      for (let k = 1; k <= Math.min(n, 480); k++){
        const int = bal * r, pri = pay - int; bal = Math.max(0, bal - pri);
        rows.push(`${String(k).padStart(3)} ${pay.toFixed(2).padStart(10)} ${int.toFixed(2).padStart(11)} ${pri.toFixed(2).padStart(11)} ${bal.toFixed(2).padStart(12)}`);
      }
      table.replaceChildren(...rows.map(t => el('div', { text: t })));
    };
    [P, R, N].forEach(x => x.oninput = go); go();
    w.append($.row($.label('Principal', P), $.label('Rate %', R), $.label('Years', N)), out, table);
  }
});

tool({
  id: 'savings', cat: 'calc', name: 'Savings Calculator',
  desc: 'Compound growth with monthly contributions.',
  keywords: 'savings compound interest monthly contribution growth',
  render(w){
    const init = $.in('initial', '10000', 'number');
    const mo = $.in('monthly deposit', '500', 'number');
    const r = $.in('annual return %', '7', 'number');
    const y = $.in('years', '10', 'number');
    const out = $.out();
    const go = () => {
      const i = +r.value / 100 / 12, n = +y.value * 12;
      let bal = +init.value || 0; const dep = +mo.value || 0;
      for (let k = 0; k < n; k++){ bal = bal * (1 + i) + dep; }
      const contributed = (+init.value || 0) + dep * n;
      out.textContent = `final balance   ${bal.toFixed(2)}\ncontributed     ${contributed.toFixed(2)}\ninterest earned ${(bal - contributed).toFixed(2)}\nover ${n} months`;
    };
    [init, mo, r, y].forEach(x => x.oninput = go); go();
    w.append($.row($.label('Initial', init), $.label('Monthly', mo), $.label('Return %', r), $.label('Years', y)), out);
  }
});

tool({
  id: 'gpa', cat: 'calc', name: 'GPA Calculator',
  desc: 'Weighted GPA from course grades and credits.',
  keywords: 'gpa grade point average credits',
  render(w){
    const rows = el('div', { class: 'list' });
    const out = $.out();
    const SCALE = { 'A+': 4.0, 'A': 4.0, 'A−': 3.7, 'B+': 3.3, 'B': 3.0, 'B−': 2.7, 'C+': 2.3, 'C': 2.0, 'C−': 1.7, 'D+': 1.3, 'D': 1.0, 'F': 0 };
    const compute = () => {
      let pts = 0, cr = 0;
      rows.querySelectorAll('.item').forEach(row => {
        const g = SCALE[row.querySelector('select').value] ?? 0;
        const c = +row.querySelector('input').value || 0;
        pts += g * c; cr += c;
      });
      out.textContent = cr ? `GPA ${(pts / cr).toFixed(3)} over ${cr} credits` : 'Add a course.';
    };
    const addRow = () => {
      const g = $.sel(Object.keys(SCALE), 'A');
      const c = $.in('credits', '3', 'number');
      g.onchange = c.oninput = compute;
      const row = el('div', { class: 'item' }, g, c, el('button', { class: 'x', type: 'button', text: '×', onclick: () => { row.remove(); compute(); } }));
      rows.append(row); compute();
    };
    addRow(); addRow(); addRow();
    w.append(rows, $.row($.btn('+ Course', addRow), $.btn('Reset', () => { rows.replaceChildren(); compute(); })), out);
  }
});

tool({
  id: 'currency', cat: 'calc', name: 'Currency Converter', needsApi: true,
  desc: 'Live rates from open.er-api.com (no key). Falls back to a manual rate box.',
  keywords: 'currency exchange rate convert usd eur',
  how: 'Rates are fetched once per session from open.er-api.com. No account, no key; the request carries only the base currency.',
  render(w){
    const amt = $.in('amount', '1', 'number');
    const from = $.sel([], 'USD'), to = $.sel([], 'EUR');
    const out = $.out();
    let rates = null, base = 'USD';
    const fill = list => { from.replaceChildren(...list.map(c => el('option', { value: c }, c))); to.replaceChildren(...list.map(c => el('option', { value: c, selected: c === 'EUR' }, c))); };
    const load = async () => {
      try {
        out.textContent = 'Fetching rates…';
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const j = await res.json();
        rates = j.rates; base = 'USD';
        fill(Object.keys(rates).sort());
        out.textContent = `rates updated ${j.time_last_update_utc || ''}`;
        conv();
      } catch (e) { out.textContent = 'Rate fetch failed (' + e.message + '). Use the manual rate box below.'; }
    };
    const manual = $.in('manual rate: 1 from = ? to', '', 'number');
    const conv = () => {
      const a = +amt.value;
      const r = rates ? rates[to.value] / rates[from.value] : +manual.value;
      if (!r) return;
      out.textContent = `${a} ${from.value} = ${(a * r).toFixed(4)} ${to.value}\n1 ${from.value} = ${r.toFixed(6)} ${to.value}`;
    };
    [amt, from, to, manual].forEach(x => x.oninput = conv); from.onchange = to.onchange = conv;
    w.append($.row($.label('Amount', amt), $.label('From', from), $.label('To', to)), $.row($.btn('Refresh rates', load, true), manual), out);
  }
});

tool({
  id: 'electricity', cat: 'calc', name: 'Electricity Bill Estimator',
  desc: 'Monthly cost from appliance watts, hours, and a tariff rate.',
  keywords: 'electricity bill kwh cost energy appliance',
  render(w){
    const rows = el('div', { class: 'list' });
    const rate = $.in('tariff per kWh', '0.15', 'number');
    const out = $.out();
    const compute = () => {
      let kwh = 0;
      rows.querySelectorAll('.item').forEach(r => {
        const [wIn, hIn, nIn] = r.querySelectorAll('input');
        kwh += (+wIn.value || 0) * (+hIn.value || 0) * (+nIn.value || 0) * 30 / 1000;
      });
      const cost = kwh * (+rate.value || 0);
      out.textContent = `${kwh.toFixed(2)} kWh / month\n${cost.toFixed(2)} per month\n${(cost * 12).toFixed(2)} per year`;
    };
    const add = () => {
      const wIn = $.in('watts', '100', 'number'), hIn = $.in('hours/day', '2', 'number'), nIn = $.in('qty', '1', 'number');
      const name = $.in('appliance', 'Fridge');
      [wIn, hIn, nIn].forEach(x => x.oninput = compute);
      const row = el('div', { class: 'item' }, name, wIn, hIn, nIn,
        el('button', { class: 'x', type: 'button', text: '×', onclick: () => { row.remove(); compute(); } }));
      rows.append(row); compute();
    };
    add();
    w.append(rows, $.row($.btn('+ Appliance', add), $.label('Tariff / kWh', rate)), out);
  }
});

/* ============================ EVERYDAY ============================ */

tool({
  id: 'recipe-convert', cat: 'daily', name: 'Recipe Measurement Converter',
  desc: 'Cups ⇄ ml ⇄ grams for common ingredients, plus scaling.',
  keywords: 'recipe cooking cups grams ml convert scale',
  render(w){
    const ING = { 'Water / milk (1 cup)': 240, 'Flour (1 cup)': 125, 'Sugar (1 cup)': 200, 'Butter (1 cup)': 227, 'Rice (1 cup)': 185, 'Honey (1 cup)': 340, 'Cocoa (1 cup)': 85 };
    const ing = $.sel(Object.keys(ING), 'Flour (1 cup)');
    const cups = $.in('cups', '1', 'number');
    const scale = $.in('scale factor', '1', 'number');
    const out = $.out();
    const go = () => {
      const g = ING[ing.value] * (+cups.value || 0) * (+scale.value || 0);
      out.textContent = `${(+cups.value * +scale.value).toFixed(2)} cups\n${(g).toFixed(1)} g\n${(g * 0.03527396).toFixed(2)} oz\n${(g).toFixed(1)} ml (volume approx)\n\n1 tbsp = 14.8 ml · 1 tsp = 4.93 ml · 1 cup = 236.6 ml US`;
    };
    [ing, cups, scale].forEach(x => x.oninput = x.onchange = go); go();
    w.append($.row($.label('Ingredient', ing), $.label('Cups', cups), $.label('Scale', scale)), out);
  }
});

tool({
  id: 'world-clock', cat: 'daily', name: 'World Clock',
  desc: 'Live times across any number of time zones, 12 or 24 hour.',
  keywords: 'world clock timezone time zones now 12 hour 24 hour am pm',
  render(w){
    const ZONES = ['UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
      'America/Sao_Paulo', 'Europe/London', 'Europe/Lisbon', 'Europe/Berlin', 'Europe/Paris',
      'Europe/Moscow', 'Africa/Cairo', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata',
      'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
    const home = Intl.DateTimeFormat().resolvedOptions().timeZone;

    let twelve = store.get('wc.12', true);
    const chips = el('div', { class: 'row' });
    const rows = el('div', { class: 'list' });

    const fmtTime = z => new Intl.DateTimeFormat(undefined, {
      timeZone: z, hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: twelve, hourCycle: twelve ? 'h12' : 'h23'
    }).format(new Date());
    const fmtDate = z => new Intl.DateTimeFormat(undefined, {
      timeZone: z, weekday: 'short', day: '2-digit', month: 'short'
    }).format(new Date());

    const tick = () => {
      rows.replaceChildren(...ZONES.map(z => {
        const isHome = z === home;
        return el('div', { class: 'item' },
          el('span', { text: z.replace(/_/g, ' ') + (isHome ? ' · your zone' : ''),
            style: { color: isHome ? 'var(--text)' : 'var(--muted)', fontWeight: isHome ? '600' : '400' } }),
          el('span', { class: 'hint', style: { marginLeft: 'auto' }, text: fmtDate(z) }),
          el('span', { style: { fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums',
            width: twelve ? '112px' : '88px', textAlign: 'right' }, text: fmtTime(z) })
        );
      }));
    };

    const paintChips = () => {
      chips.replaceChildren(
        el('button', { class: 'chip', type: 'button', 'aria-current': String(twelve),
          onclick: () => { twelve = true; store.set('wc.12', true); paintChips(); tick(); } }, '12-hour'),
        el('button', { class: 'chip', type: 'button', 'aria-current': String(!twelve),
          onclick: () => { twelve = false; store.set('wc.12', false); paintChips(); tick(); } }, '24-hour')
      );
    };

    paintChips(); tick();
    const id = setInterval(tick, 1000);
    w.addEventListener('uh:unmount', () => clearInterval(id));
    w.append($.row(el('span', { class: 'fl', text: 'Format' }), chips), rows);
  }
});

tool({
  id: 'cooking-timer', cat: 'daily', name: 'Cooking Timer',
  desc: '360° countdown ring with presets, alarm tone, and notification.',
  keywords: 'cooking timer countdown alarm kitchen ring dial',
  render(w){
    const ring = $.ring({ size: 248, stroke: 12 });
    const phase = $.hint('Ready');
    const m = $.in('minutes', '10', 'number');
    const s = $.in('seconds', '0', 'number');

    let total = 0, remaining = 0, endAt = 0, raf = 0, running = false;

    const paint = () => {
      const ms = Math.max(0, remaining);
      const mm = Math.floor(ms / 60000);
      const ss = Math.floor(ms % 60000 / 1000);
      const cs = Math.floor(ms % 1000 / 10);
      ring.set(total > 0 ? ms / total : 0,
        `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
        `.${String(cs).padStart(2, '0')}`);
    };

    const buzz = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.45, 0.9].forEach(t => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = 880;
          o.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
          g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.38);
          o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.4);
        });
      } catch {}
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Timer done');
    };

    const finish = () => {
      running = false;
      cancelAnimationFrame(raf);
      remaining = 0;
      paint();
      phase.textContent = 'DONE';
      buzz();
    };

    const loop = () => {
      if (!running) return;
      remaining = endAt - performance.now();
      if (remaining <= 0) return finish();
      paint();
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running) return;
      if (remaining <= 0){
        total = ((+m.value || 0) * 60 + (+s.value || 0)) * 1000;
        remaining = total;
      }
      if (remaining <= 0){ phase.textContent = 'Set a duration first.'; return; }
      endAt = performance.now() + remaining;
      running = true;
      phase.textContent = 'Running';
      paint();
      loop();
    };

    const pause = () => {
      if (!running) return;
      remaining = Math.max(0, endAt - performance.now());
      running = false;
      cancelAnimationFrame(raf);
      phase.textContent = 'Paused';
      paint();
    };

    const reset = () => {
      running = false;
      cancelAnimationFrame(raf);
      total = remaining = 0;
      phase.textContent = 'Ready';
      paint();
    };

    const preset = min => {
      running = false;
      cancelAnimationFrame(raf);
      m.value = String(min); s.value = '0';
      total = remaining = min * 60000;
      start();
    };

    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();

    w.addEventListener('uh:unmount', () => { cancelAnimationFrame(raf); running = false; });
    paint();
    w.append(
      el('div', { style: { display: 'grid', placeItems: 'center' } }, ring.node),
      phase,
      $.row(
        el('button', { class: 'chip', type: 'button', onclick: () => preset(1) }, '1 min'),
        el('button', { class: 'chip', type: 'button', onclick: () => preset(3) }, '3 min'),
        el('button', { class: 'chip', type: 'button', onclick: () => preset(5) }, '5 min'),
        el('button', { class: 'chip', type: 'button', onclick: () => preset(10) }, '10 min'),
        el('button', { class: 'chip', type: 'button', onclick: () => preset(15) }, '15 min'),
        el('button', { class: 'chip', type: 'button', onclick: () => preset(25) }, '25 min'),
        el('button', { class: 'chip', type: 'button', onclick: () => preset(45) }, '45 min')
      ),
      $.row($.label('Minutes', m), $.label('Seconds', s)),
      $.row($.btn('Start', start, true), $.btn('Pause', pause), $.btn('Reset', reset))
    );
  }
});

    const paintChips = () => {
      chips.replaceChildren(
        el('button', { class: 'chip', type: 'button', 'aria-current': String(twelve),
          onclick: () => { twelve = true; store.set('wc.12', true); paintChips(); tick(); } }, '12-hour'),
        el('button', { class: 'chip', type: 'button', 'aria-current': String(!twelve),
          onclick: () => { twelve = false; store.set('wc.12', false); paintChips(); tick(); } }, '24-hour')
      );
    };

    paintChips(); tick();
    const id = setInterval(tick, 1000);
    w.addEventListener('uh:unmount', () => clearInterval(id));
    w.append($.row(el('span', { class: 'fl', text: 'Format' }), chips), rows);
  }
});
tool({
  id: 'date-finder', cat: 'daily', name: 'Calendar Date Finder',
  desc: 'Day of week for any date, plus “N days from today”.',
  keywords: 'date weekday day of week find',
  render(w){
    const d = el('input', { class: 'in', type: 'date', value: new Date().toISOString().slice(0, 10) });
    const n = $.in('days from today', '30', 'number');
    const out = $.out();
    const run = () => {
      const dt = new Date(d.value + 'T00:00:00');
      const fwd = new Date(); fwd.setDate(fwd.getDate() + (+n.value || 0));
      out.textContent = `${d.value} is a ${dt.toLocaleDateString(undefined, { weekday: 'long' })}\nweek ${Math.ceil((((dt - new Date(dt.getFullYear(), 0, 1)) / 86400000) + 1) / 7)} of ${dt.getFullYear()}\n\n${n.value} days from today → ${fwd.toISOString().slice(0, 10)} (${fwd.toLocaleDateString(undefined, { weekday: 'long' })})`;
    };
    d.onchange = n.oninput = run; run();
    w.append($.row($.label('Date', d), $.label('Offset', n)), out);
  }
});

tool({
  id: 'fuel-cost', cat: 'daily', name: 'Fuel Cost Calculator',
  desc: 'Trip fuel cost from distance, consumption, and price.',
  keywords: 'fuel cost trip petrol gas mileage',
  render(w){
    const km = $.in('distance km', '300', 'number');
    const per = $.in('L / 100 km', '7.5', 'number');
    const price = $.in('price per L', '1.60', 'number');
    const people = $.in('passengers', '1', 'number');
    const out = $.out();
    const go = () => {
      const litres = (+km.value || 0) * (+per.value || 0) / 100;
      const cost = litres * (+price.value || 0);
      const p = Math.max(1, +people.value || 1);
      out.textContent = `fuel needed  ${litres.toFixed(2)} L\nround trip   ${(litres * 2).toFixed(2)} L\ntotal cost   ${cost.toFixed(2)}\nper person   ${(cost / p).toFixed(2)}\nper km       ${(cost / (+km.value || 1)).toFixed(3)}`;
    };
    [km, per, price, people].forEach(x => x.oninput = go); go();
    w.append($.row($.label('Distance', km), $.label('Consumption', per), $.label('Price / L', price), $.label('People', people)), out);
  }
});

tool({
  id: 'split-bill', cat: 'daily', name: 'Split Bill Calculator',
  desc: 'Even split with tip, or uneven split by weight.',
  keywords: 'split bill tip share restaurant',
  render(w){
    const total = $.in('total', '', 'number');
    const tip = $.in('tip %', '15', 'number');
    const people = $.in('people', '2', 'number');
    const out = $.out();
    const go = () => {
      const t = +total.value || 0, tipP = +tip.value || 0, p = Math.max(1, Math.round(+people.value || 1));
      const withTip = t * (1 + tipP / 100);
      out.textContent = `subtotal   ${t.toFixed(2)}\ntip        ${(t * tipP / 100).toFixed(2)}\ntotal      ${withTip.toFixed(2)}\nper person ${(withTip / p).toFixed(2)}`;
    };
    [total, tip, people].forEach(x => x.oninput = go); go();
    w.append($.row($.label('Total', total), $.label('Tip %', tip), $.label('People', people)), out);
  }
});

tool({
  id: 'tip', cat: 'daily', name: 'Tip Calculator',
  desc: 'Quick tip table at 10 / 15 / 18 / 20 / 25 percent.',
  keywords: 'tip gratuity percent restaurant',
  render(w){
    const bill = $.in('bill', '', 'number');
    const out = $.out();
    const go = () => {
      const b = +bill.value || 0;
      out.textContent = [10, 15, 18, 20, 25].map(p =>
        `${String(p).padStart(2)}%   tip ${(b * p / 100).toFixed(2).padStart(9)}   total ${(b * (1 + p / 100)).toFixed(2).padStart(9)}`
      ).join('\n');
    };
    bill.oninput = go;
    w.append($.label('Bill amount', bill), out);
  }
});

tool({
  id: 'size-convert', cat: 'daily', name: 'Clothing Size Converter',
  desc: 'Approximate US / UK / EU / JP conversions for tops and shoes.',
  keywords: 'clothing size shoe convert us uk eu jp',
  render(w){
    const TOPS = [[ 'XS', '6', '34', 'S' ], [ 'S', '8', '36', 'M' ], [ 'M', '10', '38', 'L' ], [ 'L', '12', '40', 'LL' ], [ 'XL', '14', '42', '3L' ], [ 'XXL', '16', '44', '4L' ]];
    const SHOES = [[ '6', '4', '36' ], [ '7', '5', '38' ], [ '8', '6', '39' ], [ '9', '7', '41' ], [ '10', '8', '42' ], [ '11', '9', '44' ], [ '12', '10', '45' ]];
    const kind = $.sel([{ v: 'top', t: 'Tops' }, { v: 'shoe', t: 'Shoes' }], 'top');
    const table = el('div', { class: 'diff' });
    const paint = () => {
      const rows = kind.value === 'top'
        ? ['US      UK    EU    JP', ...TOPS.map(r => r.map((c, i) => c.padEnd([8, 6, 6, 4][i])).join(''))]
        : ['US      UK    EU', ...SHOES.map(r => r.map((c, i) => c.padEnd([8, 6, 6][i])).join(''))];
      table.replaceChildren(...rows.map(r => el('div', { text: r })));
    };
    kind.onchange = paint; paint();
    w.append($.label('Type', kind), table, $.hint('Conversions are approximate — brands vary by a full size.'));
  }
});

tool({
  id: 'temp-convert', cat: 'daily', name: 'Temperature Converter',
  desc: 'Celsius, Fahrenheit, Kelvin, Rankine — live in all directions.',
  keywords: 'temperature celsius fahrenheit kelvin convert',
  render(w){
    const c = $.in('°C', '20', 'number'), f = $.in('°F', '68', 'number'), k = $.in('K', '293.15', 'number'), r = $.in('°R', '527.67', 'number');
    let lock = false;
    const sync = from => {
      if (lock) return; lock = true;
      const cv = +from.value;
      if (!isNaN(cv)){
        if (from === c){ f.value = (cv * 9 / 5 + 32).toFixed(2); k.value = (cv + 273.15).toFixed(2); r.value = ((cv + 273.15) * 9 / 5).toFixed(2); }
        if (from === f){ c.value = ((cv - 32) * 5 / 9).toFixed(2); k.value = ((cv - 32) * 5 / 9 + 273.15).toFixed(2); r.value = (cv + 459.67).toFixed(2); }
        if (from === k){ c.value = (cv - 273.15).toFixed(2); f.value = ((cv - 273.15) * 9 / 5 + 32).toFixed(2); r.value = (cv * 9 / 5).toFixed(2); }
        if (from === r){ c.value = ((cv - 491.67) * 5 / 9).toFixed(2); f.value = (cv - 459.67).toFixed(2); k.value = (cv * 5 / 9).toFixed(2); }
      }
      lock = false;
    };
    [c, f, k, r].forEach(x => x.oninput = () => sync(x));
    w.append($.row($.label('Celsius', c), $.label('Fahrenheit', f), $.label('Kelvin', k), $.label('Rankine', r)));
  }
});

tool({
  id: 'packing', cat: 'daily', name: 'Travel Packing Checklist',
  desc: 'Trip-length-aware packing list you can tick off; saves per trip.',
  keywords: 'packing travel checklist trip list',
  render(w){
    const days = $.in('trip length (days)', '5', 'number');
    const season = $.sel([{ v: 'warm', t: 'Warm' }, { v: 'cold', t: 'Cold' }, { v: 'mixed', t: 'Mixed' }], 'mixed');
    const list = el('div', { class: 'list' });
    const KEY = 'packing';
    const build = () => {
      const d = Math.max(1, +days.value || 1);
      const base = ['Passport / ID', 'Phone + charger', 'Wallet + cards', 'Toothbrush + paste', 'Deodorant', `Underwear ×${Math.min(d + 1, 10)}`, `Socks ×${Math.min(d + 1, 10)}`, `Tops ×${Math.min(d, 7)}`, 'Sleepwear'];
      const extra = season.value === 'cold' ? ['Jacket', 'Gloves', 'Beanie', 'Thermal layer']
        : season.value === 'warm' ? ['Sunscreen', 'Sunglasses', 'Shorts ×2', 'Hat']
        : ['Light jacket', 'Sunglasses', 'Layered tops'];
      const trip = d > 6 ? ['Laundry bag', 'Travel detergent'] : [];
      return [...base, ...extra, ...trip, 'Medication', 'Booking confirmations'];
    };
    const paint = () => {
      const items = build();
      const saved = store.get(KEY, {});
      list.replaceChildren(...items.map(name => {
        const done = !!saved[name];
        const row = el('div', { class: 'item' + (done ? ' done' : '') },
          el('input', { type: 'checkbox', checked: done }),
          el('span', { text: name }));
        row.querySelector('input').onchange = e => {
          const s = store.get(KEY, {});
          e.target.checked ? s[name] = 1 : delete s[name];
          store.set(KEY, s); row.classList.toggle('done', e.target.checked);
        };
        return row;
      }));
    };
    days.oninput = paint; season.onchange = paint; paint();
    w.append($.row($.label('Days', days), $.label('Season', season)), list, $.btn('Reset checklist', () => { store.set(KEY, {}); paint(); }));
  }
});

tool({
  id: 'emergency-card', cat: 'daily', name: 'Emergency Information Card',
  desc: 'Fill once, save locally, download as a printable card.',
  keywords: 'emergency contact medical info card',
  render(w){
    const KEY = 'emergency';
    const saved = store.get(KEY, {});
    const fields = [
      ['name', 'Full name'], ['dob', 'Date of birth'], ['blood', 'Blood type'],
      ['allergies', 'Allergies'], ['conditions', 'Medical conditions'], ['meds', 'Medications'],
      ['contact1', 'Emergency contact 1 (name / phone)'], ['contact2', 'Emergency contact 2'],
      ['doctor', 'Doctor (name / phone)'], ['insurance', 'Insurance / policy number']
    ];
    const inputs = fields.map(([k, label]) => {
      const i = k === 'allergies' || k === 'conditions' || k === 'meds' ? $.ta('') : $.in('');
      i.value = saved[k] || '';
      if (i.tagName === 'TEXTAREA') i.style.minHeight = '60px';
      i.oninput = () => { const s = store.get(KEY, {}); s[k] = i.value; store.set(KEY, s); };
      return $.label(label, i);
    });
    const makeCard = () => {
      const s = store.get(KEY, {});
      const html = `<!doctype html><meta charset="utf-8"><title>Emergency card</title>
<style>body{font-family:system-ui,sans-serif;padding:30px;max-width:520px}
h1{font-size:18px;letter-spacing:.06em;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:8px}
dt{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#555;margin-top:12px}
dd{margin:2px 0 0;font-size:15px}@media print{@page{margin:18mm}}</style>
<h1>Emergency information</h1><dl>${fields.map(([k, l]) => `<dt>${l}</dt><dd>${(s[k] || '—').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</dd>`).join('')}</dl>`;
      window.UH.download(html, 'emergency-card.html', 'text/html');
    };
    w.append(...inputs, $.row($.btn('Download printable card', makeCard, true),
      $.btn('Clear', () => { store.set(KEY, {}); inputs.forEach(i => i.value = ''); })),
      $.hint('Saved only in this browser. Nothing is transmitted.'));
  }
});

tool({
  id: 'meeting-planner', cat: 'daily', name: 'Meeting Time Planner',
  desc: 'Find overlapping working hours across cities.',
  keywords: 'meeting time zones overlap schedule planner',
  render(w){
    const zones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
    const picks = el('div', { class: 'row' });
    const chosen = new Set(['Europe/London', 'America/New_York', 'Asia/Kolkata']);
    zones.forEach(z => {
      const c = el('input', { type: 'checkbox', checked: chosen.has(z) });
      c.onchange = () => { c.checked ? chosen.add(z) : chosen.delete(z); paint(); };
      picks.append(el('label', { class: 'row', style: { gap: '5px', fontSize: '13px' } }, c, z));
    });
    const range = $.sel([{ v: '9-17', t: '09:00–17:00' }, { v: '8-18', t: '08:00–18:00' }, { v: '7-19', t: '07:00–19:00' }], '9-17');
    const out = el('div', { class: 'diff' });
    const paint = () => {
      const [s, e] = range.value.split('-').map(Number);
      const hours = Array.from({ length: e - s }, (_, i) => s + i);
      const fmt = (h, tz) => {
        const d = new Date();
        d.setUTCHours(h, 0, 0, 0);
        return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d);
      };
      const rows = [];
      const header = 'UTC  ' + [...chosen].map(z => z.split('/').pop().slice(0, 8).padEnd(9)).join('');
      rows.push(header);
      hours.forEach(h => {
        rows.push(String(h).padStart(2) + ':00 ' + [...chosen].map(z => fmt(h, z).padEnd(9)).join(''));
      });
      out.replaceChildren(...rows.map(r => el('div', { text: r })));
    };
    range.onchange = paint; paint();
    w.append(picks, $.label('Local working window (UTC)', range), out);
  }
});

tool({
  id: 'expenses', cat: 'daily', name: 'Expense Tracker',
  desc: 'Log expenses by category; monthly totals and breakdown. Stored locally.',
  keywords: 'expense tracker budget spending money',
  render(w){
    const KEY = 'expenses';
    let data = store.get(KEY, []);
    const desc = $.in('what', ''), amount = $.in('amount', '', 'number');
    const cat = $.sel(['Food', 'Transport', 'Housing', 'Bills', 'Health', 'Fun', 'Other'], 'Food');
    const date = el('input', { class: 'in', type: 'date', value: new Date().toISOString().slice(0, 10) });
    const list = el('div', { class: 'list' });
    const summary = $.out();
    const save = () => store.set(KEY, data);
    const paint = () => {
      list.replaceChildren(...data.slice().reverse().map((e, i) => el('div', { class: 'item' },
        el('span', { class: 'hint', text: e.date }),
        el('span', { text: e.desc || e.cat }),
        el('span', { style: { marginLeft: 'auto', fontFamily: 'var(--mono)' }, text: e.amount.toFixed(2) }),
        el('button', { class: 'x', type: 'button', text: '×', onclick: () => { data.splice(data.length - 1 - i, 1); save(); paint(); } }))));
      const byCat = {};
      data.forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + e.amount);
      const total = data.reduce((s, e) => s + e.amount, 0);
      summary.textContent = data.length
        ? `TOTAL ${total.toFixed(2)}\n\n` + Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.padEnd(10)} ${v.toFixed(2).padStart(9)}  ${(v / total * 100).toFixed(0)}%`).join('\n')
        : 'No expenses logged.';
    };
    const add = () => {
      const a = +amount.value;
      if (!a) return;
      data.push({ date: date.value, desc: desc.value, cat: cat.value, amount: a });
      save(); desc.value = ''; amount.value = ''; paint();
    };
    w.append($.row(desc, $.label('Amount', amount), $.label('Category', cat), $.label('Date', date), $.btn('Add', add, true)),
      list, summary,
      $.row($.btn('Export CSV', () => {
        const csv = 'date,description,category,amount\n' + data.map(e => `${e.date},"${(e.desc || '').replace(/"/g, '""')}",${e.cat},${e.amount}`).join('\n');
        window.UH.download(csv, 'expenses.csv', 'text/csv');
      }), $.btn('Clear all', () => { if (confirm('Delete all expenses?')){ data = []; save(); paint(); } })));
    paint();
  }
});
})();
