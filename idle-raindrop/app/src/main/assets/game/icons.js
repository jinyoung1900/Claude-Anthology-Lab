/* Pixel icons. Line icons are text maps; cloud badges are built on a 16x16 grid and shaded automatically. */
var Icons = (function () {
  'use strict';
  var MAP = {
    cloud: ['............', '....###.....', '...#...##...', '..#......#..', '.##.......#.', '#..........#', '#..........#', '.##########.', '............', '..#..#..#...', '.#..#..#....', '............'],
    wind: ['............', '......###...', '.........#..', '.........#..', '#########...', '............', '###########.', '...........#', '...........#', '######...##.', '......#.....', '....##......'],
    steam: ['............', '..#...#...#.', '.#...#...#..', '.#...#...#..', '..#...#...#.', '..#...#...#.', '.#...#...#..', '.#...#...#..', '............', '############', '.##########.', '............'],
    book: ['..########..', '.#.......##.', '.#.#####.##.', '.#.......##.', '.#.####..##.', '.#.......##.', '.#.......##.', '.#########..', '.#.......##.', '.#.......##.', '..########..', '............'],
    gear: ['............', '......###...', '......#.#...', '#######.####', '......#.#...', '......###...', '..###.......', '..#.#.......', '###.########', '..#.#.......', '..###.......', '............'],
    down: ['............', '............', '............', '##........##', '###......###', '.###....###.', '..###..###..', '...######...', '....####....', '.....##.....', '............', '............'],
    play: ['............', '############', '#..........#', '#..##......#', '#..####....#', '#..######..#', '#..######..#', '#..####....#', '#..##......#', '#..........#', '############', '............'],
    bolt: ['......####..', '.....####...', '....####....', '....###.....', '...####.....', '...#######..', '..#######...', '.....###....', '....###.....', '....##......', '...##.......', '...#........']
  };
  function svg(name, px) {
    var m = MAP[name], o = '';
    m.forEach(function (r, y) { for (var x = 0; x < r.length; x++) if (r[x] === '#') { var s = x; while (r[x + 1] === '#') x++; o += 'M' + s + ' ' + y + 'h' + (x - s + 1) + 'v1h-' + (x - s + 1) + 'z'; } });
    return '<svg viewBox="0 0 12 12" width="' + 12 * px + '" height="' + 12 * px + '" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="' + o + '"/></svg>';
  }

  // ---- colour badges ----
  var cache = {};
  function badge(id) {
    if (cache[id]) return cache[id];
    var c = document.createElement('canvas'); c.width = c.height = 16;
    var g = c.getContext('2d'), m = [], x, y;
    for (y = 0; y < 16; y++) m.push(new Array(16).fill(0));
    function dot(x, y) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < 16 && y < 16) m[y][x] = 1; }
    function bar(x, y, w, h) { for (var j = 0; j < (h || 1); j++) for (var i = 0; i < w; i++) dot(x + i, y + j); }
    function disc(cx, cy, r) { for (var j = 0; j < 16; j++) for (var i = 0; i < 16; i++) if ((i - cx) * (i - cx) + (j - cy) * (j - cy) <= r * r) m[j][i] = 1; }
    var bg = '#7fb4d2', tones = ['#ffffff', '#dfeaf1', '#a9c2d6'], after = function () {}, paint = function (col, pts) { g.fillStyle = col; pts.forEach(function (p) { g.fillRect(p[0], p[1], p[2] || 1, p[3] || 1); }); };
    var rain = function (col, n) { var pts = []; for (var i = 0; i < n; i++) pts.push([3 + (i * 10 / (n - 1) | 0), 11 + i % 2, 1, 2 + (i % 2)]); paint(col, pts); };
    switch (id) {
      case 'ci': bar(2, 5, 4); bar(5, 4, 6); bar(10, 3, 4); bar(3, 9, 5); bar(7, 8, 6); bar(1, 12, 3); bar(4, 11, 5); break;
      case 'st': bar(1, 4, 12, 2); bar(3, 7, 12, 2); bar(0, 10, 13, 2); bar(5, 13, 9, 1); break;
      case 'cc': [[3, 3], [8, 3], [13, 3], [1, 7], [6, 7], [11, 7], [4, 11], [9, 11], [13, 12]].forEach(function (p) { bar(p[0] - 1, p[1], 3, 2); }); break;
      case 'ac': [[3, 4, 2], [9, 3, 2.3], [13, 7, 2], [6, 9, 2.6], [2, 12, 1.6], [11, 12, 2.2]].forEach(function (p) { disc(p[0], p[1], p[2]); bar(p[0] - 2, p[1] + 1, 5); }); break;
      case 'sc': bg = '#6da2c2'; [3, 8, 13].forEach(function (p) { disc(p, 6, 3); }); bar(0, 7, 16, 3); [1, 6, 11, 15].forEach(function (p) { disc(p, 12, 2); }); bar(0, 13, 16, 2); break;
      case 'as': bg = '#86a5b8'; bar(0, 4, 13); bar(3, 9, 13, 2); bar(0, 12, 15, 2); after = function () { paint('#ffe9a8', [[6, 2, 4, 1], [5, 3, 6, 4], [6, 7, 4, 1]]); paint('#dfeaf1', [[2, 5, 9, 1]]); }; break;
      case 'cu': bg = '#5f9fca'; disc(8, 6, 4); disc(4, 9, 3); disc(12, 9, 3); bar(2, 9, 12, 3); break;
      case 'ns': bg = '#62809a'; tones = ['#cfd9e2', '#aab8c6', '#8293a6']; disc(4, 6, 3); disc(9, 5, 3.5); disc(13, 7, 2.5); bar(1, 6, 14, 4); after = function () { rain('#cfe8f7', 5); }; break;
      case 'cb': bg = '#4d647f'; tones = ['#dbe2ec', '#aab6c8', '#7a88a0']; bar(1, 1, 14, 2); bar(3, 3, 10); disc(8, 6, 3.5); disc(5, 9, 2.5); disc(11, 9, 2.5); bar(3, 8, 10, 3); after = function () { paint('#ffd75e', [[8, 10, 2], [7, 11, 2], [7, 12, 3], [8, 13, 1], [7, 14, 1]]); }; break;
      case 'sq': bg = '#465a74'; tones = ['#c3cede', '#8f9db4', '#67758f']; for (x = 0; x < 16; x++) { var h = 10 - Math.round(x * 0.45); bar(x, h - 2, 1, 4); } disc(13, 4, 3); disc(8, 6, 3); after = function () { for (var i = 0; i < 6; i++) paint('#a9cbe2', [[4 + i * 2, 12 + i % 2, 1, 2]]); }; break;
      case 'mo': bg = '#3b5068'; tones = ['#aebcd0', '#8493ab', '#5f6e88']; disc(3, 4, 3); disc(8, 3, 4); disc(13, 4, 3); bar(0, 4, 16, 4); after = function () { for (var i = 0; i < 8; i++) paint('#8fd0f0', [[i * 2, 9 + (i * 3) % 4, 1, 3]]); paint('#3f8fc0', [[0, 14, 16, 2]]); }; break;
      case 'cy': bg = '#2f4058'; tones = ['#e4ebf4', '#b3c0d4', '#8391ab']; for (var a = 0; a < 11; a += 0.07) { var q = 1.8 + a * 0.52; [0, Math.PI].forEach(function (o) { dot(7.5 + Math.cos(a * 0.75 + o) * q, 7.5 + Math.sin(a * 0.75 + o) * q * 0.85); }); } break;
      case 'drop': bg = '#256a98'; tones = ['#ffffff', '#bfe2f5', '#7dbde0']; disc(7.5, 9.5, 4); [[7, 2, 2], [6, 4, 4], [5, 6, 6]].forEach(function (p) { bar(p[0], p[1], p[2], 2); }); break;
      case 'all': bg = '#3d7a4c'; tones = ['#e9f3d8', '#cfe4b8', '#a5c98d']; for (x = -6; x <= 6; x++) { var yy = Math.round(Math.sqrt(40 - x * x)); dot(8 + x, 11 - yy); dot(8 + x, 12 - yy); } bar(2, 12, 13, 2); bar(8, 8, 1, 3); bar(9, 7, 1, 2); bar(10, 6, 1, 1); break;
      case 'bolt': bg = '#4a4668'; tones = ['#fff3c4', '#ffd75e', '#e0a93a']; MAP.bolt.forEach(function (r, y) { for (var i = 0; i < 12; i++) if (r[i] === '#') dot(i + 2, y + 2); }); break;
    }
    g.fillStyle = bg; g.fillRect(0, 0, 16, 16);
    for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) if (m[y][x]) {
      var up = y && m[y - 1][x], dn = y < 15 && m[y + 1][x];
      g.fillStyle = !up ? tones[0] : !dn ? tones[2] : tones[1]; g.fillRect(x, y, 1, 1);
    }
    after();
    return (cache[id] = '<img class="badge" alt="" src="' + c.toDataURL() + '">');
  }
  return { svg: svg, badge: badge };
})();
