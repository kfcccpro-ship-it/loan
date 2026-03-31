const QUICK_KEYWORDS = ['한정승인', '특별승인', '담보대출', '동일인'];
const storage = {
  recent: 'mg_recent_searches_v2',
  bookmark: 'mg_bookmarks_v2',
  fontSize: 'mg_search_fontsize_v2',
};

const state = {
  data: null,
  articles: [],
  searchQuery: '',
  currentPane: 'search',
  currentArticleId: null,
  selectedParts: new Set(),
  selectedChapters: new Set(),
  granularity: 'article',
  afterOx: 'ox_review',
  currentQuizType: 'ox',
  currentQuizIndex: 0,
  currentQuizPool: [],
  historyReady: false,
  ignoreNextPop: false,
};

const els = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindEvents();
  applyFontSize(loadJson(storage.fontSize, 'normal'));
  setupHistory();
  renderQuickRecent();

  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('data.json fetch failed');
    state.data = await response.json();
    state.articles = state.data.articles.filter(a => !a.supplementary);
    state.quizArticles = state.articles.filter(isQuizArticleUsable);
    renderSearchResults(state.articles.slice(0, 30), `전체 조문 ${state.articles.length}건`);
    renderToc();
    renderBookmarks();
    renderSelectors();
    updateScopeSummary();
    els.loading.classList.add('hidden');
    els.homeView.classList.remove('hidden');
    showView('home', { pushHistory: false });
    replaceInitialHistory();
  } catch (error) {
    els.loading.innerHTML = '<div>데이터를 불러오지 못했습니다.<br>data.json 파일을 확인해 주세요.</div>';
    console.error(error);
  }
}

function cacheElements() {
  Object.assign(els, {
    loading: document.getElementById('loading'),
    homeView: document.getElementById('homeView'),
    searchView: document.getElementById('searchView'),
    quizView: document.getElementById('quizView'),
    goSearch: document.getElementById('goSearch'),
    goQuiz: document.getElementById('goQuiz'),
    searchBackBtn: document.getElementById('searchBackBtn'),
    quizBackBtn: document.getElementById('quizBackBtn'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    recentSection: document.getElementById('recentSection'),
    resultInfo: document.getElementById('resultInfo'),
    searchResults: document.getElementById('searchResults'),
    tocList: document.getElementById('tocList'),
    bookmarkList: document.getElementById('bookmarkList'),
    navBtns: [...document.querySelectorAll('.nbtn')],
    panes: {
      search: document.getElementById('pane-search'),
      toc: document.getElementById('pane-toc'),
      bookmark: document.getElementById('pane-bookmark'),
    },
    articleModal: document.getElementById('articleModal'),
    articleBadges: document.getElementById('articleBadges'),
    articleTitle: document.getElementById('articleTitle'),
    articleBody: document.getElementById('articleBody'),
    closeArticleModal: document.getElementById('closeArticleModal'),
    bookmarkToggleBtn: document.getElementById('bookmarkToggleBtn'),
    settingsModal: document.getElementById('settingsModal'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    fsBtns: [...document.querySelectorAll('.fs-btn')],
    granularityButtons: [...document.querySelectorAll('#granularityButtons .seg-btn')],
    afterOxButtons: [...document.querySelectorAll('#afterOxButtons .seg-btn')],
    togglePartSelector: document.getElementById('togglePartSelector'),
    toggleChapterSelector: document.getElementById('toggleChapterSelector'),
    partSelector: document.getElementById('partSelector'),
    chapterSelector: document.getElementById('chapterSelector'),
    scopeSummary: document.getElementById('scopeSummary'),
    scopeCount: document.getElementById('scopeCount'),
    startQuizBtn: document.getElementById('startQuizBtn'),
    startDirectMcqBtn: document.getElementById('startDirectMcqBtn'),
    quizStartActions: document.getElementById('quizStartActions'),
    restartOxBtn: document.getElementById('restartOxBtn'),
    startMcqBtn: document.getElementById('startMcqBtn'),
    quizArea: document.getElementById('quizArea'),
  });
}

function bindEvents() {
  els.goSearch.addEventListener('click', () => showView('search'));
  els.goQuiz.addEventListener('click', () => showView('quiz'));
  els.searchBackBtn.addEventListener('click', () => goBackInsideApp('home'));
  els.quizBackBtn.addEventListener('click', () => goBackInsideApp('home'));

  els.searchInput.addEventListener('input', handleSearchInput);
  els.searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      if (els.searchInput.value.trim()) addRecent(els.searchInput.value.trim());
      runSearch();
      els.searchInput.blur();
    }
  });
  els.clearSearchBtn.addEventListener('click', clearSearch);

  els.navBtns.forEach(btn => btn.addEventListener('click', () => switchSearchPane(btn.dataset.pane)));

  els.closeArticleModal.addEventListener('click', () => closeArticleModal({ pushHistory: true }));
  els.articleModal.addEventListener('click', event => {
    if (event.target === els.articleModal) closeArticleModal({ pushHistory: true });
  });
  els.bookmarkToggleBtn.addEventListener('click', toggleCurrentBookmark);

  els.openSettingsBtn.addEventListener('click', () => { els.settingsModal.classList.remove('hidden'); pushAppState(); });
  els.closeSettingsBtn.addEventListener('click', () => { els.settingsModal.classList.add('hidden'); pushAppState(); });
  els.fsBtns.forEach(btn => btn.addEventListener('click', () => {
    els.fsBtns.forEach(node => node.classList.toggle('active', node === btn));
    applyFontSize(btn.dataset.fontsize);
    saveJson(storage.fontSize, btn.dataset.fontsize);
  }));

  els.granularityButtons.forEach(btn => btn.addEventListener('click', () => {
    state.granularity = btn.dataset.granularity;
    els.granularityButtons.forEach(node => node.classList.toggle('active', node === btn));
    syncGranularitySelectors();
  }));
  els.afterOxButtons.forEach(btn => btn.addEventListener('click', () => {
    state.afterOx = btn.dataset.after;
    renderAfterOxChoices();
  }));
  els.togglePartSelector.addEventListener('click', () => toggleSelector(els.partSelector, els.togglePartSelector));
  els.toggleChapterSelector.addEventListener('click', () => toggleSelector(els.chapterSelector, els.toggleChapterSelector));
  els.startQuizBtn.addEventListener('click', () => startQuiz('ox'));
  els.startDirectMcqBtn.addEventListener('click', () => startQuiz('mcq'));
  els.restartOxBtn.addEventListener('click', () => startQuiz('ox'));
  els.startMcqBtn.addEventListener('click', () => startQuiz('mcq'));
}

function showView(name, options = {}) {
  const { pushHistory = true } = options;
  els.homeView.classList.toggle('hidden', name !== 'home');
  els.searchView.classList.toggle('hidden', name !== 'search');
  els.quizView.classList.toggle('hidden', name !== 'quiz');
  state.currentView = name;
  if (name === 'search') switchSearchPane(state.currentPane, { pushHistory: false });
  if (name === 'quiz') updateScopeSummary();
  if (pushHistory) pushAppState();
}

function switchSearchPane(pane, options = {}) {
  const { pushHistory = true } = options;
  state.currentPane = pane;
  Object.entries(els.panes).forEach(([name, node]) => node.classList.toggle('hidden', name !== pane));
  els.navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.pane === pane));
  if (pane === 'toc') renderToc();
  if (pane === 'bookmark') renderBookmarks();
  if (pushHistory && state.currentView === 'search') pushAppState();
  window.scrollTo(0, 0);
}

function handleSearchInput() {
  const value = els.searchInput.value.trim();
  els.clearSearchBtn.classList.toggle('show', value.length > 0);
  runSearch();
}

function clearSearch() {
  els.searchInput.value = '';
  els.clearSearchBtn.classList.remove('show');
  state.searchQuery = '';
  renderQuickRecent();
  renderSearchResults(state.articles.slice(0, 30), `전체 조문 ${state.articles.length}건`);
}

function renderQuickRecent() {
  const recent = loadJson(storage.recent, []);
  if (state.searchQuery) {
    els.recentSection.innerHTML = '';
    return;
  }
  const chips = recent.length
    ? recent.map(word => `<span class="chip" data-recent="${escapeHtml(word)}">${escapeHtml(word)}<span class="chip-x" data-remove-recent="${escapeHtml(word)}">✕</span></span>`).join('')
    : QUICK_KEYWORDS.map(word => `<span class="chip" data-quick="${escapeHtml(word)}">${escapeHtml(word)}</span>`).join('');

  els.recentSection.innerHTML = `
    <div class="rlbl">
      <span>${recent.length ? '최근 검색어' : '추천 키워드'}</span>
      ${recent.length ? '<button class="rdel" id="clearRecentBtn">전체 삭제</button>' : ''}
    </div>
    <div class="chips">${chips}</div>`;

  els.recentSection.querySelectorAll('[data-recent], [data-quick]').forEach(node => {
    node.addEventListener('click', event => {
      if (event.target.dataset.removeRecent) return;
      const keyword = node.dataset.recent || node.dataset.quick;
      els.searchInput.value = keyword;
      els.clearSearchBtn.classList.add('show');
      addRecent(keyword);
      runSearch();
    });
  });
  els.recentSection.querySelectorAll('[data-remove-recent]').forEach(node => {
    node.addEventListener('click', event => {
      event.stopPropagation();
      removeRecent(node.dataset.removeRecent);
      renderQuickRecent();
    });
  });
  const clearRecentBtn = document.getElementById('clearRecentBtn');
  if (clearRecentBtn) clearRecentBtn.addEventListener('click', () => {
    saveJson(storage.recent, []);
    renderQuickRecent();
  });
}

function runSearch() {
  const query = els.searchInput.value.trim();
  state.searchQuery = query;
  renderQuickRecent();
  if (!query) {
    renderSearchResults(state.articles.slice(0, 30), `전체 조문 ${state.articles.length}건`);
    return;
  }
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = state.articles.filter(article => keywords.every(word => article.search_text.toLowerCase().includes(word)));
  addRecent(query);
  renderSearchResults(results, `검색 결과 ${results.length}건`, keywords);
}

function renderSearchResults(list, label, keywords = []) {
  els.resultInfo.classList.remove('hidden');
  els.resultInfo.innerHTML = `<strong>${escapeHtml(label)}</strong>`;
  if (!list.length) {
    els.searchResults.innerHTML = '<div class="empty-box">검색 결과가 없습니다.<br>다른 키워드로 다시 검색해 주세요.</div>';
    return;
  }
  els.searchResults.innerHTML = list.slice(0, 80).map(article => {
    const preview = article.body.length > 140 ? article.body.slice(0, 140) + '...' : article.body;
    return `
      <article class="card">
        <div class="chead" data-open-article="${article.id}">
          <div class="bdgs">
            <span class="badge part">${escapeHtml(article.part)}</span>
            <span class="badge chapter">${escapeHtml(article.chapter)}</span>
          </div>
          <div class="ctit">${highlight(article.display_title, keywords)}</div>
        </div>
        <div class="cprev">${highlight(preview, keywords)}</div>
      </article>`;
  }).join('');
  els.searchResults.querySelectorAll('[data-open-article]').forEach(node => node.addEventListener('click', () => openArticle(Number(node.dataset.openArticle))));
}

function renderToc() {
  const byPart = new Map();
  state.articles.forEach(article => {
    if (!byPart.has(article.part)) byPart.set(article.part, new Map());
    const chapters = byPart.get(article.part);
    if (!chapters.has(article.chapter)) chapters.set(article.chapter, 0);
    chapters.set(article.chapter, chapters.get(article.chapter) + 1);
  });
  els.tocList.innerHTML = [...byPart.entries()].map(([part, chapterMap], index) => {
    const chapterHtml = [...chapterMap.entries()].map(([chapter, count]) => `
      <button class="tch" data-filter-chapter="${escapeHtml(chapter)}">${escapeHtml(chapter)} (${count}조)</button>`).join('');
    return `
      <div class="tpart">
        <div class="thd" data-toggle-part="${index}">
          <div class="tname">${escapeHtml(part)}</div>
          <div class="tright"><span>${[...chapterMap.values()].reduce((a,b)=>a+b,0)}조</span><span>▶</span></div>
        </div>
        <div class="tchs" id="tocGroup${index}">${chapterHtml}</div>
      </div>`;
  }).join('');

  els.tocList.querySelectorAll('[data-toggle-part]').forEach(node => node.addEventListener('click', () => {
    const group = document.getElementById(`tocGroup${node.dataset.togglePart}`);
    group.classList.toggle('open');
  }));
  els.tocList.querySelectorAll('[data-filter-chapter]').forEach(node => node.addEventListener('click', () => {
    const chapter = node.dataset.filterChapter;
    const list = state.articles.filter(article => article.chapter === chapter);
    switchSearchPane('search');
    renderSearchResults(list, `${chapter} · ${list.length}건`);
  }));
}

function renderBookmarks() {
  const ids = new Set(loadJson(storage.bookmark, []));
  const list = state.articles.filter(article => ids.has(article.id));
  if (!list.length) {
    els.bookmarkList.innerHTML = '<div class="empty-box">즐겨찾기한 조문이 없습니다.<br>검색 결과에서 조문을 열고 추가해 주세요.</div>';
    return;
  }
  els.bookmarkList.innerHTML = list.map(article => `
    <article class="card">
      <div class="chead" data-open-bookmark="${article.id}">
        <div class="bdgs">
          <span class="badge part">${escapeHtml(article.part)}</span>
          <span class="badge chapter">${escapeHtml(article.chapter)}</span>
        </div>
        <div class="ctit">${escapeHtml(article.display_title)}</div>
      </div>
      <div class="cprev">${escapeHtml(article.body.slice(0, 120))}${article.body.length > 120 ? '...' : ''}</div>
    </article>`).join('');
  els.bookmarkList.querySelectorAll('[data-open-bookmark]').forEach(node => node.addEventListener('click', () => openArticle(Number(node.dataset.openBookmark))));
}

function openArticle(id, options = {}) {
  const { pushHistory = true } = options;
  const article = state.articles.find(item => item.id === id);
  if (!article) return;
  state.currentArticleId = id;
  els.articleBadges.innerHTML = `
    <span class="badge part">${escapeHtml(article.part)}</span>
    <span class="badge chapter">${escapeHtml(article.chapter)}</span>`;
  els.articleTitle.textContent = article.display_title;
  els.articleBody.textContent = article.body;
  syncBookmarkButton();
  els.articleModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if (pushHistory) pushAppState();
}

function closeArticleModal(options = {}) {
  const { pushHistory = false } = options;
  els.articleModal.classList.add('hidden');
  document.body.style.overflow = '';
  if (pushHistory) pushAppState();
}

function syncBookmarkButton() {
  const bookmarks = new Set(loadJson(storage.bookmark, []));
  const active = bookmarks.has(state.currentArticleId);
  els.bookmarkToggleBtn.textContent = active ? '⭐ 즐겨찾기 해제' : '☆ 즐겨찾기 추가';
  els.bookmarkToggleBtn.classList.toggle('on', active);
}

function toggleCurrentBookmark() {
  const bookmarks = new Set(loadJson(storage.bookmark, []));
  if (bookmarks.has(state.currentArticleId)) bookmarks.delete(state.currentArticleId);
  else bookmarks.add(state.currentArticleId);
  saveJson(storage.bookmark, [...bookmarks]);
  syncBookmarkButton();
  renderBookmarks();
}

function addRecent(keyword) {
  const current = loadJson(storage.recent, []).filter(item => item !== keyword);
  current.unshift(keyword);
  saveJson(storage.recent, current.slice(0, 10));
}

function removeRecent(keyword) {
  saveJson(storage.recent, loadJson(storage.recent, []).filter(item => item !== keyword));
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function applyFontSize(size) {
  document.body.classList.toggle('search-large', size === 'large');
  els?.fsBtns?.forEach(btn => btn.classList.toggle('active', btn.dataset.fontsize === size));
}

function renderSelectors() {
  els.partSelector.innerHTML = state.data.parts.filter(part => part !== '부칙').map(part => `
    <label class="selector-item"><input type="checkbox" value="${escapeHtml(part)}" data-part> ${escapeHtml(part)}</label>`).join('');

  const chapters = Object.entries(state.data.chapters)
    .filter(([part]) => part !== '부칙')
    .flatMap(([, list]) => list)
    .filter((value, index, array) => array.indexOf(value) === index);
  els.chapterSelector.innerHTML = chapters.map(chapter => `
    <label class="selector-item"><input type="checkbox" value="${escapeHtml(chapter)}" data-chapter> ${escapeHtml(chapter)}</label>`).join('');

  els.partSelector.querySelectorAll('[data-part]').forEach(node => node.addEventListener('change', () => {
    if (node.checked) state.selectedParts.add(node.value); else state.selectedParts.delete(node.value);
    updateScopeSummary();
  }));
  els.chapterSelector.querySelectorAll('[data-chapter]').forEach(node => node.addEventListener('change', () => {
    if (node.checked) state.selectedChapters.add(node.value); else state.selectedChapters.delete(node.value);
    updateScopeSummary();
  }));
}

function toggleSelector(node, button, forceOpen = null) {
  const open = forceOpen === null ? node.classList.contains('hidden') : forceOpen;
  node.classList.toggle('hidden', !open);
  button.textContent = open ? '닫기' : '열기';
}

function syncGranularitySelectors() {
  if (state.granularity === 'chapter') {
    toggleSelector(els.chapterSelector, els.toggleChapterSelector, true);
    toggleSelector(els.partSelector, els.togglePartSelector, false);
  } else if (state.granularity === 'part') {
    toggleSelector(els.partSelector, els.togglePartSelector, true);
    toggleSelector(els.chapterSelector, els.toggleChapterSelector, false);
  } else {
    toggleSelector(els.partSelector, els.togglePartSelector, false);
    toggleSelector(els.chapterSelector, els.toggleChapterSelector, false);
  }
}

function getScopedArticles() {
  let list = (state.quizArticles || []).slice();
  if (state.selectedParts.size) list = list.filter(article => state.selectedParts.has(article.part));
  if (state.selectedChapters.size) list = list.filter(article => state.selectedChapters.has(article.chapter));
  return list;
}

function updateScopeSummary() {
  const parts = state.selectedParts.size ? `${state.selectedParts.size}개 편 선택` : '전체 편';
  const chapters = state.selectedChapters.size ? `${state.selectedChapters.size}개 장 선택` : '전체 장';
  const scoped = getScopedArticles();
  els.scopeSummary.textContent = `${parts} / ${chapters}`;
  els.scopeCount.textContent = scoped.length;
}

function startQuiz(type) {
  const scoped = getScopedArticles();
  if (!scoped.length) {
    els.quizArea.classList.remove('hidden');
    els.quizArea.innerHTML = '<div class="empty-box">출제 가능한 조문이 없습니다.<br>편 또는 장 선택 범위를 다시 확인해 주세요.</div>';
    return;
  }
  state.currentQuizType = type;
  state.currentQuizIndex = 0;
  state.currentQuizPool = type === 'ox' ? buildOxQuiz(scoped) : buildMcqQuiz(scoped);
  els.quizArea.classList.remove('hidden');
  els.quizStartActions.classList.add('hidden');
  renderAfterOxChoices();
  renderCurrentQuestion();
  pushAppState();
}

function buildOxQuiz(scoped) {
  const selected = selectArticlesByGranularity(scoped, 10).filter(isQuizArticleUsable);
  return selected.map((article, index) => {
    const validLines = extractValidStatements(article);
    const articleLine = validLines[0] || article.body;
    const truthy = index % 2 === 0;
    let statement = articleLine;

    if (!truthy) {
      const alternatives = shuffle(scoped.filter(item => item.id !== article.id && isQuizArticleUsable(item)));
      const alt = alternatives.find(item => extractValidStatements(item).length);
      if (alt) {
        statement = extractValidStatements(alt)[0];
      } else {
        statement = mutateStatement(articleLine);
      }
      if (statement === articleLine) statement = mutateStatement(articleLine);
    }

    return {
      kind: 'ox',
      meta: `${labelGranularity()} OX ${index + 1} / 10`,
      article,
      statement,
      answer: truthy ? 'O' : 'X',
      explanation: `${article.display_title}
${cleanQuizBody(article.body)}`,
    };
  });
}

function buildMcqQuiz(scoped) {
  const selected = selectArticlesByGranularity(scoped, 10).filter(isQuizArticleUsable);
  return selected.map((article, index) => {
    let correct;
    let pool;
    if (state.granularity === 'article') {
      correct = article.display_title;
      pool = uniqueValues(scoped.filter(isQuizArticleUsable).map(item => item.display_title));
    } else if (state.granularity === 'chapter') {
      correct = article.chapter;
      pool = uniqueValues(scoped.filter(isQuizArticleUsable).map(item => item.chapter));
    } else {
      correct = article.part;
      pool = uniqueValues(scoped.filter(isQuizArticleUsable).map(item => item.part));
    }

    return {
      kind: 'mcq',
      meta: `${labelGranularity()} 4지선다 ${index + 1} / 10`,
      prompt: extractValidStatements(article)[0] || cleanQuizBody(article.body),
      options: pickChoices(pool, correct),
      answer: correct,
      explanation: `${article.part} · ${article.chapter} · ${article.display_title}
${cleanQuizBody(article.body)}`,
    };
  });
}

function selectArticlesByGranularity(scoped, count) {
  if (state.granularity === 'article') return shuffle(scoped).slice(0, Math.min(count, scoped.length));
  const key = state.granularity === 'chapter' ? 'chapter' : 'part';
  const groups = new Map();
  scoped.forEach(article => {
    if (!groups.has(article[key])) groups.set(article[key], []);
    groups.get(article[key]).push(article);
  });
  const buckets = [...groups.values()].map(items => shuffle(items));
  const result = [];
  while (result.length < count && buckets.some(items => items.length)) {
    buckets.forEach(items => {
      if (items.length && result.length < count) result.push(items.shift());
    });
  }
  return result;
}

function renderCurrentQuestion() {
  const item = state.currentQuizPool[state.currentQuizIndex];
  if (!item) {
    els.quizArea.innerHTML = `<div class="empty-box">${state.currentQuizType === 'ox' ? 'OX 10문제를 모두 마쳤습니다.' : '4지선다형 10문제를 모두 마쳤습니다.'}<br>아래 버튼으로 다음 학습을 이어가세요.</div>`;
    if (state.currentQuizType === 'ox') {
      els.quizStartActions.classList.remove('hidden');
    } else {
      els.quizStartActions.classList.add('hidden');
    }
    return;
  }
  if (item.kind === 'ox') {
    els.quizArea.innerHTML = `
      <div class="question-card">
        <div class="question-meta">${escapeHtml(item.meta)}</div>
        <div class="question-title">[${escapeHtml(item.article.display_title)}] 다음 설명이 맞으면 O, 틀리면 X를 선택하세요.</div>
        <div class="question-body">${escapeHtml(item.statement)}</div>
        <div class="answer-row">
          <button class="answer-btn" data-answer="O">O</button>
          <button class="answer-btn" data-answer="X">X</button>
        </div>
        <div id="feedback"></div>
      </div>`;
    els.quizArea.querySelectorAll('[data-answer]').forEach(node => node.addEventListener('click', () => handleOxAnswer(node, item)));
  } else {
    els.quizArea.innerHTML = `
      <div class="question-card">
        <div class="question-meta">${escapeHtml(item.meta)}</div>
        <div class="question-title">다음 설명과 가장 관련 깊은 ${state.granularity === 'article' ? '조문' : state.granularity === 'chapter' ? '장' : '편'}을 고르세요.</div>
        <div class="question-body">${escapeHtml(item.prompt)}</div>
        <div class="choice-list">${item.options.map(option => `<button class="choice-btn" data-choice="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join('')}</div>
        <div id="feedback"></div>
      </div>`;
    els.quizArea.querySelectorAll('[data-choice]').forEach(node => node.addEventListener('click', () => handleMcqAnswer(node, item)));
  }
}

function handleOxAnswer(button, item) {
  const chosen = button.dataset.answer;
  const buttons = [...els.quizArea.querySelectorAll('[data-answer]')];
  buttons.forEach(node => node.disabled = true);
  buttons.forEach(node => {
    if (node.dataset.answer === item.answer) node.classList.add('correct');
    else if (node === button) node.classList.add('wrong');
  });
  showFeedback(chosen === item.answer, item.explanation);
}

function handleMcqAnswer(button, item) {
  const chosen = button.dataset.choice;
  const buttons = [...els.quizArea.querySelectorAll('[data-choice]')];
  buttons.forEach(node => node.disabled = true);
  buttons.forEach(node => {
    if (node.dataset.choice === item.answer) node.classList.add('correct');
    else if (node === button) node.classList.add('wrong');
  });
  showFeedback(chosen === item.answer, item.explanation);
}

function showFeedback(correct, explanation) {
  const feedback = document.getElementById('feedback');
  feedback.innerHTML = `
    <div class="explanation"><strong>${correct ? '정답입니다.' : '오답입니다.'}</strong>\n\n${escapeHtml(explanation)}</div>
    <button id="nextQuestionBtn" class="primary-btn">다음 문제</button>`;
  document.getElementById('nextQuestionBtn').addEventListener('click', () => {
    state.currentQuizIndex += 1;
    renderCurrentQuestion();
  });
}


function renderAfterOxChoices() {
  if (!els.afterOxButtons.length) return;
  els.afterOxButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.after === state.afterOx));
  if (els.restartOxBtn) els.restartOxBtn.classList.toggle('primary-btn', state.afterOx === 'ox_review');
  if (els.restartOxBtn) els.restartOxBtn.classList.toggle('secondary-btn', state.afterOx !== 'ox_review');
  if (els.startMcqBtn) els.startMcqBtn.classList.toggle('primary-btn', state.afterOx === 'multiple_choice');
  if (els.startMcqBtn) els.startMcqBtn.classList.toggle('secondary-btn', state.afterOx !== 'multiple_choice');
}

function buildAppState() {
  return {
    app: true,
    view: state.currentView || (els.quizView.classList.contains('hidden') ? (els.searchView.classList.contains('hidden') ? 'home' : 'search') : 'quiz'),
    pane: state.currentPane,
    modal: !els.articleModal.classList.contains('hidden') ? 'article' : !els.settingsModal.classList.contains('hidden') ? 'settings' : null,
    quizActive: !els.quizArea.classList.contains('hidden'),
    quizType: state.currentQuizType,
    quizIndex: state.currentQuizIndex,
  };
}

function pushAppState() {
  if (!state.historyReady) return;
  const snapshot = buildAppState();
  history.pushState(snapshot, '', window.location.href);
}

function replaceInitialHistory() {
  const snapshot = buildAppState();
  history.replaceState(snapshot, '', window.location.href);
  history.pushState({ ...snapshot, sentinel: true }, '', window.location.href);
}

function setupHistory() {
  state.historyReady = true;
  window.addEventListener('popstate', event => {
    const snapshot = event.state;
    if (!snapshot || !snapshot.app) {
      history.pushState(buildAppState(), '', window.location.href);
      return;
    }
    applyHistoryState(snapshot);
    if (snapshot.sentinel) {
      history.pushState(buildAppState(), '', window.location.href);
    }
  });
}

function applyHistoryState(snapshot) {
  if (snapshot.modal === 'article' && state.currentArticleId) {
    openArticle(state.currentArticleId, { pushHistory: false });
    return;
  }
  if (snapshot.modal === 'settings') {
    els.settingsModal.classList.remove('hidden');
  } else {
    els.settingsModal.classList.add('hidden');
    closeArticleModal({ pushHistory: false });
  }
  showView(snapshot.view || 'home', { pushHistory: false });
  if ((snapshot.view || 'home') === 'search') switchSearchPane(snapshot.pane || 'search', { pushHistory: false });
}

function goBackInsideApp(fallback = 'home') {
  const current = history.state;
  if (current && current.app) {
    history.back();
    return;
  }
  showView(fallback);
}

function labelGranularity() {
  return state.granularity === 'article' ? '조 단위' : state.granularity === 'chapter' ? '장 단위' : '편 단위';
}

function firstMeaningfulLine(body) {
  return extractValidStatements({ body })[0] || cleanQuizBody(body);
}

function cleanQuizBody(body = '') {
  return String(body)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractValidStatements(article) {
  const body = cleanQuizBody(article.body || article);
  const raw = body
    .replace(/①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩/g, '\n$& ')
    .replace(/\s([0-9]+\.)/g, '\n$1')
    .replace(/\s([가-하]\.)/g, '\n$1')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);

  return raw
    .map(line => line.replace(/^([0-9]+\.|[가-하]\.|[①-⑩])\s*/, '').trim())
    .map(line => line.replace(/<[^>]*>/g, '').trim())
    .filter(line => line.length >= 16)
    .filter(line => !/^(삭제|부칙|별표|별지|서식|목차)/.test(line))
    .filter(line => !/(개정|신설|전문개정|제목개정)/.test(line) || /한다\.?$|할 수 있다\.?$|하여야 한다\.?$|된다\.?$|아니하다\.?$|있다\.?$|말한다\.?$|로 한다\.?$/.test(line))
    .filter(line => !/다음 각 호|다음 각 목/.test(line))
    .filter(line => /[가-힣]/.test(line))
    .filter(line => /한다\.?$|할 수 있다\.?$|하여야 한다\.?$|된다\.?$|아니하다\.?$|있다\.?$|말한다\.?$|로 한다\.?$/.test(line));
}

function isQuizArticleUsable(article) {
  if (!article || article.supplementary || !article.quiz_eligible) return false;
  if (!/^제\d+조/.test(article.display_title || '')) return false;
  const body = cleanQuizBody(article.body);
  if (body.length < 20) return false;
  if (/^(삭제|부칙)/.test(body)) return false;
  return extractValidStatements(article).length > 0;
}

function mutateStatement(line) {
  if (!line) return '';
  if (line.includes('할 수 없다')) return line.replace('할 수 없다', '할 수 있다');
  if (line.includes('하여서는 아니된다')) return line.replace('하여서는 아니된다', '할 수 있다');
  if (line.includes('아니한다')) return line.replace('아니한다', '한다');
  if (line.includes('한다')) return line.replace('한다', '하지 않는다');
  if (line.includes('있다')) return line.replace('있다', '없다');
  return line + ' 아니다.';
}

function uniqueValues(items) {
  return [...new Set(items.filter(Boolean))];
}

function pickChoices(pool, correct) {
  const choices = shuffle(pool.filter(value => value !== correct)).slice(0, 3);
  return shuffle([correct, ...choices]);
}

function shuffle(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function highlight(text, keywords) {
  let safe = escapeHtml(text);
  keywords.forEach(keyword => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    safe = safe.replace(new RegExp(escaped, 'gi'), match => `<mark>${match}</mark>`);
  });
  return safe;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
