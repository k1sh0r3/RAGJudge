/* RAGJudge tests — BYOK LLM layer (adapters, judge validation, key store). */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/llm.js');
const T = globalThis.RAGJudge;

function stubFetch(body, ok) {
  return async function () {
    return { ok: ok !== false, json: async () => body };
  };
}

describe('provider adapters', () => {
  it('all four providers build shaped requests', () => {
    for (const p of ['openai', 'gemini', 'groq', 'custom']) {
      const req = T.LLM_PROVIDERS[p].buildRequest('K', 'sys', 'user',
        { baseUrl: 'https://x.test/v1', model: 'm' });
      assert.ok(req.url.startsWith('http'), p + ' url');
      assert.ok(req.body, p + ' body');
      assert.ok(req.headers['Content-Type'], p + ' content-type');
    }
    assert.ok(T.LLM_PROVIDERS.openai.buildRequest('k', 's', 'u').url.includes('openai.com'));
    assert.ok(T.LLM_PROVIDERS.gemini.buildRequest('k', 's', 'u').url.includes('googleapis.com'));
    assert.ok(T.LLM_PROVIDERS.groq.buildRequest('k', 's', 'u').url.includes('groq.com'));
  });
  it('custom provider normalizes the base URL', () => {
    const r1 = T.LLM_PROVIDERS.custom.buildRequest('k', 's', 'u', { baseUrl: 'https://x.test/v1/', model: 'm' });
    assert.equal(r1.url, 'https://x.test/v1/chat/completions');
    const r2 = T.LLM_PROVIDERS.custom.buildRequest('k', 's', 'u', { baseUrl: 'https://x.test/v1/chat/completions', model: 'm' });
    assert.equal(r2.url, 'https://x.test/v1/chat/completions');
    assert.equal(r1.body.model, 'm');
  });
  it('each provider parses its response shape', () => {
    const openai = { choices: [{ message: { content: 'hi' } }] };
    assert.equal(T.LLM_PROVIDERS.openai.parseResponse(openai), 'hi');
    assert.equal(T.LLM_PROVIDERS.groq.parseResponse(openai), 'hi');
    assert.equal(T.LLM_PROVIDERS.custom.parseResponse(openai), 'hi');
    assert.equal(
      T.LLM_PROVIDERS.gemini.parseResponse({ candidates: [{ content: { parts: [{ text: 'a' }] } }] }),
      'a');
    assert.equal(T.LLM_PROVIDERS.openai.parseResponse({}), null);
  });
});

describe('llmChat', () => {
  it('returns null without a key', async () => {
    assert.equal(await T.llmChat('s', 'u', { provider: 'openai', key: '' }), null);
  });
  it('returns null for an unknown provider', async () => {
    assert.equal(await T.llmChat('s', 'u', { provider: 'nope', key: 'k' }), null);
  });
  it('round-trips through stubbed fetch', async () => {
    const text = await T.llmChat('s', 'u', {
      provider: 'openai', key: 'sk-x',
      fetchImpl: stubFetch({ choices: [{ message: { content: 'answer!' } }] })
    });
    assert.equal(text, 'answer!');
  });
  it('returns null on http error', async () => {
    const text = await T.llmChat('s', 'u', {
      provider: 'groq', key: 'gsk-x', fetchImpl: stubFetch({}, false)
    });
    assert.equal(text, null);
  });
});

describe('judgeFaithfulness', () => {
  it('validates a good judge response', async () => {
    const j = await T.judgeFaithfulness('q', 'a', 'ctx', {
      provider: 'openai', key: 'k',
      fetchImpl: stubFetch({ choices: [{ message: { content: '{"score": 4, "rationale": "mostly grounded"}' } }] })
    });
    assert.deepEqual(j, { score: 4, rationale: 'mostly grounded' });
  });
  it('rejects out-of-range scores', () => {
    assert.equal(T.validateJudge({ score: 9, rationale: 'x' }), null);
    assert.equal(T.validateJudge({ score: 0 }), null);
    assert.equal(T.validateJudge(null), null);
    assert.equal(T.validateJudge({ rationale: 'no score' }), null);
  });
  it('returns null when the model call fails', async () => {
    const j = await T.judgeFaithfulness('q', 'a', 'ctx', {
      provider: 'openai', key: 'k', fetchImpl: stubFetch({}, false)
    });
    assert.equal(j, null);
  });
  it('extractJson tolerates fenced and prose-wrapped JSON', () => {
    assert.deepEqual(T.llmExtractJson('```json\n{"score": 5}\n```'), { score: 5 });
    assert.equal(T.llmExtractJson('no json here'), null);
  });
});

describe('key store', () => {
  beforeEach(() => { T.llmSetKey('openai', ''); T.llmSetCustom({ baseUrl: '', model: '' }); });
  it('stores keys and custom config', () => {
    T.llmSetKey('openai', 'sk-x');
    assert.equal(T.llmGetKey('openai'), 'sk-x');
    assert.ok(T.llmHasKey('openai'));
    T.llmSetCustom({ baseUrl: 'https://x.test/v1/', model: 'm' });
    assert.equal(T.llmGetCustom().baseUrl, 'https://x.test/v1');
    T.llmSetKey('openai', '');
    assert.ok(!T.llmHasKey('openai'));
  });
});
