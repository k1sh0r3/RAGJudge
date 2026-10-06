/* RAGJudge tests — retrieval (BM25 + cosine). */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/text.js');
require('../assets/chunk.js');
require('../assets/retrieval.js');
const T = globalThis.RAGJudge;

function mkChunks(texts) {
  return texts.map((t, i) => ({ id: 'c' + i, docId: 'd', section: 'd:s', heading: 'H', text: t }));
}

describe('bm25', () => {
  const chunks = mkChunks([
    'The AeroBrew 3000 carries a 2-year limited warranty.',
    'Descale every 3 months with white vinegar and water.',
    'Core collaboration hours are 10am to 3pm Eastern.'
  ]);
  it('ranks the term-matching chunk first', () => {
    const r = T.bm25(chunks, 'warranty coverage years', 3);
    assert.equal(r[0].chunk.id, 'c0');
  });
  it('is deterministic across runs', () => {
    const a = T.bm25(chunks, 'descale vinegar', 3).map(r => r.chunk.id);
    const b = T.bm25(chunks, 'descale vinegar', 3).map(r => r.chunk.id);
    assert.deepEqual(a, b);
  });
  it('returns at most k results', () => {
    assert.equal(T.bm25(chunks, 'warranty water', 2).length, 2);
  });
  it('handles empty query and empty corpus', () => {
    assert.deepEqual(T.bm25(chunks, '', 3), []);
    assert.deepEqual(T.bm25([], 'warranty', 3), []);
  });
  it('prefers the chunk with more query-term hits', () => {
    const cs = mkChunks(['warranty', 'warranty warranty warranty terms coverage']);
    const r = T.bm25(cs, 'warranty terms', 2);
    assert.equal(r[0].chunk.id, 'c1');
  });
});

describe('cosineSim', () => {
  it('is 1 for identical vectors, 0 for orthogonal', () => {
    assert.ok(Math.abs(T.cosineSim([1, 0], [1, 0]) - 1) < 1e-9);
    assert.ok(Math.abs(T.cosineSim([1, 0], [0, 1])) < 1e-9);
  });
  it('is 0 when a vector is all zeros', () => {
    assert.equal(T.cosineSim([0, 0], [1, 1]), 0);
  });
});

describe('cosineRetrieve', () => {
  const chunks = mkChunks([
    'The AeroBrew 3000 carries a 2-year limited warranty.',
    'Descale every 3 months with white vinegar and water.',
    'Core collaboration hours are 10am to 3pm Eastern.'
  ]);
  it('ranks the lexically closest chunk first with the fake embedder', async () => {
    const r = await T.cosineRetrieve(chunks, 'warranty coverage', T.fakeEmbedAsync, 3);
    assert.equal(r[0].chunk.id, 'c0');
  });
  it('is deterministic and uses the cache', async () => {
    const cache = new Map();
    const a = await T.cosineRetrieve(chunks, 'descale', T.fakeEmbedAsync, 3, cache);
    const sizeAfterFirst = cache.size;
    const b = await T.cosineRetrieve(chunks, 'descale', T.fakeEmbedAsync, 3, cache);
    assert.deepEqual(a.map(r => r.chunk.id), b.map(r => r.chunk.id));
    assert.equal(cache.size, sizeAfterFirst, 'second run added no new embeddings');
  });
  it('fakeEmbed is deterministic', () => {
    assert.deepEqual(T.fakeEmbed('hello world'), T.fakeEmbed('hello world'));
  });
});
