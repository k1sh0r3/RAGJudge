/* RAGJudge — UI wiring. */
(function () {
  'use strict';
  var T = window.RAGJudge;
  var $ = function (id) { return document.getElementById(id); };

  var LS_KEY = 'ragjudge-v1';
  var state = { docs: [], questions: [], results: null, evalOut: null, embed: null, sort: { key: 'rank', dir: 1 } };

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ docs: state.docs, questions: state.questions })); } catch (e) {}
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      state.docs = s.docs || []; state.questions = s.questions || [];
    } catch (e) {}
  }
  function slug(s) {
    return (s || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'x';
  }

  /* ---------- dataset ---------- */

  function renderDataset() {
    $('doc-count').textContent = state.docs.length;
    $('q-count').textContent = state.questions.length;
    $('doc-list').innerHTML = state.docs.map(function (d, i) {
      return '<div class="docitem"><h4>' + esc(d.title) + '</h4>' +
        '<div class="meta">' + d.id + ' · ' + d.sections.length + ' sections: ' +
        d.sections.map(function (s) { return d.id + ':' + s.id; }).join(', ') + '</div>' +
        '<button class="btn small ghost del-doc" data-i="' + i + '">Delete</button></div>';
    }).join('') || '<p class="sub">No documents yet.</p>';
    $('q-list').innerHTML = state.questions.map(function (q, i) {
      return '<div class="qrow"><span class="qid">' + esc(q.id) + '</span><span>' + esc(q.question) +
        '<br><span class="sub">ref: ' + esc(q.reference) + ' · gold: ' + esc(q.goldSections.join(', ')) + '</span></span>' +
        '<button class="btn small ghost del del-q" data-i="' + i + '">✕</button></div>';
    }).join('') || '<p class="sub">No questions yet.</p>';
    document.querySelectorAll('.del-doc').forEach(function (b) {
      b.onclick = function () { state.docs.splice(+b.dataset.i, 1); save(); renderDataset(); };
    });
    document.querySelectorAll('.del-q').forEach(function (b) {
      b.onclick = function () { state.questions.splice(+b.dataset.i, 1); save(); renderDataset(); };
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  $('btn-sample').onclick = function () {
    state.docs = JSON.parse(JSON.stringify(T.SAMPLE_DOCS));
    state.questions = JSON.parse(JSON.stringify(T.SAMPLE_QUESTIONS));
    save(); renderDataset(); updateMatrixCount();
    status('run-status', 'Sample dataset loaded: 2 docs, 10 questions.');
  };
  $('btn-clear-data').onclick = function () {
    state.docs = []; state.questions = [];
    save(); renderDataset(); updateMatrixCount();
  };
  $('btn-add-doc').onclick = function () {
    var title = $('new-doc-title').value.trim() || 'Untitled';
    var raw = $('new-doc-text').value;
    var parts = raw.split(/^###\s+/m).filter(function (p) { return p.trim(); });
    var sections = parts.length ? parts.map(function (p) {
      var lines = p.split('\n');
      var heading = lines[0].trim();
      return { id: slug(heading), heading: heading, text: lines.slice(1).join('\n').trim() };
    }) : [{ id: 'body', heading: 'Body', text: raw.trim() }];
    if (!sections[0].text) { status('run-status', 'Paste some text first.', true); return; }
    state.docs.push({ id: slug(title) + '-' + Date.now().toString(36), title: title, sections: sections });
    $('new-doc-title').value = ''; $('new-doc-text').value = '';
    save(); renderDataset();
  };
  $('btn-add-q').onclick = function () {
    var q = $('new-q-text').value.trim();
    if (!q) { status('run-status', 'Enter a question first.', true); return; }
    state.questions.push({
      id: 'q' + (state.questions.length + 1) + '-' + Date.now().toString(36),
      question: q,
      reference: $('new-q-ref').value.trim(),
      goldSections: $('new-q-gold').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
    });
    $('new-q-text').value = ''; $('new-q-ref').value = ''; $('new-q-gold').value = '';
    save(); renderDataset();
  };

  /* ---------- matrix ---------- */

  function checkedValues(id) {
    return Array.prototype.map.call(
      document.querySelectorAll('#' + id + ' input:checked'), function (el) { return el.value; });
  }
  function matrixOpts() {
    return {
      chunkSizes: checkedValues('ck-size').map(Number),
      overlaps: checkedValues('ck-overlap').map(Number),
      topKs: checkedValues('ck-topk').map(Number),
      retrievals: checkedValues('ck-retr')
    };
  }
  function updateMatrixCount() {
    var n = T.expandMatrix(matrixOpts()).length;
    $('contestant-count').textContent = n;
    $('matrix-warn').classList.toggle('hidden', n <= 12);
  }
  document.querySelectorAll('#sec-matrix input[type=checkbox]').forEach(function (el) {
    el.addEventListener('change', updateMatrixCount);
  });

  function status(id, msg, isErr) {
    var el = $(id);
    el.textContent = msg;
    el.style.color = isErr ? 'var(--fail)' : '';
  }

  /* ---------- embeddings ---------- */

  function refreshBadges() {
    var eb = $('badge-embed');
    var st = T.embedderState();
    if (st === 'ready') { eb.textContent = 'embeddings: all-MiniLM-L6-v2 ready'; eb.className = 'badge on'; }
    else if (st === 'failed') { eb.textContent = 'embeddings: unavailable — cosine falls back to BM25'; eb.className = 'badge warn'; }
    else if (st === 'loading') { eb.textContent = 'embeddings: downloading model (~90MB once)…'; eb.className = 'badge'; }
    var llm = llmOpts();
    var mb = $('badge-mode');
    if (llm.key && $('llm-answer').checked) {
      mb.textContent = 'answer mode: LLM (' + T.LLM_PROVIDERS[llm.provider].label + ')';
      mb.className = 'badge on';
    } else {
      mb.textContent = 'answer mode: extractive (no key)';
      mb.className = 'badge';
    }
  }

  /* ---------- run ---------- */

  $('btn-run').onclick = async function () {
    if (!state.docs.length || !state.questions.length) {
      status('run-status', 'Load the sample dataset (or add your own docs + questions) first.', true);
      return;
    }
    var matrix = T.expandMatrix(matrixOpts());
    if (!matrix.length) { status('run-status', 'Select at least one value per matrix axis.', true); return; }
    var llm = llmOpts();
    var useLLM = llm.key && $('llm-answer').checked;
    $('btn-run').disabled = true;
    $('run-progress').classList.remove('hidden');
    var bar = $('run-progress').firstElementChild;
    try {
      var out = await T.runEvaluation(
        { docs: state.docs, questions: state.questions }, matrix,
        {
          embed: state.embed,
          llm: useLLM ? llm : null,
          answerWithLLM: useLLM,
          onProgress: function (ci, cn, qi, qn) {
            bar.style.width = Math.round(100 * (ci + qi / qn) / cn) + '%';
            status('run-status', 'Running ' + (ci + 1) + '/' + cn + ' · question ' + (qi + 1) + '/' + qn + '…');
          }
        });
      state.evalOut = out;
      state.results = out.results;
      state.sort = { key: 'rank', dir: 1 };
      renderResults();
      status('run-status', 'Done: ' + out.results.length + ' contestants, ' +
        out.meta.questions + ' questions. Winner: ' + out.results[0].config.name + '.');
    } catch (e) {
      status('run-status', 'Run failed: ' + ((e && e.message) || e), true);
    }
    $('btn-run').disabled = false;
    $('run-progress').classList.add('hidden');
    refreshBadges();
  };

  /* ---------- leaderboard ---------- */

  var METRICS = [
    ['faithfulness', 'Faithful'], ['citationP', 'Cite P'], ['citationR', 'Cite R'],
    ['relevance', 'Relevant'], ['latencyMs', 'ms']
  ];
  function metricPill(v) {
    var cls = v >= 0.75 ? 'good' : v >= 0.4 ? 'mid' : 'bad';
    return '<span class="pill ' + cls + '">' + v.toFixed(2) + '</span>';
  }

  function sortedResults() {
    var k = state.sort.key, dir = state.sort.dir;
    return state.results.slice().sort(function (a, b) {
      var av = k === 'rank' ? a.rank : k === 'config' ? a.config.name : a.aggregates[k];
      var bv = k === 'rank' ? b.rank : k === 'config' ? b.config.name : b.aggregates[k];
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
  }

  function renderResults() {
    $('sec-results').classList.remove('hidden');
    $('sec-export').classList.remove('hidden');
    var tb = $('board').querySelector('tbody');
    tb.innerHTML = sortedResults().map(function (r) {
      var a = r.aggregates;
      return '<tr class="' + (r.rank === 1 ? 'winner' : '') + '">' +
        '<td class="num">' + (r.rank === 1 ? '★ ' : '') + r.rank + '</td>' +
        '<td><span class="pill">' + esc(r.config.name) + '</span></td>' +
        '<td class="num">' + metricPill(a.faithfulness) + '</td>' +
        '<td class="num">' + metricPill(a.citationP) + '</td>' +
        '<td class="num">' + metricPill(a.citationR) + '</td>' +
        '<td class="num">' + metricPill(a.relevance) + '</td>' +
        '<td class="num">' + a.latencyMs.toFixed(0) + '</td></tr>';
    }).join('');
    T.barChart($('chart'), {
      labels: state.results.map(function (r) { return r.config.name; }),
      values: state.results.map(function (r) { return r.aggregates.faithfulness; }),
      highlight: 0
    });
    var dq = $('drill-q');
    dq.innerHTML = state.results[0].perQuestion.map(function (p) {
      return '<option value="' + esc(p.qid) + '">' + esc(p.qid + ': ' + p.question) + '</option>';
    }).join('');
    renderDrill();
    setTimeout(function () {
      $('sec-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  document.querySelectorAll('#board th').forEach(function (th) {
    th.onclick = function () {
      var k = th.dataset.k;
      if (state.sort.key === k) state.sort.dir *= -1;
      else state.sort = { key: k, dir: k === 'config' ? 1 : -1 };
      renderResults();
    };
  });

  $('drill-q').addEventListener('change', renderDrill);

  function renderDrill() {
    var qid = $('drill-q').value;
    if (!qid || !state.results) return;
    $('drill').innerHTML = '<details class="drill" open><summary>' +
      esc(qid) + ' — per-config answers</summary><div class="body">' +
      state.results.map(function (r) {
        var p = r.perQuestion.filter(function (x) { return x.qid === qid; })[0];
        var claims = p.claims.map(function (c) {
          return '<div class="claim"><span class="v ' + c.verdict + '">' + c.verdict + '</span>' +
            esc(c.text) + '</div>';
        }).join('');
        var cites = p.citations.map(function (c) {
          return '<span class="pill ' + (c.correct ? 'good' : 'bad') + '">[' + c.n + ']' +
            (c.section ? esc(c.section) : '∅') + '</span>';
        }).join(' ') || '<span class="sub">no citations</span>';
        var chunks = p.retrieved.map(function (x, i) {
          return '<div class="chunk"><b>[' + (i + 1) + '] ' + esc(x.id) + '</b> · ' +
            esc(x.heading) + ' · score ' + x.score + '<br>' + esc(x.text.slice(0, 220)) +
            (x.text.length > 220 ? '…' : '') + '</div>';
        }).join('');
        var judge = p.llmJudge
          ? '<p><b>LLM judge:</b> <span class="pill mid">' + p.llmJudge.score + '/5</span> ' +
            esc(p.llmJudge.rationale) + '</p>'
          : '<p class="sub">LLM judge: not run</p>';
        return '<div class="cfg"><h4>' + (r.rank === 1 ? '★ ' : '') + esc(r.config.name) +
          ' <span class="sub">(' + esc(p.mode) + ')</span></h4>' +
          '<p>F ' + metricPill(p.faithfulness) + ' P ' + metricPill(p.citationP) +
          ' R ' + metricPill(p.citationR) + ' rel ' + metricPill(p.relevance) +
          ' <span class="pill">' + p.latencyMs + ' ms</span></p>' +
          '<div class="answer-box">' + esc(p.answer) + '</div>' +
          '<p class="sub">Reference: ' + esc(p.reference) + '</p>' +
          '<p><b>Claims:</b></p>' + claims +
          '<p><b>Citations:</b> ' + cites + '</p>' + judge +
          '<p><b>Retrieved chunks:</b></p>' + chunks + '</div>';
      }).join('') + '</div></details>';
  }

  /* ---------- LLM judge ---------- */

  function llmOpts() {
    var provider = $('llm-provider').value;
    var custom = null;
    if (provider === 'custom') {
      custom = { baseUrl: $('llm-base').value.trim(), model: $('llm-model').value.trim() };
      T.llmSetCustom(custom);
    }
    return { provider: provider, key: $('llm-key').value.trim() || T.llmGetKey(provider),
             baseUrl: custom && custom.baseUrl, model: custom && custom.model };
  }

  $('llm-provider').addEventListener('change', function () {
    $('llm-custom').classList.toggle('hidden', $('llm-provider').value !== 'custom');
    var p = $('llm-provider').value;
    $('llm-key').placeholder = T.LLM_PROVIDERS[p].placeholder;
    if (p === 'custom') {
      var c = T.llmGetCustom();
      if (!$('llm-base').value) $('llm-base').value = c.baseUrl || '';
      if (!$('llm-model').value) $('llm-model').value = c.model || '';
    }
    refreshBadges();
  });
  $('llm-answer').addEventListener('change', refreshBadges);

  $('btn-key-save').onclick = function () {
    var o = llmOpts();
    if (!o.key) { status('judge-status', 'Paste a key first.', true); return; }
    if (o.provider === 'custom' && (!o.baseUrl || !o.model)) {
      status('judge-status', 'Custom provider needs a base URL and a model.', true); return;
    }
    T.llmSetKey(o.provider, o.key);
    $('llm-key').value = '';
    status('judge-status', T.LLM_PROVIDERS[o.provider].label + ' key saved in this browser.');
    refreshBadges();
  };

  $('btn-judge').onclick = async function () {
    if (!state.evalOut) { status('judge-status', 'Run an evaluation first.', true); return; }
    var o = llmOpts();
    if (!o.key) { status('judge-status', 'Save a provider key first.', true); return; }
    if (o.provider === 'custom' && (!o.baseUrl || !o.model)) {
      status('judge-status', 'Custom provider needs a base URL and a model.', true); return;
    }
    $('btn-judge').disabled = true;
    var total = 0, ok = 0;
    try {
      for (var ri = 0; ri < state.evalOut.results.length; ri++) {
        var r = state.evalOut.results[ri];
        for (var qi = 0; qi < r.perQuestion.length; qi++) {
          var p = r.perQuestion[qi];
          total++;
          status('judge-status', 'Judging ' + total + '… (' + r.config.name + ', ' + p.qid + ')');
          var j = await T.judgeFaithfulness(p.question, p.answer,
            T.buildContextBlock(p.retrieved.map(function (x) { return { chunk: x }; })), o);
          p.llmJudge = j;
          if (j) ok++;
        }
      }
      state.evalOut.meta.judgeMode = 'llm';
      renderDrill();
      status('judge-status', 'LLM judge done: ' + ok + '/' + total + ' scored. See drill-down for side-by-side.');
    } catch (e) {
      status('judge-status', 'Judge failed: ' + ((e && e.message) || e), true);
    }
    $('btn-judge').disabled = false;
  };

  /* ---------- export ---------- */

  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  $('btn-md').onclick = function () {
    if (state.evalOut) download('ragjudge-report.md', T.reportMarkdown(state.evalOut), 'text/markdown');
  };
  $('btn-csv').onclick = function () {
    if (state.evalOut) download('ragjudge-leaderboard.csv', T.leaderboardCSV(state.evalOut), 'text/csv');
  };

  /* ---------- init ---------- */

  load();
  renderDataset();
  updateMatrixCount();
  var savedKey = T.llmGetKey('openai');
  if (savedKey) { /* key exists; keep field empty for safety */ }
  refreshBadges();
  T.loadEmbedder(function () { refreshBadges(); })
    .then(function (fn) { state.embed = fn || null; refreshBadges(); });
})();
