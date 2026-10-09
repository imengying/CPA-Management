import { describe, expect, test } from 'bun:test';
import {
  buildClaudeMessagesEndpoint,
  buildCodexResponsesEndpoint,
  buildGeminiGenerateContentEndpoint,
  buildInteractionsEndpoint,
  buildOpenAIChatCompletionsEndpoint,
} from '../src/components/providers/utils';

/**
 * These builders back the provider connectivity probe: the form passes whatever
 * the user typed as `baseUrl` and the probe posts to the derived endpoint.
 *
 * The probe must not paper over a management URL. The saved `baseUrl` is the
 * user's own text (see `useProviderWorkbench`), so stripping a `/v8/management`
 * suffix here would let the probe succeed against an address the backend will
 * later call verbatim — reporting "connected" for a configuration that fails at
 * request time. The same reasoning drives the "does not silently adapt a legacy
 * management URL" case in `managementConnection.test.ts`.
 */

describe('provider connectivity endpoints', () => {
  test('appends the OpenAI chat completions path to a bare host', () => {
    expect(buildOpenAIChatCompletionsEndpoint('https://api.openai.com')).toBe(
      'https://api.openai.com/chat/completions'
    );
    expect(buildOpenAIChatCompletionsEndpoint('https://api.openai.com/')).toBe(
      'https://api.openai.com/chat/completions'
    );
  });

  test('keeps an OpenAI base URL that already points at chat completions', () => {
    expect(buildOpenAIChatCompletionsEndpoint('https://api.openai.com/chat/completions')).toBe(
      'https://api.openai.com/chat/completions'
    );
  });

  test('assumes http for a host without a scheme', () => {
    expect(buildOpenAIChatCompletionsEndpoint('proxy.example:8317')).toBe(
      'http://proxy.example:8317/chat/completions'
    );
  });

  test('normalizes the Codex responses endpoint from every supported base form', () => {
    const expected = 'https://api.openai.com/v1/responses';
    for (const base of [
      'https://api.openai.com',
      'https://api.openai.com/v1',
      'https://api.openai.com/v1/models',
      'https://api.openai.com/v1/responses',
    ]) {
      expect(buildCodexResponsesEndpoint(base)).toBe(expected);
    }
  });

  test('normalizes the Claude messages endpoint and falls back to the public host', () => {
    expect(buildClaudeMessagesEndpoint('')).toBe('https://api.anthropic.com/v1/messages');
    for (const base of [
      'https://api.anthropic.com',
      'https://api.anthropic.com/v1',
      'https://api.anthropic.com/v1/messages',
    ]) {
      expect(buildClaudeMessagesEndpoint(base)).toBe('https://api.anthropic.com/v1/messages');
    }
  });

  test('builds a Gemini generateContent endpoint with an encoded model resource', () => {
    expect(buildGeminiGenerateContentEndpoint('', 'gemini-3-pro')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro:generateContent'
    );
    expect(
      buildGeminiGenerateContentEndpoint('https://example.com/v1beta', 'models/gemini-3-pro')
    ).toBe('https://example.com/v1beta/models/gemini-3-pro:generateContent');
  });

  test('builds the native interactions endpoint', () => {
    expect(buildInteractionsEndpoint('https://example.com')).toBe(
      'https://example.com/v1beta/interactions'
    );
  });

  test('never rewrites a management URL, so a bad base URL fails the probe', () => {
    expect(buildOpenAIChatCompletionsEndpoint('https://proxy.example/v8/management')).toBe(
      'https://proxy.example/v8/management/chat/completions'
    );
    expect(buildCodexResponsesEndpoint('https://proxy.example/v0/management')).toBe(
      'https://proxy.example/v0/management/v1/responses'
    );
  });
});
