// 사냥 멈춤(묶음 3): 추가·검사·등록·정지 알림·반복·재무장·끊김·계속 변함·쉬기·해상도
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done, drag } = await import(ROOT + "prelude.mjs");
const J = JSON.stringify;
const { page, ev, wait } = await open(taskSpace, { connect: true });
await ev(() => { __fake.pattern("xpA", 300, 680, 11, 24); __fake.pattern("xpB", 324, 680, 12, 24); });   // 경험치 막대·숫자 대신 무늬 두 개(48×24)
const banner = () => ev(() => document.querySelector("#banner").classList.contains("on") ? document.querySelector("#bannerText").textContent : null);
const st = () => ev(() => { const t = store.targets.find(x => x.kind === "idle"), c = document.querySelector(`#card-${t.id}`);
  return { status: c.querySelector("[data-s=status]").textContent, sub: c.querySelector("[data-s=sub]").textContent, score: c.querySelector("[data-s=score]").textContent,
    strip: document.querySelector("#watchTargets").textContent, spoken: __fake.spoken.slice(), osc: __fake.osc.slice() }; });
const act = label => ev(l => { const t = store.targets.find(x => x.kind === "idle"); [...document.querySelectorAll(`#card-${t.id} button`)].find(b => b.textContent === l).click(); }, label);
const changeFor = async ticks => { for (let i = 0; i < ticks; i++) { await ev(i => __fake.pattern("xpA", 300, 680, 100 + i + Math.floor(Math.random() * 1e6), 24), i); await wait(500); } };

// 1) 대상 추가 → 다른 알림 → 사냥 멈춤: 등록 배너가 바로 열림
await page.click("#btnAdd");
await ev(() => [...document.querySelectorAll("#addMenu button")].find(b => b.textContent === "사냥 멈춤").click());
await wait(800);
check("추가: 등록 배너(영역 한 번, 꼭 맞게, 숫자 포함 안내)", (await banner()) === "사냥 멈춤 ① 경험치 막대와 숫자를 한 번에 꼭 맞게 드래그하세요 · 경험치 숫자나 퍼센트가 영역에 들어가야 해요", await banner());

// 2) 너무 작은 영역은 거절하고 다시 드래그
await drag(page, 300, 680, 330, 700); await wait(300);
check("검사: 너무 작은 영역 거절", ((await banner()) || "").startsWith("⚠ 영역이 너무 작아요 · 사냥 멈춤 ①"), await banner());
await drag(page, 296, 676, 352, 708); await wait(500);
const reg = await ev(() => { const t = store.targets.find(x => x.kind === "idle"); return { area: t.area, thumb: (t.p.thumb || "").slice(0, 22), note: document.querySelector("#watchNote").textContent, open: document.querySelector("#banner").classList.contains("on") }; });
check("등록: 영역·썸네일 저장, 안내", !reg.open && reg.area && reg.area.w === 56 && reg.thumb === "data:image/png;base64," && reg.note === "사냥 멈춤 등록했어요 · 사냥하면서 변화량 숫자가 움직이는지 확인해 주세요", reg);
await page.click("#btnAdd");
const dis = await ev(() => [...document.querySelectorAll("#addMenu button")].find(b => b.textContent === "사냥 멈춤").disabled);
await page.keyboard.press("Escape");
check("한 개만: 메뉴의 사냥 멈춤이 꺼짐", dis === true);
const slots = await ev(() => [...document.querySelectorAll("#soundRows .snd-group")].filter(g => g.querySelector("b").textContent === "사냥 멈춤").map(g => [...g.querySelectorAll(".snd-row > span:first-child")].map(s => s.textContent)));
check("소리 설정: 사냥 멈춤 · 멈춤 알림 슬롯 하나", J(slots) === J([["멈춤 알림"]]), slots);

// 3) 멈춤 시간 0:10, 반복 5초. 바뀌는 동안은 '움직여요'
await ev(() => { const t = store.targets.find(x => x.kind === "idle"), c = document.querySelector(`#card-${t.id}`);
  const i = c.querySelector("[data-f=idleSec]"); i.value = "0:10"; i.dispatchEvent(new Event("change"));
  const r = c.querySelector("[data-f=repeatSec]"); r.value = "5"; r.dispatchEvent(new Event("change")); });
await changeFor(6);
const mv = await st();
const mvMax = +((/최근 60초 최대 (\d+)/.exec(mv.score) || [])[1] || 0);
check("변하는 중: 경험치가 움직여요, 변화량 표시", mv.status === "경험치가 움직여요" && /^\d+픽셀( ✔)? · 최근 60초 최대 \d+ · 중앙 \d+ · 변화 \d+번/.test(mv.score) && mvMax >= 8, mv);
await wait(1500);   // 스트림(5fps)의 늦은 프레임이 다 들어온 뒤에 시계를 앞당긴다(늦은 프레임이 "변화"로 확정되지 않게)

// 4) 멈춤 → 10초 뒤 알림(느린 두 음 왕복, 삼각파), 상태줄·카드
await ev(() => { __fake.reset(); __fake.skew(11_000); }); await wait(2800);   // 비프(약 1.2초) 뒤에 음성
const a1 = await st();
check("멈춤 알림: 경험치가 N초째 그대로예요 + 삼각파", a1.spoken.length === 1 && /^경험치가 1\d초째 그대로예요$/.test(a1.spoken[0]) && J(a1.osc.slice(0, 4)) === J([["triangle", 587], ["triangle", 440], ["triangle", 587], ["triangle", 440]]), a1);
check("멈춤 중: 카드 alert, 상태줄 '사냥 멈춤 · 경험치 그대로'", a1.status.startsWith("멈춤 · 경험치 그대로") && a1.strip.includes("사냥 멈춤 · 경험치 그대로"), a1);

// 5) 반복은 5초 간격 2번, 그 뒤 없음
for (let i = 0; i < 3; i++) { await ev(() => __fake.skew(5_500)); await wait(2800); }
const a2 = await st();
check("반복: 처음 + 2번에서 멈춤(총 3번)", a2.spoken.length === 3, a2.spoken);

// 6) 다시 변하면 풀리고 '멈췄다가 다시 변했어요'
await changeFor(3);
const rs = await st();
check("재무장: 다시 변하면 움직여요 + 멈췄다가 다시 변했어요", rs.status === "경험치가 움직여요" && /멈췄다가 다시 변했어요$/.test(rs.sub) && !rs.strip.includes("경험치 그대로"), rs);

await wait(1500);
// 7) 검은 화면(맵 이동 암전)이 끼면 시간을 처음부터
// 경계에 걸리지 않게 앞당기는 시간을 6초로 둔다(실제 경과·프레임 지연을 더해도 10초 미만). 처음부터 세지 않으면 g1에서 16초가 넘어 울린다
await ev(() => { __fake.reset(); __fake.skew(6_000); }); await wait(1200);
await ev(() => __fake.black(true)); await wait(1200);
await ev(() => __fake.black(false)); await wait(1500);
await ev(() => __fake.skew(6_000)); await wait(1200);
const g1 = await st();
await ev(() => __fake.skew(4_000)); await wait(2800);
const g2 = await st();
check("암전 뒤 처음부터: 6+6초에는 안 울리고, 다시 10초가 지나야 울림", g1.spoken.length === 0 && g2.spoken.length === 1, { g1: g1.spoken, g2: g2.spoken });

// 8) 영역이 계속 변하면 카드·상태줄에만 표시(음성은 뺌(2026-11-10 사용자 결정))
await ev(() => { __fake.reset(); const t = store.targets.find(x => x.kind === "idle"), S = states[t.id].idle; S.recent.length = 0; for (let i = 0; i < 120; i++) S.recent.push({ at: Date.now() - i * 400, px: 99 }); });
await changeFor(2);
const b1 = await st();
check("계속 변함: 음성 없음, 카드 '영역이 계속 변해요', 상태줄 '영역 확인 필요'", b1.spoken.length === 0 && b1.status === "영역이 계속 변해요" && b1.strip.includes("사냥 멈춤 영역 확인 필요"), b1);
await ev(() => { const t = store.targets.find(x => x.kind === "idle"); states[t.id].idle.recent.length = 0; }); await wait(1200);

// 9) 쉬기: 10분 쉬기 → 멈춰도 알림 없음, 상태줄 '쉬는 중' → 쉬기 끝내기
await act("10분 쉬기"); await wait(600);
await ev(() => { __fake.reset(); __fake.skew(30_000); }); await wait(1500);
const z1 = await st();
check("쉬기: 알림 없음, 카드 쉬는 중 N 남음, 상태줄 쉬는 중", z1.spoken.length === 0 && /^쉬는 중 \d\d:\d\d 남음$/.test(z1.status) && z1.strip.includes("사냥 멈춤 쉬는 중"), z1);
await act("쉬기 끝내기"); await wait(600);
const z2 = await st();
check("쉬기 끝내기: 쉬기 버튼 3개가 돌아오고 시간은 처음부터", !z2.status.startsWith("쉬는 중") && (await ev(() => { const t = store.targets.find(x => x.kind === "idle"); return [...document.querySelectorAll(`#card-${t.id} [data-act]`)].filter(b => !b.hidden).map(b => b.textContent); })).join() === "10분 쉬기,30분 쉬기,변할 때까지 쉬기", z2);

// 10) 해상도가 바뀌면 다시 등록 필요, 알림 없음
await ev(() => { __fake.reset(); __fake.resize(1920, 1080); }); await wait(1500);
await ev(() => __fake.skew(30_000)); await wait(1200);
const rr = await st();
check("해상도 변경: 다시 등록 필요, 상태줄 버튼, 알림 없음", rr.status === "다시 등록 필요" && rr.strip.includes("사냥 멈춤 다시 등록") && rr.spoken.length === 0, rr);
const shownHidden = await ev(() => [...document.querySelectorAll("[hidden]")].filter(e => getComputedStyle(e).display !== "none").map(e => e.id || e.className || e.tagName));
check("hidden 속성인 요소는 화면에 보이지 않는다", shownHidden.length === 0, shownHidden);
done();
