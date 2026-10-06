/* RAGJudge — BYOK LLM layer: answer generation + LLM-as-judge.
   Providers: OpenAI, Gemini, Groq, and any OpenAI-compatible custom endpoint.
   Keys live in this browser only. All network calls accept an injectable fetch. */
(function (root) {
  root.RAGJudge = root.RAGJudge || {};
  var T = root.RAGJudge;

  var KEY = 'ragjudge-byok-v1';
  var _mem = {};
  function readState() {
    try {
      if (typeof localStorage !== 'undefined')
        return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (e) {}
    return _mem;
  }
  function writeState(s) {
    try {
      if (typeof localStorage !== 'undefined') { localStorage.setItem(KEY, JSON.stringify(s)); return; }
    } catch (e) {}
    _mem = s;
  }
  function setKey(p, k) { var s = readState(); s.keys = s.keys || {}; if (k) s.keys[p] = k; else delete s.keys[p]; writeState(s); }
  function getKey(p) { var s = readState(); return (s.keys && s.keys[p]) || ''; }
  function hasKey(p) { return !!getKey(p); }
  function getCustom() { var s = readState(); return s.custom || {}; }
  function setCustom(c) { var s = readState(); s.custom = { baseUrl: String((c && c.baseUrl) || '').replace(/\/+$/, ''), model: String((c && c.model) || '') }; writeState(s); }

  var PROVIDERS = {
    openai: {
      label: 'OpenAI', model: 'gpt-4o-mini', placeholder: 'sk-…',
      buildRequest: function (key, system, user) {
        return {
          url: 'https://api.openai.com/v1/chat/completions',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: { model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            temperature: 0.3, response_format: { type: 'json_object' } }
        };
      },
      parseResponse: function (d) { try { return d.choices[0].message.content; } catch (e) { return null; } }
    },
    gemini: {
      label: 'Google Gemini', model: 'gemini-2.0-flash', placeholder: 'AIza…',
      buildRequest: function (key, system, user) {
        return {
          url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(key),
          headers: { 'Content-Type': 'application/json' },
          body: { systemInstruction: { parts: [{ text: system }] },
            contents: [{ parts: [{ text: user }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.3 } }
        };
      },
      parseResponse: function (d) {
        try { return d.candidates[0].content.parts.map(function (p) { return p.text; }).join(''); }
        catch (e) { return null; }
      }
    },
    groq: {
      label: 'Groq', model: 'llama-3.3-70b-versatile', placeholder: 'gsk_…',
      buildRequest: function (key, system, user) {
        return {
          url: 'https://api.groq.com/openai/v1/chat/completions',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: { model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            temperature: 0.3, response_format: { type: 'json_object' } }
        };
      },
      parseResponse: function (d) { try { return d.choices[0].message.content; } catch (e) { return null; } }
    },
    custom: {
      label: 'Custom (OpenAI-compatible)', model: '', placeholder: 'key (any value works for keyless local servers)',
      buildRequest: function (key, system, user, extra) {
        var base = String((extra && extra.baseUrl) || '').replace(/\/+$/, '');
        var url = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
        var headers = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = 'Bearer ' + key;
        return {
          url: url, headers: headers,
          body: { model: (extra && extra.model) || '',
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            temperature: 0.3 }
        };
      },
      parseResponse: function (d) { try { return d.choices[0].message.content; } catch (e) { return null; } }
    }
  };

  function defaultFetch() {
    if (typeof fetch !== 'undefined') return fetch;
    throw new Error('No fetch implementation available.');
  }

  async function chat(system, user, opts) {
    opts = opts || {};
    var provider = opts.provider || 'openai';
    if (!PROVIDERS[provider]) return null;
    var key = opts.key || getKey(provider);
    if (!key) return null;
    var impl;
    try { impl = opts.fetchImpl || defaultFetch(); } catch (e) { return null; }
    var req = PROVIDERS[provider].buildRequest(key, system, user, opts);
    var res;
    try { res = await impl(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) }); }
    catch (e) { return null; }
    if (!res.ok) return null;
    var data;
    try { data = await res.json(); } catch (e) { return null; }
    return PROVIDERS[provider].parseResponse(data);
  }

  /* Find the outermost JSON object/array in possibly prose-wrapped text. */
  function extractJson(text) {
    if (!text || typeof text !== 'string') return null;
    var t = text.replace(/```(?:json)?/gi, '').trim();
    var start = t.search(/[\[{]/);
    if (start === -1) return null;
    var end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (end <= start) return null;
    try { return JSON.parse(t.slice(start, end + 1)); } catch (e) { return null; }
  }

  var ANSWER_SYSTEM = 'You answer questions using ONLY the provided context chunks. ' +
    'Cite every factual claim with the chunk number like [1], [2]. ' +
    'If the context does not contain the answer, say so plainly. Be concise.';

  async function generateAnswerLLM(question, contextBlock, opts) {
    var text = await chat(ANSWER_SYSTEM,
      'Context:\n' + contextBlock + '\n\nQuestion: ' + question, opts);
    return text ? text.trim() : null;
  }

  var JUDGE_SYSTEM = 'You are a strict RAG faithfulness evaluator. Given a question, an ' +
    'answer, and the retrieved context chunks, rate how well the context SUPPORTS the ' +
    'answer on a 1-5 scale: 1 = hallucinated/contradicted, 3 = partially supported, ' +
    '5 = every claim grounded in the context. Return ONLY JSON: ' +
    '{"score": <1-5 integer>, "rationale": "<one or two sentences>"}';

  function validateJudge(obj) {
    if (!obj || typeof obj !== 'object') return null;
    var s = obj.score;
    if (typeof s !== 'number' || !(s >= 1 && s <= 5)) return null;
    return { score: Math.round(s), rationale: String(obj.rationale || '').slice(0, 500) };
  }

  async function judgeFaithfulness(question, answer, contextBlock, opts) {
    var text = await chat(JUDGE_SYSTEM,
      'Question: ' + question + '\n\nAnswer: ' + answer +
      '\n\nContext:\n' + contextBlock, opts);
    if (!text) return null;
    return validateJudge(extractJson(text));
  }

  T.LLM_PROVIDERS = PROVIDERS;
  T.llmChat = chat;
  T.llmExtractJson = extractJson;
  T.generateAnswerLLM = generateAnswerLLM;
  T.judgeFaithfulness = judgeFaithfulness;
  T.validateJudge = validateJudge;
  T.llmSetKey = setKey; T.llmGetKey = getKey; T.llmHasKey = hasKey;
  T.llmGetCustom = getCustom; T.llmSetCustom = setCustom;
})(typeof window !== 'undefined' ? window : globalThis);
