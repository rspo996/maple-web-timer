// 브라우저 검사 공통 준비. ego-browser 스크립트에서:
//   const { open, check, done } = await import("file:///ABS/tests/browser/prelude.mjs");
//   const { page, ev, wait } = await open(taskSpace, { seed: { "maple-web-timer-v1": {...} }, connect: true });
import fs from "node:fs/promises";
const ROOT = new URL("../../", import.meta.url);
export const BASE = "http://127.0.0.1:8766/index.html";      // 검증 전용 포트. 평소 쓰는 8765 origin의 설정·내 소리를 지우지 않으려고 분리
export async function open(taskSpace, opt = {}) {
  const task = await taskSpace("target-list-verify");
  const page = task.page("p1");
  await page.goto(opt.url || BASE);
  await page.evaluate(async seed => {                          // 이 origin의 저장소를 비우고 시험 데이터를 넣는다
    localStorage.clear();
    await new Promise(r => { const q = indexedDB.deleteDatabase("maple-web-timer"); q.onsuccess = q.onerror = q.onblocked = r; });
    for (const [k, v] of Object.entries(seed || {})) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }, opt.seed || {});
  await page.goto(opt.url || BASE);
  await page.evaluate(await fs.readFile(new URL("tests/browser/fake-screen.js", ROOT), "utf8"));
  if (opt.connect) { await page.click("#btnConnect"); await page.waitForTimeout(opt.settleMs ?? 3000); }
  const ev = (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg));
  return { task, page, ev, wait: ms => page.waitForTimeout(ms) };
}
let pass = 0, fail = 0;
export function check(name, cond, detail) {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : "  <- " + JSON.stringify(detail)}`);
}
export function done() { console.log(`RESULT ${pass} passed, ${fail} failed`); }
