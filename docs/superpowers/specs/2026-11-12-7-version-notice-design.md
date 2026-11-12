# 묶음 7: 버전 표시·새 버전 안내 설계

> 표기: **[확인]** = 직접 연 파일·명령 출력이 근거. **[문서]** = 공식 문서를 웹 검색으로 읽은 내용(원문 대조 전). **[추정]** = 확인하지 않은 판단.

## 1. 목적과 결정 (2026-11-12 사용자 결정)

- **문제:** 사냥 중에는 알리미 탭을 몇 시간씩 열어 둔다. 그동안 main에 고친 것을 올려도 열어 둔 탭은 옛 코드로 계속 돈다. 지금 탭이 어느 버전인지 화면에 없어서, "배포됐는지"를 번들 파일 이름을 비교해 알아냈다(2026-11-12).
- **결정:**
  - 헤더에 지금 버전을 보인다.
  - 새 배포를 알게 되면 **감시 중에도 상태줄에 조용히 안내**한다(소리·음성·브라우저 알림 없음).
  - 새로고침은 사용자가 버튼으로 한다. 화면 공유 중이면 공유가 끊긴다고 먼저 확인한다.
- **방식:** 빌드할 때 버전 값 하나를 만들어 앱 코드와 `version.json`에 같이 넣는다. 앱은 `version.json`을 가끔 받아 자기 값과 비교한다. index.html 비교(Vite 파일 이름 형식에 기댐)와 서비스 워커(캐시가 끼어드는 새 문제)는 쓰지 않는다.
- **범위 밖:**
  - 작은 창(PiP)에 안내를 띄우는 것
  - 소리로 알리는 것
  - 자동 새로고침
  - 실수로 닫기·새로고침 막기(`beforeunload`, 따로 정함)
  - 옛 탭과 새 탭을 동시에 열었을 때 옛 탭이 저장소를 옛 형식으로 덮어쓰는 문제(혼자 쓰는 도구라 한 탭만 연다고 본다)

## 2. 사실 확인

- **[확인] 호스팅과 배포:** Vercel이 main을 자동 배포한다(PRODUCT.md:35).
- **[확인] 응답 헤더:** 정적 파일 응답이 `cache-control: public, max-age=0, must-revalidate`다(2026-11-12 `curl -I`, index.html·`voice/manifest.json`).
- **[확인] 빌드 경로:** `vite.config.js`의 `base: './'`. 앱은 `import.meta.env.BASE_URL||'./'`에 파일 이름을 붙여 받는다(`src/app/voice.js:9`).
- **[확인] 확인 창 선례:** 대상 삭제가 브라우저 `confirm()`을 쓴다(`src/app/cards.js:81`). 같은 방식을 따른다.
- **[확인] 화면 공유 여부:** `src.type==='stream'`이면 화면 공유, `'image'`면 스크린샷 테스트다(`src/app/capture.js:16`).
- **[확인] 새로고침 뒤 수동 타이머:** 끝 시각을 저장해 새로고침 뒤에도 이어 간다(PRODUCT.md:79).
- **[확인] 새로고침 뒤 감지:** 화면 공유는 다시 연결해야 한다. 감지 상태(읽어 둔 남은 시간, 사냥 멈춤의 쉬기 등)는 메모리에만 있어 처음부터다(`src/app/detect-run.js:15`의 `states={}`). 대상 목록·화면 설정·수동 타이머는 바뀔 때마다 저장된다(`src/app/store.js:8`, `src/app/prefs.js:5`, `src/app/manual.js:13`).
- **[추정] 작은 창:** Document PiP 창은 부모 페이지가 새로고침되면 함께 닫힌다(`src/app/pip.js:58`은 그때의 `pagehide`만 처리한다).
- **[확인] 상태줄:** 오른쪽 끝 `.end`에 "마지막 확인"(`#watchBeat`)과 "감시 끝내기"가 있다(`src/ui/WatchBar.jsx:47`).
- **[확인] 헤더:** 제목 `<h1>`이 `.brand` 안에 있다(`src/ui/Masthead.jsx:15`).
- **[확인] 회색 글씨 클래스:** `.sub`(`src/styles/app.css:21`)와 `.watch .note.info`(`:135`)가 있다.
- **[확인] 탭이 숨었을 때:** 화면을 그리지 않고 미뤘다가 다시 보일 때 그린다(`src/app/bus.js`). 그래서 안내도 탭이 보일 때 그려진다.
- **[확인] 노드 테스트 범위:** `src/app`을 불러오지 않는다(`tests/*.test.js`). 순수 계산은 `src/core`에 둔다.
- **[문서] 커밋 값:** Vercel은 빌드 때 `VERCEL_GIT_COMMIT_SHA`(배포한 커밋)를 준다. 프로젝트 설정에서 시스템 환경 변수 노출이 켜져 있어야 하고, 해당이 없으면 빈 문자열이다.
- **[추정] 커밋 값이 비어 있을 가능성:** 이 프로젝트에서 실제로 값이 들어오는지는 첫 배포 뒤 확인한다(7절). 비어도 빌드 시각으로 버전이 갈리므로 기능은 동작한다.

## 3. 버전 값

- 빌드할 때 `vite.config.js`가 한 번 만든다: `{ id, sha, builtAt }`.
- `sha`:
  - `VERCEL_GIT_COMMIT_SHA`의 앞 7자리.
  - 없으면 `git rev-parse --short=7 HEAD`(로컬 빌드·`npm run preview`용).
  - 그것도 실패하면 `''`.
- `builtAt`: 빌드 시작 시각, ISO 문자열(UTC).
- `id`: `sha ? sha + '-' + builtAt : builtAt`.
  - 같은 커밋을 다시 배포해도 다른 버전이 된다(안내가 한 번 더 뜰 뿐 해는 없다).
- 넣는 곳:
  - 앱 코드: `define`으로 `__APP_VERSION__`(값은 `JSON.stringify(버전 객체)` 문자열로 넘긴다).
  - 빌드 결과: `dist/version.json`(빌드에서만 내보내는 작은 Vite 플러그인).
  - 두 곳은 같은 객체라 값이 어긋날 수 없다.
- 개발 서버(`npm run dev`, `dev:test`): `{ id: 'dev', sha: '', builtAt: '' }`. `version.json`은 없다.

## 4. 화면

**헤더 버전 표시**
- 제목 옆에 `.sub` 글씨로 `18202a6 · 11월 12일 12:25`를 보인다.
- 시각은 `builtAt`을 브라우저의 지역 시각으로 바꿔 `M월 D일 HH:mm`(24시간, 시·분은 두 자리)으로 직접 만든다(`Intl` 형식은 쓰지 않는다).
- `sha`가 비면 `11월 12일 12:25`만 보인다.
- 개발 서버면 `개발 중`이라고 보인다.

**상태줄 새 버전 안내**
- 새 버전을 알게 되면 `.end`의 "마지막 확인" 앞에 `새 버전이 있어요`(`.note.info`)와 `[새로고침]` 버튼을 보인다.
- 감시 중이든 아니든 같다. 한 번 뜨면 새로고침할 때까지 남는다.
- `[새로고침]`을 눌렀을 때:
  - **화면 공유 중**(`src.type==='stream'`)이면 먼저 `confirm("새로고침하면 화면 공유가 끊겨요. “게임 화면 연결”을 다시 눌러야 해요. 새로고침할까요?")`.
    - 취소하면 아무것도 하지 않는다(안내는 그대로).
    - 확인하면 `location.reload()`.
  - **그 밖**(연결 전·감시 끝냄·스크린샷 테스트)이면 바로 `location.reload()`.

## 5. 새 버전 확인

**언제 확인하나**
- 확인 계기는 둘이고, 둘 다 같은 `maybeCheck(gap)`을 지난다:
  - `setInterval` 5분마다 `maybeCheck(5분)`
  - 탭이 다시 보일 때(`visibilitychange`) `maybeCheck(60초)`
- `maybeCheck`는 `shouldCheck({ dev, hidden, found, now, lastAt, gap })`가 참일 때만 받는다. 거짓인 경우:
  - 개발 서버(`id==='dev'`)
  - 탭이 숨었을 때(안내는 탭이 보일 때만 의미가 있다)
  - 이미 새 버전을 찾았을 때
  - `now - lastAt < gap`일 때(탭을 자주 오가도 요청이 몰리지 않는다)
- `lastAt`은 앱을 연 시각에서 시작한다(처음 열었을 때는 방금 받은 코드라 확인하지 않는다). 받기를 시작할 때마다 성공·실패와 상관없이 갱신한다. 그래서 실패하면 다음 계기에 다시 시도한다.
- 자동 확인을 거는 일은 `startVersionWatch()`가 하고, `initVersion()`은 dev가 아닐 때만 그것을 부른다. dev에서도 `checkVersion()`·`startVersionWatch()`를 직접 부를 수는 있다(브라우저 시험용).

**한 번 확인할 때**
- `fetch(BASE_URL + 'version.json', { cache: 'no-store' })`로 받는다.
- 다음과 같으면 새 버전으로 본다:
  - 응답이 200이고 JSON 객체다.
  - `id`가 빈 문자열이 아닌 문자열이다.
  - 그 `id`가 `__APP_VERSION__.id`와 다르다.
- 실패하면 조용히 넘기고 다음 차례에 다시 받는다. 화면에 오류를 띄우지 않는다. 실패 종류:
  - 네트워크 오류
  - 200이 아닌 응답
  - JSON이 아님
  - 모양이 맞지 않음
- 받은 값이 이전 배포(Vercel에서 되돌린 경우)여도 "다르다"로 본다. 새로고침하면 지금 배포된 것을 받으므로 문구는 그대로 둔다.

## 6. 파일

| 파일 | 할 일 |
|---|---|
| `vite.config.js` | 3절의 버전 값, `define.__APP_VERSION__`, 빌드에서만 `version.json`을 내보내는 플러그인 |
| `src/core/version-core.js` (새) | 순수 함수: `versionLabel(v)`(표시 문구), `isOtherVersion(cur, remote)`(5절 판정), `shouldCheck({ dev, hidden, found, now, lastAt, gap })`(5절 시점). 값은 모두 인자로 받고 `__APP_VERSION__`을 직접 읽지 않는다(노드 시험이 그대로 불러올 수 있게) |
| `src/app/version.js` (새) | 상태 `versionState = { cur, found, lastAt }`, `initVersion()`, `startVersionWatch()`(5분 타이머·`visibilitychange` 연결), `checkVersion()`(받아서 판정, 찾으면 `bump()`), `reloadForUpdate()`(4절 확인 창). `__APP_VERSION__`이 없으면 `dev`로 본다. 개발 서버에서는 `dev-globals.js`가 export를 `window`에 올리는데, `bus.js`가 이미 `version`을 export하므로 `version`·`state`·`cur` 같은 짧은 이름은 export하지 않는다 |
| `src/app/boot.js` | `initVersion()` 호출 |
| `src/ui/Masthead.jsx` | 제목 옆 버전 표시 |
| `src/ui/WatchBar.jsx` | 새 버전 안내와 `[새로고침]` |
| `src/styles/app.css` | 필요하면 헤더 버전 글씨의 간격만(새 색·크기는 만들지 않고 `.sub`를 쓴다) |
| `tests/version.test.js` (새) | 7절 |
| `tests/browser/version.mjs` (새) | 7절 |
| `PRODUCT.md` | "감시 상태" 근처에 버전 표시·새 버전 안내 한 단락 |

## 7. 시험과 완료 기준

**`tests/version.test.js` (node)**
- `versionLabel`:
  - `sha`가 있을 때 `18202a6 · 11월 12일 12:25`.
  - `sha`가 없을 때 시각만.
  - `dev`일 때 `개발 중`.
  - 시각은 지역 시각 기준으로 만든 `Date`로 시험해 시간대에 기대지 않는다.
- `isOtherVersion`:
  - 같은 `id`면 아님.
  - 다른 `id`면 새 버전.
  - `null`·`{}`·`{id:''}`·`{id:3}`·문자열 응답이면 아님.
- `shouldCheck`:
  - `dev`면 늘 아님.
  - 숨었으면 아님.
  - 이미 찾았으면 아님.
  - `now - lastAt`이 `gap`보다 작으면 아님, `gap` 이상이면 확인(`gap` 5분·60초 각각).

**`tests/browser/version.mjs` (dev:test, ego-browser)**
- 시험은 `window.fetch`를 바꾸되 `version.json` 요청만 가로채고, 나머지 요청(음성 목록·파일 등)은 원래 `fetch`로 넘긴다. 가로챈 횟수를 센다.
- 헤더에 `개발 중`이 보인다.
- 가로챈 `version.json`이 `{ id: 'other' }`를 돌려주게 하고 `checkVersion()`을 부르면, 상태줄에 `새 버전이 있어요`와 `[새로고침]`이 보인다.
- 연결 경로: `startVersionWatch()`를 부르고 `versionState.lastAt`을 2분 전으로 돌린다. 그 뒤 `document.hidden`을 시험에서 바꿔 `visibilitychange`를 보낸다.
  - 숨긴 채 보내면 요청이 없다.
  - 보이게 해서 보내면 요청이 한 번 가고 안내가 뜬다.
- 같은 `id`를 돌려주면 안내가 없다.
- 가짜 화면 공유로 연결한 채 `[새로고침]`을 누르면 `confirm`이 4절 문구로 한 번 불리고, `false`를 돌려주면 새로고침되지 않는다. 시험은 `window.confirm`을 바꿔 문구를 기록한다.
- 연결 전에 누르면 새로고침된다. 주입해 둔 `window.__fake`가 사라진 것으로 확인한다.

**배포 뒤 확인 (완료 기준)**
- `npm test`, `npm run build`가 통과한다.
- 구현 첫 단계에서 빌드를 돌려 `dist/version.json`과 빌드된 JS 안의 `id`가 같은지 본다(`define`·`emitFile`이 Vite 8.3.6에서 생각대로 되는지 이때 확인).
- 배포한 뒤 확인한다:
  - `curl https://maple-web-timer.vercel.app/version.json`의 `sha`가 배포한 커밋 앞 7자리와 같고, 헤더 표시와 맞는다.
  - `curl -I`로 `version.json`의 캐시 헤더가 `max-age=0, must-revalidate`인지 본다(`vercel.json`이 없어 기본값이라고 본 것).
- `sha`가 비어 있으면 결과를 보고한다. 그때는 Vercel 설정의 시스템 환경 변수 노출을 켤지 사용자에게 묻고, 켜지 않아도 빌드 시각으로 동작한다.
- 실제 배포로 한 번 본다: 열어 둔 옛 탭에서, 탭이 보이는 상태면 5분 안에, 숨겨 둔 탭이면 탭으로 돌아올 때 안내가 뜬다.
