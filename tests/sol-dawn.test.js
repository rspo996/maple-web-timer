import test from 'node:test';
import assert from 'node:assert/strict';
import { toGray } from '../src/core/match.js';
import { ocrBuffTimer } from '../src/core/detect-core.js';
import { PRESET_ICONS } from '../src/core/preset-data.js';
import { PRESETS } from '../src/core/targets.js';
import { KINDS } from '../src/core/kinds.js';
import { JANUS_SHOTS, shotPx } from './fixtures/janus-shots.js';
import { liveIcons } from './fixtures/buff-timers-live.js';
import { BUFF_BAR, buffBarPx } from './fixtures/buff-bar-live.js';
import { BUFF_BAR_305, buffBar305Px } from './fixtures/buff-bar-live-305.js';
import { detect } from './sim.js';

// 앱처럼 솔 야누스를 찾는다(검색 크기 1·1.25·1.5 → 크기 맞추기 → 상위 자리 중 보라색 확인 통과)
const find = (px, w, h) => detect(toGray(px, w * h), w, h, PRESET_ICONS.sol, PRESETS.sol.scales, KINDS.buff.timerBand, { px, preset: PRESETS.sol }).best;
const cutPx = (px, W, p) => {
  const x0 = Math.round(p.x), y0 = Math.round(p.y), w = Math.round(p.x + p.w) - x0, h = Math.round(p.y + p.h) - y0, o = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) o[(y * w + x) * 4 + c] = px[((y0 + y) * W + x0 + x) * 4 + c];
  return { px: o, w, h };
};
// 32×32 아이콘을 어두운 바탕 가운데에 둔다(버프창 빈칸 흉내)
const padded = (px, P = 10) => { const W = 32 + 2 * P, o = new Uint8ClampedArray(W * W * 4); for (let i = 0; i < W * W; i++) { o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = 30; o[i * 4 + 3] = 255; }
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) for (let c = 0; c < 4; c++) o[((y + P) * W + x + P) * 4 + c] = px[(y * 32 + x) * 4 + c]; return { px: o, w: W, h: W }; };

test('솔 야누스 내장 아이콘은 새벽 하나(남색 바탕, 사용자는 새벽만 쓴다, 2026-11-15)', () => {
  assert.equal(PRESET_ICONS.sol.length, 1);
  assert.deepEqual([PRESET_ICONS.sol[0].w, PRESET_ICONS.sol[0].h, PRESET_ICONS.sol[0].crop], [32, 32, 2]);
});

for (const o of JANUS_SHOTS) {
  test(`실제 게임 스크린샷 "${o.text}"(UI 크기 약 1.4배): 기준값 0.75 이상으로 찾고 남은 시간을 읽는다`, () => {
    const px = shotPx(o), best = find(px, o.w, o.h);
    assert.ok(best.score >= 0.75, `일치도 ${best.score.toFixed(3)} 크기 ${best.s}`);
    assert.ok(best.s >= 1.34 && best.s <= 1.46, `크기 ${best.s}`);
    const c = cutPx(px, o.w, best.pos), r = ocrBuffTimer(c.px, c.w, c.h);
    assert.equal(r && r.text, o.text);
  });
}

test('11월 12일 화면 공유의 야누스(UI 크기 1배, 숫자 1:19~5): 기준값 0.75 이상으로 찾는다', () => {
  const low = [];
  for (const o of liveIcons().filter(o => o.text)) { const p = padded(o.px), best = find(p.px, p.w, p.h); if (best.score < 0.75) low.push(`${o.text}:${best.score.toFixed(2)}`); }
  assert.deepEqual(low, []);
});

for (const [f, px] of [[BUFF_BAR, buffBarPx()], [BUFF_BAR_305, buffBar305Px()]]) {
  test(`야누스가 없는 실제 화면(비슷한 버프 "${f.lookalike.text}"가 있음): 기준값 0.75 아래`, () => {
    const best = find(px, f.w, f.h);
    assert.ok(best.score < 0.75, `일치도 ${best.score.toFixed(3)} 위치 ${Math.round(best.pos.x)},${Math.round(best.pos.y)} 크기 ${best.s}`);
  });
}
