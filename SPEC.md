# RAGJudge — SPEC

**Tagline:** "Prove your RAG works."
**What:** A 100% client-side RAG evaluation harness. Feed it documents + test questions with
reference answers, configure a matrix of RAG settings, and it scores every configuration on
faithfulness, citation quality, and answer relevance — then ranks them on a leaderboard.

**Why it matters:** Evals are the hottest interview topic in AI engineering. RAGJudge is the
natural companion to VaultChat: one builds a RAG app, the other proves RAG works. It
demonstrates eval design, retrieval (BM25 + dense), and honest measurement — all keyless.

## Theme: BENCH

Graphite lab-bench aesthetic — **not** one of the banned themes (DOJO, RED TEAM, AEGIS,
DETONATION, ATELIER, SWEEP, BROADSHEET, REWIND).
- Background: graphite `#14161a`; panels `#1d2127`; borders `#2c323b`
- Accent: signal yellow `#ffd21f`; secondary: bench-green `#7ee787` (pass), `#ff7b72` (fail)
- Text: off-white `#e8e6e1`; mono numerals via `ui-monospace`
- Texture: faint blueprint grid on the header; chunky "lab equipment" cards, stencil-ish headings

## Architecture (all static, no build step, $0)

```
index.html  → loads transformers.js CDN + assets/*.js?v=N + style.css?v=N
assets/
  text.js        tokenize, contentWords (stopword filter), splitSentences, parseCitations
  chunk.js       word-boundary char chunker; chunkDocument() → chunks with section ids
  sample-data.js SAMPLE_DOCS (2 docs, 11 sections) + SAMPLE_QUESTIONS (10, with goldSections)
  retrieval.js   bm25(), cosineSim(), cosineRetrieve() (embed fn injected), fakeEmbed()
  metrics.js     faithfulness() per-claim verdicts, citationScores() P/R, relevance()
  answer.js      extractiveAnswer() (keyless, cited), buildContextBlock()
  embeddings.js  browser-only: transformers.js all-MiniLM-L6-v2 loader (~90MB once)
  llm.js         BYOK providers (openai/gemini/groq/custom) + generateAnswerLLM + judgeFaithfulness
  runner.js      expandMatrix(), runEvaluation() → ranked leaderboard, deterministic
  export.js      leaderboardCSV(), reportMarkdown()
  charts.js      canvas barChart() (no chart lib)
  app.js         UI wiring, localStorage dataset persistence
tests/           node --test, 55+ tests, incl. no-key smoke test on the sample dataset
```

Namespace: every module attaches to `window.RAGJudge` (works from `file://` too; tests
`require()` the files and read `globalThis.RAGJudge`).

## Data model

- Doc: `{ id, title, sections: [{ id, heading, text }] }`
- Chunk: `{ id, docId, docTitle, section: "docId:sectionId", heading, text }`
- Question: `{ id, question, reference, goldSections: ["docId:sectionId", ...] }`
- Config ("contestant"): `{ name, chunkSize, overlap, topK, retrieval }`
- Result per config: per-question `{ answer, mode, retrieved[], faithfulness, claims[],
  citationP, citationR, citations[], relevance, latencyMs, llmJudge }` + aggregates.

## Metrics (all original implementations — no Ragas/DeepEval code)

1. **Faithfulness** (0–1): split the answer into sentences (= claims). A claim is *supported*
   if ≥60% of its content-word tokens appear in some single retrieved-context sentence.
   Score = supported / judged claims; per-claim verdicts shown in drill-down.
2. **Citation precision / recall** (0–1): answers cite chunks as `[1]…[k]` (rank positions).
   A citation is correct if the cited chunk's section is in the question's `goldSections`.
   P = correct / cited; R = distinct gold sections cited / gold sections.
3. **Answer relevance** (0–1): cosine(question, answer) via embeddings; token-Jaccard fallback
   when no embedder is available.
4. **Latency** (ms): measured per config with `performance.now()`; reported, not ranked.
5. **LLM-as-judge** (optional BYOK): re-scores faithfulness 1–5 with a rationale, shown
   side-by-side with the heuristic score. Never replaces it.

Ranking: mean faithfulness desc, tie-break mean relevance desc. Winner row highlighted.

## Answer modes (honest labeling in UI)

- **Keyless:** extractive answers — top question-overlapping sentences from retrieved chunks,
  each cited `[n]`. Faithful by construction, often less complete. Badge: "Extractive mode".
- **BYOK:** LLM answers grounded on retrieved chunks, instructed to cite `[n]`.
  Badge shows the provider name.

## Retrieval modes

- **BM25** (k1=1.2, b=0.75) — always available, deterministic.
- **Cosine** over in-browser embeddings (transformers.js `all-MiniLM-L6-v2`, ~90MB download
  once). If loading fails, cosine configs fall back to BM25 and the UI says so.

## Config matrix

Checkboxes: chunk size {256, 512, 1024}, overlap {0, 50}, top-k {3, 5, 10},
retrieval {bm25, cosine}. Matrix = cartesian product; UI shows contestant count and warns
above 12. Default: sizes {256, 1024}, overlap {50}, topK {3, 5}, retrieval {bm25, cosine}
→ 8 contestants.

## Export

- `leaderboard.csv`: one row per config with all aggregate metrics.
- `report.md`: leaderboard table + per-question drill-down (answers, verdicts, citations).

## Honest limitations (also in README + UI footnote)

- The heuristic faithfulness judge is token-overlap, not NLI: paraphrase-heavy answers can
  score low despite being correct; extractive answers score high by construction.
- Citation gold labels are section-level and author-defined; "correct" is approximate.
- Relevance fallback is lexical, not semantic, without embeddings.
- Sample dataset is tiny (10 questions) — real evals need 50+ diverse questions.
- LLM judge quality depends on the model; it can disagree with the heuristic — that
  disagreement is itself signal, shown side-by-side rather than hidden.

## Test plan

`node --test tests/*.test.js` — 55+ tests: chunking, BM25/cosine ranking + determinism,
metric math on synthetic supported/hallucinated cases, citation P/R, relevance ordering,
extractive answer citations, provider adapter shapes, judge validation, matrix expansion,
runner determinism (same input → identical leaderboard), CSV/Markdown shape, and a no-key
smoke test running the full pipeline on the bundled sample dataset.
