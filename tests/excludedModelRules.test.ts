import { describe, expect, test } from 'bun:test';
import {
  getModelExclusionState,
  matchesExcludedRule,
  normalizeExcludedRules,
  parseExcludedRulesText,
} from '../src/components/excludedModels/excludedModelRules';
import { buildExcludedModels } from '../src/features/providers/useProviderWorkbench';

describe('excluded model rules', () => {
  test('normalizes without reordering and keeps the first case-insensitive spelling', () => {
    expect(normalizeExcludedRules([' GPT-5-* ', 'gpt-5-*', '', 'Claude-Opus'])).toEqual([
      'GPT-5-*',
      'Claude-Opus',
    ]);
    expect(parseExcludedRulesText('z-model\r\na-model\r\nZ-MODEL')).toEqual(['z-model', 'a-model']);
  });

  test('matches only * as a wildcard and reports exact-plus-wildcard overlap', () => {
    expect(matchesExcludedRule('GPT-4.*', 'gpt-4.1-mini')).toBeTrue();
    expect(matchesExcludedRule('gpt-4.*', 'gpt-4x1-mini')).toBeFalse();
    expect(matchesExcludedRule('gpt-5', 'gpt-5-codex')).toBeFalse();
    expect(getModelExclusionState(['gpt-5-mini', 'GPT-5-*'], 'gpt-5-mini')).toEqual({
      state: 'excluded',
      by: 'both',
      rule: 'GPT-5-*',
    });
  });
});

describe('provider disable-all exclusion invariant', () => {
  test('strips hand-written * and derives it only from the disabled switch', () => {
    expect(buildExcludedModels('a\n*\nb', true, 'gemini')).toEqual(['a', 'b', '*']);
    expect(buildExcludedModels('a\n*\nb', false, 'gemini')).toEqual(['a', 'b']);
    expect(buildExcludedModels('', true, 'gemini')).toEqual(['*']);
  });

  test('never writes the disable-all rule for OpenAI providers', () => {
    expect(buildExcludedModels('a\n*', true, 'openaiCompatibility')).toEqual(['a']);
    expect(buildExcludedModels('*', true, 'openaiCompatibility')).toBeUndefined();
  });
});
