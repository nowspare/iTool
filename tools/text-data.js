/* Text & writing, file/data, developer tools — pure JS, no network */
(() => {
'use strict';
const { el, tool, ui, lib, download, readFile, bytes, copy } = window.UH;
const $ = ui;

/* ============================ TEXT ============================ */

tool({
  id: 'word-counter', cat: 'text', name: 'Word Counter',
  desc: 'Words, characters, sentences, paragraphs, reading time.',
  keywords: 'count words characters length',
  render(w){
    const ta = $.ta('Paste or type text…');
    const out = $.out();
    const run = () => {
      const t = ta.value;
      const words = (t.match(/[\p{L}\p{N}'’\-]+/gu) || []).length;
      const chars = [...t].length;
      const noSpace = [...t.replace(/\s/g, '')].length;
      const sentences = (t.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || []).filter(s => s.trim()).length;
      const paras = t.split(/\n\s*\n/).filter(p => p.trim()).length;
      const mins = Math.max(1, Math.ceil(words / 220));
      out.textContent =
        `words        ${words}\ncharacters   ${chars}\nchars (no sp)${noSpace}\nsentences    ${sentences}\nparagraphs   ${paras}\nreading time ~${mins} min\nspeaking time ~${Math.max(1, Math.ceil(words / 140))} min`;
    };
    ta.oninput = run; run();
    w.append(ta, out);
  }
});

tool({
  id: 'case-converter', cat: 'text', name: 'Case Converter',
  desc: 'UPPER, lower, Title, Sentence, camelCase, snake_case, kebab-case.',
  keywords: 'uppercase lowercase title case camel snake kebab',
  render(w){
    const ta = $.ta('Text to convert…');
    const out = $.ta(); out.readOnly = true; out.style.minHeight = '120px';
    const words = s => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    const modes = {
      'UPPER': s => s.toUpperCase(),
      'lower': s => s.toLowerCase(),
      'Title Case': s => s.replace(/\w\S*/g, x => x[0].toUpperCase() + x.slice(1).toLowerCase()),
      'Sentence case': s => s.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase()),
      'camelCase': s => words(s).map((x, i) => i ? x[0].toUpperCase() + x.slice(1).toLowerCase() : x.toLowerCase()).join(''),
      'PascalCase': s => words(s).map(x => x[0].toUpperCase() + x.slice(1).toLowerCase()).join(''),
      'snake_case': s => words(s).map(x => x.toLowerCase()).join('_'),
      'kebab-case': s => words(s).map(x => x.toLowerCase()).join('-'),
      'aLtErNaTe': s => [...s].map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join('')
    };
    const bar = $.row(...Object.keys(modes).map(k => $.btn(k, () => {
      out.value = modes[k](ta.value);
    })));
    const cp = $.btn('Copy', async () => { await copy(out.value); cp.textContent = 'Copied'; setTimeout(() => cp.textContent = 'Copy', 1200); });
    w.append(ta, bar, out, cp);
  }
});

tool({
  id: 'remove-spaces', cat: 'text', name: 'Remove Extra Spaces',
  desc: 'Collapse double spaces, strip line-leading/trailing whitespace, drop blank lines.',
  keywords: 'whitespace trim clean spaces',
  render(w){
    const ta = $.ta('Dirty text…');
    const out = $.out();
    const opts = [
      ['collapse', 'Collapse runs of spaces', true],
      ['trim', 'Trim each line', true],
      ['blank', 'Remove blank lines', false],
      ['tabs', 'Convert tabs to spaces', false]
    ];
    const boxes = opts.map(([k, label, d]) => {
      const c = el('input', { type: 'checkbox', checked: d, 'data-k': k });
      return { c, k, node: el('label', { class: 'row', style: { gap: '6px', fontSize: '13px' } }, c, label) };
    });
    const run = () => {
      const on = k => boxes.find(b => b.k === k).c.checked;
      let t = ta.value;
      if (on('tabs')) t = t.replace(/\t/g, '    ');
      if (on('collapse')) t = t.replace(/[ \u00a0]{2,}/g, ' ');
      if (on('trim')) t = t.split('\n').map(l => l.trim()).join('\n');
      if (on('blank')) t = t.split('\n').filter(l => l.trim()).join('\n');
      out.textContent = t;
    };
    ta.oninput = run; boxes.forEach(b => b.c.onchange = run); run();
    w.append(ta, $.row(...boxes.map(b => b.node)), out);
  }
});

tool({
  id: 'dupe-lines', cat: 'text', name: 'Duplicate Line Remover',
  desc: 'Deduplicate lines, keep first occurrence or last, case-insensitive option.',
  keywords: 'dedupe unique lines duplicate',
  render(w){
    const ta = $.ta('One item per line…');
    const out = $.out();
    const ci = el('input', { type: 'checkbox' });
    const run = () => {
      const seen = new Set();
      const lines = ta.value.split('\n').filter(l => {
        const k = ci.checked ? l.trim().toLowerCase() : l.trim();
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
      out.textContent = lines.join('\n');
    };
    ta.oninput = run; ci.onchange = run; run();
    w.append(ta, el('label', { class: 'row', style: { gap: '6px', fontSize: '13px' } }, ci, 'Case-insensitive'), out);
  }
});

tool({
  id: 'text-reverse', cat: 'text', name: 'Text Reverser',
  desc: 'Reverse characters, words, or lines.',
  keywords: 'reverse backwards flip text',
  render(w){
    const ta = $.ta('Text…');
    const out = $.out();
    const go = m => {
      const t = ta.value;
      out.textContent = m === 'chars' ? [...t].reverse().join('')
        : m === 'words' ? t.split(/(\s+)/).reverse().join('')
        : t.split('\n').reverse().join('\n');
    };
    w.append(ta, $.row($.btn('Reverse characters', () => go('chars')), $.btn('Reverse words', () => go('words')), $.btn('Reverse lines', () => go('lines'))), out);
  }
});

tool({
  id: 'lorem', cat: 'text', name: 'Lorem Ipsum Generator',
  desc: 'Placeholder paragraphs, sentences, or words.',
  keywords: 'lorem ipsum placeholder dummy text',
  render(w){
    const L = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');
    const n = $.in('5', '5', 'number'); n.min = 1; n.max = 200;
    const unit = $.sel([{ v: 'paragraphs', t: 'Paragraphs' }, { v: 'sentences', t: 'Sentences' }, { v: 'words', t: 'Words' }], 'paragraphs');
    const out = $.out();
    const sentence = () => {
      const len = 8 + Math.floor(Math.random() * 12);
      const ws = Array.from({ length: len }, () => L[Math.floor(Math.random() * L.length)]);
      const s = ws.join(' ');
      return s[0].toUpperCase() + s.slice(1) + '.';
    };
    const gen = () => {
      const k = Math.max(1, Math.min(200, +n.value || 1));
      if (unit.value === 'words') out.textContent = Array.from({ length: k }, () => L[Math.floor(Math.random() * L.length)]).join(' ');
      else if (unit.value === 'sentences') out.textContent = Array.from({ length: k }, sentence).join(' ');
      else out.textContent = Array.from({ length: k }, () => Array.from({ length: 3 + Math.floor(Math.random() * 3) }, sentence).join(' ')).join('\n\n');
    };
    $.btn('Generate', gen, true).click?.();
    w.append($.row($.label('Count', n), $.label('Unit', unit), $.btn('Generate', gen, true)), out);
    setTimeout(gen, 0);
  }
});

tool({
  id: 'notepad', cat: 'text', name: 'Notepad',
  desc: 'Autosaving scratchpad in local storage. Download as .txt anytime.',
  keywords: 'notes scratch pad write',
  render(w){
    const ta = $.ta('Start typing… it autosaves.');
    ta.style.minHeight = '380px';
    ta.value = window.UH.store.get('notepad', '');
    let t;
    ta.oninput = () => { clearTimeout(t); t = setTimeout(() => window.UH.store.set('notepad', ta.value), 300); };
    const meta = $.hint('Saved.');
    w.append(ta, $.row(
      $.btn('Download .txt', () => download(ta.value, 'notepad.txt', 'text/plain')),
      $.btn('Clear', () => { if (confirm('Clear the notepad?')){ ta.value = ''; window.UH.store.set('notepad', ''); meta.textContent = 'Cleared.'; } })
    ), meta);
    ta.addEventListener('input', () => { meta.textContent = `Saved · ${ta.value.length} chars`; });
  }
});

tool({
  id: 'diff', cat: 'text', name: 'Text Diff Checker',
  desc: 'Line-level comparison with added and removed lines highlighted.',
  keywords: 'diff compare difference merge',
  render(w){
    const a = $.ta('Original…'); const b = $.ta('Changed…');
    a.style.minHeight = '140px'; b.style.minHeight = '140px';
    const out = el('div', { class: 'diff' });
    const run = () => {
      const A = a.value.split('\n'), B = b.value.split('\n');
      if (A.length * B.length > 4_000_000) { out.replaceChildren(el('div', { text: 'Too large to diff. Keep each side under ~2000 lines.' })); return; }
      const n = A.length, m = B.length;
      const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
      for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--)
          dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      const rows = []; let i = 0, j = 0, add = 0, del = 0;
      while (i < n && j < m){
        if (A[i] === B[j]) { rows.push(['eq', '  ' + A[i]]); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push(['del', '- ' + A[i]]); i++; del++; }
        else { rows.push(['add', '+ ' + B[j]]); j++; add++; }
      }
      while (i < n) { rows.push(['del', '- ' + A[i++]]); del++; }
      while (j < m) { rows.push(['add', '+ ' + B[j++]]); add++; }
      out.replaceChildren(...rows.map(([c, t]) => el('div', { class: c, text: t })));
      out.prepend(el('div', { class: 'eq', text: `${add} added · ${del} removed` }));
    };
    a.oninput = run; b.oninput = run;
    w.append($.split(a, b), $.btn('Compare', run, true), out);
  }
});

tool({
  id: 'markdown', cat: 'text', name: 'Markdown Previewer',
  desc: 'Live Markdown render — headings, lists, code, tables, links, emphasis.',
  keywords: 'markdown md preview render',
  render(w){
    const src = $.ta('# Hello\n\nSome **bold** and _italic_ and `code`.\n\n- one\n- two\n\n```js\nconsole.log(1);\n```\n');
    src.style.minHeight = '300px';
    const out = el('div', { class: 'out', style: { background: 'var(--surface)', maxHeight: '600px' } });
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const md = s => {
      const blocks = [];
      s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        blocks.push(`<pre style="background:var(--bg2);padding:10px;border-radius:6px;overflow:auto"><code>${esc(code)}</code></pre>`);
        return `\u0000${blocks.length - 1}\u0000`;
      });
      s = esc(s);
      s = s.replace(/^###### (.*)$/gm, '<h6>$1</h6>').replace(/^##### (.*)$/gm, '<h5>$1</h5>')
           .replace(/^#### (.*)$/gm, '<h4>$1</h4>').replace(/^### (.*)$/gm, '<h3>$1</h3>')
           .replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>');
      s = s.replace(/^---+$/gm, '<hr>')
           .replace(/^&gt; (.*)$/gm, '<blockquote style="border-left:3px solid var(--line2);margin:0;padding-left:12px;color:var(--muted)">$1</blockquote>')
           .replace(/^\s*[-*+] (.*)$/gm, '<li>$1</li>')
           .replace(/^\s*\d+\. (.*)$/gm, '<li>$1</li>');
      s = s.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, m => `<ul>${m}</ul>`);
      s = s.replace(/`([^`\n]+)`/g, '<code style="background:var(--bg2);padding:1px 4px;border-radius:4px">$1</code>')
           .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
           .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
           .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="text-decoration:underline">$1</a>');
      s = s.split(/\n{2,}/).map(p => /^\s*<(h\d|ul|ol|pre|hr|blockquote)/.test(p) ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');
      return s.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]);
    };
    const run = () => { out.innerHTML = md(src.value); };
    src.oninput = run; run();
    w.append($.split(src, out));
  }
});

tool({
  id: 'find-replace', cat: 'text', name: 'Find and Replace',
  desc: 'Literal or regex find/replace with case and whole-word options.',
  keywords: 'replace find substitute regex',
  render(w){
    const ta = $.ta('Text…');
    const find = $.in('find');
    const repl = $.in('replace with');
    const regex = el('input', { type: 'checkbox' });
    const ci = el('input', { type: 'checkbox' });
    const whole = el('input', { type: 'checkbox' });
    const out = $.out();
    const run = () => {
      if (!find.value) { out.textContent = ta.value; return; }
      try {
        let pat = regex.checked ? find.value : find.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (whole.checked) pat = `\\b(?:${pat})\\b`;
        const re = new RegExp(pat, 'g' + (ci.checked ? 'i' : ''));
        let n = 0;
        out.textContent = ta.value.replace(re, (...a) => { n++; return repl.value.replace(/\$(\d)/g, (_, d) => a[+d] ?? ''); });
        out.prepend(el('div', { class: 'hint', text: `${n} replacement${n === 1 ? '' : 's'}` }));
      } catch (e) { out.textContent = 'Bad pattern: ' + e.message; }
    };
    [ta, find, repl].forEach(x => x.oninput = run);
    [regex, ci, whole].forEach(x => x.onchange = run); run();
    w.append(ta, $.row(find, repl), $.row(
      el('label', { class: 'row', style: { gap: '5px', fontSize: '13px' } }, regex, 'Regex'),
      el('label', { class: 'row', style: { gap: '5px', fontSize: '13px' } }, ci, 'Ignore case'),
      el('label', { class: 'row', style: { gap: '5px', fontSize: '13px' } }, whole, 'Whole word')
    ), out);
  }
});

tool({
  id: 'grammar', cat: 'text', name: 'Grammar & Style Check',
  desc: 'Local heuristics: double spaces, repeated words, missing capital, long sentences, passive voice markers.',
  keywords: 'grammar spell style proofread',
  render(w){
    const ta = $.ta('Paste writing to check…');
    ta.style.minHeight = '220px';
    const out = $.out();
    const run = () => {
      const t = ta.value; const issues = [];
      if (/ {2,}/.test(t)) issues.push('· double space found');
      const rep = t.match(/\b(\w+)\s+\1\b/gi); if (rep) issues.push(`· repeated word: ${[...new Set(rep)].slice(0, 5).join(', ')}`);
      if (/[a-z][.!?]\s+[a-z]/.test(t)) issues.push('· sentence starts lowercase after punctuation');
      const longs = (t.match(/[^.!?]+[.!?]/g) || []).filter(s => s.trim().split(/\s+/).length > 30);
      if (longs.length) issues.push(`· ${longs.length} sentence(s) over 30 words`);
      const passive = t.match(/\b(was|were|is|are|been|being)\s+\w+(ed|en)\b/gi);
      if (passive) issues.push(`· ${passive.length} passive construction(s): ${[...new Set(passive)].slice(0, 4).join(', ')}`);
      if (/\s+[,.;:!?]/.test(t)) issues.push('· space before punctuation');
      if (/[,.!?;:][A-Za-z]/.test(t)) issues.push('· missing space after punctuation');
      out.textContent = issues.length ? issues.join('\n') : 'No issues from the local rule set.';
    };
    ta.oninput = run; run();
    w.append(ta, out, $.hint('Rule-based, runs locally. No model, no network — catches mechanical faults, not meaning.'));
  }
});

tool({
  id: 'tts', cat: 'text', name: 'Text to Speech',
  desc: 'Speak text with any installed system voice; adjustable rate and pitch.',
  keywords: 'speech speak voice read aloud tts',
  render(w){
    if (!('speechSynthesis' in window)) { w.append(el('div', { class: 'err', text: 'Speech synthesis not available in this browser.' })); return; }
    const ta = $.ta('Text to speak…'); ta.style.minHeight = '150px';
    const voice = $.sel([], '');
    const rate = $.in('1', '1', 'number'); rate.step = '0.1'; rate.min = '0.5'; rate.max = '2';
    const pitch = $.in('1', '1', 'number'); pitch.step = '0.1'; pitch.min = '0'; pitch.max = '2';
    const fill = () => {
      const vs = speechSynthesis.getVoices();
      voice.replaceChildren(...vs.map(v => el('option', { value: v.name, selected: v.default }, `${v.name} (${v.lang})`)));
    };
    fill(); speechSynthesis.onvoiceschanged = fill;
    const speak = () => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(ta.value);
      const v = speechSynthesis.getVoices().find(x => x.name === voice.value);
      if (v) u.voice = v;
      u.rate = +rate.value || 1; u.pitch = +pitch.value || 1;
      speechSynthesis.speak(u);
    };
    w.append(ta, $.row($.label('Voice', voice), $.label('Rate', rate), $.label('Pitch', pitch)),
      $.row($.btn('Speak', speak, true), $.btn('Stop', () => speechSynthesis.cancel())));
  }
});

tool({
  id: 'stt', cat: 'text', name: 'Speech to Text',
  desc: 'Dictate with the browser speech recognition engine; text lands in the box.',
  keywords: 'dictate voice recognition transcribe stt',
  render(w){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { w.append(el('div', { class: 'err', text: 'Speech recognition is not available in this browser (Chrome/Edge support it).' })); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = navigator.language || 'en-US';
    const ta = $.ta('Dictated text appears here…'); ta.style.minHeight = '220px';
    let base = '', listening = false;
    rec.onresult = e => {
      let finalTxt = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++){
        const r = e.results[i];
        r.isFinal ? finalTxt += r[0].transcript : interim += r[0].transcript;
      }
      if (finalTxt) base += finalTxt;
      ta.value = base + interim;
    };
    rec.onend = () => { listening = false; btn.textContent = 'Start listening'; };
    rec.onerror = e => { ta.value += `\n[error: ${e.error}]`; };
    const btn = $.btn('Start listening', () => {
      if (listening) { rec.stop(); return; }
      base = ta.value ? ta.value + ' ' : '';
      rec.start(); listening = true; btn.textContent = 'Stop';
    }, true);
    w.append(ta, $.row(btn, $.btn('Copy', () => copy(ta.value))));
  }
});

tool({
  id: 'qr-text', cat: 'text', name: 'QR Text Generator',
  desc: 'Turn any text or URL into a downloadable QR code.',
  keywords: 'qr code generate text url',
  render(w){
    const ta = $.in('Text or URL…', 'https://');
    const canvas = el('canvas');
    const go = async () => {
      if (!ta.value) return;
      try {
        const QRCode = await lib('qrcode');
        await QRCode.toCanvas(canvas, ta.value, { width: 300, margin: 2, errorCorrectionLevel: 'M' });
      } catch (e) { w.append(el('div', { class: 'err', text: e.message })); }
    };
    w.append($.row(ta, $.btn('Generate', go, true)), canvas,
      $.row($.btn('Download PNG', () => canvas.toBlob(b => download(b, 'qr.png')))));
    ta.onkeydown = e => { if (e.key === 'Enter') go(); };
  }
});

/* ============================ FILE / DATA ============================ */

tool({
  id: 'zip-create', cat: 'file', name: 'ZIP Creator',
  desc: 'Bundle any files into a single .zip archive in the browser.',
  keywords: 'zip archive compress bundle',
  render(w){
    let files = [];
    const dz = $.dz('Drop files here or click to choose', fs => {
      files = fs; dz.setNames(fs.map(f => `${f.name} — ${bytes(f.size)}`));
    });
    const name = $.in('archive.zip', 'archive.zip');
    const go = async () => {
      if (!files.length) return alert('Add files first.');
      const JSZip = await lib('jszip');
      const zip = new JSZip();
      for (const f of files) zip.file(f.name, await f.arrayBuffer());
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      download(blob, name.value || 'archive.zip');
    };
    w.append(dz.zone, dz.list, $.label('Archive name', name), $.btn('Build ZIP', go, true));
  }
});

tool({
  id: 'zip-extract', cat: 'file', name: 'ZIP Extractor',
  desc: 'List and extract entries from a .zip without uploading it.',
  keywords: 'unzip extract zip archive',
  render(w){
    const out = el('div', { class: 'list' });
    const dz = $.dz('Drop a .zip file', async fs => {
      try {
        const JSZip = await lib('jszip');
        const zip = await JSZip.loadAsync(await fs[0].arrayBuffer());
        out.replaceChildren(...Object.values(zip.files).map(e => {
          const row = el('div', { class: 'item' },
            el('span', { text: e.name + (e.dir ? '/' : '') }),
            el('span', { class: 'hint', text: e.dir ? '' : bytes(e._data?.uncompressedSize || 0) }));
          if (!e.dir) row.append(el('button', {
            class: 'x', type: 'button', text: 'save',
            onclick: async () => download(await e.async('blob'), e.name.split('/').pop())
          }));
          return row;
        }));
      } catch (e) { out.replaceChildren(el('div', { class: 'err', text: e.message })); }
    });
    w.append(dz.zone, out);
  }
});

tool({
  id: 'file-size', cat: 'file', name: 'File Size Checker',
  desc: 'Read exact byte sizes of any files, human-readable.',
  keywords: 'size bytes file weight',
  render(w){
    const out = el('div', { class: 'list' });
    const dz = $.dz('Drop files to measure', fs => {
      out.replaceChildren(...fs.map(f => el('div', { class: 'item' },
        el('span', { text: f.name }),
        el('span', { class: 'hint', style: { marginLeft: 'auto' }, text: `${f.size.toLocaleString()} B · ${bytes(f.size)}` }))));
    });
    w.append(dz.zone, out);
  }
});

tool({
  id: 'file-rename', cat: 'file', name: 'Bulk File Renamer',
  desc: 'Prefix, suffix, sequence numbers, find/replace — then download renamed copies.',
  keywords: 'rename bulk files batch',
  render(w){
    let files = [];
    const dz = $.dz('Drop files', fs => { files = fs; dz.setNames(fs.map(f => f.name)); });
    const pre = $.in('prefix', '');
    const suf = $.in('suffix', '');
    const find = $.in('find', '');
    const repl = $.in('replace', '');
    const seq = el('input', { type: 'checkbox' });
    const go = () => {
      files.forEach((f, i) => {
        const dot = f.name.lastIndexOf('.');
        const stem = dot > 0 ? f.name.slice(0, dot) : f.name;
        const ext = dot > 0 ? f.name.slice(dot) : '';
        let n = find.value ? stem.split(find.value).join(repl.value) : stem;
        download(f, pre.value + n + (seq.checked ? String(i + 1).padStart(3, '0') : '') + suf.value + ext, f.type);
      });
    };
    w.append(dz.zone, dz.list, $.row($.label('Prefix', pre), $.label('Suffix', suf)),
      $.row($.label('Find', find), $.label('Replace', repl)),
      el('label', { class: 'row', style: { gap: '6px', fontSize: '13px' } }, seq, 'Append 001, 002…'),
      $.btn('Download renamed copies', go, true));
  }
});

tool({
  id: 'base64', cat: 'file', name: 'Base64 Encoder / Decoder',
  desc: 'Text or binary files to Base64 and back, with data-URL support.',
  keywords: 'base64 encode decode dataurl',
  render(w){
    const ta = $.ta('Text…');
    const out = $.out();
    const enc = () => { try { out.textContent = btoa(String.fromCharCode(...new TextEncoder().encode(ta.value))); } catch (e) { out.textContent = e.message; } };
    const dec = () => { try { out.textContent = new TextDecoder().decode(Uint8Array.from(atob(ta.value.trim()), c => c.charCodeAt(0))); } catch { out.textContent = 'Not valid Base64.'; } };
    const fileBtn = el('input', { type: 'file', hidden: true });
    fileBtn.onchange = async () => {
      const f = fileBtn.files[0]; if (!f) return;
      const url = await readFile(f).dataURL();
      out.textContent = url;
    };
    ta.oninput = enc;
    w.append(ta, $.row($.btn('Encode', enc, true), $.btn('Decode', dec), $.btn('File → data URL', () => fileBtn.click()), fileBtn), out);
  }
});

tool({
  id: 'json-format', cat: 'file', name: 'JSON Formatter',
  desc: 'Pretty-print, minify, and validate JSON with precise error positions.',
  keywords: 'json beautify pretty minify validate',
  render(w){
    const ta = $.ta('{"a":1}'); ta.style.minHeight = '220px';
    const out = $.out();
    const indent = $.in('2', '2', 'number');
    const run = mode => {
      try {
        const o = JSON.parse(ta.value);
        out.textContent = mode === 'min' ? JSON.stringify(o) : JSON.stringify(o, null, Math.max(0, Math.min(8, +indent.value || 2)));
      } catch (e) { out.textContent = 'Invalid JSON: ' + e.message; }
    };
    w.append(ta, $.row($.label('Indent', indent), $.btn('Format', () => run('pretty'), true), $.btn('Minify', () => run('min')), $.btn('Copy', () => copy(out.textContent))), out);
  }
});

tool({
  id: 'xml-format', cat: 'file', name: 'XML Formatter',
  desc: 'Indent XML for reading, or collapse it to a single line.',
  keywords: 'xml pretty print format',
  render(w){
    const ta = $.ta('<root><a>1</a></root>'); ta.style.minHeight = '200px';
    const out = $.out();
    const fmt = (xml, indent = '  ') => {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const err = doc.querySelector('parsererror');
      if (err) throw new Error(err.textContent.split('\n')[0]);
      const ser = (node, d) => {
        const pad = indent.repeat(d);
        const attrs = [...node.attributes].map(a => ` ${a.name}="${a.value}"`).join('');
        if (node.nodeType === 3){ const t = node.nodeValue.trim(); return t ? `${pad}${t}\n` : ''; }
        if (node.nodeType !== 1) return '';
        const kids = [...node.childNodes].filter(n => n.nodeType !== 3 || n.nodeValue.trim());
        if (!kids.length) return `${pad}<${node.nodeName}${attrs}/>\n`;
        if (kids.length === 1 && kids[0].nodeType === 3) return `${pad}<${node.nodeName}${attrs}>${kids[0].nodeValue.trim()}</${node.nodeName}>\n`;
        return `${pad}<${node.nodeName}${attrs}>\n${kids.map(k => ser(k, d + 1)).join('')}${pad}</${node.nodeName}>\n`;
      };
      return ser(doc.documentElement, 0);
    };
    w.append(ta, $.row($.btn('Format', () => { try { out.textContent = fmt(ta.value); } catch (e) { out.textContent = e.message; } }, true),
      $.btn('Minify', () => { out.textContent = ta.value.replace(/>\s+</g, '><').trim(); })), out);
  }
});

tool({
  id: 'csv-json', cat: 'file', name: 'CSV ⇄ JSON',
  desc: 'Convert between CSV and JSON arrays of objects, RFC 4180 quoting handled.',
  keywords: 'csv json convert table',
  render(w){
    const ta = $.ta('name,age\nada,36\ngrace,85'); ta.style.minHeight = '200px';
    const out = $.out();
    const parseCSV = text => {
      const rows = []; let row = [], cell = '', q = false;
      for (let i = 0; i < text.length; i++){
        const c = text[i];
        if (q){
          if (c === '"' && text[i + 1] === '"'){ cell += '"'; i++; }
          else if (c === '"') q = false;
          else cell += c;
        } else if (c === '"') q = true;
        else if (c === ','){ row.push(cell); cell = ''; }
        else if (c === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (c !== '\r') cell += c;
      }
      if (cell || row.length){ row.push(cell); rows.push(row); }
      return rows.filter(r => r.some(c => c !== ''));
    };
    const toJSON = () => {
      const rows = parseCSV(ta.value);
      if (!rows.length) return;
      const head = rows[0];
      out.textContent = JSON.stringify(rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? '']))), null, 2);
    };
    const toCSV = () => {
      try {
        const arr = JSON.parse(ta.value);
        if (!Array.isArray(arr)) throw new Error('Expecting a JSON array');
        const cols = [...new Set(arr.flatMap(o => Object.keys(o)))];
        const esc = v => /[",\n]/.test(String(v ?? '')) ? `"${String(v ?? '').replace(/"/g, '""')}"` : String(v ?? '');
        out.textContent = [cols.join(','), ...arr.map(o => cols.map(c => esc(o[c])).join(','))].join('\n');
      } catch (e) { out.textContent = e.message; }
    };
    w.append(ta, $.row($.btn('CSV → JSON', toJSON, true), $.btn('JSON → CSV', toCSV)), out);
  }
});

tool({
  id: 'html-format', cat: 'file', name: 'HTML Formatter',
  desc: 'Re-indent HTML with correct nesting, or strip it down.',
  keywords: 'html pretty format indent',
  render(w){
    const ta = $.ta('<div><p>hi</p><ul><li>a</li></ul></div>'); ta.style.minHeight = '200px';
    const out = $.out();
    const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
    const fmt = () => {
      const doc = new DOMParser().parseFromString(ta.value, 'text/html');
      let d = 0;
      const walk = node => {
        [...node.childNodes].forEach(n => {
          if (n.nodeType === 3){ const t = n.nodeValue.trim(); if (t) out.textContent += '  '.repeat(d) + t + '\n'; return; }
          if (n.nodeType !== 1) return;
          const attrs = [...n.attributes].map(a => ` ${a.name}="${a.value}"`).join('');
          if (VOID.has(n.nodeName.toLowerCase())){ out.textContent += '  '.repeat(d) + `<${n.nodeName.toLowerCase()}${attrs}>\n`; return; }
          out.textContent += '  '.repeat(d) + `<${n.nodeName.toLowerCase()}${attrs}>\n`;
          d++; walk(n); d--;
          out.textContent += '  '.repeat(d) + `</${n.nodeName.toLowerCase()}>\n`;
        });
      };
      out.textContent = ''; walk(doc.body);
    };
    w.append(ta, $.row($.btn('Format', fmt, true), $.btn('Strip tags', () => {
      const doc = new DOMParser().parseFromString(ta.value, 'text/html');
      out.textContent = doc.body.textContent.replace(/\n{3,}/g, '\n\n').trim();
    })), out);
  }
});

tool({
  id: 'minify', cat: 'file', name: 'CSS / JS Minifier',
  desc: 'Strip comments and redundant whitespace while preserving string literals.',
  keywords: 'minify css javascript compress',
  render(w){
    const ta = $.ta('/* comment */\n.btn { color: red; }'); ta.style.minHeight = '220px';
    const out = $.out();
    const kind = $.sel([{ v: 'css', t: 'CSS' }, { v: 'js', t: 'JavaScript' }], 'css');
    const minifyCSS = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
      .replace(/\s*([{}:;,>~+])\s*/g, '$1').replace(/;}/g, '}').trim();
    const minifyJS = s => {
      let o = '', i = 0;
      while (i < s.length){
        const c = s[i], n = s[i + 1];
        if (c === '"' || c === "'" || c === '`'){
          o += c; i++;
          while (i < s.length){ o += s[i]; if (s[i] === '\\'){ o += s[i + 1]; i += 2; continue; } if (s[i] === c) break; i++; }
          i++; continue;
        }
        if (c === '/' && n === '/'){ while (i < s.length && s[i] !== '\n') i++; continue; }
        if (c === '/' && n === '*'){ i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
        if (/\s/.test(c)){ o += ' '; while (i < s.length && /\s/.test(s[i])) i++; continue; }
        o += c; i++;
      }
      return o.replace(/\s*([{};,:()=\[\]<>\+\-*/%!&|?])\s*/g, '$1').replace(/;\}/g, '}').replace(/;$/,'').trim();
    };
    w.append(ta, $.row($.label('Language', kind), $.btn('Minify', () => {
      out.textContent = kind.value === 'css' ? minifyCSS(ta.value) : minifyJS(ta.value);
    }, true)), out, $.hint('Regex literals are not distinguished from division in JS mode — verify output before shipping.'));
  }
});

tool({
  id: 'file-type', cat: 'file', name: 'File Type Detector',
  desc: 'Identify files by magic bytes, not extension.',
  keywords: 'magic bytes mime identify sniff',
  render(w){
    const SIGS = [
      [[0x25,0x50,0x44,0x46], 'PDF document', 'application/pdf'],
      [[0x89,0x50,0x4E,0x47], 'PNG image', 'image/png'],
      [[0xFF,0xD8,0xFF], 'JPEG image', 'image/jpeg'],
      [[0x47,0x49,0x46,0x38], 'GIF image', 'image/gif'],
      [[0x52,0x49,0x46,0x46], 'RIFF container (WAV/AVI/WEBP)', 'application/octet-stream'],
      [[0x50,0x4B,0x03,0x04], 'ZIP archive (or DOCX/XLSX/JAR/APK)', 'application/zip'],
      [[0x52,0x61,0x72,0x21], 'RAR archive', 'application/vnd.rar'],
      [[0x37,0x7A,0xBC,0xAF], '7-Zip archive', 'application/x-7z-compressed'],
      [[0x1F,0x8B], 'GZIP compressed', 'application/gzip'],
      [[0x7F,0x45,0x4C,0x46], 'ELF executable', 'application/x-elf'],
      [[0x4D,0x5A], 'Windows PE (EXE/DLL)', 'application/vnd.microsoft.portable-executable'],
      [[0x4F,0x67,0x67,0x53], 'OGG media', 'application/ogg'],
      [[0x66,0x4C,0x61,0x43], 'FLAC audio', 'audio/flac'],
      [[0x49,0x44,0x33], 'MP3 audio (ID3)', 'audio/mpeg'],
      [[0x49,0x49,0x2A,0x00], 'TIFF image', 'image/tiff'],
      [[0x42,0x4D], 'BMP image', 'image/bmp'],
      [[0x00,0x01,0x00,0x00,0x00], 'TrueType font', 'font/ttf'],
      [[0x4F,0x54,0x54,0x4F], 'OpenType font', 'font/otf']
    ];
    const out = el('div', { class: 'list' });
    const dz = $.dz('Drop a file to sniff', async fs => {
      const f = fs[0];
      const head = new Uint8Array(await f.slice(0, 64).arrayBuffer());
      const hit = SIGS.find(([sig]) => sig.every((b, i) => head[i] === b));
      const isMP4 = new TextDecoder().decode(head.slice(4, 8)) === 'ftyp';
      const name = hit ? hit[1] : isMP4 ? 'MP4 / ISO media' : 'Unknown';
      const mime = hit ? hit[2] : isMP4 ? 'video/mp4' : (f.type || 'unknown');
      out.replaceChildren(
        el('div', { class: 'item' }, el('span', { text: f.name })),
        el('div', { class: 'item' }, el('span', { text: 'Detected' }), el('span', { class: 'hint', style: { marginLeft: 'auto' }, text: name })),
        el('div', { class: 'item' }, el('span', { text: 'MIME' }), el('span', { class: 'hint', style: { marginLeft: 'auto' }, text: mime })),
        el('div', { class: 'item' }, el('span', { text: 'First bytes' }),
          el('span', { class: 'hint', style: { marginLeft: 'auto', fontFamily: 'var(--mono)' }, text: [...head.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join(' ') })));
    });
    w.append(dz.zone, out);
  }
});

tool({
  id: 'hash', cat: 'file', name: 'File & Text Hash',
  desc: 'SHA-1, SHA-256, SHA-384, SHA-512 via WebCrypto — text or files.',
  keywords: 'hash sha256 checksum digest',
  render(w){
    const algo = $.sel(['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'], 'SHA-256');
    const out = $.out();
    const doBuf = async buf => {
      const d = await crypto.subtle.digest(algo.value, buf);
      out.textContent = [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
    };
    const ta = $.ta('Text to hash…'); ta.style.minHeight = '110px';
    const dz = $.dz('…or drop a file', async fs => doBuf(await fs[0].arrayBuffer()));
    w.append($.row($.label('Algorithm', algo), $.btn('Hash text', () => doBuf(new TextEncoder().encode(ta.value)), true)),
      ta, dz.zone, out);
  }
});

/* ============================ DEVELOPER ============================ */

tool({
  id: 'regex-tester', cat: 'dev', name: 'Regex Tester',
  desc: 'Live match highlighting with capture groups and match count.',
  keywords: 'regex regular expression test match groups',
  render(w){
    const pattern = $.in('pattern, e.g. \\b\\w+@\\w+\\.\\w+', '\\b\\w+@\\w+\\.\\w+');
    const flags = $.in('flags', 'gi');
    const ta = $.ta('Test string…'); ta.style.minHeight = '180px';
    const out = el('div', { class: 'out', style: { background: 'var(--surface)' } });
    const meta = $.hint('');
    const run = () => {
      out.textContent = ''; meta.textContent = '';
      let re;
      try { re = new RegExp(pattern.value, flags.value.includes('g') ? flags.value : flags.value + 'g'); }
      catch (e) { meta.textContent = 'Invalid regex: ' + e.message; out.textContent = ta.value; return; }
      const text = ta.value;
      let last = 0, count = 0; const frag = document.createDocumentFragment(); const groups = [];
      for (const m of text.matchAll(re)){
        if (m[0] === '' ) { if (m.index === last) continue; }
        frag.append(document.createTextNode(text.slice(last, m.index)));
        frag.append(el('mark', { style: { background: 'color-mix(in srgb,var(--accent) 30%,transparent)', borderRadius: '3px' }, text: m[0] }));
        if (m.length > 1) groups.push({ i: count + 1, at: m.index, g: m.slice(1) });
        last = m.index + m[0].length; count++;
        if (count > 5000) break;
      }
      frag.append(document.createTextNode(text.slice(last)));
      out.append(frag);
      meta.textContent = `${count} match${count === 1 ? '' : 'es'}`;
      if (groups.length) out.append(el('pre', { class: 'out', style: { marginTop: '10px' }, text: groups.map(g => `#${g.i} @${g.at}: ${JSON.stringify(g.g)}`).join('\n') }));
    };
    [pattern, flags, ta].forEach(x => x.oninput = run); run();
    w.append($.row(pattern, $.label('Flags', flags)), ta, meta, out);
  }
});

tool({
  id: 'jwt', cat: 'dev', name: 'JWT Decoder',
  desc: 'Decode header and payload; expiry flagged. No signature verification.',
  keywords: 'jwt token decode json web token',
  render(w){
    const ta = $.ta('Paste a JWT…'); ta.style.minHeight = '130px';
    const out = $.out();
    const b64u = s => {
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      return decodeURIComponent([...atob(s)].map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    };
    const run = () => {
      const parts = ta.value.trim().split('.');
      if (parts.length < 2) { out.textContent = 'Not a JWT (expecting header.payload.signature).'; return; }
      try {
        const head = JSON.parse(b64u(parts[0])), body = JSON.parse(b64u(parts[1]));
        const exp = body.exp ? new Date(body.exp * 1000) : null;
        out.textContent = `HEADER\n${JSON.stringify(head, null, 2)}\n\nPAYLOAD\n${JSON.stringify(body, null, 2)}\n\n` +
          (exp ? `expires ${exp.toISOString()} — ${exp < new Date() ? 'EXPIRED' : 'valid'}\n` : '') +
          (body.iat ? `issued  ${new Date(body.iat * 1000).toISOString()}\n` : '') +
          `signature ${parts[2] ? 'present (not verified)' : 'absent'}`;
      } catch (e) { out.textContent = 'Decode failed: ' + e.message; }
    };
    ta.oninput = run;
    w.append(ta, out);
  }
});

tool({
  id: 'uuid', cat: 'dev', name: 'UUID Generator',
  desc: 'Cryptographically random v4 UUIDs, one or many.',
  keywords: 'uuid guid v4 random id',
  render(w){
    const n = $.in('count', '5', 'number'); n.min = 1; n.max = 500;
    const braces = el('input', { type: 'checkbox' });
    const upper = el('input', { type: 'checkbox' });
    const out = $.out();
    const gen = () => {
      const k = Math.max(1, Math.min(500, +n.value || 1));
      const list = Array.from({ length: k }, () => {
        let u = crypto.randomUUID ? crypto.randomUUID() : (() => {
          const b = crypto.getRandomValues(new Uint8Array(16));
          b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
          const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
          return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
        })();
        if (upper.checked) u = u.toUpperCase();
        if (braces.checked) u = '{' + u + '}';
        return u;
      });
      out.textContent = list.join('\n');
    };
    w.append($.row($.label('Count', n),
      el('label', { class: 'row', style: { gap: '6px', fontSize: '13px' } }, braces, 'Braces'),
      el('label', { class: 'row', style: { gap: '6px', fontSize: '13px' } }, upper, 'Uppercase'),
      $.btn('Generate', gen, true), $.btn('Copy all', () => copy(out.textContent))), out);
    setTimeout(gen, 0);
  }
});

tool({
  id: 'timestamp', cat: 'dev', name: 'Unix Timestamp Converter',
  desc: 'Epoch seconds/milliseconds ⇄ ISO/UTC/local, plus live clock.',
  keywords: 'unix epoch timestamp date convert',
  render(w){
    const live = $.out();
    const tick = () => { live.textContent = `now  ${Math.floor(Date.now() / 1000)}  (${Date.now()} ms)\n${new Date().toISOString()}`; };
    tick(); const id = setInterval(tick, 1000);
    w.addEventListener('uh:unmount', () => clearInterval(id));
    const ta = $.in('Timestamp or date string', String(Math.floor(Date.now() / 1000)));
    const out = $.out();
    const conv = () => {
      const v = ta.value.trim();
      let d;
      if (/^\d{13}$/.test(v)) d = new Date(+v);
      else if (/^\d{10}$/.test(v)) d = new Date(+v * 1000);
      else d = new Date(v);
      if (isNaN(d)) { out.textContent = 'Unparseable.'; return; }
      out.textContent = `ISO        ${d.toISOString()}\nUTC        ${d.toUTCString()}\nLocal      ${d.toString()}\nepoch s    ${Math.floor(d.getTime() / 1000)}\nepoch ms   ${d.getTime()}\nday of week ${d.toLocaleDateString(undefined, { weekday: 'long' })}`;
    };
    w.append(live, $.row(ta, $.btn('Convert', conv, true)), out);
  }
});

tool({
  id: 'color-picker-dev', cat: 'dev', name: 'Color Picker & Converter',
  desc: 'HEX ⇄ RGB ⇄ HSL with live swatch and contrast check against white/black.',
  keywords: 'color hex rgb hsl convert contrast',
  render(w){
    const pick = el('input', { type: 'color', value: '#6d5bc7', style: { width: '56px', height: '40px', border: '1px solid var(--line2)', borderRadius: '8px', background: 'none', cursor: 'pointer' } });
    const hex = $.in('#hex', '#6d5bc7');
    const out = $.out();
    const lum = ([r, g, b]) => {
      const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return ((x + 0.05) / (y + 0.05)).toFixed(2); };
    const run = () => {
      let v = hex.value.trim().replace('#', '');
      if (v.length === 3) v = [...v].map(c => c + c).join('');
      if (!/^[0-9a-f]{6}$/i.test(v)) { out.textContent = 'Invalid HEX.'; return; }
      pick.value = '#' + v; hex.value = '#' + v;
      const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
      const [rr, gg, bb] = [r / 255, g / 255, b / 255];
      const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
      let h = 0, s = 0, l = (max + min) / 2;
      if (max !== min){
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = max === rr ? ((gg - bb) / d + (gg < bb ? 6 : 0)) : max === gg ? ((bb - rr) / d + 2) : ((rr - gg) / d + 4);
        h *= 60;
      }
      out.textContent =
        `HEX   #${v.toUpperCase()}\nRGB   rgb(${r}, ${g}, ${b})\nHSL   hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)\n` +
        `contrast vs #fff  ${ratio([r, g, b], [255, 255, 255])}:1\ncontrast vs #000  ${ratio([r, g, b], [0, 0, 0])}:1`;
    };
    pick.oninput = () => { hex.value = pick.value; run(); };
    hex.oninput = run; run();
    const swatch = el('div', { style: { height: '44px', borderRadius: '8px', border: '1px solid var(--line)', background: hex.value } });
    hex.addEventListener('input', () => swatch.style.background = hex.value);
    w.append($.row(pick, $.label('HEX', hex)), swatch, out);
  }
});

tool({
  id: 'gradient', cat: 'dev', name: 'CSS Gradient Generator',
  desc: 'Two-to-five stop linear/radial gradients with copyable CSS.',
  keywords: 'gradient css linear radial generator',
  render(w){
    const stops = ['#6d5bc7', '#8ab4ff'];
    const type = $.sel([{ v: 'linear', t: 'Linear' }, { v: 'radial', t: 'Radial' }], 'linear');
    const angle = $.in('angle', '135', 'number');
    const box = el('div', { style: { height: '180px', borderRadius: '10px', border: '1px solid var(--line)' } });
    const out = $.out();
    const colors = el('div', { class: 'row' });
    const renderColors = () => {
      colors.replaceChildren(...stops.map((c, i) => {
        const inp = el('input', { type: 'color', value: c, style: { width: '42px', height: '34px', border: '1px solid var(--line2)', borderRadius: '6px', background: 'none', cursor: 'pointer' } });
        inp.oninput = () => { stops[i] = inp.value; paint(); };
        return inp;
      }));
    };
    const css = () => type.value === 'radial'
      ? `radial-gradient(circle, ${stops.join(', ')})`
      : `linear-gradient(${angle.value}deg, ${stops.join(', ')})`;
    const paint = () => { box.style.background = css(); out.textContent = `background: ${css()};`; };
    w.append($.row($.label('Type', type), $.label('Angle', angle),
      $.btn('+ stop', () => { stops.push(stops.at(-1)); renderColors(); paint(); }),
      $.btn('− stop', () => { if (stops.length > 2) { stops.pop(); renderColors(); paint(); } }),
      $.btn('Copy CSS', () => copy(out.textContent), true)),
      colors, box, out);
    renderColors(); paint();
  }
});

tool({
  id: 'box-shadow', cat: 'dev', name: 'Box Shadow Generator',
  desc: 'Layer multiple shadows with a live preview and copy-ready CSS.',
  keywords: 'box-shadow css shadow generator',
  render(w){
    const S = { x: 0, y: 8, blur: 24, spread: 0, color: '#00000040', inset: false };
    const box = el('div', { style: { height: '150px', borderRadius: '10px', background: 'var(--surface)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center' } });
    const out = $.out();
    const ctrls = Object.entries({ x: [-50, 50], y: [-50, 50], blur: [0, 100], spread: [-30, 30] }).map(([k, [min, max]]) => {
      const r = el('input', { type: 'range', min, max, value: S[k], style: { width: '100%' } });
      const lab = el('span', { class: 'fl', text: k });
      r.oninput = () => { S[k] = +r.value; paint(); };
      return el('label', { class: 'field' }, el('span', { class: 'row', style: { justifyContent: 'space-between' } }, lab, el('span', { class: 'fl', text: S[k] })), r);
    });
    const color = el('input', { type: 'color', value: '#000000', style: { width: '48px', height: '34px', border: '1px solid var(--line2)', borderRadius: '6px', background: 'none' } });
    const alpha = el('input', { type: 'range', min: 0, max: 100, value: 25, style: { width: '100%' } });
    color.oninput = alpha.oninput = paint;
    const css = () => {
      const a = Math.round(+alpha.value * 2.55).toString(16).padStart(2, '0');
      return `box-shadow: ${S.inset ? 'inset ' : ''}${S.x}px ${S.y}px ${S.blur}px ${S.spread}px ${color.value}${a};`;
    };
    const paint = () => {
      box.style.boxShadow = css().replace('box-shadow: ', '').replace(/;$/, '');
      out.textContent = css();
      ctrls.forEach((c, i) => { const v = Object.keys(S)[i]; c.querySelector('.fl:last-child').textContent = S[v]; });
    };
    w.append(el('div', { class: 'split' }, el('div', { class: 'col' }, ...ctrls, $.row($.label('Color', color), $.label('Alpha', alpha))), box), out, $.btn('Copy CSS', () => copy(out.textContent), true));
    paint();
  }
});

tool({
  id: 'radius', cat: 'dev', name: 'Border Radius Generator',
  desc: 'Per-corner radii with live preview.',
  keywords: 'border radius css rounded corners',
  render(w){
    const vals = { tl: 12, tr: 12, br: 12, bl: 12 };
    const box = el('div', { style: { height: '160px', background: 'var(--accent)', borderRadius: '12px', margin: '10px 0' } });
    const out = $.out();
    const inputs = Object.keys(vals).map(k => {
      const r = el('input', { type: 'range', min: 0, max: 100, value: vals[k], style: { width: '100%' } });
      r.oninput = () => { vals[k] = +r.value; paint(); };
      return $.label(k, r);
    });
    const paint = () => {
      const css = `${vals.tl}px ${vals.tr}px ${vals.br}px ${vals.bl}px`;
      box.style.borderRadius = css;
      out.textContent = `border-radius: ${css};`;
    };
    w.append(el('div', { class: 'split' }, el('div', { class: 'col' }, ...inputs), box), out, $.btn('Copy CSS', () => copy(out.textContent), true));
    paint();
  }
});

tool({
  id: 'flexbox', cat: 'dev', name: 'CSS Flexbox Playground',
  desc: 'Adjust flex container/child properties and copy the CSS.',
  keywords: 'flexbox flex css layout playground',
  render(w){
    const opts = {
      direction: ['row', 'row-reverse', 'column', 'column-reverse'],
      justify: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
      align: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
      wrap: ['nowrap', 'wrap', 'wrap-reverse']
    };
    const state = { direction: 'row', justify: 'flex-start', align: 'stretch', wrap: 'nowrap', gap: 10 };
    const box = el('div', { style: { display: 'flex', minHeight: '170px', border: '1px solid var(--line)', borderRadius: '10px', padding: '10px', background: 'var(--bg2)' } },
      ...Array.from({ length: 4 }, (_, i) => el('div', { style: { width: '60px', height: `${50 + i * 14}px`, background: 'var(--accent)', color: 'var(--accent-fg)', borderRadius: '6px', display: 'grid', placeItems: 'center', fontSize: '12px' } }, String(i + 1))));
    const out = $.out();
    const paint = () => {
      Object.assign(box.style, { flexDirection: state.direction, justifyContent: state.justify, alignItems: state.align, flexWrap: state.wrap, gap: state.gap + 'px' });
      out.textContent = `display: flex;\nflex-direction: ${state.direction};\njustify-content: ${state.justify};\nalign-items: ${state.align};\nflex-wrap: ${state.wrap};\ngap: ${state.gap}px;`;
    };
    const selects = Object.entries(opts).map(([k, list]) => {
      const s = $.sel(list, state[k]);
      s.onchange = () => { state[k] = s.value; paint(); };
      return $.label(k, s);
    });
    const gap = el('input', { type: 'range', min: 0, max: 40, value: 10, style: { width: '100%' } });
    gap.oninput = () => { state.gap = +gap.value; paint(); };
    w.append(el('div', { class: 'split' }, el('div', { class: 'col' }, ...selects, $.label('gap', gap)), box), out, $.btn('Copy CSS', () => copy(out.textContent), true));
    paint();
  }
});

tool({
  id: 'grid-gen', cat: 'dev', name: 'CSS Grid Generator',
  desc: 'Columns, rows and gap with generated CSS and preview.',
  keywords: 'css grid layout generator',
  render(w){
    const cols = el('input', { type: 'range', min: 1, max: 8, value: 3, style: { width: '100%' } });
    const rows = el('input', { type: 'range', min: 1, max: 6, value: 2, style: { width: '100%' } });
    const gap = el('input', { type: 'range', min: 0, max: 40, value: 10, style: { width: '100%' } });
    const box = el('div', { style: { border: '1px solid var(--line)', borderRadius: '10px', padding: '10px', background: 'var(--bg2)', minHeight: '170px' } });
    const out = $.out();
    const paint = () => {
      const c = +cols.value, r = +rows.value, g = +gap.value;
      Object.assign(box.style, { display: 'grid', gridTemplateColumns: `repeat(${c}, 1fr)`, gridTemplateRows: `repeat(${r}, 1fr)`, gap: g + 'px' });
      box.replaceChildren(...Array.from({ length: c * r }, (_, i) =>
        el('div', { style: { background: 'var(--accent)', color: 'var(--accent-fg)', borderRadius: '6px', display: 'grid', placeItems: 'center', fontSize: '12px', minHeight: '40px' } }, String(i + 1))));
      out.textContent = `display: grid;\ngrid-template-columns: repeat(${c}, 1fr);\ngrid-template-rows: repeat(${r}, 1fr);\ngap: ${g}px;`;
    };
    [cols, rows, gap].forEach(x => x.oninput = paint);
    w.append(el('div', { class: 'split' },
      el('div', { class: 'col' }, $.label('Columns', cols), $.label('Rows', rows), $.label('Gap', gap)), box), out,
      $.btn('Copy CSS', () => copy(out.textContent), true));
    paint();
  }
});

tool({
  id: 'html-preview', cat: 'dev', name: 'HTML Live Preview',
  desc: 'Sandboxed iframe rendering of HTML/CSS/JS as you type.',
  keywords: 'html preview sandbox live',
  render(w){
    const ta = $.ta('<h1>Hello</h1>\n<p style="color:#6d5bc7">Live preview</p>');
    ta.style.minHeight = '200px';
    const frame = el('iframe', {
      sandbox: 'allow-scripts',
      style: { width: '100%', height: '340px', border: '1px solid var(--line)', borderRadius: '8px', background: '#fff' }
    });
    let t;
    const run = () => {
      clearTimeout(t);
      t = setTimeout(() => { frame.srcdoc = ta.value; }, 250);
    };
    ta.oninput = run; run();
    w.append($.split(ta, frame), $.hint('Scripts run in a sandboxed frame with no access to this page.'));
  }
});

tool({
  id: 'js-playground', cat: 'dev', name: 'JavaScript Playground',
  desc: 'Run JS against a sandboxed frame; console output captured.',
  keywords: 'javascript run eval console playground',
  render(w){
    const ta = $.ta('console.log([1,2,3].map(n => n * 2));\nreturn 6 * 7;');
    ta.style.minHeight = '190px';
    const out = $.out();
    const run = () => {
      const frame = el('iframe', { sandbox: 'allow-scripts', style: { display: 'none' } });
      document.body.append(frame);
      const code = `(() => {
        const lines = [];
        const fmt = v => { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); } };
        console.log = (...a) => lines.push(a.map(fmt).join(' '));
        console.error = (...a) => lines.push('ERR ' + a.map(fmt).join(' '));
        try { const r = (function(){ ${ta.value} })(); if (r !== undefined) lines.push('=> ' + fmt(r)); }
        catch (e) { lines.push('THROW ' + e.message); }
        parent.postMessage({ __uh: 1, lines }, '*');
      })();`;
      frame.srcdoc = `<script>${code}<\/script>`;
      const onMsg = e => {
        if (e.data && e.data.__uh){
          out.textContent = e.data.lines.join('\n') || '(no output)';
          removeEventListener('message', onMsg);
          frame.remove();
        }
      };
      addEventListener('message', onMsg);
      setTimeout(() => { if (frame.isConnected){ out.textContent = 'Timed out (infinite loop?).'; frame.remove(); removeEventListener('message', onMsg); } }, 3000);
    };
    w.append(ta, $.row($.btn('Run', run, true), $.btn('Clear', () => out.textContent = '')), out);
  }
});

tool({
  id: 'sql-format', cat: 'dev', name: 'SQL Formatter',
  desc: 'Keyword-cased, clause-per-line formatting for reads.',
  keywords: 'sql format beautify query',
  render(w){
    const ta = $.ta('select id, name from users u join orders o on o.user_id = u.id where u.active = 1 order by name;');
    ta.style.minHeight = '200px';
    const out = $.out();
    const KEY = ['select', 'from', 'where', 'group by', 'order by', 'having', 'limit', 'offset', 'join', 'left join', 'right join', 'inner join', 'outer join', 'on', 'union', 'insert into', 'values', 'update', 'set', 'delete from'];
    const run = () => {
      let s = ' ' + ta.value.replace(/\s+/g, ' ').trim() + ' ';
      KEY.slice().sort((a, b) => b.length - a.length).forEach(k => {
        s = s.replace(new RegExp(`\\s${k}\\s`, 'gi'), `\n${k.toUpperCase()} `);
      });
      s = s.replace(/\s*,\s*/g, ',\n  ').replace(/\s+(AND|OR)\s+/g, '\n  $1 ');
      out.textContent = s.trim();
    };
    w.append(ta, $.btn('Format', run, true), out);
    run();
  }
});

tool({
  id: 'api-format', cat: 'dev', name: 'API Response Formatter',
  desc: 'Format JSON or XML responses for reading with size stats.',
  keywords: 'api response json xml format response',
  render(w){
    const ta = $.ta('Paste a JSON or XML response…'); ta.style.minHeight = '220px';
    const out = $.out();
    const stats = $.hint('');
    const run = () => {
      const raw = ta.value.trim();
      stats.textContent = `${raw.length.toLocaleString()} chars · ${(new TextEncoder().encode(raw)).length.toLocaleString()} bytes`;
      if (!raw) { out.textContent = ''; return; }
      if (raw[0] === '{' || raw[0] === '['){
        try { out.textContent = JSON.stringify(JSON.parse(raw), null, 2); }
        catch (e) { out.textContent = 'JSON error: ' + e.message; }
      } else {
        const doc = new DOMParser().parseFromString(raw, 'application/xml');
        const err = doc.querySelector('parsererror');
        out.textContent = err ? 'XML error: ' + err.textContent.split('\n')[0]
          : new XMLSerializer().serializeToString(doc).replace(/></g, '>\n<');
      }
    };
    w.append(ta, $.row($.btn('Format', run, true), $.btn('Copy', () => copy(out.textContent))), stats, out);
  }
});

tool({
  id: 'qr-scan', cat: 'dev', name: 'QR Code Scanner',
  desc: 'Scan a QR from the camera or an uploaded image.',
  keywords: 'qr scan read camera decode',
  render(w){
    const out = $.out();
    const video = el('video', { autoplay: true, playsinline: true, style: { width: '100%', maxWidth: '420px', borderRadius: '8px', border: '1px solid var(--line)' } });
    const canvas = el('canvas', { hidden: true });
    let stream = null, raf = 0;
    const decodeLoop = async () => {
      if (!stream) return;
      const ctx = canvas.getContext('2d');
      if (video.readyState >= 2){
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const jsQR = await lib('jsqr');
        const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
        if (res){ out.textContent = res.data; stop(); return; }
      }
      raf = requestAnimationFrame(decodeLoop);
    };
    const stop = () => { stream?.getTracks().forEach(t => t.stop()); stream = null; cancelAnimationFrame(raf); };
    const start = async () => {
      try {
        const jsQR = await lib('jsqr');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        decodeLoop();
      } catch (e) { out.textContent = 'Camera unavailable: ' + e.message; }
    };
    const fileIn = el('input', { type: 'file', accept: 'image/*', hidden: true });
    fileIn.onchange = async () => {
      const f = fileIn.files[0]; if (!f) return;
      const url = await readFile(f).dataURL();
      const img = new Image();
      img.onload = async () => {
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, img.width, img.height);
        const jsQR = await lib('jsqr');
        const res = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
        out.textContent = res ? res.data : 'No QR found in that image.';
      };
      img.src = url;
    };
    w.append(video, $.row($.btn('Start camera', start, true), $.btn('Stop', stop), $.btn('From image…', () => fileIn.click()), fileIn), out);
    w.addEventListener('uh:unmount', stop);
  }
});
})();
