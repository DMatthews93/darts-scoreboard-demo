(() => {
  const qs = new URLSearchParams(location.search);
  const cfg = { theme: 'default', ...window.OVERLAY_CONFIG };
  if (qs.get('url')) cfg.obsUrl = qs.get('url');
  if (qs.get('port')) cfg.obsUrl = `ws://127.0.0.1:${qs.get('port')}`;
  if (qs.has('password')) cfg.obsPassword = qs.get('password');
  for (const k of ['position', 'theme', 'accent']) if (qs.get(k)) cfg[k] = qs.get(k);

  const $ = (id) => document.getElementById(id);
  const board = $('board');
  board.classList.add(cfg.position);
  document.body.classList.add('theme-' + cfg.theme);
  // view (?view= or config): 'scoreboard' = just the scoreboard, 'summary' = just the post-game stats (for a
  // second Browser source), 'both' = one source showing each in turn
  const view = qs.get('view') || cfg.view || 'both';
  document.documentElement.classList.add('view-' + view);
  // canvas: 'compact' (arena only; sized to the view) or 'full' (1920x1080); ?canvas= in the URL overrides
  const canvas = qs.get('canvas') || cfg.canvas || 'full';
  const compact = canvas === 'compact' && cfg.theme === 'arena';
  document.documentElement.classList.toggle('compact', compact);
  // compact layout size per view; it is scaled to the Browser source's width/height, so any size of the same shape
  // (e.g. 1500x585 for the scoreboard) stays sharp
  const SIZE = { scoreboard: [1000, 390], summary: [760, 720], both: [1000, 720] }[view] || [1000, 720];
  const fitCanvas = () => { document.body.style.transform = `scale(${Math.min(innerWidth / SIZE[0], innerHeight / SIZE[1])})`; };
  if (compact) {
    document.body.style.width = SIZE[0] + 'px';
    document.body.style.height = SIZE[1] + 'px';
    fitCanvas();
    addEventListener('resize', fitCanvas);
  }
  document.documentElement.style.setProperty('--accent', cfg.accent);
  // the green preview background behind a demo, unless &clear asks for a transparent page (e.g. inside another page)
  if ((qs.has('preview') || qs.has('demo')) && !qs.has('clear')) document.body.classList.add('preview');
  const arena = $('arena');
  const summary = $('summary');

  // Arena look: config.js gives the defaults; the extension popup's "Scoreboard style" overrides them live
  // (sent with every update as state.style). A ?caption= in the URL wins over both.
  let style = {};
  let lastBoardColours = null;
  let lastRingColours = '';
  const base = { ...cfg };
  // the settings page's highlight presets (GRADIENT_PRESETS in settings.js), left colour then right
  const DEMO_PRESETS = { blue: ['#0b4fc0', '#2a7bf2'], red: ['#f0123d', '#da0329'], violet: ['#9302ea', '#f000c1'],
    gold: ['#d4194e', '#e0c03f'], teal: ['#0f6b5a', '#63daaf'] };
  function applyStyle(next) {
    if (next) style = next;
    const s = {
      accent: cfg.arenaAccent || '#1f6fe5', accent2: cfg.arenaAccent2 || cfg.arenaAccent || '#1f6fe5',
      panel: cfg.arenaPanel || '#1c1f26', tab: cfg.arenaTab || '#2a2e37', chip: cfg.arenaChip || cfg.arenaPanel || '#1c1f26',
      showFlags: base.showFlags !== false, showCaption: true, caption: base.caption ?? '', showCheckout: base.showCheckout !== false,
      showEffects: base.showEffects !== false, visitScores: base.visitScores === true,
      ...Object.fromEntries(Object.entries(style).filter(([, v]) => v !== undefined && v !== '')),
    };
    if (qs.has('caption')) s.caption = qs.get('caption');
    if (qs.has('visit')) s.visitScores = true;
    if (qs.has('glow')) s.glowStrength = Number(qs.get('glow'));
    if (qs.has('ninematch')) s.nineMatch = true;
    // try a highlight gradient from the URL: &preset=red (the settings page's presets) or &accent=f0123d&accent2=da0329
    const preset = DEMO_PRESETS[(qs.get('preset') || '').toLowerCase()];
    if (preset) [s.accent, s.accent2] = preset;
    const hex = (v) => (v ? '#' + v.replace(/^#/, '') : '');
    if (qs.get('accent')) { s.accent = hex(qs.get('accent')); s.accent2 = hex(qs.get('accent2')) || s.accent; }
    for (const el of [arena, summary, $('sky')]) {
      el.style.setProperty('--a-accent', s.accent);
      el.style.setProperty('--a-accent2', s.accent2);
      el.style.setProperty('--a-panel', s.panel);
      el.style.setProperty('--a-tab', s.tab);
      el.style.setProperty('--a-chip', s.chip);
    }
    // ring gradients: set the stop colours directly and re-point each ring at its gradient, because OBS's built-in
    // browser doesn't repaint an SVG gradient when only the CSS variables behind it change
    // ring colours: by default the same as the thrower's name tab (Settings: Rings, "Same as the highlight")
    const [ring1, ring2] = s.ringMatch === false && s.ring1 ? [s.ring1, s.ring2 || s.ring1] : [s.accent, s.accent2];
    const ringColours = ring1 + ring2;
    for (const side of ringColours === lastRingColours ? [] : ['left', 'right']) {
      const [from, to] = document.querySelectorAll(`#ring-${side} stop`);
      from.style.stopColor = ring1;
      to.style.stopColor = ring2;
      const arc = $('a-dial-' + side).querySelector('.arc');
      arc.setAttribute('stroke', 'none');
      arc.getBoundingClientRect();
      arc.setAttribute('stroke', `url(#ring-${side})`);
    }
    lastRingColours = ringColours;
    // the board's layered gradients (name band, main panel, caption bar, dial faces) from the panel and tab colours,
    // set the same way for the same reason
    // each part has its own colours (Settings: PDC colours); a look saved before that uses shades of its panel / tab
    const mix = (c, pct, other) => `color-mix(in srgb, ${c} ${pct}%, ${other})`;
    const b = {
      bandTop: s.bandTop || mix(s.tab, 93, '#fff'), bandBottom: s.bandBottom || mix(s.tab, 62, '#0a0820'),
      panelTop: s.panelTop || mix(s.panel, 92, '#fff'), panelBottom: s.panelBottom || mix(s.panel, 85, '#0c0a2a'),
      barTop: s.barTop || mix(s.panel, 45, '#04030f'), barBottom: s.barBottom || mix(s.panel, 85, '#0c0a2a'),
      faceTop: s.faceTop || mix(s.panel, 88, '#fff'), faceBottom: s.faceBottom || mix(s.panel, 88, '#0c0a2a'),
    };
    for (const el of [arena, summary]) {
      el.style.setProperty('--a-band-top', b.bandTop);
      el.style.setProperty('--a-band-bottom', b.bandBottom);
      el.style.setProperty('--a-panel-bottom', b.panelBottom);
      el.style.setProperty('--a-track', s.ringTrack || mix(s.accent2, 14, mix(b.panelBottom, 85, '#0a0618')));
      el.style.setProperty('--a-text-name', s.textName || '#fff');
      el.style.setProperty('--a-text-number', s.textNumber || '#fff');
      el.style.setProperty('--a-text-label', s.textLabel || '#c9ccd3');
      el.style.setProperty('--a-text-caption', s.textCaption || '#e8e9ec');
    }
    const boardColours = JSON.stringify(b);
    if (boardColours !== lastBoardColours) {
      const stops = {
        'a-band': [b.bandTop, b.bandBottom], 'a-panel': [b.panelTop, b.panelBottom],
        'a-bar': [b.barTop, b.barBottom], 'a-face': [b.faceTop, b.faceBottom],
      };
      for (const [id, [top, bottom]] of Object.entries(stops)) {
        const [a, b] = document.querySelectorAll(`#${id} stop`);
        a.style.stopColor = top;
        b.style.stopColor = bottom;
      }
      for (const el of document.querySelectorAll('#arena [fill^="url(#a-"]')) {
        const f = el.getAttribute('fill');
        el.setAttribute('fill', 'none');
        el.getBoundingClientRect();
        el.setAttribute('fill', f);
      }
      lastBoardColours = boardColours;
    }
    captionStyle = s;
    showCaption();
    cfg.showFlags = s.showFlags;
    cfg.showCheckout = s.showCheckout;
    cfg.showEffects = s.showEffects !== false;
    cfg.visitScores = s.visitScores === true; // scores change only when a visit ends, as on TV
    // how long a 180 / nine-darter flash stays up, and how long it takes to fade (Options sliders)
    cfg.flashMs = (Number(s.flashSeconds) || 1) * 1000;
    document.documentElement.style.setProperty('--moment-fade', (s.flashFade ?? 0.3) + 's');
    // the "9" is gold unless it follows the highlight (some TV boards colour it to match, e.g. violet at the Poland Open)
    arena.style.setProperty('--a-nine', s.nineMatch ? s.accent2 : s.nine || '#f2c94c');
    // nine-darter glow strength (Options slider, 100% = as on TV): how strongly the colour shows and how far in it reaches
    const glow = Math.max(0, Math.min(2, (s.glowStrength ?? 100) / 100));
    arena.style.setProperty('--a-glow-mix', Math.min(100, 50 * glow) + '%');
    arena.style.setProperty('--a-glow-size', 20 * Math.max(glow, 0.3) + 'px');
    arena.style.setProperty('--a-glow-spread', 7 * glow + 'px');
    cfg.summarySeconds = s.summarySeconds ?? base.summarySeconds ?? 20;
    // scoreboard look: 'pdc' (the dials board) or 'sky' (stacked rows); ?look= in the URL wins
    // Sky colours (popup: Sky colours); anything not set keeps the defaults in overlay.html
    const rootStyle = document.documentElement.style;
    for (const k of ['head', 'strip', 'name', 'cells', 'score', 'marker', 'foot', 'chip', 'text', 'thrower', 'stats', 'label', 'moment', 'nine', 'ninecard']) {
      let v = s['sky' + k[0].toUpperCase() + k.slice(1)];
      if (k === 'marker' && v === '#b04ce0') v = ''; // the old default purple: use the new default (the "9" box pink)
      if (v) rootStyle.setProperty('--k-' + k, v); else rootStyle.removeProperty('--k-' + k);
    }
    const look = qs.get('look') || s.look || base.look || 'pdc';
    document.documentElement.classList.toggle('look-sky', look === 'sky');
  }
  // Caption: your own text when "Override" is ticked; otherwise Scolia's tournament name in a tournament game,
  // falling back to your text. A ?caption= in the URL always wins.
  let captionStyle = {};
  let captionTournament = null;
  function showCaption(state) {
    if (state !== undefined) captionTournament = state?.tournament || null;
    const s = captionStyle;
    const text = qs.has('caption') || s.captionOverride ? s.caption : (captionTournament || s.caption);
    $('a-caption-box').classList.toggle('off', !s.showCaption);
    fitCaption($('a-caption'), text || '');
  }

  // Long tournament names shrink to fit the bar under the dials (about 470px of text), down to 13px.
  function fitCaption(el, text) {
    if (el.textContent === text && el.dataset.fitted === String(document.fonts.status === 'loaded')) return;
    el.textContent = text;
    el.style.fontSize = '';
    if (!text || !el.offsetParent) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const scale = el.getBoundingClientRect().width / el.offsetWidth || 1;
    const width = () => range.getBoundingClientRect().width / scale;
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (size > 13 && width() > 470) el.style.fontSize = --size + 'px';
    el.dataset.fitted = String(document.fonts.status === 'loaded');
  }
  applyStyle();


  const RING = 2 * Math.PI * Number($('a-dial-left').querySelector('.arc').getAttribute('r'));
  for (const side of ['left', 'right']) $('a-dial-' + side).querySelector('.arc').style.strokeDasharray = RING;

  // ---------- checkout suggestions (double out) ----------
  const DOUBLES = ['D20', 'D16', 'D18', 'D12', 'D10', 'D8', 'D14', 'D19', 'D17', 'D15', 'D13', 'D11', 'D9', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'BULL'];
  const SETUPS = [];
  for (let n = 20; n >= 1; n--) SETUPS.push('T' + n);
  SETUPS.push('25');
  for (let n = 20; n >= 1; n--) SETUPS.push('S' + n);
  SETUPS.push('BULL');
  const pts = (d) => d === 'BULL' ? 50 : d === '25' ? 25 : ({ S: 1, D: 2, T: 3 }[d[0]]) * Number(d.slice(1));
  const label = (d) => d[0] === 'S' ? d.slice(1) : d;
  const finishRank = new Map(DOUBLES.map((d, i) => [pts(d), i]));

  // Checkout routes: Scolia's own table for the game's out rule (overlay/checkouts.js, copied from Scolia's app by
  // tools/update_checkouts.py), so the chips match what Scolia shows; the solver below is only a fallback.
  let outRule = 'double';
  function checkout(r, maxDarts = 3) {
    const table = window.SCOLIA_CHECKOUTS?.[outRule];
    if (table) {
      const route = table[r]?.[Math.min(3, maxDarts)];
      return route ? route.split(' ').map((d) => (/^bull$/i.test(d) ? 'BULL' : d)) : null;
    }
    return solveCheckout(r, maxDarts);
  }

  function solveCheckout(r, maxDarts = 3) {
    if (!r || r > 170 || r < 2 || maxDarts < 1) return null;
    if (finishRank.has(r)) return [DOUBLES[finishRank.get(r)]];
    if (maxDarts < 2) return null;
    let best = null;
    for (const a of SETUPS) {
      const rest = r - pts(a);
      if (!finishRank.has(rest)) continue;
      // prefer good doubles, and singles over trebles on low scores
      const score = finishRank.get(rest) * 10 + (a[0] === 'T' && r <= 60 ? 5 : 0);
      if (!best || score < best.score) best = { score, route: [a, DOUBLES[finishRank.get(rest)]] };
    }
    if (best || maxDarts < 3) return best ? best.route : null;
    // 3 darts: favourite double first, then a treble opener with a single (not treble) second dart
    for (const a of SETUPS) for (const b of SETUPS) {
      const rest = r - pts(a) - pts(b);
      if (!finishRank.has(rest)) continue;
      const score = finishRank.get(rest) * 10 + (b[0] === 'T' ? 4 : 0) + (a[0] !== 'T' ? 6 : 0);
      if (!best || score < best.score) best = { score, route: [a, b, DOUBLES[finishRank.get(rest)]] };
    }
    return best ? best.route : null;
  }

  // ---------- nine-darters ----------
  // Whether `left` can still be finished in exactly `darts` darts under the out rule (double out by default).
  // Sums any n darts can make are worked out once; a perfect leg needs every dart, so a miss is allowed only in the
  // maths (it never helps).
  const DART_VALUES = [...new Set([0, 25, 50, ...Array.from({ length: 20 }, (_, k) => [k + 1, 2 * (k + 1), 3 * (k + 1)]).flat()])];
  const reach = [new Set([0])];
  for (let n = 1; n <= 8; n++) reach[n] = new Set([...reach[n - 1]].flatMap((a) => DART_VALUES.map((v) => a + v)));
  function canFinishIn(left, darts) {
    if (darts < 1 || left < 1) return false;
    const last = outRule === 'single' ? DART_VALUES.filter((v) => v > 0)
      : DART_VALUES.filter((v) => v === 50 || (v <= 40 && v % 2 === 0 && v > 0) || (outRule === 'master' && v <= 60 && v % 3 === 0 && v > 0));
    return last.some((f) => reach[darts - 1].has(left - f));
  }
  // on a nine-darter: a 501 leg, at least one visit thrown, and every dart so far still allows a nine-dart finish
  function onNine(p, state) {
    const d = p?.legDarts;
    if (!cfg.showEffects || state.startScore !== 501 || d == null || d < 3) return false;
    if (d === 9) return p.remaining === 0; // the nine-darter itself: the "9" stays up until the next leg
    return !state.ended && d < 9 && canFinishIn(p.remaining, 9 - d);
  }

  // the score on the board for player i. With visitScores on, the darts of a visit still being thrown aren't taken
  // off yet (a bust or a checkout shows straight away). While a 180 flash is up the score from before it stays
  // underneath, as on TV, so the new score only shows as the flash clears
  const held = [null, null];
  function shownScore(i, p, state) {
    if (held[i] != null) return held[i];
    if (!p || p.remaining == null) return null;
    const visit = p.isCurrent ? state.currentVisit || [] : [];
    if (cfg.visitScores && visit.length && visit.length < 3 && p.remaining > 0 && !p.busted)
      return p.remaining + visit.reduce((a, d) => a + (d.points || 0), 0);
    return p.remaining;
  }

  // ---------- big moments: a 180 or a nine-darter fills the player's dial (PDC) or splashes over their score (Sky) ----------
  const momentTimers = [];
  function onEvent(ev, state) {
    if (!cfg.showEffects || !ev || !state?.players) return;
    const i = state.players.findIndex((p) => p.id === ev.playerId);
    if (i < 0 || i > 1) return;
    if (ev.type === 'oneEighty') {
      // under the flash: the score before the visit (end-of-visit scores) or before the third dart (live scores)
      const p = state.players[i];
      if (p.remaining != null) { held[i] = p.remaining + (cfg.visitScores ? 180 : 60); render(state); }
      moment(i, '180', cfg.flashMs);
    }
    // a finished nine-darter stays up longer: three times the flash time, at least 3 seconds (PDC); Sky shows its
    // "9-DARTER" card instead
    if (ev.type === 'nineDarter') {
      moment(i, '9', Math.max(3000, cfg.flashMs * 3));
      const p = state.players[i];
      clearTimeout(nineCardTimer);
      nineCardTimer = setTimeout(() => nineCard(p), 1300);
    }
  }
  // Sky: the "9-DARTER" card, held about 9 seconds like the TV board
  let nineCardTimer;
  function nineCard(p) {
    const card = $('k-nine-card');
    $('k-nine-name').textContent = p?.name || '';
    clearTimeout(nineCardTimer);
    card.className = 'k-nine-card';
    void card.offsetWidth; // start the wipe from the left even if a card was already up
    card.classList.add('show');
    $('sky').classList.add('ninecard', 'ninefull');
    nineCardTimer = setTimeout(() => {
      $('sky').classList.remove('ninefull'); // the board is back underneath as the card wipes away
      card.classList.add('leave');
      nineCardTimer = setTimeout(() => { card.className = 'k-nine-card'; $('sky').classList.remove('ninecard'); }, 300);
    }, 9000);
  }
  function moment(i, text, ms) {
    for (const el of [$('a-dial-' + (i ? 'right' : 'left')), $('k-row-' + i)]) {
      el.querySelector('.moment').innerHTML = `<span>${text}</span>`;
      el.classList.remove('moment-on');
      void el.offsetWidth; // restart the animation for a second 180 in a row
      el.classList.add('moment-on');
    }
    clearTimeout(momentTimers[i]);
    momentTimers[i] = setTimeout(() => {
      $('a-dial-' + (i ? 'right' : 'left')).classList.remove('moment-on');
      $('k-row-' + i).classList.remove('moment-on');
      if (held[i] != null) { held[i] = null; if (lastState) render(lastState); } // the new score as the flash fades
    }, ms);
  }

  // Sky checkout box: when the route is the old one minus its first dart, that target's text vanishes and its slot
  // closes up (the box shrinks towards the board); any other change redraws the box straight away
  function setRoute(chips, route) {
    const before = chips._route || [];
    chips._route = route;
    const dropped = before.length && route.length === before.length - 1 && route.every((d, j) => d === before[j + 1]);
    if (dropped) {
      const gone = chips.querySelector('span:not(.gone)');
      if (gone) {
        gone.style.maxWidth = gone.offsetWidth + 'px';
        void gone.offsetWidth;
        gone.classList.add('gone');
        if (!route.length) chips.classList.add('closing');
        setTimeout(() => {
          gone.remove();
          if (!chips._route.length) { chips.replaceChildren(); chips.classList.remove('closing'); }
        }, 550);
        return;
      }
    }
    if (JSON.stringify(route) === JSON.stringify(before)) return; // unchanged (leave any slot that's closing alone)
    chips.classList.remove('closing');
    // Sky writes the bull as "Bull" (the same width as the other darts, so the two rows stay in line)
    chips.innerHTML = route.map((d) => `<span>${d === 'BULL' ? 'Bull' : label(d)}</span>`).join('');
  }

  // ---------- rendering ----------
  let lastState = null;
  let endTimer = null;
  let summaryTimer = null;
  const shownSummaries = new Set(); // summaries already shown, so none shows twice (e.g. after a preview)

  function render(state) {
    lastState = state;
    // When the match ends the final score stays up; once Scolia's stats arrive the summary replaces it
    // for summarySeconds (the popup's slider; 0 = off), then everything hides until the next game. No stats
    // within a minute: just hide. A preview from the popup (state.previewSeconds) always shows.
    if (state?.ended && !endTimer && !qs.has('demo') && !state.previewSeconds) {
      endTimer = setTimeout(() => { endTimer = 'done'; render(lastState); }, 60000);
    }
    const seconds = state?.previewSeconds || cfg.summarySeconds;
    const key = state?.summary && JSON.stringify(state.summary.map((p) => [p.name, p.legs, p.sets, p.throws, p.average]));
    // a preview always shows (it reuses the same sample stats each time); real summaries show once each
    if (state?.ended && state.summary && seconds !== 0 && (state.previewSeconds || !shownSummaries.has(key))) {
      if (!state.previewSeconds) shownSummaries.add(key);
      clearTimeout(summaryTimer);
      renderSummary(state.summary, state);
      summary.classList.remove('hidden');
      summaryTimer = setTimeout(() => { summaryTimer = 'done'; summary.classList.add('hidden'); render(lastState); },
        (seconds ?? 20) * 1000);
    }
    if (!state?.ended) {
      clearTimeout(endTimer); endTimer = null;
      clearTimeout(summaryTimer); summaryTimer = null;
      summary.classList.add('hidden');
    }
    if (!state || !state.active || endTimer === 'done' || summaryTimer) {
      board.classList.add('hidden');
      arena.classList.add('hidden');
      $('sky').classList.add('hidden');
      return;
    }
    board.classList.remove('hidden');
    arena.classList.remove('hidden');
    $('sky').classList.remove('hidden');
    $('title').textContent = state.startScore ? String(state.startScore) : 'X01';
    $('setsHead').classList.toggle('hide', !state.setsEnabled);

    const wrap = $('players');
    wrap.innerHTML = '';
    for (const [i, p] of state.players.entries()) {
      const row = document.createElement('div');
      row.className = 'player' + (p.isCurrent ? ' current' : '') + (p.busted ? ' busted' : '');
      const avg = cfg.showAverage && p.average != null ? `<span class="meta">${p.average.toFixed(1)}</span>` : '';
      row.innerHTML = `
        <div class="bar"></div>
        <div class="name"><span class="arrow"></span>${escapeHtml(p.name)}${avg}</div>
        <div class="num ${state.setsEnabled ? '' : 'hide'}">${p.sets}</div>
        <div class="num">${p.legs}</div>
        <div class="remaining">${shownScore(i, p, state) ?? ''}</div>`;
      wrap.appendChild(row);
    }

    const cur = state.players.find((p) => p.isCurrent);
    const visit = state.currentVisit || [];
    for (let i = 0; i < 3; i++) {
      const el = $('d' + i);
      el.textContent = visit[i] ? visit[i].label : '·';
      el.classList.toggle('empty', !visit[i]);
    }
    const sum = visit.reduce((a, d) => a + d.points, 0);
    $('visitSum').textContent = visit.length ? `= ${sum}` : '';

    const route = cfg.showCheckout && cur ? checkout(cur.remaining) : null;
    $('checkoutChip').classList.toggle('hide', !route);
    if (route) $('checkout').textContent = route.map(label).join('  ');
    renderArena(state);
    renderSky(state);
  }

  // ---------- "Sky" look ----------
  function renderSky(state) {
    const sky = $('sky');
    const players = state.players || [];
    sky.classList.toggle('nosets', !state.setsEnabled);
    const f = state.setsEnabled && state.setsFormat ? state.setsFormat : state.legsFormat;
    // "First to 6" with no unit, as on the TV board (the Sets / Legs columns say which)
    $('k-format').textContent = qs.get('format') || cfg.formatLabel || (f?.value
      ? `${f.type === 'BestOf' ? 'Best of' : 'First to'} ${f.value}` : '');
    const flags = cfg.showFlags && players.length && players.every((p) => p.flag);
    [0, 1].forEach((i) => {
      const p = players[i];
      const row = $('k-row-' + i);
      row.classList.toggle('current', !!p?.isCurrent);
      if (p?.isCurrent) Object.assign($('k-thrower').style, { top: row.offsetTop + 'px', height: row.offsetHeight + 'px' });
      row.classList.toggle('starter', !!p && p.id === state.legStarter && !state.ended);
      fitName(row.querySelector('.k-name'), p ? p.name : '');
      if (i === 1) matchNames($('k-row-0').querySelector('.k-name'), row.querySelector('.k-name'));
      const img = row.querySelector('.k-flag img');
      const src = flags && p?.flag ? (cfg.flagUrl || 'https://flagcdn.com/w160/{code}.png').replace('{code}', p.flag) : '';
      if (img.getAttribute('src') !== src) { if (src) img.src = src; else img.removeAttribute('src'); }
      row.querySelector('.k-flag').classList.toggle('none', !src);
      row.querySelector('.k-sets').textContent = p?.sets ?? '';
      row.querySelector('.k-legs').textContent = p?.legs ?? '';
      row.querySelector('.k-score').textContent = shownScore(i, p, state) ?? '';
      const nine = onNine(p, state);
      row.classList.toggle('nine', nine);
      $('k-route-' + i).classList.toggle('nine', nine);
      // the same routes as the dials board: the thrower's shrinks as they throw
      const box = $('k-route-' + i);
      box.style.top = row.offsetTop + 'px'; // level with the player's row, below the header bar
      box.classList.toggle('current', !!p?.isCurrent);
      const dartsLeft = p?.isCurrent ? 3 - Math.min(3, (state.currentVisit || []).length) : 3;
      const chips = box.querySelector('.k-chips');
      let route = cfg.showCheckout && p && dartsLeft ? checkout(p.remaining, dartsLeft) || [] : [];
      // after a dart that scores what the route asked for, keep the rest of the same route (the solver might pick a
      // different finish for the new score, e.g. 81 as T15 D18 rather than the T19 D12 left over), like the TV board
      const before = chips._route || [];
      const rest = before.slice(1);
      if (cfg.showCheckout && p?.isCurrent && before.length && rest.length <= dartsLeft
          && rest.reduce((a, d) => a + pts(d), 0) === p.remaining && (rest.length || p.remaining === 0)) route = rest;
      setRoute(chips, route);
    });
    $('k-thrower').classList.toggle('on', players.some((p) => p.isCurrent) && !state.ended);
    $('k-foot').textContent = $('a-caption').textContent;
    sky.classList.toggle('nocaption', $('a-caption-box').classList.contains('off'));
  }

  // flag codes are ISO alpha-2 ("at") or Scolia's custom flags ("gb-eng"); flagcdn.com has both as flat flags
  function setFlag(box, code) {
    const img = box.firstElementChild;
    const src = code ? (cfg.flagUrl || 'https://flagcdn.com/w160/{code}.png').replace('{code}', code) : '';
    if (img.getAttribute('src') !== src) {
      if (src) img.src = src; else img.removeAttribute('src');
      img.onerror = () => $('a-flags').classList.add('off');
    }
  }

  // ---------- post-game summary ----------
  function renderSummary(players, state) {
    const [a, b] = players;
    // the highlighted name tab is the winner
    [a, b].forEach((p, i) => {
      const tab = $('s-name-' + i);
      fitName(tab, p ? p.name : '');
      tab.classList.toggle('current', !!p?.winner);
    });
    matchNames($('s-name-0'), $('s-name-1'));
    // same rows, order and number formats as Scolia's own Game Statistics table; like Scolia, a single-leg
    // game leaves out sets/legs won, highest finish and best leg, and a legs-only match leaves out sets won
    const withSets = (state.setsFormat?.value ?? 0) > 1;
    const multiLeg = withSets || (state.legsFormat?.value ?? 0) > 1;
    // Scolia shows whole numbers bare (58, 0%) and anything else to 2 decimals (83.80, 16.67%)
    const fix = (n) => n == null ? '-' : Number.isInteger(Number(n)) ? String(n) : Number(n).toFixed(2);
    const pct = (n) => n == null ? '-' : `${fix(n)}%`;
    // [label, shown value, number to compare (null = no highlight), lower is better]
    const rows = [
      ...(withSets ? [['Sets won', (p) => p.sets, (p) => p.sets]] : []),
      ...(multiLeg ? [['Legs won', (p) => p.legs, (p) => p.legs]] : []),
      ['Average', (p) => fix(p.average), (p) => p.average],
      ['Scoring', (p) => fix(p.scoring), (p) => p.scoring],
      ['First 9 Avg.', (p) => fix(p.first9), (p) => p.first9],
      ['Checkout', (p) => pct(p.checkoutPct), (p) => p.checkoutPct],
      ['Checkout rate', (p) => `${p.checkoutHits} / ${p.checkoutThrows}`, (p) => p.checkoutPct],
      ...(multiLeg ? [['Highest Finish', (p) => p.highestFinish, (p) => p.highestFinish]] : []),
      ['Throws', (p) => p.throws, () => null],
      ...(multiLeg ? [['Best Leg', (p) => p.bestLeg ?? '-', (p) => p.bestLeg, true]] : []),
      ['60+', (p) => p.n60, (p) => p.n60],
      ['80+', (p) => p.n80, (p) => p.n80],
      ['100+', (p) => p.n100, (p) => p.n100],
      ['140+', (p) => p.n140, (p) => p.n140],
      ['180', (p) => p.n180, (p) => p.n180],
    ];
    // your numbers bright and the opponent's muted; if neither player is you (or it's unknown), the better
    // value on each row is the bright one
    renderSkyStats(a, b, state, withSets, multiLeg, fix);
    const mine = a.isMe !== b.isMe ? [!!a.isMe, !!b.isMe] : null;
    $('s-rows').innerHTML = rows.map(([name, show, num, lowerBetter]) => {
      const [x, y] = [num(a), num(b)];
      const neutral = x == null && y == null;
      const best = (v, o) => neutral || (v != null && (o == null || (lowerBetter ? v <= o : v >= o)));
      const [bx, by] = mine || [best(x, y), best(y, x)];
      return `<div class="s-row"><b class="${bx ? 'best' : ''}">${show(a)}</b>` +
        `<span>${name}</span><b class="${by ? 'best' : ''}">${show(b)}</b></div>`;
    }).join('');
  }

  // Sky look's "Match Stats": names either side of the score, then the stats Scolia gives us in Sky's order
  function renderSkyStats(a, b, state, withSets, multiLeg, fix) {
    const fitNames = () => { fitText($('ks-name-0'), a.name, 38, 16); fitText($('ks-name-1'), b.name, 38, 16); };
    fitNames();
    // measure again once the card's bold font has actually loaded (an installed font can arrive a moment after first
    // use, and measuring the stand-in font would leave a long name too wide)
    document.fonts.load("700 38px 'Sky Bold'").then(fitNames, () => {});
    $('ks-score').textContent = withSets ? `${a.sets}-${b.sets}` : `${a.legs}-${b.legs}`;
    $('ks-sub').textContent = $('a-caption-box').classList.contains('off') ? '' : $('a-caption').textContent;
    const doubles = (p) => `${p.checkoutHits}/${p.checkoutThrows}${p.checkoutThrows ? ` (${Math.round(p.checkoutPct)}%)` : ''}`;
    const rows = [
      ['Average', (p) => fix(p.average)],
      ['First 9 Avg.', (p) => fix(p.first9)],
      ['Scoring', (p) => fix(p.scoring)],
      ['100+', (p) => p.n100],
      ['140+', (p) => p.n140],
      ['180s', (p) => p.n180],
      ...(multiLeg ? [['Highest Out', (p) => p.highestFinish || '-'], ['Best Leg', (p) => p.bestLeg ?? '-']] : []),
      ['Doubles Success', doubles],
    ];
    $('ks-rows').innerHTML = rows.map(([name, show]) =>
      `<div class="ks-row"><b>${escapeHtml(show(a))}</b><span>${name}</span><b>${escapeHtml(show(b))}</b></div>`).join('');
  }

  // text that shrinks from `max` px until it fits inside its box's padding (down to `min`, then "…")
  function fitText(el, text, max, min) {
    el.textContent = text;
    let size = max;
    el.style.fontSize = size + 'px';
    while (size > min && el.scrollWidth > el.clientWidth) el.style.fontSize = --size + 'px';
  }

  function formatText(f) {
    if (!f || !f.value) return '';
    return f.type === 'BestOf' ? `BEST OF ${f.value}` : `FIRST TO ${f.value}`;
  }

  function renderArena(state) {
    outRule = /master/i.test(state.outType || '') ? 'master' : /single|straight/i.test(state.outType || '') ? 'single' : 'double';
    showCaption(state);
    // flags only when every player has one: against the CPU (no flag) neither shows
    const players = state.players || [];
    $('a-flags').classList.toggle('off', !cfg.showFlags || !players.length || !players.every((p) => p.flag));
    const [p0, p1] = state.players;
    [p0, p1].forEach((p, i) => {
      const side = i === 0 ? 'left' : 'right';
      const tab = $('a-name-' + i);
      const dial = $('a-dial-' + side);
      tab.classList.toggle('current', !!p?.isCurrent);
      fitName(tab, p ? p.name : '');
      if (i === 1) matchNames($('a-name-0'), tab);
      setFlag($('a-flag-' + i), p?.flag);
      const score = shownScore(i, p, state);
      dial.querySelector('.a-score').textContent = score ?? '';
      dial.classList.toggle('starter', !!p && p.id === state.legStarter && !state.ended);
      const nine = onNine(p, state);
      dial.classList.toggle('nine', nine);
      dial.classList.toggle('final', nine && p.legDarts >= 6);
      $('a-nine-' + i).classList.toggle('on', nine);
      $('a-tile-' + i).classList.toggle('on', nine);
      const frac = p && state.startScore ? Math.max(0, Math.min(1, (score ?? 0) / state.startScore)) : 0;
      dial.querySelector('.arc').style.strokeDashoffset = RING * (1 - frac);
      $('a-l' + i).textContent = p?.legs ?? '';
      $('a-s' + i).textContent = p?.sets ?? '';
    });
    $('a-sets').classList.toggle('hide', !state.setsEnabled);
    // like the TV board, just "FIRST TO 4" (sets when the match has them, otherwise legs) with no unit
    $('a-format').textContent = qs.get('format') || cfg.formatLabel ||
      formatText(state.setsEnabled && state.setsFormat ? state.setsFormat : state.legsFormat);

    // Beside each dial: what that player still needs. The thrower's route is in the accent colour and
    // shrinks as they throw (darts left this visit); the other player's full route waits in dark chips.
    [p0, p1].forEach((p, i) => {
      const box = $('a-route-' + i);
      const dartsLeft = p?.isCurrent ? 3 - Math.min(3, (state.currentVisit || []).length) : 3;
      const route = cfg.showCheckout && p && dartsLeft ? checkout(p.remaining, dartsLeft) || [] : [];
      const chips = route.map((d) => ({ text: label(d), hot: !!p.isCurrent }));
      [...box.children].forEach((el, j) => {
        const c = chips[j];
        el.textContent = c ? c.text : '';
        el.classList.toggle('hot', !!c?.hot);
        el.classList.toggle('empty', !c);
      });
    });
  }

  // long names (e.g. Scolia's "Intermediate" CPU) shrink from the CSS size to fit the tab, down to 22px, then get "…"
  function fitName(tab, name) {
    let span = tab.firstElementChild;
    if (!span) { span = document.createElement('span'); tab.replaceChildren(span); }
    const key = name;
    if (tab.dataset.fitted === key) return;
    span.textContent = name;
    let size = parseFloat(getComputedStyle(tab).getPropertyValue('--name-size')) || 44;
    tab.style.fontSize = size + 'px';
    // measure the text's exact width (scrollWidth rounds, so text a fraction of a pixel too wide would still
    // get "…"); divide out any scaling on the page so the comparison is in the tab's own pixels
    const range = document.createRange();
    range.selectNodeContents(span);
    const scale = tab.getBoundingClientRect().width / tab.offsetWidth || 1;
    const textWidth = () => range.getBoundingClientRect().width / scale;
    const cs = getComputedStyle(tab);
    const room = () => tab.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 1;
    while (size > 22 && textWidth() > room()) tab.style.fontSize = --size + 'px';
    tab.dataset.size = size;
    tab.dataset.fitted = document.fonts.status === 'loaded' ? key : '';
  }
  // the two names share a size when their fitted sizes are within 3px (e.g. "Player One" 31px and "Player Two" 30px),
  // so they don't look a pixel apart; a name that needs a lot more shrinking keeps its own size
  function matchNames(a, b) {
    const sa = Number(a.dataset.size), sb = Number(b.dataset.size);
    if (!sa || !sb) return;
    const same = Math.abs(sa - sb) <= 3;
    for (const [t, own] of [[a, sa], [b, sb]]) {
      const size = same ? Math.min(sa, sb) : own;
      t.style.fontSize = size + 'px';
    }
  }
  document.fonts.ready.then(() => lastState && render(lastState));

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- data source ----------
  if (qs.has('demo')) return runDemo();
  // replay.html drives the overlay directly with postMessage instead of OBS
  if (qs.has('replay')) {
    window.addEventListener('message', (e) => {
      if (e.data?.source !== 'scolia-overlay') return;
      applyStyle(e.data.style);
      render(e.data.state);
      onEvent(e.data.event, e.data.state);
    });
    return;
  }

  const status = $('status');
  const obs = new ObsClient({
    url: cfg.obsUrl,
    password: cfg.obsPassword,
    onStatus: (s, detail) => {
      status.textContent = 'OBS: ' + (detail || s);
      status.classList.toggle('hide', s === 'connected' || !qs.has('preview'));
      if (s === 'connected') obs.broadcast({ source: 'scolia-overlay-page', kind: 'hello' }).catch(() => {});
    },
    onEvent: (type, data) => {
      if (type !== 'CustomEvent' || data?.source !== 'scolia-overlay') return;
      applyStyle(data.style);
      render(data.state);
      onEvent(data.event, data.state);
    },
  });
  obs.connect();

  // ---------- demo: fake game so you can style without a board ----------
  // ?demo plays a made-up match (first to 3 legs; &sets for first to 2 sets of 2 legs; &legs=N; &speed=ms per dart;
  // &names=A,B; &flags=gb-eng,at),
  // aiming at the checkout route on a finish, then shows the post-game summary and starts again.
  // &start=112,25 starts the players on those scores (handy for styling checkouts).
  // &perfect makes the first player hit every dart they aim at (a nine-darter whenever they start the leg).
  // &once stops the demo when the match ends, leaving the final board up.
  function runDemo() {
    const withSets = qs.has('sets');
    const legsTo = Number(qs.get('legs')) || (withSets ? 2 : 3);
    const setsTo = withSets ? 2 : 1;
    const speed = Number(qs.get('speed')) || 1100;
    const names = (qs.get('names') || 'Daniel,Opponent').split(',');
    const flags = (qs.get('flags') || '').toLowerCase().split(',');
    let st, stats, legDarts, starter = 0, pause = 0, restart = false, nextLeg = false;
    const plan = [null, null]; // each player's planned route, kept while they hit it (like the route on screen)
    const perfect = qs.has('perfect');
    // each render also sends how many darts everyone has thrown this leg, as the extension does
    const show = () => { st.players.forEach((x, j) => (x.legDarts = legDarts[j])); render(st); };

    function newMatch() {
      st = {
        active: true, ended: false, startScore: 501, setsEnabled: withSets, currentVisit: [], summary: null,
        legsFormat: { type: 'RaceTo', value: legsTo }, setsFormat: withSets ? { type: 'RaceTo', value: setsTo } : null,
        players: names.slice(0, 2).map((name, i) => ({ id: 'p' + i, name, flag: flags[i] || null, remaining: 501, legs: 0, sets: 0, isCurrent: i === 0 })),
      };
      const start = (qs.get('start') || '').split(',').map(Number);
      st.players.forEach((p, i) => { if (start[i]) p.remaining = start[i]; });
      stats = st.players.map(() => ({ darts: 0, scored: 0, f9darts: 0, f9scored: 0, coHits: 0, coDarts: 0, highest: 0, best: null,
        legsWon: 0, setsWon: 0, n60: 0, n80: 0, n100: 0, n140: 0, n180: 0 }));
      legDarts = [0, 0];
      starter = 0;
      st.legStarter = st.players[0].id;
      show();
    }

    // a rough thrower: aims at the route when on a finish, otherwise at T20
    function throwAt(target) {
      const r = Math.random();
      const n = target === 'BULL' || target === '25' ? 25 : Number(target.slice(1));
      const single = () => n === 25 ? '25' : 'S' + n;
      if (target === 'BULL') return r < 0.25 ? 'BULL' : r < 0.75 ? '25' : 'S' + (1 + Math.floor(Math.random() * 20));
      if (target[0] === 'T') return r < 0.42 ? target : r < 0.92 ? single() : ['S1', 'S5'][Math.floor(Math.random() * 2)];
      if (target[0] === 'D') return r < 0.38 ? target : r < 0.75 ? single() : 'MISS';
      return r < 0.9 ? target : ['S1', 'S5', 'S20'][Math.floor(Math.random() * 3)];
    }

    function endVisit(i, visit, bust) {
      const sum = bust ? 0 : visit.reduce((a, d) => a + d.points, 0);
      const s = stats[i];
      if (sum === 180) s.n180++; else if (sum >= 140) s.n140++; else if (sum >= 100) s.n100++; else if (sum >= 80) s.n80++; else if (sum >= 60) s.n60++;
    }

    // the final score stays up for a few seconds, then the summary takes over (like Scolia's stats arriving)
    function finishMatch() {
      st.ended = true;
      st.players.forEach((p) => (p.isCurrent = false));
      show();
      const summary = st.players.map((p, i) => {
        const s = stats[i];
        return { id: p.id, name: p.name, winner: p.sets >= setsTo && withSets || p.legs >= legsTo && !withSets,
          sets: s.setsWon, legs: s.legsWon, average: s.scored / Math.max(1, s.darts) * 3, scoring: s.scored / Math.max(1, s.darts) * 3,
          first9: s.f9scored / Math.max(1, s.f9darts) * 3, checkoutHits: s.coHits, checkoutThrows: s.coDarts,
          checkoutPct: s.coDarts ? s.coHits / s.coDarts * 100 : 0, highestFinish: s.highest, throws: s.darts, bestLeg: s.best,
          n60: s.n60, n80: s.n80, n100: s.n100, n140: s.n140, n180: s.n180 };
      });
      setTimeout(() => { st.summary = summary; show(); }, 4000);
      // &once: the finished match stays up and the demo stops there (the public demo page replays it)
      if (qs.has('once')) { pause = Infinity; return; }
      pause = Math.ceil(((cfg.summarySeconds ?? 20) * 1000 + 7000) / speed);
      restart = true;
    }

    function startLeg() {
      st.players.forEach((x) => (x.remaining = st.startScore));
      legDarts = [0, 0];
      plan[0] = plan[1] = null;
      starter = 1 - starter;
      st.legStarter = st.players[starter].id;
      st.players.forEach((x, j) => (x.isCurrent = j === starter));
      st.currentVisit = [];
    }

    newMatch();
    setInterval(() => {
      // short pause after a leg; after the match, wait for the summary then start a new match
      if (pause > 0) {
        if (--pause === 0 && restart) { restart = false; newMatch(); }
        if (pause === 0 && nextLeg) { nextLeg = false; startLeg(); show(); }
        return;
      }
      const i = st.players.findIndex((x) => x.isCurrent);
      const p = st.players[i];
      const s = stats[i];
      if (st.currentVisit.length === 3) {
        endVisit(i, st.currentVisit, false);
        st.currentVisit = [];
        st.players.forEach((x) => (x.isCurrent = !x.isCurrent));
        return show();
      }
      const left3 = 3 - st.currentVisit.length;
      const planned = plan[i];
      if (!planned || planned.length > left3 || planned.reduce((a, d) => a + pts(d), 0) !== p.remaining) plan[i] = checkout(p.remaining, left3);
      const target = plan[i] ? plan[i][0] : 'T20';
      const dart = parseDemo(perfect && i === 0 ? target : throwAt(target));
      plan[i] = plan[i] && dart.label === label(target) ? plan[i].slice(1) : null;
      const onDouble = finishRank.has(p.remaining);
      s.darts++; legDarts[i]++;
      if (legDarts[i] <= 9) { s.f9darts++; s.f9scored += dart.points; }
      if (onDouble) s.coDarts++;
      const left = p.remaining - dart.points;
      const isDouble = dart.label[0] === 'D' || dart.label === 'BULL';
      if (left === 0 && isDouble) {
        // leg won
        s.coHits++; s.scored += dart.points;
        s.highest = Math.max(s.highest, st.currentVisit.reduce((a, d) => a + d.points, 0) + dart.points);
        s.best = s.best ? Math.min(s.best, legDarts[i]) : legDarts[i];
        st.currentVisit.push(dart);
        endVisit(i, st.currentVisit, false);
        p.legs++; s.legsWon++;
        if (withSets && p.legs >= legsTo) { p.sets++; s.setsWon++; st.players.forEach((x) => (x.legs = 0)); }
        p.remaining = 0;
        if (legDarts[i] === 9) { show(); onEvent({ type: 'nineDarter', playerId: p.id }, st); }
        if ((withSets ? p.sets >= setsTo : p.legs >= legsTo)) return finishMatch();
        // the finished leg stays up for a moment before the next one starts, as in Scolia
        nextLeg = true;
        pause = 3;
        return show();
      }
      if (left < 2) {
        // bust: the visit scores nothing and play passes over
        const back = st.currentVisit.reduce((a, d) => a + d.points, 0);
        s.scored -= back; p.remaining += back;
        endVisit(i, st.currentVisit, true);
        st.currentVisit = [];
        st.players.forEach((x) => (x.isCurrent = !x.isCurrent));
        return show();
      }
      s.scored += dart.points;
      p.remaining = left;
      st.currentVisit.push(dart);
      show();
      // like the extension, the 180 event arrives as the third dart lands
      if (st.currentVisit.length === 3 && st.currentVisit.every((d) => d.points === 60)) onEvent({ type: 'oneEighty', playerId: p.id }, st);
    }, speed);
  }
  function parseDemo(l) {
    return l === 'MISS' ? { label: 'MISS', points: 0 } : { label: label(l), points: pts(l) };
  }
})();
