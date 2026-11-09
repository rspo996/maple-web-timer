/* 순수 계산 쪽(core)이 화면·캡처 쪽(app)을 직접 import하지 않도록, 부팅 때 실제 구현을 꽂는 자리.
   꽂기 전(node 시험)에는 아무것도 하지 않거나 null을 돌려준다 */
export const hooks={
  setNote:()=>{},                 // 상태줄 안내 (text, kind)
  onTargetChanged:()=>{},         // 종류가 학습 같은 효과로 대상 값을 바꿨을 때 (t, key)
  detectTemplate:()=>null,        // 템플릿 매칭 (t, source) → {score,pos}|null
  readTimer:()=>null,             // 부스터 숫자 읽기 (source, pos)
  loadTpl:()=>null,               // 템플릿 이미지 준비 (tpl) → 준비 안 됐으면 null
  hasSource:()=>true,             // 게임 화면이 연결돼 있는지
};
export function setHooks(h){ Object.assign(hooks,h); }
