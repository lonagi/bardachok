'use strict';
(() => {
  const data = window.GUIDE_DATA;
  if (!data?.chapters?.length) return; // Complete static HTML remains usable.
  const root = document.documentElement;
  const chapters = [...document.querySelectorAll('.chapter')];
  const chapterIds = new Set(data.chapters.map(c => c.id));
  const picker = document.getElementById('chapter-select');
  const dialog = document.getElementById('search-dialog');
  const searchInput = document.getElementById('guide-search');
  const results = document.getElementById('search-results');
  const searchStatus = document.getElementById('search-status');
  const prefersDark = matchMedia('(prefers-color-scheme: dark)');
  let highlighted = null;
  let activeChapter = 'ownership';
  let previousFocus = null;
  let searchNavigating = false;
  let storageAvailable = true;

  const readStorage = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch (_) { return fallback; }
  };
  const store = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  };

  function setupCarKit({ readStorage, store } = {}) {
    const section = document.getElementById('car-kit');
    if (!section) return null;

    const storageKey = 'bardachok-car-kit-v1';
    const rows = new Map(
      [...section.querySelectorAll('.kit-item')].map(row => [row.id, row])
    );
    const entries = [...section.querySelectorAll('input[data-kit-check]')]
      .filter(input => input.value && input.type === 'checkbox')
      .map(input => ({
        input,
        id: input.value,
        row: rows.get(`kit-item-${input.value}`) || null,
        group: input.closest('details[data-kit-group]')
      }));
    const knownIds = new Set(entries.map(entry => entry.id));
    const entryById = new Map(entries.map(entry => [entry.id, entry]));
    const groups = [...section.querySelectorAll('details[data-kit-group]')]
      .map(detail => ({
        detail,
        entries: entries.filter(entry => entry.group === detail),
        count: [...detail.querySelectorAll('[data-kit-group-count]')]
          .find(element => element.closest('details[data-kit-group]') === detail),
        empty: [...detail.querySelectorAll('.kit-group-empty')]
          .find(element => element.closest('details[data-kit-group]') === detail)
      }));
    const count = section.querySelector('#kit-count');
    const hideDone = section.querySelector('#kit-hide-done');
    const reset = section.querySelector('#kit-reset');
    const storageNotes = [...section.querySelectorAll('.kit-storage-note')];
    let saveFailed = false;
    let saved = [];
    try {
      saved = typeof readStorage === 'function' ? readStorage(storageKey, []) : [];
    } catch (_) {
      // A malformed value or unavailable storage must not stop the original site.
    }
    const selectedIds = new Set(
      (Array.isArray(saved) ? saved : [])
        .filter(id => typeof id === 'string' && knownIds.has(id))
    );

    function update(persist = true) {
      const selected = [...new Set(entries.filter(entry => entry.input.checked).map(entry => entry.id))];
      if (count) count.textContent = String(selected.length);
      if (reset) reset.disabled = selected.length === 0;

      const filtering = Boolean(hideDone?.checked);
      entries.forEach(entry => {
        if (entry.row) entry.row.hidden = filtering && entry.input.checked;
      });
      groups.forEach(group => {
        const completed = group.entries.filter(entry => entry.input.checked).length;
        if (group.count) group.count.textContent = `${completed} из ${group.entries.length}`;
        if (group.empty) {
          group.empty.hidden = !(filtering && group.entries.length > 0 && completed === group.entries.length);
        }
        // Keep the details element and its summary visible, including fully checked groups.
      });

      if (persist) {
        try {
          saveFailed = typeof store !== 'function' || store(storageKey, selected) !== true;
        } catch (_) {
          saveFailed = true;
        }
      }
      const message = saveFailed
        ? 'Не удалось сохранить изменения. Текущие отметки действуют до обновления страницы.'
        : 'Отметки сохраняются в этом браузере.';
      storageNotes.forEach(note => { note.textContent = message; });
    }

    entries.forEach(entry => {
      entry.input.checked = selectedIds.has(entry.id);
      entry.input.addEventListener('change', () => update());
    });
    hideDone?.addEventListener('change', () => update(false));
    reset?.addEventListener('click', event => {
      event.preventDefault();
      entries.forEach(entry => { entry.input.checked = false; });
      update();
    });
    document.querySelectorAll('button[data-print-kit]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        document.documentElement.classList.add('print-kit-only');
        try {
          window.print();
        } catch (_) {
          document.documentElement.classList.remove('print-kit-only');
        }
        // The site's existing afterprint handler removes the class and restores details.
      });
    });

    // Loading, filtering and revealing never overwrite saved state or probe storage.
    update(false);

    return {
      reveal(id) {
        if (typeof id !== 'string') return false;
        const entry = entryById.get(id);
        if (!entry) return false;
        if (hideDone?.checked && entry.input.checked) {
          hideDone.checked = false;
          update(false);
        }
        let detail = entry.group;
        while (detail && section.contains(detail)) {
          detail.open = true;
          detail = detail.parentElement?.closest('details[data-kit-group]') || null;
        }
        (entry.row || entry.input).scrollIntoView({ block: 'center', behavior: 'auto' });
        entry.input.focus({ preventScroll: true });
        return true;
      }
    };
  }

  const carKit = setupCarKit({ readStorage, store });

  function setChapter(id, { scroll = true, updateURL = true, focus = false, noteId = null } = {}) {
    if (!chapterIds.has(id)) return;
    activeChapter = id;
    chapters.forEach(el => { el.hidden = el.id !== id; });
    document.querySelectorAll('.chapter-link').forEach(link => {
      if (link.dataset.chapter === id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    picker.value = id;
    if (updateURL && location.hash !== '#' + id) history.pushState({ bardachokChapter: id }, '', '#' + id);
    if (highlighted) highlighted.classList.remove('is-highlighted');
    highlighted = noteId ? document.getElementById(noteId) : null;
    if (highlighted) highlighted.classList.add('is-highlighted');
    if (scroll) requestAnimationFrame(() => {
      const target = highlighted || document.getElementById('guide');
      target.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
    if (focus) document.getElementById('title-' + id).focus({ preventScroll: true });
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-chapter]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setChapter(link.dataset.chapter, { focus: true });
  });
  picker.addEventListener('change', () => setChapter(picker.value, { focus: true }));
  window.addEventListener('hashchange', () => {
    const hash = location.hash.slice(1);
    const id = chapterIds.has(hash) ? hash : (history.state?.bardachokChapter || activeChapter);
    setChapter(id, { updateURL: false, scroll: chapterIds.has(hash) });
    history.replaceState({ bardachokChapter: id }, '', location.href);
  });
  root.classList.add('enhanced');
  const startingChapter = location.hash.slice(1);
  setChapter(chapterIds.has(startingChapter) ? startingChapter : activeChapter, { scroll: false, updateURL: false });
  history.replaceState({ bardachokChapter: activeChapter }, '', location.href);
  if (chapterIds.has(startingChapter)) requestAnimationFrame(() => document.getElementById('guide').scrollIntoView({ behavior: 'instant' }));

  // Search uses text nodes, including highlights. User input never becomes HTML.
  const normalize = s => s.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
  const index = data.chapters.flatMap(chapter => chapter.groups.flatMap(group => group.items.map(item => ({
    ...item, chapter: chapter.id, chapterTitle: chapter.shortTitle,
    searchable: normalize([item.text, chapter.title, chapter.shortTitle, group.title].join(' '))
  })))).concat((data.carKit?.groups || []).flatMap(group => group.items.map(item => ({
    ...item, kind: 'kit', text: `${item.title}. ${item.detail}`, chapterTitle: `В машине · ${group.title}`,
    searchable: normalize([item.title, item.detail, item.location, group.title, 'памятка в машине'].join(' '))
  }))));

  function highlightedText(text, terms) {
    const fragment = document.createDocumentFragment();
    const lower = normalize(text);
    const ranges = [];
    terms.forEach(term => {
      let from = 0, pos;
      while ((pos = lower.indexOf(term, from)) !== -1) { ranges.push([pos, pos + term.length]); from = pos + term.length; }
    });
    ranges.sort((a,b) => a[0] - b[0]);
    let cursor = 0;
    ranges.forEach(([start, end]) => {
      if (start < cursor) return;
      fragment.append(document.createTextNode(text.slice(cursor, start)));
      const mark = document.createElement('mark');
      mark.textContent = text.slice(start, end);
      fragment.append(mark);
      cursor = end;
    });
    fragment.append(document.createTextNode(text.slice(cursor)));
    return fragment;
  }

  function renderSearch() {
    const query = normalize(searchInput.value.slice(0, 120));
    results.replaceChildren();
    if (!query) {
      searchStatus.textContent = 'Начни вводить слово или выбери тему.';
      const suggestions = document.createElement('div');
      suggestions.className = 'search-suggestions';
      ['Шины', 'Тормоза', 'Масло', 'Зима', 'Аптечка', 'Багажник'].forEach(term => {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = term;
        button.addEventListener('click', () => { searchInput.value = term; renderSearch(); searchInput.focus(); });
        suggestions.append(button);
      });
      results.append(suggestions);
      return;
    }
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = index.filter(item => terms.every(term => item.searchable.includes(term)));
    searchStatus.textContent = matches.length ? `Найдено: ${matches.length}${matches.length > 30 ? '. Показаны первые 30' : ''}` : 'Ничего не найдено';
    if (!matches.length) {
      const p = document.createElement('p'); p.className = 'search-empty';
      p.textContent = 'Попробуй другое слово или более короткий запрос. Например, «тормоз» вместо «тормозная система».';
      results.append(p); return;
    }
    matches.slice(0, 30).forEach(item => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'search-result';
      const label = document.createElement('span'); label.className = 'search-result-label'; label.textContent = item.chapterTitle;
      const text = document.createElement('p'); text.append(highlightedText(item.text, terms));
      button.append(label, text);
      button.addEventListener('click', () => {
        searchNavigating = true;
        dialog.close();
        if (item.kind === 'kit') {
          history.pushState({ bardachokChapter: activeChapter }, '', '#car-kit');
          carKit?.reveal(item.id);
        } else setChapter(item.chapter, { noteId: item.id, focus: true });
      });
      results.append(button);
    });
  }

  function openSearch() {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    dialog.showModal(); document.body.classList.add('modal-open'); renderSearch(); searchInput.focus();
  }
  document.querySelectorAll('[data-open-search]').forEach(button => button.addEventListener('click', openSearch));
  document.querySelector('[data-close-search]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    if (!searchNavigating) previousFocus?.focus({ preventScroll: true });
    searchNavigating = false;
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  searchInput.addEventListener('input', renderSearch);
  document.addEventListener('keydown', event => {
    const editing = event.target.matches('input,textarea,select,[contenteditable="true"]');
    if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') || (event.key === '/' && !editing)) {
      event.preventDefault(); openSearch();
    }
  });

  // Checklist states and the chosen color theme stay in this browser.
  const saved = readStorage('bardachok-checks', []);
  const checked = new Set(Array.isArray(saved) ? saved : []);
  const checkboxes = [...document.querySelectorAll('[data-check]')];
  const resetButton = document.getElementById('reset-checklist');
  function updateChecks(persist = true) {
    const selected = checkboxes.filter(input => input.checked).map(input => input.dataset.check);
    document.getElementById('check-count').textContent = selected.length;
    resetButton.disabled = selected.length === 0;
    if (persist) storageAvailable = store('bardachok-checks', selected);
    document.querySelector('.storage-note').textContent = storageAvailable ? 'Отметки сохраняются в этом браузере.' : 'Сохранение недоступно. Отметки действуют до закрытия страницы.';
  }
  checkboxes.forEach(input => {
    input.checked = checked.has(input.dataset.check);
    input.addEventListener('change', () => updateChecks());
  });
  resetButton.addEventListener('click', () => { checkboxes.forEach(input => { input.checked = false; }); updateChecks(); });
  updateChecks(false);
  document.querySelector('.print-button').addEventListener('click', () => window.print());
  const printDetails = [...document.querySelectorAll('.safety-note, .kit-group')];
  let printOpenState = [];
  window.addEventListener('beforeprint', () => {
    printOpenState = printDetails.map(detail => detail.open);
    printDetails.forEach(detail => { detail.open = true; });
  });
  window.addEventListener('afterprint', () => {
    printDetails.forEach((detail, index) => { detail.open = printOpenState[index] ?? false; });
    root.classList.remove('print-kit-only');
  });

  const themeButton = document.querySelector('.theme-button');
  function updateThemeButton() {
    const next = root.dataset.theme === 'dark' ? 'светлую' : 'тёмную';
    themeButton.setAttribute('aria-label', `Включить ${next} тему`);
    themeButton.title = `Включить ${next} тему`;
    document.querySelector('meta[name="theme-color"]').content = root.dataset.theme === 'dark' ? '#191c19' : '#f5f5f2';
  }
  themeButton.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('bardachok-theme', root.dataset.theme); } catch (_) {}
    updateThemeButton();
  });
  prefersDark.addEventListener('change', event => {
    let preference = null;
    try { preference = localStorage.getItem('bardachok-theme'); } catch (_) {}
    if (!preference) { root.dataset.theme = event.matches ? 'dark' : 'light'; updateThemeButton(); }
  });
  updateThemeButton();
})();
