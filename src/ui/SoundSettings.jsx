// 알림 소리 바꾸기와 가까운 알림 묶기. 엔진은 app/sounds.js
import { Fragment, useRef } from 'react';
import { useBus } from './useBus.js';
import { unlockAudio } from '../app/alerts.js';
import { SLOTS, customSounds, groupValue, pickSound, previewSlot, resetSound, setGroupWindow, slotName, soundMsg } from '../app/sounds.js';

const GROUP_CHOICES = [[0, '끔'], [5, '5초'], [10, '10초'], [20, '20초']];

function SoundRow({ s }) {
  const fileRef = useRef(null);
  const c = customSounds.get(s.key), name = slotName(s);
  return (
    <div className="snd-row">
      <span>{s.label}</span>
      <span className={'snd-file sub' + (c ? ' custom' : '')} title={c ? c.name : ''}>{c ? `${c.name} · ${c.dur.toFixed(1)}초` : '기본 소리'}</span>
      <span className="row">
        <button data-a="pick" aria-label={`${name} 소리 파일 고르기`} onClick={() => { unlockAudio(); fileRef.current.click(); }}>파일 고르기</button>
        <button data-a="play" aria-label={`${name} 소리 듣기`} onClick={() => previewSlot(s)}>듣기</button>
        {/* 자리는 남겨 버튼 줄을 맞춘다 */}
        <button data-a="reset" aria-label={`${name} 기본 소리로 되돌리기`} style={c ? undefined : { visibility: 'hidden' }} disabled={!c} onClick={() => resetSound(s)}>기본으로</button>
      </span>
      <input ref={fileRef} type="file" accept=".wav,audio/*" hidden onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) pickSound(s, f); }} />
    </div>
  );
}

export function SoundSettings() {
  useBus();
  const groups = [];
  for (const s of SLOTS) { const g = groups[groups.length - 1]; if (g && g.name === s.group) g.slots.push(s); else groups.push({ name: s.group, slots: [s] }); }
  const gv = groupValue();
  return (
    <details id="soundsDetails" className="win">
      <summary className="wbar">
        알림 소리 바꾸기
        {' '}
        <span className="bar-sub">내 WAV 파일 쓰기</span>
      </summary>
      <div className="wbody">
        <p className="sub">파일을 고르면 그 알림은 기본 경고음과 음성 대신 고른 소리로 울려요. 10초 이하, 5MB 이하 소리만 쓸 수 있고, 파일은 이 브라우저에만 저장돼요.</p>
        <fieldset id="groupCtl">
          <legend>가까운 알림 묶기</legend>
          {GROUP_CHOICES.map(([v, label]) => (
            <Fragment key={v}>
              <label className="sw">
                <input type="radio" name="grp" value={String(v)} checked={gv === v} onChange={e => { if (e.target.checked) setGroupWindow(v); }} />
                {' '}
                {label}
              </label>
              {' '}
            </Fragment>
          ))}
          <p className="sub">켜면 한 버프의 미리 알림이 울릴 때, 곧(선택한 시간 안에) 끝나는 다른 버프도 같이 한 번에 알려요. 묶인 알림에서는 각 버프의 내 소리 대신 아래 “묶음 알림” 소리를 써요.</p>
        </fieldset>
        <div id="soundRows">
          {groups.map((g, i) => (
            <div key={i} className="snd-group">
              <b>{g.name}</b>
              {g.slots.map(s => <SoundRow key={s.key} s={s} />)}
            </div>
          ))}
        </div>
        <p id="soundNote" className={'sub' + (soundMsg.warn ? ' warn' : '')} role="status">{soundMsg.text}</p>
      </div>
    </details>
  );
}
