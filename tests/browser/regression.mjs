// 오늘까지의 감시·알림 동작 회귀 검사 (내장 아이콘 + 가짜 화면). 사용: ego-browser nodejs < 이 파일 (ABS 경로는 아래 ROOT)
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const { ev, wait } = await open(taskSpace, { connect: true });
const txt = sel => ev(s => document.querySelector(s).textContent, sel);

// 1) 연결 직후
check("연결: 상태줄", (await txt("#watchState")) === "감시 중");
check("연결: 탭 제목", (await ev(() => document.title)) === "● 감시 중 · 메이플 재획 알리미");
const first = await ev(() => ({ cards: ["sol", "booster", "rune"].map(i => document.querySelector(`#card-${i} [data-s=status]`).textContent), spoken: __fake.spoken.slice() }));
check("연결: 카드 문구", JSON.stringify(first.cards) === JSON.stringify(["아직 못 찾음", "아직 못 찾음", "등록 필요"]), first.cards);
check("연결: 시작 음성", first.spoken[0] === "감시 시작할게요. 룬은 등록이 필요해요", first.spoken);

// 2) 솔 야누스(내장 아이콘)가 켜짐 → 학습 중, 3) 지속시간 1:00 + 51초 뒤 미리 알림 한 번
await ev(() => { __fake.reset(); __fake.image("sol", document.querySelector("#card-sol .thumb").src, 1100, 50, 32, 32); });
await wait(2500);
check("솔 야누스 켜짐 · 학습 중", (await txt("#card-sol [data-s=status]")) === "켜짐 · 학습 중");
check("일치도 표시", (await txt("#card-sol [data-s=score]")).startsWith("1.00 ✔"));
await ev(() => { const i = document.querySelector("#t-sol-dur"); i.value = "1:00"; i.dispatchEvent(new Event("change")); __fake.skew(51000); });
await wait(3500);
const pre = await ev(() => ({ spoken: __fake.spoken.slice(), beeps: __fake.beeps }));
check("미리 알림 음성 한 번", JSON.stringify(pre.spoken) === JSON.stringify(["솔 야누스 10초 전"]), pre);
check("미리 알림 비프 3음", pre.beeps === 3, pre);

// 4) 꺼져도 꺼짐 알림 없음(정책)
await ev(() => { __fake.reset(); __fake.show("sol", false); });
await wait(3500);
const off = await ev(() => ({ spoken: __fake.spoken.slice(), st: document.querySelector("#card-sol [data-s=status]").textContent }));
check("미리 알림 뒤 꺼짐 알림 없음", off.spoken.length === 0 && off.st === "꺼져 있음", off);

// 5) 화면이 검게 멈춤 → 10초 뒤 알림, 복구 시 음성만
await ev(() => { __fake.reset(); __fake.black(true); });
await wait(1200);
await ev(() => __fake.skew(11000));
await wait(1500);
const stall = await ev(() => ({ spoken: __fake.spoken.slice(), state: document.querySelector("#watchState").textContent }));
check("화면 안 들어옴 알림", stall.spoken.includes("게임 화면이 들어오지 않아요") && stall.state === "게임 화면이 안 들어와요", stall);
await ev(() => { __fake.reset(); __fake.black(false); });
await wait(2500);
const back = await ev(() => ({ spoken: __fake.spoken.slice(), state: document.querySelector("#watchState").textContent }));
check("복구는 음성만", back.spoken.includes("게임 화면이 다시 들어와요") && back.state === "감시 중", back);

// 6) 연결 끊김: 즉시 1번 + 2분 간격 2번에서 멈춤(총 3번)
await ev(() => { __fake.reset(); src.track.dispatchEvent(new Event("ended")); });
await wait(1500);
const lost = () => ev(() => __fake.spoken.filter(t => t.startsWith("화면 연결이 끊겼어요")).length);
check("끊김 즉시 1번", (await lost()) === 1, await lost());
check("끊김 상태줄", (await txt("#watchState")) === "연결 끊김 · 알림이 멈췄어요");
for (let i = 0; i < 3; i++) { await ev(() => __fake.skew(121000)); await wait(1500); }
check("끊김 재알림은 총 3번에서 멈춤", (await lost()) === 3, await lost());
done();
