/* Pixel-art scene. Everything is drawn into a small framebuffer with a limited palette and ordered
   dithering, then blown up with no smoothing. No images: clouds, plants and hills are procedural. */
var Scene = (function () {
  'use strict';

  var cv, cx, img, buf, aw = 138, ah = 298, W = 412, H = 892, PX = 3;
  var sceneT = 480, sceneCss = 480, padCss = 110;          // css px
  var SH = 160, TOP = 36, LH = 66, LT = 94;                // art px: scene bottom, hud bottom, land height, land top
  var land = null, landKey = '';
  var T = 0, info = { growth: 0, intensity: 0, owned: [], storm: false, rainbow: false, charge: 0, biome: 0 };
  var drops = [], splashes = [], floats = [], motes = [], bolts = [], wisps = [], small = [];
  var swallow = null, flash = 0, shake = 0, storm = 0, rainbow = 0, evap = null, lastLT = 94;
  var cloud = { x: 69, y: 70, r: 18, sq: 0, sv: 0, blink: 2, blinkT: 0, happy: 0, gasp: 0 };
  var calm = false;
  try { calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // ---------- maths ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed & 0xfffffff) / 0xfffffff; }; }
  function hash(x, y, s) { var n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    return lerp(lerp(hash(xi, yi, s), hash(xi + 1, yi, s), u), lerp(hash(xi, yi + 1, s), hash(xi + 1, yi + 1, s), u), v);
  }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(function (n) { return (n + 0.5) / 16; });
  function dith(x, y) { return (bay(x, y) - 0.5) * 0.6; } // narrow dither: flat bands with soft joins
  function bay(x, y) { return BAYER[((y & 3) << 2) | (x & 3)]; }

  // ---------- colour ----------
  function hex(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function pack(c) { return (0xff000000 | (c[2] & 255) << 16 | (c[1] & 255) << 8 | (c[0] & 255)) >>> 0; }
  function ramp(a) { return a.map(hex); }

  // Land is stored as palette indices and lit through a lookup each frame, so day, night and storms are free.
  var I = { F: 1, M: 4, N: 8, CR: 12, W: 13, G: 17, Q: 21, TR: 24, FL: 26, FC: 29, RD: 30, CB: 31, RF: 33, ST: 35, DR: 36, WIN: 37, LP: 38, RK: 39, TN: 41, TH: 43, FN: 45, END: 46 };
  var pal = [], lut = new Uint32Array(64);
  var BIOMES = [
    { dry: ['#8f6a52', '#a87e5c', '#c49a74', '#d8b48e'], far: ['#b98f78', '#cda58c', '#dfc0a6'], crack: '#5f3f2c', g: ['#1f5040', '#33714a', '#559653', '#8fbf62'], farL: ['#6d9a98', '#86b0a6', '#a6c8b4'], fl: ['#f7cf52', '#fbf3e2', '#ea7f5c'] },
    { dry: ['#6f2f24', '#8f4330', '#ad5c40', '#c97c56'], far: ['#a9685a', '#c08070', '#d7a08c'], crack: '#4a1c18', g: ['#2c4a30', '#4b6f38', '#769a44', '#abc25c'], farL: ['#8a9480', '#a3aa90', '#c0c2a6'], fl: ['#fbeeb8', '#ea6b96', '#f6a93e'] },
    { dry: ['#8d8474', '#a69c8a', '#c2b9a6', '#dcd5c4'], far: ['#b3b4ae', '#c8c9c3', '#dedfd8'], crack: '#6b6252', g: ['#1f5450', '#35766a', '#5a9c82', '#92c4a0'], farL: ['#84acb0', '#9dc0c0', '#bcd6d0'], fl: ['#fbf7ee', '#ee93b6', '#f5d664'] },
    { dry: ['#39353c', '#4d484f', '#656068', '#827c84'], far: ['#77747c', '#8e8b92', '#a8a5aa'], crack: '#211f26', g: ['#123c3c', '#1f5c48', '#3a8256', '#74ae66'], farL: ['#5c8484', '#759c96', '#96b6aa'], fl: ['#f0603e', '#fadc62', '#f5f1ea'] },
    { dry: ['#5f5a3e', '#78724e', '#938d66', '#b0aa82'], far: ['#8f9a96', '#a6b0a8', '#c0c8bc'], crack: '#403c28', g: ['#17494a', '#2c6a58', '#4e9068', '#86b87e'], farL: ['#6f97ac', '#8aaebe', '#abc8d0'], fl: ['#9a8ade', '#f6f2e6', '#62b0e0'] }
  ].map(function (b) { var o = {}; for (var k in b) o[k] = Array.isArray(b[k]) ? ramp(b[k]) : hex(b[k]); return o; });
  var WATER = ramp(['#1f5a86', '#3380ab', '#57a6c8', '#a8dcea']);

  function buildPalette(g, b) {
    var B = BIOMES[b], far = smooth(0.2, 0.9, g), mid = smooth(0.22, 0.75, g), i;
    function put(at, list) { list.forEach(function (c, j) { pal[at + j] = c; }); }
    put(I.F, [0, 1, 2].map(function (j) { return mix(B.far[j], B.farL[j], far); }));
    put(I.M, [0, 1, 2, 3].map(function (j) { return mix(mix(B.dry[j], B.far[2], 0.28), mix(B.g[j], B.farL[1], 0.34), mid); }));
    put(I.N, [0, 1, 2, 3].map(function (j) { return mix(B.dry[j], mix(B.g[j], B.dry[j], 0.45), smooth(0.1, 0.5, g)); }));
    put(I.CR, [B.crack]); put(I.W, WATER); put(I.G, B.g);
    put(I.Q, [0, 1, 2].map(function (j) { return mix(B.g[j], B.farL[0], 0.3); }));
    put(I.TR, ramp(['#4a3230', '#7a5644'])); put(I.FL, B.fl); put(I.FC, [hex('#fff6c8')]);
    put(I.RD, [hex('#6a4632')]); put(I.CB, ramp(['#5a3a2e', '#835840'])); put(I.RF, ramp(['#7a2f30', '#b0493c']));
    put(I.ST, [hex('#6e6468')]); put(I.DR, [hex('#33211f')]); put(I.LP, [hex('#f8dbe6')]); put(I.RK, ramp(['#5c5a62', '#8b8890']));
    put(I.TN, ramp(['#e8d6a8', '#cf8f4e'])); put(I.TH, ramp(['#a07a3a', '#d2ab58'])); put(I.FN, [hex('#8a6a4a')]);
    pal[I.WIN] = hex('#9cc0cc');
  }

  // Time of day, as keyframes around a 5 minute loop.
  var DAY = [
    { t: 0.00, a: '#6fb2da', b: '#d8eee4', tint: [255, 255, 255], k: 0 },
    { t: 0.42, a: '#62a8d6', b: '#dfeedd', tint: [255, 255, 255], k: 0 },
    { t: 0.55, a: '#6a6ca6', b: '#f8b47c', tint: [190, 96, 92], k: 0.26 },
    { t: 0.64, a: '#2a3362', b: '#86689a', tint: [38, 40, 98], k: 0.48 },
    { t: 0.70, a: '#0f1836', b: '#2d4272', tint: [12, 22, 66], k: 0.62 },
    { t: 0.86, a: '#111c3c', b: '#34497a', tint: [12, 22, 66], k: 0.6 },
    { t: 0.94, a: '#7a8cc0', b: '#f8c8ae', tint: [150, 96, 130], k: 0.24 },
    { t: 1.00, a: '#6fb2da', b: '#d8eee4', tint: [255, 255, 255], k: 0 }
  ].map(function (k) { k.a = hex(k.a); k.b = hex(k.b); return k; });
  function sky() {
    var t = (T / 300 + 0.04) % 1, i = 0;
    while (i < DAY.length - 2 && DAY[i + 1].t <= t) i++;
    var p = DAY[i], q = DAY[i + 1], f = smooth(0, 1, (t - p.t) / (q.t - p.t));
    var s = { t: t, a: mix(p.a, q.a, f), b: mix(p.b, q.b, f), tint: mix(p.tint, q.tint, f), k: lerp(p.k, q.k, f), night: smooth(0.6, 0.7, t) * (1 - smooth(0.86, 0.95, t)) };
    if (storm > 0.01) {
      s.a = mix(s.a, mix([36, 46, 72], [14, 18, 36], s.night), storm * 0.88); s.b = mix(s.b, mix([104, 118, 132], [42, 50, 74], s.night), storm * 0.82);
      s.tint = mix(s.tint, [44, 54, 88], storm * 0.8); s.k = Math.max(s.k, storm * 0.42);
    }
    return s;
  }

  // ---------- framebuffer ----------
  function px(x, y, c) { if (x >= 0 && y >= 0 && x < aw && y < ah) buf[y * aw + x] = c; }
  function pxa(x, y, c, a) { if (a > bay(x, y)) px(x, y, c); }
  function rect(x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) px(x + i, y + j, c); }
  function disc(x, y, r, c, a) { var R = Math.ceil(r); for (var j = -R; j <= R; j++) for (var i = -R; i <= R; i++) if (i * i + j * j <= r * r) { if (a === undefined) px(x + i, y + j, c); else pxa(x + i, y + j, c, a); } }
  function line(x0, y0, x1, y1, f) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (var i = 0; i <= n; i++) f(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n))); }
  function sprite(rows, key, x, y, flip) {
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) { var c = key[rows[j][i]]; if (c !== undefined) px(x + (flip ? rows[j].length - 1 - i : i), y + j, c); }
  }
  function textW(s) { var w = 0; for (var i = 0; i < s.length; i++) w += (FONT[s[i]] || FONT['?']).w + 1; return w - 1; }
  function text(s, x, y, c, o) {
    function pass(dx, dy, col) {
      var at = x + dx;
      for (var i = 0; i < s.length; i++) { var g = FONT[s[i]] || FONT['?']; for (var j = 0; j < g.rows.length; j++) for (var k = 0; k < g.w; k++) if (g.rows[j][k] === '#') px(at + k, y + dy + g.y + j, col); at += g.w + 1; }
    }
    for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) if (a || b) pass(a, b, o);
    pass(0, 0, c);
  }

  // ---------- land (palette indices) ----------
  function ridge(x, y0, amp, f, s) { var u = x / aw * 4.2; return (y0 + (Math.sin(u * f + s) * 0.5 + Math.sin(u * f * 2.3 + s * 2.3) * 0.3 + Math.sin(u * f * 4.9 + s * 0.7) * 0.2) * amp) * LH; }
  function rFar(x, b) { return Math.round(ridge(x, 0.17, 0.15, 1.05, b * 3.1 + 1)); }
  function rMid(x, b) { return Math.round(ridge(x, 0.40, 0.075, 0.7, b * 5.7 + 4)); }
  function rNear(x, b) { return Math.round(ridge(x, 0.555, 0.035, 0.6, b * 2.2 + 9)); }
  function lakeK(g) { return smooth(0.1, 0.62, g); }
  function lakeR(k) { return { x: aw * 0.5, y: LH * 0.79, rx: Math.min(aw * 0.40, LH * 1.2) * k, ry: LH * 0.14 * Math.pow(k, 0.8) }; }
  function lakeD(x, y, L, b) { // 1 at the shore
    var dx = (x - L.x) / (L.rx + 0.01), dy = (y - L.y) / (L.ry + 0.01), a = Math.atan2(dy, dx);
    return Math.sqrt(dx * dx + dy * dy) / (1 + 0.07 * Math.sin(a * 3 + b) + 0.05 * Math.sin(a * 5 + b * 2 + 1));
  }

  var plants = [], plantB = -1;
  function seedPlants(b) {
    plantB = b; plants = [];
    var r = rng(4211 + b * 977), i, a;
    function add(k, u, v, at, sc) { plants.push({ k: k, u: u, v: v, at: at, sc: sc, h: r(), c: Math.floor(r() * 3) }); }
    for (i = 0; i < 24; i++) add('pineM', r(), 0, 0.58 + r() * 0.24, 0.6 + r() * 0.5);
    for (i = 0; i < 18; i++) add('treeM', r(), 0, 0.5 + r() * 0.3, 0.6 + r() * 0.5);
    for (i = 0; i < 6; i++) add('rock', r(), 0.6 + r() * 0.38, -1, 0.7 + r() * 0.6);
    for (i = 0; i < 60; i++) add('tuft', r(), 0.6 + r() * 0.4, 0.2 + r() * 0.25, 0.7 + r() * 0.6);
    for (i = 0; i < 52; i++) add('flower', r(), 0.6 + r() * 0.4, 0.33 + r() * 0.25, 0.8 + r() * 0.5);
    for (i = 0; i < 12; i++) add('bush', r(), 0.6 + r() * 0.36, 0.42 + r() * 0.3, 0.8 + r() * 0.5);
    for (i = 0; i < 14; i++) add(r() < 0.55 ? 'tree' : 'pine', i % 2 ? 0.82 + r() * 0.2 : -0.02 + r() * 0.2, 0.6 + r() * 0.28, 0.52 + r() * 0.36, 0.85 + r() * 0.5);
    for (i = 0; i < 8; i++) add(r() < 0.5 ? 'tree' : 'pine', 0.12 + r() * 0.76, 0.57 + r() * 0.02, 0.58 + r() * 0.3, 0.5 + r() * 0.2);
    for (i = 0; i < 24; i++) { a = r() * 6.283; plants.push({ k: 'reed', a: a, q: 1.04, at: 0.6 + r() * 0.18, sc: 0.8 + r() * 0.5, h: r(), c: 0 }); }
    for (i = 0; i < 11; i++) { a = r() * 6.283; plants.push({ k: 'lily', a: a, q: 0.3 + r() * 0.5, at: 0.66 + r() * 0.2, sc: 1, h: r(), c: 0 }); }
  }
  var CABIN = [
    '.............ss....', '.............ss....', '........rr...ss....', '.......rRRr..ss....', '......rRRRRr.ss....', '.....rRRRRRRrss....', '....rRRRRRRRRrs....',
    '...rRRRRRRRRRRr....', '..rrrrrrrrrrrrrr...', '...WWWWWWWWWWWW....', '...WWWWWWWWWWWW....', '...WddWWWyyyWWW....', '...wddwwwyyywww....', '...WddWWWyyyWWW....', '...wddwwwwwwwww....', '...WddWWWWWWWWW....'];
  var TENT = ['......t......', '.....ttT.....', '.....ttT.....', '....tttTT....', '....ttdTT....', '...tttdTTT...', '...ttddTTT...', '..tttdddTTT..', '.ttttdddTTTT.'];
  var HUT = ['.......h.......', '.....hhhhh.....', '....hhHHHhh....', '...hHHHHHHHh...', '..hHHHHHHHHHh..', '.hHHHHHHHHHHHh.', 'hhhhhhhhhhhhhhh', '..WWWWWWWWWWW..', '..WWddWWWyyWW..', '..wwddwwwyyww..', '..WWddWWWWWWW..', '..wwddwwwwwww..'];
  var COTTAGE = ['..........ss...', '......r...ss...', '.....rRr..ss...', '....rRRRr.ss...', '...rRRRRRrss...', '..rRRRRRRRrs...', '.rRRRRRRRRRr...', 'rrrrrrrrrrrrr..', '.WWWWWWWWWWW...', '.WWddWWWyyWW...', '.wwddwwwyyww...', '.WWddWWWWWWW...', '.wwddwwwwwww...'];
  var HOMEKEY = { s: I.ST, r: I.RF, R: I.RF + 1, w: I.CB, W: I.CB + 1, d: I.DR, y: I.WIN, t: I.TN, T: I.TN + 1, h: I.TH, H: I.TH + 1 };
  // Where people settle, and what stands there from each valley stage on.
  var SITES = [
    { u: 0.19, v: 0.655, homes: [[2, TENT], [4, HUT], [6, CABIN]] },
    { u: 0.84, v: 0.66, homes: [[5, TENT], [7, HUT], [9, CABIN]] },
    { u: 0.41, v: 0.61, homes: [[8, HUT], [10, COTTAGE]] },
    { u: 0.60, v: 0.605, homes: [[9, TENT], [10, COTTAGE]] }
  ];
  var lamps = [], chimneys = [], puddles = [], built = [], fire = null, dock = null;
  function stageNow() { return Math.floor(info.growth * 11 + 0.001); }

  function renderLand() {
    var g = info.growth, b = info.biome % 5, key = [aw, LH, b, Math.round(g * 240)].join();
    if (key === landKey) return;
    landKey = key;
    if (plantB !== b) seedPlants(b);
    buildPalette(g, b);
    land = new Uint8Array(aw * LH);
    var x, y, i, j, v, t, L = lakeR(lakeK(g));
    function set(x, y, c) { if (x >= 0 && y >= 0 && x < aw && y < LH) land[y * aw + x] = c; }
    function get(x, y) { return x >= 0 && y >= 0 && x < aw && y < LH ? land[y * aw + x] : 0; }
    var grass = smooth(0.14, 0.52, g), damp = smooth(0.02, 0.12, g);
    for (x = 0; x < aw; x++) {
      var f = rFar(x, b), m = rMid(x, b), n = rNear(x, b), fs = rFar(x + 1, b) - f;
      for (y = Math.max(0, f); y < m + 2; y++) { // far hills: lit left faces, haze at the foot
        t = (y - f) / (LH * 0.34); v = 0.9 - fs * 0.35 + (vnoise(x / 5, y / 4, b + 3) - 0.5) * 0.9 + t * 1.1 - (y === f ? -1 : 0);
        set(x, y, I.F + clamp(Math.floor(v + 0.4 + dith(x, y)), 0, 2));
      }
      for (y = m; y < n + 2; y++) { // middle hills
        v = y === m ? 3 : 1.5 + (vnoise(x / 9, y / 3, b + 8) - 0.5) * 2.2 + (y - m) / (LH * 0.2) * 0.8;
        set(x, y, I.M + clamp(Math.floor(v + dith(x, y)), 0, 3));
      }
      for (y = n; y < LH; y++) { // valley floor: grass spreads pixel by pixel
        t = (y - n) / (LH - n);
        var isG = vnoise(x / 8, y / 3.5, b + 21) * 0.85 + hash(x, y, 5) * 0.15 < grass * 1.12;
        v = 2.9 - t * 2.1 + (vnoise(x / 10, y / 3.5, b + 40) - 0.5) * 2 - (isG ? 0 : damp * (vnoise(x / 12, y / 4, b + 60) > 0.5 ? 0.8 : 0.1));
        if (y === n) v = 3.2;
        set(x, y, (isG ? I.G : I.N) + clamp(Math.floor(v + dith(x, y)), 0, 3));
      }
    }
    function dirt(x, y) { var c = get(x, y); return c >= I.N && c < I.N + 4; }
    // cracks close up as the ground drinks
    var ck = 1 - smooth(0.06, 0.28, g), r = rng(99 + b * 31);
    for (i = 0; i < 30 * ck; i++) {
      x = r() * aw; y = (0.6 + r() * 0.4) * LH; var d = lerp(0.5, 1.1, (y / LH - 0.6) / 0.4), way = r() < 0.5 ? -1 : 1;
      for (j = 0; j < 3; j++) { var nx = x + way * (2 + r() * 4) * d, ny = y + (r() - 0.5) * 3 * d; line(x, y, nx, ny, function (a, c) { if (dirt(a, c)) set(a, c, I.CR); }); x = nx; y = ny; if (j === 1 && r() < 0.6) line(x, y, x + way * 2 * d, y + (r() < 0.5 ? -2 : 2) * d, function (a, c) { if (dirt(a, c)) set(a, c, I.CR); }); }
    }
    // water
    function water(x, y, v) { set(x, y, I.W + clamp(Math.floor(v + dith(x, y)), 0, 2)); }
    puddles.length = 0;
    var pu = smooth(0.09, 0.16, g) * (1 - smooth(0.34, 0.5, g)), r4 = rng(3 + b);
    for (i = 0; i < 7; i++) {
      var cxp = (0.08 + r4() * 0.84) * aw, cyp = (0.66 + r4() * 0.3) * LH, rx = (3 + r4() * 6) * pu, ry = (1 + r4() * 1.4) * pu;
      if (pu > 0.1) puddles.push({ x: cxp, v: cyp / LH });
      if (pu > 0.1) for (y = -3; y <= 3; y++) for (x = -10; x <= 10; x++) if (x * x / (rx * rx) + y * y / (ry * ry) < 1) water(Math.round(cxp) + x, Math.round(cyp) + y, 1.8 - y * 0.5);
    }
    var rk = smooth(0.4, 0.52, g);
    if (rk > 0) {
      var sx = Math.round(0.7 * aw), y0 = rNear(sx, b), y1 = Math.round(L.y - L.ry * 0.6);
      for (y = y0; y <= y1; y++) { t = (y - y0) / Math.max(1, y1 - y0); if (t > rk) break; var mx = lerp(sx, L.x + L.rx * 0.45, t) + Math.sin(t * 8) * 4 * (1 - t * 0.6), hw = lerp(0.6, 2.6, t); for (x = Math.round(mx - hw); x <= mx + hw; x++) water(x, y, 2 + hash(x, y, 2) * 0.8); set(Math.round(mx - hw) - 1, y, I.G); }
    }
    if (L.rx > 1) for (y = Math.floor(L.y - L.ry * 1.3); y <= L.y + L.ry * 1.3; y++) for (x = 0; x < aw; x++) {
      var ld = lakeD(x, y, L, b);
      if (ld < 1) { t = (y - L.y) / L.ry; var deep = 1 - ld; if (deep * L.ry < 0.9 && t < 0.2) set(x, y, I.W + 3); else water(x, y, 2.5 - (t + 1) * 1.0 - deep * 0.5); }
      else if ((ld - 1) * L.ry < 1 && y < LH) set(x, y, y < L.y ? I.N : I.N + 2);
    }
    // the settlement
    var st = stageNow();
    lamps.length = chimneys.length = built.length = 0; fire = null; dock = null;
    SITES.forEach(function (s) {
      var art = null; s.homes.forEach(function (h) { if (st >= h[0]) art = h[1]; });
      if (art) built.push({ k: 'home', art: art, x: Math.round(s.u * aw), y: Math.round(s.v * LH) });
    });
    if (st >= 1) fire = { x: Math.round(0.31 * aw), y: Math.round(0.635 * LH) };
    if (st >= 7 && L.rx > 10) { // a dock to fish from
      dock = { x: Math.round(L.x + L.rx * 0.58), y: Math.round(L.y - L.ry * 0.12) };
      for (x = dock.x; x < L.x + L.rx * 1.04; x++) { set(x, dock.y, I.CB + 1); set(x, dock.y + 1, x % 3 ? I.CB + 1 : I.CB); if ((x - dock.x) % 6 === 1) { set(x, dock.y + 2, I.CB); set(x, dock.y + 3, I.CB); } }
    }
    if (st >= 6) for (j = 0; j < 3; j++) for (i = 0; i < 9; i++) { // vegetable rows
      x = Math.round(0.045 * aw) + i + j; y = Math.round(0.7 * LH) + j * 2; set(x, y, I.CR); if (i % 2 === 0) { set(x, y - 1, st > 7 && i % 4 === 0 ? I.FL + 2 : I.G + 3); }
    }
    function nearHome(x, y) { return built.some(function (h) { return Math.abs(x - h.x) < 11 && y > h.y - 5 && y < h.y + 11; }) || fire && Math.abs(x - fire.x) < 6 && Math.abs(y - fire.y) < 6; }
    var all = plants.map(function (p) {
      if (p.k === 'reed' || p.k === 'lily') { p.x = Math.round(L.x + Math.cos(p.a) * L.rx * p.q); p.y = Math.round(L.y + Math.sin(p.a) * L.ry * p.q); }
      else { p.x = Math.round(p.u * aw); p.y = p.k === 'treeM' || p.k === 'pineM' ? rMid(p.x, b) + 1 : Math.max(Math.round(p.v * LH), rNear(clamp(p.x, 0, aw), b) + 1); }
      return p;
    });
    all.filter(function (p) { return p.k === 'lily' || p.k === 'treeM' || p.k === 'pineM'; }).forEach(draw);
    all.filter(function (p) { return p.k !== 'lily' && p.k !== 'treeM' && p.k !== 'pineM'; }).concat(built).sort(function (p, q) { return p.y - q.y; }).forEach(draw);
    if (st >= 9) [[0.28, 0.67], [0.75, 0.67], [0.5, 0.625]].forEach(function (q) { // lantern posts
      var lx = Math.round(q[0] * aw), ly = Math.round(q[1] * LH); for (var k = 0; k < 6; k++) set(lx, ly - k, I.DR); set(lx, ly - 6, I.WIN); lamps.push({ x: lx, y: ly - 6, r: 8 });
    });
    if (fire) { set(fire.x - 2, fire.y, I.RK); set(fire.x + 2, fire.y, I.RK); set(fire.x - 1, fire.y, I.CB); set(fire.x, fire.y, I.CB + 1); set(fire.x + 1, fire.y, I.CB); lamps.push({ x: fire.x, y: fire.y - 1, r: 11, fire: true }); }

    function blob(x, y, r, parts, base, n) {
      var R = Math.ceil(r * 1.6);
      for (var j = -R; j <= R; j++) for (var i = -R; i <= R; i++) {
        var e = -1; for (var q = 0; q < parts.length; q++) { var p = parts[q], dx = i - p[0] * r, dy = j - p[1] * r; e = Math.max(e, p[2] * r - Math.sqrt(dx * dx + dy * dy)); }
        if (e <= 0) continue;
        var l = 0.5 - i / R * 0.45 - j / R * 0.75 + (hash(x + i, y + j, 4) - 0.5) * 0.35;
        set(x + i, y + j, base + (e < 0.8 && j > 0 ? 0 : clamp(Math.floor(l * n + bay(x + i, y + j) * 0.7), 0, n - 1)));
      }
    }
    function home(p) {
      var a = p.art, w = a[0].length, x0 = p.x - (w >> 1), y0 = p.y - a.length + 1, sx = 0, sy = 0, n = 0, i, j, chim = false;
      for (i = 1; i < w - 1; i++) { var c = get(x0 + i, p.y + 1); if (c >= I.N && c < I.G + 4) set(x0 + i, p.y + 1, c >= I.G ? I.G : I.N); }
      for (j = 0; j < a.length; j++) for (i = 0; i < w; i++) {
        var ch = a[j][i], q = HOMEKEY[ch]; if (q === undefined) continue;
        set(x0 + i, y0 + j, q);
        if (ch === 'y') { sx += i; sy += j; n++; }
        if (ch === 's' && !chim) { chim = true; chimneys.push({ x: x0 + i, y: y0 + j }); }
      }
      if (n) lamps.push({ x: x0 + Math.round(sx / n), y: y0 + Math.round(sy / n), r: 13 });
    }
    function pine(x, y, h, w, base, n) {
      for (var j = 0; j < h; j++) { var f = j / h, seg = (f * 3) % 1, hw = Math.max(0, w * (0.25 + f * 0.75) * (0.55 + seg * 0.45)); for (var i = -Math.round(hw); i <= Math.round(hw); i++) set(x + i, y - h + j, base + (i < -hw * 0.3 ? n - 1 : i > hw * 0.3 || seg > 0.85 ? 0 : Math.min(1, n - 1))); }
    }
    function draw(p) {
      if (p.k === 'home') { home(p); return; }
      var k = p.at < 0 ? 1 : smooth(p.at, p.at + 0.1, g);
      if (k <= 0.05) return;
      var x = p.x, y = p.y, dep = lerp(0.65, 1.25, clamp((y / LH - 0.56) / 0.44, 0, 1)), s = p.sc * dep * k * LH / 66, b4 = I.G, z;
      if (p.k !== 'reed' && p.k !== 'lily' && p.k !== 'treeM' && p.k !== 'pineM') { // keep clear of the full-grown lake
        var F = lakeR(1), gr = p.k === 'tree' || p.k === 'pine' || p.k === 'bush' ? 1.25 : 1.12, ex = (x - F.x) / (F.rx * gr), ey = (y - F.y) / (F.ry * gr);
        if (ex * ex + ey * ey < 1 || (p.k === 'tree' || p.k === 'pine' || p.k === 'bush' || p.k === 'rock') && nearHome(x, y)) return;
      }
      switch (p.k) {
        case 'tuft': set(x, y, b4 + 2); set(x, y - 1, b4 + 3); set(x - 1, y - 1, b4 + 1); set(x + 1, y - 1, b4 + 2); if (s > 0.8) { set(x - 1, y - 2, b4 + 2); set(x + 1, y - 2, b4 + 3); } break;
        case 'flower': z = I.FL + p.c; set(x, y, b4 + 1); if (s < 0.75) { set(x, y - 1, z); break; } set(x, y - 1, b4 + 1); set(x, y - 3, z); set(x - 1, y - 2, z); set(x + 1, y - 2, z); set(x, y - 2, I.FC); if (s > 1.1) set(x, y - 1, z); break;
        case 'bush': blob(x, y - Math.round(2.2 * s), 2.6 * s + 0.6, [[-0.7, 0.15, 0.75], [0.7, 0.15, 0.75], [0, -0.25, 0.85]], b4, 4); if (p.h > 0.5 && s > 0.8) { set(x - 1, y - 3, I.FL + p.c); set(x + 2, y - 2, I.FL + p.c); } break;
        case 'tree': z = Math.max(1, Math.round(4.6 * s)); var th = Math.max(2, Math.round(5 * s)), tw = s > 0.9 ? 2 : 1; for (i = 0; i < th; i++) { set(x, y - i, I.TR); if (tw > 1) set(x - 1, y - i, I.TR + 1); } for (i = -z; i <= z; i++) if (dirt(x + i, y + 1) || get(x + i, y + 1) >= I.G && get(x + i, y + 1) < I.G + 4) set(x + i, y + 1, b4); blob(x, y - th - Math.round(z * 0.6), z, [[-0.65, 0.1, 0.72], [0.65, 0.15, 0.72], [0, -0.45, 0.85]], b4, 4); break;
        case 'pine': z = Math.max(4, Math.round(15 * s)); set(x, y, I.TR); set(x, y - 1, I.TR); pine(x, y - 1, z, 4.4 * s, b4, 3); break;
        case 'treeM': z = 1.6 * p.sc * k * LH / 66 + 0.5; blob(x, y - Math.round(z), z, [[0, 0, 1], [0.6, 0.3, 0.7]], I.Q, 3); break;
        case 'pineM': pine(x, y, Math.max(3, Math.round(6.5 * p.sc * k * LH / 66)), 1.9 * p.sc * LH / 66, I.Q, 3); break;
        case 'rock': z = Math.round(1.4 * s); for (j = 0; j <= z; j++) for (i = -z - 1 + j; i <= z + 1 - j; i++) set(x + i, y - j, I.RK + (i < 0 && j > 0 ? 1 : j === z ? 1 : 0)); break;
        case 'reed': z = Math.round(6 * s); for (i = 0; i < z; i++) set(x, y - i, b4 + (i % 2 ? 2 : 3)); set(x, y - z, I.RD); set(x, y - z - 1, I.RD); set(x + 1, y, b4 + 2); set(x + 1, y - 1, b4 + 2); set(x + 2, y - 2, b4 + 2); break;
        case 'lily': for (i = -2; i <= 2; i++) set(x + i, y, b4 + (i < 1 ? 3 : 2)); set(x - 1, y - 1, b4 + 3); set(x, y - 1, b4 + 2); if (p.h > 0.5) { set(x, y - 2, I.LP); set(x + 1, y - 1, I.LP); } break;
      }
    }
  }
  function landAt(x, y) { x = Math.round(x); y = Math.round(y) - LT; return land && x >= 0 && y >= 0 && x < aw && y < LH ? land[y * aw + x] : 0; }
  function isWater(x, y) { var c = landAt(x, y); return c >= I.W && c < I.W + 4; }

  // ---------- clouds ----------
  var SHAPE = [[-1.15, 0.22, 0.5], [-0.62, -0.08, 0.68], [0.02, -0.36, 0.86], [0.66, -0.1, 0.7], [1.18, 0.24, 0.48], [0.4, 0.26, 0.62], [-0.4, 0.28, 0.62]];
  // The hero: a plump base with fully round ends (no thin tips), and three uneven puffs on top.
  var HERO = [[-1.0, 0.24, 0.6], [1.02, 0.2, 0.64], [-0.46, 0.28, 0.62], [0.46, 0.28, 0.62], [0, 0.1, 0.9], [-0.7, -0.24, 0.58], [0.12, -0.44, 0.72], [0.88, -0.12, 0.5]];
  function blobCloud(x0, y0, r, tones, edge, sqx, sqy, wob, shape, flat) {
    shape = shape || SHAPE;
    var rx = r * sqx, ry = r * sqy, sh = [], i;
    for (i = 0; i < shape.length; i++) sh.push([shape[i][0], shape[i][1], shape[i][2] + (wob ? Math.sin(T * 1.3 + i * 1.9) * 0.03 : 0)]);
    var x1 = Math.floor(-1.75 * rx), x2 = -x1, y1 = Math.floor(-1.35 * ry), y2 = Math.ceil(1.0 * ry);
    for (var y = y1; y <= y2; y++) for (var x = x1; x <= x2; x++) {
      if (x0 + x < 0 || x0 + x >= aw) continue;
      var lx = x / rx, ly = y / ry, e = 0, puff = 0, ps = 0, qs = 0;
      for (i = 0; i < sh.length; i++) { var s = sh[i], dx = lx - s[0], dy = ly - s[1], d2 = dx * dx + dy * dy; if (d2 < s[2] * s[2]) { var q = s[2] - Math.sqrt(d2); var pf = (dy * 0.85 + dx * 0.5) / s[2], qw = q * q * q; ps += pf * qw; qs += qw; if (q > e) { e = q; puff = pf; } } }
      if (flat) { puff = qs ? ps / qs * 0.35 + ly * 0.4 : 0; e = Math.min(e, flat - ly); } // soft shading between the hero's puffs
      if (e <= 0) continue;
      if (e * r < 1) { px(x0 + x, y0 + y, edge); continue; }
      var v = 0.6 - ly * 0.36 - puff * 0.3 + (bay(x0 + x, y0 + y) - 0.5) * 0.12;
      px(x0 + x, y0 + y, tones[v > 0.62 ? 0 : v > 0.4 ? 1 : v > 0.18 ? 2 : 3]);
    }
  }
  var DAYC = ramp(['#ffffff', '#e6f0f6', '#bfd4e4', '#93b0ca', '#5e7c9e']), NIGHTC = ramp(['#ccd6f0', '#a4b2da', '#7a89b8', '#586694', '#333f68']), STORMC = ramp(['#a3adbf', '#818ca3', '#606a84', '#474f69', '#282e45']);
  function tones(night, dark) { return DAYC.map(function (c, i) { return mix(mix(c, NIGHTC[i], night), STORMC[i], dark); }); }

  function drawSmall(sk) {
    small.length = 0;
    var span = Math.max(8, LT - TOP - 8);
    for (var i = 0; i < info.owned.length; i++) {
      var n = info.owned[i];
      if (!n) continue;
      var r = clamp((0.28 + 0.05 * Math.log(n + 1) / Math.LN2 + i * 0.014) * cloud.r * 0.8, 3, 15), pad = r * 2;
      var sp = (1 + (i * 5) % 7 * 0.35) * (i % 2 ? 1 : -1), x = ((i * 0.381966 + 0.13) % 1) * (aw + pad * 2) + T * sp;
      x = Math.round(((x % (aw + pad * 2)) + aw + pad * 2) % (aw + pad * 2) - pad);
      var y = Math.round(TOP + 5 + span * (0.06 + 0.62 * ((i * 0.618 + 0.2) % 1)) + Math.sin(T * 0.4 + i));
      var c = tones(sk.night * 0.85, Math.max(storm * 0.7, i / 11 * 0.45)).map(function (q) { return mix(q, mix(sk.a, sk.b, 0.4), 0.34); });
      blobCloud(x, y, r, c.slice(0, 4).map(pack), pack(mix(c[3], c[4], 0.25)), 1, 0.72, false);
      small.push({ x: x, y: y, r: r });
    }
  }
  var BACK = [[0.5, -0.72, 0.4, 0.3], [-1.2, -0.28, 0.58, 0.16], [1.38, -0.12, 0.5, 0.2]]; // x, y, size, haze
  function drawCloud(sk) {
    var r = cloud.r, full = clamp(info.charge / 100, 0, 1), dark = Math.max(storm * 0.9, full >= 1 ? 0.4 : full * 0.2), c = tones(sk.night * 0.8, dark), i, j, s;
    var x = Math.round(cloud.x), y = Math.round(cloud.y + (calm ? 0 : Math.sin(T * 1.1) * 1.5));
    if (full >= 1 && !calm) { // crackle under the belly
      var z = pack(hex('#ffe27a'));
      for (j = 0; j < 2; j++) { var bx = x + Math.round(Math.sin(Math.floor(T * 9) * 2.4 + j * 4) * r), by = y + Math.round(r * 0.75); for (i = 0; i < 5; i++) { px(bx, by + i, z); px(bx + 1, by + i, z); bx += Math.sin(Math.floor(T * 12) * 5 + i * 9 + j) > 0 ? 1 : -1; } }
    }
    // little clouds peeking out behind, drifting on their own
    BACK.forEach(function (b, k) {
      var hz = c.map(function (q) { return mix(mix(q, c[3], 0.22), mix(sk.a, sk.b, 0.4), b[3]); }), sway = calm ? 0 : Math.sin(T * 0.7 + k * 2.1);
      blobCloud(x + Math.round(b[0] * r + sway * 1.4), Math.round(cloud.y + b[1] * r + (calm ? 0 : Math.sin(T * 0.9 + k * 1.7) * 1.5) + cloud.sq * 2), Math.max(4, Math.round(b[2] * r)), hz.slice(0, 4).map(pack), pack(mix(hz[3], hz[4], 0.55)), 1, 0.86, false);
    });
    blobCloud(x, y, r, c.slice(0, 4).map(pack), pack(c[4]), 1 + cloud.sq * 0.16, 1 - cloud.sq * 0.2, !calm, HERO, 0.76);
    // the face: happy when squeezed, startled by lightning, frowning in storms, asleep at night
    var ink = pack(mix(hex('#25304a'), hex('#1a2038'), sk.night)), wh = pack([255, 255, 255]), pk = pack(mix(hex('#f2a09a'), c[2], 0.3 + dark * 0.4));
    var ex = Math.max(3, Math.round(r * 0.36)), ey = y + Math.round(r * 0.04), big = r >= 15, w = big ? 2 : 1, h = big ? 4 : 2, ch = Math.round(r * 0.62);
    rect(x - ch - 1, ey + h - 1, big ? 3 : 2, big ? 2 : 1, pk); rect(x + ch - 1, ey + h - 1, big ? 3 : 2, big ? 2 : 1, pk);
    for (s = -1; s <= 1; s += 2) {
      var e = x + s * ex;
      if (cloud.gasp > 0) { rect(e - 1, ey - 1, w + 1, h + 1, ink); px(e - 1, ey - 1, wh); }
      else if (cloud.happy > 0) { px(e - 2, ey + 1, ink); px(e - 1, ey, ink); px(e, ey - 1, ink); px(e + 1, ey, ink); px(e + 2, ey + 1, ink); if (big) { px(e - 2, ey + 2, ink); px(e + 2, ey + 2, ink); } }
      else if (cloud.blinkT > 0 || (sk.night > 0.7 && storm < 0.2)) { px(e - 2, ey + 1, ink); px(e - 1, ey + 2, ink); px(e, ey + 2, ink); px(e + 1, ey + 2, ink); px(e + 2, ey + 1, ink); }
      else { rect(e - (w > 1 ? 1 : 0), ey - 1, w, h, ink); if (big) px(e - 1, ey - 1, wh); }
      if (storm > 0.4) { px(e + s * 2, ey - 4, ink); px(e + s, ey - 3, ink); px(e, ey - 3, ink); px(e - s, ey - 2, ink); }
    }
    var my = ey + h + 1;
    if (cloud.gasp > 0) rect(x - 1, my, 2, 3, ink);
    else { px(x - 2, my, ink); px(x - 1, my + 1, ink); px(x, my + 1, ink); px(x + 1, my, ink); }
  }

  // ---------- rain ----------
  var rainAcc = 0;
  function spawn(x, y, big) {
    if (drops.length > 340) return null;
    var d = { x: x, y: y, vy: big ? rand(40, 80) : rand(140, 205), vx: big ? rand(-16, 16) : 0, big: big, gy: LT + LH * rand(0.58, 0.99), len: 2 + (Math.random() * 3 | 0) };
    drops.push(d);
    return d;
  }
  function stepRain(dt) {
    rainAcc += info.intensity * (info.saver ? 80 : 170) * (1 + storm * 1.2) * dt;
    while (rainAcc >= 1) {
      rainAcc--;
      var s = Math.random() < 0.55 && small.length ? small[Math.floor(Math.random() * small.length)] : null;
      if (s && s.x > -6 && s.x < aw + 6) spawn(s.x + rand(-1.2, 1.2) * s.r, s.y + s.r * 0.4, false);
      else if (storm > 0.3 && Math.random() < 0.6) spawn(rand(-20, aw), TOP - 6, false);
      else spawn(cloud.x + rand(-1.25, 1.25) * cloud.r, cloud.y + cloud.r * 0.6, false);
    }
    var wind = storm * 34, i;
    for (i = drops.length - 1; i >= 0; i--) {
      var d = drops[i];
      d.vy += (d.big ? 300 : 80) * dt; d.y += d.vy * dt; d.x += (d.vx + (d.big ? 0 : wind)) * dt;
      if (d.y >= d.gy) { if (splashes.length < 90) splashes.push({ x: Math.round(d.x), y: Math.round(d.gy), t: 0, wet: isWater(d.x, d.gy), big: d.big }); drops[i] = drops[drops.length - 1]; drops.pop(); }
    }
    for (i = splashes.length - 1; i >= 0; i--) { splashes[i].t += dt * (splashes[i].wet ? 1.7 : 3.6); if (splashes[i].t >= 1) { splashes[i] = splashes[splashes.length - 1]; splashes.pop(); } }
  }
  var DROP = ['.a.', '.a.', 'aba', 'acb', '.b.'];
  function drawRain(sk) {
    var i, d, x, y, dk = Math.max(sk.night, storm), c = pack(mix(hex('#4d86b4'), hex('#b8d4f0'), dk)), c2 = pack(mix(hex('#8fbcd8'), hex('#7c9cc8'), dk));
    var key = { a: pack(mix(hex('#3a86c0'), hex('#7db4e4'), sk.night)), b: pack(mix(hex('#2766a0'), hex('#5a92cc'), sk.night)), c: pack([240, 250, 255]) };
    for (i = 0; i < drops.length; i++) {
      d = drops[i]; x = Math.round(d.x); y = Math.round(d.y);
      if (d.big) sprite(DROP, key, x - 1, y - 4); else for (var j = 0; j < d.len; j++) px(x - (storm > 0.5 && j > 1 ? 1 : 0), y - j, j > 1 ? c2 : c);
    }
    var foam = lut[I.W + 3];
    for (i = 0; i < splashes.length; i++) {
      var q = splashes[i]; x = q.x; y = q.y;
      if (q.wet) { var w = 1 + Math.floor(q.t * (q.big ? 5 : 3)), h = q.t > 0.5 ? 1 : 0; for (var k = -w; k <= w; k++) { var ed = Math.abs(k) === w; if (ed) px(x + k, y, foam); else if (Math.abs(k) > w - 2 || h) { if (isWater(x + k, y - h - (q.big ? 1 : 0))) px(x + k, y - h - (q.big && q.t > 0.4 ? 1 : 0), foam); if (isWater(x + k, y + h + 1)) px(x + k, y + h, foam); } } }
      else { var up = Math.round(Math.sin(q.t * 3.14) * (q.big ? 3 : 2)), o = 1 + Math.round(q.t * (q.big ? 3 : 2)); px(x - o, y - up, c); px(x + o, y - up, c); if (q.t < 0.35) px(x, y, c); }
    }
  }

  // ---------- living details ----------
  function drawLife(sk) {
    var g = info.growth, i, x, y, b = info.biome % 5, L = lakeR(lakeK(g));
    if (L.rx > 4) for (i = 0; i < 10; i++) { // glints
      var v = (i + 0.5) / 10 * 2 - 1, on = Math.sin(T * 1.1 + i * 2.4); if (on < -0.2) continue;
      x = Math.round(L.x + Math.sin(i * 4.1 + Math.floor(T * 1.5) * 0.12) * Math.sqrt(1 - v * v) * L.rx * 0.65); y = Math.round(LT + L.y + v * L.ry);
      var w = 1 + (i * 7) % 4 + (on > 0.6 ? 1 : 0); for (var j = -w; j <= w; j++) if (isWater(x + j, y)) px(x + j, y, lut[I.W + 3]);
    }
    var lit = Math.max(sk.night, storm * 0.8);
    lamps.forEach(function (q) {
      var wx = q.x, wy = LT + q.y, p = q.fire ? Math.max(0.35, lit) * (0.85 + Math.sin(T * 9) * 0.12) : lit, R = q.r;
      if (p > 0.2) for (y = -R; y <= R; y++) for (x = -R; x <= R; x++) { var d = Math.sqrt(x * x + y * y); if (d < R && bay(wx + x, wy + y) < (1 - d / R) * 0.7 * p) { var X = wx + x, Y = wy + y; if (X >= 0 && X < aw && Y >= 0 && Y < SH) { var o = buf[Y * aw + X]; buf[Y * aw + X] = pack(mix([o & 255, o >> 8 & 255, o >> 16 & 255], [255, 190, 92], 0.4)); } } }
    });
    chimneys.forEach(function (h, c) { for (i = 0; i < 3; i++) { var q = (T * 0.22 + i / 3 + c * 0.17) % 1; disc(Math.round(h.x + Math.sin(q * 5 + i) * 2), Math.round(LT + h.y - 1 - q * 15), 0.6 + q * 1.8, pack(mix(hex('#eeeeea'), sk.a, 0.2 + sk.night * 0.4)), 0.85 - q); } });
    if (fire && storm < 0.5) { var fx = fire.x, fy = LT + fire.y - 1, fl = Math.floor(T * 8); rect(fx - 1, fy - 1, 3, 2, pack(hex('#f07a2c'))); px(fx + (fl % 3) - 1, fy - 2, pack(hex('#f07a2c'))); px(fx, fy, pack(hex('#ffe27a'))); px(fx, fy - 1 - fl % 2, pack(hex('#ffc04a'))); px(fx + (fl % 2 ? 1 : -1), fy - 4 - fl % 3, pack(hex('#c8582a'))); }
    var n = Math.floor(smooth(0.36, 0.8, g) * 10);
    for (i = 0; i < n; i++) { // butterflies by day, fireflies by night
      x = Math.round(((i * 0.37 + 0.1 + Math.sin(T * 0.21 + i * 2) * 0.12 + 1) % 1) * aw); y = Math.round(LT + LH * (0.58 + 0.3 * ((i * 0.53) % 1)) + Math.sin(T * 1.3 + i * 3) * 4);
      if (sk.night > 0.4) { var br = Math.sin(T * 2.2 + i * 5); if (br > -0.3) { var fc = pack(hex('#f6ff9e')), f2 = pack(hex('#8fae4e')); px(x, y, fc); if (br > 0.5) { px(x - 1, y, f2); px(x + 1, y, f2); px(x, y - 1, f2); px(x, y + 1, f2); } } }
      else if (i < 5 && storm < 0.3) { var c = lut[I.FL + i % 3], op = Math.sin(T * 10 + i) > 0; px(x, y, lut[I.CR]); if (op) { px(x - 1, y - 1, c); px(x + 1, y - 1, c); px(x - 1, y, c); px(x + 1, y, c); } else { px(x, y - 1, c); px(x, y - 2, c); } }
    }
  }
  function drawGrass() {
    var g = info.growth, x, j;
    var gk = smooth(0.2, 0.5, g);
    if (gk > 0) for (x = 0; x < aw; x++) { // grass along the front, bending in the wind
      var h = Math.round((1.5 + hash(x, 1, 9) * 5) * gk), sw = Math.sin(T * 1.5 + x * 0.22) * (0.8 + storm * 1.6) + storm * 1.2;
      for (j = 0; j < h; j++) px(x + Math.round(sw * j / 6), SH - 1 - j, lut[I.G + (j > h - 2 && h > 3 ? 2 : x % 3 ? 1 : 0)]);
    }
  }

  // ---------- people ----------
  var folk = [], SHIRT = ramp(['#d9574a', '#e8a03c', '#4f8fd0', '#6db36a', '#b06cc0', '#e6dfc8', '#3f9c94']), HAIR = ramp(['#3a2a24', '#6a4428', '#c8923e', '#22222e', '#8a8a92']), SKIN = ramp(['#f2c9a4', '#d9a078', '#a86f4a', '#7a4c34']), PANTS = ramp(['#3c4668', '#5a4636', '#4a5a4a']);
  function groundOk(x, y) {
    if (x < 3 || x > aw - 4 || y < rNear(Math.round(x), info.biome % 5) + 3 || y > LH - 4) return false;
    if (isWater(x, LT + y) || isWater(x, LT + y - 1)) return false;
    return !built.some(function (h) { return Math.abs(x - h.x) < 11 && y <= h.y && y > h.y - 12; });
  }
  function pickSpot(p) {
    var i, x, y;
    for (i = 0; i < 30; i++) {
      if (p.job === 'splash' && puddles.length) { var q = puddles[Math.floor(Math.random() * puddles.length)]; x = q.x + rand(-2, 2); y = q.v * LH; if (x > 3 && x < aw - 4 && y < LH - 3) return { x: x, v: y / LH }; }
      if (p.job === 'fire' && fire) { x = fire.x + (Math.random() < 0.5 ? -1 : 1) * rand(5, 8); y = fire.y + rand(0, 2); }
      else { x = rand(5, aw - 6); y = rand(0.58, 0.95) * LH; }
      if (groundOk(x, y)) return { x: x, v: y / LH };
    }
    return { x: p.x, v: p.v };
  }
  function chooseJob(p, sk) {
    var n = Math.random();
    p.t = rand(3, 8); p.path = 0;
    if (p.fisher && dock) { p.job = 'fish'; p.to = { x: dock.x + 1, v: dock.y / LH }; p.t = 40; return; }
    if (sk.night > 0.6 && fire && storm < 0.3 && n < 0.5) p.job = 'fire';
    else if (puddles.length && n < (p.kid ? 0.7 : 0.35) && sk.night < 0.6) p.job = 'splash';
    else if (n < 0.75) p.job = 'stroll';
    else { p.job = 'rest'; p.to = null; return; }
    p.to = pickSpot(p);
  }
  function stepFolk(dt, sk) {
    var want = info.people || 0, i;
    while (folk.length > want) folk.pop();
    while (folk.length < want) {
      i = folk.length; var left = i % 2 === 0, first = T < 1 || info.quiet;
      folk.push({ i: i, x: first ? aw * (0.12 + 0.76 * ((i * 0.618 + 0.1) % 1)) : left ? -4 : aw + 4, v: 0.6 + 0.3 * ((i * 0.37 + 0.2) % 1), dir: left ? 1 : -1, kid: i % 4 === 2, fisher: i === 6, hat: i === 0 || i % 5 === 3, staff: i === 0, shirt: i % SHIRT.length, hair: (i * 3 + 1) % HAIR.length, skin: (i * 5) % SKIN.length, pants: i % 3, t: 0, hop: 0, vy: 0, cheer: 0, job: 'stroll', to: null, walking: false });
    }
    folk.forEach(function (p) {
      p.cheer -= dt; p.t -= dt;
      if (p.hop > 0 || p.vy > 0) { p.hop += p.vy * dt; p.vy -= 95 * dt; if (p.hop <= 0) { p.hop = 0; p.vy = 0; if (p.job === 'splash' && !p.walking && splashes.length < 80) for (var k = -1; k <= 1; k += 2) splashes.push({ x: Math.round(p.x) + k * 2, y: Math.round(LT + p.v * LH), t: 0, wet: false, big: true }); } }
      var y = p.v * LH, wade = isWater(p.x, LT + y) && !(dock && Math.abs(y - dock.y) < 2.5 && p.x >= dock.x - 2);
      if (!p.to && p.t <= 0) chooseJob(p, sk);
      p.walking = false;
      if (p.to) {
        var dx = p.to.x - p.x, dy = p.to.v * LH - y, d = Math.sqrt(dx * dx + dy * dy), sp = (p.kid ? 9 : 6.5) * (storm > 0.4 ? 1.7 : 1) * dt;
        if (d < 0.7) { p.to = null; if (p.job === 'fish') p.dir = -1; if (p.job === 'fire' && fire) p.dir = fire.x > p.x ? 1 : -1; }
        else {
          var nx = p.x + dx / d * Math.min(sp, d), ny = y + dy / d * Math.min(sp, d);
          var free = p.job === 'fish' || p.job === 'splash' || wade || p.x < 4 || p.x > aw - 5 || !groundOk(p.x, y) || groundOk(nx, ny);
          if (free) { p.x = nx; p.v = ny / LH; p.walking = true; if (Math.abs(dx) > 0.5) p.dir = dx > 0 ? 1 : -1; } else { p.to = null; p.t = rand(0.2, 1); }
        }
      } else if (p.job === 'splash' && p.hop === 0 && Math.random() < dt * 2.2) p.vy = 22;
      if (p.cheer > 0 && p.hop === 0 && p.vy === 0) p.vy = 18;
    });
  }
  function cheerNear(x, y) {
    folk.forEach(function (p) { var dx = p.x - x; if (Math.abs(dx) < 26 && p.cheer < 0) p.cheer = rand(0.35, 0.9); });
  }
  function drawFolk(sk) {
    function col(c) { return pack(mix(c, sk.tint, sk.k * 0.75)); }
    folk.slice().sort(function (a, b) { return a.v - b.v; }).forEach(function (p) {
      var x = Math.round(p.x), y = Math.round(LT + p.v * LH - p.hop), onDock = dock && Math.abs(p.v * LH - dock.y) < 2.5 && p.x >= dock.x - 2 && p.v * LH <= dock.y + 1;
      var wade = !onDock && isWater(p.x, LT + p.v * LH), sit = p.job === 'fire' && !p.to && p.cheer <= 0, step = p.walking && Math.floor(T * 8 + p.i) % 2, legs = p.kid ? 1 : 2, top;
      var sh = col(SHIRT[p.shirt]), sk2 = col(SKIN[p.skin]), hr = col(HAIR[p.hair]), pt = col(PANTS[p.pants]), up = p.cheer > 0;
      if (!wade && p.hop < 0.5) { px(x - 1, y + 1, lut[I.CR]); px(x, y + 1, lut[I.CR]); px(x + 1, y + 1, lut[I.CR]); }
      if (sit) { px(x, y, pt); px(x + p.dir, y, pt); px(x - 1 + (p.dir < 0 ? 1 : 0), y, pt); top = y - 1; }
      else if (wade) top = y;
      else { for (var l = 0; l < legs; l++) { var spread = step && l === 0; px(x - (spread ? 1 : 0), y - l, pt); px(x + 1 + (spread ? 1 : 0) - (step && l ? 1 : 0), y - l, pt); } top = y - legs; }
      var bh = p.kid ? 2 : 3; rect(x, top - bh + 1, 2, bh, sh); top -= bh; // body
      if (up) { px(x - 1, top, sk2); px(x - 1, top + 1, sh); px(x + 2, top, sk2); px(x + 2, top + 1, sh); } else { px(x - 1, top + 2, step ? sk2 : sh); px(x + 2, top + 2, step ? sh : sk2); }
      rect(x, top - 1, 2, 2, sk2); px(p.dir > 0 ? x : x + 1, top - 1, hr); rect(x, top - 2, 2, 1, hr); // head
      if (p.hat) { var h1 = col(hex('#e0bd6a')); rect(x - 1, top - 2, 4, 1, h1); rect(x, top - 3, 2, 1, h1); }
      if (p.staff && !sit) { var wx = p.dir > 0 ? x + 3 : x - 2; for (var s = 0; s < 7; s++) px(wx, y - s, col(hex('#7a5a3a'))); }
      if (p.job === 'fish' && !p.to) { for (var f = 0; f < 6; f++) px(x - 1 - f, top + 1 - Math.floor(f * 0.7), col(hex('#6a4a2a'))); for (f = 0; f < 8; f++) px(x - 7, top - 2 + f, col(hex('#e6eef2'))); px(x - 7, top + 6 + (Math.sin(T * 2) > 0 ? 1 : 0), pack(hex('#e2483c'))); }
      if (storm > 0.4 && !p.staff && !p.kid) { var um = col(SHIRT[(p.shirt + 3) % SHIRT.length]), ux = x; rect(ux - 2, top - 4, 6, 1, um); rect(ux - 1, top - 5, 4, 1, um); px(ux + 1, top - 3, col(hex('#4a4a52'))); }
    });
  }

  var BIRD = [
    ['....bb.........', '....bbb........', '.....bbb.......', '.....bbbb......', 'b.....bbbbbbb..', '.bbbbbbbbbbwbk.', 'b..bbbbwwwwrr..', '......wwww.....', '...............', '...............'],
    ['...............', '...............', '...............', '...............', 'b.....bbbbbbb..', '.bbbbbbbbbbwbk.', 'b..bbbbwwwwrr..', '.....bbbww.....', '....bbb........', '....bb.........']
  ];
  function drawBird() {
    var s = swallow, x = Math.round(s.x), y = Math.round(s.y), key = { b: pack(hex('#22356a')), w: pack(hex('#f8eedc')), r: pack(hex('#c2553a')), k: pack(hex('#141c34')) }, gold = pack(hex('#ffe27a')), o;
    for (var i = 0; i < 5; i++) { o = (T * 1.2 + i / 5) % 1; var a = i * 2.4 + Math.floor(T * 1.2 + i / 5), sx = Math.round(x + Math.cos(a) * 12), sy = Math.round(y + Math.sin(a) * 8); px(sx, sy, gold); if (o > 0.3 && o < 0.7) { px(sx - 1, sy, gold); px(sx + 1, sy, gold); px(sx, sy - 1, gold); px(sx, sy + 1, gold); } }
    var f = BIRD[Math.sin(s.t * 11) > 0 ? 0 : 1], halo = pack(hex('#fff6d8')), hk = { b: halo, w: halo, r: halo, k: halo };
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) { sprite(f, hk, x - 7 + d[0], y - 5 + d[1], s.dir < 0); });
    sprite(f, key, x - 7, y - 5, s.dir < 0);
  }
  function addBolt() {
    var x = cloud.x + rand(-0.6, 0.6) * cloud.r, y = cloud.y + cloud.r * 0.5, p = [[x, y]], ty = LT + LH * rand(0.58, 0.75);
    while (y < ty) { y += rand(5, 11); x += rand(-8, 8); p.push([x, Math.min(y, ty)]); }
    bolts.push({ p: p, t: 0 });
  }

  // ---------- frame ----------
  var skyLut = new Uint32Array(13);
  function frame(dt) {
    T += dt;
    sceneCss = Math.abs(sceneT - sceneCss) < 1 ? sceneT : lerp(sceneCss, sceneT, 1 - Math.pow(0.0005, dt));
    SH = Math.min(ah, Math.round(sceneCss / PX)); TOP = Math.round(padCss / PX);
    LH = Math.round(clamp(sceneT * 0.42, 130, 360) / PX); LT = SH - LH;
    if (LT !== lastLT) { drops.forEach(function (d) { d.gy += LT - lastLT; }); splashes.length = 0; lastLT = LT; }
    renderLand();
    storm = lerp(storm, info.storm ? 1 : 0, 1 - Math.pow(0.08, dt)); rainbow = lerp(rainbow, info.rainbow ? 1 : 0, 1 - Math.pow(0.2, dt));
    var room = Math.max(22, LT + LH * 0.2 - TOP), i, x, y, o;
    cloud.x = aw / 2; cloud.y = TOP + room * 0.52; cloud.r = Math.round(clamp(Math.min(aw * 0.14, room * 0.3) * (1 + info.growth * 0.25), 9, 28));
    for (var left = dt; left > 0; left -= 0.008) { var h = Math.min(left, 0.008); cloud.sv += (-cloud.sq * 260 - cloud.sv * 13) * h; cloud.sq += cloud.sv * h; }
    cloud.sq = clamp(cloud.sq, -1.2, 1.2);
    cloud.blink -= dt; if (cloud.blink <= 0) { cloud.blink = rand(2.5, 6); cloud.blinkT = 0.13; }
    cloud.blinkT -= dt; cloud.happy -= dt; cloud.gasp -= dt; flash = Math.max(0, flash - dt * 2.4); shake = Math.max(0, shake - dt * 2);
    stepRain(dt);

    // sky: twelve bands, dithered together
    var sk = sky(), N = 12;
    for (i = 0; i <= N; i++) skyLut[i] = pack(mix(sk.a, sk.b, Math.min(1, i / (N - 1))));
    for (y = 0, o = 0; y < SH; y++) { var lv = y / SH * N; for (x = 0; x < aw; x++, o++) buf[o] = skyLut[Math.min(N, Math.floor(Math.max(0, lv + (bay(x, y) - 0.5) * 0.45)))]; }
    var arc = Math.max(12, LT + LH * 0.3 - TOP - 12), ox, oy;
    if (sk.night > 0.02) {
      var rs = rng(51), star = pack([240, 244, 255]), dim = pack([150, 164, 214]);
      for (i = 0; i < 60; i++) { x = Math.floor(rs() * aw); y = Math.floor(rs() * (LT + LH * 0.2)); var tw = Math.sin(T * 1.7 + i * 2.4) * 0.5 + 0.5; if (sk.night * (1 - storm) * (0.4 + tw) < 0.55) continue; px(x, y, tw > 0.5 ? star : dim); if (i % 11 === 0 && tw > 0.8) { px(x - 1, y, dim); px(x + 1, y, dim); px(x, y - 1, dim); px(x, y + 1, dim); } }
      var m = clamp((sk.t - 0.6) / 0.36, 0, 1); ox = Math.round(aw * (0.1 + 0.8 * m)); oy = Math.round(LT + LH * 0.3 - Math.sin(m * Math.PI) * arc);
      var mc = pack(mix(hex('#f4f2dc'), sk.a, storm * 0.8)), md = pack(mix(hex('#cfcdb8'), sk.a, storm * 0.8));
      disc(ox, oy, 8, mc, 0.12 * sk.night); disc(ox, oy, 5.3, mc); px(ox - 2, oy - 1, md); px(ox - 1, oy - 1, md); px(ox - 2, oy, md); px(ox + 2, oy + 2, md); px(ox + 1, oy - 3, md); px(ox + 2, oy - 3, md);
    }
    var day = sk.t < 0.6 ? (sk.t + 0.1) / 0.68 : sk.t > 0.92 ? (sk.t - 0.9) / 0.68 : -1;
    if (day >= 0 && day <= 1) {
      ox = Math.round(aw * (0.06 + 0.88 * day)); oy = Math.round(LT + LH * 0.3 - Math.sin(day * Math.PI) * arc);
      var sc = pack(mix(hex('#fff2b0'), sk.a, storm * 0.75)), s2 = pack(mix(hex('#ffe07a'), sk.a, storm * 0.75));
      disc(ox, oy, 11, sc, 0.2); disc(ox, oy, 9, sc, 0.45); disc(ox, oy, 6.4, s2); disc(ox - 1, oy - 1, 4.6, sc);
    }
    if (rainbow > 0.03) {
      var rc = ['#e2574f', '#f0984a', '#f6dc5c', '#6fc07a', '#5a9ad6', '#8a72c4'].map(function (q) { return pack(mix(hex(q), sk.b, 0.2)); }), R = Math.round(Math.min(aw * 0.62, LT)), cy = LT + Math.round(LH * 0.45);
      for (y = Math.max(0, cy - R); y < cy; y++) for (x = 0; x < aw; x++) { var rd = R - Math.sqrt((x - aw / 2) * (x - aw / 2) + (y - cy) * (y - cy)), bi = Math.floor(rd / 2); if (bi >= 0 && bi < 6 && rd >= 0) pxa(x, y, rc[bi], rainbow * 0.7); }
    }
    // land, lit through the palette
    var lit = Math.max(sk.night, storm * 0.8);
    for (i = 1; i < I.END; i++) lut[i] = pack(i === I.WIN ? mix(pal[i], [255, 208, 112], lit) : pal[i] ? mix(pal[i], sk.tint, sk.k) : [255, 0, 255]);
    for (y = 0; y < LH; y++) for (x = 0, o = y * aw; x < aw; x++, o++) if (land[o]) px(x, LT + y, lut[land[o]]);
    var base = lut[I.N]; for (o = SH * aw; o < buf.length; o++) buf[o] = base;

    drawSmall(sk); drawLife(sk); stepFolk(dt, sk); drawFolk(sk); drawGrass(); drawRain(sk);
    for (i = bolts.length - 1; i >= 0; i--) {
      var b = bolts[i]; b.t += dt * 3; if (b.t >= 1) { bolts.splice(i, 1); continue; }
      var w1 = pack([255, 255, 240]), w2 = pack(hex('#ffd75e'));
      if (b.t < 0.8) for (var k = 1; k < b.p.length; k++) line(b.p[k - 1][0], b.p[k - 1][1], b.p[k][0], b.p[k][1], function (a, c) { px(a - 1, c, w2); px(a + 2, c, w2); px(a, c, b.t < 0.4 ? w1 : w2); px(a + 1, c, b.t < 0.4 ? w1 : w2); });
    }
    drawCloud(sk);
    if (swallow) { var s = swallow; s.t += dt; s.x += s.dir * 15 * dt; s.y = s.y0 + Math.sin(s.t * 1.8) * 7; if (s.x < -20 || s.x > aw + 20) swallow = null; else drawBird(); }
    if (evap) {
      evap.t += dt;
      for (i = 0; i < 2; i++) if (wisps.length < 110) wisps.push({ x: aw * rand(0.06, 0.94), y: LT + LH * rand(0.6, 0.98), t: 0, r: rand(2, 7), p: rand(0, 6) });
      if (evap.t > 2.2 && evap.mid) { evap.mid(); evap.mid = null; }
      if (evap.t > 3.6) evap = null;
    }
    var wc = pack([246, 250, 252]);
    for (i = wisps.length - 1; i >= 0; i--) { var w = wisps[i]; w.t += dt * 0.55; w.y -= 50 * dt; if (w.t >= 1) { wisps.splice(i, 1); continue; } disc(Math.round(w.x + Math.sin(T * 2 + w.p) * 4), Math.round(w.y), w.r * (0.6 + w.t), wc, 0.55 * Math.sin(w.t * Math.PI)); }
    if (evap) { var fog = Math.pow(Math.sin(clamp(evap.t / 3.6, 0, 1) * Math.PI), 2) * 1.06; for (y = 0, o = 0; y < ah; y++) for (x = 0; x < aw; x++, o++) if (bay(x, y) < fog) buf[o] = wc; }
    for (i = motes.length - 1; i >= 0; i--) { var q = motes[i]; q.t += dt * 0.7; if (q.t >= 1) { motes.splice(i, 1); continue; } q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 20 * dt; x = Math.round(q.x); y = Math.round(q.y); px(x, y, lut[q.c]); if (Math.sin(q.t * 18 + q.vx) > 0) px(x + 1, y, lut[q.c]); else px(x, y + 1, lut[q.c]); }
    for (i = floats.length - 1; i >= 0; i--) {
      var f = floats[i]; f.t += dt * (f.big ? 0.65 : 1.25); if (f.t >= 1) { floats.splice(i, 1); continue; }
      if (f.t > 0.8 && Math.floor(f.t * 60) % 2) continue;
      var tx = clamp(Math.round(f.x - textW(f.s) / 2), 2, Math.max(2, aw - textW(f.s) - 2));
      text(f.s, tx, Math.round(f.y - f.t * 20), f.big ? pack(hex('#ffe27a')) : pack([255, 255, 255]), pack(hex(f.big ? '#5a3a10' : '#22406a')));
    }
    if (flash > 0 && !calm) { var fl = pack([255, 253, 238]); for (y = 0, o = 0; y < ah; y++) for (x = 0; x < aw; x++, o++) if (bay(x, y) < flash * 0.85) buf[o] = fl; }
    cx.putImageData(img, 0, 0);
    cv.style.transform = shake > 0 && !calm ? 'translate(' + Math.round(rand(-2, 2) * shake) * PX + 'px,' + Math.round(rand(-2, 2) * shake) * PX + 'px)' : '';
  }

  // ---------- api (css pixels in, art pixels inside) ----------
  return {
    init: function (canvas) { cv = canvas; cx = cv.getContext('2d'); },
    resize: function (w, h) {
      W = w; H = h; PX = Math.max(2, Math.round(Math.min(w, h * 0.62) / 137));
      aw = Math.ceil(W / PX); ah = Math.ceil(H / PX); cv.width = aw; cv.height = ah; cv.style.width = aw * PX + 'px'; cv.style.height = ah * PX + 'px';
      img = cx.createImageData(aw, ah); buf = new Uint32Array(img.data.buffer); landKey = '';
    },
    view: function (h, pad, snap) { sceneT = h; padCss = pad; if (snap) sceneCss = h; },
    info: function (o) { for (var k in o) info[k] = o[k]; },
    frame: frame,
    squeeze: function (x, y, s) {
      cloud.sv = Math.min(cloud.sv + 5.5, 12); cloud.sq = Math.min(cloud.sq, 0.6); cloud.happy = 0.45;
      var ax = x / PX, ay = y / PX, i;
      for (i = 0; i < 2; i++) spawn(cloud.x + rand(-1, 1) * cloud.r, cloud.y + cloud.r * rand(0.3, 0.6), true);
      for (i = 0; i < 4; i++) { // and a little shower right under the finger
        var low = ay > LT + LH * 0.5, d = spawn(ax + rand(-5, 5), ay + rand(-6, 1) - (low ? 9 : 0), true);
        if (d) { d.vx = rand(-9, 9); d.vy = rand(5, 45); if (low) d.gy = Math.min(SH - 2, ay + rand(-1, 4)); }
      }
      cheerNear(ax, ay);
      if (s && floats.length < 14) floats.push({ x: x / PX + rand(-6, 6), y: y / PX - 10, s: s, t: 0 });
    },
    drip: function () { cloud.sv += 1.6; spawn(cloud.x + rand(-1, 1) * cloud.r, cloud.y + cloud.r * 0.5, true); },
    say: function (s) { floats.push({ x: aw / 2, y: cloud.y + cloud.r * 1.3, s: s, t: 0, big: true }); },
    strike: function () { flash = 1; shake = 0.9; cloud.gasp = 0.9; cloud.sv -= 5; addBolt(); addBolt(); for (var i = 0; i < 36; i++) spawn(rand(0, aw), TOP + rand(-12, 12), true); },
    rumble: function () { flash = Math.max(flash, 0.35); addBolt(); },
    bloom: function () { for (var i = 0; i < 46; i++) motes.push({ x: rand(0, aw), y: LT + LH * rand(0.5, 0.95), vx: rand(-10, 10), vy: rand(-42, -18), t: rand(0, 0.2), c: i % 3 ? I.G + 2 + i % 2 : I.FL + i % 3 }); },
    swallow: function () { var d = Math.random() < 0.5 ? 1 : -1, y0 = TOP + 16 + Math.random() * 12; swallow = { x: d > 0 ? -16 : aw + 16, y0: y0, y: y0, dir: d, t: 0 }; },
    hitSwallow: function (x, y) { if (!swallow) return false; var dx = x / PX - swallow.x, dy = y / PX - swallow.y; if (dx * dx + dy * dy > 17 * 17) return false; swallow = null; return true; },
    hasSwallow: function () { return swallow ? { x: swallow.x * PX, y: swallow.y * PX } : null; },
    evaporate: function (mid) { evap = { t: 0, mid: mid }; },
    busy: function () { return !!evap; },
    time: function (t) { if (t !== undefined) T = t; return T; }
  };
})();
