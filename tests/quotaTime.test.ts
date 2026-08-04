import { describe, expect, test } from 'bun:test';
import {
  buildResetDisplay,
  formatRelativeInstant,
  relativeTimeParts,
} from '../src/utils/quota/relativeTime';
import { createSharedClock } from '../src/utils/time/sharedClock';
import { formatUtcOffsetLabel } from '../src/utils/time/timezone';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '../src/utils/time/durations';

describe('quota relative time', () => {
  const now = Date.UTC(2026, 7, 4, 0, 0);

  test('uses the coarsest useful unit without overstating remaining time', () => {
    expect(relativeTimeParts(now + 2 * DAY_MS + HOUR_MS, now)).toEqual({
      value: 2,
      unit: 'day',
    });
    expect(relativeTimeParts(now + 59 * MINUTE_MS, now)).toEqual({
      value: 59,
      unit: 'minute',
    });
    expect(relativeTimeParts(now - 3 * HOUR_MS, now)).toEqual({
      value: -3,
      unit: 'hour',
    });
  });

  test('formats a localized countdown and falls back to an instant-only display', () => {
    expect(formatRelativeInstant(now + 2 * HOUR_MS, now, 'en')).toBe('in 2 hours');
    expect(buildResetDisplay('08/04, 10:00', null, now, 'en')).toEqual({
      absolute: '08/04, 10:00',
      relative: null,
    });
    expect(buildResetDisplay('-', null, now, 'en')).toBeNull();
  });
});

describe('quota timezone labels', () => {
  test('formats whole-hour and fractional UTC offsets', () => {
    expect(formatUtcOffsetLabel(0)).toBe('GMT');
    expect(formatUtcOffsetLabel(480)).toBe('GMT+8');
    expect(formatUtcOffsetLabel(-300)).toBe('GMT-5');
    expect(formatUtcOffsetLabel(330)).toBe('GMT+5:30');
  });
});

describe('shared minute clock', () => {
  test('shares one timer and clears it after the final unsubscribe', () => {
    let now = 100;
    let tick: (() => void) | null = null;
    const timer = Symbol('timer');
    const cleared: unknown[] = [];
    let notifications = 0;
    const clock = createSharedClock({
      now: () => now,
      setTimer: (callback) => {
        tick = callback;
        return timer;
      },
      clearTimer: (value) => cleared.push(value),
    });

    const unsubscribeFirst = clock.subscribe(() => {
      notifications += 1;
    });
    const unsubscribeSecond = clock.subscribe(() => {
      notifications += 1;
    });
    expect(clock.subscriberCount()).toBe(2);

    now = 200;
    (tick as (() => void) | null)?.();
    expect(clock.getSnapshot()).toBe(200);
    expect(notifications).toBe(2);

    unsubscribeFirst();
    expect(cleared).toEqual([]);
    unsubscribeSecond();
    expect(cleared).toEqual([timer]);
    expect(clock.subscriberCount()).toBe(0);
  });
});
