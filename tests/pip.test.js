import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.js';
const L = await load(['util', 'detect-core', 'targets', 'kinds', 'manual-core', 'pip-core']);
const { buildPipRows, pipFlashKind, pipLevel, plain } = L;
const NOW = 5_000_000;
const row = (o) => ({ id: 'sol', name: '솔 야누스', kind: 'buff', enabled: true, stripState: 'ok', stripText: null, statusText: '켜짐 · 학습 중', statusCls: 'on', remainSec: null, ...o });

test('buildPipRows: 대상 행(켜짐·곧 끝나요·꺼짐·못 찾음·등록 필요·꺼둠·룬 있음)', () => {
  const rows = plain(buildPipRows([
    row({ statusText: '남은 시간 03:12', remainSec: 192 }),
    row({ id: 'booster', name: '부스터', statusText: '남은 시간 00:08', statusCls: 'alert', remainSec: 8 }),
    row({ id: 'u1', name: '유니온의 힘', statusText: '꺼져 있음', statusCls: 'off' }),
    row({ id: 'u2', name: '유니온의 부', stripState: 'unseen', statusText: '아직 못 찾음', statusCls: 'off' }),
    row({ id: 'rune', name: '룬', stripState: 'reg', statusText: '등록 필요', statusCls: 'off' }),
    row({ id: 'u3', name: '비약', enabled: false, stripState: 'off', statusText: '꺼져 있음', statusCls: 'off' }),
    row({ id: 'u4', name: '룬2', statusText: '룬 있음!', statusCls: 'alert' }),
  ], [], NOW));
  assert.deepEqual(rows.map(r => [r.label, r.stateText, r.remainText, r.level]), [
    ['솔 야누스', '켜짐', '03:12', 'ok'], ['부스터', '곧 끝나요', '00:08', 'alert'], ['유니온의 힘', '꺼져 있음', '', 'idle'],
    ['유니온의 부', '아직 못 찾음', '', 'warn'], ['룬', '등록 필요', '', 'warn'], ['비약', '꺼둠', '', 'idle'], ['룬2', '룬 있음!', '', 'alert']]);
  assert.deepEqual(plain(buildPipRows([], [], NOW)), []);
});

test('buildPipRows: 수동 타이머 행(실행 중·미리 알림 구간·멈춤·대기·끝·루틴 구간)', () => {
  const s = L.manualEmptyStore();
  const a = L.manualStart(L.manualNew(s, 'countdown', '경쿠', [{ name: '경쿠', sec: 1800 }], 10), NOW - 60_000);
  const b = L.manualStart(L.manualNew(s, 'countdown', '알림', [{ name: '알림', sec: 60 }], 10), NOW - 55_000);
  const c = L.manualPause(L.manualStart(L.manualNew(s, 'countdown', '멈춘 것', [{ name: '멈춘 것', sec: 600 }], 10), NOW - 1000), NOW);
  const d = L.manualNew(s, 'routine', '사냥·회수', [{ name: '사냥', sec: 720 }, { name: '회수', sec: 180 }], 10);
  const e = { ...L.manualNew(s, 'countdown', '끝난 것', [{ name: '끝난 것', sec: 60 }], 10), status: 'done', remainMs: 0 };
  const rows = plain(buildPipRows([], [a, b, c, d, e], NOW));
  assert.deepEqual(rows.map(r => [r.id, r.label, r.stateText, r.remainText, r.level]), [
    ['m1', '경쿠', '실행 중', '29:00', 'ok'], ['m2', '알림', '실행 중', '0:05', 'warn'], ['m3', '멈춘 것', '멈춤', '9:59', 'idle'],
    ['m4', '사냥·회수 · 사냥', '대기', '12:00', 'idle'], ['m5', '끝난 것', '끝났어요', '', 'idle']]);
});

test('pipFlashKind: 이벤트 → 깜빡임 종류', () => {
  const k = ['pre', 'gone', 'end', 'next1', 'next2', 'appear', 'remind', 'ready', 'lost', 'stall', 'unread', 'alarm', 'busy', 'back', 'xyz'].map(pipFlashKind);
  assert.deepEqual(plain(k), ['pre', 'gone', 'gone', 'gone', 'gone', 'info', 'info', 'info', 'bad', 'bad', 'bad', 'bad', 'bad', null, null]);
});

test('pipLevel: 알림 뒤 5초 깜빡임 → 30초까지 고정 색 → 원래 수준. 움직임 줄이기면 처음부터 고정', () => {
  const r = { level: 'ok' }, f = { kind: 'pre', at: NOW };
  assert.deepEqual(plain(pipLevel(r, f, NOW + 1000, false)), { cls: 'flash-pre', mark: '!' });
  assert.deepEqual(plain(pipLevel(r, f, NOW + 6000, false)), { cls: 'hold-pre', mark: '!' });
  assert.deepEqual(plain(pipLevel(r, f, NOW + 31_000, false)), { cls: 'lv-ok', mark: '' });
  assert.deepEqual(plain(pipLevel(r, f, NOW + 1000, true)), { cls: 'hold-pre', mark: '!' });
  assert.deepEqual(plain(pipLevel({ level: 'alert' }, null, NOW, false)), { cls: 'lv-alert', mark: '' });
  assert.deepEqual(plain(pipLevel(r, { kind: 'gone', at: NOW }, NOW, false)).mark, '✕');
  assert.deepEqual([pipLevel(r, { kind: 'info', at: NOW }, NOW, false).mark, pipLevel(r, { kind: 'bad', at: NOW }, NOW, false).mark], ['◆', '⚠']);
});
