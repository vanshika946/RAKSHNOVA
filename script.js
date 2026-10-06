/* ==========================================================
   RakshNova – AI Disaster Intelligence & Emergency Response
   Frontend-only prototype. Every number, alert and location is
   SIMULATED in the browser. It is not real emergency data.
   ========================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     Helpers
  --------------------------------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const rand = (a, b) => Math.random() * (b - a) + a;
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function hash01(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10000) / 10000;
  }
  const fmtNum = (n) => Math.round(n).toLocaleString('en-IN');
  function fmtCompact(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(Math.round(n));
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }
  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
  function setNum(el, value, formatter) {
    if (!el) return;
    const fmt = formatter || ((v) => String(Math.round(v)));
    const from = parseFloat(el.dataset.v || '0') || 0;
    el.dataset.v = String(value);
    cancelAnimationFrame(el._raf);
    if (reduceMotion || from === value) {
      el.textContent = fmt(value);
      return;
    }
    const start = performance.now();
    const dur = 650;
    const step = (t) => {
      const p = clamp((t - start) / dur, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (value - from) * e);
      if (p < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------
     Static simulation data
  --------------------------------------------------------- */
  const TYPES = ['flood', 'earthquake', 'fire', 'weather'];
  const SEVERITY = ['Minor', 'Moderate', 'Major', 'Severe', 'Extreme'];
  const DENSITY = ['Low', 'Medium', 'High', 'Very High'];

  const ICON_PATHS = {
    flood: '<path d="M12 2.5c2.6 3 4.2 5.2 4.2 7.2a4.2 4.2 0 0 1-8.4 0c0-2 1.6-4.2 4.2-7.2z"/><path d="M2 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M2 21.5c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>',
    earthquake: '<path d="M2 12h4l2.5-6 4 12 3-9 2 3H22"/>',
    fire: '<path d="M12 2c1 4-3 6-3 10a3 3 0 0 0 6 0c0-1-.5-2-1-3 3 2 5 5 5 8a7 7 0 0 1-14 0c0-6 5-8 7-15z"/>',
    weather: '<path d="M7 17a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 9.5 3.8 3.8 0 0 1 18 17z"/><path d="M12 10.5 10 15h3l-2 4.5"/>'
  };
  function icon(type, size) {
    const s = size || 22;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_PATHS[type] + '</svg>';
  }

  const DISASTERS = {
    flood: { label: 'Flood' },
    earthquake: { label: 'Earthquake' },
    fire: { label: 'Fire' },
    weather: { label: 'Extreme Weather' }
  };

  const LEVEL_META = {
    Low:      { cls: 'lv-low',      rank: 0, priority: 'P4', name: 'Routine',   window: 'Review within 24 h',  status: 'Normal monitoring', alert: 'No active alert',          items: 2 },
    Moderate: { cls: 'lv-moderate', rank: 1, priority: 'P3', name: 'Elevated',  window: 'Prepare within 12 h', status: 'Elevated watch',    alert: 'Watch in effect',          items: 4 },
    High:     { cls: 'lv-high',     rank: 2, priority: 'P2', name: 'Urgent',    window: 'Mobilise within 3 h', status: 'High alert',        alert: 'Warning issued',           items: 5 },
    Critical: { cls: 'lv-critical', rank: 3, priority: 'P1', name: 'Immediate', window: 'Act within 30 min',   status: 'Critical alert',    alert: 'EMERGENCY WARNING active', items: 6 }
  };
  const LEVEL_NAMES = ['Low', 'Moderate', 'High', 'Critical'];
  const levelFor = (score) => (score < 30 ? 'Low' : score < 55 ? 'Moderate' : score < 78 ? 'High' : 'Critical');
  const ALL_LV_CLASSES = ['lv-low', 'lv-moderate', 'lv-high', 'lv-critical'];
  function setLevelClass(el, level) {
    if (!el) return;
    ALL_LV_CLASSES.forEach((c) => el.classList.remove(c));
    el.classList.add(LEVEL_META[level].cls);
  }

  /* Fictional regions: vulnerability is 0..1 per hazard */
  const REGIONS = {
    riverbend:  { name: 'Riverbend Delta',          pop: 1200000, density: 4, vuln: { flood: 0.90, earthquake: 0.30, fire: 0.15, weather: 0.60 }, sites: { open: 'Meridian Sports Ground',  elevated: 'Highfield Community College', shelter: 'Riverbend Civic Hall' } },
    kestrel:    { name: 'Kestrel Bay Coast',        pop: 640000,  density: 3, vuln: { flood: 0.60, earthquake: 0.25, fire: 0.20, weather: 0.90 }, sites: { open: 'Kestrel Heights Park',    elevated: 'Cliffside Arena',             shelter: 'Bayview Reinforced Shelter' } },
    ashridge:   { name: 'Ashridge Foothills',       pop: 210000,  density: 2, vuln: { flood: 0.25, earthquake: 0.45, fire: 0.90, weather: 0.35 }, sites: { open: 'Ashridge Valley Fairground', elevated: 'Cedar Ridge School',       shelter: 'Foothill Relief Centre' } },
    northmoor:  { name: 'Northmoor Highlands',      pop: 130000,  density: 1, vuln: { flood: 0.30, earthquake: 0.85, fire: 0.40, weather: 0.50 }, sites: { open: 'Northmoor Parade Ground', elevated: 'Highmoor Plateau Camp',       shelter: 'Moorgate Town Hall' } },
    sunspire:   { name: 'Sunspire Metro',           pop: 3400000, density: 4, vuln: { flood: 0.45, earthquake: 0.70, fire: 0.35, weather: 0.50 }, sites: { open: 'Sunspire Central Park',   elevated: 'Skyline Stadium',             shelter: 'Metro Convention Centre' } },
    veldt:      { name: 'Veldt Plains',             pop: 90000,   density: 1, vuln: { flood: 0.50, earthquake: 0.15, fire: 0.60, weather: 0.70 }, sites: { open: 'Veldt Open Airfield',     elevated: 'Greenbank Mesa Camp',         shelter: 'Veldt District Hospital Annex' } },
    harborline: { name: 'Harborline Port District', pop: 880000,  density: 3, vuln: { flood: 0.70, earthquake: 0.50, fire: 0.45, weather: 0.80 }, sites: { open: 'Harborline Terminal Lot', elevated: 'Lighthouse Hill School',      shelter: 'Port Authority Storm Shelter' } },
    greywater:  { name: 'Greywater Basin',          pop: 450000,  density: 2, vuln: { flood: 0.85, earthquake: 0.20, fire: 0.10, weather: 0.50 }, sites: { open: 'Greywater Fairgrounds',   elevated: 'Stonebridge High School',     shelter: 'Basin Relief Centre' } }
  };

  /* Fictional high-risk zones (x,y are % positions on the map) */
  const ZONE_DEFS = [
    { id: 'z1',  name: 'Delta Lowlands',          region: 'riverbend',  type: 'flood',      base: 88, pop: 184000, area: 140, x: 24, y: 64 },
    { id: 'z2',  name: 'Kestrel Seafront',        region: 'kestrel',    type: 'weather',    base: 76, pop: 96000,  area: 85,  x: 12, y: 32 },
    { id: 'z3',  name: 'Ashridge Pine Belt',      region: 'ashridge',   type: 'fire',       base: 74, pop: 41000,  area: 310, x: 44, y: 22 },
    { id: 'z4',  name: 'Northmoor Fault Corridor', region: 'northmoor', type: 'earthquake', base: 52, pop: 58000,  area: 220, x: 70, y: 14 },
    { id: 'z5',  name: 'Sunspire Central Grid',   region: 'sunspire',   type: 'earthquake', base: 41, pop: 420000, area: 95,  x: 62, y: 50 },
    { id: 'z6',  name: 'Greywater Floodplain',    region: 'greywater',  type: 'flood',      base: 69, pop: 73000,  area: 190, x: 40, y: 78 },
    { id: 'z7',  name: 'Harborline Docks',        region: 'harborline', type: 'weather',    base: 49, pop: 120000, area: 60,  x: 86, y: 74 },
    { id: 'z8',  name: 'Veldt Grasslands',        region: 'veldt',      type: 'fire',       base: 42, pop: 18000,  area: 400, x: 80, y: 38 },
    { id: 'z9',  name: 'Sunspire Riverside',      region: 'sunspire',   type: 'flood',      base: 52, pop: 150000, area: 70,  x: 56, y: 66 },
    { id: 'z10', name: 'Harborline Storage Yards', region: 'harborline', type: 'fire',      base: 28, pop: 22000,  area: 30,  x: 91, y: 56 }
  ];

  const SEED_ALERT_ZONES = [
    { id: 'z1', mins: 3 }, { id: 'z2', mins: 8 }, { id: 'z3', mins: 15 },
    { id: 'z6', mins: 26 }, { id: 'z4', mins: 41 }, { id: 'z9', mins: 57 }
  ];

  const ACTIONS = {
    flood: {
      Low: 'Monitor river gauges and drainage; no action beyond routine readiness checks.',
      Moderate: 'Issue a flood watch, clear storm drains and pre-position pumps and sandbags at known choke points.',
      High: 'Issue a flood warning, close low-lying underpasses, deploy pumps and boats, and begin phased evacuation of riverside blocks.',
      Critical: 'Trigger a flood emergency: mandatory evacuation of low-lying areas, close embankment roads, launch rescue boats and open all relief shelters now.'
    },
    earthquake: {
      Low: 'Continue routine seismic monitoring; confirm building-safety drills and utility shut-off knowledge.',
      Moderate: 'Raise a seismic watch; inspect critical infrastructure and brief hospitals and schools on drop-cover-hold.',
      High: 'Place search-and-rescue teams on standby, isolate gas to vulnerable grids and pre-clear ambulance corridors.',
      Critical: 'Declare a seismic emergency: deploy urban search-and-rescue, evacuate unsafe structures, cut gas and power to damaged grids and open field hospitals.'
    },
    fire: {
      Low: 'Maintain fire-weather monitoring and keep firebreaks and water sources inspected.',
      Moderate: 'Issue a fire-weather watch, restrict open burning and pre-position crews near the forest interface.',
      High: 'Issue a fire warning, stage crews and aerial support, and prepare downwind communities to evacuate.',
      Critical: 'Declare a fire emergency: evacuate interface and downwind communities, close roads near the perimeter and commit all crews and aerial units.'
    },
    weather: {
      Low: 'Track forecast updates; no action beyond routine readiness and public information.',
      Moderate: 'Issue a weather advisory, secure loose structures and place power-restoration crews on notice.',
      High: 'Issue a severe-weather warning, suspend vulnerable transport, open storm shelters and relocate people from exposed areas.',
      Critical: 'Declare a severe-weather emergency: relocate coastal and exposed residents now, shut down transport and activate shelters and generators.'
    }
  };

  const INSIGHTS = {
    flood: {
      Low: 'River gauges are nominal and drainage is absorbing current rainfall with spare capacity.',
      Moderate: 'Soil saturation is building near {z}; gauge levels are worth watching over the next 6 hours.',
      High: 'Rapid gauge rise projected near {z}; low-lying wards face inundation within hours.',
      Critical: 'Embankment overtopping is likely near {z}; the model projects inundation of low-lying wards imminently.'
    },
    earthquake: {
      Low: 'Seismic sensors show background activity only, with no unusual strain signals.',
      Moderate: 'Minor tremor clustering near {z}; exposure is driven mainly by older building stock. Earthquakes cannot be predicted.',
      High: 'Elevated exposure along {z}; dense, older structures are the most vulnerable if an event occurs.',
      Critical: 'Scenario assumes a strong earthquake near {z}; widespread structural damage and casualties are likely.'
    },
    fire: {
      Low: 'Fuel moisture is adequate and winds are light; ignition risk remains low.',
      Moderate: 'Vegetation is drying near {z}; red-flag conditions are possible if winds strengthen.',
      High: 'Hot, dry, gusty conditions near {z}; fire fronts could spread quickly toward settlements.',
      Critical: 'Active fire front near {z} with wind-driven spotting; interface communities need to leave now.'
    },
    weather: {
      Low: 'Atmospheric conditions are stable, with only isolated showers expected.',
      Moderate: 'Storm cells are developing; {z} may see heavy rain and gusty winds.',
      High: 'A severe storm band is tracking toward {z}; damaging winds and flash flooding are likely.',
      Critical: 'Extreme storm landfall is expected at {z}; destructive winds, surge and widespread outages are projected.'
    }
  };

  const NARRATIVE = {
    flood: 'Floodwater behaviour is driven by terrain, drainage and upstream rainfall; low-lying wards and underpasses are cut off first.',
    earthquake: 'Earthquakes cannot be predicted, so this score reflects exposure, building vulnerability and readiness rather than a forecast.',
    fire: 'Fire spread depends on fuel dryness, wind and slope; smoke can affect communities well beyond the fire perimeter.',
    weather: 'Extreme-weather impact scales with wind, rain and surge; power loss and blocked roads are the most common cascading failures.'
  };

  const FACTOR_SETS = {
    flood: [
      ['River & drainage proximity', 'Low-lying terrain close to rivers and drainage channels'],
      ['Soil saturation & runoff', 'Ground can absorb little additional rainfall']
    ],
    earthquake: [
      ['Fault-line proximity', 'Distance to mapped fault segments and past activity'],
      ['Structural vulnerability', 'Share of older or unreinforced buildings']
    ],
    fire: [
      ['Vegetation dryness', 'Dry fuel load raises ignition and spread rates'],
      ['Wind-driven spread', 'Wind and slope can accelerate the fire front']
    ],
    weather: [
      ['Storm intensity band', 'Wind and rainfall intensity of the incoming system'],
      ['Coastal & open exposure', 'Exposure to surge, gusts and flying debris']
    ]
  };

  const EXPOSED = {
    flood: 'low-lying and riverside blocks',
    earthquake: 'damaged and unreinforced buildings',
    fire: 'wildland-interface and downwind neighbourhoods',
    weather: 'coastal, exposed and temporary-housing areas'
  };
  const ROUTE = {
    flood: 'Use elevated routes and avoid underpasses, causeways and low bridges.',
    earthquake: 'Avoid damaged buildings, bridges and overhead lines; expect aftershocks.',
    fire: 'Travel away from the fire front and across the wind direction; keep headlights on in smoke.',
    weather: 'Move early before winds peak; avoid coastal roads and downed power lines.'
  };
  const SITE_KEY = { flood: 'elevated', earthquake: 'open', fire: 'open', weather: 'shelter' };
  const SITE_KIND = { elevated: 'Elevated assembly point', open: 'Open-ground assembly point', shelter: 'Reinforced shelter' };

  const CONTACTS = [
    { name: 'National Emergency Response', num: '112',  note: 'Police · Fire · Ambulance',    primary: ['flood', 'earthquake', 'fire', 'weather'] },
    { name: 'Fire & Rescue Service',       num: '101',  note: 'Fire and rescue of trapped persons', primary: ['fire'] },
    { name: 'Emergency Ambulance',         num: '108',  note: 'Medical emergencies and casualties', primary: ['earthquake', 'fire'] },
    { name: 'Disaster Management Helpline', num: '1078', note: 'District disaster control room', primary: ['flood', 'weather', 'earthquake'] }
  ];

  const CHECKLISTS = {
    flood: [
      'Confirm river-gauge and rainfall readings with the district control room',
      'Deploy pumps, sandbags and rescue boats to low-lying wards',
      'Close flooded underpasses and embankment roads',
      'Open relief shelters and stage food, water and medical kits',
      'Alert hospitals and utilities (substations, water plants)',
      'Broadcast multilingual evacuation advisories'
    ],
    earthquake: [
      'Activate urban search-and-rescue teams',
      'Shut off gas supply and isolate damaged power grids',
      'Inspect bridges, hospitals and schools for structural safety',
      'Set up open-ground assembly points and field triage',
      'Clear ambulance corridors and restrict non-essential traffic',
      'Broadcast aftershock safety guidance'
    ],
    fire: [
      'Dispatch fire crews and aerial support to the fire front',
      'Establish firebreaks and protect critical infrastructure',
      'Evacuate wildland-interface and downwind communities',
      'Close roads and rail lines near the fire perimeter',
      'Issue a smoke and air-quality health advisory',
      'Stage water tankers and medical units at a safe staging area'
    ],
    weather: [
      'Secure coastal, port and loose infrastructure',
      'Suspend sea, rail and air operations as needed',
      'Pre-position tree-clearing and power restoration crews',
      'Open storm shelters and verify backup generators',
      'Send wind, rain and lightning advisories by SMS',
      'Move vulnerable residents to reinforced shelters'
    ]
  };

  /* ---------------------------------------------------------
     State
  --------------------------------------------------------- */
  const state = {
    zones: [],
    alerts: [],
    alertSeq: 0,
    selectedZoneId: null,
    analysis: null,
    context: null,
    filter: 'all',
    checklist: {},
    dismissedBanner: null,
    tickCount: 0,
    analysisToken: 0,
    briefToken: 0,
    briefTimer: null,
    markers: {},
    areas: {},
    newAlertId: null
  };

  const getZone = (id) => state.zones.find((z) => z.id === id);
  const popAffected = (z) => Math.round((z.pop * Math.pow(z.score / 100, 1.3)) / 100) * 100;

  /* ---------------------------------------------------------
     Simulated risk model
  --------------------------------------------------------- */
  function vulnWord(v) {
    return v >= 0.75 ? 'very high' : v >= 0.5 ? 'elevated' : v >= 0.3 ? 'moderate' : 'low';
  }

  function computeScore(type, regionId, sev, dens) {
    const v = REGIONS[regionId].vuln[type];
    const base = 0.40 * v + 0.35 * (sev / 5) + 0.25 * (dens / 4);
    let score = Math.round(base * 100 + rand(-3, 3));
    if (v > 0.7 && sev >= 4) score += 4;
    return clamp(score, 3, 99);
  }

  function computeFactors(type, regionId, sev, dens) {
    const region = REGIONS[regionId];
    const v = region.vuln[type];
    const h = hash01(regionId + type);
    const set = FACTOR_SETS[type];
    const list = [
      { label: 'Location hazard exposure', impact: v * 100, note: region.name + ' has ' + vulnWord(v) + ' baseline exposure to ' + DISASTERS[type].label.toLowerCase() + ' events' },
      { label: 'Incident severity', impact: (sev / 5) * 100, note: SEVERITY[sev - 1] + ' scenario intensity selected' },
      { label: 'Population density', impact: (dens / 4) * 100, note: DENSITY[dens - 1] + '-density area increases the number of people exposed' },
      { label: set[0][0], impact: clamp(v * 100 * (0.88 + h * 0.24), 8, 99), note: set[0][1] },
      { label: set[1][0], impact: clamp(v * 100 * (1.04 - h * 0.26), 8, 99), note: set[1][1] },
      { label: 'Evacuation difficulty', impact: (dens / 4 * 0.55 + v * 0.45) * 100, note: 'Road capacity and crowd volume slow clearance' }
    ];
    list.forEach((f) => { f.impact = Math.round(clamp(f.impact, 5, 99)); });
    list.sort((a, b) => b.impact - a.impact);
    return list.slice(0, 5);
  }

  function estimatePop(regionId, score, sev) {
    const frac = Math.pow(score / 100, 2) * 0.35 * (0.6 + (sev / 5) * 0.4);
    return Math.max(500, Math.round((REGIONS[regionId].pop * frac) / 500) * 500);
  }

  function makeContext(o) {
    return Object.assign({}, o, { level: levelFor(o.score) });
  }

  function contextFromZone(z) {
    const r = REGIONS[z.region];
    return makeContext({
      source: 'zone', zoneId: z.id, type: z.type, regionId: z.region,
      locationName: z.name + ' (' + r.name + ')',
      score: z.score, sev: clamp(Math.ceil(z.score / 20), 1, 5), dens: r.density, pop: popAffected(z)
    });
  }

  /* ---------------------------------------------------------
     Initial / reset data
  --------------------------------------------------------- */
  function seedZones() {
    state.zones = ZONE_DEFS.map((d) => Object.assign({}, d, { score: clamp(d.base + randInt(-3, 3), 5, 99) }));
  }

  function alertTitle(level) {
    return level === 'Critical' ? 'Emergency Warning' : level === 'High' ? 'Warning' : 'Watch';
  }

  function makeZoneAlert(z, minsAgo) {
    const level = levelFor(z.score);
    const ctx = contextFromZone(z);
    return {
      id: ++state.alertSeq, type: z.type, regionId: z.region, zoneId: z.id,
      locationName: z.name, level: level, sev: ctx.sev,
      time: Date.now() - minsAgo * 60000, action: ACTIONS[z.type][level], source: 'Zone monitor'
    };
  }

  function seedAlerts() {
    state.alertSeq = 0;
    state.alerts = SEED_ALERT_ZONES.map((s) => makeZoneAlert(getZone(s.id), s.mins));
  }

  /* ---------------------------------------------------------
     Aggregates
  --------------------------------------------------------- */
  function typeSummary(type) {
    const zs = state.zones.filter((z) => z.type === type);
    const max = Math.max.apply(null, zs.map((z) => z.score));
    const avg = zs.reduce((a, z) => a + z.score, 0) / zs.length;
    const score = Math.round(0.6 * max + 0.4 * avg);
    const baseMax = Math.max.apply(null, zs.map((z) => z.base));
    const baseAvg = zs.reduce((a, z) => a + z.base, 0) / zs.length;
    const baseScore = Math.round(0.6 * baseMax + 0.4 * baseAvg);
    const top = zs.reduce((a, b) => (b.score > a.score ? b : a));
    const flagged = zs.filter((z) => z.score >= 30);
    return {
      score: score, level: levelFor(score), top: top,
      delta: score - baseScore, count: flagged.length,
      area: flagged.reduce((a, z) => a + z.area, 0)
    };
  }

  function overallIndex() {
    const scores = state.zones.map((z) => z.score);
    const max = Math.max.apply(null, scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(0.6 * max + 0.4 * avg);
  }

  function highestAlertLevel() {
    let best = null;
    state.alerts.forEach((a) => {
      if (!best || LEVEL_META[a.level].rank > LEVEL_META[best].rank) best = a.level;
    });
    return best;
  }

  /* ---------------------------------------------------------
     Header status, banner, stats
  --------------------------------------------------------- */
  function renderStatus() {
    const lvl = highestAlertLevel() || 'Low';
    const pill = $('#statusPill');
    setLevelClass(pill, lvl);
    $('#statusText').textContent = LEVEL_META[lvl].status;
  }

  function renderBanner() {
    const banner = $('#criticalBanner');
    const crit = state.alerts
      .filter((a) => a.level === 'Critical')
      .sort((a, b) => b.time - a.time)[0];
    if (!crit || state.dismissedBanner === crit.id) {
      banner.hidden = true;
      banner.dataset.alertId = '';
      return;
    }
    banner.hidden = false;
    banner.dataset.alertId = String(crit.id);
    $('#bannerTitle').textContent = 'CRITICAL ' + DISASTERS[crit.type].label.toUpperCase() + ' RISK — ' + crit.locationName;
    $('#bannerText').textContent = crit.action + ' (Simulated alert — prototype only)';
  }

  function renderStats() {
    const idx = overallIndex();
    const lvl = levelFor(idx);
    const m = LEVEL_META[lvl];

    const riskCard = $('#statRiskCard');
    setLevelClass(riskCard, lvl);
    setNum($('#statRisk'), idx);
    $('#statRiskSub').textContent = lvl + ' · region-wide composite';
    $('#statRiskBar').style.width = idx + '%';
    $('#statRiskBar').parentElement.className = 'bar ' + m.cls;

    const affected = state.zones.filter((z) => z.score >= 50).reduce((a, z) => a + popAffected(z), 0);
    setNum($('#statPeople'), affected, fmtCompact);
    $('#statPeopleSub').textContent = 'Estimated, zones scoring 50+';

    const crit = state.alerts.filter((a) => a.level === 'Critical').length;
    const high = state.alerts.filter((a) => a.level === 'High').length;
    setNum($('#statAlerts'), state.alerts.length);
    $('#statAlertsSub').textContent = crit + ' critical · ' + high + ' high';

    const hz = state.zones.filter((z) => z.score >= 55).length;
    setNum($('#statZones'), hz);
    $('#statZonesSub').textContent = 'of ' + state.zones.length + ' monitored zones';

    const top = highestAlertLevel() || 'Low';
    const pm = LEVEL_META[top];
    const prCard = $('#statPriorityCard');
    setLevelClass(prCard, top);
    $('#statPriority').textContent = pm.priority + ' · ' + pm.name;
    $('#statPrioritySub').textContent = pm.window;
  }

  /* ---------------------------------------------------------
     Overview cards
  --------------------------------------------------------- */
  function buildOverview() {
    const grid = $('#overviewGrid');
    grid.innerHTML = '';
    TYPES.forEach((t) => {
      const el = document.createElement('article');
      el.className = 'ov-card';
      el.dataset.type = t;
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', DISASTERS[t].label + ' overview. Activate to analyse this disaster type.');
      el.innerHTML =
        '<div class="ov-top"><span class="ov-icon">' + icon(t, 24) + '</span>' +
        '<div><h3>' + DISASTERS[t].label + '</h3><span class="ov-trend" data-f="trend"></span></div>' +
        '<span class="badge" data-f="level"></span></div>' +
        '<div class="ov-score"><b data-f="score">0</b><span>/100 risk index</span><span class="bar"><i data-f="bar"></i></span></div>' +
        '<dl class="ov-meta"><div><dt>Affected area</dt><dd data-f="area"></dd></div>' +
        '<div><dt>Alert status</dt><dd data-f="alert"></dd></div></dl>' +
        '<p class="ov-insight"><span class="ai-tag">AI insight</span><span data-f="insight"></span></p>';
      const activate = () => {
        $('#disasterType').value = t;
        toast(DISASTERS[t].label + ' loaded into the risk analysis');
        scrollToId('analysis');
      };
      el.addEventListener('click', activate);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
      grid.appendChild(el);
    });
    updateOverview();
  }

  function updateOverview() {
    $$('.ov-card').forEach((el) => {
      const t = el.dataset.type;
      const s = typeSummary(t);
      const m = LEVEL_META[s.level];
      setLevelClass(el, s.level);
      const f = (n) => $('[data-f="' + n + '"]', el);
      f('level').textContent = s.level;
      setNum(f('score'), s.score);
      f('bar').style.width = s.score + '%';
      const tr = f('trend');
      tr.textContent = (s.delta > 0 ? '▲ +' : s.delta < 0 ? '▼ ' : '▬ ') + s.delta + ' vs. baseline';
      tr.className = 'ov-trend ' + (s.delta > 0 ? 'up' : s.delta < 0 ? 'down' : '');
      f('area').textContent = s.count ? s.count + (s.count > 1 ? ' zones' : ' zone') + ' · ' + fmtNum(s.area) + ' km²' : 'None flagged';
      f('alert').textContent = m.alert;
      f('insight').textContent = INSIGHTS[t][s.level].replace('{z}', s.top.name);
    });
  }

  /* ---------------------------------------------------------
     Alerts
  --------------------------------------------------------- */
  function relTime(ts) {
    const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    const h = Math.floor(mins / 60);
    return h + ' h ' + (mins % 60) + ' min ago';
  }
  function clockTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderAlerts() {
    const list = $('#alertList');
    $('#alertCount').textContent = String(state.alerts.length);
    if (!state.alerts.length) {
      list.innerHTML = '<div class="alert-empty">No active simulated alerts. Run a risk analysis or wait for the simulated feed to generate new ones.</div>';
      return;
    }
    const sorted = state.alerts.slice().sort((a, b) => {
      const r = LEVEL_META[b.level].rank - LEVEL_META[a.level].rank;
      return r !== 0 ? r : b.time - a.time;
    });
    list.innerHTML = sorted.map((a) => {
      const m = LEVEL_META[a.level];
      return '<article class="alert-card ' + m.cls + (a.id === state.newAlertId ? ' is-new' : '') + '" data-id="' + a.id + '">' +
        '<div class="alert-ico">' + icon(a.type, 24) + '</div>' +
        '<div class="alert-main">' +
          '<div class="alert-head"><h3>' + DISASTERS[a.type].label + ' ' + alertTitle(a.level) + '</h3>' +
          '<span class="badge">' + a.level + '</span>' +
          '<button type="button" class="alert-dismiss" data-act="dismiss" aria-label="Dismiss this alert">×</button></div>' +
          '<div class="alert-meta">' +
            '<span>Location <b>' + a.locationName + '</b></span>' +
            '<span>Severity <b>' + SEVERITY[a.sev - 1] + '</b></span>' +
            '<span>Time <b data-ts="' + a.time + '">' + clockTime(a.time) + ' · ' + relTime(a.time) + '</b></span>' +
          '</div>' +
          '<p class="alert-action"><b>Recommended action</b>' + a.action + '</p>' +
          '<div class="alert-buttons">' +
            '<button type="button" class="btn btn-sm" data-act="plan">Open response plan</button>' +
            (a.zoneId ? '<button type="button" class="btn btn-ghost btn-sm" data-act="map">Show on map</button>' : '') +
          '</div>' +
          '<small class="muted">Source: ' + a.source + ' · simulated</small>' +
        '</div></article>';
    }).join('');
  }

  function refreshTimes() {
    $$('[data-ts]').forEach((el) => {
      const ts = Number(el.dataset.ts);
      el.textContent = clockTime(ts) + ' · ' + relTime(ts);
    });
  }

  function trimAlerts() {
    while (state.alerts.length > 8) {
      let oldest = 0;
      state.alerts.forEach((a, i) => { if (a.time < state.alerts[oldest].time) oldest = i; });
      state.alerts.splice(oldest, 1);
    }
  }

  function afterAlertsChanged() {
    trimAlerts();
    renderAlerts();
    renderBanner();
    renderStatus();
    renderStats();
  }

  function addZoneAlert() {
    const pool = state.zones.filter((z) => z.score >= 30 && !state.alerts.some((a) => a.zoneId === z.id));
    if (!pool.length) return;
    const weights = pool.map((z) => z.score * z.score);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let pick = pool[0];
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) { pick = pool[i]; break; }
    }
    const alert = makeZoneAlert(pick, 0);
    state.alerts.push(alert);
    state.newAlertId = alert.id;
    afterAlertsChanged();
    setTimeout(() => { if (state.newAlertId === alert.id) { state.newAlertId = null; renderAlerts(); } }, 6000);
  }

  function contextFromAlert(a) {
    if (a.ctx) return a.ctx;
    const z = getZone(a.zoneId);
    return z ? contextFromZone(z) : null;
  }

  /* ---------------------------------------------------------
     Map
  --------------------------------------------------------- */
  function buildMap() {
    const layer = $('#mapLayer');
    layer.innerHTML = '';
    state.markers = {};
    state.areas = {};
    state.zones.forEach((z) => {
      const r = clamp(Math.sqrt(z.area) / 2.6, 3.2, 11);
      const area = document.createElement('div');
      area.className = 'zone-area';
      area.style.left = z.x + '%';
      area.style.top = z.y + '%';
      area.style.width = (r * 2) + '%';
      layer.appendChild(area);
      state.areas[z.id] = area;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'zone-marker';
      btn.style.left = z.x + '%';
      btn.style.top = z.y + '%';
      btn.dataset.id = z.id;
      btn.innerHTML = '<span class="dot">' + icon(z.type, 16) + '</span><span class="zone-tag">' + z.name + '<em data-f="s"></em></span>';
      btn.addEventListener('click', () => selectZone(z.id, true));
      layer.appendChild(btn);
      state.markers[z.id] = btn;
    });
    updateMap();
  }

  function updateMap() {
    state.zones.forEach((z) => {
      const lvl = levelFor(z.score);
      const m = LEVEL_META[lvl];
      const btn = state.markers[z.id];
      const area = state.areas[z.id];
      if (!btn) return;
      const dim = state.filter !== 'all' && state.filter !== z.type;
      btn.className = 'zone-marker ' + m.cls + (z.id === state.selectedZoneId ? ' selected' : '') + (dim ? ' dim' : '');
      area.className = 'zone-area ' + m.cls + (dim ? ' dim' : '');
      btn.querySelector('[data-f="s"]').textContent = String(z.score);
      btn.setAttribute('aria-label', z.name + ', ' + DISASTERS[z.type].label + ', ' + lvl + ' risk, score ' + z.score + ' out of 100');
      btn.setAttribute('aria-pressed', z.id === state.selectedZoneId ? 'true' : 'false');
    });
  }

  function selectZone(id, announce) {
    const z = getZone(id);
    if (!z) return;
    state.selectedZoneId = id;
    updateMap();
    renderZoneDetail();
    setContext(contextFromZone(z));
    if (announce) toast('Response plan and briefing updated for ' + z.name);
  }

  function renderZoneDetail() {
    const box = $('#zoneDetail');
    const z = getZone(state.selectedZoneId);
    if (!z) {
      box.className = 'panel zone-detail';
      box.innerHTML = '<div class="zd-empty"><b>No zone selected</b><p>Choose a marker on the map to see its risk details.</p></div>';
      return;
    }
    const lvl = levelFor(z.score);
    const m = LEVEL_META[lvl];
    const r = REGIONS[z.region];
    box.className = 'panel zone-detail ' + m.cls;
    box.innerHTML =
      '<div class="zd-head"><div class="alert-ico">' + icon(z.type, 24) + '</div>' +
      '<div><h3>' + z.name + '</h3><p>' + r.name + ' · fictional zone</p></div>' +
      '<span class="badge" id="zdBadge">' + lvl + '</span></div>' +
      '<dl class="zd-rows">' +
        '<div class="zd-row"><dt>Location</dt><dd>' + z.name + ', ' + r.name + '</dd></div>' +
        '<div class="zd-row"><dt>Disaster type</dt><dd>' + DISASTERS[z.type].label + '</dd></div>' +
        '<div class="zd-row"><dt>Risk score</dt><dd><div class="zd-score"><b id="zdScore">' + z.score + '</b><span class="bar"><i id="zdBar" style="width:' + z.score + '%"></i></span></div></dd></div>' +
        '<div class="zd-row"><dt>Population affected</dt><dd><b id="zdPop">' + fmtNum(popAffected(z)) + '</b> <span class="muted">of ' + fmtNum(z.pop) + ' residents (est.)</span></dd></div>' +
        '<div class="zd-row"><dt>Recommended response</dt><dd id="zdAction">' + ACTIONS[z.type][lvl] + '</dd></div>' +
      '</dl>' +
      '<div class="zd-actions">' +
        '<button type="button" class="btn btn-sm" data-act="zone-analyze">Analyze this zone</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="zone-plan">Open response plan</button>' +
      '</div>';
  }

  function updateZoneDetailLive() {
    const z = getZone(state.selectedZoneId);
    if (!z) return;
    const lvl = levelFor(z.score);
    const box = $('#zoneDetail');
    if (!box.classList.contains(LEVEL_META[lvl].cls)) { renderZoneDetail(); return; }
    const s = $('#zdScore');
    if (s) {
      s.textContent = String(z.score);
      $('#zdBar').style.width = z.score + '%';
      $('#zdPop').textContent = fmtNum(popAffected(z));
    }
  }

  /* ---------------------------------------------------------
     Context → response panel + briefing
  --------------------------------------------------------- */
  function setContext(ctx) {
    state.context = ctx;
    renderResponse();
    renderBriefing();
  }

  function planKey(ctx) {
    return ctx.type + ':' + ctx.regionId + ':' + (ctx.zoneId || 'analysis');
  }

  function evacText(ctx) {
    const e = EXPOSED[ctx.type];
    switch (ctx.level) {
      case 'Critical':
        return 'Mandatory evacuation of ' + e + ' in ' + ctx.locationName + ' within 60 minutes. Move hospitals, care homes and schools first.';
      case 'High':
        return 'Advise phased evacuation of ' + e + ' in ' + ctx.locationName + ' within 3–6 hours, starting with vulnerable residents.';
      case 'Moderate':
        return 'No evacuation yet. Ask residents of ' + e + ' to prepare go-bags, charge phones and know their route.';
      default:
        return 'No evacuation required. Keep monitoring and review household and community evacuation plans.';
    }
  }

  function safeZone(ctx) {
    const region = REGIONS[ctx.regionId];
    const key = SITE_KEY[ctx.type];
    const name = region.sites[key];
    const h = hash01(name + ctx.type);
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const km = (2 + h * 9).toFixed(1);
    const capacity = Math.round((800 + h * 5200) / 100) * 100;
    const dir = dirs[Math.floor(hash01(name) * 8)];
    const status = ctx.level === 'Critical' ? 'Activate now' : ctx.level === 'High' ? 'Open & staffed' : 'On standby';
    return { name: name, kind: SITE_KIND[key], km: km, dir: dir, capacity: capacity, status: status };
  }

  function renderResponse() {
    const ctx = state.context;
    if (!ctx) return;
    const m = LEVEL_META[ctx.level];
    const root = $('#responseRoot');
    setLevelClass(root, ctx.level);

    $('#responseContext').innerHTML =
      '<div class="alert-ico">' + icon(ctx.type, 22) + '</div>' +
      '<div class="rc-text"><b>' + DISASTERS[ctx.type].label + ' · ' + ctx.locationName + '</b>' +
      '<small>Plan source: ' + (ctx.source === 'analysis' ? 'your risk analysis' : ctx.source === 'zone' ? 'selected zone' : 'alert') + ' · simulated</small></div>' +
      '<span class="badge">' + ctx.level + ' · ' + ctx.score + '%</span>';

    $('#respPriority').innerHTML =
      '<span class="priority-code">' + m.priority + '</span>' +
      '<div class="priority-copy"><b>' + m.name + ' priority</b><small>' + m.window + '</small></div>';

    $('#respEvac').innerHTML =
      '<p class="r-main">' + evacText(ctx) + '</p>' +
      '<div class="r-sub"><span class="tag status">' + (ctx.level === 'Critical' ? 'Mandatory' : ctx.level === 'High' ? 'Advised' : ctx.level === 'Moderate' ? 'Prepare' : 'Not required') + '</span>' +
      '<span class="tag">People exposed <b>' + fmtNum(ctx.pop) + '</b></span></div>' +
      '<p class="fine">' + ROUTE[ctx.type] + '</p>';

    const sz = safeZone(ctx);
    $('#respSafe').innerHTML =
      '<p class="r-main"><b>' + sz.name + '</b></p>' +
      '<p class="muted">' + sz.kind + ' · ' + sz.km + ' km ' + sz.dir + ' of the affected area</p>' +
      '<div class="r-sub"><span class="tag status">' + sz.status + '</span><span class="tag">Capacity <b>~' + fmtNum(sz.capacity) + '</b></span>' +
      '<span class="tag">Site type <b>' + cap(SITE_KEY[ctx.type]) + '</b></span></div>' +
      '<p class="fine">Capacity and distance are simulated values for the prototype.</p>';

    $('#respContacts').innerHTML = CONTACTS.map((c) => {
      const primary = c.primary.indexOf(ctx.type) !== -1;
      return '<li><a href="tel:' + c.num + '"><span class="c-num">' + c.num + '</span>' +
        '<span class="c-copy"><b>' + c.name + '</b><small>' + c.note + '</small></span>' +
        (primary ? '<em>Primary</em>' : '') + '</a></li>';
    }).join('');

    renderChecklist();
  }

  function renderChecklist() {
    const ctx = state.context;
    if (!ctx) return;
    const key = planKey(ctx);
    const count = LEVEL_META[ctx.level].items;
    if (!state.checklist[key]) state.checklist[key] = new Array(6).fill(false);
    const done = state.checklist[key];
    const items = CHECKLISTS[ctx.type].slice(0, count);
    $('#respChecklist').innerHTML = items.map((t, i) =>
      '<li><label><input type="checkbox" data-i="' + i + '"' + (done[i] ? ' checked' : '') + '>' +
      '<span class="box"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></span>' +
      '<span class="txt">' + t + '</span></label></li>'
    ).join('');
    updateChecklistProgress();
  }

  function updateChecklistProgress() {
    const ctx = state.context;
    if (!ctx) return;
    const count = LEVEL_META[ctx.level].items;
    const done = state.checklist[planKey(ctx)] || [];
    const n = done.slice(0, count).filter(Boolean).length;
    $('#respProgress').textContent = n + ' / ' + count + ' done';
    $('#respProgressBar').style.width = (n / count * 100) + '%';
  }

  /* ---------------------------------------------------------
     AI situation briefing
  --------------------------------------------------------- */
  function generateBriefing(ctx) {
    const m = LEVEL_META[ctx.level];
    const label = DISASTERS[ctx.type].label;
    const sev = SEVERITY[ctx.sev - 1].toLowerCase();
    const den = DENSITY[ctx.dens - 1].toLowerCase();
    const f = computeFactors(ctx.type, ctx.regionId, ctx.sev, ctx.dens);
    const conf = Math.round(72 + hash01(ctx.type + ctx.regionId + ctx.level) * 18);

    let outlook;
    if (ctx.score >= 78) outlook = 'Escalating: conditions are expected to worsen over the next 6 hours without intervention.';
    else if (ctx.score >= 55) outlook = 'Deteriorating: expect rising risk over the next 6–12 hours, so prepare to escalate.';
    else if (ctx.score >= 30) outlook = 'Watchful: no major escalation is expected, but conditions will be reviewed hourly.';
    else outlook = 'Stable: risk is expected to remain low.';

    return [
      {
        title: 'Situation',
        text: ctx.level + ' ' + label.toLowerCase() + ' risk (' + ctx.score + '%) for ' + ctx.locationName + '. Under a ' + sev + ' scenario in a ' + den + '-density area, an estimated ' + fmtNum(ctx.pop) + ' people could be affected.'
      },
      {
        title: 'Why the model flags this',
        text: 'The strongest drivers are ' + f[0].label.toLowerCase() + ' (' + f[0].impact + '%) and ' + f[1].label.toLowerCase() + ' (' + f[1].impact + '%). ' + NARRATIVE[ctx.type]
      },
      {
        title: 'Recommended priorities',
        text: m.priority + ' ' + m.name + ' — ' + ACTIONS[ctx.type][ctx.level]
      },
      {
        title: 'Outlook & confidence',
        text: outlook + ' Simulated model confidence: ' + conf + '%. Generated from simulated data and not suitable for real-world decisions.'
      }
    ];
  }

  function renderBriefing() {
    const ctx = state.context;
    if (!ctx) return;
    const m = LEVEL_META[ctx.level];
    const srcLabel = ctx.source === 'analysis' ? 'Your risk analysis' : ctx.source === 'zone' ? 'Selected zone' : 'Opened alert';
    const src = $('#briefingSource');
    src.innerHTML = '<span class="badge ' + m.cls + '">' + ctx.level + ' · ' + ctx.score + '%</span>' +
      '<span><b>' + srcLabel + ':</b> ' + DISASTERS[ctx.type].label + ' · ' + ctx.locationName + '</span>';

    const sections = generateBriefing(ctx);
    const body = $('#briefingBody');
    const token = ++state.briefToken;
    clearInterval(state.briefTimer);
    body.innerHTML = '';
    const paras = sections.map((s) => {
      const d = document.createElement('div');
      d.className = 'brief-sec';
      const h = document.createElement('h4');
      h.textContent = s.title;
      const p = document.createElement('p');
      d.appendChild(h);
      d.appendChild(p);
      body.appendChild(d);
      return p;
    });
    if (reduceMotion) {
      paras.forEach((p, i) => { p.textContent = sections[i].text; });
      return;
    }
    let si = 0;
    let ci = 0;
    paras[0].classList.add('caret');
    state.briefTimer = setInterval(() => {
      if (token !== state.briefToken) { clearInterval(state.briefTimer); return; }
      const full = sections[si].text;
      ci += 5;
      paras[si].textContent = full.slice(0, ci);
      if (ci >= full.length) {
        paras[si].textContent = full;
        paras[si].classList.remove('caret');
        si++;
        ci = 0;
        if (si >= sections.length) { clearInterval(state.briefTimer); return; }
        paras[si].classList.add('caret');
      }
    }, 16);
  }

  /* ---------------------------------------------------------
     Risk analysis
  --------------------------------------------------------- */
  function readForm() {
    const dens = $('input[name="density"]:checked');
    return {
      type: $('#disasterType').value,
      regionId: $('#location').value,
      sev: Number($('#severity').value),
      dens: dens ? Number(dens.value) : 2
    };
  }

  function showScanning() {
    $('#resultPanel').innerHTML =
      '<div class="scan"><div class="scan-ring"></div><p id="scanMsg">Loading simulated hazard layers…</p>' +
      '<div class="scan-bar"><i></i></div></div>';
  }

  function analyzeRisk() {
    const input = readForm();
    const btn = $('#analyzeBtn');
    const token = ++state.analysisToken;
    btn.disabled = true;
    showScanning();
    const steps = ['Weighting severity and population density…', 'Scoring location exposure…', 'Drafting recommended actions…'];
    steps.forEach((msg, i) => {
      setTimeout(() => {
        if (token !== state.analysisToken) return;
        const el = $('#scanMsg');
        if (el) el.textContent = msg;
      }, 330 * (i + 1));
    });
    setTimeout(() => {
      if (token !== state.analysisToken) return;
      btn.disabled = false;
      finishAnalysis(input);
    }, reduceMotion ? 50 : 1300);
  }

  function finishAnalysis(input) {
    const region = REGIONS[input.regionId];
    const score = computeScore(input.type, input.regionId, input.sev, input.dens);
    const ctx = makeContext({
      source: 'analysis', type: input.type, regionId: input.regionId,
      locationName: region.name, score: score, sev: input.sev, dens: input.dens,
      pop: estimatePop(input.regionId, score, input.sev)
    });
    const result = Object.assign({}, ctx, {
      factors: computeFactors(input.type, input.regionId, input.sev, input.dens),
      conf: Math.round(72 + hash01(input.type + input.regionId + ctx.level) * 18)
    });
    state.analysis = result;
    renderResult(result);

    if (ctx.level !== 'Low') {
      const alert = {
        id: ++state.alertSeq, type: ctx.type, regionId: ctx.regionId, zoneId: null,
        locationName: region.name, level: ctx.level, sev: ctx.sev, time: Date.now(),
        action: ACTIONS[ctx.type][ctx.level], source: 'Your risk analysis', ctx: ctx
      };
      state.alerts.push(alert);
      state.newAlertId = alert.id;
      afterAlertsChanged();
      setTimeout(() => { if (state.newAlertId === alert.id) { state.newAlertId = null; renderAlerts(); } }, 6000);
      toast(ctx.level + ' risk: ' + alertTitle(ctx.level).toLowerCase() + ' added to Early Warning Alerts');
    } else {
      toast('Low risk: no alert generated');
    }
    setContext(ctx);
  }

  function renderResult(r) {
    const m = LEVEL_META[r.level];
    const C = 2 * Math.PI * 54;
    const panel = $('#resultPanel');
    panel.innerHTML =
      '<div class="result ' + m.cls + '">' +
        '<div class="result-top">' +
          '<div class="gauge"><svg viewBox="0 0 128 128" aria-hidden="true"><circle class="g-bg" cx="64" cy="64" r="54"/>' +
          '<circle class="g-fg" cx="64" cy="64" r="54" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '" data-target="' + (C * (1 - r.score / 100)).toFixed(1) + '"/></svg>' +
          '<div class="gauge-center"><b>' + r.score + '%</b><span>risk</span></div></div>' +
          '<div class="result-head"><span class="badge">' + r.level + ' risk</span>' +
          '<h3>' + DISASTERS[r.type].label + ' · ' + r.locationName + '</h3>' +
          '<p class="muted">' + SEVERITY[r.sev - 1] + ' scenario · ' + DENSITY[r.dens - 1] + ' density · est. ' + fmtNum(r.pop) + ' people exposed</p>' +
          '<span class="conf">Simulated model confidence ' + r.conf + '%</span></div>' +
        '</div>' +
        '<h4>Main contributing factors</h4>' +
        '<ul class="factors">' + r.factors.map((f, i) =>
          '<li><span class="f-name">' + f.label + (i === 0 ? '<em>Primary driver</em>' : '') + '</span><span class="f-val">' + f.impact + '%</span>' +
          '<span class="bar"><i data-w="' + f.impact + '"></i></span><span class="f-note">' + f.note + '</span></li>'
        ).join('') + '</ul>' +
        '<div class="action-box"><h4>Recommended emergency action</h4><p>' + ACTIONS[r.type][r.level] + '</p>' +
        '<div class="action-meta"><span>Priority ' + m.priority + ' · ' + m.name + '</span><span>' + m.window + '</span></div></div>' +
        (r.type === 'earthquake' ? '<p class="sim-note">Earthquakes cannot be predicted. This score represents exposure and readiness risk for the chosen scenario, not a forecast.</p>' : '') +
        '<p class="sim-note">Prototype · simulated AI analysis. Not real emergency, government or sensor data.</p>' +
        '<div class="result-actions"><button type="button" class="btn btn-primary btn-sm" data-go="response">Open response plan</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-go="briefing">View AI briefing</button></div>' +
      '</div>';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fg = $('.g-fg', panel);
      if (fg) fg.setAttribute('stroke-dashoffset', fg.getAttribute('data-target'));
      $$('.factors .bar i', panel).forEach((i) => { i.style.width = i.dataset.w + '%'; });
    }));
  }

  function resetResultPanel() {
    state.analysisToken++;
    $('#analyzeBtn').disabled = false;
    $('#resultPanel').innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>' +
      '<h3>No analysis yet</h3><p>Set the scenario on the left and press <b>Analyze Risk</b> to see the simulated risk score, contributing factors and recommended action.</p>' +
      '<p class="sim-note">Prototype · simulated AI analysis · not real emergency data</p></div>';
  }

  /* ---------------------------------------------------------
     Live-style simulation tick
  --------------------------------------------------------- */
  function tick() {
    state.zones.forEach((z) => {
      z.score = clamp(Math.round(z.score + (z.base - z.score) * 0.2 + rand(-2.5, 2.5)), 5, 99);
    });
    state.tickCount++;

    if (state.tickCount % 4 === 0 && Math.random() < 0.85) addZoneAlert();

    updateMap();
    updateOverview();
    renderStats();
    updateZoneDetailLive();

    const ctx = state.context;
    if (ctx && ctx.source === 'zone') {
      const z = getZone(ctx.zoneId);
      if (z) {
        const newLevel = levelFor(z.score);
        if (newLevel !== ctx.level) {
          setContext(contextFromZone(z));
          toast(z.name + ' risk level changed to ' + newLevel);
        } else {
          ctx.score = z.score;
          ctx.pop = popAffected(z);
        }
      }
    }
    $('#tickLabel').textContent = 'Simulation tick at ' + new Date().toLocaleTimeString();
  }

  function updateClock() {
    $('#clock').textContent = new Date().toLocaleTimeString([], { hour12: false });
  }

  /* ---------------------------------------------------------
     Reset
  --------------------------------------------------------- */
  function applyFormDefaults() {
    $('#disasterType').value = 'flood';
    $('#location').value = 'greywater';
    $('#severity').value = '3';
    $('#severityOut').textContent = SEVERITY[2];
    const d = $('input[name="density"][value="' + REGIONS.greywater.density + '"]');
    if (d) d.checked = true;
  }

  function resetAll() {
    clearInterval(state.briefTimer);
    state.briefToken++;
    state.analysis = null;
    state.filter = 'all';
    state.checklist = {};
    state.dismissedBanner = null;
    state.newAlertId = null;
    state.tickCount = 0;
    seedZones();
    seedAlerts();
    applyFormDefaults();
    resetResultPanel();
    $$('#mapFilters .chip-btn').forEach((b) => b.classList.toggle('active', b.dataset.filter === 'all'));
    const top = state.zones.reduce((a, b) => (b.score > a.score ? b : a));
    state.selectedZoneId = top.id;
    updateMap();
    updateOverview();
    renderAlerts();
    renderBanner();
    renderStatus();
    renderStats();
    renderZoneDetail();
    setContext(contextFromZone(top));
  }

  /* ---------------------------------------------------------
     Setup & events
  --------------------------------------------------------- */
  function populateForm() {
    $('#disasterType').innerHTML = TYPES.map((t) => '<option value="' + t + '">' + DISASTERS[t].label + '</option>').join('');
    $('#location').innerHTML = Object.keys(REGIONS).map((id) => '<option value="' + id + '">' + REGIONS[id].name + '</option>').join('');
  }

  function bindEvents() {
    $('#riskForm').addEventListener('submit', (e) => { e.preventDefault(); analyzeRisk(); });
    $('#severity').addEventListener('input', (e) => { $('#severityOut').textContent = SEVERITY[Number(e.target.value) - 1]; });
    $('#location').addEventListener('change', (e) => {
      const d = $('input[name="density"][value="' + REGIONS[e.target.value].density + '"]');
      if (d) d.checked = true;
    });

    const doReset = () => { resetAll(); toast('Dashboard reset to its initial simulated state'); };
    $('#resetBtn').addEventListener('click', doReset);
    $('#resetBtnHeader').addEventListener('click', doReset);

    $('#bannerDismiss').addEventListener('click', () => {
      state.dismissedBanner = Number($('#criticalBanner').dataset.alertId) || null;
      renderBanner();
      toast('Critical warning acknowledged (simulated)');
    });
    $('#bannerOpen').addEventListener('click', () => {
      const a = state.alerts.find((x) => x.id === Number($('#criticalBanner').dataset.alertId));
      if (a) {
        const ctx = contextFromAlert(a);
        if (ctx) {
          if (a.zoneId) { state.selectedZoneId = a.zoneId; updateMap(); renderZoneDetail(); }
          setContext(ctx);
        }
      }
      scrollToId('response');
    });

    $('#alertList').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const card = btn.closest('.alert-card');
      const a = state.alerts.find((x) => x.id === Number(card.dataset.id));
      if (!a) return;
      const act = btn.dataset.act;
      if (act === 'dismiss') {
        state.alerts = state.alerts.filter((x) => x.id !== a.id);
        afterAlertsChanged();
        toast('Alert dismissed');
      } else if (act === 'plan') {
        const ctx = contextFromAlert(a);
        if (ctx) {
          if (a.zoneId) { state.selectedZoneId = a.zoneId; updateMap(); renderZoneDetail(); }
          setContext(ctx);
          scrollToId('response');
        }
      } else if (act === 'map' && a.zoneId) {
        selectZone(a.zoneId, false);
        scrollToId('map');
      }
    });

    $('#mapFilters').addEventListener('click', (e) => {
      const b = e.target.closest('.chip-btn');
      if (!b) return;
      state.filter = b.dataset.filter;
      $$('#mapFilters .chip-btn').forEach((x) => x.classList.toggle('active', x === b));
      updateMap();
    });

    $('#zoneDetail').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      const z = getZone(state.selectedZoneId);
      if (!btn || !z) return;
      if (btn.dataset.act === 'zone-plan') {
        scrollToId('response');
      } else if (btn.dataset.act === 'zone-analyze') {
        const r = REGIONS[z.region];
        $('#disasterType').value = z.type;
        $('#location').value = z.region;
        $('#severity').value = String(clamp(Math.ceil(z.score / 20), 1, 5));
        $('#severityOut').textContent = SEVERITY[Number($('#severity').value) - 1];
        const d = $('input[name="density"][value="' + r.density + '"]');
        if (d) d.checked = true;
        toast('Scenario pre-filled from ' + z.name + '. Press Analyze Risk.');
        scrollToId('analysis');
      }
    });

    $('#resultPanel').addEventListener('click', (e) => {
      const b = e.target.closest('[data-go]');
      if (b) scrollToId(b.dataset.go);
    });

    $('#respChecklist').addEventListener('change', (e) => {
      const cb = e.target.closest('input[type="checkbox"]');
      if (!cb || !state.context) return;
      const key = planKey(state.context);
      if (!state.checklist[key]) state.checklist[key] = new Array(6).fill(false);
      state.checklist[key][Number(cb.dataset.i)] = cb.checked;
      updateChecklistProgress();
    });

    $('#briefingRegen').addEventListener('click', () => {
      if (!state.context) return;
      renderBriefing();
      toast('Briefing regenerated');
    });
  }

  function init() {
    populateForm();
    bindEvents();
    seedZones();
    seedAlerts();
    applyFormDefaults();
    buildOverview();
    buildMap();
    renderAlerts();
    renderBanner();
    renderStatus();
    renderStats();
    const top = state.zones.reduce((a, b) => (b.score > a.score ? b : a));
    state.selectedZoneId = top.id;
    updateMap();
    renderZoneDetail();
    setContext(contextFromZone(top));
    updateClock();
    $('#tickLabel').textContent = 'Simulation tick at ' + new Date().toLocaleTimeString();
    setInterval(updateClock, 1000);
    setInterval(tick, 5000);
    setInterval(refreshTimes, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
