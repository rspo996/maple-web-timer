// 알림 문구 토스트. 알림이 울리면 6초 보인다(엔진: app/alerts.js의 toast)
import { useBus } from './useBus.js';
import { toast } from '../app/alerts.js';

export function Toast() {
  useBus();
  return <div id="toast" role="alert" style={toast.on ? { display: 'block' } : undefined}>{toast.text}</div>;
}
