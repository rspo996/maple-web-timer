import test from 'node:test';
import assert from 'node:assert/strict';
import { VOICES, DEFAULT_VOICE, WATCH_START, VOICE_SAMPLE, voicePhrases, voiceCoverage } from '../src/core/voice-phrases.js';
import { KINDS } from '../src/core/kinds.js';
import { defaultStore, addKindTarget } from '../src/core/targets.js';
import { manualEmptyStore } from '../src/core/manual-core.js';

const PRESETS = ['5분', '10분', '15분', '20분', '30분', '1시간', '2시간'].flatMap(l => [`${l} 타이머 10초 전`, `${l} 타이머 끝났어요`]);
const ROUTINE = ['회수 10초 전', '사냥 10초 전', '사냥 시간이에요', '회수 시간이에요'];

test('목소리 7개, 기본은 Erinome', () => {
  assert.deepEqual(VOICES.map(v => v.id), ['Erinome', 'Zephyr', 'Autonoe', 'Leda', 'Laomedeia', 'Aoede', 'Despina']);
  assert.equal(DEFAULT_VOICE, 'Erinome'); assert.ok(VOICES.every(v => v.label === v.id && v.gender === '여'));
  assert.equal(WATCH_START, '감시 시작할게요'); assert.equal(VOICE_SAMPLE, '야누스 곧 꺼져요');
});

test('voicePhrases: 기본 설정이면 기본 대상·수동 프리셋·사냥·회수 문구, 중복 없이 정렬', () => {
  const want = [WATCH_START, '야누스 곧 꺼져요', '부스터 곧 꺼져요', '부스터 숫자를 못 읽고 있어요', '룬이 나왔어요', '룬 아직 있어요', ...PRESETS, ...ROUTINE].sort();
  assert.deepEqual(voicePhrases(), want);
});

test('voicePhrases: 실제 알림 경로(reqFor의 def.msg)가 말하는 문구가 모두 들어 있다', () => {
  const s = defaultStore(), list = new Set(voicePhrases({ targets: s.targets, group: s.group }));
  for (const t of s.targets) for (const e of KINDS[t.kind].events) assert.ok(list.has(e.msg(t, {})), `${t.id}.${e.key}`);
});

test('voicePhrases: 묶기를 켜면 미리 알림이 있는 대상의 두 순서 모두', () => {
  const s = defaultStore(), list = voicePhrases({ targets: s.targets, group: { on: true, windowSec: 10 } });
  assert.ok(list.includes('야누스, 부스터 곧 꺼져요')); assert.ok(list.includes('부스터, 야누스 곧 꺼져요'));
  assert.ok(!voicePhrases({ targets: s.targets, group: { on: false } }).includes('야누스, 부스터 곧 꺼져요'));
});

test('voicePhrases: 사냥 멈춤은 2·4·6분, 반복 0이면 첫 번째만', () => {
  const s = defaultStore(); addKindTarget(s, 'idle');
  const list = voicePhrases({ targets: s.targets });
  for (const m of [2, 4, 6]) assert.ok(list.includes(`경험치가 ${m}분째 그대로예요`), `${m}분`);
  s.targets[3].p.repeatSec = 0;
  const one = voicePhrases({ targets: s.targets });
  assert.ok(one.includes('경험치가 2분째 그대로예요') && !one.includes('경험치가 4분째 그대로예요'));
});

test('voicePhrases: 설치기는 지속시간을 적었을 때만 "사라져요"', () => {
  const s = defaultStore(); addKindTarget(s, 'cooldown');
  assert.ok(voicePhrases({ targets: s.targets }).includes('설치기 1 아이콘이 안 보여요'));
  assert.ok(!voicePhrases({ targets: s.targets }).some(p => p.includes('사라져요')));
  s.targets[3].p.durationSec = 30;
  assert.ok(voicePhrases({ targets: s.targets }).includes('설치기 1 10초 뒤 사라져요'));
});

test('voicePhrases: 바꾼 이름·초, 저장된 수동 타이머', () => {
  const s = defaultStore(); s.targets[0].sayName = '솔'; s.targets[1].name = '부스'; s.targets[1].p.leadSec = 15;
  const m = manualEmptyStore(); m.timers.push({ id: 'm1', kind: 'countdown', label: '보스', phases: [{ name: '보스', sec: 600 }], preSec: 20 });
  const list = voicePhrases({ targets: s.targets, manual: m });
  assert.ok(list.includes('솔 곧 꺼져요')); assert.ok(list.includes('부스 곧 꺼져요')); assert.ok(list.includes('보스 20초 전')); assert.ok(list.includes('보스 끝났어요'));
});

test('voiceCoverage: 목록에서 음성 파일이 있는 것과 없는 것', () => {
  assert.deepEqual(voiceCoverage(['a', 'b', 'c'], { a: 'x.mp3', c: 'y.mp3' }), { have: 2, missing: ['b'] });
  assert.deepEqual(voiceCoverage(['a'], undefined), { have: 0, missing: ['a'] });
});
