import { useSyncExternalStore } from 'react';
import { MINUTE_CLOCK } from '@/utils/time/sharedClock';

const noopSubscribe = () => () => {};
const FROZEN_NOW = Date.now();
const frozenSnapshot = () => FROZEN_NOW;

/** Current time refreshed once per minute from the app-wide shared clock. */
export function useNow(enabled = true): number {
  return useSyncExternalStore(
    enabled ? MINUTE_CLOCK.subscribe : noopSubscribe,
    enabled ? MINUTE_CLOCK.getSnapshot : frozenSnapshot,
    frozenSnapshot
  );
}
