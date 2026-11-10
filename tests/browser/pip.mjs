// 작은 창(묶음 5): 실제 OS 창 대신 숨긴 iframe 창으로 Document PiP를 바꿔 끼워 내용·갱신·깜빡임·닫기·미지원을 확인한다
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const J = JSON.stringify;
const { page, ev, wait } = await open(taskSpace, { connect: true });
await ev(() => { Object.defineProperty(window, "documentPictureInPicture", { configurable: true, value: { window: null, async requestWindow(o) {
  const f = document.createElement("iframe"); f.id = "fakePip"; f.style.cssText = `position:fixed;left:-5000px;top:0;width:${o.width}px;height:${o.height}px`; document.body.append(f);
  window.__pipOpts = o; this.window = f.contentWindow; return f.contentWindow; } } }); });
const pip = () => ev(() => { const d = document.querySelector("#fakePip") && document.querySelector("#fakePip").contentDocument; if (!d) return null;
  return { status: d.querySelector("#pipStatus").textContent, statusCls: d.querySelector("#pipStatus").className,
    rows: [...d.querySelectorAll(".r")].map(r => ({ id: r.dataset.id, cls: r.className, text: [...r.children].map(c => c.textContent) })), css: !!d.querySelector("style") }; });

await page.click("#btnPip"); await wait(800);
const p1 = await pip();
check("열기: 버튼 문구 바뀜, 창 크기(260×대상 수), 전용 CSS", (await ev(() => document.querySelector("#btnPip").textContent)) === "작은 창 닫기" && J(await ev(() => window.__pipOpts)) === J({ width: 260, height: 44 + 34 * 3 }) && p1 && p1.css, { p1, opts: await ev(() => window.__pipOpts) });
check("내용: 맨 위 감시 상태, 대상 3행(이름·상태)", p1.status === "감시 중" && J(p1.rows.map(r => r.text[1] + "|" + r.text[2])) === J(["솔 야누스|아직 못 찾음", "부스터|아직 못 찾음", "룬|룬 없음"]), p1);  // 룬도 내장 아이콘이 생겨 등록 없이 찾는다(2026-11-10)

// 수동 타이머가 생기면 행이 늘고 남은 시간이 줄어든다(탭 숨김과 상관없이 tick마다 갱신)
await page.click("#manualPresets button:first-child"); await wait(1200);
const t1 = (await pip()).rows.find(r => r.id === "m1");
await ev(() => __fake.skew(65_000)); await wait(1200);
const t2 = (await pip()).rows.find(r => r.id === "m1");
check("수동 타이머 행: 실행 중, 남은 시간이 줄어듦", t1 && t1.text[1] === "5분 타이머" && t1.text[2] === "실행 중" && /^(5:00|4:59)$/.test(t1.text[3]) && /^3:5\d$/.test(t2.text[3]), { t1, t2 });

// 알림이 울리면 그 행만 깜빡(5초) → 고정 색 → 원래
await ev(() => { __fake.reset(); testAlert(targetById("rune")); }); await wait(700);
const f1 = (await pip()).rows.find(r => r.id === "rune");
check("알림: 룬 행 깜빡임(파랑, ◆), 다른 행은 그대로", f1.cls === "r flash-info" && f1.text[0] === "◆" && !(await pip()).rows.filter(r => r.id !== "rune").some(r => /flash|hold/.test(r.cls)), f1);
await ev(() => __fake.skew(6_000)); await wait(1000);
check("5초 뒤: 깜빡임 대신 고정 색", (await pip()).rows.find(r => r.id === "rune").cls === "r hold-info");
await ev(() => __fake.skew(30_000)); await wait(1000);
check("30초 뒤: 원래 수준(룬 없음은 평상)", (await pip()).rows.find(r => r.id === "rune").cls === "r lv-idle");

// 연결 끊김은 맨 위 줄에 문제 색으로만 표시(소리 알림이 없으니 깜빡이지 않음, 2026-11-10 사용자 결정)
await ev(() => src.track.dispatchEvent(new Event("ended"))); await wait(1200);
const lost = await pip();
check("연결 끊김: 맨 위 줄 '연결 끊김 · 알림이 멈췄어요'와 문제 색, 깜빡임 없음", lost.status === "연결 끊김 · 알림이 멈췄어요" && /bad/.test(lost.statusCls) && !/flash/.test(lost.statusCls), lost);

// 움직임 줄이기: 깜빡이지 않고 고정 색
await page.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await ev(() => testAlert(targetById("sol"))); await wait(700);
check("움직임 줄이기: 처음부터 고정 색", (await pip()).rows.find(r => r.id === "sol").cls === "r hold-pre");
await page.cdp("Emulation.setEmulatedMedia", { features: [] });

// 닫기: 버튼 문구 복귀, 크기 기억
await page.click("#btnPip"); await wait(300);
const closed = await ev(() => ({ text: document.querySelector("#btnPip").textContent, pip: JSON.parse(localStorage.getItem("maple-web-timer-ui")).pip }));
check("닫기: 버튼 문구 복귀, 창 크기 저장", closed.text === "작은 창 열기" && closed.pip && closed.pip.w >= 250 && closed.pip.h > 100, closed);   // 시험용 iframe은 테두리만큼 작다

// 지원하지 않으면 버튼 꺼짐과 이유
await ev(() => { Object.defineProperty(window, "documentPictureInPicture", { configurable: true, value: undefined }); pipInit(); });
const un = await ev(() => ({ dis: document.querySelector("#btnPip").disabled, note: document.querySelector("#pipNote").hidden ? "" : document.querySelector("#pipNote").textContent }));
check("미지원: 버튼 꺼짐, 이 브라우저는 작은 창을 지원하지 않아요", un.dis && un.note === "이 브라우저는 작은 창을 지원하지 않아요", un);
done();
