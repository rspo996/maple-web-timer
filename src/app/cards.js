/* ----- 감지 대상 카드의 엔진 쪽: 카드에 보일 값 계산과 대상 조작(켜기·기준값·입력 칸·펼침·이름·순서·추가·삭제).
   화면은 ui/TargetsPanel.jsx. 입력 칸은 KINDS[kind].cardFields로 정한다 ----- */
import {Alerts} from './alerts.js';
import {bump} from './bus.js';
import {frame,src,viewCtx} from './capture.js';
import {stateOf,states} from './detect-run.js';
import {saveUi,ui} from './prefs.js';
import {clearRegister,reg,startRegister} from './register.js';
import {customSounds,deleteSoundKeys,rebuildSounds,renderSounds} from './sounds.js';
import {saveTargets,store} from './store.js';
import {renderWatch,setNote} from './ui-watch.js';
import {newState} from '../core/detect-core.js';
import {KINDS,cardStatus} from '../core/kinds.js';
import {FULL_MSG,PRESETS,TARGET_MAX,deleteConfirmText,insertTargetAt,moveTarget,ownedSlotKeys,renameTarget} from '../core/targets.js';

// 종류가 학습 같은 효과로 값을 바꿨을 때(applyEffect) 저장하고 입력 칸을 맞춘다(입력 칸은 저장된 값을 따라 그린다)
export function onTargetChanged(){ saveTargets(); bump(); }
// 펼침 상태: 사용자가 정한 값(ui.open)이 우선. 정한 적 없으면 등록 필요·다시 등록 필요 대상만 펼친다(알림으로 카드가 움직이지 않게 접은 것은 자동으로 펼치지 않음)
export function needsAttention(t){ const k=KINDS[t.kind]; return !!k&&(!k.isRegistered(t)||(!!src&&k.needsReregister(t,frame))); }
export function isOpen(t){ return ui.open&&t.id in ui.open ? !!ui.open[t.id] : needsAttention(t); }
export function toggleOpen(t){ ui.open=ui.open||{}; ui.open[t.id]=!isOpen(t); saveUi(); bump(); }

// 카드 한 장에 보일 값(상태 문구·일치도 줄·게이지·아이콘 등)
export function cardView(t,now){
  const k=KINDS[t.kind], st=stateOf(t.id);
  const thumb=k.thumb?k.thumb(t):t.tpl?t.tpl.url:(t.preset?PRESETS[t.preset].icons[0].url:'');
  const ms=st.ms==null?'':` · 감지 ${st.ms<10?st.ms.toFixed(1):Math.round(st.ms)} ms`;   // 이 대상의 감지에 든 시간(느린 대상을 찾는 용도)
  const sr=k.scoreRow?k.scoreRow(t,st,now):null;   // 종류별 측정값 줄(사냥 멈춤: 변화량)
  const score=sr?(src&&sr.text!=='–'?sr.text+ms:sr.text):src&&(t.tpl||t.preset)?st.score.toFixed(2)+(st.score>=t.threshold?' ✔':'')+ms:'–';
  return {k,st,thumb,status:cardStatus(t,st,now,viewCtx()),scoreLabel:sr?sr.label:'일치도',score,
    gauge:src&&t.enabled?k.gauge(t,st,now):null,open:isOpen(t),
    hiddenActions:Object.fromEntries(k.actions.filter(a=>a.visible).map(a=>[a.key,!a.visible(t,st)]))};   // 쉬는 중이면 쉬기 끝내기만 등
}

/* ----- 카드 조작 ----- */
export function setEnabled(t,on){ t.enabled=on; if(!on){ states[t.id]=newState(); Alerts.drop(t.id); } saveTargets(); renderWatch(); }   // 끄는 순간 상태를 새로 시작
export function setThreshold(t,v){ t.threshold=+v; saveTargets(); bump(); }
// 입력 칸 확정: 종류의 set이 검사한다. 거절이면 안내하고 원래 값으로. 돌려주는 값은 칸에 다시 쓸 글자
export function commitField(t,f,raw){
  const r=f.set(t,raw)||{}; if(r.msg) setNote(r.msg);
  if(!r.revert) saveTargets();
  bump(); return String(f.get(t));
}
export function runAction(t,a){ a.run(t,stateOf(t.id),Date.now()); renderWatch(); }
export function resetToPreset(t){ t.tpl=null; t.area=null; t.frameW=t.frameH=0; saveTargets(); states[t.id]=newState(); setNote(`${t.name} 기본 아이콘으로 되돌렸어요`,'info'); }
// 이름 바꾸기. 거절이면 이유 문구, 바꿨으면 null
export function renameCard(t,raw){ const r=renameTarget(store,t.id,raw); if(!r.ok) return r.msg; saveTargets(); onTargetsChanged(); return null; }
export function moveCard(t,delta){ if(moveTarget(store,t.id,delta)>=0){ saveTargets(); onTargetsChanged(); } }
// 목록이 바뀐 뒤 화면을 다시 맞춘다: 카드, 소리 설정 목록, 상태줄
export function onTargetsChanged(){ if(store.targets.length>=TARGET_MAX) addMenu.open=false; rebuildSounds(); renderWatch(); }

/* ----- 대상 추가 메뉴 (순수 부분은 core/targets.js의 addBuiltin·addBuff·addKindTarget) ----- */
export const BUFF_NAMES=['유니온의 힘','유니온의 부','재물 획득의 비약','경험치 쿠폰'];   // 이름만 채워 주는 후보. 지속시간 등은 채우지 않는다
export const addMenu={open:false,nameForm:false};   // 메뉴가 열렸는지, "이름 직접 입력…" 칸을 보이는지
export const addFull=()=>store.targets.length>=TARGET_MAX;
export function setAddMenu(open){ addMenu.open=open&&!addFull(); addMenu.nameForm=false; bump(); }
export function showAddName(){ addMenu.nameForm=true; bump(); }
export function addFromMenu(make){
  const r=make(); if(!r.ok){ setNote(r.msg); return; }
  const t=r.target; ui.open=ui.open||{}; ui.open[t.id]=true; saveUi();   // 새 대상은 펼쳐 둔다
  addMenu.open=false; saveTargets(); onTargetsChanged();
  if(!KINDS[t.kind].isRegistered(t)){
    if(src) startRegister(t,{fresh:true});     // 첫 등록을 취소하면 이 대상은 자동으로 지워진다
    else setNote(`${t.name} 등록 필요 · 게임 화면을 연결한 뒤 등록할 수 있어요`);
  }
}

/* ----- 제거 ----- */
// 확인·되돌리기 없이 바로 뺀다(첫 등록 취소용). 사용자가 누르는 삭제는 deleteTarget
export function removeTargetNow(t){
  const i=store.targets.indexOf(t); if(i<0) return -1;
  if(reg&&reg.t===t) clearRegister();
  store.targets.splice(i,1); delete states[t.id]; Alerts.drop(t.id);
  saveTargets(); onTargetsChanged(); return i;
}
/* 삭제: 확인 → 바로 뺌 → 10초 되돌리기. 내 소리 파일은 10초 뒤에 지운다(그 사이 탭이 닫히면 다음 로드의 고아 정리가 지움) */
export const UNDO_MS=10000, trash=new Map();   // id → {t, index, sounds:Map(slot→소리), timer}
export const undoState={id:null,text:''};       // 되돌리기 막대(ui/UndoBar.jsx)는 마지막으로 지운 대상을 되돌린다. 지운 것이 남아 있는 동안 보인다
export function deleteTarget(t){
  const keys=ownedSlotKeys([...customSounds.keys()],t.id);
  if(!confirm(deleteConfirmText(t.name,keys.length))) return;
  const sounds=new Map(keys.map(k=>[k,customSounds.get(k)])); keys.forEach(k=>customSounds.delete(k));
  const index=removeTargetNow(t);           // 등록 중이면 취소하고, 목록·소리 설정·상태줄을 다시 그림
  const e={t,index,sounds,timer:setTimeout(()=>finalizeDelete(t.id),UNDO_MS)}; trash.set(t.id,e);
  undoState.id=t.id; undoState.text=`"${t.name}" 지웠어요 ·`; bump(); document.getElementById('undoBtn').focus();
}
export function finalizeDelete(id){
  const e=trash.get(id); if(!e) return; trash.delete(id); deleteSoundKeys([...e.sounds.keys()]);
  if(!trash.size) bump();
}
export function undoDelete(id){
  const e=trash.get(id); if(!e) return;
  if(store.targets.length>=TARGET_MAX){ setNote(FULL_MSG+' · 다른 대상을 지우고 되돌려 주세요'); return; }
  clearTimeout(e.timer); trash.delete(id);
  insertTargetAt(store,e.t,e.index); states[e.t.id]=newState(); e.sounds.forEach((v,k)=>customSounds.set(k,v));
  saveTargets(); onTargetsChanged(); renderSounds();
}
