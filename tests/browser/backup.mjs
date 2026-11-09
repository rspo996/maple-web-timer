// 설정 백업(묶음 5): 내보내기(파일명·내용)·불러오기(확인 창·적용·새로고침 뒤 복원)·감시 중 막기·오류 문구·IndexedDB 실패 시 되돌림
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const fs = await import("node:fs/promises"), os = await import("node:os"), path = await import("node:path");
const J = JSON.stringify;
const tgt = (id, kind, name, preset, threshold, p) => ({ id, kind, name, preset, enabled: true, threshold, area: null, tpl: null, frameW: 0, frameH: 0, p });
const V2 = { ver: 2, seq: 1, group: { on: true, windowSec: 5 }, targets: [tgt("sol", "buff", "솔 야누스", "sol", 0.75, { durationSec: null, leadSec: 10 }),
  tgt("booster", "countdown", "부스터", "booster", 0.7, { leadSec: 10 }), tgt("rune", "rune", "룬", null, 0.8, { repeatSec: 60 }), tgt("u1", "buff", "유니온의 힘", null, 0.75, { durationSec: 1800, leadSec: 10 })] };
const MAN = { v: 1, seq: 1, prefs: { preSec: 10 }, presets: [{ id: "p1", label: "5분", sec: 300 }], timers: [{ id: "m1", label: "경쿠", kind: "countdown", phases: [{ name: "경쿠", sec: 1800 }],
  idx: 0, cycles: 0, status: "running", endAt: Date.now() + 1_000_000, remainMs: 1_800_000, preSec: 10, preDone: false, preHeard: false, doneAt: null }] };
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "maple-backup-"));
const catchDownload = () => ev(() => { HTMLAnchorElement.prototype.click = function () { window.__dl = { name: this.download, href: this.href }; }; });
const note = () => ev(() => document.querySelector("#backupNote").textContent);

// 1) 내보내기
let { page, ev, wait } = await open(taskSpace, { seed: { "maple-web-timer-v2": V2, "maple-web-timer-manual-v1": MAN, "maple-web-timer-ui": { volumePct: 150 } }, sounds: ["sol.pre", "manual.end"] });
await wait(800); await catchDownload();
await ev(() => { document.querySelector("#backupDetails").open = true; });
await wait(200);
const label = await ev(() => document.querySelector("#exportSoundsLabel").textContent);
check("내보내기 칸: 내 소리 개수와 크기", /^내 소리 파일 포함 \(2개, 약 \d+KB\)$/.test(label), label);
await page.click("#btnExport"); await wait(800);
const dl = await ev(async () => ({ name: __dl.name, text: await (await fetch(__dl.href)).text() }));
const file = JSON.parse(dl.text);
check("파일명·봉투·내용", /^maple-web-timer-backup-\d{8}-\d{4}\.json$/.test(dl.name) && file.schema === "maple-web-timer-backup" && file.version === 1 && J(file.includes) === J(["targets", "manualTimers", "ui", "sounds"])
  && file.data.targets.targets.length === 4 && file.data.targets.group.on === true && file.data.manualTimers.timers[0].label === "경쿠" && !("endAt" in file.data.manualTimers.timers[0])
  && file.data.ui.volumePct === 150 && J(Object.keys(file.data.sounds).sort()) === J(["manual.end", "sol.pre"]), { name: dl.name, includes: file.includes });
check("내보내기 안내", (await note()) === "설정을 파일로 저장했어요");
const full = path.join(dir, "full.json"); await fs.writeFile(full, dl.text);
const noSounds = { ...file, includes: ["targets", "manualTimers"], data: { targets: file.data.targets, manualTimers: file.data.manualTimers } };
await fs.writeFile(path.join(dir, "nosound.json"), J(noSounds));
await fs.writeFile(path.join(dir, "bad.json"), "not json"); await fs.writeFile(path.join(dir, "other.json"), J({ schema: "x", version: 1 }));

// 2) 오류 문구
for (const [f, msg] of [["bad.json", "이 파일은 설정 파일이 아닌 것 같아요"], ["other.json", "메이플 재획 알리미에서 내보낸 파일이 아니에요"]]) {
  await page.setInputFiles("#fileBackup", path.join(dir, f)); await wait(500);
  check(`오류: ${msg}`, (await note()) === msg, await note());
}

// 3) 소리 없는 파일로 대상을 바꾸면 지금 소리가 지워진다는 안내, 실행 중 타이머 안내 → 취소
await page.setInputFiles("#fileBackup", path.join(dir, "nosound.json")); await wait(800);
const dlg = await ev(() => ({ open: document.querySelector("#importDialog").open, sum: document.querySelector("#importSummary").textContent, extra: document.querySelector("#importExtra").textContent,
  boxes: [...document.querySelectorAll("#importDialog input[type=checkbox]")].map(b => [b.name, b.checked, b.disabled]) }));
check("확인 창: 개수 요약, 소리 지워짐·실행 중 타이머 안내, 파일에 없는 그룹은 꺼짐",
  dlg.open && dlg.sum === "이 파일에서 감지 대상 4개, 수동 타이머 1개를 불러와요. 지금 설정은 이 내용으로 바뀌어요." && dlg.extra === "지금 내 소리 2개가 지워져요 · 실행 중인 타이머 1개가 멈춰요"
  && J(dlg.boxes) === J([["targets", true, false], ["manual", true, false], ["ui", false, true]]), dlg);
await page.click("#importCancel"); await wait(300);
check("취소: 아무것도 바뀌지 않음", (await ev(() => document.querySelector("#importDialog").open)) === false && (await ev(() => localStorage.getItem("maple-web-timer-v2"))) === J(V2));

// 4) IndexedDB 쓰기가 실패하면 localStorage를 되돌린다
await ev(() => { window.__realOpen = indexedDB.open.bind(indexedDB); indexedDB.open = () => { const r = {}; setTimeout(() => { r.error = new Error("x"); r.onerror && r.onerror(); }, 0); return r; }; });
await page.setInputFiles("#fileBackup", full); await wait(1200);
await page.click("#importOk"); await wait(800);
const rb = await ev(() => ({ note: document.querySelector("#backupNote").textContent, v2: localStorage.getItem("maple-web-timer-v2"), importing }));
check("IndexedDB 실패: 지금 설정 그대로, 안내", rb.note === "설정을 불러오지 못했어요. 지금 설정은 그대로예요" && rb.v2 === J(V2) && rb.importing === false, rb);

// 5) 다른 설정으로 시작한 브라우저에서 전체 파일을 불러오면 새로고침 뒤 그대로 복원
({ page, ev, wait } = await open(taskSpace, { seed: {} }));
await wait(800);
await ev(() => { document.querySelector("#backupDetails").open = true; });
await page.setInputFiles("#fileBackup", full); await wait(1500);
const sum = await ev(() => document.querySelector("#importSummary").textContent);
check("확인 창: 감지 대상 4개, 수동 타이머 1개, 내 소리 2개", sum === "이 파일에서 감지 대상 4개, 수동 타이머 1개, 내 소리 2개를 불러와요. 지금 설정은 이 내용으로 바뀌어요.", sum);
await page.click("#importOk"); await wait(3000);
const after = await ev(() => ({ names: store.targets.map(t => t.name), group: store.group, vol: document.querySelector("#vol").value,
  timers: manual.timers.map(t => [t.label, t.status]), sounds: [...customSounds.keys()].sort() }));
check("새로고침 뒤 복원: 대상·묶기·음량·타이머(대기)·내 소리", J(after) === J({ names: ["솔 야누스", "부스터", "룬", "유니온의 힘"], group: { on: true, windowSec: 5 }, vol: "150",
  timers: [["경쿠", "idle"]], sounds: ["manual.end", "sol.pre"] }), after);

// 6) 감시 중에는 불러오기를 막는다
({ page, ev, wait } = await open(taskSpace, { connect: true }));
await ev(() => { document.querySelector("#backupDetails").open = true; });
await page.click("#btnImport"); await wait(300);
check("감시 중 불러오기 막음", (await note()) === "감시 중에는 불러올 수 없어요. 감시를 끝낸 뒤 다시 해 주세요", await note());
await fs.rm(dir, { recursive: true, force: true });
done();
