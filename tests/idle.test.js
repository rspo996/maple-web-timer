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

// ---- Task 2: KINDS.idle 종류 정의 ----
const { load } = require('./load.js');
const L = load(['js/util.js', 'js/match.js', 'js/detect-core.js', 'js/targets.js', 'js/kinds.js', 'js/idle.js'], { PRESET_ICONS: { sol: [], booster: [] } });
const KINDS = L.get('KINDS'), K = KINDS.idle, plain = L.plain;
const idleT = (o = {}) => ({ id: 'u4', kind: 'idle', name: '사냥 멈춤', preset: null, enabled: true, threshold: 0.75, area: { x: 100, y: 690, w: 300, h: 20 }, tpl: null, frameW: 1280, frameH: 720, p: K.defaults(), ...o });
const LIVE = { src: true, live: true, frame: { w: 1280, h: 720 } };

test('KINDS.idle: 등록은 영역 한 번, 인스턴스 1개, 감지를 건너뛴 틱에도 step, 기준값 슬라이더 없음', () => {
  assert.deepEqual(plain(K.register.steps), ['area']);
  assert.deepEqual([K.maxInstances, K.onSkip, K.usesThreshold, K.trackSeen, K.menuLabel], [1, true, false, false, '사냥 멈춤']);
  assert.equal(K.isRegistered(idleT({ area: null })), false); assert.equal(K.isRegistered(idleT()), true);
  assert.equal(K.needsReregister(idleT(), { w: 1920, h: 1080 }), true); assert.equal(K.needsReregister(idleT(), { w: 1280, h: 720 }), false);
  assert.deepEqual(plain(K.events.map(e => [e.key, e.beep, e.group, !!e.noSlot])), [['alarm', 'idle', null, false], ['busy', null, null, true]]);
});

test('KINDS.idle.register.validate: 40×6 미만, 높이 8% 초과, 너비 40% 초과는 거절', () => {
  const v = (w, h) => K.register.validate(idleT(), { area: { x: 0, y: 0, w, h } }, { width: 1280, height: 720 });
  assert.equal(v(39, 20), '영역이 너무 작아요'); assert.equal(v(100, 5), '영역이 너무 작아요');
  assert.equal(v(300, 58), '영역이 너무 넓어요. 경험치 막대와 숫자만 드래그해 주세요');
  assert.equal(v(513, 20), '영역이 너무 넓어요. 경험치 막대와 숫자만 드래그해 주세요');
  assert.equal(v(300, 57), null); assert.equal(v(512, 6), null);
});

test('KINDS.idle: 기본값과 p 보정', () => {
  assert.deepEqual(plain(K.defaults()), { idleSec: 120, repeatSec: 120, minPx: 8, thumb: null });
  assert.deepEqual(plain(K.normalizeP({ idleSec: 5, repeatSec: 9999, minPx: 1, thumb: 'javascript:x' })), { idleSec: 10, repeatSec: 600, minPx: 3, thumb: null });
  assert.equal(K.normalizeP({ ...K.defaults(), thumb: 'data:image/png;base64,AA' }).thumb, 'data:image/png;base64,AA');
});

test('KINDS.idle.cardFields: 멈춤 시간(10초~60분)·반복·변화 기준', () => {
  const t = idleT(), f = Object.fromEntries(K.cardFields(t).map(x => [x.key, x]));
  assert.deepEqual(Object.keys(f), ['idleSec', 'repeatSec', 'minPx']);
  assert.equal(f.idleSec.get(t), '02:00');
  assert.deepEqual(plain(f.idleSec.set(t, '0:05')), { revert: true, msg: '멈춤 시간은 10초~60분으로 입력해 주세요' });
  f.idleSec.set(t, '3:30'); assert.equal(t.p.idleSec, 210);
  f.minPx.set(t, '100'); assert.equal(t.p.minPx, 60);
});

test('KINDS.idle.status: 스펙 4.3 표', () => {
  const now = T0, st = s => ({ idle: Object.assign(idleNewState(), s) }), S = (t, x, ctx = LIVE) => plain(K.status(t, x, now, ctx));
  assert.deepEqual(S(idleT({ area: null }), st({})), { text: '등록 필요', cls: 'off', sub: '경험치 막대와 숫자를 드래그' });
  assert.equal(S(idleT(), st({}), { src: false, frame: { w: 0, h: 0 } }).text, '대기 중');
  assert.equal(S(idleT(), st({}), { ...LIVE, frame: { w: 1920, h: 1080 } }).text, '다시 등록 필요');
  assert.deepEqual(S(idleT(), st({}), { ...LIVE, live: false }), { text: '테스트에서는 쉬어요', cls: 'off', sub: '스크린샷은 변하지 않아서 멈춤 감지를 하지 않아요' });
  assert.equal(S(idleT(), st({ phase: 'snooze', snoozeUntil: now + 125_000 })).text, '쉬는 중 02:05 남음');
  assert.equal(S(idleT(), st({ phase: 'snooze', snoozeUntil: Infinity })).text, '쉬는 중 · 다시 변할 때까지');
  assert.deepEqual(S(idleT(), st({ phase: 'watch', gap: false, busy: true })), { text: '영역이 계속 변해요', cls: 'alert', sub: '경험치 막대와 숫자만 드래그해 주세요' });
  assert.equal(S(idleT(), st({ phase: 'watch', gap: true })).text, '쉬는 중 · 화면이 안 들어와요');
  assert.deepEqual(S(idleT(), st({ phase: 'idle', gap: false, lastChangeAt: now - 130_000 })), { text: '멈춤 · 경험치 그대로 02:10', cls: 'alert', sub: '다시 변하면 자동으로 풀려요' });
  assert.deepEqual(S(idleT(), st({ phase: 'watch', gap: false, lastChangeAt: now - 3000 })), { text: '경험치가 움직여요', cls: 'on', sub: '마지막 변화 3초 전' });
  assert.deepEqual(S(idleT(), st({ phase: 'watch', gap: false, lastChangeAt: now - 30_000 })), { text: '경험치 그대로 00:30', cls: 'on', sub: '멈춤 알림까지 01:30' });
  assert.equal(S(idleT(), st({ phase: 'watch', gap: false, lastChangeAt: now - 3000, resumed: { at: now - 3000, stoppedSec: 150 } })).sub, '2분 멈췄다가 다시 변했어요');
});

test('KINDS.idle: 상태줄 값과 글자(쉬는 중·경험치 그대로·영역 확인)', () => {
  const st = s => ({ idle: Object.assign(idleNewState(), { gap: false }, s) });
  const row = s => [K.stripState(idleT(), st(s), T0, LIVE), K.stripText(idleT(), st(s), K.stripState(idleT(), st(s), T0, LIVE))];
  assert.deepEqual(row({ phase: 'snooze', snoozeUntil: Infinity }), ['snooze', '사냥 멈춤 쉬는 중']);
  assert.deepEqual(row({ phase: 'idle' }), ['idle', '사냥 멈춤 · 경험치 그대로']);
  assert.deepEqual(row({ phase: 'watch', busy: true }), ['busy', '사냥 멈춤 영역 확인 필요']);
  assert.deepEqual(row({ phase: 'watch' }), ['ok', null]);
  assert.equal(K.stripState(idleT({ area: null }), st({}), T0, LIVE), 'reg');
});

test('KINDS.idle 알림 문구: 경과 시간, 알림 테스트는 설정한 멈춤 시간', () => {
  const t = idleT(), alarm = K.events[0];
  assert.equal(alarm.msg(t, { elapsedSec: 240 }), '경험치가 4분째 그대로예요');
  assert.equal(alarm.msg(t, {}), '경험치가 2분째 그대로예요');
  assert.equal(K.events[1].msg(t, {}), '사냥 멈춤 영역이 계속 변해서 감시할 수 없어요');
});

test('쉬기 동작 버튼: 쉬는 중이 아니면 3종, 쉬는 중이면 쉬기 끝내기만', () => {
  const st = { idle: Object.assign(idleNewState(), { phase: 'watch', gap: false }) };
  const vis = () => plain(K.actions.filter(a => a.visible(idleT(), st)).map(a => a.label));
  assert.deepEqual(vis(), ['10분 쉬기', '30분 쉬기', '변할 때까지 쉬기']);
  K.actions.find(a => a.key === 'snz10').run(idleT(), st, T0);
  assert.deepEqual([st.idle.phase, st.idle.snoozeUntil], ['snooze', T0 + 600_000]);
  assert.deepEqual(vis(), ['쉬기 끝내기']);
  K.actions.find(a => a.key === 'snzEnd').run(idleT(), st, T0 + 5000);
  assert.equal(st.idle.phase, 'watch');
});
