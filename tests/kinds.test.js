import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.js';

// 전역 순서는 index.html과 같게. targets.js는 아직 예전 DEFS를 만들므로 아이콘 데이터는 빈 배열로 대신한다.
const L = await load(['util', 'detect-core', 'targets', 'kinds']);
const KINDS = L.get('KINDS'), BUILTIN = L.get('BUILTIN');
const { newState, cardStatus, unionRect, registerKind } = L;
const mk = (kind, over = {}) => ({ id: 'u1', kind, name: '유니온의 힘', preset: null, enabled: true, threshold: 0.75, area: null, tpl: null, frameW: 0, frameH: 0, p: KINDS[kind].defaults(), ...over });
const ctx = { src: true, frame: { w: 1280, h: 720 } };
const REG = { tpl: { url: 'x', w: 8, h: 8 }, frameW: 1280, frameH: 720 };   // 등록을 마친 대상

test('종류 등록부: 세 종류와 이벤트 키·묶음 종류', () => {
  assert.deepEqual(Object.keys(KINDS).sort(), ['buff', 'countdown', 'rune']);
  const ev = k => L.plain(KINDS[k].events.map(e => [e.key, e.group, e.beep]));
  assert.deepEqual(ev('buff'), [['pre', 'pre', 'buff']]);  // 꺼짐 알림 없음(2026-11-10 사용자 결정)
  assert.deepEqual(ev('countdown'), [['pre', 'pre', 'booster'], ['unread', null, 'system']]);
  assert.deepEqual(ev('rune'), [['appear', null, 'rune'], ['remind', null, 'rune']]);
});

test('문구: 기존 MSG와 같다', () => {
  const t = mk('buff', { name: '솔 야누스' }), msg = (k, key, t, info) => KINDS[k].events.find(e => e.key === key).msg(t, info || {});
  assert.equal(msg('buff', 'pre', t), '솔 야누스 10초 전');
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
  assert.match(cardStatus(mk('rune', { preset: 'rune' }), newState(), 0, ctx).sub, /미니맵\(화면 왼쪽 위\)에서 룬 아이콘을 자동 검색 중/);
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

test('게이지: 지속시간을 아는 버프만, 미리 알림 뒤에도 끝날 때까지 줄어듦', () => {
  const t = mk('buff', REG); t.p.durationSec = 100; t.p.leadSec = 10;
  const T0 = 1_000_000, on = (over = {}) => Object.assign(newState(), { present: true, seen: true, appearedAt: T0 }, over);
  assert.deepEqual(L.plain(KINDS.buff.gauge(t, on(), T0 + 25000)), { frac: 0.75, low: false });
  assert.deepEqual(L.plain(KINDS.buff.gauge(t, on({ alertedPre: true }), T0 + 95000)), { frac: 0.05, low: true });
  assert.equal(KINDS.buff.gauge(t, on(), T0 + 100000), null);                     // 끝남
  assert.equal(KINDS.buff.gauge(t, on({ present: false }), T0 + 25000), null);    // 꺼짐
  assert.equal(KINDS.buff.gauge(t, on({ appearedAt: null }), T0 + 25000), null);  // 켜진 시점 모름
  t.p.durationSec = null; assert.equal(KINDS.buff.gauge(t, on(), T0 + 25000), null);   // 학습 전
  assert.equal(KINDS.countdown.gauge(mk('countdown'), on({ remain: 30, remainAt: 0 }), 0), null);   // 부스터는 전체 길이를 몰라 그리지 않음
  assert.equal(KINDS.rune.gauge(mk('rune'), on(), 0), null);
});

// ---- 부스터: “남은시간” 글자가 잠깐 가려져도 꺼짐으로 보지 않기 (2026-11-10 사용자 보고: 알리미가 부스터가 꺼졌다고 말함) ----
import { setHooks } from '../src/core/hooks.js';
// 0.5초 틱으로 countdown.step을 돌린다. seq: 'x'=글자 일치, '.'=안 보임. read(now)는 그 시각에 읽히는 숫자(null이면 못 읽음)
function cdRun(t, st, seq, clock, read) {
  const out = [];
  setHooks({ readTimer: () => { const v = read(clock.now); return { rect: null, read: v == null ? null : { value: v, text: String(v) } }; } });
  try {
    const alertKeys = KINDS.countdown.events.map(e => e.key);   // 감지 루프(collectEvents)처럼 알림 이벤트만 남긴다(appear 등 내부 이벤트는 버림)
    for (const c of seq) { for (const e of KINDS.countdown.step(t, st, { score: c === 'x' ? 0.9 : 0.1, pos: { x: 0, y: 0, w: 10, h: 10 } }, null, clock.now)) { const k = typeof e === 'string' ? e : e.key; if (alertKeys.includes(k)) out.push(k); } clock.now += 500; }
  } finally { setHooks({ readTimer: () => null }); }
  return out;
}
const booster = () => mk('countdown', { ...REG, preset: 'booster', id: 'booster', name: '부스터' });

test('countdown.step: 읽어 둔 남은 시간이 넉넉하면 글자가 10초 가려져도 꺼짐 알림 없음, 다시 보이면 이어서 센다', () => {
  const t = booster(), st = newState(), T0 = 1_000_000, clock = { now: T0 }, left = now => +(60 - (now - T0) / 1000).toFixed(1);
  cdRun(t, st, '....', clock, left);                               // 꺼진 것을 본 뒤(armed)
  assert.deepEqual(cdRun(t, st, 'xxxx', clock, left), []);         // 켜짐(알림 없음)
  assert.equal(st.present, true); assert.ok(st.remain != null, '숫자를 읽음');
  const hidden = cdRun(t, st, '.'.repeat(20), clock, left);       // 10초 동안 안 보임
  assert.deepEqual(hidden, []); assert.equal(st.present, true); assert.equal(st.held, true);
  const back = cdRun(t, st, 'xx', clock, left);
  assert.deepEqual(back, []); assert.equal(st.present, true); assert.equal(st.held, false);
});

test('countdown.step: 남은 시간을 못 읽었으면 예전처럼 4번 안 보이면 꺼짐으로 본다(꺼짐 알림은 없음, 2026-11-10 사용자 결정)', () => {
  const t = booster(), st = newState(), clock = { now: 2_000_000 }, none = () => null;
  cdRun(t, st, '....xxxx', clock, none);
  assert.equal(st.remain, null);
  assert.deepEqual(cdRun(t, st, '....', clock, none), []);
  assert.equal(st.present, false);
});

test('countdown.step: 가려진 동안 읽어 둔 시간으로 10초 전 알림을 울리고, 끝 시각 + 2초가 지나면 꺼짐으로 본다', () => {
  const t = booster(), st = newState(), T0 = 3_000_000, clock = { now: T0 }, left = now => +(15 - (now - T0) / 1000).toFixed(1);
  cdRun(t, st, '....xxxx', clock, left);                           // 약 11.5초 남았을 때까지 읽음(10초 전은 아직)
  assert.equal(clock.now, T0 + 4000);
  const hidden = []; let preAt = null;
  for (let i = 0; i < 25; i++) { const e = cdRun(t, st, '.', clock, left); if (e.includes('pre')) preAt = clock.now - 500; hidden.push(...e); }
  assert.deepEqual(hidden, ['pre']);                               // 가려진 채로 10초 전이 되면 한 번
  assert.ok(preAt >= T0 + 5000 && preAt <= T0 + 5500, 'preAt ' + (preAt - T0));   // 남은 10초(= T0+5초) 무렵
  assert.equal(st.present, true);
  assert.deepEqual(cdRun(t, st, '......', clock, left), []);       // 끝 시각 + 2초가 지나 꺼짐. 알림 없음
  assert.equal(st.present, false);
});

test('countdown.step: 글자가 가려진 동안은 20초가 넘어도 “숫자 못 읽음”을 울리지 않는다', () => {
  const t = booster(), st = newState(), T0 = 4_000_000, clock = { now: T0 }, left = now => +(120 - (now - T0) / 1000).toFixed(1);
  cdRun(t, st, '....xxxx', clock, left);
  assert.deepEqual(cdRun(t, st, '.'.repeat(60), clock, left), []);  // 30초 가려짐
  assert.equal(st.present, true); assert.equal(st.held, true); assert.equal(st.ocrWarned, false);
});

test('countdown.step: 글자는 보이는데 숫자를 20초 넘게 못 읽으면 “숫자 못 읽음”은 그대로 한 번', () => {
  const t = booster(), st = newState(), T0 = 5_000_000, clock = { now: T0 };
  cdRun(t, st, '....xxxx', clock, now => +(120 - (now - T0) / 1000).toFixed(1));
  assert.deepEqual(cdRun(t, st, 'x'.repeat(44), clock, () => null), ['unread']);
});

test('countdown 상태: 가려진 동안은 읽어 둔 시간으로 센다고 알려 준다', () => {
  const st = Object.assign(newState(), { present: true, held: true, remain: 50, remainAt: 90_000, lastText: '50' });
  const r = cardStatus(booster(), st, 100_000, ctx);
  assert.equal(r.text, '남은 시간 00:40'); assert.match(r.sub, /가려져/);
});
