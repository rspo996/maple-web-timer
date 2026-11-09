# 수동 재획 타이머 (묶음 2) 구현 계획

**목표:** 화면을 보지 않는 카운트다운·사냥/회수 반복 타이머를 탭을 숨긴 채 소리·음성으로 알린다(스펙 `2026-11-09-2-manual-timers-design.md`, 15·16·17절이 본문보다 우선).

**실행 방식:** 메인 세션에서 직접 구현한다(사용자 결정). 그래서 이 계획은 묶음 1처럼 코드 전체를 담지 않고 태스크·인터페이스·정한 것·시험만 적는다. 태스크마다 실패하는 시험을 먼저 쓰고, 구현하고, `node --test`와 브라우저 시나리오를 돌린 뒤 커밋한다.

**기반(묶음 1에서 이미 있음) [확인]:** `main.js`가 Worker 메시지마다 `manualTick(Date.now())`를 `tick()`보다 먼저 부르고 `manualInit`이 있으면 부른다. `ui-watch.js`의 `titlePrefix`, `#watchManual` 자리, `slotsOf`의 `manual.*` 4개(수동 파일이 없으면 숨김), 예약 접두어 `manual`·`m\d+`(고아 정리 제외), `Alerts.fire`의 `group:null` 즉시 전달.

## 파일

| 파일 | 책임 |
|---|---|
| `js/manual-core.js` (새, 순수) | 타이머 모델·상태 전이·`manualStep`·저장 읽기/내보내기/불러오기·문구 |
| `js/manual-ui.js` (새) | 패널, 카드, 저장, `manualInit`·`manualTick`, 상태줄 `#watchManual`·탭 제목 접두·`#soundLock` |
| `tests/manual.test.js` (새) | 순수 함수 시험 |
| `tests/browser/manual.mjs` (새) | 가짜 시계로 패널·알림·정책·새로고침·늦은 판정 |
| `index.html`, `css/app.css` | 패널 자리(왼쪽 열 미리보기 아래), 스크립트 두 개, `#soundLock`, `#watchManual role=timer` |
| `js/alerts.js` | `SOUNDS.timer`(같은 음 두 번) |
| `js/targets.js` | `MANUAL_SLOTS` 라벨을 스펙 6.1대로 |
| `js/sounds.js` | `manual.*` 슬롯 미리듣기 |

## 인터페이스 (`manual-core.js`)

```
Timer = {id:'m<n>', label, kind:'countdown'|'routine', phases:[{name,sec}], idx, cycles,
         status:'idle'|'running'|'paused'|'done', endAt, remainMs, preSec, preDone, preHeard, doneAt}
Store = {v:1, seq, prefs:{preSec}, presets:[{id,label,sec}], timers:[Timer]}

manualNew(store, kind, label, phases, preSec) -> Timer          // id = 'm'+(++seq), 이름이 겹치면 뒤에 번호
manualStart(t, now) / manualPause(t, now) / manualReset(t) / manualAdjust(t, deltaMs, now) -> Timer'
manualStep(t, now, audible) -> {t, events:[{type:'pre'|'end'|'switch', idx, late, lateMs, silent, slot}]}
manualRemainMs(t, now), manualFmt(ms)
manualLoad(raw) -> {store, ok}        // 저장값 읽기(실행 상태 포함). 깨졌으면 빈 저장소, ok:false
manualExport(store) -> object          // 정의만(묶음 5 백업)
manualImport(obj) -> {store, ok}       // 모두 idle
manualText(t, ev, timers) -> string    // 4.5 문구
```

## 정한 것 (스펙에 없거나 해석이 필요한 곳)

1. **무음 판정(16·17-1):** 끝·전환은 그 주기의 `preHeard`가 참이면 `silent:true`(화면만 바뀜). `preHeard`는 미리 알림을 실제로 보냈고 그때 오디오가 `running`이었을 때만 참. 한 틱에 경계를 둘 이상 지나면 마지막으로 끝난 구간의 미리 알림은 들리지 않은 것이므로 `silent:false`.
2. **늦은 판정(17-5):** `lateMs = now - 마지막으로 지난 경계`. 15초 초과면 `late:true`이고 소리를 내지 않으며 상태줄에 안내만 한다. 이벤트는 경계 수와 관계없이 하나.
3. **경계 처리 뒤 같은 틱에서는 새 구간의 미리 알림을 보지 않는다.** 다음 틱에서 6.2 규칙(창 안 3초 넘게 늦으면 건너뜀)으로 판정한다.
4. **루틴 이름 접두(17-8):** 루틴이 둘 이상이면 미리 알림뿐 아니라 전환 문구에도 루틴 이름을 붙인다(`사냥·회수 2, 회수 시간이에요`). 두 루틴의 같은 전환 문구가 8초 중복 억제로 하나만 들리는 것을 막으려는 것이다.
5. **이름 중복:** 만들 때 같은 이름이 있으면 뒤에 ` 2`, ` 3`을 붙인다(기본 이름·직접 입력 모두). 고치기로 바꿀 때 겹치면 거절한다. 이름 1–20자.
6. **고치기에서 길이를 바꾸면 그 타이머는 처음부터(대기)로 돌아간다.** 길이는 실행 중이 아닐 때만 고친다(스펙 4.3).
7. **상태줄:** 실행 중(남은 시간 짧은 순) 다음 멈춤(`(멈춤)`) 순으로 2개까지, 나머지는 `+N`. 루틴은 지금 구간 이름, 카운트다운은 타이머 이름을 쓴다.
8. **프리셋 칩 이름:** `5분 타이머`, `1시간 타이머`처럼. 사용자 프리셋은 그 프리셋 이름을 쓴다.
9. **구간 하한 10초, 타이머 상한 8개, 미리 알림 0–120초.**

## 태스크

1. **`manual-core.js` 상태 전이:** `manualNew`·`manualStart`·`manualPause`·`manualReset`·`manualAdjust`·`manualRemainMs`·`manualFmt`. 시험: 시작 뒤 남은 시간, 일시정지 동안 줄지 않음, 계속하면 `endAt=now+remainMs`, ±조절 창 안/밖 `preDone`·`preHeard`, 0 아래로 안 감, `manualFmt` 올림·시간 단위, 이름 번호.
2. **`manualStep`:** 카운트다운 pre 한 번·end 한 번·done 뒤 이벤트 없음, 짧은 구간 pre 없음, 틱 늦어 pre 건너뜀, 정책(들렸으면 end 무음 / 0초면 end 울림 / 짧은 구간 end 울림 / 건너뛴 pre면 end 울림 / 오디오 잠김이면 end 울림), 루틴 1→2→1·`cycles`·드리프트 없음·전환 뒤 `preHeard` 초기화, 늦음 14.9/15.1초, 한 틱 여러 경계 하나의 이벤트와 수식 일치, 슬롯 `next1`/`next2`.
3. **저장·문구:** `manualLoad`(깨짐·`v` 불일치·필드 보정), `manualExport`(실행 상태 뺌), `manualImport`(모두 idle), `manualText`(4.5 문구, 루틴 둘 이상 접두).
4. **패널 UI와 틱 연결:** `manual-ui.js`, `index.html`, `css/app.css`, `SOUNDS.timer`. 프리셋 칩 한 번에 시작, 직접 입력·프리셋으로 저장·프리셋 지우기, 루틴 만들기, 카드(일시정지/계속·처음부터·±조절·삭제 두 번 누르기·고치기·끝난 것 모두 지우기), 8개 상한, 저장·복원, `manualTick`에서 `Alerts.fire`(`src:'manual'`, `slot:'manual.<ev>'`, `flash:'manual-<id>'`, `group:null`), 늦은 판정 안내.
5. **상태줄·탭 제목·소리 잠김:** `#watchManual`(문자열이 바뀔 때만), `titlePrefix`(가장 짧게 남은 실행 중 타이머), `#soundLock`(실행 중 타이머가 있고 오디오가 `running`이 아닐 때, `[소리 켜기]`, 첫 `pointerdown`·`keydown`에서 켬).
6. **소리 슬롯:** 라벨(미리 알림·타이머 끝·구간 1 → 구간 2·구간 2 → 구간 1), 미리듣기 문구.
7. **최종 확인:** 모든 단위 시험과 묶음 1 시나리오 전부, `tests/browser/manual.mjs`.

## 손으로 볼 것 (자동 확인 불가)

- 실제로 탭을 숨긴 채 30초 타이머가 ±1초 안에 들리는지, 노트북 잠자기 복귀, 시스템 시계 변경, 화면 낭독기가 `#watchManual`을 초마다 읽지 않는지(스펙 11.2).
