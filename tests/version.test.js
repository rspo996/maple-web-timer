import test from 'node:test';
import assert from 'node:assert/strict';
import { versionLabel, isOtherVersion, shouldCheck, VERSION_GAP } from '../src/core/version-core.js';

// 지역 시각으로 만든 Date의 ISO 문자열(시간대와 상관없이 같은 표기가 나오는지 본다)
const localIso = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).toISOString();

test('versionLabel: 커밋 앞 7자리 · M월 D일 HH:mm(지역 시각, 24시간, 두 자리)', () => {
  assert.equal(versionLabel({ id: 'x', sha: '18202a6', builtAt: localIso(2026, 11, 12, 12, 25) }), '18202a6 · 11월 12일 12:25');
  assert.equal(versionLabel({ id: 'x', sha: '18202a6', builtAt: localIso(2026, 1, 3, 9, 5) }), '18202a6 · 1월 3일 09:05');
  assert.equal(versionLabel({ id: 'x', sha: 'abc1234', builtAt: localIso(2026, 12, 31, 0, 0) }), 'abc1234 · 12월 31일 00:00');
});

test('versionLabel: 커밋 값이 없으면 시각만, 개발 서버면 "개발 중"', () => {
  assert.equal(versionLabel({ id: 'x', sha: '', builtAt: localIso(2026, 11, 12, 12, 25) }), '11월 12일 12:25');
  assert.equal(versionLabel({ id: 'dev', sha: '', builtAt: '' }), '개발 중');
  assert.equal(versionLabel(null), '개발 중');
});

test('isOtherVersion: 받은 id가 지금과 다를 때만 새 버전', () => {
  const cur = { id: 'a-1' };
  assert.equal(isOtherVersion(cur, { id: 'a-1' }), false);
  assert.equal(isOtherVersion(cur, { id: 'b-2', sha: 'b', builtAt: 'x' }), true);
});

test('isOtherVersion: 모양이 맞지 않는 응답은 새 버전으로 보지 않는다', () => {
  const cur = { id: 'a-1' };
  for (const bad of [null, undefined, {}, { id: '' }, { id: 3 }, 'a-2', [], { sha: 'b' }]) assert.equal(isOtherVersion(cur, bad), false, JSON.stringify(bad));
});

test('shouldCheck: 숨은 탭·이미 찾음이면 확인하지 않는다(개발 서버는 initVersion이 자동 확인을 걸지 않는다)', () => {
  const base = { hidden: false, found: false, now: 10 * 60_000, lastAt: 0, gap: VERSION_GAP.interval };
  assert.equal(shouldCheck(base), true);
  assert.equal(shouldCheck({ ...base, hidden: true }), false);
  assert.equal(shouldCheck({ ...base, found: true }), false);
});

test('shouldCheck: 마지막 확인에서 gap이 지나야 확인한다(주기 5분, 탭이 다시 보일 때 60초)', () => {
  assert.equal(VERSION_GAP.interval, 5 * 60_000);
  assert.equal(VERSION_GAP.visible, 60_000);
  const at = (gap, dt) => shouldCheck({ hidden: false, found: false, now: 1_000_000 + dt, lastAt: 1_000_000, gap });
  assert.equal(at(VERSION_GAP.interval, 5 * 60_000 - 1), false);
  assert.equal(at(VERSION_GAP.interval, 5 * 60_000), true);
  assert.equal(at(VERSION_GAP.visible, 59_999), false);
  assert.equal(at(VERSION_GAP.visible, 60_000), true);
});
