const test = require('node:test');
const assert = require('node:assert/strict');
const { createAlerts } = require('../js/alerts.js');

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
