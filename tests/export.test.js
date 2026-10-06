/* RAGJudge tests — CSV + Markdown export shape. */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/text.js');
require('../assets/chunk.js');
require('../assets/retrieval.js');
require('../assets/metrics.js');
require('../assets/answer.js');
require('../assets/llm.js');
require('../assets/runner.js');
require('../assets/export.js');
require('../assets/sample-data.js');
const T = globalThis.RAGJudge;

function fakeOut() {
  return {
    results: [
      { rank: 1, config: { name: 'chunk256/k3/bm25', chunkSize: 256, overlap: 50, topK: 3, retrieval: 'bm25' },
        aggregates: { faithfulness: 0.9, citationP: 1, citationR: 0.5, relevance: 0.3, latencyMs: 12.5 },
        perQuestion: [
          { qid: 'q1', question: 'How long is the warranty?', reference: '2 years.',
            answer: 'The warranty lasts 2 years. [1]', faithfulness: 0.9,
            citationP: 1, citationR: 0.5, relevance: 0.3, latencyMs: 4.1, llmJudge: null }
        ] },
      { rank: 2, config: { name: 'chunk1024/k3/bm25', chunkSize: 1024, overlap: 50, topK: 3, retrieval: 'bm25' },
        aggregates: { faithfulness: 0.8, citationP: 0.5, citationR: 0.5, relevance: 0.25, latencyMs: 9.2 },
        perQuestion: [
          { qid: 'q1', question: 'How long is the warranty?', reference: '2 years.',
            answer: 'Two years of coverage. [1]', faithfulness: 0.8,
            citationP: 0.5, citationR: 0.5, relevance: 0.25, latencyMs: 3.9,
            llmJudge: { score: 4, rationale: 'mostly grounded' } }
        ] }
    ],
    meta: { ranAt: '2026-10-05T00:00:00Z', docs: 2, questions: 1, contestants: 2,
            answerMode: 'extractive', judgeMode: 'heuristic', embeddings: 'lexical-fallback' }
  };
}

describe('leaderboardCSV', () => {
  it('has the expected header and one row per config', () => {
    const csv = T.leaderboardCSV(fakeOut());
    const lines = csv.trim().split('\n');
    assert.equal(lines.length, 3);
    assert.ok(lines[0].startsWith('rank,config,chunk_size,overlap,top_k,retrieval,faithfulness'));
    assert.ok(lines[1].includes('chunk256/k3/bm25'));
    assert.ok(lines[1].includes('0.9'));
  });
  it('quotes fields containing commas', () => {
    const out = fakeOut();
    out.results[0].config.name = 'weird, name';
    const csv = T.leaderboardCSV(out);
    assert.ok(csv.includes('"weird, name"'));
  });
});

describe('reportMarkdown', () => {
  it('contains a leaderboard table and per-question answers', () => {
    const md = T.reportMarkdown(fakeOut());
    assert.ok(md.includes('# RAGJudge Report'));
    assert.ok(md.includes('| Rank | Config | Faithfulness |'));
    assert.ok(md.includes('chunk256/k3/bm25'));
    assert.ok(md.includes('### q1: How long is the warranty?'));
    assert.ok(md.includes('The warranty lasts 2 years. [1]'));
    assert.ok(md.includes('Reference: 2 years.'));
  });
  it('includes LLM judge scores when present', () => {
    const md = T.reportMarkdown(fakeOut());
    assert.ok(md.includes('LLM judge: 4/5'));
  });
  it('states the honest-limitations footer', () => {
    assert.ok(T.reportMarkdown(fakeOut()).includes('heuristic'));
  });
});

describe('export on a real run', () => {
  it('CSV and Markdown are non-empty and consistent', async () => {
    const ds = { docs: T.SAMPLE_DOCS, questions: T.SAMPLE_QUESTIONS.slice(0, 2) };
    const matrix = T.expandMatrix({ chunkSizes: [256], overlaps: [50], topKs: [3], retrievals: ['bm25'] });
    const out = await T.runEvaluation(ds, matrix, {});
    const csv = T.leaderboardCSV(out);
    const md = T.reportMarkdown(out);
    assert.ok(csv.length > 50 && md.length > 200);
    assert.ok(md.includes(out.results[0].config.name));
  });
});
