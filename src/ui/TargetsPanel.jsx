// 감지 대상 목록 창: 대상 추가 메뉴와 카드. 엔진은 app/cards.js
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useBus } from './useBus.js';
import { NativeInput, Gauge } from './parts.jsx';
import { unlockAudio } from '../app/alerts.js';
import {
  BUFF_NAMES, addFromMenu, addFull, addMenu, cardView, commitField, deleteTarget, moveCard, renameCard, resetToPreset,
  runAction, setAddMenu, setEnabled, setThreshold, showAddName, toggleOpen,
} from '../app/cards.js';
import { testAlert } from '../app/detect-run.js';
import { startRegister } from '../app/register.js';
import { store } from '../app/store.js';
import { KINDS } from '../core/kinds.js';
import { BUILTIN, FULL_MSG, addBuff, addBuiltin, addKindTarget, missingBuiltins } from '../core/targets.js';

// 종류가 정한 입력 칸 하나(cardFields). 입력을 마치면 종류가 검사하고, 거절이면 원래 값으로 돌린다
function Field({ t, f, id }) {
  const num = f.type === 'number', fid = `${id}-${f.key}`;
  return (
    <>
      <label htmlFor={fid}>{f.label}</label>
      <span>
        <NativeInput id={fid} type={num ? 'number' : 'text'} data-f={f.key} min={num ? f.min : undefined} max={num ? f.max : undefined}
          placeholder={f.placeholder} aria-describedby={f.suffix ? `${fid}-sfx` : undefined}
          value={String(f.get(t))} onCommit={el => { el.value = commitField(t, f, el.value); }} />
        {f.suffix && <>{' '}<span className="sub" id={`${fid}-sfx`}>{f.suffix}</span></>}
        {f.hint && <>{' '}<span className="sub">{f.hint}</span></>}
      </span>
    </>
  );
}

function RenameForm({ t, open, onClose }) {
  const [err, setErr] = useState('');
  const ref = useRef(null);
  useLayoutEffect(() => { if (open) { ref.current.value = t.name; ref.current.select(); } else setErr(''); }, [open]);   // 열 때 지금 이름을 골라 둔다
  return (
    <form className="row" data-s="renameForm" hidden={!open} onSubmit={e => { e.preventDefault(); const m = renameCard(t, ref.current.value); if (m) setErr(m); else onClose(); }}>
      <input ref={ref} maxLength="12" aria-label="새 이름" />
      <button>저장</button>
      <button type="button" data-a="renameCancel" onClick={onClose}>취소</button>
      <span className="sub" role="alert" data-s="renameErr">{err}</span>
    </form>
  );
}

// 이 버전이 모르는 종류(미래 버전 데이터)는 지우지 않고 안내만
function UnknownCard({ t }) {
  return (
    <div className="card" id={'card-' + t.id}>
      <div className="top"><h2><span data-s="name">{t.name}</span></h2></div>
      <div className="sub">이 버전에서 지원하지 않는 종류예요</div>
      <div className="row manage" style={{ marginTop: 10 }}><button data-a="delete" onClick={() => deleteTarget(t)}>삭제</button></div>
    </div>
  );
}

function TargetCard({ t, idx, n, now }) {
  const [renaming, setRenaming] = useState(false);
  const v = cardView(t, now), k = v.k, id = 't-' + t.id, s = v.status;
  return (
    <div className="card" id={'card-' + t.id} data-open={v.open ? '1' : '0'}>
      <div className="top">
        <h2><img className="thumb" alt="" hidden={!v.thumb} src={v.thumb || undefined} /><span data-s="name">{t.name}</span></h2>
        {/* 접힌 카드의 한 줄 상태 */}
        <span className={'mini ' + s.cls} data-s="mini">{s.text}</span>
        <label className="sw"><input type="checkbox" data-k="enabled" checked={t.enabled} onChange={e => setEnabled(t, e.target.checked)} />{' '}사용</label>
        <button data-a="toggle" aria-expanded={v.open ? 'true' : 'false'} aria-controls={'body-' + t.id} aria-label={`${t.name} ${v.open ? '접기' : '펼치기'}`}
          onClick={() => toggleOpen(t)}>{v.open ? '접기 ▴' : '펼치기 ▾'}</button>
      </div>
      <Gauge g={v.gauge} />
      <div className="body" id={'body-' + t.id}>
        <div className={'status ' + s.cls} data-s="status">{s.text}</div>
        <div className="sub" data-s="sub">{s.sub}</div>
        <div className="grid">
          {k.cardFields(t).map(f => <Field key={f.key} t={t} f={f} id={id} />)}
          {k.usesThreshold && <>
            <label htmlFor={id + '-thr'}>기준값</label>
            <span className="row">
              <input id={id + '-thr'} type="range" min="0.4" max="0.98" step="0.01" data-k="threshold" style={{ flex: 1 }}
                value={t.threshold} onChange={e => setThreshold(t, e.target.value)} />
              {' '}
              <b data-s="thr">{t.threshold.toFixed(2)}</b>
            </span>
          </>}
          <span data-s="scoreLabel">{v.scoreLabel}</span><span className="score" data-s="score">{v.score}</span>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button data-a="register" onClick={() => startRegister(t)}>등록</button>
          <button data-a="test" onClick={() => { unlockAudio(); testAlert(t); }}>알림 테스트</button>
          {k.actions.map(a => <button key={a.key} data-act={a.key} hidden={v.hiddenActions[a.key]} onClick={() => runAction(t, a)}>{a.label}</button>)}
          {t.preset && <button data-a="reset" style={t.tpl ? undefined : { display: 'none' }} onClick={() => resetToPreset(t)}>기본 아이콘으로 되돌리기</button>}
        </div>
        <div className="row manage" style={{ marginTop: 10 }}>
          <button data-a="rename" onClick={() => setRenaming(true)}>이름 바꾸기</button>
          {/* 이름은 aria-label에만 넣는다 */}
          <button data-a="up" disabled={idx === 0} aria-label={`${t.name} 위로 옮기기`} onClick={() => moveCard(t, -1)}>위로</button>
          <button data-a="down" disabled={idx === n - 1} aria-label={`${t.name} 아래로 옮기기`} onClick={() => moveCard(t, 1)}>아래로</button>
          <button data-a="delete" onClick={() => deleteTarget(t)}>삭제</button>
        </div>
        <RenameForm t={t} open={renaming} onClose={() => setRenaming(false)} />
      </div>
    </div>
  );
}

// 대상 추가 메뉴. 기본 제공(지운 내장 대상) · 버프 직접 등록 · 다른 알림(종류별 개수 상한)
function AddMenu() {
  const nameRef = useRef(null);
  const miss = missingBuiltins(store.targets), kinds = Object.values(KINDS).filter(k => k.menuLabel);
  const btn = (text, fn, disabled) => <button key={text} type="button" disabled={disabled} onClick={fn}>{text}</button>;
  return (
    <div id="addMenu" hidden={!addMenu.open}>
      {addMenu.open && <>
        <div><b>기본 제공</b><div className="opts">
          {miss.length ? miss.map(id => btn(BUILTIN[id].name, () => addFromMenu(() => addBuiltin(store, id)))) : <span className="sub">모두 추가돼 있어요</span>}
        </div></div>
        <div><b>버프 직접 등록</b><div className="opts">
          {BUFF_NAMES.map(n => btn(n, () => addFromMenu(() => addBuff(store, n)), store.targets.some(t => t.name === n)))}
          {btn('이름 직접 입력…', () => { flushSync(showAddName); nameRef.current.focus(); })}
        </div></div>
        {kinds.length > 0 && <div><b>다른 알림</b><div className="opts">
          {kinds.map(k => btn(k.menuLabel, () => addFromMenu(() => addKindTarget(store, k.key)), store.targets.filter(t => t.kind === k.key).length >= k.maxInstances))}
        </div></div>}
        <form id="addName" hidden={!addMenu.nameForm} onSubmit={e => { e.preventDefault(); addFromMenu(() => addBuff(store, nameRef.current.value)); }}>
          <label className="sw">이름 <input ref={nameRef} maxLength="12" aria-label="새 버프 이름" /></label><button>추가</button>
        </form>
      </>}
    </div>
  );
}

export function TargetsPanel() {
  useBus();
  const full = addFull(), now = Date.now(), n = store.targets.length;
  const open = () => {
    if (addMenu.open) { setAddMenu(false); return; }
    setAddMenu(true);
    const b = document.querySelector('#addMenu button:not(:disabled)'); if (b) b.focus();
  };
  // 메뉴 밖을 누르거나 Esc면 닫는다
  useEffect(() => {
    const click = e => { if (addMenu.open && !e.target.closest('#addBar')) setAddMenu(false); };
    const key = e => { if (e.key === 'Escape' && addMenu.open) { setAddMenu(false); document.getElementById('btnAdd').focus(); } };
    document.addEventListener('click', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', click); document.removeEventListener('keydown', key); };
  }, []);
  return (
    <aside id="cards" className="win" aria-labelledby="subtitle">
      <h2 className="wbar">
        <span id="subtitle">{`감지 대상 ${n}개`}</span>
      </h2>
      <div className="wbody">
        <div id="addBar">
          <button id="btnAdd" type="button" aria-expanded={addMenu.open ? 'true' : 'false'} aria-controls="addMenu" disabled={full} onClick={open}>+ 대상 추가</button>
          {' '}
          <span id="addNote" className="sub" role="status">{full ? FULL_MSG : ''}</span>
          <AddMenu />
        </div>
        <div id="cardList">
          {store.targets.map((t, i) => KINDS[t.kind]
            ? <TargetCard key={t.id} t={t} idx={i} n={n} now={now} />
            : <UnknownCard key={t.id} t={t} />)}
        </div>
      </div>
    </aside>
  );
}
