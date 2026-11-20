// 실제 화면 공유(2026-11-20)의 부스터: 퀘스트 진행 글자가 "◷ 남은시간" 글자 아래쪽과 숫자 가운데를 덮는 화면
// 사용자 보고: 사냥 중 "부스터 숫자를 못 읽고 있어요"가 자꾸 울림
import test from 'node:test';
import assert from 'node:assert/strict';
import { ocrSevenSeg } from '../src/core/detect-core.js';
import { bandMask, matchTemplate, prepTemplate, toGray } from '../src/core/match.js';
import { PRESET_ICONS } from '../src/core/preset-data.js';
import { BUILTIN, PRESETS } from '../src/core/targets.js';
import { KINDS } from '../src/core/kinds.js';
import { decodePng } from './png.js';
import { BOOSTER_LIVE } from './fixtures/booster-live.js';

const rgbaOf = g => { const o = new Uint8ClampedArray(g.length * 4); for (let i = 0; i < g.length; i++) { o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = g[i]; o[i * 4 + 3] = 255; } return o; };
const read = f => ocrSevenSeg(rgbaOf(f.gray), f.w, f.h);

test('실제 화면 공유: 퀘스트 글자에 덮인 숫자에서 엉뚱한 값을 내지 않는다(고치기 전: 50장 중 24장이 "666"·"1556" 등)', () => {
  const wrong = [];
  for (const f of BOOSTER_LIVE.frames) {
    const r = read(f);
    if (r && r.value != null && (f.truth == null || Math.abs(r.value - f.truth) > 0.7)) wrong.push(`${f.t} ${r.text} (화면 ${f.truth})`);
  }
  assert.deepEqual(wrong, []);
});

test('실제 화면 공유: 퀘스트 글자가 흐려져 숫자가 깨끗한 9장은 모두 맞게 읽는다', () => {
  const clean = BOOSTER_LIVE.frames.filter(f => f.kind === 'clean');
  assert.equal(clean.length, 9);
  for (const f of clean) { const r = read(f); assert.ok(r && r.value != null, f.t + ' 못 읽음'); assert.ok(Math.abs(r.value - f.truth) <= 0.7, `${f.t} ${r.text} (화면 ${f.truth})`); }
});

test('실제 화면 공유: 숫자 칸을 퀘스트 글자가 지나가면 못 읽음이 아니라 “가려짐”(covered)으로 알려 준다', () => {
  const covered = BOOSTER_LIVE.frames.filter(f => f.kind === 'covered');
  assert.equal(covered.length, 41);
  for (const f of covered) { const r = read(f); assert.ok(r && r.covered === true && r.value == null, f.t + ' ' + JSON.stringify(r)); }
});

// 앱과 같은 방식: 내장 아이콘을 회색조로, 종류의 timerBand(뺄 행 띠)로 마스크
const tplOf = (scale = 1) => {
  const ic = PRESET_ICONS.booster[0], img = decodePng(ic.url), g = toGray(img.px, img.W * img.H);
  const w = Math.round(img.W * scale), h = Math.round(img.H * scale), s = new Float32Array(w * h);   // 가장 가까운 픽셀로 늘이거나 줄인다
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) s[y * w + x] = g[Math.min(img.H - 1, Math.floor(y / scale)) * img.W + Math.min(img.W - 1, Math.floor(x / scale))];
  const band = KINDS.countdown.timerBand;
  return prepTemplate(s, w, h, band ? bandMask(w, h, band[0], band[1]) : undefined);
};
const threshold = BUILTIN.booster.threshold;

test('실제 화면 공유: 퀘스트 글자가 글자 아래쪽을 덮어도 내장 “◷ 남은시간” 템플릿이 기준값을 넉넉히 넘는다(고치기 전: 0.51~0.72로 기준값 0.7을 거의 못 넘음)', () => {
  const tp = tplOf(1);
  for (const l of BOOSTER_LIVE.labels) {
    const r = matchTemplate(Float32Array.from(l.gray), l.w, l.h, tp);
    assert.ok(r.score >= threshold + 0.2, `${l.t} 일치도 ${r.score.toFixed(3)}`);
  }
});

test('실제 화면 공유: 부스터가 없는 화면의 퀘스트 글자·룬 안내에서는 내장 템플릿이 기준값에 한참 못 미친다', () => {
  const n = BOOSTER_LIVE.noBooster, img = Float32Array.from(n.gray);
  for (const s of PRESETS.booster.scales) {
    const r = matchTemplate(img, n.w, n.h, tplOf(s));
    assert.ok(r.score <= threshold - 0.15, `배율 ${s} 일치도 ${r.score.toFixed(3)}`);
  }
});

// 같은 “◷ 남은시간” 칸이 단계 콘텐츠(탈라하트 5단계)의 분·초 타이머 “9분 03초”에도 뜬다(2026-11-20 실제 화면)
test('실제 화면 공유: 분·초 타이머("9분 03초")는 숫자로 읽지 않고, 숫자 사이에 "분"이 보이면 {minutes:true}(고치기 전: "903"·"938")', () => {
  assert.equal(BOOSTER_LIVE.stage.length, 12);
  for (const f of BOOSTER_LIVE.stage) {
    const r = read(f), k = r == null ? 'none' : r.covered ? 'covered' : r.minutes ? 'minutes' : 'read ' + r.text;
    assert.equal(k, f.kind, f.t);
  }
});

test('실제 화면 공유: 부스터 숫자 칸(깨끗하거나 퀘스트 글자에 덮인 것)은 분·초 타이머로 보지 않는다', () => {
  for (const f of BOOSTER_LIVE.frames) { const r = read(f); assert.ok(!(r && r.minutes), f.t); }
});
