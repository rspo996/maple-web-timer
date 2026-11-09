// 카드의 "사용" 끄기, 직접 등록한 아이콘을 기본 아이콘으로 되돌리기, 첫 등록 중 "취소" 버튼(대상이 빠짐)
const { open, check, done } = await import("file://__ROOT__/tests/browser/prelude.mjs");
const { page, ev, wait } = await open(taskSpace, { connect: true, seed: { "maple-web-timer-ui": { connectedOnce: true, open: { sol: true } } } });
// 1) 사용 끄기
await page.click("#card-sol [data-k=enabled]"); await wait(300);
let r = await ev(() => ({ en: store.targets[0].enabled, saved: JSON.parse(localStorage.getItem("maple-web-timer-v2")).targets[0].enabled, strip: document.querySelector("#watchTargets").textContent, mini: document.querySelector("#card-sol [data-s=mini]").textContent }));
check("사용 끄기: 저장, 상태줄에 꺼둠", r.en === false && r.saved === false && r.strip.includes("솔 야누스 꺼둠"), r);
await page.click("#card-sol [data-k=enabled]"); await wait(300);
// 2) 직접 등록한 아이콘 → 기본 아이콘으로 되돌리기
await ev(() => { const t = store.targets[0]; t.tpl = { url: __fake.patternURL(3), w: 32, h: 32 }; t.area = { x: 0, y: 0, w: 100, h: 100 }; t.frameW = 1280; t.frameH = 720; saveTargets(); onTargetsChanged(); });
await wait(300);
r = await ev(() => getComputedStyle(document.querySelector("#card-sol [data-a=reset]")).display);
check("직접 등록하면 되돌리기 버튼이 보임", r !== "none", r);
await page.click("#card-sol [data-a=reset]"); await wait(300);
r = await ev(() => ({ tpl: store.targets[0].tpl, disp: getComputedStyle(document.querySelector("#card-sol [data-a=reset]")).display, note: document.querySelector("#watchNote").textContent }));
check("되돌리기: 아이콘 지움, 버튼 숨김, 안내", r.tpl === null && r.disp === "none" && r.note === "솔 야누스 기본 아이콘으로 되돌렸어요", r);
// 3) 새 대상 추가 → 등록 시작(첫 등록) → 취소 버튼이면 목록에서 빠짐
await page.click("#btnAdd"); await wait(200); await page.click("text=유니온의 힘"); await wait(800);
r = await ev(() => ({ on: document.querySelector("#banner").classList.contains("on"), text: document.querySelector("#bannerText").textContent, n: store.targets.length }));
check("추가 → 등록 안내줄", r.on && r.text.startsWith("유니온의 힘 ① ") && r.n === 4, r);
await page.click("#btnCancel"); await wait(300);
r = await ev(() => ({ on: document.querySelector("#banner").classList.contains("on"), n: store.targets.length, card: !!document.querySelector("#card-u1"), note: document.querySelector("#watchNote").textContent }));
check("취소 버튼: 안내줄 닫힘, 첫 등록 대상은 빠짐", !r.on && r.n === 3 && !r.card && r.note === "유니온의 힘 등록을 취소해서 목록에서 뺐어요", r);
done();
