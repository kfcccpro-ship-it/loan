let ARTICLES = [];
let MASTER_QUIZ = [];
let CURRENT_BATCH = [];
let currentSearch = "";
let currentQuizAnswers = 0;
let currentQuizCorrect = 0;

const state = {
  tab: "manual",
  selectedPart: "",
  selectedChapter: "",
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
  const words = keyword.trim().split(/\s+/).filter(Boolean).sort((a,b) => b.length - a.length);
  let result = safe;
  words.forEach(word => {
    const pattern = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(${pattern})`, "gi"), "<mark>$1</mark>");
  });
  return result;
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

function findPreviewSnippet(text, keyword, size = 140){
  const plain = String(text || "").replace(/\s+/g, " ").trim();
  if(!plain) return "";
  if(!keyword.trim()) return plain.slice(0, size) + (plain.length > size ? "..." : "");

  const words = keyword.trim().split(/\s+/).filter(Boolean);
  const lower = plain.toLowerCase();
  let foundIndex = -1;

  for(const word of words){
    const idx = lower.indexOf(word.toLowerCase());
    if(idx !== -1 && (foundIndex === -1 || idx < foundIndex)) foundIndex = idx;
  }

  if(foundIndex === -1){
    return plain.slice(0, size) + (plain.length > size ? "..." : "");
  }

  const start = Math.max(0, foundIndex - Math.floor(size / 3));
  const end = Math.min(plain.length, start + size);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < plain.length ? "..." : "";
  return prefix + plain.slice(start, end).trim() + suffix;
}

function getGroupedStructure(){
  const map = new Map();
  ARTICLES.forEach(article => {
    const partKey = article.part || "기타";
    if(!map.has(partKey)){
      map.set(partKey, { part: partKey, chapters: new Map(), count: 0 });
    }
    const part = map.get(partKey);
    const chapterKey = article.chapter || "기타";
    if(!part.chapters.has(chapterKey)){
      part.chapters.set(chapterKey, { chapter: chapterKey, count: 0 });
    }
    part.count += 1;
    part.chapters.get(chapterKey).count += 1;
  });

  return Array.from(map.values()).map(part => ({
    ...part,
    chapters: Array.from(part.chapters.values()).sort((a,b) => a.chapter.localeCompare(b.chapter, 'ko'))
  })).sort((a,b) => a.part.localeCompare(b.part, 'ko'));
}

function buildTOC(){
  const groups = getGroupedStructure();
  const html = groups.map(group => `
    <div class="toc-part ${state.selectedPart === group.part ? "open" : ""}">
      <button type="button" class="toc-part-head" data-part="${escapeHtml(group.part)}">
        <span class="toc-part-name">${escapeHtml(group.part)}</span>
        <span class="toc-part-meta">
          <span>${group.count}조</span>
          <span class="toc-arrow">▶</span>
        </span>
      </button>
      <div class="toc-chapters">
        ${group.chapters.map(chapter => `
          <button type="button" class="toc-chapter ${state.selectedPart === group.part && state.selectedChapter === chapter.chapter ? "active" : ""}" data-part="${escapeHtml(group.part)}" data-chapter="${escapeHtml(chapter.chapter)}">
            <span class="toc-chapter-name">${escapeHtml(chapter.chapter)}</span>
            <span class="toc-chapter-count">${chapter.count}조</span>
          </button>
        `).join("")}
      </div>
    </div>
  `).join("");

  $("#tocList").innerHTML = html;

  $all(".toc-part-head").forEach(btn => {
    btn.addEventListener("click", () => {
      const part = btn.dataset.part;
      if(state.selectedPart === part){
        state.selectedPart = "";
        state.selectedChapter = "";
      } else {
        state.selectedPart = part;
        state.selectedChapter = "";
      }
      buildTOC();
      renderManual();
    });
  });

  $all(".toc-chapter").forEach(btn => {
    btn.addEventListener("click", () => {
      state.selectedPart = btn.dataset.part;
      state.selectedChapter = btn.dataset.chapter;
      buildTOC();
      renderManual();
    });
  });
}

function matchesManual(article){
  const keywordOk = !currentSearch.trim() || [
    article.part, article.chapter, article.section, article.article_no, article.title, article.full_text
  ].join(" ").toLowerCase().includes(currentSearch.trim().toLowerCase());

  const partOk = !state.selectedPart || article.part === state.selectedPart;
  const chapterOk = !state.selectedChapter || article.chapter === state.selectedChapter;

  return keywordOk && partOk && chapterOk;
}

function renderManual(){
  const filtered = ARTICLES.filter(matchesManual);
  const host = $("#articleList");
  const tpl = $("#articleTemplate");

  const activeScope = [
    state.selectedPart || null,
    state.selectedChapter || null
  ].filter(Boolean).join(" · ");

  if(currentSearch.trim()){
    $("#articleCount").textContent = `검색 결과 ${filtered.length.toLocaleString()}개 조문`;
    $("#searchSummary").innerHTML = `<strong>${escapeHtml(currentSearch)}</strong> 검색 결과를 미리보기 카드로 보여줍니다.`;
  } else if(activeScope){
    $("#articleCount").textContent = `${activeScope} · ${filtered.length.toLocaleString()}개 조문`;
    $("#searchSummary").textContent = "목차에서 선택한 범위의 조문을 보여줍니다.";
  } else {
    $("#articleCount").textContent = `전체 ${ARTICLES.length.toLocaleString()}개 조문`;
    $("#searchSummary").textContent = "키워드를 입력하거나 목차에서 편·장을 선택해 조문을 살펴보세요.";
  }

  host.innerHTML = "";
  if(!filtered.length){
    host.innerHTML = `<div class="card empty-state">입력한 키워드 또는 선택한 범위와 일치하는 조문이 없습니다.</div>`;
    return;
  }

  filtered.forEach(article => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.id = article.id;
    node.querySelector(".article-path").textContent = [article.part, article.chapter, article.section].filter(Boolean).join(" · ");
    node.querySelector(".article-title").innerHTML = highlight(article.full_title, currentSearch);
    node.querySelector(".article-preview").innerHTML = highlight(findPreviewSnippet(article.full_text, currentSearch, 170), currentSearch);

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

function quizPromptText(item){
  if(item.type === "ox"){
    return "아래 문장이 맞는지 판단하세요.";
  }
  return "옳은 내용을 고르세요.";
}

function quizStatementText(item){
  if(item.type === "ox"){
    return item.statement || "";
  }
  return "";
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
    node.querySelector(".quiz-meta").textContent = `${item.source_article_no}${item.source_title ? `(${item.source_title})` : ""}`;
    node.querySelector(".quiz-prompt").textContent = quizPromptText(item);

    const statementHost = node.querySelector(".quiz-statement");
    const optionsHost = node.querySelector(".quiz-options");
    const resultHost = node.querySelector(".quiz-result");
    const sourceHost = node.querySelector(".source-body");

    if(item.type === "ox"){
      statementHost.textContent = quizStatementText(item);
      [["O", true], ["X", false]].forEach(([label, value]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "option-btn";
        btn.textContent = label;
        btn.addEventListener("click", () => handleQuizAnswer(index, value, node));
        optionsHost.appendChild(btn);
      });
    } else {
      statementHost.remove();
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
    return Boolean(item.answer);
  }
  return item.answer_index;
}

function lockQuizCard(node, userAnswer, isCorrect){
  const buttons = Array.from(node.querySelectorAll(".option-btn"));
  const item = CURRENT_BATCH[Number(node.dataset.index)];
  const answerValue = correctAnswerValue(item);

  buttons.forEach(button => {
    const buttonValue = item.type === "ox"
      ? button.textContent === "O"
      : Number(button.textContent.split(".")[0]) - 1;

    button.classList.add("locked");
    button.disabled = true;

    if(buttonValue === answerValue){
      button.classList.add("correct");
    }
    if(buttonValue === userAnswer && !isCorrect){
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
    ? "정답입니다. 아래의 정확한 조문으로 기준 문구를 확인해 보세요."
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
  buildTOC();
  renderManual();
  renderQuizFilters();
  makeQuizBatch();
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif">데이터를 불러오지 못했습니다. 파일 경로와 GitHub Pages 배포 상태를 확인해 주세요.</div>`;
});
