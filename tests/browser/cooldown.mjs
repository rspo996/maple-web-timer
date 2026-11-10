// 설치기 쿨타임(묶음 4): 추가·등록·보정·pre·ready(정책)·짧은 어두움·안 보임·해상도
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done, drag } = await import(ROOT + "prelude.mjs");
const J = JSON.stringify;
const { page, ev, wait } = await open(taskSpace, { connect: true });
await ev(() => __fake.pattern("skill", 600, 650, 21, 32));
const banner = () => ev(() => document.querySelector("#banner").classList.contains("on") ? document.querySelector("#bannerText").textContent : null);
const st = () => ev(() => { const t = store.targets.find(x => x.kind === "cooldown"), c = document.querySelector(`#card-${t.id}`);
  return { status: c.querySelector("[data-s=status]").textContent, sub: c.querySelector("[data-s=sub]").textContent, score: c.querySelector("[data-s=score]").textContent,
    note: document.querySelector("#watchNote").textContent, spoken: __fake.spoken.slice(), osc: __fake.osc.slice() }; });
const act = label => ev(l => { const t = store.targets.find(x => x.kind === "cooldown"); [...document.querySelectorAll(`#card-${t.id} button`)].find(b => b.textContent === l).click(); }, label);

// 1) 추가 → 설치기 쿨타임: 이름 설치기 1, 등록 배너(아이콘 한 번)
await page.click("#btnAdd");
const menu = await ev(() => [...document.querySelectorAll("#addMenu button")].map(b => b.textContent));
check("메뉴: 다른 알림에 사냥 멈춤·설치기 쿨타임", menu.includes("사냥 멈춤") && menu.includes("설치기 쿨타임"), menu);
await ev(() => [...document.querySelectorAll("#addMenu button")].find(b => b.textContent === "설치기 쿨타임").click());
await wait(800);
check("추가: 설치기 1, 등록 배너", (await banner()) === "설치기 1 ① 퀵슬롯에서 쿨타임 없이 밝게 보이는 스킬 아이콘 하나만 꼭 맞게 드래그하세요", await banner());

// 2) 어두운 상태로 등록하면 거절, 밝을 때 등록
await ev(() => __fake.shade("skill", 0.7)); await wait(400); await page.click("#btnRetake"); await wait(600);
await drag(page, 600, 650, 632, 682); await wait(300);
check("검사: 어두운 아이콘 거절", ((await banner()) || "").startsWith("⚠ 아이콘이 어두워 보여요. 쿨타임이 아닐 때 다시 등록해 주세요"), await banner());
await ev(() => __fake.shade("skill", 0)); await wait(400); await page.click("#btnRetake"); await wait(600);
await drag(page, 600, 650, 632, 682); await wait(600);
const reg = await ev(() => { const t = store.targets.find(x => x.kind === "cooldown"); return { area: t.area, tpl: !!t.tpl, th: t.threshold, note: document.querySelector("#watchNote").textContent }; });
check("등록: 검색 영역은 사방 8px, 기준값 0.7, 안내", J(reg.area) === J({ x: 592, y: 642, w: 48, h: 48 }) && reg.tpl && reg.th === 0.7 && reg.note.startsWith("설치기 1 등록했어요"), reg);
await wait(1500);
const r0 = await st();
check("밝음: 쓸 수 있음, 일치도(기준값 0.7 이상)·밝기 표시, 기준 미확인", r0.status === "쓸 수 있음" && parseFloat(r0.score) >= 0.7 && /· 밝기 (0\.9\d|1\.\d\d) ·/.test(r0.score) && r0.score.includes("쿨타임 기준 미확인"), r0);

// 3) 지속시간 0:20, 미리 알림 5초
await ev(() => { const t = store.targets.find(x => x.kind === "cooldown"), c = document.querySelector(`#card-${t.id}`);
  const l = c.querySelector("[data-f=leadSec]"); l.value = "5"; l.dispatchEvent(new Event("change"));
  const d = c.querySelector("[data-f=durationSec]"); d.value = "0:20"; d.dispatchEvent(new Event("change")); });

// 4) 쓰면(어두워짐) 쿨타임 중 → 쿨타임 중 찍기로 보정
await ev(() => { __fake.reset(); __fake.shade("skill", 0.6); }); await wait(1500);
const d1 = await st();
check("어두워짐: 쿨타임 중 · 경과, 사라지기까지", /^쿨타임 중 · 00:0\d 경과$/.test(d1.status) && d1.sub.startsWith("사라지기까지"), d1);
await act("쿨타임 중 찍기"); await wait(2200);
const cal = await ev(() => { const t = store.targets.find(x => x.kind === "cooldown"); return { p: t.p, note: document.querySelector("#watchNote").textContent }; });
check("보정: 밝기 0.4대로 내려가요, 기준 저장", cal.p.calibrated === true && cal.p.gainLo < 0.65 && /^설치기 1 · 쿨타임 때 밝기가 0\.\d\d로 내려가요\. 구분할 수 있어요$/.test(cal.note), cal);

// 5) 지속시간-미리 알림(15초)에 "5초 뒤 사라져요", 그 주기의 다시 밝아짐은 무음
await ev(() => { __fake.reset(); __fake.skew(14_000); }); await wait(2800);
const p1 = await st();
check("pre: 설치기 1 5초 뒤 사라져요", J(p1.spoken) === J(["설치기 1 5초 뒤 사라져요"]) && p1.sub === "곧 사라져요 알림을 울렸어요", p1);
await ev(() => { __fake.reset(); __fake.shade("skill", 0); }); await wait(2800);
const rd1 = await st();
check("pre 뒤 다시 밝아짐: 무음, 카드는 쓸 수 있음", rd1.spoken.length === 0 && rd1.status === "쓸 수 있음", rd1);

// 6) 새로 쓰고 pre 전에 밝아져도 알림 없음, 카드만 쓸 수 있음("다시 쓸 수 있어요" 알림은 뺌(2026-11-10 사용자 결정))
await ev(() => { __fake.reset(); __fake.shade("skill", 0.6); }); await wait(1500);
await ev(() => __fake.skew(4_000)); await wait(600);
await ev(() => __fake.shade("skill", 0)); await wait(2800);
const rd2 = await st();
check("pre 전에 밝아짐: 소리 없음, 카드는 쓸 수 있음", rd2.spoken.length === 0 && rd2.osc.length === 0 && rd2.status === "쓸 수 있음", rd2);

// 7) 3초 미만으로 어두웠다 밝아지면 알림 없음
await ev(() => { __fake.reset(); __fake.shade("skill", 0.6); }); await wait(1200);
await ev(() => __fake.shade("skill", 0)); await wait(2500);
check("짧은 어두움(MP 부족 등): 알림 없음", (await st()).spoken.length === 0, (await st()).spoken);

// 8) 다른 아이콘이 오면 확인 중, 90초 넘으면 "아이콘이 안 보여요"(낮은 경고음)
await ev(() => { __fake.reset(); __fake.pattern("skill", 600, 650, 77, 32); }); await wait(1200);
const u1 = await st();
await ev(() => __fake.skew(91_000)); await wait(2500);
const u2 = await st();
check("안 보임: 아이콘 확인 중 → 90초 뒤 한 번 알림(톱니파)", u1.status === "아이콘 확인 중" && J(u2.spoken) === J(["설치기 1 아이콘이 안 보여요"]) && u2.osc.length && u2.osc[0][0] === "sawtooth", { u1, u2 });

// 9) 해상도가 바뀌면 다시 등록 필요
await ev(() => { __fake.pattern("skill", 600, 650, 21, 32); __fake.resize(1920, 1080); }); await wait(1500);
check("해상도 변경: 다시 등록 필요", (await st()).status === "다시 등록 필요");
const ms = await ev(() => { const t = store.targets.find(x => x.kind === "cooldown"); return states[t.id].ms; });
check("감지 시간(대상 하나) 5ms 이하", ms != null && ms <= 5, ms);
const shownHidden = await ev(() => [...document.querySelectorAll("[hidden]")].filter(e => getComputedStyle(e).display !== "none").map(e => e.id || e.className || e.tagName));
check("hidden 속성인 요소는 화면에 보이지 않는다", shownHidden.length === 0, shownHidden);
done();
