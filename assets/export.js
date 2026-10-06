/* RAGJudge — report export: CSV leaderboard + Markdown report. */
(function (root) {
  root.RAGJudge = root.RAGJudge || {};
  var T = root.RAGJudge;

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function leaderboardCSV(evalOut) {
    var header = ['rank', 'config', 'chunk_size', 'overlap', 'top_k', 'retrieval',
      'faithfulness', 'citation_precision', 'citation_recall', 'relevance', 'latency_ms'];
    var lines = [header.join(',')];
    evalOut.results.forEach(function (r) {
      var a = r.aggregates, c = r.config;
      lines.push([r.rank, c.name, c.chunkSize, c.overlap, c.topK, c.retrieval,
        a.faithfulness, a.citationP, a.citationR, a.relevance, a.latencyMs]
        .map(csvCell).join(','));
    });
    return lines.join('\n') + '\n';
  }

  function reportMarkdown(evalOut) {
    var m = evalOut.meta;
    var L = [];
    L.push('# RAGJudge Report');
    L.push('');
    L.push('Generated: ' + m.ranAt);
    L.push('Datasets: ' + m.docs + ' docs, ' + m.questions + ' questions, ' +
           m.contestants + ' contestants.');
    L.push('Answer mode: ' + m.answerMode + ' · Judge mode: ' + m.judgeMode +
           ' · Relevance: ' + m.embeddings);
    L.push('');
    L.push('## Leaderboard');
    L.push('');
    L.push('| Rank | Config | Faithfulness | Citation P | Citation R | Relevance | Latency (ms) |');
    L.push('| --- | --- | --- | --- | --- | --- | --- |');
    evalOut.results.forEach(function (r) {
      var a = r.aggregates;
      L.push('| ' + r.rank + ' | ' + r.config.name + ' | ' + a.faithfulness +
             ' | ' + a.citationP + ' | ' + a.citationR + ' | ' + a.relevance +
             ' | ' + a.latencyMs + ' |');
    });
    L.push('');
    L.push('## Per-question drill-down');
    L.push('');
    var qs = evalOut.results.length ? evalOut.results[0].perQuestion : [];
    qs.forEach(function (_, qi) {
      var q0 = evalOut.results[0].perQuestion[qi];
      L.push('### ' + q0.qid + ': ' + q0.question);
      L.push('');
      L.push('Reference: ' + q0.reference);
      L.push('');
      evalOut.results.forEach(function (r) {
        var p = r.perQuestion[qi];
        L.push('**' + r.config.name + '** (faithfulness ' + p.faithfulness +
               ', citation P/R ' + p.citationP + '/' + p.citationR +
               ', relevance ' + p.relevance + ', ' + p.latencyMs + ' ms)');
        L.push('');
        L.push('> ' + p.answer.split('\n').join('\n> '));
        L.push('');
        if (p.llmJudge) {
          L.push('LLM judge: ' + p.llmJudge.score + '/5 — ' + p.llmJudge.rationale);
          L.push('');
        }
      });
    });
    L.push('---');
    L.push('_Metrics are heuristic unless an LLM judge was used. See README for definitions._');
    L.push('');
    return L.join('\n');
  }

  T.leaderboardCSV = leaderboardCSV;
  T.reportMarkdown = reportMarkdown;
})(typeof window !== 'undefined' ? window : globalThis);
