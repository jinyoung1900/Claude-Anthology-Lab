/* All sound is synthesised: rain bed, plinks, thunder, birdsong. */
var Sound = (function () {
  'use strict';
  var ac = null, out, rainGain, rainLow, on = true, noiseBuf, lastPlink = 0;
  var SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];

  function start() {
    if (ac || !on) return;
    var A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    try { ac = new A(); } catch (e) { ac = null; return; }
    out = ac.createGain(); out.gain.value = 0.8; out.connect(ac.destination);
    var n = ac.sampleRate * 3; noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
    var d = noiseBuf.getChannelData(0), b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.05) * 1.6; }
    var src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380;
    rainLow = ac.createBiquadFilter(); rainLow.type = 'lowpass'; rainLow.frequency.value = 2200;
    rainGain = ac.createGain(); rainGain.gain.value = 0;
    src.connect(hp); hp.connect(rainLow); rainLow.connect(rainGain); rainGain.connect(out); src.start();
  }
  function tone(f, t, len, vol, type, f2) {
    var o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02);
  }
  function ready() { return on && ac && ac.state === 'running'; }
  return {
    unlock: function () { start(); if (ac && ac.state === 'suspended' && on) ac.resume(); },
    prefer: function (b) { on = b; }, // browsers refuse audio before the first touch
    enable: function (b) { on = b; if (!ac) { if (b) start(); return; } b ? ac.resume() : ac.suspend(); },
    pause: function () { if (ac && ac.state === 'running') ac.suspend(); },
    resume: function () { if (ac && on) ac.resume(); },
    rain: function (k, storm) {
      if (!ready()) return;
      rainGain.gain.setTargetAtTime(Math.min(0.2, 0.15 * k + 0.1 * storm), ac.currentTime, 0.8);
      rainLow.frequency.setTargetAtTime(1500 + 3200 * k + 1500 * storm, ac.currentTime, 0.8);
    },
    plink: function () {
      if (!ready() || ac.currentTime - lastPlink < 0.045) return;
      lastPlink = ac.currentTime;
      var f = SCALE[Math.floor(Math.random() * SCALE.length)] * 1.5; tone(f * 0.72, ac.currentTime, 0.13, 0.09, 'sine', f);
    },
    buy: function () { if (!ready()) return; var t = ac.currentTime, i = Math.floor(Math.random() * 3); tone(SCALE[i], t, 0.16, 0.09, 'triangle'); tone(SCALE[i + 2], t + 0.06, 0.22, 0.08, 'triangle'); },
    chime: function () { if (!ready()) return; var t = ac.currentTime; [0, 2, 4, 5].forEach(function (n, i) { tone(SCALE[n], t + i * 0.1, 0.6, 0.08, 'sine'); }); },
    thunder: function () {
      if (!ready()) return;
      var t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(70, t + 2.4);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.03); g.gain.exponentialRampToValueAtTime(0.22, t + 0.5); g.gain.exponentialRampToValueAtTime(0.4, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + 3);
    },
    chirp: function () { if (!ready()) return; var t = ac.currentTime, b = 2300 + Math.random() * 900; for (var i = 0; i < 2 + Math.random() * 3; i++) tone(b, t + i * 0.11, 0.07, 0.022, 'sine', b * 1.35); },
    steam: function () {
      if (!ready()) return;
      var t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = 0.7; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(6000, t + 3);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
      s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 3.6);
    }
  };
})();
