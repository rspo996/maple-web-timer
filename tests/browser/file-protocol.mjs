// file://로 열어도 동작하고(캔버스 오염 없음), 스크립트 파일이 빠지면 어느 파일인지 알려 준다 (Task I1)
const ROOT = "file://__ROOT__/tests/browser/";
const { check, done } = await import(ROOT + "prelude.mjs");
const fs = await import("node:fs/promises"), os = await import("node:os"), path = await import("node:path");
const harness = await fs.readFile("__ROOT__/tests/browser/fake-screen.js", "utf8");
const task = await taskSpace("target-list-verify"); const page = task.page("p1");

// 1) 원본 폴더를 file://로
await page.goto("file://__ROOT__/index.html");
await page.evaluate(harness);
await page.click("#btnConnect"); await page.waitForTimeout(3000);
await page.evaluate(() => __fake.image("sol", document.querySelector("#card-sol .thumb").src, 1100, 50, 32, 32));
await page.waitForTimeout(2500);
const r = await page.evaluate(() => ({ proto: location.protocol, globals: [typeof KINDS, typeof Alerts, typeof matchTemplate], state: document.querySelector("#watchState").textContent, sol: document.querySelector("#card-sol [data-s=status]").textContent, score: document.querySelector("#card-sol [data-s=score]").textContent }));
check("file://: 전역 로드, 감시 중", r.proto === "file:" && r.globals.every(g => g !== "undefined") && r.state === "감시 중", r);
check("file://: 내장 아이콘 감지가 동작(캔버스 오염 오류 없음)", r.sol === "켜짐 · 학습 중" && r.score.startsWith("1.00"), r);

// 2) 다른 폴더로 복사한 사본에서 js/targets.js를 지우면 안내문
const copy = await fs.mkdtemp(path.join(os.tmpdir(), "maple-copy-"));
await fs.cp("__ROOT__/index.html", path.join(copy, "index.html")); await fs.cp("__ROOT__/css", path.join(copy, "css"), { recursive: true }); await fs.cp("__ROOT__/js", path.join(copy, "js"), { recursive: true });
await fs.rm(path.join(copy, "js/targets.js"));
await page.goto("file://" + copy + "/index.html"); await page.waitForTimeout(800);
const miss = await page.evaluate(() => document.querySelector("#empty").textContent);
check("스크립트 누락: 빠진 파일을 화면에 안내", miss.startsWith("파일이 빠졌어요:") && miss.includes("js/targets.js"), miss);
await fs.rm(copy, { recursive: true, force: true });
done();
