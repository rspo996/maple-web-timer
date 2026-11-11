import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlerts } from '../src/core/alerts-core.js';

// 소리·화면 쪽은 가짜로 바꿔 끼워 Alerts.fire의 경로만 시험한다
function setup() {
  const log = [];
  const io = { now: () => 1234, play: r => { log.push(['play', r.id, r.event, r.slot, r.mode, r.beep]); return r.slot === 'u1.pre'; },
    ui: (text, tag) => log.push(['ui', text, tag]), flash: ids => log.push(['flash', ids]) };
  return { A: createAlerts(io), log };
}

test('fire: 소리 → 화면 알림 → 카드 깜빡임 순서, 슬롯·깜빡임 기본값은 id.event, card-id', () => {
  const { A, log } = setup();
  A.fire({ src: 'target', id: 'u1', event: 'pre', text: '유니온의 힘 10초 전', beep: 'buff' });
  assert.deepEqual(log, [['play', 'u1', 'pre', 'u1.pre', 'full', 'buff'], ['ui', '유니온의 힘 10초 전', 'u1'], ['flash', ['card-u1']]]);
});

test('fire: slot:null이면 내 소리 슬롯 없음, flash:null이면 깜빡임 없음, mode voice는 음성만(화면 알림 없음)', () => {
  const { A, log } = setup();
  A.fire({ src: 'system', id: 'sys', event: 'back', text: '게임 화면이 다시 들어와요', beep: 'system', slot: null, mode: 'voice', flash: null });
  assert.deepEqual(log, [['play', 'sys', 'back', null, 'voice', 'system']]);
  log.length = 0;
  A.fire({ src: 'system', id: 'sys', event: 'lost', text: 'x', beep: 'system', slot: 'sys.lost', flash: null });
  assert.deepEqual(log.map(l => l[0]), ['play', 'ui']);
});

test('listen: 재생 직후 AlertRec를 한 번 받고, 해제하면 안 받는다. 구독자 오류는 알림을 막지 않는다', () => {
  const { A } = setup(); const got = [];
  const off = A.listen(r => got.push(r));
  A.listen(() => { throw new Error('boom'); });
  A.fire({ src: 'target', id: 'u1', event: 'pre', text: 't', beep: 'buff' });
  assert.deepEqual(got, [{ at: 1234, src: 'target', ids: ['u1'], event: 'pre', text: 't', grouped: false, custom: true }]);
  off(); A.fire({ src: 'target', id: 'u1', event: 'pre', text: 't', beep: 'buff' });
  assert.equal(got.length, 1);
});

test('flush: 묶기 대기열이 없으면 아무 일도 하지 않는다(호출만 가능)', () => {
  const { A, log } = setup(); A.flush(5000); assert.deepEqual(log, []);
});

// ---- 묶기(묶음 1 스펙 6절): 대기열·flush·configure ----
function setupGroup() {
  const log = []; let now = 1000;
  const io = { now: () => now, play: r => { log.push(['play', r.id, r.event, r.slot, r.beep, r.text]); return false; },
    ui: (text, tag) => log.push(['ui', text, tag]), flash: ids => log.push(['flash', ids]) };
  const A = createAlerts(io);
  const pre = (id, rank, order = 0) => ({ src: 'target', id, event: 'pre', text: id + ' 10초 전', beep: 'buff', group: { cls: 'pre', label: id, rank, order } });
  const gone = (id, order = 0) => ({ src: 'target', id, event: 'gone', text: id + ' 꺼졌어요', beep: 'gone', group: { cls: 'gone', label: id, rank: 0, order } });
  return { A, log, pre, gone, setNow: n => { now = n; } };
}

test('묶기가 꺼져 있으면(기본) group이 있어도 즉시 개별 전달', () => {
  const { A, log, pre } = setupGroup();
  A.fire(pre('a', 10)); A.fire(pre('b', 5));
  assert.deepEqual(log.filter(l => l[0] === 'play').map(l => l[1]), ['a', 'b']);
});

test('묶기를 켜면 pre는 flush에서 한 번에: 묶음 슬롯·multi 소리·합친 문구·알림 tag·멤버 카드 깜빡임', () => {
  const { A, log, pre } = setupGroup(); const recs = []; A.listen(r => recs.push(r));
  A.configure({ on: true, windowSec: 10 });
  A.fire(pre('a', 10, 0)); A.fire(pre('b', 4, 1));
  assert.deepEqual(log, []);                                              // 틱이 끝나기 전에는 아무것도 울리지 않는다
  A.flush(1000);
  assert.deepEqual(log, [['play', 'grp', 'pre', 'grp.pre', 'multi', 'b, a 곧 꺼져요'], ['ui', 'b, a 곧 꺼져요', 'grp.pre'], ['flash', ['card-a', 'card-b']]]);
  assert.deepEqual(recs, [{ at: 1000, src: 'target', ids: ['a', 'b'], event: 'pre', text: 'b, a 곧 꺼져요', grouped: true, custom: false }]);
  A.flush(1000); assert.equal(log.length, 3);                             // 비운 뒤에는 다시 울리지 않는다
});

test('묶을 것이 하나뿐이면 개별 알림과 똑같다', () => {
  const { A, log, pre } = setupGroup(); A.configure({ on: true });
  A.fire(pre('a', 10)); A.flush(1000);
  assert.deepEqual(log[0], ['play', 'a', 'pre', 'a.pre', 'buff', 'a 10초 전']);
});

test('gone은 첫 건이 들어온 지 2초 뒤에 묶는다(그 안에 오는 것은 합류), pre와 섞지 않는다', () => {
  const { A, log, pre, gone, setNow } = setupGroup(); A.configure({ on: true });
  setNow(1000); A.fire(gone('a', 0)); A.flush(1000); A.flush(2999);
  setNow(2500); A.fire(gone('b', 1)); A.fire(pre('c', 3, 2)); A.flush(2500);   // pre는 곧바로 개별(멤버 1개), gone은 대기
  assert.deepEqual(log.filter(l => l[0] === 'play').map(l => l[1]), ['c']);
  A.flush(3000);
  assert.deepEqual(log.filter(l => l[0] === 'play').pop(), ['play', 'grp', 'gone', 'grp.gone', 'multi', 'a, b 꺼졌어요']);
});

test('test·system 요청과 group이 없는 요청은 묶지 않고 즉시 전달', () => {
  const { A, log, pre } = setupGroup(); A.configure({ on: true });
  A.fire({ ...pre('a', 10), src: 'test' });
  A.fire({ src: 'system', id: 'sys', event: 'lost', text: 'x', beep: 'system', slot: 'sys.lost', flash: null });
  A.fire({ src: 'target', id: 'r', event: 'appear', text: '룬이 나왔어요', beep: 'rune' });
  assert.deepEqual(log.filter(l => l[0] === 'play').map(l => l[1]), ['a', 'sys', 'r']);
});

test('drop은 대기 중인 대상만 뺀다, clear는 대기열을 비운다, 묶기를 끄면 대기 중인 것을 개별로 내보낸다', () => {
  const { A, log, pre, gone } = setupGroup(); A.configure({ on: true });
  A.fire(pre('a', 10)); A.fire(pre('b', 5)); A.drop('a'); A.flush(1000);
  assert.deepEqual(log.filter(l => l[0] === 'play').map(l => l[1]), ['b']);
  log.length = 0; A.fire(gone('x')); A.clear(); A.flush(9999); assert.deepEqual(log, []);
  A.fire(gone('x')); A.fire(gone('y')); A.configure({ on: false });
  assert.deepEqual(log.filter(l => l[0] === 'play').map(l => l[1]), ['x', 'y']);
});
