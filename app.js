/**
 * TOWING DASHBOARD HUD // CORE TELEMETRY ENGINE
 * Matches Universal_Towing_Calculator.xlsm physics & moment balance equations
 */

// Caravan Axles & Water Tanks Architecture Defaults
const DEFAULT_CARAVAN_CONFIG = {
  axleType: 'tandem', // 'tandem' | 'single'
  tankMode: 'dual',   // 'dual' | 'single-front' | 'single-center' | 'single-rear' | 'custom'
  frontTank: {
    enabled: true,
    name: 'Front Water Tank',
    capacity: 95,
    leverArm: 1.80
  },
  rearTank: {
    enabled: true,
    name: 'Rear Water Tank',
    capacity: 95,
    leverArm: -1.50
  }
};

// Global State
let state = {
  currentVehicleId: 'next-gen-ranger-wildtrak',
  currentCaravanId: 'tandem-van',
  
  // Dynamic caravan architecture configuration
  caravanConfig: null,
  
  // Storage Offsets (Simulation Sliders - Excel Col E)
  sliderOffsets: {
    aFrame: 0,
    frontStorage: 0,
    frontTank: 0,
    midStorage: 0,
    rearTank: 0,
    rearStorage: 0,
    cabin: 0,
    tub: 0
  },
  
  // Custom vehicle & caravan store
  customVehicle: null,
  customCaravan: null,
  
  // Inventory items list
  inventory: [],
  
  // Filters & UI state
  invFilter: 'all',
  invSearch: '',
  audioEnabled: true,
  daylightMode: false,
  rigViewMode: 'blueprint', // 'blueprint' | 'photo'
  rigPhotoUrl: null,
  photoOverlay: {
    showPins: true,
    showDimensions: true,
    calibrating: false
  },
  photoPositions: null
};

// Lever Arms in meters relative to caravan axle center
const LEVER_ARMS = {
  aFrame: 3.75,
  frontStorage: 3.00,
  frontTank: 1.80,
  midStorage: 0.00,
  rearTank: -1.50,
  rearStorage: -2.25
};

// Safe retrieval and initialization of caravan configuration
function getCaravanConfig() {
  if (!state.caravanConfig) {
    state.caravanConfig = JSON.parse(JSON.stringify(DEFAULT_CARAVAN_CONFIG));
  }
  if (!state.caravanConfig.axleType) state.caravanConfig.axleType = 'tandem';
  if (!state.caravanConfig.tankMode) state.caravanConfig.tankMode = 'dual';
  if (!state.caravanConfig.frontTank) state.caravanConfig.frontTank = { ...DEFAULT_CARAVAN_CONFIG.frontTank };
  if (!state.caravanConfig.rearTank) state.caravanConfig.rearTank = { ...DEFAULT_CARAVAN_CONFIG.rearTank };
  if (typeof state.caravanConfig.frontTank.capacity !== 'number') state.caravanConfig.frontTank.capacity = 95;
  if (typeof state.caravanConfig.frontTank.leverArm !== 'number') state.caravanConfig.frontTank.leverArm = 1.80;
  if (typeof state.caravanConfig.rearTank.capacity !== 'number') state.caravanConfig.rearTank.capacity = 95;
  if (typeof state.caravanConfig.rearTank.leverArm !== 'number') state.caravanConfig.rearTank.leverArm = -1.50;
  return state.caravanConfig;
}

// Initialize Application
function initApp() {
  // Load baseline inventory from DEFAULT_TOWING_DATA
  if (typeof DEFAULT_TOWING_DATA !== 'undefined' && DEFAULT_TOWING_DATA.inventory) {
    state.inventory = JSON.parse(JSON.stringify(DEFAULT_TOWING_DATA.inventory));
  }
  
  // Load saved state from LocalStorage if present
  try {
    const saved = localStorage.getItem('towing_hud_state_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.currentVehicleId) state.currentVehicleId = parsed.currentVehicleId;
      if (parsed.currentCaravanId) state.currentCaravanId = parsed.currentCaravanId;
      if (parsed.caravanConfig) {
        state.caravanConfig = parsed.caravanConfig;
        const cfg = getCaravanConfig();
        LEVER_ARMS.frontTank = cfg.frontTank.leverArm;
        LEVER_ARMS.rearTank = cfg.rearTank.leverArm;
      }
      if (parsed.sliderOffsets) {
        state.sliderOffsets = { ...state.sliderOffsets, ...parsed.sliderOffsets };
      }
      if (parsed.payloadVersion >= 4 && parsed.inventory && parsed.inventory.length > 0) {
        state.inventory = parsed.inventory;
      }
      if (parsed.customVehicle) state.customVehicle = parsed.customVehicle;
      if (parsed.customCaravan) state.customCaravan = parsed.customCaravan;
      if (parsed.rigViewMode) state.rigViewMode = parsed.rigViewMode;
      if (parsed.rigPhotoUrl) state.rigPhotoUrl = parsed.rigPhotoUrl;
      if (parsed.photoOverlay) {
        state.photoOverlay = { ...state.photoOverlay, ...parsed.photoOverlay, calibrating: false };
      }
      if (parsed.photoPositions) {
        state.photoPositions = parsed.photoPositions;
      }
      if (parsed.daylightMode) {
        state.daylightMode = parsed.daylightMode;
        document.body.classList.toggle('daylight-mode', state.daylightMode);
      }
      if (parsed.carCockpitMode) {
        state.carCockpitMode = parsed.carCockpitMode;
      }
    }
  } catch (e) {
    console.warn('Could not load saved state', e);
  }

  // Auto-enable Car Display Mode if launched with ?mode=car or #aa (e.g. from Android Auto Browser)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'car' || window.location.hash === '#aa') {
    state.carCockpitMode = true;
  }
  applyCarCockpitDOMState();

  populateSelectors();
  renderInventoryTable();
  bindEvents();
  initRigView();
  updateTelemetry();
}

// Get Active Vehicle Specs
function getActiveVehicle() {
  if (state.currentVehicleId === 'user-defined' && state.customVehicle) {
    return state.customVehicle;
  }
  const found = DEFAULT_TOWING_DATA.vehicles.find(v => v.id === state.currentVehicleId);
  return found || DEFAULT_TOWING_DATA.vehicles[0];
}

// Get Active Caravan Specs
function getActiveCaravan() {
  if (state.currentCaravanId === 'user-defined' && state.customCaravan) {
    return state.customCaravan;
  }
  const found = DEFAULT_TOWING_DATA.caravans.find(c => c.id === state.currentCaravanId);
  return found || DEFAULT_TOWING_DATA.caravans[0];
}

// Compute Zone Weights from Packed Inventory Items
function getZoneBaseWeights() {
  const cfg = getCaravanConfig();
  const totals = {
    aFrame: 0,
    frontStorage: 0,
    frontTank: cfg.frontTank && cfg.frontTank.enabled ? (cfg.frontTank.capacity || 95) : 0,
    midStorage: 0,
    rearTank: cfg.rearTank && cfg.rearTank.enabled ? (cfg.rearTank.capacity || 95) : 0,
    rearStorage: 0,
    cabin: 0,
    tub: 0
  };

  state.inventory.forEach(item => {
    if (item.packed) {
      const w = item.travelWeight || item.itemWeight || 0;
      if (totals.hasOwnProperty(item.zone)) {
        totals[item.zone] += w;
      }
    }
  });

  return totals;
}

// Full Physics & Compliance Calculation
function computePhysics() {
  const vehicle = getActiveVehicle();
  const caravan = getActiveCaravan();
  const cfg = getCaravanConfig();

  // Dynamic lever arms from caravan configuration
  if (cfg.frontTank) LEVER_ARMS.frontTank = cfg.frontTank.leverArm;
  if (cfg.rearTank) LEVER_ARMS.rearTank = cfg.rearTank.leverArm;

  const baseWeights = getZoneBaseWeights();
  
  // Total Effective Zone Weights = Base + Slider Offset
  const zones = {
    aFrame: Math.max(0, baseWeights.aFrame + (state.sliderOffsets.aFrame || 0)),
    frontStorage: Math.max(0, baseWeights.frontStorage + (state.sliderOffsets.frontStorage || 0)),
    frontTank: (cfg.frontTank && cfg.frontTank.enabled) ? Math.max(0, baseWeights.frontTank + (state.sliderOffsets.frontTank || 0)) : 0,
    midStorage: Math.max(0, baseWeights.midStorage + (state.sliderOffsets.midStorage || 0)),
    rearTank: (cfg.rearTank && cfg.rearTank.enabled) ? Math.max(0, baseWeights.rearTank + (state.sliderOffsets.rearTank || 0)) : 0,
    rearStorage: Math.max(0, baseWeights.rearStorage + (state.sliderOffsets.rearStorage || 0)),
    cabin: Math.max(0, baseWeights.cabin + (state.sliderOffsets.cabin || 0)),
    tub: Math.max(0, baseWeights.tub + (state.sliderOffsets.tub || 0))
  };

  // Caravan Storage Load Total
  const caravanCargoTotal = zones.aFrame + zones.frontStorage + zones.frontTank + 
                            zones.midStorage + zones.rearTank + zones.rearStorage;
  
  // Moment balance around caravan axle center (kg * m)
  const momentsSum = (zones.aFrame * LEVER_ARMS.aFrame) +
                     (zones.frontStorage * LEVER_ARMS.frontStorage) +
                     (zones.frontTank * LEVER_ARMS.frontTank) +
                     (zones.midStorage * LEVER_ARMS.midStorage) +
                     (zones.rearTank * LEVER_ARMS.rearTank) +
                     (zones.rearStorage * LEVER_ARMS.rearStorage);

  // Live Towball Mass (TBM)
  // Formula: MAX(0, ROUND(caravan.tareTbm + (momentsSum / caravan.hitchDist), 0))
  const hitchDist = caravan.hitchDist > 0 ? caravan.hitchDist : 5.0;
  const tbm = Math.max(0, Math.round(caravan.tareTbm + (momentsSum / hitchDist)));

  // Live Trailer ATM (Aggregate Trailer Mass)
  const trailerATM = caravan.tare + caravanCargoTotal;

  // Live Trailer GTM (Gross Trailer Mass = ATM - TBM on caravan tires)
  const trailerGTM = Math.max(0, trailerATM - tbm);

  // Live Vehicle GVM (Gross Vehicle Mass = Vehicle Tare + Cabin + Tub + TBM)
  const vehicleGVM = vehicle.tare + zones.cabin + zones.tub + tbm;

  // Gross Combined Mass (GCM = Vehicle Tare + Cabin + Tub + Trailer ATM)
  const gcm = vehicleGVM + trailerATM - tbm;

  // Vehicle Axle Overhang Physics
  // Overhang cantilever multiplier = 1 + (Overhang / Wheelbase)
  const wb = vehicle.wheelbase > 0 ? vehicle.wheelbase : 3.0;
  const oh = vehicle.overhang > 0 ? vehicle.overhang : 1.25;
  const cantileverRatio = oh / wb;

  // Projected Rear Axle Loading = RearTare + Tub + (Cabin * 0.35) + TBM * (1 + (OH/WB))
  const rearAxleLoad = vehicle.rearAxleTare + zones.tub + (zones.cabin * 0.35) + (tbm * (1 + cantileverRatio));

  // Projected Front Axle Loading = FrontTare + (Cabin * 0.65) - TBM * (OH/WB)
  const frontAxleLoad = vehicle.frontAxleTare + (zones.cabin * 0.65) - (tbm * cantileverRatio);

  // TBM Percentage
  const tbmPercent = trailerATM > 0 ? (tbm / trailerATM) * 100 : 0;

  // Margins
  const margins = {
    gvm: vehicle.gvm - vehicleGVM,
    atm: caravan.atm - trailerATM,
    gtm: (caravan.maxGtm || (caravan.atm - caravan.tareTbm)) - trailerGTM,
    gcm: vehicle.gcm - gcm,
    tbm: vehicle.maxTbm - tbm,
    rearAxle: vehicle.maxRearAxle > 0 ? vehicle.maxRearAxle - rearAxleLoad : null,
    frontAxle: vehicle.maxFrontAxle > 0 ? vehicle.maxFrontAxle - frontAxleLoad : null
  };

  // Status Evaluations
  const status = {
    gvm: margins.gvm >= 0 ? (margins.gvm < 100 ? 'warn' : 'pass') : 'fail',
    atm: margins.atm >= 0 ? (margins.atm < 100 ? 'warn' : 'pass') : 'fail',
    gtm: margins.gtm >= 0 ? (margins.gtm < 100 ? 'warn' : 'pass') : 'fail',
    gcm: margins.gcm >= 0 ? (margins.gcm < 150 ? 'warn' : 'pass') : 'fail',
    tbm: margins.tbm >= 0 ? (margins.tbm < 25 ? 'warn' : 'pass') : 'fail',
    rearAxle: margins.rearAxle === null ? 'pass' : (margins.rearAxle >= 0 ? (margins.rearAxle < 75 ? 'warn' : 'pass') : 'fail'),
    frontAxle: margins.frontAxle === null ? 'pass' : (margins.frontAxle >= 0 ? 'pass' : 'fail'),
    tbmRatio: (tbmPercent >= 8.0 && tbmPercent <= 11.5) ? 'pass' : (tbmPercent < 8.0 ? 'fail' : 'warn')
  };

  return {
    vehicle,
    caravan,
    zones,
    storage: zones, // alias so both p.zones and p.storage work safely
    baseWeights,
    caravanCargoTotal,
    momentsSum,
    tbm,
    trailerATM,
    trailerGTM,
    vehicleGVM,
    gcm,
    cantileverRatio,
    rearAxleLoad,
    frontAxleLoad,
    tbmPercent,
    margins,
    status
  };
}

// Update Master HUD UI
function updateTelemetry() {
  const p = computePhysics();

  // 1. GVM Gauge
  updateArcGauge('gauge-gvm', p.vehicleGVM, p.vehicle.gvm, p.status.gvm, 'kg');
  document.getElementById('gvm-curr-val').textContent = Math.round(p.vehicleGVM).toLocaleString();
  document.getElementById('gvm-cap-val').textContent = p.vehicle.gvm.toLocaleString() + ' kg';
  const gvmMarginEl = document.getElementById('gvm-margin-val');
  gvmMarginEl.textContent = (p.margins.gvm >= 0 ? '+' : '') + Math.round(p.margins.gvm) + ' kg';
  gvmMarginEl.className = 'gauge-margin-text ' + (p.margins.gvm >= 0 ? 'margin-positive' : 'margin-negative');
  setComplianceBadge('gvm-badge', p.status.gvm);

  // 2. ATM Gauge
  updateArcGauge('gauge-atm', p.trailerATM, p.caravan.atm, p.status.atm, 'kg');
  document.getElementById('atm-curr-val').textContent = Math.round(p.trailerATM).toLocaleString();
  document.getElementById('atm-cap-val').textContent = p.caravan.atm.toLocaleString() + ' kg';
  const atmMarginEl = document.getElementById('atm-margin-val');
  atmMarginEl.textContent = (p.margins.atm >= 0 ? '+' : '') + Math.round(p.margins.atm) + ' kg';
  atmMarginEl.className = 'gauge-margin-text ' + (p.margins.atm >= 0 ? 'margin-positive' : 'margin-negative');
  setComplianceBadge('atm-badge', p.status.atm);

  // 3. TBM Gauge & Ratio
  updateArcGauge('gauge-tbm', p.tbm, p.vehicle.maxTbm, p.status.tbm, 'kg');
  document.getElementById('tbm-curr-val').textContent = Math.round(p.tbm).toLocaleString();
  document.getElementById('tbm-cap-val').textContent = p.vehicle.maxTbm.toLocaleString() + ' kg';
  const tbmMarginEl = document.getElementById('tbm-margin-val');
  tbmMarginEl.textContent = (p.margins.tbm >= 0 ? '+' : '') + Math.round(p.margins.tbm) + ' kg';
  tbmMarginEl.className = 'gauge-margin-text ' + (p.margins.tbm >= 0 ? 'margin-positive' : 'margin-negative');
  setComplianceBadge('tbm-badge', p.status.tbm);

  // TBM Ratio bar position (scale: 4% to 15%)
  const minRatio = 4;
  const maxRatio = 15;
  const clampedRatio = Math.max(minRatio, Math.min(maxRatio, p.tbmPercent));
  const markerLeft = ((clampedRatio - minRatio) / (maxRatio - minRatio)) * 100;
  const markerEl = document.getElementById('tbm-sweet-marker');
  if (markerEl) markerEl.style.left = `${markerLeft}%`;
  document.getElementById('tbm-ratio-val').textContent = p.tbmPercent.toFixed(2) + '%';

  // 4. GCM Gauge
  updateArcGauge('gauge-gcm', p.gcm, p.vehicle.gcm, p.status.gcm, 'kg');
  document.getElementById('gcm-curr-val').textContent = Math.round(p.gcm).toLocaleString();
  document.getElementById('gcm-cap-val').textContent = p.vehicle.gcm.toLocaleString() + ' kg';
  const gcmMarginEl = document.getElementById('gcm-margin-val');
  gcmMarginEl.textContent = (p.margins.gcm >= 0 ? '+' : '') + Math.round(p.margins.gcm) + ' kg';
  gcmMarginEl.className = 'gauge-margin-text ' + (p.margins.gcm >= 0 ? 'margin-positive' : 'margin-negative');
  setComplianceBadge('gcm-badge', p.status.gcm);

  // Update Dynamic Rig SVG Schematic
  renderRigBlueprint(p);

  // Update Photo View Telemetry Dock and photo overlay
  renderPhotoTelemetryDock(p);
  renderPhotoOverlay(p);

  // Update Storage Controls Display
  updateStorageCards(p);

  // Update Diagnostic Telemetry Rows
  updateTelemetryChecklist(p);

  // Update Safety Advisor
  updateSafetyAdvisor(p);

  // Update Widescreen Car Head-Unit Cockpit & Native Android Auto Bridge
  updateCarCockpitUI(p);
  pushToAndroidAutoBridge(p);
}

// Update Arc SVG Gauge fill & percentage
function updateArcGauge(id, current, max, statusClass, unit) {
  const card = document.getElementById(id);
  if (!card) return;
  
  // Set card status border
  card.className = `gauge-card status-${statusClass}`;
  
  const fillPath = card.querySelector('.gauge-fill');
  const percentTag = card.querySelector('.gauge-percent-tag');
  
  const pct = max > 0 ? (current / max) * 100 : 0;
  const clampedPct = Math.min(100, Math.max(0, pct));
  
  // Full semi-circle circumference = PI * radius (r=75 => C ~ 235.6)
  const totalLength = 235.6;
  const offset = totalLength - (totalLength * (clampedPct / 100));
  
  if (fillPath) {
    fillPath.style.strokeDashoffset = offset;
    fillPath.className = `gauge-fill ${statusClass}`;
  }
  
  if (percentTag) {
    percentTag.textContent = `${pct.toFixed(1)}%`;
  }
}

function setComplianceBadge(id, statusClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `compliance-badge ${statusClass}`;
  el.textContent = statusClass === 'pass' ? 'PASS' : (statusClass === 'warn' ? 'CAUTION' : 'FAIL');
}

// Update Blueprint SVG
function renderRigBlueprint(p) {
  const svg = document.getElementById('rig-blueprint-svg');
  if (!svg) return;
  const cfg = getCaravanConfig();

  const faKg = Math.round(p.frontAxleLoad);
  const raKg = Math.round(p.rearAxleLoad);
  const tbmKg = Math.round(p.tbm);
  const gtmKg = Math.round(p.trailerGTM);

  // Color flags
  const faColor = p.status.frontAxle === 'pass' ? '#00e676' : '#ff1744';
  const raColor = p.status.rearAxle === 'pass' ? '#00e676' : (p.status.rearAxle === 'warn' ? '#ffab00' : '#ff1744');
  const tbmColor = p.status.tbm === 'pass' ? '#00e676' : '#ff1744';
  const gtmColor = p.status.gtm === 'pass' ? '#00e676' : '#ff1744';

  // Front axle lift check (steering grip)
  const faDelta = faKg - p.vehicle.frontAxleTare;
  const faGripText = faDelta < 0 ? `LIFT: ${faDelta}kg (LIGHT STEERING)` : `+${faDelta}kg Positive Grip`;

  const isSingleAxle = cfg.axleType === 'single';

  // Caravan Body Silhouette & Skirts depending on single vs tandem axle
  let vanBodyPath = '';
  let skirtsSvg = '';
  let wheelsSvg = '';
  let fulcrumLabel = '';
  let gtmCardTitle = '';

  if (isSingleAxle) {
    // Single Heavy-Duty Axle centered at X=850, cutout from 805 to 895
    vanBodyPath = `
      M 600,218 
      Q 615,145 640,112 
      Q 660,95 685,95 
      L 1035,95 
      Q 1055,95 1055,115 
      L 1055,195 
      L 1035,218 
      L 895,218 
      Q 895,186 880,186 
      L 820,186 
      Q 805,186 805,218 
      L 600,218 Z
    `;
    skirtsSvg = `
      <path d="M 600,218 L 610,186 L 805,186 L 805,218 Z" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(56, 189, 248, 0.3)" stroke-width="1"/>
      <path d="M 895,218 L 895,186 L 1035,186 L 1035,218 Z" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(56, 189, 248, 0.3)" stroke-width="1"/>
    `;
    wheelsSvg = `
      <!-- Single Heavy-Duty Axle Wheel (Centered at X=850) -->
      <circle cx="850" cy="222" r="32" fill="#0b0f19" stroke="#64748b" stroke-width="4.5"/>
      <circle cx="850" cy="222" r="15" fill="#1e293b" stroke="#38bdf8" stroke-width="2.2"/>
    `;
    fulcrumLabel = 'SINGLE AXLE FULCRUM (0.0m)';
    gtmCardTitle = 'SINGLE AXLE CARAVAN (GTM)';
  } else {
    // Tandem Dual Axles at X=815 and X=885, cutout from 775 to 925
    vanBodyPath = `
      M 600,218 
      Q 615,145 640,112 
      Q 660,95 685,95 
      L 1035,95 
      Q 1055,95 1055,115 
      L 1055,195 
      L 1035,218 
      L 925,218 
      Q 925,186 910,186 
      L 790,186 
      Q 775,186 775,218 
      L 600,218 Z
    `;
    skirtsSvg = `
      <path d="M 600,218 L 610,186 L 775,186 L 775,218 Z" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(56, 189, 248, 0.3)" stroke-width="1"/>
      <path d="M 925,218 L 925,186 L 1035,186 L 1035,218 Z" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(56, 189, 248, 0.3)" stroke-width="1"/>
    `;
    wheelsSvg = `
      <!-- Caravan Tandem Wheels (Axle Center at X=850) -->
      <circle cx="815" cy="222" r="30" fill="#0b0f19" stroke="#64748b" stroke-width="4"/>
      <circle cx="815" cy="222" r="14" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
      <circle cx="885" cy="222" r="30" fill="#0b0f19" stroke="#64748b" stroke-width="4"/>
      <circle cx="885" cy="222" r="14" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
    `;
    fulcrumLabel = 'TANDEM AXLE FULCRUM (0.0m)';
    gtmCardTitle = 'TANDEM CARAVAN (GTM)';
  }

  // Dynamic Water Tank Pins
  let waterPinsSvg = '';
  
  if (cfg.frontTank && cfg.frontTank.enabled) {
    const fwX = Math.round(850 - (cfg.frontTank.leverArm * 60));
    const armStr = cfg.frontTank.leverArm === 0 ? '0.0m Axle' : (cfg.frontTank.leverArm > 0 ? `+${cfg.frontTank.leverArm.toFixed(2)}m` : `${cfg.frontTank.leverArm.toFixed(2)}m`);
    const pinCode = cfg.tankMode && cfg.tankMode.startsWith('single') ? 'WT' : 'FW';
    waterPinsSvg += `
      <!-- Front / Primary Water Tank (${armStr}) -->
      <g transform="translate(${fwX}, 180)" class="pin-node" onclick="focusZone('frontTank')" style="cursor: pointer;">
        <circle cx="0" cy="0" r="13" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5" filter="url(#neonGlow)"/>
        <text x="0" y="4" fill="#38bdf8" font-size="9" font-weight="900" text-anchor="middle">${pinCode}</text>
        <g transform="translate(0, 18)">
          <rect x="-42" y="0" width="84" height="24" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#38bdf8" stroke-width="1"/>
          <text x="0" y="10" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">${armStr} Tank</text>
          <text x="0" y="20" fill="#38bdf8" font-size="10" font-family="Consolas, monospace" font-weight="800" text-anchor="middle">${Math.round(p.zones.frontTank)} L</text>
        </g>
      </g>
    `;
  }

  if (cfg.rearTank && cfg.rearTank.enabled) {
    const rwX = Math.round(850 - (cfg.rearTank.leverArm * 60));
    const armStr = cfg.rearTank.leverArm === 0 ? '0.0m Axle' : (cfg.rearTank.leverArm > 0 ? `+${cfg.rearTank.leverArm.toFixed(2)}m` : `${cfg.rearTank.leverArm.toFixed(2)}m`);
    waterPinsSvg += `
      <!-- Rear Water Tank (${armStr}) -->
      <g transform="translate(${rwX}, 180)" class="pin-node" onclick="focusZone('rearTank')" style="cursor: pointer;">
        <circle cx="0" cy="0" r="13" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5" filter="url(#neonGlow)"/>
        <text x="0" y="4" fill="#38bdf8" font-size="9" font-weight="900" text-anchor="middle">RW</text>
        <g transform="translate(0, 18)">
          <rect x="-42" y="0" width="84" height="24" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#38bdf8" stroke-width="1"/>
          <text x="0" y="10" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">${armStr} Tank</text>
          <text x="0" y="20" fill="#38bdf8" font-size="10" font-family="Consolas, monospace" font-weight="800" text-anchor="middle">${Math.round(p.zones.rearTank)} L</text>
        </g>
      </g>
    `;
  }

  svg.innerHTML = `
    <defs>
      <!-- Gradients -->
      <linearGradient id="bodyGradVeh" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0b1120"/>
      </linearGradient>
      <linearGradient id="bodyGradVan" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#334155"/>
        <stop offset="100%" stop-color="#111827"/>
      </linearGradient>
      <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <!-- Arrow marker for TBM Downforce -->
      <marker id="arrowDown" viewBox="0 0 10 10" refX="5" refY="10" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 0 L 5 10 z" fill="${tbmColor}"/>
      </marker>
    </defs>

    <!-- Ground Level -->
    <line x1="20" y1="250" x2="1130" y2="250" stroke="rgba(255,255,255,0.2)" stroke-width="2" stroke-dasharray="8,5"/>

    <!-- ================= TOW VEHICLE ================= -->
    <g id="vehicle-group">
      <!-- Vehicle Body Silhouette -->
      <path d="M 70,200 L 95,160 L 165,160 L 210,120 L 305,120 L 315,165 L 440,165 L 440,222 L 420,222 A 38,38 0 0,0 340,222 L 170,222 A 38,38 0 0,0 90,222 L 70,222 Z" 
            fill="url(#bodyGradVeh)" stroke="#00f2fe" stroke-width="2"/>
      
      <!-- Windows -->
      <path d="M 215,125 L 300,125 L 300,160 L 175,160 Z" fill="rgba(0, 242, 254, 0.15)" stroke="#00f2fe" stroke-width="1"/>
      <path d="M 310,125 L 340,160 L 310,160 Z" fill="rgba(0, 242, 254, 0.1)" stroke="#00f2fe" stroke-width="1"/>

      <!-- Utility Tub Area -->
      <rect x="320" y="168" width="115" height="46" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(0,242,254,0.3)" stroke-dasharray="4,3"/>
      <text x="378" y="160" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle">TUB: ${Math.round(p.zones.tub)}kg</text>

      <!-- Cabin Area -->
      <text x="255" y="145" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle">CABIN: ${Math.round(p.zones.cabin)}kg</text>

      <!-- Front Wheel (Steer) -->
      <circle cx="130" cy="222" r="30" fill="#0b0f19" stroke="#64748b" stroke-width="4"/>
      <circle cx="130" cy="222" r="14" fill="#1e293b" stroke="#00f2fe" stroke-width="2"/>

      <!-- Rear Wheel (Drive) -->
      <circle cx="380" cy="222" r="30" fill="#0b0f19" stroke="#64748b" stroke-width="4"/>
      <circle cx="380" cy="222" r="14" fill="#1e293b" stroke="#00f2fe" stroke-width="2"/>

      <!-- Wheelbase Span Line -->
      <line x1="130" y1="238" x2="380" y2="238" stroke="#00f2fe" stroke-width="1.5"/>
      <text x="255" y="234" fill="#00f2fe" font-size="11" font-family="Consolas, monospace" font-weight="700" text-anchor="middle">Wheelbase: ${p.vehicle.wheelbase}m</text>

      <!-- Overhang Line -->
      <line x1="380" y1="238" x2="490" y2="238" stroke="#ffab00" stroke-width="1.5" stroke-dasharray="3,2"/>
      <text x="435" y="234" fill="#ffab00" font-size="10" font-family="Consolas, monospace" font-weight="700" text-anchor="middle">OH: ${p.vehicle.overhang}m</text>

      <!-- Front Axle Load Callout (Spacious & Cleanly Placed) -->
      <g transform="translate(130, 260)">
        <rect x="-65" y="0" width="130" height="46" rx="6" fill="#0f172a" stroke="${faColor}" stroke-width="1.5"/>
        <text x="0" y="14" fill="#94a3b8" font-size="9" font-weight="800" text-anchor="middle">FRONT STEER AXLE</text>
        <text x="0" y="29" fill="${faColor}" font-size="12" font-family="Consolas, monospace" font-weight="900" text-anchor="middle">${faKg} kg / ${p.vehicle.maxFrontAxle || '--'}kg</text>
        <text x="0" y="40" fill="${faDelta < 0 ? '#ff1744' : '#00e676'}" font-size="8" font-weight="700" text-anchor="middle">${faGripText}</text>
      </g>

      <!-- Rear Axle Load Callout (Spacious & Cleanly Placed) -->
      <g transform="translate(380, 260)">
        <rect x="-65" y="0" width="130" height="46" rx="6" fill="#0f172a" stroke="${raColor}" stroke-width="1.5"/>
        <text x="0" y="14" fill="#94a3b8" font-size="9" font-weight="800" text-anchor="middle">REAR DRIVE AXLE</text>
        <text x="0" y="29" fill="${raColor}" font-size="12" font-family="Consolas, monospace" font-weight="900" text-anchor="middle">${raKg} kg / ${p.vehicle.maxRearAxle || '--'}kg</text>
        <text x="0" y="40" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">Cantilever: ${(1 + p.cantileverRatio).toFixed(2)}x</text>
      </g>
    </g>

    <!-- Tow Hitch Receiver & Coupling -->
    <rect x="440" y="210" width="50" height="8" fill="#475569" rx="2"/>
    
    <!-- Tow Ball Pivot -->
    <circle cx="490" cy="214" r="8" fill="#f8fafc" stroke="#ffab00" stroke-width="2.5" filter="url(#neonGlow)"/>

    <!-- ================= TOWBALL (TBM) DOWNFORCE HUD AREA (RAISED HIGH & UNCLUTTERED) ================= -->
    <g id="tbm-callout-area">
      <!-- TBM Digital Telemetry Card (Raised to Y=12 to give maximum clearance above the drawbar & toolbox) -->
      <g transform="translate(490, 12)">
        <rect x="-80" y="0" width="160" height="52" rx="8" fill="#070c18" stroke="${tbmColor}" stroke-width="2" filter="url(#neonGlow)"/>
        <text x="0" y="16" fill="#94a3b8" font-size="9" font-weight="800" text-anchor="middle" letter-spacing="1">TOWBALL DOWNLOAD</text>
        <text x="0" y="34" fill="${tbmColor}" font-size="14" font-family="Consolas, monospace" font-weight="900" text-anchor="middle">${tbmKg} kg (${p.tbmPercent.toFixed(1)}%)</text>
        <text x="0" y="46" fill="#94a3b8" font-size="9" font-weight="700" text-anchor="middle">Max Cap: ${p.vehicle.maxTbm}kg | ${p.margins.tbm >= 0 ? '+' + Math.round(p.margins.tbm) + 'kg' : Math.round(p.margins.tbm) + 'kg'}</text>
      </g>

      <!-- Clean Long Neon Downforce Arrow pointing straight down onto the towball (490, 214) -->
      <line x1="490" y1="66" x2="490" y2="204" stroke="${tbmColor}" stroke-width="2.5" stroke-dasharray="6,3" marker-end="url(#arrowDown)"/>
      
      <!-- Downforce Vector Badge (Placed high at Y=100, well above toolbox) -->
      <g transform="translate(490, 102)">
        <rect x="-38" y="-9" width="76" height="18" rx="9" fill="#0f172a" stroke="${tbmColor}" stroke-width="1.2"/>
        <text x="0" y="4" fill="${tbmColor}" font-size="8" font-weight="800" text-anchor="middle">↓ DOWNFORCE</text>
      </g>
    </g>

    <!-- ================= CARAVAN ================= -->
    <g id="caravan-group">
      <!-- Drawbar Triangle Hitch -->
      <line x1="490" y1="214" x2="600" y2="195" stroke="#94a3b8" stroke-width="4"/>
      <line x1="490" y1="214" x2="600" y2="218" stroke="#94a3b8" stroke-width="4"/>

      <!-- Roof Air Conditioner Pod -->
      <rect x="815" y="83" width="70" height="12" rx="3" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
      <line x1="825" y1="89" x2="875" y2="89" stroke="#64748b" stroke-width="1" stroke-dasharray="3,2"/>

      <!-- Caravan Main Body (Authentic Aussie Offroad/Touring Design - No Ugly Rear Arch!) -->
      <path d="${vanBodyPath}" fill="url(#bodyGradVan)" stroke="#38bdf8" stroke-width="2"/>

      <!-- Lower Checkerplate Protective Skirt (Front and Rear of Wheels) -->
      ${skirtsSvg}

      <!-- Modern Tinted Double-Glazed Windows -->
      <rect x="665" y="108" width="78" height="38" rx="4" fill="rgba(56, 189, 248, 0.18)" stroke="#38bdf8" stroke-width="1.2"/>
      <rect x="935" y="108" width="92" height="38" rx="4" fill="rgba(56, 189, 248, 0.18)" stroke="#38bdf8" stroke-width="1.2"/>
      
      <!-- Caravan Main Entry Door -->
      <rect x="785" y="108" width="45" height="106" rx="2" fill="rgba(255, 255, 255, 0.02)" stroke="#64748b" stroke-width="1.5"/>
      <rect x="793" y="118" width="28" height="32" rx="2" fill="rgba(56, 189, 248, 0.12)" stroke="#64748b" stroke-width="1"/>
      <circle cx="792" cy="165" r="2.5" fill="#00f2fe"/>

      <!-- Dynamic Modern Side Accent Graphic -->
      <path d="M 645,158 L 760,158 L 748,166 L 635,166 Z" fill="rgba(0, 242, 254, 0.2)"/>
      <path d="M 935,158 L 1030,158 L 1020,166 L 925,166 Z" fill="rgba(0, 242, 254, 0.2)"/>

      <!-- Rear Heavy-Duty Bumper Bar -->
      <rect x="1055" y="204" width="22" height="12" rx="2" fill="#334155" stroke="#64748b" stroke-width="1.5"/>

      <!-- Rear Mounted Spare Tyre (Iconic Aussie Tourer Detail) -->
      <circle cx="1075" cy="172" r="22" fill="#0b0f19" stroke="#475569" stroke-width="3.5"/>
      <circle cx="1075" cy="172" r="10" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
      <line x1="1055" y1="180" x2="1075" y2="180" stroke="#64748b" stroke-width="3"/>

      <!-- Caravan Wheels (Single or Tandem) -->
      ${wheelsSvg}

      <!-- Axle Center Fulcrum (Pivot point for moment arms) -->
      <line x1="850" y1="75" x2="850" y2="250" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4,3"/>
      <polygon points="850,250 844,260 856,260" fill="#00f2fe"/>
      <text x="850" y="70" fill="#00f2fe" font-size="10" font-weight="700" text-anchor="middle">${fulcrumLabel}</text>

      <!-- Hitch Distance Line L -->
      <line x1="490" y1="238" x2="850" y2="238" stroke="#38bdf8" stroke-width="1.5"/>
      <text x="670" y="234" fill="#38bdf8" font-size="11" font-family="Consolas, monospace" font-weight="700" text-anchor="middle">Hitch Distance (L): ${p.caravan.hitchDist}m</text>

      <!-- Ground Axle GTM Load Callout -->
      <g transform="translate(850, 260)">
        <rect x="-70" y="0" width="140" height="46" rx="6" fill="#0f172a" stroke="${gtmColor}" stroke-width="1.5"/>
        <text x="0" y="14" fill="#94a3b8" font-size="9" font-weight="800" text-anchor="middle">${gtmCardTitle}</text>
        <text x="0" y="29" fill="${gtmColor}" font-size="12" font-family="Consolas, monospace" font-weight="900" text-anchor="middle">${gtmKg} kg / ${p.caravan.maxGtm || '--'}kg</text>
        <text x="0" y="40" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">ATM: ${Math.round(p.trailerATM)} kg</text>
      </g>

      <!-- ================= STORAGE ZONE PINS (UNCLUTTERED & STAGGERED) ================= -->
      
      <!-- A-Frame (+3.75m) - Drawbar Toolboxes & Gas Bottles -->
      <g transform="translate(560, 155)" class="pin-node" onclick="focusZone('aFrame')" style="cursor: pointer;">
        <circle cx="0" cy="0" r="13" fill="#0f172a" stroke="#00e676" stroke-width="2.5" filter="url(#neonGlow)"/>
        <text x="0" y="4" fill="#00e676" font-size="9" font-weight="900" text-anchor="middle">AF</text>
        <g transform="translate(0, 18)">
          <rect x="-44" y="0" width="88" height="24" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#00e676" stroke-width="1"/>
          <text x="0" y="10" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">+3.75m A-Frame</text>
          <text x="0" y="20" fill="#f1f5f9" font-size="10" font-family="Consolas, monospace" font-weight="800" text-anchor="middle">${Math.round(p.zones.aFrame)} kg</text>
        </g>
      </g>

      <!-- Front Storage (+3.0m) - Bedroom & Tunnel Boot -->
      <g transform="translate(670, 138)" class="pin-node" onclick="focusZone('frontStorage')" style="cursor: pointer;">
        <circle cx="0" cy="0" r="13" fill="#0f172a" stroke="#00e676" stroke-width="2.5" filter="url(#neonGlow)"/>
        <text x="0" y="4" fill="#00e676" font-size="9" font-weight="900" text-anchor="middle">FS</text>
        <g transform="translate(0, 18)">
          <rect x="-44" y="0" width="88" height="24" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#00e676" stroke-width="1"/>
          <text x="0" y="10" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">+3.0m Front</text>
          <text x="0" y="20" fill="#f1f5f9" font-size="10" font-family="Consolas, monospace" font-weight="800" text-anchor="middle">${Math.round(p.zones.frontStorage)} kg</text>
        </g>
      </g>

      <!-- Dynamic Water Tank Pins (FW and/or RW) -->
      ${waterPinsSvg}

      <!-- Mid Internal Storage (0.0m) -->
      <g transform="translate(850, 125)" class="pin-node" onclick="focusZone('midStorage')" style="cursor: pointer;">
        <circle cx="0" cy="0" r="13" fill="#0f172a" stroke="#a855f7" stroke-width="2.5" filter="url(#neonGlow)"/>
        <text x="0" y="4" fill="#a855f7" font-size="8" font-weight="900" text-anchor="middle">MID</text>
        <g transform="translate(0, 18)">
          <rect x="-40" y="0" width="80" height="24" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#a855f7" stroke-width="1"/>
          <text x="0" y="10" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">0.0m Axle</text>
          <text x="0" y="20" fill="#f1f5f9" font-size="10" font-family="Consolas, monospace" font-weight="800" text-anchor="middle">${Math.round(p.zones.midStorage)} kg</text>
        </g>
      </g>

      <!-- Rear Storage Locker (-2.25m) -->
      <g transform="translate(1015, 138)" class="pin-node" onclick="focusZone('rearStorage')" style="cursor: pointer;">
        <circle cx="0" cy="0" r="13" fill="#0f172a" stroke="#ffab00" stroke-width="2.5" filter="url(#neonGlow)"/>
        <text x="0" y="4" fill="#ffab00" font-size="9" font-weight="900" text-anchor="middle">RS</text>
        <g transform="translate(0, 18)">
          <rect x="-40" y="0" width="80" height="24" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#ffab00" stroke-width="1"/>
          <text x="0" y="10" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">-2.25m Rear</text>
          <text x="0" y="20" fill="#f1f5f9" font-size="10" font-family="Consolas, monospace" font-weight="800" text-anchor="middle">${Math.round(p.zones.rearStorage)} kg</text>
        </g>
      </g>
    </g>
  `;
}

// Update Zone Cards & Slider Displays
function updateStorageCards(p) {
  const cfg = getCaravanConfig();
  const hitchDist = p.caravan.hitchDist > 0 ? p.caravan.hitchDist : 5.0;

  // Dynamic Tank 1 (Front / Primary) Display & Labels
  const cardFrontTank = document.getElementById('card-frontTank');
  if (cardFrontTank) {
    if (!cfg.frontTank || !cfg.frontTank.enabled) {
      cardFrontTank.style.display = 'none';
    } else {
      cardFrontTank.style.display = '';
      const titleEl = document.getElementById('title-frontTank');
      const tagEl = document.getElementById('tag-frontTank');
      const subEl = document.getElementById('sub-frontTank');
      const sliderEl = document.getElementById('slider-frontTank');
      
      if (titleEl) {
        titleEl.textContent = (cfg.tankMode && cfg.tankMode.startsWith('single')) ? 'Caravan Water Tank' : cfg.frontTank.name;
      }
      
      const armVal = cfg.frontTank.leverArm;
      const armStr = armVal === 0 ? '0.00 m (Axle)' : (armVal > 0 ? `+${armVal.toFixed(2)} m` : `${armVal.toFixed(2)} m`);
      if (tagEl) {
        tagEl.textContent = armStr;
        tagEl.className = 'lever-arm-tag ' + (armVal > 0 ? 'front' : (armVal < 0 ? 'rear' : ''));
      }
      
      const ratio = (armVal / hitchDist).toFixed(2);
      if (subEl) {
        subEl.textContent = `${ratio >= 0 ? '+' : ''}${ratio}kg ball / kg`;
      }
      
      if (sliderEl) {
        sliderEl.min = -cfg.frontTank.capacity;
        sliderEl.max = 50;
      }

      const qFront = document.getElementById('quick-group-frontTank');
      if (qFront) {
        const cap = cfg.frontTank.capacity;
        const half = Math.round(cap / 2);
        qFront.innerHTML = `
          <button class="tank-btn" type="button" onclick="setQuickTank('frontTank', ${cap})">Full (${cap}L)</button>
          <button class="tank-btn" type="button" onclick="setQuickTank('frontTank', ${half})">Half (${half}L)</button>
          <button class="tank-btn" type="button" onclick="setQuickTank('frontTank', 0)">Dry (0L)</button>
        `;
      }
    }
  }

  // Dynamic Tank 2 (Rear / Secondary) Display & Labels
  const cardRearTank = document.getElementById('card-rearTank');
  if (cardRearTank) {
    if (!cfg.rearTank || !cfg.rearTank.enabled) {
      cardRearTank.style.display = 'none';
    } else {
      cardRearTank.style.display = '';
      const titleEl = document.getElementById('title-rearTank');
      const tagEl = document.getElementById('tag-rearTank');
      const subEl = document.getElementById('sub-rearTank');
      const sliderEl = document.getElementById('slider-rearTank');
      
      if (titleEl) {
        titleEl.textContent = cfg.rearTank.name;
      }
      
      const armVal = cfg.rearTank.leverArm;
      const armStr = armVal === 0 ? '0.00 m (Axle)' : (armVal > 0 ? `+${armVal.toFixed(2)} m` : `${armVal.toFixed(2)} m`);
      if (tagEl) {
        tagEl.textContent = armStr;
        tagEl.className = 'lever-arm-tag ' + (armVal > 0 ? 'front' : (armVal < 0 ? 'rear' : ''));
      }
      
      const ratio = (armVal / hitchDist).toFixed(2);
      if (subEl) {
        subEl.textContent = `${ratio >= 0 ? '+' : ''}${ratio}kg ball / kg`;
      }
      
      if (sliderEl) {
        sliderEl.min = -cfg.rearTank.capacity;
        sliderEl.max = 50;
      }

      const qRear = document.getElementById('quick-group-rearTank');
      if (qRear) {
        const cap = cfg.rearTank.capacity;
        const half = Math.round(cap / 2);
        qRear.innerHTML = `
          <button class="tank-btn" type="button" onclick="setQuickTank('rearTank', ${cap})">Full (${cap}L)</button>
          <button class="tank-btn" type="button" onclick="setQuickTank('rearTank', ${half})">Half (${half}L)</button>
          <button class="tank-btn" type="button" onclick="setQuickTank('rearTank', 0)">Dry (0L)</button>
        `;
      }
    }
  }

  // Water Balancer Presets Bar
  renderWaterBalancerUI();

  // Update Zone Weights & Sliders
  const zones = ['aFrame', 'frontStorage', 'frontTank', 'midStorage', 'rearTank', 'rearStorage', 'cabin', 'tub'];
  zones.forEach(zoneKey => {
    const totalEl = document.getElementById(`weight-${zoneKey}`);
    const offsetEl = document.getElementById(`offset-${zoneKey}`);
    const sliderEl = document.getElementById(`slider-${zoneKey}`);
    
    if (totalEl) totalEl.textContent = `${Math.round(p.zones[zoneKey])} kg`;
    
    const offset = state.sliderOffsets[zoneKey] || 0;
    if (offsetEl) {
      offsetEl.textContent = offset === 0 ? '0 kg' : (offset > 0 ? `+${offset} kg` : `${offset} kg`);
      offsetEl.style.color = offset === 0 ? 'var(--text-dim)' : (offset > 0 ? 'var(--accent-cyan)' : 'var(--status-warn)');
    }
    
    if (sliderEl && document.activeElement !== sliderEl) {
      sliderEl.value = offset;
    }
  });
}

// Render dynamic water balancer preset buttons
function renderWaterBalancerUI() {
  const container = document.getElementById('water-balancer-pills');
  if (!container) return;
  const cfg = getCaravanConfig();

  if (cfg.frontTank && cfg.frontTank.enabled && cfg.rearTank && cfg.rearTank.enabled) {
    const totalWater = cfg.frontTank.capacity + cfg.rearTank.capacity;
    container.innerHTML = `
      <button class="balancer-pill" type="button" onclick="setWaterPreset('both-full')">
        <span>💧💧 Both Full</span>
        <span class="sub">${totalWater}L Total</span>
      </button>
      <button class="balancer-pill" type="button" onclick="setWaterPreset('both-dry')">
        <span>🏜️ Both Empty</span>
        <span class="sub">Dry Travel (0L)</span>
      </button>
      <button class="balancer-pill" type="button" onclick="setWaterPreset('front-full-rear-dry')">
        <span>🔼 Front Full / Rear Dry</span>
        <span class="sub">+TBM Ballast</span>
      </button>
      <button class="balancer-pill" type="button" onclick="setWaterPreset('front-dry-rear-full')">
        <span>🔽 Front Dry / Rear Full</span>
        <span class="sub">-TBM Hitch Relief</span>
      </button>
    `;
  } else if ((cfg.frontTank && cfg.frontTank.enabled) || (cfg.rearTank && cfg.rearTank.enabled)) {
    const activeZone = (cfg.frontTank && cfg.frontTank.enabled) ? 'frontTank' : 'rearTank';
    const activeTank = (cfg.frontTank && cfg.frontTank.enabled) ? cfg.frontTank : cfg.rearTank;
    const cap = activeTank.capacity;
    const half = Math.round(cap / 2);
    container.innerHTML = `
      <button class="balancer-pill" type="button" onclick="setQuickTank('${activeZone}', ${cap})">
        <span>💧 Tank Full (${cap}L)</span>
        <span class="sub">100% Water Payload</span>
      </button>
      <button class="balancer-pill" type="button" onclick="setQuickTank('${activeZone}', ${half})">
        <span>💧 Tank Half (${half}L)</span>
        <span class="sub">50% Water Level</span>
      </button>
      <button class="balancer-pill" type="button" onclick="setQuickTank('${activeZone}', 0)">
        <span>🏜️ Tank Empty (0L)</span>
        <span class="sub">Dry Travel Weight</span>
      </button>
    `;
  } else {
    container.innerHTML = `
      <div style="font-size: 11px; color: var(--text-dim); padding: 4px 8px;">
        Water tanks disabled. Click <strong>"⚙️ Tank & Axle Setup"</strong> above to enable water tanks.
      </div>
    `;
  }
}

// Update 7 Telemetry Diagnostics Cards
function updateTelemetryChecklist(p) {
  const list = [
    { title: 'Vehicle Gross Mass (GVM)', curr: p.vehicleGVM, cap: p.vehicle.gvm, margin: p.margins.gvm, status: p.status.gvm },
    { title: 'Gross Combined Mass (GCM)', curr: p.gcm, cap: p.vehicle.gcm, margin: p.margins.gcm, status: p.status.gcm },
    { title: 'Caravan Aggregate Mass (ATM)', curr: p.trailerATM, cap: p.caravan.atm, margin: p.margins.atm, status: p.status.atm },
    { title: 'Towball Download (TBM)', curr: p.tbm, cap: p.vehicle.maxTbm, margin: p.margins.tbm, status: p.status.tbm },
    { title: 'Caravan Axle Load (GTM)', curr: p.trailerGTM, cap: p.caravan.maxGtm || (p.caravan.atm - p.caravan.tareTbm), margin: p.margins.gtm, status: p.status.gtm },
    { title: 'Vehicle Rear Axle Load', curr: p.rearAxleLoad, cap: p.vehicle.maxRearAxle, margin: p.margins.rearAxle, status: p.status.rearAxle },
    { title: 'Vehicle Front Axle Load', curr: p.frontAxleLoad, cap: p.vehicle.maxFrontAxle, margin: p.margins.frontAxle, status: p.status.frontAxle }
  ];

  const container = document.getElementById('telemetry-checklist');
  if (!container) return;

  container.innerHTML = list.map(item => {
    const badgeClass = item.status;
    const badgeLabel = item.status === 'pass' ? 'LEGAL' : (item.status === 'warn' ? 'CAUTION' : 'OVERLOAD');
    const marginText = item.margin !== null ? 
      (item.margin >= 0 ? `+${Math.round(item.margin)}kg Margin` : `${Math.round(item.margin)}kg Over`) : '--';

    return `
      <div class="telemetry-row-card">
        <div class="telemetry-row-left">
          <div class="telemetry-title">${item.title}</div>
          <div class="telemetry-detail">${marginText}</div>
        </div>
        <div class="telemetry-row-right">
          <div class="telemetry-nums">
            <div class="telemetry-curr">${Math.round(item.curr).toLocaleString()} kg</div>
            <div class="telemetry-cap">Max: ${item.cap ? item.cap.toLocaleString() + ' kg' : 'N/A'}</div>
          </div>
          <span class="compliance-badge ${badgeClass}">${badgeLabel}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Dynamic Intelligent Safety Advisor Engine
function updateSafetyAdvisor(p) {
  const container = document.getElementById('safety-advisor-list');
  if (!container) return;

  const alerts = [];

  // 1. Towball percentage / sway danger
  if (p.tbmPercent < 8.0) {
    alerts.push({
      type: 'fail',
      icon: '⚠️',
      text: `<strong>SWAY HAZARD (TBM: ${p.tbmPercent.toFixed(1)}%):</strong> Towball download is below the minimum safe 8% threshold. High risk of deadly fishtailing & aerodynamic sway at highway speeds! Shift at least ${Math.round((0.085 * p.trailerATM) - p.tbm)} kg of weight forward toward the tunnel boot or A-Frame.`
    });
  } else if (p.tbmPercent >= 8.0 && p.tbmPercent <= 11.5) {
    alerts.push({
      type: 'pass',
      icon: '🛡️',
      text: `<strong>OPTIMAL TOW STABILITY (TBM: ${p.tbmPercent.toFixed(1)}%):</strong> Tongue weight is perfectly balanced within the safe Australian 8% - 11.5% towing window. Rig will track straight and true with minimal yaw oscillation.`
    });
  } else if (p.tbmPercent > 11.5 && p.tbmPercent <= 12.5) {
    alerts.push({
      type: 'warn',
      icon: '⚖️',
      text: `<strong>HEAVY HITCH (TBM: ${p.tbmPercent.toFixed(1)}%):</strong> Downforce is elevated. Ensure towbar and chassis brackets are in top condition, and verify rear axle rating is not exceeded.`
    });
  } else {
    alerts.push({
      type: 'fail',
      icon: '🛑',
      text: `<strong>EXCESSIVE TOWBALL WEIGHT (TBM: ${p.tbmPercent.toFixed(1)}%):</strong> Over 12.5% download causes extreme rear suspension squat, unloading the steering axle and inducing hazardous understeer.`
    });
  }

  // 2. Front Axle Steering Unload Check
  const faDelta = Math.round(p.frontAxleLoad - p.vehicle.frontAxleTare);
  if (faDelta < -30) {
    alerts.push({
      type: 'fail',
      icon: '🛞',
      text: `<strong>FRONT STEERING UNLOADED (${faDelta} kg):</strong> Towball leverage over the rear overhang is acting as a lever, physically lifting weight off your steering tyres. In wet weather or emergency braking, this can cause dangerous loss of steering control!`
    });
  } else if (faDelta < 0) {
    alerts.push({
      type: 'warn',
      icon: 'ℹ️',
      text: `<strong>SLIGHT FRONT AXLE LIFT (${faDelta} kg):</strong> Front steering axle is slightly lighter than unladen tare. Safe for dry highway towing, but reduce speed in torrential rain.`
    });
  } else {
    alerts.push({
      type: 'pass',
      icon: '✅',
      text: `<strong>STEERING TRACTION SECURE (+${faDelta} kg):</strong> Cabin loading maintains positive downforce on front steering wheels.`
    });
  }

  // 3. Overall Legal Compliance
  const fails = [];
  if (p.status.gvm === 'fail') fails.push('Vehicle GVM exceeded');
  if (p.status.atm === 'fail') fails.push('Caravan ATM exceeded');
  if (p.status.gcm === 'fail') fails.push('Combined GCM exceeded');
  if (p.status.tbm === 'fail') fails.push('Towbar Rating exceeded');
  if (p.status.rearAxle === 'fail') fails.push('Rear Axle Rating exceeded');

  if (fails.length > 0) {
    alerts.push({
      type: 'fail',
      icon: '🚨',
      text: `<strong>NON-COMPLIANT RIG:</strong> The combination breaches ${fails.length} legal transport limits (${fails.join(', ')}). You will not be covered by insurance in an accident. Jettison or redistribute cargo.`
    });
  } else {
    alerts.push({
      type: 'pass',
      icon: '🌟',
      text: `<strong>100% LEGAL & COMPLIANT:</strong> All 7 Australian towing capacity thresholds (GVM, GCM, ATM, GTM, TBM, Front Axle, Rear Axle) are safely within manufacturer legal ratings.`
    });
  }

  container.innerHTML = alerts.map(a => `
    <div class="advisor-item ${a.type}">
      <span>${a.icon}</span>
      <div>${a.text}</div>
    </div>
  `).join('');
}

// Populate Dropdown Selectors
function populateSelectors() {
  const vehSelect = document.getElementById('vehicle-select');
  const vanSelect = document.getElementById('caravan-select');

  if (vehSelect && DEFAULT_TOWING_DATA.vehicles) {
    vehSelect.innerHTML = DEFAULT_TOWING_DATA.vehicles.map(v => `
      <option value="${v.id}" ${v.id === state.currentVehicleId ? 'selected' : ''}>
        ${v.name} (GVM: ${v.gvm}kg | GCM: ${v.gcm}kg)
      </option>
    `).join('') + `
      <option value="user-defined" ${state.currentVehicleId === 'user-defined' ? 'selected' : ''}>
        ⚡ User Defined (Custom Vehicle)
      </option>
    `;
  }

  if (vanSelect && DEFAULT_TOWING_DATA.caravans) {
    vanSelect.innerHTML = DEFAULT_TOWING_DATA.caravans.map(c => `
      <option value="${c.id}" ${c.id === state.currentCaravanId ? 'selected' : ''}>
        ${c.name} (Tare: ${c.tare}kg | ATM: ${c.atm}kg)
      </option>
    `).join('') + `
      <option value="user-defined" ${state.currentCaravanId === 'user-defined' ? 'selected' : ''}>
        ⚡ User Defined (Custom Van)
      </option>
    `;
  }
}

// Render Payload Inventory Table
function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  const filter = state.invFilter;
  const search = state.invSearch.toLowerCase().trim();

  const filtered = state.inventory.filter(item => {
    if (filter !== 'all') {
      if (filter === 'vehicle' && item.zone !== 'cabin' && item.zone !== 'tub') return false;
      if (filter === 'van' && (item.zone === 'cabin' || item.zone === 'tub')) return false;
      if (filter !== 'vehicle' && filter !== 'van' && item.zone !== filter) return false;
    }
    if (search && !item.name.toLowerCase().includes(search) && !item.category.toLowerCase().includes(search)) {
      return false;
    }
    return true;
  });

  document.getElementById('inv-count-badge').textContent = `${filtered.length} Items`;

  tbody.innerHTML = filtered.map((item, idx) => {
    const realIdx = state.inventory.indexOf(item);
    const weight = item.travelWeight || item.itemWeight || 0;
    return `
      <tr>
        <td style="width: 40px; text-align: center;">
          <input type="checkbox" class="inv-checkbox" data-idx="${realIdx}" ${item.packed ? 'checked' : ''}>
        </td>
        <td>
          <strong>${item.name}</strong>
          <div style="font-size: 11px; color: var(--text-muted);">${item.category || ''}</div>
        </td>
        <td>
          <span class="inv-badge-zone">${getZoneLabel(item.zone)}</span>
        </td>
        <td class="weight-cell">${item.itemWeight} kg</td>
        <td class="weight-cell" style="color: var(--accent-cyan); font-weight: 800;">
          ${item.packed ? weight + ' kg' : '<span style="color: var(--text-dim);">Unpacked</span>'}
        </td>
        <td style="text-align: right;">
          <button class="hud-btn" style="padding: 2px 8px; font-size: 10px;" onclick="deleteInventoryItem(${realIdx})">✕</button>
        </td>
      </tr>
    `;
  }).join('');
}

function getZoneLabel(zone) {
  const map = {
    cabin: 'Vehicle Cabin',
    tub: 'Vehicle Tub',
    aFrame: 'A-Frame (+3.75m)',
    frontStorage: 'Front Storage (+3.0m)',
    frontTank: 'Front Tank (+1.8m)',
    midStorage: 'Mid Storage (0.0m)',
    rearTank: 'Rear Tank (-1.5m)',
    rearStorage: 'Rear Storage (-2.25m)'
  };
  return map[zone] || zone;
}

// Bind DOM Events
function bindEvents() {
  // Vehicle selector
  document.getElementById('vehicle-select').addEventListener('change', (e) => {
    state.currentVehicleId = e.target.value;
    if (state.currentVehicleId === 'user-defined') {
      openVehicleModal();
    }
    playBlip();
    saveState();
    updateTelemetry();
  });

  // Caravan selector
  document.getElementById('caravan-select').addEventListener('change', (e) => {
    state.currentCaravanId = e.target.value;
    if (state.currentCaravanId === 'user-defined') {
      openCaravanModal();
    } else if (state.currentCaravanId === 'single-axle-van') {
      const cfg = getCaravanConfig();
      cfg.axleType = 'single';
    } else if (state.currentCaravanId === 'tandem-van') {
      const cfg = getCaravanConfig();
      cfg.axleType = 'tandem';
    }
    playBlip();
    saveState();
    updateTelemetry();
  });

  // Sliders
  const zones = ['aFrame', 'frontStorage', 'frontTank', 'midStorage', 'rearTank', 'rearStorage', 'cabin', 'tub'];
  zones.forEach(zone => {
    const slider = document.getElementById(`slider-${zone}`);
    if (slider) {
      slider.addEventListener('input', (e) => {
        state.sliderOffsets[zone] = parseFloat(e.target.value) || 0;
        updateTelemetry();
      });
      slider.addEventListener('change', () => {
        saveState();
      });
    }
  });

  // Inventory Table Checkbox Toggles
  document.getElementById('inventory-table-body').addEventListener('change', (e) => {
    if (e.target.classList.contains('inv-checkbox')) {
      const idx = parseInt(e.target.dataset.idx, 10);
      if (state.inventory[idx]) {
        state.inventory[idx].packed = e.target.checked;
        playBlip();
        saveState();
        renderInventoryTable();
        updateTelemetry();
      }
    }
  });

  // Inventory search
  const searchInput = document.getElementById('inv-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.invSearch = e.target.value;
      renderInventoryTable();
    });
  }

  // Inventory filter tabs
  document.querySelectorAll('.inv-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.invFilter = e.target.dataset.filter;
      renderInventoryTable();
    });
  });

  // Theme toggle
  document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    state.daylightMode = !state.daylightMode;
    document.body.classList.toggle('daylight-mode', state.daylightMode);
    document.getElementById('theme-toggle-btn').textContent = state.daylightMode ? '🌙 HUD Night Mode' : '☀️ Daylight Mode';
    saveState();
  });

  // Reset Baselines
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset all simulation sliders and return to the original spreadsheet baseline?')) {
      Object.keys(state.sliderOffsets).forEach(k => state.sliderOffsets[k] = 0);
      if (typeof DEFAULT_TOWING_DATA !== 'undefined' && DEFAULT_TOWING_DATA.inventory) {
        state.inventory = JSON.parse(JSON.stringify(DEFAULT_TOWING_DATA.inventory));
      }
      playChime();
      saveState();
      renderInventoryTable();
      updateTelemetry();
    }
  });

  // Print Manifest
  document.getElementById('print-manifest-btn').addEventListener('click', () => {
    generatePrintManifest();
  });

  // Drag & drop support for JPEG photo upload on the blueprint canvas wrap
  const canvasWrap = document.getElementById('blueprint-canvas-wrap');
  if (canvasWrap) {
    canvasWrap.addEventListener('dragover', (e) => {
      e.preventDefault();
      canvasWrap.classList.add('dragover');
    });
    canvasWrap.addEventListener('dragleave', () => {
      canvasWrap.classList.remove('dragover');
    });
    canvasWrap.addEventListener('drop', (e) => {
      e.preventDefault();
      canvasWrap.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        loadRigPhotoFile(e.dataTransfer.files[0]);
      }
    });
  }
}

// Quick Tank Presets
function setQuickTank(tankZone, liters) {
  const cfg = getCaravanConfig();
  const cap = (tankZone === 'frontTank') ? 
    (cfg.frontTank ? cfg.frontTank.capacity : 95) : 
    (cfg.rearTank ? cfg.rearTank.capacity : 95);
  
  const offset = liters - cap;
  state.sliderOffsets[tankZone] = offset;
  playBlip();
  saveState();
  updateTelemetry();
}

// Water Balancer Presets
function setWaterPreset(presetName) {
  const cfg = getCaravanConfig();
  const t1Cap = cfg.frontTank ? cfg.frontTank.capacity : 95;
  const t2Cap = cfg.rearTank ? cfg.rearTank.capacity : 95;

  if (presetName === 'both-full') {
    if (cfg.frontTank && cfg.frontTank.enabled) setQuickTank('frontTank', t1Cap);
    if (cfg.rearTank && cfg.rearTank.enabled) setQuickTank('rearTank', t2Cap);
  } else if (presetName === 'both-dry') {
    if (cfg.frontTank && cfg.frontTank.enabled) setQuickTank('frontTank', 0);
    if (cfg.rearTank && cfg.rearTank.enabled) setQuickTank('rearTank', 0);
  } else if (presetName === 'front-full-rear-dry') {
    if (cfg.frontTank && cfg.frontTank.enabled) setQuickTank('frontTank', t1Cap);
    if (cfg.rearTank && cfg.rearTank.enabled) setQuickTank('rearTank', 0);
  } else if (presetName === 'front-dry-rear-full') {
    if (cfg.frontTank && cfg.frontTank.enabled) setQuickTank('frontTank', 0);
    if (cfg.rearTank && cfg.rearTank.enabled) setQuickTank('rearTank', t2Cap);
  }
}

// Focus slider from SVG pin click
function focusZone(zoneKey) {
  const card = document.getElementById(`card-${zoneKey}`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.boxShadow = '0 0 20px var(--accent-cyan)';
    setTimeout(() => {
      card.style.boxShadow = '';
    }, 1200);
  }
}

// Save State to LocalStorage
function saveState() {
  try {
    localStorage.setItem('towing_hud_state_v1', JSON.stringify({
      payloadVersion: 4,
      currentVehicleId: state.currentVehicleId,
      currentCaravanId: state.currentCaravanId,
      caravanConfig: state.caravanConfig,
      sliderOffsets: state.sliderOffsets,
      inventory: state.inventory,
      customVehicle: state.customVehicle,
      customCaravan: state.customCaravan,
      daylightMode: state.daylightMode,
      carCockpitMode: !!state.carCockpitMode,
      rigViewMode: state.rigViewMode,
      rigPhotoUrl: state.rigPhotoUrl,
      photoOverlay: {
        showPins: state.photoOverlay.showPins,
        showDimensions: state.photoOverlay.showDimensions
      },
      photoPositions: state.photoPositions
    }));
  } catch (e) {
    console.warn('LocalStorage error', e);
  }
}

// ================= RIG PHOTO & VIEW MODE CONTROLLER =================

const DEFAULT_PHOTO_POSITIONS = {
  frontAxle: { x: 130, y: 360 },
  rearAxle: { x: 375, y: 360 },
  tbm: { x: 485, y: 340 },
  caravanAxle: { x: 815, y: 360 },
  // Storage pins
  cabin: { x: 230, y: 220 },
  tub: { x: 350, y: 250 },
  aFrame: { x: 550, y: 280 },
  frontStorage: { x: 620, y: 230 },
  frontTank: { x: 715, y: 340 },
  midStorage: { x: 815, y: 200 },
  rearTank: { x: 895, y: 340 },
  rearStorage: { x: 955, y: 230 }
};

// ================= RIG VECTOR VIEW ZOOM & PAN ENGINE =================
const rigZoom = {
  scale: 1.0,
  panX: 0,
  panY: 0,
  min: 0.8,
  max: 3.5,
  isPanning: false,
  startX: 0,
  startY: 0,
  hasMoved: false,
  downTime: 0,
  lastTapTime: 0,
  lastTapPos: { x: 0, y: 0 }
};

function getActiveRigStage() {
  return state.rigViewMode === 'photo'
    ? document.getElementById('rig-photo-stage')
    : document.getElementById('rig-blueprint-stage');
}

function clampPan() {
  const container = document.getElementById('blueprint-canvas-wrap');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const w = rect.width || 800;
  const h = rect.height || 350;
  
  if (rigZoom.scale <= 1.0) {
    rigZoom.panX = 0;
    rigZoom.panY = 0;
    return;
  }
  
  const maxPanX = Math.max(0, (w * (rigZoom.scale - 1)) / 2 + 100);
  const maxPanY = Math.max(0, (h * (rigZoom.scale - 1)) / 2 + 80);
  rigZoom.panX = Math.max(-maxPanX, Math.min(maxPanX, rigZoom.panX));
  rigZoom.panY = Math.max(-maxPanY, Math.min(maxPanY, rigZoom.panY));
}

function applyRigZoom() {
  const isPhoto = state.rigViewMode === 'photo';
  const bpStage = document.getElementById('rig-blueprint-stage');
  const photoStage = document.getElementById('rig-photo-stage');
  const target = isPhoto ? photoStage : bpStage;

  clampPan();

  if (target) {
    target.style.transformOrigin = 'center center';
    target.style.transform = `translate(${Math.round(rigZoom.panX)}px, ${Math.round(rigZoom.panY)}px) scale(${rigZoom.scale.toFixed(2)})`;
    target.style.transition = (rigZoom.isPanning || activeDragId) ? 'none' : 'transform 0.12s ease-out';
  }

  const pctText = `${Math.round(rigZoom.scale * 100)}%`;
  const label1 = document.getElementById('rig-zoom-label');
  const label2 = document.getElementById('floating-zoom-label');
  if (label1) label1.textContent = pctText;
  if (label2) label2.textContent = pctText;

  const badge = document.getElementById('rig-zoom-badge');
  const badgeText = document.getElementById('rig-zoom-badge-text');
  if (badge && badgeText) {
    if (rigZoom.scale > 1.02) {
      badge.style.display = 'flex';
      const hint = (isPhoto && state.photoOverlay && state.photoOverlay.calibrating)
        ? `🔍 ${pctText} • Drag pin to relocate | Drag empty space to pan`
        : `🔍 ${pctText} • Drag canvas to pan`;
      badgeText.textContent = hint;
    } else {
      badge.style.display = 'none';
    }
  }
}

function changeRigZoom(delta, focusPoint = null) {
  const oldScale = rigZoom.scale;
  let newScale = Math.round((oldScale + delta) * 100) / 100;
  newScale = Math.max(rigZoom.min, Math.min(rigZoom.max, newScale));
  if (newScale === oldScale) return;

  if (focusPoint && oldScale > 0) {
    const factor = newScale / oldScale;
    rigZoom.panX = focusPoint.x - (focusPoint.x - rigZoom.panX) * factor;
    rigZoom.panY = focusPoint.y - (focusPoint.y - rigZoom.panY) * factor;
  } else if (newScale <= 1.0) {
    rigZoom.panX = 0;
    rigZoom.panY = 0;
  }

  rigZoom.scale = newScale;
  applyRigZoom();
  playBlip();
}

function setRigZoomLevel(level) {
  rigZoom.scale = Math.max(rigZoom.min, Math.min(rigZoom.max, level));
  if (rigZoom.scale <= 1.0) {
    rigZoom.panX = 0;
    rigZoom.panY = 0;
  }
  applyRigZoom();
  playBlip();
}

function resetRigZoom() {
  rigZoom.scale = 1.0;
  rigZoom.panX = 0;
  rigZoom.panY = 0;
  applyRigZoom();
  playBlip();
}

function getPhotoPositions() {
  if (!state.photoPositions) {
    state.photoPositions = JSON.parse(JSON.stringify(DEFAULT_PHOTO_POSITIONS));
  } else {
    // Ensure all default keys exist if state was saved with an older schema
    for (const key in DEFAULT_PHOTO_POSITIONS) {
      if (!state.photoPositions[key]) {
        state.photoPositions[key] = { ...DEFAULT_PHOTO_POSITIONS[key] };
      }
    }
  }
  return state.photoPositions;
}

function initRigView() {
  // Check if rig.jpg exists in the folder if no user photo uploaded yet
  if (!state.rigPhotoUrl) {
    const testImg = new Image();
    testImg.onload = function() {
      state.rigPhotoUrl = 'rig.jpg';
      updateRigViewDisplay();
    };
    testImg.src = 'rig.jpg';
  }
  setupOverlayDragging();
  updateRigViewDisplay();
  applyRigZoom();
}

function setRigViewMode(mode) {
  state.rigViewMode = mode;
  resetRigZoom();
  updateRigViewDisplay();
  playBlip();
  saveState();
}

function updateRigViewDisplay() {
  const svgEl = document.getElementById('rig-blueprint-svg');
  const bpStage = document.getElementById('rig-blueprint-stage');
  const photoContainer = document.getElementById('rig-photo-container');
  const stage = document.getElementById('rig-photo-stage');
  const imgEl = document.getElementById('rig-photo-img');
  const dropzone = document.getElementById('photo-empty-dropzone');
  const removeBtn = document.getElementById('btn-remove-photo');
  const btnBlueprint = document.getElementById('btn-view-blueprint');
  const btnPhoto = document.getElementById('btn-view-photo');
  const photoControls = document.getElementById('photo-overlay-controls');

  if (btnBlueprint && btnPhoto) {
    btnBlueprint.classList.toggle('active', state.rigViewMode === 'blueprint');
    btnPhoto.classList.toggle('active', state.rigViewMode === 'photo');
  }

  if (photoControls) {
    photoControls.style.display = state.rigViewMode === 'photo' ? 'flex' : 'none';
  }

  const pinBtn = document.getElementById('btn-toggle-pins');
  if (pinBtn) pinBtn.classList.toggle('active', !!state.photoOverlay.showPins);
  const dimsBtn = document.getElementById('btn-toggle-dims');
  if (dimsBtn) dimsBtn.classList.toggle('active', !!state.photoOverlay.showDimensions);

  if (state.rigViewMode === 'photo') {
    if (bpStage) bpStage.style.display = 'none';
    if (svgEl) svgEl.style.display = 'none';
    if (photoContainer) photoContainer.style.display = 'flex';

    if (state.rigPhotoUrl) {
      if (stage) stage.style.display = 'block';
      if (imgEl) {
        imgEl.onload = () => renderPhotoOverlay(computePhysics());
        if (imgEl.getAttribute('src') !== state.rigPhotoUrl) {
          imgEl.src = state.rigPhotoUrl;
        } else if (imgEl.complete && imgEl.naturalWidth) {
          renderPhotoOverlay(computePhysics());
        }
      }
      if (dropzone) dropzone.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
      if (stage) stage.style.display = 'none';
      if (dropzone) dropzone.style.display = 'flex';
      if (removeBtn) removeBtn.style.display = 'none';
    }
  } else {
    if (bpStage) bpStage.style.display = 'flex';
    if (svgEl) svgEl.style.display = 'block';
    if (photoContainer) photoContainer.style.display = 'none';
    if (removeBtn) removeBtn.style.display = state.rigPhotoUrl ? 'inline-flex' : 'none';
  }

  applyRigZoom();
}
function handleRigPhotoUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  loadRigPhotoFile(file);
}

function loadRigPhotoFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file (JPEG, PNG, WebP).');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(evt) {
    state.rigPhotoUrl = evt.target.result;
    state.rigViewMode = 'photo';
    updateRigViewDisplay();
    saveState();
    playChime();
  };
  reader.readAsDataURL(file);
}

function removeRigPhoto() {
  if (confirm('Remove custom rig photo and switch back to blueprint vector?')) {
    state.rigPhotoUrl = null;
    state.rigViewMode = 'blueprint';
    updateRigViewDisplay();
    saveState();
    playBlip();
  }
}

// Render Photo Telemetry Dock (Live HUD metrics under the photo)
function renderPhotoTelemetryDock(p) {
  const dock = document.getElementById('photo-telemetry-dock');
  if (!dock) return;

  const faKg = Math.round(p.frontAxleLoad);
  const raKg = Math.round(p.rearAxleLoad);
  const tbmKg = Math.round(p.tbm);
  const gtmKg = Math.round(p.trailerGTM);

  const faDelta = faKg - p.vehicle.frontAxleTare;
  const faStatus = p.status.frontAxle;
  const raStatus = p.status.rearAxle;
  const tbmStatus = p.status.tbm;
  const gtmStatus = p.status.gtm;

  dock.innerHTML = `
    <div class="photo-tele-card ${faStatus}">
      <div class="tele-card-head">
        <span>Front Steer Axle</span>
        <span class="compliance-badge ${faStatus}">${faStatus.toUpperCase()}</span>
      </div>
      <div class="tele-card-val">${faKg.toLocaleString()} kg</div>
      <div class="tele-card-sub">Max: ${p.vehicle.maxFrontAxle || '--'}kg | ${faDelta < 0 ? '⚠️ Lift ' + faDelta + 'kg' : '+' + faDelta + 'kg Grip'}</div>
    </div>

    <div class="photo-tele-card ${tbmStatus}">
      <div class="tele-card-head">
        <span>Towball Download</span>
        <span class="compliance-badge ${tbmStatus}">${p.status.tbmRatio === 'pass' ? 'OPTIMAL' : (p.status.tbmRatio === 'fail' ? 'SWAY HAZARD' : 'HEAVY')}</span>
      </div>
      <div class="tele-card-val">${tbmKg.toLocaleString()} kg</div>
      <div class="tele-card-sub">Ratio: ${p.tbmPercent.toFixed(2)}% of ATM | Max: ${p.vehicle.maxTbm}kg</div>
    </div>

    <div class="photo-tele-card ${raStatus}">
      <div class="tele-card-head">
        <span>Rear Drive Axle</span>
        <span class="compliance-badge ${raStatus}">${raStatus.toUpperCase()}</span>
      </div>
      <div class="tele-card-val">${raKg.toLocaleString()} kg</div>
      <div class="tele-card-sub">Max: ${p.vehicle.maxRearAxle || '--'}kg | ${(1 + p.cantileverRatio).toFixed(2)}x Cantilever</div>
    </div>

    <div class="photo-tele-card ${gtmStatus}">
      <div class="tele-card-head">
        <span>Caravan Tyres (GTM)</span>
        <span class="compliance-badge ${gtmStatus}">${gtmStatus.toUpperCase()}</span>
      </div>
      <div class="tele-card-val">${gtmKg.toLocaleString()} kg</div>
      <div class="tele-card-sub">Max: ${p.caravan.maxGtm || '--'}kg | ATM: ${Math.round(p.trailerATM)}kg</div>
    </div>
  `;
}

// ================= LIVE HUD PHOTO OVERLAY & CALIBRATION =================

let activeDragId = null;

function setupOverlayDragging() {
  const overlay = document.getElementById('photo-data-overlay');
  const canvasWrap = document.getElementById('blueprint-canvas-wrap');
  if (!canvasWrap || canvasWrap._interactionsSetup) return;
  canvasWrap._interactionsSetup = true;

  function getSvgPoint(e) {
    if (!overlay) return { x: 500, y: 250 };
    const rect = overlay.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 500, y: 250 };
    const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
    const x = Math.round(Math.max(15, Math.min(985, ((clientX - rect.left) / rect.width) * 1000)));
    const y = Math.round(Math.max(15, Math.min(485, ((clientY - rect.top) / rect.height) * 500)));
    return { x, y };
  }

  // Pointer Down on canvas wrap
  canvasWrap.addEventListener('pointerdown', (e) => {
    // If click was on a floating HUD button, let the button handle it
    if (e.target.closest('.rig-floating-zoom-pill, .rig-zoom-toolbar, .cal-banner-actions')) return;

    rigZoom.downTime = Date.now();
    rigZoom.hasMoved = false;
    rigZoom.startX = e.clientX - rigZoom.panX;
    rigZoom.startY = e.clientY - rigZoom.panY;

    const isPhoto = state.rigViewMode === 'photo';
    const isCalibrating = !!(state.photoOverlay && state.photoOverlay.calibrating);

    if (isPhoto && isCalibrating && overlay) {
      const pinTarget = e.target.closest('[data-drag-id]');
      if (pinTarget) {
        activeDragId = pinTarget.getAttribute('data-drag-id');
        try { overlay.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
        return;
      }
    }

    // Canvas panning when zoomed in or when in calibration/blueprint mode
    if (rigZoom.scale > 1.01 || (isPhoto && isCalibrating)) {
      rigZoom.isPanning = true;
      try { canvasWrap.setPointerCapture(e.pointerId); } catch (_) {}
    }
  });

  // Pointer Move on window
  window.addEventListener('pointermove', (e) => {
    if (activeDragId && state.photoOverlay && state.photoOverlay.calibrating) {
      const pt = getSvgPoint(e);
      const pos = getPhotoPositions();
      if (pos[activeDragId]) {
        pos[activeDragId].x = pt.x;
        pos[activeDragId].y = pt.y;
        renderPhotoOverlay(computePhysics());
      }
      return;
    }

    if (rigZoom.isPanning) {
      const newPanX = e.clientX - rigZoom.startX;
      const newPanY = e.clientY - rigZoom.startY;
      if (Math.abs(newPanX - rigZoom.panX) > 3 || Math.abs(newPanY - rigZoom.panY) > 3) {
        rigZoom.hasMoved = true;
      }
      rigZoom.panX = newPanX;
      rigZoom.panY = newPanY;
      applyRigZoom();
    }
  });

  // Pointer Up / Cancel on window
  function stopInteraction(e) {
    if (activeDragId) {
      activeDragId = null;
      saveState();
      if (overlay) {
        try { overlay.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    }

    if (rigZoom.isPanning) {
      rigZoom.isPanning = false;
      try { canvasWrap.releasePointerCapture(e.pointerId); } catch (_) {}
      applyRigZoom();
    }

    // Double-tap detector
    const now = Date.now();
    const tapDist = Math.hypot(e.clientX - rigZoom.lastTapPos.x, e.clientY - rigZoom.lastTapPos.y);
    if (now - rigZoom.lastTapTime < 320 && tapDist < 25 && !rigZoom.hasMoved) {
      if (rigZoom.scale <= 1.05) {
        setRigZoomLevel(2.0);
      } else {
        resetRigZoom();
      }
      rigZoom.lastTapTime = 0;
    } else {
      rigZoom.lastTapTime = now;
      rigZoom.lastTapPos = { x: e.clientX, y: e.clientY };
    }
  }

  window.addEventListener('pointerup', stopInteraction);
  window.addEventListener('pointercancel', stopInteraction);

  // Wheel zoom on canvas
  canvasWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    changeRigZoom(delta);
  }, { passive: false });

  // Touch Pinch-to-zoom
  let touchStartDist = 0;
  let touchStartScale = 1.0;

  canvasWrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      touchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartScale = rigZoom.scale;
    }
  }, { passive: true });

  canvasWrap.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && touchStartDist > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartDist;
      let newScale = Math.round(touchStartScale * ratio * 100) / 100;
      newScale = Math.max(rigZoom.min, Math.min(rigZoom.max, newScale));
      rigZoom.scale = newScale;
      applyRigZoom();
      e.preventDefault();
    }
  }, { passive: false });
}

function onOverlayPinClick(id) {
  if (state.photoOverlay.calibrating || rigZoom.hasMoved) return;
  focusZone(id);
  playBlip();
}

function toggleOverlayCalibration() {
  state.photoOverlay.calibrating = !state.photoOverlay.calibrating;
  const btn = document.getElementById('btn-calibrate-overlay');
  const banner = document.getElementById('calibration-banner');
  if (btn) {
    btn.classList.toggle('active', state.photoOverlay.calibrating);
    btn.innerHTML = state.photoOverlay.calibrating ? '✓ Done Calibrating' : '🎯 Calibrate Pins';
  }
  if (banner) {
    banner.style.display = state.photoOverlay.calibrating ? 'flex' : 'none';
  }
  // Auto-zoom on mobile when entering calibration mode to make pins larger & easy to grab
  if (state.photoOverlay.calibrating && rigZoom.scale <= 1.05 && window.innerWidth <= 768) {
    setRigZoomLevel(1.5);
  }
  renderPhotoOverlay(computePhysics());
  applyRigZoom();
  playBlip();
}

function toggleOverlayOption(opt) {
  if (opt === 'pins') {
    state.photoOverlay.showPins = !state.photoOverlay.showPins;
    const btn = document.getElementById('btn-toggle-pins');
    if (btn) btn.classList.toggle('active', state.photoOverlay.showPins);
  } else if (opt === 'dims') {
    state.photoOverlay.showDimensions = !state.photoOverlay.showDimensions;
    const btn = document.getElementById('btn-toggle-dims');
    if (btn) btn.classList.toggle('active', state.photoOverlay.showDimensions);
  }
  saveState();
  renderPhotoOverlay(computePhysics());
  playBlip();
}

function resetOverlayPositions() {
  if (confirm('Reset all pin and marker positions to default layout?')) {
    state.photoPositions = JSON.parse(JSON.stringify(DEFAULT_PHOTO_POSITIONS));
    saveState();
    renderPhotoOverlay(computePhysics());
    playChime();
  }
}

async function checkForUpdates() {
  const btn = document.getElementById('update-check-btn');
  if (btn) btn.innerHTML = '⏳ Refreshing...';
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let reg of registrations) {
        await reg.update();
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      for (let key of cacheKeys) {
        await caches.delete(key);
      }
    }
    window.location.reload(true);
  } catch (e) {
    window.location.reload();
  }
}

// Render dynamic HUD telemetry overlay directly onto the user's JPEG rig photo
function renderPhotoOverlay(p) {
  const overlay = document.getElementById('photo-data-overlay');
  if (!overlay) return;
  if (!p) p = computePhysics();
  const cfg = getCaravanConfig();

  const pos = getPhotoPositions();
  const isCalibrating = !!state.photoOverlay.calibrating;

  const colors = {
    pass: '#00e676',
    warn: '#ffab00',
    fail: '#ff1744'
  };

  const faCol = colors[p.status.frontAxle] || colors.pass;
  const raCol = colors[p.status.rearAxle] || colors.pass;
  const tbmCol = colors[p.status.tbm] || colors.pass;
  const gtmCol = colors[p.status.gtm] || colors.pass;

  const fa = pos.frontAxle || DEFAULT_PHOTO_POSITIONS.frontAxle;
  const ra = pos.rearAxle || DEFAULT_PHOTO_POSITIONS.rearAxle;
  const tbm = pos.tbm || DEFAULT_PHOTO_POSITIONS.tbm;
  const ca = pos.caravanAxle || DEFAULT_PHOTO_POSITIONS.caravanAxle;

  let html = `
    <defs>
      <!-- Neon Downward Arrow marker for Towball Hitch -->
      <marker id="neon-down-arrow" markerWidth="10" markerHeight="10" refX="5" refY="7" orient="auto">
        <path d="M 0 0 L 10 0 L 5 8 Z" fill="${tbmCol}" />
      </marker>
      <!-- Dimension Arrowheads -->
      <marker id="dim-arrow-start" markerWidth="6" markerHeight="6" refX="2" refY="3" orient="auto">
        <path d="M 6 0 L 0 3 L 6 6 Z" fill="#38bdf8" />
      </marker>
      <marker id="dim-arrow-end" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
        <path d="M 0 0 L 6 3 L 0 6 Z" fill="#38bdf8" />
      </marker>
    </defs>
  `;

  // 1. Dimension Lines (Wheelbase, Overhang, Hitch Distance)
  if (state.photoOverlay.showDimensions) {
    const dimY = 405;
    html += `
      <!-- Dimension: Wheelbase (Front to Rear Axle) -->
      <g opacity="0.85">
        <line x1="${fa.x}" y1="${dimY}" x2="${ra.x}" y2="${dimY}" stroke="#38bdf8" stroke-width="1.8" stroke-dasharray="4 3" marker-start="url(#dim-arrow-start)" marker-end="url(#dim-arrow-end)" />
        <line x1="${fa.x}" y1="${fa.y}" x2="${fa.x}" y2="${dimY + 8}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 3" opacity="0.5" />
        <line x1="${ra.x}" y1="${ra.y}" x2="${ra.x}" y2="${dimY + 8}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 3" opacity="0.5" />
        <rect x="${((fa.x + ra.x) / 2) - 48}" y="${dimY - 11}" width="96" height="20" rx="4" fill="rgba(10, 15, 29, 0.9)" stroke="#38bdf8" stroke-width="1" />
        <text x="${(fa.x + ra.x) / 2}" y="${dimY + 3}" text-anchor="middle" fill="#38bdf8" font-size="10" font-weight="700">WB: ${p.vehicle.wheelbase.toFixed(2)}m</text>
      </g>

      <!-- Dimension: Overhang (Rear Axle to Towball) -->
      <g opacity="0.85">
        <line x1="${ra.x}" y1="${dimY}" x2="${tbm.x}" y2="${dimY}" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="4 3" marker-start="url(#dim-arrow-start)" marker-end="url(#dim-arrow-end)" />
        <line x1="${tbm.x}" y1="${tbm.y}" x2="${tbm.x}" y2="${dimY + 8}" stroke="#f59e0b" stroke-width="1" stroke-dasharray="2 3" opacity="0.5" />
        <rect x="${((ra.x + tbm.x) / 2) - 42}" y="${dimY - 11}" width="84" height="20" rx="4" fill="rgba(10, 15, 29, 0.9)" stroke="#f59e0b" stroke-width="1" />
        <text x="${(ra.x + tbm.x) / 2}" y="${dimY + 3}" text-anchor="middle" fill="#f59e0b" font-size="10" font-weight="700">OH: ${p.vehicle.overhang.toFixed(2)}m</text>
      </g>

      <!-- Dimension: Hitch to Caravan Axle -->
      <g opacity="0.85">
        <line x1="${tbm.x}" y1="${dimY}" x2="${ca.x}" y2="${dimY}" stroke="#a78bfa" stroke-width="1.8" stroke-dasharray="4 3" marker-start="url(#dim-arrow-start)" marker-end="url(#dim-arrow-end)" />
        <line x1="${ca.x}" y1="${ca.y}" x2="${ca.x}" y2="${dimY + 8}" stroke="#a78bfa" stroke-width="1" stroke-dasharray="2 3" opacity="0.5" />
        <rect x="${((tbm.x + ca.x) / 2) - 52}" y="${dimY - 11}" width="104" height="20" rx="4" fill="rgba(10, 15, 29, 0.9)" stroke="#a78bfa" stroke-width="1" />
        <text x="${(tbm.x + ca.x) / 2}" y="${dimY + 3}" text-anchor="middle" fill="#a78bfa" font-size="10" font-weight="700">HITCH: ${p.caravan.hitchDist.toFixed(2)}m</text>
      </g>
    `;
  }

  // Helper for Axle telemetry cards at bottom (y: 420, height: 58)
  function renderAxleCard(x, yAnchor, title, valKg, statusCol, subtext, dragId) {
    const cardW = 142;
    const cardH = 58;
    const cardX = Math.max(10, Math.min(990 - cardW, x - cardW / 2));
    const cardY = 428;
    return `
      <g class="overlay-node ${isCalibrating ? 'calibrating' : ''}" data-drag-id="${dragId}">
        <!-- Leader line from anchor dot to card -->
        <line x1="${x}" y1="${yAnchor}" x2="${cardX + cardW / 2}" y2="${cardY}" stroke="${statusCol}" stroke-width="2" stroke-dasharray="4 3" />
        
        <!-- Card Backdrop -->
        <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="7" fill="rgba(10, 15, 29, 0.92)" stroke="${statusCol}" stroke-width="1.8" />
        
        <!-- Card Text -->
        <text x="${cardX + cardW / 2}" y="${cardY + 16}" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="800" letter-spacing="0.6">${title}</text>
        <text x="${cardX + cardW / 2}" y="${cardY + 37}" text-anchor="middle" fill="#f8fafc" font-size="16" font-weight="800" font-family="Consolas, monospace">${valKg}</text>
        <text x="${cardX + cardW / 2}" y="${cardY + 50}" text-anchor="middle" fill="${statusCol}" font-size="9" font-weight="700">${subtext}</text>

        <!-- Hub Anchor Dot -->
        <circle cx="${x}" cy="${yAnchor}" r="8" fill="${statusCol}" stroke="#ffffff" stroke-width="2.5" />
        ${isCalibrating ? `
          <!-- Pulsing calibration drag ring with generous touch hit target -->
          <circle cx="${x}" cy="${yAnchor}" r="28" fill="rgba(0,0,0,0.001)" />
          <circle cx="${x}" cy="${yAnchor}" r="18" fill="none" stroke="#00f2fe" stroke-width="2" stroke-dasharray="3 3" class="drag-handle" />
          <text x="${x}" y="${yAnchor - 12}" text-anchor="middle" fill="#00f2fe" font-size="9" font-weight="800">DRAG</text>
        ` : ''}
      </g>
    `;
  }

  // 2. Front Axle Card
  const faMargin = p.margins.frontAxle !== null ? (p.margins.frontAxle >= 0 ? '+' : '') + Math.round(p.margins.frontAxle) + ' kg' : p.status.frontAxle.toUpperCase();
  html += renderAxleCard(fa.x, fa.y, 'FRONT AXLE LOAD', `${Math.round(p.frontAxleLoad).toLocaleString()} kg`, faCol, `Margin: ${faMargin}`, 'frontAxle');

  // 3. Rear Axle Card
  const raMargin = p.margins.rearAxle !== null ? (p.margins.rearAxle >= 0 ? '+' : '') + Math.round(p.margins.rearAxle) + ' kg' : p.status.rearAxle.toUpperCase();
  html += renderAxleCard(ra.x, ra.y, 'REAR AXLE LOAD', `${Math.round(p.rearAxleLoad).toLocaleString()} kg`, raCol, `Margin: ${raMargin}`, 'rearAxle');

  // 4. Caravan Axles (GTM) Card - Dynamic Single or Tandem Axle title
  const gtmMargin = p.margins.gtm !== null ? (p.margins.gtm >= 0 ? '+' : '') + Math.round(p.margins.gtm) + ' kg' : p.status.gtm.toUpperCase();
  const caravanAxleTitle = cfg.axleType === 'single' ? 'SINGLE AXLE CARAVAN (GTM)' : 'TANDEM CARAVAN (GTM)';
  html += renderAxleCard(ca.x, ca.y, caravanAxleTitle, `${Math.round(p.trailerGTM).toLocaleString()} kg`, gtmCol, `Margin: ${gtmMargin}`, 'caravanAxle');

  // 5. Towball Download (TBM) - Elevated Card & Bold Neon Downforce Arrow
  const tbmCardW = 186;
  const tbmCardH = 62;
  const tbmCardX = Math.max(10, Math.min(990 - tbmCardW, tbm.x - tbmCardW / 2));
  const tbmCardY = 18;
  const tbmMargin = (p.margins.tbm >= 0 ? '+' : '') + Math.round(p.margins.tbm) + ' kg';

  html += `
    <g class="overlay-node ${isCalibrating ? 'calibrating' : ''}" data-drag-id="tbm">
      <!-- Neon Downforce Vector Line pointing from Elevated Card directly to Tow Hitch -->
      <line x1="${tbmCardX + tbmCardW / 2}" y1="${tbmCardY + tbmCardH}" x2="${tbm.x}" y2="${tbm.y - 12}" stroke="${tbmCol}" stroke-width="3" marker-end="url(#neon-down-arrow)" />

      <!-- Elevated TBM Card -->
      <rect x="${tbmCardX}" y="${tbmCardY}" width="${tbmCardW}" height="${tbmCardH}" rx="8" fill="rgba(10, 15, 29, 0.94)" stroke="${tbmCol}" stroke-width="2" />
      <text x="${tbmCardX + tbmCardW / 2}" y="${tbmCardY + 18}" text-anchor="middle" fill="#38bdf8" font-size="10.5" font-weight="800" letter-spacing="0.6">TOWBALL DOWNLOAD (TBM)</text>
      <text x="${tbmCardX + tbmCardW / 2}" y="${tbmCardY + 40}" text-anchor="middle" fill="#ffffff" font-size="18" font-weight="800" font-family="Consolas, monospace">${Math.round(p.tbm).toLocaleString()} kg · ${p.tbmPercent.toFixed(1)}%</text>
      <text x="${tbmCardX + tbmCardW / 2}" y="${tbmCardY + 54}" text-anchor="middle" fill="${tbmCol}" font-size="9.5" font-weight="700">Margin: ${tbmMargin} · Cap: ${p.vehicle.maxTbm} kg</text>

      <!-- Hitch Anchor Point & Touch Target -->
      <circle cx="${tbm.x}" cy="${tbm.y}" r="8" fill="${tbmCol}" stroke="#ffffff" stroke-width="2.5" />
      ${isCalibrating ? `
        <circle cx="${tbm.x}" cy="${tbm.y}" r="28" fill="rgba(0,0,0,0.001)" />
        <circle cx="${tbm.x}" cy="${tbm.y}" r="18" fill="none" stroke="#00f2fe" stroke-width="2" stroke-dasharray="3 3" class="drag-handle" />
        <text x="${tbm.x}" y="${tbm.y - 14}" text-anchor="middle" fill="#00f2fe" font-size="9" font-weight="800">DRAG</text>
      ` : ''}
    </g>
  `;

  // 6. Storage Compartment Pins (if enabled)
  if (state.photoOverlay.showPins) {
    const z = (p && (p.zones || p.storage)) || {};
    const pins = [
      { id: 'cabin', code: 'CAB', label: 'Cabin Occupants & Gear', kg: Math.round(z.cabin || 0), stroke: '#38bdf8' },
      { id: 'tub', code: 'TUB', label: 'Tub / Tray Cargo', kg: Math.round(z.tub || 0), stroke: '#38bdf8' },
      { id: 'aFrame', code: 'AF', label: 'A-Frame Toolboxes (+3.75m)', kg: Math.round(z.aFrame || 0), stroke: '#00e676' },
      { id: 'frontStorage', code: 'FS', label: 'Front Storage (+3.0m)', kg: Math.round(z.frontStorage || 0), stroke: '#00e676' },
      ...(cfg.frontTank && cfg.frontTank.enabled ? [{
        id: 'frontTank',
        code: (cfg.tankMode && cfg.tankMode.startsWith('single')) ? 'WT' : 'FW',
        label: `${(cfg.tankMode && cfg.tankMode.startsWith('single')) ? 'Water Tank' : cfg.frontTank.name} (${cfg.frontTank.leverArm >= 0 ? '+' : ''}${cfg.frontTank.leverArm.toFixed(2)}m)`,
        kg: Math.round(z.frontTank || 0),
        stroke: '#38bdf8',
        isWater: true
      }] : []),
      { id: 'midStorage', code: 'MID', label: 'Mid Internal / Pantry (0.0m)', kg: Math.round(z.midStorage || 0), stroke: '#a855f7' },
      ...(cfg.rearTank && cfg.rearTank.enabled ? [{
        id: 'rearTank',
        code: 'RW',
        label: `${cfg.rearTank.name} (${cfg.rearTank.leverArm >= 0 ? '+' : ''}${cfg.rearTank.leverArm.toFixed(2)}m)`,
        kg: Math.round(z.rearTank || 0),
        stroke: '#38bdf8',
        isWater: true
      }] : []),
      { id: 'rearStorage', code: 'RS', label: 'Rear Bumper / Lockers (-2.25m)', kg: Math.round(z.rearStorage || 0), stroke: '#f59e0b' }
    ];

    pins.forEach(pin => {
      const pt = pos[pin.id] || DEFAULT_PHOTO_POSITIONS[pin.id];
      if (!pt) return;
      const pillW = 76;
      const pillH = 26;
      const pillX = pt.x - pillW / 2;
      const pillY = pt.y - pillH / 2;
      const unit = pin.isWater ? 'L' : 'kg';

      html += `
        <g class="overlay-node ${isCalibrating ? 'calibrating' : ''}" data-drag-id="${pin.id}" onclick="onOverlayPinClick('${pin.id}')" style="cursor: pointer;">
          <title>${pin.label}: ${pin.kg} ${unit} (Click to scroll to slider)</title>
          
          <!-- Anchor leader stem / dot -->
          <circle cx="${pt.x}" cy="${pt.y + 16}" r="3.5" fill="${pin.stroke}" />
          <line x1="${pt.x}" y1="${pillY + pillH}" x2="${pt.x}" y2="${pt.y + 16}" stroke="${pin.stroke}" stroke-width="1.5" stroke-dasharray="2 2" />

          <!-- Glow tag pill -->
          <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="13" fill="rgba(10, 15, 29, 0.94)" stroke="${pin.stroke}" stroke-width="2" />
          <circle cx="${pillX + 13}" cy="${pt.y}" r="4" fill="${pin.stroke}" />
          <text x="${pillX + 22}" y="${pt.y + 4}" fill="#f8fafc" font-size="10.5" font-weight="800" font-family="Consolas, monospace">${pin.code}: ${pin.kg}${unit}</text>
          
          ${isCalibrating ? `
            <circle cx="${pt.x}" cy="${pt.y}" r="32" fill="rgba(0,0,0,0.001)" />
            <circle cx="${pt.x}" cy="${pt.y}" r="22" fill="none" stroke="#00f2fe" stroke-width="2.5" stroke-dasharray="3 3" class="drag-handle" />
            <text x="${pt.x}" y="${pillY - 6}" text-anchor="middle" fill="#00f2fe" font-size="9" font-weight="900">DRAG</text>
          ` : ''}
        </g>
      `;
    });
  }

  overlay.innerHTML = html;
  setupOverlayDragging();
}

// Audio Feedback using Web Audio API (Synthesizer, zero assets needed)
function playBlip() {
  if (!state.audioEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
}

function playChime() {
  if (!state.audioEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

// Modal Handlers
function openVehicleModal() {
  const v = getActiveVehicle();
  document.getElementById('modal-veh-name').value = v.name;
  document.getElementById('modal-veh-tare').value = v.tare;
  document.getElementById('modal-veh-gvm').value = v.gvm;
  document.getElementById('modal-veh-gcm').value = v.gcm;
  document.getElementById('modal-veh-tbm').value = v.maxTbm;
  document.getElementById('modal-veh-wb').value = v.wheelbase;
  document.getElementById('modal-veh-oh').value = v.overhang;
  document.getElementById('modal-veh-ra-tare').value = v.rearAxleTare;
  document.getElementById('modal-veh-fa-tare').value = v.frontAxleTare;
  document.getElementById('modal-veh-ra-max').value = v.maxRearAxle || 0;
  document.getElementById('modal-veh-fa-max').value = v.maxFrontAxle || 0;
  
  document.getElementById('vehicle-modal').classList.add('active');
}

function saveVehicleModal() {
  state.customVehicle = {
    id: 'user-defined',
    name: document.getElementById('modal-veh-name').value || 'Custom Tow Vehicle',
    tare: parseFloat(document.getElementById('modal-veh-tare').value) || 2000,
    gvm: parseFloat(document.getElementById('modal-veh-gvm').value) || 3000,
    gcm: parseFloat(document.getElementById('modal-veh-gcm').value) || 6000,
    maxTbm: parseFloat(document.getElementById('modal-veh-tbm').value) || 350,
    wheelbase: parseFloat(document.getElementById('modal-veh-wb').value) || 3.1,
    overhang: parseFloat(document.getElementById('modal-veh-oh').value) || 1.25,
    rearAxleTare: parseFloat(document.getElementById('modal-veh-ra-tare').value) || 1000,
    frontAxleTare: parseFloat(document.getElementById('modal-veh-fa-tare').value) || 1000,
    maxRearAxle: parseFloat(document.getElementById('modal-veh-ra-max').value) || 1950,
    maxFrontAxle: parseFloat(document.getElementById('modal-veh-fa-max').value) || 1450
  };
  state.currentVehicleId = 'user-defined';
  populateSelectors();
  closeModal('vehicle-modal');
  saveState();
  updateTelemetry();
}

function openCaravanModal() {
  const c = getActiveCaravan();
  document.getElementById('modal-van-name').value = c.name;
  document.getElementById('modal-van-tare').value = c.tare;
  document.getElementById('modal-van-tbm').value = c.tareTbm;
  document.getElementById('modal-van-atm').value = c.atm;
  document.getElementById('modal-van-hitch').value = c.hitchDist;
  document.getElementById('modal-van-gtm').value = c.maxGtm || (c.atm - c.tareTbm);
  
  document.getElementById('caravan-modal').classList.add('active');
}

function saveCaravanModal() {
  state.customCaravan = {
    id: 'user-defined',
    name: document.getElementById('modal-van-name').value || 'Custom Caravan',
    tare: parseFloat(document.getElementById('modal-van-tare').value) || 2500,
    tareTbm: parseFloat(document.getElementById('modal-van-tbm').value) || 200,
    atm: parseFloat(document.getElementById('modal-van-atm').value) || 3200,
    hitchDist: parseFloat(document.getElementById('modal-van-hitch').value) || 5.0,
    maxGtm: parseFloat(document.getElementById('modal-van-gtm').value) || 3000
  };
  state.currentCaravanId = 'user-defined';
  populateSelectors();
  closeModal('caravan-modal');
  saveState();
  updateTelemetry();
}

// ================= CARAVAN AXLES & WATER TANKS ARCHITECTURE CONTROLLER =================

let activeModalAxleType = 'tandem';

function openTankAxleModal() {
  const cfg = getCaravanConfig();
  setModalAxleType(cfg.axleType || 'tandem');
  
  const presetSel = document.getElementById('modal-tank-preset');
  if (presetSel) presetSel.value = cfg.tankMode || 'dual';
  
  const t1Enable = document.getElementById('modal-tank1-enable');
  const t1Cap = document.getElementById('modal-tank1-cap');
  const t1Arm = document.getElementById('modal-tank1-arm');
  if (t1Enable) t1Enable.checked = !!(cfg.frontTank && cfg.frontTank.enabled);
  if (t1Cap) t1Cap.value = cfg.frontTank ? cfg.frontTank.capacity : 95;
  if (t1Arm) t1Arm.value = cfg.frontTank ? cfg.frontTank.leverArm : 1.80;

  const t2Enable = document.getElementById('modal-tank2-enable');
  const t2Cap = document.getElementById('modal-tank2-cap');
  const t2Arm = document.getElementById('modal-tank2-arm');
  if (t2Enable) t2Enable.checked = !!(cfg.rearTank && cfg.rearTank.enabled);
  if (t2Cap) t2Cap.value = cfg.rearTank ? cfg.rearTank.capacity : 95;
  if (t2Arm) t2Arm.value = cfg.rearTank ? cfg.rearTank.leverArm : -1.50;

  toggleModalTankFields();
  updateTankModalSummary();
  document.getElementById('tank-axle-modal').classList.add('active');
}

function setModalAxleType(type) {
  activeModalAxleType = type;
  const btnTandem = document.getElementById('opt-axle-tandem');
  const btnSingle = document.getElementById('opt-axle-single');
  if (btnTandem) btnTandem.classList.toggle('active', type === 'tandem');
  if (btnSingle) btnSingle.classList.toggle('active', type === 'single');
  updateTankModalSummary();
}

function onModalTankPresetChange() {
  const sel = document.getElementById('modal-tank-preset');
  if (!sel) return;
  const preset = sel.value;

  const t1Enable = document.getElementById('modal-tank1-enable');
  const t1Cap = document.getElementById('modal-tank1-cap');
  const t1Arm = document.getElementById('modal-tank1-arm');
  const t2Enable = document.getElementById('modal-tank2-enable');
  const t2Cap = document.getElementById('modal-tank2-cap');
  const t2Arm = document.getElementById('modal-tank2-arm');

  if (preset === 'dual') {
    if (t1Enable) t1Enable.checked = true;
    if (t1Cap) t1Cap.value = 95;
    if (t1Arm) t1Arm.value = 1.80;
    if (t2Enable) t2Enable.checked = true;
    if (t2Cap) t2Cap.value = 95;
    if (t2Arm) t2Arm.value = -1.50;
  } else if (preset === 'single-front') {
    if (t1Enable) t1Enable.checked = true;
    if (t1Cap) t1Cap.value = 95;
    if (t1Arm) t1Arm.value = 1.50;
    if (t2Enable) t2Enable.checked = false;
  } else if (preset === 'single-center') {
    if (t1Enable) t1Enable.checked = true;
    if (t1Cap) t1Cap.value = 95;
    if (t1Arm) t1Arm.value = 0.00;
    if (t2Enable) t2Enable.checked = false;
  } else if (preset === 'single-rear') {
    if (t1Enable) t1Enable.checked = true;
    if (t1Cap) t1Cap.value = 95;
    if (t1Arm) t1Arm.value = -1.50;
    if (t2Enable) t2Enable.checked = false;
  }
  
  toggleModalTankFields();
  updateTankModalSummary();
}

function toggleModalTankFields() {
  const t1Enable = document.getElementById('modal-tank1-enable');
  const t1Box = document.getElementById('tank1-config-box');
  const t1Cap = document.getElementById('modal-tank1-cap');
  const t1Arm = document.getElementById('modal-tank1-arm');

  const t2Enable = document.getElementById('modal-tank2-enable');
  const t2Box = document.getElementById('tank2-config-box');
  const t2Cap = document.getElementById('modal-tank2-cap');
  const t2Arm = document.getElementById('modal-tank2-arm');

  const e1 = t1Enable ? t1Enable.checked : false;
  const e2 = t2Enable ? t2Enable.checked : false;

  if (t1Box) t1Box.style.opacity = e1 ? '1' : '0.45';
  if (t1Cap) t1Cap.disabled = !e1;
  if (t1Arm) t1Arm.disabled = !e1;

  if (t2Box) t2Box.style.opacity = e2 ? '1' : '0.45';
  if (t2Cap) t2Cap.disabled = !e2;
  if (t2Arm) t2Arm.disabled = !e2;

  updateTankModalSummary();
}

function updateTankModalSummary() {
  const summaryEl = document.getElementById('tank-impact-summary');
  if (!summaryEl) return;

  const caravan = getActiveCaravan();
  const hitchDist = caravan.hitchDist > 0 ? caravan.hitchDist : 5.0;

  const t1Enable = document.getElementById('modal-tank1-enable')?.checked;
  const t1Cap = parseFloat(document.getElementById('modal-tank1-cap')?.value) || 0;
  const t1Arm = parseFloat(document.getElementById('modal-tank1-arm')?.value) || 0;

  const t2Enable = document.getElementById('modal-tank2-enable')?.checked;
  const t2Cap = parseFloat(document.getElementById('modal-tank2-cap')?.value) || 0;
  const t2Arm = parseFloat(document.getElementById('modal-tank2-arm')?.value) || 0;

  const t1Impact = t1Enable ? (t1Cap * t1Arm / hitchDist) : 0;
  const t2Impact = t2Enable ? (t2Cap * t2Arm / hitchDist) : 0;
  const totalImpact = t1Impact + t2Impact;
  const totalWater = (t1Enable ? t1Cap : 0) + (t2Enable ? t2Cap : 0);

  const axleDesc = activeModalAxleType === 'single' ? 
    '🚜 <strong>Single Axle:</strong> Central fulcrum under caravan frame. Moments translate directly to hitch & tyre.' :
    '🚛 <strong>Tandem Dual Axles:</strong> Load equalized across 4 tyres pivoting around central axle fulcrum (0.0m).';

  let t1Text = '';
  if (t1Enable) {
    if (Math.abs(t1Arm) < 0.05) {
      t1Text = `<div>• <strong>Tank 1 (${t1Cap}L at 0.00m):</strong> Centered over axle fulcrum = <strong>0.0 kg hitch impact</strong> (neutral ballast at all fill levels).</div>`;
    } else {
      t1Text = `<div>• <strong>Tank 1 (${t1Cap}L at ${t1Arm > 0 ? '+' : ''}${t1Arm.toFixed(2)}m):</strong> Full tank exerts <strong>${t1Impact >= 0 ? '+' : ''}${t1Impact.toFixed(1)} kg</strong> on towball.</div>`;
    }
  } else {
    t1Text = `<div>• <strong>Tank 1:</strong> Disabled.</div>`;
  }

  let t2Text = '';
  if (t2Enable) {
    if (Math.abs(t2Arm) < 0.05) {
      t2Text = `<div>• <strong>Tank 2 (${t2Cap}L at 0.00m):</strong> Centered over axle fulcrum = <strong>0.0 kg hitch impact</strong>.</div>`;
    } else {
      t2Text = `<div>• <strong>Tank 2 (${t2Cap}L at ${t2Arm > 0 ? '+' : ''}${t2Arm.toFixed(2)}m):</strong> Full tank exerts <strong>${t2Impact >= 0 ? '+' : ''}${t2Impact.toFixed(1)} kg</strong> on towball.</div>`;
    }
  } else {
    t2Text = `<div>• <strong>Tank 2:</strong> Disabled.</div>`;
  }

  const netText = `<div>• <strong>Combined Water Capacity:</strong> ${totalWater} L. When full, net towball download change is <strong>${totalImpact >= 0 ? '+' : ''}${totalImpact.toFixed(1)} kg</strong>.</div>`;

  summaryEl.innerHTML = `
    <div style="font-weight: 700; color: var(--accent-cyan); margin-bottom: 6px;">Physics & Moment Balance Summary (Hitch Distance: ${hitchDist}m)</div>
    <div style="margin-bottom: 4px;">${axleDesc}</div>
    ${t1Text}
    ${t2Text}
    <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(255,255,255,0.1);">${netText}</div>
  `;
}

function saveTankAxleModal() {
  const cfg = getCaravanConfig();
  
  cfg.axleType = activeModalAxleType;
  cfg.tankMode = document.getElementById('modal-tank-preset')?.value || 'custom';

  const t1Enable = document.getElementById('modal-tank1-enable')?.checked ?? true;
  const t1Cap = parseFloat(document.getElementById('modal-tank1-cap')?.value) || 95;
  const t1Arm = parseFloat(document.getElementById('modal-tank1-arm')?.value) || 0;

  const t2Enable = document.getElementById('modal-tank2-enable')?.checked ?? false;
  const t2Cap = parseFloat(document.getElementById('modal-tank2-cap')?.value) || 95;
  const t2Arm = parseFloat(document.getElementById('modal-tank2-arm')?.value) || 0;

  cfg.frontTank = {
    enabled: t1Enable,
    name: (cfg.tankMode && cfg.tankMode.startsWith('single')) ? 'Caravan Water Tank' : 'Front Water Tank',
    capacity: t1Cap,
    leverArm: t1Arm
  };

  cfg.rearTank = {
    enabled: t2Enable,
    name: 'Rear Water Tank',
    capacity: t2Cap,
    leverArm: t2Arm
  };

  state.caravanConfig = cfg;
  LEVER_ARMS.frontTank = cfg.frontTank.leverArm;
  LEVER_ARMS.rearTank = cfg.rearTank.leverArm;

  closeModal('tank-axle-modal');
  playChime();
  saveState();
  updateTelemetry();
}

function openAddItemModal() {
  document.getElementById('item-modal').classList.add('active');
}

function saveNewItem() {
  const name = document.getElementById('new-item-name').value.trim();
  const weight = parseFloat(document.getElementById('new-item-weight').value) || 1;
  const zone = document.getElementById('new-item-zone').value;
  
  if (!name) {
    alert('Please enter an item name');
    return;
  }

  state.inventory.push({
    name,
    itemWeight: weight,
    travelWeight: weight,
    category: 'Custom Item',
    zone: zone,
    packed: true
  });

  closeModal('item-modal');
  document.getElementById('new-item-name').value = '';
  document.getElementById('new-item-weight').value = '';
  saveState();
  renderInventoryTable();
  updateTelemetry();
}

function deleteInventoryItem(idx) {
  if (confirm(`Remove "${state.inventory[idx].name}" from inventory?`)) {
    state.inventory.splice(idx, 1);
    saveState();
    renderInventoryTable();
    updateTelemetry();
  }
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Generate Printable Weighbridge Manifest / Compliance Report
function generatePrintManifest() {
  const p = computePhysics();
  const now = new Date().toLocaleString();

  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Trip Towing Compliance Manifest</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #111; line-height: 1.5; }
        h1 { margin-bottom: 2px; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; }
        .sub { color: #666; font-size: 13px; margin-bottom: 20px; }
        .rig-header { display: flex; justify-content: space-between; background: #f4f6f8; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #ddd; }
        .rig-header div { font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        th, td { padding: 10px 14px; border: 1px solid #ddd; text-align: left; }
        th { background: #f0f4f8; font-weight: 700; text-transform: uppercase; font-size: 11px; }
        .num { text-align: right; font-family: Consolas, monospace; font-weight: bold; }
        .pass { color: #15803d; font-weight: 800; }
        .fail { color: #b91c1c; font-weight: 800; }
        .sign-box { margin-top: 40px; display: flex; justify-content: space-between; padding-top: 30px; border-top: 1px dashed #aaa; }
        .sign-line { width: 260px; border-top: 1px solid #000; padding-top: 6px; font-size: 12px; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <h1>AUSTRALIAN TOWING COMPLIANCE & WEIGHBRIDGE MANIFEST</h1>
          <div class="sub">Generated: ${now} | Universal Towing Physics Compliance HUD</div>
        </div>
        <button onclick="window.print()" style="padding: 8px 16px; background: #0284c7; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save to PDF</button>
      </div>

      <div class="rig-header">
        <div>
          <strong>TOW VEHICLE:</strong> ${p.vehicle.name}<br>
          Tare: ${p.vehicle.tare} kg | Wheelbase: ${p.vehicle.wheelbase} m | Overhang: ${p.vehicle.overhang} m
        </div>
        <div>
          <strong>CARAVAN / TRAILER:</strong> ${p.caravan.name}<br>
          Tare: ${p.caravan.tare} kg | Hitch Dist: ${p.caravan.hitchDist} m
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Telemetry / Rating Metric</th>
            <th class="num">Actual Weight</th>
            <th class="num">Legal Cap</th>
            <th class="num">Remaining Margin</th>
            <th style="text-align: center;">Compliance Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Gross Vehicle Mass (GVM)</strong></td>
            <td class="num">${Math.round(p.vehicleGVM)} kg</td>
            <td class="num">${p.vehicle.gvm} kg</td>
            <td class="num">${Math.round(p.margins.gvm)} kg</td>
            <td style="text-align: center;" class="${p.status.gvm}">${p.status.gvm.toUpperCase()}</td>
          </tr>
          <tr>
            <td><strong>Gross Combined Mass (GCM)</strong></td>
            <td class="num">${Math.round(p.gcm)} kg</td>
            <td class="num">${p.vehicle.gcm} kg</td>
            <td class="num">${Math.round(p.margins.gcm)} kg</td>
            <td style="text-align: center;" class="${p.status.gcm}">${p.status.gcm.toUpperCase()}</td>
          </tr>
          <tr>
            <td><strong>Caravan Aggregate Mass (ATM)</strong></td>
            <td class="num">${Math.round(p.trailerATM)} kg</td>
            <td class="num">${p.caravan.atm} kg</td>
            <td class="num">${Math.round(p.margins.atm)} kg</td>
            <td style="text-align: center;" class="${p.status.atm}">${p.status.atm.toUpperCase()}</td>
          </tr>
          <tr>
            <td><strong>Live Towball Mass (TBM)</strong></td>
            <td class="num">${Math.round(p.tbm)} kg</td>
            <td class="num">${p.vehicle.maxTbm} kg</td>
            <td class="num">${Math.round(p.margins.tbm)} kg</td>
            <td style="text-align: center;" class="${p.status.tbm}">${p.status.tbm.toUpperCase()}</td>
          </tr>
          <tr>
            <td><strong>Towball Mass Ratio (% of ATM)</strong></td>
            <td class="num">${p.tbmPercent.toFixed(2)} %</td>
            <td class="num">8.0% - 11.5%</td>
            <td class="num">${p.tbmPercent >= 8.0 ? 'Safe Band' : 'Sway Risk'}</td>
            <td style="text-align: center;" class="${p.status.tbmRatio}">${p.status.tbmRatio.toUpperCase()}</td>
          </tr>
          <tr>
            <td><strong>Gross Trailer Mass on Tyres (GTM)</strong></td>
            <td class="num">${Math.round(p.trailerGTM)} kg</td>
            <td class="num">${p.caravan.maxGtm || '--'} kg</td>
            <td class="num">${p.margins.gtm !== null ? Math.round(p.margins.gtm) + ' kg' : '--'}</td>
            <td style="text-align: center;" class="${p.status.gtm}">${p.status.gtm.toUpperCase()}</td>
          </tr>
          <tr>
            <td><strong>Rear Axle Projected Loading</strong></td>
            <td class="num">${Math.round(p.rearAxleLoad)} kg</td>
            <td class="num">${p.vehicle.maxRearAxle || '--'} kg</td>
            <td class="num">${p.margins.rearAxle !== null ? Math.round(p.margins.rearAxle) + ' kg' : '--'}</td>
            <td style="text-align: center;" class="${p.status.rearAxle}">${p.status.rearAxle.toUpperCase()}</td>
          </tr>
          <tr>
            <td><strong>Front Axle Projected Loading</strong></td>
            <td class="num">${Math.round(p.frontAxleLoad)} kg</td>
            <td class="num">${p.vehicle.maxFrontAxle || '--'} kg</td>
            <td class="num">${p.margins.frontAxle !== null ? Math.round(p.margins.frontAxle) + ' kg' : '--'}</td>
            <td style="text-align: center;" class="${p.status.frontAxle}">${p.status.frontAxle.toUpperCase()}</td>
          </tr>
        </tbody>
      </table>

      <div class="sign-box">
        <div class="sign-line">Driver Signature</div>
        <div class="sign-line">Inspector / Weighbridge Operator</div>
        <div class="sign-line">Date Verified</div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
}

// ============================================================================
// WIDESCREEN ANDROID AUTO / CAR HEAD-UNIT COCKPIT & NATIVE BRIDGE
// ============================================================================

function toggleCarCockpitMode(forceState) {
  if (typeof forceState === 'boolean') {
    state.carCockpitMode = forceState;
  } else {
    state.carCockpitMode = !state.carCockpitMode;
  }
  applyCarCockpitDOMState();
  playChime();
  saveState();
  updateTelemetry();
}

function applyCarCockpitDOMState() {
  const isCar = !!state.carCockpitMode;
  document.body.classList.toggle('car-cockpit-active', isCar);
  const overlay = document.getElementById('car-cockpit-overlay');
  if (overlay) {
    overlay.setAttribute('aria-hidden', isCar ? 'false' : 'true');
  }
}

function toggleDaylightFromCar() {
  state.daylightMode = !state.daylightMode;
  document.body.classList.toggle('daylight-mode', state.daylightMode);
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = state.daylightMode ? '🌙 HUD Night Mode' : '☀️ Daylight Mode';
  playBlip();
  saveState();
}

function stepZoneOffset(zone, deltaKg) {
  if (!state.sliderOffsets.hasOwnProperty(zone)) return;
  const slider = document.getElementById(`slider-${zone}`);
  const minVal = slider ? parseFloat(slider.min) : -100;
  const maxVal = slider ? parseFloat(slider.max) : 200;
  const nextVal = Math.max(minVal, Math.min(maxVal, (state.sliderOffsets[zone] || 0) + deltaKg));
  state.sliderOffsets[zone] = nextVal;
  if (slider) slider.value = nextVal;
  playBlip();
  saveState();
  updateTelemetry();
}

function updateCarCockpitUI(p) {
  const overlay = document.getElementById('car-cockpit-overlay');
  if (!overlay) return;

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt('car-veh-label', p.vehicle.name);
  setTxt('car-van-label', p.caravan.name);

  // Determine overall master compliance status
  const statuses = [p.status.gvm, p.status.atm, p.status.tbm, p.status.gcm, p.status.rearAxle, p.status.frontAxle, p.status.gtm];
  let masterStatus = 'pass';
  if (statuses.includes('fail') || p.status.tbmRatio === 'fail') {
    masterStatus = 'fail';
  } else if (statuses.includes('warn') || p.status.tbmRatio === 'warn') {
    masterStatus = 'warn';
  }

  const masterEl = document.getElementById('car-master-status');
  if (masterEl) {
    masterEl.className = `car-master-status ${masterStatus}`;
    masterEl.textContent = masterStatus === 'pass'
      ? '● ALL SYSTEMS LEGAL'
      : (masterStatus === 'warn' ? '▲ CAUTION: NEAR LIMIT' : '■ OVERLOAD / SWAY ALERT');
  }

  function updateTile(key, currKg, capKg, marginKg, status, customPillText, customFootRight) {
    const card = document.getElementById(`car-card-${key}`);
    if (card) card.className = `car-tele-tile status-${status}`;

    const badge = document.getElementById(`car-badge-${key}`);
    if (badge) {
      badge.className = `compliance-badge ${status}`;
      badge.textContent = status === 'pass' ? 'PASS' : (status === 'warn' ? 'WARN' : 'FAIL');
    }

    const valEl = document.getElementById(`car-val-${key}`);
    if (valEl) valEl.innerHTML = `${Math.round(currKg).toLocaleString()} <small>kg</small>`;

    const pct = capKg > 0 ? Math.min(100, Math.max(0, (currKg / capKg) * 100)) : 0;
    const pctEl = document.getElementById(`car-pct-${key}`);
    if (pctEl && !customPillText) {
      pctEl.textContent = `${pct.toFixed(0)}%`;
    }

    const barEl = document.getElementById(`car-bar-${key}`);
    if (barEl) {
      barEl.style.width = `${pct.toFixed(1)}%`;
      barEl.className = `car-progress-fill ${status}`;
    }

    setTxt(`car-cap-${key}`, capKg > 0 ? `${capKg.toLocaleString()} kg` : '--');
    if (customFootRight) {
      setTxt(`car-mar-${key}`, customFootRight);
    } else if (marginKg !== null && marginKg !== undefined) {
      setTxt(`car-mar-${key}`, `${marginKg >= 0 ? '+' : ''}${Math.round(marginKg)} kg`);
    }
  }

  // 1. GVM
  updateTile('gvm', p.vehicleGVM, p.vehicle.gvm, p.margins.gvm, p.status.gvm);
  // 2. ATM
  updateTile('atm', p.trailerATM, p.caravan.atm, p.margins.atm, p.status.atm);
  // 3. TBM
  const tbmCombinedStatus = (p.status.tbm === 'fail' || p.status.tbmRatio === 'fail')
    ? 'fail'
    : ((p.status.tbm === 'warn' || p.status.tbmRatio === 'warn') ? 'warn' : 'pass');
  updateTile(
    'tbm',
    p.tbm,
    p.vehicle.maxTbm,
    p.margins.tbm,
    tbmCombinedStatus,
    true,
    `${p.margins.tbm >= 0 ? '+' : ''}${Math.round(p.margins.tbm)} kg (${p.status.tbmRatio === 'pass' ? '8–11% OK' : 'Check %'})`
  );
  setTxt('car-ratio-tbm', `${p.tbmPercent.toFixed(1)}% ATM`);

  // 4. GCM
  updateTile('gcm', p.gcm, p.vehicle.gcm, p.margins.gcm, p.status.gcm);

  // 5. Steer Axle (Front)
  const faDelta = Math.round(p.frontAxleLoad - p.vehicle.frontAxleTare);
  updateTile('fa', p.frontAxleLoad, p.vehicle.maxFrontAxle || 0, p.margins.frontAxle, p.status.frontAxle, true);
  setTxt('car-delta-fa', faDelta < 0 ? `⚠️ ${faDelta}kg Lift` : `+${faDelta}kg Grip`);

  // 6. Drive Axle (Rear) + Caravan GTM
  updateTile('ra', p.rearAxleLoad, p.vehicle.maxRearAxle || 0, p.margins.rearAxle, p.status.rearAxle, true);
  setTxt('car-val-gtm', `GTM: ${Math.round(p.trailerGTM)} kg`);
}

// Push Live Telemetry JSON to Native Android Auto Service (androidx.car.app)
function pushToAndroidAutoBridge(p) {
  try {
    const payload = {
      timestamp: Date.now(),
      vehicleName: p.vehicle.name,
      caravanName: p.caravan.name,
      gvm: {
        current: Math.round(p.vehicleGVM),
        limit: p.vehicle.gvm,
        margin: Math.round(p.margins.gvm),
        status: p.status.gvm
      },
      atm: {
        current: Math.round(p.trailerATM),
        limit: p.caravan.atm,
        margin: Math.round(p.margins.atm),
        status: p.status.atm
      },
      tbm: {
        current: Math.round(p.tbm),
        limit: p.vehicle.maxTbm,
        margin: Math.round(p.margins.tbm),
        ratioPct: Number(p.tbmPercent.toFixed(2)),
        status: (p.status.tbm === 'fail' || p.status.tbmRatio === 'fail') ? 'fail' : p.status.tbm
      },
      gcm: {
        current: Math.round(p.gcm),
        limit: p.vehicle.gcm,
        margin: Math.round(p.margins.gcm),
        status: p.status.gcm
      },
      frontAxle: {
        current: Math.round(p.frontAxleLoad),
        limit: p.vehicle.maxFrontAxle || 0,
        margin: p.margins.frontAxle !== null ? Math.round(p.margins.frontAxle) : 0,
        gripDelta: Math.round(p.frontAxleLoad - p.vehicle.frontAxleTare),
        status: p.status.frontAxle
      },
      rearAxle: {
        current: Math.round(p.rearAxleLoad),
        limit: p.vehicle.maxRearAxle || 0,
        margin: p.margins.rearAxle !== null ? Math.round(p.margins.rearAxle) : 0,
        gtm: Math.round(p.trailerGTM),
        status: p.status.rearAxle
      },
      waterTanks: {
        frontLiters: Math.round(p.zones.frontTank || 0),
        rearLiters: Math.round(p.zones.rearTank || 0)
      }
    };

    const jsonStr = JSON.stringify(payload);
    localStorage.setItem('towing_aa_live_telemetry', jsonStr);

    if (window.AndroidAutoBridge && typeof window.AndroidAutoBridge.onTelemetryUpdated === 'function') {
      window.AndroidAutoBridge.onTelemetryUpdated(jsonStr);
    }
  } catch (err) {
    console.warn('AndroidAutoBridge sync warning:', err);
  }
}

// Receive Commands Dispatched from the Native Android Auto Head-Unit Screen
window.applyCarAction = function(action, value) {
  if (action === 'waterPreset') {
    setWaterPreset(value);
  } else if (action === 'stepZone') {
    if (value && value.zone) {
      stepZoneOffset(value.zone, Number(value.delta) || 0);
    }
  } else if (action === 'resetBaseline') {
    Object.keys(state.sliderOffsets).forEach(k => state.sliderOffsets[k] = 0);
    saveState();
    updateTelemetry();
  }
};

// Kick off when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
