const records = {
  type: { ref: '001', title: 'Type as structure', category: 'VISUAL / TYPOGRAPHY', image: '/type-study.svg', alt: 'Black letterforms arranged as an architectural composition on acid yellow', description: 'A letter is both a sign and a shape. This specimen arranges oversized forms into a compact structure, allowing negative space to become its own material.', question: 'How far can a letter be compressed before reading gives way to seeing?', process: 'Reduce the palette to two colors. Set an oversized grotesk form. Repeat, crop and shift its proportions while preserving a consistent underlying grid.' },
  field: { ref: '002', title: 'A field of signals', category: 'INTERACTIVE / GENERATIVE FORM', image: '/field-study.svg', alt: 'Concentric cobalt blue lines forming an optical sphere', description: 'A flat field of lines produces the suggestion of depth. Repetition becomes a visual signal, and the frame changes what that signal appears to be.', question: 'Can a two-dimensional rule produce a three-dimensional perception?', process: 'Construct an optical field from concentric lines. Vary density and crop. Move through the visual index to see how the image responds to position and frame.' },
  space: { ref: '003', title: 'Between planes', category: 'VISUAL / SPATIAL STUDY', image: '/space-study.svg', alt: 'Vermilion planes and black shadows in a geometric spatial study', description: 'Planes, intervals and shadows build a space without specifying its function. The composition sits between an architectural drawing and a graphic abstraction.', question: 'What is the smallest set of elements that can imply a space?', process: 'Begin with parallel planes. Introduce a single interruption. Use color for surfaces and black for shadow, then test the balance across different aspect ratios.' }
};
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const main = document.querySelector('#archive-content');
const routeIds = ['home', 'visual-journey', 'idea-presentation', 'working-log', 'project-title', 'feedback', 'about'];
const routeTitles = ['HOME', 'VISUAL JOURNEY', 'IDEA PRESENTATION', 'WORKING LOG', 'PROJECT TITLE', 'FEEDBACK', 'ABOUT'];
const cache = new Map();
let observer;
let navigating = false;
let queuedNavigation = null;
let activeRecord = 0;
let recordTrigger;
const dialog = document.querySelector('#record-dialog');
const recordKeys = Object.keys(records);
const noteKey = 'he-kaiyao-archive-feedback-v1';
function setActivePage(id) {
  document.body.dataset.page = id;
  main.classList.toggle('route-content', id !== 'home');
  document.querySelectorAll('#navigation a').forEach((link, index) => {
    const active = routeIds[index] === id;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}
function renderRecord(key) {
  const record = records[key]; activeRecord = recordKeys.indexOf(key);
  document.querySelector('#record-ref').textContent = `ARCHIVE RECORD / ${record.ref}`;
  document.querySelector('#record-title').textContent = record.title;
  document.querySelector('#record-category').textContent = record.category;
  document.querySelector('#record-description').textContent = record.description;
  document.querySelector('#record-question').textContent = record.question;
  document.querySelector('#record-process').textContent = record.process;
  const picture = document.querySelector('#record-image'); picture.src = record.image; picture.alt = record.alt;
  dialog.scrollTop = 0;
}
document.querySelector('#close-record').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
dialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); if (recordTrigger?.isConnected) recordTrigger.focus({ preventScroll: true }); });
document.querySelector('#next-record').addEventListener('click', () => renderRecord(recordKeys[(activeRecord + 1) % recordKeys.length]));
document.querySelector('#previous-record').addEventListener('click', () => renderRecord(recordKeys[(activeRecord + recordKeys.length - 1) % recordKeys.length]));
function initializePage() {
  const id = main.dataset.page;
  setActivePage(id);
  main.querySelectorAll('[data-letters]').forEach((line, lineIndex) => {
    line.replaceChildren(...[...line.dataset.letters].map((letter, index) => {
      const span = document.createElement('span'); span.className = 'letter'; span.textContent = letter;
      span.style.setProperty('--delay', `${lineIndex * 180 + index * 80 + 50}ms`); return span;
    }));
  });
  if ('IntersectionObserver' in window) {
    document.body.classList.add('motion-ready');
    observer?.disconnect();
    observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    }), { threshold: .08 });
    main.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  }
  main.querySelectorAll('[data-record]').forEach(button => button.addEventListener('click', () => {
    recordTrigger = button; renderRecord(button.dataset.record); dialog.showModal(); document.body.classList.add('modal-open');
  }));
  const width = main.querySelector('#type-width');
  if (width) {
    const applyWidth = () => { main.querySelector('#lab-word').style.transform = `scaleX(${Number(width.value) / 100})`; main.querySelector('#width-output').textContent = `${width.value}%`; };
    width.addEventListener('input', applyWidth);
    main.querySelector('#lab-reset').addEventListener('click', () => { width.value = '100'; applyWidth(); });
  }
  main.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    main.querySelectorAll('[data-filter]').forEach(filter => filter.setAttribute('aria-pressed', filter === button));
    let count = 0;
    main.querySelectorAll('.project-row').forEach(row => { row.hidden = button.dataset.filter !== 'all' && row.dataset.category !== button.dataset.filter; if (!row.hidden) count++; });
    main.querySelector('#filter-count').textContent = `SHOWING ${String(count).padStart(2, '0')} / ${String(main.querySelectorAll('.project-row').length).padStart(2, '0')} RECORDS`;
  }));
  const cropLab = main.querySelector('.crop-lab');
  if (cropLab) {
    const frame = cropLab.querySelector('.crop-window');
    const position = cropLab.querySelector('#crop-position');
    const output = cropLab.querySelector('#crop-position-output');
    const labels = { portrait: 'Portrait frame, 3:4.', square: 'Square frame, 1:1.', landscape: 'Landscape frame, 16:9.' };
    let drag = null;
    const setPosition = value => {
      const percent = Math.round(Math.max(0, Math.min(100, value)));
      position.value = String(percent); output.value = `${percent}%`;
      frame.style.setProperty('--crop-position', `${percent}%`);
      frame.style.setProperty('--crop-offset', `${(50 - percent) * .18}%`);
    };
    const setFrame = ratio => {
      frame.dataset.frame = ratio;
      cropLab.querySelectorAll('[data-ratio]').forEach(button => button.setAttribute('aria-pressed', button.dataset.ratio === ratio));
      cropLab.querySelector('#crop-status').textContent = labels[ratio];
    };
    position.addEventListener('input', () => setPosition(Number(position.value)));
    cropLab.querySelectorAll('[data-ratio]').forEach(button => button.addEventListener('click', () => setFrame(button.dataset.ratio)));
    cropLab.querySelector('#crop-reset').addEventListener('click', () => { setFrame('portrait'); setPosition(50); });
    frame.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, position: Number(position.value), width: frame.getBoundingClientRect().width };
      frame.setPointerCapture(event.pointerId); frame.classList.add('is-dragging');
    });
    frame.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      setPosition(drag.position - (event.clientX - drag.x) / drag.width * 100);
    });
    const endDrag = () => { drag = null; frame.classList.remove('is-dragging'); };
    frame.addEventListener('pointerup', endDrag); frame.addEventListener('pointercancel', endDrag); frame.addEventListener('lostpointercapture', endDrag);
    setFrame('portrait'); setPosition(50);
  }
  const form = main.querySelector('#note-form');
  if (form) {
    const savedNote = main.querySelector('#saved-note');
    const status = main.querySelector('#note-status');
    const showNote = note => { savedNote.hidden = !note; if (note) savedNote.querySelector('p').textContent = `${note.name || 'A fellow observer'} — ${note.text}`; };
    try { const value = localStorage.getItem(noteKey); if (value) { const note = JSON.parse(value); if (typeof note.text === 'string') showNote(note); } } catch {}
    form.addEventListener('submit', event => {
      event.preventDefault();
      const text = main.querySelector('#note-text').value.trim();
      if (!text) { status.textContent = 'Please write feedback before saving.'; main.querySelector('#note-text').focus(); return; }
      const note = { name: main.querySelector('#note-name').value.trim(), text };
      try { localStorage.setItem(noteKey, JSON.stringify(note)); showNote(note); status.textContent = 'FEEDBACK SAVED IN THIS BROWSER.'; }
      catch { showNote(note); status.textContent = 'STORAGE IS UNAVAILABLE. VISIBLE UNTIL YOU LEAVE.'; }
    });
    main.querySelector('#delete-note').addEventListener('click', () => { try { localStorage.removeItem(noteKey); } catch {} showNote(null); status.textContent = 'FEEDBACK DELETED.'; });
  }
  updateScroll();
}
let scrollScheduled = false;
function updateScroll() {
  const maximum = document.documentElement.scrollHeight - innerHeight;
  document.querySelector('.progress').style.width = `${maximum > 0 ? scrollY / maximum * 100 : 0}%`;
  document.documentElement.style.setProperty('--grid-opacity', Math.min(.25, scrollY / Math.max(innerHeight, 1) * .15));
  if (!motionPreference.matches) main.querySelectorAll('.preview-image,.visual-frame').forEach(frame => {
    const position = frame.getBoundingClientRect();
    if (position.bottom > 0 && position.top < innerHeight) {
      const t = Math.max(0, Math.min(1, (innerHeight - position.top) / (innerHeight + position.height)));
      frame.style.setProperty('--image-scale', 1.09 - t * .09);
      frame.style.setProperty('--image-shift', `${(t - .5) * 12}px`);
      if (frame.classList.contains('visual-frame')) frame.querySelector('img').style.transform = `scale(${1.09 - t * .09}) translateY(${(t - .5) * 12}px)`;
    }
  });
  scrollScheduled = false;
}
addEventListener('scroll', () => { if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(updateScroll); } }, { passive: true });
addEventListener('resize', updateScroll);
function routeId(url) { return url.pathname.replace(/^\/+|\/+$/g, '') || 'home'; }
const offline = Boolean(window.ARCHIVE_OFFLINE_PAGES);
async function loadPage(id) {
  if (offline) return { content: window.ARCHIVE_OFFLINE_PAGES[id], title: id === 'home' ? 'He Kaiyao — Digital Archive' : `${routeTitles[routeIds.indexOf(id)]} — He Kaiyao` };
  if (!cache.has(id)) {
    const source = id === 'home' ? '/index.html' : `/${id}/index.html`;
    cache.set(id, fetch(source).then(async response => {
      if (!response.ok) throw new Error('Archive page unavailable');
      const document = new DOMParser().parseFromString(await response.text(), 'text/html');
      const content = document.querySelector('#archive-content');
      if (content?.dataset.page !== id) throw new Error('Unexpected archive page');
      return { content: content.innerHTML, title: document.title };
    }).catch(error => { cache.delete(id); throw error; }));
  }
  return cache.get(id);
}
async function navigate(id, { push = true, scroll = 0, trigger = null } = {}) {
  if (!routeIds.includes(id)) return;
  if (navigating) { queuedNavigation = { id, options: { push, scroll, trigger } }; return; }
  if (id === main.dataset.page && push) { window.scrollTo({ top: 0, behavior: motionPreference.matches ? 'instant' : 'smooth' }); return; }
  navigating = true;
  try {
    const page = await loadPage(id);
    if (dialog.open) dialog.close();
    const selectedImage = trigger?.closest('.preview-entry')?.querySelector('img');
    if (selectedImage) selectedImage.style.viewTransitionName = 'archive-figure';
    const update = () => {
      main.innerHTML = page.content; main.dataset.page = id; document.title = page.title;
      initializePage();
      if (selectedImage) { const image = main.querySelector('img'); if (image) image.style.viewTransitionName = 'archive-figure'; }
      if (push) {
        const url = offline ? `#/${id === 'home' ? '' : id}` : id === 'home' ? '/' : `/${id}`;
        history.pushState({ archive: id, scroll: 0 }, '', url);
      }
      window.scrollTo({ top: scroll, behavior: 'instant' });
      const title = main.querySelector('h1') || main; title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true });
      updateScroll();
    };
    if (!motionPreference.matches && document.startViewTransition) {
      const transition = document.startViewTransition(update);
      await transition.finished.catch(() => {});
    } else if (!motionPreference.matches && main.animate) {
      await main.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished;
      update();
      main.getAnimations().forEach(animation => animation.cancel());
      await main.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' }).finished;
    } else update();
    main.querySelectorAll('[style*="view-transition-name"]').forEach(element => element.style.removeProperty('view-transition-name'));
  } catch {
    if (!offline) location.assign(id === 'home' ? '/' : `/${id}`);
  } finally {
    navigating = false;
    if (queuedNavigation) { const queued = queuedNavigation; queuedNavigation = null; navigate(queued.id, queued.options); }
  }
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-route]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.getAttribute('href'), location.href);
  const id = offline ? (link.getAttribute('href').replace(/^\/+|\/+$/g, '') || 'home') : routeId(url);
  if (!routeIds.includes(id) || (!offline && url.origin !== location.origin)) return;
  event.preventDefault();
  if (history.state?.archive) history.replaceState({ ...history.state, scroll: scrollY }, '');
  navigate(id, { trigger: link });
});
history.scrollRestoration = 'manual';
initializePage();
history.replaceState({ archive: main.dataset.page, scroll: scrollY }, '');
addEventListener('popstate', event => {
  const id = offline ? (location.hash.replace(/^#\/?/, '') || 'home') : routeId(new URL(location.href));
  navigate(id, { push: false, scroll: event.state?.scroll || 0 });
});
if (offline && location.hash) {
  const id = location.hash.replace(/^#\/?/, '') || 'home';
  if (routeIds.includes(id) && id !== main.dataset.page) navigate(id, { push: false });
}

/* Decorative ASCII infrastructure. Approved copy and layout stay untouched. */
(() => {
  const content = document.querySelector('#archive-content');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let cancelScene = () => {};
  const decoration = (className, text = '', tag = 'span') => {
    const node = document.createElement(tag);
    node.className = className; node.dataset.ascii = ''; node.setAttribute('aria-hidden', 'true');
    node.textContent = text; return node;
  };
  function drawField(time) {
    const width = 37, height = 25, rows = [];
    const palette = ' .,:;+=xX#';
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        const dx = (x - 18) / 16, dy = (y - 12) / 11;
        const radius = dx * dx + dy * dy;
        let glyph = ' ';
        if (radius < .78) {
          const depth = Math.sqrt(.78 - radius);
          const signal = Math.sin(dx * 14 + depth * 5 + time) * Math.cos(dy * 10 - time * .3);
          const light = .36 + depth * .47 - dx * .17 + signal * .13;
          glyph = palette[Math.max(1, Math.min(palette.length - 1, Math.floor(light * palette.length)))];
          if (Math.abs(signal) < .075) glyph = ':';
        } else if (y === 12 && (x < 4 || x > 32)) glyph = '-';
        else if (x === 18 && (y < 2 || y > 22)) glyph = '|';
        if ((x === 0 || x === width - 1) && (y === 0 || y === height - 1)) glyph = '+';
        row += glyph;
      }
      rows.push(row);
    }
    return rows.join('\n');
  }
  function installScene(hero) {
    const field = decoration('ascii-field', drawField(0), 'pre');
    hero.append(field);
    let timer = 0, visible = false, step = 0;
    const stop = () => { clearTimeout(timer); timer = 0; };
    const tick = () => {
      if (!visible || preference.matches || document.hidden || !field.isConnected) { stop(); return; }
      field.textContent = drawField(++step * .025);
      timer = setTimeout(tick, 220);
    };
    const resume = () => { stop(); if (visible && !preference.matches && !document.hidden) timer = setTimeout(tick, 220); };
    const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; resume(); });
    visibility.observe(field);
    document.addEventListener('visibilitychange', resume);
    preference.addEventListener('change', resume);
    cancelScene = () => { stop(); visibility.disconnect(); document.removeEventListener('visibilitychange', resume); preference.removeEventListener('change', resume); };
  }
  function apply() {
    cancelScene(); cancelScene = () => {};
    const hero = content.querySelector('.archive-cover');
    if (hero && !hero.querySelector('[data-ascii]')) {
      const ruler = decoration('ascii-cover-ruler');
      ['00', '02', '08', '12'].forEach((coordinate, index) => {
        const mark = document.createElement('span'); mark.textContent = `+ [${coordinate}:00]`;
        mark.style.setProperty('--ascii-column', [0, 16.666, 66.666, 100][index] + '%'); ruler.append(mark);
      });
      hero.append(ruler);
      if ('IntersectionObserver' in window) installScene(hero);
      else hero.append(decoration('ascii-field', drawField(0), 'pre'));
    }
    content.querySelectorAll('.section-bar,.crop-lab-bar').forEach((bar, index) => {
      if (bar.querySelector('[data-ascii]')) return;
      const position = String(index + 1).padStart(2, '0');
      const register = decoration('ascii-register');
      ['+ [' + position + ':00]', '+', '[' + position + ':12] +'].forEach(text => {
        const marker = document.createElement('span'); marker.textContent = text; register.append(marker);
      });
      bar.append(register);
    });
    content.querySelectorAll('.visual-frame,.crop-window,.inspiration-poster,.inspiration-still,.world-origin-image,.faith-figure,.boy-story-image').forEach(frame => {
      if (frame.querySelector('[data-ascii]')) return;
      const corners = decoration('ascii-image-register');
      ['+--','--+','|','|','+--','--+'].forEach((glyph, index) => {
        const marker = document.createElement('span'); marker.className = `ascii-corner ascii-corner-${index}`; marker.textContent = glyph; corners.append(marker);
      });
      frame.append(corners);
    });
    content.querySelectorAll('.lab-stage').forEach(stage => {
      if (stage.querySelector('[data-ascii]')) return;
      stage.append(decoration('ascii-type-axis', '+ : : : : : : : : : : : : : : : : : : : : : : +'));
    });
  }
  apply();
  const pageObserver = new MutationObserver(apply);
  pageObserver.observe(content, { attributes: true, attributeFilter: ['data-page'] });
})();


/* ASCII water follows the tower's footprint and the available character grid. */
(() => {
  const main = document.querySelector('#archive-content');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let dispose = () => {};
  function install() {
    dispose(); dispose = () => {};
    const sea = main.querySelector('.tower-sea');
    if (!sea) return;
    const text = sea.querySelector('.ascii-sea');
    const tower = main.querySelector('.babel-ascii');
    let visible = false, timer = 0, phase = 0;
    const stop = () => { clearTimeout(timer); timer = 0; };
    const draw = () => {
      const area = sea.getBoundingClientRect(), footprint = tower.getBoundingClientRect();
      const style = getComputedStyle(text);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d'); context.font = `${style.fontSize} ${style.fontFamily}`;
      const cell = context.measureText('0').width, line = parseFloat(style.lineHeight);
      const columns = Math.max(45, Math.floor(area.width / cell));
      const rows = Math.max(12, Math.floor(area.height / line));
      const left = (footprint.left - area.left) / cell, right = (footprint.right - area.left) / cell;
      const base = (footprint.bottom - area.top) / line;
      const lines = [];
      for (let y = 0; y < rows; y++) {
        let row = '';
        const depth = y / Math.max(rows - 1, 1);
        for (let x = 0; x < columns; x++) {
          if (y < base + .4 && x > left - 1 && x < right + 1) { row += ' '; continue; }
          const bend = Math.sin(x * .065 + phase) * (1 + depth * 1.5);
          const crest = Math.sin(y * 1.12 + bend + phase * .55);
          const flow = Math.sin(x * .19 - y * .31 - phase * .8) + Math.cos(x * .038 + y * .24 + phase);
          let glyph = ' ';
          if (Math.abs(crest) < .22 + depth * .14) glyph = flow > .55 ? '~' : flow < -.5 ? '_' : '-';
          else if (Math.abs(crest) < .35 + depth * .2) glyph = flow > 0 ? ':' : '.';
          else if (flow > 1.25 && depth > .35) glyph = ',';
          if (y < 2 && glyph !== ' ') glyph = '.';
          row += glyph;
        }
        lines.push(row);
      }
      text.textContent = lines.join('\n');
    };
    const tick = () => {
      if (!visible || preference.matches || document.hidden || !sea.isConnected) { stop(); return; }
      phase += .045; draw(); timer = setTimeout(tick, 240);
    };
    const resume = () => { stop(); draw(); if (visible && !preference.matches && !document.hidden) timer = setTimeout(tick, 240); };
    const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; resume(); });
    visibility.observe(sea);
    const size = new ResizeObserver(resume); size.observe(sea);
    document.addEventListener('visibilitychange', resume); preference.addEventListener('change', resume);
    draw();
    dispose = () => { stop(); visibility.disconnect(); size.disconnect(); document.removeEventListener('visibilitychange', resume); preference.removeEventListener('change', resume); };
  }
  install();
  new MutationObserver(install).observe(main, { attributes: true, attributeFilter: ['data-page'] });
})();
