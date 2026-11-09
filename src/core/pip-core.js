/* ===== 작은 창(Document Picture-in-Picture, 묶음 5): 상태를 항상 위 창에 보이고, 알림이 울리면 그 행을 깜빡인다.
   읽기 전용이고 새 알림을 만들지 않는다. 깜빡임은 Alerts.listen으로 받은 알림에서만 시작한다(스펙 검토 6) ===== */
import {manualFmt,manualRemainMs} from './manual-core.js';
import {fmt} from './util.js';
export const PIP_FLASH_MS=5000;      // 깜빡임은 5초까지(접근성), 그 뒤에는 고정 색
export const PIP_HOLD_MS=30000;      // 알림 뒤 30초 동안 그 행을 강조
export const PIP_KIND={pre:'pre',gone:'gone',end:'gone',next1:'gone',next2:'gone',appear:'info',remind:'info',ready:'info',lost:'bad',stall:'bad',unread:'bad',alarm:'bad',busy:'bad'};
export const PIP_MARK={pre:'!',gone:'✕',info:'◆',bad:'⚠'};   // 색만으로 구분하지 않게 행 앞 기호
export function pipFlashKind(ev){ return PIP_KIND[ev]||null; }
// 대상 행(targetSnapshot)과 수동 타이머로 PIP 행을 만든다
export function buildPipRows(snapRows,timers,now){
  const rows=snapRows.map(r=>({id:r.id,label:r.name,
    stateText:!r.enabled?'꺼둠':r.remainSec!=null?(r.statusCls==='alert'?'곧 끝나요':'켜짐'):r.statusText,
    remainText:r.enabled&&r.remainSec!=null?fmt(r.remainSec):'',
    level:!r.enabled?'idle':['reg','rereg','unseen'].includes(r.stripState)?'warn':r.statusCls==='alert'?'alert':r.statusCls==='on'?'ok':'idle'}));
  for(const t of timers||[]){
    const rem=manualRemainMs(t,now);
    rows.push({id:t.id,label:t.kind==='routine'?`${t.label} · ${t.phases[t.idx].name}`:t.label,
      stateText:{running:'실행 중',paused:'멈춤',idle:'대기',done:'끝났어요'}[t.status],remainText:t.status==='done'?'':manualFmt(rem),
      level:t.status==='running'&&t.preSec&&rem<=t.preSec*1000?'warn':t.status==='running'?'ok':'idle'});
  }
  return rows;
}
// 알림 뒤 5초는 깜빡임, 30초까지는 같은 색 고정, 그 뒤에는 행의 원래 수준. 움직임 줄이기면 처음부터 고정
export function pipLevel(row,flash,now,reduce){
  if(flash){ const dt=now-flash.at;
    if(dt<PIP_FLASH_MS&&!reduce) return {cls:'flash-'+flash.kind,mark:PIP_MARK[flash.kind]};
    if(dt<PIP_HOLD_MS) return {cls:'hold-'+flash.kind,mark:PIP_MARK[flash.kind]}; }
  return {cls:'lv-'+row.level,mark:''};
}
