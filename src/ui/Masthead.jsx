// 헤더: 이름과 연결·테스트·알림·작은 창·음량 도구
import { useRef } from 'react';
import { useBus } from './useBus.js';
import { NativeInput } from './parts.jsx';
import { commitVolume, previewVolume, setVoice, vol, voiceOn } from '../app/audio.js';
import { connect, connectBtn, loadImageFile, notifyBtn, requestNotify } from '../app/capture.js';
import { pipIsOpen, pipSupported, togglePip } from '../app/pip.js';

export function Masthead() {
  useBus();
  const fileRef = useRef(null), pip = pipSupported();
  return (
    <header className="masthead">
      <div className="brand">
        <svg className="crest" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
          <rect x="1.5" y="1.5" width="37" height="37" rx="4" className="crest-slot" />
          <path className="crest-bell" d="M20 7.5c-1.3 0-2.2 1-2.2 2.1v.9c-4.3 1.1-7 4.8-7 9.4v5.4l-2.6 3.1c-.6.7-.1 1.8.8 1.8h22c.9 0 1.4-1.1.8-1.8l-2.6-3.1v-5.4c0-4.6-2.7-8.3-7-9.4v-.9c0-1.1-.9-2.1-2.2-2.1z" />
          <path className="crest-shine" d="M15.2 15.6c.9-1.9 2.4-3.1 4-3.5" />
          <circle className="crest-clapper" cx="20" cy="33" r="2.6" />
        </svg>
        <h1>메이플 재획 알리미</h1>
      </div>
      <div className="tools">
        <button id="btnConnect" type="button" className={connectBtn.primary ? 'primary' : ''} onClick={connect}>{connectBtn.label}</button>
        {' '}
        <button id="btnImage" type="button" onClick={() => fileRef.current.click()}>스크린샷으로 테스트</button>
        {' '}
        <input id="fileImage" ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) loadImageFile(f); }} />
        {' '}
        <button id="btnNotify" type="button" onClick={requestNotify}>{notifyBtn.label}</button>
        {' '}
        <button id="btnPip" type="button" disabled={!pip} onClick={togglePip}>{pipIsOpen() ? '작은 창 닫기' : '작은 창 열기'}</button>
        {' '}
        <span id="pipNote" className="sub" hidden={pip}>이 브라우저는 작은 창을 지원하지 않아요</span>
        <div className="soundbox">
          <label className="sw">
            음량
            {' '}
            {/* 드래그 중에는 소리 없이 크기만 바꾸고, 손을 떼면 저장하고 확인음 한 번 */}
            <NativeInput id="vol" type="range" min="0" max="200" step="5" list="volTicks" aria-describedby="volNote"
              value={String(vol.pct)} onInput={el => previewVolume(el.value)} onCommit={el => commitVolume(el.value)} />
            {' '}
            <b id="volPct" className="vol-pct">{vol.pct + '%'}</b>
          </label>
          <datalist id="volTicks">
            <option value="100" />
          </datalist>
          <label className="sw">
            <NativeInput id="voice" type="checkbox" checked={voiceOn()} onCommit={el => setVoice(el.checked)} />
            {' '}
            음성
          </label>
        </div>
        <span id="volNote" className="sub" hidden={vol.pct <= 100}>음성은 100%까지만 커져요. 소리가 갈라지면 줄여 주세요</span>
      </div>
    </header>
  );
}
