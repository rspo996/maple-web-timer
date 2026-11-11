/* ----- 가까운 알림 묶기 계획 (순수) ----- */
// fired: 이번 틱에 미리 알림(group:'pre')이 난 대상 id. 곧 끝나는 다른 대상(남은 시간 <= leadSec+windowSec)을 같이 묶는다(당겨 알림).
// 돌려주는 값: members(묶일 대상 전부)와 pulled(그중 당겨온 것). 상태는 바꾸지 않는다 — 당겨온 대상의 pre 처리(markPre)는 부르는 쪽이 한다
export function planGroup(fired,targets,states,kinds,now,windowSec){
  if(!fired.length) return {members:[],pulled:[]};
  const members=[], pulled=[];
  targets.forEach((t,order)=>{
    const k=kinds[t.kind]; if(!k||!t.enabled) return;
    if(fired.includes(t.id)){ members.push({id:t.id,rank:t.p.leadSec||0,pulled:false,order}); return; }
    if(!k.events.some(e=>e.group==='pre')) return;                    // 룬 같은 종류는 묶지 않는다
    const st=states[t.id]; if(!st||st.alertedPre) return;
    const r=k.remainSec(t,st,now); if(r==null) return;                // 켜진 시점·지속시간을 모르면 null
    if(r<=(t.p.leadSec||0)+windowSec){ members.push({id:t.id,rank:r,pulled:true,order}); pulled.push({id:t.id,rank:r}); }
  });
  return {members,pulled};
}
// 묶인 알림의 음성·토스트 문구. 이름 뒤 조사를 쓰지 않고 초는 말하지 않는다(멤버마다 남은 시간이 달라 한 숫자가 틀림)
export function groupText(cls,items){
  const sorted=[...items].sort((a,b)=>a.rank-b.rank||a.order-b.order), tail=cls==='pre'?'곧 꺼져요':'꺼졌어요';
  return sorted.length>=4?`${sorted.length}개 ${tail}`:`${sorted.map(i=>i.label).join(', ')} ${tail}`;
}

/* ----- Alerts: 요청(AlertReq)을 받아 소리·화면 알림·카드 깜빡임으로 내보낸다. io를 바꿔 끼워 node에서 시험한다 -----
   AlertReq = {src:'target'|'manual'|'system'|'test', id, event, text, beep:string|null, slot:string|null, mode:'full'|'voice', group, flash:string|null}
   AlertRec = {at, src, ids[], event, text, grouped, custom}  (listen 구독자가 재생 직후 받음) */
export function createAlerts(io){
  const listeners=new Set(), queue={pre:[],gone:[]}; let cfg={on:false,windowSec:10}, goneSince=0;
  const withDefaults=r=>Object.assign({},r,{
    slot:r.slot===undefined?`${r.id}.${r.event}`:r.slot, flash:r.flash===undefined?`card-${r.id}`:r.flash,
    mode:r.mode||'full', beep:r.beep===undefined?null:r.beep, group:r.group||null });
  const notifyListeners=rec=>{ for(const fn of [...listeners]){ try{ fn(rec); }catch(e){ console.error(e); } } };
  function deliver(req){
    const custom=io.play(req);
    if(req.mode!=='voice'){ io.ui(req.text,req.id); if(req.flash) io.flash([req.flash]); }
    notifyListeners({at:io.now(),src:req.src,ids:[req.id],event:req.event,text:req.text,grouped:false,custom});
  }
  // 묶인 알림 하나: 묶음 슬롯(grp.pre/grp.gone)의 내 소리 또는 multi 비프 + 합친 음성. 멤버 개별 소리는 쓰지 않는다
  function deliverGroup(cls,items){
    const text=groupText(cls,items.map(r=>({label:r.group.label,rank:r.group.rank,order:r.group.order||0})));
    const custom=io.play({src:'target',id:'grp',event:cls,text,beep:'multi',slot:'grp.'+cls,mode:'full',flash:null,group:null});
    io.ui(text,'grp.'+cls); io.flash(items.map(r=>r.flash).filter(Boolean));
    notifyListeners({at:io.now(),src:'target',ids:items.map(r=>r.id),event:cls,text,grouped:true,custom});
  }
  function emit(cls){
    const items=queue[cls].splice(0);
    if(items.length===1) deliver(items[0]); else if(items.length>1) deliverGroup(cls,items);
  }
  return {
    fire(r){
      const req=withDefaults(r), q=req.group&&queue[req.group.cls];
      if(!q||!cfg.on||req.src==='test'||req.src==='system'){ deliver(req); return; }
      if(req.group.cls==='gone'&&!q.length) goneSince=io.now();
      q.push(req);
    },
    // tick() 끝에서만 부른다(setTimeout을 쓰지 않는 이유: 숨은 탭의 타이머 지연). pre는 바로, gone은 첫 건 뒤 2초
    flush(now){ if(queue.pre.length) emit('pre'); if(queue.gone.length&&now-goneSince>=2000) emit('gone'); },
    configure(c){ cfg={...cfg,...c}; if(!cfg.on) for(const q of Object.values(queue)) for(const r of q.splice(0)) deliver(r); },   // 끄면 대기 중인 것은 개별로
    drop(id){ for(const q of Object.values(queue)){ for(let i=q.length-1;i>=0;i--) if(q[i].id===id) q.splice(i,1); } },
    clear(){ queue.pre.length=0; queue.gone.length=0; },                    // 연결이 끊기거나 감시를 끝내면 대기 중인 알림은 버린다
    listen(fn){ listeners.add(fn); return ()=>listeners.delete(fn); },
  };
}
