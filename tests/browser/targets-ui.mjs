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

// ---- F2: 이름 바꾸기 · 순서 · 삭제 후 되돌리기 ----
const V2 = { ver: 2, seq: 3, group: { on: false, windowSec: 10 }, targets: [
  { id: "sol", kind: "buff", name: "솔 야누스", preset: "sol", enabled: true, threshold: 0.75, area: null, tpl: null, frameW: 0, frameH: 0, p: { durationSec: null, leadSec: 10 } },
  { id: "u3", kind: "buff", name: "유니온의 힘", preset: null, enabled: true, threshold: 0.75, area: null, tpl: null, frameW: 0, frameH: 0, p: { durationSec: null, leadSec: 10 } },
  { id: "rune", kind: "rune", name: "룬", preset: null, enabled: true, threshold: 0.8, area: null, tpl: null, frameW: 0, frameH: 0, p: { repeatSec: 60 } } ] };
({ page, ev, wait } = await open(taskSpace, { seed: { "maple-web-timer-v2": V2 }, sounds: ["u3.pre", "u3.gone", "sol.pre"] }));
await wait(1500);
await ev(() => { window.__confirms = []; window.confirm = m => { __confirms.push(m); return true; }; });

// 이름 바꾸기: 중복·빈 이름 거절, 성공하면 카드·소리 그룹·저장에 반영, id는 그대로
await page.click("#card-u3 [data-a=rename]");
await page.fill("#card-u3 [data-s=renameForm] input", "룬"); await page.keyboard.press("Enter");
check("이름 바꾸기: 중복 거절 문구", (await ev(() => document.querySelector("#card-u3 [data-s=renameErr]").textContent)) === "이름을 1~12자로, 다른 대상과 다르게 입력해 주세요");
await page.fill("#card-u3 [data-s=renameForm] input", "  유니온의 부  "); await page.keyboard.press("Enter"); await wait(300);
const rn = await ev(() => ({ name: document.querySelector("#card-u3 [data-s=name]").textContent, groups: [...document.querySelectorAll("#soundRows .snd-group > b")].map(b => b.textContent), saved: JSON.parse(localStorage.getItem("maple-web-timer-v2")).targets[1].name, id: store.targets[1].id }));
check("이름 바꾸기: 카드·소리 그룹·저장 반영, id 유지", rn.name === "유니온의 부" && rn.groups.includes("유니온의 부") && rn.saved === "유니온의 부" && rn.id === "u3", rn);

// 순서: 룬을 위로 → sol, rune, u3. 맨 위 카드의 위로 버튼은 비활성
await page.click("#card-rune [data-a=up]"); await wait(300);
const ord = await ev(() => ({ store: store.targets.map(t => t.id).join(), dom: [...document.querySelectorAll("#cardList .card")].map(c => c.id).join(), saved: JSON.parse(localStorage.getItem("maple-web-timer-v2")).targets.map(t => t.id).join(), groups: [...document.querySelectorAll("#soundRows .snd-group > b")].map(b => b.textContent).join(), upDis: document.querySelector("#card-sol [data-a=up]").disabled, downDis: document.querySelector("#card-u3 [data-a=down]").disabled }));
check("순서: 저장·카드·소리 목록이 함께 바뀜, 끝 버튼 비활성", ord.store === "sol,rune,u3" && ord.dom === "card-sol,card-rune,card-u3" && ord.saved === ord.store && ord.groups.startsWith("솔 야누스,룬,유니온의 부") && ord.upDis && ord.downDis, ord);

// 삭제: 확인 문구(내 소리 2개), 즉시 사라짐, 슬롯은 아직 IndexedDB에 있음 → 되돌리기로 같은 위치·소리 복원
await page.click("#card-u3 [data-a=delete]"); await wait(400);
const del = await ev(async () => ({ msg: __confirms[0], ids: store.targets.map(t => t.id).join(), bar: !document.querySelector("#undoBar").hidden, text: document.querySelector("#undoText").textContent, keys: await new Promise(res => { const r = indexedDB.open("maple-web-timer", 1); r.onsuccess = () => { const q = r.result.transaction("sounds").objectStore("sounds").getAllKeys(); q.onsuccess = () => res(q.result.sort()); }; }) }));
check("삭제: 확인 문구에 내 소리 2개", del.msg === '"유니온의 부" 대상을 지울까요? 내 소리 2개도 함께 지워져요.', del.msg);
check("삭제: 목록에서 즉시 빠지고 되돌리기 바, 소리 파일은 10초간 보관", del.ids === "sol,rune" && del.bar && del.text.includes("지웠어요") && del.keys.includes("u3.pre") && del.keys.includes("u3.gone"), del);
await page.click("#undoBtn"); await wait(400);
const back2 = await ev(() => ({ ids: store.targets.map(t => t.id).join(), bar: document.querySelector("#undoBar").hidden, custom: [...customSounds.keys()].sort().join(), name: store.targets[2].name }));
check("되돌리기: 같은 위치·이름, 내 소리 복원, 바 숨김", back2.ids === "sol,rune,u3" && back2.bar && back2.custom.includes("u3.gone") && back2.custom.includes("u3.pre") && back2.name === "유니온의 부", back2);

// 다시 지우고 10초가 지나면 IndexedDB에서 슬롯이 사라지고 바가 숨는다. 내 소리가 없는 대상은 뒷문장 없이 확인
await page.click("#card-u3 [data-a=delete]"); await wait(11000);
const gone = await ev(async () => ({ bar: document.querySelector("#undoBar").hidden, keys: await new Promise(res => { const r = indexedDB.open("maple-web-timer", 1); r.onsuccess = () => { const q = r.result.transaction("sounds").objectStore("sounds").getAllKeys(); q.onsuccess = () => res(q.result.sort()); }; }) }));
check("10초 뒤: 슬롯 삭제(sol.pre는 남음), 되돌리기 바 숨김", JSON.stringify(gone.keys) === JSON.stringify(["sol.pre"]) && gone.bar, gone);
await page.click("#card-rune [data-a=delete]"); await wait(300);
check("삭제 확인: 내 소리가 없으면 뒷문장 생략", (await ev(() => __confirms[__confirms.length - 1])) === '"룬" 대상을 지울까요?');
await page.click("#btnAdd"); await ev(() => [...document.querySelectorAll("#addMenu button")].find(b => b.textContent === "룬").click()); await wait(300);
check("지운 내장 대상은 같은 id로 복원", (await ev(() => store.targets.some(t => t.id === "rune"))));
done();
