// Gemini 음성(묶음 6): 미리 만든 음성 재생 · 목소리 고르기 · 없는 문구는 브라우저 음성 · 두 목소리 겹치지 않기
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const J = JSON.stringify;
const { page, ev, wait } = await open(taskSpace, { connect: true });
// 시험용 음성(0.3초 사인파 WAV data URL)과 목록. 버퍼 재생 횟수를 센다
await ev(() => {
  const n = 7200, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 24000, true); v.setUint32(28, 48000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 6) * 6000, true);
  let s = ""; new Uint8Array(b).forEach(x => { s += String.fromCharCode(x); });
  window.__src = 0; const cbs = AudioContext.prototype.createBufferSource; AudioContext.prototype.createBufferSource = function () { window.__src++; return cbs.call(this); };
  document.querySelector("#soundsDetails").open = true;
  setVoiceName("Erinome");
  setVoiceManifest({ version: 1, model: "t", style: "t", voices: [{ id: "Erinome", label: "Erinome", gender: "여" }, { id: "Zephyr", label: "Zephyr", gender: "여" }],
    files: { Erinome: { "야누스 곧 꺼져요": "data:audio/wav;base64," + btoa(s) }, Zephyr: {} } });
});
await page.waitForFunction(() => voiceState.clips.size === 1, undefined, { timeout: 5000 });
const say = async id => { await ev(i => { __fake.skew(9000); __fake.reset(); window.__src = 0; testAlert(targetById(i)); }, id); await wait(1500); return ev(() => ({ spoken: __fake.spoken.slice(), src: window.__src })); };

const a = await say("sol");
check("목록에 있는 문구: 브라우저 음성 대신 Gemini 음성 파일", a.spoken.length === 0 && a.src >= 1, a);
const b = await say("booster");
check("목록에 없는 문구: 브라우저 음성", J(b.spoken) === J(["부스터 곧 꺼져요"]) && b.src === 0, b);

// 브라우저 음성이 말하는 중이면 Gemini 음성 문구도 브라우저 음성 뒤로(두 목소리가 겹치지 않게)
await ev(() => Object.defineProperty(speechSynthesis, "speaking", { configurable: true, get: () => true }));
const busy = await say("sol");
await ev(() => { delete speechSynthesis.speaking; });
check("브라우저 음성이 말하는 중: 겹치지 않게 그 문구도 브라우저 음성", J(busy.spoken) === J(["야누스 곧 꺼져요"]) && busy.src === 0, busy);

const opts = await ev(() => [...document.querySelectorAll("#voiceName option")].map(o => [o.value, o.textContent]));
check("음성 칸: 목록의 목소리 + 브라우저 기본, 기본 표시", J(opts.map(o => o[0])) === J(["Erinome", "Zephyr", "browser"]) && opts[0][1].includes("(기본)"), opts);
const note = await ev(() => document.querySelector("#voiceNote").textContent);
check("음성 칸 안내: Gemini 1개 · 나머지 브라우저", /^Gemini 음성 1개 · 브라우저 음성 \d+개/.test(note), note);

await page.selectOption("#voiceName", "browser"); await wait(300);
const c = await say("sol");
const saved = await ev(() => JSON.parse(localStorage.getItem("maple-web-timer-ui")).voiceName);
check("브라우저 기본: 같은 문구도 브라우저 음성, 고른 값 저장", J(c.spoken) === J(["야누스 곧 꺼져요"]) && c.src === 0 && saved === "browser", { c, saved });

await page.selectOption("#voiceName", "Zephyr"); await wait(300);
const d = await say("sol");
check("그 목소리 파일이 없으면 브라우저 음성", J(d.spoken) === J(["야누스 곧 꺼져요"]) && d.src === 0, d);

await page.selectOption("#voiceName", "Erinome");
await page.waitForFunction(() => voiceState.clips.size === 1, undefined, { timeout: 5000 });
await ev(() => { __fake.reset(); window.__src = 0; }); await page.click("[data-a=voice-play]"); await wait(800);
const e = await ev(() => ({ spoken: __fake.spoken.slice(), src: window.__src }));
check("듣기: 고른 목소리로 '야누스 곧 꺼져요'", e.spoken.length === 0 && e.src >= 1, e);

await ev(() => setVoiceManifest(null)); await wait(300);
const f = await say("sol");
const note2 = await ev(() => document.querySelector("#voiceNote").textContent);
check("목록이 없으면 모두 브라우저 음성, 안내", J(f.spoken) === J(["야누스 곧 꺼져요"]) && note2.includes("브라우저 음성"), { f, note2 });
done();
