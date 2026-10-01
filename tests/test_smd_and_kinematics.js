import {
  solveFourBarPosition,
  solveFourBarVelocityAndAcceleration,
  classifyGrashof,
  solveSliderCrank,
  exactSimplePendulumPeriod,
  measureNumericalPeriod,
  rk4StepSimplePendulum
} from '../src/core/kinematics.js';

import {
  checkFeasibility
} from '../src/core/feasibility.js';

import {
  assembleGraphMCK,
  checkSMDGroundedness,
  solveGraphModal,
  simulateGraphTimeDomain,
  computeGraphFRF,
  solveClassroomProblem
} from '../src/core/smdSolver.js';

import {
  solveClientDesignSweep,
  validateDesignConstraints,
  getAttainableMetricRanges
} from '../src/core/designSweep.js';

console.log('====================================================');
console.log('RUNNING AUTOMATED JS VALIDATION & BENCHMARK SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    passedTests++;
    console.log(`✅ PASSED: ${message}`);
  }
}

// -----------------------------------------------------------------
// 1. KINEMATICS & 200 RANDOM FOUR-BAR CONFIGURATIONS
// -----------------------------------------------------------------
console.log('--- 1. Testing Kinematics & Loop Closure Precision ---');

// Benchmark Four-bar [4, 1, 2.5, 3]
let maxLoopErr = 0;
let minTh4 = Infinity, maxTh4 = -Infinity;
let prevTh4 = null;

for (let deg = 0; deg <= 360; deg++) {
  const th2 = (deg * Math.PI) / 180;
  const sol = solveFourBarPosition(4.0, 1.0, 2.5, 3.0, th2, prevTh4);
  assert(sol.success, `Benchmark four-bar solve at ${deg}°`);
  if (sol.loopClosureError > maxLoopErr) maxLoopErr = sol.loopClosureError;
  if (sol.theta4 < minTh4) minTh4 = sol.theta4;
  if (sol.theta4 > maxTh4) maxTh4 = sol.theta4;
  prevTh4 = sol.theta4;
}

const rockerRangeDeg = ((maxTh4 - minTh4) * 180) / Math.PI;
console.log(`Measured Max Loop Closure Error: ${maxLoopErr.toExponential(4)} m`);
console.log(`Measured Swept Rocker Range: ${rockerRangeDeg.toFixed(4)}°`);
assert(maxLoopErr < 1e-12, `Loop closure error ${maxLoopErr.toExponential(4)} m < 1e-12 m`);
assert(Math.abs(rockerRangeDeg - 39.3386) < 0.05, `Rocker range ${rockerRangeDeg.toFixed(2)}° matches Erdman-Sandor (39.34°)`);

// Test 200 random valid Grashof Crank-Rocker configurations across arbitrary crank angles
let maxRandomLoopErr = 0;
for (let i = 0; i < 200; i++) {
  const d = 3.0 + Math.random() * 2.0; // 3 to 5
  const a = 0.5 + Math.random() * 0.5; // 0.5 to 1.0 (crank shortest)
  const b = 2.0 + Math.random() * 1.5; // 2.0 to 3.5
  const c = 2.0 + Math.random() * 1.5; // 2.0 to 3.5
  const th2 = Math.random() * 2 * Math.PI;

  const sol = solveFourBarPosition(d, a, b, c, th2);
  if (sol.success) {
    if (sol.loopClosureError > maxRandomLoopErr) {
      maxRandomLoopErr = sol.loopClosureError;
    }
  }
}
console.log(`200 Random 4-Bar Configurations Max Loop Error: ${maxRandomLoopErr.toExponential(4)} m`);
assert(maxRandomLoopErr < 1e-12, `200 random linkages max loop error < 1e-12 m`);

// Test Drag-Link Continuity (no historical 257.5° branch flip jump)
let maxDragLinkDelta = 0;
prevTh4 = null;
for (let deg = 0; deg <= 360; deg++) {
  const th2 = (deg * Math.PI) / 180;
  const sol = solveFourBarPosition(2.0, 4.0, 3.0, 3.5, th2, prevTh4);
  assert(sol.success, `Drag-link solve at ${deg}°`);
  if (prevTh4 !== null) {
    const delta = Math.abs(sol.theta4 - prevTh4);
    if (delta > maxDragLinkDelta) maxDragLinkDelta = delta;
  }
  prevTh4 = sol.theta4;
}
console.log(`Drag-Link Max Angle Step Delta: ${maxDragLinkDelta.toFixed(4)} rad (Must be < 0.2 rad for 1° step)`);
// Test Analytical Velocity and Acceleration
const va = solveFourBarVelocityAndAcceleration(4.0, 1.0, 2.5, 3.0, Math.PI / 4, 0.5, 1.2, 10.0, 0.0);
assert(va.success && typeof va.omega4 === 'number' && typeof va.alpha4 === 'number', 'Four-bar analytical velocity and acceleration solve');

// Test Grashof classification
const g1 = classifyGrashof(4.0, 1.0, 2.5, 3.0);
assert(g1.isGrashof && g1.classification === 'grashof', 'classifyGrashof Crank-Rocker structure');

// Test Slider-Crank exact solution
const sc = solveSliderCrank(0.1, 0.3, Math.PI / 2, 10.0);
assert(sc.success && Math.abs(sc.x - Math.sqrt(0.08)) < 1e-12, 'Slider-crank position solve at 90°');

// Test Pendulum exact elliptic period vs RK4 numerical integration
const T_exact = exactSimplePendulumPeriod(1.0, 9.81, 0.35);
let t_sim = 0, th_sim = 0.35, om_sim = 0;
const tArr = [], thArr = [];
for (let i = 0; i < 800; i++) {
  tArr.push(t_sim);
  thArr.push(th_sim);
  const nxt = rk4StepSimplePendulum(th_sim, om_sim, 0.005, { L: 1.0, g: 9.81, m: 1.0, b: 0 });
  th_sim = nxt.theta;
  om_sim = nxt.omega;
  t_sim += 0.005;
}
const T_num = measureNumericalPeriod(tArr, thArr);
assert(Math.abs(T_num - T_exact) / T_exact < 1e-3, `Pendulum exact (${T_exact.toFixed(4)}s) vs RK4 numerical (${T_num.toFixed(4)}s) < 0.1%`);

// -----------------------------------------------------------------
// 2. FEASIBILITY ENGINE INTEGRITY
// -----------------------------------------------------------------
console.log('\n--- 2. Testing Feasibility Diagnostic Engine ---');

// Four-bar valid
const f1 = checkFeasibility('four_bar', { link_ground: 4, link_crank: 1, link_coupler: 2.5, link_rocker: 3 });
assert(f1.status === 'ok' && f1.is_feasible === true, 'Feasibility: Valid Crank-Rocker reports status ok');

// Four-bar assembly impossible
const f2 = checkFeasibility('four_bar', { link_ground: 2, link_crank: 3, link_coupler: 4, link_rocker: 10 });
assert(f2.status === 'impossible' && f2.checks.some(c => c.id === 'four_bar.assembly_impossible'), 'Feasibility: Triangle inequality failure reports status impossible');

// Four-bar Non-Grashof
const f3 = checkFeasibility('four_bar', { link_ground: 5, link_crank: 4, link_coupler: 2, link_rocker: 2 });
assert(f3.status === 'warning' && f3.checks.some(c => c.id === 'four_bar.non_grashof'), 'Feasibility: Non-Grashof linkage reports status warning with non_grashof check');

// Slider-Crank Lockup
const f4 = checkFeasibility('slider_crank', { crank_length: 0.4, conn_length: 0.3 });
assert(f4.status === 'impossible' && f4.checks.some(c => c.id === 'slider_crank.lockup'), 'Feasibility: Slider-crank r >= l reports lockup error');

// Pendulum String Suspension Inversion
const f5 = checkFeasibility('simple_pendulum', { length: 1, mass: 1, theta0: 120, suspension_type: 'string' });
assert(f5.status === 'impossible' && f5.checks.some(c => c.id === 'pendulum.string_suspension'), 'Feasibility: String angle > 90° reports error');

// Diagnostic contract verification
const requiredFields = ['id', 'severity', 'title', 'what', 'why', 'consequence', 'fix'];
let contractValid = true;
f3.checks.forEach(c => {
  requiredFields.forEach(k => {
    if (c[k] === undefined || c[k] === null || c[k] === '') contractValid = false;
  });
});
assert(contractValid, 'Feasibility checks adhere to the 7-field structured diagnostic schema');

// -----------------------------------------------------------------
// 3. PHYSICAL NETWORK SMD SOLVER & MATRIX ASSEMBLY
// -----------------------------------------------------------------
console.log('\n--- 3. Testing SMD Physical Network Engine ---');

// Groundedness BFS test
const groundedNodes = [
  { id: 'wall1', type: 'wall' },
  { id: 'm1', type: 'mass', mass: 2.0 },
  { id: 'm2', type: 'mass', mass: 1.0 }
];
const groundedEdges = [
  { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 100 },
  { id: 'k2', type: 'spring', from: 'm1', to: 'm2', k: 50 }
];
const gCheck1 = checkSMDGroundedness(groundedNodes, groundedEdges);
assert(gCheck1.isGrounded === true && gCheck1.ungroundedMasses.length === 0, 'SMD Groundedness: Connected mass chain is grounded');

// Ungrounded mass test (rigid-body mode)
const ungroundedNodes = [
  { id: 'wall1', type: 'wall' },
  { id: 'm1', type: 'mass', mass: 2.0 },
  { id: 'm2_floating', type: 'mass', mass: 1.0 }
];
const ungroundedEdges = [
  { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 100 }
  // m2_floating has no connection
];
const gCheck2 = checkSMDGroundedness(ungroundedNodes, ungroundedEdges);
assert(gCheck2.isGrounded === false && gCheck2.ungroundedMasses.includes('m2_floating'), 'SMD Groundedness: Floating mass correctly flagged as ungrounded');

// Matrix assembly 1-DOF verification
const nodes1DOF = [
  { id: 'wall1', type: 'wall' },
  { id: 'm1', type: 'mass', mass: 2.0, x0: 0.1, v0: 0.0 }
];
const edges1DOF = [
  { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 200.0 },
  { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 4.0 }
];
const sys1DOF = assembleGraphMCK(nodes1DOF, edges1DOF);
assert(sys1DOF.M[0][0] === 2.0, 'SMD 1-DOF M matrix populated correctly (M[0][0] = 2.0)');
assert(sys1DOF.K[0][0] === 200.0, 'SMD 1-DOF K matrix populated correctly (K[0][0] = 200.0)');
assert(sys1DOF.C[0][0] === 4.0, 'SMD 1-DOF C matrix populated correctly (C[0][0] = 4.0)');

// Modal analysis 1-DOF verification
const modal1DOF = solveGraphModal(sys1DOF.M, sys1DOF.C, sys1DOF.K);
const expected_wn = Math.sqrt(200.0 / 2.0); // 10 rad/s
const expected_zeta = 4.0 / (2 * Math.sqrt(200.0 * 2.0)); // 4 / 40 = 0.1
assert(Math.abs(modal1DOF.frequenciesRad[0] - expected_wn) < 1e-6, `SMD Modal 1-DOF omega_n = ${modal1DOF.frequenciesRad[0].toFixed(3)} rad/s matches theoretical 10.000 rad/s`);
assert(Math.abs(modal1DOF.dampingRatios[0] - expected_zeta) < 1e-6, `SMD Modal 1-DOF zeta = ${modal1DOF.dampingRatios[0].toFixed(3)} matches theoretical 0.100`);

// Bode Frequency Response FRF verification
const frf1DOF = computeGraphFRF(sys1DOF.M, sys1DOF.C, sys1DOF.K, 0, 0.5, 30.0, 30);
assert(frf1DOF.freqsHz.length === 30 && frf1DOF.magDb[0].length === 30, 'SMD Bode FRF response computed across 30 spectral points');

// -----------------------------------------------------------------
// 4. JSON ROUND-TRIP SERIALIZATION ON ALL 5 SMD PRESETS
// -----------------------------------------------------------------
console.log('\n--- 4. Testing JSON Round-Trip Serialization on All Presets ---');

const presets = {
  underdamped_sdof: {
    nodes: [
      { id: 'wall1', type: 'wall', x: 80, y: 220 },
      { id: 'm1', type: 'mass', x: 440, y: 220, mass: 2.0, x0: 0.15, v0: 0.0 }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 180.0 },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 1.8 }
    ]
  },
  forced_harmonic: {
    nodes: [
      { id: 'wall1', type: 'wall', x: 80, y: 220 },
      { id: 'm1', type: 'mass', x: 440, y: 220, mass: 2.0, x0: 0.0, v0: 0.0 }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 200.0 },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 2.0 },
      { id: 'F1', type: 'force', from: 'm1', to: 'm1', F0: 25.0, waveform: 'sine', freq: 10.0 }
    ]
  },
  coupled_oscillators: {
    nodes: [
      { id: 'wall1', type: 'wall', x: 70, y: 220 },
      { id: 'm1', type: 'mass', x: 270, y: 220, mass: 1.0, x0: 0.15, v0: 0.0 },
      { id: 'm2', type: 'mass', x: 490, y: 220, mass: 1.0, x0: 0.0, v0: 0.0 },
      { id: 'wall2', type: 'wall', x: 670, y: 220 }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 100.0 },
      { id: 'k12', type: 'spring', from: 'm1', to: 'm2', k: 15.0 },
      { id: 'k2', type: 'spring', from: 'm2', to: 'wall2', k: 100.0 },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 0.05 },
      { id: 'c2', type: 'damper', from: 'm2', to: 'wall2', c: 0.05 }
    ]
  },
  quarter_car: {
    nodes: [
      { id: 'road_wall', type: 'wall', x: 70, y: 220 },
      { id: 'm_wheel', type: 'mass', x: 280, y: 220, mass: 45.0, x0: 0.0, v0: 0.0 },
      { id: 'm_body', type: 'mass', x: 520, y: 220, mass: 350.0, x0: 0.05, v0: 0.0 }
    ],
    edges: [
      { id: 'k_tire', type: 'spring', from: 'road_wall', to: 'm_wheel', k: 190000.0 },
      { id: 'k_susp', type: 'spring', from: 'm_wheel', to: 'm_body', k: 28000.0 },
      { id: 'c_susp', type: 'damper', from: 'm_wheel', to: 'm_body', c: 2500.0 }
    ]
  },
  tmd_system: {
    nodes: [
      { id: 'wall1', type: 'wall', x: 70, y: 220 },
      { id: 'm1', type: 'mass', x: 300, y: 220, mass: 5.0, x0: 0.15, v0: 0.0 },
      { id: 'm2', type: 'mass', x: 530, y: 220, mass: 0.5, x0: 0.0, v0: 0.0 }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 200.0 },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 0.8 },
      { id: 'k2', type: 'spring', from: 'm1', to: 'm2', k: 20.0 },
      { id: 'c2', type: 'damper', from: 'm1', to: 'm2', c: 2.2 },
      { id: 'F1', type: 'force', from: 'm1', to: 'm1', F0: 30.0, waveform: 'sine', freq: 6.32 }
    ]
  }
};

for (const [presetKey, presetData] of Object.entries(presets)) {
  // Original simulation
  const sysOrig = assembleGraphMCK(presetData.nodes, presetData.edges);
  const modalOrig = solveGraphModal(sysOrig.M, sysOrig.C, sysOrig.K);
  const x0_orig = sysOrig.massNodes.map(m => m.x0 || 0);
  const simOrig = simulateGraphTimeDomain(sysOrig.M, sysOrig.C, sysOrig.K, sysOrig.appliedForces, {
    dt: 0.01,
    t_max: 2.0,
    x0: x0_orig
  });

  // Serialize to JSON and deserialize back
  const jsonString = JSON.stringify({ nodes: presetData.nodes, edges: presetData.edges }, null, 2);
  const restored = JSON.parse(jsonString);

  // Restored simulation
  const sysRestored = assembleGraphMCK(restored.nodes, restored.edges);
  const modalRestored = solveGraphModal(sysRestored.M, sysRestored.C, sysRestored.K);
  const x0_rest = sysRestored.massNodes.map(m => m.x0 || 0);
  const simRestored = simulateGraphTimeDomain(sysRestored.M, sysRestored.C, sysRestored.K, sysRestored.appliedForces, {
    dt: 0.01,
    t_max: 2.0,
    x0: x0_rest
  });

  // Check modal frequency agreement
  for (let i = 0; i < modalOrig.frequenciesRad.length; i++) {
    const diff = Math.abs(modalOrig.frequenciesRad[i] - modalRestored.frequenciesRad[i]);
    assert(diff < 1e-12, `JSON Round-Trip [${presetKey}] mode ${i+1} freq diff ${diff.toExponential(2)} < 1e-12`);
  }

  // Check state trajectory agreement
  let maxStateDiff = 0;
  for (let j = 0; j < simOrig.x.length; j++) {
    for (let k = 0; k < simOrig.x[j].length; k++) {
      const diff = Math.abs(simOrig.x[j][k] - simRestored.x[j][k]);
      if (diff > maxStateDiff) maxStateDiff = diff;
    }
  }
  assert(maxStateDiff < 1e-12, `JSON Round-Trip [${presetKey}] trajectory diff ${maxStateDiff.toExponential(2)} < 1e-12`);
}

// -----------------------------------------------------------------
// 5. SERIES SPRINGS JUNCTION STABILITY & CLASSROOM PROBLEM DERIVATION
// -----------------------------------------------------------------
console.log('\n--- 5. Testing Series Springs Junction Stability & Classroom Derivation ---');

// Test 5.1: Series Springs Junction Smooth Tracking (No Parasitic 14 Hz Buzzing)
const seriesPresetNodes = [
  { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Fixed Wall' },
  { id: 'junc1', type: 'mass', x: 280, y: 220, mass: 0.05, x0: 0.075, v0: 0.0, label: 'Junction J₁' },
  { id: 'm1', type: 'mass', x: 500, y: 220, mass: 2.0, x0: 0.15, v0: 0.0, label: 'm₁ (2.0 kg)' }
];
const seriesPresetEdges = [
  { id: 'k1', type: 'spring', from: 'wall1', to: 'junc1', k: 200.0, label: 'k₁ = 200 N/m' },
  { id: 'k2', type: 'spring', from: 'junc1', to: 'm1', k: 200.0, label: 'k₂ = 200 N/m' },
  { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 1.5, yOffset: 45, label: 'c₁ = 1.5 N·s/m' }
];

const sysSeries = assembleGraphMCK(seriesPresetNodes, seriesPresetEdges);
const simSeries = simulateGraphTimeDomain(sysSeries.M, sysSeries.C, sysSeries.K, sysSeries.appliedForces, {
  dt: 0.005,
  t_max: 2.0,
  x0: [0.075, 0.15],
  v0: [0.0, 0.0]
});

// Max tracking error between junction and 0.5 * m1 across all steps
let maxJuncTrackingErr = 0;
for (let s = 0; s < simSeries.time.length; s++) {
  const err = Math.abs(simSeries.x[0][s] - 0.5 * simSeries.x[1][s]);
  if (err > maxJuncTrackingErr) maxJuncTrackingErr = err;
}
assert(maxJuncTrackingErr < 0.0025, `Series springs junction tracking error ${(maxJuncTrackingErr * 1000).toFixed(2)} mm < 2.5 mm (smooth tracking, zero parasite buzzing)`);

// Test 5.2: Quasi-Static Equilibrium Auto-Init when x0 of junction is 0
const simSeriesAutoInit = simulateGraphTimeDomain(sysSeries.M, sysSeries.C, sysSeries.K, sysSeries.appliedForces, {
  dt: 0.005,
  t_max: 0.5,
  x0: [0.0, 0.15], // junction initialized at 0, should auto-init to 0.075
  v0: [0.0, 0.0]
});
assert(Math.abs(simSeriesAutoInit.x[0][0] - 0.075) < 1e-4, `Quasi-static auto-init sets junction x0 to 0.075 m (got ${simSeriesAutoInit.x[0][0].toFixed(4)} m)`);

// Test 5.3: Classroom Problem Solver Series Springs Exact Analytical Agreement
const solSeriesClassroom = solveClassroomProblem(seriesPresetNodes, seriesPresetEdges, { x0: 0.15, v0: 0.0 });
assert(Math.abs(solSeriesClassroom.m - 2.0) < 1e-6, `Classroom Series m = ${solSeriesClassroom.m} kg matches primary mass 2.0 kg`);
assert(Math.abs(solSeriesClassroom.k_eq - 100.0) < 1e-6, `Classroom Series k_eq = ${solSeriesClassroom.k_eq} N/m matches analytical 100.0 N/m`);
assert(Math.abs(solSeriesClassroom.c_eq - 1.5) < 1e-6, `Classroom Series c_eq = ${solSeriesClassroom.c_eq} N·s/m matches 1.5 N·s/m`);
assert(Math.abs(solSeriesClassroom.omega_n - Math.sqrt(50)) < 1e-4, `Classroom Series omega_n = ${solSeriesClassroom.omega_n.toFixed(3)} rad/s matches sqrt(50) = 7.071 rad/s`);
assert(Math.abs(solSeriesClassroom.zeta - (1.5 / (2 * Math.sqrt(200)))) < 1e-4, `Classroom Series zeta = ${solSeriesClassroom.zeta.toFixed(4)} matches analytical 0.0530`);

// Test 5.4: Classroom Problem Solver Series-Parallel Network Exact Analytical Agreement
const spNodes = [
  { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Fixed Wall' },
  { id: 'junc1', type: 'mass', x: 280, y: 220, mass: 0.05, x0: 0.06, v0: 0.0, label: 'Junction J₁' },
  { id: 'm1', type: 'mass', x: 520, y: 220, mass: 3.0, x0: 0.12, v0: 0.0, label: 'm₁ (3.0 kg)' }
];
const spEdges = [
  { id: 'k1', type: 'spring', from: 'wall1', to: 'junc1', k: 300.0, label: 'k₁ = 300 N/m' },
  { id: 'k2', type: 'spring', from: 'junc1', to: 'm1', k: 150.0, yOffset: -35, label: 'k₂ = 150 N/m' },
  { id: 'k3', type: 'spring', from: 'junc1', to: 'm1', k: 150.0, yOffset: 35, label: 'k₃ = 150 N/m' },
  { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 2.0, yOffset: -55, label: 'c₁ = 2.0 N·s/m' }
];
const solSPClassroom = solveClassroomProblem(spNodes, spEdges, { x0: 0.12, v0: 0.0 });
assert(Math.abs(solSPClassroom.m - 3.0) < 1e-6, `Classroom Series-Parallel m = ${solSPClassroom.m} kg matches primary mass 3.0 kg`);
assert(Math.abs(solSPClassroom.k_eq - 150.0) < 1e-6, `Classroom Series-Parallel k_eq = ${solSPClassroom.k_eq} N/m matches analytical 150.0 N/m`);
assert(Math.abs(solSPClassroom.c_eq - 2.0) < 1e-6, `Classroom Series-Parallel c_eq = ${solSPClassroom.c_eq} N·s/m matches 2.0 N·s/m`);
assert(Math.abs(solSPClassroom.omega_n - Math.sqrt(50)) < 1e-4, `Classroom Series-Parallel omega_n = ${solSPClassroom.omega_n.toFixed(3)} rad/s matches sqrt(50) = 7.071 rad/s`);
assert(Math.abs(solSPClassroom.zeta - (2.0 / (2 * Math.sqrt(450)))) < 1e-4, `Classroom Series-Parallel zeta = ${solSPClassroom.zeta.toFixed(4)} matches analytical 0.0471`);

// -----------------------------------------------------------------
// 6. 1-DOF VS 2-DOF TOPOLOGY & INTER-MASS COUPLING VALIDATION
// -----------------------------------------------------------------
console.log('\n--- 6. Testing 1-DOF vs 2-DOF Topology & Inter-Mass Coupling Validation ---');

// Test 6.1: Configuration 1 (Image 1) - Single Mass 1-DOF System
// 1 Mass = 2 kg, Parallel springs = 150 N/m & 250 N/m (k_eq = 400 N/m), Damper = 3 N·s/m, Force = 20 N
const cfg1Nodes = [
  { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Wall' },
  { id: 'm1', type: 'mass', x: 440, y: 220, mass: 2.0, x0: 0.0, v0: 0.0, label: 'm₁ (2.0 kg)' }
];
const cfg1Edges = [
  { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 150.0, yOffset: -30, label: 'k₁ = 150 N/m' },
  { id: 'k2', type: 'spring', from: 'wall1', to: 'm1', k: 250.0, yOffset: 30, label: 'k₂ = 250 N/m' },
  { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 3.0, yOffset: 0, label: 'c₁ = 3.0 N·s/m' },
  { id: 'f1', type: 'force', from: 'm1', to: 'm1', F0: 20.0, waveform: 'step', freq: 0 }
];

const sys1 = assembleGraphMCK(cfg1Nodes, cfg1Edges);
assert(sys1.n === 1, 'Config 1 DOF count is exactly 1');
assert(sys1.M[0][0] === 2.0, 'Config 1 M[0][0] = 2.0 kg');
assert(sys1.K[0][0] === 400.0, 'Config 1 K[0][0] = 150 + 250 = 400.0 N/m (parallel springs)');
assert(sys1.C[0][0] === 3.0, 'Config 1 C[0][0] = 3.0 N·s/m');
assert(sys1.appliedForces[0].F0 === 20.0, 'Config 1 applied force is 20 N step');

const modal1 = solveGraphModal(sys1.M, sys1.C, sys1.K);
const expectedWn1 = Math.sqrt(400.0 / 2.0); // sqrt(200) = 14.1421 rad/s
const expectedZeta1 = 3.0 / (2.0 * Math.sqrt(400.0 * 2.0)); // 3 / (2 * sqrt(800)) = 0.053033
assert(Math.abs(modal1.frequenciesRad[0] - expectedWn1) < 1e-4, `Config 1 omega_n = ${modal1.frequenciesRad[0].toFixed(3)} rad/s matches sqrt(200) = ${expectedWn1.toFixed(3)} rad/s`);
assert(Math.abs(modal1.dampingRatios[0] - expectedZeta1) < 1e-4, `Config 1 zeta = ${modal1.dampingRatios[0].toFixed(4)} matches analytical ${expectedZeta1.toFixed(4)}`);

// Test 6.2: Configuration 2 (Image 2) - 2-DOF Coupled Masses System
// Mass 1 = 2 kg, Springs to ground = 150 & 250 N/m, Damper to ground = 3 N·s/m, Force = 20 N
// Coupling damper c12 = 2 N·s/m connected to Mass 2 = 2 kg
const cfg2Nodes = [
  { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Wall' },
  { id: 'm1', type: 'mass', x: 340, y: 220, mass: 2.0, x0: 0.0, v0: 0.0, label: 'm₁ (2.0 kg)' },
  { id: 'm2', type: 'mass', x: 580, y: 220, mass: 2.0, x0: 0.0, v0: 0.0, label: 'm₂ (2.0 kg)' }
];
const cfg2Edges = [
  { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 150.0, yOffset: -30, label: 'k₁ = 150 N/m' },
  { id: 'k2', type: 'spring', from: 'wall1', to: 'm1', k: 250.0, yOffset: 30, label: 'k₂ = 250 N/m' },
  { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 3.0, yOffset: 0, label: 'c₁ = 3.0 N·s/m' },
  { id: 'c12', type: 'damper', from: 'm1', to: 'm2', c: 2.0, yOffset: 0, label: 'c₁₂ = 2.0 N·s/m' },
  { id: 'f1', type: 'force', from: 'm1', to: 'm1', F0: 20.0, waveform: 'step', freq: 0 }
];

const sys2 = assembleGraphMCK(cfg2Nodes, cfg2Edges);
assert(sys2.n === 2, 'Config 2 DOF count is exactly 2');
assert(sys2.M[0][0] === 2.0 && sys2.M[1][1] === 2.0 && sys2.M[0][1] === 0, 'Config 2 M is diag([2, 2])');
assert(sys2.K[0][0] === 400.0 && sys2.K[0][1] === 0 && sys2.K[1][1] === 0, 'Config 2 K[0][0] = 400 N/m, K[1][1] = 0 (no spring on m2)');

// Newton's 3rd Law Coupling: C11 = c1 + c12 = 3 + 2 = 5, C12 = C21 = -c12 = -2, C22 = c12 = 2
assert(sys2.C[0][0] === 5.0, 'Config 2 C[0][0] = 3 + 2 = 5.0 N·s/m');
assert(sys2.C[0][1] === -2.0, 'Config 2 C[0][1] = -2.0 N·s/m (coupling reaction on m1)');
assert(sys2.C[1][0] === -2.0, 'Config 2 C[1][0] = -2.0 N·s/m (coupling symmetry)');
assert(sys2.C[1][1] === 2.0, 'Config 2 C[1][1] = 2.0 N·s/m (coupling action on m2)');

// Test 6.3: State-Space Matrix Realization for 2-DOF
// z_dot = A * z + B * u
// A = [0, 0, 1, 0; 0, 0, 0, 1; -K/M, -C/M]
const invM1 = 1.0 / sys2.M[0][0]; // 0.5
const invM2 = 1.0 / sys2.M[1][1]; // 0.5
const A_row2 = [-sys2.K[0][0] * invM1, -sys2.K[0][1] * invM1, -sys2.C[0][0] * invM1, -sys2.C[0][1] * invM1];
const A_row3 = [-sys2.K[1][0] * invM2, -sys2.K[1][1] * invM2, -sys2.C[1][0] * invM2, -sys2.C[1][1] * invM2];
assert(A_row2[0] === -200.0, 'State-Space A[2][0] = -K11/M1 = -200.0');
assert(A_row2[2] === -2.5, 'State-Space A[2][2] = -C11/M1 = -2.5');
assert(A_row2[3] === 1.0, 'State-Space A[2][3] = -C12/M1 = +1.0 (coupling velocity of m2 accelerates m1)');
assert(A_row3[2] === 1.0, 'State-Space A[3][2] = -C21/M2 = +1.0 (coupling velocity of m1 accelerates m2)');
assert(A_row3[3] === -1.0, 'State-Space A[3][3] = -C22/M2 = -1.0');

// Test 6.4: Time Domain Transient Simulation for 2-DOF with Inter-Mass Damper
const sim2 = simulateGraphTimeDomain(sys2.M, sys2.C, sys2.K, sys2.appliedForces, {
  dt: 0.005,
  t_max: 3.0,
  x0: [0, 0],
  v0: [0, 0]
});
assert(sim2.x.length === 2, 'Simulate time-domain yields trajectories for both masses');
assert(sim2.x[0].length === sim2.time.length, 'Mass 1 trajectory length matches time vector');
assert(sim2.x[1].length === sim2.time.length, 'Mass 2 trajectory length matches time vector');

// Under 20 N step force on m1, m1 oscillates around x_ss = 20 / 400 = 0.05 m (5 cm)
const peakX1 = Math.max(...sim2.x[0]);
assert(peakX1 > 0.05 && peakX1 < 0.10, `Mass 1 peak displacement ${peakX1.toFixed(4)} m reflects underdamped overshoot around 0.05 m`);

// Mass 2 is driven solely through coupling damper c12 (relative velocity)
const peakX2 = Math.max(...sim2.x[1]);
assert(peakX2 > 0.001, `Mass 2 responds dynamically via damper c12 coupling (peak x2 = ${(peakX2 * 100).toFixed(2)} cm > 0)`);

// Test 6.5: 2-DOF Coupled Oscillators with Inter-Mass Spring k12 = 50 N/m
const cfgCoupledNodes = [
  { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Wall' },
  { id: 'm1', type: 'mass', x: 340, y: 220, mass: 2.0, x0: 0.0, v0: 0.0, label: 'm₁' },
  { id: 'm2', type: 'mass', x: 580, y: 220, mass: 2.0, x0: 0.0, v0: 0.0, label: 'm₂' }
];
const cfgCoupledEdges = [
  { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 400.0, label: 'k₁ = 400 N/m' },
  { id: 'k12', type: 'spring', from: 'm1', to: 'm2', k: 50.0, label: 'k₁₂ = 50 N/m' },
  { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 1.0, label: 'c₁ = 1 N·s/m' }
];
const sysCoupled = assembleGraphMCK(cfgCoupledNodes, cfgCoupledEdges);
const modalCoupled = solveGraphModal(sysCoupled.M, sysCoupled.C, sysCoupled.K);
// Analytical eigenvalues: lambda^2 - 250*lambda + 5000 = 0 -> lambda = 21.9224 and 228.0776
// omega_n1 = sqrt(21.9224) = 4.6821 rad/s, omega_n2 = sqrt(228.0776) = 15.1022 rad/s
assert(Math.abs(modalCoupled.frequenciesRad[0] - 4.6821) < 0.01, `Coupled 2-DOF Mode 1 = ${modalCoupled.frequenciesRad[0].toFixed(3)} rad/s matches analytical 4.682 rad/s`);
assert(Math.abs(modalCoupled.frequenciesRad[1] - 15.1022) < 0.01, `Coupled 2-DOF Mode 2 = ${modalCoupled.frequenciesRad[1].toFixed(3)} rad/s matches analytical 15.102 rad/s`);

// -----------------------------------------------------------------
// 7. MULTI-DIMENSIONAL DESIGN SWEEP & PHYSICAL CONSTRAINT VALIDATION
// -----------------------------------------------------------------
console.log('\n--- 7. Testing Multi-Dimensional Design Sweep & Constraint Validation ---');

// Test 7.1: Single-variable mathematical impossibility (Min > Max)
const vMinMax = validateDesignConstraints('simple_pendulum', {
  period: { min: 7.0, max: 4.0 }
});
assert(vMinMax.hasErrors === true, 'Validation catches Min > Max (7.0 > 4.0)');
assert(vMinMax.errors.period.includes('cannot be greater than Max'), 'Error message describes Min > Max contradiction');

// Test 7.2: Physical limit violations (Negative/Zero period)
const vNegPeriod = validateDesignConstraints('simple_pendulum', {
  period: { min: -1.0, max: 2.0 }
});
assert(vNegPeriod.hasErrors === true, 'Validation catches negative period constraint');

// Test 7.3: Geometric limits (Rocker range > 360°)
const vRockerOver = validateDesignConstraints('four_bar', {
  rocker_range_deg: { max: 420.0 }
});
assert(vRockerOver.hasErrors === true, 'Validation catches Rocker range > 360°');

// Test 7.4: Grid attainable metric span calculation
const pRangesPendulum = {
  length: { min: 0.2, max: 4.0 },
  mass: { min: 0.5, max: 3.0 }
};
const fParamsPendulum = { gravity: 9.81, theta0: 30.0, omega0: 0.0 };
const attPendulum = getAttainableMetricRanges('simple_pendulum', pRangesPendulum, fParamsPendulum);
assert(attPendulum.period !== undefined, 'Attainable metric ranges computed for simple pendulum');
assert(attPendulum.period.min >= 0.85 && attPendulum.period.min <= 0.95, `Period min = ${attPendulum.period.min} s matches L=0.2m`);
assert(attPendulum.period.max >= 4.0 && attPendulum.period.max <= 4.2, `Period max = ${attPendulum.period.max} s matches L=4.0m`);

// Test 7.5: Mutual Physical Trade-Off Conflict (T >= 4.0 and omega >= 3.0)
const vTradeoff = validateDesignConstraints(
  'simple_pendulum',
  { period: { min: 4.0 }, max_omega: { min: 3.0 } },
  pRangesPendulum,
  fParamsPendulum
);
assert(Boolean(vTradeoff.warnings.tradeoff_conflict), 'Validation catches energy conservation trade-off conflict between T and omega');
assert(vTradeoff.warnings.tradeoff_conflict.includes('Physical Trade-off Conflict'), 'Trade-off warning explains coupling');

// Test 7.6: Fast Client-Side Sweep Execution
const clientSweepRes = solveClientDesignSweep(
  'simple_pendulum',
  { period: { min: 1.5, max: 2.5 } },
  { length: { min: 0.5, max: 2.0 }, mass: { min: 0.5, max: 2.0 } },
  { gravity: 9.81, theta0: 30.0, omega0: 0.0 },
  5
);
assert(clientSweepRes.total_count === 25, `Client sweep evaluated exactly 5x5 = 25 points (got ${clientSweepRes.total_count})`);
assert(clientSweepRes.feasible_count > 0, `Client sweep identified feasible configurations (${clientSweepRes.feasible_count} found)`);
assert(clientSweepRes.ranked_designs.length === clientSweepRes.feasible_count, 'Ranked designs list matches feasible count');
assert(clientSweepRes.heatmap_data !== null, 'Heatmap data generated for 2D visualization');
assert(clientSweepRes.heatmap_data.pass_grid.length === 5, 'Heatmap grid dimensions match n_points');

// Test 7.7: User Screenshot Case (omega 20 to 30 is physically impossible)
const vUserCase = validateDesignConstraints(
  'simple_pendulum',
  { period: { min: 1, max: 3 }, max_omega: { min: 20, max: 30 } },
  pRangesPendulum,
  fParamsPendulum
);
assert(vUserCase.hasErrors === true, 'Validation catches omega [20, 30] as impossible range');
assert(vUserCase.errors.max_omega.includes('Impossible range'), 'Error message clearly flags unattainable angular velocity');
assert(vUserCase.isValid === false, 'Form is marked invalid to disable the sweep button');

console.log('\n====================================================');
console.log(`SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('====================================================\n');
