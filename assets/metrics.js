/* RAGJudge — metric implementations (original; no Ragas/DeepEval code).
   All scores are 0..1 unless noted. */
(function (root) {
  root.RAGJudge = root.RAGJudge || {};
  var T = root.RAGJudge;

  var CLAIM_THRESHOLD = 0.6; /* fraction of a claim's content words found in one context sentence */

  /* One claim vs all context sentences: best single-sentence token recall. */
  function claimSupport(claim, contextSentences) {
    var ct = T.contentWords(claim);
    if (!ct.length) return { verdict: 'skipped', best: 0 };
    var best = 0;
    for (var i = 0; i < contextSentences.length; i++) {
      var st = {};
      T.contentWords(contextSentences[i]).forEach(function (t) { st[t] = true; });
      var hit = ct.filter(function (t) { return st[t]; }).length;
      var r = hit / ct.length;
      if (r > best) best = r;
    }
    return { verdict: best >= CLAIM_THRESHOLD ? 'supported' : 'unsupported', best: best };
  }

  /* Faithfulness: % of answer claims (sentences) supported by retrieved context. */
  function faithfulness(answer, contextTexts) {
    var ctxSents = [];
    (contextTexts || []).forEach(function (t) { ctxSents = ctxSents.concat(T.splitSentences(t)); });
    var claims = T.splitSentences(answer || '').map(function (text) {
      var v = claimSupport(text, ctxSents);
      return { text: text, verdict: v.verdict, best: +v.best.toFixed(3) };
    });
    var judged = claims.filter(function (c) { return c.verdict !== 'skipped'; });
    var score = judged.length
      ? judged.filter(function (c) { return c.verdict === 'supported'; }).length / judged.length
      : 0;
    return { score: score, claims: claims };
  }

  /* Citation precision/recall. Citations are 1-based ranks into `retrieved`
     ([{chunk, score}]). A citation is correct when the cited chunk's section is in
     the question's goldSections. */
  function citationScores(answer, retrieved, goldSections) {
    goldSections = goldSections || [];
    var details = T.parseCitations(answer).map(function (n) {
      var r = retrieved[n - 1];
      var section = r ? r.chunk.section : null;
      return {
        n: n,
        chunkId: r ? r.chunk.id : null,
        section: section,
        correct: !!(section && goldSections.indexOf(section) >= 0)
      };
    });
    var correct = details.filter(function (d) { return d.correct; }).length;
    var precision = details.length ? correct / details.length : 0;
    var hit = {};
    details.forEach(function (d) { if (d.correct) hit[d.section] = true; });
    var recall = goldSections.length ? Object.keys(hit).length / goldSections.length : 0;
    return { precision: precision, recall: recall, citations: details };
  }

  /* Answer relevance: cosine(question, answer) with embeddings, else token Jaccard. */
  async function relevance(answer, question, embed) {
    if (embed) {
      var parts = await Promise.all([embed(answer || ''), embed(question || '')]);
      return T.cosineSim(parts[0], parts[1]);
    }
    var at = {}, qt = {};
    T.contentWords(answer).forEach(function (t) { at[t] = true; });
    T.contentWords(question).forEach(function (t) { qt[t] = true; });
    var ka = Object.keys(at), kq = Object.keys(qt);
    if (!ka.length || !kq.length) return 0;
    var inter = kq.filter(function (t) { return at[t]; }).length;
    return inter / (ka.length + kq.length - inter);
  }

  T.faithfulness = faithfulness;
  T.claimSupport = claimSupport;
  T.citationScores = citationScores;
  T.relevance = relevance;
  T.CLAIM_THRESHOLD = CLAIM_THRESHOLD;
})(typeof window !== 'undefined' ? window : globalThis);
