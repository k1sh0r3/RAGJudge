# RAGJudge — Prove your RAG works

A 100% client-side **RAG evaluation harness**. Feed it documents and test questions with
reference answers, configure a matrix of RAG settings (chunk size, overlap, top-k,
retrieval mode), and it scores every configuration on **faithfulness**, **citation
quality**, and **answer relevance** — then ranks them on a sortable leaderboard with
per-question drill-downs.

No backend, no build step, no API key required. Open `index.html` (or serve the folder
with any static server) and it runs. Deploy as-is to GitHub Pages.

## Quick start

1. Open `index.html` in a browser.
2. Click **Load sample dataset** — a fictional product manual + company policy with
   10 test questions, so the bench runs with zero setup.
3. Pick your config matrix (defaults = 8 contestants) and hit **▶ Run evaluation**.
4. Read the leaderboard, expand the per-question drill-down, export the report.

Optional upgrades:
- **Embeddings:** the app tries to load `all-MiniLM-L6-v2` via transformers.js CDN
  (~90MB, cached after the first download) for cosine retrieval and semantic relevance.
  If it fails, cosine configs fall back to BM25 and the UI says so.
- **BYOK LLM:** add an OpenAI / Gemini / Groq / custom OpenAI-compatible key to get
  LLM-generated answers and an **LLM-as-judge** that re-scores faithfulness 1–5 with
  rationales, shown side-by-side with the heuristic score. Keys never leave the browser.

## Metric definitions

All scorers are original implementations written for this project (no Ragas/DeepEval code).

| Metric | Scale | Definition |
|---|---|---|
| **Faithfulness** | 0–1 | The answer is split into sentences (= claims). A claim is *supported* if ≥60% of its content-word tokens appear in a single retrieved-context sentence. Score = supported ÷ judged claims. Per-claim verdicts are shown in the drill-down. |
| **Citation precision** | 0–1 | Answers cite chunks as `[1]…[k]` (rank positions). A citation is *correct* if the cited chunk's section is in the question's author-defined `goldSections`. P = correct ÷ cited. |
| **Citation recall** | 0–1 | R = distinct gold sections cited ÷ gold sections. |
| **Answer relevance** | 0–1 | Cosine similarity between question and answer embeddings; falls back to token Jaccard when no embedder is available. |
| **Latency** | ms | Measured per config with `performance.now()`; reported, not ranked. |
| **LLM judge** | 1–5 | Optional BYOK re-score of faithfulness with a one-line rationale. Displayed next to — never instead of — the heuristic score. |

**Ranking:** mean faithfulness descending, tie-break mean relevance descending.

## Honest limitations

- The heuristic faithfulness judge is **token overlap, not NLI**: heavily paraphrased
  correct answers can score low, while extractive answers score high by construction
  (they're copied from context). The side-by-side LLM judge exists precisely to
  cross-check this.
- Citation "correctness" is judged against **author-defined, section-level** gold labels —
  an approximation, not ground truth.
- Without the embedding model, relevance is **lexical** (token Jaccard), not semantic.
- The bundled sample is tiny (10 questions over 2 docs). Real evals want 50+
  diverse questions, adversarial cases, and multiple runs.
- Single-run scores are noisy; RAGJudge reports one run per config. Re-run to check
  stability before making decisions off small gaps.
- The toy `fakeEmbed` in the test suite is a hashing trick for determinism in tests —
  it is not a semantic embedding and is never used by the app.

## Project layout

```
index.html            UI shell (loads transformers.js CDN + assets/*.js?v=1)
assets/
  text.js             tokenize, contentWords, splitSentences, parseCitations
  chunk.js            word-boundary character chunker
  sample-data.js      fictional sample docs + 10 questions
  retrieval.js        BM25 + cosineRetrieve (embed fn injected) + fakeEmbed (tests)
  metrics.js          faithfulness, citationScores, relevance
  answer.js           extractiveAnswer (keyless), buildContextBlock
  embeddings.js       browser-only transformers.js loader
  llm.js             BYOK providers + generateAnswerLLM + judgeFaithfulness
  runner.js           expandMatrix + runEvaluation (deterministic)
  export.js           leaderboardCSV + reportMarkdown
  charts.js           canvas bar chart, no chart lib
  app.js              UI wiring
  style.css           BENCH theme (graphite + signal yellow)
tests/                node --test — 73 tests, all green
SPEC.md               design spec
```

## Tests

```bash
node --test tests/*.test.js
```

73 tests, all passing: chunking, BM25/cosine ranking + determinism, metric math on
synthetic supported/hallucinated answers, citation precision/recall, relevance ordering,
extractive-answer citations, provider adapter shapes, judge validation, matrix expansion,
runner determinism (same input → identical leaderboard), CSV/Markdown export shape, and a
no-key smoke test running the full pipeline on the bundled sample dataset.

## Theme

**BENCH** — graphite lab-bench (`#14161a`) with signal-yellow (`#ffd21f`) accents,
chosen to be visually distinct from the DOJO, RED TEAM, AEGIS, DETONATION, ATELIER,
SWEEP, BROADSHEET, and REWIND themes used by kishore's other projects.
