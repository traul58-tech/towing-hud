/**
 * TOWING DASHBOARD HUD // CORE TELEMETRY ENGINE
 * Matches Universal_Towing_Calculator.xlsm physics & moment balance equations
 */

// Global State
let state = {
  currentVehicleId: 'mitsubishi-triton-next-gen-mv',
  currentCaravanId: 'tandem-van',
  
  // Storage Offsets (Simulation Sliders - Excel Col E)
  sliderOffsets: {
    toolbox: 0,
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
  rigPhotoUrl: null
};

// Lever Arms in meters relative to caravan axle center
const LEVER_ARMS = {
  toolbox: 3.75,
  frontStorage: 3.00,
  frontTank: 1.80,
  midStorage: 0.00,
  rearTank: -1.50,
  rearStorage: -2.25
};

// Initialize Application
function initApp() {
  // Load data from DEFAULT_TOWING_DATA
  if (typeof DEFAULT_TOWING_DATA !== 'undefined') {
    state.inventory = JSON.parse(JSON.stringify(DEFAULT_TOWING_DATA.inventory));
  }
  
  // Load saved state from LocalStorage if present
  try {
    const saved = localStorage.getItem('towing_hud_state_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.currentVehicleId) state.currentVehicleId = parsed.currentVehicleId;
      if (parsed.currentCaravanId) state.currentCaravanId = parsed.currentCaravanId;
      if (parsed.sliderOffsets) state.sliderOffsets = { ...state.sliderOffsets, ...parsed.sliderOffsets };
      if (parsed.inventory && parsed.inventory.length > 0) state.inventory = parsed.inventory;
      if (parsed.customVehicle) state.customVehicle = parsed.customVehicle;
      if (parsed.customCaravan) state.customCaravan = parsed.customCaravan;
      if (parsed.rigViewMode) state.rigViewMode = parsed.rigViewMode;
      if (parsed.rigPhotoUrl) state.rigPhotoUrl = parsed.rigPhotoUrl;
      if (parsed.daylightMode) {
        state.daylightMode = parsed.daylightMode;
        document.body.classList.toggle('daylight-mode', state.daylightMode);
      }
    }
  } catch (e) {
    console.warn('Could not load saved state', e);
  }

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
  const totals = {
    toolbox: 0,
    frontStorage: 0,
    frontTank: 95, // Default water tank capacity
    midStorage: 0,
    rearTank: 95,  // Default water tank capacity
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
  const baseWeights = getZoneBaseWeights();
  
  // Total Effective Zone Weights = Base + Slider Offset
  const zones = {
    toolbox: Math.max(0, baseWeights.toolbox + (state.sliderOffsets.toolbox || 0)),
    frontStorage: Math.max(0, baseWeights.frontStorage + (state.sliderOffsets.frontStorage || 0)),
    frontTank: Math.max(0, baseWeights.frontTank + (state.sliderOffsets.frontTank || 0)),
    midStorage: Math.max(0, baseWeights.midStorage + (state.sliderOffsets.midStorage || 0)),
    rearTank: Math.max(0, baseWeights.rearTank + (state.sliderOffsets.rearTank || 0)),
    rearStorage: Math.max(0, baseWeights.rearStorage + (state.sliderOffsets.rearStorage || 0)),
    cabin: Math.max(0, baseWeights.cabin + (state.sliderOffsets.cabin || 0)),
    tub: Math.max(0, baseWeights.tub + (state.sliderOffsets.tub || 0))
  };

  // Caravan Storage Load Total
  const caravanCargoTotal = zones.toolbox + zones.frontStorage + zones.frontTank + 
                            zones.midStorage + zones.rearTank + zones.rearStorage;
  
  // Moment balance around caravan axle center (kg * m)
  const momentsSum = (zones.toolbox * LEVER_ARMS.toolbox) +
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

  // Update Photo View Telemetry Dock
  renderPhotoTelemetryDock(p);

  // Update Storage Controls Display
  updateStorageCards(p);

  // Update Diagnostic Telemetry Rows
  updateTelemetryChecklist(p);

  // Update Safety Advisor
  updateSafetyAdvisor(p);
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
      <text x="378" y="195" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle">TUB: ${Math.round(p.zones.tub)}kg</text>

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
      <path d="M 600,218 
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
               L 600,218 Z" 
            fill="url(#bodyGradVan)" stroke="#38bdf8" stroke-width="2"/>

      <!-- Lower Checkerplate Protective Skirt (Front and Rear of Wheels) -->
      <path d="M 600,218 L 610,186 L 775,186 L 775,218 Z" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(56, 189, 248, 0.3)" stroke-width="1"/>
      <path d="M 925,218 L 925,186 L 1035,186 L 1035,218 Z" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(56, 189, 248, 0.3)" stroke-width="1"/>

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

      <!-- Caravan Tandem Wheels (Axle Center at X=850) -->
      <circle cx="815" cy="222" r="30" fill="#0b0f19" stroke="#64748b" stroke-width="4"/>
      <circle cx="815" cy="222" r="14" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>

      <circle cx="885" cy="222" r="30" fill="#0b0f19" stroke="#64748b" stroke-width="4"/>
      <circle cx="885" cy="222" r="14" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>

      <!-- Axle Center Fulcrum (Pivot point for moment arms) -->
      <line x1="850" y1="75" x2="850" y2="250" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4,3"/>
      <polygon points="850,250 844,260 856,260" fill="#00f2fe"/>
      <text x="850" y="70" fill="#00f2fe" font-size="10" font-weight="700" text-anchor="middle">AXLE FULCRUM (0.0m)</text>

      <!-- Hitch Distance Line L -->
      <line x1="490" y1="238" x2="850" y2="238" stroke="#38bdf8" stroke-width="1.5"/>
      <text x="670" y="234" fill="#38bdf8" font-size="11" font-family="Consolas, monospace" font-weight="700" text-anchor="middle">Hitch Distance (L): ${p.caravan.hitchDist}m</text>

      <!-- Ground Axle GTM Load Callout -->
      <g transform="translate(850, 260)">
        <rect x="-70" y="0" width="140" height="46" rx="6" fill="#0f172a" stroke="${gtmColor}" stroke-width="1.5"/>
        <text x="0" y="14" fill="#94a3b8" font-size="9" font-weight="800" text-anchor="middle">CARAVAN TYRES (GTM)</text>
        <text x="0" y="29" fill="${gtmColor}" font-size="12" font-family="Consolas, monospace" font-weight="900" text-anchor="middle">${gtmKg} kg / ${p.caravan.maxGtm || '--'}kg</text>
        <text x="0" y="40" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">ATM: ${Math.round(p.trailerATM)} kg</text>
      </g>

      <!-- ================= STORAGE ZONE PINS (UNCLUTTERED & STAGGERED) ================= -->
      
      <!-- Toolbox (+3.75m) on Drawbar -->
      <g transform="translate(565, 168)" class="pin-node" onclick="focusZone('toolbox')" style="cursor: pointer;">
        <circle cx="0" cy="0" r="13" fill="#0f172a" stroke="#00e676" stroke-width="2.5" filter="url(#neonGlow)"/>
        <text x="0" y="4" fill="#00e676" font-size="9" font-weight="900" text-anchor="middle">TB</text>
        <g transform="translate(0, 18)">
          <rect x="-42" y="0" width="84" height="24" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#00e676" stroke-width="1"/>
          <text x="0" y="10" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">+3.75m Drawbar</text>
          <text x="0" y="20" fill="#f1f5f9" font-size="10" font-family="Consolas, monospace" font-weight="800" text-anchor="middle">${Math.round(p.zones.toolbox)} kg</text>
        </g>
      </g>

      <!-- Front Storage / Tunnel Boot (+3.0m) -->
      <g transform="translate(670, 138)" class="pin-node" onclick="focusZone('frontStorage')" style="cursor: pointer;">
        <circle cx="0" cy="0" r="13" fill="#0f172a" stroke="#00e676" stroke-width="2.5" filter="url(#neonGlow)"/>
        <text x="0" y="4" fill="#00e676" font-size="9" font-weight="900" text-anchor="middle">FS</text>
        <g transform="translate(0, 18)">
          <rect x="-40" y="0" width="80" height="24" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#00e676" stroke-width="1"/>
          <text x="0" y="10" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">+3.0m Boot</text>
          <text x="0" y="20" fill="#f1f5f9" font-size="10" font-family="Consolas, monospace" font-weight="800" text-anchor="middle">${Math.round(p.zones.frontStorage)} kg</text>
        </g>
      </g>

      <!-- Front Water Tank (+1.8m) -->
      <g transform="translate(745, 180)" class="pin-node" onclick="focusZone('frontTank')" style="cursor: pointer;">
        <circle cx="0" cy="0" r="13" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5" filter="url(#neonGlow)"/>
        <text x="0" y="4" fill="#38bdf8" font-size="9" font-weight="900" text-anchor="middle">FW</text>
        <g transform="translate(0, 18)">
          <rect x="-40" y="0" width="80" height="24" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#38bdf8" stroke-width="1"/>
          <text x="0" y="10" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">+1.8m Tank</text>
          <text x="0" y="20" fill="#38bdf8" font-size="10" font-family="Consolas, monospace" font-weight="800" text-anchor="middle">${Math.round(p.zones.frontTank)} L</text>
        </g>
      </g>

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

      <!-- Rear Water Tank (-1.5m) -->
      <g transform="translate(950, 180)" class="pin-node" onclick="focusZone('rearTank')" style="cursor: pointer;">
        <circle cx="0" cy="0" r="13" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5" filter="url(#neonGlow)"/>
        <text x="0" y="4" fill="#38bdf8" font-size="9" font-weight="900" text-anchor="middle">RW</text>
        <g transform="translate(0, 18)">
          <rect x="-40" y="0" width="80" height="24" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#38bdf8" stroke-width="1"/>
          <text x="0" y="10" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">-1.5m Tank</text>
          <text x="0" y="20" fill="#38bdf8" font-size="10" font-family="Consolas, monospace" font-weight="800" text-anchor="middle">${Math.round(p.zones.rearTank)} L</text>
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
  const zones = ['toolbox', 'frontStorage', 'frontTank', 'midStorage', 'rearTank', 'rearStorage', 'cabin', 'tub'];
  
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
      text: `<strong>SWAY HAZARD (TBM: ${p.tbmPercent.toFixed(1)}%):</strong> Towball download is below the minimum safe 8% threshold. High risk of deadly fishtailing & aerodynamic sway at highway speeds! Shift at least ${Math.round((0.085 * p.trailerATM) - p.tbm)} kg of weight forward toward the tunnel boot or toolbox.`
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
    toolbox: 'Toolbox (+3.75m)',
    frontStorage: 'Tunnel Boot (+3.0m)',
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
    }
    playBlip();
    saveState();
    updateTelemetry();
  });

  // Sliders
  const zones = ['toolbox', 'frontStorage', 'frontTank', 'midStorage', 'rearTank', 'rearStorage', 'cabin', 'tub'];
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
      playChime();
      saveState();
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
  // Front tank base is 95L, rear tank base is 95L
  const base = 95;
  const offset = liters - base;
  state.sliderOffsets[tankZone] = offset;
  playBlip();
  saveState();
  updateTelemetry();
}

// Water Balancer Presets
function setWaterPreset(presetName) {
  if (presetName === 'both-full') {
    setQuickTank('frontTank', 95);
    setQuickTank('rearTank', 95);
  } else if (presetName === 'both-dry') {
    setQuickTank('frontTank', 0);
    setQuickTank('rearTank', 0);
  } else if (presetName === 'front-full-rear-dry') {
    setQuickTank('frontTank', 95);
    setQuickTank('rearTank', 0);
  } else if (presetName === 'front-dry-rear-full') {
    setQuickTank('frontTank', 0);
    setQuickTank('rearTank', 95);
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
      currentVehicleId: state.currentVehicleId,
      currentCaravanId: state.currentCaravanId,
      sliderOffsets: state.sliderOffsets,
      inventory: state.inventory,
      customVehicle: state.customVehicle,
      customCaravan: state.customCaravan,
      daylightMode: state.daylightMode,
      rigViewMode: state.rigViewMode,
      rigPhotoUrl: state.rigPhotoUrl
    }));
  } catch (e) {
    console.warn('LocalStorage error', e);
  }
}

// ================= RIG PHOTO & VIEW MODE CONTROLLER =================

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
  updateRigViewDisplay();
}

function setRigViewMode(mode) {
  state.rigViewMode = mode;
  updateRigViewDisplay();
  playBlip();
  saveState();
}

function updateRigViewDisplay() {
  const svgEl = document.getElementById('rig-blueprint-svg');
  const photoContainer = document.getElementById('rig-photo-container');
  const imgEl = document.getElementById('rig-photo-img');
  const dropzone = document.getElementById('photo-empty-dropzone');
  const removeBtn = document.getElementById('btn-remove-photo');
  const btnBlueprint = document.getElementById('btn-view-blueprint');
  const btnPhoto = document.getElementById('btn-view-photo');

  if (btnBlueprint && btnPhoto) {
    btnBlueprint.classList.toggle('active', state.rigViewMode === 'blueprint');
    btnPhoto.classList.toggle('active', state.rigViewMode === 'photo');
  }

  if (state.rigViewMode === 'photo') {
    if (svgEl) svgEl.style.display = 'none';
    if (photoContainer) photoContainer.style.display = 'flex';
    
    if (state.rigPhotoUrl) {
      if (imgEl) {
        imgEl.src = state.rigPhotoUrl;
        imgEl.style.display = 'block';
      }
      if (dropzone) dropzone.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
      if (imgEl) imgEl.style.display = 'none';
      if (dropzone) dropzone.style.display = 'flex';
      if (removeBtn) removeBtn.style.display = 'none';
    }
  } else {
    if (svgEl) svgEl.style.display = 'block';
    if (photoContainer) photoContainer.style.display = 'none';
    if (removeBtn) removeBtn.style.display = state.rigPhotoUrl ? 'inline-flex' : 'none';
  }
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

// Kick off when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
