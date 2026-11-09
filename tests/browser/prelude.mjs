// 브라우저 검사 공통 준비. ego-browser 스크립트에서:
//   const { open, check, done } = await import("file:///ABS/tests/browser/prelude.mjs");
//   const { page, ev, wait } = await open(taskSpace, { seed: { "maple-web-timer-v1": {...} }, sounds: ["sol.pre"], connect: true });
import fs from "node:fs/promises";
const ROOT = new URL("../../", import.meta.url);
export const BASE = "http://127.0.0.1:8766/index.html";      // 검증 전용 포트. 평소 쓰는 8765 origin의 설정·내 소리를 지우지 않으려고 분리
export async function open(taskSpace, opt = {}) {
  const task = await taskSpace("target-list-verify");
  const page = task.page("p1");
  await page.goto(new URL("/__seed__", BASE).href);            // 앱이 열려 있으면 IndexedDB 삭제가 막히므로, 앱이 없는 같은 origin 페이지(404)에서 비우고 시험 데이터를 넣는다
  await page.evaluate(async ({ seed, sounds }) => {                  localStorage.clear();
    await new Promise(r => { const q = indexedDB.deleteDatabase("maple-web-timer"); q.onsuccess = q.onerror = q.onblocked = r; });
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    if (sounds.length) await new Promise((res, rej) => {         // 내 소리 슬롯 키마다 0.3초 WAV를 넣는다
      const mk = () => { const n = 2400, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
        w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 8) * 8000, true); return b; };
      const r = indexedDB.open("maple-web-timer", 1); r.onupgradeneeded = () => r.result.createObjectStore("sounds");
      r.onsuccess = () => { const tx = r.result.transaction("sounds", "readwrite"), st = tx.objectStore("sounds"); for (const k of sounds) st.put({ name: k + ".wav", data: mk(), dur: 0.3 }, k); tx.oncomplete = () => { r.result.close(); res(); }; };
      r.onerror = () => rej(r.error);
    });
  }, { seed: opt.seed || {}, sounds: opt.sounds || [] });
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

// 미리보기 캔버스 위에서 이미지 좌표 (x0,y0)→(x1,y1)로 드래그한다(영역·아이콘 등록용). 부드러운 스크롤이 멈출 때까지 기다린 뒤 좌표를 잡는다
export async function drag(page, x0, y0, x1, y1) {
  const rect = () => page.evaluate(() => { const c = document.querySelector("#preview"), b = c.getBoundingClientRect(); return { l: b.left, t: b.top, sx: b.width / c.width, sy: b.height / c.height }; });
  let r = await rect();
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(100); const n = await rect(); if (n.t === r.t && n.l === r.l) break; r = n; }
  const P = (x, y) => [r.l + x * r.sx, r.t + y * r.sy];
  await page.mouse.move(...P(x0, y0)); await page.mouse.down(); await page.mouse.move(...P((x0 + x1) / 2, (y0 + y1) / 2)); await page.mouse.move(...P(x1, y1)); await page.mouse.up();
}
