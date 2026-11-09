import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDetector, stepCountdown, newState, UNREAD_MS } from '../src/core/detect-core.js';

// 0.5초 간격 틱을 흉내 낸다. seq: 'x'=일치, '.'=불일치. 틱마다 나온 이벤트를 [{t, ev}]로 모은다.
function run(st, cfg, seq, start = 1_000_000) {
  const out = []; let now = start;
  for (const c of seq) { for (const ev of stepDetector(st, cfg, c === 'x', now)) out.push({ t: now, ev }); now += 500; }
  return out;
}
const buff = (o = {}) => ({ kind: 'buff', durationSec: null, leadSec: 10, ...o });
const names = evs => evs.map(e => (typeof e.ev === 'string' ? e.ev : Object.keys(e.ev)[0]));

test('켜짐은 연속 2번 일치해야 인정, 이미 켜져 있던 것은 appear-unknown', () => {
  const st = newState();
  assert.deepEqual(names(run(st, buff(), 'x')), []);
  assert.equal(st.present, false);
  assert.deepEqual(names(run(st, buff(), 'x', 1_000_500)), ['appear-unknown']);
  assert.equal(st.present, true); assert.equal(st.appearedAt, null);
});

test('꺼진 것을 4틱 본 뒤(armed)에는 appear와 켜진 시각을 기록', () => {
  const st = newState(), c = buff();
  run(st, c, '....');                       // armed
  assert.equal(st.armed, true);
  const ev = run(st, c, 'xx', 1_010_000);
  assert.deepEqual(names(ev), ['appear']);
  assert.equal(st.appearedAt, 1_010_500);
});

test('꺼짐은 연속 4번 불일치, 중간에 한 번 일치하면 세기가 처음부터', () => {
  const st = newState(), c = buff({ durationSec: 600 });
  run(st, c, '....xx', 1_000_000);
  assert.deepEqual(names(run(st, c, '...x...', 1_010_000)), []);   // 4번 연속이 아니므로 켜짐 유지
  assert.equal(st.present, true);
  assert.deepEqual(names(run(st, c, '....', 1_020_000)), ['gone']);
  assert.equal(st.present, false);
});

test('지속시간 학습: 15초 이상일 때만 {learn}, 15초 미만은 학습하지 않음', () => {
  let st = newState(), c = buff();
  run(st, c, '....'); run(st, c, 'xx', 2_000_000);      // 켜짐 2_000_500
  const long = run(st, c, '.'.repeat(4), 2_000_500 + 60_000);
  const learn = long.find(e => e.ev.learn);
  assert.ok(learn, '학습 이벤트');
  assert.equal(learn.ev.learn, Math.round((2_000_500 + 60_000 + 1500 - 2_000_500) / 1000 - 2));   // 꺼짐 확정 시각은 4번째 불일치(+1.5초)
  st = newState(); run(st, c, '....'); run(st, c, 'xx', 3_000_000);
  const short = run(st, c, '....', 3_000_500 + 8_000);
  assert.equal(short.find(e => e.ev.learn), undefined);
});

test('미리 알림은 끝나기 leadSec 전에 한 번, 이후 꺼져도 꺼짐 알림 없음(정책)', () => {
  const st = newState(), c = buff({ durationSec: 60, leadSec: 10 });
  run(st, c, '....'); run(st, c, 'xx', 5_000_000);       // appearedAt 5_000_500
  const before = stepDetector(st, c, true, 5_000_500 + 49_900);
  assert.deepEqual(before, []);
  const at = stepDetector(st, c, true, 5_000_500 + 50_000);
  assert.deepEqual(at, ['pre']);
  assert.deepEqual(stepDetector(st, c, true, 5_000_500 + 55_000), []);
  const off = run(st, c, '....', 5_000_500 + 70_000);
  assert.deepEqual(names(off), []);
  assert.equal(st.alertedPre, false);                    // 다음 주기를 위해 초기화
});

test('미리 알림 전에 꺼지면 꺼짐 알림 한 번', () => {
  const st = newState(), c = buff({ durationSec: 600 });
  run(st, c, '....'); run(st, c, 'xx', 6_000_000);
  assert.deepEqual(names(run(st, c, '....', 6_020_000)), ['gone']);
});

test('countdown 종류: 미리 알림을 못 울렸을 때만 gone', () => {
  const c = { kind: 'countdown', leadSec: 10 };
  let st = newState(); run(st, c, '....'); run(st, c, 'xx', 7_000_000);
  assert.deepEqual(names(run(st, c, '....', 7_010_000)), ['gone']);
  st = newState(); run(st, c, '....'); run(st, c, 'xx', 8_000_000); st.alertedPre = true;
  assert.deepEqual(names(run(st, c, '....', 8_010_000)), []);
});

test('rune: repeatSec마다 remind, 0이면 끔', () => {
  const c = { kind: 'rune', repeatSec: 60 };
  const st = newState(); run(st, c, '....'); run(st, c, 'xx', 9_000_000);
  assert.deepEqual(stepDetector(st, c, true, 9_000_500 + 59_000), []);
  assert.deepEqual(stepDetector(st, c, true, 9_000_500 + 60_000), ['remind']);
  assert.deepEqual(stepDetector(st, c, true, 9_000_500 + 61_000), []);
  const off = { kind: 'rune', repeatSec: 0 }, s2 = newState(); run(s2, off, '....'); run(s2, off, 'xx', 9_500_000);
  assert.deepEqual(stepDetector(s2, off, true, 9_500_500 + 999_000), []);
});

// ---- stepCountdown ----
test('stepCountdown: 꺼져 있으면 상태를 비우고 이벤트 없음', () => {
  const st = newState(); st.remain = 30; st.cand = 5;
  assert.deepEqual(stepCountdown(st, { leadSec: 10 }, 12, 1000), []);
  assert.equal(st.remain, null); assert.equal(st.cand, null);
});

test('stepCountdown: 첫 값은 후보로만 두고, 후보·예상과 맞는 값이 와야 받아들인다', () => {
  const st = newState(), c = { leadSec: 10 }; st.present = true; st.presentAt = 0;
  assert.deepEqual(stepCountdown(st, c, 30, 0), []);
  assert.equal(st.remain, null);
  assert.deepEqual(stepCountdown(st, c, 29.5, 500), []);     // 후보(30-0.5)와 일치
  assert.equal(st.remain, 29.5);
  assert.deepEqual(stepCountdown(st, c, 5, 600), []);        // 예상(29.4)과 크게 다른 값 하나는 무시(후보로만)
  assert.equal(st.remain, 29.5);
});

test('stepCountdown: 10초 이하에서 pre 한 번, 0은 pre 아님, 새 부스터(leadSec+5 초과)면 다시 준비', () => {
  const st = newState(), c = { leadSec: 10 }; st.present = true; st.presentAt = 0;
  stepCountdown(st, c, 30, 0); stepCountdown(st, c, 29.5, 500);
  assert.deepEqual(stepCountdown(st, c, 10, 20_000), ['pre']);
  assert.deepEqual(stepCountdown(st, c, 9, 21_000), []);
  assert.deepEqual(stepCountdown(st, c, 0, 30_000), []);
  stepCountdown(st, c, 60, 40_000); stepCountdown(st, c, 59.5, 40_500);   // 새로 사용: 60초
  assert.equal(st.alertedPre, false);
  assert.deepEqual(stepCountdown(st, c, 9.5, 91_000), ['pre']);
});

test('stepCountdown: 숫자를 20초 넘게 못 읽으면 unread 한 번, 읽으면 다시 준비', () => {
  const st = newState(), c = { leadSec: 10 }; st.present = true; st.presentAt = 1000;
  assert.equal(UNREAD_MS, 20000);
  assert.deepEqual(stepCountdown(st, c, null, 1000 + UNREAD_MS - 1), []);
  assert.deepEqual(stepCountdown(st, c, null, 1000 + UNREAD_MS), ['unread']);
  assert.deepEqual(stepCountdown(st, c, null, 1000 + UNREAD_MS + 5000), []);
  stepCountdown(st, c, 50, 40_000);
  assert.equal(st.ocrWarned, false);
});

// ---- 묶음 1 스펙 16-1: 당겨 알림(markPre) 뒤에 같은 주기의 pre가 다시 울리지 않아야 함 ----
test('부스터: 당겨 알림으로 pre 처리된 뒤 19초를 읽어도 재무장되지 않아 10초에 pre가 또 울리지 않는다', () => {
  const st = newState(), c = { leadSec: 10 }; st.present = true; st.presentAt = 0;
  stepCountdown(st, c, 20, 0); stepCountdown(st, c, 19.5, 500);
  st.alertedPre = true; st.preMarkRemain = 19.5;               // KINDS.countdown.markPre가 하는 일
  assert.deepEqual(stepCountdown(st, c, 19, 1000), []);        // 19 > leadSec+5 이지만 재무장하지 않음
  assert.equal(st.alertedPre, true);
  assert.deepEqual(stepCountdown(st, c, 10, 10_000), []);      // 10초에 pre 없음
});

test('부스터: 당겨 알림 뒤에도 새 부스터(표시 값이 훨씬 커짐)를 쓰면 다시 준비', () => {
  const st = newState(), c = { leadSec: 10 }; st.present = true; st.presentAt = 0;
  stepCountdown(st, c, 20, 0); stepCountdown(st, c, 19.5, 500);
  st.alertedPre = true; st.preMarkRemain = 19.5;
  stepCountdown(st, c, 60, 5000); stepCountdown(st, c, 59.5, 5500);   // 60 > 19.5+5
  assert.equal(st.alertedPre, false);
});

test('부스터 자체 pre도 preMarkRemain을 남기고, 새 주기가 시작되면 지운다', () => {
  const st = newState(), c = { leadSec: 10 }; st.present = true; st.presentAt = 0;
  stepCountdown(st, c, 11, 0); stepCountdown(st, c, 10.5, 500);
  assert.deepEqual(stepCountdown(st, c, 10, 1000), ['pre']);
  assert.equal(st.preMarkRemain, 10);
  const d = newState(); assert.equal(d.preMarkRemain, 0);
});
