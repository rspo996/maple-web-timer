import test from 'node:test';
import assert from 'node:assert/strict';
import { ocrBuffTimer } from '../src/core/detect-core.js';
import { BUFF_TIMERS, rgbaOf } from './fixtures/buff-timers.js';
import { liveIcons } from './fixtures/buff-timers-live.js';

const secOf = s => s.includes(':') ? +s.split(':')[0] * 60 + +s.split(':')[1] : +s;
// 가장 가까운 픽셀로 늘린다(UI 배율 1.25·1.5 흉내)
function scaleUp(px, w, h, k) {
  const W = Math.round(w * k), H = Math.round(h * k), o = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (Math.min(h - 1, Math.floor(y / k)) * w + Math.min(w - 1, Math.floor(x / k))) * 4, d = (y * W + x) * 4; for (let q = 0; q < 4; q++) o[d + q] = px[s + q]; }
  return { px: o, W, H };
}

test('실제 화면: 노란 숫자가 찍힌 버프 아이콘 13개를 모두 읽는다(초는 "38", 1분 이상은 "2:07")', () => {
  const got = BUFF_TIMERS.filter(o => o.text).map(o => { const r = ocrBuffTimer(rgbaOf(o), 32, 32); return [o.text, r && r.text, r && r.value]; });
  assert.deepEqual(got, BUFF_TIMERS.filter(o => o.text).map(o => [o.text, o.text, secOf(o.text)]));
});

test('실제 화면: 큰 노란 숫자가 없는 아이콘(작은 흰 숫자 "28"·"13"만 있거나 없음)은 null', () => {
  for (const o of BUFF_TIMERS.filter(o => !o.text)) assert.equal(ocrBuffTimer(rgbaOf(o), 32, 32), null, `(${o.x},${o.y})`);
});

test('UI 배율 1.25·1.5로 커진 아이콘도 읽는다', () => {
  for (const k of [1.25, 1.5]) for (const o of BUFF_TIMERS.filter(o => o.text)) {
    const { px, W, H } = scaleUp(rgbaOf(o), 32, 32, k), r = ocrBuffTimer(px, W, H);
    assert.equal(r && r.text, o.text, `배율 ${k} ${o.text}`);
  }
});

test('숫자가 아닌 모양(꽉 찬 노란 덩어리)은 다른 숫자로 읽지 않고 null', () => {
  // "38" 아이콘(솔 야누스)의 3 자리(x 10~14, y 12~20)를 꽉 찬 노란 사각형으로 덮는다
  const o = BUFF_TIMERS.find(o => o.text === '38'), px = rgbaOf(o);
  for (let y = 12; y <= 20; y++) for (let x = 10; x <= 14; x++) { const k = (y * 32 + x) * 4; px[k] = 243; px[k + 1] = 227; px[k + 2] = 8; }
  assert.equal(ocrBuffTimer(px, 32, 32), null);
});

// ----- 실제 화면 공유 프레임(2026-11-12). 브라우저가 색을 2×2 단위로 줄여 넘겨 글자 가장자리가 희게 바랜다 -----
const LIVE = liveIcons();

test('실제 화면 공유: 솔 야누스 숫자를 모두 읽는다(1:19~1:00, 59~5, 4가 든 값 포함)', () => {
  const got = LIVE.filter(o => o.text).map(o => { const r = ocrBuffTimer(o.px, 32, 32); return [o.text, r && r.text, r && r.value]; });
  assert.deepEqual(got, LIVE.filter(o => o.text).map(o => [o.text, o.text, secOf(o.text)]));
});

test('실제 화면 공유: 숫자 없는 장면(끝나기 전 깜빡이는 아이콘, 다른 그림)은 null', () => {
  LIVE.forEach((o, i) => { if (!o.text) assert.equal(ocrBuffTimer(o.px, 32, 32), null, `#${i}`); });
});

test('실제 화면 공유: 1.25·1.5배로 늘려도 틀린 값을 내지 않는다(1.5배는 모두, 1.25배는 95% 이상 읽음)', () => {
  for (const k of [1.25, 1.5]) {
    const pos = LIVE.filter(o => o.text); let ok = 0;
    for (const o of pos) { const { px, W, H } = scaleUp(o.px, 32, 32, k), r = ocrBuffTimer(px, W, H);
      if (r) assert.equal(r.text, o.text, `배율 ${k}`); if (r) ok++; }
    assert.ok(k === 1.5 ? ok === pos.length : ok >= 0.95 * pos.length, `배율 ${k}: ${ok}/${pos.length}`);
  }
});

test('숫자 하나가 끊겨 일부만 남으면 남은 숫자만 읽지 않고 null(실제로 "59"를 "9", "52"를 "5"로 읽었던 경우)', () => {
  // 실제 "59"에서 5의 윗줄과 왼쪽 세로획(x 9~14, y 11~15)을 검게 지워 5를 조각으로 만든다
  const o = LIVE.find(o => o.text === '59'), px = o.px.slice();
  assert.equal(ocrBuffTimer(px, 32, 32).text, '59');
  for (let y = 11; y <= 15; y++) for (let x = 9; x <= 14; x++) { const k = (y * 32 + x) * 4; px[k] = px[k + 1] = px[k + 2] = 5; }
  assert.equal(ocrBuffTimer(px, 32, 32), null);
});

test('형식에 맞지 않는 숫자(콜론 없이 60 이상)는 null', () => {
  // "2:07"에서 콜론 두 점을 지우면 "207"이 되는데, 메이플은 60초 이상을 분:초로 쓰므로 받아들이지 않는다
  const o = BUFF_TIMERS.find(o => o.text === '2:07'), px = rgbaOf(o);
  for (let y = 0; y < 32; y++) for (let x = 11; x <= 13; x++) { const k = (y * 32 + x) * 4; if (px[k] >= 150 && px[k + 1] >= 130 && px[k + 2] <= 100) { px[k] = px[k + 1] = px[k + 2] = 20; } }
  assert.equal(ocrBuffTimer(px, 32, 32), null);
});
