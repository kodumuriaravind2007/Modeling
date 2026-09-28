/**
 * ============================================================================
 * PHYSICAL FEASIBILITY & MECHANISM CONSTRAINTS ENGINE (JS)
 * Module: src/core/feasibility.js
 * ============================================================================
 * 
 * Evaluates geometric assembly, kinematic feasibility, transmission angle bounds,
 * dynamic stability, and physical validity before and during simulation.
 * 
 * Returns unified DiagnosticReport:
 * {
 *   status: 'ok' | 'warning' | 'impossible',
 *   checks: DiagnosticCheck[]
 * }
 */

import { classifyGrashof, computeReachableInputArc } from './kinematics.js';

export const FEASIBILITY_STATUS = Object.freeze({
  OK: 'ok',
  WARNING: 'warning',
  IMPOSSIBLE: 'impossible',
  // Backward-compatibility aliases
  OPTIMAL: 'ok',
  MARGINAL: 'warning',
  INFEASIBLE: 'impossible'
});

/**
 * Checks physical feasibility of any mechanism given its type and parameters.
 * 
 * @param {string} simType Mechanism type key
 * @param {object} params Parameter map
 * @returns {object} DiagnosticReport + compatibility fields
 */
export function checkFeasibility(simType, params = {}) {
  const checks = [];

  _checkUniversal(simType, params, checks);

  if (simType === 'four_bar') {
    _checkFourBar(params, checks);
  } else if (simType === 'slider_crank') {
    _checkSliderCrank(params, checks);
  } else if (simType === 'simple_pendulum') {
    _checkSimplePendulum(params, checks);
  } else if (simType === 'compound_pendulum') {
    _checkCompoundPendulum(params, checks);
  }

  const hasError = checks.some(c => c.severity === 'error');
  const hasWarning = checks.some(c => c.severity === 'warning');

  let status = FEASIBILITY_STATUS.OK;
  let score = 100;
  let title = 'Valid Parameter Space';

  if (hasError) {
    status = FEASIBILITY_STATUS.IMPOSSIBLE;
    score = 0;
    title = 'Infeasible Kinematic Configuration';
  } else if (hasWarning) {
    status = FEASIBILITY_STATUS.WARNING;
    score = Math.max(20, 100 - checks.length * 20);
    title = 'Functionally Constrained Configuration';
  }

  const summary = checks.length > 0 ? checks[0].what : 'All parameters satisfy physical constraints.';

  // Metrics for badges
  const metrics = {};
  if (simType === 'four_bar') {
    const d = Number(params.link_ground) || 4.0;
    const a = Number(params.link_crank) || 1.0;
    const b = Number(params.link_coupler) || 2.5;
    const c = Number(params.link_rocker) || 3.0;
    if (d > 0 && a > 0 && b > 0 && c > 0) {
      const g = classifyGrashof(d, a, b, c);
      metrics.grashof_type = g.type;
      metrics.shortest_link = g.shortestLink || g.shortest || 'crank';
      const s0 = Math.abs(d - a);
      const s180 = d + a;
      const cosMu1 = (b * b + c * c - s0 * s0) / (2.0 * b * c);
      const cosMu2 = (b * b + c * c - s180 * s180) / (2.0 * b * c);
      const muAngles = [];
      for (const cMu of [cosMu1, cosMu2]) {
        if (cMu >= -1.0 && cMu <= 1.0) {
          const ang = Math.acos(cMu);
          muAngles.push(ang);
          muAngles.push(Math.PI - ang);
        }
      }
      if (muAngles.length > 0) {
        metrics.min_trans_deg = Math.min(...muAngles) * 180.0 / Math.PI;
        metrics.max_trans_deg = Math.max(...muAngles) * 180.0 / Math.PI;
      }
    }
  } else if (simType === 'slider_crank') {
    const r = Number(params.crank_length) || 0.1;
    const l = Number(params.conn_length) || 0.3;
    if (l > 0) {
      metrics.lambda = (r / l).toFixed(3);
      metrics.stroke_m = (2 * r).toFixed(3);
    }
  }

  // Backward-compatible violations list
  const violations = checks.map(c => ({
    id: c.id,
    severity: c.severity,
    message: `${c.title}: ${c.what}`,
    recommendation: c.fix.join('; ')
  }));

  return {
    status,
    checks,
    isFeasible: !hasError,
    is_feasible: !hasError,
    score,
    title,
    summary,
    violations,
    metrics
  };
}

function _checkUniversal(simType, params, checks) {
  const b = Number(params.damping) || 0.0;
  if (b < 0) {
    checks.push({
      id: 'universal.damping',
      severity: 'error',
      title: 'Negative Damping Injects Energy',
      what: `Viscous damping coefficient b = ${b.toFixed(4)} is strictly negative.`,
      why: 'Negative damping injects energy continuously into the mechanical system rather than dissipating it.',
      consequence: 'Dynamic states undergo exponential runaway; no bounded physical solution exists.',
      fix: ['Set damping to zero for conservative motion or a positive value (b >= 0.0).']
    });
  }

  const dt = Number(params.dt) || 0.01;
  const tMax = Number(params.t_max) || 10.0;

  if (dt <= 0) {
    checks.push({
      id: 'universal.dt_positivity',
      severity: 'error',
      title: 'Non-Positive Time Step',
      what: `Time step dt = ${dt} must be strictly positive.`,
      why: 'Time cannot stand still or run backward in forward initial value integration.',
      consequence: 'Simulation cannot progress.',
      fix: ['Set dt to a positive value between 0.001 s and 0.02 s.']
    });
  }

  let expectedPeriod = null;
  if (simType === 'simple_pendulum' || simType === 'compound_pendulum') {
    const L = Number(params.length) || 1.0;
    const g = Number(params.gravity) || 9.81;
    if (L > 0 && g > 0) {
      const factor = simType === 'simple_pendulum' ? 1.0 : Math.sqrt(2.0 / 3.0);
      expectedPeriod = 2.0 * Math.PI * Math.sqrt(L / g) * factor;
    }
  } else if (simType === 'slider_crank' || simType === 'four_bar') {
    const rpm = Number(params.crank_speed) || 60.0;
    if (rpm > 0) {
      expectedPeriod = 60.0 / rpm;
    }
  }

  if (expectedPeriod !== null && expectedPeriod > 0) {
    if (dt > expectedPeriod / 20.0) {
      checks.push({
        id: 'universal.dt',
        severity: 'warning',
        title: 'Time Step is Coarse Relative to System Dynamics',
        what: `dt = ${dt.toFixed(4)} s exceeds 1/20th of the dynamic period (T ~ ${expectedPeriod.toFixed(3)} s; recommended dt <= ${(expectedPeriod / 20.0).toFixed(4)} s).`,
        why: 'Coarse time-stepping introduces artificial numerical dissipation and truncation phase lag.',
        consequence: 'Energy conservation metrics will degrade and peak amplitude will be clipped.',
        fix: [`Reduce dt to ${(expectedPeriod / 40.0).toFixed(4)} s or smaller.`]
      });
    }

    if (tMax < 3.0 * expectedPeriod) {
      checks.push({
        id: 'universal.t_max',
        severity: 'warning',
        title: 'Simulation Window is Too Short for Reliable Period Detection',
        what: `Total simulation time t_max = ${tMax.toFixed(2)} s is less than 3 complete periods (3 T ~ ${(3.0 * expectedPeriod).toFixed(2)} s).`,
        why: 'Statistical zero-crossing interpolation and spectral FFT require multiple complete cycles to resolve frequency without aliasing.',
        consequence: "Numerical period measurement will report unavailable ('—') or have high variance.",
        fix: [`Increase t_max to at least ${(3.5 * expectedPeriod).toFixed(1)} s.`]
      });
    }
  }
}

function _checkSimplePendulum(params, checks) {
  const L = Number(params.length) || 1.0;
  const m = Number(params.mass) || 1.0;
  const g = Number(params.gravity) || 9.81;
  const b = Number(params.damping) || 0.0;
  const th0Deg = Number(params.theta0 ?? 30.0);
  const w0 = Number(params.omega0) || 0.0;
  const suspension = params.suspension_type || 'rod';

  if (L <= 0 || m <= 0 || g <= 0) {
    checks.push({
      id: 'pendulum.positivity',
      severity: 'error',
      title: 'Non-Positive Physical Dimension or Mass',
      what: `Length L=${L}, mass m=${m}, and gravity g=${g} must all be strictly positive.`,
      why: 'A pendulum with zero or negative length/mass cannot be constructed in Euclidean mechanics.',
      consequence: 'Natural frequency is imaginary or undefined.',
      fix: ['Ensure length L >= 0.1 m, mass m >= 0.01 kg, and gravity g >= 0.1 m/s².']
    });
    return;
  }

  if (suspension === 'string' && Math.abs(th0Deg) > 90.0) {
    checks.push({
      id: 'pendulum.string_suspension',
      severity: 'error',
      title: 'String Cannot Push in Upper Hemisphere',
      what: `Initial release angle θ₀ = ${th0Deg.toFixed(1)}° exceeds 90° with a flexible string suspension.`,
      why: 'A flexible string cannot sustain compressive axial loads (it cannot push).',
      consequence: 'The cord goes slack immediately, entering chaotic freefall rather than circular pendular motion.',
      fix: ['Switch suspension to rigid rod, or limit string angle to |θ₀| <= 90°.']
    });
  }

  const th0Rad = (th0Deg * Math.PI) / 180.0;
  const E0 = 0.5 * m * (L * w0) ** 2 + m * g * L * (1.0 - Math.cos(th0Rad));
  const ECrit = 2.0 * m * g * L;
  if (E0 >= ECrit) {
    const wCrit = Math.sqrt(Math.max(0.0, (ECrit - m * g * L * (1.0 - Math.cos(th0Rad))) * 2.0 / (m * L ** 2)));
    checks.push({
      id: 'pendulum.over_the_top',
      severity: 'warning',
      title: 'Pendulum Energy Exceeds Inversion Barrier (Over-the-Top)',
      what: `Initial mechanical energy E₀ = ${E0.toFixed(2)} J exceeds the potential barrier for top-dead-center (2 m g L = ${ECrit.toFixed(2)} J).`,
      why: 'Kinetic and potential energy are sufficient to cross theta = 180°.',
      consequence: 'The pendulum continuously rotates full 360° revolutions rather than oscillating; elliptic libration period does not apply.',
      fix: [
        `Reduce initial angle theta0 below ${(Math.acos(Math.max(-1.0, 1.0 - ECrit / (m * g * L))) * 180 / Math.PI).toFixed(1)}°`,
        `Reduce initial angular velocity omega0 below ${wCrit.toFixed(2)} rad/s.`
      ]
    });
  }

  const omega0 = Math.sqrt(g / L);
  const bEff = b / (m * L ** 2);
  const zeta = bEff / (2.0 * omega0);

  if (zeta >= 1.0) {
    checks.push({
      id: 'pendulum.overdamped',
      severity: 'info',
      title: 'System is Overdamped (Non-Oscillatory)',
      what: `Viscous damping ratio ζ = ${zeta.toFixed(3)} >= 1.0.`,
      why: 'Viscous damping completely suppresses harmonic oscillation.',
      consequence: 'Displacement decays asymptotically to vertical without zero-crossings. No period exists.',
      fix: [`To observe oscillations, reduce damping b below critical damping b_c = ${(2.0 * m * L ** 2 * omega0).toFixed(3)} N·m·s/rad.`]
    });
  }
}

function _checkCompoundPendulum(params, checks) {
  const L = Number(params.length) || 1.0;
  const m = Number(params.mass) || 2.0;
  const g = Number(params.gravity) || 9.81;
  const b = Number(params.damping) || 0.0;
  const dPivot = Number(params.pivot_distance ?? L / 2.0);

  if (L <= 0 || m <= 0 || g <= 0) {
    checks.push({
      id: 'compound_pendulum.positivity',
      severity: 'error',
      title: 'Non-Positive Physical Parameters',
      what: `Beam length L=${L}, mass m=${m}, and gravity g=${g} must be strictly positive.`,
      why: 'Physical rigid body properties cannot be zero or negative.',
      consequence: 'Dynamics cannot be computed.',
      fix: ['Ensure length L >= 0.1 m and mass m >= 0.01 kg.']
    });
    return;
  }

  if (Math.abs(dPivot) < 1e-4) {
    checks.push({
      id: 'compound_pendulum.com_pivot',
      severity: 'error',
      title: 'Pivot Located at Center of Mass (Zero Restoring Torque)',
      what: `Pivot-to-CoM distance d = ${dPivot.toFixed(4)} m is essentially zero.`,
      why: 'Gravitational force line of action passes through the pivot axis, producing zero restoring moment.',
      consequence: 'The rigid body has neutral equilibrium and will not oscillate under gravity.',
      fix: ['Offset pivot axis away from Center of Mass by setting pivot_distance >= 0.05 m.']
    });
    return;
  }

  const IPivot = (1.0 / 3.0) * m * L ** 2;
  const omega0 = Math.sqrt((m * g * dPivot) / IPivot);
  const zeta = b / (2.0 * IPivot * omega0);

  if (zeta >= 1.0) {
    checks.push({
      id: 'compound_pendulum.overdamped',
      severity: 'info',
      title: 'Compound Pendulum is Overdamped',
      what: `Damping ratio ζ = ${zeta.toFixed(3)} >= 1.0.`,
      why: 'Viscous pivot friction dissipates all kinetic energy before a cycle completes.',
      consequence: 'Body decays monotonically to rest with no zero crossings.',
      fix: [`Reduce pivot friction below ${(2.0 * IPivot * omega0).toFixed(3)} N·m·s/rad.`]
    });
  }
}

function _checkSliderCrank(params, checks) {
  const r = Number(params.crank_length) || 0.1;
  const l = Number(params.conn_length) || 0.3;
  const rpm = Number(params.crank_speed) || 60.0;
  const e = Number(params.offset ?? params.eccentricity ?? 0.0);

  if (r <= 0 || l <= 0) {
    checks.push({
      id: 'slider_crank.positivity',
      severity: 'error',
      title: 'Non-Positive Dimensions',
      what: `Crank radius r=${r} m and rod length l=${l} m must be strictly positive.`,
      why: 'Geometric link lengths cannot be zero or negative.',
      consequence: 'Mechanism geometry is undefined.',
      fix: ['Set crank length r >= 0.01 m and connecting rod length l >= 0.02 m.']
    });
    return;
  }

  if (l <= r + Math.abs(e)) {
    checks.push({
      id: 'slider_crank.lockup',
      severity: 'error',
      title: 'Connecting Rod Too Short (Kinematic Lockup)',
      what: `Connecting rod length l=${l.toFixed(3)} m is less than or equal to crank radius plus offset (r + |e| = ${(r + Math.abs(e)).toFixed(3)} m).`,
      why: 'The connecting rod cannot span the distance between the crank pin and the slider axis at top dead center / dead centers.',
      consequence: 'Mechanism cannot rotate through 360°. It locks at the limit positions.',
      fix: [
        `Increase connecting rod length l to at least ${(1.5 * (r + Math.abs(e))).toFixed(3)} m.`,
        `Reduce crank radius r below ${(l - Math.abs(e)).toFixed(3)} m.`
      ]
    });
    return;
  }

  const lam = r / l;
  if (lam > 0.45) {
    checks.push({
      id: 'slider_crank.high_obliquity',
      severity: 'warning',
      title: 'High Connecting Rod Obliquity Ratio (Severe Side-Thrust)',
      what: `Rod obliquity ratio λ = r/l = ${lam.toFixed(3)} exceeds 0.45 (standard automotive range is 0.22 - 0.30).`,
      why: 'Large rod angle φ creates high lateral force component against the cylinder wall (F_N = F_rod * sin φ).',
      consequence: 'Excessive cylinder wall and piston skirt wear, high frictional power losses, and potential piston slap.',
      fix: [
        `Increase rod length l to at least ${(r / 0.30).toFixed(3)} m to bring λ <= 0.30.`,
        `Reduce crank radius r to ${(0.30 * l).toFixed(3)} m.`
      ]
    });
  }

  if (Math.abs(rpm) > 3000) {
    checks.push({
      id: 'slider_crank.high_rpm',
      severity: 'info',
      title: 'High Reciprocating Inertia Acceleration',
      what: `Crank speed |N| = ${Math.abs(rpm).toFixed(0)} rpm.`,
      why: 'Reciprocating acceleration scales with ω² (r + r²/l), producing large secondary shaking forces.',
      consequence: 'Substantial dynamic imbalance loads on main bearings and engine mounting frame.',
      fix: ['Ensure crank counterweights are sized for dynamic balance or reduce operating RPM.']
    });
  }
}

function _checkFourBar(params, checks) {
  const d = Number(params.link_ground) || 4.0;
  const a = Number(params.link_crank) || 1.0;
  const b = Number(params.link_coupler) || 2.5;
  const c = Number(params.link_rocker) || 3.0;

  if (d <= 0 || a <= 0 || b <= 0 || c <= 0) {
    checks.push({
      id: 'four_bar.positivity',
      severity: 'error',
      title: 'Non-Positive Link Lengths',
      what: `All link lengths (d=${d}, a=${a}, b=${b}, c=${c}) must be strictly positive.`,
      why: 'Rigid bodies in planar linkage mechanics cannot have zero or negative dimension.',
      consequence: 'Kinematic loop closure is undefined.',
      fix: ['Specify positive link lengths greater than 0.01 m.']
    });
    return;
  }

  const lengths = [d, a, b, c];
  const maxLen = Math.max(...lengths);
  const sumOthers = lengths.reduce((acc, v) => acc + v, 0) - maxLen;

  if (maxLen >= sumOthers) {
    checks.push({
      id: 'four_bar.assembly_impossible',
      severity: 'error',
      title: 'Triangle Assembly Inequality Violated (Cannot Form Closed Loop)',
      what: `Longest link (${maxLen.toFixed(3)} m) >= sum of remaining links (${sumOthers.toFixed(3)} m).`,
      why: 'In any planar quadrilateral, no single side can be longer than or equal to the sum of the other three sides.',
      consequence: 'The four links cannot be connected at the revolute joints in any planar configuration. The mechanism cannot assemble.',
      fix: [
        `Decrease the longest link below ${sumOthers.toFixed(3)} m.`,
        `Increase the shorter links so their sum exceeds ${maxLen.toFixed(3)} m.`
      ]
    });
    return;
  }

  const gInfo = classifyGrashof(d, a, b, c);
  const sPlusL = gInfo.S + gInfo.L;
  const pPlusQ = gInfo.P + gInfo.Q;

  if (!gInfo.isGrashof) {
    const reachable = computeReachableInputArc(d, a, b, c);
    let arcStr = 'limited arc';
    if (reachable && !reachable.isFullRotation) {
      arcStr = `[${(reachable.minAngle * 180 / Math.PI).toFixed(1)}°, ${(reachable.maxAngle * 180 / Math.PI).toFixed(1)}°]`;
    }
    checks.push({
      id: 'four_bar.non_grashof',
      severity: 'warning',
      title: 'Non-Grashof Linkage (Triple-Rocker: No Continuous 360° Rotation)',
      what: `Grashof condition s + l <= p + q fails: s + l = ${sPlusL.toFixed(3)} > p + q = ${pPlusQ.toFixed(3)}.`,
      why: "By Grashof's Theorem, if the sum of the shortest and longest links exceeds the sum of the remaining two, no link can rotate through 360° relative to any other link.",
      consequence: `All movable links rock back and forth within limited angular bounds (input crank reaches only ${arcStr}). Driving the crank continuously will jam the mechanism.`,
      fix: [
        'Adjust link dimensions so s + l <= p + q if continuous 360° input rotation is required.',
        'Make the input crank the shortest link to obtain a Crank-Rocker.'
      ]
    });
  } else if (gInfo.isSpecial || Math.abs(sPlusL - pPlusQ) < 1e-9) {
    checks.push({
      id: 'four_bar.change_point',
      severity: 'warning',
      title: 'Change-Point Condition (s + l = p + q)',
      what: `Sum of shortest and longest links exactly equals sum of other two: s + l = p + q = ${sPlusL.toFixed(3)}.`,
      why: 'All four links can become collinear simultaneously at toggle positions.',
      consequence: 'Degrees of freedom become indeterminate at toggle positions; mechanism can flip unexpectedly into folded or crossed configurations unless guided by springs or flywheel inertia.',
      fix: ['Vary one link length slightly (by ~2-5%) to avoid exact change-point singularity.']
    });
  }

  // Transmission angle evaluation
  const s0 = Math.abs(d - a);
  const s180 = d + a;
  const cosMu1 = (b * b + c * c - s0 * s0) / (2.0 * b * c);
  const cosMu2 = (b * b + c * c - s180 * s180) / (2.0 * b * c);

  const muAngles = [];
  for (const cMu of [cosMu1, cosMu2]) {
    if (cMu >= -1.0 && cMu <= 1.0) {
      const ang = Math.acos(cMu);
      muAngles.push(ang);
      muAngles.push(Math.PI - ang);
    }
  }

  if (muAngles.length > 0) {
    const minMuDeg = Math.min(...muAngles) * 180.0 / Math.PI;
    if (minMuDeg < 40.0) {
      checks.push({
        id: 'four_bar.poor_transmission_angle',
        severity: 'warning',
        title: `Sub-Optimal Transmission Angle (μ_min = ${minMuDeg.toFixed(1)}° < 40°)`,
        what: `Minimum transmission angle μ_min is ${minMuDeg.toFixed(1)}° (recommended range is 40° - 140°, ideal ~90°).`,
        why: 'Transmission angle μ between coupler and output rocker determines the mechanical advantage: torque τ_out ∝ sin(μ).',
        consequence: 'At acute angles, force transmission efficiency plummets, joint bearing forces spike drastically, and risk of toggle locking increases.',
        fix: [
          'Increase coupler length b or adjust ground distance d to expand the transmission angle envelope.',
          'Ensure μ stays above 45° across the entire operational stroke.'
        ]
      });
    }
  }
}

