// 화면 전체. 각 영역 컴포넌트는 엔진(src/app)의 상태를 읽어 그린다
import { Masthead } from './Masthead.jsx';
import { WatchBar } from './WatchBar.jsx';
import { TargetsPanel } from './TargetsPanel.jsx';
import { ManualPanel } from './ManualPanel.jsx';
import { StagePanel } from './StagePanel.jsx';
import { Help } from './Help.jsx';
import { SoundSettings } from './SoundSettings.jsx';
import { Backup } from './Backup.jsx';
import { Toast } from './Toast.jsx';
import { ImportDialog } from './ImportDialog.jsx';
import { UndoBar } from './UndoBar.jsx';

export function App() {
  return (
    <>
      <Masthead />
      <main>
        <WatchBar />
        <div className="col col-targets"><TargetsPanel /></div>
        <div className="col col-timers"><ManualPanel /></div>
        <div className="col col-screen">
          <StagePanel />
          <Help />
          <section id="sounds">
            <SoundSettings />
            <Backup />
          </section>
        </div>
      </main>
      <Toast />
      <ImportDialog />
      <UndoBar />
    </>
  );
}
