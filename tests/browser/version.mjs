// 버전 표시·새 버전 안내(묶음 7): version.json 요청만 가로채 다른 버전을 돌려주고, 상태줄 안내·자동 확인 연결·새로고침 확인 창을 본다
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const { page, ev, wait } = await open(taskSpace, {});
const note = () => ev(() => { const n = document.querySelector("#verNote"); return n ? { hidden: n.hidden, text: n.textContent, btn: !!n.querySelector("#btnReload") } : null; });

check("헤더: 개발 서버는 '개발 중'", (await ev(() => document.querySelector("#verLabel") && document.querySelector("#verLabel").textContent)) === "개발 중");

// version.json만 가로챈다(음성 목록·파일 등 나머지는 원래 fetch로)
await ev(() => {
  const real = window.fetch.bind(window); window.__verCalls = 0; window.__verReply = { id: "dev" };
  window.fetch = (u, o) => String(u).endsWith("version.json")
    ? (window.__verCalls++, Promise.resolve(new Response(JSON.stringify(window.__verReply), { status: 200, headers: { "content-type": "application/json" } })))
    : real(u, o);
  window.__hid = false; Object.defineProperty(document, "hidden", { configurable: true, get: () => window.__hid });
});
const calls = () => ev(() => window.__verCalls);
const vis = async hidden => { await ev(h => { window.__hid = h; document.dispatchEvent(new Event("visibilitychange")); }, hidden); await wait(400); };

await ev(() => checkVersion()); await wait(300);
const n0 = await note();
check("같은 id: 안내 없음", (await calls()) === 1 && n0 && n0.hidden, { calls: await calls(), n0 });

// 자동 확인 연결: 숨은 탭에서는 받지 않고, 다시 보이면(마지막 확인 60초 지남) 한 번 받는다
await ev(() => { startVersionWatch(); versionState.lastAt = Date.now() - 120_000; });
await vis(true);
check("숨은 탭: visibilitychange에도 요청 없음", (await calls()) === 1, await calls());
await vis(false);
check("다시 보임: 요청 한 번(같은 id라 안내 없음)", (await calls()) === 2 && (await note()).hidden, { calls: await calls(), n: await note() });
await vis(true); await vis(false);
check("60초 안에 다시 보임: 요청 없음(마지막 확인 시각이 갱신됨)", (await calls()) === 2, await calls());

await ev(() => { window.__verReply = { id: "other-2026" }; versionState.lastAt = Date.now() - 120_000; });
await vis(false);
const n1 = await note();
check("다른 id: 상태줄에 '새 버전이 있어요'와 [새로고침]", (await calls()) === 3 && n1 && !n1.hidden && /새 버전이 있어요/.test(n1.text) && n1.btn, { calls: await calls(), n1 });
await ev(() => { versionState.lastAt = Date.now() - 600_000; }); await vis(false);
check("찾은 뒤에는 더 받지 않음", (await calls()) === 3, await calls());

// 화면 공유 중 새로고침: 확인 창(취소하면 그대로)
await page.click("#btnConnect"); await wait(2500);
await ev(() => { window.__confirms = []; window.confirm = m => { window.__confirms.push(m); return false; }; });
await page.click("#btnReload"); await wait(500);
const conf = await ev(() => window.__confirms);
check("공유 중: 확인 창 문구, 취소하면 새로고침 안 함", conf.length === 1 && conf[0] === "새로고침하면 화면 공유가 끊겨요. “게임 화면 연결”을 다시 눌러야 해요. 새로고침할까요?" && (await ev(() => !!window.__fake)), conf);

// 감시를 끝낸 뒤에는 확인 없이 새로고침(주입해 둔 가짜 화면이 사라짐)
await page.click("#btnStop"); await wait(300);
await page.click("#btnReload"); await wait(2500);
check("감시 끝낸 뒤: 확인 없이 새로고침", (await ev(() => typeof window.__fake === "undefined" && !!document.querySelector("#verLabel"))), null);
done();
