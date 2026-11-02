/* Image + PDF — canvas pipeline, pdf.js, pdf-lib, jsPDF */
(() => {
'use strict';
const { el, tool, ui, lib, download, readFile, bytes } = window.UH;
const $ = ui;

/* ---------- shared image pipeline ---------- */
function loadImage(file){
  return new Promise(async (res, rej) => {
    const url = await readFile(file).dataURL();
    const img = new Image();
    img.onload = () => res({ img, url });
    img.onerror = () => rej(new Error('not a decodable image'));
    img.src = url;
  });
}
function toCanvas(img, w = img.naturalWidth, h = img.naturalHeight){
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
const canvasBlob = (c, type = 'image/png', q = 0.9) => new Promise(r => c.toBlob(r, type, q));
const fmtBytes = c => `${c.width}×${c.height}px`;

/** Standard image tool scaffold: drop zone → canvas → actions */
function imageTool(w, { title, build }) {
  const stage = el('div', { class: 'col' });
  const dz = $.dz('Drop an image (PNG, JPEG, WebP, GIF, BMP)', async files => {
    try {
      const { img } = await loadImage(files[0]);
      stage.replaceChildren(...build(img, files[0]));
    } catch (e) { stage.replaceChildren(el('div', { class: 'err', text: e.message })); }
  });
  w.append(dz.zone, stage);
}

/* ============================ IMAGE ============================ */

tool({
  id: 'img-compress', cat: 'image', name: 'Image Compressor',
  desc: 'Re-encode to JPEG or WebP at a chosen quality; see the size saved.',
  keywords: 'compress image reduce size jpeg webp',
  render(w){
    imageTool(w, {
      build: img => {
        const canvas = toCanvas(img);
        const preview = el('canvas', { class: 'preview' });
        const out = $.out();
        const quality = el('input', { type: 'range', min: 10, max: 100, value: 75, style: { width: '100%' } });
        const qLbl = $.hint('75%');
        const type = $.sel([{ v: 'image/jpeg', t: 'JPEG' }, { v: 'image/webp', t: 'WebP' }], 'image/jpeg');
        let blob = null;
        const run = async () => {
          blob = await canvasBlob(canvas, type.value, +quality.value / 100);
          preview.width = 300; preview.height = Math.round(300 * canvas.height / canvas.width);
          preview.getContext('2d').drawImage(canvas, 0, 0, preview.width, preview.height);
          out.textContent = `${fmtBytes(canvas)}\noriginal ~${bytes(img.src.length * 0.75)}\ncompressed ${bytes(blob.size)}\nratio ${(100 - blob.size / (img.src.length * 0.75) * 100).toFixed(1)}% smaller`;
        };
        quality.oninput = () => { qLbl.textContent = quality.value + '%'; run(); };
        type.onchange = run; run();
        return [preview, $.row($.label('Quality', quality), qLbl, $.label('Format', type)), out,
          $.btn('Download', () => blob && download(blob, 'compressed.' + (type.value === 'image/webp' ? 'webp' : 'jpg')), true)];
      }
    });
  }
});

tool({
  id: 'img-resize', cat: 'image', name: 'Image Resizer',
  desc: 'Resize by pixels or percentage with aspect lock.',
  keywords: 'resize image dimensions scale',
  render(w){
    imageTool(w, {
      build: img => {
        const wIn = $.in('width', String(img.naturalWidth), 'number');
        const hIn = $.in('height', String(img.naturalHeight), 'number');
        const pct = $.in('percent', '', 'number');
        const lock = el('input', { type: 'checkbox', checked: true });
        const canvas = el('canvas', { class: 'preview' });
        const out = $.out();
        let blob = null;
        const ratio = img.naturalWidth / img.naturalHeight;
        const run = async () => {
          let W = +wIn.value, H = +hIn.value;
          if (pct.value){ W = Math.round(img.naturalWidth * +pct.value / 100); H = Math.round(img.naturalHeight * +pct.value / 100); }
          const c = toCanvas(img, W, H);
          canvas.width = Math.min(600, c.width); canvas.height = Math.round(canvas.width * c.height / c.width);
          canvas.getContext('2d').drawImage(c, 0, 0, canvas.width, canvas.height);
          blob = await canvasBlob(c, 'image/png');
          out.textContent = `output ${W}×${H}px · ${bytes(blob.size)}`;
        };
        wIn.oninput = () => { if (lock.checked) hIn.value = String(Math.round(+wIn.value / ratio)); run(); };
        hIn.oninput = () => { if (lock.checked) wIn.value = String(Math.round(+hIn.value * ratio)); run(); };
        pct.oninput = run;
        run();
        return [canvas, $.row($.label('Width', wIn), $.label('Height', hIn),
          el('label', { class: 'row', style: { gap: '5px', fontSize: '13px' } }, lock, 'Lock ratio')),
          $.label('Or percent', pct), out,
          $.btn('Download PNG', () => blob && download(blob, 'resized.png'), true)];
      }
    });
  }
});

tool({
  id: 'img-convert', cat: 'image', name: 'Image Format Converter',
  desc: 'Convert between PNG, JPEG, and WebP with quality control.',
  keywords: 'convert image format png jpg webp',
  render(w){
    imageTool(w, {
      build: img => {
        const type = $.sel([{ v: 'image/png', t: 'PNG' }, { v: 'image/jpeg', t: 'JPEG' }, { v: 'image/webp', t: 'WebP' }], 'image/png');
        const q = el('input', { type: 'range', min: 10, max: 100, value: 92, style: { width: '100%' } });
        const out = $.out();
        const canvas = toCanvas(img);
        let blob = null;
        const run = async () => {
          if (type.value === 'image/jpeg'){
            const flat = document.createElement('canvas');
            flat.width = canvas.width; flat.height = canvas.height;
            const ctx = flat.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, flat.width, flat.height);
            ctx.drawImage(canvas, 0, 0);
            blob = await canvasBlob(flat, type.value, +q.value / 100);
          } else blob = await canvasBlob(canvas, type.value, +q.value / 100);
          out.textContent = `${fmtBytes(canvas)} → ${type.value.split('/')[1].toUpperCase()}\n${bytes(blob.size)}`;
        };
        type.onchange = run; q.oninput = run; run();
        return [$.row($.label('Output format', type), $.label('Quality', q)), out,
          $.btn('Download', () => blob && download(blob, 'converted.' + type.value.split('/')[1]), true)];
      }
    });
  }
});

tool({
  id: 'img-crop', cat: 'image', name: 'Image Cropper',
  desc: 'Drag a rectangle on the image, crop, download.',
  keywords: 'crop image cut trim selection',
  render(w){
    imageTool(w, {
      build: img => {
        const view = toCanvas(img, Math.min(720, img.naturalWidth), 0);
        if (view.width !== Math.min(720, img.naturalWidth)){
          const s = Math.min(720, img.naturalWidth) / img.naturalWidth;
          view.width = Math.round(img.naturalWidth * s);
          view.height = Math.round(img.naturalHeight * s);
          view.getContext('2d').drawImage(img, 0, 0, view.width, view.height);
        }
        const overlay = el('canvas', { class: 'edit' });
        overlay.width = view.width; overlay.height = view.height;
        const octx = overlay.getContext('2d');
        octx.drawImage(view, 0, 0);
        let sx = 0, sy = 0, dragging = false;
        const info = $.out();
        const redraw = (ex = sx, ey = sy) => {
          octx.clearRect(0, 0, overlay.width, overlay.height);
          octx.drawImage(view, 0, 0);
          octx.fillStyle = 'rgba(0,0,0,.45)';
          octx.fillRect(0, 0, overlay.width, overlay.height);
          const x = Math.min(sx, ex), y = Math.min(sy, ey);
          const w = Math.abs(ex - sx), h = Math.abs(ey - sy);
          octx.drawImage(view, x, y, w, h, x, y, w, h);
          octx.strokeStyle = '#fff'; octx.lineWidth = 1.5;
          octx.strokeRect(x, y, w, h);
          const scale = img.naturalWidth / overlay.width;
          info.textContent = `selection ${Math.round(w * scale)}×${Math.round(h * scale)} px`;
        };
        const pos = e => {
          const r = overlay.getBoundingClientRect();
          return [Math.round((e.clientX - r.left) * overlay.width / r.width), Math.round((e.clientY - r.top) * overlay.height / r.height)];
        };
        overlay.onpointerdown = e => { [sx, sy] = pos(e); dragging = true; overlay.setPointerCapture(e.pointerId); };
        overlay.onpointermove = e => { if (dragging) redraw(...pos(e)); };
        overlay.onpointerup = e => { dragging = false; redraw(...pos(e)); };
        const crop = async () => {
          const scale = img.naturalWidth / overlay.width;
          const c = toCanvas(img, sx * scale, sy * scale);
          const ctx = c.getContext('2d');
          ctx.drawImage(img, sx * scale, sy * scale, (overlay.width) * 1, (overlay.height) * 1, 0, 0, c.width, c.height);
          const blob = await canvasBlob(c, 'image/png');
          download(blob, 'cropped.png');
        };
        return [overlay, $.hint('Drag on the image to select a region.'), info, $.btn('Crop & download', crop, true)];
      }
    });
  }
});

tool({
  id: 'img-rotate', cat: 'image', name: 'Image Rotator & Flipper',
  desc: 'Rotate in 90° steps or arbitrary angles; flip horizontal or vertical.',
  keywords: 'rotate flip image mirror turn',
  render(w){
    imageTool(w, {
      build: img => {
        let angle = 0, flipH = false, flipV = false;
        const canvas = el('canvas', { class: 'preview' });
        const out = $.out();
        const paint = async () => {
          const rad = angle * Math.PI / 180;
          const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
          const W = Math.round(img.naturalWidth * cos + img.naturalHeight * sin);
          const H = Math.round(img.naturalWidth * sin + img.naturalHeight * cos);
          const c = document.createElement('canvas');
          c.width = W; c.height = H;
          const ctx = c.getContext('2d');
          ctx.translate(W / 2, H / 2);
          ctx.rotate(rad);
          ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
          ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
          canvas.width = Math.min(600, W); canvas.height = Math.round(canvas.width * H / W);
          canvas.getContext('2d').drawImage(c, 0, 0, canvas.width, canvas.height);
          const blob = await canvasBlob(c, 'image/png');
          out.textContent = `${W}×${H}px · ${bytes(blob.size)}`;
          canvas._blob = blob;
        };
        w.append ? null : null;
        const btns = [
          ['↺ 90°', () => { angle -= 90; paint(); }],
          ['↻ 90°', () => { angle += 90; paint(); }],
          ['Flip H', () => { flipH = !flipH; paint(); }],
          ['Flip V', () => { flipV = !flipV; paint(); }],
          ['Reset', () => { angle = 0; flipH = flipV = false; paint(); }]
        ];
        paint();
        return [canvas, $.row(...btns.map(([l, f]) => $.btn(l, f))), out,
          $.btn('Download', () => canvas._blob && download(canvas._blob, 'transformed.png'), true)];
      }
    });
  }
});

tool({
  id: 'img-watermark', cat: 'image', name: 'Image Watermark',
  desc: 'Text watermark with position, opacity, size, and tiling.',
  keywords: 'watermark image text copyright',
  render(w){
    imageTool(w, {
      build: img => {
        const text = $.in('watermark text', '© Your Name');
        const opacity = el('input', { type: 'range', min: 5, max: 100, value: 40, style: { width: '100%' } });
        const size = el('input', { type: 'range', min: 10, max: 200, value: 48, style: { width: '100%' } });
        const pos = $.sel(['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center', 'tile'], 'bottom-right');
        const color = el('input', { type: 'color', value: '#ffffff', style: { width: '46px', height: '32px', border: '1px solid var(--line2)', borderRadius: '6px', background: 'none' } });
        const canvas = el('canvas', { class: 'preview' });
        const out = $.out();
        let blob = null;
        const paint = async () => {
          const c = toCanvas(img);
          const ctx = c.getContext('2d');
          const fs = Math.max(8, Math.round(c.width * (+size.value / 1000)));
          ctx.font = `600 ${fs}px system-ui, sans-serif`;
          ctx.fillStyle = color.value;
          ctx.globalAlpha = +opacity.value / 100;
          ctx.textBaseline = 'middle';
          const tw = ctx.measureText(text.value).width;
          if (pos.value === 'tile'){
            ctx.save();
            ctx.translate(0, 0); ctx.rotate(-Math.PI / 8);
            for (let y = -c.height; y < c.height * 2; y += fs * 4)
              for (let x = -c.width; x < c.width * 2; x += tw + fs * 3)
                ctx.fillText(text.value, x, y);
            ctx.restore();
          } else {
            const m = fs;
            const xy = {
              'bottom-right': [c.width - tw - m, c.height - m],
              'bottom-left': [m, c.height - m],
              'top-right': [c.width - tw - m, m],
              'top-left': [m, m],
              'center': [(c.width - tw) / 2, c.height / 2]
            }[pos.value];
            ctx.fillText(text.value, xy[0], xy[1]);
          }
          canvas.width = Math.min(600, c.width); canvas.height = Math.round(canvas.width * c.height / c.width);
          canvas.getContext('2d').drawImage(c, 0, 0, canvas.width, canvas.height);
          blob = await canvasBlob(c, 'image/png');
          out.textContent = `${fmtBytes(c)} · ${bytes(blob.size)}`;
        };
        [text, opacity, size, color, pos].forEach(x => { x.oninput = paint; x.onchange = paint; });
        paint();
        return [canvas, $.row($.label('Text', text), $.label('Color', color)),
          $.row($.label('Opacity', opacity), $.label('Size', size), $.label('Position', pos)), out,
          $.btn('Download', () => blob && download(blob, 'watermarked.png'), true)];
      }
    });
  }
});

tool({
  id: 'img-blur', cat: 'image', name: 'Image Blur Tool',
  desc: 'Gaussian-style blur via canvas filter, strength adjustable.',
  keywords: 'blur image gaussian soften',
  render(w){
    imageTool(w, {
      build: img => {
        const amount = el('input', { type: 'range', min: 0, max: 40, value: 8, style: { width: '100%' } });
        const canvas = el('canvas', { class: 'preview' });
        const out = $.out();
        let blob = null;
        const paint = async () => {
          const c = toCanvas(img);
          const ctx = c.getContext('2d');
          ctx.filter = `blur(${amount.value}px)`;
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          canvas.width = Math.min(600, c.width); canvas.height = Math.round(canvas.width * c.height / c.width);
          canvas.getContext('2d').drawImage(c, 0, 0, canvas.width, canvas.height);
          blob = await canvasBlob(c, 'image/png');
          out.textContent = `blur ${amount.value}px · ${bytes(blob.size)}`;
        };
        amount.oninput = paint; paint();
        return [canvas, $.label('Blur radius', amount), out,
          $.btn('Download', () => blob && download(blob, 'blurred.png'), true)];
      }
    });
  }
});

tool({
  id: 'img-pixelate', cat: 'image', name: 'Image Pixelate Tool',
  desc: 'Downscale/upscale with smoothing off for a true block effect.',
  keywords: 'pixelate mosaic censor blocks',
  render(w){
    imageTool(w, {
      build: img => {
        const blocks = el('input', { type: 'range', min: 2, max: 80, value: 12, style: { width: '100%' } });
        const canvas = el('canvas', { class: 'preview' });
        const out = $.out();
        let blob = null;
        const paint = async () => {
          const b = +blocks.value;
          const small = document.createElement('canvas');
          small.width = Math.max(1, Math.floor(img.naturalWidth / b));
          small.height = Math.max(1, Math.floor(img.naturalHeight / b));
          const sctx = small.getContext('2d');
          sctx.imageSmoothingEnabled = false;
          sctx.drawImage(img, 0, 0, small.width, small.height);
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(small, 0, 0, c.width, c.height);
          canvas.width = Math.min(600, c.width); canvas.height = Math.round(canvas.width * c.height / c.width);
          canvas.getContext('2d').imageSmoothingEnabled = false;
          canvas.getContext('2d').drawImage(c, 0, 0, canvas.width, canvas.height);
          blob = await canvasBlob(c, 'image/png');
          out.textContent = `block size ${b}px · ${fmtBytes(c)}`;
        };
        blocks.oninput = paint; paint();
        return [canvas, $.label('Block size', blocks), out,
          $.btn('Download', () => blob && download(blob, 'pixelated.png'), true)];
      }
    });
  }
});

tool({
  id: 'img-color-pick', cat: 'image', name: 'Image Color Picker',
  desc: 'Click anywhere on a loaded image to read the exact pixel color.',
  keywords: 'eyedropper color picker image pixel',
  render(w){
    imageTool(w, {
      build: img => {
        const canvas = toCanvas(img, Math.min(720, img.naturalWidth), 0);
        if (canvas.width !== Math.min(720, img.naturalWidth)){
          const s = Math.min(720, img.naturalWidth) / img.naturalWidth;
          canvas.width = Math.round(img.naturalWidth * s);
          canvas.height = Math.round(img.naturalHeight * s);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        canvas.className = 'edit';
        const swatch = el('div', { style: { width: '56px', height: '40px', borderRadius: '8px', border: '1px solid var(--line)', background: '#000' } });
        const out = $.out();
        canvas.onclick = e => {
          const r = canvas.getBoundingClientRect();
          const x = Math.round((e.clientX - r.left) * canvas.width / r.width);
          const y = Math.round((e.clientY - r.top) * canvas.height / r.height);
          const d = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
          const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
          swatch.style.background = hex;
          out.textContent = `position  ${x}, ${y}\nHEX       ${hex.toUpperCase()}\nRGB       rgb(${d[0]}, ${d[1]}, ${d[2]})\nRGBA      rgba(${d[0]}, ${d[1]}, ${d[2]}, ${(d[3] / 255).toFixed(2)})`;
        };
        return [canvas, $.row(swatch, $.hint('Click the image to sample a pixel.')), out];
      }
    });
  }
});

tool({
  id: 'img-to-pdf', cat: 'image', name: 'Image to PDF',
  desc: 'One or many images into a single PDF, page-fit or original size.',
  keywords: 'image to pdf convert jpg png pdf',
  render(w){
    let files = [];
    const dz = $.dz('Drop images (order is preserved)', fs => { files = fs; dz.setNames(fs.map(f => f.name)); });
    const fit = $.sel([{ v: 'a4', t: 'A4 page, fit' }, { v: 'orig', t: 'Original size' }], 'a4');
    const out = $.out();
    const go = async () => {
      if (!files.length) return;
      out.textContent = 'Building…';
      const { jsPDF } = await lib('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      let first = true;
      for (const f of files){
        const { img } = await loadImage(f);
        if (fit.value === 'orig'){
          const c = toCanvas(img);
          const jpeg = await canvasBlob(c, 'image/jpeg', 0.92);
          const url = URL.createObjectURL(jpeg);
          if (!first) doc.addPage([c.width, c.height], c.width > c.height ? 'l' : 'p');
          doc.addImage(url, 'JPEG', 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
        } else {
          const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
          const scale = Math.min(pw / img.naturalWidth, ph / img.naturalHeight);
          const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
          if (!first) doc.addPage();
          doc.addImage(img, 'PNG', (pw - w) / 2, (ph - h) / 2, w, h);
        }
        first = false;
      }
      const blob = doc.output('blob');
      out.textContent = `${files.length} page(s) · ${bytes(blob.size)}`;
      download(blob, 'images.pdf');
    };
    w.append(dz.zone, dz.list, $.label('Page fit', fit), $.btn('Build PDF', go, true), out);
  }
});

tool({
  id: 'bg-remove', cat: 'image', name: 'Background Remover',
  desc: 'Chroma-key removal: samples the corner color and clears matching pixels with a tolerance slider.',
  keywords: 'background remove transparent png cutout',
  how: 'Edge-sampled color distance with a soft alpha ramp. Works well on flat or studio backgrounds; photographic backgrounds need a segmentation model, which cannot run in a pure static page.',
  render(w){
    imageTool(w, {
      build: img => {
        const tol = el('input', { type: 'range', min: 0, max: 160, value: 40, style: { width: '100%' } });
        const canvas = el('canvas', { class: 'preview' });
        const out = $.out();
        let blob = null;
        const paint = async () => {
          const c = toCanvas(img);
          const ctx = c.getContext('2d');
          const d = ctx.getImageData(0, 0, c.width, c.height);
          const px = d.data;
          const corners = [[0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1]];
          const avg = corners.map(([x, y]) => { const i = (y * c.width + x) * 4; return [px[i], px[i + 1], px[i + 2]]; });
          const base = avg.reduce((a, v) => [a[0] + v[0] / 4, a[1] + v[1] / 4, a[2] + v[2] / 4], [0, 0, 0]);
          const t = +tol.value;
          for (let i = 0; i < px.length; i += 4){
            const dist = Math.hypot(px[i] - base[0], px[i + 1] - base[1], px[i + 2] - base[2]);
            if (dist < t) px[i + 3] = 0;
            else if (dist < t * 1.6) px[i + 3] = Math.round(px[i + 3] * (dist - t) / (t * 0.6));
          }
          ctx.putImageData(d, 0, 0);
          canvas.width = Math.min(600, c.width); canvas.height = Math.round(canvas.width * c.height / c.width);
          const pctx = canvas.getContext('2d');
          pctx.clearRect(0, 0, canvas.width, canvas.height);
          pctx.drawImage(c, 0, 0, canvas.width, canvas.height);
          blob = await canvasBlob(c, 'image/png');
          out.textContent = `sampled background rgb(${base.map(v => Math.round(v)).join(', ')}) · ${bytes(blob.size)}`;
        };
        tol.oninput = paint; paint();
        return [canvas, $.label('Tolerance', tol), out,
          $.btn('Download transparent PNG', () => blob && download(blob, 'cutout.png'), true)];
      }
    });
  }
});

tool({
  id: 'passport-photo', cat: 'image', name: 'Passport Photo Creator',
  desc: 'Preset sizes for common passport/visa photos with head-position guide.',
  keywords: 'passport photo id visa crop size',
  render(w){
    imageTool(w, {
      build: img => {
        const SIZES = { 'US passport 2×2in (600×600)': [600, 600], 'UK/EU 35×45mm (413×531)': [413, 531], 'India 35×45mm (413×531)': [413, 531], 'China 33×48mm (390×567)': [390, 567], 'Canada 50×70mm (591×827)': [591, 827] };
        const preset = $.sel(Object.keys(SIZES), 'US passport 2×2in (600×600)');
        const zoom = el('input', { type: 'range', min: 50, max: 200, value: 100, style: { width: '100%' } });
        const ox = el('input', { type: 'range', min: -50, max: 50, value: 0, style: { width: '100%' } });
        const oy = el('input', { type: 'range', min: -50, max: 50, value: 0, style: { width: '100%' } });
        const canvas = el('canvas', { class: 'preview' });
        const out = $.out();
        let blob = null;
        const paint = async () => {
          const [W, H] = SIZES[preset.value];
          const c = document.createElement('canvas');
          c.width = W; c.height = H;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
          const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * (+zoom.value / 100);
          const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
          const dx = (W - dw) / 2 + (+ox.value / 100) * W;
          const dy = (H - dh) / 2 + (+oy.value / 100) * H;
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.strokeStyle = 'rgba(255,0,0,.35)';
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(0, H * 0.12); ctx.lineTo(W, H * 0.12);
          ctx.moveTo(0, H * 0.88); ctx.lineTo(W, H * 0.88);
          ctx.stroke();
          canvas.width = Math.min(340, W); canvas.height = Math.round(canvas.width * H / W);
          canvas.getContext('2d').drawImage(c, 0, 0, canvas.width, canvas.height);
          blob = await canvasBlob(c, 'image/jpeg', 0.95);
          out.textContent = `${W}×${H}px · ${bytes(blob.size)}`;
        };
        [preset, zoom, ox, oy].forEach(x => { x.oninput = paint; x.onchange = paint; });
        paint();
        return [canvas, $.label('Preset', preset), $.row($.label('Zoom', zoom)), $.row($.label('Shift X', ox)), $.row($.label('Shift Y', oy)),
          $.hint('Dashed lines mark the usual head-height band. Framing rules vary by country — check your issuing authority before printing.'),
          out, $.btn('Download JPEG', () => blob && download(blob, 'passport.jpg'), true)];
      }
    });
  }
});

/* ============================ PDF ============================ */

tool({
  id: 'pdf-generate', cat: 'pdf', name: 'PDF Generator',
  desc: 'Plain text to a paginated PDF with selectable font size and margins.',
  keywords: 'pdf create text generate jspdf',
  render(w){
    const ta = $.ta('Write your document…'); ta.style.minHeight = '260px';
    const size = $.in('font pt', '11', 'number');
    const out = $.out();
    const go = async () => {
      const { jsPDF } = await lib('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      doc.setFontSize(+size.value || 11);
      const margin = 56;
      const lines = doc.splitTextToSize(ta.value, doc.internal.pageSize.getWidth() - margin * 2);
      let y = margin;
      const lh = (+size.value || 11) * 1.45;
      for (const line of lines){
        if (y > doc.internal.pageSize.getHeight() - margin){ doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += lh;
      }
      const blob = doc.output('blob');
      out.textContent = `${doc.internal.getNumberOfPages()} page(s) · ${bytes(blob.size)}`;
      download(blob, 'document.pdf');
    };
    w.append(ta, $.row($.label('Font size', size), $.btn('Generate PDF', go, true)), out);
  }
});

async function loadPdf(file){
  const { PDFDocument } = await lib('pdflib');
  const buf = await file.arrayBuffer();
  return { doc: await PDFDocument.load(buf, { ignoreEncryption: true }), raw: buf };
}
const pdfBytesOut = async doc => new Blob([await doc.save()], { type: 'application/pdf' });

tool({
  id: 'pdf-merge', cat: 'pdf', name: 'PDF Merger',
  desc: 'Concatenate multiple PDFs in drop order.',
  keywords: 'merge pdf combine join',
  render(w){
    let files = [];
    const dz = $.dz('Drop PDFs (order matters)', fs => { files = fs; dz.setNames(fs.map(f => f.name)); });
    const out = $.out();
    const go = async () => {
      if (files.length < 2) { out.textContent = 'Add at least two PDFs.'; return; }
      const { PDFDocument } = await lib('pdflib');
      const merged = await PDFDocument.create();
      for (const f of files){
        const src = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      const blob = await pdfBytesOut(merged);
      out.textContent = `${merged.getPageCount()} pages · ${bytes(blob.size)}`;
      download(blob, 'merged.pdf');
    };
    w.append(dz.zone, dz.list, $.btn('Merge', go, true), out);
  }
});

tool({
  id: 'pdf-split', cat: 'pdf', name: 'PDF Splitter',
  desc: 'Extract a page range or explode into single-page PDFs.',
  keywords: 'split pdf extract pages range',
  render(w){
    let file = null;
    const dz = $.dz('Drop a PDF', fs => { file = fs[0]; dz.setNames([fs[0].name]); });
    const range = $.in('e.g. 1-3,7,10-12', '');
    const out = $.out();
    const doRange = async () => {
      if (!file) return;
      const { PDFDocument } = await lib('pdflib');
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const total = src.getPageCount();
      const wanted = [];
      for (const part of range.value.split(',')){
        const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!m) continue;
        const a = +m[1], b = m[2] ? +m[2] : a;
        for (let i = a; i <= b; i++) if (i >= 1 && i <= total) wanted.push(i - 1);
      }
      if (!wanted.length) { out.textContent = `Enter pages between 1 and ${total}.`; return; }
      const outDoc = await PDFDocument.create();
      const pages = await outDoc.copyPages(src, wanted);
      pages.forEach(p => outDoc.addPage(p));
      const blob = await pdfBytesOut(outDoc);
      out.textContent = `${wanted.length} page(s) extracted · ${bytes(blob.size)}`;
      download(blob, 'extracted.pdf');
    };
    const doExplode = async () => {
      if (!file) return;
      const { PDFDocument } = await lib('pdflib');
      const JSZip = await lib('jszip');
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const zip = new JSZip();
      for (let i = 0; i < src.getPageCount(); i++){
        const d = await PDFDocument.create();
        const [p] = await d.copyPages(src, [i]);
        d.addPage(p);
        zip.file(`page-${String(i + 1).padStart(3, '0')}.pdf`, await d.save());
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      out.textContent = `${src.getPageCount()} single-page PDFs · ${bytes(blob.size)}`;
      download(blob, 'split-pages.zip');
    };
    w.append(dz.zone, $.label('Page range', range), $.row($.btn('Extract range', doRange, true), $.btn('One PDF per page (ZIP)', doExplode)), out);
  }
});

tool({
  id: 'pdf-rotate', cat: 'pdf', name: 'PDF Page Rotator',
  desc: 'Rotate all or selected pages by 90/180/270 degrees.',
  keywords: 'rotate pdf pages landscape orientation',
  render(w){
    let file = null;
    const dz = $.dz('Drop a PDF', fs => { file = fs[0]; dz.setNames([fs[0].name]); });
    const deg = $.sel([{ v: 90, t: '90°' }, { v: 180, t: '180°' }, { v: 270, t: '270°' }], 90);
    const range = $.in('pages (blank = all)', '');
    const out = $.out();
    const go = async () => {
      if (!file) return;
      const { PDFDocument, degrees } = await lib('pdflib');
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const total = doc.getPageCount();
      const sel = new Set();
      if (range.value.trim()){
        for (const part of range.value.split(',')){
          const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
          if (!m) continue;
          const a = +m[1], b = m[2] ? +m[2] : a;
          for (let i = a; i <= b; i++) if (i >= 1 && i <= total) sel.add(i - 1);
        }
      }
      doc.getPages().forEach((p, i) => {
        if (!sel.size || sel.has(i)){
          p.setRotation(degrees((p.getRotation().angle + +deg.value) % 360));
        }
      });
      const blob = await pdfBytesOut(doc);
      out.textContent = `${sel.size || total} page(s) rotated · ${bytes(blob.size)}`;
      download(blob, 'rotated.pdf');
    };
    w.append(dz.zone, $.row($.label('Rotation', deg), $.label('Pages', range), $.btn('Rotate', go, true)), out);
  }
});

tool({
  id: 'pdf-remove-pages', cat: 'pdf', name: 'PDF Page Remover',
  desc: 'Delete specific pages from a PDF.',
  keywords: 'remove pages delete pdf',
  render(w){
    let file = null;
    const dz = $.dz('Drop a PDF', fs => { file = fs[0]; dz.setNames([fs[0].name]); });
    const range = $.in('pages to delete, e.g. 2,5-7', '');
    const out = $.out();
    const go = async () => {
      if (!file) return;
      const { PDFDocument } = await lib('pdflib');
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const total = src.getPageCount();
      const kill = new Set();
      for (const part of range.value.split(',')){
        const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
        if (!m) continue;
        const a = +m[1], b = m[2] ? +m[2] : a;
        for (let i = a; i <= b; i++) if (i >= 1 && i <= total) kill.add(i - 1);
      }
      if (!kill.size) { out.textContent = 'Name at least one valid page.'; return; }
      if (kill.size >= total) { out.textContent = 'That would delete every page.'; return; }
      const keep = [...Array(total).keys()].filter(i => !kill.has(i));
      const outDoc = await PDFDocument.create();
      const pages = await outDoc.copyPages(src, keep);
      pages.forEach(p => outDoc.addPage(p));
      const blob = await pdfBytesOut(outDoc);
      out.textContent = `removed ${kill.size}, kept ${keep.length} · ${bytes(blob.size)}`;
      download(blob, 'trimmed.pdf');
    };
    w.append(dz.zone, $.label('Pages to delete', range), $.btn('Remove pages', go, true), out);
  }
});

tool({
  id: 'pdf-watermark', cat: 'pdf', name: 'PDF Watermark',
  desc: 'Diagonal or centered text watermark on every page, with opacity.',
  keywords: 'pdf watermark stamp text',
  render(w){
    let file = null;
    const dz = $.dz('Drop a PDF', fs => { file = fs[0]; dz.setNames([fs[0].name]); });
    const text = $.in('watermark text', 'CONFIDENTIAL');
    const size = $.in('font size', '48', 'number');
    const opacity = el('input', { type: 'range', min: 5, max: 100, value: 20, style: { width: '100%' } });
    const angleSel = $.sel([{ v: 45, t: 'Diagonal 45°' }, { v: 0, t: 'Horizontal' }], 45);
    const out = $.out();
    const go = async () => {
      if (!file) return;
      const { PDFDocument, rgb, StandardFonts, degrees } = await lib('pdflib');
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const fs = +size.value || 48;
      const tw = font.widthOfTextAtSize(text.value, fs);
      doc.getPages().forEach(p => {
        const { width, height } = p.getSize();
        p.drawText(text.value, {
          x: (width - tw * Math.cos(+angleSel.value * Math.PI / 180)) / 2,
          y: height / 2 - fs * 0.35,
          size: fs, font, opacity: +opacity.value / 100,
          color: rgb(0.75, 0.1, 0.1),
          rotate: degrees(+angleSel.value)
        });
      });
      const blob = await pdfBytesOut(doc);
      out.textContent = `${doc.getPageCount()} page(s) stamped · ${bytes(blob.size)}`;
      download(blob, 'watermarked.pdf');
    };
    w.append(dz.zone, $.row($.label('Text', text), $.label('Size', size), $.label('Angle', angleSel)),
      $.label('Opacity', opacity), $.btn('Apply watermark', go, true), out);
  }
});

tool({
  id: 'pdf-page-numbers', cat: 'pdf', name: 'PDF Page Numbering',
  desc: 'Stamp “n / total” at any corner with size and start offset.',
  keywords: 'pdf page numbers pagination footer',
  render(w){
    let file = null;
    const dz = $.dz('Drop a PDF', fs => { file = fs[0]; dz.setNames([fs[0].name]); });
    const pos = $.sel(['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left'], 'bottom-center');
    const size = $.in('font size', '10', 'number');
    const start = $.in('start at', '1', 'number');
    const out = $.out();
    const go = async () => {
      if (!file) return;
      const { PDFDocument, StandardFonts, rgb } = await lib('pdflib');
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const total = doc.getPageCount();
      const fs = +size.value || 10;
      doc.getPages().forEach((p, i) => {
        const n = String(+start.value + i);
        const label = `${n} / ${total + (+start.value - 1)}`;
        const tw = font.widthOfTextAtSize(label, fs);
        const { width, height } = p.getSize();
        const [vert, horiz] = pos.value.split('-');
        const x = horiz === 'left' ? 36 : horiz === 'right' ? width - tw - 36 : (width - tw) / 2;
        const y = vert === 'top' ? height - 36 : 24;
        p.drawText(label, { x, y, size: fs, font, color: rgb(0.25, 0.25, 0.25) });
      });
      const blob = await pdfBytesOut(doc);
      out.textContent = `${total} page(s) numbered · ${bytes(blob.size)}`;
      download(blob, 'numbered.pdf');
    };
    w.append(dz.zone, $.row($.label('Position', pos), $.label('Font size', size), $.label('Start at', start)),
      $.btn('Add page numbers', go, true), out);
  }
});

tool({
  id: 'pdf-metadata', cat: 'pdf', name: 'PDF Metadata Viewer',
  desc: 'Read title, author, subject, keywords, page count, and producer.',
  keywords: 'pdf metadata info properties read',
  render(w){
    const out = $.out();
    const dz = $.dz('Drop a PDF', async fs => {
      try {
        const { PDFDocument } = await lib('pdflib');
        const doc = await PDFDocument.load(await fs[0].arrayBuffer(), { ignoreEncryption: true });
        const rows = [
          ['Title', doc.getTitle()], ['Author', doc.getAuthor()], ['Subject', doc.getSubject()],
          ['Keywords', (doc.getKeywords() || '').toString()], ['Creator', doc.getCreator()],
          ['Producer', doc.getProducer()], ['Created', doc.getCreationDate()?.toISOString()],
          ['Modified', doc.getModificationDate()?.toISOString()],
          ['Pages', String(doc.getPageCount())]
        ];
        out.textContent = rows.map(([k, v]) => `${k.padEnd(10)} ${v || '—'}`).join('\n');
      } catch (e) { out.textContent = e.message; }
    });
    w.append(dz.zone, out);
  }
});

tool({
  id: 'pdf-to-images', cat: 'pdf', name: 'PDF to Images',
  desc: 'Render each page to PNG at a chosen scale; download singly or as ZIP.',
  keywords: 'pdf to png jpg image convert render',
  render(w){
    let file = null;
    const dz = $.dz('Drop a PDF', fs => { file = fs[0]; dz.setNames([fs[0].name]); });
    const scale = el('input', { type: 'range', min: 1, max: 4, value: 2, step: '0.5', style: { width: '100%' } });
    const thumbs = el('div', { class: 'thumbs' });
    const out = $.out();
    const go = async () => {
      if (!file) return;
      thumbs.replaceChildren(); out.textContent = 'Rendering…';
      const pdfjsLib = await lib('pdfjs');
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const blobs = [];
      for (let i = 1; i <= pdf.numPages; i++){
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: +scale.value });
        const c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        const blob = await canvasBlob(c, 'image/png');
        blobs.push({ blob, i });
        const img = el('img', { src: URL.createObjectURL(blob) });
        const fig = el('figure', {}, img, el('figcaption', { text: `p${i}` }));
        img.onclick = () => download(blob, `page-${i}.png`);
        thumbs.append(fig);
      }
      out.textContent = `${blobs.length} page image(s) — click a thumbnail to save.`;
      const zipBtn = $.btn('Download all (ZIP)', async () => {
        const JSZip = await lib('jszip');
        const zip = new JSZip();
        blobs.forEach(({ blob, i }) => zip.file(`page-${String(i).padStart(3, '0')}.png`, blob));
        download(await zip.generateAsync({ type: 'blob' }), 'pdf-pages.zip');
      }, true);
      out.after(zipBtn);
    };
    w.append(dz.zone, $.label('Render scale', scale), $.btn('Render pages', go, true), out, thumbs);
  }
});

tool({
  id: 'pdf-text', cat: 'pdf', name: 'PDF Text Extractor',
  desc: 'Pull selectable text out of a PDF, page by page.',
  keywords: 'pdf text extract copy content',
  render(w){
    const out = $.ta('Extracted text appears here…'); out.readOnly = true; out.style.minHeight = '320px';
    const dz = $.dz('Drop a PDF', async fs => {
      try {
        out.value = 'Extracting…';
        const pdfjsLib = await lib('pdfjs');
        const pdf = await pdfjsLib.getDocument({ data: await fs[0].arrayBuffer() }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++){
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          pages.push(`— page ${i} —\n` + tc.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim());
        }
        out.value = pages.join('\n\n');
      } catch (e) { out.value = 'Failed: ' + e.message; }
    });
    w.append(dz.zone, out, $.row($.btn('Download .txt', () => download(out.value, 'extracted.txt', 'text/plain'), true)));
  }
});

tool({
  id: 'pdf-compress', cat: 'pdf', name: 'PDF Compressor',
  desc: 'Re-save with object streams; reports size delta honestly.',
  keywords: 'compress pdf reduce size shrink',
  how: 'pdf-lib can rewrite the file and use compressed object streams, but cannot re-encode embedded images. Large savings need an image recompression pass — Ghostscript or qpdf on a server — so this tool reports the delta it actually achieved rather than promising one.',
  render(w){
    let file = null;
    const dz = $.dz('Drop a PDF', fs => { file = fs[0]; dz.setNames([fs[0].name]); });
    const out = $.out();
    const go = async () => {
      if (!file) return;
      const { PDFDocument } = await lib('pdflib');
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
      const bytesOut = await doc.save({ useObjectStreams: true });
      const blob = new Blob([bytesOut], { type: 'application/pdf' });
      const delta = (1 - blob.size / file.size) * 100;
      out.textContent = `before  ${bytes(file.size)}\nafter   ${bytes(blob.size)}\nchange  ${delta >= 0 ? '−' : '+'}${Math.abs(delta).toFixed(1)}%`;
      download(blob, 'compressed.pdf');
    };
    w.append(dz.zone, $.btn('Compress', go, true), out,
      $.hint('Image-heavy PDFs change little without a raster re-encode pass.'));
  }
});

tool({
  id: 'pdf-protect', cat: 'pdf', name: 'PDF Password Protector', needsApi: true,
  desc: 'Encrypt a PDF with a user password. Requires a server-side qpdf step.',
  keywords: 'pdf password protect encrypt secure',
  how: 'PDF encryption (AES-256 / RC4 revision 6) is not implemented in pdf-lib. The front end posts the file to /api/pdf/protect, which runs qpdf --encrypt and returns the sealed file. Keep the password out of logs.',
  render(w){
    let file = null;
    const dz = $.dz('Drop a PDF', fs => { file = fs[0]; dz.setNames([fs[0].name]); });
    const pw = el('input', { class: 'in', type: 'password', placeholder: 'user password' });
    const out = $.out();
    const go = async () => {
      if (!file || !pw.value) return;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('password', pw.value);
      try {
        const r = await fetch('/api/pdf/protect', { method: 'POST', body: fd });
        if (!r.ok) throw new Error('endpoint returned ' + r.status);
        download(await r.blob(), 'protected.pdf');
        out.textContent = 'Encrypted file downloaded.';
      } catch (e) {
        out.textContent = `Endpoint not reachable (${e.message}).\n\nServer contract:  POST /api/pdf/protect  multipart { file, password }  →  application/pdf\nImplementation: qpdf --encrypt "<pw>" "<owner>" 256 -- in.pdf out.pdf\nNever store the password; stream it straight into the child process.`;
      }
    };
    w.append(dz.zone, $.label('Password', pw), $.btn('Encrypt', go, true), out);
  }
});

tool({
  id: 'pdf-unlock', cat: 'pdf', name: 'PDF Unlocker', needsApi: true,
  desc: 'Remove password protection from a PDF you own. Requires qpdf server-side.',
  keywords: 'pdf unlock remove password decrypt',
  how: 'Ownership gate: only run this on documents you are authorised to modify. pdf-lib can open some restricted files but cannot decrypt protected ones; qpdf --decrypt does it correctly, server-side.',
  render(w){
    let file = null;
    const dz = $.dz('Drop a PDF you own', fs => { file = fs[0]; dz.setNames([fs[0].name]); });
    const pw = el('input', { class: 'in', type: 'password', placeholder: 'current password' });
    const out = $.out();
    const go = async () => {
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('password', pw.value);
      try {
        const r = await fetch('/api/pdf/unlock', { method: 'POST', body: fd });
        if (!r.ok) throw new Error('endpoint returned ' + r.status);
        download(await r.blob(), 'unlocked.pdf');
        out.textContent = 'Password removed.';
      } catch (e) {
        out.textContent = `Endpoint not reachable (${e.message}).\n\nServer contract:  POST /api/pdf/unlock  multipart { file, password }  →  application/pdf\nImplementation: qpdf --decrypt --password="<pw>" in.pdf out.pdf`;
      }
    };
    w.append(dz.zone, $.label('Current password', pw), $.btn('Remove password', go, true), out);
  }
});

tool({
  id: 'pdf-scanner', cat: 'pdf', name: 'PDF Scanner',
  desc: 'Capture pages with the camera, straighten-free, assemble into one PDF.',
  keywords: 'scanner camera document pdf capture',
  render(w){
    const video = el('video', { autoplay: true, playsinline: true, style: { width: '100%', maxWidth: '420px', borderRadius: '8px', border: '1px solid var(--line)' } });
    const canvas = el('canvas', { hidden: true });
    const pages = [];
    const gallery = el('div', { class: 'thumbs' });
    const out = $.out();
    let stream = null;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } });
        video.srcObject = stream;
      } catch (e) { out.textContent = 'Camera unavailable: ' + e.message; }
    };
    const snap = () => {
      if (!video.videoWidth) return;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(blob => {
        pages.push(blob);
        const fig = el('figure', {}, el('img', { src: URL.createObjectURL(blob) }), el('figcaption', { text: `page ${pages.length}` }));
        gallery.append(fig);
        out.textContent = `${pages.length} page(s) captured`;
      }, 'image/jpeg', 0.92);
    };
    const build = async () => {
      if (!pages.length) { out.textContent = 'Capture at least one page.'; return; }
      const { jsPDF } = await lib('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      for (const [i, blob] of pages.entries()){
        const url = URL.createObjectURL(blob);
        const img = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = url; });
        if (i) doc.addPage();
        const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
        const m = 24;
        const s = Math.min((pw - m * 2) / img.width, (ph - m * 2) / img.height);
        doc.addImage(img, 'JPEG', (pw - img.width * s) / 2, (ph - img.height * s) / 2, img.width * s, img.height * s);
        URL.revokeObjectURL(url);
      }
      const outBlob = doc.output('blob');
      out.textContent = `${pages.length} page(s) · ${bytes(outBlob.size)}`;
      download(outBlob, 'scan.pdf');
    };
    const stop = () => stream?.getTracks().forEach(t => t.stop());
    w.addEventListener('uh:unmount', stop);
    w.append(video, $.row($.btn('Start camera', start, true), $.btn('Capture page', snap), $.btn('Stop', stop)), gallery,
      $.row($.btn('Build PDF', build, true), $.btn('Clear pages', () => { pages.length = 0; gallery.replaceChildren(); out.textContent = ''; })), out);
  }
});
})();
