import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.js';
import { liveIcons } from './fixtures/buff-timers-live.js';
const L = await load(['scan', 'match']);
const { SCALE_GRID, sweepScales, pickScale, toGray, prepTemplate, matchTemplate, bandMask } = L;

// 양선형으로 늘리고 줄인다(브라우저 drawImage의 부드러운 확대 흉내)
function resize(g, W, H, k) {
  const w = Math.round(W * k), h = Math.round(H * k), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(W - 1.001, Math.max(0, (x + 0.5) / k - 0.5)), sy = Math.min(H - 1.001, Math.max(0, (y + 0.5) / k - 0.5));
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    o[y * w + x] = g[y0 * W + x0] * (1 - fx) * (1 - fy) + g[y0 * W + x0 + 1] * fx * (1 - fy) + g[(y0 + 1) * W + x0] * (1 - fx) * fy + g[(y0 + 1) * W + x0 + 1] * fx * fy;
  }
  return { g: o, w, h };
}
const pad = ({ g, w, h }, P) => { const W = w + 2 * P, H = h + 2 * P, o = new Float32Array(W * H).fill(20); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[(y + P) * W + x + P] = g[y * w + x]; return { g: o, w: W, h: H }; };
// 11월 12일 화면 공유의 솔 야누스(어두운 바탕) 아이콘 하나를 배율 s로 만든 템플릿(가장자리 2px, 숫자 띠 뺌) — 앱의 loadTpl과 같은 모양.
// 그때 내장 아이콘이던 모양이다. 지금 내장 아이콘(새벽, 밝은 바탕)은 tests/sol-dawn.test.js에서 시험한다
const icon = { crop: 2 }, ip = { W: 32, H: 32 }, IG = toGray(liveIcons().find(o => o.text === '54').px, 1024);
function tplAt(s) {
  const T = resize(IG, ip.W, ip.H, s), m = Math.round(icon.crop * s), w = T.w - 2 * m, h = T.h - 2 * m, g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = T.g[(y + m) * T.w + x + m];
  return prepTemplate(g, w, h, bandMask(w, h, 0.27, 0.78));
}
const LIVE = liveIcons().filter(o => o.text);

test('SCALE_GRID: 0.7~2.0배를 2%씩, sweepScales는 시작 크기의 ±25% 안', () => {
  assert.equal(SCALE_GRID[0], 0.7); assert.ok(SCALE_GRID.at(-1) <= 2 && SCALE_GRID.at(-1) > 1.96);
  for (let i = 1; i < SCALE_GRID.length; i++) assert.ok(Math.abs(SCALE_GRID[i] / SCALE_GRID[i - 1] - 1.02) < 0.002);
  const s = sweepScales(1.25);
  assert.ok(s.length >= 25 && s.length <= 27, String(s.length));   // ln(1.25/0.75)/ln(1.02) ≈ 26
  assert.ok(s.every(x => x >= 1.25 * 0.75 && x <= 1.25 * 1.25));
});

test('pickScale: 가장 높은 점수의 크기를 고르고, 준비 안 된(null) 크기가 있으면 ready=false', () => {
  const r = pickScale([1, 1.1, 1.2], s => ({ score: 1 - Math.abs(s - 1.1), pos: { s } }));
  assert.equal(r.best.s, 1.1); assert.equal(r.ready, true);
  const n = pickScale([1, 1.1], s => s === 1 ? null : { score: 0.5 });
  assert.deepEqual([n.best.s, n.ready], [1.1, false]);
});

test('실제 화면 공유 아이콘이 1.1·1.4배여도: 검색 크기(1·1.25·1.5)로는 0.5대, 크기 맞추기 뒤에는 0.85 이상', () => {
  for (const actual of [1.1, 1.4]) {
    for (const o of LIVE.filter((_, i) => i % 10 === 0)) {
      const img = pad(resize(toGray(o.px, 1024), 32, 32, actual), 8);
      const at = s => { const r = matchTemplate(img.g, img.w, img.h, tplAt(s)); return { score: r.score, pos: r }; };
      const coarse = [1, 1.25, 1.5].map(s => ({ s, ...at(s) })).sort((a, b) => b.score - a.score)[0];
      assert.ok(coarse.score < 0.75, `배율 ${actual} 검색 ${coarse.score.toFixed(2)}`);
      const { best } = pickScale(sweepScales(coarse.s), at);
      assert.ok(best.score >= 0.85, `배율 ${actual} ${o.text}: 맞춘 크기 ${best.s} 일치도 ${best.score.toFixed(2)}`);
      assert.ok(Math.abs(best.s / actual - 1) <= 0.03, `배율 ${actual}: 고른 크기 ${best.s}`);
    }
  }
});

test('proposals: 점수 높은 순, 기준 미만은 빼고, 겹치는 자리는 하나만, 최대 n개', () => {
  const r = (score, x, y, w = 32) => ({ score, pos: { x, y, w, h: w } });
  const got = L.proposals([r(0.5, 100, 10), r(0.55, 104, 12, 40), r(0.3, 300, 10), r(0.52, 200, 10), r(0.48, 400, 10), r(0.47, 500, 10)], 0.4);
  assert.deepEqual(got.map(o => o.score), [0.55, 0.52, 0.48]);   // 0.5는 0.55와 같은 자리, 0.3은 기준 미만, 3개까지
  assert.deepEqual(L.proposals([], 0.4), []);
});
