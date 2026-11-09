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
const after = await ev(() => ({ st: document.querySelector("#card-rune [data-s=status]").textContent, spoken: __fake.spoken.slice(), osc: JSON.stringify(__fake.osc.slice(0, 3)) }));
check("등록 뒤 룬 감지: 룬 있음 + 나왔어요 음성 + 올라가는 세 음", after.st === "룬 있음!" && after.spoken.includes("룬이 나왔어요") && after.osc === JSON.stringify([["square", 880], ["square", 1175], ["square", 1568]]), after);

// 3) 알림 테스트 버튼은 개별 알림
await ev(() => __fake.reset());
await page.click("#card-sol [data-a=toggle]"); await page.click("#card-sol [data-a=test]"); await wait(2500);
check("알림 테스트: 솔 야누스 10초 전", JSON.stringify(await ev(() => __fake.spoken)) === JSON.stringify(["솔 야누스 10초 전"]));

// 4) 해상도 변경 → 다시 등록 필요
await ev(() => __fake.resize(1920, 1080)); await wait(1500);
const rr = await ev(() => ({ st: document.querySelector("#card-rune [data-s=status]").textContent, strip: document.querySelector("#watchTargets").textContent }));
check("해상도 변경: 다시 등록 필요", rr.st === "다시 등록 필요" && rr.strip.includes("룬 다시 등록"), rr);
done();
