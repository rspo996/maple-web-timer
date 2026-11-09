// 엔진 상태가 바뀔 때(bump) 이 컴포넌트를 다시 그린다. 상태는 엔진 모듈에서 직접 읽는다
import { useSyncExternalStore } from 'react';
import { subscribe, version } from '../app/bus.js';

export function useBus() { return useSyncExternalStore(subscribe, version); }
