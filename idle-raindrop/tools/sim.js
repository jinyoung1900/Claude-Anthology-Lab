// Balance check: a greedy bot plays the game. Usage: node tools/sim.js [hours] [tapsPerSec]
const C = require('../app/src/main/assets/game/core.js');
const hours = +process.argv[2] || 6, tps = +process.argv[3] || 1.5;
let seed = 7, best = 0; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const s = C.fresh(1); let d = C.derive(s), t = 0, tapAcc = 0, cycleStart = 0, lastV = 0, stage = 0;
const T = x => C.fmtTime(x).padStart(8);
while (t < hours * 3600) {
  const dt = 0.25; t += dt; tapAcc += tps * dt;
  while (tapAcc >= 1) { tapAcc--; C.tap(s, d); }
  const ev = C.tick(s, d, dt, rnd());
  if (ev.swallow && rnd() < .6) C.swallow(s, d, rnd());
  if (s.charge >= 100) C.strike(s, d);
  C.checkAch(s);
  // buy best payback
  for (let k = 0; k < 8; k++) {
    let best = null;
    C.UPS.forEach(u => { if (C.upVisible(s, u) && u.cost <= s.drops) best = best || { u }; });
    if (best) { C.buyUp(s, best.u.id); d = C.derive(s); continue; }
    let bi = -1, bv = 1e99;
    C.GENS.forEach((g, i) => { if (C.genVisible(s, i)) { const v = C.unitCost(s, i) / d.per[i]; if (v < bv) { bv = v; bi = i; } } });
    if (bi >= 0 && C.buyGen(s, bi, 1)) d = C.derive(s); else break;
  }
  d = C.derive(s);
  if (d.stage !== stage) { stage = d.stage; if (stage > best && (best = stage)) console.log(T(t), `cycle ${s.evap + 1} +${C.fmtTime(t - cycleStart)}`.padEnd(20), C.STAGES[stage].name.padEnd(18), 'rate', C.fmt(d.rate), 'tap', C.fmt(d.tap), 'clouds', C.total(s), 'vapor', C.vaporGain(s)); }
  const v = C.vaporGain(s);
  // evaporate when it would roughly double total vapor, or progress stalls
  if (v >= Math.max(15, s.vaporTotal * 0.6)) {
    console.log(T(t), '--- EVAPORATE #' + (s.evap + 1), 'after', C.fmtTime(t - cycleStart), 'for', v, 'total', s.vaporTotal + v);
    C.evaporate(s); cycleStart = t; stage = 0;
    for (let k = 0; k < 400; k++) { const a = C.PERKS.filter(p => C.perk(s, p.id) < p.max && C.perkCost(s, p.id) <= s.vapor).sort((a, b) => C.perkCost(s, a.id) - C.perkCost(s, b.id)); if (!a[0]) break; C.buyPerk(s, a[0].id); }
    d = C.derive(s);
  }
}
console.log('end', T(t), 'stage', C.STAGES[C.stageOf(s)].name, 'ach', Object.keys(s.ach).length + '/' + C.ACH.length, 'strikes', s.stats.strikes, 'swallows', s.stats.swallows, 'owned', s.owned.join(','));
