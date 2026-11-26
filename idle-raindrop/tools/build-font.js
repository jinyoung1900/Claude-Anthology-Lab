// Turns the glyphs in font.js into a TrueType font embedded in font.css: node tools/build-font.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '../app/src/main/assets/game');
const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(dir, 'font.js'), 'utf8') + ';this.FONT=FONT', ctx);
const FONT = ctx.FONT, P = 100, EM = 1000, ASC = 800, DESC = 200;
const chars = Object.keys(FONT).sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
const be = (...v) => { const b = Buffer.alloc(v.reduce((n, [s]) => n + s, 0)); let o = 0; v.forEach(([s, x]) => { if (s === 1) b.writeUInt8(x & 255, o); else if (s === 2) b.writeUInt16BE(x & 65535, o); else if (s === 4) b.writeUInt32BE(x >>> 0, o); else b.writeBigUInt64BE(BigInt(x), o); o += s; }); return b; };

// Glyph outlines: each horizontal run of pixels becomes one rectangle, merged downward when runs line up.
function outline(g) {
  const rects = []; let open = {};
  g.rows.forEach((r, j) => {
    const next = {};
    for (let x = 0; x < r.length; x++) if (r[x] === '#') { let s = x; while (r[x + 1] === '#') x++; const k = s + ',' + (x + 1); if (open[k]) { open[k].y1 = g.y + j + 1; next[k] = open[k]; } else { const q = { x0: s, x1: x + 1, y0: g.y + j, y1: g.y + j + 1 }; rects.push(q); next[k] = q; } }
    open = next;
  });
  return rects.map(r => ({ x0: r.x0 * P, x1: r.x1 * P, top: (7 - r.y0) * P, bot: (7 - r.y1) * P }));
}
function glyf(rects) {
  if (!rects.length) return Buffer.alloc(0);
  const xs = rects.flatMap(r => [r.x0, r.x1]), ys = rects.flatMap(r => [r.top, r.bot]);
  const out = [be([2, rects.length], [2, Math.min(...xs)], [2, Math.min(...ys)], [2, Math.max(...xs)], [2, Math.max(...ys)])];
  rects.forEach((_, i) => out.push(be([2, i * 4 + 3]))); out.push(be([2, 0]));
  const pts = rects.flatMap(r => [[r.x0, r.bot], [r.x0, r.top], [r.x1, r.top], [r.x1, r.bot]]);
  out.push(Buffer.alloc(pts.length, 1));
  let p = 0; pts.forEach(q => { out.push(be([2, q[0] - p])); p = q[0]; });
  p = 0; pts.forEach(q => { out.push(be([2, q[1] - p])); p = q[1]; });
  let b = Buffer.concat(out); if (b.length % 4) b = Buffer.concat([b, Buffer.alloc(4 - b.length % 4)]);
  return b;
}
const box = [{ x0: 0, x1: 400, top: 700, bot: 0 }];
const glyphs = [{ r: box, w: 5 }].concat(chars.map(c => ({ r: outline(FONT[c]), w: FONT[c].w + 1 })));
const bodies = glyphs.map(g => glyf(g.r)), loca = [0]; bodies.forEach(b => loca.push(loca[loca.length - 1] + b.length));
const maxC = Math.max(...glyphs.map(g => g.r.length)), maxW = Math.max(...glyphs.map(g => g.w)) * P;
// cmap format 4, one segment per character
const segs = chars.map((c, i) => [c.codePointAt(0), i + 1]).concat([[0xffff, 0]]), n = segs.length, sr = 2 * 2 ** Math.floor(Math.log2(n));
const c4 = Buffer.concat([be([2, 4], [2, 16 + n * 8], [2, 0], [2, n * 2], [2, sr], [2, Math.log2(sr / 2)], [2, n * 2 - sr]),
  ...segs.map(s => be([2, s[0]])), be([2, 0]), ...segs.map(s => be([2, s[0]])), ...segs.map(s => be([2, s[0] === 0xffff ? 1 : s[1] - s[0]])), ...segs.map(() => be([2, 0]))]);
const str = { 1: 'Raindrop Pixel', 2: 'Regular', 3: 'RaindropPixel1', 4: 'Raindrop Pixel', 6: 'RaindropPixel' };
let so = 0; const recs = [], strs = [];
Object.entries(str).forEach(([id, s]) => { const b = Buffer.from(s, 'utf16le').swap16(); recs.push(be([2, 3], [2, 1], [2, 0x409], [2, +id], [2, b.length], [2, so])); strs.push(b); so += b.length; });
const T = {
  'OS/2': Buffer.concat([be([2, 4], [2, 450], [2, 400], [2, 5], [2, 0], [2, 650], [2, 600], [2, 0], [2, 75], [2, 650], [2, 600], [2, 0], [2, 350], [2, 50], [2, 300], [2, 0]), Buffer.alloc(10),
    be([4, 1], [4, 0], [4, 0], [4, 0]), Buffer.from('RAIN'), be([2, 0x40], [2, segs[0][0]], [2, segs[n - 2][0]], [2, ASC], [2, -DESC], [2, 0], [2, ASC], [2, DESC], [4, 1], [4, 0], [2, 500], [2, 700], [2, 0], [2, 32], [2, 0])]),
  cmap: Buffer.concat([be([2, 0], [2, 1], [2, 3], [2, 1], [4, 12]), c4]),
  glyf: Buffer.concat(bodies),
  head: be([4, 0x10000], [4, 0x10000], [4, 0], [4, 0x5f0f3cf5], [2, 3], [2, EM], [8, 0], [8, 0], [2, 0], [2, -DESC], [2, maxW], [2, ASC], [2, 0], [2, 8], [2, 2], [2, 1], [2, 0]),
  hhea: Buffer.concat([be([4, 0x10000], [2, ASC], [2, -DESC], [2, 0], [2, maxW], [2, 0], [2, 0], [2, maxW], [2, 1], [2, 0], [2, 0]), Buffer.alloc(10), be([2, glyphs.length])]),
  hmtx: Buffer.concat(glyphs.map(g => be([2, g.w * P], [2, g.r.length ? Math.min(...g.r.map(r => r.x0)) : 0]))),
  loca: Buffer.concat(loca.map(o => be([4, o]))),
  maxp: be([4, 0x10000], [2, glyphs.length], [2, maxC * 4], [2, maxC], [2, 0], [2, 0], [2, 1], [2, 0], [2, 0], [2, 0], [2, 0], [2, 0], [2, 0], [2, 0], [2, 0]),
  name: Buffer.concat([be([2, 0], [2, recs.length], [2, 6 + recs.length * 12]), ...recs, ...strs]),
  post: be([4, 0x30000], [4, 0], [2, -100], [2, 50], [4, 0], [4, 0], [4, 0], [4, 0], [4, 0])
};
const pad = b => b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - b.length % 4)]) : b;
const sum = b => { b = pad(b); let s = 0; for (let i = 0; i < b.length; i += 4) s = (s + b.readUInt32BE(i)) >>> 0; return s; };
const tags = Object.keys(T).sort(), nt = tags.length, sq = 16 * 2 ** Math.floor(Math.log2(nt));
let off = 12 + nt * 16; const dirs = [], data = [];
tags.forEach(t => { dirs.push(Buffer.concat([Buffer.from(t), be([4, sum(T[t])], [4, off], [4, T[t].length])])); const p = pad(T[t]); data.push(p); off += p.length; });
const ttf = Buffer.concat([be([4, 0x10000], [2, nt], [2, sq], [2, Math.log2(sq / 16)], [2, nt * 16 - sq]), ...dirs, ...data]);
const hi = tags.indexOf('head'), headOff = 12 + nt * 16 + data.slice(0, hi).reduce((a, b) => a + b.length, 0);
ttf.writeUInt32BE((0xb1b0afba - sum(ttf)) >>> 0, headOff + 8);
fs.writeFileSync(path.join(dir, 'font.css'), "/* Built by tools/build-font.js from font.js */\n@font-face{font-family:'Raindrop Pixel';src:url(data:font/ttf;base64," + ttf.toString('base64') + ") format('truetype')}\n");
console.log(chars.length + ' glyphs, ' + ttf.length + ' bytes');
