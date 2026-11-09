/* ===== 설정 백업 (묶음 5): 설정 전체를 JSON 파일 하나로 내보내고 불러온다. 서버로 보내지 않는다.
   위쪽은 순수 함수(node 시험), 아래쪽은 화면과 적용(localStorage 먼저 → IndexedDB 한 트랜잭션 → 새로고침) ===== */
import {KINDS} from './kinds.js';
import {manualImport} from './manual-core.js';
import {migrateV1,normalizeStore} from './targets.js';
import {clampVolumePct} from './util.js';
export const BACKUP_SCHEMA='maple-web-timer-backup', BACKUP_VERSION=1;
export const BACKUP_MAX_BYTES=50*1024*1024;            // 불러올 파일 상한(검토 10)
export const BACKUP_SOUND_MAX=5*1024*1024, BACKUP_TPL_MAX=500*1024;
export const B64_RE=/^[A-Za-z0-9+/]+={0,2}$/;
// 큰 배열도 호출 스택이 넘치지 않게 32KB씩 나눠 바꾼다
export function bytesToBase64(u8){ let s=''; for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); return btoa(s); }
export function base64ToBytes(b64){ const s=atob(b64), u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; }
export function base64Size(b64){ const pad=b64.endsWith('==')?2:b64.endsWith('=')?1:0; return Math.floor(b64.length*3/4)-pad; }
export const pad2=n=>String(n).padStart(2,'0');
export function backupFileName(d){ return `maple-web-timer-backup-${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.json`; }
export function isoLocal(d){ const o=-d.getTimezoneOffset(), s=o>=0?'+':'-', a=Math.abs(o);
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${s}${pad2(Math.floor(a/60))}:${pad2(a%60)}`; }
// parts: {targets: v2 Store, manualTimers: manualExport 결과, ui: {volumePct, voice, pip}, sounds: {slot: {name, dur, mime, base64}}}. null인 것은 넣지 않는다
export function buildBackup(parts,now){
  const includes=[], data={};
  for(const k of ['targets','manualTimers','ui','sounds']) if(parts[k]!=null){ includes.push(k); data[k]=parts[k]; }
  return {schema:BACKUP_SCHEMA,version:BACKUP_VERSION,exportedAt:isoLocal(now),includes,data};
}
// 봉투 검사와 버전 이전(지금은 v1뿐이라 항등)
export function migrateBackup(obj){
  if(!obj||typeof obj!=='object'||Array.isArray(obj)) return {ok:false,msg:'이 파일은 설정 파일이 아닌 것 같아요'};
  if(obj.schema!==BACKUP_SCHEMA) return {ok:false,msg:'메이플 재획 알리미에서 내보낸 파일이 아니에요'};
  if(!Number.isInteger(obj.version)||obj.version<1) return {ok:false,msg:'이 파일은 설정 파일이 아닌 것 같아요'};
  if(obj.version>BACKUP_VERSION) return {ok:false,msg:'더 새 버전에서 만든 파일이라 불러올 수 없어요'};
  return {ok:true,obj};
}
export const validTpl=tp=>!!tp&&typeof tp.url==='string'&&tp.url.startsWith('data:image/png;base64,')&&tp.url.length<=BACKUP_TPL_MAX&&[tp.w,tp.h].every(v=>Number.isInteger(v)&&v>=4&&v<=512);
export const backupClamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,Math.round(v)));
/* 그룹별로 검사해 {ok, errors[], warnings[], groups:{targets?, manualTimers?, sounds?, ui?}, counts}. 깨진 항목은 그 항목만 건너뛰고 경고,
   그룹 전체가 깨졌으면 그 그룹을 건너뛴다. 대상은 normalizeStore, 수동 타이머는 manualImport(실행 상태 버림)를 거친다 */
export function validateBackup(obj){
  const fail=msg=>({ok:false,errors:[msg],warnings:[],groups:{},counts:{}});
  const m=migrateBackup(obj); if(!m.ok) return fail(m.msg);
  const data=obj.data; if(!data||typeof data!=='object'||Array.isArray(data)) return fail('이 파일에 설정이 들어 있지 않아요');
  const inc=new Set(Array.isArray(obj.includes)?obj.includes:[]), warnings=[], groups={}, counts={};
  if(inc.has('targets')&&data.targets&&typeof data.targets==='object'){
    let raw=data.targets;
    if(raw.ver!==2&&!Array.isArray(raw.targets)) raw=migrateV1(raw);                 // v1 모양이면 먼저 옮긴다
    if(raw&&raw.ver===2&&Array.isArray(raw.targets)){
      const kept=[];
      for(const t of raw.targets){
        if(!t||typeof t!=='object') continue;
        const name=typeof t.name==='string'&&t.name?t.name:String(t.id);
        if(!KINDS[t.kind]){ warnings.push(`${name}: 이 버전에서 지원하지 않는 종류라 건너뛰어요`); continue; }
        const c={...t};
        if(c.tpl!=null&&!validTpl(c.tpl)){ warnings.push(`${name}: 등록한 아이콘이 잘못돼서 다시 등록해야 해요`); Object.assign(c,{tpl:null,area:null,frameW:0,frameH:0}); }
        kept.push(c);
      }
      const st=normalizeStore({...raw,targets:kept}); groups.targets=st; counts.targets=st.targets.length;
    } else warnings.push('감지 대상 설정이 깨져 있어서 건너뛰어요');
  }
  if(inc.has('manualTimers')&&data.manualTimers!=null){
    const r=manualImport(data.manualTimers);
    if(r.ok){ groups.manualTimers=r.store; counts.timers=r.store.timers.length; } else warnings.push('수동 타이머 설정이 깨져 있어서 건너뛰어요');
  }
  if(inc.has('ui')&&data.ui&&typeof data.ui==='object'){                              // 허용 목록만(화면 상태 connectedOnce·open 등은 옮기지 않음)
    const u=data.ui, o={};
    if('volumePct' in u) o.volumePct=clampVolumePct(u.volumePct);
    if(typeof u.voice==='boolean') o.voice=u.voice;
    if(u.pip&&Number.isFinite(+u.pip.w)&&Number.isFinite(+u.pip.h)) o.pip={w:backupClamp(+u.pip.w,160,1200),h:backupClamp(+u.pip.h,60,1200)};
    groups.ui=o;
  }
  if(inc.has('sounds')&&data.sounds&&typeof data.sounds==='object'){
    const ids=new Set(groups.targets?groups.targets.targets.map(t=>t.id):[]), out={};
    for(const [k,v] of Object.entries(data.sounds)){
      const bad=()=>warnings.push(`${k} 소리는 불러올 수 없어서 기본 소리로 둬요`);
      if(!/^[A-Za-z0-9]+\.[A-Za-z0-9]+$/.test(k)||!v||typeof v!=='object'||typeof v.base64!=='string'||!B64_RE.test(v.base64)){ bad(); continue; }
      if(base64Size(v.base64)>BACKUP_SOUND_MAX){ bad(); continue; }
      const dur=+v.dur; if(!(dur>0&&dur<=10)){ bad(); continue; }
      const owner=k.split('.')[0];
      if(!/^(sys|grp|manual)$/.test(owner)&&!ids.has(owner)){ warnings.push(`${k} 소리는 쓰이는 대상이 없어 건너뛰어요`); continue; }   // 고아 정리가 지울 소리
      out[k]={name:typeof v.name==='string'?v.name.slice(0,120):'소리',dur,base64:v.base64};
    }
    groups.sounds=out; counts.sounds=Object.keys(out).length;
  }
  const ok=Object.keys(groups).length>0;
  return {ok,errors:ok?[]:['불러올 수 있는 설정이 없어요'],warnings,groups,counts};
}
