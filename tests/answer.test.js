/* RAGJudge tests — extractive answers + context block. */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/text.js');
require('../assets/answer.js');
const T = globalThis.RAGJudge;

function mkRetrieved() {
  return [
    { chunk: { id: 'c0', section: 'manual:warranty', text: 'The AeroBrew 3000 carries a 2-year limited warranty. Register within 30 days.' }, score: 0.9 },
    { chunk: { id: 'c1', section: 'manual:cleaning', text: 'Descale every 3 months with white vinegar. Rinse the carafe after every use.' }, score: 0.4 }
  ];
}

describe('buildContextBlock', () => {
  it('numbers chunks 1-based', () => {
    const b = T.buildContextBlock(mkRetrieved());
    assert.ok(b.startsWith('[1] The AeroBrew'));
    assert.ok(b.includes('\n\n[2] Descale'));
  });
});

describe('extractiveAnswer', () => {
  it('cites retrieved chunks with rank markers', () => {
    const a = T.extractiveAnswer('How long is the warranty?', mkRetrieved());
    assert.ok(/\[1\]/.test(a), 'cites chunk 1');
    assert.ok(a.includes('2-year limited warranty'));
  });
  it('prefers sentences overlapping the question', () => {
    const a = T.extractiveAnswer('How often should I descale?', mkRetrieved());
    assert.ok(a.includes('Descale every 3 months'), 'descaling sentence chosen, got: ' + a);
  });
  it('is honest when nothing is retrieved', () => {
    assert.ok(T.extractiveAnswer('q', []).includes('No relevant context'));
  });
  it('is honest when nothing overlaps the question', () => {
    const r = [{ chunk: { id: 'c0', section: 's', text: 'Zebras migrate at dawn across the savanna.' }, score: 0.1 }];
    const a = T.extractiveAnswer('How long is the warranty?', r);
    assert.ok(a.includes('does not directly answer'));
    assert.ok(!/\[\d+\]/.test(a), 'no bogus citations');
  });
  it('does not repeat the same sentence twice', () => {
    const r = [
      { chunk: { id: 'c0', section: 's', text: 'The warranty lasts 2 years. The warranty lasts 2 years.' }, score: 0.9 },
      { chunk: { id: 'c1', section: 's', text: 'The warranty lasts 2 years.' }, score: 0.8 }
    ];
    const a = T.extractiveAnswer('How long is the warranty?', r);
    const n = (a.match(/The warranty lasts 2 years/g) || []).length;
    assert.equal(n, 1);
  });
});
