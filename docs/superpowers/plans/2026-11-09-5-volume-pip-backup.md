# 볼륨 증폭 · PIP 깜빡임 창 · 설정 백업 (묶음 5) 구현 계획

**목표:** 알림 소리를 200%까지 키우고, 작은 항상 위 창(Document PiP)에 상태를 보이며 알림 때 깜빡이고, 설정 전체를 JSON 파일로 내보내고 불러온다(스펙 `2026-11-09-5-volume-pip-backup-design.md`. "맞춘 결과"·"사용자 결정"·"검토 반영"이 본문보다 우선).

**실행 방식:** 메인 세션에서 직접 구현(사용자 결정). 태스크마다 실패하는 시험 → 구현 → 시험 → 커밋.

## 파일

| 파일 | 책임 |
|---|---|
| `js/util.js` | 순수 `clampVolumePct`·`volumeToGain`·`ttsVolume`, 불러오기 중 저장을 막는 `importing` 플래그(`saveUi`가 지킴) |
| `js/audio.js` (새) | 마스터 체인(`Gain`, 100% 초과일 때만 `DynamicsCompressor`), 음량 슬라이더 0~200%·눈금·숫자·보조 문구·확인음, `ui.volumePct`·`ui.voice` 저장, `audioInit` |
| `js/pip.js` (새) | 순수 `pipFlashKind`·`buildPipRows`·`pipLevel`. 창 열기·닫기·갱신·깜빡임(`Alerts.listen`), `pipInit`·`pipUpdate` |
| `js/backup.js` (새) | 순수 `bytesToBase64`·`base64ToBytes`·`base64Size`·`backupFileName`·`buildBackup`·`migrateBackup`·`validateBackup`. 내보내기·불러오기 화면과 적용(`localStorage` 먼저 → IndexedDB 한 트랜잭션 → `reload`), `backupInit` |
| `js/alerts.js`, `js/sounds.js` | 비프·내 소리의 개별 음량 곱셈을 걷어내고(마스터에서 한 번), 음성은 `ttsVolume` |
| `js/targets.js`, `js/manual-ui.js` | 저장이 `importing` 중이면 쓰지 않음, `targetSnapshot`에 `statusCls` |
| `js/detect-run.js` | `tick` 끝에서 `pipUpdate(now)` |
| `index.html`, `css/app.css` | 슬라이더, `작은 창 열기` 버튼, 백업 영역, 불러오기 확인 창(`<dialog>`), 설명서 한 줄 |

## 정한 것

1. **확인음:** 슬라이더 `change`에서 `unlockAudio()` 뒤 `beep('buff')` 한 번(스펙의 `sol`은 묶음 1에서 `buff`로 이름이 바뀜).
2. **PIP 행:** 대상은 `targetSnapshot` 행(이름 · 상태 문구 · 남은 시간), 수동 타이머는 이름(루틴은 구간) · 실행 중/멈춤/대기/끝났어요 · 남은 시간. 맨 위 한 줄은 `watchStatus()`의 상태.
3. **깜빡임:** `Alerts.listen`으로 받은 알림의 `ids` 행만 5초 깜빡이고, 그 뒤 30초 동안 같은 색으로 고정한 다음 원래 상태로 돌아간다. `sys` 알림은 맨 위 줄. 이벤트→종류: `pre`→미리 알림(호박), `gone`·`end`·`next1`·`next2`→꺼짐(빨강), `appear`·`remind`·`ready`→알림(파랑), `lost`·`stall`·`unread`·`alarm`·`busy`→문제(회색 줄무늬), `back`→맨 위 줄 강조 해제. 행 앞 기호 `!` `✕` `◆` `⚠`. 상태(룬 있음·사냥 멈춤·연결 끊김)는 깜빡이지 않고 고정 강조(검토 6). 움직임 줄이기면 깜빡이지 않는다.
4. **백업 그룹:** `감지 대상과 내 소리`(하나로), `수동 타이머`, `음량·화면 설정` 세 개(검토 1). `ui`는 `volumePct`·`voice`·`pip`만(검토 11).
5. **시험에서 PiP 창:** 브라우저 시나리오는 실제 OS 창을 열지 않도록 `documentPictureInPicture`를 같은 문서의 숨긴 `iframe` 창으로 바꿔 끼워 확인한다. 실제 PiP 창은 손으로 확인한다.
6. **소리 길이 확인:** 불러올 때 `OfflineAudioContext.decodeAudioData`로 10초 이하인지 본다(사용자 조작 없이도 동작).

## 태스크

1. **볼륨:** 순수 함수 시험(`-1→0`, `250→200`, `'abc'→80`, `80.4→80`, `null→80`, 게인·음성 0/80/100/200). 브라우저: 슬라이더 0~200·기본 80·`80%`, 100 초과 보조 문구, 새로고침 뒤 유지, 음성 `u.volume` 150%에서 1, 체인(100% 이하 Gain만, 초과면 압축기), 확인음.
2. **PIP:** 순수 `buildPipRows`(켜짐·곧 끝남·꺼짐·못 찾음·등록 필요·꺼둠·룬·수동 타이머, 0개), `pipFlashKind`, `pipLevel`(5초 깜빡임 → 30초 고정 → 원래). 브라우저(가짜 PiP): 열기/닫기 버튼 문구, 행·남은 시간 갱신(탭이 숨겨진 것과 무관), 알림 때 그 행 깜빡임, 미지원이면 버튼 꺼짐과 문구.
3. **백업:** 순수 `bytesToBase64`↔`base64ToBytes` 왕복(0·작은·큰 배열), `buildBackup`→`validateBackup` 왕복, 오류(스키마·미래 버전·데이터 없음·JSON 아님), 항목 건너뜀(템플릿 URL·크기, 소리 base64·5MB·10초·쓰이지 않는 슬롯, 모르는 종류), `ui` 허용 목록, 수동 타이머 검사. 브라우저: 내보내기(파일명·내용), 감시 중 막기, 불러오기 확인 창 문구(개수·소리 지워짐·실행 중 타이머)와 적용 → 새로고침 뒤 대상·소리·타이머·음량 복원, IndexedDB 실패 시 되돌림.
4. **최종 확인:** 모든 단위 시험과 묶음 1~4 시나리오.

## 손으로 볼 것

- 실제 Document PiP 창(크기 기억, 창 X로 닫기, 게임 전체 화면에서 보이는지), 200%에서 소리가 갈라지는지(내 소리 WAV), 100%에서 이전과 같은 크기인지.
