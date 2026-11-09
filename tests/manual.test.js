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

// ---- Task 2: manualStep ----
const { manualStep, MANUAL_LATE_MS } = M;
// 0.5초 간격으로 from~to(ms, T0 기준)를 돌며 나온 이벤트를 모은다
function runTicks(t, from, to, audible = true) {
  const out = [];
  for (let ms = from; ms <= to; ms += 500) { const r = manualStep(t, T0 + ms, audible); t = r.t; for (const e of r.events) out.push({ at: ms, ...e }); }
  return { t, out };
}
const brief = evs => evs.map(e => `${e.type}@${e.at}${e.silent ? ':silent' : ''}${e.late ? ':late' : ''}`);

test('manualStep: 카운트다운 미리 알림 한 번, 끝 한 번, 끝난 뒤에는 이벤트 없음', () => {
  const { t, out } = runTicks(manualStart(cd(60, 10), T0), 0, 70_000);
  assert.deepEqual(brief(out), ['pre@50000', 'end@60000:silent']);   // 미리 알림이 들렸으므로 끝은 무음(정책)
  assert.deepEqual([t.status, t.doneAt, t.endAt, t.remainMs], ['done', T0 + 60_000, null, 0]);
  assert.equal(out[0].slot, 'pre'); assert.equal(out[1].slot, 'end');
  assert.deepEqual(manualStep(t, T0 + 99_000).events, []);
});

test('manualStep: 대기·멈춤 상태에서는 아무 일도 없다', () => {
  assert.deepEqual(manualStep(cd(60), T0 + 99_000).events, []);
  assert.deepEqual(manualStep(manualPause(manualStart(cd(60), T0), T0 + 1000), T0 + 99_000).events, []);
});

test('정책: 미리 알림 0초면 끝이 울린다', () => {
  assert.deepEqual(brief(runTicks(manualStart(cd(60, 0), T0), 0, 61_000).out), ['end@60000']);
});

test('정책: 구간이 미리 알림+3초 이하면 미리 알림 없이 끝이 울린다', () => {
  assert.deepEqual(brief(runTicks(manualStart(cd(13, 10), T0), 0, 14_000).out), ['end@13000']);
  assert.deepEqual(brief(runTicks(manualStart(cd(14, 10), T0), 0, 15_000).out), ['pre@4000', 'end@14000:silent']);
});

test('정책: 틱이 늦어 미리 알림 창에 3초 넘게 늦게 들어오면 건너뛰고, 그러면 끝이 울린다', () => {
  let t = manualStart(cd(60, 10), T0);
  t = manualStep(t, T0 + 40_000).t;                       // 남은 20초
  const late = manualStep(t, T0 + 54_000);                // 남은 6초: 10초 전 창에 4초 늦게 들어옴
  assert.deepEqual(late.events, []); assert.equal(late.t.preDone, true); assert.equal(late.t.preHeard, false);
  const ok = manualStep(t, T0 + 52_500);                  // 남은 7.5초: 2.5초 늦음 → 울림
  assert.equal(ok.events[0].type, 'pre');
  assert.deepEqual(manualStep(late.t, T0 + 60_000).events.map(e => [e.type, e.silent]), [['end', false]]);
});

test('정책: 오디오가 잠긴 채 울린 미리 알림은 들린 것으로 치지 않아 끝이 울린다', () => {
  const { out } = runTicks(manualStart(cd(60, 10), T0), 0, 61_000, false);
  assert.deepEqual(brief(out), ['pre@50000', 'end@60000']);
});

test('±조절로 창 밖에 나갔다 다시 들어오면 미리 알림이 다시 울린다', () => {
  let { t } = runTicks(manualStart(cd(60, 10), T0), 0, 51_000);   // 미리 알림 울림
  assert.equal(t.preHeard, true);
  t = manualAdjust(t, 60_000, T0 + 51_000);                         // 남은 69초
  const r = runTicks(t, 51_500, 125_000);
  assert.deepEqual(brief(r.out), ['pre@110000', 'end@120000:silent']);
});

test('루틴: 1→2→1, 바퀴 수, 경계에서 endAt은 이전 endAt+구간 길이(드리프트 없음), 전환 뒤 미리 알림 기록 초기화', () => {
  let t = manualStart(rt(20, 10, 5), T0);
  const a = runTicks(t, 0, 15_000); assert.deepEqual(brief(a.out), ['pre@15000']);
  const sw = manualStep(a.t, T0 + 20_400);                          // 0.4초 늦은 틱
  assert.deepEqual(sw.events.map(e => [e.type, e.idx, e.slot, e.silent, e.late]), [['switch', 1, 'next1', true, false]]);
  assert.deepEqual([sw.t.idx, sw.t.cycles, sw.t.endAt, sw.t.preDone, sw.t.preHeard], [1, 0, T0 + 30_000, false, false]);
  const b = runTicks(sw.t, 20_500, 30_000);
  assert.deepEqual(brief(b.out), ['pre@25000', 'switch@30000:silent']);
  assert.deepEqual([b.t.idx, b.t.cycles, b.t.endAt, b.out[1].slot], [0, 1, T0 + 50_000, 'next2']);
});

test('늦은 판정: 마지막 경계에서 14.9초면 보통 알림, 15.1초면 late(소리 없이 따라잡음)', () => {
  assert.equal(MANUAL_LATE_MS, 15_000);
  const t = manualStart(cd(60, 0), T0);
  const a = manualStep(t, T0 + 60_000 + 14_900).events[0], b = manualStep(t, T0 + 60_000 + 15_100).events[0];
  assert.deepEqual([a.late, a.lateMs, b.late, b.lateMs], [false, 14_900, true, 15_100]);
});

test('루틴을 1시간 건너뛰면 이벤트는 하나, 지금 구간·바퀴·끝 시각이 수식과 같다', () => {
  const t = manualStart(rt(20, 10, 5), T0);                           // 한 바퀴 30초. 1구간 진입 경계는 30초×k
  const r = manualStep(t, T0 + 3_600_000 + 18_000);
  assert.equal(r.events.length, 1);
  assert.deepEqual([r.events[0].type, r.events[0].idx, r.events[0].late, r.events[0].lateMs], ['switch', 0, true, 18_000]);
  assert.deepEqual([r.t.idx, r.t.cycles, r.t.endAt], [0, 120, T0 + 3_620_000]);
});

test('한 틱에 경계 둘을 지나면(늦음 아님) 전환 하나만 내고, 마지막 구간의 미리 알림은 못 들었으므로 소리를 낸다', () => {
  const t = { ...manualStart(rt(10, 10, 0), T0), preHeard: true };
  const r = manualStep(t, T0 + 21_000);
  assert.deepEqual(r.events.map(e => [e.type, e.idx, e.slot, e.silent, e.late, e.lateMs]), [['switch', 0, 'next2', false, false, 1000]]);
  assert.deepEqual([r.t.idx, r.t.cycles, r.t.endAt], [0, 1, T0 + 30_000]);
});

// ---- Task 3: 저장·내보내기·문구 ----
const { manualLoad, manualExport, manualImport, manualText } = M;
function sampleStore() {
  const s = manualEmptyStore();
  s.timers.push(manualStart(manualNew(s, 'countdown', '경쿠', [{ name: '경쿠', sec: 1800 }], 10), T0));
  s.timers.push(manualNew(s, 'routine', '사냥·회수', [{ name: '사냥', sec: 720 }, { name: '회수', sec: 180 }], 10));
  return s;
}

test('manualLoad: 저장값이 없으면 기본(프리셋 7개), 실행 상태를 그대로 복원', () => {
  const empty = manualLoad(null);
  assert.equal(empty.ok, true); assert.deepEqual(empty.store.presets.map(p => p.label), ['5분', '10분', '15분', '20분', '30분', '1시간', '2시간']);
  const s = sampleStore(), r = manualLoad(JSON.stringify(s));
  assert.equal(r.ok, true); assert.deepEqual(r.store, s);
});

test('manualLoad: JSON 오류·v 불일치·형식 오류면 빈 저장소와 ok:false', () => {
  for (const raw of ['{oops', JSON.stringify({ v: 2, timers: [] }), JSON.stringify([1, 2]), JSON.stringify({ v: 1, timers: 'x' })]) {
    const r = manualLoad(raw); assert.equal(r.ok, false, raw); assert.deepEqual(r.store, manualEmptyStore());
  }
});

test('manualLoad: 잘못된 타이머는 버리고 값은 범위로 보정, seq는 가장 큰 m번호 이상, 8개 상한', () => {
  const s = sampleStore();
  s.seq = 0;
  s.timers.push({ id: 'x9', kind: 'countdown', label: 'a', phases: [{ name: 'a', sec: 60 }] });                       // 잘못된 id
  s.timers.push({ id: 'm7', kind: 'routine', label: 'b', phases: [{ name: 'a', sec: 60 }] });                         // 루틴인데 구간 1개
  s.timers.push({ ...s.timers[0], id: 'm1' });                                                                        // 중복 id
  s.timers.push({ id: 'm5', kind: 'countdown', label: '  ', phases: [{ name: 'z', sec: 3 }], preSec: 999, status: 'running', endAt: 'x' });
  const r = manualLoad(JSON.stringify(s));
  assert.deepEqual(r.store.timers.map(t => t.id), ['m1', 'm2', 'm5']);
  const m5 = r.store.timers[2];
  assert.deepEqual([m5.label, m5.phases[0].sec, m5.preSec, m5.status, m5.endAt, m5.remainMs], ['z', 10, 120, 'idle', null, 10_000]);   // 실행 중인데 끝 시각이 없으면 대기로
  assert.equal(r.store.seq, 7);
  const many = manualEmptyStore();
  for (let i = 0; i < 10; i++) many.timers.push(manualNew(many, 'countdown', 't' + i, [{ name: 't', sec: 60 }], 10));
  assert.equal(manualLoad(JSON.stringify(many)).store.timers.length, 8);
});

test('manualExport: 정의만 내보내고 실행 상태는 뺀다', () => {
  const e = manualExport(sampleStore());
  assert.deepEqual(Object.keys(e.timers[0]).sort(), ['id', 'kind', 'label', 'phases', 'preSec']);
  assert.equal(e.v, 1); assert.equal(e.presets.length, 7); assert.deepEqual(e.prefs, { preSec: 10 });
});

test('manualImport: 불러온 타이머는 모두 대기, 남은 시간은 첫 구간 전체. 잘못된 값은 ok:false', () => {
  const r = manualImport(manualExport(sampleStore()));
  assert.equal(r.ok, true);
  assert.deepEqual(r.store.timers.map(t => [t.status, t.endAt, t.remainMs, t.idx, t.cycles, t.preDone, t.preHeard]),
    [['idle', null, 1_800_000, 0, 0, false, false], ['idle', null, 720_000, 0, 0, false, false]]);
  const old = { ...sampleStore() }; old.timers = old.timers.map(t => ({ ...t, status: 'running', endAt: 5 }));
  assert.equal(manualImport(old).store.timers[0].status, 'idle');      // 며칠 전 파일의 오래된 끝 시각이 살아나지 않음
  assert.equal(manualImport('nope').ok, false); assert.equal(manualImport({ v: 9 }).ok, false);
});

test('manualText: 카운트다운·루틴 문구, 루틴이 둘 이상이면 루틴 이름을 앞에 붙인다', () => {
  const s = sampleStore(), [c, r] = s.timers;
  assert.equal(manualText(c, { type: 'pre', idx: 0 }, s.timers), '경쿠 10초 전');
  assert.equal(manualText(c, { type: 'end', idx: 0 }, s.timers), '경쿠 끝났어요');
  assert.equal(manualText(r, { type: 'pre', idx: 0 }, s.timers), '회수 10초 전');
  assert.equal(manualText(r, { type: 'pre', idx: 1 }, s.timers), '사냥 10초 전');
  assert.equal(manualText(r, { type: 'switch', idx: 1 }, s.timers), '회수 시간이에요');
  assert.equal(manualText(r, { type: 'switch', idx: 0 }, s.timers), '사냥 시간이에요');
  const r2 = manualNew(s, 'routine', '사냥·회수', [{ name: '사냥', sec: 600 }, { name: '회수', sec: 120 }], 10); s.timers.push(r2);
  assert.equal(r2.label, '사냥·회수 2');
  assert.equal(manualText(r2, { type: 'pre', idx: 0 }, s.timers), '사냥·회수 2, 회수 10초 전');
  assert.equal(manualText(r, { type: 'switch', idx: 0 }, s.timers), '사냥·회수, 사냥 시간이에요');
});
