/* RAGJudge tests — text utils + chunking. */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/text.js');
require('../assets/chunk.js');
const T = globalThis.RAGJudge;

describe('text utils', () => {
  it('tokenizes lowercase alphanumerics', () => {
    assert.deepEqual(T.tokenize('Hello, World 3000!'), ['hello', 'world', '3000']);
  });
  it('contentWords drops stopwords and tiny tokens', () => {
    const w = T.contentWords('The quick brown fox is a test');
    assert.ok(!w.includes('the') && !w.includes('is') && !w.includes('a'));
    assert.ok(w.includes('quick') && w.includes('brown'));
  });
  it('splitSentences splits on sentence boundaries', () => {
    assert.equal(T.splitSentences('One. Two! Three?').length, 3);
  });
  it('parseCitations extracts 1-based markers in order', () => {
    assert.deepEqual(T.parseCitations('a [1] b [12] c [1]'), [1, 12, 1]);
    assert.deepEqual(T.parseCitations('no citations'), []);
  });
});

describe('chunkText', () => {
  it('returns no chunks for empty text', () => {
    assert.deepEqual(T.chunkText('', 256, 50), []);
    assert.deepEqual(T.chunkText('   ', 256, 50), []);
  });
  it('keeps short text as one chunk', () => {
    const c = T.chunkText('hello world', 256, 50);
    assert.deepEqual(c, ['hello world']);
  });
  it('splits long text into multiple chunks near the size', () => {
    const text = Array(200).fill('lorem').join(' ');
    const c = T.chunkText(text, 256, 50);
    assert.ok(c.length > 1, 'got ' + c.length);
    assert.ok(c.every(x => x.length <= 300), 'word-boundary respected');
  });
  it('overlap carries trailing content into the next chunk', () => {
    const text = Array(100).fill('alpha').join(' ') + ' ' + Array(100).fill('omega').join(' ');
    const noOv = T.chunkText(text, 256, 0);
    const withOv = T.chunkText(text, 256, 80);
    assert.ok(withOv.length >= noOv.length);
    assert.ok(withOv[1].includes('alpha'), 'overlap kept alpha words in chunk 2');
  });
  it('reassembles losslessly at the word level', () => {
    const text = 'The quick brown fox jumps over the lazy dog. '.repeat(30);
    const c = T.chunkText(text, 200, 40);
    const words = text.split(/\s+/).filter(Boolean);
    const got = c.join(' ').split(/\s+/).filter(Boolean);
    assert.ok(got.length >= words.length, 'no words lost');
  });
});

describe('chunkDocument', () => {
  const doc = { id: 'd1', title: 'Doc', sections: [
    { id: 's1', heading: 'A', text: 'alpha beta gamma delta epsilon zeta eta theta' },
    { id: 's2', heading: 'B', text: 'one two three four five six seven eight' }
  ]};
  it('maps every chunk back to its section', () => {
    const chunks = T.chunkDocument(doc, 256, 0);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].section, 'd1:s1');
    assert.equal(chunks[1].section, 'd1:s2');
    assert.ok(chunks[0].id.startsWith('d1:s1#'));
  });
  it('splits long sections into several chunks with sequential ids', () => {
    const big = { id: 'd2', title: 'Big', sections: [
      { id: 's1', heading: 'A', text: Array(300).fill('word').join(' ') } ]};
    const chunks = T.chunkDocument(big, 256, 50);
    assert.ok(chunks.length > 2);
    assert.deepEqual(chunks.map(c => c.id),
      chunks.map((_, i) => 'd2:s1#' + i));
  });
});
