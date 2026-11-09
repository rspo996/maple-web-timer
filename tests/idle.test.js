const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../js/idle.js');
const { lumaDiffCount, idleNewState, stepIdle, idleStartSnooze, idleEndSnooze, idleText, idleStats, IDLE_DELTA } = I;

const T0 = 1_000_000;
const CFG = { idleSec: 120, repeatSec: 120, minPx: 8 };
const still = { px: 0 }, moved = { px: 50 };
// 0.5초 간격 틱. obsAt(ms) → obs. 알림 이벤트만 [{at, elapsedSec, repeat}]로 모은다(그 밖의 내부 이벤트는 all에)
function run(S, from, to, obsAt, cfg = CFG) {
  const alarms = [], all = [];
  for (let ms = from; ms <= to; ms += 500) {
    for (const e of stepIdle(S, cfg, obsAt(ms), T0 + ms)) { all.push({ at: ms, e }); if (e && e.idle) alarms.push({ at: ms, ...e.idle }); }
  }
  return { alarms, all };
}

test('lumaDiffCount: 같음 0, 24 미만 흔들림 0, 정확히 24는 센다, 8개만 크게 다르면 8', () => {
  assert.equal(IDLE_DELTA, 24);
  const a = new Float32Array(100).fill(100);
  assert.equal(lumaDiffCount(a, a.slice(), IDLE_DELTA), 0);
  assert.equal(lumaDiffCount(a, a.map(v => v + 23.9), IDLE_DELTA), 0);
  assert.equal(lumaDiffCount(a, a.map(v => v - 24), IDLE_DELTA), 100);
  const b = a.slice(); for (let i = 0; i < 8; i++) b[i * 7] = 200;
  assert.equal(lumaDiffCount(a, b, IDLE_DELTA), 8);
});

test('stepIdle: 첫 유효 샘플은 rebase만, 알림 계산은 그 시각부터', () => {
  const S = idleNewState();
  assert.deepEqual(stepIdle(S, CFG, still, T0), ['rebase']);
  assert.equal(S.phase, 'watch'); assert.equal(S.lastChangeAt, T0);
});

test('stepIdle: 계속 변하면 10분 동안 울리지 않는다', () => {
  const S = idleNewState();
  assert.deepEqual(run(S, 0, 600_000, () => moved).alarms, []);
});

test('stepIdle: 정지하면 마지막 변화+120초에 1번, 120초 간격 2번 더, 그 뒤 없음', () => {
  const S = idleNewState();
  const { alarms } = run(S, 0, 1_000_000, () => still);
  assert.deepEqual(alarms.map(a => [a.at, a.elapsedSec, a.repeat]), [[120_000, 120, false], [240_000, 240, true], [360_000, 360, true]]);
});

test('stepIdle: repeatSec=0이면 처음 한 번만', () => {
  const S = idleNewState();
  assert.equal(run(S, 0, 1_000_000, () => still, { ...CFG, repeatSec: 0 }).alarms.length, 1);
});

test('stepIdle: 알림 뒤 변화가 2틱 연속이면 resume·재무장, 다음 정지에서 다시 울린다', () => {
  const S = idleNewState();
  run(S, 0, 125_000, () => still);
  assert.equal(S.phase, 'idle');
  const r = run(S, 125_500, 126_000, () => moved);
  assert.ok(r.all.some(x => x.e === 'confirm') && r.all.some(x => x.e.resume), JSON.stringify(r.all));
  assert.equal(r.all.find(x => x.e.resume).e.resume.stoppedSec, 126);
  assert.deepEqual([S.phase, S.count], ['watch', 0]);
  const again = run(S, 126_500, 250_000, () => still);
  assert.deepEqual(again.alarms.map(a => a.at), [246_000]);
});

test('stepIdle: 한 틱짜리 번쩍임은 변화로 확정되지 않는다', () => {
  const S = idleNewState();
  run(S, 0, 50_000, () => still);
  run(S, 50_500, 50_500, () => moved);
  const { alarms } = run(S, 51_000, 121_000, () => still);
  assert.deepEqual(alarms.map(a => a.at), [120_000]);
});

test('stepIdle: null 샘플이 끼면 시간을 처음부터(100초 정지 중 null 한 틱 → 다시 120초)', () => {
  const S = idleNewState();
  run(S, 0, 100_000, () => still);
  assert.deepEqual(stepIdle(S, CFG, null, T0 + 100_500), []);
  const { alarms } = run(S, 101_000, 230_000, () => still);
  assert.deepEqual(alarms.map(a => a.at), [221_000]);
});

test('stepIdle: 알림이 울린 뒤 null → watch로, 횟수 0, 이전 알림의 반복은 나가지 않는다', () => {
  const S = idleNewState();
  run(S, 0, 121_000, () => still);
  stepIdle(S, CFG, null, T0 + 121_500);
  const { alarms } = run(S, 122_000, 245_000, () => still);
  assert.deepEqual(alarms.map(a => [a.at, a.repeat]), [[242_000, false]]);
});

test('stepIdle: 3번 울린 뒤에는 null이 끼어도 다시 울리지 않고, 변화가 확정돼야 다시 준비', () => {
  const S = idleNewState();
  run(S, 0, 400_000, () => still);
  assert.equal(S.count, 3);
  stepIdle(S, CFG, null, T0 + 400_500);
  assert.deepEqual(run(S, 401_000, 900_000, () => still).alarms, []);
  run(S, 900_500, 901_000, () => moved);
  assert.deepEqual(run(S, 901_500, 1_030_000, () => still).alarms.map(a => a.at), [1_021_000]);
});

test('쉬기 10분: 쉬는 동안 알림 없음, 끝나면 시간 처음부터, 쉬기 중 null이어도 끝 시각은 점검', () => {
  const S = idleNewState();
  run(S, 0, 100_000, () => still);
  idleStartSnooze(S, '10m', T0 + 100_000);
  assert.deepEqual([S.phase, S.count, S.snoozeUntil], ['snooze', 0, T0 + 700_000]);
  assert.deepEqual(run(S, 100_500, 699_500, () => still).alarms, []);
  assert.deepEqual(stepIdle(S, CFG, null, T0 + 700_000), ['snooze-end']);
  assert.deepEqual([S.phase, S.lastChangeAt], ['watch', T0 + 700_000]);
});

test('쉬기 "다시 변할 때까지": 시작 15초 안의 변화는 무시, 그 뒤 변화에서 풀린다', () => {
  const S = idleNewState();
  run(S, 0, 10_000, () => still);
  idleStartSnooze(S, 'until-change', T0 + 10_000);
  assert.equal(S.snoozeUntil, Infinity);
  run(S, 10_500, 11_000, () => moved);                         // 0.5~1초 뒤 변화 → 무시
  assert.equal(S.phase, 'snooze');
  const r = run(S, 30_000, 30_500, () => moved);              // 20초 뒤 변화 → 풀림
  assert.ok(r.all.some(x => x.e === 'snooze-end')); assert.equal(S.phase, 'watch');
});

test('쉬기 끝내기: watch로, 시간 처음부터', () => {
  const S = idleNewState(); run(S, 0, 5000, () => still);
  idleStartSnooze(S, '30m', T0 + 5000); idleEndSnooze(S, T0 + 9000);
  assert.deepEqual([S.phase, S.lastChangeAt, S.snoozeMode], ['watch', T0 + 9000, null]);
});

test('idleText: 60초 미만은 초, 이상은 분(내림)', () => {
  assert.equal(idleText(45), '경험치가 45초째 그대로예요');
  assert.equal(idleText(90), '경험치가 1분째 그대로예요');
  assert.equal(idleText(240), '경험치가 4분째 그대로예요');
});

test('idleStats: 최근 60초의 변화량 최대·중앙값, 변화 확정 횟수', () => {
  const S = idleNewState();
  S.recent = [{ at: T0 - 70_000, px: 99 }, { at: T0 - 50_000, px: 3 }, { at: T0 - 40_000, px: 10 }, { at: T0 - 1000, px: 20 }];
  S.confirms = [T0 - 80_000, T0 - 30_000, T0 - 10_000];
  assert.deepEqual(idleStats(S, T0), { max: 20, med: 10, confirms: 2, n: 3, changedRatio: 0 });
});
