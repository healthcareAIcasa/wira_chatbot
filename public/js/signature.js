/* Finger / mouse / stylus signature pad on a <canvas>. Exports a transparent PNG data URL. */
(function (root) {
  'use strict';
  function SignaturePad(canvas) {
    var ctx = canvas.getContext('2d');
    var drawing = false, last = null, strokes = 0, inkLength = 0;
    var ratio = 1;

    function resize() {
      var data = strokes ? canvas.toDataURL('image/png') : null;
      ratio = Math.max(window.devicePixelRatio || 1, 1);
      var r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * ratio);
      canvas.height = Math.round(r.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0d1f55';
      if (data) { var img = new Image(); img.onload = function () { ctx.drawImage(img, 0, 0, r.width, r.height); }; img.src = data; }
    }
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure || 0.5 }; }
    function down(e) {
      e.preventDefault();
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      drawing = true; last = pos(e); strokes++;
      ctx.beginPath(); ctx.arc(last.x, last.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#0d1f55'; ctx.fill();
      canvas.dispatchEvent(new Event('signature-change'));
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e);
      ctx.lineWidth = 1.6 + 2.2 * (e.pointerType === 'pen' ? p.p : 0.5);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      inkLength += Math.hypot(p.x - last.x, p.y - last.y);
      last = p;
    }
    function up() { drawing = false; }

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', up);
    window.addEventListener('resize', resize);

    this.resize = resize;
    this.clear = function () { ctx.clearRect(0, 0, canvas.width, canvas.height); strokes = 0; inkLength = 0; canvas.dispatchEvent(new Event('signature-change')); };
    this.isEmpty = function () { return strokes === 0 || inkLength < 25; };
    this.toPNG = function () {
      // crop to the ink (plus a margin) so the signature fills the box on the PDF, and keep the upload small
      var w = canvas.width, h = canvas.height;
      var px = ctx.getImageData(0, 0, w, h).data;
      var minX = w, minY = h, maxX = -1, maxY = -1;
      for (var y = 0; y < h; y += 2) {
        for (var x = 0; x < w; x += 2) {
          if (px[(y * w + x) * 4 + 3] > 10) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
      }
      if (maxX < 0) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
      var pad = Math.round(10 * ratio);
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
      var cw = maxX - minX + 1, ch = maxY - minY + 1;
      var scale = Math.min(1, 1000 / cw);
      var out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(cw * scale)); out.height = Math.max(1, Math.round(ch * scale));
      out.getContext('2d').drawImage(canvas, minX, minY, cw, ch, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    };
  }
  root.SignaturePad = SignaturePad;
})(window);
