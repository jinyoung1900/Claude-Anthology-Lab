// Rule tests: node tools/test.js
const assert = require('assert'), C = require('../app/src/main/assets/game/core.js');
const t = (n, f) => { f(); console.log('ok  ' + n); };
const near = (a, b) => assert(Math.abs(a - b) <= Math.abs(b) * 1e-9 + 1e-9, a + ' vs ' + b);
t('bad saves load as a fresh game', () => {
  for (const r of [null, undefined, '', '{', '[]', '5', '"x"', 'null', '{"owned":"no","drops":"NaN","perks":{"tail":-4},"stats":7}', '{"drops":-5,"charge":9999}']) {
    const s = C.load(r, 1), d = C.derive(s);
    assert(s.drops >= 0 && s.charge <= 100 && s.owned.length === 12 && isFinite(d.rate) && isFinite(d.tap), String(r));
  }
});
t('save round trip', () => {
  const s = C.fresh(5); s.drops = 123.5; s.owned[3] = 7; s.ups.tap0 = 1; s.perks.tail = 2; s.vapor = 4; s.ach.tap1 = 1; s.buyMode = 'max'; s.settings.sound = false; s.buffs.storm = 9; s.evap = 3;
  assert.deepStrictEqual(C.load(JSON.stringify(s), 5), s);
});
t('bulk price equals buying one at a time', () => {
  const s = C.fresh(1); s.owned[2] = 13; let sum = 0; const b = C.bulkCost(s, 2, 10);
  for (let i = 0; i < 10; i++) { sum += C.unitCost(s, 2); s.owned[2]++; } near(b, sum);
});
t('Max buys all it can and never overspends', () => {
  for (const m of [0, 11.9, 12, 1e3, 3.7e9, 1e25]) { const s = C.fresh(1); s.drops = m; const n = C.maxBuy(s, 0); if (n) assert(C.buyGen(s, 0, n)); assert(s.drops >= 0); assert(s.drops < C.unitCost(s, 0)); }
});
t('cannot buy what you cannot afford', () => {
  const s = C.fresh(1); s.drops = 11; assert(!C.buyGen(s, 0, 1)); assert(!C.buyGen(s, 0, 0)); assert(!C.buyUp(s, 'tap0')); assert(!C.buyPerk(s, 'tail')); assert.strictEqual(s.drops, 11);
});
t('away rain is capped, reduced, and ignores clock rollback', () => {
  const s = C.fresh(1000); s.owned[4] = 10; const r = C.derive(s).rate, o = C.offline(s, 1000 + 20 * 3600e3);
  assert(o.capped); near(o.gain, r * 8 * 3600 * 0.5);
  const b = s.drops; s.last = 9e12; assert.strictEqual(C.offline(s, 5000), null); assert.strictEqual(s.drops, b); assert.strictEqual(s.last, 5000);
});
t('evaporating keeps vapor and perks, resets the rest', () => {
  const s = C.fresh(1); s.perks.start = 2; s.cycleRain = 5e8; assert.strictEqual(C.evaporate(s), 0); s.cycleRain = 1e9; s.owned[5] = 9; s.ups.tap0 = 1;
  assert.strictEqual(C.evaporate(s), 10); assert.deepStrictEqual(s.owned.slice(0, 3), [5, 5, 0]); assert.deepStrictEqual(s.ups, {}); assert.strictEqual(s.vapor, 10); assert.strictEqual(s.evap, 1);
});
t('thunder only when charged', () => { const s = C.fresh(1); s.charge = 99; assert.strictEqual(C.strike(s, C.derive(s)), 0); s.charge = 100; assert(C.strike(s, C.derive(s)) > 0); assert.strictEqual(s.charge, 0); assert(s.buffs.storm > 0); });
t('income does not depend on frame rate', () => {
  const run = dt => { const s = C.fresh(1); s.owned[0] = 20; const d = C.derive(s); for (let i = 0; i < 60 / dt; i++) C.tick(s, d, dt, 0.5); return s.drops; };
  assert(Math.abs(run(1 / 64) - run(0.5)) < 1e-6);
});
t('numbers read well', () => {
  [[0, '0'], [0.25, '0.2'], [9.99, '9.9'], [999.9, '999'], [1000, '1.00K'], [12345, '12.3K'], [999999, '999K'], [1e6, '1.00M'], [1e33, '1.00Dc'], [NaN, '0'], [1.5e40, '1.50e40']].forEach(([n, e]) => assert.strictEqual(C.fmt(n), e));
});
t('every id is unique', () => [C.UPS, C.PERKS, C.ACH].forEach(l => assert.strictEqual(new Set(l.map(x => x.id)).size, l.length)));
t('ad rewards double the gift and add a quarter more vapor', () => {
  const s = C.fresh(1); s.buffs.rain = 12; C.doubleGift(s, { kind: 'rain' }); assert.strictEqual(s.buffs.rain, 42);
  C.doubleGift(s, { kind: 'tap' }); assert.strictEqual(s.buffs.tap, 20); C.doubleGift(s, { kind: 'gift', n: 50 }); assert.strictEqual(s.drops, 50);
  assert.strictEqual(C.vaporWithAd(s), 0); s.cycleRain = 1e9; assert.strictEqual(C.evaporate(s, true), 12);
});
