const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/manual-core.js');
const { manualEmptyStore, manualNew, manualStart, manualPause, manualReset, manualAdjust, manualRemainMs, manualFmt } = M;

const T0 = 1_000_000;
const cd = (sec = 60, preSec = 10, label = '경쿠') => { const s = manualEmptyStore(); return manualNew(s, 'countdown', label, [{ name: label, sec }], preSec); };
const rt = (a = 20, b = 10, preSec = 5) => { const s = manualEmptyStore(); return manualNew(s, 'routine', '사냥·회수', [{ name: '사냥', sec: a }, { name: '회수', sec: b }], preSec); };

// ---- Task 1: 상태 전이 ----
test('manualNew: id는 m+증가 숫자, 대기 상태, 남은 시간은 첫 구간 전체', () => {
  const s = manualEmptyStore();
  const a = manualNew(s, 'countdown', '경쿠', [{ name: '경쿠', sec: 1800 }], 10);
  const b = manualNew(s, 'countdown', '알림', [{ name: '알림', sec: 60 }], 10);
  assert.equal(a.id, 'm1'); assert.equal(b.id, 'm2'); assert.equal(s.seq, 2);
  assert.deepEqual([a.status, a.idx, a.cycles, a.endAt, a.remainMs, a.preDone, a.preHeard, a.doneAt], ['idle', 0, 0, null, 1_800_000, false, false, null]);
});

test('manualNew: 같은 이름이 있으면 뒤에 번호를 붙인다', () => {
  const s = manualEmptyStore();
  s.timers.push(manualNew(s, 'countdown', '10분 타이머', [{ name: '10분 타이머', sec: 600 }], 10));
  const b = manualNew(s, 'countdown', '10분 타이머', [{ name: '10분 타이머', sec: 600 }], 10); s.timers.push(b);
  const c = manualNew(s, 'countdown', '10분 타이머', [{ name: '10분 타이머', sec: 600 }], 10);
  assert.equal(b.label, '10분 타이머 2'); assert.equal(c.label, '10분 타이머 3');
});

test('manualStart·manualRemainMs: 시작하면 endAt=now+남은 시간, 입력을 바꾸지 않는다', () => {
  const t = cd(60); const r = manualStart(t, T0);
  assert.equal(t.status, 'idle');
  assert.deepEqual([r.status, r.endAt], ['running', T0 + 60_000]);
  assert.equal(manualRemainMs(r, T0 + 15_000), 45_000);
  assert.equal(manualRemainMs(r, T0 + 99_000), 0);
});

test('일시정지 동안 줄지 않고, 계속하면 그 남은 시간부터', () => {
  let t = manualStart(cd(60), T0);
  t = manualPause(t, T0 + 20_000);
  assert.deepEqual([t.status, t.endAt, t.remainMs], ['paused', null, 40_000]);
  assert.equal(manualRemainMs(t, T0 + 500_000), 40_000);
  t = manualStart(t, T0 + 500_000);
  assert.deepEqual([t.status, t.endAt], ['running', T0 + 540_000]);
});

test('manualReset: 첫 구간 전체 길이, 대기, 미리 알림 기록 초기화', () => {
  let t = manualStart(rt(), T0); t = { ...t, idx: 1, cycles: 3, preDone: true, preHeard: true };
  const r = manualReset(t);
  assert.deepEqual([r.status, r.idx, r.cycles, r.endAt, r.remainMs, r.preDone, r.preHeard], ['idle', 0, 0, null, 20_000, false, false]);
});

test('다 끝난 카운트다운을 시작하면 처음부터 다시 실행', () => {
  const t = { ...cd(60), status: 'done', remainMs: 0, doneAt: T0, preDone: true, preHeard: true };
  const r = manualStart(t, T0 + 5000);
  assert.deepEqual([r.status, r.endAt, r.doneAt, r.preDone, r.preHeard], ['running', T0 + 65_000, null, false, false]);
});

test('manualAdjust: 실행 중·멈춤 모두 남은 시간에 더하고 빼며 0 아래로 가지 않는다', () => {
  let t = manualStart(cd(60), T0);
  assert.equal(manualRemainMs(manualAdjust(t, 60_000, T0), T0), 120_000);
  assert.equal(manualRemainMs(manualAdjust(t, -600_000, T0 + 1000), T0 + 1000), 0);
  t = manualPause(t, T0 + 10_000);
  assert.equal(manualAdjust(t, -10_000, T0).remainMs, 40_000);
  assert.equal(manualAdjust(t, -99_000, T0).remainMs, 0);
  const done = { ...cd(60), status: 'done', remainMs: 0 };
  assert.deepEqual(manualAdjust(done, 10_000, T0), done);   // 끝난 것은 그대로
});

test('manualAdjust: 미리 알림 창 밖으로 나가면 다시 울릴 수 있게, 창 안으로 들어가면 울리지 않게', () => {
  let t = { ...manualStart(cd(60, 10), T0), preDone: true, preHeard: true };      // 남은 60초에서 이미 울렸다고 가정
  const out = manualAdjust(t, 0, T0 + 52_000);                                    // 남은 8초(창 안) → 그대로
  assert.deepEqual([out.preDone, out.preHeard], [true, true]);
  const back = manualAdjust({ ...t }, 60_000, T0 + 52_000);                       // 남은 68초(창 밖) → 다시 준비
  assert.deepEqual([back.preDone, back.preHeard], [false, false]);
  const fresh = manualStart(cd(60, 10), T0);
  const into = manualAdjust(fresh, -55_000, T0);                                  // 남은 5초(창 안으로) → 울리지 않음
  assert.deepEqual([into.preDone, into.preHeard], [true, false]);
});

test('manualFmt: 올림, 1시간 미만은 m:ss, 이상은 h:mm:ss', () => {
  assert.equal(manualFmt(0), '0:00');
  assert.equal(manualFmt(59_100), '1:00');
  assert.equal(manualFmt(750_000), '12:30');
  assert.equal(manualFmt(3_723_000), '1:02:03');
  assert.equal(manualFmt(-5000), '0:00');
});
