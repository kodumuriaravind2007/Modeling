// clientSimulation.js
// High-performance client-side simulation engine for ARCHE Workstation.
// Powered by src/core/kinematics.js (Single Source of Truth).
//
// 1. Simple Pendulum (Nonlinear symplectic RK4, energy, exact elliptic period)
// 2. Compound Pendulum (Rigid-body RK4, parallel axis theorem, effective length)
// 3. Slider-Crank (Exact analytical loop closure, velocity, acceleration)
// 4. Four-Bar Linkage (Law of Cosines, continuous branch tracking, zero loop closure error)

import {
  rk4StepSimplePendulum,
  rk4StepCompoundPendulum,
  pendulumTotalEnergy,
  compoundPendulumTotalEnergy,
  exactSimplePendulumPeriod,
  exactCompoundPendulumPeriod,
  solveSliderCrank,
  solveFourBarPosition,
  solveFourBarVelocityAndAcceleration,
  classifyGrashof,
  computeReachableInputArc
} from './core/kinematics.js';

// ── 1. Simple Pendulum Simulation ──────────────────────────────────────
export function simulateSimplePendulum(params = {}) {
  const L = Math.max(0.05, Number(params.length) || 1.0);
  const m = Math.max(0.01, Number(params.mass) || 1.0);
  const g = Math.max(0.1, Number(params.gravity) || 9.81);
  const b = Math.max(0.0, Number(params.damping) || 0.0);
  const theta0Deg = Number(params.theta0 ?? 30.0);
  const omega0 = Number(params.omega0 ?? 0.0);
  const t_max = Math.max(1.0, Number(params.t_max) || 15.0);
  const dt = Math.max(0.001, Number(params.dt) || 0.01);

  const nSteps = Math.max(2, Math.round(t_max / dt) + 1);
  const time = new Array(nSteps);
  const theta = new Array(nSteps);
  const theta_deg = new Array(nSteps);
  const omega = new Array(nSteps);
  const alpha = new Array(nSteps);
  const x = new Array(nSteps);
  const y = new Array(nSteps);
  const vx = new Array(nSteps);
  const vy = new Array(nSteps);
  const KE = new Array(nSteps);
  const PE = new Array(nSteps);
  const total_E = new Array(nSteps);

  let currentTh = (theta0Deg * Math.PI) / 180;
  let currentW = omega0;

  const initialE = pendulumTotalEnergy(currentTh, currentW, { m, L, g }).total;
  let maxEnergyDev = 0;

  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    time[i] = t;
    theta[i] = currentTh;
    theta_deg[i] = (currentTh * 180) / Math.PI;
    omega[i] = currentW;

    // Angular acceleration
    const b_eff = b / (m * L * L);
    alpha[i] = -(g / L) * Math.sin(currentTh) - b_eff * currentW;

    // Coordinates
    x[i] = L * Math.sin(currentTh);
    y[i] = -L * Math.cos(currentTh);

    // Linear velocities
    vx[i] = L * currentW * Math.cos(currentTh);
    vy[i] = L * currentW * Math.sin(currentTh);

    // Energy
    const en = pendulumTotalEnergy(currentTh, currentW, { m, L, g });
    KE[i] = en.kinetic;
    PE[i] = en.potential;
    total_E[i] = en.total;

    const dev = Math.abs(en.total - initialE);
    if (dev > maxEnergyDev) maxEnergyDev = dev;

    // RK4 Step
    const next = rk4StepSimplePendulum(currentTh, currentW, dt, { L, g, m, b });
    currentTh = next.theta;
    currentW = next.omega;
  }

  const finalE = total_E[nSteps - 1];
  const energy_drift = initialE !== 0 ? maxEnergyDev / Math.abs(initialE) : 0;
  const energy_dissipated = Math.max(0, initialE - finalE);
  const energy_dissipated_fraction = initialE !== 0 ? Math.max(0, (initialE - finalE) / initialE) : 0;

  const T_exact = exactSimplePendulumPeriod(L, g, (theta0Deg * Math.PI) / 180);

  return {
    sim_type: 'simple_pendulum',
    time,
    theta,
    theta_deg,
    omega,
    alpha,
    x,
    y,
    vx,
    vy,
    KE,
    PE,
    total_E,
    energy_drift: b === 0 ? energy_drift : 0.0,
    energy_dissipated: b > 0 ? energy_dissipated : 0.0,
    energy_dissipated_fraction,
    T_exact,
    params: { length: L, mass: m, gravity: g, damping: b, theta0: theta0Deg, omega0, dt, t_max }
  };
}

// ── 2. Compound Pendulum Simulation ────────────────────────────────────
export function simulateCompoundPendulum(params = {}) {
  const L = Math.max(0.05, Number(params.length) || 1.0);
  const m = Math.max(0.01, Number(params.mass) || 2.0);
  const g = Math.max(0.1, Number(params.gravity) || 9.81);
  const b = Math.max(0.0, Number(params.damping) || 0.0);
  const theta0Deg = Number(params.theta0 ?? 25.0);
  const omega0 = Number(params.omega0 ?? 0.0);
  const t_max = Math.max(1.0, Number(params.t_max) || 15.0);
  const dt = Math.max(0.001, Number(params.dt) || 0.01);

  const d = L / 2.0;
  const I_pivot = (1.0 / 3.0) * m * L * L;
  const L_eff = 2.0 * L / 3.0;

  const nSteps = Math.max(2, Math.round(t_max / dt) + 1);
  const time = new Array(nSteps);
  const theta = new Array(nSteps);
  const theta_deg = new Array(nSteps);
  const omega = new Array(nSteps);
  const alpha = new Array(nSteps);
  const x = new Array(nSteps);
  const y = new Array(nSteps);
  const vx = new Array(nSteps);
  const vy = new Array(nSteps);
  const KE = new Array(nSteps);
  const PE = new Array(nSteps);
  const total_E = new Array(nSteps);

  let currentTh = (theta0Deg * Math.PI) / 180;
  let currentW = omega0;

  const initialE = compoundPendulumTotalEnergy(currentTh, currentW, { m, L, g }).total;
  let maxEnergyDev = 0;

  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    time[i] = t;
    theta[i] = currentTh;
    theta_deg[i] = (currentTh * 180) / Math.PI;
    omega[i] = currentW;

    alpha[i] = -(m * g * d * Math.sin(currentTh) + b * currentW) / I_pivot;

    // Tip position
    x[i] = L * Math.sin(currentTh);
    y[i] = -L * Math.cos(currentTh);
    vx[i] = L * currentW * Math.cos(currentTh);
    vy[i] = L * currentW * Math.sin(currentTh);

    const en = compoundPendulumTotalEnergy(currentTh, currentW, { m, L, g });
    KE[i] = en.kinetic;
    PE[i] = en.potential;
    total_E[i] = en.total;

    const dev = Math.abs(en.total - initialE);
    if (dev > maxEnergyDev) maxEnergyDev = dev;

    // RK4 Step
    const next = rk4StepCompoundPendulum(currentTh, currentW, dt, { L, g, m, b });
    currentTh = next.theta;
    currentW = next.omega;
  }

  const finalE = total_E[nSteps - 1];
  const energy_drift = initialE !== 0 ? maxEnergyDev / Math.abs(initialE) : 0;
  const energy_dissipated = Math.max(0, initialE - finalE);
  const energy_dissipated_fraction = initialE !== 0 ? Math.max(0, (initialE - finalE) / initialE) : 0;

  const T_exact = exactCompoundPendulumPeriod(L, g, (theta0Deg * Math.PI) / 180);

  return {
    sim_type: 'compound_pendulum',
    time,
    theta,
    theta_deg,
    omega,
    alpha,
    x,
    y,
    vx,
    vy,
    KE,
    PE,
    total_E,
    energy_drift: b === 0 ? energy_drift : 0.0,
    energy_dissipated: b > 0 ? energy_dissipated : 0.0,
    energy_dissipated_fraction,
    T_exact,
    I_pivot,
    L_eff,
    d,
    params: { length: L, mass: m, gravity: g, damping: b, theta0: theta0Deg, omega0, dt, t_max }
  };
}

// ── 3. Slider-Crank Simulation ─────────────────────────────────────────
export function simulateSliderCrank(params = {}) {
  const r = Math.max(0.01, Number(params.crank_length) || 0.1);
  const l = Math.max(r + 0.001, Number(params.conn_length) || 0.3);
  const speed = Math.max(1.0, Number(params.crank_speed) || 60.0);
  const t_max = Math.max(0.5, Number(params.t_max) || 5.0);
  const dt = Math.max(0.001, Number(params.dt) || 0.005);

  const omega = (speed * 2 * Math.PI) / 60;
  const nSteps = Math.max(2, Math.round(t_max / dt) + 1);

  const time = new Array(nSteps);
  const crank_angle = new Array(nSteps);
  const crank_angle_deg = new Array(nSteps);
  const x_slider = new Array(nSteps);
  const v_slider = new Array(nSteps);
  const a_slider = new Array(nSteps);
  const conn_rod_angle_deg = new Array(nSteps);
  const bx = new Array(nSteps);
  const by = new Array(nSteps);

  let xMax = -Infinity;
  let xMin = Infinity;
  let vMax = 0;
  let aMax = 0;

  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    time[i] = t;
    const th = omega * t;
    crank_angle[i] = th;
    crank_angle_deg[i] = (th * 180 / Math.PI) % 360;

    const sol = solveSliderCrank(r, l, th, omega);
    x_slider[i] = sol.x;
    v_slider[i] = sol.v;
    a_slider[i] = sol.a;
    conn_rod_angle_deg[i] = (sol.phi * 180) / Math.PI;
    bx[i] = sol.B.x;
    by[i] = sol.B.y;

    if (sol.x > xMax) xMax = sol.x;
    if (sol.x < xMin) xMin = sol.x;
    if (Math.abs(sol.v) > vMax) vMax = Math.abs(sol.v);
    if (Math.abs(sol.a) > aMax) aMax = Math.abs(sol.a);
  }

  const stroke = xMax - xMin;

  return {
    sim_type: 'slider_crank',
    time,
    crank_angle,
    crank_angle_deg,
    x_slider,
    v_slider,
    a_slider,
    conn_rod_angle_deg,
    bx,
    by,
    stroke,
    x_max: xMax,
    x_min: xMin,
    v_max: vMax,
    a_max: aMax,
    lambda: r / l,
    params: { crank_length: r, conn_length: l, crank_speed: speed, dt, t_max }
  };
}

// ── 4. Four-Bar Linkage Simulation (Law of Cosines Single Source of Truth)
export function simulateFourBar(params = {}) {
  const d = Math.max(0.1, Number(params.link_ground) || 4.0);
  const a = Math.max(0.1, Number(params.link_crank) || 1.0);
  const b = Math.max(0.1, Number(params.link_coupler) || 2.5);
  const c = Math.max(0.1, Number(params.link_rocker) || 3.0);
  const speed = Math.max(1.0, Number(params.crank_speed) || 60.0);
  const t_max = Math.max(0.5, Number(params.t_max) || 5.0);
  const dt = Math.max(0.001, Number(params.dt) || 0.005);

  const omega2 = (speed * 2 * Math.PI) / 60;
  const nSteps = Math.max(2, Math.round(t_max / dt) + 1);

  const time = new Array(nSteps);
  const crank_angle_deg = new Array(nSteps);
  const coupler_angle_deg = new Array(nSteps);
  const rocker_angle_deg = new Array(nSteps);
  const omega3 = new Array(nSteps);
  const omega4 = new Array(nSteps);
  const alpha3 = new Array(nSteps);
  const alpha4 = new Array(nSteps);
  const bx = new Array(nSteps);
  const by = new Array(nSteps);
  const cx = new Array(nSteps);
  const cy = new Array(nSteps);
  const coupler_x = new Array(nSteps);
  const coupler_y = new Array(nSteps);
  const transmission_angle_deg = new Array(nSteps);

  let minTh4 = Infinity;
  let maxTh4 = -Infinity;
  let prevTh4 = null;
  let maxLoopError = 0;

  const arcInfo = computeReachableInputArc(d, a, b, c);
  const isFull = arcInfo.isFullRotation;
  const isImpos = arcInfo.impossible;
  const arcSpan = (arcInfo.maxAngle - arcInfo.minAngle) / 2;
  const arcCenter = (arcInfo.maxAngle + arcInfo.minAngle) / 2;

  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    time[i] = t;
    let th2;
    if (isFull) {
      th2 = omega2 * t;
      crank_angle_deg[i] = (th2 * 180 / Math.PI) % 360;
    } else if (!isImpos) {
      th2 = arcCenter + (arcSpan * 0.98) * Math.sin(omega2 * t);
      crank_angle_deg[i] = (th2 * 180 / Math.PI);
    } else {
      th2 = 0;
      crank_angle_deg[i] = 0;
    }

    const sol = solveFourBarPosition(d, a, b, c, th2, prevTh4);
    if (sol.success) {
      bx[i] = sol.B.x;
      by[i] = sol.B.y;
      cx[i] = sol.C.x;
      cy[i] = sol.C.y;
      coupler_x[i] = 0.5 * (sol.B.x + sol.C.x);
      coupler_y[i] = 0.5 * (sol.B.y + sol.C.y);
      coupler_angle_deg[i] = (sol.theta3 * 180) / Math.PI;
      rocker_angle_deg[i] = (sol.theta4 * 180) / Math.PI;
      transmission_angle_deg[i] = sol.transmissionAngleDeg;

      if (sol.loopClosureError > maxLoopError) maxLoopError = sol.loopClosureError;
      if (sol.theta4 < minTh4) minTh4 = sol.theta4;
      if (sol.theta4 > maxTh4) maxTh4 = sol.theta4;
      prevTh4 = sol.theta4;

      const velSol = solveFourBarVelocityAndAcceleration(
        d, a, b, c, th2, sol.theta3, sol.theta4, omega2
      );
      omega3[i] = velSol.success ? velSol.omega3 : 0;
      omega4[i] = velSol.success ? velSol.omega4 : 0;
      alpha3[i] = velSol.success ? velSol.alpha3 : 0;
      alpha4[i] = velSol.success ? velSol.alpha4 : 0;
    } else {
      bx[i] = sol.B.x;
      by[i] = sol.B.y;
      cx[i] = d;
      cy[i] = 0;
      coupler_x[i] = sol.B.x;
      coupler_y[i] = sol.B.y;
      coupler_angle_deg[i] = 0;
      rocker_angle_deg[i] = 0;
      omega3[i] = 0;
      omega4[i] = 0;
      alpha3[i] = 0;
      alpha4[i] = 0;
      transmission_angle_deg[i] = 0;
    }
  }

  const rocker_range_deg = maxTh4 > minTh4 ? ((maxTh4 - minTh4) * 180) / Math.PI : 0;
  const grashofInfo = classifyGrashof(d, a, b, c);

  return {
    sim_type: 'four_bar',
    time,
    crank_angle_deg,
    coupler_angle_deg,
    rocker_angle_deg,
    omega3,
    omega4,
    alpha3,
    alpha4,
    bx,
    by,
    cx,
    cy,
    coupler_x,
    coupler_y,
    transmission_angle_deg,
    rocker_range_deg,
    max_loop_error: maxLoopError,
    grashof_info: grashofInfo,
    params: { link_ground: d, link_crank: a, link_coupler: b, link_rocker: c, crank_speed: speed, dt, t_max }
  };
}

// ── Master Dispatcher ──────────────────────────────────────────────────
export function simulateClient(simType, params) {
  if (simType === 'simple_pendulum') {
    return simulateSimplePendulum(params);
  } else if (simType === 'compound_pendulum') {
    return simulateCompoundPendulum(params);
  } else if (simType === 'slider_crank') {
    return simulateSliderCrank(params);
  } else if (simType === 'four_bar') {
    return simulateFourBar(params);
  }
  return simulateSimplePendulum(params);
}
