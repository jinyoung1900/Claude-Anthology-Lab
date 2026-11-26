/* Glue: input, interface, saving, and the Android bridge. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, C = Core, fmt = C.fmt;
  var A = window.Android || null, KEY = 'idle-raindrop';
  var s, d, tab = 'clouds', open = true, dirty = true, inset = { top: 0, bottom: 0, left: 0, right: 0 };

  // ---------- save ----------
  function readSave() { try { var r = A ? A.load() : localStorage.getItem(KEY); return r || null; } catch (e) { return null; } }
  function save() { if (!s) return; try { var t = JSON.stringify(s); if (A) A.save(t); else localStorage.setItem(KEY, t); } catch (e) {} }
  // 0 = light tick, 1 = click, 2 = heavy
  function haptic(kind) { if (!s.settings.haptics) return; try { if (A) A.haptic(kind); else if (navigator.vibrate && kind) navigator.vibrate(kind === 2 ? 40 : 8); } catch (e) {} }

  function refresh() { d = C.derive(s); dirty = true; }

  // ---------- layout ----------
  function layout(snap) {
    var h = innerHeight, sheet = open ? Math.round(Math.max(Math.min(h * 0.47, 520), Math.min(300, h * 0.6))) : 60 + inset.bottom;
    var rs = document.documentElement.style;
    rs.setProperty('--sheet', sheet + 'px');
    rs.setProperty('--top', inset.top + 'px'); rs.setProperty('--bot', inset.bottom + 'px');
    rs.setProperty('--lft', inset.left + 'px'); rs.setProperty('--rgt', inset.right + 'px');
    Scene.view(h - sheet + 6, inset.top + 108, snap);
  }
  function resize() {
    Scene.resize(innerWidth, innerHeight);
    layout(true);
  }

  // ---------- toasts / modal ----------
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(title, sub) {
    var e = document.createElement('div'); e.className = 'toast';
    e.innerHTML = '<b>' + esc(title) + '</b><span>' + esc(sub || '') + '</span>';
    var box = $('toasts'); box.appendChild(e);
    while (box.children.length > 2) box.removeChild(box.firstChild);
    setTimeout(function () { e.classList.add('out'); setTimeout(function () { e.remove(); }, 400); }, 3000);
  }
  function modal(html, handlers) {
    var c = $('modal').firstChild; c.innerHTML = html; $('modal').hidden = false;
    c.onclick = function (ev) { var b = ev.target.closest('[data-a]'); if (b && handlers[b.dataset.a]) handlers[b.dataset.a](b); };
  }
  function closeModal() { $('modal').hidden = true; }
  $('modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });

  // ---------- badges ----------
  function badge(i) { return Icons.badge(C.GENS[i].id); }
  [].forEach.call(document.querySelectorAll('[data-ico]'), function (e) { e.innerHTML = Icons.svg(e.dataset.ico, +e.dataset.px); });
  // Writes to the page only when a value changed.
  function set(el, prop, v) {
    if (el['_' + prop] === v) return;
    el['_' + prop] = v;
    if (prop === 'text') el.textContent = v;
    else if (prop === 'html') el.innerHTML = v;
    else if (prop === 'cls') el.className = v;
    else if (prop === 'sx') el.style.transform = 'scaleX(' + v + ')';
  }

  // ---------- clouds tab ----------
  var genRows = [];
  function buildGens() {
    var box = $('gens');
    C.GENS.forEach(function (g, i) {
      var r = document.createElement('div'); r.className = 'row';
      r.innerHTML = badge(i) + '<div class="mid"><div class="nm"><span></span><em></em></div><div class="ds"></div><div class="ml"><i></i></div></div><button class="buy"><span></span><small></small></button>';
      var q = function (x) { return r.querySelector(x); };
      var o = { r: r, n: q('.nm span'), e: q('.nm em'), ds: q('.ds'), ml: q('.ml'), mi: q('.ml i'), b: q('.buy'), bt: q('.buy span'), bs: q('.buy small') };
      o.b.onclick = function () {
        if (C.buyGen(s, i, C.buyCount(s, i))) { haptic(1); Sound.buy(); refresh(); paint(); save(); }
      };
      box.appendChild(r); genRows.push(o);
    });
  }
  function paintGens() {
    C.GENS.forEach(function (g, i) {
      var o = genRows[i], vis = C.genVisible(s, i), teaser = !vis && C.genVisible(s, i - 1);
      o.r.style.display = vis || teaser ? '' : 'none';
      if (!vis && !teaser) return;
      var own = s.owned[i], n = C.buyCount(s, i), cost = C.bulkCost(s, i, n), can = vis && cost <= s.drops, nm = C.nextMilestone(own);
      set(o.r, 'cls', 'row' + (teaser ? ' locked' : ''));
      set(o.n, 'text', g.name); set(o.e, 'text', own ? '×' + own : '');
      set(o.ds, 'text', teaser ? 'Condense a ' + C.GENS[i - 1].name + ' first' : !own ? g.note :
        fmt(d.per[i]) + '/s each · ' + (d.rate > 0 ? Math.round(d.per[i] * own / d.rate * 100) : 0) + '% of rain');
      o.ml.style.visibility = own && nm ? 'visible' : 'hidden';
      if (nm) set(o.mi, 'sx', ((own - C.prevMilestone(own)) / (nm - C.prevMilestone(own))).toFixed(3));
      o.b.style.visibility = teaser ? 'hidden' : '';
      set(o.b, 'cls', 'buy' + (can ? '' : ' no')); set(o.bt, 'text', fmt(cost));
      set(o.bs, 'text', nm && own + n >= nm ? '+' + n + ' → ×2' : '+' + n);
    });
  }
  $('buyMode').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; s.buyMode = b.dataset.m === 'max' ? 'max' : +b.dataset.m; paint(); };

  // ---------- lore tab ----------
  var upKey = '';
  function paintUps() {
    var list = C.UPS.filter(function (u) { return C.upVisible(s, u); });
    var key = list.map(function (u) { return u.id + (u.cost <= s.drops ? 1 : 0); }).join() || 'none';
    set($('upCount'), 'text', Object.keys(s.ups).length + ' of ' + C.UPS.length + ' learned');
    if (key === upKey) return;
    upKey = key;
    $('ups').innerHTML = list.map(function (u) {
      return '<div class="row">' + LoreArt.badge(u.id) + '<div class="mid"><div class="nm">' + esc(u.name) + '</div><div class="ds">' + esc(u.desc) + '</div></div><button class="buy' + (u.cost <= s.drops ? '' : ' no') + '" data-u="' + u.id + '">' + fmt(u.cost) + '</button></div>';
    }).join('') || '<div class="empty">Nothing to learn yet. Condense 10 of one cloud, or let more rain fall.</div>';
  }
  $('ups').onclick = function (e) { var b = e.target.closest('[data-u]'); if (b && C.buyUp(s, b.dataset.u)) { haptic(1); Sound.buy(); refresh(); paint(); save(); } };

  // ---------- evaporate tab ----------
  var vKey = '';
  function nextValley() { return C.VALLEYS[(s.evap + 1) % C.VALLEYS.length]; }
  function pct(v) { return fmt(v * C.VAPOR_BONUS * 100) + '%'; }
  function paintVapor() {
    var v = C.vaporGain(s), reached = C.stageOf(s) >= C.EVAP_STAGE;
    var key = [v, s.vapor, s.vaporTotal, JSON.stringify(s.perks), reached, s.evap].join();
    if (key === vKey) return;
    vKey = key;
    var h = '<div class="vhero"><h2>' + (s.vaporTotal || reached ? fmt(s.vapor) + ' vapor to spend' : 'The water cycle') + '</h2><p>' +
      (reached ? 'Let the lake rise back into you and drift to ' + nextValley() + '. Drops, clouds and lore are left behind. Vapor and currents stay.' :
        'Fill this valley up to a lake, and you can evaporate it. You’ll drift to a new valley carrying vapor, which makes all your rain stronger for good.') +
      (s.vaporTotal ? ' The ' + fmt(s.vaporTotal) + ' vapor you’ve gathered gives +' + pct(s.vaporTotal) + ' rain, even after you spend it.' : '') + '</p>' +
      '<button class="big' + (v ? '' : ' no') + '" data-evap="1">' + (v ? 'Evaporate for ' + fmt(v) + ' vapor' : 'Needs a lake') + '</button></div>';
    h += '<h3>Currents</h3>' + C.PERKS.map(function (p) {
      var l = C.perk(s, p.id), mx = l >= p.max, c = C.perkCost(s, p.id);
      return '<div class="row"><div class="mid"><div class="nm">' + esc(p.name) + ' <em>' + (l ? l + '/' + p.max : '') + '</em></div><div class="ds">' + esc(p.desc) + (l ? '. Now ' + p.fx(l) : '') + '</div></div>' +
        (mx ? '<span class="buy max">Full</span>' : '<button class="buy' + (s.vapor >= c ? '' : ' no') + '" data-k="' + p.id + '">' + fmt(c) + '<small>vapor</small></button>') + '</div>';
    }).join('');
    $('vapor').innerHTML = h;
  }
  $('vapor').onclick = function (e) {
    var b = e.target.closest('[data-k]');
    if (b) { if (C.buyPerk(s, b.dataset.k)) { haptic(1); Sound.buy(); refresh(); paint(); save(); } return; }
    var v = C.vaporGain(s);
    if (e.target.closest('[data-evap]') && v) {
      modal('<h2>Evaporate this valley?</h2><p>You’ll gain <b>' + fmt(v) + ' vapor</b> (+' + pct(v) + ' rain for good) and start over in ' + nextValley() + '.</p><button class="big" data-a="go">Evaporate</button>' + (adReady() ? '<button class="big ad" data-a="ad">' + adLabel('Watch ad: ' + fmt(C.vaporWithAd(s)) + ' vapor') + '</button>' : '') + '<button class="big ghost" data-a="no">Keep raining</button>',
        { no: closeModal, go: function () { closeModal(); doEvap(false); }, ad: function () { closeModal(); watchAd(function () { doEvap(true); }); } });
    }
  };
  function doEvap(ad) {
    if (Scene.busy()) return;
    $('offer').hidden = true;
    open = false; layout(); paintTabs(); Sound.steam(); haptic(2);
    Scene.evaporate(function () {
      var v = C.evaporate(s, ad);
      lastStage = 0; shownGrowth = 0; upKey = vKey = jKey = ''; refresh(); save();
      toast(C.VALLEYS[s.evap % C.VALLEYS.length], '+' + fmt(v) + ' vapor carried with you');
      setTimeout(function () { open = true; tab = 'vapor'; layout(); paintTabs(); paint(); }, 1900);
    });
  }

  // ---------- journal ----------
  var jKey = '';
  function paintJournal() {
    var st = C.stageOf(s), got = Object.keys(s.ach).length;
    var key = [st, got, Math.floor(s.stats.play / 2), s.evap].join();
    if (key === jKey) return;
    jKey = key;
    function kv(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }
    $('journal').innerHTML = '<h3>' + esc(C.VALLEYS[s.evap % C.VALLEYS.length]) + '</h3>' + C.STAGES.map(function (q, i) {
      return '<div class="st ' + (i <= st ? 'on' : 'off') + '"><i></i><div><b>' + (i <= Math.max(st, s.bestStage) ? esc(q.name) : 'Not seen yet') + '</b>' + (i <= st ? ' ' + esc(q.line) : '') + '</div></div>';
    }).join('') +
      '<h3>Rain gauge</h3>' + kv('People here', C.STAGES[st].pop) + kv('Rain here', fmt(s.cycleRain)) + kv('Rain in all', fmt(s.lifeRain)) + kv('Best rate', fmt(s.stats.bestRate) + '/s') + kv('Each squeeze', fmt(d.tap)) +
      kv('Valley bonus', '×' + d.land.toFixed(2)) + kv('Vapor bonus', '+' + pct(s.vaporTotal)) + kv('Squeezes', fmt(s.stats.taps)) + kv('Thunder', s.stats.strikes) + kv('Swallows', s.stats.swallows) + kv('Valleys left behind', s.evap) + kv('Time raining', C.fmtTime(s.stats.play)) +
      '<h3>Sightings: ' + got + ' of ' + C.ACH.length + ' (+' + Math.round(got * C.ACH_BONUS * 100) + '% rain)</h3><div class="ach">' + C.ACH.map(function (a) { return '<div class="' + (s.ach[a.id] ? 'on' : '') + '"><b>' + esc(a.name) + '</b>' + esc(a.desc) + '</div>'; }).join('') + '</div>';
  }

  // ---------- ads: always the player's choice, and never shown when no ad is ready ----------
  var FAKE_ADS = !A && /[?&]ads/.test(location.search); // desktop testing only: ?ads
  var adDone = null, adOn = false, offerT = 0, offerCool = 0;
  function adReady() { try { return FAKE_ADS || !!(A && A.adReady && A.adReady()); } catch (e) { return false; } }
  function watchAd(reward) {
    if (adOn || !adReady()) { toast('No ad right now', 'Try again a little later'); return; }
    adOn = true; adDone = reward; s.last = Date.now(); save();
    if (FAKE_ADS) { modal('<h2>Test ad</h2><p>This stands in for a video ad.</p><button class="big" data-a="y">Finish it</button><button class="big ghost" data-a="n">Skip it</button>', { y: function () { closeModal(); adResult(true); }, n: function () { closeModal(); adResult(false); } }); return; }
    A.showAd();
  }
  // Called by Android when the ad closes.
  function adResult(earned) {
    var f = adDone; adOn = false; adDone = null; s.last = Date.now();
    if (!earned) { toast('No bonus this time', 'The ad didn’t finish'); return; }
    if (f) { f(); Sound.chime(); haptic(2); refresh(); save(); }
  }
  function adLabel(text) { return Icons.svg('play', 2) + '<span>' + text + '</span>'; }
  function offerDouble(g) {
    // Not on the first few swallows, and at most one offer every three minutes.
    if (s.stats.swallows < 3 || offerCool > 0 || !adReady() || Scene.busy()) return;
    offerCool = 180; offerT = 12;
    var what = g.kind === 'rain' ? '30 more seconds of rain ×5' : g.kind === 'tap' ? '20 more seconds of squeezes ×8' : '+' + fmt(g.n) + ' more drops';
    var o = $('offer');
    o.innerHTML = '<b>Double the swallow’s gift?</b><p>' + esc(what) + '</p><div class="btns"><button class="big ad" data-o="y">' + adLabel('Watch ad') + '</button><button class="big ghost" data-o="n">No thanks</button></div><div class="left"></div>';
    o.hidden = false;
    o.onclick = function (e) {
      var b = e.target.closest('[data-o]');
      if (!b) return;
      o.hidden = true;
      if (b.dataset.o === 'y') watchAd(function () { C.doubleGift(s, g); Scene.say(g.text + ' ×2'); toast('Gift doubled', what); });
    };
  }
  function stepOffer(dt) {
    offerCool -= dt;
    var o = $('offer');
    if (o.hidden || adOn) return;
    offerT -= dt;
    if (offerT <= 0) { o.hidden = true; return; }
    o.querySelector('.left').style.transform = 'scaleX(' + (offerT / 12).toFixed(2) + ')';
  }

  // ---------- tabs ----------
  $('fold').onclick = function () { open = false; haptic(1); layout(); paintTabs(); };
  var tabBtns = [].slice.call(document.querySelectorAll('#tabs button')), panels = [].slice.call(document.querySelectorAll('.panel')), modeBtns = [].slice.call(document.querySelectorAll('#buyMode button'));
  function paintTabs() {
    tabBtns.forEach(function (b) { b.classList.toggle('on', open && b.dataset.t === tab); });
    panels.forEach(function (p) { p.classList.toggle('on', p.dataset.p === tab); });
    $('fold').style.visibility = open ? '' : 'hidden';
  }
  $('tabs').onclick = function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (open && tab === b.dataset.t) open = false; else { open = true; tab = b.dataset.t; }
    layout(); paintTabs(); paint();
  };
  function dots() {
    var m = {
      clouds: C.GENS.some(function (_, i) { return C.genVisible(s, i) && C.unitCost(s, i) <= s.drops; }),
      lore: C.UPS.some(function (x) { return C.upVisible(s, x) && x.cost <= s.drops; }),
      vapor: C.PERKS.some(function (p) { return C.perk(s, p.id) < p.max && C.perkCost(s, p.id) <= s.vapor; }) || (!s.evap && C.vaporGain(s) > 0)
    };
    tabBtns.forEach(function (b) { b.classList.toggle('dot', !!m[b.dataset.t] && !(open && tab === b.dataset.t)); });
  }

  // ---------- paint ----------
  function hintText() {
    if (s.evap) return '';
    if (s.stats.taps < 6) return 'Tap the sky to squeeze your cloud';
    if (!C.total(s) && s.drops >= C.unitCost(s, 0)) return 'Condense a Cirrus to help';
    if (s.charge >= 100 && !s.stats.strikes) return 'Tap the bolt to release thunder';
    if (!s.stats.swallows && Scene.hasSwallow()) return 'Tap the swallow';
    return '';
  }
  function paintHud() {
    set($('drops'), 'text', fmt(s.drops));
    var m = C.rainBuff(s);
    set($('rate'), 'text', fmt(d.rate * m) + ' drops/s' + (m > 1 ? '  ×' + m : '')); set($('rate'), 'cls', m > 1 ? 'up' : '');
    var st = C.stageOf(s), nx = C.STAGES[st + 1];
    set($('stName'), 'text', C.STAGES[st].name); set($('stNext'), 'text', nx ? fmt(s.cycleRain) + ' / ' + fmt(nx.at) : 'Fully grown');
    set($('stBar'), 'sx', C.stageFrac(s).toFixed(3));
    var bo = $('bolt'), show = s.lifeRain > 500;
    if (bo.hidden === show) bo.hidden = !show;
    $('boltFill').style.transform = 'scaleY(' + (Math.round(s.charge / 5) / 20) + ')';
    bo.classList.toggle('full', s.charge >= 100);
    var h = '';
    if (s.buffs.storm > 0) h += '<div class="buff">Storm ×3 · ' + Math.ceil(s.buffs.storm) + 's</div>';
    if (s.buffs.rain > 0) h += '<div class="buff">Updraft ×5 · ' + Math.ceil(s.buffs.rain) + 's</div>';
    if (s.buffs.tap > 0) h += '<div class="buff">Soft cloud ×8 · ' + Math.ceil(s.buffs.tap) + 's</div>';
    set($('buffs'), 'html', h);
    var hint = hintText(); $('hint').classList.toggle('on', !!hint);
    if (hint) set($('hint'), 'html', '<span>' + hint + '</span>');
  }
  function paint() {
    paintHud(); dots();
    modeBtns.forEach(function (b) { b.classList.toggle('on', b.dataset.m === String(s.buyMode)); });
    if (!open) return;
    if (tab === 'clouds') paintGens(); else if (tab === 'lore') paintUps(); else if (tab === 'vapor') paintVapor(); else paintJournal();
  }

  // ---------- input ----------
  var held = {}, holdT = 0;
  function doSqueeze(x, y) {
    if (Scene.busy()) return;
    var n = C.tap(s, d); Scene.squeeze(x, y, '+' + fmt(n)); Sound.plink(); haptic(0);
  }
  $('scene').addEventListener('pointerdown', function (e) {
    e.preventDefault(); Sound.unlock();
    if (Scene.hitSwallow(e.clientX, e.clientY)) {
      var g = C.swallow(s, d, Math.random()); Scene.say(g.text); toast(g.text, g.sub); Sound.chime(); haptic(2); save(); offerDouble(g);
      return;
    }
    held[e.pointerId] = { x: e.clientX, y: e.clientY }; holdT = 0; doSqueeze(e.clientX, e.clientY);
  });
  $('scene').addEventListener('pointermove', function (e) { var h = held[e.pointerId]; if (h) { h.x = e.clientX; h.y = e.clientY; } });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { $('scene').addEventListener(n, function (e) { delete held[e.pointerId]; }); });
  document.addEventListener('contextmenu', function (e) { if (e.target.tagName !== 'TEXTAREA') e.preventDefault(); });
  document.addEventListener('pointerup', function () { Sound.unlock(); });
  $('bolt').onclick = function () {
    if (s.charge < 100) { toast('Thunder is ' + Math.floor(s.charge) + '% charged', 'Squeezing charges it faster'); return; }
    if (Scene.busy()) return;
    var n = C.strike(s, d); Scene.strike(); Scene.say('+' + fmt(n)); Sound.thunder(); haptic(2); save();
  };

  // ---------- settings ----------
  $('gear').onclick = settings;
  function settings() {
    var rows = [['sound', 'Sound', ''], ['haptics', 'Vibration', ''], ['saver', 'Battery saver', '30 frames a second, less rain'], ['sci', 'Scientific numbers', '1.20e9 instead of 1.20B']];
    modal('<h2>Settings</h2>' + rows.map(function (r) { return '<button class="tog' + (s.settings[r[0]] ? ' on' : '') + '" data-a="t" data-k="' + r[0] + '" role="switch" aria-checked="' + s.settings[r[0]] + '"><span>' + r[1] + '<small>' + r[2] + '</small></span><span class="sw"></span></button>'; }).join('') +
      '<div style="height:12px"></div><button class="big" data-a="close">Done</button>' + (A && A.privacyNeeded && A.privacyNeeded() ? '<button class="big ghost" data-a="priv">Ad privacy choices</button>' : '') + '<button class="big ghost" data-a="back">Back up or restore</button><button class="big ghost" data-a="reset">Erase everything</button>', {
      t: function (b) { var k = b.dataset.k; s.settings[k] = !s.settings[k]; b.classList.toggle('on', s.settings[k]); b.setAttribute('aria-checked', s.settings[k]); apply(); save(); },
      close: closeModal, back: backup, reset: eraseAsk, priv: function () { closeModal(); A.showPrivacy(); }
    });
  }
  function eraseAsk() {
    modal('<h2>Erase everything?</h2><p>All valleys, vapor and journal entries will be gone. This can’t be undone.</p><button class="big warn" data-a="y">Erase</button><button class="big ghost" data-a="n">Keep my game</button>', {
      n: closeModal,
      y: function () { var keep = s.settings; s = C.fresh(Date.now()); s.settings = keep; swapped(); closeModal(); }
    });
  }
  function backup() {
    var code = btoa(unescape(encodeURIComponent(JSON.stringify(s))));
    modal('<h2>Back up or restore</h2><p>Copy this code somewhere safe, or paste one in to restore it.</p><textarea id="code" spellcheck="false" autocapitalize="off"></textarea><button class="big" data-a="copy">Copy code</button><button class="big ghost" data-a="load">Restore from code</button><button class="big ghost" data-a="close">Close</button>', {
      close: closeModal,
      copy: function (b) {
        var t = $('code'); t.value = code; t.select();
        try { if (A) A.copy(code); else if (navigator.clipboard) navigator.clipboard.writeText(code); else document.execCommand('copy'); b.textContent = 'Copied'; } catch (e) { b.textContent = 'Select the text and copy it'; }
      },
      load: function () {
        var v = $('code').value.trim(), o = null;
        if (v === code) { closeModal(); return; }
        try { o = JSON.parse(decodeURIComponent(escape(atob(v)))); } catch (e) {}
        if (!o || o.v === undefined || !Array.isArray(o.owned)) { toast('That code didn’t work', 'Check that all of it was pasted'); return; }
        s = C.load(o, Date.now()); s.last = Date.now(); swapped(); closeModal(); toast('Restored', C.STAGES[lastStage].name);
      }
    });
    $('code').value = code;
  }
  function swapped() { refresh(); lastStage = C.stageOf(s); shownGrowth = C.growth(s); apply(); save(); }
  function apply() { Sound.enable(s.settings.sound); C.setSci(s.settings.sci); upKey = vKey = jKey = ''; resize(); paint(); }

  // ---------- loop ----------
  var lastStage = 0, shownGrowth = 0, lastT = 0, acc = 0, paintAcc = 0, saveAcc = 0, rumbleAcc = 6, chirpAcc = 5, achAcc = 0, running = true;
  function awayCheck(now) {
    if (adOn || now - s.last < 10000) return;
    var r = C.offline(s, now); refresh(); lastStage = C.stageOf(s); save();
    if (r && r.sec > 60 && r.gain >= 1) {
      modal('<h2>It kept raining</h2><p>You were away for ' + C.fmtTime(r.sec) + '.' + (r.capped ? ' The rain stopped after ' + C.fmtTime(r.counted) + '.' : '') + '</p><div class="num">+' + fmt(r.gain) + '</div><button class="big" data-a="ok">Collect the rain</button><div id="awayAd"></div>', {
        ok: function () { closeModal(); Sound.unlock(); Sound.chime(); paint(); },
        ad: function () { closeModal(); watchAd(function () { C.gain(s, r.gain); Scene.say('+' + fmt(r.gain)); toast('Rain doubled', '+' + fmt(r.gain) + ' more drops'); }); }
      });
      // The ad may still be loading when the app opens, so keep checking while the dialog is up.
      (function look() {
        var slot = $('awayAd');
        if (!slot || $('modal').hidden) return;
        if (adReady()) slot.innerHTML = '<button class="big ad" data-a="ad" style="margin-top:9px">' + adLabel('Watch ad: +' + fmt(r.gain * 2)) + '</button>'; else setTimeout(look, 700);
      })();
    }
  }
  function frame(t) {
    if (!running) return;
    requestAnimationFrame(frame);
    var dt = Math.min(10, (t - lastT) / 1000); lastT = t;
    if (!(dt > 0)) return;
    acc += dt;
    if (s.settings.saver && acc < 0.03) return;
    dt = acc; acc = 0;
    step(dt);
  }
  function step(dt) {
    var now = Date.now(); awayCheck(now); s.last = now; stepOffer(dt);
    if (!Scene.busy() && !adOn) {
      var ev = C.tick(s, d, dt, Math.random());
      for (var id in held) { holdT += dt; if (holdT > 0.25) { holdT -= 0.25; doSqueeze(held[id].x, held[id].y); } break; }
      if (ev.auto) Scene.drip();
      if (ev.swallow && s.lifeRain > 300) { Scene.swallow(); Sound.chirp(); }
      if (ev.charged) { Sound.chime(); haptic(1); }
      var st = C.stageOf(s);
      if (st !== d.stage) refresh();
      if (st > lastStage) { lastStage = st; toast(C.STAGES[st].name, C.STAGES[st].line); Scene.bloom(); Sound.chime(); haptic(2); save(); }
    }
    achAcc += dt;
    if (achAcc > 1) {
      achAcc = 0;
      var got = C.checkAch(s);
      if (got.length) { refresh(); toast(got[0].name, got.length > 1 ? 'and ' + (got.length - 1) + ' more sightings' : 'Sighting: ' + got[0].desc); save(); }
    }
    var g = C.growth(s);
    shownGrowth += (g - shownGrowth) * (1 - Math.pow(0.15, dt));
    if (Math.abs(g - shownGrowth) < 0.001) shownGrowth = g;
    var rate = d.rate * C.rainBuff(s), storm = s.buffs.storm > 0, intens = rate > 0 ? Math.min(1, 0.04 + Math.log(rate + 1) / Math.LN10 / 14) : 0;
    Scene.info({ growth: shownGrowth, intensity: intens, owned: s.owned, storm: storm, rainbow: s.buffs.rain > 0 || s.buffs.tap > 0, charge: s.charge, people: C.STAGES[C.stageOf(s)].pop, biome: s.evap % C.VALLEYS.length, saver: s.settings.saver });
    Sound.rain(intens, storm ? 1 : 0);
    if (storm) { rumbleAcc -= dt; if (rumbleAcc <= 0) { rumbleAcc = 3 + Math.random() * 4; Scene.rumble(); Sound.thunder(); } }
    chirpAcc -= dt; if (chirpAcc <= 0) { chirpAcc = 5 + Math.random() * 9; if (shownGrowth > 0.38 && !storm) Sound.chirp(); }
    Scene.frame(Math.min(dt, 0.1));
    paintAcc += dt; if (paintAcc > 0.1 || dirty) { paintAcc = 0; dirty = false; paint(); }
    saveAcc += dt; if (saveAcc > 10) { saveAcc = 0; save(); }
  }

  function pause() { if (!running) return; running = false; held = {}; s.last = Date.now(); save(); Sound.pause(); }
  function resume() { if (running) return; running = true; if (adOn) s.last = Date.now(); lastT = performance.now(); Sound.resume(); requestAnimationFrame(frame); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else resume(); });
  addEventListener('pagehide', function () { if (running) s.last = Date.now(); save(); });
  addEventListener('resize', resize);

  window.Game = {
    insets: function (t, b, l, r) { inset = { top: t, bottom: b, left: l, right: r }; layout(true); },
    back: function () {
      if (!$('modal').hidden) { closeModal(); return true; }
      if (!$('offer').hidden) { $('offer').hidden = true; return true; }
      if (open) { open = false; layout(); paintTabs(); return true; }
      return false;
    },
    pause: pause, resume: resume, save: save, adResult: adResult,
    // used by the test scripts
    state: function () { return s; }, swapped: swapped, step: step
  };

  // ---------- go ----------
  s = C.load(readSave(), Date.now());
  if (!s.last) s.last = Date.now();
  Scene.init($('scene')); C.setSci(s.settings.sci); Sound.prefer(s.settings.sound);
  buildGens(); refresh(); lastStage = C.stageOf(s); shownGrowth = C.growth(s);
  resize(); paintTabs(); paint();
  lastT = performance.now(); requestAnimationFrame(frame);
})();
