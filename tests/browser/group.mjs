// 가까운 알림 묶기: 설정 · 당겨 알림 · 개별 · 내 소리 · 룬 비포함 (Task G3)
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const J = JSON.stringify;
// 등록(드래그)을 건너뛰고 대상에 직접 템플릿을 넣는다: fake-screen의 patternURL이 같은 그림을 만든다
const addPatternBuff = (ev, name, seed, x, y) => ev(a => {
  const r = addBuff(store, a.name); const t = r.target;
  Object.assign(t, { tpl: { url: __fake.patternURL(a.seed, 32), w: 32, h: 32 }, area: { x: a.x - 100, y: a.y - 40, w: 300, h: 120 }, frameW: 1280, frameH: 720 });
  __fake.pattern(t.id, a.x, a.y, a.seed, 32); __fake.show(t.id, false); saveTargets(); onTargetsChanged(); return t.id;
}, { name, seed, x, y });
// 버프를 켠다: 아이콘을 보이고 남은 시간 숫자 1:00부터 찍는다(버프는 아이콘 숫자로 센다, 2026-11-11)
const showBuff = (ev, id) => ev(x => { __fake.show(x, true); __fake.timer(x, 60); }, id);
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
  const a = await addPatternBuff(t.ev, "버프A", 21, 700, 100), b = await addPatternBuff(t.ev, "버프B", 22, 900, 100);
  await t.wait(2500);
  await showBuff(t.ev, a); await t.wait(2500);
  await t.ev(ms => __fake.skew(ms), gap); await showBuff(t.ev, b); await t.wait(2500);
  await t.ev(() => __fake.reset());
  return { ...t, a, b };
}
let T = await twoBuffs(3000, { on: true, windowSec: 10 });
await T.ev(() => __fake.skew(46500)); await T.wait(3500);   // A의 숫자가 약 6초(미리 알림 10초 이하). B는 약 11초 → 묶기 한계(10+10=20) 안
const g1 = await T.ev(() => ({ spoken: __fake.spoken.slice(), toast: document.querySelector("#toast").textContent, flashed: [...document.querySelectorAll(".card.flash")].map(c => c.id).sort(), alerted: Object.fromEntries(store.targets.map(t => [t.name, states[t.id].alertedPre])) }));
check("묶기 켬 + 3초 차이: 묶인 음성 한 번", J(g1.spoken) === J(["버프A, 버프B 곧 꺼져요"]), g1);
check("묶인 알림: 토스트 한 줄, 두 카드 깜빡임, 둘 다 미리 알림 처리", g1.toast === "버프A, 버프B 곧 꺼져요" && J(g1.flashed) === J(["card-" + T.a, "card-" + T.b]) && g1.alerted["버프A"] && g1.alerted["버프B"], g1);
await T.ev(() => { __fake.reset(); __fake.skew(20000); }); await T.wait(2500);
check("당겨진 버프는 자기 미리 알림·꺼짐 알림을 다시 울리지 않음", J(await T.ev(() => __fake.spoken)) === J([]));

// ---- 11초 차이: 당겨지지 않고 개별 두 번 ----
T = await twoBuffs(11000, { on: true, windowSec: 10 });
await T.ev(() => __fake.skew(34500)); await T.wait(3000);   // A의 숫자 약 10초: B는 약 23초(>20)
const g2a = await T.ev(() => __fake.spoken.slice());
await T.ev(() => __fake.skew(16000)); await T.wait(3000);
const g2b = await T.ev(() => __fake.spoken.slice());
check("묶기 켬 + 11초 차이: 개별 알림 두 번", J(g2a) === J(["버프A 곧 꺼져요"]) && J(g2b) === J(["버프A 곧 꺼져요", "버프B 곧 꺼져요"]), { g2a, g2b });

// ---- 묶기 끔: 3초 차이라도 개별 ----
T = await twoBuffs(3000, { on: false, windowSec: 10 });
await T.ev(() => __fake.skew(48000)); await T.wait(5000);
const g3 = await T.ev(() => __fake.spoken.slice());
check("묶기 끔: 개별 알림 두 번", J(g3) === J(["버프A 곧 꺼져요", "버프B 곧 꺼져요"]), g3);

// ---- grp.pre 내 소리가 있으면 그 소리만(비프·음성 없음) ----
T = await (async () => { const t = await open(taskSpace, { seed: { "maple-web-timer-v2": V2({ on: true, windowSec: 10 }) }, sounds: ["grp.pre"], connect: true }); return t; })();
const a4 = await addPatternBuff(T.ev, "버프A", 21, 700, 100), b4 = await addPatternBuff(T.ev, "버프B", 22, 900, 100);
await T.ev(() => { window.__recs = []; Alerts.listen(r => __recs.push(r)); });
await T.wait(2500); await showBuff(T.ev, a4); await T.wait(2500); await T.ev(ms => __fake.skew(ms), 3000); await showBuff(T.ev, b4); await T.wait(2500);
await T.ev(() => { __fake.reset(); __fake.skew(46500); }); await T.wait(3000);
const g4 = await T.ev(() => ({ recs: __recs.map(r => [r.grouped, r.custom, r.ids.length]), spoken: __fake.spoken.slice(), beeps: __fake.beeps }));
check("묶인 알림 + grp.pre 내 소리: 그 소리만 재생(기본 비프·음성 없음)", J(g4.recs) === J([[true, true, 2]]) && g4.spoken.length === 0 && g4.beeps === 0, g4);

// ---- 룬은 묶이지 않고 바로 ----
T = await open(taskSpace, { seed: { "maple-web-timer-v2": V2({ on: true, windowSec: 20 }) }, connect: true });
await T.ev(() => { const t = addBuiltin(store, "rune").target; Object.assign(t, { tpl: { url: __fake.patternURL(31, 24), w: 24, h: 24 }, area: { x: 100, y: 500, w: 300, h: 200 }, frameW: 1280, frameH: 720 }); __fake.pattern("rune", 300, 600, 31, 24); __fake.show("rune", false); saveTargets(); onTargetsChanged(); });
await T.wait(2500); await T.ev(() => { __fake.reset(); __fake.show("rune", true); }); await T.wait(3500);
check("룬 출현은 묶기를 켜도 바로 알림", J(await T.ev(() => __fake.spoken.slice())) === J(["룬이 나왔어요"]));
done();
