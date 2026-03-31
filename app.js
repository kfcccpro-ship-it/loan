let ARTICLES = [];
let MASTER_QUIZ = [];
let CURRENT_BATCH = [];
let currentSearch = "";
let currentQuizAnswers = 0;
let currentQuizCorrect = 0;

const state = {
  tab: "manual",
  quizPreset: "random",
  quizPart: "",
  quizChapter: "",
  quizArticleStart: "",
  quizArticleEnd: ""
};

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function highlight(text, keyword){
  if(!keyword) return escapeHtml(text);
  const safe = escapeHtml(text);
  const pattern = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${pattern})`, "gi"), "<mark>$1</mark>");
}

function articleNumber(articleNo){
  const m = String(articleNo || "").match(/제\s*(\d+)\s*조/);
  return m ? Number(m[1]) : null;
}

function articleByNo(articleNo){
  return ARTICLES.find(a => a.article_no === articleNo) || null;
}

function shuffle(array){
  const cloned = [...array];
  for(let i=cloned.length-1;i>0;i--){
    const j = Math.floor(Math.random() * (i+1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function takeRandom(array, count){
  return shuffle(array).slice(0, count);
}

function enrichData(){
  ARTICLES = ARTICLES.map(article => ({
    ...article,
    article_num: article.article_num ?? articleNumber(article.article_no)
  }));

  MASTER_QUIZ = MASTER_QUIZ.map(q => {
    const article = articleByNo(q.source_article_no) || {};
    return {
      ...q,
      source_part: q.source_part || article.part || "",
      source_chapter: q.source_chapter || article.chapter || "",
      source_section: q.source_section || article.section || "",
      source_article_num: q.source_article_num || article.article_num || articleNumber(q.source_article_no)
    };
  });
}

function setTab(tabName){
  state.tab = tabName;
  $all(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabName));
  $("#manualTab").classList.toggle("active", tabName === "manual");
  $("#quizTab").classList.toggle("active", tabName === "quiz");
}

function buildTocItems(filtered){
  const groups = filtered.slice(0, 300).map(article => `
    <button class="toc-item" data-target="${escapeHtml(article.id)}">
      ${highlight(`${article.article_no} ${article.title}`, currentSearch)}
    </button>
  `).join("");

  $("#tocList").innerHTML = groups || `<div class="empty-state">검색 결과가 없습니다.</div>`;

  $all(".toc-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const el = document.getElementById(btn.dataset.target);
      if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
    });
  });
}

function matchesKeyword(article, keyword){
  const q = keyword.trim().toLowerCase();
  if(!q) return true;
  const haystack = [
    article.part, article.chapter, article.section, article.article_no, article.title, article.full_text
  ].join(" ").toLowerCase();
  return haystack.includes(q);
}

function renderManual(){
  const filtered = ARTICLES.filter(article => matchesKeyword(article, currentSearch));
  const host = $("#articleList");
  const tpl = $("#articleTemplate");
  $("#articleCount").textContent = currentSearch
    ? `검색 결과 ${filtered.length.toLocaleString()}개 조문`
    : `전체 ${ARTICLES.length.toLocaleString()}개 조문`;

  host.innerHTML = "";
  if(!filtered.length){
    host.innerHTML = `<div class="card empty-state">입력한 키워드와 일치하는 조문이 없습니다.</div>`;
    buildTocItems(filtered);
    return;
  }

  filtered.forEach(article => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.id = article.id;
    node.querySelector(".article-path").textContent = [article.part, article.chapter, article.section].filter(Boolean).join(" · ");
    node.querySelector(".article-title").innerHTML = highlight(article.full_title, currentSearch);

    const body = node.querySelector(".article-body");
    article.blocks.forEach(block => {
      const div = document.createElement("div");
      div.className = "block";
      div.innerHTML = `
        <div class="block-label">${escapeHtml(block.label || "본문")}</div>
        <div class="block-text">${highlight(block.text, currentSearch)}</div>
      `;
      body.appendChild(div);
    });

    host.appendChild(node);
  });

  buildTocItems(filtered);
}

function renderQuizFilters(){
  const parts = [...new Set(ARTICLES.map(a => a.part).filter(Boolean))];
  const chapters = [...new Set(
    ARTICLES.filter(a => !state.quizPart || a.part === state.quizPart).map(a => a.chapter).filter(Boolean)
  )];

  $("#quizPartSelect").innerHTML = '<option value="">전체 편</option>' + parts.map(p =>
    `<option value="${escapeHtml(p)}" ${state.quizPart === p ? "selected" : ""}>${escapeHtml(p)}</option>`
  ).join("");

  $("#quizChapterSelect").innerHTML = '<option value="">전체 장</option>' + chapters.map(c =>
    `<option value="${escapeHtml(c)}" ${state.quizChapter === c ? "selected" : ""}>${escapeHtml(c)}</option>`
  ).join("");

  $("#quizPreset").value = state.quizPreset;
  $("#quizArticleStart").value = state.quizArticleStart;
  $("#quizArticleEnd").value = state.quizArticleEnd;

  const partsText = [];
  if(state.quizPreset === "random"){
    partsText.push("현재 범위: 전체 방법서에서 랜덤 출제");
  } else {
    if(state.quizPart) partsText.push(`편: ${state.quizPart}`);
    if(state.quizChapter) partsText.push(`장: ${state.quizChapter}`);
    if(state.quizArticleStart || state.quizArticleEnd){
      const start = state.quizArticleStart || "시작 미지정";
      const end = state.quizArticleEnd || "끝 미지정";
      partsText.push(`조 범위: 제${start}조 ~ 제${end}조`);
    }
    if(!partsText.length) partsText.push("현재 범위: 직접 선택 모드이지만 아직 전체 범위입니다.");
  }

  $("#quizScopeSummary").textContent = partsText.join(" / ");
  const pool = getQuizPool();
  const oxCount = pool.filter(item => item.type === "ox").length;
  const mcqCount = pool.filter(item => item.type === "mcq").length;
  $("#quizPoolInfo").textContent = `현재 범위에서 생성 가능한 문제: OX ${oxCount}문제 · 4지선다 ${mcqCount}문제`;
}

function getQuizPool(){
  let pool = [...MASTER_QUIZ];

  if(state.quizPreset === "custom"){
    if(state.quizPart){
      pool = pool.filter(q => q.source_part === state.quizPart);
    }
    if(state.quizChapter){
      pool = pool.filter(q => q.source_chapter === state.quizChapter);
    }

    const start = state.quizArticleStart === "" ? null : Number(state.quizArticleStart);
    const end = state.quizArticleEnd === "" ? null : Number(state.quizArticleEnd);

    if(start != null && !Number.isNaN(start)){
      pool = pool.filter(q => q.source_article_num != null && q.source_article_num >= start);
    }
    if(end != null && !Number.isNaN(end)){
      pool = pool.filter(q => q.source_article_num != null && q.source_article_num <= end);
    }
  }

  return pool;
}

function makeQuizBatch(){
  const pool = getQuizPool();
  const oxPool = pool.filter(item => item.type === "ox");
  const mcqPool = pool.filter(item => item.type === "mcq");

  const oxSet = takeRandom(oxPool, Math.min(10, oxPool.length));
  const mcqSet = takeRandom(mcqPool, Math.min(10, mcqPool.length));

  CURRENT_BATCH = [...oxSet, ...mcqSet];

  currentQuizAnswers = 0;
  currentQuizCorrect = 0;

  renderQuizBatch();
  updateQuizStats();
  $("#quizMoreSection").classList.add("hidden");
}

function updateQuizStats(){
  $("#quizSessionLabel").textContent = `현재 세트: OX ${CURRENT_BATCH.filter(q => q.type === "ox").length}문제 + 4지선다 ${CURRENT_BATCH.filter(q => q.type === "mcq").length}문제`;
  $("#quizProgress").textContent = `${currentQuizAnswers} / ${CURRENT_BATCH.length} 완료`;
  $("#quizScore").textContent = `정답 ${currentQuizCorrect}`;
}

function renderQuizBatch(){
  const host = $("#quizList");
  const tpl = $("#quizTemplate");
  host.innerHTML = "";

  if(!CURRENT_BATCH.length){
    host.innerHTML = `<div class="card empty-state">현재 범위에서 출제 가능한 문제가 없습니다. 범위를 넓혀 주세요.</div>`;
    return;
  }

  CURRENT_BATCH.forEach((item, index) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.index = index;
    node.querySelector(".quiz-type").textContent = item.type === "ox" ? "OX" : "4지선다";
    node.querySelector(".quiz-meta").textContent = `${item.source_article_no} ${item.source_title ? `· ${item.source_title}` : ""}`;
    node.querySelector(".quiz-prompt").textContent = item.prompt;

    const optionsHost = node.querySelector(".quiz-options");
    const resultHost = node.querySelector(".quiz-result");
    const sourceHost = node.querySelector(".source-body");

    if(item.type === "ox"){
      [["O", 0], ["X", 1]].forEach(([label, value]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "option-btn";
        btn.textContent = label;
        btn.addEventListener("click", () => handleQuizAnswer(index, value, node));
        optionsHost.appendChild(btn);
      });
    } else {
      item.choices.forEach((choice, choiceIndex) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "option-btn";
        btn.innerHTML = `${choiceIndex + 1}. ${escapeHtml(choice)}`;
        btn.addEventListener("click", () => handleQuizAnswer(index, choiceIndex, node));
        optionsHost.appendChild(btn);
      });
    }

    sourceHost.innerHTML = `
      <div class="source-ref">${escapeHtml([item.source_part, item.source_chapter, item.source_section].filter(Boolean).join(" · "))}</div>
      <div><strong>${escapeHtml(item.source_article_no)}${item.source_title ? `(${escapeHtml(item.source_title)})` : ""}</strong></div>
      <div class="block-text">${escapeHtml(item.source_text || "")}</div>
    `;

    host.appendChild(node);
  });
}

function correctAnswerValue(item){
  if(item.type === "ox"){
    return item.answer_index === 0 ? 0 : 1;
  }
  return item.answer_index;
}

function lockQuizCard(node, userAnswer, isCorrect){
  const buttons = Array.from(node.querySelectorAll(".option-btn"));
  const item = CURRENT_BATCH[Number(node.dataset.index)];
  const answerValue = correctAnswerValue(item);

  buttons.forEach((button, idx) => {
    button.classList.add("locked");
    button.disabled = true;
    if(idx === answerValue){
      button.classList.add("correct");
    }
    if(idx === userAnswer && !isCorrect){
      button.classList.add("wrong");
    }
  });
}

function handleQuizAnswer(index, userAnswer, node){
  const item = CURRENT_BATCH[index];
  if(node.dataset.answered === "true") return;

  const isCorrect = userAnswer === correctAnswerValue(item);
  node.dataset.answered = "true";
  lockQuizCard(node, userAnswer, isCorrect);

  currentQuizAnswers += 1;
  if(isCorrect) currentQuizCorrect += 1;
  updateQuizStats();

  const resultHost = node.querySelector(".quiz-result");
  resultHost.className = `quiz-result ${isCorrect ? "ok" : "bad"}`;
  resultHost.textContent = isCorrect
    ? "정답입니다. 아래의 정확한 조문으로 바로 확인해 보세요."
    : "오답입니다. 아래의 정확한 조문을 열어 기준 문구를 직접 확인해 보세요.";

  if(currentQuizAnswers === CURRENT_BATCH.length){
    $("#quizMoreSection").classList.remove("hidden");
  }
}

function bindEvents(){
  $all(".tab").forEach(btn => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  $("#searchInput").addEventListener("input", (e) => {
    currentSearch = e.target.value;
    renderManual();
  });

  $("#clearSearchBtn").addEventListener("click", () => {
    currentSearch = "";
    $("#searchInput").value = "";
    renderManual();
  });

  $("#quizPreset").addEventListener("change", (e) => {
    state.quizPreset = e.target.value;
    renderQuizFilters();
  });

  $("#quizPartSelect").addEventListener("change", (e) => {
    state.quizPart = e.target.value;
    if(state.quizChapter){
      const chapters = [...new Set(
        ARTICLES.filter(a => !state.quizPart || a.part === state.quizPart).map(a => a.chapter).filter(Boolean)
      )];
      if(!chapters.includes(state.quizChapter)) state.quizChapter = "";
    }
    renderQuizFilters();
  });

  $("#quizChapterSelect").addEventListener("change", (e) => {
    state.quizChapter = e.target.value;
    renderQuizFilters();
  });

  $("#quizArticleStart").addEventListener("input", (e) => state.quizArticleStart = e.target.value);
  $("#quizArticleEnd").addEventListener("input", (e) => state.quizArticleEnd = e.target.value);

  $("#applyQuizRangeBtn").addEventListener("click", () => {
    state.quizPreset = $("#quizPreset").value;
    state.quizPart = $("#quizPartSelect").value;
    state.quizChapter = $("#quizChapterSelect").value;
    state.quizArticleStart = $("#quizArticleStart").value;
    state.quizArticleEnd = $("#quizArticleEnd").value;
    renderQuizFilters();
    makeQuizBatch();
  });

  $("#clearQuizRangeBtn").addEventListener("click", () => {
    state.quizPreset = "random";
    state.quizPart = "";
    state.quizChapter = "";
    state.quizArticleStart = "";
    state.quizArticleEnd = "";
    renderQuizFilters();
    makeQuizBatch();
  });

  $("#resetBtn").addEventListener("click", () => {
    makeQuizBatch();
  });

  $("#loadMoreBtn").addEventListener("click", () => {
    makeQuizBatch();
    window.scrollTo({ top: $("#quizTab").offsetTop - 10, behavior: "smooth" });
  });
}

async function init(){
  const [articlesRes, quizRes] = await Promise.all([
    fetch("data.json"),
    fetch("quiz.json")
  ]);

  ARTICLES = await articlesRes.json();
  MASTER_QUIZ = await quizRes.json();
  enrichData();
  bindEvents();
  renderManual();
  renderQuizFilters();
  makeQuizBatch();
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif">데이터를 불러오지 못했습니다. 파일 경로와 GitHub Pages 배포 상태를 확인해 주세요.</div>`;
});
