/* RAGJudge — word-boundary character chunker. */
(function (root) {
  root.RAGJudge = root.RAGJudge || {};
  var T = root.RAGJudge;

  /* Split text into chunks of ~size chars, keeping word boundaries.
     Overlap keeps the trailing `overlap` chars (cut at a word boundary). */
  function chunkText(text, size, overlap) {
    var chunks = [];
    if (!text || !text.trim()) return chunks;
    size = Math.max(50, size | 0);
    overlap = Math.max(0, Math.min(overlap | 0, size - 1));
    var words = text.split(/\s+/).filter(Boolean);
    var cur = '';
    function flush() { if (cur.trim()) chunks.push(cur.trim()); }
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var add = cur ? cur + ' ' + w : w;
      if (add.length > size && cur) {
        flush();
        var tail = overlap ? cur.slice(-overlap) : '';
        var sp = tail.indexOf(' ');
        tail = sp >= 0 ? tail.slice(sp + 1) : '';
        cur = tail ? tail + ' ' + w : w;
      } else {
        cur = add;
      }
    }
    flush();
    return chunks;
  }

  /* Chunk a doc {id,title,sections:[{id,heading,text}]} → chunk objects. */
  function chunkDocument(doc, size, overlap) {
    var out = [];
    (doc.sections || []).forEach(function (sec) {
      chunkText(sec.text || '', size, overlap).forEach(function (t, ci) {
        out.push({
          id: doc.id + ':' + sec.id + '#' + ci,
          docId: doc.id,
          docTitle: doc.title,
          section: doc.id + ':' + sec.id,
          heading: sec.heading,
          text: t
        });
      });
    });
    return out;
  }

  T.chunkText = chunkText;
  T.chunkDocument = chunkDocument;
})(typeof window !== 'undefined' ? window : globalThis);
