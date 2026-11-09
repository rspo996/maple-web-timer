// 음량 0~200%(묶음 5): 슬라이더·저장·보조 문구·확인음·마스터 체인·음성 상한
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const fs = await import("node:fs/promises");
const harness = await fs.readFile("__ROOT__/tests/browser/fake-screen.js", "utf8");
const J = JSON.stringify;
const { page, ev, wait } = await open(taskSpace, {});
const s0 = await ev(() => { const v = document.querySelector("#vol"); return { min: v.min, max: v.max, step: v.step, value: v.value, pct: document.querySelector("#volPct").textContent, note: document.querySelector("#volNote").hidden, tick: document.querySelector("#volTicks option").value }; });
check("슬라이더: 0~200, 5단위, 기본 80, 80%, 100 눈금, 보조 문구 숨김", J(s0) === J({ min: "0", max: "200", step: "5", value: "80", pct: "80%", note: true, tick: "100" }), s0);

await page.click("h1"); await wait(300);   // 실제 클릭 한 번(사용자 조작) → 첫 조작에서 오디오가 켜진다(running)
// 150%로: 손을 떼면 확인음 한 번(음성 없음), 보조 문구, 저장, 마스터 체인은 리미터 경유
await page.fill("#vol", "150"); await ev(() => { __fake.reset(); const v = document.querySelector("#vol"); v.dispatchEvent(new Event("input")); v.dispatchEvent(new Event("change")); });
await wait(600);
const s1 = await ev(() => ({ pct: document.querySelector("#volPct").textContent, note: document.querySelector("#volNote").hidden, saved: JSON.parse(localStorage.getItem("maple-web-timer-ui")).volumePct,
  osc: __fake.osc.slice(), spoken: __fake.spoken.slice(), out: Alerts.audioOut() === master, state: actx.state, gain: Math.round(master.gain.value * 100) / 100, lim: limiterOn }));
check("150%: 숫자·보조 문구·저장·확인음(딩딩-동)·음성 없음", s1.pct === "150%" && s1.note === false && s1.saved === 150 && J(s1.osc) === J([["square", 1046], ["square", 1046], ["square", 784]]) && s1.spoken.length === 0, s1);
check("마스터 체인: 오디오 running, audioOut이 마스터, 게인 1.5, 100% 초과라 리미터 경유", s1.state === "running" && s1.out && s1.gain === 1.5 && s1.lim === true, s1);

// 음성은 100%를 넘지 못한다
await ev(() => { __fake.reset(); speak("음량 확인"); });
check("150%에서도 음성 음량은 1", J(await ev(() => __fake.volumes.slice())) === J([1]), await ev(() => __fake.volumes.slice()));

// 100%로 내리면 리미터를 빼고(이전과 같은 크기) 보조 문구를 숨긴다
await page.fill("#vol", "100"); await ev(() => { const v = document.querySelector("#vol"); v.dispatchEvent(new Event("input")); v.dispatchEvent(new Event("change")); });
await wait(400);
const s2 = await ev(() => ({ lim: limiterOn, note: document.querySelector("#volNote").hidden, gain: Math.round(master.gain.value * 100) / 100 }));
check("100%: 리미터 빠짐, 보조 문구 숨김, 게인 1", s2.lim === false && s2.note === true && s2.gain === 1, s2);

// 새로고침해도 음량·음성 설정 유지
await page.fill("#vol", "135"); await ev(() => { const v = document.querySelector("#vol"); v.dispatchEvent(new Event("change")); const c = document.querySelector("#voice"); c.checked = false; c.dispatchEvent(new Event("change")); });
await page.reload(); await wait(1000); await page.evaluate(harness);
const s3 = await ev(() => ({ value: document.querySelector("#vol").value, pct: document.querySelector("#volPct").textContent, voice: document.querySelector("#voice").checked }));
check("새로고침 뒤 유지: 135%, 음성 꺼짐", J(s3) === J({ value: "135", pct: "135%", voice: false }), s3);
done();
