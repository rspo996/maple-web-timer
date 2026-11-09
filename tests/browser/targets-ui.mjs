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
