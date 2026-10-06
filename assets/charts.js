/* RAGJudge — tiny canvas bar chart (no chart library). */
(function (root) {
  root.RAGJudge = root.RAGJudge || {};
  var T = root.RAGJudge;

  function barChart(canvas, opts) {
    opts = opts || {};
    var labels = opts.labels || [], values = opts.values || [];
    var color = opts.color || '#ffd21f';
    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    var W = canvas.clientWidth || 640, H = canvas.clientHeight || 260;
    canvas.width = W * dpr; canvas.height = H * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    var padL = 8, padR = 8, padT = 28, padB = 44;
    var max = Math.max.apply(null, values.concat([1]));
    var n = values.length;
    if (!n) return;
    var bw = (W - padL - padR) / n;
    ctx.font = '11px ui-monospace, monospace';
    for (var i = 0; i < n; i++) {
      var bh = (H - padT - padB) * (values[i] / max);
      var x = padL + i * bw + bw * 0.15, y = H - padB - bh;
      ctx.fillStyle = i === (opts.highlight || 0) ? color : '#3a414c';
      ctx.fillRect(x, y, bw * 0.7, Math.max(1, bh));
      ctx.fillStyle = '#e8e6e1';
      ctx.textAlign = 'center';
      ctx.fillText(Number(values[i]).toFixed(2), x + bw * 0.35, y - 6);
      ctx.save();
      ctx.translate(x + bw * 0.35, H - padB + 8);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#9aa3b2';
      ctx.fillText(String(labels[i]).slice(0, 22), 0, 10);
      ctx.restore();
    }
  }

  T.barChart = barChart;
})(typeof window !== 'undefined' ? window : globalThis);
