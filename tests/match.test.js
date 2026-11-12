import test from 'node:test';
import assert from 'node:assert/strict';
import { toGray, prepTemplate, matchTemplate } from '../src/core/match.js';
import { ocrSevenSeg, SEG_DIGITS } from '../src/core/detect-core.js';

// 결정적인 가짜 난수(시험 데이터 고정용)
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
function noiseImage(W, H, seed) { const r = rng(seed), g = new Float32Array(W * H); for (let i = 0; i < g.length; i++) g[i] = r() * 255; return g; }
function crop(g, W, x, y, w, h) { const o = new Float32Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) o[j * w + i] = g[(y + j) * W + x + i]; return o; }

test('matchTemplate: 잘라낸 조각을 원래 위치에서 점수 약 1로 찾는다', () => {
  const W = 60, H = 40, img = noiseImage(W, H, 7);
  const tpl = prepTemplate(crop(img, W, 13, 7, 8, 8), 8, 8);
  const r = matchTemplate(img, W, H, tpl);
  assert.equal(r.x, 13); assert.equal(r.y, 7);
  assert.ok(r.score > 0.999, 'score ' + r.score);
});

test('matchTemplate: 상관없는 이미지는 점수가 낮다', () => {
  const W = 60, H = 40, tplSrc = noiseImage(8, 8, 1), other = noiseImage(W, H, 99);
  const r = matchTemplate(other, W, H, prepTemplate(tplSrc, 8, 8));
  assert.ok(r.score < 0.7, 'score ' + r.score);
});

test('matchTemplate: 템플릿이 영역보다 크거나 단색이면 0', () => {
  const big = prepTemplate(noiseImage(20, 20, 3), 20, 20);
  assert.equal(matchTemplate(noiseImage(10, 10, 4), 10, 10, big).score, 0);
  const flat = prepTemplate(new Float32Array(64).fill(100), 8, 8);
  assert.equal(matchTemplate(noiseImage(30, 30, 5), 30, 30, flat).score, 0);
});

test('toGray: 가중 평균', () => {
  const g = toGray(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]), 2);
  assert.ok(Math.abs(g[0] - 76.245) < 0.01); assert.ok(Math.abs(g[1] - 149.685) < 0.01);
});

// 7세그먼트 숫자를 합성해 ocrSevenSeg를 시험: 밝은 글씨(노랑) + 검은 배경
function renderDigits(str, h = 36, w = 20, gap = 8) {
  const pad = 4, dotW = 5;
  const W = pad * 2 + [...str].reduce((a, c) => a + (c === '.' ? dotW + gap : w + gap), 0), H = h + pad * 2;
  const px = new Uint8ClampedArray(W * H * 4); for (let i = 3; i < px.length; i += 4) px[i] = 255;
  const fill = (x0, x1, y0, y1) => { for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) { const k = (y * W + x) * 4; px[k] = 255; px[k + 1] = 230; px[k + 2] = 80; } };
  // 가로 획은 글자 너비 전체, 세로 획은 가로 획과 이어지도록 그린다(실제 7세그먼트 글자 모양)
  const segBox = [[0, 1, 0, .14], [.78, 1, .05, .5], [.78, 1, .5, .95], [0, 1, .86, 1], [0, .22, .5, .95], [0, .22, .05, .5], [0, 1, .43, .57]];
  let x = pad;
  for (const ch of str) {
    if (ch === '.') { fill(x, x + dotW - 1, pad + h - 5, pad + h - 1); x += dotW + gap; continue; }
    const key = Object.keys(SEG_DIGITS).find(k => SEG_DIGITS[k] === ch);
    [...key].forEach((on, i) => { if (on === '1') { const [a, b, c, d] = segBox[i]; fill(x + a * (w - 1), x + b * (w - 1), pad + c * (h - 1), pad + d * (h - 1)); } });
    x += w + gap;
  }
  return { px, W, H };
}

test('ocrSevenSeg: 합성한 7세그먼트 숫자를 읽는다', () => {
  for (const s of ['38', '125', '9.5', '07']) {
    const { px, W, H } = renderDigits(s);
    const r = ocrSevenSeg(px, W, H);
    assert.ok(r, s + ' 읽기 실패'); assert.equal(r.text, s); assert.equal(r.value, parseFloat(s));
  }
});

test('ocrSevenSeg: 글씨가 없거나 너무 작으면 null', () => {
  const blank = new Uint8ClampedArray(40 * 20 * 4); for (let i = 3; i < blank.length; i += 4) blank[i] = 255;
  assert.equal(ocrSevenSeg(blank, 40, 20), null);
});

// ---- 실제 화면의 부스터 숫자(2026-11-11): 숫자 바로 아래에 퀘스트 진행 글자가 붙어 있으면 못 읽던 문제 ----
import { BOOSTER_TIMER, grayOf as boosterGray } from './fixtures/booster-timer.js';
// 회색조 조각에서 원래 화면 좌표의 사각형을 RGBA로 잘라 낸다(회색값 = 밝기)
function boosterCrop(x0, y0, w, h) {
  const f = BOOSTER_TIMER.frame, g = boosterGray(f), px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = g[(y0 - f.y + y) * f.w + (x0 - f.x + x)], k = (y * w + x) * 4; px[k] = px[k + 1] = px[k + 2] = v; px[k + 3] = 255; }
  return px;
}
// detect-run.js readTimer와 같은 영역: 글자 상자 p 오른쪽, 위쪽은 글자 위 끝부터 글자 높이의 2배
const timerRect = p => { const x0 = Math.round(p.x + p.w * 1.05), y0 = Math.round(p.y); return { x0, y0, w: Math.round(p.x + p.w * 2.75) - x0, h: Math.round(p.y + p.h * 2.0) - y0 }; };

test('실제 화면: 숫자 바로 아래에 퀘스트 글자가 붙어 있어도 앱이 자르는 영역에서 27.48을 읽는다', () => {
  const r = timerRect(BOOSTER_TIMER.label), out = ocrSevenSeg(boosterCrop(r.x0, r.y0, r.w, r.h), r.w, r.h);
  assert.ok(out, '읽기 실패(퀘스트 글자 윗부분이 영역에 들어감)');
  assert.equal(out.text, BOOSTER_TIMER.text);
});

test('실제 화면: 글자 자리가 위아래로 어긋나 위쪽 테두리나 아래 퀘스트 글자가 더 들어와도 27.48을 읽는다', () => {
  for (let dy = -6; dy <= 2; dy++) {
    const r = timerRect({ ...BOOSTER_TIMER.label, y: BOOSTER_TIMER.label.y + dy }), out = ocrSevenSeg(boosterCrop(r.x0, r.y0, r.w, r.h), r.w, r.h);
    assert.equal(out && out.text, BOOSTER_TIMER.text, 'dy ' + dy);
  }
});

// ---- 버퍼 재사용 (스펙 9.3 ④): 결과는 그대로, 크기가 같거나 작으면 적분 배열을 새로 만들지 않는다 ----
import { matchStats } from '../src/core/match.js';
function matchRef(img, W, H, tpl) {          // 분리 전 원본 알고리즘(호출마다 새 배열)
  const { t, w, h, norm } = tpl; if (W < w || H < h || norm < 1e-3) return { score: 0, x: 0, y: 0 };
  const W1 = W + 1, S = new Float64Array(W1 * (H + 1)), Q = new Float64Array(W1 * (H + 1));
  for (let y = 0; y < H; y++) { let rs = 0, rq = 0; for (let x = 0; x < W; x++) { const v = img[y * W + x]; rs += v; rq += v * v; S[(y + 1) * W1 + x + 1] = S[y * W1 + x + 1] + rs; Q[(y + 1) * W1 + x + 1] = Q[y * W1 + x + 1] + rq; } }
  const n = w * h; let best = -2, bx = 0, by = 0;
  for (let y = 0; y <= H - h; y++) for (let x = 0; x <= W - w; x++) { const a = y * W1 + x, b = a + w, c = (y + h) * W1 + x, d = c + w; const sum = S[d] - S[b] - S[c] + S[a], sq = Q[d] - Q[b] - Q[c] + Q[a]; const v = sq - sum * sum / n; if (v < 1e-3) continue; let cr = 0; for (let ty = 0; ty < h; ty++) { const ro = (y + ty) * W + x, to = ty * w; for (let tx = 0; tx < w; tx++) cr += t[to + tx] * img[ro + tx]; } const sc = cr / (norm * Math.sqrt(v)); if (sc > best) { best = sc; bx = x; by = y; } }
  return { score: Math.max(best, 0), x: bx, y: by };
}

test('matchTemplate: 크기가 다른 호출을 번갈아 해도 원본 알고리즘과 같은 결과', () => {
  const cases = [[80, 50, 1], [30, 20, 2], [64, 36, 3], [80, 50, 4], [17, 41, 5]];
  for (const [W, H, seed] of cases) {
    const img = noiseImage(W, H, seed), tpl = prepTemplate(crop(img, W, 3, 2, 8, 8), 8, 8), other = noiseImage(W, H, seed + 100);
    for (const im of [img, other]) assert.deepEqual(matchTemplate(im, W, H, tpl), matchRef(im, W, H, tpl));
  }
});

test('matchTemplate: 적분 배열은 더 큰 크기가 필요할 때만 새로 만든다', () => {
  const tpl = prepTemplate(noiseImage(8, 8, 9), 8, 8);
  matchTemplate(noiseImage(100, 80, 1), 100, 80, tpl);
  const after = matchStats.allocs;
  matchTemplate(noiseImage(40, 30, 2), 40, 30, tpl); matchTemplate(noiseImage(100, 80, 3), 100, 80, tpl);
  assert.equal(matchStats.allocs, after);
  matchTemplate(noiseImage(200, 100, 4), 200, 100, tpl);
  assert.equal(matchStats.allocs, after + 1);
});

// ---- 마스크 비교: 버프 아이콘의 남은 시간 숫자 띠 빼기(2026-11-10 실제 화면에서 솔 야누스를 못 찾던 문제), 룬 마름모 ----
import { bandMask, diamondMask, maskRects } from '../src/core/match.js';
import { KINDS } from '../src/core/kinds.js';
import { SOL_TIMER, grayOf } from './fixtures/sol-janus-timer.js';
import { RUNE_MINIMAP, grayOf as gunzipGray } from './fixtures/rune-minimap.js';
const L_plain = x => JSON.parse(JSON.stringify(x));
const rowsOf = (m, w, h) => [...Array(h).keys()].filter(y => m[y * w]);

test('bandMask: 행 중심 비율이 lo~hi인 가운데 띠를 뺀다', () => {
  assert.deepEqual(rowsOf(bandMask(28, 28, 0.27, 0.78), 28, 28), [0, 1, 2, 3, 4, 5, 6, 7, 22, 23, 24, 25, 26, 27]);
  assert.deepEqual(rowsOf(bandMask(14, 14, 0.27, 0.78), 14, 14), [0, 1, 2, 3, 11, 12, 13]);
  assert.deepEqual(L_plain(maskRects(bandMask(10, 10, 0.27, 0.78), 10, 10)), [[0, 3, 0, 10], [8, 10, 0, 10]]);   // 위아래 사각형 두 개
});

test('diamondMask: 11×11은 |dx|+|dy|≤5 마름모(61픽셀), 행마다 사각형 하나', () => {
  const m = diamondMask(11, 11), n = m.reduce((a, b) => a + b, 0);
  assert.equal(n, 61);
  assert.equal(m[0 * 11 + 5], 1); assert.equal(m[0 * 11 + 4], 0); assert.equal(m[5 * 11 + 0], 1); assert.equal(m[1 * 11 + 3], 0);
  assert.equal(maskRects(m, 11, 11).length, 11);
  assert.deepEqual(L_plain(maskRects(undefined, 7, 5)), [[0, 5, 0, 7]]);
});

test('matchTemplate 마스크: 뺀 부분의 내용이 바뀌어도 원래 위치에서 점수 약 1', () => {
  const W = 60, H = 40, img = noiseImage(W, H, 7), tg = crop(img, W, 13, 7, 10, 10), other = noiseImage(W, H, 55);
  const changed = Float32Array.from(img);
  for (let y = 7 + 3; y <= 7 + 7; y++) for (let x = 13; x < 23; x++) changed[y * W + x] = other[y * W + x];   // 가운데 띠(행 3~7)를 다른 무늬로 덮음
  const whole = matchTemplate(changed, W, H, prepTemplate(tg, 10, 10));
  const masked = matchTemplate(changed, W, H, prepTemplate(tg, 10, 10, bandMask(10, 10, 0.27, 0.78)));
  assert.ok(whole.score < 0.8, 'whole ' + whole.score);
  assert.equal(masked.x, 13); assert.equal(masked.y, 7);
  assert.ok(masked.score > 0.999, 'masked ' + masked.score);
});

test('실제 화면: 남은 시간 "23"이 찍힌 솔 야누스 아이콘은 통째로는 기준값 아래, 숫자 띠를 빼면 찾는다', () => {
  const { frame, icon, at } = SOL_TIMER, img = grayOf(frame), g = grayOf(icon), band = KINDS.buff.timerBand;
  const whole = matchTemplate(img, frame.w, frame.h, prepTemplate(g, icon.w, icon.h));
  const masked = matchTemplate(img, frame.w, frame.h, prepTemplate(g, icon.w, icon.h, bandMask(icon.w, icon.h, band[0], band[1])));
  assert.ok(whole.score < 0.75, 'whole ' + whole.score);        // 솔 야누스 기준값 0.75 아래 = 고치기 전에 못 찾던 이유
  assert.deepEqual([masked.x, masked.y], [at.x, at.y]);
  assert.ok(masked.score > 0.85, 'masked ' + masked.score);
});

test('실제 미니맵: 룬 마름모만 비교하면 룬은 찾고, 룬이 없는 미니맵(다른 플레이어·포털 표시)은 기준값 0.8 아래', () => {
  const { withRune, noRune, rune, at } = RUNE_MINIMAP, R = gunzipGray(rune), tp = prepTemplate(R, 11, 11, diamondMask(11, 11));
  const hit = matchTemplate(gunzipGray(withRune), withRune.w, withRune.h, tp);
  assert.deepEqual([hit.x, hit.y], [at.x, at.y]); assert.ok(hit.score > 0.99, 'hit ' + hit.score);
  const miss = matchTemplate(gunzipGray(noRune), noRune.w, noRune.h, tp);
  assert.ok(miss.score < 0.7, 'miss ' + miss.score);
});

test('실제 미니맵: 룬을 다른 맵 배경에 옮겨 놓아도 마름모 비교는 점수 약 1, 통째 비교는 배경 때문에 떨어진다', () => {
  const { noRune, rune } = RUNE_MINIMAP, R = gunzipGray(rune), M = diamondMask(11, 11), bg = gunzipGray(noRune), X = 120, Y = 30;
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) if (M[y * 11 + x]) bg[(Y + y) * noRune.w + X + x] = R[y * 11 + x];   // 마름모 픽셀만 옮김(모서리는 그 맵 배경)
  const masked = matchTemplate(bg, noRune.w, noRune.h, prepTemplate(R, 11, 11, M));
  const whole = matchTemplate(bg, noRune.w, noRune.h, prepTemplate(R, 11, 11));
  assert.deepEqual([masked.x, masked.y], [X, Y]); assert.ok(masked.score > 0.999, 'masked ' + masked.score);
  assert.ok(whole.score < masked.score - 0.05, `whole ${whole.score}`);
});
