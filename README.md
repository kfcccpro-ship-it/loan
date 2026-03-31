# MG 여신업무방법서 학습앱

여신업무방법서 기반의 학습용 웹앱입니다.

## 포함 파일

- `index.html` : UI 구조
- `styles.css` : 반응형 스타일
- `app.js` : 검색 / 목차 필터 / 퀴즈 로직
- `data.json` : 조문 데이터
- `quiz.json` : 학습용 문제 데이터
- `.nojekyll` : GitHub Pages 설정

## 주요 기능

1. 키워드 검색
   - 조문 제목/내용/키워드 검색
   - 검색어 하이라이트
   - 검색 후 모바일 키보드 자동 내려감

2. 목차 검색
   - 모달 방식
   - 편/장 선택 후 해당 범위 필터링

3. 학습용 문제
   - OX / 객관식 지원
   - 정답 확인 후 해설 및 관련 조문 표시
   - `부칙`, `시행일`, `경과조치` 포함 문제는 자동 제외 처리 가능

## 데이터 형식

### data.json

```json
{
  "articles": [
    {
      "id": 1,
      "part": "제1편 총칙",
      "chapter": "제1장 기본사항",
      "title": "제1조 목적",
      "body": "조문 본문",
      "keywords": ["키워드1", "키워드2"]
    }
  ]
}
```

### quiz.json

```json
{
  "quizzes": [
    {
      "id": 1,
      "type": "ox",
      "question": "문항",
      "answer": "O",
      "explanation": "해설",
      "articleTitle": "관련 조문 제목",
      "articleBody": "관련 조문 내용"
    }
  ]
}
```

## GitHub 업로드 순서

1. `loan` 저장소 접속
2. `Add file` → `Upload files`
3. 아래 파일 전체 업로드
   - `index.html`
   - `styles.css`
   - `app.js`
   - `data.json`
   - `quiz.json`
   - `README.md`
   - `.nojekyll`
4. Commit 후 GitHub Pages 반영 확인

## 반영 확인

- `https://kfcccpro-ship-it.github.io/loan/?v=20260331`

## 주의

- 반드시 `loan` 저장소에 업로드
- 캐시 문제 시 `?v=` 값을 변경해서 확인
