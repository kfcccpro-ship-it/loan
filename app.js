let ARTICLES = [];
let MASTER_QUIZ = [];
let QUIZ = [];
let answered = 0;
let correct = 0;

const state = {
  tab: "manual",
  search: "",
  part: "",
  chapter: "",
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

function enrichArticles(){
  ARTICLES = ARTICLES.map(article => ({
    ...article,
    article_num: articleNumber(article.article_no)
  }));
}

function articleByNo(articleNo){
  return ARTICLES.find(a => a.article_no === articleNo) || null;
}

function enrichQuiz(){
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

function matchesArticle(article){
  const q = state.search.trim();
  const haystack = [
    article.part, article.chapter, article.section, article.article_no, article.title, article.full_text
  ].join(" ");
  const okSearch = !q || haystack.toLowerCase().includes(q.toLowerCase());
  const okPart = !state.part || article.part === state.part;
  const okChapter = !state.chapter || article.chapter === state.chapter;
  return okSearch && okPart && okChapter;
}

function renderFilters(){
  const parts = [...new Set(ARTICLES.map(a => a.part).filter(Boolean))];
  const chapters = [...new Set(
    ARTICLES.filter(a => !state.part || a.part === state.part).map(a => a.chapter).filter(Boolean)
  )];

  $("#partSelect").innerHTML = '<option value="">전체 편</option>' + parts.map(p =>
    `<option value="${escapeHtml(p)}" ${state.part===p?"selected":""}>${escapeHtml(p)}</option>`
  ).join("");

  $("#chapterSelect").innerHTML = '<option value="">전체 장</option>' + chapters.map(c =>
    `<option value="${escapeHtml(c)}" ${state.chapter===c?"selected":""}>${escapeHtml(c)}</option>`
  ).join("");
}

function renderTOC(filtered){
  const toc = $("#tocList");
  const items = filtered.slice(0, 200).map(a => `
    <button data-target="${a.id}">
      ${escapeHtml(a.article_no)} ${escapeHtml(a.title)}
    </button>
  `).join("");
  toc.innerHTML = items || '<div class="count-text">표시할 조문이 없습니다.</div>';

  $all("#tocList button").forEach(btn => {
    btn.addEventListener("click", () => {
      const el = document.getElementById(btn.dataset.target);
      if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
    });
  });
}

function renderArticles(){
  const filtered = ARTICLES.filter(matchesArticle);
  $("#articleCount").textContent = `총 ${filtered.length.toLocaleString()}개 조문`;
  const host = $("#articleList");
  const tpl = $("#articleTemplate");

  host.innerHTML = "";
  filtered.forEach(article => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.id = article.id;
    node.querySelector(".article-path").textContent = [article.part, article.chapter, article.section].filter(Boolean).join(" · ");
    node.querySelector(".article-title").innerHTML = highlight(article.full_title, state.search);

    const body = node.querySelector(".article-body");
    article.blocks.forEach(block => {
      const div = document.createElement("div");
      div.className = "block";
      div.innerHTML = `
        <div class="block-label">${escapeHtml(block.label || "본문")}</div>
        <div class="block-text">${highlight(block.text, state.search)}</div>
      `;
      body.appendChild(div);
    });

    host.appendChild(node);
  });

  renderTOC(filtered);
}

function quizSummaryText(){
  if(state.quizPreset === "random"){
    return "현재 범위: 랜덤 편 · 장 · 조 전체에서 문제를 섞어서 출제합니다.";
  }

  const bits = [];
  if(state.quizPart) bits.push(`편: ${state.quizPart}`);
  if(state.quizChapter) bits.push(`장: ${state.quizChapter}`);
  if(state.quizArticleStart || state.quizArticleEnd){
    const start = state.quizArticleStart || "시작 미지정";
    const end = state.quizArticleEnd || "끝 미지정";
    bits.push(`조: 제${start}조 ~ 제${end}조`);
  }

  return bits.length
    ? `현재 범위: ${bits.join(" / ")}`
    : "현재 범위: 전체 편 · 장 · 조에서 직접 선택 모드입니다. 조건을 추가하면 해당 범위만 출제됩니다.";
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

    const rawStart = state.quizArticleStart === "" ? null : Number(state.quizArticleStart);
    const rawEnd = state.quizArticleEnd === "" ? null : Number(state.quizArticleEnd);
    const start = rawStart == null || Number.isNaN(rawStart) ? null : rawStart;
    const end = rawEnd == null || Number.isNaN(rawEnd) ? null : rawEnd;

    if(start != null){
      pool = pool.filter(q => q.source_article_num != null && q.source_article_num >= start);
    }
    if(end != null){
      pool = pool.filter(q => q.source_article_num != null && q.source_article_num <= end);
    }
  }

  return pool;
}

function updateQuizStats(){
  $("#quizTotal").textContent = `총 ${QUIZ.length}문제`;
  $("#quizProgress").textContent = `${answered} / ${QUIZ.length}`;
  $("#quizScore").textContent = `정답 ${correct}`;
  $("#quizScopeSummary").textContent = quizSummaryText();
}

function buildSourceBox(q){
  const title = `${q.source_article_no}${q.source_title ? `(${q.source_title})` : ""}`;
  const clause = q.source_clause ? `${q.source_clause} ` : "";
  return `
    <div class="source-ref">${escapeHtml([q.source_part, q.source_chapter, q.source_section].filter(Boolean).join(" · "))}</div>
    <div class="source-ref">${escapeHtml(title)}</div>
    <div>${escapeHtml(clause + q.source_text)}</div>
  `;
}

function lockButtons(container){
  container.querySelectorAll("button").forEach(btn => {
    btn.disabled = true;
    btn.classList.add("locked");
  });
}

function renderQuiz(customPool = null){
  QUIZ = customPool ? [...customPool] : getQuizPool();
  answered = 0;
  correct = 0;
  updateQuizStats();

  const host = $("#quizList");
  const tpl = $("#quizTemplate");
  host.innerHTML = "";

  if(!QUIZ.length){
    host.innerHTML = '<article class="card quiz-card"><div class="quiz-result bad">선택한 범위에 해당하는 문제가 없습니다. 편/장/조 범위를 조금 넓혀 보세요.</div></article>';
    return;
  }

  QUIZ.forEach((q, idx) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.qid = q.id;
    node.querySelector(".quiz-type").textContent = q.type === "ox" ? "OX" : "4지선다";
    node.querySelector(".quiz-meta").textContent = [q.source_part, q.source_chapter, q.source_article_no].filter(Boolean).join(" · ");
    node.querySelector(".quiz-prompt").textContent = `${idx + 1}. ${q.prompt}`;
    node.querySelector(".quiz-statement").textContent = q.statement || q.question || "";
    node.querySelector(".source-body").innerHTML = buildSourceBox(q);
    const options = node.querySelector(".quiz-options");
    const result = node.querySelector(".quiz-result");

    const pushResult = (isRight, extra="") => {
      answered += 1;
      if(isRight) correct += 1;
      updateQuizStats();
      result.className = `quiz-result ${isRight ? "ok" : "bad"}`;
      result.textContent = isRight ? "정답입니다." : `오답입니다.${extra ? " " + extra : ""}`;
    };

    if(q.type === "ox"){
      [["O", true], ["X", false]].forEach(([label, value], index) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = label;
        btn.addEventListener("click", () => {
          lockButtons(options);
          const isRight = value === q.answer;
          btn.classList.add(isRight ? "correct" : "wrong");
          const correctBtn = options.querySelectorAll("button")[q.answer ? 0 : 1];
          if(correctBtn) correctBtn.classList.add("correct");
          pushResult(isRight, `근거 조문은 ${q.source_article_no}${q.source_title ? `(${q.source_title})` : ""}입니다.`);
          node.querySelector("details").open = true;
        });
        options.appendChild(btn);
      });
    } else {
      q.choices.forEach((choice, choiceIndex) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = `${choiceIndex + 1}. ${choice}`;
        btn.addEventListener("click", () => {
          lockButtons(options);
          const isRight = choiceIndex === q.answer_index;
          btn.classList.add(isRight ? "correct" : "wrong");
          const correctBtn = options.querySelectorAll("button")[q.answer_index];
          if(correctBtn) correctBtn.classList.add("correct");
          pushResult(isRight, `정답 근거는 ${q.source_article_no}${q.source_title ? `(${q.source_title})` : ""}입니다.`);
          node.querySelector("details").open = true;
        });
        options.appendChild(btn);
      });
    }

    host.appendChild(node);
  });
}

function bindTabEvents(){
  $all(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $all(".tab").forEach(t => t.classList.remove("active"));
      $all(".tab-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab + "Tab").classList.add("active");
    });
  });
}

function bindManualControls(){
  $("#searchInput").addEventListener("input", e => {
    state.search = e.target.value;
    renderArticles();
  });
  $("#partSelect").addEventListener("change", e => {
    state.part = e.target.value;
    state.chapter = "";
    renderFilters();
    renderArticles();
  });
  $("#chapterSelect").addEventListener("change", e => {
    state.chapter = e.target.value;
    renderArticles();
  });
}

function renderQuizSelectors(){
  const parts = [...new Set(MASTER_QUIZ.map(q => q.source_part).filter(Boolean))];
  const chapters = [...new Set(
    MASTER_QUIZ.filter(q => !state.quizPart || q.source_part === state.quizPart)
      .map(q => q.source_chapter).filter(Boolean)
  )];

  $("#quizPreset").value = state.quizPreset;
  $("#quizPartSelect").innerHTML = '<option value="">전체 편</option>' + parts.map(p =>
    `<option value="${escapeHtml(p)}" ${state.quizPart===p?"selected":""}>${escapeHtml(p)}</option>`
  ).join("");
  $("#quizChapterSelect").innerHTML = '<option value="">전체 장</option>' + chapters.map(c =>
    `<option value="${escapeHtml(c)}" ${state.quizChapter===c?"selected":""}>${escapeHtml(c)}</option>`
  ).join("");
  $("#quizArticleStart").value = state.quizArticleStart;
  $("#quizArticleEnd").value = state.quizArticleEnd;

  const disabled = state.quizPreset === "random";
  ["#quizPartSelect", "#quizChapterSelect", "#quizArticleStart", "#quizArticleEnd"].forEach(sel => {
    $(sel).disabled = disabled;
  });
}

function applyQuizScope(){
  if(state.quizPreset === "custom"){
    const start = state.quizArticleStart === "" ? null : Number(state.quizArticleStart);
    const end = state.quizArticleEnd === "" ? null : Number(state.quizArticleEnd);
    if(start != null && end != null && !Number.isNaN(start) && !Number.isNaN(end) && start > end){
      alert("시작 조는 끝 조보다 클 수 없습니다.");
      return;
    }
  }
  renderQuizSelectors();
  renderQuiz();
}

function resetQuizScope(){
  state.quizPreset = "random";
  state.quizPart = "";
  state.quizChapter = "";
  state.quizArticleStart = "";
  state.quizArticleEnd = "";
  renderQuizSelectors();
  renderQuiz();
}

function bindQuizControls(){
  $("#quizPreset").addEventListener("change", e => {
    state.quizPreset = e.target.value;
    renderQuizSelectors();
    renderQuiz();
  });
  $("#quizPartSelect").addEventListener("change", e => {
    state.quizPart = e.target.value;
    state.quizChapter = "";
    renderQuizSelectors();
  });
  $("#quizChapterSelect").addEventListener("change", e => {
    state.quizChapter = e.target.value;
  });
  $("#quizArticleStart").addEventListener("input", e => {
    state.quizArticleStart = e.target.value;
  });
  $("#quizArticleEnd").addEventListener("input", e => {
    state.quizArticleEnd = e.target.value;
  });
  $("#applyQuizRangeBtn").addEventListener("click", applyQuizScope);
  $("#clearQuizRangeBtn").addEventListener("click", resetQuizScope);
  $("#shuffleBtn").addEventListener("click", () => {
    const shuffled = [...getQuizPool()];
    for(let i = shuffled.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    renderQuiz(shuffled);
  });
  $("#resetBtn").addEventListener("click", renderQuiz);
}

async function init(){
  const [articleRes, quizRes] = await Promise.all([
    fetch("data.json"),
    fetch("quiz.json")
  ]);
  ARTICLES = await articleRes.json();
  MASTER_QUIZ = await quizRes.json();

  enrichArticles();
  enrichQuiz();

  bindTabEvents();
  bindManualControls();
  bindQuizControls();

  renderFilters();
  renderArticles();
  renderQuizSelectors();
  renderQuiz();
}

init().catch(err => {
  document.body.innerHTML = `<main style="padding:24px;font-family:sans-serif">
    <h1>데이터 로딩 실패</h1>
    <p>${escapeHtml(err.message)}</p>
  </main>`;
});
