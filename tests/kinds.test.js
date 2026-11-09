const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.js');

// 전역 순서는 index.html과 같게. targets.js는 아직 예전 DEFS를 만들므로 아이콘 데이터는 빈 배열로 대신한다.
const L = load(['js/util.js', 'js/detect-core.js', 'js/targets.js', 'js/kinds.js'], { PRESET_ICONS: { sol: [], booster: [] } });
const KINDS = L.get('KINDS'), BUILTIN = L.get('BUILTIN');
const { newState, cardStatus, unionRect, registerKind } = L;
const mk = (kind, over = {}) => ({ id: 'u1', kind, name: '유니온의 힘', preset: null, enabled: true, threshold: 0.75, area: null, tpl: null, frameW: 0, frameH: 0, p: KINDS[kind].defaults(), ...over });
const ctx = { src: true, frame: { w: 1280, h: 720 } };
const REG = { tpl: { url: 'x', w: 8, h: 8 }, frameW: 1280, frameH: 720 };   // 등록을 마친 대상

test('종류 등록부: 세 종류와 이벤트 키·묶음 종류', () => {
  assert.deepEqual(Object.keys(KINDS).sort(), ['buff', 'countdown', 'rune']);
  const ev = k => L.plain(KINDS[k].events.map(e => [e.key, e.group, e.beep]));
  assert.deepEqual(ev('buff'), [['pre', 'pre', 'buff'], ['gone', 'gone', 'gone']]);
  assert.deepEqual(ev('countdown'), [['pre', 'pre', 'booster'], ['gone', 'gone', 'gone'], ['unread', null, 'system']]);
  assert.deepEqual(ev('rune'), [['appear', null, 'rune'], ['remind', null, 'rune']]);
});

test('문구: 기존 MSG와 같다', () => {
  const t = mk('buff', { name: '솔 야누스' }), msg = (k, key, t, info) => KINDS[k].events.find(e => e.key === key).msg(t, info || {});
  assert.equal(msg('buff', 'pre', t), '솔 야누스 10초 전');
  assert.equal(msg('buff', 'gone', t), '솔 야누스 꺼졌어요');
  assert.equal(msg('countdown', 'unread', mk('countdown', { name: '부스터' })), '부스터 숫자를 못 읽고 있어요');
  assert.equal(msg('rune', 'appear', mk('rune')), '룬이 나왔어요');
  assert.equal(msg('rune', 'remind', mk('rune')), '룬 아직 있어요');
});

test('기본값과 p 보정(normalizeP)', () => {
  assert.deepEqual(L.plain(KINDS.buff.defaults()), { durationSec: null, leadSec: 10 });
  assert.deepEqual(L.plain(KINDS.countdown.defaults()), { leadSec: 10 });
  assert.deepEqual(L.plain(KINDS.rune.defaults()), { repeatSec: 60 });
  assert.deepEqual(L.plain(KINDS.buff.normalizeP({ leadSec: 999, durationSec: 5 })), { leadSec: 120, durationSec: null });   // 지속시간 <= 미리 알림은 버림
  assert.deepEqual(L.plain(KINDS.buff.normalizeP({ leadSec: 10, durationSec: 600.4 })), { leadSec: 10, durationSec: 600 });
  assert.deepEqual(L.plain(KINDS.rune.normalizeP({ repeatSec: -3 })), { repeatSec: 60 });
  assert.deepEqual(L.plain(KINDS.rune.normalizeP({ repeatSec: 0 })), { repeatSec: 0 });
});

test('buff.step: 기존 stepDetector와 같은 이벤트, {learn}은 effect로 바뀐다', () => {
  const t = mk('buff'), st = newState();
  const step = (m, now) => L.plain(KINDS.buff.step(t, st, { score: m ? 0.9 : 0.1, pos: null }, null, now));
  for (let i = 0; i < 4; i++) step(false, 1000 + i * 500);           // armed
  step(true, 5000); assert.deepEqual(step(true, 5500), ['appear']);
  assert.equal(st.seen, true);
  let out = []; for (let i = 0; i < 4; i++) out.push(...step(false, 5500 + 60_000 + i * 500));
  assert.deepEqual(out.map(e => e.effect || e), ['learn', 'gone']);
  assert.equal(out[0].durationSec, Math.round((65_500 + 1500 - 5500) / 1000 - 2));
});

test('rune.step: appear-unknown도 appear로', () => {
  const t = mk('rune'), st = newState();
  const step = (now) => L.plain(KINDS.rune.step(t, st, { score: 0.9, pos: null }, null, now));
  step(1000); assert.deepEqual(step(1500), ['appear']);
});

test('markPre: 버프는 alertedPre, 부스터는 현재 남은 시간도 기록', () => {
  const b = newState(); KINDS.buff.markPre(b, 0); assert.equal(b.alertedPre, true);
  const c = newState(); c.present = true; c.remain = 30; c.remainAt = 1000;
  KINDS.countdown.markPre(c, 11_000); assert.equal(c.alertedPre, true); assert.equal(c.preMarkRemain, 20);
});

test('remainSec: 켜진 시각·지속시간을 모르거나 이미 알렸거나 끝났으면 null', () => {
  const t = mk('buff', { p: { durationSec: 60, leadSec: 10 } }), st = newState();
  assert.equal(KINDS.buff.remainSec(t, st, 0), null);                     // 꺼져 있음
  st.present = true; st.appearedAt = 1000;
  assert.equal(KINDS.buff.remainSec(t, st, 21_000), 40);
  assert.equal(KINDS.buff.remainSec(t, st, 61_000), null);               // 끝남
  st.alertedPre = true; assert.equal(KINDS.buff.remainSec(t, st, 21_000), null);
  st.alertedPre = false; st.appearedAt = null; assert.equal(KINDS.buff.remainSec(t, st, 21_000), null);
  assert.equal(KINDS.buff.remainSec(mk('buff'), Object.assign(newState(), { present: true, appearedAt: 1 }), 5), null);   // 지속시간 없음
  const c = newState(); c.present = true; c.remain = 30; c.remainAt = 1000;
  assert.equal(KINDS.countdown.remainSec(mk('countdown'), c, 11_000), 20);
  assert.equal(KINDS.rune.remainSec(mk('rune'), newState(), 0), null);
});

test('상태 문구: 기존 renderCard 분기와 같다', () => {
  const st = newState(), now = 100_000;
  const s = (t, over = {}, c = ctx) => L.plain(cardStatus(t, Object.assign(st, over), now, c));
  assert.equal(s(mk('buff')).text, '등록 필요');
  assert.equal(s(mk('buff'), {}, { src: false, frame: { w: 0, h: 0 } }).text, '등록 필요');
  assert.equal(s(mk('buff', REG), {}, { src: false, frame: { w: 0, h: 0 } }).text, '대기 중');
  const re = s(mk('buff', REG), {}, { src: true, frame: { w: 1920, h: 1080 } });
  assert.equal(re.text, '다시 등록 필요'); assert.equal(re.cls, 'alert'); assert.equal(re.sub, '등록 당시 화면 1280×720, 지금 1920×1080');
  assert.equal(s(mk('buff', REG)).text, '아직 못 찾음');
  assert.equal(s(mk('buff', REG), { seen: true }).text, '꺼져 있음');
  assert.equal(s(mk('buff', REG), { present: true, appearedAt: null }).text, '켜짐');
  assert.equal(s(mk('buff', REG), { present: true, appearedAt: 40_000 }).text, '켜짐 · 학습 중');
  const on = s(mk('buff', { ...REG, p: { durationSec: 120, leadSec: 10 } }), { present: true, appearedAt: 40_000 });
  assert.equal(on.text, '남은 시간 01:00'); assert.equal(on.cls, 'on');
  const soon = s(mk('buff', { ...REG, p: { durationSec: 60, leadSec: 10 } }), { present: true, appearedAt: 50_000 });
  assert.equal(soon.cls, 'alert');
  assert.equal(s(mk('rune', REG), { present: false }).text, '룬 없음');
  assert.equal(s(mk('rune', REG), { present: true }).text, '룬 있음!');
  const cd = mk('countdown', { ...REG, preset: 'booster' });
  assert.equal(s(cd, { present: true, remain: null, ocrWarned: false, lastText: '' }).text, '켜짐 · 숫자 읽는 중');
  assert.equal(s(cd, { ocrWarned: true }).text, '켜짐 · 숫자를 못 읽음');
  assert.equal(s(cd, { remain: 50, remainAt: 90_000, ocrWarned: false, lastText: '50' }).text, '남은 시간 00:40');
});

test('내장 아이콘 대상은 등록 없이도 등록된 것으로 보고, 안내 문구가 붙는다', () => {
  const sol = mk('buff', { preset: 'sol' });
  assert.equal(KINDS.buff.isRegistered(sol), true);
  assert.match(cardStatus(sol, Object.assign(newState(), { seen: true }), 0, ctx).sub, /기본 아이콘으로 화면 오른쪽 위를 자동 검색 중/);
  assert.match(cardStatus(mk('countdown', { preset: 'booster' }), Object.assign(newState(), { seen: true }), 0, ctx).sub, /남은시간/);
});

test('stripState: 꺼둠 > 등록 필요 > 다시 등록 > 아직 못 찾음 > 정상. 룬은 못 찾음 표시 없음', () => {
  const ss = (t, over = {}, c = ctx) => KINDS[t.kind].stripState(t, Object.assign(newState(), over), 0, c);
  assert.equal(ss(mk('buff', { enabled: false })), 'off');
  assert.equal(ss(mk('buff')), 'reg');
  assert.equal(ss(mk('buff', REG), {}, { src: true, frame: { w: 1920, h: 1080 } }), 'rereg');
  assert.equal(ss(mk('buff', REG)), 'unseen');
  assert.equal(ss(mk('buff', REG), { seen: true }), 'ok');
  assert.equal(ss(mk('rune', REG)), 'ok');
});

test('입력 칸(cardFields): 버프 지속시간·미리 알림 검사', () => {
  const t = mk('buff'), f = Object.fromEntries(KINDS.buff.cardFields(t).map(x => [x.key, x]));
  assert.equal(f.durationSec.get(t), '');
  assert.deepEqual(L.plain(f.durationSec.set(t, '1:00')), {}); assert.equal(t.p.durationSec, 60); assert.equal(f.durationSec.get(t), '01:00');
  const bad = f.durationSec.set(t, 'abc'); assert.equal(bad.revert, true); assert.equal(t.p.durationSec, 60);
  const low = f.durationSec.set(t, '0:05'); assert.equal(low.revert, true); assert.equal(low.msg, '미리 알림(10초)보다 길게 입력해 주세요');
  assert.deepEqual(L.plain(f.durationSec.set(t, '')), {}); assert.equal(t.p.durationSec, null);
  f.durationSec.set(t, '1:00');
  const lead = f.leadSec.set(t, '60'); assert.equal(lead.revert, true); assert.equal(t.p.leadSec, 10);
  assert.deepEqual(L.plain(f.leadSec.set(t, '30')), {}); assert.equal(t.p.leadSec, 30);
  assert.equal(f.leadSec.set(t, '999').revert, true); assert.equal(t.p.leadSec, 30);   // 120으로 잘린 값도 지속시간(60초) 이상이라 거절
  const r = mk('rune'), rf = KINDS.rune.cardFields(r)[0];
  rf.set(r, '999'); assert.equal(r.p.repeatSec, 600); rf.set(r, '0'); assert.equal(r.p.repeatSec, 0);
});

test('학습 결과(applyEffect): 지속시간 저장, 미리 알림 이하의 값은 버림', () => {
  const t = mk('buff');
  KINDS.buff.applyEffect(t, { effect: 'learn', durationSec: 5 }); assert.equal(t.p.durationSec, null);
  KINDS.buff.applyEffect(t, { effect: 'learn', durationSec: 720 }); assert.equal(t.p.durationSec, 720);
});

test('"방금 켰어요" 동작', () => {
  const t = mk('buff'), st = newState(); st.alertedPre = true; st.preMarkRemain = 5;
  KINDS.buff.actions[0].run(t, st, 7000);
  assert.deepEqual(L.plain({ p: st.present, a: st.appearedAt, ap: st.alertedPre, pm: st.preMarkRemain, arm: st.armed, on: st.onStreak }), { p: true, a: 7000, ap: false, pm: 0, arm: true, on: 2 });
});

test('등록 도우미: 영역과 아이콘의 합집합, 라벨', () => {
  assert.deepEqual(L.plain(unionRect({ x: 10, y: 10, w: 100, h: 50 }, { x: 5, y: 20, w: 30, h: 100 })), { x: 5, y: 10, w: 105, h: 110 });
  assert.equal(L.labelsOf(mk('buff')).area, '버프창 영역');
  assert.equal(L.labelsOf(mk('buff', { name: '유니온의 부' })).icon, '유니온의 부 아이콘');
  assert.equal(L.labelsOf(mk('rune')).area, '미니맵 영역');
  assert.equal(L.labelsOf(mk('countdown')).icon, '“◷ 남은시간” 글자');
});

test('registerKind: 묶음 3·4가 종류를 더할 때 쓰는 기본값', () => {
  registerKind('idle', { label: '사냥 멈춤', defaults: () => ({ idleSec: 30 }), events: [{ key: 'alarm', label: '알림', beep: 'system', group: null, msg: () => 'x' }], maxInstances: 1, onSkip: true });
  const k = KINDS.idle;
  assert.equal(k.onSkip, true); assert.equal(k.maxInstances, 1); assert.equal(k.trackSeen, false);
  assert.deepEqual(L.plain(k.register.steps), ['area', 'icon']);
  assert.equal(k.register.validate({}, {}, null), null);
  assert.equal(k.remainSec({}, {}, 0), null);
  assert.equal(k.isRegistered({ tpl: null, preset: null }), false);
});
