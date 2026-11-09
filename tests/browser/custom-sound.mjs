// 내 소리 파일: 고르기 · 용량/길이 제한 · 대체 재생 · 저장 · 기본으로 (오늘 추가된 기능 회귀)
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const fs = await import("node:fs/promises"), os = await import("node:os"), path = await import("node:path");
const J = JSON.stringify;
// 8kHz 16비트 모노 WAV. sec초
function wav(sec) { const n = Math.floor(8000 * sec), b = Buffer.alloc(44 + n * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), 44 + i * 2); return b; }
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "maple-sound-"));
const files = { ok: path.join(dir, "ding.wav"), long: path.join(dir, "long.wav"), big: path.join(dir, "big.wav") };
await fs.writeFile(files.ok, wav(0.3)); await fs.writeFile(files.long, wav(11)); await fs.writeFile(files.big, wav(330));   // 330초 = 약 5.3MB

const { page, ev, wait } = await open(taskSpace, { connect: true });
await ev(() => { document.querySelector("#soundsDetails").open = true; document.querySelectorAll("#soundRows .snd-row").forEach((r, i) => r.querySelector("input[type=file]").id = "pick" + i); });
const rowOf = key => ev(k => SLOTS.findIndex(s => s.key === k), key);
const iSolPre = await rowOf("sol.pre"), iSolGone = await rowOf("sol.gone");
const note = () => ev(() => document.querySelector("#soundNote").textContent);

await page.setInputFiles("#pick" + iSolPre, files.ok); await wait(1200);
let r = await ev(() => ({ has: customSounds.has("sol.pre"), file: document.querySelector("#soundRows .snd-row").querySelector(".snd-file").textContent, note: document.querySelector("#soundNote").textContent }));
check("파일 고르기: 슬롯에 저장, 이름·길이 표시", r.has && r.file === "ding.wav · 0.3초" && r.note.includes("소리를 바꿨어요"), r);
await page.setInputFiles("#pick" + iSolGone, files.long); await wait(1000);
check("10초 넘는 소리는 거절", (await note()).includes("10초 이하 소리만 쓸 수 있어요") && !(await ev(() => customSounds.has("sol.gone"))), await note());
await page.setInputFiles("#pick" + iSolGone, files.big); await wait(1000);
check("5MB 넘는 파일은 거절", (await note()).includes("5MB 이하 파일만 쓸 수 있어요") && !(await ev(() => customSounds.has("sol.gone"))), await note());

// 내 소리가 있는 알림은 기본 경고음·음성 대신 그 소리만
await ev(() => { __fake.reset(); window.__recs = []; Alerts.listen(x => __recs.push(x)); testAlert(targetById("sol")); });
await wait(1500);
const play = await ev(() => ({ spoken: __fake.spoken.slice(), osc: __fake.osc.length, recs: __recs.map(x => [x.event, x.custom]) }));
check("내 소리가 있으면 기본 비프·음성 대신 재생", play.spoken.length === 0 && play.osc === 0 && J(play.recs) === J([["pre", true]]), play);
await ev(() => { __fake.reset(); testAlert(targetById("booster")); }); await wait(2500);
check("다른 알림은 기본 소리 그대로(비프 + 음성)", (await ev(() => __fake.osc.length)) === 4 && J(await ev(() => __fake.spoken)) === J(["부스터 10초 전"]));

// 새로고침해도 유지(IndexedDB), 기본으로 되돌리기
await ev(() => location.reload()); await wait(2000);
check("새로고침 뒤에도 유지", (await ev(() => customSounds.has("sol.pre"))) === true);
await ev(() => { document.querySelector("#soundsDetails").open = true; document.querySelector("#soundRows .snd-row").querySelector("[data-a=reset]").click(); }); await wait(800);
const reset = await ev(async () => ({ has: customSounds.has("sol.pre"), note: document.querySelector("#soundNote").textContent, keys: await new Promise(res => { const q = indexedDB.open("maple-web-timer", 1); q.onsuccess = () => { const g = q.result.transaction("sounds").objectStore("sounds").getAllKeys(); g.onsuccess = () => res(g.result); }; }) }));
check("기본으로: 슬롯·저장소에서 삭제, 안내 문구", !reset.has && reset.note === "솔 야누스 미리 알림을 기본 소리로 되돌렸어요" && reset.keys.length === 0, reset);
await fs.rm(dir, { recursive: true, force: true });
done();
