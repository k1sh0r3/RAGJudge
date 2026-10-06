/* RAGJudge — config matrix expansion + deterministic evaluation pipeline. */
(function (root) {
  root.RAGJudge = root.RAGJudge || {};
  var T = root.RAGJudge;

  /* opts: {chunkSizes, overlaps, topKs, retrievals} → list of contestant configs. */
  function expandMatrix(opts) {
    opts = opts || {};
    var sizes = opts.chunkSizes && opts.chunkSizes.length ? opts.chunkSizes : [512];
    var ovs = opts.overlaps && opts.overlaps.length ? opts.overlaps : [50];
    var ks = opts.topKs && opts.topKs.length ? opts.topKs : [5];
    var rets = opts.retrievals && opts.retrievals.length ? opts.retrievals : ['bm25'];
    var out = [];
    sizes.forEach(function (cs) {
      ovs.forEach(function (ov) {
        ks.forEach(function (k) {
          rets.forEach(function (r) {
            out.push({
              name: 'chunk' + cs + '/ov' + ov + '/k' + k + '/' + r,
              chunkSize: cs, overlap: ov, topK: k, retrieval: r
            });
          });
        });
      });
    });
    return out;
  }

  function now() {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    return Date.now();
  }

  /* Full pipeline. opts: {embed (async fn|null), llm {provider,key,baseUrl,model}|null,
     answerWithLLM bool, judgeWithLLM bool, onProgress(cfgIdx, total, qIdx, qTotal)}.
     Deterministic: same dataset + matrix + options → identical leaderboard. */
  async function runEvaluation(dataset, matrix, opts) {
    opts = opts || {};
    var results = [];
    for (var ci = 0; ci < matrix.length; ci++) {
      var cfg = matrix[ci];
      var chunks = [];
      (dataset.docs || []).forEach(function (d) {
        chunks = chunks.concat(T.chunkDocument(d, cfg.chunkSize, cfg.overlap));
      });
      var embedCache = new Map();
      var perQuestion = [];
      var totalLatency = 0;
      var questions = dataset.questions || [];
      for (var qi = 0; qi < questions.length; qi++) {
        if (opts.onProgress) opts.onProgress(ci, matrix.length, qi, questions.length);
        var q = questions[qi];
        var t0 = now();
        var retrieved;
        if (cfg.retrieval === 'cosine' && opts.embed) {
          retrieved = await T.cosineRetrieve(chunks, q.question, opts.embed, cfg.topK, embedCache);
        } else {
          retrieved = T.bm25(chunks, q.question, cfg.topK);
        }
        var contextTexts = retrieved.map(function (r) { return r.chunk.text; });
        var contextBlock = T.buildContextBlock(retrieved);
        var answer, mode;
        if (opts.answerWithLLM && opts.llm && opts.llm.key) {
          answer = await T.generateAnswerLLM(q.question, contextBlock, opts.llm);
          mode = 'llm';
          if (!answer) { answer = T.extractiveAnswer(q.question, retrieved); mode = 'extractive-fallback'; }
        } else {
          answer = T.extractiveAnswer(q.question, retrieved);
          mode = 'extractive';
        }
        var f = T.faithfulness(answer, contextTexts);
        var c = T.citationScores(answer, retrieved, q.goldSections);
        var rel = await T.relevance(answer, q.question, opts.embed || null);
        var latencyMs = now() - t0;
        totalLatency += latencyMs;
        var llmJudge = null;
        if (opts.judgeWithLLM && opts.llm && opts.llm.key) {
          llmJudge = await T.judgeFaithfulness(q.question, answer, contextBlock, opts.llm);
        }
        perQuestion.push({
          qid: q.id, question: q.question, reference: q.reference,
          answer: answer, mode: mode,
          retrieved: retrieved.map(function (r) {
            return { id: r.chunk.id, section: r.chunk.section, heading: r.chunk.heading,
                     text: r.chunk.text, score: +r.score.toFixed(4) };
          }),
          faithfulness: +f.score.toFixed(4), claims: f.claims,
          citationP: +c.precision.toFixed(4), citationR: +c.recall.toFixed(4),
          citations: c.citations,
          relevance: +rel.toFixed(4), latencyMs: +latencyMs.toFixed(1),
          llmJudge: llmJudge
        });
      }
      function agg(fn) { return +T.mean(perQuestion.map(fn)).toFixed(4); }
      results.push({
        config: cfg,
        perQuestion: perQuestion,
        aggregates: {
          faithfulness: agg(function (p) { return p.faithfulness; }),
          citationP: agg(function (p) { return p.citationP; }),
          citationR: agg(function (p) { return p.citationR; }),
          relevance: agg(function (p) { return p.relevance; }),
          latencyMs: +totalLatency.toFixed(1)
        }
      });
    }
    results.sort(function (a, b) {
      return (b.aggregates.faithfulness - a.aggregates.faithfulness) ||
             (b.aggregates.relevance - a.aggregates.relevance);
    });
    results.forEach(function (r, i) { r.rank = i + 1; });
    return {
      results: results,
      meta: {
        ranAt: new Date().toISOString(),
        questions: (dataset.questions || []).length,
        docs: (dataset.docs || []).length,
        contestants: matrix.length,
        answerMode: (opts.answerWithLLM && opts.llm && opts.llm.key) ? 'llm' : 'extractive',
        judgeMode: (opts.judgeWithLLM && opts.llm && opts.llm.key) ? 'llm' : 'heuristic',
        embeddings: opts.embed ? 'dense' : 'lexical-fallback'
      }
    };
  }

  T.expandMatrix = expandMatrix;
  T.runEvaluation = runEvaluation;
})(typeof window !== 'undefined' ? window : globalThis);
