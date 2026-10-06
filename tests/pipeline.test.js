/* RAGJudge tests — no-key smoke test: the full pipeline on the bundled sample
   dataset, exactly as a first-time visitor would run it (no API keys, no network). */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

for (const f of ['text.js', 'chunk.js', 'sample-data.js', 'retrieval.js',
                 'metrics.js', 'answer.js', 'llm.js', 'runner.js', 'export.js']) {
  require('../assets/' + f);
}
const T = globalThis.RAGJudge;

describe('no-key smoke test (sample dataset, extractive answers)', () => {
  const dataset = { docs: T.SAMPLE_DOCS, questions: T.SAMPLE_QUESTIONS };
  const matrix = T.expandMatrix({
    chunkSizes: [256, 1024], overlaps: [50], topKs: [3, 5], retrievals: ['bm25', 'cosine']
  }); /* 8 contestants */

  it('builds the default 8-contestant matrix', () => {
    assert.equal(matrix.length, 8);
  });

  it('runs the whole pipeline keyless and ranks a winner', async () => {
    const out = await T.runEvaluation(dataset, matrix, { embed: T.fakeEmbedAsync });
    assert.equal(out.results.length, 8);
    assert.equal(out.results[0].rank, 1, 'winner is ranked first');
    assert.ok(out.results[0].perQuestion.length === 10, 'all 10 questions evaluated');
    assert.equal(out.meta.answerMode, 'extractive');
    assert.equal(out.meta.judgeMode, 'heuristic');
  });

  it('extractive answers are highly faithful (honest by construction)', async () => {
    const matrix1 = T.expandMatrix({ chunkSizes: [512], overlaps: [50], topKs: [5], retrievals: ['bm25'] });
    const out = await T.runEvaluation(dataset, matrix1, {});
    const f = out.results[0].aggregates.faithfulness;
    assert.ok(f >= 0.8, 'extractive faithfulness should be high, got ' + f);
  });

  it('every question retrieves context and cites it', async () => {
    const matrix1 = T.expandMatrix({ chunkSizes: [512], overlaps: [50], topKs: [3], retrievals: ['bm25'] });
    const out = await T.runEvaluation(dataset, matrix1, {});
    out.results[0].perQuestion.forEach(p => {
      assert.ok(p.retrieved.length > 0, p.qid + ' retrieved nothing');
      assert.ok(T.parseCitations(p.answer).length > 0, p.qid + ' answer has no citations');
    });
  });

  it('drill-down data is complete for every contestant and question', async () => {
    const matrix1 = T.expandMatrix({ chunkSizes: [256], overlaps: [0], topKs: [3], retrievals: ['bm25', 'cosine'] });
    const out = await T.runEvaluation(dataset, matrix1, { embed: T.fakeEmbedAsync });
    out.results.forEach(r => {
      r.perQuestion.forEach(p => {
        assert.ok(p.answer && p.answer.length > 10);
        assert.ok(Array.isArray(p.claims) && p.claims.length > 0);
        assert.ok(Array.isArray(p.citations));
        assert.ok(p.retrieved.every(x => x.id && x.section && x.text));
        assert.ok(p.faithfulness >= 0 && p.faithfulness <= 1);
        assert.ok(p.citationP >= 0 && p.citationP <= 1);
        assert.ok(p.relevance >= 0);
      });
    });
  });

  it('exports describe the same run', async () => {
    const matrix1 = T.expandMatrix({ chunkSizes: [512], overlaps: [50], topKs: [3], retrievals: ['bm25'] });
    const out = await T.runEvaluation(dataset, matrix1, {});
    const csv = T.leaderboardCSV(out);
    const md = T.reportMarkdown(out);
    assert.ok(csv.includes('chunk512/ov50/k3/bm25'));
    assert.ok(md.includes('## Leaderboard'));
    assert.ok(md.includes('## Per-question drill-down'));
    T.SAMPLE_QUESTIONS.forEach(q => assert.ok(md.includes(q.id), 'report covers ' + q.id));
  });
});
