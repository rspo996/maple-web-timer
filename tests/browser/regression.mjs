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
check("연결: 카드 문구(못 찾음은 꺼짐과 구분)", J(first.cards) === J(["아직 못 찾음", "아직 못 찾음", "룬 없음"]), first.cards);  // 룬도 내장 아이콘이 생겨 등록 없이 찾는다(2026-11-10)
check("연결: 시작 음성 없음(등록할 대상 없음, 2026-11-28 사용자 결정)", first.spoken.length === 0, first.spoken);
const hand = await ev(() => ({ label: document.querySelector("#btnConnect").textContent, primary: document.querySelector("#btnConnect").classList.contains("primary"), strip: [...document.querySelectorAll("#watchTargets button.primary")].map(b => b.textContent) }));
check("연결 뒤: 연결 버튼은 '다른 창 연결'로 물러나고, 등록할 대상이 없으니 상태줄에 등록 버튼 없음", hand.label === "다른 창 연결" && !hand.primary && J(hand.strip) === J([]), hand);

// 2) 부스터 숫자를 못 읽음: 20초 넘게 못 읽어도 소리 없이 카드 상태 문구만(2026-11-28 사용자 결정)
await ev(() => { __fake.reset(); __fake.image("booster", PRESET_ICONS.booster[0].url, 500, 20, 65, 19); });
// 처음 찾을 때는 크기를 하나씩 번갈아 보고 크기 맞추기용 템플릿을 불러오느라 몇 초 걸린다(2026-11-15 감지 정리). 켜질 때까지 기다린다
let bWait = 0; while (!(await ev(() => states.booster.present)) && bWait < 30) { await wait(500); bWait++; }
// 꺼진 것을 본 뒤 새로 나타난 내장 부스터: 숫자를 읽기 전에는 나타난 때부터 100초로 센다(2026-11-20 사용자 결정)
const bShown = await ev(() => [document.querySelector("#card-booster [data-s=status]").textContent, document.querySelector("#card-booster [data-s=sub]").textContent]);
check("부스터 켜짐: 숫자를 읽기 전에는 100초로 센다", /^남은 시간 01:(3\d|40)$/.test(bShown[0]) && bShown[1].includes("100초로 세고"), { bShown, bWait });
await ev(() => __fake.skew(21000)); await wait(2500);
const unread = await ev(() => ({ spoken: __fake.spoken.slice(), st: document.querySelector("#card-booster [data-s=status]").textContent, sub: document.querySelector("#card-booster [data-s=sub]").textContent, osc: __fake.osc.slice(0, 3) }));
check("숫자 못 읽음(글자는 보이고 숫자 칸은 비어 있음): 소리 없이 상태 문구만(2026-11-28 사용자 결정)", J(unread.spoken) === J([]) && /^남은 시간 01:1\d$/.test(unread.st) && unread.sub.includes("20초 넘게 못 읽었어요") && J(unread.osc) === J([]), unread);
// 글자가 사라져도 100초가 다 될 때까지는 가려진 것으로 보고, 그 10초 전에 미리 알림을 울린 뒤 끝 + 2초가 지나면 꺼짐(꺼짐 알림은 없음)
await ev(() => { __fake.show("booster", false); __fake.reset(); __fake.skew(67000); });
await wait(2500);
const bPre = await ev(() => ({ spoken: __fake.spoken.slice(), present: states.booster.present, held: states.booster.held }));
check("가려진 채로 100초 가정의 10초 전 미리 알림", J(bPre.spoken) === J(["부스터 곧 꺼져요"]) && bPre.present && bPre.held, bPre);
await ev(() => { __fake.reset(); __fake.skew(15000); });
await wait(3000);
const bOff = await ev(() => ({ spoken: __fake.spoken.slice(), present: states.booster.present }));
check("끝 시각 + 2초가 지나면 꺼짐, 꺼짐 알림 없음", bOff.present === false && bOff.spoken.length === 0, bOff);

// 3) 솔 야누스(내장 아이콘): 켜짐(남은 시간 숫자는 아직 없음), 일치도 표시, 캔버스 일치도 라벨
await ev(() => { __fake.reset(); window.__labels = []; const o = pctx.fillText.bind(pctx); pctx.fillText = (tx, ...a) => { __labels.push(tx); return o(tx, ...a); }; __fake.image("sol", document.querySelector("#card-sol .thumb").src, 1100, 50, 32, 32); });
await wait(2500);
check("솔 야누스 켜짐(숫자 없음): 지속시간 칸·방금 켰어요 없이 미리 알림 칸만", J(await ev(() => [document.querySelector("#card-sol [data-s=status]").textContent, [...document.querySelectorAll("#card-sol [data-f]")].map(e => e.dataset.f), document.querySelectorAll("#card-sol [data-act]").length])) === J(["켜짐", ["leadSec"], 0]));
check("일치도 표시(카드)", (await txt("#card-sol [data-s=score]")).startsWith("1.00 ✔"));
check("캔버스 일치도/기준값 라벨", (await ev(() => __labels.includes("솔 야누스 1.00 / 0.75"))) === true);

// 4) 검은 화면은 감지를 건너뛰어 꺼짐으로 오판하지 않는다
await ev(() => { __fake.reset(); __fake.black(true); });
await wait(3000);
const blank = await ev(() => ({ present: states.sol.present, spoken: __fake.spoken.slice() }));
check("검은 프레임: 켜짐 상태 유지, 꺼짐 알림 없음", blank.present === true && blank.spoken.length === 0, blank);
// 10초 넘게 검으면 상태줄에 화면 안 들어옴, 화면이 돌아오면 감시 중. 소리 알림은 없음(2026-11-10 사용자 결정)
await ev(() => __fake.skew(11000)); await wait(1500);
const stall = await ev(() => ({ spoken: __fake.spoken.slice(), state: document.querySelector("#watchState").textContent }));
check("화면 안 들어옴: 10초 뒤 상태줄만(소리 없음)", stall.spoken.length === 0 && stall.state === "게임 화면이 안 들어와요", stall);
await ev(() => { __fake.reset(); __fake.black(false); }); await wait(2500);
const back = await ev(() => ({ spoken: __fake.spoken.slice(), state: document.querySelector("#watchState").textContent, osc: __fake.osc.length }));
check("복구: 상태줄만(소리 없음)", back.spoken.length === 0 && back.state === "감시 중" && back.osc === 0, back);

// 5) 아이콘에 남은 시간 숫자 1:00이 찍히고 51초 뒤 미리 알림 한 번(딩딩-동), 이후 꺼져도 꺼짐 알림 없음(정책). 지속시간 칸 대신 숫자를 읽는다(2026-11-11)
await ev(() => { __fake.reset(); __fake.timer("sol", 60); });
await wait(2500);
check("야누스 숫자 읽기: 남은 시간 표시", /^남은 시간 00:5\d$/.test(await txt("#card-sol [data-s=status]")), await txt("#card-sol [data-s=status]"));
await ev(() => __fake.skew(51000));
await wait(3500);
const pre = await ev(() => ({ spoken: __fake.spoken.slice(), osc: __fake.osc.slice() }));
check("미리 알림: 음성 한 번 + 딩딩-동", J(pre.spoken) === J(["야누스 곧 꺼져요"]) && J(pre.osc) === J([["square", 1046], ["square", 1046], ["square", 784]]), pre);
// 아이콘이 사라져도 읽어 둔 끝 시각 + 2초까지는 가려진 것으로 보고 그 값으로 계속 센다(dec3080, 2026-11-21 사용자 결정). 그 뒤 꺼짐
await ev(() => { __fake.reset(); __fake.show("sol", false); });
await wait(2500);
const solHeld = await ev(() => ({ spoken: __fake.spoken.slice(), present: states.sol.present, held: states.sol.held, sub: document.querySelector("#card-sol [data-s=sub]").textContent }));
check("미리 알림 뒤 아이콘이 사라져도 끝 시각 + 2초까지는 읽어 둔 시간으로 센다", solHeld.present && solHeld.held && solHeld.sub.includes("읽어 둔 시간으로 계속 세요") && solHeld.spoken.length === 0, solHeld);
await ev(() => __fake.skew(5000)); await wait(2500);
const off = await ev(() => ({ spoken: __fake.spoken.slice(), st: document.querySelector("#card-sol [data-s=status]").textContent }));
check("끝 시각 + 2초가 지나면 꺼짐, 미리 알림 뒤 꺼짐 알림 없음", off.spoken.length === 0 && off.st === "꺼져 있음", off);

// 6) 알림 테스트: 음성은 같은 문구 8초 중복 억제, 순서대로 말함
await ev(() => { __fake.skew(9000); __fake.reset(); testAlert(targetById("sol")); testAlert(targetById("sol")); testAlert(targetById("booster")); });   // 앞 알림과 8초 넘게 띄워 중복 억제에 걸리지 않게
await wait(3500);
const said = await ev(() => __fake.spoken.slice());
check("음성: 같은 문구는 한 번만, 다른 문구는 이어서", J(said) === J(["야누스 곧 꺼져요", "부스터 곧 꺼져요"]), said);

// 7) 숨은 탭: grabFrame으로 감시, 응답이 없으면 1.5초 뒤 포기하고 10초 넘으면 화면 안 들어옴
await ev(() => { __fake.reset(); Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); });
await wait(2000);
check("숨은 탭에서도 감시 중(grabFrame)", (await ev(() => watchStatus().state)) === "감시 중");   // 숨은 동안은 화면을 그리지 않으므로 엔진 상태를 본다
await ev(() => { src.cap.grabFrame = () => new Promise(() => {}); });   // 새 프레임이 영원히 안 오는 상태
await wait(3500); await ev(() => __fake.skew(11000)); await wait(3500);
const hid = await ev(() => ({ spoken: __fake.spoken.slice(), state: watchStatus().state, base: baseTitle() }));
check("grabFrame 무응답: 감지가 멈추지 않고 상태줄·탭 제목에 화면 안 들어옴(소리 없음)", !hid.spoken.some(t => t.includes("들어오지 않아요")) && hid.state === "게임 화면이 안 들어와요" && hid.base === "⚠ 화면 안 들어옴 · 메이플 재획 알리미", hid);
const shown = await ev(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); return document.querySelector("#watchState").textContent; });
check("탭이 다시 보이면 숨은 동안 미룬 상태줄을 바로 그린다", shown === "게임 화면이 안 들어와요", shown);

// 8) 연결 끊김: 상태줄·탭 제목만. 소리 알림은 없음(2026-11-10 사용자 결정)
await ev(() => { __fake.reset(); src.track.dispatchEvent(new Event("ended")); });
await wait(1500);
const lost = () => ev(() => __fake.spoken.filter(t => t.startsWith("화면 연결이 끊겼어요")).length);
check("끊김: 소리 알림 없음", (await lost()) === 0 && (await ev(() => __fake.spoken.length)) === 0, await ev(() => __fake.spoken.slice()));
check("끊김 상태줄 · 탭 제목", (await txt("#watchState")) === "연결 끊김 · 알림이 멈췄어요" && (await ev(() => baseTitle())) === "⚠ 연결 끊김 · 메이플 재획 알리미");
for (let i = 0; i < 3; i++) { await ev(() => __fake.skew(121000)); await wait(1500); }
check("끊김: 2분이 지나도 다시 알리지 않음", (await lost()) === 0, await lost());

// 9) 화면이 다시 들어오면(화면 안 들어옴 → 복구) 음성만. 새로 연결하면 다시 감시 중
await ev(() => __fake.reset()); await page.click("#btnConnect"); await wait(3000);
check("다시 연결: 감시 중 · 시작 음성 없음", (await txt("#watchState")) === "감시 중" && (await ev(() => __fake.spoken.length)) === 0);
await ev(() => location.reload()); await wait(1500);
check("연결한 적이 있으면 새로고침 뒤 설명서가 접혀 있음", (await ev(() => document.querySelector("#helpDetails").open)) === false);
const shownHidden = await ev(() => [...document.querySelectorAll("[hidden]")].filter(e => getComputedStyle(e).display !== "none").map(e => e.id || e.className || e.tagName));
check("hidden 속성인 요소는 화면에 보이지 않는다", shownHidden.length === 0, shownHidden);
done();
