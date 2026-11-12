import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.js';
import { planGroup, groupText } from '../src/core/alerts-core.js';

const L = await load(['util', 'detect-core', 'targets', 'kinds']);
const KINDS = L.get('KINDS'), newState = L.newState, plain = L.plain;
const NOW = 1_000_000;
const buff = (id, over = {}) => ({ id, kind: 'buff', name: id, enabled: true, p: { leadSec: 10 }, ...over });
// 아이콘 숫자로 남은 시간 remain초를 지금 읽어 둔 버프 상태(2026-11-11부터 버프도 숫자를 읽는다)
const on = (remain, over = {}) => Object.assign(newState(), { present: true, remain, remainAt: NOW }, over);
const ids = r => plain(r.members.map(m => m.id));

test('planGroup: 미리 알림이 하나도 없으면 묶을 것이 없다', () => {
  const r = planGroup([], [buff('a')], { a: on(5) }, KINDS, NOW, 10);
  assert.deepEqual(plain(r), { members: [], pulled: [] });
});

test('planGroup: 같은 틱에 둘이 미리 알림이면 둘 다 멤버(당겨온 것 없음)', () => {
  const r = planGroup(['a', 'b'], [buff('a'), buff('b')], { a: on(10, { alertedPre: true }), b: on(10, { alertedPre: true }) }, KINDS, NOW, 10);
  assert.deepEqual([ids(r), plain(r.pulled)], [['a', 'b'], []]);
});

test('planGroup: 남은 시간이 leadSec+windowSec 이하인 다른 버프를 당겨온다(8초 차이=당김, 11초 차이=안 당김)', () => {
  const ts = [buff('a'), buff('b'), buff('c')];
  const st = { a: on(10, { alertedPre: true }), b: on(18), c: on(21) };           // 한계는 10+10=20
  const r = planGroup(['a'], ts, st, KINDS, NOW, 10);
  assert.deepEqual(ids(r), ['a', 'b']); assert.deepEqual(plain(r.pulled), [{ id: 'b', rank: 18 }]);
});

test('planGroup: windowSec에 따라 한계가 달라진다(5초·20초)', () => {
  const ts = [buff('a'), buff('b')], st = { a: on(10, { alertedPre: true }), b: on(14) };
  assert.deepEqual(ids(planGroup(['a'], ts, st, KINDS, NOW, 5)), ['a', 'b']);                 // 한계 15
  assert.deepEqual(ids(planGroup(['a'], ts, { ...st, b: on(16) }, KINDS, NOW, 5)), ['a']);
  assert.deepEqual(ids(planGroup(['a'], ts, { ...st, b: on(29) }, KINDS, NOW, 20)), ['a', 'b']);   // 한계 30
});

test('planGroup: 남은 시간을 아직 못 읽었거나, 이미 미리 알림을 했거나, 꺼진/비활성 대상은 당기지 않는다', () => {
  const ts = [buff('a'), buff('b'), buff('c'), buff('e', { enabled: false }), buff('f')];
  const st = { a: on(10, { alertedPre: true }), b: on(15, { remain: null }), c: on(15, { alertedPre: true }), e: on(15), f: on(15, { present: false }) };
  assert.deepEqual(ids(planGroup(['a'], ts, st, KINDS, NOW, 10)), ['a']);
});

test('planGroup: 룬은 당기지 않는다, 부스터는 읽은 남은 시간으로 당긴다', () => {
  const rune = { id: 'r', kind: 'rune', name: '룬', enabled: true, p: { repeatSec: 60 } };
  const cd = { id: 'cd', kind: 'countdown', name: '부스터', enabled: true, p: { leadSec: 10 } };
  const st = { a: on(10, { alertedPre: true }), r: Object.assign(newState(), { present: true }), cd: Object.assign(newState(), { present: true, remain: 25, remainAt: NOW - 8000 }) };   // 지금 17초
  const r = planGroup(['a'], [buff('a'), rune, cd], st, KINDS, NOW, 10);
  assert.deepEqual(ids(r), ['a', 'cd']); assert.equal(r.pulled[0].rank, 17);
});

test('groupText: 1·2·3개는 이름 나열, 4개부터는 개수. 남은 시간이 짧은 순(같으면 목록 순서)', () => {
  const it = (label, rank, order) => ({ label, rank, order });
  assert.equal(groupText('pre', [it('A', 10, 0)]), 'A 곧 꺼져요');
  assert.equal(groupText('pre', [it('A', 10, 0), it('B', 4, 1)]), 'B, A 곧 꺼져요');
  assert.equal(groupText('pre', [it('A', 10, 2), it('B', 10, 1), it('C', 12, 0)]), 'B, A, C 곧 꺼져요');
  assert.equal(groupText('pre', [it('A', 1, 0), it('B', 2, 1), it('C', 3, 2), it('D', 4, 3)]), '4개 곧 꺼져요');
  assert.equal(groupText('gone', [it('A', 0, 0), it('B', 0, 1)]), 'A, B 꺼졌어요');
  assert.equal(groupText('gone', [it('A', 0, 0), it('B', 0, 1), it('C', 0, 2), it('D', 0, 3), it('E', 0, 4)]), '5개 꺼졌어요');
});
