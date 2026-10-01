/**
 * ============================================================================
 * MULTI-DIMENSIONAL PARAMETER SWEEP & CONSTRAINT ENGINE (Client-Side)
 * Module: src/core/designSweep.js
 * ============================================================================
 * 
 * Provides ultra-fast, robust, client-side grid search and constraint filtering
 * for all dynamic mechanisms (Simple Pendulum, Compound Pendulum, Slider-Crank, Four-Bar).
 * 
 * Features:
 *   1. Impossible range detection (Min > Max, non-positive quantities, physical limits).
 *   2. Closed-form exact KPI extraction using kinematics.js analytical models.
 *   3. Multi-dimensional Cartesian product sweep (resolution-scaled).
 *   4. Normalized design margin calculation & ranking.
 *   5. 2D Feasibility heatmap matrix generation.
 */

import {
  exactSimplePendulumPeriod,
  exactCompoundPendulumPeriod,
  solveSliderCrank,
  solveFourBarPosition,
  solveFourBarVelocityAndAcceleration,
  classifyGrashof
} from './kinematics.js';

// Physical parameter limits for validation
export const CONSTRAINT_LIMITS = Object.freeze({
  simple_pendulum: {
    period: { minAllowed: 0.05, maxAllowed: 30.0, positiveOnly: true, label: 'Period T', unit: 's', physicalDomain: [0.5, 15.0] },
    max_omega: { minAllowed: 0.0, maxAllowed: 100.0, nonNegative: true, label: 'Max Angular Velocity ω', unit: 'rad/s', physicalDomain: [0.1, 35.0] }
  },
  compound_pendulum: {
    period: { minAllowed: 0.05, maxAllowed: 30.0, positiveOnly: true, label: 'Period T', unit: 's', physicalDomain: [0.4, 15.0] },
    max_omega: { minAllowed: 0.0, maxAllowed: 100.0, nonNegative: true, label: 'Max Angular Velocity ω', unit: 'rad/s', physicalDomain: [0.1, 40.0] }
  },
  slider_crank: {
    stroke: { minAllowed: 0.005, maxAllowed: 2.0, positiveOnly: true, label: 'Stroke', unit: 'm', physicalDomain: [0.04, 1.0] },
    v_max: { minAllowed: 0.0, maxAllowed: 100.0, nonNegative: true, label: 'Max Velocity', unit: 'm/s', physicalDomain: [0.05, 35.0] },
    a_max: { minAllowed: 0.0, maxAllowed: 5000.0, nonNegative: true, label: 'Max Acceleration', unit: 'm/s²', physicalDomain: [1.0, 2500.0] }
  },
  four_bar: {
    rocker_range_deg: { minAllowed: 0.0, maxAllowed: 360.0, nonNegative: true, label: 'Rocker Range', unit: '°', physicalDomain: [1.0, 360.0] },
    max_omega4: { minAllowed: 0.0, maxAllowed: 200.0, nonNegative: true, label: 'Max Rocker ω₄', unit: 'rad/s', physicalDomain: [0.1, 100.0] }
  }
});

/**
 * Computes achievable minimum and maximum values for each output metric
 * across the specified parameter sweep bounds.
 * 
 * @param {string} simType Mechanism type
 * @param {object} paramRanges { [paramKey]: { min, max } }
 * @param {object} fixedParams { [paramKey]: value }
 * @returns {object} { [metricKey]: { min: number, max: number, unit: string, label: string } }
 */
export function getAttainableMetricRanges(simType, paramRanges = {}, fixedParams = {}) {
  const variedKeys = Object.keys(paramRanges);
  const lim = CONSTRAINT_LIMITS[simType] || {};

  if (variedKeys.length === 0) {
    const res = {};
    for (const [k, v] of Object.entries(lim)) {
      res[k] = { min: v.physicalDomain[0], max: v.physicalDomain[1], unit: v.unit, label: v.label };
    }
    return res;
  }

  // Sample grid corners and midpoints
  const samples = [];
  function sampleAxes(idx, current) {
    if (idx === variedKeys.length) {
      samples.push({ ...current });
      return;
    }
    const k = variedKeys[idx];
    const b = paramRanges[k];
    const lo = Number(b.min);
    const hi = Number(b.max);
    const mid = (lo + hi) / 2.0;
    for (const val of [lo, mid, hi]) {
      current[k] = val;
      sampleAxes(idx + 1, current);
    }
  }
  sampleAxes(0, {});

  const metricMinMax = {};
  for (const s of samples) {
    const full = { ...fixedParams, ...s };
    try {
      const m = extractMetrics(simType, full);
      for (const [mk, mv] of Object.entries(m)) {
        if (typeof mv !== 'number' || isNaN(mv)) continue;
        if (!metricMinMax[mk]) {
          metricMinMax[mk] = { min: mv, max: mv };
        } else {
          if (mv < metricMinMax[mk].min) metricMinMax[mk].min = mv;
          if (mv > metricMinMax[mk].max) metricMinMax[mk].max = mv;
        }
      }
    } catch {
      // skip invalid parameter combinations
    }
  }

  const result = {};
  for (const [mk, bounds] of Object.entries(metricMinMax)) {
    const cfg = lim[mk];
    result[mk] = {
      min: Number(bounds.min.toFixed(2)),
      max: Number(bounds.max.toFixed(2)),
      unit: cfg?.unit || '',
      label: cfg?.label || mk
    };
  }
  return result;
}

/**
 * Validates design constraints. Returns detailed error/warning map per constraint
 * and overall validity. Does NOT allow impossible ranges silently.
 * 
 * @param {string} simType Mechanism type key
 * @param {object} designConstraints Map of { [key]: { min, max } }
 * @param {object} paramRanges Varied parameter ranges
 * @param {object} fixedParams Fixed parameters
 * @returns {object} { isValid: boolean, hasErrors: boolean, errors: {}, warnings: {} }
 */
export function validateDesignConstraints(simType, designConstraints = {}, paramRanges = {}, fixedParams = {}) {
  const limits = CONSTRAINT_LIMITS[simType] || {};
  const errors = {};
  const warnings = {};
  let hasErrors = false;

  const attainable = getAttainableMetricRanges(simType, paramRanges, fixedParams);

  for (const [key, val] of Object.entries(designConstraints)) {
    if (!val || typeof val !== 'object') continue;
    const cfg = limits[key];
    const minRaw = val.min !== undefined ? String(val.min).trim() : '';
    const maxRaw = val.max !== undefined ? String(val.max).trim() : '';

    if (minRaw === '' && maxRaw === '') continue;

    const minNum = minRaw !== '' ? parseFloat(minRaw) : null;
    const maxNum = maxRaw !== '' ? parseFloat(maxRaw) : null;

    // 1. Check for NaN
    if (minRaw !== '' && (isNaN(minNum) || !Number.isFinite(minNum))) {
      errors[key] = `Min value for ${cfg?.label || key} must be a valid number.`;
      hasErrors = true;
      continue;
    }
    if (maxRaw !== '' && (isNaN(maxNum) || !Number.isFinite(maxNum))) {
      errors[key] = `Max value for ${cfg?.label || key} must be a valid number.`;
      hasErrors = true;
      continue;
    }

    // 2. Mathematical contradiction: Min cannot exceed Max
    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      errors[key] = `Impossible range: Min (${minNum}) cannot be greater than Max (${maxNum}).`;
      hasErrors = true;
      continue;
    }

    // 3. Physical boundaries (Strict positivity / Non-negativity)
    if (cfg?.positiveOnly) {
      if (minNum !== null && minNum <= 0) {
        errors[key] = `${cfg.label} must be strictly positive (> 0 ${cfg.unit}).`;
        hasErrors = true;
        continue;
      }
      if (maxNum !== null && maxNum <= 0) {
        errors[key] = `${cfg.label} must be strictly positive (> 0 ${cfg.unit}).`;
        hasErrors = true;
        continue;
      }
    }

    if (cfg?.nonNegative) {
      if (minNum !== null && minNum < 0) {
        errors[key] = `${cfg.label} cannot be negative (must be ≥ 0 ${cfg.unit}).`;
        hasErrors = true;
        continue;
      }
      if (maxNum !== null && maxNum < 0) {
        errors[key] = `${cfg.label} cannot be negative (must be ≥ 0 ${cfg.unit}).`;
        hasErrors = true;
        continue;
      }
    }

    // 4. Geometry-specific absolute boundaries
    if (key === 'rocker_range_deg') {
      if (maxNum !== null && maxNum > 360.0) {
        errors[key] = `Rocker oscillation range cannot exceed 360°.`;
        hasErrors = true;
        continue;
      }
      if (minNum !== null && minNum > 360.0) {
        errors[key] = `Min rocker range (${minNum}°) exceeds 360°.`;
        hasErrors = true;
        continue;
      }
    }

    // 5. Grid attainable reachability check
    const att = attainable[key];
    if (att) {
      if (minNum !== null && minNum > att.max) {
        warnings[key] = `Impossible in grid: Min (${minNum} ${att.unit}) exceeds maximum achievable ${att.label} (${att.max} ${att.unit}) in this parameter space.`;
      } else if (maxNum !== null && maxNum < att.min) {
        warnings[key] = `Impossible in grid: Max (${maxNum} ${att.unit}) is below minimum achievable ${att.label} (${att.min} ${att.unit}) in this parameter space.`;
      }
    }
  }

  // 6. Mutual Physical Conflict Detection (e.g. Pendulum Period vs Max Omega)
  if (simType === 'simple_pendulum' || simType === 'compound_pendulum') {
    const pVal = designConstraints.period;
    const wVal = designConstraints.max_omega;
    const pMin = pVal?.min !== '' && pVal?.min !== undefined ? parseFloat(pVal.min) : null;
    const wMin = wVal?.min !== '' && wVal?.min !== undefined ? parseFloat(wVal.min) : null;

    if (pMin !== null && wMin !== null && !isNaN(pMin) && !isNaN(wMin) && pMin > 0 && wMin > 0) {
      // By conservation of energy, T * omega is bounded:
      // T ~ 2pi * sqrt(L/g), omega ~ sqrt(2g(1-cos theta0)/L)
      // T * omega ~ 2pi * sqrt(2(1 - cos theta0))
      const th0Deg = Number(fixedParams?.theta0 ?? 30.0);
      const th0Rad = (th0Deg * Math.PI) / 180.0;
      const kFactor = simType === 'simple_pendulum' ? 1.0 : Math.sqrt(3.0 / 2.0);
      const theoreticalProduct = 2.0 * Math.PI * Math.sqrt(2.0 * (1.0 - Math.cos(th0Rad))) * kFactor;
      
      const requestedProduct = pMin * wMin;
      // Allow 15% margin for numerical/non-small-angle effects
      if (requestedProduct > theoreticalProduct * 1.15) {
        warnings['tradeoff_conflict'] = `Physical Trade-off Conflict: Period T and Angular Velocity ω are inversely coupled by conservation of energy (T · ω ≈ ${theoreticalProduct.toFixed(2)} at θ₀=${th0Deg}°). Requiring T ≥ ${pMin} s and ω ≥ ${wMin} rad/s (product = ${requestedProduct.toFixed(2)}) is physically impossible in this system.`;
      }
    }
  }

  return {
    isValid: !hasErrors,
    hasErrors,
    errors,
    warnings
  };
}

/**
 * Metric extraction helpers for each mechanism
 */
export function extractMetrics(simType, params) {
  if (simType === 'simple_pendulum') {
    const L = Math.max(0.05, Number(params.length) || 1.0);
    const m = Math.max(0.01, Number(params.mass) || 1.0);
    const g = Math.max(0.1, Number(params.gravity) || 9.81);
    const th0Deg = Number(params.theta0 ?? 30.0);
    const th0Rad = (th0Deg * Math.PI) / 180.0;
    const w0 = Number(params.omega0 ?? 0.0);

    const period = exactSimplePendulumPeriod(L, g, th0Rad);
    const E0 = 0.5 * m * (L * w0) ** 2 + m * g * L * (1.0 - Math.cos(th0Rad));
    const max_omega = Math.sqrt(Math.max(0.0, (2.0 * E0) / (m * L * L)));

    return {
      period: Number(period.toFixed(4)),
      max_omega: Number(max_omega.toFixed(3)),
      energy_drift_pct: 0.0
    };
  }

  if (simType === 'compound_pendulum') {
    const L = Math.max(0.05, Number(params.length) || 1.0);
    const m = Math.max(0.01, Number(params.mass) || 2.0);
    const g = Math.max(0.1, Number(params.gravity) || 9.81);
    const th0Deg = Number(params.theta0 ?? 25.0);
    const th0Rad = (th0Deg * Math.PI) / 180.0;
    const d = L / 2.0;
    const IPivot = (1.0 / 3.0) * m * L * L;

    const period = exactCompoundPendulumPeriod(L, g, th0Rad);
    const PE0 = m * g * d * (1.0 - Math.cos(th0Rad));
    const max_omega = Math.sqrt(Math.max(0.0, (2.0 * PE0) / IPivot));

    return {
      period: Number(period.toFixed(4)),
      L_eff: Number(((2.0 / 3.0) * L).toFixed(3)),
      max_omega: Number(max_omega.toFixed(3)),
      energy_drift_pct: 0.0
    };
  }

  if (simType === 'slider_crank') {
    const r = Math.max(0.01, Number(params.crank_length) || 0.1);
    const l = Math.max(r + 0.001, Number(params.conn_length) || 0.3);
    const speed = Math.max(1.0, Number(params.crank_speed) || 60.0);
    const omega = (speed * 2.0 * Math.PI) / 60.0;

    let vMax = 0;
    let aMax = 0;
    for (let k = 0; k < 24; k++) {
      const th = (k / 24) * 2 * Math.PI;
      const sol = solveSliderCrank(r, l, th, omega);
      const absV = Math.abs(sol.v);
      const absA = Math.abs(sol.a);
      if (absV > vMax) vMax = absV;
      if (absA > aMax) aMax = absA;
    }

    return {
      stroke: Number((2.0 * r).toFixed(4)),
      v_max: Number(vMax.toFixed(3)),
      a_max: Number(aMax.toFixed(2)),
      lambda: Number((r / l).toFixed(3))
    };
  }

  if (simType === 'four_bar') {
    const d = Math.max(0.1, Number(params.link_ground) || 4.0);
    const a = Math.max(0.1, Number(params.link_crank) || 1.0);
    const b = Math.max(0.1, Number(params.link_coupler) || 2.5);
    const c = Math.max(0.1, Number(params.link_rocker) || 3.0);
    const speed = Math.max(1.0, Number(params.crank_speed) || 60.0);
    const omega2 = (speed * 2.0 * Math.PI) / 60.0;

    let minTh4 = Infinity;
    let maxTh4 = -Infinity;
    let maxOmega4 = 0;
    let prevTh4 = null;

    for (let k = 0; k < 36; k++) {
      const th2 = (k / 36) * 2 * Math.PI;
      const pos = solveFourBarPosition(d, a, b, c, th2, prevTh4);
      if (pos.success) {
        prevTh4 = pos.theta4;
        if (pos.theta4 < minTh4) minTh4 = pos.theta4;
        if (pos.theta4 > maxTh4) maxTh4 = pos.theta4;
        const vel = solveFourBarVelocityAndAcceleration(d, a, b, c, th2, pos.theta3, pos.theta4, omega2, 0);
        if (vel.success && Math.abs(vel.omega4) > maxOmega4) {
          maxOmega4 = Math.abs(vel.omega4);
        }
      }
    }

    const rangeDeg = (maxTh4 > minTh4 && Number.isFinite(minTh4)) ? ((maxTh4 - minTh4) * 180.0) / Math.PI : 0;
    const gInfo = classifyGrashof(d, a, b, c);

    return {
      rocker_range_deg: Number(rangeDeg.toFixed(1)),
      max_omega4: Number(maxOmega4.toFixed(2)),
      grashof: gInfo.type
    };
  }

  return {};
}

/**
 * Evaluates constraints against extracted metrics.
 */
export function evaluateConstraints(metrics, constraints) {
  const margins = {};
  let allPass = true;

  for (const [key, bounds] of Object.entries(constraints)) {
    const val = metrics[key];
    if (val === undefined || val === null || isNaN(val)) continue;

    let lo = null;
    let hi = null;

    if (bounds && typeof bounds === 'object') {
      lo = (bounds.min !== undefined && bounds.min !== '' && bounds.min !== null) ? Number(bounds.min) : null;
      hi = (bounds.max !== undefined && bounds.max !== '' && bounds.max !== null) ? Number(bounds.max) : null;
    }

    let ok = true;
    let margin = 1.0;

    if (lo !== null && hi !== null) {
      const centre = (lo + hi) / 2.0;
      const halfRange = (hi - lo) / 2.0;
      margin = halfRange > 0 ? (halfRange - Math.abs(val - centre)) / halfRange : 0.0;
      ok = val >= lo - 1e-9 && val <= hi + 1e-9;
    } else if (lo !== null) {
      margin = lo !== 0 ? (val - lo) / Math.abs(lo) : val;
      ok = val >= lo - 1e-9;
    } else if (hi !== null) {
      margin = hi !== 0 ? (hi - val) / Math.abs(hi) : -val;
      ok = val <= hi + 1e-9;
    }

    margins[key] = { value: val, margin: Number(margin.toFixed(4)), pass: Boolean(ok) };
    if (!ok) {
      allPass = false;
    }
  }

  return { pass: allPass, margins };
}

/**
 * Linearly spaced array helper
 */
function linspace(start, end, n) {
  if (n <= 1) return [start];
  const step = (end - start) / (n - 1);
  const arr = new Array(n);
  for (let i = 0; i < n; i++) {
    arr[i] = Number((start + i * step).toFixed(5));
  }
  return arr;
}

/**
 * Executes a full client-side design sweep.
 * 
 * @param {string} simType Mechanism type key
 * @param {object} constraints User constraints map { [k]: { min, max } }
 * @param {object} paramRanges Varied parameter bounds { [k]: { min, max } }
 * @param {object} fixedParams Unvarying parameter values { [k]: val }
 * @param {number} nPoints Number of points per axis (default: 7)
 * @returns {object} DesignSweepResult matching backend structure
 */
export function solveClientDesignSweep(simType, constraints = {}, paramRanges = {}, fixedParams = {}, nPoints = 7) {
  // Validate constraints first — do not allow impossible ranges
  const validation = validateDesignConstraints(simType, constraints, paramRanges, fixedParams);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Impossible constraint range';
    throw new Error(firstErr);
  }

  const variedKeys = Object.keys(paramRanges);
  if (variedKeys.length === 0) {
    throw new Error('No parameter ranges specified for grid sweep.');
  }

  // Adjust resolution if parameter dimensions exceed 2 to avoid browser freeze
  let effNPoints = Math.max(3, Math.min(nPoints || 7, 10));
  const totalCombos = effNPoints ** variedKeys.length;
  if (totalCombos > 500) {
    effNPoints = Math.max(3, Math.floor(500 ** (1 / variedKeys.length)));
  }

  // Generate 1-D axes
  const sweepGrids = {};
  for (const k of variedKeys) {
    const b = paramRanges[k];
    const lo = Number(b.min);
    const hi = Number(b.max);
    sweepGrids[k] = linspace(lo, hi, effNPoints);
  }

  // Generate Cartesian combinations
  const axes = variedKeys.map(k => sweepGrids[k]);
  const combinations = [];

  function cartesian(depth, current) {
    if (depth === axes.length) {
      combinations.push({ ...current });
      return;
    }
    const key = variedKeys[depth];
    for (const val of axes[depth]) {
      current[key] = val;
      cartesian(depth + 1, current);
    }
  }
  cartesian(0, {});

  const results = [];
  const errors = [];

  for (const combo of combinations) {
    const fullParams = { ...fixedParams, ...combo };
    try {
      const metrics = extractMetrics(simType, fullParams);
      const { pass, margins } = evaluateConstraints(metrics, constraints);

      const allMarginVals = Object.values(margins).map(m => m.margin);
      const score = allMarginVals.length > 0
        ? allMarginVals.reduce((a, b) => a + b, 0) / allMarginVals.length
        : 0.0;

      results.push({
        params: { ...combo },
        metrics,
        pass,
        margins,
        score: Number(score.toFixed(4))
      });
    } catch (err) {
      errors.push(err.message);
    }
  }

  const feasible = results.filter(r => r.pass);
  const ranked = [...feasible].sort((a, b) => b.score - a.score).slice(0, 10);
  const attainable = getAttainableMetricRanges(simType, paramRanges, fixedParams);

  // 2D Feasibility heatmap for top 2 parameters
  let heatmapData = null;
  if (variedKeys.length >= 2) {
    const k0 = variedKeys[0];
    const k1 = variedKeys[1];
    const ax0 = sweepGrids[k0];
    const ax1 = sweepGrids[k1];
    const passGrid = [];
    const scoreGrid = [];

    for (const v0 of ax0) {
      const rowPass = [];
      const rowScore = [];
      for (const v1 of ax1) {
        const testParams = { ...fixedParams, [k0]: v0, [k1]: v1 };
        // Remaining params set to midpoints
        for (let i = 2; i < variedKeys.length; i++) {
          const k = variedKeys[i];
          const b = paramRanges[k];
          testParams[k] = (Number(b.min) + Number(b.max)) / 2;
        }

        try {
          const metrics = extractMetrics(simType, testParams);
          const { pass, margins } = evaluateConstraints(metrics, constraints);
          const allMarginVals = Object.values(margins).map(m => m.margin);
          const score = allMarginVals.length > 0
            ? allMarginVals.reduce((a, b) => a + b, 0) / allMarginVals.length
            : 0.0;
          rowPass.push(pass ? 1 : 0);
          rowScore.push(Number(score.toFixed(2)));
        } catch {
          rowPass.push(0);
          rowScore.push(-1.0);
        }
      }
      passGrid.push(rowPass);
      scoreGrid.push(rowScore);
    }

    heatmapData = {
      x_key: k1,
      y_key: k0,
      x_values: ax1,
      y_values: ax0,
      pass_grid: passGrid,
      score_grid: scoreGrid
    };
  }

  return {
    sweep_results: results,
    feasible_count: feasible.length,
    total_count: results.length,
    ranked_designs: ranked,
    param_keys: variedKeys,
    heatmap_data: heatmapData,
    errors: errors.slice(0, 5),
    attainable
  };
}
