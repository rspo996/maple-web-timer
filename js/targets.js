const DEFS=[
  {id:'sol',name:'솔 야누스',kind:'buff',areaLabel:'버프창 영역',iconLabel:'솔 야누스 아이콘',threshold:0.75,
   presets:PRESET_ICONS.sol},
  {id:'booster',name:'부스터',kind:'countdown',areaLabel:'남은시간 타이머 주변',iconLabel:'“◷ 남은시간” 글자',threshold:0.7,
   presetArea:f=>({x:Math.round(f.w*0.2),y:0,w:Math.round(f.w*0.6),h:Math.round(f.h*0.3)}), presetScales:[0.8,1,1.25,1.5],
   presets:PRESET_ICONS.booster},
  {id:'rune',name:'룬',kind:'rune',areaLabel:'미니맵 영역',iconLabel:'룬 아이콘',threshold:0.8},
];
const STORE='maple-web-timer-v1';
let cfgs={};
function loadLegacyStore(){
  try{ cfgs=JSON.parse(localStorage.getItem(STORE)||'{}'); }catch(e){}
for(const d of DEFS){ cfgs[d.id]=Object.assign({enabled:true,area:null,tpl:null,frameW:0,frameH:0,threshold:d.threshold,durationSec:null,leadSec:10,repeatSec:60},cfgs[d.id]||{},{kind:d.kind}); }
if(cfgs.booster && cfgs.booster.ver!==2){ Object.assign(cfgs.booster,{ver:2,tpl:null,area:null,frameW:0,frameH:0,threshold:0.7}); }
}
function save(){ try{ localStorage.setItem(STORE,JSON.stringify(cfgs)); }catch(e){} }
const needsRegister=d=>!cfgs[d.id].tpl && !d.presets;
const needsReregister=d=>{ const c=cfgs[d.id]; return !!(c.tpl && c.frameW && frame.w && (c.frameW!==frame.w||c.frameH!==frame.h)); };

/* ===== 감지 대상 모델 (묶음 1 스펙 3절). 위의 DEFS·cfgs는 Task E1에서 이 모델로 바뀔 때까지 남아 있는 예전 코드 ===== */
const TARGET_MAX=12;
// 내장 3개: 기존 id를 그대로 써서 내 소리 슬롯 키(sol.pre 등)를 이전 없이 이어간다
const BUILTIN={
  sol:{kind:'buff',name:'솔 야누스',preset:'sol',threshold:0.75},
  booster:{kind:'countdown',name:'부스터',preset:'booster',threshold:0.7},
  rune:{kind:'rune',name:'룬',preset:null,threshold:0.8},
};
// 내장 기본 아이콘 세트. 저장하지 않는 코드 상수. 아이콘 이미지는 preset-data.js
const PRESETS={
  sol:{scales:[1,1.25,1.5], area:f=>({x:Math.round(f.w*0.35),y:0,w:Math.round(f.w*0.65),h:Math.round(f.h*0.3)}), get icons(){ return PRESET_ICONS.sol; }},
  booster:{scales:[0.8,1,1.25,1.5], area:f=>({x:Math.round(f.w*0.2),y:0,w:Math.round(f.w*0.6),h:Math.round(f.h*0.3)}), get icons(){ return PRESET_ICONS.booster; }},
};
