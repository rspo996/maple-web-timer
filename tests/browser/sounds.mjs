// 소리 슬롯: 동적 목록, 고아 정리, 예약 접두어 보존 (Task E2 이후)
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const V2 = { ver: 2, seq: 9, group: { on: false, windowSec: 10 }, targets: [
  { id: "sol", kind: "buff", name: "솔 야누스", preset: "sol", enabled: true, threshold: 0.75, area: null, tpl: null, frameW: 0, frameH: 0, p: { durationSec: null, leadSec: 10 } },
  { id: "u3", kind: "buff", name: "유니온의 힘", preset: null, enabled: true, threshold: 0.75, area: null, tpl: null, frameW: 0, frameH: 0, p: { durationSec: null, leadSec: 10 } } ] };
const keys = () => new Promise(res => { const r = indexedDB.open("maple-web-timer", 1); r.onsuccess = () => { const q = r.result.transaction("sounds").objectStore("sounds").getAllKeys(); q.onsuccess = () => res(q.result.sort()); }; });
const { ev, wait } = await open(taskSpace, { seed: { "maple-web-timer-v2": V2 }, sounds: ["sol.pre", "u3.gone", "u9.pre", "booster.gone", "sys.lost", "grp.pre", "manual.end", "m2.pre"] });
await wait(1500);
const rows = await ev(() => [...document.querySelectorAll("#soundRows .snd-group > b")].map(b => b.textContent));
check("소리 설정: 대상 이름 순서대로 그룹", JSON.stringify(rows) === JSON.stringify(["솔 야누스", "유니온의 힘", "묶음 알림", "수동 타이머", "연결 문제"]), rows);
const kept = await ev(keys);
check("고아 정리: 없는 대상(u9, booster)만 삭제, 예약 접두어·현재 대상은 보존",
  JSON.stringify(kept) === JSON.stringify(["grp.pre", "m2.pre", "manual.end", "sol.pre", "sys.lost", "u3.gone"]), kept);
const shown = await ev(() => [...document.querySelectorAll(".snd-file.custom")].length);
check("소리 설정: 보이는 슬롯의 내 소리 3개(sol.pre, u3.gone, sys.lost) 표시", shown >= 3, shown);
// 저장소가 깨진 채 시작하면 소리를 지우지 않는다
const r2 = await open(taskSpace, { seed: { "maple-web-timer-v2": "{oops" }, sounds: ["u9.pre"] });
await r2.wait(1500);
const k2 = await r2.ev(keys);
check("깨진 저장소로 시작: 고아 정리 안 함", JSON.stringify(k2) === JSON.stringify(["u9.pre"]), k2);
check("깨진 저장소 알림줄", (await r2.ev(() => document.querySelector("#watchNote").textContent)).startsWith("설정을 읽지 못해 처음 상태로 시작했어요"));
done();
