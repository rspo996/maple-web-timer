import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.js';
const L = await load(['util', 'detect-core', 'targets', 'kinds', 'slow-watch']);
const { createSlowWatch } = L;

test('createSlowWatch: 평균이 한계를 20틱 연속 넘으면 한 번 알리고, 회복해야 다시 알린다', () => {
  const w = createSlowWatch(450, 20), out = [];
  for (let i = 0; i < 19; i++) out.push(w.push(600));
  assert.ok(out.every(v => v === null));                    // 19틱까지는 아직
  assert.equal(w.push(600), 600);                           // 20틱째에 평균(ms)을 돌려줌
  for (let i = 0; i < 10; i++) assert.equal(w.push(600), null);   // 계속 느려도 다시 알리지 않음
  for (let i = 0; i < 30; i++) w.push(100);                 // 회복
  const again = []; for (let i = 0; i < 40; i++) again.push(w.push(700));   // 평균이 한계를 넘는 데 몇 틱 걸린 뒤 다시 20틱
  assert.equal(again.filter(v => v !== null).length, 1); assert.ok(again.find(v => v !== null) > 450);
});

test('createSlowWatch: 한계 이하이면 세지 않는다(한 번 튀는 값은 평균에 묻힌다)', () => {
  const w = createSlowWatch(450, 20);
  for (let i = 0; i < 100; i++) assert.equal(w.push(i % 10 === 0 ? 900 : 100), null);
});
