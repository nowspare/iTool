/* iHub engine — registry, router, search, themes, storage, lazy libs */
(() => {
'use strict';

function el(tag, attrs, ...kids){
  const n = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)){
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(9)){
    if (kid === null || kid === undefined || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

const store = {
  get(k, d){ try { const v = localStorage.getItem('uh.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v){ try { localStorage.setItem('uh.' + k, JSON.stringify(v)); } catch {} }
};

const LIBS = {
  pdflib: { src: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js', g: 'PDFLib' },
  pdfjs:  { src: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', g: 'pdfjsLib',
            after(){ pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'; } },
  jspdf:  { src: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', g: 'jspdf' },
  jszip:  { src: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', g: 'JSZip' },
  qrcode: { src: 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js', g: 'QRCode' },
  jsqr:   { src: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js', g: 'jsQR' }
};
const _libP = {};
function lib(name){
  if (_libP[name]) return _libP[name];
  return _libP[name] = new Promise((res, rej) => {
    const L = LIBS[name];
    if (!L) return rej(new Error('unknown lib ' + name));
    if (window[L.g]) { L.after?.(); return res(window[L.g]); }
    const s = document.createElement('script');
    s.src = L.src; s.async = true;
    s.onload = () => { try { L.after?.(); res(window[L.g]); } catch (e){ rej(e); } };
    s.onerror = () => rej(new Error('failed to load ' + name + ' (offline or blocked)'));
    document.head.append(s);
  });
}

function download(data, name, type = 'application/octet-stream'){
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function readFile(f){
  return {
    name: f.name, size: f.size, type: f.type || '',
    buf: () => f.arrayBuffer(),
    text: () => f.text(),
    dataURL: () => new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = j; fr.readAsDataURL(f); })
  };
}
function bytes(n){
  if (!n && n !== 0) return '—';
  const u = ['B','KB','MB','GB','TB']; let i = 0;
  while (n >= 1024 && i < u.length - 1){ n /= 1024; i++; }
  return n.toFixed(i ? 2 : 0) + ' ' + u[i];
}
async function copy(text){
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

const ui = {
  ta(ph = '', val = ''){ return el('textarea', { class: 'ta', placeholder: ph, spellcheck: 'false', value: val }); },
  in(ph = '', val = '', type = 'text'){ return el('input', { class: 'in', placeholder: ph, type, value: val }); },
  sel(opts, val){ return el('select', { class: 'sel' }, opts.map(o => el('option', { value: o.v ?? o, selected: (o.v ?? o) === val }, o.t ?? o))); },
  btn(label, onclick, primary){ return el('button', { class: 'btn' + (primary ? ' btn-p' : ''), onclick, type: 'button' }, label); },
  row(...k){ return el('div', { class: 'row' }, ...k); },
  col(...k){ return el('div', { class: 'col' }, ...k); },
  split(a, b){ return el('div', { class: 'split' }, a, b); },
  label(t, c){ return el('label', { class: 'field' }, el('span', { class: 'fl' }, t), c); },
  out(){ return el('pre', { class: 'out' }, ''); },
  hint(t){ return el('p', { class: 'hint' }, t); },
  dz(label, onFiles){
    const input = el('input', { type: 'file', multiple: true, hidden: true });
    const zone = el('div', { class: 'dz', tabindex: '0' }, label);
    const list = el('div', { class: 'dz-list' });
    const fire = files => { if (files?.length) onFiles([...files]); };
    zone.onclick = () => input.click();
    zone.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') input.click(); };
    input.onchange = () => fire(input.files);
    zone.ondragover = e => { e.preventDefault(); zone.classList.add('over'); };
    zone.ondragleave = () => zone.classList.remove('over');
    zone.ondrop = e => { e.preventDefault(); zone.classList.remove('over'); fire(e.dataTransfer.files); };
    zone.append(input);
    return { zone, list, setNames: names => { list.textContent = ''; names.forEach(n => list.append(el('div', { text: n }))); } };
  },
  ring({ size = 240, stroke = 12 } = {}){
    const NS = 'http://www.w3.org/2000/svg';
    const c = size / 2;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const mk = (tag, attrs = {}) => {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      return n;
    };
    const svg = mk('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size });
    svg.style.display = 'block';

    const track = mk('circle', { cx: c, cy: c, r, fill: 'none', 'stroke-width': stroke });
    track.style.stroke = 'var(--line2)';

    const prog = mk('circle', {
      cx: c, cy: c, r, fill: 'none',
      'stroke-width': stroke, 'stroke-linecap': 'round',
      'stroke-dasharray': String(circ), 'stroke-dashoffset': String(circ),
      transform: `rotate(-90 ${c} ${c})`
    });
    prog.style.stroke = 'var(--accent)';

    const main = mk('text', {
      x: c, y: c + size * 0.06, 'text-anchor': 'middle',
      'font-size': String(size * 0.17), 'font-weight': '600'
    });
    main.style.fill = 'var(--text)';
    main.style.fontFamily = 'var(--mono)';
    main.style.fontVariantNumeric = 'tabular-nums';

    const sub = mk('text', {
      x: c, y: c + size * 0.20, 'text-anchor': 'middle',
      'font-size': String(size * 0.07)
    });
    sub.style.fill = 'var(--muted)';
    sub.style.fontFamily = 'var(--mono)';

    svg.append(track, prog, main, sub);

    return {
      node: svg,
      set(frac, m = '', s = ''){
        const f = Math.max(0, Math.min(1, frac || 0));
        prog.setAttribute('stroke-dashoffset', String(circ * (1 - f)));
        main.textContent = m;
        sub.textContent = s;
      }
    };
  }
};

const TOOLS = [];
function tool(def){
  if (!def.id || !def.render) throw new Error('bad tool def');
  def.keywords = def.keywords || '';
  def.how = def.how || '';
  def.cat = def.cat || 'misc';
  if (!TOOLS.some(t => t.id === def.id)) TOOLS.push(def);
}

const CATS = [
  { id: 'pdf',     name: 'PDF Tools',            mono: 'PD' },
  { id: 'image',   name: 'Image Tools',          mono: 'IM' },
  { id: 'text',    name: 'Text & Writing',       mono: 'TX' },
  { id: 'calc',    name: 'Calculators',          mono: 'CA' },
  { id: 'file',    name: 'File Tools',           mono: 'FL' },
  { id: 'prod',    name: 'Productivity',         mono: 'PR' },
  { id: 'net',     name: 'Internet & Network',   mono: 'NT' },
  { id: 'dev',     name: 'Developer Tools',      mono: 'DV' },
  { id: 'daily',   name: 'Everyday Utilities',   mono: 'DY' }
];

const S = {
  favs: store.get('favs', []),
  recent: store.get('recent', []),
  theme: store.get('theme', 'snow'),
  mode: store.get('mode', 'auto')
};

const THEMES = [
  { id: 'snow',     name: 'Snow White',    sw: '#ffffff' },
  { id: 'midnight', name: 'Midnight',      sw: '#0d1015' },
  { id: 'sand',     name: 'Warm Sand',     sw: '#e8ddca' },
  { id: 'lavender', name: 'Soft Lavender', sw: '#e2daf7' },
  { id: 'slate',    name: 'Slate',         sw: '#cfd7df' }
];

function applyTheme(){
  const html = document.documentElement;
  html.dataset.theme = S.theme;
  const dark = S.mode === 'dark' || (S.mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  html.dataset.mode = dark ? 'dark' : 'light';
  store.set('theme', S.theme); store.set('mode', S.mode);
}

/* ============================================================
   SPLASH — driven by Web Animations API.
   Guaranteed to fire. Handles reduced-motion gracefully.
   ============================================================ */
function runSplash(){
  const sp = document.getElementById('splash');
  if (!sp) return;

  /* ?nosplash=1 → remove instantly */
  if (/[?&]nosplash=1/.test(location.search)){
    sp.remove();
    return;
  }

  /* clamp duration to your 5–10s window */
  const dur = Math.max(5000, Math.min(10000, +(sp.dataset.duration) || 6600));
  const fade = 600;

  /* tell CSS when to start its fallback fade-out */
  sp.style.setProperty('--splash-out-delay', (dur - fade) + 'ms');

  /* lock scroll while it plays */
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  /* remove when done (also ensures a clean DOM even if CSS fade fails) */
  setTimeout(() => {
    sp.remove();
    document.body.style.overflow = prevOverflow;
  }, dur);

  /* reduced-motion: skip the elaborate sequence */
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mark = sp.querySelector('.sp-mark');
  const dot = sp.querySelector('.sp-dot');
  const stem = sp.querySelector('.sp-stem');
  const r1 = sp.querySelector('.sp-ripple.r1');
  const r2 = sp.querySelector('.sp-ripple.r2');
  const r3 = sp.querySelector('.sp-ripple.r3');
  const lockup = sp.querySelector('.sp-lockup');
  const chars = [...sp.querySelectorAll('.sp-char')];
  const underline = sp.querySelector('.sp-underline');
  const tag = sp.querySelector('.sp-tag');
  const word = sp.querySelector('.sp-word');

  if (reduced){
    /* simple fade-in / hold / fade-out, no motion */
    mark.style.transform = 'scale(1)';
    stem.style.strokeDasharray = 'none';
    stem.style.strokeDashoffset = '0';
    return;
  }

  /* ---- FORCE INITIAL HIDDEN STATES (in case CSS defaults leak) ---- */
  mark.style.transform = 'scale(2.4) rotate(-45deg)';
  dot.style.opacity = '0';
  stem.style.strokeDasharray = '30';
  stem.style.strokeDashoffset = '30';
  r1.style.opacity = '0';
  r2.style.opacity = '0';
  r3.style.opacity = '0';
  chars.forEach(c => { c.style.opacity = '0'; c.style.transform = 'translateY(24px) rotate(8deg)'; });
  underline.style.transform = 'scaleX(0)';
  tag.style.opacity = '0';

  const anim = (node, kf, opt) => {
    try { return node.animate(kf, { fill: 'forwards', ...opt }); }
    catch (e) { console.warn('animate fail', e); return null; }
  };

  /* 1) dot drops in with bounce (0.10 → 0.85s) */
  anim(dot, [
    { transform: 'translateY(-80px) scale(0.3)', opacity: 0, offset: 0 },
    { transform: 'translateY(6px) scale(1.15)', opacity: 1, offset: 0.55 },
    { transform: 'translateY(-3px) scale(0.95)', offset: 0.78 },
    { transform: 'translateY(0) scale(1)', opacity: 1, offset: 1 }
  ], { duration: 800, delay: 100, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });

  /* 2) two ripples expand from the dot (0.72 → 1.95s) */
  anim(r1, [
    { transform: 'scale(1)', opacity: 0.85 },
    { transform: 'scale(4.2)', opacity: 0 }
  ], { duration: 950, delay: 720, easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)' });

  anim(r2, [
    { transform: 'scale(1)', opacity: 0.55 },
    { transform: 'scale(6)', opacity: 0 }
  ], { duration: 1200, delay: 880, easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)' });

  /* 3) stem draws upward (0.85 → 1.7s) */
  anim(stem, [
    { strokeDashoffset: 30 },
    { strokeDashoffset: 0 }
  ], { duration: 850, delay: 850, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });

  /* 4) mark SPINS 360° + shrinks to true size (1.7 → 2.6s) */
  anim(mark, [
    { transform: 'scale(2.4) rotate(-45deg)', opacity: 1 },
    { transform: 'scale(0.94) rotate(200deg)', offset: 0.7 },
    { transform: 'scale(1) rotate(315deg)' }
  ], { duration: 950, delay: 1700, easing: 'cubic-bezier(0.45, 0, 0.15, 1)' });

  /* 5) third ripple fires as the mark settles (2.0 → 2.9s) */
  anim(r3, [
    { transform: 'scale(0.8)', opacity: 0.55 },
    { transform: 'scale(3.2)', opacity: 0 }
  ], { duration: 900, delay: 2050, easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)' });

  /* 6) wordmark letters cascade in (2.45 → 3.1s) */
  chars.forEach((c, i) => {
    anim(c, [
      { transform: 'translateY(24px) rotate(8deg)', opacity: 0 },
      { transform: 'translateY(0) rotate(0deg)', opacity: 1 }
    ], { duration: 520, delay: 2450 + i * 130, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
  });

  /* 7) lockup slides left by half wordmark width so group stays centered */
  requestAnimationFrame(() => {
    const wordW = word.offsetWidth || 100;
    anim(lockup, [
      { transform: 'translateX(0)' },
      { transform: `translateX(${-(wordW / 2)}px)` }
    ], { duration: 700, delay: 2450, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  });

  /* 8) underline sweeps (3.15 → 3.75s) */
  anim(underline, [
    { transform: 'scaleX(0)' },
    { transform: 'scaleX(1)' }
  ], { duration: 600, delay: 3150, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });

  /* 9) tagline fades (3.65 → 4.15s) */
  anim(tag, [
    { opacity: 0, transform: 'translateY(6px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration: 500, delay: 3650, easing: 'ease-out' });

  /* 10) breathing pulse during the hold (4.4s) */
  setTimeout(() => {
    if (!mark.isConnected) return;
    anim(mark, [
      { transform: 'scale(1)' },
      { transform: 'scale(1.06)' },
      { transform: 'scale(1)' }
    ], { duration: 1600, iterations: 2, easing: 'ease-in-out' });
  }, 4400);

  /* 11) final fade via CSS animation, then remove */
  /* CSS is already set to fade at `dur − fade`. Nothing more to do. */
}

/* ---------- favorites / recents ---------- */
function toggleFav(id){
  const i = S.favs.indexOf(id);
  i < 0 ? S.favs.unshift(id) : S.favs.splice(i, 1);
  store.set('favs', S.favs);
}
function markRecent(id){
  S.recent = [id, ...S.recent.filter(x => x !== id)].slice(0, 12);
  store.set('recent', S.recent);
}

function card(t){
  return el('a', { class: 'card', href: '#/t/' + t.id },
    el('div', { class: 'mono-badge', text: (CATS.find(c => c.id === t.cat)?.mono) || '··' }),
    el('div', { class: 'card-b' },
      el('p', { class: 'card-t' }, t.name, t.needsApi ? el('span', { class: 'tagapi', text: 'API' }) : null),
      el('p', { class: 'card-d', text: t.desc })
    )
  );
}
function grid(list){ return el('div', { class: 'grid' }, list.map(card)); }
function section(title, list, href){
  return el('section', { class: 'sect' },
    el('div', { class: 'sect-head' }, el('h2', { text: title }), href ? el('a', { href }, 'View all →') : null),
    list.length ? grid(list) : el('div', { class: 'empty', text: 'Nothing here yet.' })
  );
}

const view = document.getElementById('view');

function viewHome(){
  const favs = TOOLS.filter(t => S.favs.includes(t.id));
  const recent = TOOLS.filter(t => S.recent.includes(t.id));
  view.replaceChildren(
    el('div', { class: 'hero' },
      el('h1', { text: 'Every ordinary digital task, one place.' }),
      el('p', { text: `${TOOLS.length} tools across ${CATS.length} categories. Runs in your browser — files never leave the tab unless a tool is marked API.` })
    ),
    favs.length ? section('Favorites', favs) : '',
    recent.length ? section('Recently used', recent) : '',
    ...CATS.map(c => {
      const list = TOOLS.filter(t => t.cat === c.id);
      return section(c.name, list.slice(0, 6), list.length > 6 ? '#/c/' + c.id : null);
    })
  );
  document.querySelectorAll('.cat').forEach(a => a.setAttribute('aria-current', String(a.dataset.cat === 'home')));
}

function viewCategory(id){
  const c = CATS.find(x => x.id === id);
  if (!c) return viewHome();
  const list = TOOLS.filter(t => t.cat === id);
  view.replaceChildren(
    el('div', { class: 'crumb' }, el('a', { href: '#/' }, 'Home'), ' / ', c.name),
    el('h1', { text: c.name, style: { fontSize: '24px', margin: '0 0 4px' } }),
    el('p', { class: 'tool-desc', text: `${list.length} tools` }),
    grid(list)
  );
  document.querySelectorAll('.cat').forEach(a => a.setAttribute('aria-current', String(a.dataset.cat === id)));
}

function viewList(ids, title, blurb){
  const list = ids.map(id => TOOLS.find(t => t.id === id)).filter(Boolean);
  view.replaceChildren(
    el('div', { class: 'crumb' }, el('a', { href: '#/' }, 'Home'), ' / ', title),
    el('h1', { text: title, style: { fontSize: '24px', margin: '0 0 4px' } }),
    el('p', { class: 'tool-desc', text: blurb }),
    list.length ? grid(list) : el('div', { class: 'empty', text: 'Nothing saved yet. Open a tool and hit Save.' })
  );
}

function viewSearch(q){
  const term = q.toLowerCase().trim();
  const hits = !term ? [] : TOOLS.filter(t =>
    t.name.toLowerCase().includes(term) ||
    t.desc.toLowerCase().includes(term) ||
    t.keywords.toLowerCase().includes(term) ||
    (CATS.find(c => c.id === t.cat)?.name.toLowerCase() || '').includes(term)
  ).sort((a, b) => {
    const an = a.name.toLowerCase().startsWith(term) ? 0 : 1;
    const bn = b.name.toLowerCase().startsWith(term) ? 0 : 1;
    return an - bn || a.name.localeCompare(b.name);
  });
  view.replaceChildren(
    el('div', { class: 'crumb' }, el('a', { href: '#/' }, 'Home'), ' / Search'),
    el('h1', { text: `“${q}”`, style: { fontSize: '22px', margin: '0 0 4px' } }),
    el('p', { class: 'tool-desc', text: `${hits.length} result${hits.length === 1 ? '' : 's'}` }),
    hits.length ? grid(hits) : el('div', { class: 'empty', text: 'No tool matched. Try “pdf”, “hash”, “timer”, “json”.' })
  );
}

function viewTool(id){
  const t = TOOLS.find(x => x.id === id);
  if (!t) return viewHome();
  markRecent(id);

  const oldWs = view.querySelector('.workspace');
  if (oldWs) oldWs.dispatchEvent(new CustomEvent('uh:unmount'));

  const c = CATS.find(x => x.id === t.cat);
  const favBtn = el('button', {
    class: 'fav-btn', type: 'button',
    'data-on': String(S.favs.includes(id)),
    onclick: e => { toggleFav(id); e.currentTarget.dataset.on = String(S.favs.includes(id)); e.currentTarget.textContent = S.favs.includes(id) ? '★ Saved' : '☆ Save'; }
  }, S.favs.includes(id) ? '★ Saved' : '☆ Save');

  const ws = el('div', { class: 'workspace' });
  view.replaceChildren(
    el('div', { class: 'crumb' }, el('a', { href: '#/' }, 'Home'), ' / ', el('a', { href: '#/c/' + t.cat }, c?.name || ''), ' / ', t.name),
    el('div', { class: 'tool-head' }, el('h1', { text: t.name }), favBtn),
    el('p', { class: 'tool-desc', text: t.desc }),
    ws,
    t.how ? el('details', { class: 'how' }, el('summary', { text: 'How it works' }), el('p', { text: t.how })) : ''
  );
  view.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });

  Promise.resolve()
    .then(() => t.render(ws))
    .catch(err => {
      ws.append(el('div', { class: 'err', text: `${t.name} failed: ${err?.message || err}\n\n${err?.stack || ''}` }));
    });
}

function route(){
  const h = location.hash.replace(/^#\/?/, '');
  document.getElementById('side').classList.remove('open');
  if (!h) return viewHome();
  const [seg, a] = h.split('/');
  if (seg === 't' && a) return viewTool(a);
  if (seg === 'c' && a) return viewCategory(a);
  if (seg === 'favorites') return viewList(S.favs, 'Favorites', 'Your saved tools, in order of saving.');
  if (seg === 'recent') return viewList(S.recent, 'Recently used', 'Last twelve tools you opened.');
  if (seg === 'q') return viewSearch(decodeURIComponent(a || ''));
  viewHome();
}

function buildNav(){
  const nav = document.getElementById('cats');
  nav.replaceChildren(
    el('a', { class: 'cat', 'data-cat': 'home', href: '#/' }, el('span', { text: 'All tools' }), el('span', { class: 'n', text: String(TOOLS.length) })),
    ...CATS.map(c => {
      const n = TOOLS.filter(t => t.cat === c.id).length;
      return el('a', { class: 'cat', 'data-cat': c.id, href: '#/c/' + c.id },
        el('span', { text: c.name }), el('span', { class: 'n', text: String(n) }));
    })
  );
}
function buildThemePop(){
  const list = document.getElementById('themeList');
  list.replaceChildren(...THEMES.map(t =>
    el('button', {
      type: 'button', 'aria-current': String(S.theme === t.id),
      onclick: () => { S.theme = t.id; applyTheme(); buildThemePop(); }
    }, el('span', { class: 'sw', style: { background: t.sw } }), t.name)
  ));
  document.querySelectorAll('.tp-modes .chip').forEach(b => {
    b.setAttribute('aria-current', String(S.mode === b.dataset.mode));
    b.onclick = () => { S.mode = b.dataset.mode; applyTheme(); buildThemePop(); };
  });
}

function boot(){
  applyTheme();
  buildNav();
  buildThemePop();

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.mode === 'auto') applyTheme(); });

  document.getElementById('navToggle').onclick = () => document.getElementById('side').classList.toggle('open');
  const pop = document.getElementById('themePop');
  document.getElementById('themeBtn').onclick = e => { e.stopPropagation(); pop.hidden = !pop.hidden; };
  document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target)) pop.hidden = true; });

  const search = document.getElementById('search');
  let tid;
  search.oninput = () => {
    clearTimeout(tid);
    const v = search.value.trim();
    tid = setTimeout(() => {
      if (!v) { if (location.hash.startsWith('#/q/')) location.hash = '#/'; return; }
      location.hash = '#/q/' + encodeURIComponent(v);
    }, 140);
  };
  search.onkeydown = e => {
    if (e.key === 'Escape'){ search.value = ''; search.blur(); location.hash = '#/'; }
  };
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== search && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)){
      e.preventDefault(); search.focus(); search.select();
    }
  });

  window.addEventListener('hashchange', route);
  route();

  /* splash runs last so the rest of the page is already rendered underneath */
  runSplash();
}

window.UH = { el, tool, ui, lib, download, readFile, bytes, copy, store, CATS, TOOLS, S };
window.addEventListener('DOMContentLoaded', boot);

})();