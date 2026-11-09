// 수동 타이머(묶음 2): 프리셋 시작·미리 알림·정책·루틴·새로고침 복원·삭제 확인·늦은 판정·상한
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const fs = await import("node:fs/promises");
const harness = await fs.readFile("__ROOT__/tests/browser/fake-screen.js", "utf8");
let { page, ev, wait } = await open(taskSpace, {});
const J = JSON.stringify;
const spoken = () => ev(() => __fake.spoken.slice());
const card = (id, s) => ev(([id, s]) => { const e = document.querySelector(`#manual-${id} [data-s=${s}]`); return e && e.textContent; }, [id, s]);
const btn = (id, text) => ev(([id, text]) => [...document.querySelectorAll(`#manual-${id} button`)].find(b => b.textContent === text).click(), [id, text]);

// 1) 패널
const chips = await ev(() => [...document.querySelectorAll("#manualPresets button")].map(b => b.textContent));
check("패널: 프리셋 칩 7개 + 내 프리셋", J(chips) === J(["5분", "10분", "15분", "20분", "30분", "1시간", "2시간", "+ 내 프리셋"]), chips);

// 2) 프리셋 칩 한 번에 시작 → 10초 전 미리 알림(같은 음 두 번) → 끝은 무음(미리 알림을 들었으므로)
await page.click("#manualPresets button:first-child"); await wait(800);
const m1 = await ev(() => ({ ids: manual.timers.map(t => t.id + ":" + t.label + ":" + t.status), time: document.querySelector("#manual-m1 [data-s=time]").textContent }));
check("프리셋: 5분 타이머가 바로 실행", m1.ids[0] === "m1:5분 타이머:running" && /^(5:00|4:59)$/.test(m1.time), m1);
await ev(() => { __fake.reset(); __fake.skew(290_000); }); await wait(1500);
const pre = await ev(() => ({ spoken: __fake.spoken.slice(), osc: __fake.osc.slice() }));
check("미리 알림: 5분 타이머 10초 전, 같은 음 두 번", J(pre.spoken) === J(["5분 타이머 10초 전"]) && J(pre.osc) === J([["square", 988], ["square", 988]]), pre);
await ev(() => { __fake.reset(); __fake.skew(10_000); }); await wait(1500);
const end = await ev(() => ({ spoken: __fake.spoken.slice(), time: document.querySelector("#manual-m1 [data-s=time]").textContent, clear: !document.querySelector("#manualClearDone").hidden }));
check("끝: 미리 알림이 들렸으면 무음, 카드는 끝났어요, 끝난 것 지우기 버튼", end.spoken.length === 0 && end.time === "끝났어요" && end.clear, end);

// 3) 직접 입력 + 미리 알림 0초 → 끝 알림이 울린다(내려가는 두 음)
await page.fill("#manualPre", "0"); await ev(() => document.querySelector("#manualPre").dispatchEvent(new Event("change")));
await page.fill("#manualName", "경쿠"); await page.fill("#manualDur", "0:30"); await page.click("#manualForm button.primary"); await wait(500);
await ev(() => { __fake.reset(); __fake.skew(31_000); }); await wait(1500);
const e2 = await ev(() => ({ spoken: __fake.spoken.slice(), osc: __fake.osc.slice() }));
check("미리 알림 0초: 경쿠 끝났어요(내려가는 두 음)", J(e2.spoken) === J(["경쿠 끝났어요"]) && J(e2.osc) === J([["square", 784], ["square", 523]]), e2);

// 4) 사냥·회수 루틴(미리 알림 5초): 회수 5초 전 → 전환은 무음, 카드는 회수·1바퀴째
await page.fill("#manualPre", "5"); await ev(() => document.querySelector("#manualPre").dispatchEvent(new Event("change")));
await ev(() => { document.querySelector("#manualRoutineBox").open = true; });
await page.fill("#manualRoutine [name=d1]", "0:20"); await page.fill("#manualRoutine [name=d2]", "0:15");
await page.click("#manualRoutine button.primary"); await wait(500);
await ev(() => { __fake.reset(); __fake.skew(15_500); }); await wait(1500);
check("루틴: 회수 5초 전", J(await spoken()) === J(["회수 5초 전"]), await spoken());
await ev(() => { __fake.reset(); __fake.skew(5_000); }); await wait(1500);
const sw = { spoken: await spoken(), phase: await card("m3", "phase") };
check("루틴 전환: 미리 알림을 들었으므로 무음, 카드는 회수 · 1바퀴째", sw.spoken.length === 0 && sw.phase === "회수 · 1바퀴째", sw);

// 5) 새로고침해도 타이머가 이어진다(끝 시각 저장)
const before = await ev(() => manual.timers.map(t => [t.id, t.status, t.endAt]));
await page.reload(); await wait(1200); await page.evaluate(harness);
const after = await ev(() => manual.timers.map(t => [t.id, t.status, t.endAt]));
check("새로고침: 같은 타이머·상태·끝 시각", J(after) === J(before), { before, after });

// 6) 실행 중인 타이머 삭제는 두 번 눌러야 한다
await btn("m3", "삭제"); await wait(200);
const armed = await ev(() => ({ n: manual.timers.length, text: document.querySelector("#manual-m3 .mt-del").textContent }));
await btn("m3", "정말 지울까요?"); await wait(300);
const gone = await ev(() => manual.timers.map(t => t.id));
check("실행 중 삭제: 한 번 누르면 확인 문구, 다시 누르면 지움", armed.n === 3 && armed.text === "정말 지울까요?" && !gone.includes("m3"), { armed, gone });

// 7) 자리를 비운 사이(15초 넘게 늦음) 끝난 타이머는 소리 없이 따라잡고 안내
await page.fill("#manualPre", "10"); await ev(() => document.querySelector("#manualPre").dispatchEvent(new Event("change")));
await page.fill("#manualName", "늦음"); await page.fill("#manualDur", "0:30"); await page.click("#manualForm button.primary"); await wait(500);
await ev(() => { __fake.reset(); __fake.skew(60_000); }); await wait(1500);
const late = await ev(() => ({ spoken: __fake.spoken.slice(), note: document.querySelector("#watchNote").textContent, st: manual.timers.find(t => t.label === "늦음").status }));
check("늦은 판정: 소리 없이 끝남, 상태줄 안내", late.spoken.length === 0 && late.st === "done" && late.note === "자리를 비운 사이 지난 알림이 있어요: 늦음", late);

// 8) 8개 상한
for (let i = 0; i < 8; i++) { const off = await ev(() => document.querySelector("#manualPresets button").disabled); if (off) break; await page.click("#manualPresets button:first-child"); await wait(150); }
const cap = await ev(() => ({ n: manual.timers.length, dis: document.querySelector("#manualPresets button").disabled, note: document.querySelector("#manualNote").textContent }));
check("상한: 8개면 만들기 버튼이 꺼지고 안내", cap.n === 8 && cap.dis && cap.note === "타이머는 8개까지 만들 수 있어요", cap);
const clr = await ev(() => { document.querySelector("#manualClearDone").click(); return manual.timers.filter(t => t.status === "done").length; });
check("끝난 것 모두 지우기", clr === 0);
done();
