// Draws the pixel launcher icon as Android vectors: node tools/build-icon.js
const fs = require('fs'), path = require('path'), out = path.join(__dirname, '../app/src/main/res/drawable');
const N = 36, U = 3, grid = () => Array.from({ length: N }, () => Array(N).fill(null));
const SHAPE = [[-1.15, 0.22, 0.5], [-0.62, -0.08, 0.68], [0.02, -0.36, 0.86], [0.66, -0.1, 0.7], [1.18, 0.24, 0.48], [0.4, 0.26, 0.62], [-0.4, 0.28, 0.62]];
const fg = grid(), bg = grid(), mono = grid(), R = 6.6, X = 17.5, Y = 16;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  let e = 0, p = 0; const lx = (x - X) / R, ly = (y - Y) / R;
  SHAPE.forEach(s => { const dx = lx - s[0], dy = ly - s[1], d = Math.hypot(dx, dy); if (s[2] - d > e) { e = s[2] - d; p = (dy * 0.85 + dx * 0.5) / s[2]; } });
  if (e > 0) { const v = 0.6 - ly * 0.36 - p * 0.3; fg[y][x] = e * R < 1 ? '#5E7C9E' : v > 0.62 ? '#FFFFFF' : v > 0.4 ? '#E6F0F6' : v > 0.18 ? '#BFD4E4' : '#93B0CA'; mono[y][x] = '#FFFFFF'; }
  const b = Math.floor(y / 6 + ((x + y) % 2 ? 0.25 : 0)), hill = 27 + Math.sin(x / 5) * 1.6;
  bg[y][x] = y >= hill + 3 ? '#1F5040' : y >= hill ? (y - hill < 1 ? '#8FBF62' : '#559653') : ['#62A8D6', '#6FB2DA', '#83BFE0', '#9ACDE4', '#B4DAE6', '#C8E6E6'][Math.min(5, b)];
}
[[13, 15], [21, 15]].forEach(([x, y]) => { for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) fg[y + j][x + i] = '#25304A'; });
fg[19][17] = fg[19][18] = '#25304A'; fg[18][16] = fg[18][19] = '#25304A';
[[11, 17], [23, 17]].forEach(([x, y]) => { fg[y + 1][x] = fg[y + 1][x + 1] = '#F2A09A'; });
[[11, 23], [17, 24], [23, 23]].forEach(([x, y]) => [[0, 0, 'a'], [0, 1, 'a'], [-1, 2, 'a'], [0, 2, 'c'], [1, 2, 'a'], [-1, 3, 'b'], [0, 3, 'b'], [1, 3, 'b']].forEach(([i, j, k]) => { if (y + j < N) { fg[y + j][x + i] = { a: '#3A86C0', b: '#2766A0', c: '#F0FAFF' }[k]; mono[y + j][x + i] = '#FFFFFF'; } }));
[[13, 15], [21, 15]].forEach(([x, y]) => { for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) mono[y + j][x + i] = null; });
function save(name, g) {
  const by = {};
  g.forEach((r, y) => { for (let x = 0; x < N; x++) if (r[x]) { const s = x, c = r[x]; while (r[x + 1] === c) x++; (by[c] = by[c] || []).push(`M${s * U},${y * U}h${(x - s + 1) * U}v${U}h-${(x - s + 1) * U}z`); } });
  fs.writeFileSync(path.join(out, name + '.xml'), `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n` + Object.entries(by).map(([c, d]) => `    <path android:fillColor="${c}" android:pathData="${d.join('')}" />\n`).join('') + '</vector>\n');
}
save('ic_fg', fg); save('ic_bg', bg); save('ic_mono', mono);
