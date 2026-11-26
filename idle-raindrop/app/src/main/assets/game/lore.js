/* One 16x16 picture for every piece of weather lore, drawn from its name. */
var LoreArt = (function () {
  'use strict';
  var P = { k: '#20263a', w: '#ffffff', g: '#c9d3df', s: '#8593aa', d: '#55627c', b: '#4a9ad6', B: '#23598f', c: '#a6dcf2', y: '#ffd75e', o: '#f0984a', r: '#d9534f', R: '#97333a', p: '#f2a7a0', n: '#8a5a3a', N: '#5d3b28', t: '#e8c48f', e: '#5fae5a', E: '#2f7040', l: '#a9d66b', v: '#8a72c4' };
  var g;
  function r(c, x, y, w, h) { g.fillStyle = P[c] || c; g.fillRect(x, y, w || 1, h || 1); }
  function sky(a, b, y) { r(a, 0, 0, 16, 16); if (b) r(b, 0, y, 16, 16 - y); }
  function each(f) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) f(x, y); }
  function disc(c, cx, cy, q) { each(function (x, y) { if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= q * q) r(c, x, y); }); }
  function ring(c, cx, cy, q, t) { each(function (x, y) { var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)); if (d <= q && d > q - t) r(c, x, y); }); }
  function line(c, x0, y0, x1, y1, w) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (var i = 0; i <= n; i++) r(c, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), w || 1, 1); }
  function wave(c, y, a, f, h, o) { for (var x = 0; x < 16; x++) r(c, x, Math.round(y + Math.sin(x * f + (o || 0)) * a), 1, h || 1); }
  function dots(c, pts, w, h) { for (var i = 0; i < pts.length; i += 2) r(c, pts[i], pts[i + 1], w, h); }
  function art(rows, x, y) { rows.forEach(function (q, j) { for (var i = 0; i < q.length; i++) if (P[q[i]]) r(q[i], x + i, y + j); }); }
  function cloud(x, y, a, b) { // 10x6
    r(a, x + 3, y, 4); r(a, x + 2, y + 1, 6); r(a, x + 1, y + 2, 8); r(a, x, y + 3, 10, 2); r(b, x + 1, y + 5, 8); r(b, x + 5, y + 4, 4);
  }
  function drop(x, y, a, b) { r(a, x + 1, y); r(a, x + 1, y + 1); r(a, x, y + 2, 3, 2); r(b, x + 1, y + 4); r(b, x + 2, y + 3); }
  function bolt(c, x, y) { art(['...##', '..##.', '.##..', '####.', '..##.', '.##..', '.#...'].map(function (q) { return q.replace(/#/g, c); }), x, y); }
  function palm(x, y) { line('N', x, y, x - 2, y + 9, 2); r('E', x - 5, y - 1, 5, 2); r('e', x - 3, y - 3, 4, 2); r('E', x + 1, y - 2, 5, 2); r('e', x, y - 1, 6); r('E', x - 6, y + 1, 2, 2); r('E', x + 5, y, 2, 3); }

  var ART = {
    // squeezing
    tap0: function () { sky('#2f6f9f'); drop(6, 1, 'w', 'c'); art(['t............t', 't............t', 'tt.cccccccc.tt', 'ttt.cbbbbc.ttt', '.ttttbbbbtttt.', '.nttttttttttn.', '..nntttttnnn..', '....nnnnnn....'], 1, 7); },
    tap1: function () { sky('#d98a5b'); cloud(3, 5, 'w', 'g'); art(['r..', 'rr.', 'rrr', 'rr.', 'r..'], 0, 5); art(['..r', '.rr', 'rrr', '.rr', '..r'], 13, 5); dots('b', [5, 12, 8, 13, 10, 12], 1, 2); },
    tap2: function () { sky('#bfe3f2'); disc('b', 7.5, 9.5, 5); r('b', 7, 1, 2, 2); r('b', 6, 3, 4, 2); r('b', 5, 5, 6); disc('B', 9, 11, 3); disc('b', 8, 10, 3); r('w', 4, 8, 2, 3); r('w', 5, 7); },
    tap3: function () { sky('#3f8f8a'); art(['yyyyyyyyyyyy', 'yyoyyyyyyoyy', 'yyyyoyyyyyyy', '.yyyyyyoyyy.', '..yoyyyyyy..', '..yyyyoyyy..', '.yyyyyyyyoy.', 'yyoyyoyyyyyy', 'oooooooooooo'], 2, 1); dots('c', [4, 11, 8, 12, 11, 11, 6, 14, 10, 14], 1, 2); },
    tap4: function () { sky('#7c94ad'); ring('k', 7.5, 6.5, 5.5, 1); r('b', 3, 5, 10, 2); r('c', 4, 5, 8); art(['dssssssssd', 'dgsssssssd', '.dgsssssd.', '.dgsssssd.', '.dgsssssd.', '..dgsssd..', '..dddddd..'], 3, 7); dots('c', [1, 8, 14, 7, 1, 12, 14, 11], 1, 2); },
    tap5: function () { sky('#6f86c8'); art(['o....o', 'oo..oo', 'oooooo', 'okooko', 'oopooo', '.oooo.'], 1, 2); art(['.nnnn.', 'NttttN', 'NktktN', 'NttttN', '.tkkt.', '..pp..'], 8, 8); dots('c', [10, 2, 13, 4, 2, 11, 5, 13], 1, 3); },
    tap6: function () { sky('#2f6f9f'); [[0, 0], [8, 0], [15, 0], [0, 7], [15, 7], [0, 15], [15, 15]].forEach(function (q) { line('y', 7, 7, q[0], q[1], 2); }); art(['..tttttttt..', '.ttnttnttnt.', '.ttnttnttntt', '.ttnttnttntt', '.ttnttnttntt', 'ttttttttnttt', 'tttttttttntt', 'nnnnnnnttttt', '.ttttttttttn', '..ttttttttn.', '..rrrrrrrr..', '..RRRRRRRR..'], 2, 3); },
    // squeeze + rain together
    pct0: function () { sky('#f6cfd0'); art(['.rrr..rrr.', 'rpprrrrrrr', 'rprrrrrrrr', 'rrrrrrrrrr', '.rrrrrrrr.', '..rrrrrr..', '...rrrr...', '....rr....'], 3, 2); dots('b', [3, 11, 7, 12, 11, 11, 5, 13, 9, 13], 1, 2); },
    pct1: function () { sky('#d9c08f'); art(['.NN.', 'NNNN', 'NNNN', 'NNN.', '....', '.NN.', '.NN.'], 2, 7); art(['.NN.', 'NNNN', 'NNNN', '.NNN', '....', '.NN.', '.NN.'], 10, 2); dots('c', [4, 3, 12, 12], 2, 2); },
    pct2: function () { sky('#5d7f9c'); dots('c', [2, 1, 6, 0, 11, 1, 14, 3], 1, 3); art(['.....r.....', '...rrrrr...', '.rrpprrrrr.', 'rrpprrRrrRr', 'rrprrRrrrRr', 'r.rr.Rr.rr.'], 2, 4); r('N', 7, 10, 1, 4); r('N', 8, 14, 2); r('N', 10, 13); },
    pct3: function () { sky('#171d3a'); dots('w', [1, 2, 14, 1, 2, 13, 13, 14, 15, 8]); disc('b', 7.5, 7.5, 5.5); art(['..ee....', '.eeee.e.', '.eee..ee', '..e..eee', '.....ee.', '..ee....', '...e.ee.'], 4, 4); r('w', 4, 3, 4); r('w', 8, 11, 3); },
    pct4: function () { sky('#c5e6ef', '#2d6b98', 8); r('w', 0, 8, 16); disc('b', 7.5, 4.5, 2); r('b', 7, 0, 2, 3); disc('c', 7.5, 11.5, 2); r('c', 7, 13, 2, 3); r('#2d6b98', 4, 12, 8); dots('c', [2, 10, 12, 10], 2); },
    // all rain
    all0: function () { sky('#8a5a3a'); disc('y', 7.5, 7.5, 6.6); disc('#f3ead2', 7.5, 7.5, 5.4); dots('k', [7, 3, 3, 7, 12, 7, 4, 4, 11, 4]); line('r', 7, 8, 11, 11); line('r', 8, 8, 11, 12); r('k', 7, 7, 2, 2); },
    all1: function () { sky('#dff0c9'); art(['.........eee', '......eeeele', '....eeeelee.', '...eeeelEee.', '..eeeelEeee.', '..eeelEeee..', '.eeelEeee...', '.eelEeee....', '..EEee......', '.E..........'], 1, 1); drop(9, 10, 'b', 'B'); r('w', 9, 12); dots('w', [6, 7, 9, 4], 2, 1); },
    all2: function () { sky('#9bd0e6'); for (var i = 0; i < 11; i++) r('d', 7 - i * 0.72 | 0, 5 + i, 2 + i * 1.45 | 0, 1); r('w', 7, 4, 2); r('w', 6, 5, 4); r('w', 5, 6, 5); r('w', 5, 7, 2); r('w', 9, 7); cloud(6, 0, 'w', 'g'); line('r', 1, 14, 5, 9); r('r', 3, 8, 3); r('r', 5, 8, 1, 3); },
    all3: function () { sky('#cfe4f2', '#f2d9a8', 8); r('B', 0, 5, 16, 2); [-1, 5, 11].forEach(function (x) { r('B', x + 1, 7, 5); r('B', x + 2, 8, 3); r('B', x + 3, 9); }); dots('w', [2, 2, 8, 1, 13, 3], 2, 1); dots('o', [3, 13, 11, 12, 7, 14], 2, 1); },
    all4: function () { sky('#e6edf2'); ring('s', 7.5, 7.5, 7.4, 0.9); ring('g', 7.5, 7.5, 10.4, 0.9); art(['rrr....', 'rrr....', 'rrr....', 'rrr....', 'rrr....', 'rrrrrrr', 'rrrrrRR', 'RRRRRR.'], 4, 4); },
    all5: function () { sky('#2a3f78', '#1d2c58', 11); wave('b', 6, 4, 0.42, 4, 1.4); wave('c', 6, 4, 0.42, 2, 1.4); dots('w', [1, 2, 13, 13, 4, 13], 1, 1); },
    all6: function () { sky('#f6b35d', '#2d6b98', 8); disc('y', 8, 6, 3.6); r('r', 0, 9, 16, 2); r('o', 2, 11, 12, 2); r('#2d6b98', 0, 13, 16, 3); dots('y', [2, 9, 7, 10, 12, 9, 5, 12, 10, 12], 2); wave('b', 14, 0.6, 1.1); },
    // thunder
    chg0: function () { sky('#51407a'); art(['rrrrr..', 'wwwww..', 'rrrrr..', 'wwwww..', 'rrrrrr.', 'rrrrrrr', '.rrrrrr', '..RRRR.'], 4, 4); dots('y', [1, 4, 2, 5, 1, 6, 13, 3, 12, 4, 13, 5, 1, 11, 2, 12, 14, 9, 13, 14, 9, 1, 8, 2]); },
    chg1: function () { sky('#1d3558'); [[4, 5], [11, 10]].forEach(function (q) { line('c', q[0] - 3, q[1], q[0] + 3, q[1]); line('c', q[0], q[1] - 3, q[0], q[1] + 3); line('w', q[0] - 2, q[1] - 2, q[0] + 2, q[1] + 2); line('w', q[0] + 2, q[1] - 2, q[0] - 2, q[1] + 2); }); dots('y', [7, 7, 8, 8, 8, 6, 9, 5, 7, 9, 6, 10, 10, 6, 5, 9]); },
    str0: function () { sky('#2b2a4a'); line('y', 10, 0, 6, 6, 2); line('y', 6, 6, 9, 7, 2); line('y', 9, 7, 5, 15, 2); line('y', 8, 9, 13, 12); line('y', 13, 12, 12, 15); line('y', 6, 5, 2, 9); line('y', 2, 9, 3, 12); line('w', 10, 0, 7, 5); },
    str1: function () { sky('#4a4668'); line('t', 1, 1, 6, 5, 2); line('t', 14, 1, 9, 5, 2); r('w', 3, 6, 10); r('w', 2, 7, 12, 2); r('g', 3, 8, 10); r('r', 2, 9, 12, 5); r('R', 3, 14, 10); line('y', 2, 9, 5, 13); line('y', 5, 13, 8, 9); line('y', 8, 9, 11, 13); line('y', 11, 13, 13, 9); dots('y', [0, 6, 15, 6, 7, 2], 1, 2); },
    // cirrus
    ci0: function () { sky('#3f7fb8'); line('w', 1, 8, 14, 8); line('w', 8, 1, 8, 14); line('c', 3, 3, 13, 13); line('c', 13, 3, 3, 13); dots('w', [6, 3, 10, 3, 6, 13, 10, 13, 3, 6, 3, 10, 13, 6, 13, 10]); },
    ci1: function () { sky('#79b7dc'); art(['......w.w....', '....nwwww....', '...nnwwwww...', '..nnwwkwwww..', '..nnwwwwwwww.', '.nnwwwwwwwwg.', '.nnwwwww..ww.', 'nnwwwwww.....', 'nnwwwwww.....', 'n.wwwwwww....', 'n.wwwwwwww...', '..gggggggg...'], 1, 2); },
    ci2: function () { sky('#3a6ea5'); ring('w', 7.5, 7.5, 7.4, 1.1); ring('c', 7.5, 7.5, 6.3, 0.9); disc('y', 7.5, 7.5, 2.9); dots('o', [1, 7, 14, 7], 1, 2); },
    // stratus
    st0: function () { sky('#a9bcc7', '#5d8199', 12); art(['..rr..', '.yyyy.', '..rr..', '.wwww.', '.rrrr.', '.wwww.', '.rrrr.', 'wwwwww', 'rrrrrr', 'wwwwww'], 5, 2); r('y', 0, 3, 5); r('y', 11, 3, 5); r('#dfe8ed', 0, 9, 8); r('#dfe8ed', 9, 11, 7); r('#dfe8ed', 1, 13, 11); },
    st1: function () { sky('#f6c79a', '#e9a37c', 6); disc('y', 8, 6, 4); art(['..E..', '..E..', '.EEE.', '.EEE.', 'EEEEE', '..N..'], 1, 5); art(['..E..', '.EEE.', '.EEE.', 'EEEEE', '..N..'], 11, 6); r('#fbeadb', 0, 8, 12, 1); r('#fbeadb', 4, 10, 12, 2); r('#fff6ee', 0, 13, 16, 3); },
    st2: function () { sky('#777f89'); r('#878f99', 0, 0, 16, 4); r('#69717b', 0, 12, 16, 4); art(['.www....www.', 'ww.ww..ww.ww', 'w...wwww...w', 'w....ww....w', 'w...wwww...w', 'ww.ww..ww.ww', '.www....www.'], 2, 4); },
    // cirrocumulus
    cc0: function () { sky('#b6e0ea', '#4a90b8', 11); art(['....bbbbb....c', '..bbBbBbBb..bb', '.bkbbBbBbBbbb.', 'bbbbBbBbBbbbb.', '.cccccccccc.bb', '...wwwwww...cb'], 1, 4); wave('c', 13, 0.6, 1); },
    cc1: function () { sky('#d8f0f8'); [2, 6, 10, 14].forEach(function (y, i) { wave(i % 2 ? '#7fb9d6' : '#5a9ac0', y, 1.2, 0.85, 2, i); }); dots('w', [3, 4, 9, 8, 13, 4, 5, 12]); },
    cc2: function () { sky('#f3d9a0', '#e0b46a', 6); disc('o', 12, 3, 2); wave('#c48f48', 6, 1.6, 0.42, 1); wave('#b57f3c', 9, 1, 0.6, 1, 1); wave('#b57f3c', 12, 1, 0.6, 1, 2.4); wave('#b57f3c', 14, 1, 0.6, 1, 4); art(['.E.', 'EE.', 'EEE', '.E.', '.E.'], 2, 2); },
    // altocumulus
    ac0: function () { sky('#9fd0ea', '#6fae55', 11); art(['...ww.www...', '.wwwwwwwwww.', 'wwwwwwwwwkkk', 'wwwwwwwwwkwk', 'wwwwwwwwwkkk', '.wwwgwwwgw..', '..gggggggg..', '..kk...kk...', '..kk...kk...'], 2, 4); },
    ac1: function () { sky('#f0b48a', '#e08f75', 8); art(['r.........r', 'rr...k...rr', 'g.g.gkg.g.g', 'ggg.ggg.ggg', 'gsg.gsg.gsg', 'ggggggggggg', 'ggggggggggg', 'ggsgNNNgsgg', 'ggggNNNgggg', 'ssssNNNssss'], 2, 3); r('E', 0, 13, 16, 3); },
    ac2: function () { sky('#f5a25d', '#d9674f', 8); disc('y', 8, 12, 4); r('#7a3a4a', 0, 13, 16, 3); [[6, 1], [2, 3], [10, 3], [0, 6], [12, 6]].forEach(function (q) { dots('k', [q[0], q[1], q[0] + 1, q[1] + 1, q[0] + 2, q[1] + 1, q[0] + 3, q[1]]); }); },
    // stratocumulus
    sc0: function () { sky('#6da2c2'); r('#f2f6f9', 6, 9, 10, 4); r('#c9d3df', 6, 12, 10, 1); disc('#f2f6f9', 6, 7, 5.4); ring('s', 6, 7, 4, 1); ring('s', 6, 7, 1.9, 1); r('#f2f6f9', 6, 8, 4, 1); },
    sc1: function () { sky('#8a5210'); [[1, 0], [6, 0], [11, 0], [-2, 5], [3, 5], [8, 5], [13, 5], [1, 10], [6, 10], [11, 10], [-2, 15], [3, 15], [8, 15], [13, 15]].forEach(function (q, i) { r(i % 3 ? 'y' : 'o', q[0] + 1, q[1], 2, 4); r(i % 3 ? 'y' : 'o', q[0], q[1] + 1, 4, 2); }); },
    sc2: function () { sky('#2f7ab0'); [[3, 3, 4], [11, 4, 4.4], [6, 11, 4.4], [13, 13, 3.4]].forEach(function (q) { ring('w', q[0], q[1], q[2], 1.3); }); dots('c', [3, 3, 11, 4, 6, 11]); },
    // altostratus
    as0: function () { sky('#b8c6cc', '#6a8fa3', 9); disc('#f2e3ae', 8, 6, 3.6); r('#cdd7da', 2, 5, 8); r('#cdd7da', 6, 7, 9); dots('#f2e3ae', [5, 10, 7, 12, 6, 14], 5, 1); dots('#f2e3ae', [4, 12, 11, 11], 2, 1); },
    as1: function () { sky('#1c2348'); disc('#7a4a5a', 7.5, 7.5, 7.4); disc('#b98a52', 7.5, 7.5, 6.2); disc('#6f9a8a', 7.5, 7.5, 5.1); disc('#4f74a8', 7.5, 7.5, 4.2); disc('#f4f2dc', 7.5, 7.5, 3); dots('#cfcdb8', [7, 6, 9, 8, 6, 9]); },
    as2: function () { sky('#39445c'); disc('#f4f2dc', 8, 5, 3.4); for (var x = 0; x < 16; x++) { var m = x % 4, y = 4 + Math.abs(x - 8) * 0.5 | 0; r(m === 0 ? '#8d98a8' : m === 3 ? '#a3adbb' : '#bcc5d0', x, y < 5 ? 5 : y, 1, 9 + (m === 1 ? 1 : 0)); } r('#e4e8ed', 0, 8, 1, 1); wave('#e4e8ed', 14, 0.8, 1.6); },
    // cumulus
    cu0: function () { sky('#8ccbe8'); disc('r', 7.5, 5.5, 4.8); r('y', 5, 1, 2, 9); r('y', 9, 1, 2, 9); r('r', 7, 1, 2, 9); r('R', 6, 10, 4); line('k', 5, 10, 6, 12); line('k', 10, 10, 9, 12); r('n', 6, 12, 4, 3); r('t', 6, 12, 4); dots('o', [1, 12, 14, 10], 1, 3); dots('o', [0, 13, 2, 13, 13, 11, 15, 11]); },
    cu1: function () { sky('#c9e2a8'); disc('#fff7e2', 5, 5, 3); disc('#fff7e2', 10, 5, 3); disc('#fff7e2', 8, 4, 3); disc('#fff7e2', 8, 8, 3.4); dots('#d9cfa8', [4, 5, 7, 3, 10, 4, 8, 7, 6, 8, 11, 7, 9, 9]); art(['e............e', 'ee..........ee', 'eel........lee', 'Eeel......leeE', '.Eeelle.leeeE.', '..EEeelleeEE..', '....EEEEEE....'], 1, 7); },
    cu2: function () { sky('#7fc0e4', '#6fae55', 8); for (var y = 8; y < 16; y++) { var w = 1 + (y - 8) * 0.8 | 0; r('d', 8 - w, y, w * 2, 1); } dots('y', [7, 9, 7, 11, 7, 14], 2, 1); r('w', 1, 2, 5, 2); r('w', 2, 1, 3); r('w', 10, 2, 5, 2); r('w', 11, 1, 3); r('w', 4, 5, 3); r('w', 9, 5, 3); r('w', 7, 7, 2); },
    // nimbostratus
    ns0: function () { sky('#6b8aa6'); r('w', 2, 3, 12, 11); r('r', 2, 3, 12, 3); dots('k', [4, 2, 11, 2], 1, 3); dots('b', [4, 8, 7, 8, 10, 8, 4, 11, 7, 11, 10, 11], 2, 2); dots('g', [3, 7, 6, 7, 9, 7, 12, 7], 1, 6); },
    ns1: function () { sky('#7d8c99'); art(['.....ddd.dd....', '...dddddddddd..', '.ddddddddddd.d.', '..dddd.ddddddd.', 'ddd.ddddd.dd...'], 1, 3); dots('g', [0, 10, 5, 12, 1, 14], 6, 1); dots('g', [9, 10, 12, 14], 4, 1); },
    ns2: function () { sky('#5b3b2b'); r('#4f7288', 2, 1, 12, 12); r('w', 7, 1, 2, 12); r('w', 2, 6, 12, 1); dots('c', [3, 2, 5, 4, 10, 2, 12, 4, 4, 8, 6, 10, 11, 8, 9, 10], 1, 2); r('t', 0, 13, 16, 2); art(['.r.', 'rer', '.E.', 'nnn'], 11, 9); },
    // cumulonimbus
    cb0: function () { sky('#d9a066'); art(['.kkkkkkkkkkkk', 'kdsssssssssdk', '.kkdddddddkk.', '....kdddk....', '....kdddk....', '...kkdddkk...', '..kddddddddk.', '..kkkkkkkkkk.'], 1, 5); dots('y', [4, 2, 8, 1, 11, 3, 6, 3]); },
    cb1: function () { sky('#3d5370'); [[4, 3, 2.3], [11, 5, 2.8], [5, 10, 2.8], [12, 13, 2.2]].forEach(function (q) { disc('#b9d6e6', q[0], q[1], q[2]); disc('w', q[0] - 0.6, q[1] - 0.6, q[2] - 1); }); dots('s', [4, 0, 11, 0, 5, 5, 12, 9], 1, 2); },
    cb2: function () { sky('#5a6a52', '#3c4a34', 13); r('k', 0, 0, 16, 2); [[1, 14], [2, 12], [3, 10], [4, 9], [5, 7], [6, 6], [7, 5], [7, 4], [6, 4], [6, 3], [7, 2]].forEach(function (q, i) { r(i % 2 ? 's' : 'g', q[0], 2 + i, q[1], 1); }); dots('n', [3, 12, 11, 13, 12, 10, 4, 14]); },
    // squall line
    sq0: function () { sky('#4f8fb8', '#7bb15a', 13); r('k', 2, 1, 1, 14); r('k', 2, 2, 2, 1); for (var i = 0; i < 12; i++) { var h = 7 - Math.round(i * 0.35), y = 2 + Math.round(i * 0.35 + Math.sin(i * 0.6) * 0.6); r((i / 3 | 0) % 2 ? 'w' : 'o', 3 + i, y, 1, h); r((i / 3 | 0) % 2 ? 'g' : 'r', 3 + i, y + h - 1); } dots('c', [5, 10, 10, 11], 5, 1); },
    sq1: function () { sky('#c8b98a', '#4f8a4a', 13); r('k', 0, 0, 16, 3); r('#39465e', 0, 3, 15, 2); r('#4f607c', 0, 5, 13, 2); r('#6b7f9c', 0, 7, 10, 1); r('#8fa3bd', 0, 8, 7, 1); r('#b9c8da', 0, 9, 4, 1); dots('c', [1, 11, 4, 11, 7, 10], 1, 2); },
    sq2: function () { sky('#7a3f3a'); [1, 6, 11].forEach(function (y, i) { var c = ['y', 'o', 'y'][i]; r(c, 1 + i, y + 1, 9, 2); art(['#...', '##..', '##..', '#...'].map(function (q) { return q.replace(/#/g, c); }), 10 + i, y); r(c, 12 + i, y + 1, 1, 2); }); },
    // monsoon
    mo0: function () { sky('#a8e0ee', '#2f86b0', 11); art(['......w.....', '.....ww.w...', '....www.ww..', '...wwww.www.', '..wwwww.wwww', '.......N....', '.NNNNNNNNNN.', '..nnnnnnnn..'], 2, 3); wave('c', 12, 0.6, 1); wave('c', 14, 0.6, 1, 1, 2); },
    mo1: function () { sky('#5fa04f'); for (var y = 0; y < 16; y++) { var m = 7 + Math.sin(y * 0.55) * 3, w = 2 + y * 0.28; r('t', Math.round(m - w) - 1, y, Math.round(w * 2) + 2, 1); r('b', Math.round(m - w), y, Math.round(w * 2), 1); } dots('c', [7, 2, 9, 5, 6, 9, 5, 12, 9, 13], 2, 1); dots('E', [1, 1, 13, 1, 14, 6, 1, 6], 2, 2); },
    mo2: function () { sky('#24577c'); art(['.w..www..www', 'ww.ww.wwww.w', '.w.w..ww...w', '.w.w..ww...w', '.w.ww.wwww.w', 'www.www..www'], 2, 2); [[1, 10], [6, 11], [11, 10]].forEach(function (q) { drop(q[0] + 1, q[1], 'c', 'b'); }); },
    // cyclone
    cy0: function () { sky('#f2b08a', '#c9564a', 8); wave('#e8806a', 8, 1, 0.8, 2); wave('#e8806a', 12, 1, 0.8, 1, 2); art(['.www.', '.wgw.', '.wrw.', '.wrw.', '.wrw.', '.wrw.', '.wrw.', 'wwrww', 'wrrrw', 'wrrrw', '.www.'], 6, 2); },
    cy1: function () { sky('#2b3a5c'); art(['.....wwwwww.....', '...wwwwwwwwww...', '.wwwwwbbbbwwwww.', 'wwwwwbbkkbbwwwww', 'wwwwwbkkwbbwwwww', '.wwwwbbkkbbwwww.', '...wwwbbbbwww...', '.....wwwwww.....'], 0, 4); line('s', 1, 4, 5, 1); line('s', 5, 1, 10, 1); line('s', 10, 1, 14, 4); line('s', 1, 12, 5, 14); line('s', 5, 14, 10, 14); line('s', 10, 14, 14, 12); },
    cy2: function () { sky('#7f93a8', '#2d6b98', 12); r('t', 3, 12, 10, 2); r('#f0dcae', 4, 11, 8, 1); palm(9, 4); dots('w', [0, 2, 1, 6, 0, 9], 3, 1); wave('c', 14, 0.7, 1.2); }
  };
  var cache = {};
  return {
    has: function (id) { return !!ART[id]; },
    badge: function (id) {
      if (!cache[id]) { var c = document.createElement('canvas'); c.width = c.height = 16; g = c.getContext('2d'); ART[id](); cache[id] = '<img class="badge" alt="" src="' + c.toDataURL() + '">'; }
      return cache[id];
    }
  };
})();
