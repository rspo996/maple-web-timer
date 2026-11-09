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
const shownHidden = await ev(() => [...document.querySelectorAll("[hidden]")].filter(e => getComputedStyle(e).display !== "none").map(e => e.id || e.className || e.tagName));
check("hidden 속성인 요소는 화면에 보이지 않는다", shownHidden.length === 0, shownHidden);
done();
