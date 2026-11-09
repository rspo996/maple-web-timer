const test = require('node:test');
const assert = require('node:assert/strict');
const { prepTemplate, matchTemplate } = require('../js/match.js');
const C = require('../js/cooldown.js');
const { iconGain, classifyIcon, cdNewState, stepCooldown, calibrateCooldown, TPL_MIN_LUMA } = C;

// 질감 있는 32×32 합성 아이콘(회색조 60~240)
function icon(seed) { let s = seed; const g = new Float32Array(32 * 32); for (let i = 0; i < g.length; i++) { s = (s * 1103515245 + 12345) % 2147483648; g[i] = 60 + (s / 2147483648) * 180; } return g; }
const ncc = (tpl, cur) => matchTemplate(cur, 32, 32, prepTemplate(tpl, 32, 32)).score;
const CFG = { threshold: 0.7, gainHi: 0.85, gainLo: 0.65, nccDim: 0.45 };

test('iconGain·classifyIcon: 고르게 0.4배 어두워진 아이콘은 일치도 그대로(>0.97), 밝기 0.4 → dim', () => {
  const tpl = icon(7), dim = tpl.map(v => v * 0.4);
  const n = ncc(tpl, dim), g = iconGain(tpl, dim, TPL_MIN_LUMA);
  assert.ok(n > 0.97, 'ncc ' + n);
  assert.ok(Math.abs(g.p50 - 0.4) < 0.01 && Math.abs(g.p20 - 0.4) < 0.01, JSON.stringify(g));
  assert.equal(classifyIcon(n, g, CFG), 'dim');
  assert.equal(classifyIcon(ncc(tpl, tpl), iconGain(tpl, tpl, TPL_MIN_LUMA), CFG), 'ready');
});

test('어두운 아이콘 위에 흰 숫자가 얹히면 일반 NCC는 크게 떨어지지만(0.35), 숫자를 뺀 NCC와 밝기 중앙값으로 dim', () => {
  const tpl = icon(7), cur = tpl.map(v => v * 0.4);
  const draw = (x0, x1, y0, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) cur[y * 32 + x] = 255; };
  draw(10, 12, 10, 22); draw(16, 22, 10, 12); draw(16, 18, 10, 16); draw(16, 22, 15, 17); draw(20, 22, 15, 22); draw(16, 22, 20, 22);   // 가는 획 "15"(7%)
  const g = iconGain(tpl, cur, TPL_MIN_LUMA), n = ncc(tpl, cur);
  assert.ok(n < 0.45, 'ncc ' + n);                                     // 스펙 기본 nccDim(0.45)만으로는 unknown이 된다
  assert.ok(Math.abs(g.p50 - 0.4) < 0.02 && g.nccMasked > 0.97, JSON.stringify(g));
  assert.equal(classifyIcon(n, g, CFG), 'dim');
  for (let y = 9; y < 23; y++) for (let x = 8; x < 24; x++) cur[y * 32 + x] = 255;   // 꽉 찬 덩어리(22%)여도 남은 픽셀로 판정
  assert.equal(classifyIcon(ncc(tpl, cur), iconGain(tpl, cur, TPL_MIN_LUMA), CFG), 'dim');
});

test('다른 아이콘·검은 창이 덮음은 숫자를 뺀 NCC로도 dim이 되지 않는다', () => {
  const tpl = icon(7);
  for (const seed of [99, 123, 456]) {
    const other = icon(seed).map(v => v * 0.5), g = iconGain(tpl, other, TPL_MIN_LUMA);
    assert.ok(g.nccMasked < 0.85, seed + ' ' + g.nccMasked);
    assert.equal(classifyIcon(ncc(tpl, other), g, CFG), 'unknown');
  }
  const black = new Float32Array(1024).fill(5);
  assert.equal(classifyIcon(ncc(tpl, black), iconGain(tpl, black, TPL_MIN_LUMA), CFG), 'unknown');
});

test('다른 아이콘이 오면 일치도가 낮아 unknown(알림 근거가 되지 않음)', () => {
  const tpl = icon(7), other = icon(99);
  const n = ncc(tpl, other);
  assert.ok(n < 0.45, 'ncc ' + n);
  assert.equal(classifyIcon(n, iconGain(tpl, other, TPL_MIN_LUMA), CFG), 'unknown');
});

test('절반만 0.4배(방사형 스윕 중간)는 ready가 아니다(p20이 낮음)', () => {
  const tpl = icon(7), cur = tpl.map((v, i) => (i % 32) < 16 ? v * 0.4 : v);
  const g = iconGain(tpl, cur, TPL_MIN_LUMA);
  assert.ok(g.p20 < 0.5, JSON.stringify(g));
  assert.notEqual(classifyIcon(ncc(tpl, cur), g, CFG), 'ready');
});

test('iconGain: 템플릿에서 어두운 픽셀(밝기 하한 미만)은 비율 계산에서 뺀다', () => {
  const tpl = new Float32Array([10, 10, 100, 200]), cur = new Float32Array([200, 200, 50, 100]);
  const g = iconGain(tpl, cur, 40); assert.deepEqual([g.p20, g.p50, g.n], [0.5, 0.5, 2]);
  assert.deepEqual(iconGain(new Float32Array([1, 2]), new Float32Array([1, 2]), 40), { p20: 0, p50: 0, n: 0, nccMasked: 0 });
});

// ---- stepCooldown ----
const T0 = 1_000_000;
const DUR = { durationSec: 60, leadSec: 10 };
// seq: 'r'=ready, 'd'=dim, 'u'=unknown, '-'=null. 0.5초 간격
function run(S, seq, from = 0, cfg = DUR) {
  const out = [];
  [...seq].forEach((c, i) => { const ms = from + i * 500, obs = { r: 'ready', d: 'dim', u: 'unknown', '-': null }[c];
    for (const e of stepCooldown(S, cfg, obs, T0 + ms)) out.push({ at: ms, e }); });
  return out;
}
const names = out => out.map(x => typeof x.e === 'string' ? x.e : x.e.ready ? (x.e.ready.silent ? 'ready:silent' : 'ready') : JSON.stringify(x.e));
const ticks = (c, n) => c.repeat(n);

test('stepCooldown: 밝음 2프레임으로 시작, dim 1프레임은 사용 아님, 2프레임이면 usedAt=첫 dim 시각', () => {
  const S = cdNewState();
  run(S, 'rr'); assert.equal(S.cur, 'ready');
  run(S, 'dr', 1000); assert.deepEqual([S.cur, S.usedAt], ['ready', null]);
  run(S, 'dd', 2000); assert.deepEqual([S.cur, S.usedAt, S.alertedPre], ['dim', T0 + 2000, false]);
});

test('stepCooldown: 쓴 시각+지속시간-미리 알림에 pre 1번, 그 주기의 ready는 무음(정책)', () => {
  const S = cdNewState();
  run(S, 'rrdd');                                                     // usedAt = T0+1000
  const pre = run(S, ticks('d', 110), 1500);                          // ~T0+56000까지
  assert.deepEqual(names(pre), ['pre']); assert.equal(pre[0].at, 51_000);
  assert.equal(S.alertedPre, true);
  assert.deepEqual(names(run(S, 'rr', 70_000)), ['ready:silent']);
  assert.equal(S.cur, 'ready');
});

test('stepCooldown: pre 전에 밝아지면 ready가 울리고, 쓴 시각 기준 pre는 그 뒤에도 한 번', () => {
  const S = cdNewState();
  run(S, 'rrdd');
  assert.deepEqual(names(run(S, ticks('d', 40) + 'rr', 1500)), ['ready']);   // 21.5초 뒤 밝아짐
  assert.equal(S.lastCdSec, 21);
  const later = run(S, ticks('r', 80), 22_500);
  assert.deepEqual(names(later), ['pre']); assert.equal(later[0].at, 51_000);
});

test('stepCooldown: 다시 쓰면(ready→dim) 이전 pre를 취소하고 새 시각 기준', () => {
  const S = cdNewState();
  run(S, 'rrdd'); run(S, ticks('d', 20) + 'rr', 1500);                 // 쿨타임 11초
  run(S, 'dd', 30_000);                                                // 다시 씀: usedAt = T0+30000
  assert.equal(S.usedAt, T0 + 30_000);
  const out = run(S, ticks('d', 120), 31_000);
  assert.deepEqual(names(out), ['pre']); assert.equal(out[0].at, 80_000);
});

test('stepCooldown: 연결 때 이미 어두우면 pre 없이 ready만', () => {
  const S = cdNewState();
  const out = run(S, ticks('d', 200) + 'rr');
  assert.deepEqual(names(out), ['ready']); assert.equal(S.lastCdSec, null);
});

test('stepCooldown: dim 뒤 unknown 5초 → ready는 울림, 30초 → 조용히 맞춤', () => {
  let S = cdNewState(); run(S, 'rrdd');
  assert.deepEqual(names(run(S, ticks('u', 10) + 'rr', 1500)), ['ready']);
  S = cdNewState(); run(S, 'rrdd');
  assert.deepEqual(names(run(S, ticks('u', 60) + 'rr', 1500)), []);
  assert.equal(S.cur, 'ready');
});

test('stepCooldown: unknown이 90초 넘게 이어지면 unread 1번(에피소드마다)', () => {
  const S = cdNewState(); run(S, 'rr');
  const out = run(S, ticks('u', 200), 1000);
  assert.deepEqual(names(out), ['unread']); assert.equal(out[0].at, 91_000);
  run(S, 'rr', 101_000);
  assert.deepEqual(names(run(S, ticks('u', 200), 102_000)), ['unread']);
  const fresh = cdNewState();                                          // 한 번도 못 본 채로는 unread 없음
  assert.deepEqual(names(run(fresh, ticks('u', 200))), []);
});

test('stepCooldown: 판정 사이에 낀 unknown은 세지도 지우지도 않는다', () => {
  const S = cdNewState(); run(S, 'rr');
  run(S, 'dud', 1000);
  assert.deepEqual([S.cur, S.usedAt], ['dim', T0 + 1000]);
});

test('stepCooldown: 시각 기반 pre는 unknown 중에도 울린다, 끝 시각이 지난 늦은 pre는 건너뛰고 그 주기 ready는 울린다', () => {
  let S = cdNewState(); run(S, 'rrdd');
  assert.deepEqual(names(run(S, ticks('u', 110), 1500)), ['pre']);
  S = cdNewState(); run(S, 'rrdd');
  run(S, 'd', 5000);
  assert.deepEqual(names(run(S, 'd', 62_000)), []);                    // 프레임이 없다가 끝(61초) 뒤에 돌아옴 → 건너뜀
  assert.deepEqual(names(run(S, 'rr', 63_000)), ['ready']);
});

test('stepCooldown: 3초 미만으로 어두웠다 밝아지면 주기로 치지 않는다(MP 부족 등)', () => {
  const S = cdNewState(); run(S, 'rr');
  assert.deepEqual(names(run(S, 'dddd' + 'rr', 1000)), []);
  assert.deepEqual([S.usedAt, S.alertedPre], [null, false]);
});

test('stepCooldown: 지속시간이 없으면 pre 없음, ready는 울림', () => {
  const S = cdNewState(); run(S, 'rrdd', 0, { durationSec: null, leadSec: 10 });
  assert.deepEqual(names(run(S, ticks('d', 200) + 'rr', 1500, { durationSec: null, leadSec: 10 })), ['ready']);
});

test('stepCooldown: 당겨 알림으로 묶인 주기(alertedPre)도 ready 무음', () => {
  const S = cdNewState(); run(S, 'rrdd');
  S.alertedPre = true;                                                 // KINDS.cooldown.markPre가 하는 일
  assert.deepEqual(names(run(S, ticks('d', 20) + 'rr', 1500)), ['ready:silent']);
});

test('calibrateCooldown: 보정 공식과 거절·경고', () => {
  const ok = calibrateCooldown([{ ncc: 0.9, p50: 0.36 }, { ncc: 0.85, p50: 0.38 }, { ncc: 0.88, p50: 0.37 }], 0.7);
  assert.deepEqual([ok.ok, ok.gainLo, ok.nccDim, ok.msg], [true, 0.494, 0.6, '쿨타임 때 밝기가 0.38로 내려가요. 구분할 수 있어요']);
  const low = calibrateCooldown([{ ncc: 0.5, p50: 0.3 }, { ncc: 0.45, p50: 0.3 }, { ncc: 0.48, p50: 0.3 }], 0.7);
  assert.equal(low.nccDim, 0.4);                                       // 하한 0.40
  const warn = calibrateCooldown([{ ncc: 0.9, p50: 0.82 }, { ncc: 0.9, p50: 0.8 }, { ncc: 0.9, p50: 0.81 }], 0.7);
  assert.deepEqual([warn.ok, warn.gainLo, warn.msg], [true, 0.65, '쿨타임 때 밝기 차이가 작아요(0.82). 이 아이콘은 구분하기 어려워요. 알림이 틀릴 수 있어요']);
  const bright = calibrateCooldown([{ ncc: 0.9, p50: 0.9 }, { ncc: 0.9, p50: 0.92 }, { ncc: 0.9, p50: 0.91 }], 0.7);
  assert.deepEqual([bright.ok, bright.msg], [false, '쿨타임 때 밝기 차이가 작아요(0.92). 이 아이콘은 구분하기 어려워요. 쿨타임 중에 다시 찍어 주세요']);
  const lost = calibrateCooldown([{ ncc: 0.3, p50: 0.4 }, { ncc: 0.9, p50: 0.4 }, { ncc: 0.9, p50: 0.4 }], 0.7);
  assert.deepEqual([lost.ok, lost.msg], [false, '아이콘을 못 찾았어요']);
});
