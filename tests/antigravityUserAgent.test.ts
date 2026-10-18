import { describe, expect, test } from 'bun:test';
import { ANTIGRAVITY_REQUEST_HEADERS } from '@/utils/quota/constants';

describe('Antigravity hub User-Agent', () => {
  // 后端 internal/misc/antigravity_version.go 的注释写明：
  // "Cloud Code rejects newer models for clients below 2.23.0"，
  // 并把 antigravityFallbackVersion 固定为 2.23.0。低于此版本的 UA 会被拒。
  const FLOOR = [2, 23, 0];

  const parseVersion = (ua: string): number[] | null => {
    const match = ua.match(/antigravity\/hub\/(\d+)\.(\d+)\.(\d+)/);
    return match ? match.slice(1, 4).map(Number) : null;
  };

  const atLeast = (version: number[], floor: number[]): boolean => {
    for (let i = 0; i < floor.length; i += 1) {
      if (version[i] > floor[i]) return true;
      if (version[i] < floor[i]) return false;
    }
    return true;
  };

  test('reports the hub UA shape the backend sends', () => {
    expect(ANTIGRAVITY_REQUEST_HEADERS['User-Agent']).toMatch(
      /^antigravity\/hub\/\d+\.\d+\.\d+ \S+\/\S+$/
    );
  });

  test('meets the Cloud Code minimum client version of 2.23.0', () => {
    const version = parseVersion(ANTIGRAVITY_REQUEST_HEADERS['User-Agent']);
    expect(version).not.toBeNull();
    expect(atLeast(version!, FLOOR)).toBe(true);
  });
});
