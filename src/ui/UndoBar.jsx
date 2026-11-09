// 대상 삭제 되돌리기 막대. 지운 대상이 10초 안에 남아 있는 동안 보이고, 마지막으로 지운 것을 되돌린다
import { useBus } from './useBus.js';
import { trash, undoDelete, undoState } from '../app/cards.js';

export function UndoBar() {
  useBus();
  return (
    <div id="undoBar" role="status" hidden={!trash.size}>
      <span id="undoText">{undoState.text}</span>
      {' '}
      <button id="undoBtn" type="button" onClick={() => undoDelete(undoState.id)}>되돌리기</button>
    </div>
  );
}
