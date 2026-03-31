const state = {
  articles: [],
  quizzes: [],
  filteredByToc: [],
  activeQuiz: null,
  activePart: '',
  activeChapter: '',
};

const els = {
  keywordInput: document.getElementById('keywordInput'),
  searchBtn: document.getElementById('searchBtn'),
  searchResults: document.getElementById('searchResults'),
  searchMeta: document.getElementById('searchMeta'),
  quickKeywords: document.getElementById('quickKeywords'),
  quizContainer: document.getElementById('quizContainer'),
  quizTypeSelect: document.getElementById('quizTypeSelect'),
  nextQuizBtn: document.getElementById('nextQuizBtn'),
  openTocBtn: document.getElementById('openTocBtn'),
  closeTocBtn: document.getElementById('closeTocBtn'),
  tocModal: document.getElementById('tocModal'),
  tocBackdrop: document.getElementById('tocBackdrop'),
  partSelect: document.getElementById('partSelect'),
  chapterSelect: document.getElementById('chapterSelect'),
  applyTocBtn: document.getElementById('applyTocBtn'),
  resetTocBtn: document.getElementById('resetTocBtn'),
  resultTemplate: document.getElementById('searchResultTemplate'),
};

const quickKeywordPool = ['담보', '대출한도', '연체', '채권보전', '기한의 이익', '대환'];
const excludedQuizPatterns = /(부칙|시행일|경과조치)/;

init();

async function init() {
  bindEvents();

  try {
    const [articleData, quizData] = await Promise.all([
      fetchJson('data.json'),
      fetchJson('quiz.json'),
    ]);

    state.articles = normalizeArticles(articleData);
    state.quizzes = normalizeQuizzes(quizData).filter((item) => !excludedQuizPatterns.test(item.question));
    state.filteredByToc = [...state.articles];

    renderQuickKeywords();
    populateToc();
    renderResults(state.articles, '');
    renderQuiz();
  } catch (error) {
    console.error(error);
    renderFatalError(error);
  }
}

function bindEvents() {
  els.searchBtn.addEventListener('click', handleSearch);
  els.keywordInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  });

  els.quizTypeSelect.addEventListener('change', renderQuiz);
  els.nextQuizBtn.addEventListener('click', renderQuiz);

  els.openTocBtn.addEventListener('click', openTocModal);
  els.closeTocBtn.addEventListener('click', closeTocModal);
  els.tocBackdrop.addEventListener('click', closeTocModal);
  els.applyTocBtn.addEventListener('click', applyTocFilter);
  els.resetTocBtn.addEventListener('click', resetTocFilter);
  els.partSelect.addEventListener('change', updateChapterOptions);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeTocModal();
    }
  });
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${path} 파일을 불러오지 못했습니다.`);
  }
  return response.json();
}

function normalizeArticles(raw) {
  if (Array.isArray(raw)) {
    return raw.map(mapArticle);
  }
  if (Array.isArray(raw?.articles)) {
    return raw.articles.map(mapArticle);
  }
  return [];
}

function mapArticle(item, index) {
  return {
    id: item.id ?? index + 1,
    part: item.part ?? item.section ?? '',
    chapter: item.chapter ?? item.subsection ?? '',
    title: item.title ?? item.article_title ?? `조문 ${index + 1}`,
    body: item.body ?? item.content ?? '',
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
  };
}

function normalizeQuizzes(raw) {
  if (Array.isArray(raw)) {
    return raw.map(mapQuiz);
  }
  if (Array.isArray(raw?.quizzes)) {
    return raw.quizzes.map(mapQuiz);
  }
  return [];
}

function mapQuiz(item, index) {
  const type = (item.type ?? '').toLowerCase();
  return {
    id: item.id ?? index + 1,
    type: type === 'multiple' ? 'multiple' : 'ox',
    question: item.question ?? '',
    options: Array.isArray(item.options) ? item.options : type === 'multiple' ? [] : ['O', 'X'],
    answer: String(item.answer ?? '').trim(),
    explanation: item.explanation ?? '',
    articleTitle: item.articleTitle ?? item.article_title ?? '',
    articleBody: item.articleBody ?? item.article_body ?? '',
  };
}

function renderQuickKeywords() {
  els.quickKeywords.innerHTML = '';
  quickKeywordPool.forEach((keyword) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = keyword;
    button.addEventListener('click', () => {
      els.keywordInput.value = keyword;
      handleSearch();
    });
    els.quickKeywords.appendChild(button);
  });
}

function handleSearch() {
  const keyword = els.keywordInput.value.trim();
  const source = state.filteredByToc.length ? state.filteredByToc : state.articles;

  const results = !keyword
    ? source
    : source.filter((item) => {
        const haystack = [item.part, item.chapter, item.title, item.body, item.keywords.join(' ')].join(' ').toLowerCase();
        return haystack.includes(keyword.toLowerCase());
      });

  renderResults(results, keyword);
  dismissKeyboard();
}

function renderResults(list, keyword) {
  if (!Array.isArray(list) || !list.length) {
    els.searchResults.className = 'result-list empty-state';
    els.searchResults.textContent = '조건에 맞는 조문이 없습니다.';
    els.searchMeta.textContent = '검색 결과 0건';
    return;
  }

  els.searchResults.className = 'result-list';
  els.searchResults.innerHTML = '';
  els.searchMeta.textContent = `검색 결과 ${list.length}건`;

  const fragment = document.createDocumentFragment();

  list.forEach((article) => {
    const node = els.resultTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.result-card__meta').textContent = [article.part, article.chapter].filter(Boolean).join(' · ') || '조문';
    node.querySelector('.result-card__title').innerHTML = highlight(article.title, keyword);
    node.querySelector('.result-card__body').innerHTML = highlight(article.body, keyword);
    fragment.appendChild(node);
  });

  els.searchResults.appendChild(fragment);
}

function highlight(text, keyword) {
  const safeText = escapeHtml(text || '');
  if (!keyword) {
    return safeText;
  }
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedKeyword})`, 'gi');
  return safeText.replace(regex, '<mark>$1</mark>');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br />');
}

function dismissKeyboard() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function populateToc() {
  const parts = [...new Set(state.articles.map((item) => item.part).filter(Boolean))];
  els.partSelect.innerHTML = '<option value="">전체 편</option>';

  parts.forEach((part) => {
    const option = document.createElement('option');
    option.value = part;
    option.textContent = part;
    els.partSelect.appendChild(option);
  });

  updateChapterOptions();
}

function updateChapterOptions() {
  const selectedPart = els.partSelect.value;
  const chapters = [...new Set(
    state.articles
      .filter((item) => !selectedPart || item.part === selectedPart)
      .map((item) => item.chapter)
      .filter(Boolean)
  )];

  const previous = els.chapterSelect.value;
  els.chapterSelect.innerHTML = '<option value="">전체 장</option>';

  chapters.forEach((chapter) => {
    const option = document.createElement('option');
    option.value = chapter;
    option.textContent = chapter;
    els.chapterSelect.appendChild(option);
  });

  if (chapters.includes(previous)) {
    els.chapterSelect.value = previous;
  }
}

function applyTocFilter() {
  state.activePart = els.partSelect.value;
  state.activeChapter = els.chapterSelect.value;

  state.filteredByToc = state.articles.filter((item) => {
    const partMatch = !state.activePart || item.part === state.activePart;
    const chapterMatch = !state.activeChapter || item.chapter === state.activeChapter;
    return partMatch && chapterMatch;
  });

  closeTocModal();
  handleSearch();
}

function resetTocFilter() {
  state.activePart = '';
  state.activeChapter = '';
  els.partSelect.value = '';
  updateChapterOptions();
  els.chapterSelect.value = '';
  state.filteredByToc = [...state.articles];
  closeTocModal();
  handleSearch();
}

function openTocModal() {
  els.tocModal.classList.add('is-open');
  els.tocModal.setAttribute('aria-hidden', 'false');
}

function closeTocModal() {
  els.tocModal.classList.remove('is-open');
  els.tocModal.setAttribute('aria-hidden', 'true');
}

function renderQuiz() {
  if (!state.quizzes.length) {
    els.quizContainer.className = 'quiz-box empty-state';
    els.quizContainer.textContent = 'quiz.json에 표시할 문제가 없습니다.';
    return;
  }

  const selectedType = els.quizTypeSelect.value;
  const pool = state.quizzes.filter((quiz) => selectedType === 'all' || quiz.type === selectedType);

  if (!pool.length) {
    els.quizContainer.className = 'quiz-box empty-state';
    els.quizContainer.textContent = '선택한 유형에 해당하는 문제가 없습니다.';
    return;
  }

  state.activeQuiz = pool[Math.floor(Math.random() * pool.length)];
  const quiz = state.activeQuiz;

  els.quizContainer.className = 'quiz-box';
  els.quizContainer.innerHTML = `
    <div class="quiz-badge">${quiz.type === 'ox' ? 'OX 문제' : '객관식 문제'}</div>
    <h3 class="quiz-question">${escapeHtml(quiz.question)}</h3>
    <div class="option-list"></div>
    <div id="quizFeedbackArea"></div>
  `;

  const optionList = els.quizContainer.querySelector('.option-list');
  const options = quiz.type === 'ox' ? ['O', 'X'] : [...quiz.options];

  options.forEach((optionText, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option-button';
    button.innerHTML = quiz.type === 'multiple'
      ? `<strong>${index + 1}.</strong> ${escapeHtml(optionText)}`
      : escapeHtml(optionText);
    button.addEventListener('click', () => handleQuizAnswer(button, optionText));
    optionList.appendChild(button);
  });
}

function handleQuizAnswer(button, selectedAnswer) {
  const quiz = state.activeQuiz;
  const optionButtons = [...els.quizContainer.querySelectorAll('.option-button')];
  const normalizedSelected = normalizeAnswer(selectedAnswer, quiz.type);
  const normalizedAnswer = normalizeAnswer(quiz.answer, quiz.type);
  const isCorrect = normalizedSelected === normalizedAnswer;

  optionButtons.forEach((item) => {
    item.disabled = true;
    const rawText = item.textContent.trim();
    const comparable = quiz.type === 'multiple'
      ? normalizeAnswer(rawText.replace(/^\d+\.\s*/, ''), 'multiple')
      : normalizeAnswer(rawText, 'ox');

    if (comparable === normalizedAnswer) {
      item.classList.add('correct');
    }
  });

  if (!isCorrect) {
    button.classList.add('incorrect');
  }

  const feedbackArea = document.getElementById('quizFeedbackArea');
  const feedback = document.createElement('div');
  feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
  feedback.innerHTML = `
    <strong>${isCorrect ? '정답입니다.' : '오답입니다.'}</strong><br />
    ${escapeHtml(quiz.explanation || '해설이 없습니다.')}
    <div class="quiz-article">
      <strong>${escapeHtml(quiz.articleTitle || '관련 조문')}</strong><br />
      ${escapeHtml(quiz.articleBody || '관련 조문 내용이 없습니다.')}
    </div>
  `;

  feedbackArea.innerHTML = '';
  feedbackArea.appendChild(feedback);
}

function normalizeAnswer(value, type) {
  const raw = String(value).trim();
  if (type === 'ox') {
    return raw.toUpperCase();
  }
  return raw.replace(/\s+/g, ' ').trim();
}

function renderFatalError(error) {
  els.searchResults.className = 'result-list empty-state';
  els.searchResults.textContent = '데이터를 불러오지 못했습니다. data.json 경로를 확인하세요.';
  els.quizContainer.className = 'quiz-box empty-state';
  els.quizContainer.textContent = '문제를 불러오지 못했습니다. quiz.json 경로를 확인하세요.';
  els.searchMeta.textContent = error.message;
}
