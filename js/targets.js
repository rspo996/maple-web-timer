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
