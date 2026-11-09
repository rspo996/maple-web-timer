const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.js');

const L = load(['js/util.js', 'js/detect-core.js', 'js/targets.js', 'js/kinds.js'], { PRESET_ICONS: { sol: [], booster: [] } });
const { migrateV1, normalizeTarget, normalizeStore, makeId, defaultStore, loadStore, saveStore, checkName, targetSnapshot, newState } = L;
const plain = L.plain;
const fakeStorage = (init = {}, opt = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (opt.failSet) throw new Error('quota'); m.set(k, String(v)); }, m }; };
const FULL_V1 = {
  sol: { enabled: false, area: { x: 1, y: 2, w: 300, h: 80 }, tpl: { url: 'data:sol', w: 30, h: 30 }, frameW: 1920, frameH: 1080, threshold: 0.8, durationSec: 1800, leadSec: 15, repeatSec: 99, kind: 'x' },
  booster: { ver: 2, enabled: true, area: { x: 5, y: 5, w: 100, h: 30 }, tpl: { url: 'data:b', w: 60, h: 18 }, frameW: 1920, frameH: 1080, threshold: 0.66, leadSec: 20 },
  rune: { enabled: true, area: { x: 9, y: 9, w: 200, h: 200 }, tpl: { url: 'data:r', w: 12, h: 12 }, frameW: 1920, frameH: 1080, threshold: 0.85, repeatSec: 30, leadSec: 77 },
};

test('기본 저장소: sol, booster, rune 순서의 내장 3개, 묶기 꺼짐', () => {
  const s = plain(defaultStore());
  assert.deepEqual(s.targets.map(t => [t.id, t.kind, t.name, t.preset, t.threshold]),
    [['sol', 'buff', '솔 야누스', 'sol', 0.75], ['booster', 'countdown', '부스터', 'booster', 0.7], ['rune', 'rune', '룬', null, 0.8]]);
  assert.deepEqual(s.group, { on: false, windowSec: 10 }); assert.equal(s.seq, 0); assert.equal(s.ver, 2);
});

test('migrateV1: 모든 필드를 스펙 4.2 표대로 옮긴다', () => {
  const s = plain(migrateV1(FULL_V1)), [sol, booster, rune] = s.targets;
  assert.deepEqual([sol.id, sol.enabled, sol.threshold, sol.area, sol.tpl, sol.frameW, sol.p], ['sol', false, 0.8, { x: 1, y: 2, w: 300, h: 80 }, { url: 'data:sol', w: 30, h: 30 }, 1920, { durationSec: 1800, leadSec: 15 }]);
  assert.deepEqual([booster.threshold, booster.p, booster.tpl.url], [0.66, { leadSec: 20 }, 'data:b']);   // ver:2 이므로 재설정 없음
  assert.deepEqual([rune.p, rune.threshold], [{ repeatSec: 30 }, 0.85]);                                // 룬의 leadSec는 버림
  assert.equal('kind' in sol && sol.kind, 'buff');                                                      // v1에 저장된 kind(x)는 무시
});

test('migrateV1: 부스터 ver이 없거나 1이면 등록·기준값을 초기화(예전 부스터 재설정 이력)', () => {
  for (const ver of [undefined, 1]) {
    const v1 = { ...FULL_V1, booster: { ...FULL_V1.booster, ver } }, b = plain(migrateV1(v1)).targets[1];
    assert.deepEqual([b.tpl, b.area, b.frameW, b.frameH, b.threshold, b.p.leadSec], [null, null, 0, 0, 0.7, 20]);
  }
});

test('migrateV1: 비었거나 객체가 아니면 기본 목록, 값이 없으면 기본값, 두 번 돌려도 같다', () => {
  for (const bad of [null, [], 'x', 5, {}]) assert.deepEqual(plain(migrateV1(bad)).targets.map(t => t.id), ['sol', 'booster', 'rune']);
  const partial = plain(migrateV1({ sol: { tpl: { url: 'u', w: 5, h: 5 } } })).targets[0];
  assert.deepEqual([partial.enabled, partial.threshold, partial.p], [true, 0.75, { durationSec: null, leadSec: 10 }]);
  const once = plain(migrateV1(FULL_V1));
  assert.deepEqual(plain(migrateV1(FULL_V1)), once);
});

test('normalizeTarget: 범위 보정, 알 수 없는 필드 보존, 이름 보정', () => {
  const t = plain(normalizeTarget({ id: 'u3', kind: 'buff', name: '  유니온의 힘  ', threshold: 5, enabled: true, preset: 'nope', frameW: -4, area: { x: 0, y: 0, w: 0, h: 5 }, tpl: { url: 7 }, p: { leadSec: 500, durationSec: 5 }, extra: 'keep' }));
  assert.deepEqual([t.name, t.threshold, t.preset, t.frameW, t.area, t.tpl, t.p, t.extra], ['유니온의 힘', 0.98, null, 0, null, null, { leadSec: 120, durationSec: null }, 'keep']);
  assert.equal(plain(normalizeTarget({ id: 'u3', kind: 'buff', name: '', threshold: 0.1, p: {} })).name, 'u3');
  assert.equal(plain(normalizeTarget({ id: 'u3', kind: 'buff', name: '가'.repeat(20), p: {} })).name.length, 12);
  assert.equal(plain(normalizeTarget({ id: 'u3', kind: 'buff', name: 'a', threshold: 0.1, p: {} })).threshold, 0.4);
  assert.equal(plain(normalizeTarget({ id: 'rune', kind: 'rune', name: '룬', threshold: 'abc', p: {} })).threshold, 0.8);
});

test('normalizeTarget: 알 수 없는 kind는 지우지 않고 꺼 둔다', () => {
  const t = plain(normalizeTarget({ id: 'u9', kind: 'future', name: '미래', enabled: true, p: { z: 1 } }));
  assert.deepEqual([t.kind, t.enabled, t.p], ['future', false, { z: 1 }]);
});

test('normalizeStore: 중복 id·잘못된 id는 버리고, 12개 상한, seq는 가장 큰 u번호 이상', () => {
  const mk = id => ({ id, kind: 'buff', name: id, p: {} });
  const s = plain(normalizeStore({ ver: 2, seq: 2, targets: [mk('u5'), mk('u5'), mk('zzz'), mk('sol'), mk('u1')], group: { on: true, windowSec: 7 } }));
  assert.deepEqual(s.targets.map(t => t.id), ['u5', 'sol', 'u1']);
  assert.equal(s.seq, 5);
  assert.deepEqual(s.group, { on: true, windowSec: 10 });
  const many = plain(normalizeStore({ ver: 2, seq: 0, targets: Array.from({ length: 15 }, (_, i) => mk('u' + (i + 1))) }));
  assert.equal(many.targets.length, 12); assert.equal(many.seq, 15);
});

test('makeId: u + 증가 숫자, 삭제한 id를 다시 쓰지 않는다', () => {
  const store = plain(defaultStore());
  assert.equal(makeId(store), 'u1'); store.targets.push({ id: 'u1' }); assert.equal(makeId(store), 'u2');
  store.targets = store.targets.filter(t => t.id !== 'u2');                       // u2를 지움
  assert.equal(makeId(store), 'u3'); assert.equal(store.seq, 3);
  assert.match(makeId(store), /^u\d+$/);
});

test('loadStore: v2가 있으면 그대로(ok), 쓰지 않는다', () => {
  const st = fakeStorage({ 'maple-web-timer-v2': JSON.stringify({ ver: 2, seq: 3, targets: plain(defaultStore()).targets, group: { on: true, windowSec: 5 } }) });
  const r = plain(loadStore(st));
  assert.equal(r.status, 'ok'); assert.equal(r.saveFailed, false); assert.deepEqual(r.store.group, { on: true, windowSec: 5 }); assert.equal(r.store.seq, 3);
});

test('loadStore: v2가 없고 v1이 있으면 이전(migrated)하고 v2를 쓰되 v1은 지우지 않는다. 두 번째 로드는 ok', () => {
  const st = fakeStorage({ 'maple-web-timer-v1': JSON.stringify(FULL_V1) });
  const r = plain(loadStore(st));
  assert.equal(r.status, 'migrated'); assert.equal(r.store.targets[0].p.durationSec, 1800);
  assert.ok(st.m.has('maple-web-timer-v2')); assert.ok(st.m.has('maple-web-timer-v1'));
  const r2 = plain(loadStore(st)); assert.equal(r2.status, 'ok'); assert.deepEqual(r2.store, r.store);
});

test('loadStore: 아무것도 없으면 fresh(기본 목록, 아무것도 쓰지 않음), v1이 깨졌거나 객체가 아니어도 fresh', () => {
  const empty = fakeStorage(); const r = plain(loadStore(empty));
  assert.equal(r.status, 'fresh'); assert.equal(r.store.targets.length, 3); assert.equal(empty.m.size, 0);
  for (const bad of ['{oops', '[]', 'null']) { const s = fakeStorage({ 'maple-web-timer-v1': bad }); assert.equal(plain(loadStore(s)).status, 'fresh'); assert.equal(s.m.has('maple-web-timer-v2'), false); }
});

test('loadStore: v2가 깨졌거나 ver>2 이거나 targets가 배열이 아니면 broken, 원문을 -broken에 보관하고 v1 이전은 하지 않는다', () => {
  for (const raw of ['{oops', JSON.stringify({ ver: 3, targets: [] }), JSON.stringify({ ver: 2, targets: {} })]) {
    const st = fakeStorage({ 'maple-web-timer-v2': raw, 'maple-web-timer-v1': JSON.stringify(FULL_V1) });
    const r = plain(loadStore(st));
    assert.equal(r.status, 'broken'); assert.equal(st.m.get('maple-web-timer-v2-broken'), raw);
    assert.equal(r.store.targets[0].p.durationSec, null);            // v1(1800)을 쓰지 않았다
  }
});

test('loadStore: 저장 실패는 saveFailed로 알리고 메모리 목록으로 계속, 저장소 접근이 막혀도 동작', () => {
  const st = fakeStorage({ 'maple-web-timer-v1': JSON.stringify(FULL_V1) }, { failSet: true });
  const r = plain(loadStore(st)); assert.equal(r.status, 'migrated'); assert.equal(r.saveFailed, true);
  const none = plain(loadStore(null)); assert.equal(none.status, 'fresh');
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(plain(loadStore(throwing)).status, 'fresh');
  assert.equal(saveStore(defaultStore(), throwing), false);
});

test('checkName: 앞뒤 공백 제거, 1~12자, 다른 대상과 같은 이름 금지(자기 자신은 허용)', () => {
  const ts = [{ id: 'sol', name: '솔 야누스' }, { id: 'u1', name: '유니온의 힘' }];
  assert.deepEqual(plain(checkName('  새 버프 ', ts, null)), { ok: true, name: '새 버프', msg: '' });
  assert.equal(checkName('   ', ts, null).ok, false);
  assert.equal(checkName('가'.repeat(13), ts, null).ok, false);
  assert.equal(checkName('가'.repeat(12), ts, null).ok, true);
  assert.equal(checkName('유니온의 힘', ts, null).ok, false);
  assert.equal(checkName('유니온의 힘', ts, 'u1').ok, true);
  assert.equal(checkName('', ts, null).msg, '이름을 1~12자로, 다른 대상과 다르게 입력해 주세요');
});

test('targetSnapshot: 상태줄·PIP가 같이 쓰는 행', () => {
  const targets = plain(defaultStore()).targets.concat([{ id: 'u9', kind: 'future', name: '미래', enabled: false, p: {} }]);
  const st = newState(); st.present = true; st.seen = true; st.appearedAt = 1000;
  targets[0].p.durationSec = 100;
  const rows = plain(targetSnapshot(targets, { sol: st }, { src: true, frame: { w: 1280, h: 720 } }, 31_000));
  assert.deepEqual(rows[0], { id: 'sol', name: '솔 야누스', kind: 'buff', enabled: true, stripState: 'ok', statusText: '남은 시간 01:10', remainSec: 70 });
  assert.equal(rows[1].stripState, 'unseen'); assert.equal(rows[2].stripState, 'reg');
  assert.deepEqual([rows[3].stripState, rows[3].statusText], ['off', '이 버전에서 지원하지 않는 종류예요']);
});
