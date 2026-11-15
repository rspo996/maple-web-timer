import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.js';
const L = await load(['scan', 'match']);
const { nearRect, scanSlice, matchTemplate, prepTemplate } = L;

const AREA = { x: 100, y: 0, w: 800, h: 300 };

test('nearRect: 찾은 자리를 아이콘 한 칸(가로·세로 중 큰 쪽)만큼 넓힌다', () => {
  assert.deepEqual(nearRect({ x: 400, y: 100, w: 32, h: 32 }, AREA), { x: 368, y: 68, w: 96, h: 96 });
  assert.deepEqual(nearRect({ x: 400, y: 100, w: 97.5, h: 28.5 }, AREA), { x: 302, y: 2, w: 294, h: 225 });
});

test('nearRect: 감지 영역 밖으로는 넓히지 않고, 겹치지 않으면 null', () => {
  assert.deepEqual(nearRect({ x: 110, y: 5, w: 32, h: 32 }, AREA), { x: 100, y: 0, w: 74, h: 69 });
  assert.deepEqual(nearRect({ x: 880, y: 280, w: 32, h: 32 }, AREA), { x: 848, y: 248, w: 52, h: 52 });
  assert.equal(nearRect({ x: 2000, y: 2000, w: 32, h: 32 }, AREA), null);
});

test('scanSlice: step이 없거나 후보 수 이상이면 전부(예전대로)', () => {
  assert.deepEqual(scanSlice(4, 0, 0), { idx: [0, 1, 2, 3], next: 0 });
  assert.deepEqual(scanSlice(4, 2, undefined), { idx: [0, 1, 2, 3], next: 0 });
  assert.deepEqual(scanSlice(3, 1, 5), { idx: [0, 1, 2], next: 0 });
});

test('scanSlice: step개씩 돌아가며 보고, 한 바퀴 돌면 처음으로', () => {
  const seen = []; let c = 0;
  for (let i = 0; i < 5; i++) { const s = scanSlice(4, c, 1); seen.push(s.idx); c = s.next; }
  assert.deepEqual(seen, [[0], [1], [2], [3], [0]]);
  assert.deepEqual(scanSlice(9, 7, 3), { idx: [7, 8, 0], next: 1 });
  assert.deepEqual(scanSlice(4, 9, 1), { idx: [1], next: 2 });   // 후보 수가 줄어도 범위 안으로
});

test('주변만 보기: 넓은 영역 전체와 같은 자리·점수를 찾고, 훨씬 빠르다', () => {
  // 1920×1080 화면의 부스터 검색 영역(축소 0.49)과 같은 크기. 무늬 있는 배경에 템플릿을 심는다
  const W = 566, H = 159, w = 48, h = 14, img = new Float32Array(W * H);
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < img.length; i++) img[i] = rnd() * 255;
  const g = new Float32Array(w * h); for (let i = 0; i < g.length; i++) g[i] = rnd() * 255;
  const X = 300, Y = 60; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img[(Y + y) * W + X + x] = g[y * w + x];
  const tp = prepTemplate(g, w, h);
  const r = nearRect({ x: X, y: Y, w, h }, { x: 0, y: 0, w: W, h: H });
  const sub = new Float32Array(r.w * r.h); for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) sub[y * r.w + x] = img[(r.y + y) * W + r.x + x];
  // 첫 실행의 JIT 준비 시간을 빼려고 여러 번 재서 가장 빠른 값을 비교한다
  const best = f => { let m = Infinity, out; for (let i = 0; i < 4; i++) { const t0 = performance.now(); out = f(); m = Math.min(m, performance.now() - t0); } return [out, m]; };
  const [full, tFull] = best(() => matchTemplate(img, W, H, tp)), [near, tNear] = best(() => matchTemplate(sub, r.w, r.h, tp));
  assert.deepEqual([full.x, full.y], [X, Y]);
  assert.deepEqual([r.x + near.x, r.y + near.y], [X, Y]);
  assert.ok(Math.abs(full.score - near.score) < 1e-6);
  assert.ok(tNear * 4 < tFull, `주변 ${tNear.toFixed(1)}ms, 전체 ${tFull.toFixed(1)}ms`);
});
