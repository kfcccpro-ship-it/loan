# MG인재개발원 - 여신업무방법서 학습용 웹앱

이 패키지는 `여신업무방법서`의 비정기 개정에 대응할 수 있도록 **디자인과 데이터 구조를 분리**한 웹앱입니다.

## 핵심 원칙

- `방법서 검색` 화면은 기존 사용자가 익숙한 **구버전 검색 UI 흐름을 최대한 유지**합니다.
- 첫 화면은 `방법서 검색` / `학습용 문제`를 병렬로 제공합니다.
- 원본 방법서가 개정되면 `data.json`만 다시 생성해서 반영할 수 있습니다.
- 검색, 목차, 즐겨찾기, 학습용 문제는 모두 `data.json`을 기준으로 동작합니다.

## 포함 파일

- `index.html` : 메인 화면 및 검색/학습 UI
- `styles.css` : 화면 스타일
- `app.js` : 검색/목차/즐겨찾기/학습용 문제 로직
- `data.json` : 편/장/조 구조의 방법서 데이터
- `quiz.json` : 예비용 문제 데이터
- `.nojekyll` : GitHub Pages 설정
- `scripts/build_data.py` : HWPX -> data.json 재생성 스크립트
- `source/current_manual.hwpx` : 현재 원본 파일

## GitHub 업로드

1. `loan` 저장소로 이동
2. 기존 파일을 이 패키지 파일로 교체 업로드
3. Commit
4. `https://kfcccpro-ship-it.github.io/loan/?v=20260331` 형식으로 확인

## 방법서 개정 시 업데이트

1. `source/current_manual.hwpx`를 새 파일로 교체
2. 아래 명령으로 데이터 재생성

```bash
python scripts/build_data.py source/current_manual.hwpx data.json
```

3. 변경된 `data.json`과 웹앱 파일을 다시 업로드

## 학습용 문제 구성

- 조 단위 / 장 단위 / 편 단위 선택 가능
- 편/장 범위 혼합 선택 가능
- 기본 시작은 OX 10문제
- OX 완료 후 다시 OX 점검 또는 4지선다형 이동 가능
- 기본값은 `다시 OX 점검`
