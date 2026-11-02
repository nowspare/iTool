/* UtilityHub engine — registry, router, search, themes, storage, lazy libs */
(() => {
'use strict';

/* ---------- DOM helper ---------- */
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

/* ---------- storage ---------- */
const store = {
  get(k, d){ try { const v = localStorage.getItem('uh.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v){ try { localStorage.setItem('uh.' + k, JSON.stringify(v)); } catch {} }
};

/* ---------- lazy CDN libs ---------- */
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

/* ---------- io helpers ---------- */
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

/* ---------- UI kit ---------- */
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
  }
};

ring({ size = 240, stroke = 12 } = {}){
    const NS = 'http://www.w3.org/2000/svg';
    const c = size / 2;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const mk = (tag, attrs) => {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      return n;
    };
    const svg = mk('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img' });
    svg.style.display = 'block';
    const track = mk('circle', { cx: c, cy: c, r, fill: 'none', stroke: 'var(--bg2)', 'stroke-width': stroke });
    const prog = mk('circle', {
      cx: c, cy: c, r, fill: 'none', stroke: 'var(--accent)', 'stroke-width': stroke,
      'stroke-linecap': 'round', 'stroke-dasharray': circ, 'stroke-dashoffset': circ,
      transform: `rotate(-90 ${c} ${c})`
    });
    const main = mk('text', {
      x: c, y: c - size * 0.012, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: 'var(--text)', 'font-family': 'var(--mono)', 'font-variant-numeric': 'tabular-nums',
      'font-size': size * 0.17, 'font-weight': '600'
    });
    const sub = mk('text', {
      x: c, y: c + size * 0.145, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: 'var(--muted)', 'font-family': 'var(--mono)', 'font-size': size * 0.072
    });
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
  },

/* ---------- registry ---------- */
const TOOLS = [];
function tool(def){
  if (!def.id || !def.render) throw new Error('bad tool def');
  def.keywords = def.keywords || '';
  def.how = def.how || '';
  def.cat = def.cat || 'misc';
  if (!TOOLS.some(t => t.id === def.id)) TOOLS.push(def);
}

/* ---------- categories ---------- */
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

/* ---------- state ---------- */
const S = {
  favs: store.get('favs', []),
  recent: store.get('recent', []),
  theme: store.get('theme', 'snow'),
  mode: store.get('mode', 'auto')
};

const THEMES = [
  { id: 'snow',     name: 'Snow White', sw: '#ffffff' },
  { id: 'midnight', name: 'Midnight',   sw: '#0d1015' },
  { id: 'sand',     name: 'Warm Sand',  sw: '#e8ddca' },
  { id: 'lavender', name: 'Soft Lavender', sw: '#e2daf7' },
  { id: 'slate',    name: 'Slate',      sw: '#cfd7df' }
];

function applyTheme(){
  const html = document.documentElement;
  html.dataset.theme = S.theme;
  const dark = S.mode === 'dark' || (S.mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  html.dataset.mode = dark ? 'dark' : 'light';
  store.set('theme', S.theme); store.set('mode', S.mode);
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

/* ---------- card ---------- */
function card(t){
  const fav = S.favs.includes(t.id);
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

/* ---------- views ---------- */
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

/* ---------- router ---------- */
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

/* ---------- chrome ---------- */
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

/* ---------- boot ---------- */
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
}

/* ---------- public surface ---------- */
window.UH = { el, tool, ui, lib, download, readFile, bytes, copy, store, CATS, TOOLS, S };
window.addEventListener('DOMContentLoaded', boot);

})();
