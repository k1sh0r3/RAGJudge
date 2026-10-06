/* RAGJudge tests — matrix expansion + evaluation runner. */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/text.js');
require('../assets/chunk.js');
require('../assets/retrieval.js');
require('../assets/metrics.js');
require('../assets/answer.js');
require('../assets/llm.js');
require('../assets/runner.js');
require('../assets/sample-data.js');
const T = globalThis.RAGJudge;

const DATASET = {
  docs: T.SAMPLE_DOCS,
  questions: T.SAMPLE_QUESTIONS.slice(0, 3)
};

describe('expandMatrix', () => {
  it('builds the cartesian product', () => {
    const m = T.expandMatrix({ chunkSizes: [256, 512], overlaps: [50], topKs: [3, 5], retrievals: ['bm25', 'cosine'] });
    assert.equal(m.length, 2 * 1 * 2 * 2);
    assert.ok(m.every(c => c.name && c.chunkSize && c.topK && c.retrieval));
  });
  it('has sane defaults', () => {
    const m = T.expandMatrix({});
    assert.equal(m.length, 1);
    assert.equal(m[0].retrieval, 'bm25');
  });
});

describe('runEvaluation', () => {
  const matrix = T.expandMatrix({ chunkSizes: [256, 1024], overlaps: [50], topKs: [3], retrievals: ['bm25', 'cosine'] });

  it('runs every contestant over every question', async () => {
    const out = await T.runEvaluation(DATASET, matrix, { embed: T.fakeEmbedAsync });
    assert.equal(out.results.length, matrix.length);
    out.results.forEach(r => {
      assert.equal(r.perQuestion.length, 3);
      assert.ok(r.rank >= 1);
    });
  });
  it('is deterministic: same input → identical leaderboard', async () => {
    const a = await T.runEvaluation(DATASET, matrix, { embed: T.fakeEmbedAsync });
    const b = await T.runEvaluation(DATASET, matrix, { embed: T.fakeEmbedAsync });
    assert.deepEqual(
      a.results.map(r => [r.config.name, r.aggregates.faithfulness, r.aggregates.relevance]),
      b.results.map(r => [r.config.name, r.aggregates.faithfulness, r.aggregates.relevance]));
  });
  it('aggregates are means of per-question scores', async () => {
    const out = await T.runEvaluation(DATASET, matrix.slice(0, 1), {});
    const r = out.results[0];
    const meanF = T.mean(r.perQuestion.map(p => p.faithfulness));
    assert.ok(Math.abs(r.aggregates.faithfulness - meanF) < 1e-3, 'rounded means match');
  });
  it('leaderboard is sorted by faithfulness desc', async () => {
    const out = await T.runEvaluation(DATASET, matrix, {});
    const fs = out.results.map(r => r.aggregates.faithfulness);
    const sorted = fs.slice().sort((x, y) => y - x);
    assert.deepEqual(fs, sorted);
  });
  it('reports latency as a non-negative number and meta honestly', async () => {
    const out = await T.runEvaluation(DATASET, matrix.slice(0, 1), {});
    assert.ok(out.results[0].aggregates.latencyMs >= 0);
    assert.equal(out.meta.answerMode, 'extractive');
    assert.equal(out.meta.judgeMode, 'heuristic');
    assert.equal(out.meta.questions, 3);
  });
  it('cosine falls back to BM25 without an embedder', async () => {
    const m = T.expandMatrix({ chunkSizes: [256], overlaps: [0], topKs: [3], retrievals: ['cosine'] });
    const out = await T.runEvaluation(DATASET, m, {}); /* no embed */
    assert.equal(out.results.length, 1);
    assert.ok(out.results[0].perQuestion[0].retrieved.length > 0);
  });
});
