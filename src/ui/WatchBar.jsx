// 감시 상태줄: 연결 상태, 대상 요약, 안내, 수동 타이머 요약, 소리 잠김, 마지막 확인
import { Fragment } from 'react';
import { useBus } from './useBus.js';
import { src, stopWatching } from '../app/capture.js';
import { manualStripText, manualWake, soundLocked } from '../app/manual.js';
import { startRegister, startRegisterQueue } from '../app/register.js';
import { targetById } from '../app/store.js';
import { beatText, note, stripItems, toggleStripOpen, watchStatus } from '../app/watch.js';
import { reloadForUpdate, versionState } from '../app/version.js';

// 상태줄 항목 하나. 연결 뒤 다음에 할 일(등록)이 주된 버튼이 되도록 primary로 강조
function StripItem({ it }) {
  if (it.type === 'btn') return <button className="primary" onClick={() => startRegister(targetById(it.id))}>{it.label}</button>;
  if (it.type === 'reregAll') return <button className="primary" onClick={() => startRegisterQueue(it.ids)}>{it.label}</button>;
  if (it.type === 'okGroup') return <button aria-expanded={it.open ? 'true' : 'false'} onClick={toggleStripOpen}>{it.label}</button>;
  return <span className={it.cls || undefined}>{it.text}</span>;
}

export function WatchBar() {
  useBus();
  const w = watchStatus(), items = stripItems();
  return (
    <div id="watch" className={'watch ' + w.cls}>
      <span className="dot" id="watchDot" aria-hidden="true" />
      {/* 바뀐 글자만 DOM에 쓰이므로 화면 낭독기가 매 틱 읽지 않는다 */}
      <div className="live" role="status" aria-live="polite">
        <b id="watchState">{w.state}</b>
        {' '}
        <span id="watchTargets" className="targets">
          {items.map((it, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="sep" aria-hidden="true">·</span>}
              <StripItem it={it} />
            </Fragment>
          ))}
        </span>
        {' '}
        <span id="watchNote" className={'note' + (note.kind === 'info' ? ' info' : '')}>{note.text}</span>
      </div>
      {/* role=timer라 화면 낭독기가 매번 읽지 않는다 */}
      <span id="watchManual" className="sub" role="timer">{manualStripText(Date.now())}</span>
      {' '}
      <span id="soundLock" hidden={!soundLocked()}>
        <span className="note">소리가 꺼져 있어요</span>
        {' '}
        <button id="soundLockBtn" type="button" onClick={manualWake}>소리 켜기</button>
      </span>
      <div className="end">
        {/* 새 배포가 있으면 감시 중에도 조용히 안내(소리 없음). 새로고침은 사용자가 누를 때만 */}
        <span id="verNote" hidden={!versionState.found}>
          <span className="note info">새 버전이 있어요</span>
          {' '}
          <button id="btnReload" type="button" onClick={reloadForUpdate}>새로고침</button>
        </span>
        <span id="watchBeat" className="sub">{beatText()}</span>
        {' '}
        <button id="btnStop" type="button" hidden={!src} onClick={stopWatching}>{src && src.type === 'image' ? '테스트 끝내기' : '감시 끝내기'}</button>
      </div>
    </div>
  );
}
