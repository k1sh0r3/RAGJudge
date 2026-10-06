/* RAGJudge — answer generation. Keyless extractive answers keep the whole pipeline
   demoable with zero API keys; BYOK answers come from llm.js. */
(function (root) {
  root.RAGJudge = root.RAGJudge || {};
  var T = root.RAGJudge;

  /* Numbered context block for LLM prompts: "[1] chunk text ..." */
  function buildContextBlock(retrieved) {
    return retrieved.map(function (r, i) {
      return '[' + (i + 1) + '] ' + r.chunk.text;
    }).join('\n\n');
  }

  /* Extractive answer: for each retrieved chunk, take up to 2 sentences with the
     highest content-word overlap with the question, cited as [rank]. Faithful by
     construction; completeness varies — that's the honest trade-off the UI shows. */
  function extractiveAnswer(question, retrieved) {
    if (!retrieved || !retrieved.length) return 'No relevant context was retrieved.';
    var qset = {};
    T.contentWords(question).forEach(function (t) { qset[t] = true; });
    var seen = {};
    var lines = [];
    retrieved.forEach(function (r, i) {
      var sents = T.splitSentences(r.chunk.text).map(function (s) {
        var score = T.contentWords(s).filter(function (t) { return qset[t]; }).length;
        return { s: s, score: score };
      }).filter(function (o) { return o.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, 2);
      sents.forEach(function (o) {
        if (seen[o.s]) return;
        seen[o.s] = true;
        lines.push(o.s + ' [' + (i + 1) + ']');
      });
    });
    if (!lines.length) return 'The retrieved context does not directly answer the question.';
    return 'Based on the retrieved documents:\n\n' + lines.join('\n');
  }

  T.buildContextBlock = buildContextBlock;
  T.extractiveAnswer = extractiveAnswer;
})(typeof window !== 'undefined' ? window : globalThis);
