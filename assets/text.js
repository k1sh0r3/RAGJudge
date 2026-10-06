/* RAGJudge — text utilities shared by chunking, retrieval, metrics. */
(function (root) {
  root.RAGJudge = root.RAGJudge || {};
  var T = root.RAGJudge;

  var STOP = {};
  ('a,an,the,and,or,but,if,then,else,for,to,of,in,on,at,by,with,from,as,is,are,was,were,' +
   'be,been,being,it,its,this,that,these,those,you,your,we,our,they,their,he,she,his,her,' +
   'do,does,did,not,no,yes,can,will,should,may,might,must,have,has,had,all,any,each,other,' +
   'more,most,some,such,than,too,very,just,only,also,into,over,after,before,between,' +
   'through,during,about,up,down,out,off,when,where,which,who,whom,what,how,why,because,' +
   'while,until,again,once,here,there,per,say,said,like,get,got,make,made').split(',')
   .forEach(function (w) { STOP[w] = true; });

  /* Lowercase alphanumeric tokens. */
  function tokenize(text) {
    return ((text || '').toLowerCase().match(/[a-z0-9]+/g) || []);
  }

  /* Tokens with stopwords and tiny tokens removed — the "content" of a string. */
  function contentWords(text) {
    return tokenize(text).filter(function (t) { return !STOP[t] && t.length > 2; });
  }

  /* Naive sentence splitter (good enough for eval claims). */
  function splitSentences(text) {
    var parts = (text || '').match(/[^.!?]+[.!?]+["']?/g) || [text || ''];
    return parts.map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* Extract 1-based citation markers like [1], [12] in order of appearance. */
  function parseCitations(text) {
    var out = [];
    var re = /\[(\d+)\]/g, m;
    while ((m = re.exec(text || '')) !== null) out.push(parseInt(m[1], 10));
    return out;
  }

  function mean(arr) {
    if (!arr || !arr.length) return 0;
    return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
  }

  T.tokenize = tokenize;
  T.contentWords = contentWords;
  T.splitSentences = splitSentences;
  T.parseCitations = parseCitations;
  T.mean = mean;
  T.STOP = STOP;
})(typeof window !== 'undefined' ? window : globalThis);
