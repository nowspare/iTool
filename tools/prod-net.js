/* Productivity + network tools */
(() => {
'use strict';
const { el, tool, ui, copy, store, bytes, download } = window.UH;
const $ = ui;

/* -------------------- PRODUCTIVITY -------------------- */

tool({
  id: 'todo', cat: 'prod', name: 'Daily To-Do List',
  desc: 'Checkable task list, saved per day, with carry-over of unfinished items.',
  keywords: 'todo task list checklist daily',
  render(w){
    const KEY = 'todo:' + new Date().toISOString().slice(0, 10);
    let items = store.get(KEY, []);
    const input = $.in('Add a task and press Enter');
    const list = el('div', { class: 'list' });
    const save = () => store.set(KEY, items);
    const paint = () => {
      list.replaceChildren(...items.map((t, i) => {
        const row = el('div', { class: 'item' + (t.done ? ' done' : '') },
          el('input', { type: 'checkbox', checked: t.done }),
          el('span', { text: t.text }),
          el('button', { class: 'x', type: 'button', text: '×' }));
        row.querySelector('input').onchange = e => { items[i].done = e.target.checked; save(); paint(); };
        row.querySelector('.x').onclick = () => { items.splice(i, 1); save(); paint(); };
        return row;
      }));
      list.append(el('p', { class: 'hint', text: `${items.filter(t => t.done).length} of ${items.length} done` }));
    };
    const add = () => { if (!input.value.trim()) return; items.push({ text: input.value.trim(), done: false }); input.value = ''; save(); paint(); };
    input.onkeydown = e => { if (e.key === 'Enter') add(); };
    const yKey = 'todo:' + new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const carried = store.get(yKey, []).filter(t => !t.done);
    w.append(input, list,
      $.row($.btn('Add', add, true),
        carried.length ? $.btn(`Carry over ${carried.length} unfinished`, () => {
          items.push(...carried.map(t => ({ text: t.text, done: false }))); save(); paint();
        }) : '',
        $.btn('Clear done', () => { items = items.filter(t => !t.done); save(); paint(); })));
    paint();
  }
});

tool({
  id: 'notes', cat: 'prod', name: 'Notes Manager',
  desc: 'Multiple named notes with search, autosave, and export.',
  keywords: 'notes manager documents write save',
  render(w){
    const KEY = 'notes';
    let notes = store.get(KEY, [{ id: 1, title: 'Untitled', body: '' }]);
    let active = notes[0].id;
    const list = el('div', { class: 'list' });
    const title = $.in('title', '');
    const body = $.ta(''); body.style.minHeight = '320px';
    const save = () => store.set(KEY, notes);
    const paint = () => {
      list.replaceChildren(...notes.map(n => {
        const row = el('div', { class: 'item' },
          el('span', { text: n.title || 'Untitled', style: { fontWeight: n.id === active ? '600' : '400' } }),
          el('button', { class: 'x', type: 'button', text: '×' }));
        row.onclick = e => { if (e.target.classList.contains('x')) return; active = n.id; load(); paint(); };
        row.querySelector('.x').onclick = () => {
          notes = notes.filter(x => x.id !== n.id);
          if (active === n.id) active = notes[0]?.id ?? null;
          save(); paint(); load();
        };
        return row;
      }));
    };
    const load = () => {
      const n = notes.find(x => x.id === active);
      title.value = n?.title ?? ''; body.value = n?.body ?? '';
    };
    title.oninput = body.oninput = () => {
      const n = notes.find(x => x.id === active); if (!n) return;
      n.title = title.value; n.body = body.value; save(); paint();
    };
    w.append(el('div', { class: 'split' },
      el('div', { class: 'col' }, list, $.btn('+ New note', () => {
        const n = { id: Date.now(), title: 'Untitled', body: '' };
        notes.unshift(n); active = n.id; save(); paint(); load();
      }, true)),
      el('div', { class: 'col' }, $.label('Title', title), body)),
      $.row($.btn('Download note', () => download(body.value, (title.value || 'note') + '.txt', 'text/plain')),
        $.btn('Export all', () => download(JSON.stringify(notes, null, 2), 'notes.json'))));
    paint(); load();
  }
});

tool({
  id: 'planner', cat: 'prod', name: 'Daily Planner',
  desc: 'Hour-by-hour plan for today with autosave.',
  keywords: 'planner schedule day hourly agenda',
  render(w){
    const KEY = 'planner:' + new Date().toISOString().slice(0, 10);
    const saved = store.get(KEY, {});
    const rows = el('div', { class: 'col', style: { gap: '4px' } });
    for (let h = 6; h <= 23; h++){
      const slot = $.in('', saved[h] || '');
      slot.style.height = '36px';
      slot.oninput = () => { const s = store.get(KEY, {}); s[h] = slot.value; store.set(KEY, s); };
      rows.append(el('div', { class: 'row', style: { flexWrap: 'nowrap' } },
        el('span', { class: 'hint', style: { width: '62px', fontFamily: 'var(--mono)' }, text: `${String(h).padStart(2, '0')}:00` }), slot));
    }
    w.append(rows);
  }
});

tool({
  id: 'pomodoro', cat: 'prod', name: 'Pomodoro Timer',
  desc: '25/5 default cycle, adjustable lengths, long break after four rounds.',
  keywords: 'pomodoro focus timer work break ring',
  render(w){
    const ring = $.ring({ size: 260, stroke: 12 });
    const phase = $.hint('Ready');
    const work = $.in('work min', '25', 'number'), brk = $.in('break min', '5', 'number');

    let id = 0, mode = 'work', round = 0, phaseTotal = 0, endAt = 0, remaining = 0;

    const paint = () => {
      const mm = Math.floor(Math.max(0, remaining) / 60000);
      const ss = Math.floor(Math.max(0, remaining) % 60000 / 1000);
      ring.set(phaseTotal > 0 ? Math.max(0, remaining) / phaseTotal : 0,
        `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
        mode === 'work' ? `round ${round + 1}` : 'break');
    };

    const beep = () => {
      try {
        const c = new (window.AudioContext || window.webkitAudioContext)();
        const o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination); o.frequency.value = 660;
        g.gain.setValueAtTime(0.2, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
        o.start(); o.stop(c.currentTime + 0.6);
      } catch {}
    };

    const next = () => {
      if (mode === 'work'){
        round++;
        phase.textContent = `Round ${round} complete — break`;
        mode = 'break';
      } else {
        phase.textContent = 'Back to work';
        mode = 'work';
      }
      phaseTotal = (mode === 'work' ? (+work.value || 25) : (+brk.value || 5)) * 60000;
      remaining = phaseTotal;
      endAt = performance.now() + remaining;
      paint();
    };

    const tick = () => {
      clearInterval(id);
      if (!phaseTotal) return;
      endAt = performance.now() + remaining;
      phase.textContent = mode === 'work' ? 'Focusing' : 'Break';
      id = setInterval(() => {
        remaining = Math.max(0, endAt - performance.now());
        paint();
        if (remaining <= 0){ clearInterval(id); beep(); next(); tick(); }
      }, 200);
    };

    const start = () => {
      if (!phaseTotal){
        phaseTotal = (+work.value || 25) * 60000;
        remaining = phaseTotal;
      }
      tick();
    };

    w.addEventListener('uh:unmount', () => clearInterval(id));

    paint();
    w.append(
      el('div', { style: { display: 'grid', placeItems: 'center' } }, ring.node),
      phase,
      $.row($.label('Work', work), $.label('Break', brk)),
      $.row($.btn('Start', start, true),
        $.btn('Pause', () => { clearInterval(id); phase.textContent = 'Paused'; }),
        $.btn('Reset', () => {
          clearInterval(id); id = 0;
          mode = 'work'; round = 0; phaseTotal = 0; remaining = 0;
          phase.textContent = 'Ready'; paint();
        }))
    );
  }
});

tool({
  id: 'stopwatch', cat: 'prod', name: 'Stopwatch',
  desc: 'Sixty-second sweep dial with hundredths, lap splits, and tick marks.',
  keywords: 'stopwatch timer lap elapsed dial',
  render(w){
    const SIZE = 260;
    const ring = $.ring({ size: SIZE, stroke: 10 });

    const NS = 'http://www.w3.org/2000/svg';
    const c = SIZE / 2;
    for (let i = 0; i < 60; i++){
      const a = (i * 6) * Math.PI / 180;
      const major = i % 5 === 0;
      const outer = c - 16;
      const inner = outer - (major ? 9 : 4);
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(c + Math.sin(a) * inner));
      line.setAttribute('y1', String(c - Math.cos(a) * inner));
      line.setAttribute('x2', String(c + Math.sin(a) * outer));
      line.setAttribute('y2', String(c - Math.cos(a) * outer));
      line.setAttribute('stroke-width', major ? '1.6' : '1');
      line.style.stroke = major ? 'var(--line2)' : 'var(--line)';
      ring.node.append(line);
    }

    const laps = el('div', { class: 'list' });
    const SWEEP = 60000;
    let startAt = 0, elapsed = 0, raf = 0, running = false;

    const now = () => elapsed + (running ? performance.now() - startAt : 0);
    const fmt = ms => {
      const mm = Math.floor(ms / 60000);
      const ss = Math.floor(ms % 60000 / 1000);
      const cc = Math.floor(ms % 1000 / 10);
      return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
    };

    const paint = t => {
      const mm = Math.floor(t / 60000);
      const ss = Math.floor(t % 60000 / 1000);
      const cc = Math.floor(t % 1000 / 10);
      ring.set((t % SWEEP) / SWEEP,
        `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
        `.${String(cc).padStart(2, '0')}`);
    };

    const loop = () => {
      if (!running) return;
      paint(now());
      raf = requestAnimationFrame(loop);
    };

    const toggleBtn = $.btn('Start', () => {}, true);
    toggleBtn.onclick = () => {
      if (running){
        elapsed += performance.now() - startAt;
        running = false;
        cancelAnimationFrame(raf);
        paint(elapsed);
        toggleBtn.textContent = 'Resume';
      } else {
        startAt = performance.now();
        running = true;
        loop();
        toggleBtn.textContent = 'Stop';
      }
    };

    const lap = () => {
      const t = now();
      const firstRow = laps.firstElementChild;
      const prev = firstRow ? +firstRow.dataset.t : 0;
      const split = t - prev;
      laps.prepend(el('div', { class: 'item', 'data-t': String(t) },
        el('span', { class: 'fl', style: { width: '42px', flex: 'none' }, text: `#${laps.children.length + 1}` }),
        el('span', { text: fmt(t), style: { fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' } }),
        el('span', { class: 'hint', style: { marginLeft: 'auto', fontFamily: 'var(--mono)' }, text: '+' + fmt(split) })
      ));
    };

    const reset = () => {
      running = false; cancelAnimationFrame(raf);
      elapsed = 0; laps.replaceChildren();
      toggleBtn.textContent = 'Start';
      paint(0);
    };

    w.addEventListener('uh:unmount', () => { cancelAnimationFrame(raf); running = false; });
    paint(0);
    w.append(
      el('div', { style: { display: 'grid', placeItems: 'center' } }, ring.node),
      $.row(toggleBtn, $.btn('Lap', lap), $.btn('Reset', reset)),
      laps
    );
  }
});

tool({
  id: 'countdown', cat: 'prod', name: 'Countdown Timer',
  desc: ' Counting down to a target date and time.',
  keywords: 'countdown days until event timer ring',
  render(w){
    const ring = $.ring({ size: 260, stroke: 12 });
    const dt = el('input', { class: 'in', type: 'datetime-local' });
    const sub = $.hint('time remaining');
    const d = new Date(Date.now() + 86400000 * 7);
    dt.value = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    let total = 0;
    const resetTotal = () => {
      const target = new Date(dt.value).getTime();
      if (isNaN(target)) return;
      total = Math.max(1, target - Date.now());
    };

    const tick = () => {
      const target = new Date(dt.value).getTime();
      if (isNaN(target)) { ring.set(0, '—', ''); return; }
      let diff = target - Date.now();
      const past = diff < 0;
      diff = Math.abs(diff);
      const dd = Math.floor(diff / 86400000);
      const hh = Math.floor(diff % 86400000 / 3600000);
      const mm = Math.floor(diff % 3600000 / 60000);
      const ss = Math.floor(diff % 60000 / 1000);
      const frac = past ? 0 : Math.min(1, diff / total);
      ring.set(frac,
        `${String(dd).padStart(2, '0')}:${String(hh).padStart(2, '0')}`,
        `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
      sub.textContent = past ? 'time since target' : 'time remaining';
    };

    resetTotal();
    tick();
    const id = setInterval(tick, 1000);
    dt.onchange = () => { resetTotal(); tick(); };
    w.addEventListener('uh:unmount', () => clearInterval(id));

    w.append(
      el('div', { style: { display: 'grid', placeItems: 'center' } }, ring.node),
      $.label('Target', dt),
      sub
    );
  }
});

tool({
  id: 'alarm', cat: 'prod', name: 'Alarm Clock',
  desc: 'Browser alarm at a set time, tone plus tab title flash.',
  keywords: 'alarm clock wake time reminder',
  render(w){
    const t = el('input', { class: 'in', type: 'time', value: '07:00' });
    const status = $.hint('Idle');
    let armed = false;
    const id = setInterval(() => {
      if (!armed) return;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0');
      if (`${hh}:${mm}` === t.value && now.getSeconds() < 2){
        armed = false; status.textContent = 'ALARM';
        document.title = '⏰ UtilityHub';
        try {
          const c = new (window.AudioContext || window.webkitAudioContext)();
          const o = c.createOscillator(), g = c.createGain();
          o.frequency.value = 740; o.type = 'square'; o.connect(g); g.connect(c.destination);
          g.gain.value = 0.12; o.start();
          setTimeout(() => { o.stop(); document.title = 'UtilityHub — 130 everyday tools'; }, 4000);
        } catch {}
      }
    }, 500);
    w.addEventListener('uh:unmount', () => clearInterval(id));
    w.append($.label('Alarm time', t), $.row($.btn('Arm', () => { armed = true; status.textContent = 'Armed for ' + t.value; }, true),
      $.btn('Disarm', () => { armed = false; status.textContent = 'Disarmed'; })), status,
      $.hint('Keep the tab open — browsers suspend background timers.'));
  }
});

tool({
  id: 'calendar', cat: 'prod', name: 'Calendar',
  desc: 'Month grid with navigation and today highlight.',
  keywords: 'calendar month view date',
  render(w){
    let cursor = new Date();
    cursor.setDate(1);
    const head = el('div', { class: 'row', style: { justifyContent: 'space-between' } });
    const table = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' } });
    const paint = () => {
      const y = cursor.getFullYear(), m = cursor.getMonth();
      head.replaceChildren(
        el('strong', { text: cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }),
        el('div', { class: 'row' },
          $.btn('‹', () => { cursor = new Date(y, m - 1, 1); paint(); }),
          $.btn('Today', () => { cursor = new Date(); cursor.setDate(1); paint(); }),
          $.btn('›', () => { cursor = new Date(y, m + 1, 1); paint(); })));
      const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
      const first = (new Date(y, m, 1).getDay() + 6) % 7;
      const count = new Date(y, m + 1, 0).getDate();
      const today = new Date();
      const cells = days.map(d => el('div', { class: 'hint', text: d, style: { textAlign: 'center' } }));
      for (let i = 0; i < first; i++) cells.push(el('div'));
      for (let d = 1; d <= count; d++){
        const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
        cells.push(el('div', {
          text: String(d),
          style: { textAlign: 'center', padding: '9px 0', borderRadius: '6px', fontSize: '13px',
            background: isToday ? 'var(--accent)' : 'var(--bg2)', color: isToday ? 'var(--accent-fg)' : 'inherit' }
        }));
      }
      table.replaceChildren(...cells);
    };
    paint();
    w.append(head, table);
  }
});

tool({
  id: 'habit', cat: 'prod', name: 'Habit Tracker',
  desc: 'Streaks and a 30-day grid per habit, stored locally.',
  keywords: 'habit streak tracker daily routine',
  render(w){
    const KEY = 'habits';
    let habits = store.get(KEY, [{ id: 1, name: 'Read 20 pages', days: [] }]);
    const nameIn = $.in('new habit', '');
    const list = el('div', { class: 'list' });
    const save = () => store.set(KEY, habits);
    const todayKey = new Date().toISOString().slice(0, 10);
    const paint = () => {
      list.replaceChildren(...habits.map(h => {
        const done = h.days.includes(todayKey);
        let streak = 0;
        for (let i = 0; i < 400; i++){
          const d = new Date(); d.setDate(d.getDate() - i);
          if (h.days.includes(d.toISOString().slice(0, 10))) streak++;
          else if (i > 0) break;
        }
        const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(30, 1fr)', gap: '2px', marginTop: '6px', width: '100%' } },
          ...Array.from({ length: 30 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (29 - i));
            const k = d.toISOString().slice(0, 10);
            return el('div', { title: k, style: { aspectRatio: '1', borderRadius: '2px', background: h.days.includes(k) ? 'var(--accent)' : 'var(--bg2)', border: '1px solid var(--line)' } });
          }));
        const row = el('div', { class: 'item', style: { flexWrap: 'wrap' } },
          el('input', { type: 'checkbox', checked: done }),
          el('span', { text: h.name }),
          el('span', { class: 'hint', style: { marginLeft: 'auto' }, text: `${streak}d · ${h.days.length} total` }),
          el('button', { class: 'x', type: 'button', text: '×' }), grid);
        row.querySelector('input').onchange = e => {
          if (e.target.checked){ if (!h.days.includes(todayKey)) h.days.push(todayKey); }
          else h.days = h.days.filter(d => d !== todayKey);
          save(); paint();
        };
        row.querySelector('.x').onclick = () => { habits = habits.filter(x => x.id !== h.id); save(); paint(); };
        return row;
      }));
    };
    w.append($.row(nameIn, $.btn('Add habit', () => {
      if (!nameIn.value.trim()) return;
      habits.push({ id: Date.now(), name: nameIn.value.trim(), days: [] });
      nameIn.value = ''; save(); paint();
    }, true)), list);
    paint();
  }
});

tool({
  id: 'password-gen', cat: 'prod', name: 'Password Generator',
  desc: 'Crypto-random passwords with charset control and entropy readout.',
  keywords: 'password generator random secure',
  render(w){
    const len = el('input', { type: 'range', min: 6, max: 64, value: 20, style: { width: '100%' } });
    const lenLbl = $.hint('20');
    const sets = {
      lower: ['abcdefghijklmnopqrstuvwxyz', true],
      upper: ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', true],
      digits: ['0123456789', true],
      symbols: ['!@#$%^&*()-_=+[]{};:,.?/', true]
    };
    const boxes = Object.entries(sets).map(([k, [chars, on]]) => {
      const c = el('input', { type: 'checkbox', checked: on });
      return { c, k, chars, node: el('label', { class: 'row', style: { gap: '5px', fontSize: '13px' } }, c, k) };
    });
    const out = el('div', { class: 'out', style: { fontSize: '17px', fontFamily: 'var(--mono)', wordBreak: 'break-all' } });
    const meter = $.hint('');
    const gen = () => {
      let pool = '';
      boxes.forEach(b => { if (b.c.checked) pool += b.chars; });
      if (!pool) { out.textContent = 'Select at least one character set.'; return; }
      const n = +len.value;
      const bytesArr = crypto.getRandomValues(new Uint32Array(n));
      out.textContent = [...bytesArr].map(x => pool[x % pool.length]).join('');
      const bits = n * Math.log2(pool.length);
      meter.textContent = `${pool.length} character pool · ~${bits.toFixed(0)} bits of entropy · crack time at 1e10 guesses/s: ${bits < 40 ? 'minutes' : bits < 60 ? 'days' : bits < 80 ? 'centuries' : 'astronomically long'}`;
    };
    len.oninput = () => { lenLbl.textContent = len.value; gen(); };
    boxes.forEach(b => b.c.onchange = gen);
    gen();
    w.append($.row($.label('Length', len), lenLbl), $.row(...boxes.map(b => b.node)),
      $.row($.btn('Generate', gen, true), $.btn('Copy', async () => { await copy(out.textContent); })), out, meter);
  }
});

tool({
  id: 'random-number', cat: 'prod', name: 'Random Number Generator',
  desc: 'Uniform integers in a range, with or without repeats.',
  keywords: 'random number generator dice',
  render(w){
    const min = $.in('min', '1', 'number'), max = $.in('max', '100', 'number'), count = $.in('count', '1', 'number');
    const uniq = el('input', { type: 'checkbox' });
    const out = $.out();
    const gen = () => {
      const lo = Math.ceil(+min.value), hi = Math.floor(+max.value), n = Math.max(1, Math.min(10000, +count.value || 1));
      if (hi < lo) { out.textContent = 'Max must be ≥ min.'; return; }
      const range = hi - lo + 1;
      if (uniq.checked && n > range) { out.textContent = `Cannot draw ${n} unique values from ${range}.`; return; }
      const res = []; const used = new Set(); const buf = new Uint32Array(1);
      while (res.length < n){
        crypto.getRandomValues(buf);
        const v = lo + (buf[0] % range);
        if (uniq.checked && used.has(v)) continue;
        used.add(v); res.push(v);
      }
      out.textContent = res.join(', ');
    };
    w.append($.row($.label('Min', min), $.label('Max', max), $.label('Count', count),
      el('label', { class: 'row', style: { gap: '5px', fontSize: '13px' } }, uniq, 'Unique')),
      $.btn('Generate', gen, true), out);
  }
});

tool({
  id: 'name-picker', cat: 'prod', name: 'Random Name Picker',
  desc: 'Fair draw from a list; removes the winner unless you keep them in.',
  keywords: 'random picker name draw raffle choose',
  render(w){
    const ta = $.ta('One name per line…'); ta.style.minHeight = '180px';
    const keep = el('input', { type: 'checkbox' });
    const winner = el('div', { class: 'big-num', text: '—' });
    const left = $.hint('');
    const draw = () => {
      let names = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!names.length){ winner.textContent = '—'; return; }
      const buf = crypto.getRandomValues(new Uint32Array(1));
      const pick = names[buf[0] % names.length];
      winner.textContent = pick;
      if (!keep.checked){
        names = names.filter(n => n !== pick);
        ta.value = names.join('\n');
      }
      left.textContent = `${names.length} remaining`;
    };
    w.append(ta, $.row($.btn('Draw', draw, true),
      el('label', { class: 'row', style: { gap: '5px', fontSize: '13px' } }, keep, 'Keep winner in pool')), winner, left);
  }
});

tool({
  id: 'clipboard', cat: 'prod', name: 'Clipboard Manager',
  desc: 'Save snippets locally, one click to re-copy.',
  keywords: 'clipboard snippets copy paste manager',
  render(w){
    const KEY = 'clips';
    let clips = store.get(KEY, []);
    const ta = $.ta('Snippet…'); ta.style.minHeight = '90px';
    const label = $.in('label (optional)');
    const list = el('div', { class: 'list' });
    const save = () => store.set(KEY, clips);
    const paint = () => {
      list.replaceChildren(...clips.map((c, i) => el('div', { class: 'item' },
        el('div', { style: { minWidth: 0, flex: 1 } },
          el('div', { style: { fontWeight: '550' }, text: c.label || 'Untitled' }),
          el('div', { class: 'hint', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, text: c.text })),
        el('button', { class: 'x', type: 'button', text: 'copy', onclick: () => copy(c.text) }),
        el('button', { class: 'x', type: 'button', text: '×', onclick: () => { clips.splice(i, 1); save(); paint(); } }))));
    };
    w.append($.row(label, $.btn('Save snippet', () => {
      if (!ta.value.trim()) return;
      clips.unshift({ label: label.value, text: ta.value }); ta.value = ''; label.value = ''; save(); paint();
    }, true)), ta, list);
    paint();
  }
});

tool({
  id: 'bookmarks', cat: 'prod', name: 'Bookmark Manager',
  desc: 'Personal link list with titles, stored in this browser.',
  keywords: 'bookmarks links save url manager',
  render(w){
    const KEY = 'bookmarks';
    let items = store.get(KEY, []);
    const url = $.in('https://…'), title = $.in('title');
    const list = el('div', { class: 'list' });
    const save = () => store.set(KEY, items);
    const paint = () => {
      list.replaceChildren(...items.map((b, i) => el('div', { class: 'item' },
        el('a', { href: b.url, target: '_blank', rel: 'noopener', text: b.title || b.url, style: { textDecoration: 'underline' } }),
        el('span', { class: 'hint', style: { marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '45%' }, text: b.url }),
        el('button', { class: 'x', type: 'button', text: '×', onclick: () => { items.splice(i, 1); save(); paint(); } }))));
    };
    w.append($.row(url, title, $.btn('Add', () => {
      if (!url.value.trim()) return;
      const u = url.value.startsWith('http') ? url.value : 'https://' + url.value;
      items.unshift({ url: u, title: title.value });
      url.value = title.value = ''; save(); paint();
    }, true)), list);
    paint();
  }
});

tool({
  id: 'reminders', cat: 'prod', name: 'Reminder Manager',
  desc: 'Timed reminders with browser notifications while the tab is open.',
  keywords: 'reminder notification alert time',
  render(w){
    const KEY = 'reminders';
    let items = store.get(KEY, []);
    const text = $.in('remind me to…');
    const when = el('input', { class: 'in', type: 'datetime-local' });
    const list = el('div', { class: 'list' });
    const save = () => store.set(KEY, items);
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    const paint = () => {
      list.replaceChildren(...items.map((r, i) => el('div', { class: 'item' + (r.fired ? ' done' : '') },
        el('span', { text: r.text }),
        el('span', { class: 'hint', style: { marginLeft: 'auto' }, text: new Date(r.at).toLocaleString() }),
        el('button', { class: 'x', type: 'button', text: '×', onclick: () => { items.splice(i, 1); save(); paint(); } }))));
    };
    const id = setInterval(() => {
      const now = Date.now();
      let changed = false;
      items.forEach(r => {
        if (!r.fired && r.at <= now){
          r.fired = true; changed = true;
          if (Notification.permission === 'granted') new Notification('Reminder', { body: r.text });
        }
      });
      if (changed){ save(); paint(); }
    }, 5000);
    w.addEventListener('uh:unmount', () => clearInterval(id));
    w.append($.row(text, $.label('When', when), $.btn('Add', () => {
      if (!text.value || !when.value) return;
      items.push({ text: text.value, at: new Date(when.value).getTime(), fired: false });
      text.value = ''; save(); paint();
    }, true)), list);
    paint();
  }
});

/* -------------------- NETWORK -------------------- */

tool({
  id: 'ip-check', cat: 'net', name: 'IP Address Checker', needsApi: true,
  desc: 'Your public IPv4 and network details via api.ipify.org + ipapi.co.',
  keywords: 'ip address public network what is my ip',
  render(w){
    const out = $.out();
    const go = async () => {
      out.textContent = 'Checking…';
      try {
        const ip = await (await fetch('https://api.ipify.org?format=json')).json();
        let extra = '';
        try {
          const j = await (await fetch('https://ipapi.co/' + ip.ip + '/json/')).json();
          extra = `\ncity        ${j.city || '—'}\nregion      ${j.region || '—'}\ncountry     ${j.country_name || '—'} (${j.country_code || '—'})\norg         ${j.org || '—'}\ntimezone    ${j.timezone || '—'}`;
        } catch {}
        out.textContent = `public IPv4  ${ip.ip}${extra}\n\nlocal hint   ${navigator.connection?.effectiveType || 'unknown'} · ${navigator.onLine ? 'online' : 'offline'}`;
      } catch (e) { out.textContent = 'Lookup failed: ' + e.message; }
    };
    w.append($.btn('Check my IP', go, true), out);
    go();
  }
});

tool({
  id: 'ua-viewer', cat: 'net', name: 'User-Agent Viewer',
  desc: 'Your UA string plus parsed hints and a copy button.',
  keywords: 'user agent browser ua viewer',
  render(w){
    const ua = navigator.userAgent;
    const rows = [
      ['User-Agent', ua],
      ['Platform', navigator.platform || '—'],
      ['Language', navigator.language],
      ['Languages', (navigator.languages || []).join(', ')],
      ['Cores', String(navigator.hardwareConcurrency || '—')],
      ['Screen', `${screen.width}×${screen.height} @${devicePixelRatio}x`],
      ['Viewport', `${innerWidth}×${innerHeight}`],
      ['Touch', String(navigator.maxTouchPoints > 0)],
      ['Cookies', String(navigator.cookieEnabled)]
    ];
    w.append(el('div', { class: 'list' }, ...rows.map(([k, v]) =>
      el('div', { class: 'item' }, el('span', { class: 'fl', style: { width: '110px', flex: 'none' }, text: k }), el('span', { text: v, style: { wordBreak: 'break-all' } })))),
      $.btn('Copy UA', () => copy(ua)));
  }
});

tool({
  id: 'url-encode', cat: 'net', name: 'URL Encoder / Decoder',
  desc: 'encodeURIComponent / decodeURIComponent, or full URL encoding.',
  keywords: 'url encode decode percent escape',
  render(w){
    const ta = $.ta('text or URL…'); ta.style.minHeight = '140px';
    const out = $.out();
    w.append(ta, $.row(
      $.btn('Encode component', () => out.textContent = encodeURIComponent(ta.value), true),
      $.btn('Encode full URL', () => out.textContent = encodeURI(ta.value)),
      $.btn('Decode', () => { try { out.textContent = decodeURIComponent(ta.value); } catch (e) { out.textContent = 'Invalid encoding: ' + e.message; } }),
      $.btn('Copy', () => copy(out.textContent))), out);
  }
});

tool({
  id: 'speed-test', cat: 'net', name: 'Internet Speed Test', needsApi: true,
  desc: 'Download throughput measured against Cloudflare’s speed endpoint.',
  keywords: 'speed test bandwidth download mbps internet',
  how: 'Pulls sized payloads from speed.cloudflare.com/__down and measures wall-clock time.',
  render(w){
    const out = $.out();
    const bar = el('div', { style: { height: '6px', borderRadius: '3px', background: 'var(--bg2)', overflow: 'hidden' } },
      el('div', { style: { height: '100%', width: '0%', background: 'var(--accent)', transition: 'width .2s' } }));
    const run = async () => {
      out.textContent = 'Measuring download…';
      const sizes = [1e6, 5e6, 1e7];
      let totalBytes = 0, totalMs = 0;
      for (const [i, size] of sizes.entries()){
        const t0 = performance.now();
        const res = await fetch(`https://speed.cloudflare.com/__down?bytes=${size}&r=${Math.random()}`, { cache: 'no-store' });
        const buf = await res.arrayBuffer();
        const ms = performance.now() - t0;
        totalBytes += buf.byteLength; totalMs += ms;
        bar.firstChild.style.width = `${((i + 1) / sizes.length) * 100}%`;
      }
      const mbps = (totalBytes * 8) / (totalMs / 1000) / 1e6;
      out.textContent = `download  ${mbps.toFixed(2)} Mbps\n          ${(mbps / 8).toFixed(2)} MB/s\nsamples   ${sizes.map(s => (s / 1e6) + 'MB').join(', ')}\ntime      ${(totalMs / 1000).toFixed(2)} s`;
    };
    w.append($.btn('Run download test', run, true), bar, out);
  }
});

tool({
  id: 'dns-lookup', cat: 'net', name: 'DNS Lookup', needsApi: true,
  desc: 'A / AAAA / MX / TXT / CNAME / NS records via Google Public DNS.',
  keywords: 'dns lookup records mx txt a ns',
  render(w){
    const name = $.in('domain', 'example.com');
    const type = $.sel(['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA', 'CAA'], 'A');
    const out = $.out();
    const go = async () => {
      out.textContent = 'Querying…';
      try {
        const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name.value)}&type=${type.value}`);
        const j = await r.json();
        if (!j.Answer){ out.textContent = `Status ${j.Status} — no answers.`; return; }
        out.textContent = j.Answer.map(a => `${String(a.type).padEnd(6)} TTL ${String(a.TTL).padEnd(6)} ${a.data}`).join('\n');
      } catch (e) { out.textContent = 'Lookup failed: ' + e.message; }
    };
    name.onkeydown = e => { if (e.key === 'Enter') go(); };
    w.append($.row(name, $.label('Type', type), $.btn('Look up', go, true)), out);
  }
});

tool({
  id: 'http-headers', cat: 'net', name: 'HTTP Header Viewer', needsApi: true,
  desc: 'Fetch and list response headers through a small proxy endpoint.',
  keywords: 'http headers response inspect curl',
  render(w){
    const url = $.in('https://…', 'https://example.com');
    const out = $.out();
    const go = async () => {
      out.textContent = 'Requesting…';
      try {
        const r = await fetch('/api/headers?url=' + encodeURIComponent(url.value));
        if (!r.ok) throw new Error('endpoint returned ' + r.status);
        const j = await r.json();
        out.textContent = `status ${j.status}\n\n` + Object.entries(j.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
      } catch (e) {
        out.textContent = `Endpoint not reachable (${e.message}).\n\nDeploy a Cloudflare Worker at /api/headers that fetches the target and returns { status, headers }.`;
      }
    };
    w.append($.row(url, $.btn('Fetch headers', go, true)), out);
  }
});

tool({
  id: 'ssl-check', cat: 'net', name: 'SSL Certificate Checker', needsApi: true,
  desc: 'Certificate subject, issuer, and expiry for a host.',
  keywords: 'ssl tls certificate expiry check',
  render(w){
    const host = $.in('host', 'example.com');
    const out = $.out();
    const go = async () => {
      out.textContent = 'Checking…';
      try {
        const r = await fetch('/api/ssl?host=' + encodeURIComponent(host.value));
        if (!r.ok) throw new Error('endpoint returned ' + r.status);
        out.textContent = JSON.stringify(await r.json(), null, 2);
      } catch (e) {
        out.textContent = `Endpoint not reachable (${e.message}).\n\nNeeds a server-side TLS handshake. Contract: GET /api/ssl?host=<host> → { subject, issuer, validFrom, validTo, daysLeft, altNames[] }.`;
      }
    };
    w.append($.row(host, $.btn('Check certificate', go, true)), out);
  }
});

tool({
  id: 'url-shortener', cat: 'net', name: 'URL Shortener', needsApi: true,
  desc: 'Shorten a link through your own endpoint (or a keyed provider).',
  keywords: 'short url link tiny',
  render(w){
    const url = $.in('long URL', '');
    const out = $.out();
    const go = async () => {
      try {
        const r = await fetch('/api/shorten', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: url.value }) });
        if (!r.ok) throw new Error('endpoint returned ' + r.status);
        const j = await r.json();
        out.textContent = j.short || JSON.stringify(j);
      } catch (e) {
        out.textContent = `Endpoint not reachable (${e.message}).\n\nContract: POST /api/shorten { url } → { short }.`;
      }
    };
    w.append($.row(url, $.btn('Shorten', go, true)), out);
  }
});

tool({
  id: 'site-qr', cat: 'net', name: 'Website QR Generator',
  desc: 'QR for any URL with size and error-correction control.',
  keywords: 'website qr code url link',
  render(w){
    const url = $.in('https://…', 'https://');
    const size = $.in('px', '320', 'number');
    const ec = $.sel([{ v: 'L', t: 'L — 7%' }, { v: 'M', t: 'M — 15%' }, { v: 'Q', t: 'Q — 25%' }, { v: 'H', t: 'H — 30%' }], 'M');
    const canvas = el('canvas');
    const go = async () => {
      if (!url.value) return;
      const QRCode = await window.UH.lib('qrcode');
      await QRCode.toCanvas(canvas, url.value, { width: Math.max(80, Math.min(1024, +size.value || 320)), errorCorrectionLevel: ec.value, margin: 2 });
    };
    w.append($.row(url, $.label('Size', size), $.label('Error correction', ec), $.btn('Generate', go, true)),
      canvas, $.btn('Download PNG', () => canvas.toBlob(b => download(b, 'website-qr.png'))));
  }
});

tool({
  id: 'screenshot', cat: 'net', name: 'Website Screenshot Tool', needsApi: true,
  desc: 'Full-page screenshot through a rendering service you control.',
  keywords: 'screenshot website capture page',
  render(w){
    const url = $.in('https://…', 'https://example.com');
    const out = el('div', { class: 'col' });
    const go = async () => {
      try {
        const r = await fetch('/api/screenshot?url=' + encodeURIComponent(url.value));
        if (!r.ok) throw new Error('endpoint returned ' + r.status);
        const blob = await r.blob();
        out.replaceChildren(el('img', { src: URL.createObjectURL(blob), class: 'preview' }),
          $.btn('Download', () => download(blob, 'screenshot.png')));
      } catch (e) {
        out.replaceChildren(el('div', { class: 'err', text: `Endpoint not reachable (${e.message}).\n\nContract: GET /api/screenshot?url=<url> → image/png. Puppeteer / Playwright page.screenshot({ fullPage: true }).` }));
      }
    };
    w.append($.row(url, $.btn('Capture', go, true)), out);
  }
});
})();