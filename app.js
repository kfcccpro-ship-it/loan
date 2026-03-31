let data = [];
let quiz = [];

fetch("data.json").then(r=>r.json()).then(d=>data=d);
fetch("quiz.json").then(r=>r.json()).then(d=>quiz=d);

function setTab(tab){
  document.getElementById("searchTab").style.display = tab==="search"?"block":"none";
  document.getElementById("quizTab").style.display = tab==="quiz"?"block":"none";
}

function runSearch(){
  let input = document.getElementById("searchInput");
  let keyword = input.value;
  input.blur(); // 🔥 키보드 내려감

  let results = data.filter(d => d.full_text.includes(keyword));

  let html = results.map(r => {
    let text = r.full_text.replaceAll(keyword, `<mark>${keyword}</mark>`);
    return `<div><b>${r.article_no}</b><br>${text}</div>`;
  }).join("");

  document.getElementById("results").innerHTML = html;

  if(results.length>0){
    document.getElementById("results").scrollIntoView({behavior:"smooth"});
  }
}

function openToc(){
  alert("목차 기능 (추후 확장)");
}

// 🔥 문제 품질 필터
function valid(q){
  if(q.source_text.includes("부칙")) return false;
  if(q.source_text.length < 10) return false;
  if(q.statement && q.statement.length < 10) return false;
  return true;
}

function startQuiz(){
  let filtered = quiz.filter(valid);

  let q = filtered[Math.floor(Math.random()*filtered.length)];

  let html = `
  <div>
    <b>${q.source_article_no}</b><br>
    ${q.statement || "문장 없음"}
    <br><br>
    <button onclick="answer(true)">O</button>
    <button onclick="answer(false)">X</button>
  </div>
  `;

  document.getElementById("quizArea").innerHTML = html;
}

function answer(v){
  alert("결과 확인 (조문 직접 확인)");
}
