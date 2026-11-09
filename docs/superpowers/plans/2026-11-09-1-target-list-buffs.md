# 감지 대상 목록 · 버프 종료 알림 · 알림 묶기 (묶음 1) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고정된 솔 야누스·부스터·룬 3개를 사용자가 추가·삭제·이름 변경·순서 변경할 수 있는 감지 대상 목록으로 바꾸고, 버프를 직접 등록해 종료 전 알림을 받으며, 비슷한 때 끝나는 버프의 미리 알림을 묶고(기본 꺼짐), `index.html` 한 파일을 `css/`·`js/` 여러 파일로 나눈다.

**Architecture:** 먼저 동작을 바꾸지 않고 `index.html`을 줄 번호로 기계적으로 잘라 클래식 `<script src>` 파일로 나눈다(ES 모듈·빌드 없음, `file://`에서 동작). 순수 계산(상태기계, 저장소, 묶기 계획)은 `node --test`로 먼저 시험하고, 화면 동작은 가짜 화면 공유(`tests/browser/`)로 시험한다. 종류별 동작은 `KINDS` 등록부 한 곳에, 모든 알림은 `Alerts.fire` 한 곳에 모아 묶음 2~5가 꽂힐 자리를 만든다.

**Tech Stack:** 브라우저 JavaScript(클래식 스크립트), Node 22 `node:test`/`node:vm`(의존성 없음), 검증용 `ego-browser` + `python3 -m http.server`.

**스펙:** `docs/superpowers/specs/2026-11-09-1-target-list-buffs-design.md` (14·15·16절이 본문보다 우선), `docs/superpowers/specs/2026-11-09-feature-expansion-overview.md` (3·6·7절). 묶음 2~5 스펙은 이 계획이 지켜야 할 계약(`KINDS` 필드, `Alerts` 함수, `slotsOf`, `loadStore`, `targetSnapshot`, `grab()`, `init*()` 순서)을 확인하는 데만 읽었다.

**상태 표기:** 이 문서의 "[확인]"은 계획을 쓰며 직접 실행하거나 파일을 열어 본 것, "[추정]"은 그렇지 못한 것이다. 이 문서의 모든 코드 블록(전체 파일·diff)은 임시 저장소에서 Task 순서대로 적용해 단위 테스트와 브라우저 시나리오를 통과시킨 것이고, 블록을 순서대로 다시 적용하면 최종 트리가 그 저장소와 같음을 확인했다 [확인]. "Expected"의 통과·실패 개수와 `RESULT` 줄도 단계별 상태에서 실제로 돌려 얻은 값이다 [확인]. 브라우저 시나리오의 대기 시간은 이 Mac의 `ego-browser` 기준이라 느린 환경에서는 모자랄 수 있다 [추정]. 대상은 `feat/feature-expansion`의 `index.html`(803줄)이다.

---

## 먼저 알아 둘 것 (스펙·요청과 다른 점)

1. **[확인] 내장 아이콘 base64가 있는 줄은 249–260행이 아니라 271행과 274행이다.** 249–260행은 `stepCountdown`이다. 분리 스크립트(Task 2)가 271·274행만 따로 꺼내 `js/preset-data.js`로 만들고, 앵커 검사로 줄 번호가 맞는지 확인한다.
2. **[확인] Node 22.22에서 `node --test tests/`는 실패한다**(디렉터리를 모듈로 읽으려다 `ERR_TEST_FAILURE`). 그래서 이 계획은 `node --test`(자동 탐색: `tests/*.test.js`)를 쓴다.
3. **브라우저 검증 포트는 8765가 아니라 8766이다.** 검증 시작 때마다 그 origin의 `localStorage`와 IndexedDB를 지운다. 8765 origin에는 평소 쓰는 설정·내 소리가 있을 수 있어 [추정], 실제로 8765에서 열어 보니 내 소리 슬롯(`sol.pre`)이 이미 들어 있었다 [확인]. 서버만 다른 포트로 띄울 뿐 나머지는 요청대로다.
4. **`js/kinds.js`를 새로 둔다.** 스펙 8.1은 `KINDS`를 `targets.js`에 두지만, 모델·저장소(`targets.js`)와 종류별 동작(`kinds.js`)을 한 파일에 넣으면 600줄이 넘는다. 전역 이름과 호출 계약은 스펙 그대로다.
5. **스펙의 함수 시그니처에 인자를 덧붙인 곳**: `KINDS[k].status/stripState(t, st, now, ctx)`(ctx = `{src, frame}`), `detect/step(…, ctx)`, `AlertReq.group.order`, `Alerts.drop(id)`·`Alerts.clear()`·`Alerts.setAudioOut(node)`, `planGroup(fired, targets, states, KINDS, now, windowSec)`(위치 인자). 모두 끝에 덧붙인 것이라 스펙의 호출은 그대로 된다.
6. **스펙 16-9에 따라 뺀 것**: 배율 고정(`hint`), 격틱 검색, `cost()` 경고, 5.2의 "같은 아이콘 안내". 대상별 감지 시간 표시·틱 느림 알림·`matchTemplate` 버퍼 재사용만 한다(Task 20).
7. **눈에 보이는 변화(스펙 5.5·5.6 때문)**: 카드가 기본으로 접힌다(등록이 필요한 카드만 펼침). 헤더 부제가 `감지 대상 N개`가 된다. 알림 묶기는 설정에서 켜기 전에는 지금처럼 따로 울린다.

## 공통 규칙

**실행 위치:** 저장소 루트 `/Users/song/dev/maple-web-timer`, 브랜치 `feat/feature-expansion`. 시작할 때 `git status --short`가 비어 있어야 한다.

**단위 테스트:** `node --test` (저장소 루트에서). 한 파일만: `node --test tests/util.test.js`. 요약만 보려면 `node --test 2>&1 | grep -E "^# (pass|fail)"`.

**브라우저 검증 준비** (UI 단계에서 쓴다):

```bash
cd /Users/song/dev/maple-web-timer
ego-browser skill > /dev/null          # 설치된 버전의 사용법을 한 번 읽어 둔다(출력 마지막 줄이 "end of guide"인지 확인)
python3 -m http.server 8766 --bind 127.0.0.1 >/dev/null 2>&1 &    # 검증이 끝나면 pkill -f "http.server 8766"
runb() { sed "s|__ROOT__|$PWD|g" "$1" | ego-browser nodejs 2>&1 | grep -E "PASS|FAIL|RESULT|Error|감시|감지"; }
```

- 셸 함수(`runb`)와 백그라운드 서버는 도구 호출마다 사라질 수 있다. 새 셸에서는 위 세 줄을 다시 실행하되 서버가 이미 떠 있으면(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8766/index.html`이 `200`) `python3 -m http.server` 줄은 건너뛴다.
- 시나리오는 `tests/browser/*.mjs`이고 `runb tests/browser/regression.mjs`처럼 **한 명령에 하나씩** 돌린다(연달아 돌리면 출력이 비는 일이 있었다 [확인]. 비면 다시 돌린다).
- 모든 시나리오는 `PASS`/`FAIL` 줄과 `RESULT N passed, M failed` 한 줄을 낸다. `FAIL` 줄 끝의 `<-` 뒤가 실제 값이다.
- 시나리오는 시작할 때 `http://127.0.0.1:8766`의 저장소를 비우고 필요한 데이터를 넣는다(`tests/browser/prelude.mjs`의 `open`). 가짜 화면 공유는 `tests/browser/fake-screen.js`(1280×720 캔버스를 150ms마다 다시 그리고 `getDisplayMedia`를 `captureStream(5)`로 바꿈, `Date.now`를 앞당기는 `__fake.skew`, 음성·비프 기록).

**diff 적용:** 이 문서의 ` ```diff ` 블록은 `git apply`로 적용한다.

```bash
git apply --whitespace=nowarn <<'PATCH'
(블록 내용을 그대로 붙여 넣는다)
PATCH
```

적용이 실패하면 앞 Task의 결과가 이 문서와 다르다는 뜻이다. 같은 내용으로 직접 편집해도 된다. 새 파일이나 "전체 교체" 블록은 그 내용을 그대로 파일로 쓴다.

**커밋:** 모든 Task의 마지막 단계다. 메시지는 한국어, 마지막 줄은 아래 `Co-Authored-By`다.

```bash
git commit -F - <<'EOF'
제목

본문

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## 파일 구조 (분리 뒤 최종)

| 파일 | 책임 | 순수? | 만드는 Task |
|---|---|---|---|
| `index.html` | 마크업 + `<link>` + `<script src>` 13→14개 | | 2, 8, 11, 13–15, 19 |
| `css/app.css` | 현재 `<style>` 전체 + 새 UI 규칙 | | 2, 13–15, 19 |
| `js/util.js` | `$`, `fmt`, `parseDur`, `clampInt`, `batchim/eunNeun/eulReul`, `checkDurLead`, `ui` 저장 | 예 | 2, 3, 8 |
| `js/match.js` | `toGray`, `prepTemplate`, `matchTemplate`(버퍼 재사용) | 예 | 2, 3, 20 |
| `js/detect-core.js` | `stepDetector`, `stepCountdown`, `ocrSevenSeg`, `newState` | 예 | 2, 3, 7 |
| `js/preset-data.js` | `PRESET_ICONS`(내장 아이콘 data URL 4개) | | 2 |
| `js/targets.js` | `BUILTIN`/`PRESETS`, 저장소(`loadStore`/`migrateV1`/`normalizeTarget`), 추가·이름·순서·삭제 계산, `slotsOf`/`orphanSlots`, `summarizeStrip`, `targetSnapshot`, 실행 중 `store` | 예(상단) | 2, 8–16 |
| `js/kinds.js` | `KINDS` 등록부(`buff`/`countdown`/`rune`), `registerKind`, `cardStatus` | 예 | 8 |
| `js/alerts.js` | `SOUNDS`, `beep`, `speak`, `planGroup`/`groupText`, `createAlerts`/`Alerts` | 예(일부) | 2, 10, 11, 17, 18 |
| `js/sounds.js` | 내 소리(IndexedDB), 소리 설정 화면, 고아 정리, 묶기 설정 라디오 | | 2, 10, 11, 12, 19 |
| `js/capture.js` | `src`, `grab()`→`{frame,fresh}`, `health`, 연결/끝내기/스크린샷 | | 2, 11, 19 |
| `js/detect-run.js` | `states`, `detectTemplate`, `tick`, 이벤트 모으기·보내기, `createSlowWatch` | | 2, 11, 19, 20 |
| `js/ui-cards.js` | 카드, 대상 추가 메뉴, 삭제(되돌리기)·이름·순서, 접힘 | | 2, 11, 13–15, 20 |
| `js/ui-watch.js` | 상태줄 요약, `snapshotNow`, `baseTitle`, `setNote` | | 2, 11, 16 |
| `js/register.js` | 미리보기, 드래그 등록(`steps/validate/save`), 차례로 다시 등록 | | 2, 11, 13, 15, 16 |
| `js/main.js` | 부팅(필수 전역 검사, `init*()` 순서, Worker) | | 2, 11 |
| `tests/load.js` | 클래식 스크립트를 한 전역(vm)에 올리는 시험 도구 | | 8 |
| `tests/*.test.js` | 단위 시험 | | 4–20 |
| `tests/browser/*` | 가짜 화면·준비·시나리오 | | 1, 11–21 |

묶음 2~5가 나중에 더할 파일(`manual-*.js`, `idle.js`, `cooldown.js`, `audio.js`, `pip.js`, `backup.js`)은 `main.js` 앞에 끼우면 되고, `main.js`는 `manualInit`·`audioInit`·`pipInit`·`backupInit`이 있으면 부른다(Task 11).

## Task 목록

| # | Task | 단계 |
|---|---|---|
| 1 | 브라우저 검증 도구와 지금 동작의 기준선 | A |
| 2 | `index.html`을 파일로 분리(동작 변화 없음) | A |
| 3 | 순수 파일에 `module.exports` 가드 | A |
| 4 | `util.js` 회귀 테스트 | B |
| 5 | `matchTemplate`·`ocrSevenSeg` 회귀 테스트 | B |
| 6 | `stepDetector`·`stepCountdown` 회귀 테스트 | B |
| 7 | 부스터 당겨 알림 뒤 재무장 수정(스펙 16-1) | C |
| 8 | `KINDS` 등록부 | C |
| 9 | 저장소 v2 · `migrateV1` · `normalizeTarget` · `loadStore` | C |
| 10 | `Alerts` 경로(`notify`/`fire`/`fireSystem` 대체) | D |
| 11 | 런타임을 대상 목록·`KINDS`로 전환 | E |
| 12 | 동적 `slotsOf` · 고아 소리 정리 | E |
| 13 | 대상 추가 메뉴 · 기본 제공 복원 · 첫 등록 취소 시 삭제 | F |
| 14 | 삭제(10초 되돌리기) · 이름 바꾸기 · 순서 | F |
| 15 | 접힌/펼친 카드 · 미리보기 점선 · 부제 · 설명서 | F |
| 16 | 상태줄 요약 · 차례로 다시 등록 | F |
| 17 | `planGroup` · `groupText` | G |
| 18 | `Alerts` 묶기 대기열(`flush`/`configure`) | G |
| 19 | 묶기 연결: 당겨 알림 · 설정 라디오 · 묶음 슬롯 미리듣기 | G |
| 20 | 대상별 감지 시간 · 틱 느림 알림 · 버퍼 재사용 | H |
| 21 | 최종 회귀 · 파일 분리 확인 · 회귀 체크리스트 | I |

---

## Phase A. 파일 분리 (동작 변화 없음)

### Task 1: 브라우저 검증 도구와 지금 동작의 기준선

분리 전 `index.html`이 오늘 하는 일을 숫자로 남겨 두고, 이후 모든 Task가 같은 검사를 다시 돌린다.

**Files:**
- Create: `tests/browser/fake-screen.js`, `tests/browser/prelude.mjs`, `tests/browser/regression.mjs`

- [ ] **Step 1: 가짜 화면 공유 파일을 만든다**

`tests/browser/fake-screen.js`:

```js
// 브라우저 검사용 가짜 화면 공유. prelude.mjs의 open()이 주입한다. 주입 뒤 "게임 화면 연결"을 누르면 이 캔버스가 공유 화면이 된다.
(() => {
  if (window.__fake) return;
  const realNow = Date.now.bind(Date); let skew = 0;
  Date.now = () => realNow() + skew;                       // 시간을 앞당겨 타이머를 시험
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
  const g = cv.getContext('2d');
  const icons = new Map();                                 // name -> {x,y,w,h,seed|img,on}
  const cells = seed => { let s = seed * 9301 + 49297; const a = []; for (let i = 0; i < 16; i++) { s = (s * 9301 + 49297) % 233280; a.push(s / 233280); } return a; };
  let black = false;
  const draw = () => {
    g.fillStyle = black ? '#000' : '#26303a'; g.fillRect(0, 0, cv.width, cv.height);
    if (black) return;
    for (const ic of icons.values()) {
      if (!ic.on) continue;
      if (ic.img) { if (ic.img.complete) g.drawImage(ic.img, ic.x, ic.y, ic.w, ic.h); continue; }
      const c = cells(ic.seed), u = ic.w / 4;
      for (let i = 0; i < 16; i++) { const v = 40 + Math.floor(c[i] * 200); g.fillStyle = `rgb(${v},${(v * 1.7) % 255 | 0},${(v * 2.3) % 255 | 0})`; g.fillRect(ic.x + (i % 4) * u, ic.y + Math.floor(i / 4) * u, u, u); }
    }
  };
  setInterval(draw, 150);
  const fake = {
    cv, spoken: [], beeps: 0,
    pattern(name, x, y, seed, size = 32) { icons.set(name, { x, y, w: size, h: size, seed, on: true }); },     // 무늬 아이콘(등록해서 쓰는 대상용)
    image(name, url, x, y, w, h) { const img = new Image(); img.src = url; icons.set(name, { x, y, w, h, img, on: true }); },   // 그림 아이콘(내장 아이콘용)
    show(name, on = true) { const ic = icons.get(name); if (ic) ic.on = on; },
    black(on = true) { black = on; },
    resize(w, h) { cv.width = w; cv.height = h; },
    skew(ms) { skew += ms; },
    reset() { fake.spoken.length = 0; fake.beeps = 0; },
    wait(ms) { return new Promise(r => setTimeout(r, ms)); },
  };
  speechSynthesis.speak = u => fake.spoken.push(u.text);   // 음성 문구를 기록만 한다(실제로 말하지 않음)
  const co = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () { fake.beeps++; return co.call(this); };
  navigator.mediaDevices.getDisplayMedia = async () => cv.captureStream(5);
  window.__fake = fake;
})();
```

- [ ] **Step 2: 시나리오 공통 준비 파일을 만든다**

`tests/browser/prelude.mjs`(`open`이 저장소를 비우고, 가짜 화면을 주입하고, 옵션이 있으면 연결까지 한다):

```js
// 브라우저 검사 공통 준비. ego-browser 스크립트에서:
//   const { open, check, done } = await import("file:///ABS/tests/browser/prelude.mjs");
//   const { page, ev, wait } = await open(taskSpace, { seed: { "maple-web-timer-v1": {...} }, connect: true });
import fs from "node:fs/promises";
const ROOT = new URL("../../", import.meta.url);
export const BASE = "http://127.0.0.1:8766/index.html";      // 검증 전용 포트. 평소 쓰는 8765 origin의 설정·내 소리를 지우지 않으려고 분리
export async function open(taskSpace, opt = {}) {
  const task = await taskSpace("target-list-verify");
  const page = task.page("p1");
  await page.goto(opt.url || BASE);
  await page.evaluate(async seed => {                          // 이 origin의 저장소를 비우고 시험 데이터를 넣는다
    localStorage.clear();
    await new Promise(r => { const q = indexedDB.deleteDatabase("maple-web-timer"); q.onsuccess = q.onerror = q.onblocked = r; });
    for (const [k, v] of Object.entries(seed || {})) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }, opt.seed || {});
  await page.goto(opt.url || BASE);
  await page.evaluate(await fs.readFile(new URL("tests/browser/fake-screen.js", ROOT), "utf8"));
  if (opt.connect) { await page.click("#btnConnect"); await page.waitForTimeout(opt.settleMs ?? 3000); }
  const ev = (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg));
  return { task, page, ev, wait: ms => page.waitForTimeout(ms) };
}
let pass = 0, fail = 0;
export function check(name, cond, detail) {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : "  <- " + JSON.stringify(detail)}`);
}
export function done() { console.log(`RESULT ${pass} passed, ${fail} failed`); }
```

- [ ] **Step 3: 회귀 시나리오를 만든다**

`tests/browser/regression.mjs`(이 단계의 버전. 오늘의 연결 상태 감시·알림 정책을 14가지로 확인한다. Task 21에서 더 넓힌다):

```js
// 오늘까지의 감시·알림 동작 회귀 검사 (내장 아이콘 + 가짜 화면). 사용: ego-browser nodejs < 이 파일 (ABS 경로는 아래 ROOT)
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const { ev, wait } = await open(taskSpace, { connect: true });
const txt = sel => ev(s => document.querySelector(s).textContent, sel);

// 1) 연결 직후
check("연결: 상태줄", (await txt("#watchState")) === "감시 중");
check("연결: 탭 제목", (await ev(() => document.title)) === "● 감시 중 · 메이플 재획 알리미");
const first = await ev(() => ({ cards: ["sol", "booster", "rune"].map(i => document.querySelector(`#card-${i} [data-s=status]`).textContent), spoken: __fake.spoken.slice() }));
check("연결: 카드 문구", JSON.stringify(first.cards) === JSON.stringify(["아직 못 찾음", "아직 못 찾음", "등록 필요"]), first.cards);
check("연결: 시작 음성", first.spoken[0] === "감시 시작할게요. 룬은 등록이 필요해요", first.spoken);

// 2) 솔 야누스(내장 아이콘)가 켜짐 → 학습 중, 3) 지속시간 1:00 + 51초 뒤 미리 알림 한 번
await ev(() => { __fake.reset(); __fake.image("sol", document.querySelector("#card-sol .thumb").src, 1100, 50, 32, 32); });
await wait(2500);
check("솔 야누스 켜짐 · 학습 중", (await txt("#card-sol [data-s=status]")) === "켜짐 · 학습 중");
check("일치도 표시", (await txt("#card-sol [data-s=score]")).startsWith("1.00 ✔"));
await ev(() => { const i = document.querySelector("#t-sol-dur"); i.value = "1:00"; i.dispatchEvent(new Event("change")); __fake.skew(51000); });
await wait(3500);
const pre = await ev(() => ({ spoken: __fake.spoken.slice(), beeps: __fake.beeps }));
check("미리 알림 음성 한 번", JSON.stringify(pre.spoken) === JSON.stringify(["솔 야누스 10초 전"]), pre);
check("미리 알림 비프 3음", pre.beeps === 3, pre);

// 4) 꺼져도 꺼짐 알림 없음(정책)
await ev(() => { __fake.reset(); __fake.show("sol", false); });
await wait(3500);
const off = await ev(() => ({ spoken: __fake.spoken.slice(), st: document.querySelector("#card-sol [data-s=status]").textContent }));
check("미리 알림 뒤 꺼짐 알림 없음", off.spoken.length === 0 && off.st === "꺼져 있음", off);

// 5) 화면이 검게 멈춤 → 10초 뒤 알림, 복구 시 음성만
await ev(() => { __fake.reset(); __fake.black(true); });
await wait(1200);
await ev(() => __fake.skew(11000));
await wait(1500);
const stall = await ev(() => ({ spoken: __fake.spoken.slice(), state: document.querySelector("#watchState").textContent }));
check("화면 안 들어옴 알림", stall.spoken.includes("게임 화면이 들어오지 않아요") && stall.state === "게임 화면이 안 들어와요", stall);
await ev(() => { __fake.reset(); __fake.black(false); });
await wait(2500);
const back = await ev(() => ({ spoken: __fake.spoken.slice(), state: document.querySelector("#watchState").textContent }));
check("복구는 음성만", back.spoken.includes("게임 화면이 다시 들어와요") && back.state === "감시 중", back);

// 6) 연결 끊김: 즉시 1번 + 2분 간격 2번에서 멈춤(총 3번)
await ev(() => { __fake.reset(); src.track.dispatchEvent(new Event("ended")); });
await wait(1500);
const lost = () => ev(() => __fake.spoken.filter(t => t.startsWith("화면 연결이 끊겼어요")).length);
check("끊김 즉시 1번", (await lost()) === 1, await lost());
check("끊김 상태줄", (await txt("#watchState")) === "연결 끊김 · 알림이 멈췄어요");
for (let i = 0; i < 3; i++) { await ev(() => __fake.skew(121000)); await wait(1500); }
check("끊김 재알림은 총 3번에서 멈춤", (await lost()) === 3, await lost());
done();
```

- [ ] **Step 4: 분리 전 페이지에서 기준선을 돌린다**

```bash
cd /Users/song/dev/maple-web-timer
python3 -m http.server 8766 --bind 127.0.0.1 >/dev/null 2>&1 &
sleep 1
runb() { sed "s|__ROOT__|$PWD|g" "$1" | ego-browser nodejs 2>&1 | grep -E "PASS|FAIL|RESULT|Error|감시|감지"; }
runb tests/browser/regression.mjs
```

Expected: 14개 모두 `PASS`, 마지막 줄 `RESULT 14 passed, 0 failed` [확인: 분리 전 `index.html`에서 같은 결과].
이 14개가 "오늘 동작"의 기준이다. 실패하는 것이 있으면 코드가 아니라 시나리오(타이밍)를 먼저 의심한다.

- [ ] **Step 5: 커밋**

```bash
git add tests/browser/fake-screen.js tests/browser/prelude.mjs tests/browser/regression.mjs
git commit -F - <<'EOF'
브라우저 검증 도구: 가짜 화면 공유와 현재 동작 회귀 시나리오

getDisplayMedia를 캔버스 스트림으로 바꾸고 Date.now를 앞당겨, 연결 상태 감시·
미리 알림 정책·끊김 재알림 한도를 분리 전 코드에서 14가지로 확인한다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 2: `index.html`을 파일로 분리(동작 변화 없음)

줄 범위로 자르는 스크립트라 800줄을 다시 쓰지 않는다. 지금 `index.html`(803줄)의 구성 [확인]:

| 줄 | 내용 | 가는 곳 |
|---|---|---|
| 8–88 | `<style>` 안의 CSS | `css/app.css` |
| 147–178 | NCC 매칭(`toGray`, `prepTemplate`, `matchTemplate`) | `js/match.js` |
| 179–264 | `stepDetector`, `newState`, 7세그먼트, `stepCountdown` | `js/detect-core.js` |
| 271, 274 | `DEFS`의 내장 아이콘 배열(큰 base64) | `js/preset-data.js` |
| 269–277, 282, 295–296 | `DEFS`, 저장 키, `save`, `needsRegister`… | `js/targets.js` |
| 278, 286–294 | `$`, `fmt`, `parseDur`, `clampInt`, 조사, `ui` 저장 | `js/util.js` |
| 298–373 | 카드 | `js/ui-cards.js` |
| 375–432 | 소리 패턴, `beep`, `speak`, `notify`, `fire`, `fireSystem` | `js/alerts.js` |
| 434–520 | 내 소리(IndexedDB)와 소리 설정 화면 | `js/sounds.js` |
| 522, 527–560 | 상태줄 | `js/ui-watch.js` |
| 523–526, 562–632 | `health`, 화면 소스, 연결·끝내기 버튼 | `js/capture.js` |
| 283–284, 634–721 | 감지, `tick` | `js/detect-run.js` |
| 723–792 | 미리보기와 드래그 등록 | `js/register.js` |
| 795–800 | 부팅과 Worker | `js/main.js` |

**Files:**
- Create: `css/app.css`, `js/util.js`, `js/match.js`, `js/detect-core.js`, `js/preset-data.js`, `js/targets.js`, `js/alerts.js`, `js/sounds.js`, `js/capture.js`, `js/detect-run.js`, `js/ui-cards.js`, `js/ui-watch.js`, `js/register.js`, `js/main.js`
- Modify: `index.html`(스크립트가 만든 새 `index.html`로 교체)
- 임시(커밋하지 않음): `$TMPDIR/split-index.js`, `$TMPDIR/check-lines.js`

- [ ] **Step 1: 분리 스크립트를 임시 위치에 만든다**

최상위에서 바로 실행되던 코드(저장소 읽기, 버튼 핸들러 연결, 부팅)는 `initCapture()`·`initRegister()`·`loadLegacyStore()`·`initStates()` 같은 함수로 감싸 `main.js`가 부른다(스펙 8.2). 감싸는 줄 말고는 원본 줄을 그대로 옮긴다. 줄 번호가 다르면 앵커 검사에서 멈춘다.

`$TMPDIR/split-index.js`:

```js
// 사용법: node split-index.js <저장소 루트>   (index.html 803줄 기준. 줄 번호가 다르면 앵커 검사에서 멈춘다)
const fs = require('fs'), path = require('path');
const root = process.argv[2];
const L = fs.readFileSync(path.join(root, 'index.html'), 'utf8').split('\n');
const cut = (a, b) => L.slice(a - 1, b);            // 1부터, 양끝 포함
const need = (n, s) => { if (!L[n - 1].trimStart().startsWith(s)) throw new Error(`앵커 불일치 ${n}행: 기대 "${s}" / 실제 "${L[n - 1].slice(0, 50)}"`); };
[[8,':root{'],[88,'.score'],[89,'</style>'],[90,'</head>'],[144,'<div id="toast"'],[146,'<script>'],[147,'/* ===== 핵심'],[178,'}'],
 [179,'// 켜짐/꺼짐'],[264,'}'],[265,'</script>'],[267,'<script>'],[269,'const DEFS'],[271,'presets:[{url'],[274,'presets:[{url'],[277,'const STORE'],
 [278,'const $'],[286,'const fmt'],[294,'function saveUi'],[295,'const needsRegister'],[296,'const needsReregister'],[298,'/* ----- 카드 UI'],[373,'}'],
 [375,'/* ----- 알림'],[432,'function fireSystem'],[434,'/* ----- 알림 소리'],[520,'}'],[522,'/* ----- 감시'],[523,'const EMPTY_DEFAULT'],[526,'const health'],
 [527,'function watchStatus'],[560,'function pulse'],[562,'/* ----- 화면 소스'],[590,'}'],[591,"$('#btnConnect')"],[632,"if('Notification'"],
 [634,'/* ----- 감지'],[721,'}'],[723,'/* ----- 미리보기'],[774,'}'],[775,"$('#btnCancel')"],[777,'document.addEventListener'],[778,'function toImg'],
 [779,"pv.addEventListener('pointerdown'"],[792,'});'],[794,'/* ----- 백그라운드'],[795,'buildCards'],[800,'}catch(e){ setInterval'],[801,'</script>'],[802,'</body>']
].forEach(([n, s]) => need(n, s));
const write = (rel, ...parts) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, parts.flat().join('\n') + '\n'); };

write('css/app.css', cut(8, 88));
write('js/match.js', cut(147, 178));
write('js/detect-core.js', cut(179, 264));
const icons = n => L[n - 1].replace(/^\s*presets:/, '').replace(/\},\s*$/, '');   // 271·274행의 [..] 배열만 꺼냄
write('js/preset-data.js', '/* 내장 기본 아이콘 (data URL). 별도 PNG 파일로 빼면 file://에서 캔버스가 오염될 수 있어 JS 문자열로 둔다 */',
  'const PRESET_ICONS={', 'sol:' + icons(271) + ',', 'booster:' + icons(274), '};');
write('js/util.js', cut(278, 278), cut(286, 294));
write('js/targets.js', cut(269, 270), '   presets:PRESET_ICONS.sol},', cut(272, 273), '   presets:PRESET_ICONS.booster},', cut(275, 277),
  'let cfgs={};', 'function loadLegacyStore(){', "  try{ cfgs=JSON.parse(localStorage.getItem(STORE)||'{}'); }catch(e){}", cut(280, 281), '}', cut(282, 282), cut(295, 296));
write('js/alerts.js', cut(375, 432));
write('js/sounds.js', cut(434, 520));
write('js/ui-watch.js', cut(522, 522), cut(527, 560));
write('js/capture.js', cut(523, 526), cut(562, 590), 'function initCapture(){', cut(591, 632), '}');
write('js/detect-run.js', 'const states={}; const tplCache={};', 'function initStates(){ for(const d of DEFS) states[d.id]=newState(); }', cut(634, 721));
write('js/ui-cards.js', cut(298, 373));
write('js/register.js', cut(723, 774), cut(778, 778), 'function initRegister(){', cut(775, 777), cut(779, 792), '}');
write('js/main.js', '/* 부팅: 이 파일만 최상위에서 코드를 실행한다 */', 'loadLegacyStore(); initStates(); initCapture(); initRegister();', cut(795, 800));
const order = ['util', 'match', 'detect-core', 'preset-data', 'targets', 'alerts', 'sounds', 'capture', 'detect-run', 'ui-watch', 'ui-cards', 'register', 'main'];
write('index.html', cut(1, 6), '<link rel="stylesheet" href="css/app.css">', cut(90, 144), '', order.map(n => `<script src="js/${n}.js"></script>`), cut(802, 803));
console.log('ok');
```

- [ ] **Step 2: 실행한다**

```bash
cd /Users/song/dev/maple-web-timer
T=${TMPDIR:-/tmp}
# (Step 1의 스크립트를 $T/split-index.js 로 저장한 뒤)
git show HEAD:index.html | wc -l                 # 803 이어야 한다
node $T/split-index.js .
wc -l css/app.css js/*.js index.html
for f in js/*.js; do node --check $f || echo "문법 오류: $f"; done
```

Expected: `ok` 출력, `node --check` 오류 없음. 줄 수 [확인]: `css/app.css` 81, `js/alerts.js` 58, `js/capture.js` 77, `js/detect-core.js` 86, `js/detect-run.js` 90, `js/main.js` 8, `js/match.js` 32, `js/preset-data.js` 5, `js/register.js` 72, `js/sounds.js` 87, `js/targets.js` 18, `js/ui-cards.js` 76, `js/ui-watch.js` 35, `js/util.js` 10, `index.html` 78.

- [ ] **Step 2b: 줄이 빠지거나 늘지 않았는지 검사한다**

원본 스크립트의 모든 줄이 새 파일 어딘가에 그대로 있고, 차이는 우리가 넣은 감싸는 줄뿐이어야 한다.

`$TMPDIR/check-lines.js`:

```js
// 분리 전후로 줄이 빠지거나 늘지 않았는지 검사: 원본 스크립트 줄(다중집합) 대 새 js 줄
const fs=require('fs'); const root=process.argv[2];
const o=require('child_process').execSync('git show HEAD:index.html',{cwd:root,maxBuffer:1e8}).toString().split('\n');
const orig=[...o.slice(146,264), ...o.slice(268,800)].map(s=>s.trim()).filter(Boolean);   // 147-264, 269-800
const files=fs.readdirSync(root+'/js').filter(f=>f!=='preset-data.js');
const now=files.flatMap(f=>fs.readFileSync(root+'/js/'+f,'utf8').split('\n')).map(s=>s.trim()).filter(Boolean);
const count=a=>a.reduce((m,s)=>m.set(s,(m.get(s)||0)+1),new Map());
const A=count(orig),B=count(now); const only=(X,Y)=>[...X].filter(([s,n])=>n>(Y.get(s)||0)).map(([s])=>s.slice(0,70));
console.log('원본에만 있음:',only(A,B)); console.log('새 파일에만 있음:',only(B,A));
```

```bash
node $T/check-lines.js .
```

Expected [확인] — "원본에만 있음"은 정확히 다섯 줄(내장 아이콘 배열 2줄, `let cfgs={}; try{…`, `for(const d of DEFS) states…`, 백그라운드 타이머 주석), "새 파일에만 있음"은 감싸는 줄들(`}`, `function initCapture(){`, `function initStates(){…`, `/* 부팅:…`, `loadLegacyStore(); initStates(); initCapture(); initRegister();`, `function initRegister(){`, `presets:PRESET_ICONS.sol},`, `presets:PRESET_ICONS.booster},`, `let cfgs={};`, `function loadLegacyStore(){`, `try{ cfgs=JSON.parse(…`)뿐이다. 이 밖의 줄이 나오면 멈추고 앵커를 다시 본다.

- [ ] **Step 3: 분리 뒤에도 기준선이 같은지 브라우저로 확인한다**

```bash
runb tests/browser/regression.mjs
```

Expected: `RESULT 14 passed, 0 failed` (Task 1과 같은 14개). 서버를 새로 띄울 필요 없이 같은 서버가 새 파일을 준다.

- [ ] **Step 4: 커밋**

```bash
git add index.html css js
git commit -F - <<'EOF'
index.html을 css/·js/ 파일로 분리 (동작 변화 없음)

줄 범위로 기계적으로 잘라 클래식 <script src>로 나눴다. 최상위에서 실행되던
코드는 init 함수로 감싸 main.js가 부른다. 내장 아이콘은 file://에서 캔버스가
오염되지 않도록 JS 문자열(preset-data.js)로 둔다. 회귀 시나리오 14개 그대로 통과.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 3: 순수 파일에 `module.exports` 가드

**Files:**
- Modify: `js/util.js`, `js/match.js`, `js/detect-core.js`

- [ ] **Step 1: 각 파일 끝에 가드를 붙인다**

브라우저에서는 `module`이 없어 무시되고, node에서는 `require`로 읽힌다.

```diff
diff --git a/js/detect-core.js b/js/detect-core.js
--- a/js/detect-core.js
+++ b/js/detect-core.js
@@ -85,2 +85,3 @@ function stepCountdown(st, cfg, value, now){
   return ev;
 }
+if(typeof module==='object') module.exports={stepDetector,newState,SEG_DIGITS,ocrSevenSeg,UNREAD_MS,stepCountdown};
diff --git a/js/match.js b/js/match.js
--- a/js/match.js
+++ b/js/match.js
@@ -31,2 +31,3 @@ function matchTemplate(img, W, H, tpl){
   return {score:Math.max(best,0),x:bx,y:by};
 }
+if(typeof module==='object') module.exports={toGray,prepTemplate,matchTemplate};
diff --git a/js/util.js b/js/util.js
--- a/js/util.js
+++ b/js/util.js
@@ -9,2 +9,3 @@ const UI_STORE='maple-web-timer-ui';
 let ui={}; try{ ui=JSON.parse(localStorage.getItem(UI_STORE)||'{}'); }catch(e){}
 function saveUi(){ try{ localStorage.setItem(UI_STORE,JSON.stringify(ui)); }catch(e){} }
+if(typeof module==='object') module.exports={fmt,parseDur,clampInt,batchim,eunNeun,eulReul};   // node 테스트용. 브라우저에서는 무시됨
```

- [ ] **Step 2: node에서 읽히는지 확인한다**

```bash
node -e "for (const f of ['util','match','detect-core']) console.log(f, Object.keys(require('./js/'+f+'.js')).join(','))"
```

Expected [확인]:
```
util fmt,parseDur,clampInt,batchim,eunNeun,eulReul
match toGray,prepTemplate,matchTemplate
detect-core stepDetector,newState,SEG_DIGITS,ocrSevenSeg,UNREAD_MS,stepCountdown
```
(키 순서는 `module.exports` 줄의 순서다.)

- [ ] **Step 3: 브라우저가 그대로인지 확인**

```bash
runb tests/browser/regression.mjs
```

Expected: `RESULT 14 passed, 0 failed`.

- [ ] **Step 4: 커밋**

```bash
git add js/util.js js/match.js js/detect-core.js
git commit -F - <<'EOF'
순수 파일에 module.exports 가드 추가

node --test에서 util·match·detect-core를 require로 시험할 수 있게 한다.
브라우저에서는 module이 없어 무시된다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Phase B. 지금 동작을 고정하는 회귀 테스트

기존 순수 함수는 이미 동작하므로 이 Task들의 테스트는 처음부터 통과해야 한다(테스트가 코드를 설명하고, 뒤의 변경이 동작을 바꾸면 여기서 잡히게 하는 것이 목적). 통과하지 않으면 테스트의 가정이 틀린 것이니 코드를 고치지 말고 테스트를 코드의 실제 동작에 맞춘다.

### Task 4: `util.js` 회귀 테스트

**Files:**
- Create: `tests/util.test.js`

- [ ] **Step 1: 테스트 파일을 만든다**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { fmt, parseDur, clampInt, batchim, eunNeun, eulReul } = require('../js/util.js');

test('parseDur: 숫자만 쓰면 분, 분:초, 빈 값은 null, 형식 오류는 undefined', () => {
  assert.equal(parseDur('30'), 1800);
  assert.equal(parseDur('1:05'), 65);
  assert.equal(parseDur(' 2:0 '), 120);
  assert.equal(parseDur(''), null);
  assert.equal(parseDur('   '), null);
  assert.equal(parseDur(null), null);
  assert.equal(parseDur('abc'), undefined);
  assert.equal(parseDur('1:2:3'), undefined);
  assert.equal(parseDur('-5'), undefined);
});

test('fmt: 올림해서 mm:ss', () => {
  assert.equal(fmt(0), '00:00');
  assert.equal(fmt(59.2), '01:00');
  assert.equal(fmt(65), '01:05');
  assert.equal(fmt(-3), '00:00');
});

test('clampInt: 범위로 자르고 숫자가 아니거나 하한 미만이면 기본값', () => {
  assert.equal(clampInt('15', 1, 120, 10), 15);
  assert.equal(clampInt('500', 1, 120, 10), 120);
  assert.equal(clampInt('0', 1, 120, 10), 10);
  assert.equal(clampInt('abc', 1, 120, 10), 10);
  assert.equal(clampInt('0', 0, 600, 0), 0);
});

test('받침 조사: 은/는, 을/를', () => {
  assert.equal(batchim('룬'), true);
  assert.equal(batchim('부스터'), false);
  assert.equal(batchim('abc'), false);
  assert.equal(eunNeun('룬'), '룬은');
  assert.equal(eunNeun('부스터'), '부스터는');
  assert.equal(eulReul('룬'), '룬을');
  assert.equal(eulReul('솔 야누스'), '솔 야누스를');
  assert.equal(eulReul('솔 야누스 미리 알림'), '솔 야누스 미리 알림을');
});
```

- [ ] **Step 2: 실행**

```bash
node --test tests/util.test.js 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 4` `# fail 0`.

- [ ] **Step 3: 커밋**

```bash
git add tests/util.test.js
git commit -F - <<'EOF'
parseDur·fmt·clampInt·조사 함수 회귀 테스트

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 5: `matchTemplate`·`ocrSevenSeg` 회귀 테스트

**Files:**
- Create: `tests/match.test.js`

- [ ] **Step 1: 테스트 파일을 만든다**

7세그먼트 글자는 합성한다(가로 획은 글자 너비 전체, 세로 획은 가로 획과 이어지게). 실제 글자 모양에 가깝게 그려야 읽는 쪽이 쓰는 위치 비율과 맞는다 [확인: 획을 서로 떼어 그리면 읽지 못했다].

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { toGray, prepTemplate, matchTemplate } = require('../js/match.js');
const { ocrSevenSeg, SEG_DIGITS } = require('../js/detect-core.js');

// 결정적인 가짜 난수(시험 데이터 고정용)
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
function noiseImage(W, H, seed) { const r = rng(seed), g = new Float32Array(W * H); for (let i = 0; i < g.length; i++) g[i] = r() * 255; return g; }
function crop(g, W, x, y, w, h) { const o = new Float32Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) o[j * w + i] = g[(y + j) * W + x + i]; return o; }

test('matchTemplate: 잘라낸 조각을 원래 위치에서 점수 약 1로 찾는다', () => {
  const W = 60, H = 40, img = noiseImage(W, H, 7);
  const tpl = prepTemplate(crop(img, W, 13, 7, 8, 8), 8, 8);
  const r = matchTemplate(img, W, H, tpl);
  assert.equal(r.x, 13); assert.equal(r.y, 7);
  assert.ok(r.score > 0.999, 'score ' + r.score);
});

test('matchTemplate: 상관없는 이미지는 점수가 낮다', () => {
  const W = 60, H = 40, tplSrc = noiseImage(8, 8, 1), other = noiseImage(W, H, 99);
  const r = matchTemplate(other, W, H, prepTemplate(tplSrc, 8, 8));
  assert.ok(r.score < 0.7, 'score ' + r.score);
});

test('matchTemplate: 템플릿이 영역보다 크거나 단색이면 0', () => {
  const big = prepTemplate(noiseImage(20, 20, 3), 20, 20);
  assert.equal(matchTemplate(noiseImage(10, 10, 4), 10, 10, big).score, 0);
  const flat = prepTemplate(new Float32Array(64).fill(100), 8, 8);
  assert.equal(matchTemplate(noiseImage(30, 30, 5), 30, 30, flat).score, 0);
});

test('toGray: 가중 평균', () => {
  const g = toGray(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]), 2);
  assert.ok(Math.abs(g[0] - 76.245) < 0.01); assert.ok(Math.abs(g[1] - 149.685) < 0.01);
});

// 7세그먼트 숫자를 합성해 ocrSevenSeg를 시험: 밝은 글씨(노랑) + 검은 배경
function renderDigits(str, h = 36, w = 20, gap = 8) {
  const pad = 4, dotW = 5;
  const W = pad * 2 + [...str].reduce((a, c) => a + (c === '.' ? dotW + gap : w + gap), 0), H = h + pad * 2;
  const px = new Uint8ClampedArray(W * H * 4); for (let i = 3; i < px.length; i += 4) px[i] = 255;
  const fill = (x0, x1, y0, y1) => { for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) { const k = (y * W + x) * 4; px[k] = 255; px[k + 1] = 230; px[k + 2] = 80; } };
  // 가로 획은 글자 너비 전체, 세로 획은 가로 획과 이어지도록 그린다(실제 7세그먼트 글자 모양)
  const segBox = [[0, 1, 0, .14], [.78, 1, .05, .5], [.78, 1, .5, .95], [0, 1, .86, 1], [0, .22, .5, .95], [0, .22, .05, .5], [0, 1, .43, .57]];
  let x = pad;
  for (const ch of str) {
    if (ch === '.') { fill(x, x + dotW - 1, pad + h - 5, pad + h - 1); x += dotW + gap; continue; }
    const key = Object.keys(SEG_DIGITS).find(k => SEG_DIGITS[k] === ch);
    [...key].forEach((on, i) => { if (on === '1') { const [a, b, c, d] = segBox[i]; fill(x + a * (w - 1), x + b * (w - 1), pad + c * (h - 1), pad + d * (h - 1)); } });
    x += w + gap;
  }
  return { px, W, H };
}

test('ocrSevenSeg: 합성한 7세그먼트 숫자를 읽는다', () => {
  for (const s of ['38', '125', '9.5', '07']) {
    const { px, W, H } = renderDigits(s);
    const r = ocrSevenSeg(px, W, H);
    assert.ok(r, s + ' 읽기 실패'); assert.equal(r.text, s); assert.equal(r.value, parseFloat(s));
  }
});

test('ocrSevenSeg: 글씨가 없거나 너무 작으면 null', () => {
  const blank = new Uint8ClampedArray(40 * 20 * 4); for (let i = 3; i < blank.length; i += 4) blank[i] = 255;
  assert.equal(ocrSevenSeg(blank, 40, 20), null);
});
```

- [ ] **Step 2: 실행**

```bash
node --test tests/*.test.js 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 10` `# fail 0` (util 4 + match 6).

- [ ] **Step 3: 커밋**

```bash
git add tests/match.test.js
git commit -F - <<'EOF'
matchTemplate·toGray·ocrSevenSeg 회귀 테스트

잘라낸 조각을 원래 위치에서 찾는지, 상관없는 이미지·큰 템플릿·단색은 낮은 점수인지,
합성한 7세그먼트 숫자(38, 125, 9.5, 07)를 읽는지 확인한다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 6: `stepDetector`·`stepCountdown` 회귀 테스트

**Files:**
- Create: `tests/detector.test.js`

- [ ] **Step 1: 테스트 파일을 만든다**

켜짐 2틱·꺼짐 4틱, `armed` 전 `appear-unknown`, 학습(15초 미만 제외), 미리 알림 뒤 꺼짐 알림 없음, 부스터 `unread` 20초, 룬 반복을 고정한다.

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { stepDetector, stepCountdown, newState, UNREAD_MS } = require('../js/detect-core.js');

// 0.5초 간격 틱을 흉내 낸다. seq: 'x'=일치, '.'=불일치. 틱마다 나온 이벤트를 [{t, ev}]로 모은다.
function run(st, cfg, seq, start = 1_000_000) {
  const out = []; let now = start;
  for (const c of seq) { for (const ev of stepDetector(st, cfg, c === 'x', now)) out.push({ t: now, ev }); now += 500; }
  return out;
}
const buff = (o = {}) => ({ kind: 'buff', durationSec: null, leadSec: 10, ...o });
const names = evs => evs.map(e => (typeof e.ev === 'string' ? e.ev : Object.keys(e.ev)[0]));

test('켜짐은 연속 2번 일치해야 인정, 이미 켜져 있던 것은 appear-unknown', () => {
  const st = newState();
  assert.deepEqual(names(run(st, buff(), 'x')), []);
  assert.equal(st.present, false);
  assert.deepEqual(names(run(st, buff(), 'x', 1_000_500)), ['appear-unknown']);
  assert.equal(st.present, true); assert.equal(st.appearedAt, null);
});

test('꺼진 것을 4틱 본 뒤(armed)에는 appear와 켜진 시각을 기록', () => {
  const st = newState(), c = buff();
  run(st, c, '....');                       // armed
  assert.equal(st.armed, true);
  const ev = run(st, c, 'xx', 1_010_000);
  assert.deepEqual(names(ev), ['appear']);
  assert.equal(st.appearedAt, 1_010_500);
});

test('꺼짐은 연속 4번 불일치, 중간에 한 번 일치하면 세기가 처음부터', () => {
  const st = newState(), c = buff({ durationSec: 600 });
  run(st, c, '....xx', 1_000_000);
  assert.deepEqual(names(run(st, c, '...x...', 1_010_000)), []);   // 4번 연속이 아니므로 켜짐 유지
  assert.equal(st.present, true);
  assert.deepEqual(names(run(st, c, '....', 1_020_000)), ['gone']);
  assert.equal(st.present, false);
});

test('지속시간 학습: 15초 이상일 때만 {learn}, 15초 미만은 학습하지 않음', () => {
  let st = newState(), c = buff();
  run(st, c, '....'); run(st, c, 'xx', 2_000_000);      // 켜짐 2_000_500
  const long = run(st, c, '.'.repeat(4), 2_000_500 + 60_000);
  const learn = long.find(e => e.ev.learn);
  assert.ok(learn, '학습 이벤트');
  assert.equal(learn.ev.learn, Math.round((2_000_500 + 60_000 + 1500 - 2_000_500) / 1000 - 2));   // 꺼짐 확정 시각은 4번째 불일치(+1.5초)
  st = newState(); run(st, c, '....'); run(st, c, 'xx', 3_000_000);
  const short = run(st, c, '....', 3_000_500 + 8_000);
  assert.equal(short.find(e => e.ev.learn), undefined);
});

test('미리 알림은 끝나기 leadSec 전에 한 번, 이후 꺼져도 꺼짐 알림 없음(정책)', () => {
  const st = newState(), c = buff({ durationSec: 60, leadSec: 10 });
  run(st, c, '....'); run(st, c, 'xx', 5_000_000);       // appearedAt 5_000_500
  const before = stepDetector(st, c, true, 5_000_500 + 49_900);
  assert.deepEqual(before, []);
  const at = stepDetector(st, c, true, 5_000_500 + 50_000);
  assert.deepEqual(at, ['pre']);
  assert.deepEqual(stepDetector(st, c, true, 5_000_500 + 55_000), []);
  const off = run(st, c, '....', 5_000_500 + 70_000);
  assert.deepEqual(names(off), []);
  assert.equal(st.alertedPre, false);                    // 다음 주기를 위해 초기화
});

test('미리 알림 전에 꺼지면 꺼짐 알림 한 번', () => {
  const st = newState(), c = buff({ durationSec: 600 });
  run(st, c, '....'); run(st, c, 'xx', 6_000_000);
  assert.deepEqual(names(run(st, c, '....', 6_020_000)), ['gone']);
});

test('countdown 종류: 미리 알림을 못 울렸을 때만 gone', () => {
  const c = { kind: 'countdown', leadSec: 10 };
  let st = newState(); run(st, c, '....'); run(st, c, 'xx', 7_000_000);
  assert.deepEqual(names(run(st, c, '....', 7_010_000)), ['gone']);
  st = newState(); run(st, c, '....'); run(st, c, 'xx', 8_000_000); st.alertedPre = true;
  assert.deepEqual(names(run(st, c, '....', 8_010_000)), []);
});

test('rune: repeatSec마다 remind, 0이면 끔', () => {
  const c = { kind: 'rune', repeatSec: 60 };
  const st = newState(); run(st, c, '....'); run(st, c, 'xx', 9_000_000);
  assert.deepEqual(stepDetector(st, c, true, 9_000_500 + 59_000), []);
  assert.deepEqual(stepDetector(st, c, true, 9_000_500 + 60_000), ['remind']);
  assert.deepEqual(stepDetector(st, c, true, 9_000_500 + 61_000), []);
  const off = { kind: 'rune', repeatSec: 0 }, s2 = newState(); run(s2, off, '....'); run(s2, off, 'xx', 9_500_000);
  assert.deepEqual(stepDetector(s2, off, true, 9_500_500 + 999_000), []);
});

// ---- stepCountdown ----
test('stepCountdown: 꺼져 있으면 상태를 비우고 이벤트 없음', () => {
  const st = newState(); st.remain = 30; st.cand = 5;
  assert.deepEqual(stepCountdown(st, { leadSec: 10 }, 12, 1000), []);
  assert.equal(st.remain, null); assert.equal(st.cand, null);
});

test('stepCountdown: 첫 값은 후보로만 두고, 후보·예상과 맞는 값이 와야 받아들인다', () => {
  const st = newState(), c = { leadSec: 10 }; st.present = true; st.presentAt = 0;
  assert.deepEqual(stepCountdown(st, c, 30, 0), []);
  assert.equal(st.remain, null);
  assert.deepEqual(stepCountdown(st, c, 29.5, 500), []);     // 후보(30-0.5)와 일치
  assert.equal(st.remain, 29.5);
  assert.deepEqual(stepCountdown(st, c, 5, 600), []);        // 예상(29.4)과 크게 다른 값 하나는 무시(후보로만)
  assert.equal(st.remain, 29.5);
});

test('stepCountdown: 10초 이하에서 pre 한 번, 0은 pre 아님, 새 부스터(leadSec+5 초과)면 다시 준비', () => {
  const st = newState(), c = { leadSec: 10 }; st.present = true; st.presentAt = 0;
  stepCountdown(st, c, 30, 0); stepCountdown(st, c, 29.5, 500);
  assert.deepEqual(stepCountdown(st, c, 10, 20_000), ['pre']);
  assert.deepEqual(stepCountdown(st, c, 9, 21_000), []);
  assert.deepEqual(stepCountdown(st, c, 0, 30_000), []);
  stepCountdown(st, c, 60, 40_000); stepCountdown(st, c, 59.5, 40_500);   // 새로 사용: 60초
  assert.equal(st.alertedPre, false);
  assert.deepEqual(stepCountdown(st, c, 9.5, 91_000), ['pre']);
});

test('stepCountdown: 숫자를 20초 넘게 못 읽으면 unread 한 번, 읽으면 다시 준비', () => {
  const st = newState(), c = { leadSec: 10 }; st.present = true; st.presentAt = 1000;
  assert.equal(UNREAD_MS, 20000);
  assert.deepEqual(stepCountdown(st, c, null, 1000 + UNREAD_MS - 1), []);
  assert.deepEqual(stepCountdown(st, c, null, 1000 + UNREAD_MS), ['unread']);
  assert.deepEqual(stepCountdown(st, c, null, 1000 + UNREAD_MS + 5000), []);
  stepCountdown(st, c, 50, 40_000);
  assert.equal(st.ocrWarned, false);
});
```

- [ ] **Step 2: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 22` `# fail 0`.

- [ ] **Step 3: 커밋**

```bash
git add tests/detector.test.js
git commit -F - <<'EOF'
stepDetector·stepCountdown 회귀 테스트

연속 판정, 미리 알림 뒤 꺼짐 알림 없음, 학습 하한, 부스터 숫자 못 읽음 20초,
룬 반복 알림 같은 현재 동작을 고정한다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Phase C. 대상 모델 · `KINDS` · 저장소

### Task 7: 부스터 당겨 알림 뒤 재무장 수정 (스펙 16-1)

묶기를 켜면 부스터를 당겨 알린 직후 19초를 읽을 때 `stepCountdown`이 `alertedPre`를 꺼 [확인: `leadSec+5`보다 크면 끈다], 10초에 미리 알림이 또 울린다. `st.preMarkRemain`에 "미리 알린 시점의 남은 시간"을 남기고, 그 값보다 훨씬 커져야(새 부스터) 재무장하게 한다.

**Files:**
- Modify: `js/detect-core.js`, `tests/detector.test.js`

- [ ] **Step 1: 실패하는 테스트를 더한다**

```diff
diff --git a/tests/detector.test.js b/tests/detector.test.js
--- a/tests/detector.test.js
+++ b/tests/detector.test.js
@@ -124,2 +124,28 @@ test('stepCountdown: 숫자를 20초 넘게 못 읽으면 unread 한 번, 읽으
   assert.equal(st.ocrWarned, false);
 });
+
+// ---- 묶음 1 스펙 16-1: 당겨 알림(markPre) 뒤에 같은 주기의 pre가 다시 울리지 않아야 함 ----
+test('부스터: 당겨 알림으로 pre 처리된 뒤 19초를 읽어도 재무장되지 않아 10초에 pre가 또 울리지 않는다', () => {
+  const st = newState(), c = { leadSec: 10 }; st.present = true; st.presentAt = 0;
+  stepCountdown(st, c, 20, 0); stepCountdown(st, c, 19.5, 500);
+  st.alertedPre = true; st.preMarkRemain = 19.5;               // KINDS.countdown.markPre가 하는 일
+  assert.deepEqual(stepCountdown(st, c, 19, 1000), []);        // 19 > leadSec+5 이지만 재무장하지 않음
+  assert.equal(st.alertedPre, true);
+  assert.deepEqual(stepCountdown(st, c, 10, 10_000), []);      // 10초에 pre 없음
+});
+
+test('부스터: 당겨 알림 뒤에도 새 부스터(표시 값이 훨씬 커짐)를 쓰면 다시 준비', () => {
+  const st = newState(), c = { leadSec: 10 }; st.present = true; st.presentAt = 0;
+  stepCountdown(st, c, 20, 0); stepCountdown(st, c, 19.5, 500);
+  st.alertedPre = true; st.preMarkRemain = 19.5;
+  stepCountdown(st, c, 60, 5000); stepCountdown(st, c, 59.5, 5500);   // 60 > 19.5+5
+  assert.equal(st.alertedPre, false);
+});
+
+test('부스터 자체 pre도 preMarkRemain을 남기고, 새 주기가 시작되면 지운다', () => {
+  const st = newState(), c = { leadSec: 10 }; st.present = true; st.presentAt = 0;
+  stepCountdown(st, c, 11, 0); stepCountdown(st, c, 10.5, 500);
+  assert.deepEqual(stepCountdown(st, c, 10, 1000), ['pre']);
+  assert.equal(st.preMarkRemain, 10);
+  const d = newState(); assert.equal(d.preMarkRemain, 0);
+});
```

- [ ] **Step 2: 실행해서 실패를 본다**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 23` `# fail 2` (당겨 알림 뒤 재무장 방지, `preMarkRemain` 기록). 새 부스터 재무장 테스트는 지금도 통과한다(기존 동작).

- [ ] **Step 3: 구현**

`newState`에 `preMarkRemain`을 더하고, `appear`·꺼짐·미리 알림 때 갱신하고, 재무장 조건을 바꾼다.

```diff
diff --git a/js/detect-core.js b/js/detect-core.js
--- a/js/detect-core.js
+++ b/js/detect-core.js
@@ -5,5 +5,5 @@ function stepDetector(st, cfg, matched, now){
   if(!st.present && st.onStreak>=need.on){
     st.present=true; st.presentAt=now;
-    if(st.armed){ st.appearedAt=now; st.alertedPre=false; ev.push('appear'); }
+    if(st.armed){ st.appearedAt=now; st.alertedPre=false; st.preMarkRemain=0; ev.push('appear'); }
     else { st.appearedAt=null; ev.push('appear-unknown'); }   // 연결 시점에 이미 켜져 있던 경우
     st.lastRemind=now;
@@ -18,5 +18,5 @@ function stepDetector(st, cfg, matched, now){
       if(!st.alertedPre) ev.push('gone');
     }
-    st.appearedAt=null; st.alertedPre=false;
+    st.appearedAt=null; st.alertedPre=false; st.preMarkRemain=0;
   }
   if(!st.present && st.offStreak>=need.off) st.armed=true;   // 확실히 꺼진 걸 본 뒤부터 켜짐 시각을 신뢰
@@ -30,5 +30,5 @@ function stepDetector(st, cfg, matched, now){
   return ev;
 }
-function newState(){ return {present:false,seen:false,presentAt:null,onStreak:0,offStreak:0,armed:false,appearedAt:null,alertedPre:false,lastRemind:0,score:0,pos:null,remain:null,remainAt:0,cand:null,candAt:0,lastText:'',lastReadAt:null,ocrWarned:false}; }
+function newState(){ return {present:false,seen:false,presentAt:null,onStreak:0,offStreak:0,armed:false,appearedAt:null,alertedPre:false,preMarkRemain:0,lastRemind:0,score:0,pos:null,remain:null,remainAt:0,cand:null,candAt:0,lastText:'',lastReadAt:null,ocrWarned:false}; }
 
 /* ===== 부스터 타이머 숫자 읽기 (7세그먼트) ===== */
@@ -81,6 +81,7 @@ function stepCountdown(st, cfg, value, now){
   if(!ok){ st.cand=value; st.candAt=now; return ev; }
   st.remain=value; st.remainAt=now; st.cand=null;
-  if(value>cfg.leadSec+5) st.alertedPre=false;                   // 새 부스터를 썼으면 다시 알림 준비
-  if(value<=cfg.leadSec && value>0 && !st.alertedPre){ st.alertedPre=true; ev.push('pre'); }
+  // 새 부스터를 썼으면 다시 알림 준비. 묶기로 미리 당겨 알린 주기(preMarkRemain)는 그 값보다 훨씬 커져야 새 주기로 본다
+  if(value>Math.max(cfg.leadSec,st.preMarkRemain||0)+5){ st.alertedPre=false; st.preMarkRemain=0; }
+  if(value<=cfg.leadSec && value>0 && !st.alertedPre){ st.alertedPre=true; st.preMarkRemain=value; ev.push('pre'); }
   return ev;
 }
```

- [ ] **Step 4: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 25` `# fail 0`.

- [ ] **Step 5: 커밋**

```bash
git add js/detect-core.js tests/detector.test.js
git commit -F - <<'EOF'
부스터: 당겨 알린 주기는 더 큰 값을 읽어도 재무장하지 않음 (스펙 16-1)

stepCountdown이 leadSec+5보다 큰 값을 읽으면 alertedPre를 꺼서, 묶기로 미리 당겨 알린
뒤 10초에 미리 알림이 또 울릴 수 있었다. preMarkRemain에 미리 알린 시점의 남은 시간을
남기고 그보다 5초 넘게 커져야(새 부스터) 다시 준비한다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 8: `KINDS` 등록부

종류별 동작(이벤트·문구·소리·상태 문구·입력 칸·등록 훅·남은 시간·`markPre`)을 한 곳에 모으고, 기존 순수 상태기계는 시그니처를 바꾸지 않은 채 감싼다(스펙 3.4, 16-3). 이 Task에서는 아직 어느 화면도 `KINDS`를 쓰지 않는다.

**Files:**
- Create: `js/kinds.js`, `tests/load.js`, `tests/kinds.test.js`
- Modify: `js/targets.js`(내장 대상·기본 아이콘 상수), `js/util.js`(`checkDurLead`), `tests/util.test.js`, `index.html`

- [ ] **Step 1: `checkDurLead` 테스트를 더한다**

지속시간이 미리 알림 초 이하이면 켜지자마자 미리 알림이 울린다 [확인: `stepDetector`의 `now>=endAt-lead*1000`]. 그 입력을 거절하는 문구를 순수 함수로 둔다(스펙 5.4).

```diff
diff --git a/tests/util.test.js b/tests/util.test.js
--- a/tests/util.test.js
+++ b/tests/util.test.js
@@ -40,2 +40,12 @@ test('받침 조사: 은/는, 을/를', () => {
   assert.equal(eulReul('솔 야누스 미리 알림'), '솔 야누스 미리 알림을');
 });
+
+test('checkDurLead: 지속시간이 미리 알림 이하이면 거절 문구, 아니면 null', () => {
+  const { checkDurLead } = require('../js/util.js');
+  assert.equal(checkDurLead(null, 10, 'duration'), null);
+  assert.equal(checkDurLead(60, 10, 'duration'), null);
+  assert.equal(checkDurLead(10, 10, 'duration'), '미리 알림(10초)보다 길게 입력해 주세요');
+  assert.equal(checkDurLead(5, 10, 'duration'), '미리 알림(10초)보다 길게 입력해 주세요');
+  assert.equal(checkDurLead(60, 60, 'lead'), '미리 알림은 지속시간(01:00)보다 짧게 입력해 주세요');
+  assert.equal(checkDurLead(60, 59, 'lead'), null);
+});
```

- [ ] **Step 2: 실패를 본다**

```bash
node --test tests/util.test.js 2>&1 | grep -E "TypeError|^# (pass|fail)"
```

Expected: `TypeError: checkDurLead is not a function`, `# fail 1`.

- [ ] **Step 3: `js/util.js`에 구현**

```diff
diff --git a/js/util.js b/js/util.js
--- a/js/util.js
+++ b/js/util.js
@@ -9,3 +9,8 @@ const UI_STORE='maple-web-timer-ui';
 let ui={}; try{ ui=JSON.parse(localStorage.getItem(UI_STORE)||'{}'); }catch(e){}
 function saveUi(){ try{ localStorage.setItem(UI_STORE,JSON.stringify(ui)); }catch(e){} }
-if(typeof module==='object') module.exports={fmt,parseDur,clampInt,batchim,eunNeun,eulReul};   // node 테스트용. 브라우저에서는 무시됨
+// 지속시간이 미리 알림 초 이하이면 켜지자마자 미리 알림이 울린다 → 입력을 거절하는 문구(통과하면 null). field: 'duration'|'lead'
+const checkDurLead=(durationSec,leadSec,field)=>{
+  if(!durationSec||durationSec>leadSec) return null;
+  return field==='lead' ? `미리 알림은 지속시간(${fmt(durationSec)})보다 짧게 입력해 주세요` : `미리 알림(${leadSec}초)보다 길게 입력해 주세요`;
+};
+if(typeof module==='object') module.exports={fmt,parseDur,clampInt,batchim,eunNeun,eulReul,checkDurLead};   // node 테스트용. 브라우저에서는 무시됨
```

- [ ] **Step 4: 시험 도구와 `KINDS` 테스트를 만든다**

`tests/load.js`는 브라우저처럼 파일들을 한 전역에 차례로 올린다(함수 선언은 속성으로, 최상위 `const`는 `ctx.get('이름')`으로 읽음. vm 안에서 만든 객체는 프로토타입이 달라 `deepStrictEqual`이 실패하므로 `ctx.plain(x)`로 JSON 복사본을 만들어 비교한다 [확인]).

```js
// 브라우저용 클래식 스크립트를 하나의 전역(vm 컨텍스트)에 차례로 올려 시험한다. 브라우저와 같이 파일끼리 전역 이름으로 서로를 본다.
// - 함수 선언은 반환값의 속성으로 바로 읽힌다. 최상위 const/let 값은 ctx.get('KINDS')처럼 읽는다.
// - vm 안에서 만든 객체는 프로토타입이 달라 deepStrictEqual이 실패하므로 ctx.plain(x)로 JSON 복사본을 만들어 비교한다.
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
function load(files, globals = {}) {
  const ctx = vm.createContext({ console, ...globals });
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  ctx.get = name => vm.runInContext(name, ctx);
  ctx.plain = x => JSON.parse(JSON.stringify(x));
  return ctx;
}
module.exports = { load };
```

`tests/kinds.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.js');

// 전역 순서는 index.html과 같게. targets.js는 아직 예전 DEFS를 만들므로 아이콘 데이터는 빈 배열로 대신한다.
const L = load(['js/util.js', 'js/detect-core.js', 'js/targets.js', 'js/kinds.js'], { PRESET_ICONS: { sol: [], booster: [] } });
const KINDS = L.get('KINDS'), BUILTIN = L.get('BUILTIN');
const { newState, cardStatus, unionRect, registerKind } = L;
const mk = (kind, over = {}) => ({ id: 'u1', kind, name: '유니온의 힘', preset: null, enabled: true, threshold: 0.75, area: null, tpl: null, frameW: 0, frameH: 0, p: KINDS[kind].defaults(), ...over });
const ctx = { src: true, frame: { w: 1280, h: 720 } };
const REG = { tpl: { url: 'x', w: 8, h: 8 }, frameW: 1280, frameH: 720 };   // 등록을 마친 대상

test('종류 등록부: 세 종류와 이벤트 키·묶음 종류', () => {
  assert.deepEqual(Object.keys(KINDS).sort(), ['buff', 'countdown', 'rune']);
  const ev = k => L.plain(KINDS[k].events.map(e => [e.key, e.group, e.beep]));
  assert.deepEqual(ev('buff'), [['pre', 'pre', 'buff'], ['gone', 'gone', 'gone']]);
  assert.deepEqual(ev('countdown'), [['pre', 'pre', 'booster'], ['gone', 'gone', 'gone'], ['unread', null, 'system']]);
  assert.deepEqual(ev('rune'), [['appear', null, 'rune'], ['remind', null, 'rune']]);
});

test('문구: 기존 MSG와 같다', () => {
  const t = mk('buff', { name: '솔 야누스' }), msg = (k, key, t, info) => KINDS[k].events.find(e => e.key === key).msg(t, info || {});
  assert.equal(msg('buff', 'pre', t), '솔 야누스 10초 전');
  assert.equal(msg('buff', 'gone', t), '솔 야누스 꺼졌어요');
  assert.equal(msg('countdown', 'unread', mk('countdown', { name: '부스터' })), '부스터 숫자를 못 읽고 있어요');
  assert.equal(msg('rune', 'appear', mk('rune')), '룬이 나왔어요');
  assert.equal(msg('rune', 'remind', mk('rune')), '룬 아직 있어요');
});

test('기본값과 p 보정(normalizeP)', () => {
  assert.deepEqual(L.plain(KINDS.buff.defaults()), { durationSec: null, leadSec: 10 });
  assert.deepEqual(L.plain(KINDS.countdown.defaults()), { leadSec: 10 });
  assert.deepEqual(L.plain(KINDS.rune.defaults()), { repeatSec: 60 });
  assert.deepEqual(L.plain(KINDS.buff.normalizeP({ leadSec: 999, durationSec: 5 })), { leadSec: 120, durationSec: null });   // 지속시간 <= 미리 알림은 버림
  assert.deepEqual(L.plain(KINDS.buff.normalizeP({ leadSec: 10, durationSec: 600.4 })), { leadSec: 10, durationSec: 600 });
  assert.deepEqual(L.plain(KINDS.rune.normalizeP({ repeatSec: -3 })), { repeatSec: 60 });
  assert.deepEqual(L.plain(KINDS.rune.normalizeP({ repeatSec: 0 })), { repeatSec: 0 });
});

test('buff.step: 기존 stepDetector와 같은 이벤트, {learn}은 effect로 바뀐다', () => {
  const t = mk('buff'), st = newState();
  const step = (m, now) => L.plain(KINDS.buff.step(t, st, { score: m ? 0.9 : 0.1, pos: null }, null, now));
  for (let i = 0; i < 4; i++) step(false, 1000 + i * 500);           // armed
  step(true, 5000); assert.deepEqual(step(true, 5500), ['appear']);
  assert.equal(st.seen, true);
  let out = []; for (let i = 0; i < 4; i++) out.push(...step(false, 5500 + 60_000 + i * 500));
  assert.deepEqual(out.map(e => e.effect || e), ['learn', 'gone']);
  assert.equal(out[0].durationSec, Math.round((65_500 + 1500 - 5500) / 1000 - 2));
});

test('rune.step: appear-unknown도 appear로', () => {
  const t = mk('rune'), st = newState();
  const step = (now) => L.plain(KINDS.rune.step(t, st, { score: 0.9, pos: null }, null, now));
  step(1000); assert.deepEqual(step(1500), ['appear']);
});

test('markPre: 버프는 alertedPre, 부스터는 현재 남은 시간도 기록', () => {
  const b = newState(); KINDS.buff.markPre(b, 0); assert.equal(b.alertedPre, true);
  const c = newState(); c.present = true; c.remain = 30; c.remainAt = 1000;
  KINDS.countdown.markPre(c, 11_000); assert.equal(c.alertedPre, true); assert.equal(c.preMarkRemain, 20);
});

test('remainSec: 켜진 시각·지속시간을 모르거나 이미 알렸거나 끝났으면 null', () => {
  const t = mk('buff', { p: { durationSec: 60, leadSec: 10 } }), st = newState();
  assert.equal(KINDS.buff.remainSec(t, st, 0), null);                     // 꺼져 있음
  st.present = true; st.appearedAt = 1000;
  assert.equal(KINDS.buff.remainSec(t, st, 21_000), 40);
  assert.equal(KINDS.buff.remainSec(t, st, 61_000), null);               // 끝남
  st.alertedPre = true; assert.equal(KINDS.buff.remainSec(t, st, 21_000), null);
  st.alertedPre = false; st.appearedAt = null; assert.equal(KINDS.buff.remainSec(t, st, 21_000), null);
  assert.equal(KINDS.buff.remainSec(mk('buff'), Object.assign(newState(), { present: true, appearedAt: 1 }), 5), null);   // 지속시간 없음
  const c = newState(); c.present = true; c.remain = 30; c.remainAt = 1000;
  assert.equal(KINDS.countdown.remainSec(mk('countdown'), c, 11_000), 20);
  assert.equal(KINDS.rune.remainSec(mk('rune'), newState(), 0), null);
});

test('상태 문구: 기존 renderCard 분기와 같다', () => {
  const st = newState(), now = 100_000;
  const s = (t, over = {}, c = ctx) => L.plain(cardStatus(t, Object.assign(st, over), now, c));
  assert.equal(s(mk('buff')).text, '등록 필요');
  assert.equal(s(mk('buff'), {}, { src: false, frame: { w: 0, h: 0 } }).text, '등록 필요');
  assert.equal(s(mk('buff', REG), {}, { src: false, frame: { w: 0, h: 0 } }).text, '대기 중');
  const re = s(mk('buff', REG), {}, { src: true, frame: { w: 1920, h: 1080 } });
  assert.equal(re.text, '다시 등록 필요'); assert.equal(re.cls, 'alert'); assert.equal(re.sub, '등록 당시 화면 1280×720, 지금 1920×1080');
  assert.equal(s(mk('buff', REG)).text, '아직 못 찾음');
  assert.equal(s(mk('buff', REG), { seen: true }).text, '꺼져 있음');
  assert.equal(s(mk('buff', REG), { present: true, appearedAt: null }).text, '켜짐');
  assert.equal(s(mk('buff', REG), { present: true, appearedAt: 40_000 }).text, '켜짐 · 학습 중');
  const on = s(mk('buff', { ...REG, p: { durationSec: 120, leadSec: 10 } }), { present: true, appearedAt: 40_000 });
  assert.equal(on.text, '남은 시간 01:00'); assert.equal(on.cls, 'on');
  const soon = s(mk('buff', { ...REG, p: { durationSec: 60, leadSec: 10 } }), { present: true, appearedAt: 50_000 });
  assert.equal(soon.cls, 'alert');
  assert.equal(s(mk('rune', REG), { present: false }).text, '룬 없음');
  assert.equal(s(mk('rune', REG), { present: true }).text, '룬 있음!');
  const cd = mk('countdown', { ...REG, preset: 'booster' });
  assert.equal(s(cd, { present: true, remain: null, ocrWarned: false, lastText: '' }).text, '켜짐 · 숫자 읽는 중');
  assert.equal(s(cd, { ocrWarned: true }).text, '켜짐 · 숫자를 못 읽음');
  assert.equal(s(cd, { remain: 50, remainAt: 90_000, ocrWarned: false, lastText: '50' }).text, '남은 시간 00:40');
});

test('내장 아이콘 대상은 등록 없이도 등록된 것으로 보고, 안내 문구가 붙는다', () => {
  const sol = mk('buff', { preset: 'sol' });
  assert.equal(KINDS.buff.isRegistered(sol), true);
  assert.match(cardStatus(sol, Object.assign(newState(), { seen: true }), 0, ctx).sub, /기본 아이콘으로 화면 오른쪽 위를 자동 검색 중/);
  assert.match(cardStatus(mk('countdown', { preset: 'booster' }), Object.assign(newState(), { seen: true }), 0, ctx).sub, /남은시간/);
});

test('stripState: 꺼둠 > 등록 필요 > 다시 등록 > 아직 못 찾음 > 정상. 룬은 못 찾음 표시 없음', () => {
  const ss = (t, over = {}, c = ctx) => KINDS[t.kind].stripState(t, Object.assign(newState(), over), 0, c);
  assert.equal(ss(mk('buff', { enabled: false })), 'off');
  assert.equal(ss(mk('buff')), 'reg');
  assert.equal(ss(mk('buff', REG), {}, { src: true, frame: { w: 1920, h: 1080 } }), 'rereg');
  assert.equal(ss(mk('buff', REG)), 'unseen');
  assert.equal(ss(mk('buff', REG), { seen: true }), 'ok');
  assert.equal(ss(mk('rune', REG)), 'ok');
});

test('입력 칸(cardFields): 버프 지속시간·미리 알림 검사', () => {
  const t = mk('buff'), f = Object.fromEntries(KINDS.buff.cardFields(t).map(x => [x.key, x]));
  assert.equal(f.durationSec.get(t), '');
  assert.deepEqual(L.plain(f.durationSec.set(t, '1:00')), {}); assert.equal(t.p.durationSec, 60); assert.equal(f.durationSec.get(t), '01:00');
  const bad = f.durationSec.set(t, 'abc'); assert.equal(bad.revert, true); assert.equal(t.p.durationSec, 60);
  const low = f.durationSec.set(t, '0:05'); assert.equal(low.revert, true); assert.equal(low.msg, '미리 알림(10초)보다 길게 입력해 주세요');
  assert.deepEqual(L.plain(f.durationSec.set(t, '')), {}); assert.equal(t.p.durationSec, null);
  f.durationSec.set(t, '1:00');
  const lead = f.leadSec.set(t, '60'); assert.equal(lead.revert, true); assert.equal(t.p.leadSec, 10);
  assert.deepEqual(L.plain(f.leadSec.set(t, '30')), {}); assert.equal(t.p.leadSec, 30);
  assert.equal(f.leadSec.set(t, '999').revert, true); assert.equal(t.p.leadSec, 30);   // 120으로 잘린 값도 지속시간(60초) 이상이라 거절
  const r = mk('rune'), rf = KINDS.rune.cardFields(r)[0];
  rf.set(r, '999'); assert.equal(r.p.repeatSec, 600); rf.set(r, '0'); assert.equal(r.p.repeatSec, 0);
});

test('학습 결과(applyEffect): 지속시간 저장, 미리 알림 이하의 값은 버림', () => {
  const t = mk('buff');
  KINDS.buff.applyEffect(t, { effect: 'learn', durationSec: 5 }); assert.equal(t.p.durationSec, null);
  KINDS.buff.applyEffect(t, { effect: 'learn', durationSec: 720 }); assert.equal(t.p.durationSec, 720);
});

test('"방금 켰어요" 동작', () => {
  const t = mk('buff'), st = newState(); st.alertedPre = true; st.preMarkRemain = 5;
  KINDS.buff.actions[0].run(t, st, 7000);
  assert.deepEqual(L.plain({ p: st.present, a: st.appearedAt, ap: st.alertedPre, pm: st.preMarkRemain, arm: st.armed, on: st.onStreak }), { p: true, a: 7000, ap: false, pm: 0, arm: true, on: 2 });
});

test('등록 도우미: 영역과 아이콘의 합집합, 라벨', () => {
  assert.deepEqual(L.plain(unionRect({ x: 10, y: 10, w: 100, h: 50 }, { x: 5, y: 20, w: 30, h: 100 })), { x: 5, y: 10, w: 105, h: 110 });
  assert.equal(L.labelsOf(mk('buff')).area, '버프창 영역');
  assert.equal(L.labelsOf(mk('buff', { name: '유니온의 부' })).icon, '유니온의 부 아이콘');
  assert.equal(L.labelsOf(mk('rune')).area, '미니맵 영역');
  assert.equal(L.labelsOf(mk('countdown')).icon, '“◷ 남은시간” 글자');
});

test('registerKind: 묶음 3·4가 종류를 더할 때 쓰는 기본값', () => {
  registerKind('idle', { label: '사냥 멈춤', defaults: () => ({ idleSec: 30 }), events: [{ key: 'alarm', label: '알림', beep: 'system', group: null, msg: () => 'x' }], maxInstances: 1, onSkip: true });
  const k = KINDS.idle;
  assert.equal(k.onSkip, true); assert.equal(k.maxInstances, 1); assert.equal(k.trackSeen, false);
  assert.deepEqual(L.plain(k.register.steps), ['area', 'icon']);
  assert.equal(k.register.validate({}, {}, null), null);
  assert.equal(k.remainSec({}, {}, 0), null);
  assert.equal(k.isRegistered({ tpl: null, preset: null }), false);
});
```

- [ ] **Step 5: 실패를 본다**

```bash
node --test tests/kinds.test.js 2>&1 | grep -E "Error|^# (pass|fail)" | head -3
```

Expected: `ENOENT: no such file or directory, open '…/js/kinds.js'`.

- [ ] **Step 6: `targets.js`에 내장 대상·기본 아이콘 상수를 더하고 `kinds.js`를 만든다**

`targets.js` 끝에 덧붙인다(`DEFS`는 Task 11까지 남아 있는 예전 코드다):

```diff
diff --git a/js/targets.js b/js/targets.js
--- a/js/targets.js
+++ b/js/targets.js
@@ -17,2 +17,16 @@ function save(){ try{ localStorage.setItem(STORE,JSON.stringify(cfgs)); }catch(e
 const needsRegister=d=>!cfgs[d.id].tpl && !d.presets;
 const needsReregister=d=>{ const c=cfgs[d.id]; return !!(c.tpl && c.frameW && frame.w && (c.frameW!==frame.w||c.frameH!==frame.h)); };
+
+/* ===== 감지 대상 모델 (묶음 1 스펙 3절). 위의 DEFS·cfgs는 Task E1에서 이 모델로 바뀔 때까지 남아 있는 예전 코드 ===== */
+const TARGET_MAX=12;
+// 내장 3개: 기존 id를 그대로 써서 내 소리 슬롯 키(sol.pre 등)를 이전 없이 이어간다
+const BUILTIN={
+  sol:{kind:'buff',name:'솔 야누스',preset:'sol',threshold:0.75},
+  booster:{kind:'countdown',name:'부스터',preset:'booster',threshold:0.7},
+  rune:{kind:'rune',name:'룬',preset:null,threshold:0.8},
+};
+// 내장 기본 아이콘 세트. 저장하지 않는 코드 상수. 아이콘 이미지는 preset-data.js
+const PRESETS={
+  sol:{scales:[1,1.25,1.5], area:f=>({x:Math.round(f.w*0.35),y:0,w:Math.round(f.w*0.65),h:Math.round(f.h*0.3)}), get icons(){ return PRESET_ICONS.sol; }},
+  booster:{scales:[0.8,1,1.25,1.5], area:f=>({x:Math.round(f.w*0.2),y:0,w:Math.round(f.w*0.6),h:Math.round(f.h*0.3)}), get icons(){ return PRESET_ICONS.booster; }},
+};
```

`js/kinds.js`:

```js
/* ===== 종류 등록부 KINDS (묶음 1 스펙 3.4, 16절). 종류별 동작은 여기 한 곳에 둔다.
   묶음 3(idle)·4(cooldown)는 registerKind(이름, 정의)로 종류를 더한다. 이 파일은 정의만 하고 DOM은 호출 시점에만 건드린다. ===== */
const KINDS={};
const isPresetMode=t=>!t.tpl&&!!t.preset;                    // 직접 등록한 아이콘이 없고 내장 아이콘을 쓰는 중
const cfgView=t=>({kind:t.kind,...t.p});                      // 기존 순수 상태기계(stepDetector 등)에 넘기는 설정 모양
function unionRect(a,i){ const x0=Math.min(a.x,i.x),y0=Math.min(a.y,i.y),x1=Math.max(a.x+a.w,i.x+i.w),y1=Math.max(a.y+a.h,i.y+i.h); return {x:x0,y:y0,w:x1-x0,h:y1-y0}; }
// 영역 → 아이콘으로 드래그한 결과를 저장. 아이콘이 영역 밖으로 나가면 영역을 넓힌다
function templateRegisterSave(t,rects,snap){
  const r=rects.icon, cv=document.createElement('canvas'); cv.width=r.w; cv.height=r.h;
  cv.getContext('2d').drawImage(snap,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
  Object.assign(t,{area:unionRect(rects.area,r),tpl:{url:cv.toDataURL('image/png'),w:r.w,h:r.h},frameW:snap.width,frameH:snap.height});
}
function labelsOf(t){ return KINDS[t.kind].labels(t); }
// 등록·연결·해상도 같은 공통 분기. 해당하지 않으면 null
function commonStatus(k,t,ctx){
  if(!k.isRegistered(t)){ const l=k.labels(t); return {text:'등록 필요',cls:'off',sub:`${l.area} → ${l.icon} 순서로 드래그`}; }
  if(!ctx.src) return {text:'대기 중',cls:'off',sub:'게임 화면을 연결하세요'};
  if(k.needsReregister(t,ctx.frame)) return {text:'다시 등록 필요',cls:'alert',sub:`등록 당시 화면 ${t.frameW}×${t.frameH}, 지금 ${ctx.frame.w}×${ctx.frame.h}`};
  return null;
}
const NOT_SEEN={text:'아직 못 찾음',cls:'off',sub:'이번 연결에서 아직 한 번도 못 봤어요 · 켜져 있는데도 이러면 “등록”으로 직접 지정'};
const KIND_DEFAULTS={
  label:'', needsTemplate:true, trackSeen:false, maxInstances:12, onSkip:false, events:[], actions:[],
  defaults:()=>({}), normalizeP:p=>p,
  isRegistered:t=>!!(t.tpl||t.preset),
  needsReregister:(t,frame)=>!!(t.tpl&&t.frameW&&frame&&frame.w&&(t.frameW!==frame.w||t.frameH!==frame.h)),
  register:{steps:['area','icon'],validate:()=>null,save:templateRegisterSave},   // validate가 문자열을 돌려주면 저장하지 않고 그 이유를 배너에 보인다
  labels:t=>({area:'영역',icon:`${t.name} 아이콘`}),
  detect:(t,source,ctx)=>detectTemplate(t,source),
  step:()=>[],
  markPre:st=>{ st.alertedPre=true; },                        // 묶기로 미리 당겨 알렸거나 자체 pre를 울린 주기를 표시
  remainSec:()=>null, applyEffect:()=>{}, cardFields:()=>[], cost:t=>t.tpl?5:80,
  status:(t,st,now,ctx)=>commonStatus(KINDS[t.kind],t,ctx)||{text:'',cls:'off',sub:''},
  stripState(t,st,now,ctx){
    const k=KINDS[t.kind];
    if(!t.enabled) return 'off'; if(!k.isRegistered(t)) return 'reg'; if(k.needsReregister(t,ctx&&ctx.frame)) return 'rereg';
    return k.trackSeen&&!st.seen?'unseen':'ok';
  },
};
function registerKind(name,def){
  KINDS[name]=Object.assign({},KIND_DEFAULTS,def,{key:name,register:Object.assign({},KIND_DEFAULTS.register,def.register||{})});
}
// 카드 상태 문구. 내장 아이콘을 쓰는 중이고 안내가 없으면 자동 검색 중이라는 안내를 붙인다
function cardStatus(t,st,now,ctx){
  const r=Object.assign({sub:''},KINDS[t.kind].status(t,st,now,ctx));
  if(!r.sub&&isPresetMode(t)&&ctx.src) r.sub=t.kind==='countdown'?'화면 위쪽 가운데의 “남은시간” 타이머를 자동 검색 중':'기본 아이콘으로 화면 오른쪽 위를 자동 검색 중 · 잘 안 잡히면 “등록”으로 직접 지정';
  return r;
}
const mapLearn=evs=>evs.map(e=>e&&e.learn!=null?{effect:'learn',durationSec:e.learn}:e);
const leadField={key:'leadSec',label:'미리 알림',type:'number',min:1,max:120,suffix:'초 전',
  get:t=>t.p.leadSec,
  set:(t,raw)=>{ const v=clampInt(raw,1,120,10); const m=checkDurLead(t.p.durationSec,v,'lead'); if(m) return {revert:true,msg:m}; t.p.leadSec=v; return {}; }};

registerKind('buff',{
  label:'버프', trackSeen:true,
  defaults:()=>({durationSec:null,leadSec:10}),
  normalizeP:p=>{ const lead=clampInt(p.leadSec,1,120,10), d=p.durationSec; return {...p,leadSec:lead,durationSec:(typeof d==='number'&&Number.isFinite(d)&&d>lead)?Math.round(d):null}; },
  labels:t=>({area:'버프창 영역',icon:`${t.name} 아이콘`}),
  events:[
    {key:'pre',label:'미리 알림',beep:'buff',group:'pre',msg:t=>`${t.name} ${t.p.leadSec}초 전`},
    {key:'gone',label:'꺼짐',beep:'gone',group:'gone',msg:t=>`${t.name} 꺼졌어요`},
  ],
  step(t,st,det,source,now){ const evs=stepDetector(st,cfgView(t),det.score>=t.threshold,now); if(st.present) st.seen=true; return mapLearn(evs); },
  remainSec(t,st,now){
    if(!st.present||st.alertedPre||!st.appearedAt||!t.p.durationSec) return null;
    const r=(st.appearedAt+t.p.durationSec*1000-now)/1000; return r>0?r:null;
  },
  applyEffect(t,ev){
    if(ev.effect!=='learn'||ev.durationSec<=t.p.leadSec) return;      // 미리 알림 이하로 학습하면 켜지자마자 알림이 울리므로 버린다
    t.p.durationSec=ev.durationSec;
    if(typeof onTargetChanged==='function') onTargetChanged(t,'durationSec');
    if(typeof setNote==='function') setNote(`학습한 시간 ${fmt(ev.durationSec)} · 맞지 않으면 직접 고치세요`,'info');
  },
  status(t,st,now,ctx){
    const c=commonStatus(KINDS.buff,t,ctx); if(c) return c;
    if(!st.present&&!st.seen) return NOT_SEEN;
    if(!st.present) return {text:'꺼져 있음',cls:'off',sub:''};
    if(!st.appearedAt) return {text:'켜짐',cls:'on',sub:'켜진 시점을 몰라요 · 다음 사용부터 계산 (또는 “방금 켰어요”)'};
    if(!t.p.durationSec) return {text:'켜짐 · 학습 중',cls:'on',sub:`${fmt((now-st.appearedAt)/1000)} 경과 · 꺼지면 지속시간을 기억합니다`};
    const rem=(st.appearedAt+t.p.durationSec*1000-now)/1000;
    return {text:'남은 시간 '+fmt(rem),cls:rem<=t.p.leadSec?'alert':'on',sub:''};
  },
  cardFields:()=>[
    {key:'durationSec',label:'지속시간',type:'text',placeholder:'자동 학습',suffix:'분:초',
     get:t=>t.p.durationSec?fmt(t.p.durationSec):'',
     set:(t,raw)=>{ const v=parseDur(raw); if(v===undefined) return {revert:true}; const m=checkDurLead(v,t.p.leadSec,'duration'); if(m) return {revert:true,msg:m}; t.p.durationSec=v||null; return {}; }},
    leadField,
  ],
  actions:[{key:'restart',label:'방금 켰어요',run(t,st,now){ Object.assign(st,{appearedAt:now,alertedPre:false,preMarkRemain:0,present:true,seen:true,onStreak:2,offStreak:0,armed:true}); }}],
});

registerKind('countdown',{
  label:'카운트다운', trackSeen:true,
  defaults:()=>({leadSec:10}),
  normalizeP:p=>({...p,leadSec:clampInt(p.leadSec,1,120,10)}),
  labels:()=>({area:'남은시간 타이머 주변',icon:'“◷ 남은시간” 글자'}),
  events:[
    {key:'pre',label:'미리 알림',beep:'booster',group:'pre',msg:t=>`${t.name} ${t.p.leadSec}초 전`},
    {key:'gone',label:'꺼짐',beep:'gone',group:'gone',msg:t=>`${t.name} 꺼졌어요`},
    {key:'unread',label:'숫자 못 읽음',beep:'system',group:null,msg:t=>`${t.name} 숫자를 못 읽고 있어요`},
  ],
  step(t,st,det,source,now){
    const hit=det.score>=t.threshold, evs=stepDetector(st,cfgView(t),hit,now); if(st.present) st.seen=true;
    const o=st.present&&hit?readTimer(source,det.pos):null; st.ocrRect=o&&o.rect; if(o&&o.read) st.lastText=o.read.text;
    evs.push(...stepCountdown(st,cfgView(t),o&&o.read?o.read.value:null,now));
    return evs;
  },
  markPre(st,now){ st.alertedPre=true; st.preMarkRemain=st.remain!=null?Math.max(0,st.remain-(now-st.remainAt)/1000):0; },
  remainSec(t,st,now){
    if(!st.present||st.alertedPre||st.remain==null) return null;
    const r=st.remain-(now-st.remainAt)/1000; return r>0?r:null;
  },
  status(t,st,now,ctx){
    const c=commonStatus(KINDS.countdown,t,ctx); if(c) return c;
    if(!st.present&&!st.seen) return NOT_SEEN;
    if(!st.present) return {text:'꺼져 있음',cls:'off',sub:''};
    const stuck=`숫자를 ${UNREAD_MS/1000}초 넘게 못 읽었어요`;
    if(st.remain==null) return {text:st.ocrWarned?'켜짐 · 숫자를 못 읽음':'켜짐 · 숫자 읽는 중',cls:st.ocrWarned?'alert':'on',
      sub:st.ocrWarned?stuck+' · 안 되면 “등록”으로 “◷ 남은시간” 글자를 직접 지정':st.lastText?'읽은 값 '+st.lastText:'타이머 숫자를 아직 못 읽었어요'};
    const rem=st.remain-(now-st.remainAt)/1000;
    return {text:'남은 시간 '+fmt(rem),cls:rem<=t.p.leadSec?'alert':'on',sub:st.ocrWarned?stuck+' · 이 시간은 추정이에요':'읽은 값 '+st.lastText+'초'};
  },
  cardFields:()=>[{...leadField,set:(t,raw)=>{ t.p.leadSec=clampInt(raw,1,120,10); return {}; }}],   // 부스터는 지속시간이 없어 검사할 것이 없다
});

registerKind('rune',{
  label:'룬',
  defaults:()=>({repeatSec:60}),
  normalizeP:p=>({...p,repeatSec:clampInt(p.repeatSec,0,600,60)}),
  labels:()=>({area:'미니맵 영역',icon:'룬 아이콘'}),
  events:[
    {key:'appear',label:'나왔을 때',beep:'rune',group:null,msg:()=>'룬이 나왔어요'},
    {key:'remind',label:'아직 있을 때',beep:'rune',group:null,msg:()=>'룬 아직 있어요'},
  ],
  step(t,st,det,source,now){ const evs=stepDetector(st,cfgView(t),det.score>=t.threshold,now); if(st.present) st.seen=true; return evs.map(e=>e==='appear-unknown'?'appear':e); },
  status(t,st,now,ctx){
    const c=commonStatus(KINDS.rune,t,ctx); if(c) return c;
    return {text:st.present?'룬 있음!':'룬 없음',cls:st.present?'alert':'off',sub:''};
  },
  cardFields:()=>[{key:'repeatSec',label:'반복 알림',type:'number',min:0,max:600,suffix:'초마다',hint:'(0=끔)',
    get:t=>t.p.repeatSec, set:(t,raw)=>{ t.p.repeatSec=clampInt(raw,0,600,0); return {}; }}],
});

if(typeof module==='object') module.exports={KINDS,registerKind,cardStatus,cfgView,unionRect,labelsOf};
```

- [ ] **Step 7: `index.html`에 스크립트를 더한다**

```diff
diff --git a/index.html b/index.html
--- a/index.html
+++ b/index.html
@@ -67,4 +67,5 @@
 <script src="js/preset-data.js"></script>
 <script src="js/targets.js"></script>
+<script src="js/kinds.js"></script>
 <script src="js/alerts.js"></script>
 <script src="js/sounds.js"></script>
```

- [ ] **Step 8: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
runb tests/browser/regression.mjs
```

Expected: `# pass 41` `# fail 0`, 브라우저 `RESULT 14 passed, 0 failed`(새 파일이 로드만 되고 아직 쓰이지 않음).

- [ ] **Step 9: 커밋**

```bash
git add index.html js/kinds.js js/targets.js js/util.js tests/kinds.test.js tests/load.js tests/util.test.js
git commit -F - <<'EOF'
KINDS 종류 등록부: buff·countdown·rune의 이벤트·문구·상태·입력 칸·등록 훅

종류별 동작을 한 곳에 모은다(묶음 3·4는 registerKind로 종류를 더한다). 기존
stepDetector/stepCountdown은 그대로 두고 cfgView로 감싼다. 아직 화면은 쓰지 않는다.
checkDurLead로 지속시간 <= 미리 알림 입력을 거절하는 문구를 둔다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 9: 저장소 v2 · `migrateV1` · `normalizeTarget` · `loadStore`

**Files:**
- Modify: `js/targets.js`, `tests/targets.test.js`(새 파일)

- [ ] **Step 1: 테스트를 만든다**

`migrateV1`(모든 필드, 부스터 재설정, 룬 `leadSec` 버림, 비어 있거나 깨진 입력, 멱등), `normalizeTarget`(범위 보정·모르는 kind 보존), `makeId`(삭제한 id 재사용 없음), `loadStore`의 네 상태와 저장 실패, `checkName`, `targetSnapshot`.

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.js');

const L = load(['js/util.js', 'js/detect-core.js', 'js/targets.js', 'js/kinds.js'], { PRESET_ICONS: { sol: [], booster: [] } });
const { migrateV1, normalizeTarget, normalizeStore, makeId, defaultStore, loadStore, saveStore, checkName, targetSnapshot, newState } = L;
const plain = L.plain;
const fakeStorage = (init = {}, opt = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (opt.failSet) throw new Error('quota'); m.set(k, String(v)); }, m }; };
const FULL_V1 = {
  sol: { enabled: false, area: { x: 1, y: 2, w: 300, h: 80 }, tpl: { url: 'data:sol', w: 30, h: 30 }, frameW: 1920, frameH: 1080, threshold: 0.8, durationSec: 1800, leadSec: 15, repeatSec: 99, kind: 'x' },
  booster: { ver: 2, enabled: true, area: { x: 5, y: 5, w: 100, h: 30 }, tpl: { url: 'data:b', w: 60, h: 18 }, frameW: 1920, frameH: 1080, threshold: 0.66, leadSec: 20 },
  rune: { enabled: true, area: { x: 9, y: 9, w: 200, h: 200 }, tpl: { url: 'data:r', w: 12, h: 12 }, frameW: 1920, frameH: 1080, threshold: 0.85, repeatSec: 30, leadSec: 77 },
};

test('기본 저장소: sol, booster, rune 순서의 내장 3개, 묶기 꺼짐', () => {
  const s = plain(defaultStore());
  assert.deepEqual(s.targets.map(t => [t.id, t.kind, t.name, t.preset, t.threshold]),
    [['sol', 'buff', '솔 야누스', 'sol', 0.75], ['booster', 'countdown', '부스터', 'booster', 0.7], ['rune', 'rune', '룬', null, 0.8]]);
  assert.deepEqual(s.group, { on: false, windowSec: 10 }); assert.equal(s.seq, 0); assert.equal(s.ver, 2);
});

test('migrateV1: 모든 필드를 스펙 4.2 표대로 옮긴다', () => {
  const s = plain(migrateV1(FULL_V1)), [sol, booster, rune] = s.targets;
  assert.deepEqual([sol.id, sol.enabled, sol.threshold, sol.area, sol.tpl, sol.frameW, sol.p], ['sol', false, 0.8, { x: 1, y: 2, w: 300, h: 80 }, { url: 'data:sol', w: 30, h: 30 }, 1920, { durationSec: 1800, leadSec: 15 }]);
  assert.deepEqual([booster.threshold, booster.p, booster.tpl.url], [0.66, { leadSec: 20 }, 'data:b']);   // ver:2 이므로 재설정 없음
  assert.deepEqual([rune.p, rune.threshold], [{ repeatSec: 30 }, 0.85]);                                // 룬의 leadSec는 버림
  assert.equal('kind' in sol && sol.kind, 'buff');                                                      // v1에 저장된 kind(x)는 무시
});

test('migrateV1: 부스터 ver이 없거나 1이면 등록·기준값을 초기화(예전 부스터 재설정 이력)', () => {
  for (const ver of [undefined, 1]) {
    const v1 = { ...FULL_V1, booster: { ...FULL_V1.booster, ver } }, b = plain(migrateV1(v1)).targets[1];
    assert.deepEqual([b.tpl, b.area, b.frameW, b.frameH, b.threshold, b.p.leadSec], [null, null, 0, 0, 0.7, 20]);
  }
});

test('migrateV1: 비었거나 객체가 아니면 기본 목록, 값이 없으면 기본값, 두 번 돌려도 같다', () => {
  for (const bad of [null, [], 'x', 5, {}]) assert.deepEqual(plain(migrateV1(bad)).targets.map(t => t.id), ['sol', 'booster', 'rune']);
  const partial = plain(migrateV1({ sol: { tpl: { url: 'u', w: 5, h: 5 } } })).targets[0];
  assert.deepEqual([partial.enabled, partial.threshold, partial.p], [true, 0.75, { durationSec: null, leadSec: 10 }]);
  const once = plain(migrateV1(FULL_V1));
  assert.deepEqual(plain(migrateV1(FULL_V1)), once);
});

test('normalizeTarget: 범위 보정, 알 수 없는 필드 보존, 이름 보정', () => {
  const t = plain(normalizeTarget({ id: 'u3', kind: 'buff', name: '  유니온의 힘  ', threshold: 5, enabled: true, preset: 'nope', frameW: -4, area: { x: 0, y: 0, w: 0, h: 5 }, tpl: { url: 7 }, p: { leadSec: 500, durationSec: 5 }, extra: 'keep' }));
  assert.deepEqual([t.name, t.threshold, t.preset, t.frameW, t.area, t.tpl, t.p, t.extra], ['유니온의 힘', 0.98, null, 0, null, null, { leadSec: 120, durationSec: null }, 'keep']);
  assert.equal(plain(normalizeTarget({ id: 'u3', kind: 'buff', name: '', threshold: 0.1, p: {} })).name, 'u3');
  assert.equal(plain(normalizeTarget({ id: 'u3', kind: 'buff', name: '가'.repeat(20), p: {} })).name.length, 12);
  assert.equal(plain(normalizeTarget({ id: 'u3', kind: 'buff', name: 'a', threshold: 0.1, p: {} })).threshold, 0.4);
  assert.equal(plain(normalizeTarget({ id: 'rune', kind: 'rune', name: '룬', threshold: 'abc', p: {} })).threshold, 0.8);
});

test('normalizeTarget: 알 수 없는 kind는 지우지 않고 꺼 둔다', () => {
  const t = plain(normalizeTarget({ id: 'u9', kind: 'future', name: '미래', enabled: true, p: { z: 1 } }));
  assert.deepEqual([t.kind, t.enabled, t.p], ['future', false, { z: 1 }]);
});

test('normalizeStore: 중복 id·잘못된 id는 버리고, 12개 상한, seq는 가장 큰 u번호 이상', () => {
  const mk = id => ({ id, kind: 'buff', name: id, p: {} });
  const s = plain(normalizeStore({ ver: 2, seq: 2, targets: [mk('u5'), mk('u5'), mk('zzz'), mk('sol'), mk('u1')], group: { on: true, windowSec: 7 } }));
  assert.deepEqual(s.targets.map(t => t.id), ['u5', 'sol', 'u1']);
  assert.equal(s.seq, 5);
  assert.deepEqual(s.group, { on: true, windowSec: 10 });
  const many = plain(normalizeStore({ ver: 2, seq: 0, targets: Array.from({ length: 15 }, (_, i) => mk('u' + (i + 1))) }));
  assert.equal(many.targets.length, 12); assert.equal(many.seq, 15);
});

test('makeId: u + 증가 숫자, 삭제한 id를 다시 쓰지 않는다', () => {
  const store = plain(defaultStore());
  assert.equal(makeId(store), 'u1'); store.targets.push({ id: 'u1' }); assert.equal(makeId(store), 'u2');
  store.targets = store.targets.filter(t => t.id !== 'u2');                       // u2를 지움
  assert.equal(makeId(store), 'u3'); assert.equal(store.seq, 3);
  assert.match(makeId(store), /^u\d+$/);
});

test('loadStore: v2가 있으면 그대로(ok), 쓰지 않는다', () => {
  const st = fakeStorage({ 'maple-web-timer-v2': JSON.stringify({ ver: 2, seq: 3, targets: plain(defaultStore()).targets, group: { on: true, windowSec: 5 } }) });
  const r = plain(loadStore(st));
  assert.equal(r.status, 'ok'); assert.equal(r.saveFailed, false); assert.deepEqual(r.store.group, { on: true, windowSec: 5 }); assert.equal(r.store.seq, 3);
});

test('loadStore: v2가 없고 v1이 있으면 이전(migrated)하고 v2를 쓰되 v1은 지우지 않는다. 두 번째 로드는 ok', () => {
  const st = fakeStorage({ 'maple-web-timer-v1': JSON.stringify(FULL_V1) });
  const r = plain(loadStore(st));
  assert.equal(r.status, 'migrated'); assert.equal(r.store.targets[0].p.durationSec, 1800);
  assert.ok(st.m.has('maple-web-timer-v2')); assert.ok(st.m.has('maple-web-timer-v1'));
  const r2 = plain(loadStore(st)); assert.equal(r2.status, 'ok'); assert.deepEqual(r2.store, r.store);
});

test('loadStore: 아무것도 없으면 fresh(기본 목록, 아무것도 쓰지 않음), v1이 깨졌거나 객체가 아니어도 fresh', () => {
  const empty = fakeStorage(); const r = plain(loadStore(empty));
  assert.equal(r.status, 'fresh'); assert.equal(r.store.targets.length, 3); assert.equal(empty.m.size, 0);
  for (const bad of ['{oops', '[]', 'null']) { const s = fakeStorage({ 'maple-web-timer-v1': bad }); assert.equal(plain(loadStore(s)).status, 'fresh'); assert.equal(s.m.has('maple-web-timer-v2'), false); }
});

test('loadStore: v2가 깨졌거나 ver>2 이거나 targets가 배열이 아니면 broken, 원문을 -broken에 보관하고 v1 이전은 하지 않는다', () => {
  for (const raw of ['{oops', JSON.stringify({ ver: 3, targets: [] }), JSON.stringify({ ver: 2, targets: {} })]) {
    const st = fakeStorage({ 'maple-web-timer-v2': raw, 'maple-web-timer-v1': JSON.stringify(FULL_V1) });
    const r = plain(loadStore(st));
    assert.equal(r.status, 'broken'); assert.equal(st.m.get('maple-web-timer-v2-broken'), raw);
    assert.equal(r.store.targets[0].p.durationSec, null);            // v1(1800)을 쓰지 않았다
  }
});

test('loadStore: 저장 실패는 saveFailed로 알리고 메모리 목록으로 계속, 저장소 접근이 막혀도 동작', () => {
  const st = fakeStorage({ 'maple-web-timer-v1': JSON.stringify(FULL_V1) }, { failSet: true });
  const r = plain(loadStore(st)); assert.equal(r.status, 'migrated'); assert.equal(r.saveFailed, true);
  const none = plain(loadStore(null)); assert.equal(none.status, 'fresh');
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(plain(loadStore(throwing)).status, 'fresh');
  assert.equal(saveStore(defaultStore(), throwing), false);
});

test('checkName: 앞뒤 공백 제거, 1~12자, 다른 대상과 같은 이름 금지(자기 자신은 허용)', () => {
  const ts = [{ id: 'sol', name: '솔 야누스' }, { id: 'u1', name: '유니온의 힘' }];
  assert.deepEqual(plain(checkName('  새 버프 ', ts, null)), { ok: true, name: '새 버프', msg: '' });
  assert.equal(checkName('   ', ts, null).ok, false);
  assert.equal(checkName('가'.repeat(13), ts, null).ok, false);
  assert.equal(checkName('가'.repeat(12), ts, null).ok, true);
  assert.equal(checkName('유니온의 힘', ts, null).ok, false);
  assert.equal(checkName('유니온의 힘', ts, 'u1').ok, true);
  assert.equal(checkName('', ts, null).msg, '이름을 1~12자로, 다른 대상과 다르게 입력해 주세요');
});

test('targetSnapshot: 상태줄·PIP가 같이 쓰는 행', () => {
  const targets = plain(defaultStore()).targets.concat([{ id: 'u9', kind: 'future', name: '미래', enabled: false, p: {} }]);
  const st = newState(); st.present = true; st.seen = true; st.appearedAt = 1000;
  targets[0].p.durationSec = 100;
  const rows = plain(targetSnapshot(targets, { sol: st }, { src: true, frame: { w: 1280, h: 720 } }, 31_000));
  assert.deepEqual(rows[0], { id: 'sol', name: '솔 야누스', kind: 'buff', enabled: true, stripState: 'ok', statusText: '남은 시간 01:10', remainSec: 70 });
  assert.equal(rows[1].stripState, 'unseen'); assert.equal(rows[2].stripState, 'reg');
  assert.deepEqual([rows[3].stripState, rows[3].statusText], ['off', '이 버전에서 지원하지 않는 종류예요']);
});
```

- [ ] **Step 2: 실패를 본다**

```bash
node --test tests/targets.test.js 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 0` `# fail 15` (모두 `TypeError: … is not a function`).

- [ ] **Step 3: 구현**

`targets.js` 끝에 덧붙인다. 순수 함수는 저장소 객체(`getItem`/`setItem`)를 인자로 받아 node에서 시험하고, 인자를 생략하면 `localStorage`를 쓴다.

```diff
diff --git a/js/targets.js b/js/targets.js
--- a/js/targets.js
+++ b/js/targets.js
@@ -31,2 +31,95 @@ const PRESETS={
   booster:{scales:[0.8,1,1.25,1.5], area:f=>({x:Math.round(f.w*0.2),y:0,w:Math.round(f.w*0.6),h:Math.round(f.h*0.3)}), get icons(){ return PRESET_ICONS.booster; }},
 };
+
+/* ----- 저장소 v2: 형식·검사·이전 (순수 함수. 저장소 객체를 인자로 받아 node에서 시험한다) ----- */
+const STORE_V1='maple-web-timer-v1', STORE_V2='maple-web-timer-v2', STORE_BROKEN='maple-web-timer-v2-broken';
+const ID_RE=/^(sol|booster|rune|u\d+)$/;                  // sys·grp·manual·m<숫자>는 다른 용도로 예약
+const GROUP_WINDOWS=[5,10,20];
+const defaultGroup=()=>({on:false,windowSec:10});          // 알림 묶기는 기본 꺼짐(사용자 결정)
+function newTarget(id,kind,name,extra){
+  return Object.assign({id,kind,name,preset:null,enabled:true,threshold:0.75,area:null,tpl:null,frameW:0,frameH:0,p:KINDS[kind].defaults()},extra||{});
+}
+function builtinTarget(id){ const b=BUILTIN[id]; return newTarget(id,b.kind,b.name,{preset:b.preset,threshold:b.threshold}); }
+function defaultStore(){ return {ver:2,seq:0,targets:['sol','booster','rune'].map(builtinTarget),group:defaultGroup()}; }
+const validRect=r=>!!r&&['x','y','w','h'].every(k=>Number.isFinite(+r[k]))&&r.w>0&&r.h>0;
+// v2를 불러올 때마다 각 대상에 적용: 범위 밖 값은 자르고, 모르는 필드는 보존, 모르는 kind는 지우지 않고 끈다
+function normalizeTarget(t){
+  const o=Object.assign({},t); o.id=String(o.id);
+  const nm=typeof o.name==='string'?o.name.trim().slice(0,12):'';
+  o.name=nm||(BUILTIN[o.id]&&BUILTIN[o.id].name)||o.id;
+  o.enabled=typeof o.enabled==='boolean'?o.enabled:true;
+  const th=+o.threshold; o.threshold=Number.isFinite(th)?Math.min(0.98,Math.max(0.4,th)):(BUILTIN[o.id]?BUILTIN[o.id].threshold:0.75);
+  o.preset=PRESETS[o.preset]?o.preset:null;
+  o.frameW=Math.max(0,Math.round(+o.frameW)||0); o.frameH=Math.max(0,Math.round(+o.frameH)||0);
+  o.area=validRect(o.area)?{x:+o.area.x,y:+o.area.y,w:+o.area.w,h:+o.area.h}:null;
+  o.tpl=o.tpl&&typeof o.tpl.url==='string'&&o.tpl.w>0&&o.tpl.h>0?{url:o.tpl.url,w:o.tpl.w,h:o.tpl.h}:null;
+  const k=KINDS[o.kind]; if(!k){ o.enabled=false; return o; }
+  o.p=k.normalizeP(Object.assign(k.defaults(),o.p&&typeof o.p==='object'?o.p:{}));
+  return o;
+}
+function normalizeStore(raw){
+  const seen=new Set(), targets=[]; let maxU=0;
+  for(const t of raw.targets){
+    if(!t||typeof t!=='object'||!ID_RE.test(String(t.id))||seen.has(String(t.id))) continue;
+    const m=/^u(\d+)$/.exec(t.id); if(m) maxU=Math.max(maxU,+m[1]);
+    if(targets.length>=TARGET_MAX) continue;
+    seen.add(String(t.id)); targets.push(normalizeTarget(t));
+  }
+  const g=raw.group||{}, seq=Number.isFinite(+raw.seq)?Math.floor(+raw.seq):0;
+  return {ver:2,seq:Math.max(seq,maxU),targets,group:{on:g.on===true,windowSec:GROUP_WINDOWS.includes(g.windowSec)?g.windowSec:10}};
+}
+// 새 대상 id: u + 단조 증가 숫자. 삭제한 id는 다시 쓰지 않으므로 지워진 대상의 내 소리가 새 대상에 붙지 않는다
+function makeId(store){ store.seq=(store.seq||0)+1; return 'u'+store.seq; }
+// v1(대상 id별 객체) → v2. 스펙 4.2 표
+function migrateV1(v1){
+  const store=defaultStore();
+  if(!v1||typeof v1!=='object'||Array.isArray(v1)) return store;
+  const b=v1.booster&&typeof v1.booster==='object'?{...v1.booster}:null;
+  if(b&&b.ver!==2) Object.assign(b,{tpl:null,area:null,frameW:0,frameH:0,threshold:0.7});   // 예전 부스터 재설정(ver 2 이전 값은 못 씀)
+  const src={sol:v1.sol,booster:b,rune:v1.rune};
+  store.targets=store.targets.map(t=>{
+    const o=src[t.id]; if(!o||typeof o!=='object') return t;
+    const m=Object.assign({},t,{enabled:typeof o.enabled==='boolean'?o.enabled:true,area:o.area||null,tpl:o.tpl||null,frameW:o.frameW,frameH:o.frameH});
+    if(Number.isFinite(+o.threshold)&&o.threshold!=null) m.threshold=+o.threshold;
+    const p=Object.assign({},t.p);
+    if(t.id==='sol'){ p.durationSec=o.durationSec||null; if(o.leadSec!=null) p.leadSec=o.leadSec; }
+    if(t.id==='booster'&&o.leadSec!=null) p.leadSec=o.leadSec;
+    if(t.id==='rune'&&o.repeatSec!=null) p.repeatSec=o.repeatSec;
+    m.p=p; return normalizeTarget(m);
+  });
+  return store;
+}
+const browserStorage=()=>{ try{ return typeof localStorage!=='undefined'?localStorage:null; }catch(e){ return null; } };
+function saveStore(store,st){ try{ st=st===undefined?browserStorage():st; if(!st) return false; st.setItem(STORE_V2,JSON.stringify(store)); return true; }catch(e){ return false; } }
+// status: 'ok'(v2 정상) | 'migrated'(v1에서 이전) | 'fresh'(저장된 것 없음) | 'broken'(v2를 못 읽음). 고아 정리는 ok·migrated일 때만
+function loadStore(st){
+  st=st===undefined?browserStorage():st;
+  const get=k=>{ try{ return st?st.getItem(k):null; }catch(e){ return null; } };
+  const parse=raw=>{ try{ return JSON.parse(raw); }catch(e){ return undefined; } };
+  const v2raw=get(STORE_V2);
+  if(v2raw!=null){
+    const v2=parse(v2raw);
+    if(v2&&typeof v2==='object'&&v2.ver===2&&Array.isArray(v2.targets)) return {store:normalizeStore(v2),status:'ok',saveFailed:false};
+    try{ st.setItem(STORE_BROKEN,v2raw); }catch(e){}
+    return {store:defaultStore(),status:'broken',saveFailed:false};      // v1 이전은 하지 않는다
+  }
+  const v1raw=get(STORE_V1), v1=v1raw!=null?parse(v1raw):undefined;
+  if(v1&&typeof v1==='object'&&!Array.isArray(v1)){
+    const store=migrateV1(v1); return {store,status:'migrated',saveFailed:!saveStore(store,st)};   // v1 키는 지우지 않는다
+  }
+  return {store:defaultStore(),status:'fresh',saveFailed:false};
+}
+function checkName(raw,targets,selfId){
+  const name=String(raw==null?'':raw).trim();
+  if(name.length<1||name.length>12||targets.some(t=>t.id!==selfId&&t.name===name)) return {ok:false,name,msg:'이름을 1~12자로, 다른 대상과 다르게 입력해 주세요'};
+  return {ok:true,name,msg:''};
+}
+// 상태줄과 묶음 5의 PIP가 같이 쓰는 한 행. ctx={src:boolean, frame:{w,h}}
+function targetSnapshot(targets,states,ctx,now){
+  return targets.map(t=>{
+    const k=KINDS[t.kind], st=states[t.id]||newState();
+    if(!k) return {id:t.id,name:t.name,kind:t.kind,enabled:false,stripState:'off',statusText:'이 버전에서 지원하지 않는 종류예요',remainSec:null};
+    return {id:t.id,name:t.name,kind:t.kind,enabled:t.enabled,stripState:k.stripState(t,st,now,ctx),statusText:cardStatus(t,st,now,ctx).text,remainSec:k.remainSec(t,st,now)};
+  });
+}
+if(typeof module==='object') module.exports={BUILTIN,PRESETS,defaultStore,newTarget,builtinTarget,normalizeTarget,normalizeStore,makeId,migrateV1,loadStore,saveStore,checkName,targetSnapshot};
```

- [ ] **Step 4: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
runb tests/browser/regression.mjs
```

Expected: `# pass 56` `# fail 0`, 브라우저 14 통과(새 전역 이름이 예전 코드와 부딪히지 않음).

- [ ] **Step 5: 커밋**

```bash
git add js/targets.js tests/targets.test.js
git commit -F - <<'EOF'
저장소 v2 모델: Target 형식, migrateV1, normalizeTarget, loadStore(status), checkName

v1은 지우지 않고 읽기만 한다. v2가 깨졌거나 ver>2이면 원문을 -v2-broken에 두고 v1
이전 없이 기본 목록으로 시작한다. 새 id는 u+증가 숫자이고 삭제한 id는 다시 쓰지 않는다.
targetSnapshot은 상태줄과 묶음 5의 PIP가 같이 쓴다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Phase D. 알림 경로

### Task 10: `Alerts` 경로 (`notify`/`fire`/`fireSystem` 대체)

모든 알림이 지나는 한 곳을 만든다(스펙 7절). 소리·음성·내 소리·토스트·탭 제목·브라우저 알림·카드 깜빡임은 지금과 같고, 묶기는 Task 18에서 더한다. `createAlerts(io)`는 소리·화면 쪽(`io`)을 바꿔 끼울 수 있어 node에서 시험한다. 예전 호출부(`fire(d,kind)`, `fireSystem`)는 Task 11까지 `Alerts.fire`를 부르는 얇은 함수로 남긴다.

**Files:**
- Create: `tests/alerts.test.js`
- Modify: `js/alerts.js`(전체 교체), `js/sounds.js`(`playCustom`의 출력 노드)

- [ ] **Step 1: 테스트를 만든다**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAlerts } = require('../js/alerts.js');

// 소리·화면 쪽은 가짜로 바꿔 끼워 Alerts.fire의 경로만 시험한다
function setup() {
  const log = [];
  const io = { now: () => 1234, play: r => { log.push(['play', r.id, r.event, r.slot, r.mode, r.beep]); return r.slot === 'u1.pre'; },
    ui: (text, tag) => log.push(['ui', text, tag]), flash: ids => log.push(['flash', ids]) };
  return { A: createAlerts(io), log };
}

test('fire: 소리 → 화면 알림 → 카드 깜빡임 순서, 슬롯·깜빡임 기본값은 id.event, card-id', () => {
  const { A, log } = setup();
  A.fire({ src: 'target', id: 'u1', event: 'pre', text: '유니온의 힘 10초 전', beep: 'buff' });
  assert.deepEqual(log, [['play', 'u1', 'pre', 'u1.pre', 'full', 'buff'], ['ui', '유니온의 힘 10초 전', 'u1'], ['flash', ['card-u1']]]);
});

test('fire: slot:null이면 내 소리 슬롯 없음, flash:null이면 깜빡임 없음, mode voice는 음성만(화면 알림 없음)', () => {
  const { A, log } = setup();
  A.fire({ src: 'system', id: 'sys', event: 'back', text: '게임 화면이 다시 들어와요', beep: 'system', slot: null, mode: 'voice', flash: null });
  assert.deepEqual(log, [['play', 'sys', 'back', null, 'voice', 'system']]);
  log.length = 0;
  A.fire({ src: 'system', id: 'sys', event: 'lost', text: 'x', beep: 'system', slot: 'sys.lost', flash: null });
  assert.deepEqual(log.map(l => l[0]), ['play', 'ui']);
});

test('listen: 재생 직후 AlertRec를 한 번 받고, 해제하면 안 받는다. 구독자 오류는 알림을 막지 않는다', () => {
  const { A } = setup(); const got = [];
  const off = A.listen(r => got.push(r));
  A.listen(() => { throw new Error('boom'); });
  A.fire({ src: 'target', id: 'u1', event: 'pre', text: 't', beep: 'buff' });
  assert.deepEqual(got, [{ at: 1234, src: 'target', ids: ['u1'], event: 'pre', text: 't', grouped: false, custom: true }]);
  off(); A.fire({ src: 'target', id: 'u1', event: 'pre', text: 't', beep: 'buff' });
  assert.equal(got.length, 1);
});

test('flush: 묶기 대기열이 없으면 아무 일도 하지 않는다(호출만 가능)', () => {
  const { A, log } = setup(); A.flush(5000); assert.deepEqual(log, []);
});
```

- [ ] **Step 2: 실패를 본다**

```bash
node --test tests/alerts.test.js 2>&1 | grep -E "TypeError|^# (pass|fail)" | sort | uniq -c
```

Expected: `TypeError: createAlerts is not a function`이 4번, `# fail 4`.

- [ ] **Step 3: `js/alerts.js`를 다음으로 교체한다**

- `SOUNDS.buff`를 새로 두고 예전 `sol`은 같은 패턴의 별칭으로 둔다(예전 호출부용, Task 11에서 삭제).
- `unlockAudio()`는 오디오가 켜지면 `Alerts.onAudioReady` 대기자를 부른다. `Alerts.audioOut()`은 오디오를 켜기 전에는 `null`, 켠 뒤에는 `actx.destination`(묶음 5가 `setAudioOut`으로 마스터 노드를 꽂는 자리)이다. `beep`은 이 노드로 연결한다.
- `playDefault`는 `beep`가 없으면 음성만 한다. `mode:'voice'`(연결 회복 알림)는 음성만 하고 토스트·제목·카드 깜빡임을 하지 않는다 [확인: 현재 `fireSystem('back')`이 `speak`만 부름].

```js
/* ===== 알림 경로 (묶음 1 스펙 7절). 모든 알림은 Alerts.fire 한 곳을 지난다 ===== */
// 소리만 듣고도 무슨 알림인지 알 수 있게 대상·이벤트마다 패턴을 나눔. 연결 문제는 음색부터 다르게(톱니파, 낮은 음)
const BUFF_BEEP={wave:'square',notes:[[1046,.15],[1046,.15],[784,.3]]};   // 딩딩-동
const SOUNDS={
  buff:   BUFF_BEEP,                                                              // 모든 버프 공용(솔 야누스 포함)
  sol:    BUFF_BEEP,                                                              // 예전 호출부용 별칭(Task E1에서 삭제)
  booster:{wave:'square',  notes:[[1318,.08],[1318,.08],[1318,.08],[988,.28]]},  // 딱딱딱-동
  gone:   {wave:'square',  notes:[[784,.2],[523,.45]]},                          // 내려가는 두 음
  rune:   {wave:'square',  notes:[[880,.12],[1175,.12],[1568,.2]]},              // 올라가는 세 음
  system: {wave:'sawtooth',notes:[[330,.22],[330,.22],[330,.22]],gain:.13},      // 낮은 경고음
};
let actx=null, beepEnd=0, audioOutNode=null; const audioWaiters=[];
function unlockAudio(){
  try{ actx=actx||new AudioContext(); if(actx.state==='suspended') actx.resume(); }catch(e){}
  predecodeSounds();
  if(actx) while(audioWaiters.length){ const fn=audioWaiters.shift(); try{ fn(actx); }catch(e){ console.error(e); } }
}
// 알림 순간에 디코딩하느라 순서가 밀리지 않도록, 오디오를 켤 때 내 소리를 미리 풀어 둠
function predecodeSounds(){ if(!actx) return; for(const c of customSounds.values()) if(!c.buf&&!c.decoding){ c.decoding=true; actx.decodeAudioData(c.data.slice(0)).then(b=>{ c.buf=b; },()=>{}).finally(()=>{ c.decoding=false; }); } }
// 앞 소리가 끝난 뒤에 이어서 예약해 겹치지 않게 함. 끝날 때까지 남은 초를 돌려줌
function beep(name){
  const s=SOUNDS[name]; if(!actx||!s) return 0;
  const amp=(s.gain||.18)*(+$('#vol').value); let t=Math.max(actx.currentTime+0.02, beepEnd);
  for(const [f,dur] of s.notes){ const o=actx.createOscillator(), g=actx.createGain();
    o.type=s.wave; o.frequency.value=f; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(amp,t+0.01); g.gain.setValueAtTime(amp,t+dur-0.03); g.gain.linearRampToValueAtTime(0,t+dur);
    o.connect(g).connect(Alerts.audioOut()); o.start(t); o.stop(t+dur); t+=dur+0.06; }
  beepEnd=t; return t-actx.currentTime;
}
// 음성은 끊지 않고 차례로 말함. 같은 문구가 8초 안에 또 오면 건너뛰고, 큐가 15초 넘게 막혀 있으면 비운 뒤 다시 말함
const spokenAt=new Map(); let speakQueuedAt=0;
function speak(text){
  if(!$('#voice').checked||!('speechSynthesis' in window)) return;
  const now=Date.now(); if(now-(spokenAt.get(text)||0)<8000) return; spokenAt.set(text,now);
  if((speechSynthesis.speaking||speechSynthesis.pending) && now-speakQueuedAt>15000) speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang='ko-KR'; u.volume=+$('#vol').value; u.rate=1.1;
  speechSynthesis.speak(u); speakQueuedAt=now;
}
const SYS_MSG={ lost:'화면 연결이 끊겼어요. 다시 연결해 주세요', stall:'게임 화면이 들어오지 않아요', back:'게임 화면이 다시 들어와요' };
let toastTimer, titleTimer=null;
// 기본 소리: 경고음 뒤에 음성. beep가 없으면 음성만
function playDefault(msg, sound){ const wait=sound?beep(sound):0; setTimeout(()=>speak(msg), Math.round(wait*1000)+150); }

/* ----- Alerts: 요청(AlertReq)을 받아 소리·화면 알림·카드 깜빡임으로 내보낸다. io를 바꿔 끼워 node에서 시험한다 -----
   AlertReq = {src:'target'|'manual'|'system'|'test', id, event, text, beep:string|null, slot:string|null, mode:'full'|'voice', group, flash:string|null}
   AlertRec = {at, src, ids[], event, text, grouped, custom}  (listen 구독자가 재생 직후 받음) */
function createAlerts(io){
  const listeners=new Set();
  const withDefaults=r=>Object.assign({},r,{
    slot:r.slot===undefined?`${r.id}.${r.event}`:r.slot, flash:r.flash===undefined?`card-${r.id}`:r.flash,
    mode:r.mode||'full', beep:r.beep===undefined?null:r.beep, group:r.group||null });
  function deliver(req){
    const custom=io.play(req);
    if(req.mode!=='voice'){ io.ui(req.text,req.id); if(req.flash) io.flash([req.flash]); }
    const rec={at:io.now(),src:req.src,ids:[req.id],event:req.event,text:req.text,grouped:false,custom};
    for(const fn of [...listeners]){ try{ fn(rec); }catch(e){ console.error(e); } }
  }
  return {
    fire(req){ deliver(withDefaults(req)); },
    flush(now){},                                    // tick() 끝에서 부른다. 묶기 대기열은 Task G2에서 채운다
    listen(fn){ listeners.add(fn); return ()=>listeners.delete(fn); },
  };
}
const browserIO={
  now:()=>Date.now(),
  // 내 소리 슬롯이 있으면 그것, 없으면 비프 뒤 음성. 돌려주는 값은 내 소리를 썼는지
  play(req){
    if(req.mode==='voice'){ speak(req.text); return false; }
    const custom=playCustom(req.slot, ()=>playDefault(req.text,req.beep));
    if(!custom) playDefault(req.text,req.beep);
    return custom;
  },
  ui(text,tag){
    const t=$('#toast'); t.textContent=text; t.style.display='block'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.style.display='none',6000);
    clearInterval(titleTimer); let i=0;
    titleTimer=setInterval(()=>{ document.title=(i++%2)?'⚠ '+text:baseTitle(); if(i>12){ clearInterval(titleTimer); titleTimer=null; document.title=baseTitle(); } },700);
    if(document.hidden && 'Notification' in window && Notification.permission==='granted'){ try{ new Notification(text,{tag,renotify:true}); }catch(e){} }
  },
  flash(ids){ for(const id of ids){ const el=document.getElementById(id); if(el){ el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } } },
};
const Alerts=Object.assign(createAlerts(browserIO),{
  // 묶음 5(볼륨 증폭)가 마스터 노드를 꽂는 자리. unlockAudio() 전에는 null
  audioOut:()=>actx?(audioOutNode||actx.destination):null,
  setAudioOut:node=>{ audioOutNode=node; },
  onAudioReady:fn=>{ if(actx) fn(actx); else audioWaiters.push(fn); },
});

/* ----- 예전 호출부(Task E1에서 KINDS 기반 호출로 바뀌며 사라짐) ----- */
const MSG={
  pre:(d,c)=>`${d.name} ${c.leadSec}초 전`,
  gone:d=>`${d.name} 꺼졌어요`,
  appear:()=>'룬이 나왔어요',
  remind:()=>'룬 아직 있어요',
  unread:d=>`${d.name} 숫자를 못 읽고 있어요`,
};
const soundName=(d,kind)=> kind==='gone' ? 'gone' : kind==='unread' ? 'system' : d.kind==='rune' ? 'rune'
                         : SOUNDS[d.id] ? d.id : d.kind==='countdown' ? 'booster' : 'sol';
function fire(d, kind){ Alerts.fire({src:'target',id:d.id,event:kind,text:MSG[kind](d,cfgs[d.id]),beep:soundName(d,kind)}); }
// 화면을 받는 쪽의 문제(끊김·멈춤)는 게임 알림과 다른 소리로 알림. 회복은 음성만
function fireSystem(kind){ Alerts.fire({src:'system',id:'sys',event:kind,text:SYS_MSG[kind],beep:'system',slot:'sys.'+kind,mode:kind==='back'?'voice':'full',flash:null}); }
if(typeof module==='object') module.exports={createAlerts};
```

- [ ] **Step 4: `js/sounds.js`의 내 소리 출력 노드를 `Alerts.audioOut()`으로 바꾼다**

```diff
diff --git a/js/sounds.js b/js/sounds.js
--- a/js/sounds.js
+++ b/js/sounds.js
@@ -24,5 +24,5 @@ function playCustom(slot, fallback){
   const c=slot&&customSounds.get(slot); if(!c||!actx) return false;
   const play=buf=>{ const n=actx.createBufferSource(), g=actx.createGain(); n.buffer=buf; g.gain.value=+$('#vol').value;
-    n.connect(g).connect(actx.destination); const t=Math.max(actx.currentTime+0.02, beepEnd); n.start(t); beepEnd=t+buf.duration+0.06; };
+    n.connect(g).connect(Alerts.audioOut()); const t=Math.max(actx.currentTime+0.02, beepEnd); n.start(t); beepEnd=t+buf.duration+0.06; };
   if(c.buf) play(c.buf);
   else actx.decodeAudioData(c.data.slice(0)).then(b=>{ c.buf=b; play(b); }, ()=>{ if(fallback) fallback(); });
```

- [ ] **Step 5: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
runb tests/browser/regression.mjs
```

Expected: `# pass 60` `# fail 0`(`Error: boom`이 두 줄 찍히는 것은 정상이다. 일부러 예외를 던지는 구독자를 로그만 남기고 넘기는 시험이다). 브라우저 `RESULT 14 passed, 0 failed`.

- [ ] **Step 6: 커밋**

```bash
git add js/alerts.js js/sounds.js tests/alerts.test.js
git commit -F - <<'EOF'
Alerts 경로: notify·fire·fireSystem을 Alerts.fire로 대체

요청(AlertReq)을 받아 내 소리 슬롯 → 기본 비프+음성, 토스트, 탭 제목, 브라우저 알림,
카드 깜빡임 순서로 내보내고 재생 직후 listen 구독자에게 AlertRec를 보낸다.
audioOut/onAudioReady/setAudioOut은 묶음 5(볼륨·PIP)가 꽂을 자리다. 소리·음성·
내 소리 동작은 그대로이며 예전 호출부는 Task 11까지 얇은 함수로 남긴다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Phase E. 런타임 전환

### Task 11: 런타임을 대상 목록·`KINDS`로 전환

`DEFS`/`cfgs`를 `store.targets`와 `KINDS`로 바꾼다. 카드는 아직 모두 펼친 채(지금 모양)로 둔다. **이 Task는 중간 단계에서 앱이 동작하지 않으므로(옛 전역이 사라짐) 모든 단계를 적용한 뒤 한 번에 확인한다.**

첫 로드에서 `loadStore()`가 `maple-web-timer-v1`을 읽어 v2로 옮기고(v1은 그대로 둠), 이후는 v2만 쓴다. 감지 흐름은 `detect → step → 이벤트 모으기(collectEvents) → 보내기(dispatchEvents) → Alerts.fire`이고, `events`에 선언된 키만 알림이 된다(`appear-unknown` 같은 내부 이벤트는 버림, `effect`는 종류의 `applyEffect`가 처리). 감지를 건너뛰는 틱에도 `onSkip` 종류는 `step(…, null)`을 받고, `grab()`은 `{frame, fresh}`를 돌려준다(묶음 3용). `main.js`는 필수 전역이 없으면 `파일이 빠졌어요: js/…`를 보여 주고, `init*()` 순서대로 부른 뒤 Worker를 시작하며, Worker 메시지마다 `manualTick`(있으면)을 `tick()`보다 먼저 부른다.

**Files:**
- Modify: `js/targets.js`, `js/capture.js`, `js/alerts.js`, `js/sounds.js`, `index.html`, `tests/browser/prelude.mjs`, `tests/browser/regression.mjs`
- Replace(전체 교체): `js/detect-run.js`, `js/ui-cards.js`, `js/ui-watch.js`, `js/register.js`, `js/main.js`
- Create: `tests/browser/model.mjs`

- [ ] **Step 1: `js/targets.js` 앞부분(예전 `DEFS`·`cfgs`·`save`·`needsRegister`·`needsReregister`)을 없애고, 실행 중 저장소를 더한다**

```diff
diff --git a/js/targets.js b/js/targets.js
--- a/js/targets.js
+++ b/js/targets.js
@@ -1,22 +1,3 @@
-const DEFS=[
-  {id:'sol',name:'솔 야누스',kind:'buff',areaLabel:'버프창 영역',iconLabel:'솔 야누스 아이콘',threshold:0.75,
-   presets:PRESET_ICONS.sol},
-  {id:'booster',name:'부스터',kind:'countdown',areaLabel:'남은시간 타이머 주변',iconLabel:'“◷ 남은시간” 글자',threshold:0.7,
-   presetArea:f=>({x:Math.round(f.w*0.2),y:0,w:Math.round(f.w*0.6),h:Math.round(f.h*0.3)}), presetScales:[0.8,1,1.25,1.5],
-   presets:PRESET_ICONS.booster},
-  {id:'rune',name:'룬',kind:'rune',areaLabel:'미니맵 영역',iconLabel:'룬 아이콘',threshold:0.8},
-];
-const STORE='maple-web-timer-v1';
-let cfgs={};
-function loadLegacyStore(){
-  try{ cfgs=JSON.parse(localStorage.getItem(STORE)||'{}'); }catch(e){}
-for(const d of DEFS){ cfgs[d.id]=Object.assign({enabled:true,area:null,tpl:null,frameW:0,frameH:0,threshold:d.threshold,durationSec:null,leadSec:10,repeatSec:60},cfgs[d.id]||{},{kind:d.kind}); }
-if(cfgs.booster && cfgs.booster.ver!==2){ Object.assign(cfgs.booster,{ver:2,tpl:null,area:null,frameW:0,frameH:0,threshold:0.7}); }
-}
-function save(){ try{ localStorage.setItem(STORE,JSON.stringify(cfgs)); }catch(e){} }
-const needsRegister=d=>!cfgs[d.id].tpl && !d.presets;
-const needsReregister=d=>{ const c=cfgs[d.id]; return !!(c.tpl && c.frameW && frame.w && (c.frameW!==frame.w||c.frameH!==frame.h)); };
-
-/* ===== 감지 대상 모델 (묶음 1 스펙 3절). 위의 DEFS·cfgs는 Task E1에서 이 모델로 바뀔 때까지 남아 있는 예전 코드 ===== */
+/* ===== 감지 대상 모델 (묶음 1 스펙 3절) + 실행 중 저장소 ===== */
 const TARGET_MAX=12;
 // 내장 3개: 기존 id를 그대로 써서 내 소리 슬롯 키(sol.pre 등)를 이전 없이 이어간다
@@ -123,3 +104,17 @@ function targetSnapshot(targets,states,ctx,now){
   });
 }
+
+/* ----- 실행 중 저장소. 소유: 이 파일. 다른 파일은 store.targets를 읽고, 바꾼 뒤에는 saveTargets()를 부른다 ----- */
+let store={ver:2,seq:0,targets:[],group:defaultGroup()}, storeStatus='fresh';   // initTargets()가 채운다(KINDS는 kinds.js가 뒤에 올라오므로 여기서 만들지 않음)
+const targetById=id=>store.targets.find(t=>t.id===id);
+let saveWarned=false;
+function saveTargets(){
+  if(saveStore(store)||saveWarned) return;
+  saveWarned=true; setNote('설정을 저장하지 못했어요 (이 탭에서만 유지)');
+}
+function initTargets(){
+  const r=loadStore(); store=r.store; storeStatus=r.status;
+  if(r.status==='broken') setNote('설정을 읽지 못해 처음 상태로 시작했어요. 백업 파일이 있으면 불러오세요');
+  else if(r.saveFailed){ saveWarned=true; setNote('설정을 저장하지 못했어요 (이 탭에서만 유지)'); }
+}
 if(typeof module==='object') module.exports={BUILTIN,PRESETS,defaultStore,newTarget,builtinTarget,normalizeTarget,normalizeStore,makeId,migrateV1,loadStore,saveStore,checkName,targetSnapshot};
```

- [ ] **Step 2: `js/detect-run.js` 전체 교체**

`areaOf(t)`/`detectTemplate(t, source)`는 예전 `detect`와 같은 검색이고 대상 형식만 바뀌었다. `tick`은 종류별 `detect`/`step`을 부르고 이벤트를 모아 한 번에 보낸다.

```js
const states={}; const tplCache={};
const stateOf=id=>states[id]||(states[id]=newState());
// 모든 대상의 감지 상태를 새로 시작. armed=true는 스크린샷 테스트(처음부터 켜짐 시각을 믿음)
function resetAllStates(armed){ for(const t of store.targets){ states[t.id]=newState(); if(armed) states[t.id].armed=true; } }

/* ----- 감지 ----- */
function scaleFor(tw,th){ return Math.min(1,Math.max(0.25,14/Math.min(tw,th))); }
function loadTpl(t){
  const s=t.s||1, key=t.url+"@"+s; const ca=tplCache[key]; if(ca) return ca.ready?ca:null;
  const ent={ready:false}; tplCache[key]=ent;
  const img=new Image(); img.onload=()=>{
    const m=t.crop||0, iw=img.width-2*m, ih=img.height-2*m;
    const k=scaleFor(iw*s,ih*s), w=Math.max(4,Math.round(iw*s*k)), h=Math.max(4,Math.round(ih*s*k));
    work.width=w; work.height=h; wctx.fillStyle="#000"; wctx.fillRect(0,0,w,h); wctx.drawImage(img,m,m,iw,ih,0,0,w,h);
    Object.assign(ent,{k,m:m*s,ready:true},prepTemplate(toGray(wctx.getImageData(0,0,w,h).data,w*h),w,h));
  }; img.src=t.url; return null;
}
function areaOf(t){
  if(t.area&&t.tpl) return t.area;
  if(isPresetMode(t)&&frame.w) return PRESETS[t.preset].area(frame);   // 내장 아이콘: 솔 야누스는 오른쪽 위, 부스터는 위쪽 가운데
  return null;
}
// 템플릿 매칭으로 대상을 찾는다. buff·countdown·rune이 공용(KINDS.detect의 기본값). 돌려주는 값은 {score, pos} 또는 null
function detectTemplate(t, source){
  const a=areaOf(t); if(!a) return null;
  if(t.tpl && t.frameW && (t.frameW!==frame.w||t.frameH!==frame.h)) return null;
  // 기본 아이콘은 UI 배율이 달라도 찾도록 여러 크기로 검색. 한 번 찾으면 그 크기부터 먼저 확인
  const P=t.preset&&PRESETS[t.preset];
  const cands=t.tpl?[t.tpl]:P.icons.flatMap(p=>P.scales.map(s=>({...p,s})));
  const st=stateOf(t.id), hit=st.hit&&cands.find(x=>x.url===st.hit.url&&x.s===st.hit.s);
  const order=hit?[hit,...cands.filter(x=>x!==hit)]:cands;
  let best=null;
  for(const c of order){
    const tp=loadTpl(c); if(!tp) continue;
    if(best&&best.score>=t.threshold&&c!==order[0]) break;
    const W=Math.round(a.w*tp.k), H=Math.round(a.h*tp.k);
    work.width=W; work.height=H; wctx.drawImage(source,a.x,a.y,a.w,a.h,0,0,W,H);
    const r=matchTemplate(toGray(wctx.getImageData(0,0,W,H).data,W*H),W,H,tp);
    if(!best||r.score>best.score) best={score:r.score,t:c,pos:{x:a.x+r.x/tp.k-tp.m,y:a.y+r.y/tp.k-tp.m,w:c.w*(c.s||1),h:c.h*(c.s||1)}};
  }
  if(best&&best.score>=t.threshold) st.hit={url:best.t.url,s:best.t.s};
  return best;
}
// “남은시간” 글자 오른쪽의 숫자 영역을 원본 해상도로 잘라 읽기
function readTimer(source, p){
  const x0=Math.round(p.x+p.w*1.05), x1=Math.round(p.x+p.w*2.75), y0=Math.round(p.y), y1=Math.round(p.y+p.h*2.0);
  const W=Math.min(x1,frame.w)-x0, H=Math.min(y1,frame.h)-y0; if(W<10||H<8||x0<0||y0<0) return null;
  work.width=W; work.height=H; wctx.drawImage(source,x0,y0,W,H,0,0,W,H);
  return {rect:{x:x0,y:y0,w:W,h:H}, read:ocrSevenSeg(wctx.getImageData(0,0,W,H).data,W,H)};
}
// 거의 검은 프레임(맵 이동 중 암전, 창 최소화 등)인지. 이때 감지하면 버프가 꺼진 것으로 오판하므로 건너뜀
function isBlank(s){
  const [w,h]=dims(s); if(!w||!h) return true;
  work.width=64; work.height=36; wctx.drawImage(s,0,0,w,h,0,0,64,36);
  const p=wctx.getImageData(0,0,64,36).data;
  for(let i=0;i<p.length;i+=4) if(0.299*p[i]+0.587*p[i+1]+0.114*p[i+2]>=8) return false;
  return true;
}
// 종류의 step이 돌려준 이벤트를 알림 후보로 모은다. events에 선언된 키만 알림이 되고(appear-unknown 같은 내부 이벤트는 버림), effect는 종류가 처리한다
function collectEvents(t,evs,out){
  const k=KINDS[t.kind];
  for(const ev of evs){
    const e=typeof ev==='string'?{key:ev}:ev;
    if(e.effect){ k.applyEffect(t,e); continue; }
    const def=k.events.find(x=>x.key===e.key); if(def) out.push({t,def,info:e.info||{}});
  }
}
function reqFor(t,def,info,rank){
  return {src:'target',id:t.id,event:def.key,text:def.msg(t,info||{}),beep:def.beep,slot:`${t.id}.${def.key}`,mode:'full',flash:'card-'+t.id,
    group:def.group?{cls:def.group,label:t.name,rank:rank==null?(t.p.leadSec||0):rank,order:store.targets.indexOf(t)}:null};
}
function dispatchEvents(list,now){ for(const x of list) Alerts.fire(reqFor(x.t,x.def,x.info)); }
// 카드의 "알림 테스트": 묶지 않고 첫 이벤트를 개별 알림으로 재생
function testAlert(t){ const def=KINDS[t.kind].events[0]; Alerts.fire({...reqFor(t,def,{}),src:'test',group:null}); }
let busy=false;
async function tick(){
  if(busy) return; busy=true;
  try{
    const now=Date.now(), g=await grab(), source=g.frame; frameFresh=g.fresh;
    if(source){ [frame.w,frame.h]=dims(source); }
    const live=!!src&&src.type==='stream', ok=!!source&&!(live&&isBlank(source));
    if(live){
      if(ok){ health.okAt=now; health.badSince=null; if(health.badWarned){ health.badWarned=false; fireSystem('back'); } }
      else { health.badSince=health.badSince||now; if(!health.badWarned && now-health.badSince>=STALL_MS){ health.badWarned=true; fireSystem('stall'); } }
    } else if(!src && health.lostAt && health.reminders<LOST_REMIND_MAX && now-health.remindAt>=LOST_REMIND_MS){
      health.reminders++; health.remindAt=now; fireSystem('lost');
    }
    const evq=[], ctx={src:!!src,frame,fresh:frameFresh};
    for(const t of store.targets){
      const k=KINDS[t.kind]; if(!k) continue;
      const st=stateOf(t.id);
      if(ok && t.enabled && !reg){
        const det=k.detect(t,source,ctx);
        if(det){ st.score=det.score; st.pos=det.pos; collectEvents(t,k.step(t,st,det,source,now,ctx),evq); }
        else if(k.onSkip) collectEvents(t,k.step(t,st,null,source,now,ctx),evq);
      } else if(k.onSkip && t.enabled) collectEvents(t,k.step(t,st,null,null,now,ctx),evq);   // 감지를 건너뛴 틱에도 부르는 종류(묶음 3)
      if(!document.hidden) renderCard(t);
    }
    dispatchEvents(evq,now);
    renderWatch();   // 탭 제목은 숨겨져 있어도 갱신
    if(!document.hidden){ drawPreview(source); if(live&&ok) pulse(); }
  } finally { busy=false; Alerts.flush(Date.now()); }
}
```

- [ ] **Step 3: `js/capture.js` 수정**

`grab()`이 `{frame, fresh}`를 돌려주고, 연결·끝내기·스크린샷 테스트가 `resetAllStates`를 쓴다.

```diff
diff --git a/js/capture.js b/js/capture.js
--- a/js/capture.js
+++ b/js/capture.js
@@ -8,4 +8,5 @@ const frame={w:0,h:0};
 const work=document.createElement('canvas'); const wctx=work.getContext('2d',{willReadFrequently:true});
 let lastBitmap=null;
+let frameFresh=true;     // 마지막 grab()이 새 프레임이었는지. 숨은 탭에서 grabFrame 실패 뒤 video로 대체했으면 false(묶음 3이 화면 변화 판단에서 제외)
 // grabFrame()은 새 프레임이 올 때까지 기다리므로, 화면이 멈추면 감지 루프 전체가 멈추지 않게 시간 제한을 둠
 function grabFrameWithin(cap, ms){
@@ -16,12 +17,14 @@ function grabFrameWithin(cap, ms){
   });
 }
+// {frame, fresh}를 돌려준다. frame이 null이면 프레임이 없는 것(화면 안 들어옴으로 집계)
 async function grab(){
-  if(!src) return null;
-  if(src.type==='image') return src.img;
+  if(!src) return {frame:null,fresh:false};
+  if(src.type==='image') return {frame:src.img,fresh:true};
+  let fresh=true;
   if(src.cap && document.hidden){
-    try{ const b=await grabFrameWithin(src.cap,1500); if(lastBitmap&&lastBitmap.close) lastBitmap.close(); lastBitmap=b; return b; }
-    catch(e){ if(e.message==='timeout') return null; }   // 새 프레임이 없음 → 화면 안 들어옴으로 집계
+    try{ const b=await grabFrameWithin(src.cap,1500); if(lastBitmap&&lastBitmap.close) lastBitmap.close(); lastBitmap=b; return {frame:b,fresh:true}; }
+    catch(e){ if(e.message==='timeout') return {frame:null,fresh:false}; fresh=false; }   // 새 프레임이 없음 → 화면 안 들어옴으로 집계. 다른 오류는 video로 대체(오래된 프레임일 수 있음)
   }
-  return src.video.readyState>=2 ? src.video : null;
+  return {frame:src.video.readyState>=2 ? src.video : null, fresh};
 }
 function dims(s){ return s instanceof HTMLVideoElement ? [s.videoWidth,s.videoHeight] : [s.naturalWidth||s.width, s.naturalHeight||s.height]; }
@@ -30,5 +33,5 @@ function teardown(emptyText){
   src=null; pctx.clearRect(0,0,pv.width,pv.height);   // 멈춘 마지막 화면 대신 빈 화면 위에 안내문을 보여줌
   $('#empty').textContent=emptyText; $('#empty').style.display=''; $('#btnConnect').textContent='게임 화면 연결'; $('#btnConnect').classList.add('primary');
-  DEFS.forEach(renderCard); renderWatch();
+  store.targets.forEach(renderCard); renderWatch();
 }
 function initCapture(){
@@ -50,7 +53,7 @@ $('#btnConnect').onclick=async()=>{
     $('#btnConnect').textContent='다른 창 연결'; $('#btnConnect').classList.remove('primary');   // 연결 뒤에는 주된 행동이 아님
     Object.assign(health,{lostAt:null,badSince:null,badWarned:false,okAt:Date.now()});
-    for(const d of DEFS){ states[d.id]=newState(); }
+    resetAllStates(false);
     ui.connectedOnce=true; saveUi();
-    const need=DEFS.filter(d=>cfgs[d.id].enabled&&needsRegister(d)).map(d=>d.name);
+    const need=store.targets.filter(t=>t.enabled&&KINDS[t.kind]&&!KINDS[t.kind].isRegistered(t)).map(t=>t.name);
     speak('감시 시작할게요'+(need.length?`. ${eunNeun(need.join(', '))} 등록이 필요해요`:''));
     renderWatch();
@@ -65,5 +68,5 @@ $('#btnImage').onclick=()=>$('#fileImage').click();
 $('#fileImage').onchange=e=>{
   const f=e.target.files[0]; if(!f) return; const img=new Image();
-  img.onload=()=>{ if(src&&src.track) src.track.stop(); src={type:'image',img}; health.lostAt=null; health.badWarned=false; $('#empty').style.display='none'; for(const d of DEFS){ states[d.id]=newState(); states[d.id].armed=true; } renderWatch(); };
+  img.onload=()=>{ if(src&&src.track) src.track.stop(); src={type:'image',img}; health.lostAt=null; health.badWarned=false; $('#empty').style.display='none'; resetAllStates(true); renderWatch(); };
   img.src=URL.createObjectURL(f); e.target.value='';
 };
```

- [ ] **Step 4: `js/alerts.js`에서 예전 호출부를 지우고 `drop`/`clear` 자리를 만든다**

```diff
diff --git a/js/alerts.js b/js/alerts.js
--- a/js/alerts.js
+++ b/js/alerts.js
@@ -4,5 +4,4 @@ const BUFF_BEEP={wave:'square',notes:[[1046,.15],[1046,.15],[784,.3]]};   // 딩
 const SOUNDS={
   buff:   BUFF_BEEP,                                                              // 모든 버프 공용(솔 야누스 포함)
-  sol:    BUFF_BEEP,                                                              // 예전 호출부용 별칭(Task E1에서 삭제)
   booster:{wave:'square',  notes:[[1318,.08],[1318,.08],[1318,.08],[988,.28]]},  // 딱딱딱-동
   gone:   {wave:'square',  notes:[[784,.2],[523,.45]]},                          // 내려가는 두 음
@@ -58,4 +57,6 @@ function createAlerts(io){
     fire(req){ deliver(withDefaults(req)); },
     flush(now){},                                    // tick() 끝에서 부른다. 묶기 대기열은 Task G2에서 채운다
+    drop(id){},                                      // 삭제·끈 대상의 대기 중 알림을 뺀다(Task G2)
+    clear(){},                                       // 연결이 끊겼을 때 대기열을 비운다(Task G2)
     listen(fn){ listeners.add(fn); return ()=>listeners.delete(fn); },
   };
@@ -85,15 +86,4 @@ const Alerts=Object.assign(createAlerts(browserIO),{
 });
 
-/* ----- 예전 호출부(Task E1에서 KINDS 기반 호출로 바뀌며 사라짐) ----- */
-const MSG={
-  pre:(d,c)=>`${d.name} ${c.leadSec}초 전`,
-  gone:d=>`${d.name} 꺼졌어요`,
-  appear:()=>'룬이 나왔어요',
-  remind:()=>'룬 아직 있어요',
-  unread:d=>`${d.name} 숫자를 못 읽고 있어요`,
-};
-const soundName=(d,kind)=> kind==='gone' ? 'gone' : kind==='unread' ? 'system' : d.kind==='rune' ? 'rune'
-                         : SOUNDS[d.id] ? d.id : d.kind==='countdown' ? 'booster' : 'sol';
-function fire(d, kind){ Alerts.fire({src:'target',id:d.id,event:kind,text:MSG[kind](d,cfgs[d.id]),beep:soundName(d,kind)}); }
 // 화면을 받는 쪽의 문제(끊김·멈춤)는 게임 알림과 다른 소리로 알림. 회복은 음성만
 function fireSystem(kind){ Alerts.fire({src:'system',id:'sys',event:kind,text:SYS_MSG[kind],beep:'system',slot:'sys.'+kind,mode:kind==='back'?'voice':'full',flash:null}); }
```

- [ ] **Step 5: `js/ui-cards.js` 전체 교체**

카드를 `store.targets`로 만들고 입력 칸은 `KINDS[kind].cardFields`로 만든다. 끄는 순간 상태를 `newState()`로 비운다(스펙 3.3). 이름은 `textContent`로만 넣는다.

```js
/* ----- 카드 UI: 대상 목록(store.targets)에서 만들고, 입력 칸은 KINDS[kind].cardFields로 만든다 ----- */
const setText=(el,txt)=>{ if(el.textContent!==txt) el.textContent=txt; };   // 같은 값이면 DOM을 건드리지 않는다
function fieldHtml(f,id){
  const num=f.type==='number', fid=`${id}-${f.key}`;
  return `<label for="${fid}">${f.label}</label><span><input id="${fid}" type="${num?'number':'text'}" data-f="${f.key}"${num?` min="${f.min}" max="${f.max}"`:''}${f.placeholder?` placeholder="${f.placeholder}"`:''}${f.suffix?` aria-describedby="${fid}-sfx"`:''}>`
    +`${f.suffix?` <span class="sub" id="${fid}-sfx">${f.suffix}</span>`:''}${f.hint?` <span class="sub">${f.hint}</span>`:''}</span>`;
}
function initCards(){ buildCards(); }
function buildCards(){
  const box=$('#cards'); box.innerHTML='';
  for(const t of store.targets) box.appendChild(buildCard(t));
  for(const t of store.targets) renderCard(t);
  $('#subtitle').textContent=`감지 대상 ${store.targets.length}개`;
}
function buildCard(t){
  const k=KINDS[t.kind], el=document.createElement('div'), id='t-'+t.id; el.className='card'; el.id='card-'+t.id;
  if(!k){   // 이 버전이 모르는 종류(미래 버전 데이터)는 지우지 않고 안내만
    el.innerHTML='<div class="top"><h2><span data-s="name"></span></h2></div><div class="sub">이 버전에서 지원하지 않는 종류예요</div>';
    el.querySelector('[data-s=name]').textContent=t.name; return el;
  }
  el.innerHTML=`
    <div class="top"><h2><img class="thumb" alt="" hidden><span data-s="name"></span></h2>
      <label class="sw"><input type="checkbox" data-k="enabled"> 사용</label></div>
    <div class="status off" data-s="status">등록 필요</div>
    <div class="sub" data-s="sub"></div>
    <div class="grid">
      ${k.cardFields(t).map(f=>fieldHtml(f,id)).join('')}
      <label for="${id}-thr">기준값</label><span class="row"><input id="${id}-thr" type="range" min="0.4" max="0.98" step="0.01" data-k="threshold" style="flex:1"> <b data-s="thr"></b></span>
      <span>일치도</span><span class="score" data-s="score">–</span>
    </div>
    <div class="row" style="margin-top:10px">
      <button data-a="register">등록</button><button data-a="test">알림 테스트</button>
      ${k.actions.map(a=>`<button data-act="${a.key}">${a.label}</button>`).join('')}
      ${t.preset?'<button data-a="reset">기본 아이콘으로 되돌리기</button>':''}
    </div>`;
  const q=s=>el.querySelector(s);
  q('[data-s=name]').textContent=t.name;
  q('[data-k=enabled]').checked=t.enabled;
  q('[data-k=enabled]').onchange=e=>{ t.enabled=e.target.checked; if(!t.enabled){ states[t.id]=newState(); Alerts.drop(t.id); } saveTargets(); renderWatch(); renderCard(t); };   // 끄는 순간 상태를 새로 시작
  q('[data-k=threshold]').value=t.threshold;
  q('[data-k=threshold]').oninput=e=>{ t.threshold=+e.target.value; saveTargets(); renderCard(t); };
  for(const f of k.cardFields(t)){
    const inp=q(`[data-f=${f.key}]`); inp.value=f.get(t);
    inp.onchange=()=>{ const r=f.set(t,inp.value)||{}; if(r.msg) setNote(r.msg); inp.value=f.get(t); if(!r.revert) saveTargets(); };
  }
  for(const a of k.actions) q(`[data-act=${a.key}]`).onclick=()=>a.run(t,stateOf(t.id),Date.now());
  if(t.preset) q('[data-a=reset]').onclick=()=>{ t.tpl=null; t.area=null; t.frameW=t.frameH=0; saveTargets(); states[t.id]=newState(); renderCard(t); setNote(`${t.name} 기본 아이콘으로 되돌렸어요`,'info'); };
  q('[data-a=register]').onclick=()=>startRegister(t);
  q('[data-a=test]').onclick=()=>{ unlockAudio(); testAlert(t); };
  return el;
}
// 종류가 학습 같은 효과로 값을 바꿨을 때(applyEffect) 저장하고 입력 칸을 맞춘다
function onTargetChanged(t,key){
  saveTargets();
  const f=KINDS[t.kind].cardFields(t).find(x=>x.key===key), inp=document.querySelector(`#card-${t.id} [data-f=${key}]`);
  if(f&&inp) inp.value=f.get(t);
}
function renderCard(t){
  const el=document.getElementById('card-'+t.id), k=KINDS[t.kind]; if(!el||!k) return;
  const st=stateOf(t.id), q=s=>el.querySelector(s);
  const tu=t.tpl?t.tpl.url:(t.preset?PRESETS[t.preset].icons[0].url:''), th=q('.thumb'); th.hidden=!tu; if(tu&&th.getAttribute('src')!==tu) th.src=tu;
  const rb=q('[data-a=reset]'); if(rb) rb.style.display=t.tpl?'':'none';
  setText(q('[data-s=thr]'),t.threshold.toFixed(2));
  setText(q('[data-s=score]'),src&&(t.tpl||t.preset)?st.score.toFixed(2)+(st.score>=t.threshold?' ✔':''):'–');
  const s=cardStatus(t,st,Date.now(),{src:!!src,frame}), sEl=q('[data-s=status]');
  setText(sEl,s.text); const cls='status '+s.cls; if(sEl.className!==cls) sEl.className=cls; setText(q('[data-s=sub]'),s.sub);
}
```

- [ ] **Step 6: `js/ui-watch.js` 전체 교체**

상태줄은 `targetSnapshot`의 행으로 그린다. `titlePrefix`(묶음 2가 수동 타이머 상태를 탭 제목 앞에 붙임)와 `snapshotNow()`(묶음 5의 PIP가 같은 행을 씀)를 둔다.

```js
/* ----- 감시 상태줄 ----- */
function watchStatus(){
  if(src&&src.type==='stream') return health.badWarned ? {cls:'bad',state:'게임 화면이 안 들어와요',title:'⚠ 화면 안 들어옴'} : {cls:'on',state:'감시 중',title:'● 감시 중'};
  if(src) return {cls:'test',state:'스크린샷 테스트 중 · 실제 감시 아님',title:''};
  if(health.lostAt) return {cls:'bad',state:'연결 끊김 · 알림이 멈췄어요',title:'⚠ 연결 끊김'};
  return {cls:'',state:'연결 안 됨 · 감시하지 않아요',title:''};
}
let titlePrefix='';   // 묶음 2가 수동 타이머 상태를 탭 제목 앞에 붙이는 자리
function baseTitle(){ const t=watchStatus().title; return (titlePrefix?titlePrefix+' · ':'')+(t?t+' · ':'')+'메이플 재획 알리미'; }
let watchKey='', noteTimer;
function setNote(text, kind='warn'){
  const n=$('#watchNote'); n.textContent=text; n.className='note'+(kind==='info'?' info':'');
  clearTimeout(noteTimer); if(text&&kind==='info') noteTimer=setTimeout(()=>{ n.textContent=''; },8000);
}
// 상태줄과 묶음 5의 PIP가 같은 행을 쓴다. 순수 계산은 targets.js의 targetSnapshot
const snapshotNow=()=>targetSnapshot(store.targets,states,{src:!!src,frame},Date.now());
function renderWatch(){
  const w=watchStatus();
  const rows=src?snapshotNow():[];
  const key=w.cls+'|'+w.state+'|'+rows.map(r=>r.id+':'+r.name+':'+r.stripState).join(',')+'|'+(src&&src.type);
  if(key!==watchKey){   // 바뀔 때만 다시 그려서 화면 낭독기가 매 틱 읽지 않게 함
    watchKey=key; $('#watch').className='watch '+w.cls; $('#watchState').textContent=w.state;
    const box=$('#watchTargets'); box.textContent='';
    rows.forEach((r,i)=>{
      if(i){ const sep=document.createElement('span'); sep.className='sep'; sep.setAttribute('aria-hidden','true'); sep.textContent='·'; box.append(sep); }
      // 연결 뒤 다음에 할 일(등록)이 주된 버튼이 되도록 primary로 강조
      if(r.stripState==='reg'||r.stripState==='rereg'){ const b=document.createElement('button'); b.className='primary'; b.textContent=`${r.name} ${r.stripState==='reg'?'등록하기':'다시 등록'}`; b.onclick=()=>startRegister(targetById(r.id)); box.append(b); }
      else { const sp=document.createElement('span'); if(r.stripState!=='ok') sp.className=r.stripState; sp.textContent=r.stripState==='off'?`${r.name} 꺼둠`:r.stripState==='unseen'?`${r.name} 아직 못 찾음`:r.name; box.append(sp); }
    });
    const stop=$('#btnStop'); stop.hidden=!src; stop.textContent=src&&src.type==='image'?'테스트 끝내기':'감시 끝내기';
  }
  if(titleTimer===null){ const bt=baseTitle(); if(document.title!==bt) document.title=bt; }
  const stale=src&&src.type==='stream' ? (Date.now()-health.okAt)/1000 : 0;   // 2초 넘게 확인이 없을 때만 경과 시간 표시
  const beat=stale>2 ? `마지막 확인 ${Math.floor(stale)}초 전` : '';
  if($('#watchBeat').textContent!==beat) $('#watchBeat').textContent=beat;
}
function pulse(){ const dot=$('#watchDot'); dot.classList.remove('beat'); void dot.offsetWidth; dot.classList.add('beat'); }
```

- [ ] **Step 7: `js/register.js` 전체 교체**

등록을 `register.steps`로 일반화한다. 단계를 마치면 `validate`(문자열을 돌려주면 이유를 배너에 보이고 처음부터 다시 드래그)를 거쳐 `save`로 저장한다.

```js
/* ----- 미리보기 & 드래그 등록 ----- */
const pv=$('#preview'), pctx=pv.getContext('2d');
let reg=null; // {t, steps, i, snap, rects:{area?,icon?}, drag, msg}
function drawPreview(source){
  const s = reg ? reg.snap : source; if(!s) return;
  const [w,h]=dims(s); if(!w) return;
  if(pv.width!==w||pv.height!==h){ pv.width=w; pv.height=h; }
  pctx.drawImage(s,0,0);
  const lw=Math.max(2,w/600); pctx.lineWidth=lw; pctx.font=`${Math.round(lw*7)}px sans-serif`;
  const placed=[];
  if(!reg) for(const t of store.targets){ const st=stateOf(t.id), ar=KINDS[t.kind]?areaOf(t):null; if(!ar) continue;
    pctx.setLineDash([lw*3,lw*2]); pctx.strokeStyle='rgba(255,255,255,.55)'; pctx.strokeRect(ar.x,ar.y,ar.w,ar.h);
    pctx.setLineDash([]); pctx.fillStyle='rgba(255,255,255,.8)'; pctx.fillText(t.name,ar.x+2,ar.y+lw*8);
    if(st.pos&&src){ const hit=st.score>=t.threshold;
      pctx.strokeStyle=hit?'#3ccf7d':'rgba(255,107,107,.7)'; pctx.strokeRect(st.pos.x,st.pos.y,st.pos.w,st.pos.h);
      // 기준값을 맞출 때 카드와 캔버스를 오가지 않도록 일치도/기준값을 박스 바로 아래에 표시
      const label=`${t.name} ${st.score.toFixed(2)} / ${t.threshold.toFixed(2)}`, fs=Math.round(lw*9);
      pctx.save(); pctx.font=`600 ${fs}px sans-serif`;
      const bw=pctx.measureText(label).width+lw*4, bh=fs+lw*3;
      let ly=st.pos.y+st.pos.h+lw*2; if(ly+bh>h) ly=Math.max(0,st.pos.y-bh-lw*2);
      const lx=Math.min(Math.max(0,st.pos.x),w-bw);
      while(placed.some(p=>lx<p.x+p.w&&p.x<lx+bw&&ly<p.y+p.h&&p.y<ly+bh)) ly+=bh+lw;   // 다른 대상의 표시와 겹치면 아래로 비킴
      placed.push({x:lx,y:ly,w:bw,h:bh});
      pctx.fillStyle='rgba(0,0,0,.75)'; pctx.fillRect(lx,ly,bw,bh);
      pctx.fillStyle=hit?'#3ccf7d':'#ff8a8a'; pctx.fillText(label,lx+lw*2,ly+fs+lw/2);
      pctx.restore(); }
    if(st.ocrRect&&src){ pctx.strokeStyle='#f0c040'; pctx.strokeRect(st.ocrRect.x,st.ocrRect.y,st.ocrRect.w,st.ocrRect.h); } }
  if(reg){
    pctx.setLineDash([]);
    if(reg.rects.area){ pctx.strokeStyle='#6aa1ff'; pctx.strokeRect(reg.rects.area.x,reg.rects.area.y,reg.rects.area.w,reg.rects.area.h); }
    if(reg.drag){ const r=norm(reg.drag); pctx.strokeStyle='#f08a45'; pctx.strokeRect(r.x,r.y,r.w,r.h); }
  }
}
function norm(g){ return {x:Math.round(Math.min(g.x0,g.x1)),y:Math.round(Math.min(g.y0,g.y1)),w:Math.round(Math.abs(g.x1-g.x0)),h:Math.round(Math.abs(g.y1-g.y0))}; }
async function snapshot(){
  const s=(await grab()).frame; if(!s) return null; const [w,h]=dims(s);
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(s,0,0); return cv;
}
async function startRegister(t){
  if(!src){ setNote(`${t.name} 등록은 게임 화면을 연결하거나 스크린샷을 불러온 뒤에 할 수 있어요`); return; }
  setNote('');
  const snap=await snapshot(); if(!snap) return;
  reg={t,steps:KINDS[t.kind].register.steps,i:0,snap,rects:{},drag:null,msg:''}; updateBanner(); drawPreview(null);
  $('#stage').scrollIntoView({behavior:'smooth',block:'center'});
}
const STEP_TEXT={ area:l=>`${l.area}을 넉넉하게 드래그하세요`, icon:l=>`${l.icon} 하나만 꼭 맞게 드래그하세요` };
function updateBanner(){
  const b=$('#banner'); if(!reg){ b.classList.remove('on'); return; }
  b.classList.add('on');
  $('#bannerText').textContent=(reg.msg?`⚠ ${reg.msg} · `:'')+`${reg.t.name} ${'①②③'[reg.i]} ${STEP_TEXT[reg.steps[reg.i]](labelsOf(reg.t))}`;
}
function cancelRegister(){ reg=null; updateBanner(); }
// 모든 단계를 마치면 종류의 검사(validate)를 거쳐 저장(save). 검사에 걸리면 이유를 배너에 보이고 처음 단계부터 다시 드래그
function finishRegister(){
  const t=reg.t, k=KINDS[t.kind], why=k.register.validate(t,reg.rects,reg.snap);
  if(why){ reg.msg=why; reg.rects={}; reg.i=0; updateBanner(); drawPreview(null); return; }
  k.register.save(t,reg.rects,reg.snap); saveTargets();
  states[t.id]=newState(); states[t.id].armed=!!(src&&src.type==='image');
  reg=null; updateBanner(); renderCard(t); renderWatch(); setNote(`${t.name} 등록했어요`,'info');
}
function toImg(e){ const r=pv.getBoundingClientRect(); return {x:(e.clientX-r.left)*pv.width/r.width, y:(e.clientY-r.top)*pv.height/r.height}; }
function initRegister(){
$('#btnCancel').onclick=cancelRegister;
$('#btnRetake').onclick=async()=>{ if(!reg) return; const s=await snapshot(); if(s){ reg.snap=s; drawPreview(null); } };
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&reg) cancelRegister(); });
pv.addEventListener('pointerdown',e=>{ if(!reg) return; const p=toImg(e); reg.drag={x0:p.x,y0:p.y,x1:p.x,y1:p.y}; pv.setPointerCapture(e.pointerId); });
pv.addEventListener('pointermove',e=>{ if(!reg||!reg.drag) return; const p=toImg(e); reg.drag.x1=p.x; reg.drag.y1=p.y; drawPreview(null); });
pv.addEventListener('pointerup',()=>{
  if(!reg||!reg.drag) return; const r=norm(reg.drag); reg.drag=null;
  if(r.w<6||r.h<6){ drawPreview(null); return; }
  reg.rects[reg.steps[reg.i]]=r; reg.msg=''; reg.i++;
  if(reg.i<reg.steps.length){ updateBanner(); drawPreview(null); return; }
  finishRegister();
});
}
```

- [ ] **Step 8: `js/sounds.js` 수정**

`previewSlot`이 대상 목록에서 이벤트를 찾고, `initSounds()`를 둔다. (슬롯 목록 자체는 아직 고정 배열이고 Task 12에서 계산으로 바뀐다.)

```diff
diff --git a/js/sounds.js b/js/sounds.js
--- a/js/sounds.js
+++ b/js/sounds.js
@@ -33,7 +33,8 @@ function soundNote(text, warn){ const n=$('#soundNote'); n.textContent=text; n.c
 function previewSlot(s){
   unlockAudio(); if(playCustom(s.key)) return;
-  const [id,kind]=s.key.split('.');
-  if(id==='sys') playDefault(SYS_MSG[kind],'system');
-  else { const d=defOf(id); playDefault(MSG[kind](d,cfgs[d.id]), soundName(d,kind)); }
+  const [id,ev]=s.key.split('.');
+  if(id==='sys'){ playDefault(SYS_MSG[ev],'system'); return; }
+  const t=targetById(id), def=t&&KINDS[t.kind]&&KINDS[t.kind].events.find(e=>e.key===ev);
+  if(def) playDefault(def.msg(t,{}),def.beep);   // 대상을 못 찾으면 소리 미리듣기만
 }
 async function pickSound(s, file){
@@ -81,4 +82,5 @@ function renderSounds(){
     const rb=s.row.querySelector('[data-a=reset]'); rb.style.visibility=c?'':'hidden'; rb.disabled=!c; }   // 자리는 남겨 버튼 줄을 맞춤
 }
+function initSounds(){ buildSounds(); loadSounds(); }
 async function loadSounds(){
   try{ const st=await soundStore('readonly'); const keys=idb(st.getAllKeys()), vals=idb(st.getAll());
```

- [ ] **Step 9: `js/main.js` 전체 교체와 `index.html` 수정**

`index.html`은 헤더 부제에 `id="subtitle"`을, 상태줄에 묶음 2용 자리 `#watchManual`(aria-live 밖)을 더한다.

```js
/* 부팅: 이 파일만 최상위에서 코드를 실행한다. 다른 파일은 정의와 init*()만 둔다 */
// 필수 전역이 하나라도 없으면(파일 누락) 빈 화면 대신 어느 파일이 빠졌는지 보여준다
const REQUIRED={ 'js/util.js':'parseDur','js/match.js':'matchTemplate','js/detect-core.js':'stepDetector','js/preset-data.js':'PRESET_ICONS','js/targets.js':'loadStore',
  'js/kinds.js':'KINDS','js/alerts.js':'Alerts','js/sounds.js':'loadSounds','js/capture.js':'grab','js/detect-run.js':'tick','js/ui-watch.js':'renderWatch',
  'js/ui-cards.js':'buildCards','js/register.js':'startRegister' };
function missingFiles(){ return Object.keys(REQUIRED).filter(f=>{ try{ return typeof eval(REQUIRED[f])==='undefined'; }catch(e){ return true; } }); }
function onWorkerTick(){
  if(typeof manualTick==='function') manualTick(Date.now());   // 묶음 2: 수동 타이머는 감지 tick의 busy·grabFrame 대기에 묶이지 않게 먼저 동기로
  tick();
  Alerts.flush(Date.now());                                    // busy로 tick이 건너뛰어진 메시지에서도 묶기 대기열을 비운다
}
(function boot(){
  const miss=missingFiles();
  if(miss.length){ const e=$('#empty'); if(e) e.textContent='파일이 빠졌어요: '+miss.join(', '); return; }
  initTargets(); initCapture(); initRegister(); initCards(); initSounds();
  for(const f of ['manualInit','audioInit','pipInit','backupInit']) if(typeof globalThis[f]==='function') globalThis[f]();   // 묶음 2·5가 파일을 더하면 여기서 부른다
  renderWatch();
  $('#helpDetails').open = !(ui.connectedOnce || store.targets.some(t=>t.tpl));   // 처음에만 펼침
  try{
    const wk=new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),500)'],{type:'text/javascript'})));
    wk.onmessage=onWorkerTick;
  }catch(e){ setInterval(onWorkerTick,500); }
})();
```

```diff
diff --git a/index.html b/index.html
--- a/index.html
+++ b/index.html
@@ -9,5 +9,5 @@
 <body>
 <header>
-  <h1>메이플 재획 알리미 <span class="sub">솔 야누스 · 부스터 · 룬</span></h1>
+  <h1>메이플 재획 알리미 <span class="sub" id="subtitle">감지 대상</span></h1>
   <div class="row">
     <button id="btnConnect" class="primary">게임 화면 연결</button>
@@ -25,4 +25,5 @@
       <span id="watchNote" class="note"></span>
     </div>
+    <span id="watchManual" class="sub"></span>
     <div class="end">
       <span id="watchBeat" class="sub"></span>
```

- [ ] **Step 10: 시험 파일을 맞춘다**

`prelude.mjs`에 미리보기 위에서 영역·아이콘을 드래그하는 `drag`를 더하고, 회귀 시나리오의 입력 칸 선택자를 새 카드(`[data-f=durationSec]`)에 맞추고, 대상 모델 시나리오를 만든다(v1 이전, 룬 직접 등록, 알림 테스트 버튼, 해상도 변경).

```diff
diff --git a/tests/browser/prelude.mjs b/tests/browser/prelude.mjs
--- a/tests/browser/prelude.mjs
+++ b/tests/browser/prelude.mjs
@@ -26,2 +26,9 @@ export function check(name, cond, detail) {
 }
 export function done() { console.log(`RESULT ${pass} passed, ${fail} failed`); }
+
+// 미리보기 캔버스 위에서 이미지 좌표 (x0,y0)→(x1,y1)로 드래그한다(영역·아이콘 등록용)
+export async function drag(page, x0, y0, x1, y1) {
+  const r = await page.evaluate(() => { const c = document.querySelector("#preview"), b = c.getBoundingClientRect(); return { l: b.left, t: b.top, sx: b.width / c.width, sy: b.height / c.height }; });
+  const P = (x, y) => [r.l + x * r.sx, r.t + y * r.sy];
+  await page.mouse.move(...P(x0, y0)); await page.mouse.down(); await page.mouse.move(...P((x0 + x1) / 2, (y0 + y1) / 2)); await page.mouse.move(...P(x1, y1)); await page.mouse.up();
+}
```

```diff
diff --git a/tests/browser/regression.mjs b/tests/browser/regression.mjs
--- a/tests/browser/regression.mjs
+++ b/tests/browser/regression.mjs
@@ -17,5 +17,5 @@ await wait(2500);
 check("솔 야누스 켜짐 · 학습 중", (await txt("#card-sol [data-s=status]")) === "켜짐 · 학습 중");
 check("일치도 표시", (await txt("#card-sol [data-s=score]")).startsWith("1.00 ✔"));
-await ev(() => { const i = document.querySelector("#t-sol-dur"); i.value = "1:00"; i.dispatchEvent(new Event("change")); __fake.skew(51000); });
+await ev(() => { const i = document.querySelector("#card-sol [data-f=durationSec]"); i.value = "1:00"; i.dispatchEvent(new Event("change")); __fake.skew(51000); });
 await wait(3500);
 const pre = await ev(() => ({ spoken: __fake.spoken.slice(), beeps: __fake.beeps }));
```

`tests/browser/model.mjs`:

```js
// 대상 모델·v1 이전·직접 등록·알림 테스트 버튼 검사 (Task E1 이후)
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done, drag } = await import(ROOT + "prelude.mjs");

// 1) v1 → v2 이전: 지속시간·룬 반복·부스터 재설정, v1은 그대로
const V1 = JSON.stringify({
  sol: { enabled: true, threshold: 0.8, durationSec: 1800, leadSec: 15 },
  booster: { enabled: true, threshold: 0.55, area: { x: 1, y: 1, w: 50, h: 20 }, tpl: { url: "data:x", w: 5, h: 5 }, frameW: 1280, frameH: 720, leadSec: 12 },
  rune: { enabled: true, threshold: 0.85, repeatSec: 30, leadSec: 77 },
});
let { page, ev, wait } = await open(taskSpace, { seed: { "maple-web-timer-v1": V1 } });
const m = await ev(() => ({
  cards: [...document.querySelectorAll(".card")].map(c => c.id),
  sub: document.querySelector("#subtitle").textContent,
  dur: document.querySelector("#card-sol [data-f=durationSec]").value, lead: document.querySelector("#card-sol [data-f=leadSec]").value,
  rep: document.querySelector("#card-rune [data-f=repeatSec]").value, thr: document.querySelector("#card-sol [data-k=threshold]").value,
  v2: JSON.parse(localStorage.getItem("maple-web-timer-v2")), v1same: localStorage.getItem("maple-web-timer-v1") === JSON.stringify(JSON.parse(localStorage.getItem("maple-web-timer-v1"))),
  boosterThr: store.targets[1].threshold, boosterTpl: store.targets[1].tpl,
}));
check("이전: 카드 3장", JSON.stringify(m.cards) === JSON.stringify(["card-sol", "card-booster", "card-rune"]), m.cards);
check("이전: 부제", m.sub === "감지 대상 3개", m.sub);
check("이전: 지속시간 30:00 · 미리 알림 15 · 룬 반복 30 · 기준값 0.8", m.dur === "30:00" && m.lead === "15" && m.rep === "30" && m.thr === "0.8", m);
check("이전: v2 저장, 룬 leadSec 버림", m.v2 && m.v2.ver === 2 && m.v2.targets.length === 3 && !("leadSec" in m.v2.targets[2].p), m.v2);
check("이전: 부스터는 재설정(등록 비움, 0.7)", m.boosterThr === 0.7 && m.boosterTpl === null, m);

// 2) 룬 직접 등록(영역 → 아이콘) → 룬이 나왔어요
({ page, ev, wait } = await open(taskSpace, { connect: true }));
await ev(() => { __fake.pattern("rune", 300, 600, 5, 16); __fake.show("rune", false); });
await page.click("#card-rune [data-a=register]"); await wait(800);
check("등록: 배너 안내(영역)", (await ev(() => document.querySelector("#bannerText").textContent)) === "룬 ① 미니맵 영역을 넉넉하게 드래그하세요");
await drag(page, 100, 500, 500, 700);
check("등록: 배너 안내(아이콘)", (await ev(() => document.querySelector("#bannerText").textContent)) === "룬 ② 룬 아이콘 하나만 꼭 맞게 드래그하세요");
await ev(() => __fake.show("rune", true)); await wait(400);   // 등록용 화면을 다시 찍기 전에 아이콘이 보이도록
await page.click("#btnRetake"); await wait(600);
await drag(page, 298, 598, 318, 618);
const reg = await ev(() => ({ t: store.targets[2], banner: document.querySelector("#banner").classList.contains("on"), v2: JSON.parse(localStorage.getItem("maple-web-timer-v2")).targets[2] }));
check("등록: 배너 닫힘, tpl·area·frame 저장", !reg.banner && reg.t.tpl && reg.t.area && reg.t.frameW === 1280 && reg.v2.tpl && reg.v2.frameH === 720, reg);
await ev(() => __fake.reset()); await wait(3500);
const after = await ev(() => ({ st: document.querySelector("#card-rune [data-s=status]").textContent, spoken: __fake.spoken.slice() }));
check("등록 뒤 룬 감지: 룬 있음 + 나왔어요 음성", after.st === "룬 있음!" && after.spoken.includes("룬이 나왔어요"), after);

// 3) 알림 테스트 버튼은 개별 알림
await ev(() => __fake.reset());
await page.click("#card-sol [data-a=test]"); await wait(2500);
check("알림 테스트: 솔 야누스 10초 전", JSON.stringify(await ev(() => __fake.spoken)) === JSON.stringify(["솔 야누스 10초 전"]));

// 4) 해상도 변경 → 다시 등록 필요
await ev(() => __fake.resize(1920, 1080)); await wait(1500);
const rr = await ev(() => ({ st: document.querySelector("#card-rune [data-s=status]").textContent, strip: document.querySelector("#watchTargets").textContent }));
check("해상도 변경: 다시 등록 필요", rr.st === "다시 등록 필요" && rr.strip.includes("룬 다시 등록"), rr);
done();
```

- [ ] **Step 11: 문법과 단위 테스트**

```bash
for f in js/*.js; do node --check $f || echo "문법 오류: $f"; done
grep -n "DEFS\|cfgs\|defOf\|loadLegacy\|initStates\|needsRegister" js/*.js | wc -l
node --test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: 문법 오류 없음, `grep` 결과 `0`(옛 전역이 어디에도 남지 않음), `# pass 60` `# fail 0`.

- [ ] **Step 12: 브라우저 검증**

```bash
runb tests/browser/regression.mjs
runb tests/browser/model.mjs
```

Expected: 회귀 `RESULT 14 passed, 0 failed`(기능이 바뀌지 않았다는 증거). 모델 시나리오 `RESULT 11 passed, 0 failed` — 이전(카드 3장·부제 `감지 대상 3개`·지속시간 `30:00`·미리 알림 15·룬 반복 30·기준값 0.8, v2 저장에서 룬 `leadSec` 버림, 부스터 재설정), 룬 직접 등록(배너 문구 `룬 ① 미니맵 영역을 넉넉하게 드래그하세요` → `룬 ② 룬 아이콘 하나만 꼭 맞게 드래그하세요`, `tpl`·`area`·프레임 크기 저장, `룬이 나왔어요`와 올라가는 세 음), 알림 테스트 버튼 `솔 야누스 10초 전`, 해상도 변경 뒤 `다시 등록 필요`와 상태줄 `룬 다시 등록`.

- [ ] **Step 13: 커밋**

```bash
git add index.html js tests/browser
git commit -F - <<'EOF'
런타임을 대상 목록(store.targets)과 KINDS로 전환, v1→v2 자동 이전

DEFS/cfgs를 없애고 detect→step→이벤트 모으기→Alerts.fire 흐름으로 바꿨다.
events에 선언된 키만 알림이 되고 effect는 종류가 처리한다. grab()은 {frame,fresh},
등록은 steps/validate/save, 상태줄은 targetSnapshot, 부팅은 init 함수 순서와
필수 전역 검사(파일이 빠졌어요)로 일반화했다. 끄면 그 대상의 상태를 비운다.
회귀 시나리오 14개와 모델 시나리오 11개 통과.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 12: 동적 `slotsOf` · 고아 소리 정리

소리 설정 화면의 행을 고정 배열 대신 대상 목록에서 계산한다. 대상이 바뀌면 화면을 다시 만든다(Task 13·14가 부른다). 지워진 대상의 내 소리가 남는 경우는 다음 로드의 고아 정리가 지운다(저장소를 정상으로 읽었을 때만).

**Files:**
- Modify: `js/targets.js`, `js/sounds.js`, `tests/targets.test.js`, `tests/browser/prelude.mjs`
- Create: `tests/browser/sounds.mjs`

- [ ] **Step 1: 실패하는 테스트를 더한다**

```diff
diff --git a/tests/targets.test.js b/tests/targets.test.js
--- a/tests/targets.test.js
+++ b/tests/targets.test.js
@@ -133,2 +133,33 @@ test('targetSnapshot: 상태줄·PIP가 같이 쓰는 행', () => {
   assert.deepEqual([rows[3].stripState, rows[3].statusText], ['off', '이 버전에서 지원하지 않는 종류예요']);
 });
+
+// ---- 내 소리 슬롯 (묶음 1 스펙 4.4·4.5) ----
+const { slotsOf, orphanSlots } = L;
+const keysOf = r => plain(r).map(s => s.key);
+
+test('slotsOf: 대상 순서·이름을 따르고, 묶음·수동 타이머·시스템 슬롯이 뒤에 붙는다', () => {
+  const targets = plain(defaultStore()).targets;
+  targets.push({ id: 'u1', kind: 'buff', name: '유니온의 힘', p: {} });
+  const r = plain(slotsOf(targets));
+  assert.deepEqual(r.map(s => s.key), ['sol.pre', 'sol.gone', 'booster.pre', 'booster.gone', 'booster.unread', 'rune.appear', 'rune.remind', 'u1.pre', 'u1.gone',
+    'grp.pre', 'grp.gone', 'manual.pre', 'manual.end', 'manual.next1', 'manual.next2', 'sys.lost', 'sys.stall']);
+  assert.deepEqual([r[7].group, r[7].label, r[9].group, r[9].label, r[15].group], ['유니온의 힘', '미리 알림', '묶음 알림', '미리 알림', '연결 문제']);
+  targets[3].name = '새 이름';
+  assert.equal(plain(slotsOf(targets))[7].group, '새 이름');
+});
+
+test('slotsOf: 수동 타이머 파일이 없는 동안에는 manual 슬롯을 숨길 수 있다, 모르는 kind는 건너뛴다', () => {
+  const ks = keysOf(slotsOf([{ id: 'u1', kind: 'future', name: 'x', p: {} }], { manual: false }));
+  assert.deepEqual(ks, ['grp.pre', 'grp.gone', 'sys.lost', 'sys.stall']);
+});
+
+test('orphanSlots: 예약 접두어와 현재 대상은 보존, 대상 없는 id는 삭제', () => {
+  const targets = [{ id: 'sol' }, { id: 'u2' }];
+  const keys = ['sol.pre', 'u2.gone', 'u9.pre', 'u10.appear', 'sys.lost', 'grp.pre', 'manual.end', 'm3.pre', 'booster.gone', 'zzz.pre'];
+  assert.deepEqual(plain(orphanSlots(keys, targets, 'ok')), ['u9.pre', 'u10.appear', 'booster.gone', 'zzz.pre']);
+  assert.deepEqual(plain(orphanSlots(keys, targets, 'migrated')), ['u9.pre', 'u10.appear', 'booster.gone', 'zzz.pre']);
+});
+
+test('orphanSlots: 저장소가 비었거나 깨져서 기본 목록으로 시작한 경우(fresh·broken)에는 아무것도 지우지 않는다', () => {
+  for (const status of ['fresh', 'broken']) assert.deepEqual(plain(orphanSlots(['u9.pre'], [{ id: 'sol' }], status)), []);
+});
```

- [ ] **Step 2: 실패를 본다**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 60` `# fail 4`(`slotsOf`/`orphanSlots`가 없음).

- [ ] **Step 3: 구현**

`slotsOf`는 대상 순서, `grp.*` 2개, `manual.*` 4개(묶음 2 파일이 있을 때만 화면에 보이게 `opts.manual`로 끌 수 있음), `sys.*` 2개 순서다. `orphanSlots`는 예약 접두어(`sys`·`grp`·`manual`·`m<숫자>`)와 현재 대상을 뺀 키를 돌려주고, 상태가 `ok`·`migrated`가 아니면 빈 배열이다.

```diff
diff --git a/js/targets.js b/js/targets.js
--- a/js/targets.js
+++ b/js/targets.js
@@ -105,4 +105,23 @@ function targetSnapshot(targets,states,ctx,now){
 }
 
+/* ----- 내 소리 슬롯 키 = 대상id.이벤트 (묶음 1 스펙 4.4·4.5) ----- */
+const MANUAL_SLOTS=[['manual.pre','미리 알림'],['manual.end','끝'],['manual.next1','구간 전환 1'],['manual.next2','구간 전환 2']];
+// 소리 설정 화면의 행 목록. 대상이 추가·삭제·개명될 때마다 다시 계산한다. opts.manual=false면 수동 타이머(묶음 2) 슬롯을 뺀다
+function slotsOf(targets,opts){
+  const out=[], manual=!(opts&&opts.manual===false);
+  for(const t of targets){ const k=KINDS[t.kind]; if(!k) continue; for(const e of k.events) out.push({key:`${t.id}.${e.key}`,group:t.name,label:e.label}); }
+  out.push({key:'grp.pre',group:'묶음 알림',label:'미리 알림'},{key:'grp.gone',group:'묶음 알림',label:'꺼짐'});
+  if(manual) for(const [key,label] of MANUAL_SLOTS) out.push({key,group:'수동 타이머',label});
+  out.push({key:'sys.lost',group:'연결 문제',label:'연결 끊김'},{key:'sys.stall',group:'연결 문제',label:'화면 안 들어옴'});
+  return out;
+}
+const RESERVED_OWNER=/^(sys|grp|manual|m\d+)$/;
+// 저장된 소리 키 중 지울 것: 소유자가 예약 접두어도 현재 대상도 아닌 것. 저장소를 정상으로 읽었을 때(ok·migrated)만 지운다
+function orphanSlots(keys,targets,status){
+  if(status!=='ok'&&status!=='migrated') return [];
+  const ids=new Set(targets.map(t=>t.id));
+  return keys.filter(k=>{ const owner=String(k).split('.')[0]; return !RESERVED_OWNER.test(owner)&&!ids.has(owner); });
+}
+
 /* ----- 실행 중 저장소. 소유: 이 파일. 다른 파일은 store.targets를 읽고, 바꾼 뒤에는 saveTargets()를 부른다 ----- */
 let store={ver:2,seq:0,targets:[],group:defaultGroup()}, storeStatus='fresh';   // initTargets()가 채운다(KINDS는 kinds.js가 뒤에 올라오므로 여기서 만들지 않음)
@@ -118,3 +137,3 @@ function initTargets(){
   else if(r.saveFailed){ saveWarned=true; setNote('설정을 저장하지 못했어요 (이 탭에서만 유지)'); }
 }
-if(typeof module==='object') module.exports={BUILTIN,PRESETS,defaultStore,newTarget,builtinTarget,normalizeTarget,normalizeStore,makeId,migrateV1,loadStore,saveStore,checkName,targetSnapshot};
+if(typeof module==='object') module.exports={slotsOf,orphanSlots,BUILTIN,PRESETS,defaultStore,newTarget,builtinTarget,normalizeTarget,normalizeStore,makeId,migrateV1,loadStore,saveStore,checkName,targetSnapshot};
```

```diff
diff --git a/js/sounds.js b/js/sounds.js
--- a/js/sounds.js
+++ b/js/sounds.js
@@ -1,14 +1,7 @@
 /* ----- 알림 소리 바꾸기 (내 WAV 등) ----- */
-const SLOTS=[
-  {key:'sol.pre',        group:'솔 야누스', label:'미리 알림'},
-  {key:'sol.gone',       group:'솔 야누스', label:'꺼짐'},
-  {key:'booster.pre',    group:'부스터',    label:'미리 알림'},
-  {key:'booster.gone',   group:'부스터',    label:'꺼짐'},
-  {key:'booster.unread', group:'부스터',    label:'숫자 못 읽음'},
-  {key:'rune.appear',    group:'룬',        label:'나왔을 때'},
-  {key:'rune.remind',    group:'룬',        label:'아직 있을 때'},
-  {key:'sys.lost',       group:'연결 문제', label:'연결 끊김'},
-  {key:'sys.stall',      group:'연결 문제', label:'화면 안 들어옴'},
-];
+let SLOTS=[];   // 소리 설정 화면의 행. 대상 목록에서 계산한다(targets.js의 slotsOf)
+function refreshSlots(){ SLOTS=slotsOf(store.targets,{manual:typeof manualInit==='function'}); }
+// 대상이 추가·삭제·개명·순서 변경될 때 소리 설정 화면을 다시 만든다. 불러 둔 내 소리(customSounds)는 그대로 쓴다
+function rebuildSounds(){ refreshSlots(); buildSounds(); }
 const SOUND_MAX_SEC=10, SOUND_MAX_BYTES=5*1024*1024;   // 긴 소리는 다음 알림을 밀어내므로 제한
 const customSounds=new Map();   // slot → {name, data:ArrayBuffer, dur, buf:AudioBuffer|null}
@@ -82,8 +75,14 @@ function renderSounds(){
     const rb=s.row.querySelector('[data-a=reset]'); rb.style.visibility=c?'':'hidden'; rb.disabled=!c; }   // 자리는 남겨 버튼 줄을 맞춤
 }
-function initSounds(){ buildSounds(); loadSounds(); }
+function initSounds(){ refreshSlots(); buildSounds(); loadSounds(); }
+async function deleteSoundKeys(keys){
+  try{ const st=await soundStore('readwrite'); await Promise.all(keys.map(k=>idb(st.delete(k)))); }catch(e){}
+}
 async function loadSounds(){
-  try{ const st=await soundStore('readonly'); const keys=idb(st.getAllKeys()), vals=idb(st.getAll());
-    const [ks,vs]=await Promise.all([keys,vals]); ks.forEach((k,i)=>{ if(SLOTS.some(s=>s.key===k)) customSounds.set(k,{...vs[i],buf:null}); }); renderSounds(); predecodeSounds(); }
+  try{ const st=await soundStore('readonly'); const [ks,vs]=await Promise.all([idb(st.getAllKeys()),idb(st.getAll())]);
+    const orphans=new Set(orphanSlots(ks,store.targets,storeStatus));   // 지워진 대상의 소리(탭이 닫혀 10초 삭제를 못 한 것)를 정리
+    ks.forEach((k,i)=>{ if(!orphans.has(k)) customSounds.set(k,{...vs[i],buf:null}); });
+    if(orphans.size) deleteSoundKeys([...orphans]);
+    renderSounds(); predecodeSounds(); }
   catch(e){ soundNote('이 브라우저에서는 내 소리를 저장할 수 없어요. 기본 소리로 알려요',true); }
 }
```

- [ ] **Step 4: 시험 준비물을 더한다**

`open`이 `sounds: ["sol.pre", …]` 옵션으로 IndexedDB에 0.3초 WAV를 넣게 하고, 소리 시나리오를 만든다.

```diff
diff --git a/tests/browser/prelude.mjs b/tests/browser/prelude.mjs
--- a/tests/browser/prelude.mjs
+++ b/tests/browser/prelude.mjs
@@ -1,5 +1,5 @@
 // 브라우저 검사 공통 준비. ego-browser 스크립트에서:
 //   const { open, check, done } = await import("file:///ABS/tests/browser/prelude.mjs");
-//   const { page, ev, wait } = await open(taskSpace, { seed: { "maple-web-timer-v1": {...} }, connect: true });
+//   const { page, ev, wait } = await open(taskSpace, { seed: { "maple-web-timer-v1": {...} }, sounds: ["sol.pre"], connect: true });
 import fs from "node:fs/promises";
 const ROOT = new URL("../../", import.meta.url);
@@ -9,9 +9,17 @@ export async function open(taskSpace, opt = {}) {
   const page = task.page("p1");
   await page.goto(opt.url || BASE);
-  await page.evaluate(async seed => {                          // 이 origin의 저장소를 비우고 시험 데이터를 넣는다
+  await page.evaluate(async ({ seed, sounds }) => {              // 이 origin의 저장소를 비우고 시험 데이터를 넣는다
     localStorage.clear();
     await new Promise(r => { const q = indexedDB.deleteDatabase("maple-web-timer"); q.onsuccess = q.onerror = q.onblocked = r; });
-    for (const [k, v] of Object.entries(seed || {})) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
-  }, opt.seed || {});
+    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
+    if (sounds.length) await new Promise((res, rej) => {         // 내 소리 슬롯 키마다 0.3초 WAV를 넣는다
+      const mk = () => { const n = 2400, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
+        w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
+        for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 8) * 8000, true); return b; };
+      const r = indexedDB.open("maple-web-timer", 1); r.onupgradeneeded = () => r.result.createObjectStore("sounds");
+      r.onsuccess = () => { const tx = r.result.transaction("sounds", "readwrite"), st = tx.objectStore("sounds"); for (const k of sounds) st.put({ name: k + ".wav", data: mk(), dur: 0.3 }, k); tx.oncomplete = () => { r.result.close(); res(); }; };
+      r.onerror = () => rej(r.error);
+    });
+  }, { seed: opt.seed || {}, sounds: opt.sounds || [] });
   await page.goto(opt.url || BASE);
   await page.evaluate(await fs.readFile(new URL("tests/browser/fake-screen.js", ROOT), "utf8"));
```

`tests/browser/sounds.mjs`:

```js
// 소리 슬롯: 동적 목록, 고아 정리, 예약 접두어 보존 (Task E2 이후)
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const V2 = { ver: 2, seq: 9, group: { on: false, windowSec: 10 }, targets: [
  { id: "sol", kind: "buff", name: "솔 야누스", preset: "sol", enabled: true, threshold: 0.75, area: null, tpl: null, frameW: 0, frameH: 0, p: { durationSec: null, leadSec: 10 } },
  { id: "u3", kind: "buff", name: "유니온의 힘", preset: null, enabled: true, threshold: 0.75, area: null, tpl: null, frameW: 0, frameH: 0, p: { durationSec: null, leadSec: 10 } } ] };
const keys = () => new Promise(res => { const r = indexedDB.open("maple-web-timer", 1); r.onsuccess = () => { const q = r.result.transaction("sounds").objectStore("sounds").getAllKeys(); q.onsuccess = () => res(q.result.sort()); }; });
const { ev, wait } = await open(taskSpace, { seed: { "maple-web-timer-v2": V2 }, sounds: ["sol.pre", "u3.gone", "u9.pre", "booster.gone", "sys.lost", "grp.pre", "manual.end", "m2.pre"] });
await wait(1500);
const rows = await ev(() => [...document.querySelectorAll("#soundRows .snd-group > b")].map(b => b.textContent));
check("소리 설정: 대상 이름 순서대로 그룹", JSON.stringify(rows) === JSON.stringify(["솔 야누스", "유니온의 힘", "묶음 알림", "연결 문제"]), rows);
const kept = await ev(keys);
check("고아 정리: 없는 대상(u9, booster)만 삭제, 예약 접두어·현재 대상은 보존",
  JSON.stringify(kept) === JSON.stringify(["grp.pre", "m2.pre", "manual.end", "sol.pre", "sys.lost", "u3.gone"]), kept);
const shown = await ev(() => [...document.querySelectorAll(".snd-file.custom")].length);
check("소리 설정: 보이는 슬롯의 내 소리 3개(sol.pre, u3.gone, sys.lost) 표시", shown >= 3, shown);
// 저장소가 깨진 채 시작하면 소리를 지우지 않는다
const r2 = await open(taskSpace, { seed: { "maple-web-timer-v2": "{oops" }, sounds: ["u9.pre"] });
await r2.wait(1500);
const k2 = await r2.ev(keys);
check("깨진 저장소로 시작: 고아 정리 안 함", JSON.stringify(k2) === JSON.stringify(["u9.pre"]), k2);
check("깨진 저장소 알림줄", (await r2.ev(() => document.querySelector("#watchNote").textContent)).startsWith("설정을 읽지 못해 처음 상태로 시작했어요"));
done();
```

- [ ] **Step 5: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
runb tests/browser/sounds.mjs
runb tests/browser/regression.mjs
```

Expected: `# pass 64` `# fail 0`. 소리 시나리오 `RESULT 5 passed, 0 failed`: 대상 이름 순서의 그룹(`솔 야누스`, `유니온의 힘`, `묶음 알림`, `연결 문제`), 없는 대상(`u9`·`booster`)의 소리만 삭제되고 `sys.lost`·`grp.pre`·`manual.end`·`m2.pre`·현재 대상의 소리는 남음, 깨진 `v2`로 시작하면 아무것도 지우지 않고 알림줄에 `설정을 읽지 못해 처음 상태로 시작했어요…`. 회귀 14 통과.

- [ ] **Step 6: 커밋**

```bash
git add js/targets.js js/sounds.js tests/targets.test.js tests/browser/prelude.mjs tests/browser/sounds.mjs
git commit -F - <<'EOF'
소리 설정 슬롯을 대상 목록에서 계산하고 고아 소리를 정리

slotsOf(대상 순서 + grp.* + manual.* + sys.*), orphanSlots(예약 접두어와 현재 대상 보존,
저장소가 비었거나 깨진 경우는 지우지 않음). 로드 때 고아 키를 IndexedDB에서 지운다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Phase F. 대상 목록 UI

### Task 13: 대상 추가 메뉴 · 기본 제공 복원 · 첫 등록 취소 시 삭제

`+ 대상 추가` 메뉴(스펙 5.1): "기본 제공"(목록에 없는 내장 대상만)과 "버프 직접 등록"(이름만 채움: 유니온의 힘·유니온의 부·재물 획득의 비약·경험치 쿠폰·이름 직접 입력). 지속시간·기준값·아이콘은 채우지 않는다(게임 안 값을 확인하지 못했고 틀린 값은 틀린 시각에 알림을 울린다). 연결돼 있으면 곧바로 등록 단계로 들어가고, 방금 만든 대상의 첫 등록을 `Esc`/`취소`하면 대상이 자동으로 지워진다. 12개가 차면 추가 버튼이 꺼진다.

**Files:**
- Modify: `js/targets.js`, `js/ui-cards.js`, `js/register.js`, `index.html`, `css/app.css`, `tests/targets.test.js`, `tests/browser/prelude.mjs`
- Create: `tests/browser/targets-ui.mjs`

- [ ] **Step 1: 순수 함수의 실패하는 테스트를 더한다**

```diff
diff --git a/tests/targets.test.js b/tests/targets.test.js
--- a/tests/targets.test.js
+++ b/tests/targets.test.js
@@ -164,2 +164,34 @@ test('orphanSlots: 저장소가 비었거나 깨져서 기본 목록으로 시
   for (const status of ['fresh', 'broken']) assert.deepEqual(plain(orphanSlots(['u9.pre'], [{ id: 'sol' }], status)), []);
 });
+
+// ---- 대상 추가 (묶음 1 스펙 3.3·5.1) ----
+const { missingBuiltins, addBuiltin, addBuff } = L;
+const storeWith = ids => { const s = plain(defaultStore()); s.targets = s.targets.filter(t => ids.includes(t.id)); return s; };
+
+test('missingBuiltins: 목록에 없는 내장 대상만, sol·booster·rune 순서', () => {
+  assert.deepEqual(plain(missingBuiltins(storeWith(['sol', 'booster', 'rune']).targets)), []);
+  assert.deepEqual(plain(missingBuiltins(storeWith(['booster']).targets)), ['sol', 'rune']);
+});
+
+test('addBuiltin: 원래 id·기본값으로 복원, 이미 있으면 거절, 이름이 겹치면 (기본)을 붙인다', () => {
+  const s = storeWith(['booster', 'rune']);
+  const r = addBuiltin(s, 'sol');
+  assert.equal(r.ok, true); assert.deepEqual(plain([r.target.id, r.target.name, r.target.preset, r.target.p]), ['sol', '솔 야누스', 'sol', { durationSec: null, leadSec: 10 }]);
+  assert.equal(s.targets.length, 3); assert.equal(addBuiltin(s, 'sol').ok, false);
+  const s2 = storeWith(['booster']); s2.targets.push({ id: 'u1', kind: 'buff', name: '솔 야누스', p: {} });
+  assert.equal(addBuiltin(s2, 'sol').target.name, '솔 야누스 (기본)');
+  assert.equal(addBuiltin(storeWith([]), 'nope').ok, false);
+});
+
+test('addBuff: 이름 검사를 거쳐 u번호 id로 추가, 12개 상한, seq는 계속 증가', () => {
+  const s = plain(defaultStore());
+  const a = addBuff(s, ' 유니온의 힘 ');
+  assert.deepEqual(plain([a.ok, a.target.id, a.target.name, a.target.kind, a.target.preset, a.target.threshold, a.target.enabled, a.target.p]),
+    [true, 'u1', '유니온의 힘', 'buff', null, 0.75, true, { durationSec: null, leadSec: 10 }]);
+  assert.equal(addBuff(s, '유니온의 힘').ok, false);                  // 같은 이름
+  assert.equal(addBuff(s, '').msg, '이름을 1~12자로, 다른 대상과 다르게 입력해 주세요');
+  s.targets = s.targets.filter(t => t.id !== 'u1');
+  assert.equal(addBuff(s, '유니온의 부').target.id, 'u2');
+  while (s.targets.length < 12) addBuff(s, '버프' + s.seq);
+  const full = addBuff(s, '하나 더'); assert.deepEqual(plain([full.ok, full.msg]), [false, '대상은 12개까지 둘 수 있어요']);
+});
```

- [ ] **Step 2: 실패를 본다**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 64` `# fail 3`.

- [ ] **Step 3: `js/targets.js`에 구현**

`addBuiltin`은 지웠던 내장 대상을 원래 id·기본값으로 되살리고(이름이 겹치면 `(기본)`), `addBuff`는 이름 검사·12개 상한·`u<번호>` id를 처리한다.

```diff
diff --git a/js/targets.js b/js/targets.js
--- a/js/targets.js
+++ b/js/targets.js
@@ -105,4 +105,22 @@ function targetSnapshot(targets,states,ctx,now){
 }
 
+/* ----- 대상 추가 (순수: 저장소 객체를 바꾸고 결과를 돌려준다. 화면 처리는 ui-cards.js) ----- */
+const FULL_MSG=`대상은 ${TARGET_MAX}개까지 둘 수 있어요`;
+function missingBuiltins(targets){ return Object.keys(BUILTIN).filter(id=>!targets.some(t=>t.id===id)); }
+// 지웠던 내장 대상을 기본값으로 다시 만든다(원래 id). 같은 이름이 이미 있으면 (기본)을 붙인다
+function addBuiltin(store,id){
+  if(!BUILTIN[id]||store.targets.some(t=>t.id===id)) return {ok:false,msg:'이미 목록에 있어요'};
+  if(store.targets.length>=TARGET_MAX) return {ok:false,msg:FULL_MSG};
+  const t=builtinTarget(id); let name=t.name, n=1;
+  while(store.targets.some(x=>x.name===name)){ name=`${t.name} (기본${n>1?' '+n:''})`; n++; }
+  t.name=name; store.targets.push(t); return {ok:true,target:t};
+}
+// 이름만 채운 새 버프. 지속시간·아이콘은 비워 둔다(게임 안 값을 모르므로 미리 채우지 않음)
+function addBuff(store,rawName){
+  if(store.targets.length>=TARGET_MAX) return {ok:false,msg:FULL_MSG};
+  const c=checkName(rawName,store.targets,null); if(!c.ok) return {ok:false,msg:c.msg};
+  const t=newTarget(makeId(store),'buff',c.name,{threshold:0.75}); store.targets.push(t); return {ok:true,target:t};
+}
+
 /* ----- 내 소리 슬롯 키 = 대상id.이벤트 (묶음 1 스펙 4.4·4.5) ----- */
 const MANUAL_SLOTS=[['manual.pre','미리 알림'],['manual.end','끝'],['manual.next1','구간 전환 1'],['manual.next2','구간 전환 2']];
@@ -137,3 +155,3 @@ function initTargets(){
   else if(r.saveFailed){ saveWarned=true; setNote('설정을 저장하지 못했어요 (이 탭에서만 유지)'); }
 }
-if(typeof module==='object') module.exports={slotsOf,orphanSlots,BUILTIN,PRESETS,defaultStore,newTarget,builtinTarget,normalizeTarget,normalizeStore,makeId,migrateV1,loadStore,saveStore,checkName,targetSnapshot};
+if(typeof module==='object') module.exports={missingBuiltins,addBuiltin,addBuff,slotsOf,orphanSlots,BUILTIN,PRESETS,defaultStore,newTarget,builtinTarget,normalizeTarget,normalizeStore,makeId,migrateV1,loadStore,saveStore,checkName,targetSnapshot};
```

- [ ] **Step 4: 마크업·스타일**

카드 목록을 `#cardList`로 옮기고 그 위에 추가 막대(`#addBar`)를 둔다.

```diff
diff --git a/css/app.css b/css/app.css
--- a/css/app.css
+++ b/css/app.css
@@ -41,9 +41,10 @@ main{display:grid;grid-template-columns:minmax(0,1fr) 360px;grid-template-areas:
 #stagePanel{grid-area:stage}
 #cards{grid-area:cards;display:grid;gap:12px;align-content:start}
+#cardList{display:grid;gap:12px}
 #help{grid-area:help;align-self:start}
 #sounds{grid-area:sounds;align-self:start}
 @media (max-width:980px){
   main{grid-template-columns:minmax(0,1fr);grid-template-areas:"stage" "cards" "help" "sounds";grid-template-rows:auto}
-  #cards{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
+  #cardList{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
 }
 .panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px}
@@ -80,2 +81,8 @@ summary{cursor:pointer}
 #soundNote.warn{color:var(--warn-text)}
 .score{font-variant-numeric:tabular-nums}
+/* 대상 추가 메뉴 */
+#addMenu{margin-top:8px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--panel);display:grid;gap:10px}
+#addMenu b{font-size:13px;color:var(--muted)}
+#addMenu .opts{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
+#addMenu form{display:flex;gap:8px;align-items:center}
+#addMenu input{font:inherit;padding:3px 6px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--ink);width:10em}
diff --git a/index.html b/index.html
--- a/index.html
+++ b/index.html
@@ -37,5 +37,11 @@
     <div id="stage"><canvas id="preview" width="960" height="540"></canvas><div id="empty">“게임 화면 연결”을 눌러 메이플스토리 창을 공유하세요.</div></div>
   </section>
-  <aside id="cards" aria-label="감지 대상"></aside>
+  <aside id="cards" aria-label="감지 대상">
+    <div id="addBar">
+      <button id="btnAdd" aria-expanded="false" aria-controls="addMenu">+ 대상 추가</button> <span id="addNote" class="sub" role="status"></span>
+      <div id="addMenu" hidden></div>
+    </div>
+    <div id="cardList"></div>
+  </aside>
   <section class="panel" id="help">
     <details id="helpDetails">
```

- [ ] **Step 5: 화면 동작**

```diff
diff --git a/js/register.js b/js/register.js
--- a/js/register.js
+++ b/js/register.js
@@ -1,5 +1,5 @@
 /* ----- 미리보기 & 드래그 등록 ----- */
 const pv=$('#preview'), pctx=pv.getContext('2d');
-let reg=null; // {t, steps, i, snap, rects:{area?,icon?}, drag, msg}
+let reg=null; // {t, steps, i, snap, rects:{area?,icon?}, drag, msg, fresh}  fresh: 방금 만든 대상의 첫 등록(취소하면 대상도 지운다)
 function drawPreview(source){
   const s = reg ? reg.snap : source; if(!s) return;
@@ -37,9 +37,10 @@ async function snapshot(){
   const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(s,0,0); return cv;
 }
-async function startRegister(t){
+async function startRegister(t,opts={}){
   if(!src){ setNote(`${t.name} 등록은 게임 화면을 연결하거나 스크린샷을 불러온 뒤에 할 수 있어요`); return; }
   setNote('');
   const snap=await snapshot(); if(!snap) return;
-  reg={t,steps:KINDS[t.kind].register.steps,i:0,snap,rects:{},drag:null,msg:''}; updateBanner(); drawPreview(null);
+  if(reg) cancelRegister();   // 다른 대상을 등록 중이었으면 그만둔다(첫 등록이었으면 그 대상은 지워진다)
+  reg={t,steps:KINDS[t.kind].register.steps,i:0,snap,rects:{},drag:null,msg:'',fresh:!!opts.fresh}; updateBanner(); drawPreview(null);
   $('#stage').scrollIntoView({behavior:'smooth',block:'center'});
 }
@@ -50,5 +51,8 @@ function updateBanner(){
   $('#bannerText').textContent=(reg.msg?`⚠ ${reg.msg} · `:'')+`${reg.t.name} ${'①②③'[reg.i]} ${STEP_TEXT[reg.steps[reg.i]](labelsOf(reg.t))}`;
 }
-function cancelRegister(){ reg=null; updateBanner(); }
+function cancelRegister(){
+  const r=reg; reg=null; updateBanner();
+  if(r&&r.fresh){ removeTargetNow(r.t); setNote(`${r.t.name} 등록을 취소해서 목록에서 뺐어요`,'info'); }   // 빈 "등록 필요" 카드가 쌓이지 않게
+}
 // 모든 단계를 마치면 종류의 검사(validate)를 거쳐 저장(save). 검사에 걸리면 이유를 배너에 보이고 처음 단계부터 다시 드래그
 function finishRegister(){
diff --git a/js/ui-cards.js b/js/ui-cards.js
--- a/js/ui-cards.js
+++ b/js/ui-cards.js
@@ -6,10 +6,16 @@ function fieldHtml(f,id){
     +`${f.suffix?` <span class="sub" id="${fid}-sfx">${f.suffix}</span>`:''}${f.hint?` <span class="sub">${f.hint}</span>`:''}</span>`;
 }
-function initCards(){ buildCards(); }
+function initCards(){
+  buildCards();
+  $('#btnAdd').onclick=()=>{ if($('#addMenu').hidden){ renderAddMenu(); $('#addMenu').hidden=false; $('#btnAdd').setAttribute('aria-expanded','true'); const b=$('#addMenu button:not(:disabled)'); if(b) b.focus(); } else closeAddMenu(); };
+  document.addEventListener('click',e=>{ if(!$('#addMenu').hidden&&!e.target.closest('#addBar')) closeAddMenu(); });
+  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#addMenu').hidden){ closeAddMenu(); $('#btnAdd').focus(); } });
+}
 function buildCards(){
-  const box=$('#cards'); box.innerHTML='';
+  const box=$('#cardList'); box.innerHTML='';
   for(const t of store.targets) box.appendChild(buildCard(t));
   for(const t of store.targets) renderCard(t);
   $('#subtitle').textContent=`감지 대상 ${store.targets.length}개`;
+  updateAddBar();
 }
 function buildCard(t){
@@ -66,2 +72,40 @@ function renderCard(t){
   setText(sEl,s.text); const cls='status '+s.cls; if(sEl.className!==cls) sEl.className=cls; setText(q('[data-s=sub]'),s.sub);
 }
+
+/* ----- 대상 추가·제거 (순수 부분은 targets.js의 addBuiltin·addBuff) ----- */
+const BUFF_NAMES=['유니온의 힘','유니온의 부','재물 획득의 비약','경험치 쿠폰'];   // 이름만 채워 주는 후보. 지속시간 등은 채우지 않는다
+function updateAddBar(){ const full=store.targets.length>=TARGET_MAX; $('#btnAdd').disabled=full; setText($('#addNote'),full?FULL_MSG:''); if(full) closeAddMenu(); }
+function closeAddMenu(){ $('#addMenu').hidden=true; $('#btnAdd').setAttribute('aria-expanded','false'); }
+function menuBtn(text,fn){ const b=document.createElement('button'); b.type='button'; b.textContent=text; b.onclick=fn; return b; }
+function renderAddMenu(){
+  const m=$('#addMenu'); m.textContent='';
+  const group=title=>{ const d=document.createElement('div'), b=document.createElement('b'), o=document.createElement('div'); b.textContent=title; o.className='opts'; d.append(b,o); m.append(d); return o; };
+  const base=group('기본 제공'), miss=missingBuiltins(store.targets);
+  if(!miss.length){ const s=document.createElement('span'); s.className='sub'; s.textContent='모두 추가돼 있어요'; base.append(s); }
+  for(const id of miss) base.append(menuBtn(BUILTIN[id].name,()=>addFromMenu(()=>addBuiltin(store,id))));
+  const buffs=group('버프 직접 등록');
+  for(const n of BUFF_NAMES){ const b=menuBtn(n,()=>addFromMenu(()=>addBuff(store,n))); b.disabled=store.targets.some(t=>t.name===n); buffs.append(b); }
+  buffs.append(menuBtn('이름 직접 입력…',()=>{ $('#addName').hidden=false; $('#addName input').focus(); }));
+  const f=document.createElement('form'); f.id='addName'; f.hidden=true;
+  f.innerHTML='<label class="sw">이름 <input maxlength="12" aria-label="새 버프 이름"></label><button>추가</button>';
+  f.onsubmit=e=>{ e.preventDefault(); addFromMenu(()=>addBuff(store,f.querySelector('input').value)); };
+  m.append(f);
+}
+// 목록이 바뀐 뒤 화면을 다시 맞춘다: 카드, 소리 설정 목록, 상태줄
+function onTargetsChanged(){ buildCards(); rebuildSounds(); renderWatch(); }
+function addFromMenu(make){
+  const r=make(); if(!r.ok){ setNote(r.msg); return; }
+  const t=r.target; ui.open=ui.open||{}; ui.open[t.id]=true; saveUi();   // 새 대상은 펼쳐 둔다(펼침 상태는 Task F3에서 쓴다)
+  closeAddMenu(); saveTargets(); onTargetsChanged();
+  if(!KINDS[t.kind].isRegistered(t)){
+    if(src) startRegister(t,{fresh:true});     // 첫 등록을 취소하면 이 대상은 자동으로 지워진다
+    else setNote(`${t.name} 등록 필요 · 게임 화면을 연결한 뒤 등록할 수 있어요`);
+  }
+}
+// 확인·되돌리기 없이 바로 뺀다(첫 등록 취소용). 사용자가 누르는 삭제는 Task F2의 deleteTarget
+function removeTargetNow(t){
+  const i=store.targets.indexOf(t); if(i<0) return -1;
+  if(reg&&reg.t===t){ reg=null; updateBanner(); }
+  store.targets.splice(i,1); delete states[t.id]; Alerts.drop(t.id);
+  saveTargets(); onTargetsChanged(); return i;
+}
```

- [ ] **Step 6: 브라우저 시나리오**

`drag`는 부드러운 스크롤이 멈출 때까지 기다린 뒤 좌표를 잡도록 고친다(등록 배너가 열리면 캔버스가 스크롤된다 [확인: 안 기다리면 드래그가 빗나가 템플릿이 단색이 되었다]).

```diff
diff --git a/tests/browser/prelude.mjs b/tests/browser/prelude.mjs
--- a/tests/browser/prelude.mjs
+++ b/tests/browser/prelude.mjs
@@ -35,7 +35,9 @@ export function check(name, cond, detail) {
 export function done() { console.log(`RESULT ${pass} passed, ${fail} failed`); }
 
-// 미리보기 캔버스 위에서 이미지 좌표 (x0,y0)→(x1,y1)로 드래그한다(영역·아이콘 등록용)
+// 미리보기 캔버스 위에서 이미지 좌표 (x0,y0)→(x1,y1)로 드래그한다(영역·아이콘 등록용). 부드러운 스크롤이 멈출 때까지 기다린 뒤 좌표를 잡는다
 export async function drag(page, x0, y0, x1, y1) {
-  const r = await page.evaluate(() => { const c = document.querySelector("#preview"), b = c.getBoundingClientRect(); return { l: b.left, t: b.top, sx: b.width / c.width, sy: b.height / c.height }; });
+  const rect = () => page.evaluate(() => { const c = document.querySelector("#preview"), b = c.getBoundingClientRect(); return { l: b.left, t: b.top, sx: b.width / c.width, sy: b.height / c.height }; });
+  let r = await rect();
+  for (let i = 0; i < 30; i++) { await page.waitForTimeout(100); const n = await rect(); if (n.t === r.t && n.l === r.l) break; r = n; }
   const P = (x, y) => [r.l + x * r.sx, r.t + y * r.sy];
   await page.mouse.move(...P(x0, y0)); await page.mouse.down(); await page.mouse.move(...P((x0 + x1) / 2, (y0 + y1) / 2)); await page.mouse.move(...P(x1, y1)); await page.mouse.up();
```

`tests/browser/targets-ui.mjs`(이 Task의 버전. 이후 Task에서 시나리오가 이어서 더해진다):

```js
// 대상 추가·삭제·이름·순서·카드 접힘·상태줄 요약 검사 (Task F1 이후 단계마다 이 파일에 시나리오가 더해진다)
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done, drag } = await import(ROOT + "prelude.mjs");
const ids = ev => ev(() => store.targets.map(t => t.id));
const J = JSON.stringify;

// ---- F1: 대상 추가 메뉴 ----
let { page, ev, wait } = await open(taskSpace, { connect: true });
await page.click("#btnAdd");
const menu = await ev(() => ({ hidden: document.querySelector("#addMenu").hidden, text: document.querySelector("#addMenu").innerText, expanded: document.querySelector("#btnAdd").getAttribute("aria-expanded") }));
check("추가 메뉴: 열림, 기본 제공은 모두 추가돼 있어요", !menu.hidden && menu.expanded === "true" && menu.text.includes("모두 추가돼 있어요") && menu.text.includes("유니온의 힘") && menu.text.includes("이름 직접 입력"), menu);
await page.click("#addMenu >> text=유니온의 힘").catch(async () => { await ev(() => [...document.querySelectorAll("#addMenu button")].find(b => b.textContent === "유니온의 힘").click()); });
await wait(1200);
const added = await ev(() => ({ ids: store.targets.map(t => t.id), banner: document.querySelector("#bannerText").textContent, name: document.querySelector("#card-u1 [data-s=name]").textContent, status: document.querySelector("#card-u1 [data-s=status]").textContent, groups: [...document.querySelectorAll("#soundRows .snd-group > b")].map(b => b.textContent) }));
check("버프 추가: u1 카드, 등록 배너가 바로 열림", J(added.ids) === J(["sol", "booster", "rune", "u1"]) && added.banner === "유니온의 힘 ① 버프창 영역을 넉넉하게 드래그하세요" && added.name === "유니온의 힘", added);
check("버프 추가: 소리 설정에 그룹이 생김", added.groups.includes("유니온의 힘"), added.groups);
await page.keyboard.press("Escape"); await wait(300);
const cancelled = await ev(() => ({ ids: store.targets.map(t => t.id), cards: document.querySelectorAll(".card").length, sub: document.querySelector("#subtitle").textContent, v2: JSON.parse(localStorage.getItem("maple-web-timer-v2")).targets.length, note: document.querySelector("#watchNote").textContent }));
check("첫 등록 취소(Esc): 대상 자동 삭제", J(cancelled.ids) === J(["sol", "booster", "rune"]) && cancelled.cards === 3 && cancelled.v2 === 3 && cancelled.note.includes("등록을 취소해서 목록에서 뺐어요"), cancelled);

// 다시 추가 → 영역·아이콘 드래그로 등록
await ev(() => { __fake.pattern("u2", 900, 100, 11, 32); });
await wait(1200);                                            // 가짜 화면이 새 프레임으로 갱신될 시간(캔버스 150ms + 캡처 5fps)
await page.click("#btnAdd"); await ev(() => [...document.querySelectorAll("#addMenu button")].find(b => b.textContent === "유니온의 힘").click()); await wait(1000);
await drag(page, 700, 60, 1200, 200);
await drag(page, 898, 98, 934, 134);
await wait(3500);
const reg = await ev(() => ({ t: store.targets[3], status: document.querySelector("#card-u2 [data-s=status]").textContent, score: document.querySelector("#card-u2 [data-s=score]").textContent }));
check("버프 등록: id u2(삭제한 u1은 재사용 안 함), tpl·area 저장, 켜짐 인식", reg.t.id === "u2" && reg.t.tpl && reg.t.area && reg.status === "켜짐" && parseFloat(reg.score) >= 0.9, reg);

// 이름 직접 입력, 중복·빈 이름 거절
await page.click("#btnAdd"); await ev(() => [...document.querySelectorAll("#addMenu button")].find(b => b.textContent === "이름 직접 입력…").click());
await page.fill("#addName input", "유니온의 힘"); await page.keyboard.press("Enter"); await wait(300);
check("이름 직접 입력: 중복 거절", (await ev(() => document.querySelector("#watchNote").textContent)) === "이름을 1~12자로, 다른 대상과 다르게 입력해 주세요" && (await ids(ev)).length === 4);

// 12개 상한
await ev(() => { while (store.targets.length < 12) { const r = addBuff(store, "채움" + store.seq); if (!r.ok) break; } onTargetsChanged(); });
const full = await ev(() => ({ n: store.targets.length, dis: document.querySelector("#btnAdd").disabled, note: document.querySelector("#addNote").textContent, sub: document.querySelector("#subtitle").textContent }));
check("12개: 추가 버튼 비활성과 안내", full.n === 12 && full.dis && full.note === "대상은 12개까지 둘 수 있어요" && full.sub === "감지 대상 12개", full);

// 지운 내장 대상은 '기본 제공'에서 복원
await ev(() => { removeTargetNow(targetById("rune")); });
await page.click("#btnAdd");
const menu2 = await ev(() => document.querySelector("#addMenu").innerText);
check("기본 제공 복원 칸: 룬", menu2.includes("기본 제공") && menu2.split("버프 직접 등록")[0].includes("룬"), menu2);
await ev(() => [...document.querySelectorAll("#addMenu button")].find(b => b.textContent === "룬").click()); await wait(1200);
const back = await ev(() => ({ last: store.targets[store.targets.length - 1], banner: document.querySelector("#bannerText").textContent }));
check("룬 복원: 원래 id·기본값, 등록 필요라 배너가 열림", back.last.id === "rune" && back.last.name === "룬" && back.last.threshold === 0.8 && back.banner.startsWith("룬 ① 미니맵 영역"), back);

// 연결 전에 추가하면 등록 필요 문구
({ page, ev, wait } = await open(taskSpace, {}));
await page.click("#btnAdd"); await ev(() => [...document.querySelectorAll("#addMenu button")].find(b => b.textContent === "경험치 쿠폰").click()); await wait(300);
const off = await ev(() => ({ note: document.querySelector("#watchNote").textContent, st: document.querySelector("#card-u1 [data-s=status]").textContent, banner: document.querySelector("#banner").classList.contains("on") }));
check("연결 전 추가: 등록 필요 문구, 배너 없음", off.note.includes("경험치 쿠폰 등록 필요 · 게임 화면을 연결한 뒤 등록할 수 있어요") && off.st === "등록 필요" && !off.banner, off);
done();
```

- [ ] **Step 7: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
runb tests/browser/targets-ui.mjs
runb tests/browser/regression.mjs
```

Expected: `# pass 67` `# fail 0`. 시나리오 `RESULT 10 passed, 0 failed` — 메뉴 열림과 "기본 제공은 모두 추가돼 있어요", 유니온의 힘 추가 시 `u1` 카드와 배너 `유니온의 힘 ① 버프창 영역을 넉넉하게 드래그하세요`, 소리 설정에 그룹 생성, `Esc`로 대상 자동 삭제(알림줄 `…등록을 취소해서 목록에서 뺐어요`), 다시 추가하면 id `u2`(삭제한 `u1`은 재사용 안 함)로 드래그 등록되고 `켜짐`으로 인식, 이름 중복 거절, 12개에서 추가 버튼 비활성과 `대상은 12개까지 둘 수 있어요`, 지운 룬이 "기본 제공"에 나타나 원래 id로 복원, 연결 전 추가 시 `등록 필요` 문구. 회귀 14 통과.

- [ ] **Step 8: 커밋**

```bash
git add css/app.css index.html js/register.js js/targets.js js/ui-cards.js tests/browser/prelude.mjs tests/browser/targets-ui.mjs tests/targets.test.js
git commit -F - <<'EOF'
대상 추가 메뉴: 기본 제공 복원, 버프 이름만 채워 등록, 첫 등록 취소 시 자동 삭제

addBuiltin(원래 id로 복원, 이름이 겹치면 (기본))·addBuff(이름 검사, 12개 상한, u+증가 id).
버프는 지속시간·기준값·아이콘을 미리 채우지 않는다. 연결돼 있으면 곧바로 영역→아이콘
등록을 시작하고, 방금 만든 대상의 첫 등록을 취소하면 빈 카드가 쌓이지 않게 지운다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 14: 삭제(10초 되돌리기) · 이름 바꾸기 · 순서

삭제는 확인 → 목록에서 즉시 빼기 → 10초 되돌리기(스펙 4.5). 내 소리 파일은 메모리에 보관하다가 10초 뒤에 IndexedDB에서 지운다. 10초 안에 탭이 닫혀 남은 파일은 다음 로드의 고아 정리(Task 12)가 지운다. 되돌리면 같은 위치·같은 id·같은 소리다. 이름은 id·슬롯을 바꾸지 않고 1~12자·다른 대상과 중복 금지. 순서는 카드의 `위로`/`아래로` 버튼이다.

**Files:**
- Modify: `js/targets.js`, `js/ui-cards.js`, `index.html`, `css/app.css`, `tests/targets.test.js`, `tests/browser/targets-ui.mjs`

- [ ] **Step 1: 실패하는 테스트를 더한다**

```diff
diff --git a/tests/targets.test.js b/tests/targets.test.js
--- a/tests/targets.test.js
+++ b/tests/targets.test.js
@@ -196,2 +196,39 @@ test('addBuff: 이름 검사를 거쳐 u번호 id로 추가, 12개 상한, seq
   const full = addBuff(s, '하나 더'); assert.deepEqual(plain([full.ok, full.msg]), [false, '대상은 12개까지 둘 수 있어요']);
 });
+
+// ---- 이름 바꾸기·순서·삭제 (묶음 1 스펙 3.3·4.5) ----
+const { renameTarget, moveTarget, insertTargetAt, deleteConfirmText, ownedSlotKeys } = L;
+
+test('renameTarget: id·슬롯은 그대로, 이름만 바뀐다. 중복·빈 이름·13자는 거절하고 이름을 바꾸지 않는다', () => {
+  const s = plain(defaultStore());
+  assert.deepEqual(plain(renameTarget(s, 'sol', '  솔  ')), { ok: true, msg: '' });
+  assert.deepEqual([s.targets[0].id, s.targets[0].name], ['sol', '솔']);
+  assert.equal(renameTarget(s, 'sol', '룬').ok, false);
+  assert.equal(renameTarget(s, 'sol', '룬').msg, '이름을 1~12자로, 다른 대상과 다르게 입력해 주세요');
+  assert.equal(renameTarget(s, 'sol', '').ok, false); assert.equal(renameTarget(s, 'sol', '가'.repeat(13)).ok, false);
+  assert.equal(s.targets[0].name, '솔');
+  assert.equal(renameTarget(s, 'sol', '솔').ok, true);                    // 자기 자신과 같은 이름은 허용
+  assert.equal(renameTarget(s, 'nope', 'x').ok, false);
+});
+
+test('moveTarget: 위(-1)·아래(+1)로 한 칸, 끝에서는 아무 일도 없다', () => {
+  const s = plain(defaultStore()), order = () => s.targets.map(t => t.id).join();
+  assert.equal(moveTarget(s, 'rune', -1), 1); assert.equal(order(), 'sol,rune,booster');
+  assert.equal(moveTarget(s, 'sol', -1), -1); assert.equal(order(), 'sol,rune,booster');
+  assert.equal(moveTarget(s, 'booster', 1), -1);
+  assert.equal(moveTarget(s, 'sol', 1), 1); assert.equal(order(), 'rune,sol,booster');
+  assert.equal(moveTarget(s, 'zzz', 1), -1);
+});
+
+test('insertTargetAt: 되돌리기 위치(범위를 넘으면 끝), 이름이 겹치면 (복원)', () => {
+  const s = plain(defaultStore()), t = { id: 'u1', name: '유니온의 힘' };
+  insertTargetAt(s, t, 1); assert.deepEqual(s.targets.map(x => x.id), ['sol', 'u1', 'booster', 'rune']);
+  const s2 = plain(defaultStore()); insertTargetAt(s2, { id: 'u2', name: '룬' }, 99);
+  assert.deepEqual(s2.targets.map(x => [x.id, x.name]).slice(2), [['rune', '룬'], ['u2', '룬 (복원)']]);
+});
+
+test('삭제 확인 문구와 대상이 가진 내 소리 키', () => {
+  assert.equal(deleteConfirmText('유니온의 힘', 0), '"유니온의 힘" 대상을 지울까요?');
+  assert.equal(deleteConfirmText('유니온의 힘', 2), '"유니온의 힘" 대상을 지울까요? 내 소리 2개도 함께 지워져요.');
+  assert.deepEqual(plain(ownedSlotKeys(['u3.pre', 'u3.gone', 'u30.pre', 'sol.pre', 'sys.lost'], 'u3')), ['u3.pre', 'u3.gone']);
+});
```

- [ ] **Step 2: 실패를 본다**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 67` `# fail 4`.

- [ ] **Step 3: 구현**

```diff
diff --git a/js/targets.js b/js/targets.js
--- a/js/targets.js
+++ b/js/targets.js
@@ -123,4 +123,24 @@ function addBuff(store,rawName){
 }
 
+/* ----- 이름 바꾸기·순서·삭제 (순수. 화면 처리는 ui-cards.js) ----- */
+function renameTarget(store,id,raw){
+  const t=store.targets.find(x=>x.id===id); if(!t) return {ok:false,msg:'대상을 찾을 수 없어요'};
+  const c=checkName(raw,store.targets,id); if(!c.ok) return {ok:false,msg:c.msg};
+  t.name=c.name; return {ok:true,msg:''};            // id·내 소리 슬롯은 그대로
+}
+// delta -1(위)·+1(아래). 바뀐 새 위치를 돌려주고, 끝이라 못 움직이면 -1
+function moveTarget(store,id,delta){
+  const i=store.targets.findIndex(x=>x.id===id), j=i+delta;
+  if(i<0||j<0||j>=store.targets.length) return -1;
+  [store.targets[i],store.targets[j]]=[store.targets[j],store.targets[i]]; return j;
+}
+// 삭제 되돌리기: 같은 위치로 복원(위치가 목록 길이를 넘으면 끝). 그 사이 같은 이름이 생겼으면 (복원)을 붙인다
+function insertTargetAt(store,t,index){
+  if(store.targets.some(x=>x.name===t.name)) t.name=t.name.slice(0,6)+' (복원)';
+  store.targets.splice(Math.min(index,store.targets.length),0,t);
+}
+function deleteConfirmText(name,soundCount){ return `"${name}" 대상을 지울까요?`+(soundCount?` 내 소리 ${soundCount}개도 함께 지워져요.`:''); }
+function ownedSlotKeys(keys,id){ return keys.filter(k=>String(k).split('.')[0]===id); }
+
 /* ----- 내 소리 슬롯 키 = 대상id.이벤트 (묶음 1 스펙 4.4·4.5) ----- */
 const MANUAL_SLOTS=[['manual.pre','미리 알림'],['manual.end','끝'],['manual.next1','구간 전환 1'],['manual.next2','구간 전환 2']];
@@ -155,3 +175,3 @@ function initTargets(){
   else if(r.saveFailed){ saveWarned=true; setNote('설정을 저장하지 못했어요 (이 탭에서만 유지)'); }
 }
-if(typeof module==='object') module.exports={missingBuiltins,addBuiltin,addBuff,slotsOf,orphanSlots,BUILTIN,PRESETS,defaultStore,newTarget,builtinTarget,normalizeTarget,normalizeStore,makeId,migrateV1,loadStore,saveStore,checkName,targetSnapshot};
+if(typeof module==='object') module.exports={renameTarget,moveTarget,insertTargetAt,deleteConfirmText,ownedSlotKeys,missingBuiltins,addBuiltin,addBuff,slotsOf,orphanSlots,BUILTIN,PRESETS,defaultStore,newTarget,builtinTarget,normalizeTarget,normalizeStore,makeId,migrateV1,loadStore,saveStore,checkName,targetSnapshot};
```

- [ ] **Step 4: 화면**

되돌리기 막대(`#undoBar`)를 더하고, 카드에 `이름 바꾸기`·`위로`·`아래로`·`삭제` 줄과 이름 입력 폼을 더한다. 되돌리기 막대는 한 번에 가장 최근에 지운 대상 하나만 보인다(여러 개를 빠르게 지우면 앞의 것은 10초 뒤 확정 삭제된다 — 알려진 한계).

```diff
diff --git a/css/app.css b/css/app.css
--- a/css/app.css
+++ b/css/app.css
@@ -87,2 +87,6 @@ summary{cursor:pointer}
 #addMenu form{display:flex;gap:8px;align-items:center}
 #addMenu input{font:inherit;padding:3px 6px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--ink);width:10em}
+/* 삭제 되돌리기 */
+#undoBar{position:fixed;left:16px;bottom:16px;z-index:8;display:flex;gap:10px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 12px;box-shadow:0 6px 24px rgba(0,0,0,.2)}
+#undoBar[hidden]{display:none}
+.card .manage{justify-content:flex-end}
diff --git a/index.html b/index.html
--- a/index.html
+++ b/index.html
@@ -68,4 +68,5 @@
 </main>
 <div id="toast" role="alert"></div>
+<div id="undoBar" role="status" hidden><span id="undoText"></span> <button id="undoBtn" type="button">되돌리기</button></div>
 
 <script src="js/util.js"></script>
diff --git a/js/ui-cards.js b/js/ui-cards.js
--- a/js/ui-cards.js
+++ b/js/ui-cards.js
@@ -22,6 +22,6 @@ function buildCard(t){
   const k=KINDS[t.kind], el=document.createElement('div'), id='t-'+t.id; el.className='card'; el.id='card-'+t.id;
   if(!k){   // 이 버전이 모르는 종류(미래 버전 데이터)는 지우지 않고 안내만
-    el.innerHTML='<div class="top"><h2><span data-s="name"></span></h2></div><div class="sub">이 버전에서 지원하지 않는 종류예요</div>';
-    el.querySelector('[data-s=name]').textContent=t.name; return el;
+    el.innerHTML='<div class="top"><h2><span data-s="name"></span></h2></div><div class="sub">이 버전에서 지원하지 않는 종류예요</div><div class="row manage" style="margin-top:10px"><button data-a="delete">삭제</button></div>';
+    el.querySelector('[data-s=name]').textContent=t.name; el.querySelector('[data-a=delete]').onclick=()=>deleteTarget(t); return el;
   }
   el.innerHTML=`
@@ -39,5 +39,9 @@ function buildCard(t){
       ${k.actions.map(a=>`<button data-act="${a.key}">${a.label}</button>`).join('')}
       ${t.preset?'<button data-a="reset">기본 아이콘으로 되돌리기</button>':''}
-    </div>`;
+    </div>
+    <div class="row manage" style="margin-top:10px">
+      <button data-a="rename">이름 바꾸기</button><button data-a="up" aria-label="${t.name} 위로 옮기기">위로</button><button data-a="down" aria-label="${t.name} 아래로 옮기기">아래로</button><button data-a="delete">삭제</button>
+    </div>
+    <form class="row" data-s="renameForm" hidden><input maxlength="12" aria-label="새 이름"><button>저장</button><button type="button" data-a="renameCancel">취소</button><span class="sub" role="alert" data-s="renameErr"></span></form>`;
   const q=s=>el.querySelector(s);
   q('[data-s=name]').textContent=t.name;
@@ -53,4 +57,11 @@ function buildCard(t){
   if(t.preset) q('[data-a=reset]').onclick=()=>{ t.tpl=null; t.area=null; t.frameW=t.frameH=0; saveTargets(); states[t.id]=newState(); renderCard(t); setNote(`${t.name} 기본 아이콘으로 되돌렸어요`,'info'); };
   q('[data-a=register]').onclick=()=>startRegister(t);
+  const idx=store.targets.indexOf(t), form=q('[data-s=renameForm]'), nameInp=form.querySelector('input');
+  q('[data-a=up]').disabled=idx===0; q('[data-a=down]').disabled=idx===store.targets.length-1;
+  q('[data-a=up]').onclick=()=>moveCard(t,-1); q('[data-a=down]').onclick=()=>moveCard(t,1);
+  q('[data-a=delete]').onclick=()=>deleteTarget(t);
+  q('[data-a=rename]').onclick=()=>{ form.hidden=false; nameInp.value=t.name; nameInp.select(); };
+  q('[data-a=renameCancel]').onclick=()=>{ form.hidden=true; q('[data-s=renameErr]').textContent=''; };
+  form.onsubmit=e=>{ e.preventDefault(); const r=renameTarget(store,t.id,nameInp.value); if(!r.ok){ q('[data-s=renameErr]').textContent=r.msg; return; } saveTargets(); onTargetsChanged(); };
   q('[data-a=test]').onclick=()=>{ unlockAudio(); testAlert(t); };
   return el;
@@ -110,2 +121,26 @@ function removeTargetNow(t){
   saveTargets(); onTargetsChanged(); return i;
 }
+
+function moveCard(t,delta){ if(moveTarget(store,t.id,delta)>=0){ saveTargets(); onTargetsChanged(); } }
+/* ----- 삭제: 확인 → 바로 뺌 → 10초 되돌리기. 내 소리 파일은 10초 뒤에 지운다(그 사이 탭이 닫히면 다음 로드의 고아 정리가 지움) ----- */
+const UNDO_MS=10000, trash=new Map();   // id → {t, index, sounds:Map(slot→소리), timer}
+function deleteTarget(t){
+  const keys=ownedSlotKeys([...customSounds.keys()],t.id);
+  if(!confirm(deleteConfirmText(t.name,keys.length))) return;
+  const sounds=new Map(keys.map(k=>[k,customSounds.get(k)])); keys.forEach(k=>customSounds.delete(k));
+  const index=removeTargetNow(t);           // 등록 중이면 취소하고, 목록·소리 설정·상태줄을 다시 그림
+  const e={t,index,sounds,timer:setTimeout(()=>finalizeDelete(t.id),UNDO_MS)}; trash.set(t.id,e);
+  $('#undoText').textContent=`"${t.name}" 지웠어요 ·`; $('#undoBar').hidden=false; $('#undoBtn').onclick=()=>undoDelete(t.id); $('#undoBtn').focus();
+}
+function finalizeDelete(id){
+  const e=trash.get(id); if(!e) return; trash.delete(id); deleteSoundKeys([...e.sounds.keys()]);
+  if(!trash.size) $('#undoBar').hidden=true;
+}
+function undoDelete(id){
+  const e=trash.get(id); if(!e) return;
+  if(store.targets.length>=TARGET_MAX){ setNote(FULL_MSG+' · 다른 대상을 지우고 되돌려 주세요'); return; }
+  clearTimeout(e.timer); trash.delete(id);
+  insertTargetAt(store,e.t,e.index); states[e.t.id]=newState(); e.sounds.forEach((v,k)=>customSounds.set(k,v));
+  saveTargets(); onTargetsChanged(); renderSounds();
+  if(!trash.size) $('#undoBar').hidden=true;
+}
```

- [ ] **Step 5: 시나리오를 더한다**

`window.confirm`을 덮어 문구를 기록한다. 내 소리 3개(`u3.pre`, `u3.gone`, `sol.pre`)를 미리 넣고 시작한다.

```diff
diff --git a/tests/browser/targets-ui.mjs b/tests/browser/targets-ui.mjs
--- a/tests/browser/targets-ui.mjs
+++ b/tests/browser/targets-ui.mjs
@@ -53,3 +53,43 @@ await page.click("#btnAdd"); await ev(() => [...document.querySelectorAll("#addM
 const off = await ev(() => ({ note: document.querySelector("#watchNote").textContent, st: document.querySelector("#card-u1 [data-s=status]").textContent, banner: document.querySelector("#banner").classList.contains("on") }));
 check("연결 전 추가: 등록 필요 문구, 배너 없음", off.note.includes("경험치 쿠폰 등록 필요 · 게임 화면을 연결한 뒤 등록할 수 있어요") && off.st === "등록 필요" && !off.banner, off);
+
+// ---- F2: 이름 바꾸기 · 순서 · 삭제 후 되돌리기 ----
+const V2 = { ver: 2, seq: 3, group: { on: false, windowSec: 10 }, targets: [
+  { id: "sol", kind: "buff", name: "솔 야누스", preset: "sol", enabled: true, threshold: 0.75, area: null, tpl: null, frameW: 0, frameH: 0, p: { durationSec: null, leadSec: 10 } },
+  { id: "u3", kind: "buff", name: "유니온의 힘", preset: null, enabled: true, threshold: 0.75, area: null, tpl: null, frameW: 0, frameH: 0, p: { durationSec: null, leadSec: 10 } },
+  { id: "rune", kind: "rune", name: "룬", preset: null, enabled: true, threshold: 0.8, area: null, tpl: null, frameW: 0, frameH: 0, p: { repeatSec: 60 } } ] };
+({ page, ev, wait } = await open(taskSpace, { seed: { "maple-web-timer-v2": V2 }, sounds: ["u3.pre", "u3.gone", "sol.pre"] }));
+await wait(1500);
+await ev(() => { window.__confirms = []; window.confirm = m => { __confirms.push(m); return true; }; });
+
+// 이름 바꾸기: 중복·빈 이름 거절, 성공하면 카드·소리 그룹·저장에 반영, id는 그대로
+await page.click("#card-u3 [data-a=rename]");
+await page.fill("#card-u3 [data-s=renameForm] input", "룬"); await page.keyboard.press("Enter");
+check("이름 바꾸기: 중복 거절 문구", (await ev(() => document.querySelector("#card-u3 [data-s=renameErr]").textContent)) === "이름을 1~12자로, 다른 대상과 다르게 입력해 주세요");
+await page.fill("#card-u3 [data-s=renameForm] input", "  유니온의 부  "); await page.keyboard.press("Enter"); await wait(300);
+const rn = await ev(() => ({ name: document.querySelector("#card-u3 [data-s=name]").textContent, groups: [...document.querySelectorAll("#soundRows .snd-group > b")].map(b => b.textContent), saved: JSON.parse(localStorage.getItem("maple-web-timer-v2")).targets[1].name, id: store.targets[1].id }));
+check("이름 바꾸기: 카드·소리 그룹·저장 반영, id 유지", rn.name === "유니온의 부" && rn.groups.includes("유니온의 부") && rn.saved === "유니온의 부" && rn.id === "u3", rn);
+
+// 순서: 룬을 위로 → sol, rune, u3. 맨 위 카드의 위로 버튼은 비활성
+await page.click("#card-rune [data-a=up]"); await wait(300);
+const ord = await ev(() => ({ store: store.targets.map(t => t.id).join(), dom: [...document.querySelectorAll("#cardList .card")].map(c => c.id).join(), saved: JSON.parse(localStorage.getItem("maple-web-timer-v2")).targets.map(t => t.id).join(), groups: [...document.querySelectorAll("#soundRows .snd-group > b")].map(b => b.textContent).join(), upDis: document.querySelector("#card-sol [data-a=up]").disabled, downDis: document.querySelector("#card-u3 [data-a=down]").disabled }));
+check("순서: 저장·카드·소리 목록이 함께 바뀜, 끝 버튼 비활성", ord.store === "sol,rune,u3" && ord.dom === "card-sol,card-rune,card-u3" && ord.saved === ord.store && ord.groups.startsWith("솔 야누스,룬,유니온의 부") && ord.upDis && ord.downDis, ord);
+
+// 삭제: 확인 문구(내 소리 2개), 즉시 사라짐, 슬롯은 아직 IndexedDB에 있음 → 되돌리기로 같은 위치·소리 복원
+await page.click("#card-u3 [data-a=delete]"); await wait(400);
+const del = await ev(async () => ({ msg: __confirms[0], ids: store.targets.map(t => t.id).join(), bar: !document.querySelector("#undoBar").hidden, text: document.querySelector("#undoText").textContent, keys: await new Promise(res => { const r = indexedDB.open("maple-web-timer", 1); r.onsuccess = () => { const q = r.result.transaction("sounds").objectStore("sounds").getAllKeys(); q.onsuccess = () => res(q.result.sort()); }; }) }));
+check("삭제: 확인 문구에 내 소리 2개", del.msg === '"유니온의 부" 대상을 지울까요? 내 소리 2개도 함께 지워져요.', del.msg);
+check("삭제: 목록에서 즉시 빠지고 되돌리기 바, 소리 파일은 10초간 보관", del.ids === "sol,rune" && del.bar && del.text.includes("지웠어요") && del.keys.includes("u3.pre") && del.keys.includes("u3.gone"), del);
+await page.click("#undoBtn"); await wait(400);
+const back2 = await ev(() => ({ ids: store.targets.map(t => t.id).join(), bar: document.querySelector("#undoBar").hidden, custom: [...customSounds.keys()].sort().join(), name: store.targets[2].name }));
+check("되돌리기: 같은 위치·이름, 내 소리 복원, 바 숨김", back2.ids === "sol,rune,u3" && back2.bar && back2.custom.includes("u3.gone") && back2.custom.includes("u3.pre") && back2.name === "유니온의 부", back2);
+
+// 다시 지우고 10초가 지나면 IndexedDB에서 슬롯이 사라지고 바가 숨는다. 내 소리가 없는 대상은 뒷문장 없이 확인
+await page.click("#card-u3 [data-a=delete]"); await wait(11000);
+const gone = await ev(async () => ({ bar: document.querySelector("#undoBar").hidden, keys: await new Promise(res => { const r = indexedDB.open("maple-web-timer", 1); r.onsuccess = () => { const q = r.result.transaction("sounds").objectStore("sounds").getAllKeys(); q.onsuccess = () => res(q.result.sort()); }; }) }));
+check("10초 뒤: 슬롯 삭제(sol.pre는 남음), 되돌리기 바 숨김", JSON.stringify(gone.keys) === JSON.stringify(["sol.pre"]) && gone.bar, gone);
+await page.click("#card-rune [data-a=delete]"); await wait(300);
+check("삭제 확인: 내 소리가 없으면 뒷문장 생략", (await ev(() => __confirms[__confirms.length - 1])) === '"룬" 대상을 지울까요?');
+await page.click("#btnAdd"); await ev(() => [...document.querySelectorAll("#addMenu button")].find(b => b.textContent === "룬").click()); await wait(300);
+check("지운 내장 대상은 같은 id로 복원", (await ev(() => store.targets.some(t => t.id === "rune"))));
 done();
```

- [ ] **Step 6: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
runb tests/browser/targets-ui.mjs
```

Expected: `# pass 71` `# fail 0`. 시나리오 `RESULT 19 passed, 0 failed` — 이름 중복 거절 문구와 성공 시 카드·소리 그룹·저장 반영(id 유지), 순서 변경이 저장·카드·소리 목록에 함께 반영되고 맨 위 `위로`·맨 아래 `아래로`는 비활성, 삭제 확인 문구 `"유니온의 부" 대상을 지울까요? 내 소리 2개도 함께 지워져요.`, 지운 직후 목록에서 빠지고 되돌리기 막대가 뜨며 IndexedDB의 `u3.*`는 아직 남음, 되돌리기로 같은 위치·이름·내 소리 복원, 다시 지우고 11초 뒤 `u3.*` 삭제(`sol.pre`는 남음)와 막대 숨김, 내 소리가 없는 대상은 뒷문장 없는 확인 문구, 지운 룬이 같은 id로 복원.

- [ ] **Step 7: 커밋**

```bash
git add css/app.css index.html js/targets.js js/ui-cards.js tests/targets.test.js tests/browser/targets-ui.mjs
git commit -F - <<'EOF'
대상 삭제(10초 되돌리기), 이름 바꾸기, 순서 변경

삭제는 확인 후 즉시 목록에서 빼고 내 소리는 10초 뒤 IndexedDB에서 지운다. 되돌리면 같은
위치·id·소리로 복원한다. 이름은 id·슬롯을 그대로 두고 1~12자·중복 금지 검사를 한다.
순서 변경은 저장·카드·소리 설정 목록에 함께 반영된다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 15: 접힌/펼친 카드 · 미리보기 점선 · 부제 · 설명서

대상이 8~10개로 늘어도 카드 열이 길어지지 않게 카드를 두 모드로 만든다(스펙 5.5). 접힌 카드는 한 줄(썸네일·이름·상태·사용 체크·펼치기)이고, 펼친 카드는 지금 카드 전체다. 펼침 상태는 `ui.open[id]`에 저장되며, 정한 적이 없으면 등록 필요·다시 등록 필요 대상만 펼친다. 사용자가 접은 카드는 자동으로 펼치지 않는다. 미리보기의 점선 영역과 이름은 펼친 카드의 대상만 그리고 일치 박스는 모든 대상에 그린다.

**Files:**
- Modify: `js/ui-cards.js`, `js/register.js`, `css/app.css`, `index.html`, `tests/browser/model.mjs`, `tests/browser/targets-ui.mjs`

- [ ] **Step 1: 카드·미리보기·스타일·설명서**

설명서(`#help`)에는 `다른 버프는 “+ 대상 추가”에서…` 한 줄이 더해진다(스펙 5.5). 헤더 부제 `감지 대상 N개`는 Task 11에서 이미 들어갔다.

```diff
diff --git a/css/app.css b/css/app.css
--- a/css/app.css
+++ b/css/app.css
@@ -91,2 +91,13 @@ summary{cursor:pointer}
 #undoBar[hidden]{display:none}
 .card .manage{justify-content:flex-end}
+/* 접힌/펼친 카드 */
+.card .top{flex-wrap:wrap;gap:6px 10px}
+.card .top h2{flex:1 1 auto;min-width:0}
+.card .top h2 span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
+.card .top button{padding:3px 10px;font-size:13px}
+.mini{color:var(--muted);font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap}
+.mini.on{color:var(--ok)}.mini.alert{color:var(--warn-text)}
+.card[data-open="1"] .mini{display:none}
+.card[data-open="0"] .body{display:none}
+.card[data-open="0"]{padding:8px 12px}
+.card[data-open="0"] .top{margin-bottom:0}
diff --git a/index.html b/index.html
--- a/index.html
+++ b/index.html
@@ -51,4 +51,5 @@
         <li><b>솔 야누스</b>와 <b>부스터</b>는 따로 등록하지 않아도 자동으로 찾습니다. 부스터는 화면 위쪽 가운데 “남은시간” 타이머의 숫자를 직접 읽어요. 잘 안 잡히면 <b>등록</b>으로 직접 지정하세요(부스터는 ② 단계에서 “◷ 남은시간” 글자를 드래그).</li>
         <li>룬이 미니맵에 보일 때 룬 카드의 <b>등록</b> → ① 미니맵 전체 → ② 룬 아이콘만 드래그.</li>
+        <li>다른 버프는 <b>“+ 대상 추가”</b>에서 이름을 고르고 영역 → 아이콘 순서로 등록하세요. 카드는 기본으로 접혀 있고 <b>펼치기</b>로 설정을 볼 수 있어요.</li>
         <li>지속시간 칸을 비워두면 한 번 켜졌다 꺼지는 걸 보고 <b>자동으로 학습</b>합니다. 알고 있으면 <code>분:초</code>로 직접 입력하세요.</li>
         <li>일치도 숫자를 보면서 켜져 있을 땐 기준값보다 높고, 꺼져 있을 땐 낮게 나오도록 기준값을 조절하세요.</li>
diff --git a/js/register.js b/js/register.js
--- a/js/register.js
+++ b/js/register.js
@@ -9,9 +9,10 @@ function drawPreview(source){
   const lw=Math.max(2,w/600); pctx.lineWidth=lw; pctx.font=`${Math.round(lw*7)}px sans-serif`;
   const placed=[];
-  if(!reg) for(const t of store.targets){ const st=stateOf(t.id), ar=KINDS[t.kind]?areaOf(t):null; if(!ar) continue;
-    pctx.setLineDash([lw*3,lw*2]); pctx.strokeStyle='rgba(255,255,255,.55)'; pctx.strokeRect(ar.x,ar.y,ar.w,ar.h);
-    pctx.setLineDash([]); pctx.fillStyle='rgba(255,255,255,.8)'; pctx.fillText(t.name,ar.x+2,ar.y+lw*8);
+  if(!reg) for(const t of store.targets){ if(!KINDS[t.kind]) continue; const st=stateOf(t.id), ar=areaOf(t);
+    // 점선 영역과 이름은 펼친 카드의 대상만(10개가 겹치지 않게). 일치 박스는 모든 대상에 그린다
+    if(ar&&isOpen(t)){ pctx.setLineDash([lw*3,lw*2]); pctx.strokeStyle='rgba(255,255,255,.55)'; pctx.strokeRect(ar.x,ar.y,ar.w,ar.h);
+      pctx.setLineDash([]); pctx.fillStyle='rgba(255,255,255,.8)'; pctx.fillText(t.name,ar.x+2,ar.y+lw*8); }
     if(st.pos&&src){ const hit=st.score>=t.threshold;
-      pctx.strokeStyle=hit?'#3ccf7d':'rgba(255,107,107,.7)'; pctx.strokeRect(st.pos.x,st.pos.y,st.pos.w,st.pos.h);
+      pctx.setLineDash([]); pctx.strokeStyle=hit?'#3ccf7d':'rgba(255,107,107,.7)'; pctx.strokeRect(st.pos.x,st.pos.y,st.pos.w,st.pos.h);
       // 기준값을 맞출 때 카드와 캔버스를 오가지 않도록 일치도/기준값을 박스 바로 아래에 표시
       const label=`${t.name} ${st.score.toFixed(2)} / ${t.threshold.toFixed(2)}`, fs=Math.round(lw*9);
diff --git a/js/ui-cards.js b/js/ui-cards.js
--- a/js/ui-cards.js
+++ b/js/ui-cards.js
@@ -27,5 +27,8 @@ function buildCard(t){
   el.innerHTML=`
     <div class="top"><h2><img class="thumb" alt="" hidden><span data-s="name"></span></h2>
-      <label class="sw"><input type="checkbox" data-k="enabled"> 사용</label></div>
+      <span class="mini" data-s="mini"></span>
+      <label class="sw"><input type="checkbox" data-k="enabled"> 사용</label>
+      <button data-a="toggle" aria-expanded="false" aria-controls="body-${t.id}"></button></div>
+    <div class="body" id="body-${t.id}">
     <div class="status off" data-s="status">등록 필요</div>
     <div class="sub" data-s="sub"></div>
@@ -43,5 +46,6 @@ function buildCard(t){
       <button data-a="rename">이름 바꾸기</button><button data-a="up" aria-label="${t.name} 위로 옮기기">위로</button><button data-a="down" aria-label="${t.name} 아래로 옮기기">아래로</button><button data-a="delete">삭제</button>
     </div>
-    <form class="row" data-s="renameForm" hidden><input maxlength="12" aria-label="새 이름"><button>저장</button><button type="button" data-a="renameCancel">취소</button><span class="sub" role="alert" data-s="renameErr"></span></form>`;
+    <form class="row" data-s="renameForm" hidden><input maxlength="12" aria-label="새 이름"><button>저장</button><button type="button" data-a="renameCancel">취소</button><span class="sub" role="alert" data-s="renameErr"></span></form>
+    </div>`;
   const q=s=>el.querySelector(s);
   q('[data-s=name]').textContent=t.name;
@@ -57,4 +61,5 @@ function buildCard(t){
   if(t.preset) q('[data-a=reset]').onclick=()=>{ t.tpl=null; t.area=null; t.frameW=t.frameH=0; saveTargets(); states[t.id]=newState(); renderCard(t); setNote(`${t.name} 기본 아이콘으로 되돌렸어요`,'info'); };
   q('[data-a=register]').onclick=()=>startRegister(t);
+  q('[data-a=toggle]').onclick=()=>{ ui.open=ui.open||{}; ui.open[t.id]=!isOpen(t); saveUi(); renderCard(t); };
   const idx=store.targets.indexOf(t), form=q('[data-s=renameForm]'), nameInp=form.querySelector('input');
   q('[data-a=up]').disabled=idx===0; q('[data-a=down]').disabled=idx===store.targets.length-1;
@@ -73,4 +78,7 @@ function onTargetChanged(t,key){
   if(f&&inp) inp.value=f.get(t);
 }
+// 펼침 상태: 사용자가 정한 값(ui.open)이 우선. 정한 적 없으면 등록 필요·다시 등록 필요 대상만 펼친다(알림으로 카드가 움직이지 않게 접은 것은 자동으로 펼치지 않음)
+function needsAttention(t){ const k=KINDS[t.kind]; return !!k&&(!k.isRegistered(t)||(!!src&&k.needsReregister(t,frame))); }
+function isOpen(t){ return ui.open&&t.id in ui.open ? !!ui.open[t.id] : needsAttention(t); }
 function renderCard(t){
   const el=document.getElementById('card-'+t.id), k=KINDS[t.kind]; if(!el||!k) return;
@@ -82,4 +90,7 @@ function renderCard(t){
   const s=cardStatus(t,st,Date.now(),{src:!!src,frame}), sEl=q('[data-s=status]');
   setText(sEl,s.text); const cls='status '+s.cls; if(sEl.className!==cls) sEl.className=cls; setText(q('[data-s=sub]'),s.sub);
+  const mini=q('[data-s=mini]'); setText(mini,s.text); const mc='mini '+s.cls; if(mini.className!==mc) mini.className=mc;   // 접힌 카드의 한 줄 상태
+  const open=isOpen(t), tg=q('[data-a=toggle]'); if(el.dataset.open!==(open?'1':'0')) el.dataset.open=open?'1':'0';
+  setText(tg,open?'접기 ▴':'펼치기 ▾'); tg.setAttribute('aria-expanded',open?'true':'false'); tg.setAttribute('aria-label',`${t.name} ${open?'접기':'펼치기'}`);
 }
 
```

- [ ] **Step 2: 시나리오를 맞추고 더한다**

접힌 카드의 버튼은 보이지 않으므로 모델 시나리오는 알림 테스트 전에 `펼치기`를 누른다. 새 시나리오는 `strokeRect` 호출을 기록해 점선 영역이 접힌 대상에는 그려지지 않는 것을 확인한다.

```diff
diff --git a/tests/browser/model.mjs b/tests/browser/model.mjs
--- a/tests/browser/model.mjs
+++ b/tests/browser/model.mjs
@@ -42,5 +42,5 @@ check("등록 뒤 룬 감지: 룬 있음 + 나왔어요 음성", after.st === "
 // 3) 알림 테스트 버튼은 개별 알림
 await ev(() => __fake.reset());
-await page.click("#card-sol [data-a=test]"); await wait(2500);
+await page.click("#card-sol [data-a=toggle]"); await page.click("#card-sol [data-a=test]"); await wait(2500);
 check("알림 테스트: 솔 야누스 10초 전", JSON.stringify(await ev(() => __fake.spoken)) === JSON.stringify(["솔 야누스 10초 전"]));
 
diff --git a/tests/browser/targets-ui.mjs b/tests/browser/targets-ui.mjs
--- a/tests/browser/targets-ui.mjs
+++ b/tests/browser/targets-ui.mjs
@@ -93,3 +93,24 @@ check("삭제 확인: 내 소리가 없으면 뒷문장 생략", (await ev(() =>
 await page.click("#btnAdd"); await ev(() => [...document.querySelectorAll("#addMenu button")].find(b => b.textContent === "룬").click()); await wait(300);
 check("지운 내장 대상은 같은 id로 복원", (await ev(() => store.targets.some(t => t.id === "rune"))));
+
+// ---- F3: 접힌/펼친 카드, 펼침 상태 저장, 미리보기 점선 ----
+({ page, ev, wait } = await open(taskSpace, { connect: true }));
+const cs = await ev(() => Object.fromEntries(["sol", "booster", "rune"].map(i => { const c = document.querySelector("#card-" + i); return [i, { open: c.dataset.open, h: Math.round(c.getBoundingClientRect().height), body: c.querySelector(".body").offsetHeight, mini: c.querySelector("[data-s=mini]").textContent, status: c.querySelector("[data-s=status]").textContent }]; })));
+check("기본: 등록된 내장 대상은 접힘, 등록 필요한 룬은 펼침", cs.sol.open === "0" && cs.booster.open === "0" && cs.rune.open === "1", cs);
+check("접힌 카드: 한 줄(높이 70px 이하)이고 한 줄 상태가 상태 문구와 같음", cs.sol.h <= 70 && cs.sol.body === 0 && cs.sol.mini === cs.sol.status && cs.sol.mini === "아직 못 찾음", cs.sol);
+check("부제는 감지 대상 3개", (await ev(() => document.querySelector("#subtitle").textContent)) === "감지 대상 3개");
+// 미리보기: 점선 영역은 펼친 카드만(strokeRect 호출을 기록)
+await ev(() => { window.__r = []; const o = pctx.strokeRect.bind(pctx); pctx.strokeRect = (...a) => { __r.push(a.join()); o(...a); }; });
+await wait(1200);
+const collapsedRects = await ev(() => __r.slice());
+check("미리보기: 접힌 sol·booster의 점선 영역은 그리지 않음", !collapsedRects.includes("448,0,832,216") && !collapsedRects.includes("256,0,768,216"), collapsedRects.slice(0, 5));
+await page.click("#card-sol [data-a=toggle]"); await ev(() => { __r.length = 0; }); await wait(1200);
+const openRects = await ev(() => __r.slice());
+check("미리보기: 펼친 sol의 점선 영역은 그림", openRects.includes("448,0,832,216"), openRects.slice(0, 5));
+check("펼침 상태 저장(ui.open)", (await ev(() => JSON.parse(localStorage.getItem("maple-web-timer-ui")).open.sol)) === true);
+// 새로고침해도 유지, 사용자가 접은 룬은 등록 필요여도 자동으로 펼치지 않음
+await page.click("#card-rune [data-a=toggle]");
+await ev(() => location.reload()); await wait(2000);
+const rl = await ev(() => ({ sol: document.querySelector("#card-sol").dataset.open, rune: document.querySelector("#card-rune").dataset.open, booster: document.querySelector("#card-booster").dataset.open }));
+check("새로고침 뒤에도 사용자가 정한 펼침/접힘 유지", rl.sol === "1" && rl.rune === "0" && rl.booster === "0", rl);
 done();
```

- [ ] **Step 3: 실행**

```bash
runb tests/browser/targets-ui.mjs
runb tests/browser/model.mjs
runb tests/browser/regression.mjs
```

Expected: 대상 시나리오 `RESULT 26 passed, 0 failed` — 새로 더해진 7개: 기본은 내장 대상 접힘·룬(등록 필요) 펼침, 접힌 카드 높이 70px 이하이고 한 줄 상태가 상태 문구와 같음, 부제 `감지 대상 3개`, 접힌 `sol`·`booster`의 점선 영역(`448,0,832,216`·`256,0,768,216`)은 그리지 않고 펼친 `sol`은 그림, `ui.open` 저장, 새로고침 뒤에도 사용자가 정한 펼침/접힘 유지(접은 룬은 등록 필요여도 자동으로 펼치지 않음). 모델 11, 회귀 14 통과.

- [ ] **Step 4: 커밋**

```bash
git add css/app.css index.html js/register.js js/ui-cards.js tests/browser/model.mjs tests/browser/targets-ui.mjs
git commit -F - <<'EOF'
카드를 접힌 한 줄/펼친 카드로: 펼침 상태 저장, 미리보기 점선은 펼친 카드만

등록·다시 등록이 필요한 카드만 처음에 펼치고 사용자가 접은 것은 자동으로 펼치지 않는다.
접힌 카드는 썸네일·이름·상태·사용 체크만 보인다. 설명서에 대상 추가 안내를 더했다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 16: 상태줄 요약 · 차례로 다시 등록

켜진 대상이 5개 이하이면 지금처럼 모두 나열하고, 6개 이상이면 문제 있는 대상(등록하기·다시 등록·아직 못 찾음·꺼둠)만 개별로 보이고 정상은 `정상 N개`로 묶는다(누르면 이름 펼침, `ui.stripOpen`). 다시 등록이 3개 이상 필요하면 개별 버튼 대신 `다시 등록 N개 · 차례로 등록` 하나로 묶고, 누르면 첫 대상부터 등록하고 끝나면 다음으로 이어 간다(앞 단계에서 찍은 화면 재사용, `화면 다시 찍기`로 갱신, `Esc`로 중단).

**Files:**
- Modify: `js/targets.js`, `js/ui-watch.js`, `js/register.js`, `tests/targets.test.js`, `tests/browser/targets-ui.mjs`

- [ ] **Step 1: 실패하는 테스트를 더한다**

```diff
diff --git a/tests/targets.test.js b/tests/targets.test.js
--- a/tests/targets.test.js
+++ b/tests/targets.test.js
@@ -233,2 +233,37 @@ test('삭제 확인 문구와 대상이 가진 내 소리 키', () => {
   assert.deepEqual(plain(ownedSlotKeys(['u3.pre', 'u3.gone', 'u30.pre', 'sol.pre', 'sys.lost'], 'u3')), ['u3.pre', 'u3.gone']);
 });
+
+// ---- 상태줄 요약 (묶음 1 스펙 5.6) ----
+const { summarizeStrip } = L;
+const row = (id, s, o = {}) => ({ id, name: o.name || id, enabled: s !== 'off', stripState: s, ...o });
+const labels = items => plain(items).map(i => (i.type === 'text' ? i.text : i.label));
+
+test('summarizeStrip: 켜진 대상 5개 이하는 지금처럼 모두 나열(꺼둠·못 찾음 문구 포함)', () => {
+  const rows = [row('a', 'ok'), row('b', 'unseen'), row('c', 'off'), row('d', 'reg'), row('e', 'ok')];
+  assert.deepEqual(labels(summarizeStrip(rows, false)), ['a', 'b 아직 못 찾음', 'c 꺼둠', 'd 등록하기', 'e']);
+});
+
+test('summarizeStrip: 6개 이상이면 정상은 "정상 N개"로 묶고 문제 있는 것만 개별로', () => {
+  const rows = ['a', 'b', 'c', 'd', 'e'].map(id => row(id, 'ok')).concat([row('f', 'unseen'), row('g', 'reg'), row('h', 'off')]);   // 켜진 대상 7개
+  const items = plain(summarizeStrip(rows, false));
+  assert.deepEqual(labels(items), ['f 아직 못 찾음', 'g 등록하기', 'h 꺼둠', '정상 5개']);
+  assert.deepEqual(items[3], { type: 'okGroup', n: 5, open: false, label: '정상 5개' });
+});
+
+test('summarizeStrip: 정상 묶음을 펼치면 이름이 이어진다', () => {
+  const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => row(id, 'ok'));
+  assert.deepEqual(labels(summarizeStrip(rows, true)), ['정상 6개', 'a', 'b', 'c', 'd', 'e', 'f']);
+});
+
+test('summarizeStrip: 다시 등록이 3개 이상이면 개별 버튼 대신 "차례로 등록" 하나(5개 이하여도)', () => {
+  const rows = [row('a', 'rereg'), row('b', 'ok'), row('c', 'rereg'), row('d', 'rereg')];
+  const items = plain(summarizeStrip(rows, false));
+  assert.deepEqual(labels(items), ['다시 등록 3개 · 차례로 등록', 'b']);
+  assert.deepEqual(items[0].ids, ['a', 'c', 'd']);
+  assert.deepEqual(labels(summarizeStrip([row('a', 'rereg'), row('c', 'rereg')], false)), ['a 다시 등록', 'c 다시 등록']);   // 2개는 개별
+});
+
+test('summarizeStrip: 꺼둔 대상은 켜진 대상 수에 세지 않는다', () => {
+  const rows = ['a', 'b', 'c', 'd', 'e'].map(id => row(id, 'ok')).concat([row('f', 'off'), row('g', 'off')]);
+  assert.equal(labels(summarizeStrip(rows, false)).length, 7);                      // 켜진 것 5개 → 나열
+});
```

- [ ] **Step 2: 실패를 본다**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 71` `# fail 5`.

- [ ] **Step 3: `summarizeStrip` 구현**

```diff
diff --git a/js/targets.js b/js/targets.js
--- a/js/targets.js
+++ b/js/targets.js
@@ -143,4 +143,21 @@ function deleteConfirmText(name,soundCount){ return `"${name}" 대상을 지울
 function ownedSlotKeys(keys,id){ return keys.filter(k=>String(k).split('.')[0]===id); }
 
+/* ----- 상태줄 요약 (스펙 5.6). rows는 targetSnapshot의 행. 켜진 대상이 6개 이상이면 정상은 한 덩어리로 묶는다 ----- */
+// 돌려주는 항목: {type:'text',id,text,cls} | {type:'btn',id,label} | {type:'reregAll',ids,n,label} | {type:'okGroup',n,open,label}
+function summarizeStrip(rows,open){
+  const group=rows.filter(r=>r.enabled).length>=6;
+  const reIds=rows.filter(r=>r.stripState==='rereg').map(r=>r.id);
+  const items=[], oks=[]; let reDone=false;
+  for(const r of rows){
+    const s=r.stripState;
+    if(s==='rereg'&&reIds.length>=3){ if(!reDone){ reDone=true; items.push({type:'reregAll',ids:reIds,n:reIds.length,label:`다시 등록 ${reIds.length}개 · 차례로 등록`}); } continue; }
+    if(s==='reg'||s==='rereg'){ items.push({type:'btn',id:r.id,label:`${r.name} ${s==='reg'?'등록하기':'다시 등록'}`}); continue; }
+    if(s==='ok'&&group){ oks.push(r.name); continue; }
+    items.push({type:'text',id:r.id,cls:s==='ok'?'':s,text:s==='off'?`${r.name} 꺼둠`:s==='unseen'?`${r.name} 아직 못 찾음`:r.name});
+  }
+  if(oks.length){ items.push({type:'okGroup',n:oks.length,open:!!open,label:`정상 ${oks.length}개`}); if(open) for(const n of oks) items.push({type:'text',id:null,cls:'',text:n}); }
+  return items;
+}
+
 /* ----- 내 소리 슬롯 키 = 대상id.이벤트 (묶음 1 스펙 4.4·4.5) ----- */
 const MANUAL_SLOTS=[['manual.pre','미리 알림'],['manual.end','끝'],['manual.next1','구간 전환 1'],['manual.next2','구간 전환 2']];
@@ -175,3 +192,3 @@ function initTargets(){
   else if(r.saveFailed){ saveWarned=true; setNote('설정을 저장하지 못했어요 (이 탭에서만 유지)'); }
 }
-if(typeof module==='object') module.exports={renameTarget,moveTarget,insertTargetAt,deleteConfirmText,ownedSlotKeys,missingBuiltins,addBuiltin,addBuff,slotsOf,orphanSlots,BUILTIN,PRESETS,defaultStore,newTarget,builtinTarget,normalizeTarget,normalizeStore,makeId,migrateV1,loadStore,saveStore,checkName,targetSnapshot};
+if(typeof module==='object') module.exports={summarizeStrip,renameTarget,moveTarget,insertTargetAt,deleteConfirmText,ownedSlotKeys,missingBuiltins,addBuiltin,addBuff,slotsOf,orphanSlots,BUILTIN,PRESETS,defaultStore,newTarget,builtinTarget,normalizeTarget,normalizeStore,makeId,migrateV1,loadStore,saveStore,checkName,targetSnapshot};
```

- [ ] **Step 4: 상태줄과 차례로 등록**

`renderWatch`의 다시 그리기 키는 새 표시 규칙의 항목 전체로 만든다(스크린 리더가 매 틱 다시 읽지 않게 하는 기존 목적 유지).

```diff
diff --git a/js/register.js b/js/register.js
--- a/js/register.js
+++ b/js/register.js
@@ -1,5 +1,5 @@
 /* ----- 미리보기 & 드래그 등록 ----- */
 const pv=$('#preview'), pctx=pv.getContext('2d');
-let reg=null; // {t, steps, i, snap, rects:{area?,icon?}, drag, msg, fresh}  fresh: 방금 만든 대상의 첫 등록(취소하면 대상도 지운다)
+let reg=null; // {t, steps, i, snap, rects:{area?,icon?}, drag, msg, fresh, queue}  fresh: 방금 만든 대상의 첫 등록(취소하면 대상도 지운다), queue: 이어서 다시 등록할 대상 id
 function drawPreview(source){
   const s = reg ? reg.snap : source; if(!s) return;
@@ -41,7 +41,7 @@ async function startRegister(t,opts={}){
   if(!src){ setNote(`${t.name} 등록은 게임 화면을 연결하거나 스크린샷을 불러온 뒤에 할 수 있어요`); return; }
   setNote('');
-  const snap=await snapshot(); if(!snap) return;
+  const snap=opts.snap||await snapshot(); if(!snap) return;   // 차례로 등록할 때는 앞 단계에서 찍은 화면을 재사용
   if(reg) cancelRegister();   // 다른 대상을 등록 중이었으면 그만둔다(첫 등록이었으면 그 대상은 지워진다)
-  reg={t,steps:KINDS[t.kind].register.steps,i:0,snap,rects:{},drag:null,msg:'',fresh:!!opts.fresh}; updateBanner(); drawPreview(null);
+  reg={t,steps:KINDS[t.kind].register.steps,i:0,snap,rects:{},drag:null,msg:'',fresh:!!opts.fresh,queue:opts.queue||[]}; updateBanner(); drawPreview(null);
   $('#stage').scrollIntoView({behavior:'smooth',block:'center'});
 }
@@ -50,5 +50,5 @@ function updateBanner(){
   const b=$('#banner'); if(!reg){ b.classList.remove('on'); return; }
   b.classList.add('on');
-  $('#bannerText').textContent=(reg.msg?`⚠ ${reg.msg} · `:'')+`${reg.t.name} ${'①②③'[reg.i]} ${STEP_TEXT[reg.steps[reg.i]](labelsOf(reg.t))}`;
+  $('#bannerText').textContent=(reg.msg?`⚠ ${reg.msg} · `:'')+`${reg.t.name} ${'①②③'[reg.i]} ${STEP_TEXT[reg.steps[reg.i]](labelsOf(reg.t))}`+(reg.queue.length?` · 이어서 ${reg.queue.length}개 더`:'');
 }
 function cancelRegister(){
@@ -62,6 +62,10 @@ function finishRegister(){
   k.register.save(t,reg.rects,reg.snap); saveTargets();
   states[t.id]=newState(); states[t.id].armed=!!(src&&src.type==='image');
-  reg=null; updateBanner(); renderCard(t); renderWatch(); setNote(`${t.name} 등록했어요`,'info');
+  const queue=reg.queue, snap=reg.snap; reg=null; updateBanner(); renderCard(t); renderWatch(); setNote(`${t.name} 등록했어요`,'info');
+  const next=queue.map(targetById).find(Boolean);           // 해상도가 바뀐 뒤 여러 대상을 차례로 다시 등록
+  if(next) startRegister(next,{queue:queue.slice(queue.indexOf(next.id)+1),snap});
 }
+// 차례로 등록: 첫 대상부터 등록하고 끝나면 다음 대상으로 이어 간다. Esc·취소로 중단
+function startRegisterQueue(ids){ const first=ids.map(targetById).find(Boolean); if(first) return startRegister(first,{queue:ids.slice(ids.indexOf(first.id)+1)}); }
 function toImg(e){ const r=pv.getBoundingClientRect(); return {x:(e.clientX-r.left)*pv.width/r.width, y:(e.clientY-r.top)*pv.height/r.height}; }
 function initRegister(){
diff --git a/js/ui-watch.js b/js/ui-watch.js
--- a/js/ui-watch.js
+++ b/js/ui-watch.js
@@ -17,14 +17,18 @@ const snapshotNow=()=>targetSnapshot(store.targets,states,{src:!!src,frame},Date
 function renderWatch(){
   const w=watchStatus();
-  const rows=src?snapshotNow():[];
-  const key=w.cls+'|'+w.state+'|'+rows.map(r=>r.id+':'+r.name+':'+r.stripState).join(',')+'|'+(src&&src.type);
+  const items=src?summarizeStrip(snapshotNow(),ui.stripOpen):[];     // 연결 안 됨 상태에서는 대상 목록을 보이지 않는다
+  const key=w.cls+'|'+w.state+'|'+JSON.stringify(items)+'|'+(src&&src.type);
   if(key!==watchKey){   // 바뀔 때만 다시 그려서 화면 낭독기가 매 틱 읽지 않게 함
     watchKey=key; $('#watch').className='watch '+w.cls; $('#watchState').textContent=w.state;
     const box=$('#watchTargets'); box.textContent='';
-    rows.forEach((r,i)=>{
+    items.forEach((it,i)=>{
       if(i){ const sep=document.createElement('span'); sep.className='sep'; sep.setAttribute('aria-hidden','true'); sep.textContent='·'; box.append(sep); }
-      // 연결 뒤 다음에 할 일(등록)이 주된 버튼이 되도록 primary로 강조
-      if(r.stripState==='reg'||r.stripState==='rereg'){ const b=document.createElement('button'); b.className='primary'; b.textContent=`${r.name} ${r.stripState==='reg'?'등록하기':'다시 등록'}`; b.onclick=()=>startRegister(targetById(r.id)); box.append(b); }
-      else { const sp=document.createElement('span'); if(r.stripState!=='ok') sp.className=r.stripState; sp.textContent=r.stripState==='off'?`${r.name} 꺼둠`:r.stripState==='unseen'?`${r.name} 아직 못 찾음`:r.name; box.append(sp); }
+      if(it.type==='btn'||it.type==='reregAll'){   // 연결 뒤 다음에 할 일(등록)이 주된 버튼이 되도록 primary로 강조
+        const b=document.createElement('button'); b.className='primary'; b.textContent=it.label;
+        b.onclick=it.type==='btn'?()=>startRegister(targetById(it.id)):()=>startRegisterQueue(it.ids); box.append(b); }
+      else if(it.type==='okGroup'){
+        const b=document.createElement('button'); b.textContent=it.label; b.setAttribute('aria-expanded',it.open?'true':'false');
+        b.onclick=()=>{ ui.stripOpen=!ui.stripOpen; saveUi(); renderWatch(); }; box.append(b); }
+      else { const sp=document.createElement('span'); if(it.cls) sp.className=it.cls; sp.textContent=it.text; box.append(sp); }
     });
     const stop=$('#btnStop'); stop.hidden=!src; stop.textContent=src&&src.type==='image'?'테스트 끝내기':'감시 끝내기';
```

- [ ] **Step 5: 시나리오를 더한다**

같은 이름으로 등록한 버프 4개를 1280×720로 저장해 두고 화면을 1920×1080으로 연결한다.

```diff
diff --git a/tests/browser/targets-ui.mjs b/tests/browser/targets-ui.mjs
--- a/tests/browser/targets-ui.mjs
+++ b/tests/browser/targets-ui.mjs
@@ -114,3 +114,27 @@ await ev(() => location.reload()); await wait(2000);
 const rl = await ev(() => ({ sol: document.querySelector("#card-sol").dataset.open, rune: document.querySelector("#card-rune").dataset.open, booster: document.querySelector("#card-booster").dataset.open }));
 check("새로고침 뒤에도 사용자가 정한 펼침/접힘 유지", rl.sol === "1" && rl.rune === "0" && rl.booster === "0", rl);
+
+// ---- F4: 상태줄 요약, 해상도가 바뀐 뒤 차례로 다시 등록 ----
+const tgt = (id, name) => ({ id, kind: "buff", name, preset: null, enabled: true, threshold: 0.75, area: { x: 0, y: 0, w: 100, h: 50 }, tpl: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", w: 1, h: 1 }, frameW: 1280, frameH: 720, p: { durationSec: null, leadSec: 10 } });
+const V4 = { ver: 2, seq: 4, group: { on: false, windowSec: 10 }, targets: [
+  { id: "sol", kind: "buff", name: "솔 야누스", preset: "sol", enabled: true, threshold: 0.75, area: null, tpl: null, frameW: 0, frameH: 0, p: { durationSec: null, leadSec: 10 } },
+  { id: "booster", kind: "countdown", name: "부스터", preset: "booster", enabled: true, threshold: 0.7, area: null, tpl: null, frameW: 0, frameH: 0, p: { leadSec: 10 } },
+  tgt("u1", "버프A"), tgt("u2", "버프B"), tgt("u3", "버프C"), tgt("u4", "버프D") ] };
+({ page, ev, wait } = await open(taskSpace, { seed: { "maple-web-timer-v2": V4 } }));
+await ev(() => { __fake.resize(1920, 1080); [["u1", 300, 11], ["u2", 500, 12], ["u3", 700, 13], ["u4", 900, 14]].forEach(([n, x, seed]) => __fake.pattern(n, x, 150, seed, 32)); });
+await wait(1200);
+await page.click("#btnConnect"); await wait(2500);
+const st1 = await ev(() => ({ strip: document.querySelector("#watchTargets").innerText.replace(/\n/g, " "), btns: [...document.querySelectorAll("#watchTargets button")].map(b => b.textContent) }));
+check("해상도 변경: 다시 등록 4개는 '차례로 등록' 버튼 하나", st1.btns.includes("다시 등록 4개 · 차례로 등록") && !st1.btns.some(t => t.endsWith("다시 등록")), st1);
+await page.click("#watchTargets >> text=차례로 등록").catch(async () => { await ev(() => [...document.querySelectorAll("#watchTargets button")].find(b => b.textContent.includes("차례로 등록")).click()); });
+await wait(800);
+check("차례로 등록: 첫 대상 배너와 남은 개수", (await ev(() => document.querySelector("#bannerText").textContent)) === "버프A ① 버프창 영역을 넉넉하게 드래그하세요 · 이어서 3개 더");
+for (const x of [300, 500, 700, 900]) { await drag(page, 100, 100, 1800, 300); await drag(page, x - 2, 148, x + 34, 184); await wait(500); }
+await wait(3000);
+const st2 = await ev(() => ({ banner: document.querySelector("#banner").classList.contains("on"), frames: store.targets.slice(2).map(t => t.frameW + "x" + t.frameH).join(), btns: [...document.querySelectorAll("#watchTargets button")].map(b => b.textContent), strip: document.querySelector("#watchTargets").innerText.replace(/\n/g, " ") }));
+check("차례로 등록: 4개 모두 1920x1080으로 저장되고 배너가 닫힘", !st2.banner && st2.frames === "1920x1080,1920x1080,1920x1080,1920x1080" && !st2.btns.some(t => t.includes("등록")), st2);
+check("상태줄: 켜진 대상 6개 → 정상 4개로 묶고 못 찾은 내장 2개는 개별 표시", st2.btns.includes("정상 4개") && st2.strip.includes("솔 야누스 아직 못 찾음") && st2.strip.includes("부스터 아직 못 찾음") && !st2.strip.includes("버프A"), st2);
+await page.click("#watchTargets >> text=정상 4개").catch(async () => { await ev(() => [...document.querySelectorAll("#watchTargets button")].find(b => b.textContent === "정상 4개").click()); });
+const st3 = await ev(() => ({ strip: document.querySelector("#watchTargets").innerText.replace(/\n/g, " "), saved: JSON.parse(localStorage.getItem("maple-web-timer-ui")).stripOpen }));
+check("정상 묶음을 누르면 이름이 펼쳐지고 상태가 저장됨", st3.strip.includes("버프A") && st3.strip.includes("버프D") && st3.saved === true, st3);
 done();
```

- [ ] **Step 6: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
runb tests/browser/targets-ui.mjs
```

Expected: `# pass 76` `# fail 0`. 시나리오 `RESULT 31 passed, 0 failed` — 새로 더해진 5개: 다시 등록 4개가 `다시 등록 4개 · 차례로 등록` 버튼 하나로 묶임, 누르면 배너 `버프A ① 버프창 영역을 넉넉하게 드래그하세요 · 이어서 3개 더`, 네 대상을 이어서 등록하면 모두 `1920x1080`으로 저장되고 배너가 닫힘, 켜진 대상 6개라 `정상 4개`로 묶이고 못 찾은 내장 2개는 개별 표시, `정상 4개`를 누르면 이름이 펼쳐지고 `ui.stripOpen`이 저장됨.

- [ ] **Step 7: 커밋**

```bash
git add js/register.js js/targets.js js/ui-watch.js tests/browser/targets-ui.mjs tests/targets.test.js
git commit -F - <<'EOF'
상태줄 요약(6개부터 정상 묶음)과 해상도 변경 뒤 차례로 다시 등록

summarizeStrip: 켜진 대상 5개 이하는 나열, 6개 이상은 문제 있는 것만 개별로 보이고
정상은 "정상 N개"(누르면 이름 펼침). 다시 등록 3개 이상은 "차례로 등록" 하나로 묶고
앞 단계에서 찍은 화면을 재사용해 이어서 등록한다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Phase G. 가까운 알림 묶기 (기본 꺼짐)

### Task 17: `planGroup` · `groupText`

어떤 대상을 묶을지 계산하는 순수 함수다(스펙 6.2·6.3, 16-11). `fired`는 이번 틱에 미리 알림(`group:'pre'`)이 난 대상 id다. 곧 끝나는 다른 대상(`remainSec <= leadSec + windowSec`)을 같이 묶고(당겨 알림), 룬처럼 `pre` 묶음 이벤트가 없는 종류·꺼진 대상·이미 미리 알린 대상·켜진 시점이나 지속시간을 모르는 대상은 당기지 않는다. 상태는 바꾸지 않는다(당겨온 대상의 `markPre`는 Task 19에서 부르는 쪽이 한다).

**Files:**
- Create: `tests/group.test.js`
- Modify: `js/alerts.js`

- [ ] **Step 1: 테스트를 만든다**

같은 틱 둘, 8초 차이(당겨짐), 11초 차이(안 당겨짐), `windowSec` 5·20초, 켜진 시점 모름·지속시간 없음·이미 `alertedPre`·꺼진 대상, 룬 제외·부스터 포함, 문구 1·2·3·4개와 정렬.

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.js');
const { planGroup, groupText } = require('../js/alerts.js');

const L = load(['js/util.js', 'js/detect-core.js', 'js/targets.js', 'js/kinds.js'], { PRESET_ICONS: { sol: [], booster: [] } });
const KINDS = L.get('KINDS'), newState = L.newState, plain = L.plain;
const NOW = 1_000_000;
const buff = (id, over = {}) => ({ id, kind: 'buff', name: id, enabled: true, p: { durationSec: 600, leadSec: 10 }, ...over });
// 켜진 지 elapsed초 지난 버프 상태(지속시간 600초 → 남은 시간 600-elapsed)
const on = (remain, over = {}) => Object.assign(newState(), { present: true, appearedAt: NOW - (600 - remain) * 1000 }, over);
const ids = r => plain(r.members.map(m => m.id));

test('planGroup: 미리 알림이 하나도 없으면 묶을 것이 없다', () => {
  const r = planGroup([], [buff('a')], { a: on(5) }, KINDS, NOW, 10);
  assert.deepEqual(plain(r), { members: [], pulled: [] });
});

test('planGroup: 같은 틱에 둘이 미리 알림이면 둘 다 멤버(당겨온 것 없음)', () => {
  const r = planGroup(['a', 'b'], [buff('a'), buff('b')], { a: on(10, { alertedPre: true }), b: on(10, { alertedPre: true }) }, KINDS, NOW, 10);
  assert.deepEqual([ids(r), plain(r.pulled)], [['a', 'b'], []]);
});

test('planGroup: 남은 시간이 leadSec+windowSec 이하인 다른 버프를 당겨온다(8초 차이=당김, 11초 차이=안 당김)', () => {
  const ts = [buff('a'), buff('b'), buff('c')];
  const st = { a: on(10, { alertedPre: true }), b: on(18), c: on(21) };           // 한계는 10+10=20
  const r = planGroup(['a'], ts, st, KINDS, NOW, 10);
  assert.deepEqual(ids(r), ['a', 'b']); assert.deepEqual(plain(r.pulled), [{ id: 'b', rank: 18 }]);
});

test('planGroup: windowSec에 따라 한계가 달라진다(5초·20초)', () => {
  const ts = [buff('a'), buff('b')], st = { a: on(10, { alertedPre: true }), b: on(14) };
  assert.deepEqual(ids(planGroup(['a'], ts, st, KINDS, NOW, 5)), ['a', 'b']);                 // 한계 15
  assert.deepEqual(ids(planGroup(['a'], ts, { ...st, b: on(16) }, KINDS, NOW, 5)), ['a']);
  assert.deepEqual(ids(planGroup(['a'], ts, { ...st, b: on(29) }, KINDS, NOW, 20)), ['a', 'b']);   // 한계 30
});

test('planGroup: 켜진 시점을 모르거나, 지속시간이 없거나, 이미 미리 알림을 했거나, 꺼진/비활성 대상은 당기지 않는다', () => {
  const ts = [buff('a'), buff('b'), buff('c'), buff('d', { p: { durationSec: null, leadSec: 10 } }), buff('e', { enabled: false }), buff('f')];
  const st = { a: on(10, { alertedPre: true }), b: on(15, { appearedAt: null }), c: on(15, { alertedPre: true }), d: on(15), e: on(15), f: on(15, { present: false }) };
  assert.deepEqual(ids(planGroup(['a'], ts, st, KINDS, NOW, 10)), ['a']);
});

test('planGroup: 룬은 당기지 않는다, 부스터는 읽은 남은 시간으로 당긴다', () => {
  const rune = { id: 'r', kind: 'rune', name: '룬', enabled: true, p: { repeatSec: 60 } };
  const cd = { id: 'cd', kind: 'countdown', name: '부스터', enabled: true, p: { leadSec: 10 } };
  const st = { a: on(10, { alertedPre: true }), r: Object.assign(newState(), { present: true }), cd: Object.assign(newState(), { present: true, remain: 25, remainAt: NOW - 8000 }) };   // 지금 17초
  const r = planGroup(['a'], [buff('a'), rune, cd], st, KINDS, NOW, 10);
  assert.deepEqual(ids(r), ['a', 'cd']); assert.equal(r.pulled[0].rank, 17);
});

test('groupText: 1·2·3개는 이름 나열, 4개부터는 개수. 남은 시간이 짧은 순(같으면 목록 순서)', () => {
  const it = (label, rank, order) => ({ label, rank, order });
  assert.equal(groupText('pre', [it('A', 10, 0)]), 'A 곧 끝나요');
  assert.equal(groupText('pre', [it('A', 10, 0), it('B', 4, 1)]), 'B, A 곧 끝나요');
  assert.equal(groupText('pre', [it('A', 10, 2), it('B', 10, 1), it('C', 12, 0)]), 'B, A, C 곧 끝나요');
  assert.equal(groupText('pre', [it('A', 1, 0), it('B', 2, 1), it('C', 3, 2), it('D', 4, 3)]), '4개 곧 끝나요');
  assert.equal(groupText('gone', [it('A', 0, 0), it('B', 0, 1)]), 'A, B 꺼졌어요');
  assert.equal(groupText('gone', [it('A', 0, 0), it('B', 0, 1), it('C', 0, 2), it('D', 0, 3), it('E', 0, 4)]), '5개 꺼졌어요');
});
```

- [ ] **Step 2: 실패를 본다**

```bash
node --test tests/group.test.js 2>&1 | grep -E "TypeError|^# (pass|fail)" | sort | uniq -c
```

Expected: `TypeError: planGroup is not a function`(또는 `groupText`)이 7번, `# fail 7`.

- [ ] **Step 3: 구현**

`js/alerts.js`의 `/* ----- Alerts: 요청(AlertReq)…` 주석 줄 바로 위에 다음을 붙인다.

```js
/* ----- 가까운 알림 묶기 계획 (순수) ----- */
// fired: 이번 틱에 미리 알림(group:'pre')이 난 대상 id. 곧 끝나는 다른 대상(남은 시간 <= leadSec+windowSec)을 같이 묶는다(당겨 알림).
// 돌려주는 값: members(묶일 대상 전부)와 pulled(그중 당겨온 것). 상태는 바꾸지 않는다 — 당겨온 대상의 pre 처리(markPre)는 부르는 쪽이 한다
function planGroup(fired,targets,states,kinds,now,windowSec){
  if(!fired.length) return {members:[],pulled:[]};
  const members=[], pulled=[];
  targets.forEach((t,order)=>{
    const k=kinds[t.kind]; if(!k||!t.enabled) return;
    if(fired.includes(t.id)){ members.push({id:t.id,rank:t.p.leadSec||0,pulled:false,order}); return; }
    if(!k.events.some(e=>e.group==='pre')) return;                    // 룬 같은 종류는 묶지 않는다
    const st=states[t.id]; if(!st||st.alertedPre) return;
    const r=k.remainSec(t,st,now); if(r==null) return;                // 켜진 시점·지속시간을 모르면 null
    if(r<=(t.p.leadSec||0)+windowSec){ members.push({id:t.id,rank:r,pulled:true,order}); pulled.push({id:t.id,rank:r}); }
  });
  return {members,pulled};
}
// 묶인 알림의 음성·토스트 문구. 이름 뒤 조사를 쓰지 않고 초는 말하지 않는다(멤버마다 남은 시간이 달라 한 숫자가 틀림)
function groupText(cls,items){
  const sorted=[...items].sort((a,b)=>a.rank-b.rank||a.order-b.order), tail=cls==='pre'?'곧 끝나요':'꺼졌어요';
  return sorted.length>=4?`${sorted.length}개 ${tail}`:`${sorted.map(i=>i.label).join(', ')} ${tail}`;
}
```

파일 맨 끝의 내보내기 줄을 바꾼다.

```js
if(typeof module==='object') module.exports={createAlerts,planGroup,groupText};
```

- [ ] **Step 4: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 83` `# fail 0`.

- [ ] **Step 5: 커밋**

```bash
git add js/alerts.js tests/group.test.js
git commit -F - <<'EOF'
묶기 계획 planGroup·groupText (순수)

미리 알림이 난 틱에 곧 끝나는 다른 버프·부스터를 당겨 묶는다(남은 시간 <= leadSec+windowSec).
룬·꺼진 대상·이미 알린 대상·켜진 시점을 모르는 대상은 당기지 않는다. 문구는
"A, B 곧 끝나요"(남은 시간이 짧은 순), 4개부터 "4개 곧 끝나요".

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 18: `Alerts` 묶기 대기열 (`flush`/`configure`)

`createAlerts`에 대기열을 더한다(스펙 6.4·7.2). 묶기가 꺼져 있으면(기본) `group`이 있어도 즉시 개별 전달이다. 켜면 `pre`는 같은 틱 안에서 `flush`가 곧바로 한 번에 내보내고, `gone`은 첫 건이 들어온 지 2초 뒤에 묶는다. 묶인 알림(멤버 2개 이상)은 `grp.pre`/`grp.gone` 내 소리 하나 또는 `multi` 비프 + 합친 음성이고, 멤버 개별 소리는 쓰지 않는다. 묶을 것이 하나뿐이면 개별 알림과 똑같다. 기다리는 데 `setTimeout`을 쓰지 않는 이유는 숨은 탭의 타이머 지연이다(Worker가 부르는 `tick`의 `flush`만 시간을 판단).

**Files:**
- Modify: `js/alerts.js`, `tests/alerts.test.js`

- [ ] **Step 1: 실패하는 테스트를 더한다**

```diff
diff --git a/tests/alerts.test.js b/tests/alerts.test.js
--- a/tests/alerts.test.js
+++ b/tests/alerts.test.js
@@ -39,2 +39,62 @@ test('flush: 묶기 대기열이 없으면 아무 일도 하지 않는다(호출
   const { A, log } = setup(); A.flush(5000); assert.deepEqual(log, []);
 });
+
+// ---- 묶기(묶음 1 스펙 6절): 대기열·flush·configure ----
+function setupGroup() {
+  const log = []; let now = 1000;
+  const io = { now: () => now, play: r => { log.push(['play', r.id, r.event, r.slot, r.beep, r.text]); return false; },
+    ui: (text, tag) => log.push(['ui', text, tag]), flash: ids => log.push(['flash', ids]) };
+  const A = createAlerts(io);
+  const pre = (id, rank, order = 0) => ({ src: 'target', id, event: 'pre', text: id + ' 10초 전', beep: 'buff', group: { cls: 'pre', label: id, rank, order } });
+  const gone = (id, order = 0) => ({ src: 'target', id, event: 'gone', text: id + ' 꺼졌어요', beep: 'gone', group: { cls: 'gone', label: id, rank: 0, order } });
+  return { A, log, pre, gone, setNow: n => { now = n; } };
+}
+
+test('묶기가 꺼져 있으면(기본) group이 있어도 즉시 개별 전달', () => {
+  const { A, log, pre } = setupGroup();
+  A.fire(pre('a', 10)); A.fire(pre('b', 5));
+  assert.deepEqual(log.filter(l => l[0] === 'play').map(l => l[1]), ['a', 'b']);
+});
+
+test('묶기를 켜면 pre는 flush에서 한 번에: 묶음 슬롯·multi 소리·합친 문구·알림 tag·멤버 카드 깜빡임', () => {
+  const { A, log, pre } = setupGroup(); const recs = []; A.listen(r => recs.push(r));
+  A.configure({ on: true, windowSec: 10 });
+  A.fire(pre('a', 10, 0)); A.fire(pre('b', 4, 1));
+  assert.deepEqual(log, []);                                              // 틱이 끝나기 전에는 아무것도 울리지 않는다
+  A.flush(1000);
+  assert.deepEqual(log, [['play', 'grp', 'pre', 'grp.pre', 'multi', 'b, a 곧 끝나요'], ['ui', 'b, a 곧 끝나요', 'grp.pre'], ['flash', ['card-a', 'card-b']]]);
+  assert.deepEqual(recs, [{ at: 1000, src: 'target', ids: ['a', 'b'], event: 'pre', text: 'b, a 곧 끝나요', grouped: true, custom: false }]);
+  A.flush(1000); assert.equal(log.length, 3);                             // 비운 뒤에는 다시 울리지 않는다
+});
+
+test('묶을 것이 하나뿐이면 개별 알림과 똑같다', () => {
+  const { A, log, pre } = setupGroup(); A.configure({ on: true });
+  A.fire(pre('a', 10)); A.flush(1000);
+  assert.deepEqual(log[0], ['play', 'a', 'pre', 'a.pre', 'buff', 'a 10초 전']);
+});
+
+test('gone은 첫 건이 들어온 지 2초 뒤에 묶는다(그 안에 오는 것은 합류), pre와 섞지 않는다', () => {
+  const { A, log, pre, gone, setNow } = setupGroup(); A.configure({ on: true });
+  setNow(1000); A.fire(gone('a', 0)); A.flush(1000); A.flush(2999);
+  setNow(2500); A.fire(gone('b', 1)); A.fire(pre('c', 3, 2)); A.flush(2500);   // pre는 곧바로 개별(멤버 1개), gone은 대기
+  assert.deepEqual(log.filter(l => l[0] === 'play').map(l => l[1]), ['c']);
+  A.flush(3000);
+  assert.deepEqual(log.filter(l => l[0] === 'play').pop(), ['play', 'grp', 'gone', 'grp.gone', 'multi', 'a, b 꺼졌어요']);
+});
+
+test('test·system 요청과 group이 없는 요청은 묶지 않고 즉시 전달', () => {
+  const { A, log, pre } = setupGroup(); A.configure({ on: true });
+  A.fire({ ...pre('a', 10), src: 'test' });
+  A.fire({ src: 'system', id: 'sys', event: 'lost', text: 'x', beep: 'system', slot: 'sys.lost', flash: null });
+  A.fire({ src: 'target', id: 'r', event: 'appear', text: '룬이 나왔어요', beep: 'rune' });
+  assert.deepEqual(log.filter(l => l[0] === 'play').map(l => l[1]), ['a', 'sys', 'r']);
+});
+
+test('drop은 대기 중인 대상만 뺀다, clear는 대기열을 비운다, 묶기를 끄면 대기 중인 것을 개별로 내보낸다', () => {
+  const { A, log, pre, gone } = setupGroup(); A.configure({ on: true });
+  A.fire(pre('a', 10)); A.fire(pre('b', 5)); A.drop('a'); A.flush(1000);
+  assert.deepEqual(log.filter(l => l[0] === 'play').map(l => l[1]), ['b']);
+  log.length = 0; A.fire(gone('x')); A.clear(); A.flush(9999); assert.deepEqual(log, []);
+  A.fire(gone('x')); A.fire(gone('y')); A.configure({ on: false });
+  assert.deepEqual(log.filter(l => l[0] === 'play').map(l => l[1]), ['x', 'y']);
+});
```

- [ ] **Step 2: 실패를 본다**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 84` `# fail 5`.

- [ ] **Step 3: `createAlerts` 전체를 다음으로 교체한다**

`js/alerts.js`에서 `function createAlerts(io){`부터 그 아래 `const browserIO={` 바로 위까지를 교체한다.

```js
function createAlerts(io){
  const listeners=new Set(), queue={pre:[],gone:[]}; let cfg={on:false,windowSec:10}, goneSince=0;
  const withDefaults=r=>Object.assign({},r,{
    slot:r.slot===undefined?`${r.id}.${r.event}`:r.slot, flash:r.flash===undefined?`card-${r.id}`:r.flash,
    mode:r.mode||'full', beep:r.beep===undefined?null:r.beep, group:r.group||null });
  const notifyListeners=rec=>{ for(const fn of [...listeners]){ try{ fn(rec); }catch(e){ console.error(e); } } };
  function deliver(req){
    const custom=io.play(req);
    if(req.mode!=='voice'){ io.ui(req.text,req.id); if(req.flash) io.flash([req.flash]); }
    notifyListeners({at:io.now(),src:req.src,ids:[req.id],event:req.event,text:req.text,grouped:false,custom});
  }
  // 묶인 알림 하나: 묶음 슬롯(grp.pre/grp.gone)의 내 소리 또는 multi 비프 + 합친 음성. 멤버 개별 소리는 쓰지 않는다
  function deliverGroup(cls,items){
    const text=groupText(cls,items.map(r=>({label:r.group.label,rank:r.group.rank,order:r.group.order||0})));
    const custom=io.play({src:'target',id:'grp',event:cls,text,beep:'multi',slot:'grp.'+cls,mode:'full',flash:null,group:null});
    io.ui(text,'grp.'+cls); io.flash(items.map(r=>r.flash).filter(Boolean));
    notifyListeners({at:io.now(),src:'target',ids:items.map(r=>r.id),event:cls,text,grouped:true,custom});
  }
  function emit(cls){
    const items=queue[cls].splice(0);
    if(items.length===1) deliver(items[0]); else if(items.length>1) deliverGroup(cls,items);
  }
  return {
    fire(r){
      const req=withDefaults(r), q=req.group&&queue[req.group.cls];
      if(!q||!cfg.on||req.src==='test'||req.src==='system'){ deliver(req); return; }
      if(req.group.cls==='gone'&&!q.length) goneSince=io.now();
      q.push(req);
    },
    // tick() 끝에서만 부른다(setTimeout을 쓰지 않는 이유: 숨은 탭의 타이머 지연). pre는 바로, gone은 첫 건 뒤 2초
    flush(now){ if(queue.pre.length) emit('pre'); if(queue.gone.length&&now-goneSince>=2000) emit('gone'); },
    configure(c){ cfg={...cfg,...c}; if(!cfg.on) for(const q of Object.values(queue)) for(const r of q.splice(0)) deliver(r); },   // 끄면 대기 중인 것은 개별로
    drop(id){ for(const q of Object.values(queue)){ for(let i=q.length-1;i>=0;i--) if(q[i].id===id) q.splice(i,1); } },
    clear(){ queue.pre.length=0; queue.gone.length=0; },                    // 연결이 끊기거나 감시를 끝내면 대기 중인 알림은 버린다
    listen(fn){ listeners.add(fn); return ()=>listeners.delete(fn); },
  };
}
```

`SOUNDS`에 묶인 알림용 소리를 더한다(`rune` 줄과 `system` 줄 사이).

```js
  multi:  {wave:'square',  notes:[[1046,.1],[1046,.1],[1046,.1],[1568,.28]]},    // 같은 음 세 번 + 높은 음(묶인 알림)
```

- [ ] **Step 4: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 89` `# fail 0`.

- [ ] **Step 5: 커밋**

```bash
git add js/alerts.js tests/alerts.test.js
git commit -F - <<'EOF'
Alerts 묶기 대기열: flush·configure·drop·clear

묶기가 꺼져 있으면 즉시 개별 전달. 켜면 pre는 같은 틱 flush에서, gone은 첫 건 뒤 2초에
한 번에 내보낸다. 묶인 알림은 grp.* 내 소리 또는 multi 비프+합친 음성, 토스트 한 줄,
알림 tag grp.pre, 멤버 카드 깜빡임. test·system 요청과 group 없는 요청은 묶지 않는다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 19: 묶기 연결 — 당겨 알림 · 설정 라디오 · 묶음 슬롯 미리듣기

`dispatchEvents`가 묶기가 켜져 있으면 `planGroup`으로 당겨올 대상을 정해 그 대상의 `KINDS[kind].markPre`를 부르고(자체 `pre`·`gone`이 다시 울리지 않게, 부스터는 Task 7의 `preMarkRemain`도 함께) 묶음 요청으로 보낸다. 소리 설정 패널 맨 위에 `가까운 알림 묶기 [끔 | 5초 | 10초 | 20초]`를 두고(기본 끔) 바꾸는 즉시 저장하고 `Alerts.configure`를 부른다. 묶음 슬롯 `듣기`는 켜진 버프 앞 두 개의 실제 이름으로 합친 문구를 재생한다. 연결이 끊기거나 감시를 끝내면 대기열을 비운다.

**Files:**
- Modify: `js/detect-run.js`, `js/capture.js`, `js/sounds.js`, `index.html`, `css/app.css`, `tests/browser/fake-screen.js`, `tests/browser/prelude.mjs`
- Create: `tests/browser/group.mjs`

- [ ] **Step 1: 코드**

```diff
diff --git a/css/app.css b/css/app.css
--- a/css/app.css
+++ b/css/app.css
@@ -102,2 +102,5 @@ summary{cursor:pointer}
 .card[data-open="0"]{padding:8px 12px}
 .card[data-open="0"] .top{margin-bottom:0}
+#groupCtl{border:1px solid var(--line);border-radius:8px;margin:10px 0 0;padding:6px 12px 8px;display:flex;flex-wrap:wrap;gap:4px 16px;align-items:center}
+#groupCtl legend{padding:0 4px}
+#groupCtl p{flex:1 0 100%;margin:4px 0 0}
diff --git a/index.html b/index.html
--- a/index.html
+++ b/index.html
@@ -63,4 +63,11 @@
       <summary><b>알림 소리 바꾸기</b> <span class="sub">내 WAV 파일 쓰기</span></summary>
       <p class="sub">파일을 고르면 그 알림은 기본 경고음과 음성 대신 고른 소리로 울려요. 10초 이하, 5MB 이하 소리만 쓸 수 있고, 파일은 이 브라우저에만 저장돼요.</p>
+      <fieldset id="groupCtl"><legend><b>가까운 알림 묶기</b></legend>
+        <label class="sw"><input type="radio" name="grp" value="0" checked> 끔</label>
+        <label class="sw"><input type="radio" name="grp" value="5"> 5초</label>
+        <label class="sw"><input type="radio" name="grp" value="10"> 10초</label>
+        <label class="sw"><input type="radio" name="grp" value="20"> 20초</label>
+        <p class="sub">켜면 한 버프의 미리 알림이 울릴 때, 곧(선택한 시간 안에) 끝나는 다른 버프도 같이 한 번에 알려요. 묶인 알림에서는 각 버프의 내 소리 대신 아래 “묶음 알림” 소리를 써요.</p>
+      </fieldset>
       <div id="soundRows"></div>
       <p id="soundNote" class="sub" role="status"></p>
diff --git a/js/capture.js b/js/capture.js
--- a/js/capture.js
+++ b/js/capture.js
@@ -31,4 +31,5 @@ function dims(s){ return s instanceof HTMLVideoElement ? [s.videoWidth,s.videoHe
 
 function teardown(emptyText){
+  Alerts.clear();   // 묶음 대기 중이던 알림은 연결 알림이 우선이라 버린다
   src=null; pctx.clearRect(0,0,pv.width,pv.height);   // 멈춘 마지막 화면 대신 빈 화면 위에 안내문을 보여줌
   $('#empty').textContent=emptyText; $('#empty').style.display=''; $('#btnConnect').textContent='게임 화면 연결'; $('#btnConnect').classList.add('primary');
diff --git a/js/detect-run.js b/js/detect-run.js
--- a/js/detect-run.js
+++ b/js/detect-run.js
@@ -70,5 +70,17 @@ function reqFor(t,def,info,rank){
     group:def.group?{cls:def.group,label:t.name,rank:rank==null?(t.p.leadSec||0):rank,order:store.targets.indexOf(t)}:null};
 }
-function dispatchEvents(list,now){ for(const x of list) Alerts.fire(reqFor(x.t,x.def,x.info)); }
+// 이번 틱의 이벤트를 알림으로 보낸다. 묶기가 켜져 있으면 미리 알림이 난 틱에 곧 끝나는 다른 대상을 같이 묶는다(당겨 알림)
+function dispatchEvents(list,now){
+  const reqs=list.map(x=>reqFor(x.t,x.def,x.info));
+  if(store.group.on){
+    const fired=list.filter(x=>x.def.group==='pre').map(x=>x.t.id);
+    for(const p of planGroup(fired,store.targets,states,KINDS,now,store.group.windowSec).pulled){
+      const t=targetById(p.id), k=KINDS[t.kind];
+      k.markPre(stateOf(t.id),now);                     // 당겨 알린 주기는 자체 pre·꺼짐 알림을 다시 울리지 않는다
+      reqs.push(reqFor(t,k.events.find(e=>e.group==='pre'),{},p.rank));
+    }
+  }
+  for(const r of reqs) Alerts.fire(r);
+}
 // 카드의 "알림 테스트": 묶지 않고 첫 이벤트를 개별 알림으로 재생
 function testAlert(t){ const def=KINDS[t.kind].events[0]; Alerts.fire({...reqFor(t,def,{}),src:'test',group:null}); }
diff --git a/js/sounds.js b/js/sounds.js
--- a/js/sounds.js
+++ b/js/sounds.js
@@ -28,4 +28,5 @@ function previewSlot(s){
   const [id,ev]=s.key.split('.');
   if(id==='sys'){ playDefault(SYS_MSG[ev],'system'); return; }
+  if(id==='grp'){ playDefault(groupText(ev,groupPreviewItems(ev)),'multi'); return; }   // 켜진 버프 앞 두 개의 실제 이름으로
   const t=targetById(id), def=t&&KINDS[t.kind]&&KINDS[t.kind].events.find(e=>e.key===ev);
   if(def) playDefault(def.msg(t,{}),def.beep);   // 대상을 못 찾으면 소리 미리듣기만
@@ -75,5 +76,19 @@ function renderSounds(){
     const rb=s.row.querySelector('[data-a=reset]'); rb.style.visibility=c?'':'hidden'; rb.disabled=!c; }   // 자리는 남겨 버튼 줄을 맞춤
 }
-function initSounds(){ refreshSlots(); buildSounds(); loadSounds(); }
+function initSounds(){ refreshSlots(); buildSounds(); loadSounds(); initGroupControl(); }
+// 묶음 알림 미리듣기에 쓸 이름: 해당 묶음 종류의 이벤트가 있는 켜진 대상 앞 두 개. 없으면 예시 이름
+function groupPreviewItems(cls){
+  const names=store.targets.filter(t=>t.enabled&&KINDS[t.kind]&&KINDS[t.kind].events.some(e=>e.group===cls)).slice(0,2).map(t=>t.name);
+  return (names.length===2?names:['유니온의 힘','유니온의 부']).map((label,i)=>({label,rank:i,order:i}));
+}
+// 가까운 알림 묶기 설정: 끔 | 5초 | 10초 | 20초(기본 끔). 바꾸는 즉시 저장하고 Alerts에 알린다
+function initGroupControl(){
+  const g=store.group, val=g.on?String(g.windowSec):'0';
+  for(const r of document.querySelectorAll('#groupCtl input')){
+    r.checked=r.value===val;
+    r.onchange=()=>{ if(!r.checked) return; const v=+r.value; store.group=v?{on:true,windowSec:v}:{on:false,windowSec:store.group.windowSec}; saveTargets(); Alerts.configure(store.group); };
+  }
+  Alerts.configure(store.group);
+}
 async function deleteSoundKeys(keys){
   try{ const st=await soundStore('readwrite'); await Promise.all(keys.map(k=>idb(st.delete(k)))); }catch(e){}
```

- [ ] **Step 2: 시험 도구**

`fake-screen.js`에 등록 드래그를 건너뛰고 대상에 템플릿을 직접 넣을 수 있도록 같은 그림의 data URL을 만드는 `patternURL`을 더한다. `prelude.mjs`는 시작할 때 저장소를 비우는 일을 앱이 열려 있지 않은 같은 origin 페이지(`/__seed__`, 404)에서 하도록 고친다 [확인: 앱이 열려 있으면 IndexedDB 삭제가 앱의 연결 때문에 막혀 시나리오가 멈췄다].

```diff
diff --git a/tests/browser/fake-screen.js b/tests/browser/fake-screen.js
--- a/tests/browser/fake-screen.js
+++ b/tests/browser/fake-screen.js
@@ -24,4 +24,6 @@
     pattern(name, x, y, seed, size = 32) { icons.set(name, { x, y, w: size, h: size, seed, on: true }); },     // 무늬 아이콘(등록해서 쓰는 대상용)
     image(name, url, x, y, w, h) { const img = new Image(); img.src = url; icons.set(name, { x, y, w, h, img, on: true }); },   // 그림 아이콘(내장 아이콘용)
+    patternURL(seed, size = 32) { const c = document.createElement('canvas'); c.width = c.height = size; const k = c.getContext('2d'), cl = cells(seed), u = size / 4;   // pattern()과 같은 그림의 data URL(대상에 직접 넣어 등록을 건너뜀)
+      for (let i = 0; i < 16; i++) { const v = 40 + Math.floor(cl[i] * 200); k.fillStyle = `rgb(${v},${(v * 1.7) % 255 | 0},${(v * 2.3) % 255 | 0})`; k.fillRect((i % 4) * u, Math.floor(i / 4) * u, u, u); } return c.toDataURL('image/png'); },
     show(name, on = true) { const ic = icons.get(name); if (ic) ic.on = on; },
     black(on = true) { black = on; },
diff --git a/tests/browser/prelude.mjs b/tests/browser/prelude.mjs
--- a/tests/browser/prelude.mjs
+++ b/tests/browser/prelude.mjs
@@ -8,7 +8,6 @@ export async function open(taskSpace, opt = {}) {
   const task = await taskSpace("target-list-verify");
   const page = task.page("p1");
-  await page.goto(opt.url || BASE);
-  await page.evaluate(async ({ seed, sounds }) => {              // 이 origin의 저장소를 비우고 시험 데이터를 넣는다
-    localStorage.clear();
+  await page.goto(new URL("/__seed__", BASE).href);            // 앱이 열려 있으면 IndexedDB 삭제가 막히므로, 앱이 없는 같은 origin 페이지(404)에서 비우고 시험 데이터를 넣는다
+  await page.evaluate(async ({ seed, sounds }) => {                  localStorage.clear();
     await new Promise(r => { const q = indexedDB.deleteDatabase("maple-web-timer"); q.onsuccess = q.onerror = q.onblocked = r; });
     for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
```

- [ ] **Step 3: 시나리오**

`tests/browser/group.mjs`:

```js
// 가까운 알림 묶기: 설정 · 당겨 알림 · 개별 · 내 소리 · 룬 비포함 (Task G3)
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const J = JSON.stringify;
// 등록(드래그)을 건너뛰고 대상에 직접 템플릿을 넣는다: fake-screen의 patternURL이 같은 그림을 만든다
const addPatternBuff = (ev, name, seed, x, y, dur) => ev(a => {
  const r = addBuff(store, a.name); const t = r.target;
  Object.assign(t, { tpl: { url: __fake.patternURL(a.seed, 32), w: 32, h: 32 }, area: { x: a.x - 100, y: a.y - 40, w: 300, h: 120 }, frameW: 1280, frameH: 720 }); t.p.durationSec = a.dur;
  __fake.pattern(t.id, a.x, a.y, a.seed, 32); __fake.show(t.id, false); saveTargets(); onTargetsChanged(); return t.id;
}, { name, seed, x, y, dur });
const V2 = g => ({ ver: 2, seq: 0, group: g, targets: [] });   // 내장 대상 없이 시작(빈 목록)

// ---- 설정 라디오: 기본 끔, 선택하면 저장 ----
let { page, ev, wait } = await open(taskSpace, { connect: true });
const ctl = await ev(() => ({ checked: [...document.querySelectorAll("#groupCtl input")].find(r => r.checked).value, labels: [...document.querySelectorAll("#groupCtl label")].map(l => l.textContent.trim()) }));
check("묶기 설정: 끔 | 5초 | 10초 | 20초, 기본 끔", ctl.checked === "0" && J(ctl.labels) === J(["끔", "5초", "10초", "20초"]), ctl);
await ev(() => { document.querySelector("#soundsDetails").open = true; });
await page.click("#groupCtl input[value='10']");
const saved = await ev(() => JSON.parse(localStorage.getItem("maple-web-timer-v2")).group);
check("묶기 설정: 10초 선택 즉시 저장", J(saved) === J({ on: true, windowSec: 10 }), saved);

// ---- 당겨 알림: 3초 차이로 켠 버프 둘 → 묶인 알림 한 번 ----
async function twoBuffs(gap, group) {
  const t = await open(taskSpace, { seed: { "maple-web-timer-v2": V2(group) }, connect: true });
  const a = await addPatternBuff(t.ev, "버프A", 21, 700, 100, 60), b = await addPatternBuff(t.ev, "버프B", 22, 900, 100, 60);
  await t.wait(2500);                                         // 먼저 꺼진 것을 봐야 켜짐 시각을 믿는다(armed)
  await t.ev(x => __fake.show(x, true), a); await t.wait(2500);
  await t.ev(ms => __fake.skew(ms), gap); await t.ev(x => __fake.show(x, true), b); await t.wait(2500);
  await t.ev(() => __fake.reset());
  return { ...t, a, b };
}
let T = await twoBuffs(3000, { on: true, windowSec: 10 });
await T.ev(() => __fake.skew(46500)); await T.wait(3500);   // A의 미리 알림 시각(켜진 지 50초) 직후. B는 켜진 지 약 47초 → 남은 약 13초(<=20)
const g1 = await T.ev(() => ({ spoken: __fake.spoken.slice(), toast: document.querySelector("#toast").textContent, flashed: [...document.querySelectorAll(".card.flash")].map(c => c.id).sort(), alerted: Object.fromEntries(store.targets.map(t => [t.name, states[t.id].alertedPre])) }));
check("묶기 켬 + 3초 차이: 묶인 음성 한 번", J(g1.spoken) === J(["버프A, 버프B 곧 끝나요"]), g1);
check("묶인 알림: 토스트 한 줄, 두 카드 깜빡임, 둘 다 미리 알림 처리", g1.toast === "버프A, 버프B 곧 끝나요" && J(g1.flashed) === J(["card-" + T.a, "card-" + T.b]) && g1.alerted["버프A"] && g1.alerted["버프B"], g1);
await T.ev(() => { __fake.reset(); __fake.skew(20000); }); await T.wait(2500);
check("당겨진 버프는 자기 미리 알림·꺼짐 알림을 다시 울리지 않음", J(await T.ev(() => __fake.spoken)) === J([]));

// ---- 11초 차이: 당겨지지 않고 개별 두 번 ----
T = await twoBuffs(11000, { on: true, windowSec: 10 });
await T.ev(() => __fake.skew(34500)); await T.wait(3000);   // A 켜진 지 약 50초: B는 약 36초 → 남은 24초(>20)
const g2a = await T.ev(() => __fake.spoken.slice());
await T.ev(() => __fake.skew(16000)); await T.wait(3000);
const g2b = await T.ev(() => __fake.spoken.slice());
check("묶기 켬 + 11초 차이: 개별 알림 두 번", J(g2a) === J(["버프A 10초 전"]) && J(g2b) === J(["버프A 10초 전", "버프B 10초 전"]), { g2a, g2b });

// ---- 묶기 끔: 3초 차이라도 개별 ----
T = await twoBuffs(3000, { on: false, windowSec: 10 });
await T.ev(() => __fake.skew(48000)); await T.wait(5000);
const g3 = await T.ev(() => __fake.spoken.slice());
check("묶기 끔: 개별 알림 두 번", J(g3) === J(["버프A 10초 전", "버프B 10초 전"]), g3);

// ---- grp.pre 내 소리가 있으면 그 소리만(비프·음성 없음) ----
T = await (async () => { const t = await open(taskSpace, { seed: { "maple-web-timer-v2": V2({ on: true, windowSec: 10 }) }, sounds: ["grp.pre"], connect: true }); return t; })();
const a4 = await addPatternBuff(T.ev, "버프A", 21, 700, 100, 60), b4 = await addPatternBuff(T.ev, "버프B", 22, 900, 100, 60);
await T.ev(() => { window.__recs = []; Alerts.listen(r => __recs.push(r)); });
await T.wait(2500); await T.ev(x => __fake.show(x, true), a4); await T.wait(2500); await T.ev(ms => __fake.skew(ms), 3000); await T.ev(x => __fake.show(x, true), b4); await T.wait(2500);
await T.ev(() => { __fake.reset(); __fake.skew(46500); }); await T.wait(3000);
const g4 = await T.ev(() => ({ recs: __recs.map(r => [r.grouped, r.custom, r.ids.length]), spoken: __fake.spoken.slice(), beeps: __fake.beeps }));
check("묶인 알림 + grp.pre 내 소리: 그 소리만 재생(기본 비프·음성 없음)", J(g4.recs) === J([[true, true, 2]]) && g4.spoken.length === 0 && g4.beeps === 0, g4);

// ---- 룬은 묶이지 않고 바로 ----
T = await open(taskSpace, { seed: { "maple-web-timer-v2": V2({ on: true, windowSec: 20 }) }, connect: true });
await T.ev(() => { const t = addBuiltin(store, "rune").target; Object.assign(t, { tpl: { url: __fake.patternURL(31, 24), w: 24, h: 24 }, area: { x: 100, y: 500, w: 300, h: 200 }, frameW: 1280, frameH: 720 }); __fake.pattern("rune", 300, 600, 31, 24); __fake.show("rune", false); saveTargets(); onTargetsChanged(); });
await T.wait(2500); await T.ev(() => { __fake.reset(); __fake.show("rune", true); }); await T.wait(3500);
check("룬 출현은 묶기를 켜도 바로 알림", J(await T.ev(() => __fake.spoken.slice())) === J(["룬이 나왔어요"]));
done();
```

- [ ] **Step 4: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
runb tests/browser/group.mjs
runb tests/browser/regression.mjs
runb tests/browser/targets-ui.mjs
```

Expected: `# pass 89` `# fail 0`. 묶기 시나리오 `RESULT 9 passed, 0 failed` — 설정 라디오 `끔 | 5초 | 10초 | 20초`(기본 끔)와 10초 선택 즉시 저장, 묶기 켬 + 3초 차이: 음성 `버프A, 버프B 곧 끝나요` 정확히 한 번·토스트 한 줄·두 카드 깜빡임·둘 다 미리 알림 처리, 이후 당겨진 버프의 미리 알림·꺼짐 알림이 다시 울리지 않음, 11초 차이는 개별 두 번(`버프A 10초 전`, `버프B 10초 전`), 묶기 끔은 3초 차이라도 개별, `grp.pre` 내 소리가 있으면 그 소리만(비프·음성 없음, 멤버 소리는 쓰지 않음), 룬 출현은 묶기를 켜도 바로 `룬이 나왔어요`. 회귀 14, 대상 시나리오 31 통과.

- [ ] **Step 5: 커밋**

```bash
git add css/app.css index.html js/capture.js js/detect-run.js js/sounds.js tests/browser/fake-screen.js tests/browser/group.mjs tests/browser/prelude.mjs
git commit -F - <<'EOF'
알림 묶기 연결: 당겨 알림, 설정(끔·5·10·20초, 기본 끔), 묶음 슬롯 미리듣기

미리 알림이 난 틱에 planGroup으로 곧 끝나는 대상을 당기고 markPre로 그 주기의 자체 pre·
꺼짐 알림을 막는다(부스터 재무장 포함). 설정은 소리 설정 맨 위 라디오이고 바꾸면
저장·Alerts.configure. 연결이 끊기면 대기열을 비운다. 룬·unread·시스템은 묶지 않는다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Phase H. 성능

### Task 20: 대상별 감지 시간 · 틱 느림 알림 · `matchTemplate` 버퍼 재사용

스펙 16-9에 따라 1차 범위는 감지 시간 표시(9.3 ①)와 버퍼 재사용(9.3 ④)뿐이다. 카드의 일치도 옆에 `· 감지 4.7 ms`를 보이고, 틱 평균이 450ms를 20틱 넘게 넘으면 `감지가 느려요 (평균 N ms) · 사용 안 하는 대상은 꺼 주세요`를 알린다. `matchTemplate`은 적분 배열을 호출마다 새로 만들지 않고(546×142 영역이면 약 1.2MB씩 [확인: 스펙 9.1]) 더 큰 크기가 필요할 때만 다시 만든다. 알고리즘은 바꾸지 않는다.

**Files:**
- Modify: `js/match.js`, `js/detect-run.js`, `js/ui-cards.js`, `tests/match.test.js`
- Create: `tests/slow.test.js`, `tests/browser/perf.mjs`

- [ ] **Step 1: 테스트를 더한다**

버퍼 재사용 시험은 분리 전 원본 알고리즘(호출마다 새 배열)을 시험 안에 그대로 두고 크기가 다른 호출을 번갈아 해도 결과가 같은지 비교한다(새 배열이 아닌 재사용 배열의 첫 행·첫 열 0 처리를 놓치면 여기서 잡힌다).

```diff
diff --git a/tests/match.test.js b/tests/match.test.js
--- a/tests/match.test.js
+++ b/tests/match.test.js
@@ -65,2 +65,31 @@ test('ocrSevenSeg: 글씨가 없거나 너무 작으면 null', () => {
   assert.equal(ocrSevenSeg(blank, 40, 20), null);
 });
+
+// ---- 버퍼 재사용 (스펙 9.3 ④): 결과는 그대로, 크기가 같거나 작으면 적분 배열을 새로 만들지 않는다 ----
+const { matchStats } = require('../js/match.js');
+function matchRef(img, W, H, tpl) {          // 분리 전 원본 알고리즘(호출마다 새 배열)
+  const { t, w, h, norm } = tpl; if (W < w || H < h || norm < 1e-3) return { score: 0, x: 0, y: 0 };
+  const W1 = W + 1, S = new Float64Array(W1 * (H + 1)), Q = new Float64Array(W1 * (H + 1));
+  for (let y = 0; y < H; y++) { let rs = 0, rq = 0; for (let x = 0; x < W; x++) { const v = img[y * W + x]; rs += v; rq += v * v; S[(y + 1) * W1 + x + 1] = S[y * W1 + x + 1] + rs; Q[(y + 1) * W1 + x + 1] = Q[y * W1 + x + 1] + rq; } }
+  const n = w * h; let best = -2, bx = 0, by = 0;
+  for (let y = 0; y <= H - h; y++) for (let x = 0; x <= W - w; x++) { const a = y * W1 + x, b = a + w, c = (y + h) * W1 + x, d = c + w; const sum = S[d] - S[b] - S[c] + S[a], sq = Q[d] - Q[b] - Q[c] + Q[a]; const v = sq - sum * sum / n; if (v < 1e-3) continue; let cr = 0; for (let ty = 0; ty < h; ty++) { const ro = (y + ty) * W + x, to = ty * w; for (let tx = 0; tx < w; tx++) cr += t[to + tx] * img[ro + tx]; } const sc = cr / (norm * Math.sqrt(v)); if (sc > best) { best = sc; bx = x; by = y; } }
+  return { score: Math.max(best, 0), x: bx, y: by };
+}
+
+test('matchTemplate: 크기가 다른 호출을 번갈아 해도 원본 알고리즘과 같은 결과', () => {
+  const cases = [[80, 50, 1], [30, 20, 2], [64, 36, 3], [80, 50, 4], [17, 41, 5]];
+  for (const [W, H, seed] of cases) {
+    const img = noiseImage(W, H, seed), tpl = prepTemplate(crop(img, W, 3, 2, 8, 8), 8, 8), other = noiseImage(W, H, seed + 100);
+    for (const im of [img, other]) assert.deepEqual(matchTemplate(im, W, H, tpl), matchRef(im, W, H, tpl));
+  }
+});
+
+test('matchTemplate: 적분 배열은 더 큰 크기가 필요할 때만 새로 만든다', () => {
+  const tpl = prepTemplate(noiseImage(8, 8, 9), 8, 8);
+  matchTemplate(noiseImage(100, 80, 1), 100, 80, tpl);
+  const after = matchStats.allocs;
+  matchTemplate(noiseImage(40, 30, 2), 40, 30, tpl); matchTemplate(noiseImage(100, 80, 3), 100, 80, tpl);
+  assert.equal(matchStats.allocs, after);
+  matchTemplate(noiseImage(200, 100, 4), 200, 100, tpl);
+  assert.equal(matchStats.allocs, after + 1);
+});
```

`tests/slow.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.js');
const L = load(['js/util.js', 'js/detect-core.js', 'js/targets.js', 'js/kinds.js', 'js/detect-run.js'], { PRESET_ICONS: { sol: [], booster: [] } });
const { createSlowWatch } = L;

test('createSlowWatch: 평균이 한계를 20틱 연속 넘으면 한 번 알리고, 회복해야 다시 알린다', () => {
  const w = createSlowWatch(450, 20), out = [];
  for (let i = 0; i < 19; i++) out.push(w.push(600));
  assert.ok(out.every(v => v === null));                    // 19틱까지는 아직
  assert.equal(w.push(600), 600);                           // 20틱째에 평균(ms)을 돌려줌
  for (let i = 0; i < 10; i++) assert.equal(w.push(600), null);   // 계속 느려도 다시 알리지 않음
  for (let i = 0; i < 30; i++) w.push(100);                 // 회복
  const again = []; for (let i = 0; i < 40; i++) again.push(w.push(700));   // 평균이 한계를 넘는 데 몇 틱 걸린 뒤 다시 20틱
  assert.equal(again.filter(v => v !== null).length, 1); assert.ok(again.find(v => v !== null) > 450);
});

test('createSlowWatch: 한계 이하이면 세지 않는다(한 번 튀는 값은 평균에 묻힌다)', () => {
  const w = createSlowWatch(450, 20);
  for (let i = 0; i < 100; i++) assert.equal(w.push(i % 10 === 0 ? 900 : 100), null);
});
```

- [ ] **Step 2: 실패를 본다**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: `# pass 90` `# fail 3`(`matchStats`, `createSlowWatch`가 없음. 결과 동일 시험은 지금도 통과한다).

- [ ] **Step 3: 구현**

```diff
diff --git a/js/detect-run.js b/js/detect-run.js
--- a/js/detect-run.js
+++ b/js/detect-run.js
@@ -85,9 +85,20 @@ function dispatchEvents(list,now){
 // 카드의 "알림 테스트": 묶지 않고 첫 이벤트를 개별 알림으로 재생
 function testAlert(t){ const def=KINDS[t.kind].events[0]; Alerts.fire({...reqFor(t,def,{}),src:'test',group:null}); }
+// 틱이 느려졌는지 지켜본다(스펙 9.3 ①): 지수 이동 평균이 limitMs를 needTicks번 연속 넘으면 그때의 평균(ms)을 한 번 돌려주고, 회복하면 다시 알릴 수 있다
+function createSlowWatch(limitMs,needTicks){
+  let ema=null, over=0, warned=false;
+  return { push(ms){
+    ema=ema==null?ms:ema*0.8+ms*0.2;
+    if(ema>limitMs) over++; else { over=0; warned=false; }
+    if(over>=needTicks&&!warned){ warned=true; return Math.round(ema); }
+    return null;
+  } };
+}
+const slowWatch=createSlowWatch(450,20);
 let busy=false;
 async function tick(){
   if(busy) return; busy=true;
   try{
-    const now=Date.now(), g=await grab(), source=g.frame; frameFresh=g.fresh;
+    const t0=performance.now(), now=Date.now(), g=await grab(), source=g.frame; frameFresh=g.fresh;
     if(source){ [frame.w,frame.h]=dims(source); }
     const live=!!src&&src.type==='stream', ok=!!source&&!(live&&isBlank(source));
@@ -103,13 +114,17 @@ async function tick(){
       const st=stateOf(t.id);
       if(ok && t.enabled && !reg){
-        const det=k.detect(t,source,ctx);
+        const d0=performance.now(), det=k.detect(t,source,ctx);
         if(det){ st.score=det.score; st.pos=det.pos; collectEvents(t,k.step(t,st,det,source,now,ctx),evq); }
         else if(k.onSkip) collectEvents(t,k.step(t,st,null,source,now,ctx),evq);
+        const dt=performance.now()-d0; st.ms=st.ms==null?dt:st.ms*0.8+dt*0.2;     // 대상별 감지 시간(지수 이동 평균). 카드에 표시
       } else if(k.onSkip && t.enabled) collectEvents(t,k.step(t,st,null,null,now,ctx),evq);   // 감지를 건너뛴 틱에도 부르는 종류(묶음 3)
       if(!document.hidden) renderCard(t);
     }
     dispatchEvents(evq,now);
+    const slow=ok&&live?slowWatch.push(performance.now()-t0):null;
+    if(slow) setNote(`감지가 느려요 (평균 ${slow} ms) · 사용 안 하는 대상은 꺼 주세요`);
     renderWatch();   // 탭 제목은 숨겨져 있어도 갱신
     if(!document.hidden){ drawPreview(source); if(live&&ok) pulse(); }
   } finally { busy=false; Alerts.flush(Date.now()); }
 }
+if(typeof module==='object') module.exports={createSlowWatch};
diff --git a/js/match.js b/js/match.js
--- a/js/match.js
+++ b/js/match.js
@@ -11,10 +11,14 @@ function prepTemplate(gray, w, h){
   return {t, w, h, norm:Math.sqrt(ss)};
 }
+// 적분 배열은 매 호출마다 새로 만들지 않고 재사용(546×142 영역이면 약 1.2MB씩 만들던 것). 더 큰 크기가 필요할 때만 다시 만든다
+const matchStats={allocs:0}; let bufS=null, bufQ=null;
+function integralBuffers(n){ if(!bufS||bufS.length<n){ bufS=new Float64Array(n); bufQ=new Float64Array(n); matchStats.allocs++; } return [bufS,bufQ]; }
 // 검색 영역(img, W×H)에서 템플릿과 가장 비슷한 위치와 점수(-1~1)를 반환
 function matchTemplate(img, W, H, tpl){
   const {t,w,h,norm}=tpl;
   if(W<w||H<h||norm<1e-3) return {score:0,x:0,y:0};
-  const W1=W+1, S=new Float64Array(W1*(H+1)), Q=new Float64Array(W1*(H+1));
-  for(let y=0;y<H;y++){ let rs=0,rq=0;
+  const W1=W+1, [S,Q]=integralBuffers(W1*(H+1));
+  S.fill(0,0,W1); Q.fill(0,0,W1);          // 재사용 배열이라 첫 행·첫 열의 0은 직접 채운다
+  for(let y=0;y<H;y++){ let rs=0,rq=0; S[(y+1)*W1]=0; Q[(y+1)*W1]=0;
     for(let x=0;x<W;x++){ const v=img[y*W+x]; rs+=v; rq+=v*v;
       S[(y+1)*W1+x+1]=S[y*W1+x+1]+rs; Q[(y+1)*W1+x+1]=Q[y*W1+x+1]+rq; } }
@@ -31,3 +35,3 @@ function matchTemplate(img, W, H, tpl){
   return {score:Math.max(best,0),x:bx,y:by};
 }
-if(typeof module==='object') module.exports={toGray,prepTemplate,matchTemplate};
+if(typeof module==='object') module.exports={toGray,prepTemplate,matchTemplate,matchStats};
diff --git a/js/ui-cards.js b/js/ui-cards.js
--- a/js/ui-cards.js
+++ b/js/ui-cards.js
@@ -87,5 +87,6 @@ function renderCard(t){
   const rb=q('[data-a=reset]'); if(rb) rb.style.display=t.tpl?'':'none';
   setText(q('[data-s=thr]'),t.threshold.toFixed(2));
-  setText(q('[data-s=score]'),src&&(t.tpl||t.preset)?st.score.toFixed(2)+(st.score>=t.threshold?' ✔':''):'–');
+  const ms=st.ms==null?'':` · 감지 ${st.ms<10?st.ms.toFixed(1):Math.round(st.ms)} ms`;   // 이 대상의 감지에 든 시간(느린 대상을 찾는 용도)
+  setText(q('[data-s=score]'),src&&(t.tpl||t.preset)?st.score.toFixed(2)+(st.score>=t.threshold?' ✔':'')+ms:'–');
   const s=cardStatus(t,st,Date.now(),{src:!!src,frame}), sEl=q('[data-s=status]');
   setText(sEl,s.text); const cls='status '+s.cls; if(sEl.className!==cls) sEl.className=cls; setText(q('[data-s=sub]'),s.sub);
```

- [ ] **Step 4: 성능 시나리오**

1920×1080에서 직접 등록한 버프 10개의 감지 합계를 재고(예산 300ms 이하), 내장 아이콘 2종이 화면에 없을 때의 시간을 보고한다.

`tests/browser/perf.mjs`:

```js
// 대상별 감지 시간 표시와 틱 비용 측정 (Task H1). 1920×1080에서 직접 등록한 버프 10개의 감지 합계를 잰다(보고용 + 300ms 예산)
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const V2 = { ver: 2, seq: 0, group: { on: false, windowSec: 10 }, targets: [] };
const t = await open(taskSpace, { seed: { "maple-web-timer-v2": V2 } });
await t.ev(() => {
  __fake.resize(1920, 1080);
  for (let i = 0; i < 10; i++) {
    const r = addBuff(store, "버프" + (i + 1)), x = 200 + i * 150, y = 120;
    Object.assign(r.target, { tpl: { url: __fake.patternURL(40 + i, 32), w: 32, h: 32 }, area: { x: x - 60, y: y - 40, w: 400, h: 150 }, frameW: 1920, frameH: 1080 });
    __fake.pattern(r.target.id, x, y, 40 + i, 32);
  }
  saveTargets(); onTargetsChanged();
});
await t.wait(800); await t.page.click("#btnConnect"); await t.wait(10000);
const r = await t.ev(() => ({ ms: store.targets.map(x => +(states[x.id].ms || 0).toFixed(1)), score: document.querySelector("#card-u1 [data-s=score]").textContent, note: document.querySelector("#watchNote").textContent }));
const sum = r.ms.reduce((a, b) => a + b, 0);
console.log("감지 시간(ms) 대상별:", r.ms.join(", "), "합계:", sum.toFixed(1));
check("카드에 감지 시간 표시", /· 감지 [\d.]+ ms$/.test(r.score), r.score);
check("직접 등록 버프 10개: 감지 합계가 예산(300ms) 이하", sum > 0 && sum <= 300, sum);
check("틱이 느리다는 알림은 없음", !r.note.includes("감지가 느려요"), r.note);

// 내장 아이콘 2종(솔 야누스·부스터)이 화면에 없을 때의 감지 시간: 보고용(스펙 9.2는 브라우저 값을 아직 모른다)
const p = await open(taskSpace, {});
await p.ev(() => __fake.resize(1920, 1080)); await p.wait(500); await p.page.click("#btnConnect"); await p.wait(8000);
const pm = await p.ev(() => ({ sol: +states.sol.ms.toFixed(1), booster: +states.booster.ms.toFixed(1) }));
console.log("내장 아이콘(화면에 없음, 1920x1080) 감지 시간(ms):", JSON.stringify(pm));
check("내장 2종 감지 시간이 측정됨(보고용)", pm.sol > 0 && pm.booster > 0, pm);
done();
```

- [ ] **Step 5: 실행**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
runb tests/browser/perf.mjs
runb tests/browser/regression.mjs
```

Expected: `# pass 93` `# fail 0`. 성능 시나리오 `RESULT 4 passed, 0 failed`이고 두 줄을 출력한다 [확인: 이 Mac]: `감지 시간(ms) 대상별: 4.5, 1, 1, 0.9, … 합계: 12.2`, `내장 아이콘(화면에 없음, 1920x1080) 감지 시간(ms): {"sol":17.3,"booster":13.6}`. **주의:** 가짜 화면은 단색 배경이라 NCC가 변화 없는 창을 건너뛰어 실제 게임 화면보다 훨씬 빠르게 나온다 [추정]. 스펙 9.2의 "솔 야누스 node 80ms 대 브라우저 214~460ms" 불일치는 이 시나리오로 풀리지 않으며, 실제 게임 화면 캡처로 `detect`를 단계별로 재는 일이 남는다(이 계획의 범위 밖). 회귀 14 통과.

- [ ] **Step 6: 커밋**

```bash
git add js/detect-run.js js/match.js js/ui-cards.js tests/browser/perf.mjs tests/match.test.js tests/slow.test.js
git commit -F - <<'EOF'
대상별 감지 시간 표시, 틱 느림 알림, matchTemplate 적분 배열 재사용

카드 일치도 옆에 감지 시간(지수 이동 평균)을 보이고, 틱 평균이 450ms를 20틱 넘으면 안내한다.
적분 배열은 더 큰 크기가 필요할 때만 새로 만든다(결과는 원본 알고리즘과 같음을 시험으로 고정).
배율 고정·격틱 검색·cost 경고는 실제 게임 화면 측정 뒤로 미룬다(스펙 16-9).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Phase I. 마무리

### Task 21: 최종 회귀 · 파일 분리 확인 · 회귀 체크리스트

오늘 만든 기능이 하나도 빠지지 않았는지 시나리오로 확인한다. 회귀 시나리오를 27개로 넓히고(부스터 숫자 못 읽음, 검은 프레임, 숨은 탭의 `grabFrame` 무응답, 연결 버튼 handoff, 캔버스 일치도 라벨, 설명서 접힘, 대비 토큰, 알림별 비프 모양, 음성 중복 억제, `audioOut`/`onAudioReady`), 내 소리 파일 시나리오와 `file://`·파일 누락 시나리오를 더한다.

**Files:**
- Modify: `tests/browser/fake-screen.js`(비프를 [파형, 주파수]로 기록), `tests/browser/regression.mjs`(전체 교체), `tests/browser/model.mjs`
- Create: `tests/browser/custom-sound.mjs`, `tests/browser/file-protocol.mjs`

- [ ] **Step 1: 시험 파일**

```diff
diff --git a/tests/browser/fake-screen.js b/tests/browser/fake-screen.js
--- a/tests/browser/fake-screen.js
+++ b/tests/browser/fake-screen.js
@@ -30,10 +30,15 @@
     resize(w, h) { cv.width = w; cv.height = h; },
     skew(ms) { skew += ms; },
-    reset() { fake.spoken.length = 0; fake.beeps = 0; },
+    reset() { fake.spoken.length = 0; fake.beeps = 0; fake.osc.length = 0; },
     wait(ms) { return new Promise(r => setTimeout(r, ms)); },
   };
   speechSynthesis.speak = u => fake.spoken.push(u.text);   // 음성 문구를 기록만 한다(실제로 말하지 않음)
   const co = AudioContext.prototype.createOscillator;
-  AudioContext.prototype.createOscillator = function () { fake.beeps++; return co.call(this); };
+  fake.osc = [];                                           // 재생된 비프를 [파형, 주파수]로 기록(알림 소리 구분 확인용)
+  AudioContext.prototype.createOscillator = function () {
+    fake.beeps++; const o = co.call(this), start = o.start.bind(o);
+    o.start = (...a) => { fake.osc.push([o.type, Math.round(o.frequency.value)]); return start(...a); };
+    return o;
+  };
   navigator.mediaDevices.getDisplayMedia = async () => cv.captureStream(5);
   window.__fake = fake;
diff --git a/tests/browser/model.mjs b/tests/browser/model.mjs
--- a/tests/browser/model.mjs
+++ b/tests/browser/model.mjs
@@ -37,6 +37,6 @@ const reg = await ev(() => ({ t: store.targets[2], banner: document.querySelecto
 check("등록: 배너 닫힘, tpl·area·frame 저장", !reg.banner && reg.t.tpl && reg.t.area && reg.t.frameW === 1280 && reg.v2.tpl && reg.v2.frameH === 720, reg);
 await ev(() => __fake.reset()); await wait(3500);
-const after = await ev(() => ({ st: document.querySelector("#card-rune [data-s=status]").textContent, spoken: __fake.spoken.slice() }));
-check("등록 뒤 룬 감지: 룬 있음 + 나왔어요 음성", after.st === "룬 있음!" && after.spoken.includes("룬이 나왔어요"), after);
+const after = await ev(() => ({ st: document.querySelector("#card-rune [data-s=status]").textContent, spoken: __fake.spoken.slice(), osc: JSON.stringify(__fake.osc.slice(0, 3)) }));
+check("등록 뒤 룬 감지: 룬 있음 + 나왔어요 음성 + 올라가는 세 음", after.st === "룬 있음!" && after.spoken.includes("룬이 나왔어요") && after.osc === JSON.stringify([["square", 880], ["square", 1175], ["square", 1568]]), after);
 
 // 3) 알림 테스트 버튼은 개별 알림
```

`tests/browser/regression.mjs`(전체 교체):

```js
// 오늘까지의 감시·알림 동작 회귀 검사 (내장 아이콘 + 가짜 화면). 사용: sed "s|__ROOT__|$PWD|" tests/browser/regression.mjs | ego-browser nodejs
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const J = JSON.stringify;
// 첫 방문: 설명서는 펼쳐져 있고, 연결 버튼이 주된 버튼
let t = await open(taskSpace, {});
check("첫 방문: 설명서 펼침 · 연결 버튼이 주된 버튼", (await t.ev(() => document.querySelector("#helpDetails").open && document.querySelector("#btnConnect").classList.contains("primary"))) === true);
check("대비 토큰: 경고 글자·알림 배경·보조 글자", (await t.ev(() => ["--warn-text", "--alert-bg", "--muted", "--accent"].every(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim().startsWith("#")))) === true);

check("묶음 5용 자리: 오디오를 켜기 전 audioOut()은 null", (await t.ev(() => Alerts.audioOut())) === null);
const { ev, wait, page } = await open(taskSpace, { connect: true });
check("묶음 5용 자리: 연결 뒤 audioOut()은 노드, onAudioReady는 바로 호출", (await ev(() => { let ready = false; Alerts.onAudioReady(() => { ready = true; }); return !!Alerts.audioOut() && ready; })) === true);
const txt = sel => ev(s => document.querySelector(s).textContent, sel);
const osc = () => ev(() => J(__fake.osc));

// 1) 연결 직후
check("연결: 상태줄", (await txt("#watchState")) === "감시 중");
check("연결: 탭 제목", (await ev(() => document.title)) === "● 감시 중 · 메이플 재획 알리미");
const first = await ev(() => ({ cards: ["sol", "booster", "rune"].map(i => document.querySelector(`#card-${i} [data-s=status]`).textContent), spoken: __fake.spoken.slice() }));
check("연결: 카드 문구(못 찾음은 꺼짐과 구분)", J(first.cards) === J(["아직 못 찾음", "아직 못 찾음", "등록 필요"]), first.cards);
check("연결: 시작 음성", first.spoken[0] === "감시 시작할게요. 룬은 등록이 필요해요", first.spoken);
const hand = await ev(() => ({ label: document.querySelector("#btnConnect").textContent, primary: document.querySelector("#btnConnect").classList.contains("primary"), strip: [...document.querySelectorAll("#watchTargets button.primary")].map(b => b.textContent) }));
check("연결 뒤: 연결 버튼은 '다른 창 연결'로 물러나고 등록 버튼이 주된 버튼", hand.label === "다른 창 연결" && !hand.primary && J(hand.strip) === J(["룬 등록하기"]), hand);

// 2) 부스터 숫자를 못 읽음: 20초 넘게 못 읽으면 알림 한 번(낮은 경고음)
await ev(() => { __fake.reset(); __fake.image("booster", PRESET_ICONS.booster[0].url, 500, 20, 65, 19); });
await wait(2500);
check("부스터 켜짐 · 숫자 읽는 중", (await txt("#card-booster [data-s=status]")) === "켜짐 · 숫자 읽는 중");
await ev(() => __fake.skew(21000)); await wait(2500);
const unread = await ev(() => ({ spoken: __fake.spoken.slice(), st: document.querySelector("#card-booster [data-s=status]").textContent, osc: __fake.osc.slice(0, 3) }));
check("숫자 못 읽음: 음성 한 번 · 상태 문구 · 낮은 톱니파 경고음", J(unread.spoken) === J(["부스터 숫자를 못 읽고 있어요"]) && unread.st === "켜짐 · 숫자를 못 읽음" && J(unread.osc) === J([["sawtooth", 330], ["sawtooth", 330], ["sawtooth", 330]]), unread);
await ev(() => { __fake.show("booster", false); });
await wait(3000);                                             // 꺼짐 확정(4틱) 뒤 "부스터 꺼졌어요"가 나간 다음에 다음 단계로

// 3) 솔 야누스(내장 아이콘): 켜짐 → 학습 중, 일치도 표시, 캔버스 일치도 라벨
await ev(() => { __fake.reset(); window.__labels = []; const o = pctx.fillText.bind(pctx); pctx.fillText = (tx, ...a) => { __labels.push(tx); return o(tx, ...a); }; __fake.image("sol", document.querySelector("#card-sol .thumb").src, 1100, 50, 32, 32); });
await wait(2500);
check("솔 야누스 켜짐 · 학습 중", (await txt("#card-sol [data-s=status]")) === "켜짐 · 학습 중");
check("일치도 표시(카드)", (await txt("#card-sol [data-s=score]")).startsWith("1.00 ✔"));
check("캔버스 일치도/기준값 라벨", (await ev(() => __labels.includes("솔 야누스 1.00 / 0.75"))) === true);

// 4) 검은 화면은 감지를 건너뛰어 꺼짐으로 오판하지 않는다
await ev(() => { __fake.reset(); __fake.black(true); });
await wait(3000);
const blank = await ev(() => ({ present: states.sol.present, spoken: __fake.spoken.slice() }));
check("검은 프레임: 켜짐 상태 유지, 꺼짐 알림 없음", blank.present === true && blank.spoken.length === 0, blank);
// 10초 넘게 검으면 화면 안 들어옴 알림(연결 문제 경고음), 화면이 돌아오면 음성만
await ev(() => __fake.skew(11000)); await wait(1500);
const stall = await ev(() => ({ spoken: __fake.spoken.slice(), state: document.querySelector("#watchState").textContent }));
check("화면 안 들어옴: 10초 뒤 알림 · 상태줄", stall.spoken.includes("게임 화면이 들어오지 않아요") && stall.state === "게임 화면이 안 들어와요", stall);
await ev(() => { __fake.reset(); __fake.black(false); }); await wait(2500);
const back = await ev(() => ({ spoken: __fake.spoken.slice(), state: document.querySelector("#watchState").textContent, osc: __fake.osc.length }));
check("복구는 음성만(비프 없음)", J(back.spoken) === J(["게임 화면이 다시 들어와요"]) && back.state === "감시 중" && back.osc === 0, back);

// 5) 지속시간 1:00 + 51초 뒤 미리 알림 한 번(딩딩-동), 이후 꺼져도 꺼짐 알림 없음(정책)
await ev(() => { __fake.reset(); const i = document.querySelector("#card-sol [data-f=durationSec]"); i.value = "1:00"; i.dispatchEvent(new Event("change")); __fake.skew(51000); });
await wait(3500);
const pre = await ev(() => ({ spoken: __fake.spoken.slice(), osc: __fake.osc.slice() }));
check("미리 알림: 음성 한 번 + 딩딩-동", J(pre.spoken) === J(["솔 야누스 10초 전"]) && J(pre.osc) === J([["square", 1046], ["square", 1046], ["square", 784]]), pre);
await ev(() => { __fake.reset(); __fake.show("sol", false); });
await wait(3500);
const off = await ev(() => ({ spoken: __fake.spoken.slice(), st: document.querySelector("#card-sol [data-s=status]").textContent }));
check("미리 알림 뒤 꺼짐 알림 없음", off.spoken.length === 0 && off.st === "꺼져 있음", off);

// 6) 알림 테스트: 음성은 같은 문구 8초 중복 억제, 순서대로 말함
await ev(() => { __fake.skew(9000); __fake.reset(); testAlert(targetById("sol")); testAlert(targetById("sol")); testAlert(targetById("booster")); });   // 앞 알림과 8초 넘게 띄워 중복 억제에 걸리지 않게
await wait(3500);
const said = await ev(() => __fake.spoken.slice());
check("음성: 같은 문구는 한 번만, 다른 문구는 이어서", J(said) === J(["솔 야누스 10초 전", "부스터 10초 전"]), said);

// 7) 숨은 탭: grabFrame으로 감시, 응답이 없으면 1.5초 뒤 포기하고 10초 넘으면 화면 안 들어옴
await ev(() => { __fake.reset(); Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); });
await wait(2000);
check("숨은 탭에서도 감시 중(grabFrame)", (await txt("#watchState")) === "감시 중");
await ev(() => { src.cap.grabFrame = () => new Promise(() => {}); });   // 새 프레임이 영원히 안 오는 상태
await wait(3500); await ev(() => __fake.skew(11000)); await wait(3500);
const hid = await ev(() => ({ spoken: __fake.spoken.slice(), state: document.querySelector("#watchState").textContent, base: baseTitle() }));
check("grabFrame 무응답: 감지가 멈추지 않고 화면 안 들어옴 알림 · 탭 제목", hid.spoken.includes("게임 화면이 들어오지 않아요") && hid.state === "게임 화면이 안 들어와요" && hid.base === "⚠ 화면 안 들어옴 · 메이플 재획 알리미", hid);
await ev(() => { delete document.hidden; });

// 8) 연결 끊김: 즉시 1번 + 2분 간격 2번에서 멈춤(총 3번), 낮은 경고음
await ev(() => { __fake.reset(); src.track.dispatchEvent(new Event("ended")); });
await wait(1500);
const lost = () => ev(() => __fake.spoken.filter(t => t.startsWith("화면 연결이 끊겼어요")).length);
check("끊김 즉시 1번", (await lost()) === 1, await lost());
check("끊김 상태줄 · 탭 제목", (await txt("#watchState")) === "연결 끊김 · 알림이 멈췄어요" && (await ev(() => baseTitle())) === "⚠ 연결 끊김 · 메이플 재획 알리미");
for (let i = 0; i < 3; i++) { await ev(() => __fake.skew(121000)); await wait(1500); }
check("끊김 재알림은 총 3번에서 멈춤", (await lost()) === 3, await lost());

// 9) 화면이 다시 들어오면(화면 안 들어옴 → 복구) 음성만. 새로 연결하면 다시 감시 중
await ev(() => __fake.reset()); await page.click("#btnConnect"); await wait(3000);
check("다시 연결: 감시 중 · 시작 음성", (await txt("#watchState")) === "감시 중" && (await ev(() => __fake.spoken[0])) === "감시 시작할게요. 룬은 등록이 필요해요");
await ev(() => location.reload()); await wait(1500);
check("연결한 적이 있으면 새로고침 뒤 설명서가 접혀 있음", (await ev(() => document.querySelector("#helpDetails").open)) === false);
done();
```

`tests/browser/custom-sound.mjs`(8kHz WAV를 노드에서 만들어 파일 입력으로 고른다. 5MB 초과는 330초 길이로 만든다):

```js
// 내 소리 파일: 고르기 · 용량/길이 제한 · 대체 재생 · 저장 · 기본으로 (오늘 추가된 기능 회귀)
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const fs = await import("node:fs/promises"), os = await import("node:os"), path = await import("node:path");
const J = JSON.stringify;
// 8kHz 16비트 모노 WAV. sec초
function wav(sec) { const n = Math.floor(8000 * sec), b = Buffer.alloc(44 + n * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), 44 + i * 2); return b; }
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "maple-sound-"));
const files = { ok: path.join(dir, "ding.wav"), long: path.join(dir, "long.wav"), big: path.join(dir, "big.wav") };
await fs.writeFile(files.ok, wav(0.3)); await fs.writeFile(files.long, wav(11)); await fs.writeFile(files.big, wav(330));   // 330초 = 약 5.3MB

const { page, ev, wait } = await open(taskSpace, { connect: true });
await ev(() => { document.querySelector("#soundsDetails").open = true; document.querySelectorAll("#soundRows .snd-row").forEach((r, i) => r.querySelector("input[type=file]").id = "pick" + i); });
const rowOf = key => ev(k => SLOTS.findIndex(s => s.key === k), key);
const iSolPre = await rowOf("sol.pre"), iSolGone = await rowOf("sol.gone");
const note = () => ev(() => document.querySelector("#soundNote").textContent);

await page.setInputFiles("#pick" + iSolPre, files.ok); await wait(1200);
let r = await ev(() => ({ has: customSounds.has("sol.pre"), file: SLOTS[0].row.querySelector(".snd-file").textContent, note: document.querySelector("#soundNote").textContent }));
check("파일 고르기: 슬롯에 저장, 이름·길이 표시", r.has && r.file === "ding.wav · 0.3초" && r.note.includes("소리를 바꿨어요"), r);
await page.setInputFiles("#pick" + iSolGone, files.long); await wait(1000);
check("10초 넘는 소리는 거절", (await note()).includes("10초 이하 소리만 쓸 수 있어요") && !(await ev(() => customSounds.has("sol.gone"))), await note());
await page.setInputFiles("#pick" + iSolGone, files.big); await wait(1000);
check("5MB 넘는 파일은 거절", (await note()).includes("5MB 이하 파일만 쓸 수 있어요") && !(await ev(() => customSounds.has("sol.gone"))), await note());

// 내 소리가 있는 알림은 기본 경고음·음성 대신 그 소리만
await ev(() => { __fake.reset(); window.__recs = []; Alerts.listen(x => __recs.push(x)); testAlert(targetById("sol")); });
await wait(1500);
const play = await ev(() => ({ spoken: __fake.spoken.slice(), osc: __fake.osc.length, recs: __recs.map(x => [x.event, x.custom]) }));
check("내 소리가 있으면 기본 비프·음성 대신 재생", play.spoken.length === 0 && play.osc === 0 && J(play.recs) === J([["pre", true]]), play);
await ev(() => { __fake.reset(); testAlert(targetById("booster")); }); await wait(2500);
check("다른 알림은 기본 소리 그대로(비프 + 음성)", (await ev(() => __fake.osc.length)) === 4 && J(await ev(() => __fake.spoken)) === J(["부스터 10초 전"]));

// 새로고침해도 유지(IndexedDB), 기본으로 되돌리기
await ev(() => location.reload()); await wait(2000);
check("새로고침 뒤에도 유지", (await ev(() => customSounds.has("sol.pre"))) === true);
await ev(() => { document.querySelector("#soundsDetails").open = true; SLOTS[0].row.querySelector("[data-a=reset]").click(); }); await wait(800);
const reset = await ev(async () => ({ has: customSounds.has("sol.pre"), note: document.querySelector("#soundNote").textContent, keys: await new Promise(res => { const q = indexedDB.open("maple-web-timer", 1); q.onsuccess = () => { const g = q.result.transaction("sounds").objectStore("sounds").getAllKeys(); g.onsuccess = () => res(g.result); }; }) }));
check("기본으로: 슬롯·저장소에서 삭제, 안내 문구", !reset.has && reset.note === "솔 야누스 미리 알림을 기본 소리로 되돌렸어요" && reset.keys.length === 0, reset);
await fs.rm(dir, { recursive: true, force: true });
done();
```

`tests/browser/file-protocol.mjs`(`file://`로 열어 내장 아이콘 감지가 되는지, 폴더를 복사해 `js/targets.js`를 지우면 안내가 뜨는지):

```js
// file://로 열어도 동작하고(캔버스 오염 없음), 스크립트 파일이 빠지면 어느 파일인지 알려 준다 (Task I1)
const ROOT = "file://__ROOT__/tests/browser/";
const { check, done } = await import(ROOT + "prelude.mjs");
const fs = await import("node:fs/promises"), os = await import("node:os"), path = await import("node:path");
const harness = await fs.readFile("__ROOT__/tests/browser/fake-screen.js", "utf8");
const task = await taskSpace("target-list-verify"); const page = task.page("p1");

// 1) 원본 폴더를 file://로
await page.goto("file://__ROOT__/index.html");
await page.evaluate(harness);
await page.click("#btnConnect"); await page.waitForTimeout(3000);
await page.evaluate(() => __fake.image("sol", document.querySelector("#card-sol .thumb").src, 1100, 50, 32, 32));
await page.waitForTimeout(2500);
const r = await page.evaluate(() => ({ proto: location.protocol, globals: [typeof KINDS, typeof Alerts, typeof matchTemplate], state: document.querySelector("#watchState").textContent, sol: document.querySelector("#card-sol [data-s=status]").textContent, score: document.querySelector("#card-sol [data-s=score]").textContent }));
check("file://: 전역 로드, 감시 중", r.proto === "file:" && r.globals.every(g => g !== "undefined") && r.state === "감시 중", r);
check("file://: 내장 아이콘 감지가 동작(캔버스 오염 오류 없음)", r.sol === "켜짐 · 학습 중" && r.score.startsWith("1.00"), r);

// 2) 다른 폴더로 복사한 사본에서 js/targets.js를 지우면 안내문
const copy = await fs.mkdtemp(path.join(os.tmpdir(), "maple-copy-"));
await fs.cp("__ROOT__/index.html", path.join(copy, "index.html")); await fs.cp("__ROOT__/css", path.join(copy, "css"), { recursive: true }); await fs.cp("__ROOT__/js", path.join(copy, "js"), { recursive: true });
await fs.rm(path.join(copy, "js/targets.js"));
await page.goto("file://" + copy + "/index.html"); await page.waitForTimeout(800);
const miss = await page.evaluate(() => document.querySelector("#empty").textContent);
check("스크립트 누락: 빠진 파일을 화면에 안내", miss.startsWith("파일이 빠졌어요:") && miss.includes("js/targets.js"), miss);
await fs.rm(copy, { recursive: true, force: true });
done();
```

- [ ] **Step 2: 전부 돌린다(하나씩)**

```bash
node --test 2>&1 | grep -E "^# (pass|fail)"
runb tests/browser/regression.mjs
runb tests/browser/model.mjs
runb tests/browser/targets-ui.mjs
runb tests/browser/sounds.mjs
runb tests/browser/group.mjs
runb tests/browser/custom-sound.mjs
runb tests/browser/file-protocol.mjs
runb tests/browser/perf.mjs
```

Expected: 단위 `# pass 93` `# fail 0`. 브라우저 `RESULT`는 회귀 `27 passed`, 모델 `11`, 대상 `31`, 소리 `5`, 묶기 `9`, 내 소리 `7`, `file://` `3`, 성능 `4`. 모두 `0 failed`. `FAIL`이 있으면 `<-` 뒤의 값을 보고 원인을 찾는다(타이밍 때문에 드물게 흔들리는 시나리오는 한 번 더 돌려 본다. 같은 곳에서 두 번 실패하면 진짜 결함이다).

- [ ] **Step 3: 서버를 끈다**

```bash
pkill -f "http.server 8766"
```

- [ ] **Step 4: 자동으로 확인하지 못한 것을 손으로 확인한다**

1. **실제 게임 화면.** 이 계획의 모든 감지 검사는 합성 이미지다. 실제 메이플스토리 창을 공유해 솔 야누스·부스터가 잡히는지, 버프 하나를 직접 등록해 켜짐·미리 알림이 도는지 한 번 본다 [추정: 합성 검사가 통과해도 실제 화면은 확인하지 못함].
2. **다른 폴더로 복사한 `index.html`에서 설정이 공유되는지**(스펙 16-11). `file://` 저장소의 origin은 파일 경로마다 다를 수 있다 [추정]. 두 경로로 열어 설정이 같은지 본다.
3. **대상 10개일 때 접힌 카드 열과 상태줄이 한눈에 들어오는지**(스펙 11.2 #8). 단위·시나리오는 구조(접힘 높이 70px 이하, 6개부터 `정상 N개`)만 확인한다.
4. **어두운 모드.** 새 CSS는 기존 색 토큰(`--ok`, `--warn-text`, `--muted`, `--line`, `--panel`)만 쓴다. OS를 어두운 모드로 두고 접힌 카드의 한 줄 상태(`.mini`)와 묶기 설정 상자의 대비를 눈으로 본다.

- [ ] **Step 5: 회귀 체크리스트를 표로 확인한다**

| 오늘의 동작 | 확인하는 곳 |
|---|---|
| 상태줄·탭 제목: 감시 중 / 연결 끊김 / 화면 안 들어옴 | 회귀 #5 #6 #16 #22 #24 |
| 끊김 알림: 즉시 1번 + 2분 간격 2번에서 멈춤, 낮은 경고음 | 회귀 #23 #25 |
| 화면 안 들어옴: 10초 넘으면 알림, 검은 프레임은 감지를 건너뛰어 꺼짐으로 오판하지 않음, 복구는 음성만 | 회귀 #15 #16 #17 |
| `grabFrame` 1.5초 시간 제한, 숨은 탭 감시 | 회귀 #21 #22 |
| 부스터 숫자 20초 못 읽음 알림(한 번, 낮은 경고음) | 회귀 #10 #11, 단위 `stepCountdown` |
| 미리 알림 한 번(딩딩-동), 미리 알림 뒤 꺼짐 알림 없음 | 회귀 #18 #19, 단위 `stepDetector` |
| 이벤트별 소리 모양(룬 올라가는 세 음, 연결 문제 톱니파) | 모델(룬), 회귀 #11 |
| 음성: 순서대로, 같은 문구 8초 중복 억제 | 회귀 #20 |
| 내 소리 파일: 10초·5MB 제한, 기본 소리 대체, IndexedDB 저장, 기본으로 | 내 소리 7개 |
| "아직 못 찾음"(꺼짐과 구분) | 회귀 #7 |
| 연결 버튼이 연결 뒤 주된 버튼에서 물러나고 등록 버튼이 주된 버튼이 됨 | 회귀 #1 #9 |
| 카드 일치도·캔버스 일치도/기준값 라벨 | 회귀 #13 #14 |
| 지속시간 자동 학습 표시 | 회귀 #12 |
| 설명서: 처음엔 펼침, 연결한 적이 있으면 접힘 | 회귀 #1 #27 |
| 대비 토큰 | 회귀 #2 + 손 확인 4 |
| v1 설정 자동 이전(지속시간·룬 반복·부스터 재설정) | 모델 |
| 해상도 변경 → 다시 등록 필요, 차례로 등록 | 모델, 대상 시나리오 |
| 직접 등록(영역 → 아이콘), 알림 테스트 버튼 | 모델 |
| `file://`에서 동작, 파일이 빠지면 안내 | `file://` 3개 |

- [ ] **Step 6: 커밋**

```bash
git add tests/browser/custom-sound.mjs tests/browser/fake-screen.js tests/browser/file-protocol.mjs tests/browser/model.mjs tests/browser/regression.mjs
git commit -F - <<'EOF'
최종 회귀: 부스터 숫자·검은 프레임·숨은 탭·내 소리·file:// 시나리오

회귀 시나리오를 27개로 넓히고 내 소리 파일(10초/5MB/대체 재생/저장)과 file://·스크립트
누락 안내 시나리오를 더했다. 알림별 비프 모양과 audioOut/onAudioReady 자리를 확인한다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## 자체 검토

### 스펙 적용 범위

| 스펙 | 이 계획에서 |
|---|---|
| 3.1–3.3 모델·id·순서·켜기/끄기·이름·12개 | Task 9(모델·검사·`makeId`), 11(끄면 상태 초기화), 13(12개), 14(이름·순서) |
| 3.4 `KINDS` | Task 8 (`events`, `register.steps/validate/save`, `isRegistered`, `needsReregister`, `maxInstances`, `onSkip`, `status`, `stripState`, `markPre`, `applyEffect`, `remainSec`, `cardFields`, `cost`) |
| 3.5 `PRESETS`, 내장 삭제·복원 | Task 8, 13 |
| 4.1–4.3 저장·이전·검사 | Task 9 |
| 4.4–4.5 슬롯·삭제·고아 정리 | Task 12, 14 |
| 5.1 추가 흐름, 5.3 지속시간, 5.4 입력 검사 | Task 13, 8 |
| 5.2 등록 때 도움 | 영역 공유는 기본 동작. "같은 아이콘 노트"는 스펙 16-9에 따라 뺌 |
| 5.5 카드·미리보기·부제·설명서 | Task 15 (부제는 Task 11) |
| 5.6 상태줄 | Task 16 |
| 6.2–6.5 묶기 | Task 8(`events.group`), 17, 18, 19 |
| 7 알림 경로 | Task 10, 18 (호출부는 Task 11) |
| 8 파일 분리 | Task 2, 3, 11(`main.js`), 21(`file://`·누락 안내) |
| 9 성능 | Task 20 (① ④만. 나머지는 16-9에 따라 미룸) |
| 10 오류·예외 | v2 깨짐·저장 실패 Task 9, 이름·12개 Task 13·14, 등록 중 삭제 Task 13(`removeTargetNow`), 대기열 삭제·끄기 Task 11·18(`drop`), 해상도 Task 16, 알 수 없는 kind Task 9·11, 연결 끊김 시 대기열 비움 Task 19 |
| 11 테스트 | 단위: `migrateV1`·`normalizeTarget`·`makeId`·이름·`parseDur`/`checkDurLead`·회귀·`planGroup`·`groupText`·`slotsOf`·`orphanSlots`·`summarizeStrip`·부스터 재무장. 브라우저 11.2의 1–7·9(일부)·10·11 |
| 14–16 맞춘 결과·사용자 결정·검토 반영 | 14: Task 8·9·11(`onSkip`, `fresh`, `#watchManual`, `loadStore`, `targetSnapshot`, 12개 상한). 15: 묶기 기본 끔(Task 9·19). 16: 1(Task 7·19), 2(18·19), 3(8·11), 4–5(9), 6(10), 7(11), 8(11), 9(20), 10(11), 11(8·9) |

### 이 계획이 하지 않는 것·위험

- **`maxInstances`는 필드만 있다.** 종류별 상한(`idle` 1개)을 지키는 UI는 이 묶음에 없다(대상 추가 메뉴가 버프와 내장 대상만 낸다). 묶음 3이 메뉴에 종류를 더할 때 `maxInstances`를 확인해야 한다.
- **`frameFresh`/`onSkip`/`Alerts.audioOut`/`setAudioOut`/`onAudioReady`/`titlePrefix`/`#watchManual`/`manualTick` 호출은 소비자가 아직 없다.** 존재와 호출 순서만 시험한다(회귀 #3 #4).
- **합성 화면 검사의 한계.** 감지·성능 검사는 단색 배경 위 합성 아이콘이다. 실제 화면의 오탐·감지 시간은 확인하지 못한다. 스펙 9.2의 "솔 야누스 80ms 대 214~460ms" 불일치도 그대로 남는다.
- **삭제 되돌리기 막대는 가장 최근에 지운 대상 하나만 보인다.** 10초 안에 둘을 지우면 앞의 것은 되돌릴 수 없다. 삭제 확인은 브라우저 `confirm()`이라 막히는 대화상자다.
- **학습 결과가 미리 알림 이하이면 버린다**(`applyEffect`). 지금은 그런 값도 저장해 켜지자마자 미리 알림이 울릴 수 있었다. 스펙 5.4를 학습에도 적용한 작은 동작 변화다.
- **브라우저 알림의 `tag`**가 시스템 알림은 `system`에서 `sys`로 바뀐다(같은 알림이 서로 대체되는 규칙은 그대로).
- **카드가 기본으로 접힌다**(스펙 5.5). 처음 보는 날 기준값 슬라이더가 보이지 않는 것은 의도한 변화다.
- **시나리오는 시간(`wait`)에 기대는 곳이 있다.** 드물게 흔들릴 수 있다. 같은 곳이 두 번 실패하면 결함으로 본다.
- **`PRODUCT.md`의 저장 키 설명(`maple-web-timer-v1`)은 이 계획이 고치지 않는다.** 병합 뒤 따로 맞춘다.
