/* Idle Raindrop: game rules. No DOM in here, so Node can run it for tests and balance sims. */
var Core = (function () {
  'use strict';

  var SAVE_VERSION = 1;
  var COST_GROWTH = 1.15;

  // Real cloud genera, in the order the player condenses them.
  var GENS = [
    { id: 'ci', code: 'Ci', name: 'Cirrus',        note: 'A thread of ice, high up',       cost: 12, rate: 0.25 },
    { id: 'st', code: 'St', name: 'Stratus',       note: 'A low grey blanket',             cost: 150, rate: 1.6 },
    { id: 'cc', code: 'Cc', name: 'Cirrocumulus',  note: 'Ripples, like wet sand',         cost: 2100, rate: 10 },
    { id: 'ac', code: 'Ac', name: 'Altocumulus',   note: 'A flock drifting east',          cost: 3.2e4, rate: 62 },
    { id: 'sc', code: 'Sc', name: 'Stratocumulus', note: 'Lumpy and patient',              cost: 5.2e5, rate: 390 },
    { id: 'as', code: 'As', name: 'Altostratus',   note: 'The sun goes watery behind it',  cost: 9e6, rate: 2500 },
    { id: 'cu', code: 'Cu', name: 'Cumulus',       note: 'Heaped up by warm air',          cost: 1.6e8, rate: 1.65e4 },
    { id: 'ns', code: 'Ns', name: 'Nimbostratus',  note: 'Rains all day and means it',     cost: 3e9, rate: 1.1e5 },
    { id: 'cb', code: 'Cb', name: 'Cumulonimbus',  note: 'Ten kilometres of thunder',      cost: 6e10, rate: 7.5e5 },
    { id: 'sq', code: 'Sq', name: 'Squall Line',   note: 'A wall with weather behind it',  cost: 1.3e12, rate: 5.2e6 },
    { id: 'mo', code: 'Mo', name: 'Monsoon',       note: 'A season, all at once',          cost: 3e13, rate: 3.7e7 },
    { id: 'cy', code: 'Cy', name: 'Cyclone',       note: 'It has a calm, quiet centre',    cost: 7.5e14, rate: 2.7e8 }
  ];

  var MILESTONES = [25, 50, 100, 200, 300, 400, 500];

  // Rain needed this cycle to reach each stage of the valley.
  var STAGES = [
    { at: 0,      pop: 1,  name: 'Cracked earth',    line: 'One wanderer, and no shade.' },
    { at: 150,    pop: 1,  name: 'Damp ground',      line: 'A campfire. Someone is staying the night.' },
    { at: 3000,   pop: 2,  name: 'First puddles',    line: 'A tent goes up. Somebody splashes.' },
    { at: 6e4,    pop: 3,  name: 'Moss and sprouts', line: 'Something green was waiting underneath.' },
    { at: 1.2e6,  pop: 4,  name: 'Meadow',           line: 'The tent has become a hut.' },
    { at: 3e7,    pop: 5,  name: 'Running stream',   line: 'More people follow the water up.' },
    { at: 1e9,    pop: 6,  name: 'Lake',             line: 'The first cabin, and a vegetable patch.' },
    { at: 1e11,   pop: 7,  name: 'Woodland',         line: 'They built a dock. The fishing is good.' },
    { at: 2e13,   pop: 8,  name: 'Wetland',          line: 'Reeds, frogs, and a great deal of noise.' },
    { at: 5e15,   pop: 9,  name: 'Forest',           line: 'Lanterns along the path at night.' },
    { at: 2e18,   pop: 10, name: 'Hamlet',           line: 'Smoke from every chimney.' },
    { at: 1e21,   pop: 12, name: 'Paradise',         line: 'All this from a little rain.' }
  ];
  var EVAP_STAGE = 6;

  var VALLEYS = ['Dust Basin', 'Red Canyon', 'Salt Flat', 'Ash Field', 'Cold Steppe'];

  // ---- upgrades (reset every cycle) ----
  var UPS = [];
  function up(u) { UPS.push(u); }
  var GEN_UP_NAMES = [
    ['Finer Ice', 'Mare’s Tails', 'Halo'],
    ['Sea Fret', 'Morning Fog', 'Endless Grey'],
    ['Mackerel Sky', 'Ice Ripples', 'Sand Pattern'],
    ['Sheepback', 'Castle Towers', 'Great Flock'],
    ['Rolling Sheets', 'Honeycomb', 'Open Cells'],
    ['Watery Sun', 'Corona', 'Grey Veil'],
    ['Warm Thermals', 'Cauliflower Tops', 'Cloud Street'],
    ['Wet Week', 'Scud', 'Rain Until Sunday'],
    ['Anvil Top', 'Hailstones', 'Supercell'],
    ['Gust Front', 'Shelf Cloud', 'Derecho'],
    ['Sea Breeze', 'Swollen Rivers', 'Hundred-Day Rain'],
    ['Warm Ocean', 'Eyewall', 'Landfall']
  ];
  var GEN_UP_AT = [10, 35, 90], GEN_UP_MULT = [2, 2, 3];
  GENS.forEach(function (g, i) {
    for (var k = 0; k < 3; k++) {
      up({ id: g.id + k, name: GEN_UP_NAMES[i][k], gen: i, need: GEN_UP_AT[k], mult: GEN_UP_MULT[k],
           cost: g.cost * [9, 260, 4e5][k], desc: g.name + ' rains ×' + GEN_UP_MULT[k] });
    }
  });
  [['Cupped Hands', 60], ['Tighter Squeeze', 900], ['Fat Drops', 2.4e4], ['Wrung Out', 7e5],
   ['Bucketing', 4e7], ['Cats and Dogs', 6e9], ['Sky Fist', 2e12]].forEach(function (t, i) {
    up({ id: 'tap' + i, name: t[0], tap: 2, cost: t[1], desc: 'Squeezing the cloud gives ×2' });
  });
  [['Sympathetic Rain', 2500], ['In Step', 1.5e5], ['One Weather', 1.4e7], ['Whole Sky', 3e9], ['As Above', 8e11]].forEach(function (t, i) {
    up({ id: 'pct' + i, name: t[0], pct: 0.01, cost: t[1], desc: 'Each squeeze adds 1% of your rain per second' });
  });
  [['Falling Barometer', 2e4, 2], ['Dew Point', 1.6e6, 4], ['Orographic Lift', 9e7, 5], ['Cold Front', 1.5e10, 6],
   ['Low Pressure', 4e12, 7], ['Jet Stream Dip', 3e14, 8], ['El Niño', 4e16, 9]].forEach(function (t, i) {
    up({ id: 'all' + i, name: t[0], all: 1.5, cost: t[1], stage: t[2], desc: 'All rain ×1.5' });
  });
  up({ id: 'chg0', name: 'Static Cling', charge: 1.25, cost: 5e4, stage: 3, desc: 'Thunder charges 25% faster' });
  up({ id: 'str0', name: 'Forked Lightning', strike: 20, cost: 5e6, stage: 4, desc: 'Strikes release 20 more seconds of rain' });
  up({ id: 'chg1', name: 'Ice Collisions', charge: 1.25, cost: 8e8, stage: 5, desc: 'Thunder charges 25% faster' });
  up({ id: 'str1', name: 'Rolling Thunder', strike: 30, cost: 2e11, stage: 7, desc: 'Strikes release 30 more seconds of rain' });
  UPS.sort(function (a, b) { return a.cost - b.cost; });
  var UP_BY_ID = {};
  UPS.forEach(function (u) { UP_BY_ID[u.id] = u; });

  // ---- perks (bought with vapor, kept forever) ----
  var PERKS = [
    { id: 'tail',  name: 'Tailwind',       max: 25, base: 3,  g: 1.65, desc: 'All rain +15%', fx: function (l) { return '+' + l * 15 + '%'; } },
    { id: 'grip',  name: 'Strong Grip',    max: 12, base: 2,  g: 2.0,  desc: 'Squeezing gives ×1.5', fx: function (l) { return '×' + fmt(Math.pow(1.5, l)); } },
    { id: 'auto',  name: 'Steady Drizzle', max: 6,  base: 4,  g: 2.4,  desc: 'The cloud squeezes itself once a second', fx: function (l) { return l + '/s'; } },
    { id: 'cheap', name: 'Humid Air',      max: 12, base: 5,  g: 1.8,  desc: 'Clouds cost 3% less', fx: function (l) { return '−' + Math.round((1 - Math.pow(0.97, l)) * 100) + '%'; } },
    { id: 'lush',  name: 'Deep Roots',     max: 10, base: 6,  g: 1.9,  desc: 'Every valley stage gives +2% more', fx: function (l) { return '+' + l * 2 + '%'; } },
    { id: 'quick', name: 'Charged Air',    max: 8,  base: 4,  g: 1.8,  desc: 'Thunder charges 20% faster', fx: function (l) { return '+' + l * 20 + '%'; } },
    { id: 'storm', name: 'Long Storm',     max: 8,  base: 5,  g: 1.9,  desc: 'Storms last 5 seconds longer', fx: function (l) { return '+' + l * 5 + 's'; } },
    { id: 'bird',  name: 'Nesting Box',    max: 8,  base: 4,  g: 1.8,  desc: 'Swallows visit 10% sooner', fx: function (l) { return Math.round((1 - Math.pow(0.9, l)) * 100) + '% sooner'; } },
    { id: 'cap',   name: 'Night Watch',    max: 8,  base: 2,  g: 1.7,  desc: 'Rains 2 more hours while you’re away', fx: function (l) { return (8 + l * 2) + 'h'; } },
    { id: 'eff',   name: 'Sleeping Rain',  max: 5,  base: 3,  g: 2.0,  desc: 'Away rain is 10% stronger', fx: function (l) { return (50 + l * 10) + '%'; } },
    { id: 'start', name: 'Memory of Water', max: 8, base: 3,  g: 1.9,  desc: 'Start each valley with 5 of the next cloud', fx: function (l) { return l + (l === 1 ? ' kind' : ' kinds'); } }
  ];
  var PERK_BY_ID = {};
  PERKS.forEach(function (p) { PERK_BY_ID[p.id] = p; });

  // ---- journal entries, +2% rain each ----
  var ACH = [
    { id: 'tap1',   name: 'Drip',               desc: 'Squeeze the cloud 10 times',     ok: function (s) { return s.stats.taps >= 10; } },
    { id: 'tap2',   name: 'Drizzle',            desc: 'Squeeze 250 times',              ok: function (s) { return s.stats.taps >= 250; } },
    { id: 'tap3',   name: 'Tired Thumbs',       desc: 'Squeeze 2,500 times',            ok: function (s) { return s.stats.taps >= 2500; } },
    { id: 'tap4',   name: 'Wrung Dry',          desc: 'Squeeze 15,000 times',           ok: function (s) { return s.stats.taps >= 15000; } },
    { id: 'own1',   name: 'Not Alone',          desc: 'Condense a second cloud',        ok: function (s) { return total(s) >= 1; } },
    { id: 'own2',   name: 'Overcast',           desc: 'Have 50 clouds',                 ok: function (s) { return total(s) >= 50; } },
    { id: 'own3',   name: 'Eight Oktas',        desc: 'Have 200 clouds',                ok: function (s) { return total(s) >= 200; } },
    { id: 'own4',   name: 'No More Sky',        desc: 'Have 600 clouds',                ok: function (s) { return total(s) >= 600; } },
    { id: 'hund',   name: 'Specialist',         desc: 'Have 100 of one cloud',          ok: function (s) { return Math.max.apply(null, s.owned) >= 100; } },
    { id: 'cb',     name: 'Anvil',              desc: 'Condense a Cumulonimbus',        ok: function (s) { return s.owned[8] >= 1; } },
    { id: 'atlas',  name: 'Cloud Atlas',        desc: 'Have every kind of cloud',       ok: function (s) { return s.owned.every(function (n) { return n > 0; }); } },
    { id: 'st2',    name: 'Puddle Jumper',      desc: 'Fill the first puddles',         ok: function (s) { return stageOf(s) >= 2; } },
    { id: 'st4',    name: 'Barefoot Weather',   desc: 'Grow a meadow',                  ok: function (s) { return stageOf(s) >= 4; } },
    { id: 'st6',    name: 'Deep End',           desc: 'Fill a lake',                    ok: function (s) { return stageOf(s) >= 6; } },
    { id: 'st8',    name: 'Frog Chorus',        desc: 'Grow a wetland',                 ok: function (s) { return stageOf(s) >= 8; } },
    { id: 'st10',   name: 'Neighbours',         desc: 'Grow a hamlet',               ok: function (s) { return stageOf(s) >= 10; } },
    { id: 'st11',   name: 'Enough Rain',        desc: 'Reach paradise',                 ok: function (s) { return stageOf(s) >= 11; } },
    { id: 'bolt1',  name: 'Count the Seconds',  desc: 'Release thunder',                ok: function (s) { return s.stats.strikes >= 1; } },
    { id: 'bolt2',  name: 'Storm Season',       desc: 'Release thunder 25 times',       ok: function (s) { return s.stats.strikes >= 25; } },
    { id: 'bolt3',  name: 'Grounded',           desc: 'Release thunder 150 times',      ok: function (s) { return s.stats.strikes >= 150; } },
    { id: 'bird1',  name: 'Low-Flying',         desc: 'Greet a swallow',                ok: function (s) { return s.stats.swallows >= 1; } },
    { id: 'bird2',  name: 'Old Friends',        desc: 'Greet 20 swallows',              ok: function (s) { return s.stats.swallows >= 20; } },
    { id: 'bird3',  name: 'One Summer',         desc: 'Greet 100 swallows',             ok: function (s) { return s.stats.swallows >= 100; } },
    { id: 'evap1',  name: 'Full Circle',        desc: 'Evaporate once',                 ok: function (s) { return s.evap >= 1; } },
    { id: 'evap2',  name: 'Every Valley',       desc: 'Rain on all five valleys',       ok: function (s) { return s.evap >= 4; } },
    { id: 'evap3',  name: 'The Water Cycle',    desc: 'Evaporate 15 times',             ok: function (s) { return s.evap >= 15; } },
    { id: 'perk1',  name: 'Change of Air',      desc: 'Learn 10 levels of currents',    ok: function (s) { return perkTotal(s) >= 10; } },
    { id: 'perk2',  name: 'Prevailing Wind',    desc: 'Learn 40 levels of currents',    ok: function (s) { return perkTotal(s) >= 40; } },
    { id: 'away',   name: 'It Rained All Night', desc: 'Be away for 6 hours',           ok: function (s) { return s.stats.longestAway >= 21600; } },
    { id: 'life',   name: 'Every Last Drop',    desc: 'Rain 1 quadrillion drops in all', ok: function (s) { return s.lifeRain >= 1e15; } }
  ];
  var ACH_BONUS = 0.02, VAPOR_BONUS = 0.02;

  function total(s) { return s.owned.reduce(function (a, b) { return a + b; }, 0); }
  function perkTotal(s) { var n = 0; for (var k in s.perks) n += s.perks[k]; return n; }

  function fresh(now) {
    return {
      v: SAVE_VERSION, drops: 0, cycleRain: 0, lifeRain: 0,
      owned: GENS.map(function () { return 0; }), ups: {},
      vapor: 0, vaporTotal: 0, perks: {}, evap: 0,
      charge: 0, buffs: {}, swallowIn: 75, autoAcc: 0, ach: {}, bestStage: 0,
      stats: { taps: 0, strikes: 0, swallows: 0, play: 0, bestRate: 0, longestAway: 0 },
      settings: { sound: true, haptics: true, saver: false, sci: false },
      buyMode: 1, last: now || 0
    };
  }

  // Loads anything: missing, corrupt or older saves all come back as a valid state.
  function load(raw, now) {
    var s = fresh(now), d;
    try { d = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return s; }
    if (!d || typeof d !== 'object') return s;
    function num(v, f) { return typeof v === 'number' && isFinite(v) && v >= 0 ? v : f; }
    ['drops', 'cycleRain', 'lifeRain', 'vapor', 'vaporTotal', 'evap', 'charge', 'swallowIn', 'bestStage', 'last'].forEach(function (k) { s[k] = num(d[k], s[k]); });
    s.charge = Math.min(100, s.charge);
    if (Array.isArray(d.owned)) GENS.forEach(function (_, i) { s.owned[i] = Math.floor(num(d.owned[i], 0)); });
    if (d.ups) UPS.forEach(function (u) { if (d.ups[u.id]) s.ups[u.id] = 1; });
    if (d.perks) PERKS.forEach(function (p) { var l = Math.min(p.max, Math.floor(num(d.perks[p.id], 0))); if (l) s.perks[p.id] = l; });
    if (d.ach) ACH.forEach(function (a) { if (d.ach[a.id]) s.ach[a.id] = 1; });
    if (d.buffs) ['rain', 'tap', 'storm'].forEach(function (k) { var t = num(d.buffs[k], 0); if (t) s.buffs[k] = Math.min(t, 300); });
    if (d.stats) for (var k in s.stats) s.stats[k] = num(d.stats[k], 0);
    if (d.settings) for (var q in s.settings) if (typeof d.settings[q] === 'boolean') s.settings[q] = d.settings[q];
    if (d.buyMode === 10 || d.buyMode === 'max') s.buyMode = d.buyMode;
    return s;
  }

  function stageOf(s) {
    var i = 0;
    while (i + 1 < STAGES.length && s.cycleRain >= STAGES[i + 1].at) i++;
    return i;
  }
  // 0..1 toward the next stage, on a log scale so progress feels even.
  function stageFrac(s) {
    var i = stageOf(s);
    if (i + 1 >= STAGES.length) return 1;
    var a = Math.max(STAGES[i].at, 8), b = STAGES[i + 1].at;
    return Math.max(0, Math.min(1, Math.log(Math.max(s.cycleRain, a) / a) / Math.log(b / a)));
  }
  function growth(s) { return Math.min(1, (stageOf(s) + stageFrac(s)) / (STAGES.length - 1)); }

  function perk(s, id) { return s.perks[id] || 0; }

  function milestoneMult(n) {
    var m = 1;
    for (var i = 0; i < MILESTONES.length && n >= MILESTONES[i]; i++) m *= 2;
    return m;
  }
  function nextMilestone(n) {
    for (var i = 0; i < MILESTONES.length; i++) if (n < MILESTONES[i]) return MILESTONES[i];
    return 0;
  }

  function prevMilestone(n) {
    var p = 0;
    MILESTONES.forEach(function (m) { if (n >= m) p = m; });
    return p;
  }

  // Everything derived from the state, without temporary buffs.
  function derive(s) {
    var st = stageOf(s), gm = GENS.map(function () { return 1; });
    var tap = 1, pct = 0, all = 1, chg = 1, strike = 45;
    for (var id in s.ups) {
      var u = UP_BY_ID[id];
      if (!u) continue;
      if (u.gen !== undefined) gm[u.gen] *= u.mult;
      if (u.tap) tap *= u.tap;
      if (u.pct) pct += u.pct;
      if (u.all) all *= u.all;
      if (u.charge) chg *= u.charge;
      if (u.strike) strike += u.strike;
    }
    var achN = Object.keys(s.ach).length;
    var land = Math.pow(1.2 + 0.02 * perk(s, 'lush'), st);
    var mult = all * land * (1 + VAPOR_BONUS * s.vaporTotal) * (1 + ACH_BONUS * achN) * (1 + 0.15 * perk(s, 'tail'));
    var per = GENS.map(function (g, i) { return g.rate * gm[i] * milestoneMult(s.owned[i]) * mult; });
    var rate = 0;
    per.forEach(function (p, i) { rate += p * s.owned[i]; });
    return {
      stage: st, land: land, mult: mult, per: per, rate: rate,
      tap: tap * Math.pow(1.5, perk(s, 'grip')) * mult + rate * pct,
      chargeMult: chg * (1 + 0.2 * perk(s, 'quick')),
      strikeSec: strike, stormSec: 15 + 5 * perk(s, 'storm'),
      auto: perk(s, 'auto'),
      offCap: (8 + 2 * perk(s, 'cap')) * 3600, offEff: 0.5 + 0.1 * perk(s, 'eff')
    };
  }

  var BUFF_RAIN = 5, BUFF_TAP = 8, BUFF_STORM = 3;
  function rainBuff(s) { return (s.buffs.rain > 0 ? BUFF_RAIN : 1) * (s.buffs.storm > 0 ? BUFF_STORM : 1); }
  function tapBuff(s) { return (s.buffs.tap > 0 ? BUFF_TAP : 1) * (s.buffs.storm > 0 ? BUFF_STORM : 1); }

  function gain(s, n) { s.drops += n; s.cycleRain += n; s.lifeRain += n; }

  function unitCost(s, i) { return GENS[i].cost * Math.pow(COST_GROWTH, s.owned[i]) * Math.pow(0.97, perk(s, 'cheap')); }
  function bulkCost(s, i, n) { return unitCost(s, i) * (Math.pow(COST_GROWTH, n) - 1) / (COST_GROWTH - 1); }
  function maxBuy(s, i) {
    var n = Math.floor(Math.log(1 + s.drops * (COST_GROWTH - 1) / unitCost(s, i)) / Math.log(COST_GROWTH) + 1e-9);
    while (n > 0 && bulkCost(s, i, n) > s.drops) n--;
    return Math.max(0, n);
  }
  function buyCount(s, i) { return s.buyMode === 'max' ? Math.max(1, maxBuy(s, i)) : s.buyMode; }
  function buyGen(s, i, n) {
    var c = bulkCost(s, i, n);
    if (!(n > 0) || c > s.drops) return false;
    s.drops -= c; s.owned[i] += n;
    return true;
  }
  // A generator row appears once the one before it is owned, or it is nearly affordable.
  function genVisible(s, i) { return i === 0 || s.owned[i] > 0 || s.owned[i - 1] > 0; }

  function upVisible(s, u) {
    if (s.ups[u.id]) return false;
    if (u.gen !== undefined) return s.owned[u.gen] >= u.need;
    if (u.stage !== undefined) return stageOf(s) >= u.stage;
    return s.cycleRain >= u.cost * 0.35;
  }
  function buyUp(s, id) {
    var u = UP_BY_ID[id];
    if (!u || !upVisible(s, u) || s.drops < u.cost) return false;
    s.drops -= u.cost; s.ups[id] = 1;
    return true;
  }

  function perkCost(s, id) { var p = PERK_BY_ID[id]; return Math.ceil(p.base * Math.pow(p.g, perk(s, id))); }
  function buyPerk(s, id) {
    var p = PERK_BY_ID[id], c = perkCost(s, id);
    if (perk(s, id) >= p.max || s.vapor < c) return false;
    s.vapor -= c; s.perks[id] = perk(s, id) + 1;
    return true;
  }

  function vaporGain(s) {
    if (stageOf(s) < EVAP_STAGE) return 0;
    return Math.floor(10 * Math.pow(s.cycleRain / STAGES[EVAP_STAGE].at, 0.2));
  }
  // Watching an ad carries a quarter more.
  function vaporWithAd(s) { var v = vaporGain(s); return v < 1 ? 0 : v + Math.max(1, Math.floor(v * 0.25)); }
  function evaporate(s, ad) {
    var v = ad ? vaporWithAd(s) : vaporGain(s);
    if (v < 1) return 0;
    s.vapor += v; s.vaporTotal += v; s.evap++;
    s.drops = 0; s.cycleRain = 0; s.ups = {}; s.charge = 0; s.buffs = {}; s.autoAcc = 0;
    s.owned = GENS.map(function (_, i) { return i < perk(s, 'start') ? 5 : 0; });
    return v;
  }

  function tap(s, d, silent) {
    var n = d.tap * tapBuff(s);
    gain(s, n);
    if (!silent) { s.stats.taps++; s.charge = Math.min(100, s.charge + 0.25 * d.chargeMult); }
    return n;
  }

  function strike(s, d) {
    if (s.charge < 100) return 0;
    var n = d.rate * d.strikeSec + d.tap * 30;
    s.charge = 0; s.stats.strikes++;
    s.buffs.storm = d.stormSec;
    gain(s, n);
    return n;
  }

  function nextSwallow(s, rnd) { return (70 + 80 * rnd) * Math.pow(0.9, perk(s, 'bird')); }
  // A greeted swallow brings one of three gifts.
  function swallow(s, d, rnd) {
    s.stats.swallows++;
    if (rnd < 0.4) { s.buffs.rain = 30; return { kind: 'rain', text: 'Updraft', sub: 'rain ×' + BUFF_RAIN + ' for 30s' }; }
    if (rnd < 0.65) { s.buffs.tap = 20; return { kind: 'tap', text: 'Soft cloud', sub: 'squeezes ×' + BUFF_TAP + ' for 20s' }; }
    var n = Math.max(d.tap * 25, Math.min(d.rate * 600, s.drops * 0.2 + d.rate * 90));
    gain(s, n);
    return { kind: 'gift', text: 'Cloudburst', sub: '+' + fmt(n) + ' drops', n: n };
  }

  // The ad reward for a swallow's gift: the same gift again.
  function doubleGift(s, g) {
    if (g.kind === 'rain') s.buffs.rain = Math.min(300, (s.buffs.rain || 0) + 30);
    else if (g.kind === 'tap') s.buffs.tap = Math.min(300, (s.buffs.tap || 0) + 20);
    else gain(s, g.n);
  }

  // Advances live play. Returns things the UI should react to.
  function tick(s, d, dt, rnd) {
    var ev = {};
    s.stats.play += dt;
    for (var k in s.buffs) { s.buffs[k] -= dt; if (s.buffs[k] <= 0) delete s.buffs[k]; }
    gain(s, d.rate * rainBuff(s) * dt);
    if (d.auto) {
      s.autoAcc += d.auto * dt;
      var n = Math.floor(s.autoAcc);
      s.autoAcc -= n;
      for (var i = 0; i < n; i++) tap(s, d, true);
      ev.auto = n;
    }
    if (s.lifeRain > 500 && s.charge < 100) {
      s.charge = Math.min(100, s.charge + 0.15 * d.chargeMult * dt);
      if (s.charge >= 100) ev.charged = true;
    }
    s.swallowIn -= dt;
    if (s.swallowIn <= 0) { s.swallowIn = nextSwallow(s, rnd === undefined ? 0.5 : rnd); ev.swallow = true; }
    if (d.rate > s.stats.bestRate) s.stats.bestRate = d.rate;
    var st = stageOf(s);
    if (st > s.bestStage) s.bestStage = st;
    if (st !== d.stage) ev.stage = st;
    return ev;
  }

  function checkAch(s) {
    var got = [];
    ACH.forEach(function (a) { if (!s.ach[a.id] && a.ok(s)) { s.ach[a.id] = 1; got.push(a); } });
    return got;
  }

  // Rain that fell while the app was closed.
  function offline(s, now) {
    var sec = Math.max(0, (now - s.last) / 1000);
    if (!s.last || sec < 1) { s.last = now; return null; }
    s.last = now;
    if (sec > s.stats.longestAway) s.stats.longestAway = sec;
    s.buffs = {};
    var d = derive(s), counted = Math.min(sec, d.offCap);
    var n = d.rate * counted * d.offEff;
    gain(s, n);
    s.charge = Math.min(100, s.charge + (s.lifeRain > 500 ? counted * 0.05 * d.chargeMult : 0));
    return { sec: sec, counted: counted, capped: sec > d.offCap, gain: n, eff: d.offEff };
  }

  var SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  var sci = false;
  function setSci(b) { sci = b; }
  function fmt(n) {
    if (!(n >= 0)) n = 0;
    if (n < 10) { var r = Math.floor(n * 10) / 10; return r === Math.floor(r) ? String(r) : r.toFixed(1); }
    if (n < 1000) return String(Math.floor(n));
    var e = Math.floor(Math.log10(n) + 1e-12);
    if (sci && n >= 1e6) return (Math.floor(n / Math.pow(10, e) * 100) / 100).toFixed(2) + 'e' + e;
    var t = Math.floor(e / 3);
    if (t >= SUF.length) return (Math.floor(n / Math.pow(10, e) * 100) / 100).toFixed(2) + 'e' + e;
    var v = n / Math.pow(1000, t), dp = v >= 100 ? 0 : v >= 10 ? 1 : 2, p = Math.pow(10, dp);
    return (Math.floor(v * p + 1e-9) / p).toFixed(dp) + SUF[t];
  }
  function fmtTime(sec) {
    sec = Math.floor(sec);
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), q = sec % 60;
    if (h >= 24) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + q + 's';
    return q + 's';
  }

  return {
    GENS: GENS, UPS: UPS, PERKS: PERKS, ACH: ACH, STAGES: STAGES, VALLEYS: VALLEYS, EVAP_STAGE: EVAP_STAGE,
    ACH_BONUS: ACH_BONUS, VAPOR_BONUS: VAPOR_BONUS,
    fresh: fresh, load: load, derive: derive, tick: tick, tap: tap, strike: strike, swallow: swallow,
    stageOf: stageOf, stageFrac: stageFrac, growth: growth, total: total, perk: perk,
    unitCost: unitCost, bulkCost: bulkCost, maxBuy: maxBuy, buyCount: buyCount, buyGen: buyGen, genVisible: genVisible,
    milestoneMult: milestoneMult, nextMilestone: nextMilestone, prevMilestone: prevMilestone,
    upVisible: upVisible, buyUp: buyUp, perkCost: perkCost, buyPerk: buyPerk,
    gain: gain, doubleGift: doubleGift, vaporWithAd: vaporWithAd, vaporGain: vaporGain, evaporate: evaporate, rainBuff: rainBuff, tapBuff: tapBuff,
    checkAch: checkAch, offline: offline, fmt: fmt, fmtTime: fmtTime, setSci: setSci
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
