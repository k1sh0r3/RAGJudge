/* RAGJudge — retrieval: BM25 baseline + cosine over injected embeddings. */
(function (root) {
  root.RAGJudge = root.RAGJudge || {};
  var T = root.RAGJudge;

  /* Standard BM25 (k1=1.2, b=0.75). Returns [{chunk, score}] sorted desc, top k. */
  function bm25(chunks, query, k) {
    var qterms = T.contentWords(query);
    var N = chunks.length;
    if (!N || !qterms.length) return [];
    var docTerms = chunks.map(function (c) { return T.tokenize(c.text); });
    var df = {};
    docTerms.forEach(function (ts) {
      var seen = {};
      ts.forEach(function (t) { if (!seen[t]) { seen[t] = true; df[t] = (df[t] || 0) + 1; } });
    });
    var avgdl = docTerms.reduce(function (a, t) { return a + t.length; }, 0) / N;
    var k1 = 1.2, b = 0.75;
    var scored = chunks.map(function (c, i) {
      var tf = {};
      docTerms[i].forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
      var dl = docTerms[i].length;
      var s = 0;
      qterms.forEach(function (q) {
        if (!tf[q]) return;
        var d = df[q] || 0;
        var idf = Math.log(1 + (N - d + 0.5) / (d + 0.5));
        s += idf * (tf[q] * (k1 + 1)) / (tf[q] + k1 * (1 - b + b * dl / avgdl));
      });
      return { chunk: c, score: s };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, Math.max(1, k | 0));
  }

  function cosineSim(a, b) {
    var dot = 0, na = 0, nb = 0;
    var n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  /* Dense retrieval. `embed` is an async (text) => number[] injected by the caller
     (transformers.js in the browser, fakeEmbed in tests). `cache` is an optional
     Map keyed by chunk id so repeated questions don't re-embed chunks. */
  async function cosineRetrieve(chunks, query, embed, k, cache) {
    cache = cache || new Map();
    async function get(key, text) {
      if (!cache.has(key)) cache.set(key, await embed(text));
      return cache.get(key);
    }
    var qv = await get('__q__' + query, query);
    var scored = [];
    for (var i = 0; i < chunks.length; i++) {
      var v = await get(chunks[i].id, chunks[i].text);
      scored.push({ chunk: chunks[i], score: cosineSim(qv, v) });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, Math.max(1, k | 0));
  }

  /* Deterministic toy embedder (hashing trick) — for tests and as a documented
     fallback. NOT a semantic embedding; do not mistake it for one. */
  function fakeEmbed(text, dim) {
    dim = dim || 64;
    var vec = new Array(dim).fill(0);
    T.contentWords(text).forEach(function (t) {
      var h = 2166136261;
      for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
      vec[Math.abs(h) % dim] += 1;
    });
    var norm = Math.sqrt(vec.reduce(function (a, x) { return a + x * x; }, 0));
    if (norm) vec = vec.map(function (x) { return x / norm; });
    return vec;
  }
  function fakeEmbedAsync(text) { return Promise.resolve(fakeEmbed(text)); }

  T.bm25 = bm25;
  T.cosineSim = cosineSim;
  T.cosineRetrieve = cosineRetrieve;
  T.fakeEmbed = fakeEmbed;
  T.fakeEmbedAsync = fakeEmbedAsync;
})(typeof window !== 'undefined' ? window : globalThis);
