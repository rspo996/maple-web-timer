const test = require('node:test');
const assert = require('node:assert/strict');
const { toGray, prepTemplate, matchTemplate } = require('../js/match.js');
const { ocrSevenSeg, SEG_DIGITS } = require('../js/detect-core.js');

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

// ---- 버퍼 재사용 (스펙 9.3 ④): 결과는 그대로, 크기가 같거나 작으면 적분 배열을 새로 만들지 않는다 ----
const { matchStats } = require('../js/match.js');
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
