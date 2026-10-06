/* RAGJudge — browser-only embedding loader (transformers.js).
   Kept in its own file so tests never touch it. */
(function (root) {
  root.RAGJudge = root.RAGJudge || {};
  var T = root.RAGJudge;

  var _embedder = null;
  var _state = 'idle'; /* idle | loading | ready | failed */

  /* Loads all-MiniLM-L6-v2 (~90MB, cached by the browser after first download).
     Returns an async embed(text) => number[], or null when unavailable. */
  async function loadEmbedder(onStatus) {
    if (_state === 'ready') return _embedder;
    if (_state === 'loading') return null;
    _state = 'loading';
    try {
      if (!root.transformers) throw new Error('transformers.js CDN not loaded');
      var pipe = await root.transformers.pipeline(
        'feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      _embedder = async function (text) {
        var out = await pipe(text || ' ', { pooling: 'mean', normalize: true });
        return Array.from(out.data);
      };
      _state = 'ready';
      if (onStatus) onStatus('ready');
      return _embedder;
    } catch (e) {
      _state = 'failed';
      if (onStatus) onStatus('failed', String((e && e.message) || e));
      return null;
    }
  }

  function embedderState() { return _state; }

  T.loadEmbedder = loadEmbedder;
  T.embedderState = embedderState;
})(typeof window !== 'undefined' ? window : globalThis);
