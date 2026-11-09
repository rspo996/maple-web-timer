# 설치기 쿨타임 알림 (묶음 4) 구현 계획

**목표:** 퀵슬롯 아이콘이 어두워지면 쓴 것으로, 다시 밝아지면 쿨타임 끝으로 보고 "다시 쓸 수 있어요"와(지속시간을 적었으면) "N초 뒤 사라져요"를 알린다(스펙 `2026-11-09-4-skill-cooldown-design.md`, 13·14·15절이 본문보다 우선). 새 대상 종류 `cooldown`.

**실행 방식:** 메인 세션에서 직접 구현(사용자 결정). 태스크마다 실패하는 시험 → 구현 → 시험 → 커밋.

## 파일

| 파일 | 책임 |
|---|---|
| `js/cooldown.js` (새) | 순수: `iconGain`(밝기 비 p20·p50), `classifyIcon`, `cdNewState`, `stepCooldown`, `calibrateCooldown`. 아래쪽: `registerKind('cooldown', …)`(아이콘 자리 매칭·밝기 측정, 보정 모으기) |
| `tests/cooldown.test.js` (새) | 순수 함수와 `KINDS.cooldown` |
| `tests/browser/cooldown.mjs` (새) | 가짜 화면의 아이콘을 어둡게·밝게 하며 등록·보정·pre·ready(정책)·짧은 어두움·안 보임·해상도 확인 |
| `tests/browser/fake-screen.js` | 아이콘 위에 검은 반투명을 덮는 `shade(name, alpha)` |
| `js/detect-run.js` | `loadTpl`이 같은 배율의 원본 회색값 `gray`도 보관(15-1) |
| `js/targets.js` | `normalizeTarget`이 종류의 `fixTarget(o)`를 부름, `addKindTarget`의 번호 이름(`numbered`)과 기본 기준값(`defaultThreshold`) |
| `js/alerts.js` | `SOUNDS.ready`(올라가는 두 음) |
| `index.html` | 스크립트 |

## 정한 것

1. **보정 결과:** 3프레임 중 가장 밝은 p50이 0.85 이상이면 거절(값 그대로, 경고), 0.8 이상 0.85 미만이면 적용하되 경고, 그 아래는 "구분할 수 있어요". `gainLo=min(0.65, 최대 p50×1.3)`, `nccDim=clamp(최소 ncc×0.8, 0.40, threshold−0.1)`, 최소 ncc가 0.4 미만이면 "아이콘을 못 찾았어요"(15-4, 3.3, 7).
2. **`ready` 무음:** 그 사용 주기에 `pre`가 울렸거나 당겨 알림으로 묶였으면(`alertedPre`) `ready`는 카드만 바꾼다(14).
3. **늦은 `pre`:** 끝 시각(`usedAt+지속시간`)이 이미 지났으면 울리지 않고, 그 주기의 `ready`는 울린다.
4. **`ready` 뒤에도 `usedAt`을 지우지 않는다.** 쿨타임이 지속시간보다 짧은 스킬도 마지막 사용 기준 `pre`가 한 번 울린다(6절). `remainSec`(당겨 알림용)는 어두운 동안만 값을 준다(15-6).
5. **기본 이름** `설치기 1`, `설치기 2`…, 기본 기준값 0.7.
6. **스크린샷 테스트 모드**에서는 상태·측정값만 보이고 알리지 않는다(7절).

## 태스크

1. **순수 함수:** `iconGain`·`classifyIcon`(고르게 0.4배 → ncc>0.97·p50≈0.4·dim, 가운데 흰 숫자 → p50 거의 그대로, 다른 무늬 → unknown, 절반만 0.4배 → ready 아님), `stepCooldown`(dim 1프레임은 시작 아님·2프레임이면 usedAt=첫 dim 시각, pre 1번, 다시 쓰면 새 시각, ready 1번, 연결 때 dim이면 pre 없고 ready만, unknown 5초 뒤 ready 울림·30초면 조용히, unknown 90초 unread 1번, 늦은 pre 건너뜀, 3초 미만 어두움 무시, 지속시간 없으면 pre 없음, pre 울린 주기 ready 무음·pre 전에 밝아지면 울림·당겨진 주기 무음, 판정 사이 unknown은 세지도 지우지도 않음), `calibrateCooldown`.
2. **종류 정의와 공통 확장:** `KINDS.cooldown`(등록 한 번 `['icon']`, 검사: 어두운 아이콘·가장자리, 저장: 사방 8px 넓혀 프레임 안으로 자른 영역, `events` pre/ready/unread, `markPre`, `remainSec`, `status` 표 3.1, `scoreRow` 일치도·밝기, 동작 '쿨타임 중 찍기'·'방금 썼어요', `fixTarget`), `loadTpl`의 `gray`, `addKindTarget` 번호 이름·기본 기준값.
3. **화면 연결과 브라우저 시나리오.**
4. **최종 확인:** 모든 단위 시험과 묶음 1~3 시나리오.

## 손으로 볼 것

- 실제 퀵슬롯 아이콘의 쿨타임 모양(고르게 어두워지는지, 방사형 스윕인지), 밝기 비 실측(0.85·0.65 기본값), MP 부족 같은 쿨타임 아닌 어두움, 숨은 탭에서 `ready`가 울리는지(스펙 9절 끝·15-9).
