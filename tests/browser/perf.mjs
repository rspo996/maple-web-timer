// 대상별 감지 시간 표시와 틱 비용 측정 (Task H1). 1920×1080에서 직접 등록한 버프 10개의 감지 합계를 잰다(보고용 + 300ms 예산)
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const V2 = { ver: 2, seq: 0, group: { on: false, windowSec: 10 }, targets: [] };
const t = await open(taskSpace, { seed: { "maple-web-timer-v2": V2 } });
await t.ev(() => {
  __fake.resize(1920, 1080);
  for (let i = 0; i < 10; i++) {
    const r = addBuff(store, "버프" + (i + 1)), x = 200 + i * 150, y = 120;
    Object.assign(r.target, { tpl: { url: __fake.patternURL(40 + i, 32), w: 32, h: 32 }, area: { x: x - 60, y: y - 40, w: 400, h: 150 }, frameW: 1920, frameH: 1080 });
    __fake.pattern(r.target.id, x, y, 40 + i, 32);
  }
  saveTargets(); onTargetsChanged();
});
await t.wait(800); await t.page.click("#btnConnect"); await t.wait(10000);
const r = await t.ev(() => ({ ms: store.targets.map(x => +(states[x.id].ms || 0).toFixed(1)), score: document.querySelector("#card-u1 [data-s=score]").textContent, note: document.querySelector("#watchNote").textContent }));
const sum = r.ms.reduce((a, b) => a + b, 0);
console.log("감지 시간(ms) 대상별:", r.ms.join(", "), "합계:", sum.toFixed(1));
check("카드에 감지 시간 표시", /· 감지 [\d.]+ ms$/.test(r.score), r.score);
check("직접 등록 버프 10개: 감지 합계가 예산(300ms) 이하", sum > 0 && sum <= 300, sum);
check("틱이 느리다는 알림은 없음", !r.note.includes("감지가 느려요"), r.note);

// 내장 아이콘 2종(솔 야누스·부스터)이 화면에 없을 때의 감지 시간: 보고용(스펙 9.2는 브라우저 값을 아직 모른다)
const p = await open(taskSpace, {});
await p.ev(() => __fake.resize(1920, 1080)); await p.wait(500); await p.page.click("#btnConnect"); await p.wait(8000);
const pm = await p.ev(() => ({ sol: +states.sol.ms.toFixed(1), booster: +states.booster.ms.toFixed(1) }));
console.log("내장 아이콘(화면에 없음, 1920x1080) 감지 시간(ms):", JSON.stringify(pm));
check("내장 2종 감지 시간이 측정됨(보고용)", pm.sol > 0 && pm.booster > 0, pm);

// 2026-11-25 실제 화면 공유(1366×796): video에서 조각을 잘라 올 때마다 한 번에 1~2ms(3×3 조각도 같음)가 들어, 탭이 보이는 동안 틱마다
// drawImage를 170번 넘게 불러 10초 중 약 7초를 붙잡혔고 탭이 최대 8.6초 응답하지 않았다. 틱마다 화면을 한 번만 복사하고 감지는 사본에서 읽는다.
// video를 원본으로 그리는 것은 틱마다 복사 1번 + 미리보기 1번
const v = await open(taskSpace, {});
await v.ev(() => { __fake.resize(1366, 796); __fake.image("sol", PRESET_ICONS.sol[0].url, 900, 30, 32, 32); });
await v.wait(500); await v.page.click("#btnConnect"); await v.wait(3000);
const vd = await v.ev(async () => {
  const P = CanvasRenderingContext2D.prototype, od = P.drawImage, k = KINDS.rune, o = k.detect; let vid = 0, ticks = 0;
  P.drawImage = function (s, ...a) { if (s instanceof HTMLVideoElement) vid++; return od.call(this, s, ...a); };
  k.detect = function (...a) { ticks++; return o.apply(this, a); };   // 룬은 틱마다 한 번 감지한다
  await new Promise(r => setTimeout(r, 5000));
  P.drawImage = od; k.detect = o;
  return { vid, ticks, perTick: ticks ? +(vid / ticks).toFixed(1) : null, sol: +states.sol.score.toFixed(2) };
});
check("탭이 보일 때 video에서 그리는 횟수: 틱마다 2번 이하(복사·미리보기)", vd.ticks >= 5 && vd.perTick <= 2, vd);
check("사본에서 읽어도 솔 야누스를 찾는다", vd.sol >= 0.75, vd);
done();
