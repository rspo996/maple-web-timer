import test from 'node:test';
import assert from 'node:assert/strict';
import { ocrBuffTimer } from '../src/core/detect-core.js';
import { BUFF_TIMERS, rgbaOf } from './fixtures/buff-timers.js';

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

test('모르는 글자 모양(실제 표본이 아직 없는 4)은 다른 숫자로 읽지 않고 null', () => {
  // "38" 아이콘(솔 야누스)의 3을 지우고 같은 자리(x 10~14, y 12~20)에 추측한 4 모양을 노랗게 찍는다
  const o = BUFF_TIMERS.find(o => o.text === '38'), px = rgbaOf(o);
  const four = ['...##', '..###', '.##.#', '##..#', '#####', '....#', '....#', '....#', '....#'];
  for (let y = 0; y < 9; y++) for (let x = 0; x < 6; x++) { const k = ((12 + y) * 32 + 10 + x) * 4; const on = four[y][x] === '#'; px[k] = on ? 243 : 20; px[k + 1] = on ? 227 : 20; px[k + 2] = on ? 8 : 20; }
  assert.equal(ocrBuffTimer(px, 32, 32), null);
});

test('형식에 맞지 않는 숫자(콜론 없이 60 이상)는 null', () => {
  // "2:07"에서 콜론 두 점을 지우면 "207"이 되는데, 메이플은 60초 이상을 분:초로 쓰므로 받아들이지 않는다
  const o = BUFF_TIMERS.find(o => o.text === '2:07'), px = rgbaOf(o);
  for (let y = 0; y < 32; y++) for (let x = 11; x <= 13; x++) { const k = (y * 32 + x) * 4; if (px[k] >= 150 && px[k + 1] >= 130 && px[k + 2] <= 100) { px[k] = px[k + 1] = px[k + 2] = 20; } }
  assert.equal(ocrBuffTimer(px, 32, 32), null);
});
