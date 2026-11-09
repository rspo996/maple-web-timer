---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["src/styles/app.css"]
---

# 메이플 재획 알리미 · 메인 화면 (index.html)

## 범위와 모드

- 범위: `index.html` 한 화면 전체(헤더·감시 상태창·게임 화면·감지 대상·수동 타이머·설명서·소리·백업)와 작은 창(PiP) 스타일.
- 모드: Operate. 설정과 등록을 하고, 탭을 숨기기 직전에 "감시 중"을 확인하는 화면이다. 사냥 중에는 보지 않는다.

## 사용자 요청 (2026-11-09)

- "메이플스토리스러운 디자인." 핵심 네 가지를 모두 골랐다: 게임 창 느낌, 버프 아이콘·게이지, 통통한 글자·숫자, 밝은 색감.
- 톤: 밝은 톤(예전 게임 창 느낌)과 어두운 톤(요즘 게임 창 느낌) 둘 다, 시스템 설정을 따른다.
- 범위: 배치까지 바꿔도 된다. 기능과 문구는 그대로 둔다. 테스트가 참조하는 id는 유지한다.
- 선: 실제 게임 에셋(로고·캐릭터·UI 이미지·공식 서체)은 쓰지 않는다. 분위기를 떠올리게 하는 독자 디자인이다.

## Direction contract

THESIS: 회색 설정 대시보드(흰 카드에 주황 버튼 하나)를 버리고, 2D 판타지 MMO의 게임 창 언어로 다시 짠다. 컨트롤은 표준 그대로 두고, 세계는 글꼴·색·밀도·대표 장치 하나로만 들어온다.

OWN-WORLD: 밝은 톤은 하늘색 바탕, 나무 갈색 테두리와 밝은 안쪽 베벨, 주황 제목 줄, 따뜻한 흰 창 본문, 갈색 잉크. 어두운 톤은 짙은 남색 바탕, 남색 창에 밝은 파랑 안쪽 테두리, 금색 제목 글자. 공통으로 제목·상태·시간은 둥글고 통통한 Jua(숫자 폭을 맞춘 개조판), 본문은 시스템 고딕. 버튼은 안쪽 아래 베벨이 있는 통통한 버튼.

STORY: 연결 → 등록 → 상태창에서 "감시 중"과 대상 상태를 확인 → 탭을 숨긴다. 버프 슬롯과 게이지만 보고 준비가 됐는지 안다.

FIRST VIEWPORT: 헤더 왼쪽에 워드마크, 오른쪽에 게임 화면 연결(주된 버튼)·보조 버튼·소리 묶음. 그 아래 전체 폭 상태창(보석 표시등, 큰 상태 글자, 대상 목록, 감시 끝내기). 본문 2열: 왼쪽 넓은 "게임 화면" 창(미리보기), 오른쪽 "감지 대상 N개" 창(버프 슬롯 목록)과 그 아래 "수동 타이머" 창. 설명서·소리·백업 창은 왼쪽 열 아래.

FORM: 사용자가 정한 방향(메이플스토리풍 게임 창). 대표 장치는 "버프 슬롯 + 게이지": 대상 아이콘은 베젤 슬롯에 들어가고, 전체 길이를 아는 대상(지속시간을 아는 버프, 수동 타이머)은 남은 비율만큼 게이지가 줄어들며 곧 끝나면 빨갛게 바뀐다. 남은 시간 숫자는 외곽선이 있는 통통한 숫자. seed: none (user-pinned) — 사용자가 방향을 직접 정해서 추첨(concept-seed)을 돌리지 않았다. 추첨이 실패한 것이 아니다. 근거: impeccable 4.8.1 reference/new-work.md:61 "A session that reaches directions or comps without concept-seed having run (a direction the user or brief pinned) reads the mode's file instead" → mode-operate.md를 읽고 따랐다.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 정한 것

- 카드 토글의 "펼치기 ▾ / 접기 ▴"와 상태줄·탭 제목의 "⏱"는 그대로 둔다(사용자 결정, 2026-11-09). 기존 문구이고, 탭 제목에는 그림을 넣을 수 없다. 마감 리뷰가 기호 아이콘으로 지적했지만 사용자가 "이대로 둬"라고 정했으니 다시 고치자고 하지 않는다.

## 미정

- 호스팅할 곳(PRODUCT.md). 서체 파일은 프로젝트 안(`src/fonts/`)에 두고 빌드에 포함한다.
