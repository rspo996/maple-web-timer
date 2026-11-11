# 묶음 6: Gemini 음성 (미리 만든 알림 음성) 설계

> 표기: **[확인]** = 직접 연 파일·명령 출력이 근거. **[문서]** = Google 공식 문서를 웹 조회로 읽은 내용(첫 실제 호출 전까지는 요청 모양을 검증하지 않음). **[추정]** = 확인하지 않은 판단.

## 0. 바뀐 결정 (2026-11-11, 첫 샘플을 들어 본 뒤 사용자 결정)

- **목소리:** 밝은 여자 목소리 7개. 기본은 Erinome, 옵션은 Zephyr·Autonoe·Leda·Laomedeia·Aoede·Despina(성별 [추정], 사용자가 샘플을 듣고 고름). 아래 3절의 6개 목록과 Kore 기본값을 대신한다.
- **말투 지시:** `Friendly, bright and natural young Korean woman, like a cheerful game guide. Warm smile in the voice. Say only the given text.` (사용자가 들어 본 샘플의 지시)
- **10초 전 대사:** 버프와 부스터의 미리 알림을 "N초 전" 대신 `"<부를 이름> 곧 꺼져요"`로 바꾼다(예: "야누스 곧 꺼져요", "부스터 곧 꺼져요"). 묶음 미리 알림은 `"야누스, 부스터 곧 꺼져요"`. 설치기·수동 타이머·룬·사냥 멈춤 문구는 그대로.
- **부를 이름:** 화면 이름("솔 야누스")은 그대로 두고 말할 때만 쓰는 이름 `sayName`을 둔다. 내장 솔 야누스는 "야누스", 그 밖의 대상은 없으면 화면 이름.
- **음질:** MP3 96kbps(첫 샘플에서 48kbps가 지지직거린다는 보고. 원본 WAV에는 클리핑이 없었고 ㅅ·ㅊ·ㅈ의 고음이 강했다 [확인]. 원인이 압축인지는 사용자 청취로 아직 확인하지 않음 [추정]).
- **목소리 줄임(2026-11-11):** 무료 하루 10개 한도 [확인: 429 문구] 때문에 기본 Erinome만 만든다. 다른 목소리는 기존 '내 소리' 기능으로 알림마다 음성 파일을 등록해 쓴다(사용자 결정).
- **무료 한도:** 이 모델은 무료 키에서 분당 3번 [확인: 429 응답 문구]. 생성 스크립트는 요청 사이를 21초 띄운다.
- `VOICE_SAMPLE`(듣기 문구)은 "야누스 곧 꺼져요".

## 1. 목적과 결정 (2026-11-10 사용자 결정)

- 알림 음성을 브라우저 기본 음성(speechSynthesis) 대신 Google Gemini 음성 모델로 만든 음성으로 바꾼다.
- **미리 만든다.** 개발 PC에서 스크립트로 문구별 음성 파일을 만들어 앱과 함께 배포한다. 알림 순간에는 네트워크·API 키가 필요 없다(원칙 1: 알림이 제때 울리는 것이 먼저).
- **여러 목소리를 만들고 앱에서 고른다.** 기본값은 여자 목소리 하나(Kore). 브라우저 기본 음성도 고를 수 있다.
- 범위 밖: 앱 안에서 그때그때 생성, 대상별로 다른 목소리, 말투를 앱에서 바꾸기.

## 2. 사실 확인

- [확인] 지금 모든 음성은 `src/app/alerts.js`의 `speak(text)` 한 곳에서 나온다. 경고음 뒤에 음성(`playDefault`), 같은 문구 8초 중복 막기, 음성 끄기(`voiceOn`), 음량은 `ttsVolume`(100%까지).
- [확인] 내 소리 파일은 `src/app/sounds.js`가 WebAudio로 경고음과 같은 시간줄(`beepEnd`)에 이어서 재생한다. 마스터 출력(`Alerts.audioOut()`)을 지나 음량 0~200%가 적용된다.
- [확인] ffmpeg는 이 PC에 없다. `@breezystack/lamejs` 1.2.7(순수 JS MP3 인코더, 2025-01 갱신)이 npm에 있다.
- [문서] 모델 `gemini-3.8-flash-tts`, 한국어 지원, 무료 등급 있음(가격표 요약 기준). 결과는 WAV(RIFF, 24kHz, 모노, 16비트). 목소리 30개(성별 표기 없음).
- [확인, 2026-11-11 첫 실제 호출] 요청: `POST https://generativelanguage.googleapis.com/v1beta/interactions`, 헤더 `x-goog-api-key`, 본문 `{model, input:[{type:'user_input', content:[{type:'text', text, annotations:[{type:'speech_metadata', style}]}]}], response_format:{type:'audio'}, generation_config:{speech_config:[{voice}]}}`. 오디오는 `steps[]`(type `model_output`)의 `content[]`(type `audio`)의 `data`(base64). 한국어 대본이어도 말투 지시는 영어가 좋다고 적혀 있다. 실제 응답: `steps[0].type="model_output"`, `content[0]={type:"audio", mime_type:"audio/wav", data}`. WAV는 RIFF·24kHz·모노·16비트이고, data 덩어리 뒤에 C2PA(콘텐츠 출처 표시, `jumb`) 덩어리가 붙어 있다(소리가 아니므로 data 길이만큼만 읽는다). 무료 키 한도는 분당 3번(429 응답 문구 "limit: 3 requests per minute on Free Tier … retry in 8s").
- [추정] 무료 키의 TTS 하루 한도는 문서에 숫자가 없다. 300번 안팎의 요청이 하루에 다 안 될 수 있다.
- [문서] 무료 등급은 보낸 내용이 Google 제품 개선에 쓰일 수 있다. 보내는 것은 알림 문구뿐이고 게임 화면은 보내지 않는다.

## 3. 목소리

| id | 표시 | 성별 [추정] | 문서 설명 |
|---|---|---|---|
| `Kore` | Kore (기본) | 여 | Firm |
| `Zephyr` | Zephyr | 여 | Bright |
| `Leda` | Leda | 여 | Youthful |
| `Sulafat` | Sulafat | 여 | Warm |
| `Charon` | Charon | 남 | Informative |
| `Puck` | Puck | 남 | Upbeat |

성별은 문서에 없어 기억에 기댄 분류다. 사용자가 들어 보고 틀리면 표시만 고친다.
말투 지시(모든 목소리 공통): `Clear, calm Korean alert announcer. Slightly fast pace. No extra words.`

## 4. 문구 목록 (`src/core/voice-phrases.js`, 순수)

`voicePhrases({targets, group, manual})` → 중복 없는 문자열 배열(정렬). 앱이 실제로 말하는 문구와 글자까지 같아야 하므로 문구는 직접 쓰지 않고 앱의 문구 함수를 부른다.

- 대상(`targets`, 꺼 둔 대상 포함): 종류별 `KINDS[kind].events`의 `msg(t, info)`.
  - 버프·부스터 미리 알림, 부스터 숫자 못 읽음, 룬 나왔을 때·아직 있을 때, 설치기 사라짐(지속시간을 적었을 때)·아이콘 안 보임.
  - 사냥 멈춤: `idleText(idleSec)`, `idleText(idleSec+repeatSec)`, `idleText(idleSec+2*repeatSec)`(반복이 0이면 첫 번째만). 60초 미만 설정은 실제 경과 초가 1초 어긋날 수 있어 맞지 않으면 브라우저 음성이 대신한다.
- 묶기(`group.on`일 때만): 미리 알림이 있는 대상이 3개 이하이면 2개·3개 조합의 모든 순서를 `groupText('pre', …)`로. 4개 이상이면 2개 조합의 모든 순서와 "N개 곧 꺼져요"(N=4~대상 수). 순서는 실행 중 남은 시간에 따라 바뀌므로 모든 순서를 만든다.
- 수동 타이머: 프리셋마다 시작될 때 이름(`manualStartPreset`과 같은 규칙: `label`이 시간 표기와 같으면 `"<label> 타이머"`)으로 미리 알림·끝 문구. 저장된 타이머가 있으면 그 이름과 구간으로. 사냥·회수 반복은 기본 구간 이름(사냥·회수)으로 미리 알림·전환 문구. 이름 뒤에 붙는 중복 번호(`"5분 타이머 2"`)는 만들지 않는다(브라우저 음성).
- 고정: `"감시 시작할게요"`. 등록이 필요한 대상 이름이 붙는 변형은 만들지 않는다.

입력이 없으면 기본 설정(`defaultStore()`, `manualEmptyStore()`, 묶기 꺼짐)으로 만든다.

## 5. 생성 스크립트 (`scripts/voice-gen.mjs`, `scripts/voice-lib.mjs`)

- 실행: `npm run voice -- [--backup <설정 백업.json>] [--voices Kore,Zephyr] [--limit N] [--dry-run]`.
  - `--limit N`: 새로 만들 것 중 앞의 N개만(첫 실제 호출로 요청 모양을 확인할 때 1).
  - `--backup`: 앱의 "설정 백업" 파일. 대상·묶기·수동 타이머를 읽어 그 설정의 문구를 만든다(소리 파일 등 나머지는 읽지 않는다).
  - `--dry-run`: 문구 목록과 새로 만들 개수만 출력하고 API를 부르지 않는다.
- API 키: 저장소 맨 위 `.env.gemini`의 `GEMINI_API_KEY=` 한 줄. `.env*`는 이미 git에서 빠져 있다. 키가 없으면 만드는 곳(aistudio.google.com/apikey)과 파일 이름을 알려 주고 멈춘다. 키를 출력하지 않는다.
- 만들기: 목소리마다 문구마다, `manifest.json`에 이미 있고 파일도 있으면 건너뛴다. 없으면 API 호출 → WAV를 PCM으로 풀기 → MP3(모노, 48kbps, 24kHz)로 저장 → 파일 하나마다 `manifest.json`을 바로 갱신(중간에 멈춰도 이어서 만들 수 있게).
- 실패: 429·5xx는 기다렸다 다시(최대 5번, 2·4·8·16·32초). 하루 한도로 보이는 429가 계속되면 "내일 다시 돌리면 이어서 만들어요"를 출력하고 멈춘다. 그 밖의 4xx는 응답 메시지를 보여 주고 멈춘다(요청 모양이 문서와 다를 때 바로 알 수 있게).
- `voice-lib.mjs`(순수, node 시험): 요청 본문 만들기, 응답에서 오디오 꺼내기, WAV 헤더 풀기, 파일 이름(`sha1(text)` 앞 12자), manifest 합치기.
- 개발용 의존성 추가: `@breezystack/lamejs`(스크립트에서만 쓰고 앱 번들에는 들어가지 않는다).

### 결과물

```
public/voice/manifest.json
public/voice/Kore/3f2a1c9b0d4e.mp3 …
```

```json
{
  "version": 1,
  "model": "gemini-3.8-flash-tts",
  "style": "Clear, calm Korean alert announcer. Slightly fast pace. No extra words.",
  "voices": [{"id": "Kore", "label": "Kore", "gender": "여"}],
  "files": {"Kore": {"솔 야누스 10초 전": "Kore/3f2a1c9b0d4e.mp3"}}
}
```

예상 크기 [추정]: 문구 50개 × 1.5초 × 6KB/s ≈ 목소리 하나 0.5MB, 6개 3MB.

## 6. 앱 재생 (`src/app/voice.js`)

- 켜질 때 `import.meta.env.BASE_URL + 'voice/manifest.json'`을 읽는다(하위 경로 배포에서도 맞게). 없거나 깨졌으면 모든 문구를 브라우저 음성으로 하고 소리 설정에 이유를 보인다.
- 고른 목소리: `ui.voiceName`(`maple-web-timer-ui`). 기본 `'Kore'`. `'browser'`면 브라우저 기본 음성. manifest에 없는 목소리 이름이면 기본값.
- 오디오를 켤 때(`unlockAudio`)와 목소리를 바꿀 때, 고른 목소리의 파일만 받아 미리 푼다(`Map<text, AudioBuffer>`). 다른 목소리 파일은 받지 않는다.
- `speak(text)`: 음성 꺼짐·8초 중복 막기는 지금 그대로 먼저 본다. 그 문구의 풀어 둔 음성이 있으면 경고음 시간줄(`beepEnd`) 뒤에 이어서 재생하고 `beepEnd`를 늘린다(마스터 출력 → 음량 0~200%). 없으면(목록에 없음·아직 받는 중·풀기 실패) 지금의 브라우저 음성.
- `playDefault`는 경고음 길이만큼 기다렸다 `speak`를 부르던 것을, Gemini 음성일 때는 곧바로 시간줄에 예약한다(경고음과 겹치지 않음).

## 7. 화면 (소리 설정)

- "음성" 선택 칸: Kore (기본) · Zephyr · Leda · Sulafat · Charon · Puck · 브라우저 기본. 이름 옆에 (여)/(남).
- "듣기" 버튼: "솔 야누스 10초 전"을 고른 목소리로 재생(없으면 브라우저 음성).
- 안내 한 줄: `Gemini 음성 N개 · 브라우저 음성 M개` (지금 설정의 문구 목록 기준). M>0이면 "설정을 바꿔서 없는 문구는 브라우저 음성으로 나와요".
- 설정 백업: `ui.voiceName`을 백업 허용 목록에 넣는다(`/^[A-Za-z]{1,32}$/` 또는 `'browser'`).

## 8. 시험

- node: `voicePhrases` 기본 설정의 정확한 목록, 묶기 켬(두 순서 모두), 이름·초를 바꾼 설정, 사냥 멈춤 2·4·6분, 수동 프리셋 문구가 `manualText`와 같음. 실제 알림 경로의 문구(`reqFor`가 쓰는 `def.msg`)가 목록 안에 있는지.
- node: `voice-lib` 요청 본문, 응답 오디오 꺼내기(문서의 응답 모양), WAV 헤더 풀기, manifest 합치기·건너뛰기.
- 브라우저: 작은 시험용 manifest와 음성 파일을 넣고 → 목록에 있는 문구는 `speechSynthesis.speak`를 부르지 않고 오디오로 재생, 없는 문구는 브라우저 음성, 목소리 바꾸기 저장·새로고침 유지, "브라우저 기본"이면 항상 브라우저 음성, manifest가 없으면 모두 브라우저 음성.
- 실제 생성: 첫 호출에서 요청 모양을 확인한다. 문서와 다르면 그 자리에서 고치고 이 문서에 적는다.

## 9. 순서

1. `voice-phrases.js`와 시험.
2. `voice-lib.mjs`·`voice-gen.mjs`와 시험, `--dry-run`으로 문구 목록 확인.
3. 사용자가 `.env.gemini`를 넣은 뒤 한 문구로 실제 호출 확인 → 전체 생성(목소리 6개).
4. `voice.js` 재생 연결, 소리 설정 화면, 백업 허용 목록, 시험.
5. PRODUCT.md 갱신(외부 API는 개발 때만 쓰고 앱은 여전히 서버 없이 동작).
