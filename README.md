# 여신업무방법서 학습앱 개편안

이 묶음은 기존 `index.html` 일체형 구조를 아래처럼 분리한 버전입니다.

- `data.json` : 방법서 조문 데이터
- `quiz.json` : OX + 4지선다 문제 데이터
- `index.html` : 화면
- `styles.css` : 스타일
- `app.js` : 동작 로직
- `parser.py` : 새 HWPX 개정본으로 `data.json`, `quiz.json` 재생성

## 핵심 방향
1. 해설은 별도 서술형이 아니라 **정확한 조문 원문**을 그대로 보여줍니다.
2. 학습자는 정답 여부를 확인한 뒤, **근거 조문을 직접 펼쳐서 확인**합니다.
3. 개정본이 나오면 `parser.py`로 다시 생성하면 됩니다.

## 배포 방법
기존 GitHub Pages 저장소에 아래 파일들을 올리면 됩니다.

- index.html
- styles.css
- app.js
- data.json
- quiz.json

그리고 push 하면 기존 배포 URL은 그대로 유지됩니다.

## 갱신 방법
```bash
python parser.py "여신업무방법서(YYYYMMDD).hwpx" .
```

생성 후 GitHub에 커밋/푸시:
```bash
git add index.html styles.css app.js data.json quiz.json
git commit -m "여신업무방법서 개정 반영 및 학습형 문제 업데이트"
git push
```

## 문제 설계 원칙
- **OX**: "다음 설명이 제X조의 내용이면 O" 방식
- **4지선다**: "다음 중 제X조의 내용으로 옳은 것은?" 방식
- **해설**: 정답 근거 조문을 그대로 표시

## 권장 다음 단계
- 조문별 즐겨찾기
- 랜덤 10문제 시험모드
- 장별 문제 풀기
- 최근 개정 조문 배지 표시
