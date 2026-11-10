# 묶음 6: Gemini 음성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 알림 음성을 미리 만든 Gemini 음성(목소리 6개, 기본 Kore)으로 재생하고, 앱에서 목소리를 고르게 한다.

**Architecture:** 순수 함수 `voicePhrases`가 앱이 말하는 문구 목록을 앱의 문구 함수로 만든다. 개발 PC의 node 스크립트가 그 목록을 Gemini TTS로 만들어 `public/voice`에 MP3와 `manifest.json`으로 저장한다. 앱은 고른 목소리의 파일만 받아 풀어 두고, `speak`가 문구에 맞는 음성이 있으면 경고음 시간줄 뒤에 WebAudio로 재생하고 없으면 브라우저 음성을 쓴다.

**Tech Stack:** Vite + React(JavaScript), node `node:test`, ego-browser 시나리오, Gemini API(Interactions, `gemini-3.8-flash-tts`), `@breezystack/lamejs`(개발용 MP3 인코더).

**설계 문서:** `docs/superpowers/specs/2026-11-10-6-gemini-voice-design.md`

**커밋:** 이 저장소는 사용자가 요청할 때만 커밋한다. 각 작업 끝의 "확인"까지만 하고 커밋하지 않는다.

---

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `src/core/manual-core.js` (수정) | `durLabel`, `presetTimerName`을 앱 쪽에서 옮겨 온다(문구 목록이 같은 규칙을 쓰도록) |
| `src/app/manual.js` (수정) | 위 두 함수를 core에서 가져다 쓰고 `durLabel`은 다시 내보낸다 |
| `src/core/voice-phrases.js` (새) | 목소리 목록·기본값·말투·모델 상수, `voicePhrases`, `voiceCoverage`, `WATCH_START`, `VOICE_SAMPLE` |
| `scripts/voice-lib.mjs` (새) | 스크립트의 순수 함수: 요청 본문, 응답 오디오 꺼내기, WAV/PCM 풀기, MP3 인코딩, 파일 이름, manifest |
| `scripts/voice-gen.mjs` (새) | 생성 스크립트(API 호출, 파일 쓰기, 이어서 만들기) |
| `src/app/voice.js` (새) | manifest 읽기, 고른 목소리, 음성 파일 받아 풀기, 소리 설정 안내 문구, 듣기 |
| `src/app/alerts.js` (수정) | `speakClip` 추가, `speak`·`playDefault`·`unlockAudio`에서 쓰기 |
| `src/app/capture.js` (수정) | 시작 음성 문구를 `WATCH_START`로 |
| `src/app/boot.js` (수정) | `initVoice()` 호출 |
| `src/app/audio.js`, `src/ui/Masthead.jsx` (수정) | "음성은 100%까지" 안내를 브라우저 음성일 때만 |
| `src/ui/SoundSettings.jsx` (수정) | 음성 선택 칸, 듣기, 안내 한 줄 |
| `src/core/backup-core.js`, `src/app/backup.js` (수정) | `ui.voiceName` 백업 |
| `tests/manual.test.js`, `tests/voice.test.js`(새), `tests/voice-lib.test.js`(새), `tests/backup.test.js` | node 시험 |
| `tests/browser/voice.mjs` (새) | 브라우저 시나리오 |
| `package.json` | `voice` 스크립트, `@breezystack/lamejs` 개발 의존성 |
| `PRODUCT.md`, 설계 문서 | 결과 기록 |

---

### Task 1: 프리셋 타이머 이름 규칙을 core로

**Files:**
- Modify: `src/core/manual-core.js` (`manualFmt` 정의 아래)
- Modify: `src/app/manual.js:14` (`durLabel` 정의), `:83` (`manualStartPreset`)
- Test: `tests/manual.test.js`

- [ ] **Step 1: 실패하는 시험 쓰기** — `tests/manual.test.js` 맨 끝에 추가

```js
// ---- 묶음 6: 프리셋으로 시작한 타이머 이름(음성 문구 목록이 같은 규칙을 쓴다) ----
import { durLabel, presetTimerName } from '../src/core/manual-core.js';
test('presetTimerName: 이름이 시간 표기와 같으면 "… 타이머", 직접 지은 이름은 그대로', () => {
  assert.equal(durLabel(300), '5분'); assert.equal(durLabel(7200), '2시간');
  assert.equal(presetTimerName({ label: '5분', sec: 300 }), '5분 타이머');
  assert.equal(presetTimerName({ label: '1시간', sec: 3600 }), '1시간 타이머');
  assert.equal(presetTimerName({ label: '보스', sec: 600 }), '보스');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test 2>&1 | grep -E "^not ok|does not provide|^# (pass|fail)"`
Expected: `does not provide an export named 'durLabel'` 와 `not ok … tests/manual.test.js`

- [ ] **Step 3: 구현** — `src/core/manual-core.js`의 `export function manualFmt(ms){…}` 바로 아래에 추가

```js
// 초를 "5분"·"1시간"처럼. 분·시간으로 떨어지지 않으면 분:초
export const durLabel=sec=>sec%3600===0?`${sec/3600}시간`:sec%60===0?`${sec/60}분`:manualFmt(sec*1000);
// 프리셋으로 시작한 타이머 이름: 이름이 시간 표기와 같으면 "5분 타이머", 직접 지은 이름이면 그대로
export const presetTimerName=p=>p.label===durLabel(p.sec)?`${p.label} 타이머`:p.label;
```

`src/app/manual.js`:
- `:14`의 `export const durLabel=sec=>…;` 줄을 지운다.
- core에서 가져오는 import 목록(`import {MANUAL_LABEL_MAX,…} from '../core/manual-core.js';`)에 `durLabel,presetTimerName`을 더한다.
- 그 import 바로 아래에 `export {durLabel};` 한 줄(ManualPanel이 `app/manual.js`에서 가져다 쓴다).
- `:83`을 바꾼다:

```js
export function manualStartPreset(p){ const name=presetTimerName(p); manualAddAndStart('countdown',name,[{name,sec:p.sec}]); }
```

- [ ] **Step 4: 통과 확인**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`

---

### Task 2: 문구 목록 `voicePhrases`

**Files:**
- Create: `src/core/voice-phrases.js`
- Test: `tests/voice.test.js`

- [ ] **Step 1: 실패하는 시험 쓰기** — `tests/voice.test.js` 새 파일

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { VOICES, DEFAULT_VOICE, WATCH_START, VOICE_SAMPLE, voicePhrases, voiceCoverage } from '../src/core/voice-phrases.js';
import { KINDS } from '../src/core/kinds.js';
import { defaultStore, addKindTarget } from '../src/core/targets.js';
import { manualEmptyStore } from '../src/core/manual-core.js';

const PRESETS = ['5분', '10분', '15분', '20분', '30분', '1시간', '2시간'].flatMap(l => [`${l} 타이머 10초 전`, `${l} 타이머 끝났어요`]);
const ROUTINE = ['회수 10초 전', '사냥 10초 전', '사냥 시간이에요', '회수 시간이에요'];

test('목소리 6개, 기본은 Kore', () => {
  assert.deepEqual(VOICES.map(v => v.id), ['Kore', 'Zephyr', 'Leda', 'Sulafat', 'Charon', 'Puck']);
  assert.equal(DEFAULT_VOICE, 'Kore');
  assert.equal(WATCH_START, '감시 시작할게요'); assert.equal(VOICE_SAMPLE, '솔 야누스 10초 전');
});

test('voicePhrases: 기본 설정이면 기본 대상·수동 프리셋·사냥·회수 문구, 중복 없이 정렬', () => {
  const want = [WATCH_START, '솔 야누스 10초 전', '부스터 10초 전', '부스터 숫자를 못 읽고 있어요', '룬이 나왔어요', '룬 아직 있어요', ...PRESETS, ...ROUTINE].sort();
  assert.deepEqual(voicePhrases(), want);
});

test('voicePhrases: 실제 알림 경로(reqFor의 def.msg)가 말하는 문구가 모두 들어 있다', () => {
  const s = defaultStore(), list = new Set(voicePhrases({ targets: s.targets, group: s.group }));
  for (const t of s.targets) for (const e of KINDS[t.kind].events) assert.ok(list.has(e.msg(t, {})), `${t.id}.${e.key}`);
});

test('voicePhrases: 묶기를 켜면 미리 알림이 있는 대상의 두 순서 모두', () => {
  const s = defaultStore(), list = voicePhrases({ targets: s.targets, group: { on: true, windowSec: 10 } });
  assert.ok(list.includes('솔 야누스, 부스터 곧 끝나요')); assert.ok(list.includes('부스터, 솔 야누스 곧 끝나요'));
  assert.ok(!voicePhrases({ targets: s.targets, group: { on: false } }).some(p => p.endsWith('곧 끝나요')));
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
  const s = defaultStore(); s.targets[0].name = '솔'; s.targets[0].p.leadSec = 15;
  const m = manualEmptyStore(); m.timers.push({ id: 'm1', kind: 'countdown', label: '보스', phases: [{ name: '보스', sec: 600 }], preSec: 20 });
  const list = voicePhrases({ targets: s.targets, manual: m });
  assert.ok(list.includes('솔 15초 전')); assert.ok(list.includes('보스 20초 전')); assert.ok(list.includes('보스 끝났어요'));
});

test('voiceCoverage: 목록에서 음성 파일이 있는 것과 없는 것', () => {
  assert.deepEqual(voiceCoverage(['a', 'b', 'c'], { a: 'x.mp3', c: 'y.mp3' }), { have: 2, missing: ['b'] });
  assert.deepEqual(voiceCoverage(['a'], undefined), { have: 0, missing: ['a'] });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test 2>&1 | grep -E "^not ok|Cannot find|^# (pass|fail)"`
Expected: `Cannot find module …/src/core/voice-phrases.js`

- [ ] **Step 3: 구현** — `src/core/voice-phrases.js`

```js
/* ===== 묶음 6: Gemini 음성으로 미리 만들 문구 목록 (순수). 문구는 직접 쓰지 않고 앱의 문구 함수를 불러, 실제로 말하는 문구와 글자까지 같게 한다 ===== */
import {groupText} from './alerts-core.js';
import './cooldown.js';                                   // 설치기 종류 등록
import {IDLE_ALERTS} from './idle.js';                    // 사냥 멈춤 종류 등록 + 알림 횟수
import {KINDS} from './kinds.js';
import {manualEmptyStore,manualText,presetTimerName} from './manual-core.js';
import {defaultStore} from './targets.js';

// 성별은 Google 문서에 없어 기억에 기댄 분류 [추정]. 들어 보고 틀리면 표시만 고친다
export const VOICES=[
  {id:'Kore',label:'Kore',gender:'여'},{id:'Zephyr',label:'Zephyr',gender:'여'},{id:'Leda',label:'Leda',gender:'여'},
  {id:'Sulafat',label:'Sulafat',gender:'여'},{id:'Charon',label:'Charon',gender:'남'},{id:'Puck',label:'Puck',gender:'남'},
];
export const DEFAULT_VOICE='Kore';                         // 사용자 결정(2026-11-10): 기본은 여자 목소리 하나
export const VOICE_MODEL='gemini-3.8-flash-tts';
export const VOICE_STYLE='Clear, calm Korean alert announcer. Slightly fast pace. No extra words.';   // 한국어 대본이어도 말투 지시는 영어가 좋다(문서)
export const WATCH_START='감시 시작할게요';
export const VOICE_SAMPLE='솔 야누스 10초 전';             // 소리 설정의 "듣기"

const perms=(arr,k)=>k===0?[[]]:arr.flatMap((x,i)=>perms([...arr.slice(0,i),...arr.slice(i+1)],k-1).map(p=>[x,...p]));
const preOf=t=>KINDS[t.kind]&&KINDS[t.kind].events.find(e=>e.group==='pre');
const hasPre=t=>!!preOf(t)&&!(t.kind==='cooldown'&&!t.p.durationSec);

// 대상 하나가 말할 수 있는 문구
function targetTexts(t){
  const k=KINDS[t.kind]; if(!k) return [];
  const out=[];
  for(const e of k.events){
    if(t.kind==='idle'&&e.key==='alarm'){   // 처음 + 반복(경과 시간이 문구에 들어간다)
      for(let i=0;i<IDLE_ALERTS&&(i===0||t.p.repeatSec>0);i++) out.push(e.msg(t,{elapsedSec:t.p.idleSec+i*t.p.repeatSec}));
      continue;
    }
    if(t.kind==='cooldown'&&e.key==='pre'&&!t.p.durationSec) continue;   // 지속시간이 없으면 울리지 않는다
    out.push(e.msg(t,{}));
  }
  return out;
}
// 묶음 미리 알림: 실행 중 남은 시간에 따라 순서가 바뀌므로 모든 순서를 만든다. 4개 이상이면 "N개 곧 끝나요"
function groupTexts(targets){
  const names=targets.filter(hasPre).map(t=>t.name), out=[];
  const say=arr=>groupText('pre',arr.map((label,i)=>({label,rank:i,order:i})));
  for(const p of perms(names,2)) out.push(say(p));
  if(names.length<=3) for(const p of perms(names,3)) out.push(say(p));
  for(let n=4;n<=names.length;n++) out.push(say(names.slice(0,n)));
  return out;
}
// 수동 타이머: 프리셋으로 시작할 타이머, 기본 사냥·회수 반복, 저장된 타이머
function manualTexts(m){
  const pre=(m.prefs&&m.prefs.preSec)||10, out=[];
  const count=(t,all)=>out.push(manualText(t,{type:'pre',idx:0},all),manualText(t,{type:'end',idx:0},all));
  const routine=(t,all)=>{ for(let i=0;i<t.phases.length;i++) out.push(manualText(t,{type:'pre',idx:i},all),manualText(t,{type:'switch',idx:i},all)); };
  for(const p of m.presets||[]){ const label=presetTimerName(p), t={kind:'countdown',label,preSec:pre,phases:[{name:label,sec:p.sec}]}; count(t,[t]); }
  const r={kind:'routine',label:'사냥·회수',preSec:pre,phases:[{name:'사냥',sec:60},{name:'회수',sec:60}]}; routine(r,[r]);
  const timers=m.timers||[];
  for(const t of timers) (t.kind==='routine'?routine:count)(t,timers);
  return out;
}
// targets: 대상 배열(꺼 둔 대상 포함), group: {on}, manual: 수동 타이머 저장값. 없으면 기본 설정
export function voicePhrases({targets,group,manual}={}){
  const ts=targets||defaultStore().targets, m=manual||manualEmptyStore();
  const all=[WATCH_START,...ts.flatMap(targetTexts),...(group&&group.on?groupTexts(ts):[]),...manualTexts(m)];
  return [...new Set(all)].sort();
}
// files: manifest.files[목소리] (문구 → 파일). 없는 문구는 브라우저 음성으로 나온다
export function voiceCoverage(phrases,files){
  const f=files||{}, missing=phrases.filter(p=>!f[p]);
  return {have:phrases.length-missing.length,missing};
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`

---

### Task 3: 스크립트 순수 함수 `voice-lib.mjs`

**Files:**
- Modify: `package.json` (개발 의존성)
- Create: `scripts/voice-lib.mjs`
- Test: `tests/voice-lib.test.js`

- [ ] **Step 1: MP3 인코더 설치와 API 확인**

Run: `npm install --save-dev @breezystack/lamejs@1.2.7 && node -e "import('@breezystack/lamejs').then(l=>{const e=new l.Mp3Encoder(1,24000,48);const b=e.encodeBuffer(new Int16Array(2400));const f=e.flush();console.log(typeof l.Mp3Encoder,b.constructor.name,b.length+f.length)})"`
Expected: `function Int8Array <0보다 큰 수>` (이름이 다르면 아래 `encodeMp3`의 import를 그 이름에 맞춘다)

- [ ] **Step 2: 실패하는 시험 쓰기** — `tests/voice-lib.test.js` 새 파일

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TTS_URL, adoptManifest, buildTtsRequest, clipPath, emptyManifest, encodeMp3, extractAudioBase64, manifestGet, manifestSet, parseEnvKey, pcmFromAudio } from '../scripts/voice-lib.mjs';
import { VOICE_MODEL, VOICE_STYLE } from '../src/core/voice-phrases.js';

function wav(samples, rate = 24000) {   // 모노 16비트 WAV
  const b = Buffer.alloc(44 + samples.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40); samples.forEach((s, i) => b.writeInt16LE(s, 44 + i * 2)); return b;
}

test('buildTtsRequest: 문서의 Interactions 요청 모양, 키는 헤더로', () => {
  const r = buildTtsRequest({ text: '룬이 나왔어요', voice: 'Kore', key: 'K' });
  assert.equal(r.url, TTS_URL); assert.equal(r.init.method, 'POST'); assert.equal(r.init.headers['x-goog-api-key'], 'K');
  assert.deepEqual(JSON.parse(r.init.body), { model: VOICE_MODEL, input: [{ type: 'user_input', content: [{ type: 'text', text: '룬이 나왔어요', annotations: [{ type: 'speech_metadata', style: VOICE_STYLE }] }] }],
    response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice: 'Kore' }] } });
});

test('extractAudioBase64: Interactions 응답과 generateContent 응답, 없으면 오류', () => {
  assert.equal(extractAudioBase64({ steps: [{ type: 'thought', content: [] }, { type: 'model_output', content: [{ type: 'audio', data: 'QUJD' }] }] }), 'QUJD');
  assert.equal(extractAudioBase64({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: 'REVG' } }] } }] }), 'REVG');
  assert.throws(() => extractAudioBase64({ steps: [] }), /응답에 음성이 없어요/);
});

test('pcmFromAudio: WAV는 헤더를 읽고, 헤더가 없으면 24kHz 모노 16비트로 본다', () => {
  const w = pcmFromAudio(wav([1, -2, 300], 22050));
  assert.equal(w.sampleRate, 22050); assert.deepEqual([...w.samples], [1, -2, 300]);
  const raw = Buffer.alloc(4); raw.writeInt16LE(5, 0); raw.writeInt16LE(-6, 2);
  const r = pcmFromAudio(raw); assert.equal(r.sampleRate, 24000); assert.deepEqual([...r.samples], [5, -6]);
});

test('encodeMp3: MPEG 프레임으로 시작하는 MP3', () => {
  const s = new Int16Array(4800).map((_, i) => Math.round(Math.sin(i / 8) * 8000));
  const mp3 = encodeMp3(s, 24000);
  assert.ok(mp3.length > 100); assert.equal(mp3[0], 0xff); assert.equal(mp3[1] & 0xe0, 0xe0);
});

test('parseEnvKey: GEMINI_API_KEY 한 줄, 따옴표·주석·다른 줄 무시', () => {
  assert.equal(parseEnvKey('GEMINI_API_KEY=abc123'), 'abc123');
  assert.equal(parseEnvKey('# x\nOTHER=1\nGEMINI_API_KEY = "q-w_e" # 메모\n'), 'q-w_e');
  assert.equal(parseEnvKey('OTHER=1'), null);
});

test('clipPath: 목소리 폴더 + 문구 sha1 앞 12자', () => {
  assert.match(clipPath('Kore', '룬이 나왔어요'), /^Kore\/[0-9a-f]{12}\.mp3$/);
  assert.equal(clipPath('Kore', 'a'), clipPath('Kore', 'a')); assert.notEqual(clipPath('Kore', 'a'), clipPath('Kore', 'b'));
});

test('manifest: 새로 만들기, 넣고 꺼내기, 모델·말투가 같을 때만 이어서', () => {
  const m = emptyManifest(); assert.equal(m.version, 1); assert.equal(m.voices.length, 6);
  manifestSet(m, 'Kore', 'a', 'Kore/1.mp3'); assert.equal(manifestGet(m, 'Kore', 'a'), 'Kore/1.mp3'); assert.equal(manifestGet(m, 'Puck', 'a'), null);
  assert.deepEqual(adoptManifest(JSON.parse(JSON.stringify(m))).files, m.files);
  assert.deepEqual(adoptManifest({ ...m, style: '다른 말투' }).files, {});
  assert.deepEqual(adoptManifest(null).files, {});
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm test 2>&1 | grep -E "^not ok|Cannot find|^# (pass|fail)"`
Expected: `Cannot find module …/scripts/voice-lib.mjs`

- [ ] **Step 4: 구현** — `scripts/voice-lib.mjs`

```js
/* ===== 묶음 6: 음성 생성 스크립트의 순수 함수(node 전용). API 호출·파일 쓰기는 voice-gen.mjs ===== */
import {createHash} from 'node:crypto';
import * as lame from '@breezystack/lamejs';
import {VOICES,VOICE_MODEL,VOICE_STYLE} from '../src/core/voice-phrases.js';

export const TTS_URL='https://generativelanguage.googleapis.com/v1beta/interactions';
// 문서(2026-11-10 기준)의 Interactions API 모양. 첫 실제 호출에서 확인한다
export function buildTtsRequest({text,voice,key,model=VOICE_MODEL,style=VOICE_STYLE}){
  const body={model,input:[{type:'user_input',content:[{type:'text',text,annotations:[{type:'speech_metadata',style}]}]}],
    response_format:{type:'audio'},generation_config:{speech_config:[{voice}]}};
  return {url:TTS_URL,init:{method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},body:JSON.stringify(body)}};
}
// 응답에서 base64 오디오. Interactions(steps[].content[] type audio)와 generateContent(candidates[].content.parts[].inlineData) 모두
export function extractAudioBase64(j){
  for(const s of (j&&j.steps)||[]) for(const c of s.content||[]) if(c&&c.type==='audio'&&c.data) return c.data;
  for(const c of (j&&j.candidates)||[]) for(const p of (c.content&&c.content.parts)||[]) if(p.inlineData&&p.inlineData.data) return p.inlineData.data;
  throw new Error('응답에 음성이 없어요: '+JSON.stringify(j).slice(0,300));
}
const int16At=(u,off,len)=>{ const n=len>>1, out=new Int16Array(n), dv=new DataView(u.buffer,u.byteOffset+off,n*2); for(let i=0;i<n;i++) out[i]=dv.getInt16(i*2,true); return out; };
// WAV(RIFF)면 헤더를 읽고, 아니면 헤더 없는 24kHz 모노 16비트(리틀 엔디언) PCM으로 본다
export function pcmFromAudio(buf){
  const u=buf instanceof Uint8Array?buf:new Uint8Array(buf), dv=new DataView(u.buffer,u.byteOffset,u.byteLength);
  const tag=o=>String.fromCharCode(u[o],u[o+1],u[o+2],u[o+3]);
  if(u.length>=12&&tag(0)==='RIFF'&&tag(8)==='WAVE'){
    let o=12, rate=24000, ch=1, bits=16, data=null;
    while(o+8<=u.length){ const id=tag(o), size=dv.getUint32(o+4,true), body=o+8;
      if(id==='fmt '){ ch=dv.getUint16(body+2,true); rate=dv.getUint32(body+4,true); bits=dv.getUint16(body+14,true); }
      else if(id==='data'){ data=[body,Math.min(size,u.length-body)]; break; }
      o=body+size+(size&1); }
    if(!data) throw new Error('WAV에 data 덩어리가 없어요');
    if(ch!==1||bits!==16) throw new Error(`모노 16비트 WAV만 받아요(지금 ${ch}채널 ${bits}비트)`);
    return {sampleRate:rate,samples:int16At(u,data[0],data[1])};
  }
  return {sampleRate:24000,samples:int16At(u,0,u.length)};
}
// 모노 MP3(48kbps). 1152샘플씩 넣는다
export function encodeMp3(samples,sampleRate){
  const enc=new lame.Mp3Encoder(1,sampleRate,48), parts=[];
  for(let i=0;i<samples.length;i+=1152){ const b=enc.encodeBuffer(samples.subarray(i,i+1152)); if(b.length) parts.push(b); }
  const end=enc.flush(); if(end.length) parts.push(end);
  const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0)); let o=0;
  for(const p of parts){ out.set(new Uint8Array(p.buffer,p.byteOffset,p.length),o); o+=p.length; }
  return out;
}
export function parseEnvKey(text){ const m=/^\s*GEMINI_API_KEY\s*=\s*["']?([^"'\s#]+)/m.exec(String(text)); return m?m[1]:null; }
export const clipPath=(voice,text)=>`${voice}/${createHash('sha1').update(text).digest('hex').slice(0,12)}.mp3`;
export function emptyManifest(){ return {version:1,model:VOICE_MODEL,style:VOICE_STYLE,voices:VOICES.map(v=>({...v})),files:{}}; }
// 저장된 manifest를 이어서 쓴다. 모델·말투가 바뀌었으면 처음부터(다른 소리가 섞이지 않게)
export function adoptManifest(j){
  const m=emptyManifest();
  if(j&&j.version===1&&j.model===VOICE_MODEL&&j.style===VOICE_STYLE&&j.files&&typeof j.files==='object') m.files=j.files;
  return m;
}
export const manifestGet=(m,voice,text)=>(m.files[voice]&&m.files[voice][text])||null;
export function manifestSet(m,voice,text,rel){ (m.files[voice]=m.files[voice]||{})[text]=rel; }
```

- [ ] **Step 5: 통과 확인**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`

---

### Task 4: 생성 스크립트 `voice-gen.mjs`

**Files:**
- Create: `scripts/voice-gen.mjs`
- Modify: `package.json` (`"scripts"`에 `"voice": "node scripts/voice-gen.mjs"`)

- [ ] **Step 1: 스크립트 작성** — `scripts/voice-gen.mjs`

```js
/* ===== 묶음 6: 알림 문구를 Gemini 음성(MP3)으로 미리 만든다
   사용: npm run voice -- [--backup 설정백업.json] [--voices Kore,Zephyr] [--limit N] [--dry-run]
   API 키: 저장소 맨 위 .env.gemini 의 GEMINI_API_KEY=… (git에서 빠져 있다). 키는 출력하지 않는다 ===== */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateBackup} from '../src/core/backup-core.js';
import {VOICES,voicePhrases} from '../src/core/voice-phrases.js';
import {adoptManifest,buildTtsRequest,clipPath,encodeMp3,extractAudioBase64,manifestGet,manifestSet,parseEnvKey,pcmFromAudio} from './voice-lib.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), OUT=path.join(ROOT,'public','voice'), MANIFEST=path.join(OUT,'manifest.json');
const args=process.argv.slice(2), opt=k=>{ const i=args.indexOf(k); return i>=0?args[i+1]:null; };

let input={};
if(opt('--backup')){
  const v=validateBackup(JSON.parse(fs.readFileSync(opt('--backup'),'utf8')));
  if(!v.ok){ console.error('설정 백업 파일을 읽지 못했어요: '+v.errors.join(', ')); process.exit(1); }
  const st=v.groups.targets; input={targets:st&&st.targets,group:st&&st.group,manual:v.groups.manualTimers};
}
const phrases=voicePhrases(input);
const ids=(opt('--voices')||VOICES.map(v=>v.id).join(',')).split(',').map(s=>s.trim()).filter(Boolean);
const unknown=ids.filter(id=>!VOICES.some(v=>v.id===id)); if(unknown.length){ console.error('모르는 목소리: '+unknown.join(', ')); process.exit(1); }
const manifest=adoptManifest(fs.existsSync(MANIFEST)?JSON.parse(fs.readFileSync(MANIFEST,'utf8')):null);
let todo=[];
for(const voice of ids) for(const text of phrases){ const rel=manifestGet(manifest,voice,text); if(!rel||!fs.existsSync(path.join(OUT,rel))) todo.push({voice,text}); }
const limit=+opt('--limit'); if(limit>0) todo=todo.slice(0,limit);
console.log(`문구 ${phrases.length}개 × 목소리 ${ids.length}개 · 새로 만들 것 ${todo.length}개`);
if(args.includes('--dry-run')){ for(const p of phrases) console.log('  '+p); process.exit(0); }

const envFile=path.join(ROOT,'.env.gemini'), key=fs.existsSync(envFile)?parseEnvKey(fs.readFileSync(envFile,'utf8')):null;
if(!key){ console.error('API 키가 없어요. https://aistudio.google.com/apikey 에서 키를 만들어 저장소 맨 위 .env.gemini 파일에 GEMINI_API_KEY=키 한 줄로 넣어 주세요'); process.exit(1); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function synth(text,voice){
  for(let attempt=0;;attempt++){
    const {url,init}=buildTtsRequest({text,voice,key});
    const res=await fetch(url,init);
    if(res.ok) return extractAudioBase64(await res.json());
    const body=await res.text();
    if((res.status===429||res.status>=500)&&attempt<5){ console.log(`  HTTP ${res.status}, ${2*2**attempt}초 뒤 다시`); await sleep(2000*2**attempt); continue; }
    const e=new Error(`HTTP ${res.status}: ${body.slice(0,500)}`); e.status=res.status; throw e;
  }
}
fs.mkdirSync(OUT,{recursive:true});
fs.writeFileSync(MANIFEST,JSON.stringify(manifest,null,1));   // 목소리 목록·모델·말투를 먼저 맞춰 둔다
let done=0;
for(const {voice,text} of todo){
  try{
    const pcm=pcmFromAudio(Buffer.from(await synth(text,voice),'base64'));
    const rel=clipPath(voice,text); fs.mkdirSync(path.join(OUT,voice),{recursive:true});
    fs.writeFileSync(path.join(OUT,rel),encodeMp3(pcm.samples,pcm.sampleRate));
    manifestSet(manifest,voice,text,rel); fs.writeFileSync(MANIFEST,JSON.stringify(manifest,null,1));   // 하나 만들 때마다 저장(중간에 멈춰도 이어서)
    done++; console.log(`[${done}/${todo.length}] ${voice} · ${text} · ${(pcm.samples.length/pcm.sampleRate).toFixed(1)}초`);
  }catch(e){
    if(e.status===429){ console.error(`한도에 걸렸어요(${done}개 만듦). 나중에 다시 돌리면 이어서 만들어요.`); process.exit(2); }
    console.error(`${voice} · ${text}: ${e.message}`); process.exit(1);
  }
}
console.log(`끝났어요. ${done}개 만듦`);
```

`package.json`의 `"scripts"`에 `"voice": "node scripts/voice-gen.mjs",`를 `"test"` 위에 넣는다.

- [ ] **Step 2: 문구 목록 확인(API 안 부름)**

Run: `npm run voice -- --dry-run`
Expected: 첫 줄 `문구 24개 × 목소리 6개 · 새로 만들 것 144개`, 그 아래 24개 문구(Task 2의 기본 목록)

- [ ] **Step 3: 키 없을 때 안내 확인** (`.env.gemini`가 아직 없을 때)

Run: `npm run voice -- --voices Kore --limit 1; echo "exit=$?"`
Expected: `API 키가 없어요. …` 와 `exit=1`

---

### Task 5: 실제 생성 (사용자가 `.env.gemini`를 넣은 뒤)

- [ ] **Step 1: 사용자 쪽 준비 확인** — 파일 내용은 열지 않고 있는지만 본다

Run: `test -f .env.gemini && echo 있음 || echo 없음`
Expected: `있음` (없으면 사용자에게 다시 부탁하고 멈춘다)

- [ ] **Step 2: 한 문구로 요청 모양 확인**

Run: `npm run voice -- --voices Kore --limit 1`
Expected: `[1/1] Kore · … · 1.x초`. 4xx면 응답 메시지를 읽고 `buildTtsRequest`/`extractAudioBase64`를 그에 맞게 고친 뒤 Task 3 시험을 고쳐 다시 통과시키고 이 단계를 반복한다. 고친 내용은 설계 문서 2절에 [확인]으로 적는다.

- [ ] **Step 3: 들어 보기**

Run: `afplay "public/voice/$(node -e "const m=require('./public/voice/manifest.json');console.log(Object.values(m.files.Kore)[0])")"`
Expected: 한국어로 또렷하게 들림. 이상하면(다른 말이 붙음·영어 억양) `VOICE_STYLE`을 고치고 `public/voice`를 지운 뒤 Step 2부터.

- [ ] **Step 4: 전체 생성**

Run: `npm run voice`
Expected: `끝났어요. 143개 만듦` 또는 한도 안내(`한도에 걸렸어요…`, exit 2). 한도면 사용자에게 알리고 다음 날 같은 명령으로 이어서 만든다(앱은 없는 문구를 브라우저 음성으로 하므로 Task 6 이후를 먼저 진행해도 된다).

- [ ] **Step 5: 크기 확인**

Run: `du -sh public/voice && ls public/voice`
Expected: 3MB 안팎, `Charon Kore Leda Puck Sulafat Zephyr manifest.json`

---

### Task 6: 앱 재생 `voice.js`와 `speak` 연결

**Files:**
- Create: `src/app/voice.js`
- Modify: `src/app/alerts.js` (`unlockAudio`, `speak`, `playDefault`, 끝의 낡은 주석)
- Modify: `src/app/capture.js:79` (시작 음성)
- Modify: `src/app/boot.js` (`initVoice`)

- [ ] **Step 1: `src/app/voice.js` 작성**

```js
/* ===== 묶음 6: 미리 만든 Gemini 음성 재생. 목록(public/voice/manifest.json)과 고른 목소리의 파일을 받아 풀어 두고, alerts.js의 speakClip이 꺼내 쓴다 ===== */
import {actx,speak,spokenAt} from './alerts.js';
import {bump} from './bus.js';
import {manual} from './manual.js';
import {saveUi,ui} from './prefs.js';
import {store} from './store.js';
import {DEFAULT_VOICE,VOICE_SAMPLE,voiceCoverage,voicePhrases} from '../core/voice-phrases.js';
export const voiceState={manifest:null,status:'loading',clips:new Map(),run:null};   // status: loading|ok|none
const base=()=>import.meta.env.BASE_URL||'./';
export const voiceFileUrl=f=>/^(data:|blob:|https?:)/.test(f)?f:base()+'voice/'+f;
export const voiceIds=()=>voiceState.manifest?voiceState.manifest.voices.map(v=>v.id):[];
// 고른 목소리. 'browser'는 브라우저 기본 음성. 목록에 없으면 기본(Kore), 목록이 없으면 브라우저
export function currentVoice(){
  if(ui.voiceName==='browser') return 'browser';
  const ids=voiceIds(); if(ids.includes(ui.voiceName)) return ui.voiceName;
  return ids.includes(DEFAULT_VOICE)?DEFAULT_VOICE:(ids[0]||'browser');
}
export function setVoiceManifest(m){
  voiceState.manifest=m&&m.version===1&&Array.isArray(m.voices)&&m.files&&typeof m.files==='object'?m:null;
  voiceState.status=voiceState.manifest?'ok':'none'; voiceState.clips.clear(); voiceState.run=null; bump(); loadClips();
}
export async function initVoice(){
  try{ const r=await fetch(base()+'voice/manifest.json',{cache:'no-cache'}); if(!r.ok) throw new Error('HTTP '+r.status); setVoiceManifest(await r.json()); }
  catch(e){ setVoiceManifest(null); }
}
export function setVoiceName(name){ ui.voiceName=name; saveUi(); voiceState.clips.clear(); voiceState.run=null; bump(); loadClips(); }
async function decode(f){ return actx.decodeAudioData(await (await fetch(voiceFileUrl(f))).arrayBuffer()); }
// 고른 목소리의 파일만 차례로 받아 푼다. 목소리를 바꾸면 하던 것을 그만둔다. 오디오가 켜지기 전이면 unlockAudio가 다시 부른다
export async function loadClips(){
  const v=currentVoice(); if(!actx||!voiceState.manifest||v==='browser') return;
  const run=Symbol(v); voiceState.run=run;
  for(const [text,f] of Object.entries(voiceState.manifest.files[v]||{})){
    if(voiceState.run!==run) return;
    if(voiceState.clips.has(text)) continue;
    try{ const b=await decode(f); if(voiceState.run===run) voiceState.clips.set(text,b); }catch(e){}   // 못 풀면 그 문구는 브라우저 음성
  }
  if(voiceState.run===run){ voiceState.run=null; bump(); }
}
export const clipFor=text=>currentVoice()==='browser'?null:(voiceState.clips.get(text)||null);
// 소리 설정의 "듣기": 아직 안 풀렸으면 그 문구만 먼저 풀어서 바로 들려준다
export async function previewVoice(){
  const v=currentVoice(), f=v!=='browser'&&voiceState.manifest&&(voiceState.manifest.files[v]||{})[VOICE_SAMPLE];
  if(f&&actx&&!voiceState.clips.has(VOICE_SAMPLE)){ try{ voiceState.clips.set(VOICE_SAMPLE,await decode(f)); }catch(e){} }
  spokenAt.delete(VOICE_SAMPLE); speak(VOICE_SAMPLE);
}
export function voiceChoices(){
  const vs=voiceState.manifest?voiceState.manifest.voices:[];
  return [...vs.map(v=>({id:v.id,text:`${v.label}${v.id===DEFAULT_VOICE?' (기본)':''} · ${v.gender}`})),{id:'browser',text:'브라우저 기본 음성'}];
}
export function voiceNote(){
  if(voiceState.status==='loading') return 'Gemini 음성 목록을 읽는 중이에요';
  if(voiceState.status==='none') return 'Gemini 음성 파일이 없어서 브라우저 음성으로 말해요';
  const v=currentVoice(); if(v==='browser') return '브라우저 기본 음성으로 말해요';
  const c=voiceCoverage(voicePhrases({targets:store.targets,group:store.group,manual}),voiceState.manifest.files[v]);
  return `Gemini 음성 ${c.have}개 · 브라우저 음성 ${c.missing.length}개`+(c.missing.length?' · 설정을 바꿔서 없는 문구는 브라우저 음성으로 나와요':'');
}
```

- [ ] **Step 2: `src/app/alerts.js` 고치기**

import에 한 줄 추가(`import {customSounds,playCustom} from './sounds.js';` 아래):

```js
import {clipFor,loadClips} from './voice.js';
```

`unlockAudio`의 `predecodeSounds();`를 `predecodeSounds(); loadClips();`로.

`speak`를 아래로 바꾸고 바로 위에 `speakClip`을 둔다:

```js
// 미리 만든 Gemini 음성(묶음 6)이 있으면 경고음 시간줄(beepEnd) 뒤에 이어서 재생. 처리했으면(재생·중복·음성 끔) true, 그 문구 음성이 없으면 false
export function speakClip(text){
  const buf=clipFor(text); if(!buf||!actx) return false;
  if(!voiceOn()) return true;
  const now=Date.now(); if(now-(spokenAt.get(text)||0)<8000) return true; spokenAt.set(text,now);
  const n=actx.createBufferSource(); n.buffer=buf; n.connect(Alerts.audioOut());   // 마스터를 지나 음량 0~200%
  const t=Math.max(actx.currentTime+0.02,beepEnd); n.start(t); beepEnd=t+buf.duration+0.06;
  return true;
}
export function speak(text){
  if(speakClip(text)) return;
  if(!voiceOn()||!('speechSynthesis' in window)) return;
  const now=Date.now(); if(now-(spokenAt.get(text)||0)<8000) return; spokenAt.set(text,now);
  if((speechSynthesis.speaking||speechSynthesis.pending) && now-speakQueuedAt>15000) speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang='ko-KR'; u.volume=ttsVolume(volPct()); u.rate=1.1;
  speechSynthesis.speak(u); speakQueuedAt=now;
}
```

`playDefault`를 바꾼다(Gemini 음성이면 타이머를 거치지 않고 바로 시간줄에 예약. 숨은 탭에서 setTimeout이 늦어져도 순서가 지켜진다):

```js
export function playDefault(msg, sound){ const wait=sound?beep(sound):0; if(speakClip(msg)) return; setTimeout(()=>speak(msg), Math.round(wait*1000)+150); }
```

파일 끝의 `// 화면을 받는 쪽의 문제(끊김·멈춤)는 게임 알림과 다른 소리로 알림. 회복은 음성만` 줄을 지운다(연결 문제 알림은 2026-11-10에 뺐다).

- [ ] **Step 3: `src/app/capture.js` 시작 음성**

import에 `import {WATCH_START} from '../core/voice-phrases.js';`를 더하고 `:79`를 바꾼다:

```js
    speak(WATCH_START+(need.length?`. ${eunNeun(need.join(', '))} 등록이 필요해요`:''));
```

- [ ] **Step 4: `src/app/boot.js`**

import에 `import {initVoice} from './voice.js';`, `boot()`의 `manualInit(); audioInit(); pipInit();`를 `manualInit(); audioInit(); pipInit(); initVoice();`로.

- [ ] **Step 5: 빌드·node 시험**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)" && npm run build 2>&1 | tail -2`
Expected: `# fail 0`, `✓ built in …`

---

### Task 7: 소리 설정 화면과 음량 안내

**Files:**
- Modify: `src/ui/SoundSettings.jsx`
- Modify: `src/ui/Masthead.jsx` (`#volNote`), `src/app/audio.js:1-2` (주석)

- [ ] **Step 1: `SoundSettings.jsx`**

import 추가:

```js
import { currentVoice, previewVoice, setVoiceName, voiceChoices, voiceNote } from '../app/voice.js';
```

`<div className="wbody">` 바로 다음, 첫 `<p className="sub">파일을 고르면…` 앞에 넣는다:

```jsx
        <fieldset id="voiceCtl">
          <legend>음성</legend>
          <select id="voiceName" aria-label="알림 음성" value={currentVoice()} onChange={e => setVoiceName(e.target.value)}>
            {voiceChoices().map(v => <option key={v.id} value={v.id}>{v.text}</option>)}
          </select>
          {' '}
          <button data-a="voice-play" type="button" onClick={() => { unlockAudio(); previewVoice(); }}>듣기</button>
          <p id="voiceNote" className="sub">{voiceNote()}</p>
        </fieldset>
```

- [ ] **Step 2: 음량 안내** — `Masthead.jsx`에 `import { currentVoice } from '../app/voice.js';`를 더하고 `#volNote` 줄을 바꾼다:

```jsx
        <span id="volNote" className="sub" hidden={vol.pct <= 100 || currentVoice() !== 'browser'}>브라우저 음성은 100%까지만 커져요. 소리가 갈라지면 줄여 주세요</span>
```

`src/app/audio.js` 첫 두 줄 주석의 `음성(TTS)은 Web Audio로 키울 수 없어 100%에서 멈춘다(ttsVolume)`를 `브라우저 음성(TTS)은 Web Audio로 키울 수 없어 100%에서 멈춘다(ttsVolume). 미리 만든 Gemini 음성(묶음 6)은 마스터를 지나 함께 커진다`로.

- [ ] **Step 3: 빌드**

Run: `npm run build 2>&1 | tail -2`
Expected: `✓ built in …`

---

### Task 8: 백업에 고른 목소리

**Files:**
- Modify: `src/core/backup-core.js` (`validateBackup`의 ui 허용 목록), `src/app/backup.js:36`
- Test: `tests/backup.test.js`

- [ ] **Step 1: 실패하는 시험** — `tests/backup.test.js` 끝에 추가

```js
test('백업 ui: 고른 목소리(voiceName)는 영문 이름이나 browser만', () => {
  const env = ui => ({ schema: 'maple-web-timer-backup', version: 1, includes: ['ui'], data: { ui } });
  assert.deepEqual(L.validateBackup(env({ voiceName: 'Zephyr' })).groups.ui, { voiceName: 'Zephyr' });
  assert.deepEqual(L.validateBackup(env({ voiceName: 'browser' })).groups.ui, { voiceName: 'browser' });
  assert.deepEqual(L.validateBackup(env({ voiceName: '<b>' })).groups.ui, {});
  assert.deepEqual(L.validateBackup(env({ voiceName: 'x'.repeat(40) })).groups.ui, {});
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `not ok … 백업 ui: 고른 목소리…`

- [ ] **Step 3: 구현** — `backup-core.js`의 `if(typeof u.voice==='boolean') o.voice=u.voice;` 아래에:

```js
    if(typeof u.voiceName==='string'&&/^([A-Za-z]{1,32}|browser)$/.test(u.voiceName)) o.voiceName=u.voiceName;   // 묶음 6: 고른 음성
```

`src/app/backup.js:36`의 `ui:{volumePct:…,voice:ui.voice!==false,...(ui.pip?{pip:ui.pip}:{})}`에 `...(ui.voiceName?{voiceName:ui.voiceName}:{})`를 더한다.

- [ ] **Step 4: 통과 확인**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`

---

### Task 9: 브라우저 시나리오

**Files:**
- Create: `tests/browser/voice.mjs`

- [ ] **Step 1: 시나리오 작성**

```js
// Gemini 음성(묶음 6): 미리 만든 음성 재생 · 목소리 고르기 · 없는 문구는 브라우저 음성
const ROOT = "file://__ROOT__/tests/browser/";
const { open, check, done } = await import(ROOT + "prelude.mjs");
const J = JSON.stringify;
const { page, ev, wait } = await open(taskSpace, { connect: true });
// 시험용 음성(0.3초 사인파 WAV data URL)과 목록. 버퍼 재생 횟수를 센다
await ev(() => {
  const n = 7200, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 24000, true); v.setUint32(28, 48000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 6) * 6000, true);
  let s = ""; new Uint8Array(b).forEach(x => { s += String.fromCharCode(x); });
  window.__src = 0; const cbs = AudioContext.prototype.createBufferSource; AudioContext.prototype.createBufferSource = function () { window.__src++; return cbs.call(this); };
  document.querySelector("#soundsDetails").open = true;
  setVoiceName("Kore");
  setVoiceManifest({ version: 1, model: "t", style: "t", voices: [{ id: "Kore", label: "Kore", gender: "여" }, { id: "Zephyr", label: "Zephyr", gender: "여" }],
    files: { Kore: { "솔 야누스 10초 전": "data:audio/wav;base64," + btoa(s) }, Zephyr: {} } });
});
await page.waitForFunction(() => voiceState.clips.size === 1, undefined, { timeout: 5000 });
const say = async id => { await ev(i => { __fake.skew(9000); __fake.reset(); window.__src = 0; testAlert(targetById(i)); }, id); await wait(1500); return ev(() => ({ spoken: __fake.spoken.slice(), src: window.__src })); };

const a = await say("sol");
check("목록에 있는 문구: 브라우저 음성 대신 Gemini 음성 파일", a.spoken.length === 0 && a.src >= 1, a);
const b = await say("booster");
check("목록에 없는 문구: 브라우저 음성", J(b.spoken) === J(["부스터 10초 전"]) && b.src === 0, b);

const opts = await ev(() => [...document.querySelectorAll("#voiceName option")].map(o => [o.value, o.textContent]));
check("음성 칸: 목록의 목소리 + 브라우저 기본, 기본 표시", J(opts.map(o => o[0])) === J(["Kore", "Zephyr", "browser"]) && opts[0][1].includes("(기본)"), opts);
const note = await ev(() => document.querySelector("#voiceNote").textContent);
check("음성 칸 안내: Gemini 1개 · 나머지 브라우저", /^Gemini 음성 1개 · 브라우저 음성 \d+개/.test(note), note);

await page.selectOption("#voiceName", "browser"); await wait(300);
const c = await say("sol");
const saved = await ev(() => JSON.parse(localStorage.getItem("maple-web-timer-ui")).voiceName);
check("브라우저 기본: 같은 문구도 브라우저 음성, 고른 값 저장", J(c.spoken) === J(["솔 야누스 10초 전"]) && c.src === 0 && saved === "browser", { c, saved });

await page.selectOption("#voiceName", "Zephyr"); await wait(300);
const d = await say("sol");
check("그 목소리 파일이 없으면 브라우저 음성", J(d.spoken) === J(["솔 야누스 10초 전"]) && d.src === 0, d);

await page.selectOption("#voiceName", "Kore");
await page.waitForFunction(() => voiceState.clips.size === 1, undefined, { timeout: 5000 });
await ev(() => { __fake.reset(); window.__src = 0; }); await page.click("[data-a=voice-play]"); await wait(800);
const e = await ev(() => ({ spoken: __fake.spoken.slice(), src: window.__src }));
check("듣기: 고른 목소리로 '솔 야누스 10초 전'", e.spoken.length === 0 && e.src >= 1, e);

await ev(() => setVoiceManifest(null)); await wait(300);
const f = await say("sol");
const note2 = await ev(() => document.querySelector("#voiceNote").textContent);
check("목록이 없으면 모두 브라우저 음성, 안내", J(f.spoken) === J(["솔 야누스 10초 전"]) && note2.includes("브라우저 음성"), { f, note2 });
done();
```

- [ ] **Step 2: 실행**

Run: `npm run dev:test` (백그라운드) 후 `sh tests/browser/run.sh voice`
Expected: `voice          RESULT 9 passed, 0 failed`

- [ ] **Step 3: 전체 회귀** (실행 중에 파일을 고치지 않는다. 개발 서버가 새로고침해 시나리오가 깨진다)

Run: `npm test 2>&1 | grep -E "^# (pass|fail)" && sh tests/browser/run.sh`
Expected: `# fail 0`, 16개 시나리오 모두 `0 failed`

---

### Task 10: 실제 앱에서 듣기와 기록

- [ ] **Step 1: 실제 manifest로 확인** — `npm run dev:test`를 띄우고 ego-browser로 `http://127.0.0.1:8766/index.html` 열기 → "게임 화면 연결" 대신 `loadImageFile` 없이 `unlockAudio()` → `voiceState.status==='ok'`, `voiceIds()`가 6개, `voiceState.clips.size`가 목록 수와 같아질 때까지 기다림 → `testAlert(targetById("sol"))`가 브라우저 음성을 부르지 않음.

- [ ] **Step 2: PRODUCT.md** — "알림 소리 바꾸기" 단락 아래에 추가:

```markdown
Gemini 음성 [코드, 2026-11-10 추가]: 알림 음성은 미리 만든 Gemini 음성(모델 `gemini-3.8-flash-tts`, 목소리 6개, 기본 Kore)으로 재생한다. 개발 PC에서 `npm run voice`(API 키는 `.env.gemini`, git 제외)가 앱의 문구 함수로 문구 목록을 만들고 `public/voice`에 MP3와 `manifest.json`으로 저장한다. 앱은 소리 설정의 "음성"에서 고른 목소리의 파일만 받아 쓰고, 목록에 없는 문구(이름·초를 바꾼 뒤 다시 만들지 않은 것)는 브라우저 음성으로 말한다. Gemini 음성은 음량 0~200%를 따른다. 외부 API는 음성을 만들 때만 쓰고 앱은 여전히 서버 없이 동작한다.
```

"현재 상태이지만 약속은 아닌 것"의 `서버나 외부 API 없이 브라우저 안에서만 처리하고, 게임 화면은 밖으로 나가지 않는다.`를 `서버나 외부 API 없이 브라우저 안에서만 처리하고, 게임 화면은 밖으로 나가지 않는다. 알림 음성은 개발 PC에서 Gemini API로 미리 만들어 함께 배포한다(묶음 6).`로.

- [ ] **Step 3: 설계 문서 2절** — Task 5에서 확인한 실제 요청·응답 모양을 [확인]으로 고쳐 적는다.

- [ ] **Step 4: 사용자에게 보고** — 만든 개수, 한도로 못 만든 것, 시험 결과, 커밋 여부를 묻는다.
