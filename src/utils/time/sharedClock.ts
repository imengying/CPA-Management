import { MINUTE_MS } from './durations';

export interface SharedClock {
  subscribe(listener: () => void): () => void;
  getSnapshot(): number;
}

export interface SharedClockOptions {
  intervalMs?: number;
  now?: () => number;
  setTimer?: (callback: () => void, intervalMs: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

export interface TestableSharedClock extends SharedClock {
  subscriberCount(): number;
}

export function createSharedClock(options: SharedClockOptions = {}): TestableSharedClock {
  const {
    intervalMs = MINUTE_MS,
    now = Date.now,
    setTimer = (callback, interval) => setInterval(callback, interval),
    clearTimer = (timer) => clearInterval(timer as ReturnType<typeof setInterval>),
  } = options;

  const listeners = new Set<() => void>();
  let current = now();
  let timer: unknown = null;

  const tick = () => {
    current = now();
    listeners.forEach((listener) => listener());
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (timer === null) {
        current = now();
        timer = setTimer(tick, intervalMs);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== null) {
          clearTimer(timer);
          timer = null;
        }
      };
    },
    getSnapshot: () => current,
    subscriberCount: () => listeners.size,
  };
}

export const MINUTE_CLOCK: SharedClock = createSharedClock();
