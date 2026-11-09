import test from 'node:test';
import assert from 'node:assert/strict';
import { fmt, parseDur, clampInt, batchim, eunNeun, eulReul } from '../src/core/util.js';

test('parseDur: 숫자만 쓰면 분, 분:초, 빈 값은 null, 형식 오류는 undefined', () => {
  assert.equal(parseDur('30'), 1800);
  assert.equal(parseDur('1:05'), 65);
  assert.equal(parseDur(' 2:0 '), 120);
  assert.equal(parseDur(''), null);
  assert.equal(parseDur('   '), null);
  assert.equal(parseDur(null), null);
  assert.equal(parseDur('abc'), undefined);
  assert.equal(parseDur('1:2:3'), undefined);
  assert.equal(parseDur('-5'), undefined);
});

test('fmt: 올림해서 mm:ss', () => {
  assert.equal(fmt(0), '00:00');
  assert.equal(fmt(59.2), '01:00');
  assert.equal(fmt(65), '01:05');
  assert.equal(fmt(-3), '00:00');
});

test('clampInt: 범위로 자르고 숫자가 아니거나 하한 미만이면 기본값', () => {
  assert.equal(clampInt('15', 1, 120, 10), 15);
  assert.equal(clampInt('500', 1, 120, 10), 120);
  assert.equal(clampInt('0', 1, 120, 10), 10);
  assert.equal(clampInt('abc', 1, 120, 10), 10);
  assert.equal(clampInt('0', 0, 600, 0), 0);
});

test('받침 조사: 은/는, 을/를', () => {
  assert.equal(batchim('룬'), true);
  assert.equal(batchim('부스터'), false);
  assert.equal(batchim('abc'), false);
  assert.equal(eunNeun('룬'), '룬은');
  assert.equal(eunNeun('부스터'), '부스터는');
  assert.equal(eulReul('룬'), '룬을');
  assert.equal(eulReul('솔 야누스'), '솔 야누스를');
  assert.equal(eulReul('솔 야누스 미리 알림'), '솔 야누스 미리 알림을');
});

test('checkDurLead: 지속시간이 미리 알림 이하이면 거절 문구, 아니면 null', async () => {
  const { checkDurLead } = await import('../src/core/util.js');
  assert.equal(checkDurLead(null, 10, 'duration'), null);
  assert.equal(checkDurLead(60, 10, 'duration'), null);
  assert.equal(checkDurLead(10, 10, 'duration'), '미리 알림(10초)보다 길게 입력해 주세요');
  assert.equal(checkDurLead(5, 10, 'duration'), '미리 알림(10초)보다 길게 입력해 주세요');
  assert.equal(checkDurLead(60, 60, 'lead'), '미리 알림은 지속시간(01:00)보다 짧게 입력해 주세요');
  assert.equal(checkDurLead(60, 59, 'lead'), null);
});

// ---- 묶음 5: 볼륨 ----
test('clampVolumePct·volumeToGain·ttsVolume', async () => {
  const { clampVolumePct, volumeToGain, ttsVolume } = await import('../src/core/util.js');
  assert.deepEqual([-1, 250, 'abc', 80.4, null, undefined, '120'].map(clampVolumePct), [0, 200, 80, 80, 80, 80, 120]);
  assert.deepEqual([0, 80, 100, 200].map(volumeToGain), [0, 0.8, 1, 2]);
  assert.deepEqual([0, 80, 100, 200].map(ttsVolume), [0, 0.8, 1, 1]);
});
