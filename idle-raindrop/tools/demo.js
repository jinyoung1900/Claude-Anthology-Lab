// Paste into the browser console to jump to a stage: J(6, { evap: 1, time: 215, buffs: { storm: 20 } })
window.J = (st, o = {}) => {
  const s = Game.state();
  s.cycleRain = Core.STAGES[st].at * 1.5 + 1; s.lifeRain = s.cycleRain; s.drops = s.cycleRain * 0.3;
  s.owned = s.owned.map((_, i) => Math.max(0, st * 9 - i * 9));
  s.evap = o.evap || 0; s.bestStage = 11; s.charge = o.charge || 40; s.buffs = o.buffs || {}; s.stats.taps = 50; s.ups = {};
  Scene.time(o.time === undefined ? 60 : o.time); Game.swapped();
  for (let i = 0; i < 40; i++) Game.step(0.03);
  document.getElementById('toasts').innerHTML = '';
};
