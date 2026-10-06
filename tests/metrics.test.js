/* RAGJudge tests — metric math on synthetic cases. */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/text.js');
require('../assets/retrieval.js');
require('../assets/metrics.js');
const T = globalThis.RAGJudge;

const CTX = [
  'The AeroBrew 3000 carries a 2-year limited warranty.',
  'Descale every 3 months with a 1 to 1 mix of white vinegar and water.'
];

describe('faithfulness', () => {
  it('scores 1.0 for a fully supported answer', () => {
    const f = T.faithfulness(
      'The AeroBrew 3000 carries a 2-year limited warranty. Descale every 3 months with white vinegar and water.',
      CTX);
    assert.equal(f.score, 1);
    assert.ok(f.claims.every(c => c.verdict === 'supported'));
  });
  it('scores 0 for a fully hallucinated answer', () => {
    const f = T.faithfulness(
      'The AeroBrew 9000 includes free interstellar shipping and lifetime unicorn support.',
      CTX);
    assert.equal(f.score, 0);
    assert.ok(f.claims.every(c => c.verdict === 'unsupported'));
  });
  it('gives per-claim verdicts for mixed answers', () => {
    const f = T.faithfulness(
      'The AeroBrew 3000 carries a 2-year limited warranty. It also makes espresso martinis.',
      CTX);
    assert.equal(f.claims.length, 2);
    assert.equal(f.claims[0].verdict, 'supported');
    assert.equal(f.claims[1].verdict, 'unsupported');
    assert.equal(f.score, 0.5);
  });
  it('skips vacuous claims (no content words)', () => {
    const f = T.faithfulness('Yes.', CTX);
    assert.ok(f.claims.every(c => c.verdict === 'skipped'));
    assert.equal(f.score, 0);
  });
  it('handles empty answer and empty context', () => {
    assert.equal(T.faithfulness('', CTX).score, 0);
    assert.equal(T.faithfulness('Some claim here.', []).score, 0);
  });
  it('paraphrase below the threshold is unsupported (documented limitation)', () => {
    const f = T.faithfulness('The guarantee spans twenty-four months.', CTX);
    assert.equal(f.claims[0].verdict, 'unsupported');
  });
});

function mkRetrieved(sections) {
  return sections.map((s, i) => ({ chunk: { id: 'c' + i, section: s, text: 't' }, score: 1 - i * 0.1 }));
}

describe('citationScores', () => {
  it('perfect citations → P=1, R=1', () => {
    const r = mkRetrieved(['manual:warranty', 'manual:cleaning']);
    const s = T.citationScores('It has a 2-year warranty [1] and needs descaling [2].', r, ['manual:warranty', 'manual:cleaning']);
    assert.equal(s.precision, 1);
    assert.equal(s.recall, 1);
    assert.ok(s.citations.every(c => c.correct));
  });
  it('wrong citation → precision drops, recall unaffected for the right one', () => {
    const r = mkRetrieved(['manual:warranty', 'policy:hours']);
    const s = T.citationScores('Warranty [1] and hours [2].', r, ['manual:warranty']);
    assert.equal(s.precision, 0.5);
    assert.equal(s.recall, 1);
    assert.equal(s.citations[1].correct, false);
  });
  it('missing a gold section → recall drops', () => {
    const r = mkRetrieved(['manual:warranty', 'manual:cleaning']);
    const s = T.citationScores('Warranty [1].', r, ['manual:warranty', 'manual:cleaning']);
    assert.equal(s.precision, 1);
    assert.equal(s.recall, 0.5);
  });
  it('no citations → P=0, R=0', () => {
    const s = T.citationScores('Just a claim.', mkRetrieved(['manual:warranty']), ['manual:warranty']);
    assert.equal(s.precision, 0);
    assert.equal(s.recall, 0);
  });
  it('out-of-range citation index is marked incorrect, not a crash', () => {
    const s = T.citationScores('Claim [9].', mkRetrieved(['manual:warranty']), ['manual:warranty']);
    assert.equal(s.precision, 0);
    assert.equal(s.citations[0].chunkId, null);
  });
});

describe('relevance', () => {
  it('orders answers by question overlap (lexical fallback)', async () => {
    const q = 'How long is the warranty?';
    const good = 'The warranty lasts 2 years from purchase.';
    const bad = 'Descale the machine with vinegar every quarter.';
    const rg = await T.relevance(good, q, null);
    const rb = await T.relevance(bad, q, null);
    assert.ok(rg > rb, rg + ' should exceed ' + rb);
  });
  it('identical question/answer text scores 1 with embeddings path stubbed', async () => {
    const r = await T.relevance('warranty two years', 'warranty two years', T.fakeEmbedAsync);
    assert.ok(Math.abs(r - 1) < 1e-9);
  });
  it('returns 0 for empty inputs', async () => {
    assert.equal(await T.relevance('', 'warranty?', null), 0);
    assert.equal(await T.relevance('the and or', 'warranty?', null), 0);
  });
});
