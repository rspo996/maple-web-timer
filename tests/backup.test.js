import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.js';
const L = await load(['util', 'match', 'detect-core', 'targets', 'kinds', 'idle', 'cooldown', 'manual-core', 'backup-core']);
const { bytesToBase64, base64ToBytes, base64Size, backupFileName, buildBackup, migrateBackup, validateBackup, plain } = L;
const PNG = 'data:image/png;base64,' + 'A'.repeat(40);
const WAV64 = Buffer.from('RIFF....WAVEfmt ').toString('base64');

function sample() {
  const store = L.defaultStore();
  store.targets[0].tpl = { url: PNG, w: 32, h: 32 }; store.targets[0].area = { x: 1, y: 2, w: 40, h: 40 }; store.targets[0].frameW = 1280; store.targets[0].frameH = 720;
  const u = L.addBuff(store, '유니온의 힘').target; u.p.durationSec = 1800;
  store.group = { on: true, windowSec: 5 };
  const ms = L.manualEmptyStore(); ms.timers.push(L.manualStart(L.manualNew(ms, 'countdown', '경쿠', [{ name: '경쿠', sec: 1800 }], 10), 1000));
  return { store, ms };
}

test('base64: 0바이트·작은 배열·큰 배열 왕복이 Buffer와 같다', () => {
  for (const n of [0, 5, 70_000]) {
    const u = new Uint8Array(n).map((_, i) => (i * 37 + 11) & 255);
    const b = bytesToBase64(u);
    assert.equal(b, Buffer.from(u).toString('base64'));
    assert.deepEqual(Buffer.from(base64ToBytes(b)), Buffer.from(u));
    assert.equal(base64Size(b), n);
  }
});

test('backupFileName: maple-web-timer-backup-YYYYMMDD-HHmm.json(로컬 시각)', () => {
  assert.equal(backupFileName(new Date(2026, 10, 9, 21, 5)), 'maple-web-timer-backup-20261109-2105.json');
});

test('buildBackup → validateBackup 왕복: 대상·묶기·수동 타이머(정의만, 대기)·소리·음량', () => {
  const { store, ms } = sample();
  const obj = JSON.parse(JSON.stringify(buildBackup({ targets: store, manualTimers: L.manualExport(ms), ui: { volumePct: 150, voice: false, pip: { w: 300, h: 200 } },
    sounds: { 'sol.pre': { name: '알림.wav', dur: 1.5, mime: 'audio/wav', base64: WAV64 }, 'manual.end': { name: 'b.wav', dur: 2, mime: 'audio/wav', base64: WAV64 } } }, new Date(2026, 10, 9, 21, 30))));
  assert.deepEqual([obj.schema, obj.version, plain(obj.includes)], ['maple-web-timer-backup', 1, ['targets', 'manualTimers', 'ui', 'sounds']]);
  const v = plain(validateBackup(obj));
  assert.deepEqual([v.ok, v.errors, v.warnings], [true, [], []]);
  assert.deepEqual(v.groups.targets, plain(L.normalizeStore(store)));
  assert.deepEqual(v.groups.manualTimers.timers.map(t => [t.label, t.status, t.remainMs]), [['경쿠', 'idle', 1_800_000]]);
  assert.deepEqual(v.groups.ui, { volumePct: 150, voice: false, pip: { w: 300, h: 200 } });
  assert.deepEqual(Object.keys(v.groups.sounds), ['sol.pre', 'manual.end']);
  assert.deepEqual(v.counts, { targets: 4, timers: 1, sounds: 2 });
});

test('migrateBackup·validateBackup: 설정 파일이 아님·다른 스키마·미래 버전·데이터 없음', () => {
  assert.equal(migrateBackup(null).msg, '이 파일은 설정 파일이 아닌 것 같아요');
  assert.equal(migrateBackup([1]).msg, '이 파일은 설정 파일이 아닌 것 같아요');
  assert.equal(migrateBackup({ schema: 'x', version: 1 }).msg, '메이플 재획 알리미에서 내보낸 파일이 아니에요');
  assert.equal(migrateBackup({ schema: 'maple-web-timer-backup', version: 2 }).msg, '더 새 버전에서 만든 파일이라 불러올 수 없어요');
  assert.equal(migrateBackup({ schema: 'maple-web-timer-backup', version: 1 }).ok, true);
  assert.deepEqual(plain(validateBackup({ schema: 'maple-web-timer-backup', version: 1 }).errors), ['이 파일에 설정이 들어 있지 않아요']);
  assert.deepEqual(plain(validateBackup({ schema: 'maple-web-timer-backup', version: 1, includes: [], data: {} }).errors), ['불러올 수 있는 설정이 없어요']);
});

test('validateBackup: 잘못된 항목만 건너뛰고 경고(템플릿·모르는 종류·소리 형식·크기·길이·쓰이지 않는 슬롯)', () => {
  const { store } = sample();
  store.targets[1].tpl = { url: 'javascript:alert(1)', w: 10, h: 10 };
  store.targets.push({ id: 'u9', kind: 'future', name: '미래', enabled: true, p: {} });
  const big = 'A'.repeat(Math.ceil(5 * 1024 * 1024 / 3) * 4 + 8);
  const obj = buildBackup({ targets: store, sounds: {
    'sol.pre': { name: 'ok.wav', dur: 1, base64: WAV64 }, 'sol.gone': { name: 'x', dur: 1, base64: '***' }, 'booster.pre': { name: 'big', dur: 1, base64: big },
    'rune.appear': { name: 'long', dur: 11, base64: WAV64 }, 'u77.pre': { name: 'orphan', dur: 1, base64: WAV64 }, 'bad key': { name: 'x', dur: 1, base64: WAV64 } } }, new Date());
  const v = plain(validateBackup(JSON.parse(JSON.stringify(obj))));
  assert.equal(v.ok, true);
  assert.deepEqual(v.groups.targets.targets.map(t => t.id), ['sol', 'booster', 'rune', 'u1']);
  assert.deepEqual([v.groups.targets.targets[1].tpl, v.groups.targets.targets[1].frameW], [null, 0]);
  assert.deepEqual(Object.keys(v.groups.sounds), ['sol.pre']);
  assert.deepEqual(v.warnings, ['부스터: 등록한 아이콘이 잘못돼서 다시 등록해야 해요', '미래: 이 버전에서 지원하지 않는 종류라 건너뛰어요',
    'sol.gone 소리는 불러올 수 없어서 기본 소리로 둬요', 'booster.pre 소리는 불러올 수 없어서 기본 소리로 둬요', 'rune.appear 소리는 불러올 수 없어서 기본 소리로 둬요',
    'u77.pre 소리는 쓰이는 대상이 없어 건너뛰어요', 'bad key 소리는 불러올 수 없어서 기본 소리로 둬요']);
});

test('validateBackup: 대상이 v1 모양이면 옮겨서 검사, 수동 타이머가 깨지면 그 그룹만 건너뜀, ui는 허용 목록만', () => {
  const obj = { schema: 'maple-web-timer-backup', version: 1, includes: ['targets', 'manualTimers', 'ui'], data: {
    targets: { sol: { enabled: true, threshold: 0.8, durationSec: 1800, leadSec: 15 } },
    manualTimers: { v: 7, timers: [] },
    ui: { volumePct: 999, voice: 'yes', connectedOnce: true, open: { sol: true }, pip: { w: 50, h: 5000 } } } };
  const v = plain(validateBackup(obj));
  assert.equal(v.groups.targets.targets[0].p.durationSec, 1800);
  assert.equal(v.groups.manualTimers, undefined);
  assert.deepEqual(v.warnings, ['수동 타이머 설정이 깨져 있어서 건너뛰어요']);
  assert.deepEqual(v.groups.ui, { volumePct: 200, pip: { w: 160, h: 1200 } });
});
