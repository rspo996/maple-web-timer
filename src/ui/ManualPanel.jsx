// 수동 타이머 창: 프리셋 칩, 만들기 폼, 사냥·회수 반복, 프리셋 편집, 타이머 카드. 엔진은 app/manual.js
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useBus } from './useBus.js';
import { NativeInput, Gauge } from './parts.jsx';
import { unlockAudio } from '../app/alerts.js';
import {
  durLabel, manual, manualAct, manualClearDone, manualCreateCountdown, manualCreateRoutine, manualDelArm, manualDelete,
  manualDeletePreset, manualFull, manualMsg, manualNote, manualSaveEdit, manualSavePreset, manualSetPre, manualStartPreset, manualView,
} from '../app/manual.js';
import { MANUAL_LABEL_MAX, MANUAL_PRE_MAX, manualAdjust, manualFmt, manualPause, manualReset, manualStart } from '../core/manual-core.js';

const ADJUST = [['-1분', -60000, '1분 빼기'], ['-10초', -10000, '10초 빼기'], ['+10초', 10000, '10초 더하기'], ['+1분', 60000, '1분 더하기']];
// 타이머 객체는 바뀔 때마다 새로 만들어진다. 바뀌면 고치기 폼의 입력값을 새로 채우려고 객체마다 번호를 붙인다
const revs = new WeakMap(); let revN = 0;
const rev = t => { if (!revs.has(t)) revs.set(t, ++revN); return revs.get(t); };

// 고치기: 이름·미리 알림은 언제든, 길이는 실행 중이 아닐 때만
function ManualEdit({ t, open, onSaved }) {
  const [err, setErr] = useState('');
  const routine = t.kind === 'routine';
  const submit = e => {
    e.preventDefault();
    const f = e.currentTarget, q = s => f.querySelector(s);
    const msg = manualSaveEdit(t.id, {
      label: q('[data-e=label]').value, preSec: q('[data-e=pre]').value,
      phases: t.phases.map((p, i) => ({ name: routine ? q(`[data-e=n${i}]`).value : null, dur: q(`[data-e=d${i}]`).value })),
    });
    if (msg) setErr(msg); else onSaved();
  };
  return (
    <form className="grid mt-edit" hidden={!open} onSubmit={submit}>
      <label>이름</label><span><input data-e="label" defaultValue={t.label} maxLength={MANUAL_LABEL_MAX} /></span>
      {t.phases.map((p, i) => {
        const lab = routine ? `구간 ${i + 1}` : '시간';
        return [
          <label key={'l' + i}>{lab}</label>,
          <span key={'s' + i}>
            {routine && <><input data-e={'n' + i} defaultValue={p.name} maxLength={MANUAL_LABEL_MAX} aria-label={`${lab} 이름`} />{' '}</>}
            <input data-e={'d' + i} defaultValue={manualFmt(p.sec * 1000)} size={7} disabled={t.status === 'running'} aria-label={`${lab} 길이(분:초)`} />
          </span>,
        ];
      })}
      <label>미리 알림</label><span><input data-e="pre" type="number" min={0} max={MANUAL_PRE_MAX} defaultValue={t.preSec} /></span>
      <span />
      <span className="row"><button>저장</button><span className="sub" role="alert">{err}</span></span>
    </form>
  );
}

function ManualCard({ t, now }) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef(null);
  const v = manualView(t, now);
  const act = fn => { setOpen(false); manualAct(t, fn); };
  const toggleEdit = () => {
    flushSync(() => setOpen(!open));
    if (!open) cardRef.current.querySelector('form input').focus();   // 열면 이름 칸으로
  };
  return (
    <div className="card mt" id={'manual-' + t.id} ref={cardRef}>
      <div className="mt-head">
        <b>{t.label}</b><span className="sub" data-s="phase">{v.phase}</span>
        <button type="button" aria-label={`${t.label} 고치기`} onClick={toggleEdit}>고치기</button>
      </div>
      <div className="mt-time" data-s="time">{v.time}</div>
      <Gauge g={v.gauge} />
      <div className="sub" data-s="info">{v.info}</div>
      <div className="row mt-btns">
        {t.status === 'done'
          ? <button type="button" onClick={() => { unlockAudio(); act(x => manualStart(x, Date.now())); }}>다시 시작</button>
          : <>
            <button type="button" onClick={() => { unlockAudio(); act(x => x.status === 'running' ? manualPause(x, Date.now()) : manualStart(x, Date.now())); }}>
              {t.status === 'running' ? '일시정지' : t.status === 'paused' ? '계속' : '시작'}
            </button>
            <button type="button" onClick={() => act(manualReset)}>처음부터</button>
            {ADJUST.map(([txt, ms, lb]) => <button key={txt} type="button" aria-label={`${t.label} ${lb}`} onClick={() => act(x => manualAdjust(x, ms, Date.now()))}>{txt}</button>)}
          </>}
        <button type="button" className="mt-del" aria-label={`${t.label} 삭제`} onClick={() => manualDelete(t.id)}>{manualDelArm[t.id] ? '정말 지울까요?' : '삭제'}</button>
      </div>
      <ManualEdit key={rev(t)} t={t} open={open} onSaved={() => setOpen(false)} />
    </div>
  );
}

export function ManualPanel() {
  useBus();
  const nameRef = useRef(null), durRef = useRef(null);
  const full = manualFull(), now = Date.now();
  const submitRoutine = e => {
    e.preventDefault();
    const el = e.currentTarget.elements;
    manualCreateRoutine({ n1: el.n1.value, d1: el.d1.value, n2: el.n2.value, d2: el.d2.value });
  };
  return (
    <section className="win" id="manual" aria-labelledby="manualTitle">
      <div className="wbar mhead">
        <h2 id="manualTitle">수동 타이머</h2>
        {' '}
        <button id="manualClearDone" type="button" hidden={!manual.timers.some(t => t.status === 'done')} onClick={manualClearDone}>끝난 것 모두 지우기</button>
      </div>
      <div className="wbody">
        <p className="sub mlead">화면을 보지 않고 직접 시작해요</p>
        <div className="row chips" id="manualPresets" role="group" aria-label="프리셋: 누르면 바로 시작">
          {manual.presets.map(p => <button key={p.id} type="button" title={`${p.label} 타이머 바로 시작`} disabled={full} onClick={() => manualStartPreset(p)}>{p.label}</button>)}
          <button type="button" disabled={full} onClick={() => { nameRef.current.focus(); manualNote('이름과 시간을 넣고 “프리셋으로 저장”을 누르세요'); }}>+ 내 프리셋</button>
        </div>
        <form id="manualForm" className="row" onSubmit={e => { e.preventDefault(); manualCreateCountdown(nameRef.current.value, durRef.current.value); }}>
          <input id="manualName" ref={nameRef} placeholder="이름(선택)" maxLength="20" aria-label="타이머 이름" />
          {' '}
          <input id="manualDur" ref={durRef} placeholder="분:초" size="7" aria-label="시간(분:초)" />
          {' '}
          <button className="primary" disabled={full}>시작</button>
          {' '}
          <button type="button" id="manualSavePreset" onClick={() => manualSavePreset(nameRef.current.value, durRef.current.value)}>프리셋으로 저장</button>
          {' '}
          <label className="sw">
            미리 알림
            {' '}
            {/* 새로 만드는 타이머에 쓴다 */}
            <NativeInput id="manualPre" type="number" min="0" max="120" aria-describedby="manualPreSfx"
              value={String(manual.prefs.preSec)} onCommit={el => { el.value = manualSetPre(el.value); }} />
            {' '}
            <span id="manualPreSfx" className="sub">초 전 (0=끔)</span>
          </label>
        </form>
        <details id="manualRoutineBox">
          <summary>사냥·회수 반복 만들기</summary>
          <form id="manualRoutine" className="grid" onSubmit={submitRoutine}>
            <label htmlFor="manualN1">구간 1</label>
            <span>
              <input id="manualN1" name="n1" defaultValue="사냥" maxLength="20" />
              {' '}
              <input name="d1" placeholder="분:초" size="7" aria-label="구간 1 길이(분:초)" />
            </span>
            {' '}
            <label htmlFor="manualN2">구간 2</label>
            <span>
              <input id="manualN2" name="n2" defaultValue="회수" maxLength="20" />
              {' '}
              <input name="d2" placeholder="분:초" size="7" aria-label="구간 2 길이(분:초)" />
            </span>
            {' '}
            <span />
            <span>
              <button className="primary" disabled={full}>시작</button>
              {' '}
              <span className="sub">멈출 때까지 번갈아 반복해요</span>
            </span>
          </form>
        </details>
        <details id="manualPresetEdit">
          <summary>프리셋 편집</summary>
          <div id="manualPresetList">
            {manual.presets.map(p => (
              <div key={p.id} className="row">
                <span>{`${p.label} · ${durLabel(p.sec)}`}</span>
                <button type="button" aria-label={`${p.label} 프리셋 지우기`} onClick={() => manualDeletePreset(p)}>지우기</button>
              </div>
            ))}
          </div>
        </details>
        <p id="manualNote" className="sub" role="status">{manualMsg.text}</p>
        <div id="manualList">
          {manual.timers.map(t => <ManualCard key={t.id} t={t} now={now} />)}
        </div>
      </div>
    </section>
  );
}
