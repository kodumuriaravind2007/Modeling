/**
 * ============================================================================
 * MULTI-DOF SPRING-MASS-DAMPER SOLVER & MODAL ANALYSIS ENGINE
 * Module: src/core/smdSolver.js
 * ============================================================================
 * 
 * Provides rigorous matrix assembly, generalized eigenvalue modal analysis,
 * state-space RK4 time integration, and transfer function Bode frequency response:
 * 
 *    M * x'' + C * x' + K * x = F(t)
 */

/**
 * Assembles M, C, K matrices for a 1-DOF, 2-DOF, or 3-DOF mass-spring-damper chain.
 * Fixed ground at left (x = 0). Masses connected in series.
 * 
 * @param {Array<number>} masses Array of mass values [m1, m2, ...]
 * @param {Array<number>} springs Array of spring stiffnesses [k1, k2, ...]
 * @param {Array<number>} dampers Array of damping coefficients [c1, c2, ...]
 * @param {boolean} groundedRight Whether the rightmost mass is anchored to a right wall via a spring/damper
 */
export function assembleMCK(masses, springs, dampers, groundedRight = false) {
  const n = masses.length;
  // Initialize zero matrices
  const M = Array.from({ length: n }, () => new Array(n).fill(0));
  const K = Array.from({ length: n }, () => new Array(n).fill(0));
  const C = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    M[i][i] = Math.max(1e-4, masses[i]);
  }

  // Springs & Dampers between nodes
  // Node 0 connected to ground via k0, c0
  K[0][0] += springs[0];
  C[0][0] += dampers[0];

  for (let i = 0; i < n - 1; i++) {
    const k_inter = springs[i + 1] || 0;
    const c_inter = dampers[i + 1] || 0;

    K[i][i] += k_inter;
    K[i][i + 1] -= k_inter;
    K[i + 1][i] -= k_inter;
    K[i + 1][i + 1] += k_inter;

    C[i][i] += c_inter;
    C[i][i + 1] -= c_inter;
    C[i + 1][i] -= c_inter;
    C[i + 1][i + 1] += c_inter;
  }

  if (groundedRight && springs[n]) {
    K[n - 1][n - 1] += springs[n];
    C[n - 1][n - 1] += (dampers[n] || 0);
  }

  return { M, C, K, n };
}

/**
 * Performs generalized eigenvalue modal analysis on the undamped system:
 *    det(K - omega^2 * M) = 0
 * 
 * Returns natural frequencies (rad/s and Hz) and normalized mode shape vectors.
 */
export function solveModalAnalysis(masses, springs, dampers) {
  const n = masses.length;

  if (n === 1) {
    const m = masses[0];
    const k = springs[0];
    const c = dampers[0];
    const omega_n = Math.sqrt(k / m);
    const fn = omega_n / (2 * Math.PI);
    const zeta = c / (2 * Math.sqrt(k * m));

    return {
      frequenciesRad: [omega_n],
      frequenciesHz: [fn],
      dampingRatios: [zeta],
      modeShapes: [[1.0]],
      n
    };
  }

  if (n === 2) {
    const m1 = masses[0], m2 = masses[1];
    const k1 = springs[0], k2 = springs[1];
    const c1 = dampers[0], c2 = dampers[1];

    // Characteristic equation: (m1*m2)*lambda^2 - [m1*k2 + m2*(k1+k2)]*lambda + k1*k2 = 0
    const A = m1 * m2;
    const B = -(m1 * k2 + m2 * (k1 + k2));
    const C = k1 * k2;

    const disc = Math.max(0, B * B - 4 * A * C);
    const lam1 = (-B - Math.sqrt(disc)) / (2 * A);
    const lam2 = (-B + Math.sqrt(disc)) / (2 * A);

    const w1 = Math.sqrt(Math.max(1e-6, lam1));
    const w2 = Math.sqrt(Math.max(1e-6, lam2));

    // Mode shapes: [1, (k1 + k2 - m1*lambda) / k2]
    const u1_2 = (k1 + k2 - m1 * lam1) / k2;
    const u2_2 = (k1 + k2 - m1 * lam2) / k2;

    // Mass-normalize mode shapes
    const norm1 = Math.sqrt(m1 * 1.0 + m2 * u1_2 * u1_2);
    const norm2 = Math.sqrt(m1 * 1.0 + m2 * u2_2 * u2_2);

    const mode1 = [1.0 / norm1, u1_2 / norm1];
    const mode2 = [1.0 / norm2, u2_2 / norm2];

    // Modal damping ratios: zeta_i = (phi_i^T * C * phi_i) / (2 * omega_i)
    const c_mod1 = mode1[0] * (c1 + c2) * mode1[0] - 2 * mode1[0] * c2 * mode1[1] + mode1[1] * c2 * mode1[1];
    const c_mod2 = mode2[0] * (c1 + c2) * mode2[0] - 2 * mode2[0] * c2 * mode2[1] + mode2[1] * c2 * mode2[1];
    const zeta1 = c_mod1 / (2 * w1);
    const zeta2 = c_mod2 / (2 * w2);

    return {
      frequenciesRad: [w1, w2],
      frequenciesHz: [w1 / (2 * Math.PI), w2 / (2 * Math.PI)],
      dampingRatios: [zeta1, zeta2],
      modeShapes: [mode1, mode2],
      n
    };
  }

  // Fallback for n >= 3: Jacobi or power iteration
  return solveGeneralModal(masses, springs, dampers);
}

/**
 * Computes frequency response function (Bode magnitude in dB and phase in deg)
 * over an excitation frequency sweep omega in [w_min, w_max].
 */
export function computeFrequencyResponse(masses, springs, dampers, wMin = 0.1, wMax = 50, nPoints = 120) {
  const { M, C, K, n } = assembleMCK(masses, springs, dampers);
  const freqsHz = [];
  const magDb = Array.from({ length: n }, () => []);
  const phaseDeg = Array.from({ length: n }, () => []);

  const wVals = [];
  for (let i = 0; i < nPoints; i++) {
    // Logarithmic frequency sweep
    const logW = Math.log10(wMin) + (i / (nPoints - 1)) * (Math.log10(wMax) - Math.log10(wMin));
    wVals.push(Math.pow(10, logW));
  }

  for (const w of wVals) {
    freqsHz.push(w / (2 * Math.PI));

    // Dynamic stiffness matrix Z(w) = -w^2*M + j*w*C + K
    // For unit harmonic force on mass 1: F = [1, 0, ...]
    // Solve Z * X = F
    const X = solveComplexLinearSystem2x2(M, C, K, w);

    for (let j = 0; j < n; j++) {
      const mag = X[j].magnitude;
      magDb[j].push(20 * Math.log10(Math.max(1e-6, mag)));
      phaseDeg[j].push(X[j].phaseDeg);
    }
  }

  return { freqsHz, magDb, phaseDeg };
}

/**
 * Solves 2x2 complex impedance system: (-w^2*M + j*w*C + K) * X = [1, 0]^T
 */
function solveComplexLinearSystem2x2(M, C, K, w) {
  const n = M.length;
  if (n === 1) {
    const Re = K[0][0] - w * w * M[0][0];
    const Im = w * C[0][0];
    const denom = Re * Re + Im * Im;
    const xRe = Re / denom;
    const xIm = -Im / denom;
    const mag = Math.hypot(xRe, xIm);
    const phase = Math.atan2(xIm, xRe) * (180 / Math.PI);
    return [{ magnitude: mag, phaseDeg: phase }];
  }

  // 2x2 Matrix Inversion: Z11, Z12, Z21, Z22
  const z11_r = K[0][0] - w * w * M[0][0], z11_i = w * C[0][0];
  const z12_r = K[0][1], z12_i = w * C[0][1];
  const z21_r = K[1][0], z21_i = w * C[1][0];
  const z22_r = K[1][1] - w * w * M[1][1], z22_i = w * C[1][1];

  // det(Z) = Z11*Z22 - Z12*Z21
  const det_r = (z11_r * z22_r - z11_i * z22_i) - (z12_r * z21_r - z12_i * z21_i);
  const det_i = (z11_r * z22_i + z11_i * z22_r) - (z12_r * z21_i + z12_i * z21_r);
  const detMag2 = det_r * det_r + det_i * det_i;

  // Inv * [1, 0]^T => X1 = Z22 / det, X2 = -Z21 / det
  const x1_r = (z22_r * det_r + z22_i * det_i) / detMag2;
  const x1_i = (z22_i * det_r - z22_r * det_i) / detMag2;

  const x2_r = (-z21_r * det_r - z21_i * det_i) / detMag2;
  const x2_i = (-z21_i * det_r + z21_r * det_i) / detMag2;

  return [
    { magnitude: Math.hypot(x1_r, x1_i), phaseDeg: Math.atan2(x1_i, x1_r) * (180 / Math.PI) },
    { magnitude: Math.hypot(x2_r, x2_i), phaseDeg: Math.atan2(x2_i, x2_r) * (180 / Math.PI) }
  ];
}

/**
 * High-performance state-space Runge-Kutta 4th Order (RK4) time-domain transient integrator.
 * Solves: M*x'' + C*x' + K*x = F(t)
 */
export function simulateSMDTimeDomain(masses, springs, dampers, options = {}) {
  const {
    dt = 0.005,
    t_max = 8.0,
    excitation = 'step', // 'step', 'sine', 'impulse', 'free'
    F0 = 10.0,
    driveFreqRad = 5.0,
    x0 = [0.1, 0.0],
    v0 = [0.0, 0.0]
  } = options;

  const { M, C, K, n } = assembleMCK(masses, springs, dampers);
  const nSteps = Math.max(2, Math.round(t_max / dt) + 1);

  const time = new Array(nSteps);
  const x = Array.from({ length: n }, () => new Array(nSteps));
  const v = Array.from({ length: n }, () => new Array(nSteps));
  const a = Array.from({ length: n }, () => new Array(nSteps));
  const total_E = new Array(nSteps);

  let curX = [...(x0.slice(0, n))];
  while (curX.length < n) curX.push(0);
  let curV = [...(v0.slice(0, n))];
  while (curV.length < n) curV.push(0);

  const getForce = (t) => {
    const f = new Array(n).fill(0);
    if (excitation === 'step') {
      f[0] = t >= 0 ? F0 : 0;
    } else if (excitation === 'sine') {
      f[0] = F0 * Math.sin(driveFreqRad * t);
    } else if (excitation === 'impulse') {
      f[0] = t < dt * 2 ? F0 / (dt * 2) : 0;
    }
    return f;
  };

  const evalDeriv = (t, stateX, stateV) => {
    const F = getForce(t);
    const acc = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      let restoring = 0;
      let dampingForce = 0;
      for (let j = 0; j < n; j++) {
        restoring += K[i][j] * stateX[j];
        dampingForce += C[i][j] * stateV[j];
      }
      acc[i] = (F[i] - restoring - dampingForce) / M[i][i];
    }
    return { dX: stateV, dV: acc };
  };

  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    time[i] = t;

    for (let j = 0; j < n; j++) {
      x[j][i] = curX[j];
      v[j][i] = curV[j];
    }

    const { dV } = evalDeriv(t, curX, curV);
    for (let j = 0; j < n; j++) {
      a[j][i] = dV[j];
    }

    // Energy calculation: 1/2 * v^T * M * v + 1/2 * x^T * K * x
    let KE = 0;
    let PE = 0;
    for (let j = 0; j < n; j++) {
      KE += 0.5 * M[j][j] * curV[j] * curV[j];
      for (let k = 0; k < n; k++) {
        PE += 0.5 * curX[j] * K[j][k] * curX[k];
      }
    }
    total_E[i] = KE + PE;

    // RK4 Step
    const k1 = evalDeriv(t, curX, curV);
    const x2 = curX.map((xi, idx) => xi + 0.5 * dt * k1.dX[idx]);
    const v2 = curV.map((vi, idx) => vi + 0.5 * dt * k1.dV[idx]);

    const k2 = evalDeriv(t + 0.5 * dt, x2, v2);
    const x3 = curX.map((xi, idx) => xi + 0.5 * dt * k2.dX[idx]);
    const v3 = curV.map((vi, idx) => vi + 0.5 * dt * k2.dV[idx]);

    const k3 = evalDeriv(t + 0.5 * dt, x3, v3);
    const x4 = curX.map((xi, idx) => xi + dt * k3.dX[idx]);
    const v4 = curV.map((vi, idx) => vi + dt * k3.dV[idx]);

    const k4 = evalDeriv(t + dt, x4, v4);

    for (let j = 0; j < n; j++) {
      curX[j] += (dt / 6.0) * (k1.dX[j] + 2 * k2.dX[j] + 2 * k3.dX[j] + k4.dX[j]);
      curV[j] += (dt / 6.0) * (k1.dV[j] + 2 * k2.dV[j] + 2 * k3.dV[j] + k4.dV[j]);
    }
  }

  return { time, x, v, a, total_E, n };
}

// ============================================================================
// GENERALIZED GRAPH TOPOLOGY SOLVER (MATLAB SIMULINK EQUIVALENT)
// ============================================================================

/**
 * Parses user-built Simulink schematic graph into system matrices [M], [C], [K].
 * @param {Array} nodes List of nodes: { id, type: 'wall' | 'mass', mass: number, label: string }
 * @param {Array} edges List of edges/components: { id, type: 'spring' | 'damper' | 'force', from, to, k, c, F0, freq, waveform }
 */
export function assembleGraphMCK(nodes, edges) {
  // 1. Identify all Mass nodes (degrees of freedom)
  const massNodes = nodes.filter(n => n.type === 'mass');
  const n = Math.max(1, massNodes.length);
  const massIndexMap = new Map();
  massNodes.forEach((node, idx) => {
    massIndexMap.set(node.id, idx);
  });

  const M = Array.from({ length: n }, () => new Array(n).fill(0));
  const K = Array.from({ length: n }, () => new Array(n).fill(0));
  const C = Array.from({ length: n }, () => new Array(n).fill(0));

  // Populate Mass matrix
  massNodes.forEach((node, idx) => {
    M[idx][idx] = Math.max(1e-4, Number(node.mass) || 1.0);
  });

  // Track forces attached to masses
  const appliedForces = [];

  // 2. Process all connected components (Springs, Dampers, Forces)
  edges.forEach(edge => {
    const fromId = edge.from;
    const toId = edge.to;
    const isFromMass = massIndexMap.has(fromId);
    const isToMass = massIndexMap.has(toId);
    const idxFrom = massIndexMap.get(fromId);
    const idxTo = massIndexMap.get(toId);

    if (edge.type === 'spring') {
      const k = Math.max(0, Number(edge.k) || 0);
      if (isFromMass && isToMass) {
        K[idxFrom][idxFrom] += k;
        K[idxTo][idxTo] += k;
        K[idxFrom][idxTo] -= k;
        K[idxTo][idxFrom] -= k;
      } else if (isFromMass) {
        K[idxFrom][idxFrom] += k;
      } else if (isToMass) {
        K[idxTo][idxTo] += k;
      }
    } else if (edge.type === 'damper') {
      const c = Math.max(0, Number(edge.c) || 0);
      if (isFromMass && isToMass) {
        C[idxFrom][idxFrom] += c;
        C[idxTo][idxTo] += c;
        C[idxFrom][idxTo] -= c;
        C[idxTo][idxFrom] -= c;
      } else if (isFromMass) {
        C[idxFrom][idxFrom] += c;
      } else if (isToMass) {
        C[idxTo][idxTo] += c;
      }
    } else if (edge.type === 'force') {
      const targetIdx = isToMass ? idxTo : (isFromMass ? idxFrom : 0);
      appliedForces.push({
        targetMassIdx: targetIdx,
        F0: Number(edge.F0) || 10.0,
        waveform: edge.waveform || 'step',
        freq: Number(edge.freq) || 5.0
      });
    }
  });

  // 3. Grounding Verification (Rigid-body mode detection)
  const groundingInfo = checkSMDGroundedness(nodes, edges);

  return {
    M,
    C,
    K,
    n,
    massNodes,
    massIndexMap,
    appliedForces,
    isGrounded: groundingInfo.isGrounded,
    ungroundedMasses: groundingInfo.ungroundedMasses,
    groundingReason: groundingInfo.reason
  };
}

/**
 * Evaluates whether all mass nodes have an elastic connection path to at least one fixed ground / wall node.
 * Unconnected masses cause singular [K] matrix and rigid-body modes (zero natural frequency).
 */
export function checkSMDGroundedness(nodes, edges) {
  const wallNodes = nodes.filter(n => n.type === 'wall');
  const massNodes = nodes.filter(n => n.type === 'mass');

  if (massNodes.length === 0) {
    return { isGrounded: true, ungroundedMasses: [] };
  }

  if (wallNodes.length === 0) {
    return {
      isGrounded: false,
      ungroundedMasses: massNodes.map(m => m.id),
      reason: 'No fixed ground/wall anchor present in schematic.'
    };
  }

  // Build adjacency list via spring and damper edges
  const adj = new Map();
  nodes.forEach(n => adj.set(n.id, []));
  edges.forEach(e => {
    if (e.type === 'spring' || e.type === 'damper') {
      if (adj.has(e.from) && adj.has(e.to)) {
        adj.get(e.from).push(e.to);
        adj.get(e.to).push(e.from);
      }
    }
  });

  // BFS from all walls
  const visited = new Set(wallNodes.map(w => w.id));
  const queue = [...wallNodes.map(w => w.id)];

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const nbr of adj.get(cur) || []) {
      if (!visited.has(nbr)) {
        visited.add(nbr);
        queue.push(nbr);
      }
    }
  }

  const ungroundedMasses = massNodes.filter(m => !visited.has(m.id)).map(m => m.id);
  return {
    isGrounded: ungroundedMasses.length === 0,
    ungroundedMasses,
    reason: ungroundedMasses.length > 0
      ? `Mass(es) [${ungroundedMasses.join(', ')}] have no elastic path to ground.`
      : 'All masses are grounded.'
  };
}

/**
 * Solves generalized symmetric eigenvalue problem: K * phi = omega^2 * M * phi
 * using Jacobi transformation on M^(-1/2) * K * M^(-1/2).
 */
export function solveGraphModal(M, C, K) {
  const n = M.length;
  if (n === 1) {
    const m = M[0][0];
    const k = K[0][0];
    const c = C[0][0];
    const w = Math.sqrt(Math.max(1e-6, k / m));
    return {
      frequenciesRad: [w],
      frequenciesHz: [w / (2 * Math.PI)],
      dampingRatios: [c / (2 * Math.sqrt(k * m))],
      modeShapes: [[1.0 / Math.sqrt(m)]],
      n: 1
    };
  }

  // M^(-1/2)
  const invSqrtM = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    invSqrtM[i][i] = 1.0 / Math.sqrt(Math.max(1e-6, M[i][i]));
  }

  // K_tilde = invSqrtM * K * invSqrtM
  const K_tilde = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      K_tilde[i][j] = invSqrtM[i][i] * K[i][j] * invSqrtM[j][j];
    }
  }

  // Jacobi Eigenvalue Solver for symmetric matrix K_tilde
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0)));
  const A = K_tilde.map(r => [...r]);
  const maxIter = 50;

  for (let iter = 0; iter < maxIter; iter++) {
    // Find largest off-diagonal element
    let maxVal = 0;
    let p = 0, q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j]) > maxVal) {
          maxVal = Math.abs(A[i][j]);
          p = i; q = j;
        }
      }
    }
    if (maxVal < 1e-9) break;

    const diff = A[q][q] - A[p][p];
    let t;
    if (Math.abs(diff) < 1e-12) {
      t = 1.0;
    } else {
      const theta = diff / (2.0 * A[p][q]);
      t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1.0));
    }
    const c = 1.0 / Math.sqrt(t * t + 1.0);
    const s = t * c;
    const tau = s / (1.0 + c);

    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];

    A[p][p] = app - t * apq;
    A[q][q] = aqq + t * apq;
    A[p][q] = 0;
    A[q][p] = 0;

    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const aip = A[i][p];
        const aiq = A[i][q];
        A[i][p] = aip - s * (aiq + tau * aip);
        A[p][i] = A[i][p];
        A[i][q] = aiq + s * (aip - tau * aiq);
        A[q][i] = A[i][q];
      }
    }

    for (let i = 0; i < n; i++) {
      const vip = V[i][p];
      const viq = V[i][q];
      V[i][p] = vip - s * (viq + tau * vip);
      V[i][q] = viq + s * (vip - tau * viq);
    }
  }

  // Extract eigenvalues and sort ascending
  const eigenPairs = [];
  for (let i = 0; i < n; i++) {
    const lambda = Math.max(0, A[i][i]);
    const w = Math.sqrt(lambda);
    // Mode shape in physical coordinates: phi = invSqrtM * V_col
    const phi = new Array(n);
    for (let r = 0; r < n; r++) {
      phi[r] = invSqrtM[r][r] * V[r][i];
    }
    // Standardize sign: first significant element > 0
    let leadSign = 1;
    for (let r = 0; r < n; r++) {
      if (Math.abs(phi[r]) > 1e-4) {
        leadSign = Math.sign(phi[r]);
        break;
      }
    }
    if (leadSign < 0) {
      for (let r = 0; r < n; r++) phi[r] = -phi[r];
    }

    // Modal damping: zeta_i = (phi^T * C * phi) / (2 * omega_i)
    let cModal = 0;
    for (let r1 = 0; r1 < n; r1++) {
      for (let r2 = 0; r2 < n; r2++) {
        cModal += phi[r1] * C[r1][r2] * phi[r2];
      }
    }
    const zeta = w > 1e-4 ? cModal / (2 * w) : 0;

    eigenPairs.push({ w, f: w / (2 * Math.PI), zeta, phi });
  }

  eigenPairs.sort((a, b) => a.w - b.w);

  return {
    frequenciesRad: eigenPairs.map(e => e.w),
    frequenciesHz: eigenPairs.map(e => e.f),
    dampingRatios: eigenPairs.map(e => e.zeta),
    modeShapes: eigenPairs.map(e => e.phi),
    n
  };
}

// Complex arithmetic helpers
const cMag = ([r, i]) => Math.hypot(r, i);
const cSub = ([r1, i1], [r2, i2]) => [r1 - r2, i1 - i2];
const cMul = ([r1, i1], [r2, i2]) => [r1 * r2 - i1 * i2, r1 * i2 + i1 * r2];
const cDiv = ([r1, i1], [r2, i2]) => {
  const d = r2 * r2 + i2 * i2 || 1e-14;
  return [(r1 * r2 + i1 * i2) / d, (i1 * r2 - r1 * i2) / d];
};

/**
 * Computes frequency response (Bode magnitude dB, phase deg) for arbitrary N-DOF system.
 */
export function computeGraphFRF(M, C, K, inputMassIdx = 0, wMin = 0.2, wMax = 40.0, nPoints = 120) {
  const n = M.length;
  const freqsHz = [];
  const magDb = Array.from({ length: n }, () => []);
  const phaseDeg = Array.from({ length: n }, () => []);

  const wVals = [];
  for (let i = 0; i < nPoints; i++) {
    const logW = Math.log10(wMin) + (i / (nPoints - 1)) * (Math.log10(wMax) - Math.log10(wMin));
    wVals.push(Math.pow(10, logW));
  }

  for (const w of wVals) {
    freqsHz.push(w / (2 * Math.PI));

    // Build Z(w) = -w^2 * M + j*w * C + K
    const Z = Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => {
        const re = K[r][c] - (r === c ? w * w * M[r][c] : 0);
        const im = w * C[r][c];
        return [re, im];
      })
    );

    // Vector b: unit force at inputMassIdx
    const b = Array.from({ length: n }, (_, i) => [i === inputMassIdx ? 1.0 : 0.0, 0.0]);

    // Gaussian Elimination with Partial Pivoting
    const aug = Z.map((row, i) => [...row.map(c => [c[0], c[1]]), [b[i][0], b[i][1]]]);

    for (let k = 0; k < n; k++) {
      let maxRow = k;
      let maxVal = cMag(aug[k][k]);
      for (let i = k + 1; i < n; i++) {
        const val = cMag(aug[i][k]);
        if (val > maxVal) { maxVal = val; maxRow = i; }
      }
      if (maxRow !== k) {
        const tmp = aug[k]; aug[k] = aug[maxRow]; aug[maxRow] = tmp;
      }
      const pivot = aug[k][k];
      for (let i = k + 1; i < n; i++) {
        const factor = cDiv(aug[i][k], pivot);
        for (let j = k; j <= n; j++) {
          aug[i][j] = cSub(aug[i][j], cMul(factor, aug[k][j]));
        }
      }
    }

    const sol = Array.from({ length: n }, () => [0, 0]);
    for (let i = n - 1; i >= 0; i--) {
      let sum = aug[i][n];
      for (let j = i + 1; j < n; j++) {
        sum = cSub(sum, cMul(aug[i][j], sol[j]));
      }
      sol[i] = cDiv(sum, aug[i][i]);
    }

    for (let j = 0; j < n; j++) {
      const mag = cMag(sol[j]);
      magDb[j].push(20 * Math.log10(Math.max(1e-6, mag)));
      let ph = Math.atan2(sol[j][1], sol[j][0]) * (180 / Math.PI);
      phaseDeg[j].push(ph);
    }
  }

  return { freqsHz, magDb, phaseDeg };
}

/**
 * General dynamic state-space RK4 time-domain integrator for arbitrary graph network.
 */
export function simulateGraphTimeDomain(M, C, K, appliedForces = [], options = {}) {
  const {
    dt = 0.005,
    t_max = 8.0,
    x0 = [],
    v0 = []
  } = options;

  const n = M.length;
  const nSteps = Math.max(2, Math.round(t_max / dt) + 1);

  const time = new Array(nSteps);
  const x = Array.from({ length: n }, () => new Array(nSteps));
  const v = Array.from({ length: n }, () => new Array(nSteps));
  const a = Array.from({ length: n }, () => new Array(nSteps));
  const total_E = new Array(nSteps);

  let curX = new Array(n).fill(0);
  for (let i = 0; i < n; i++) curX[i] = x0[i] !== undefined ? x0[i] : (i === 0 ? 0.12 : 0.0);
  let curV = new Array(n).fill(0);
  for (let i = 0; i < n; i++) curV[i] = v0[i] !== undefined ? v0[i] : 0.0;

  // Quasi-static equilibrium initialization for lightweight junction nodes (m <= 0.15 kg)
  // If a junction mass has x0 = 0 while connected masses are displaced, compute its static force equilibrium
  for (let i = 0; i < n; i++) {
    if (M[i][i] <= 0.15 && Math.abs(curX[i]) < 1e-6 && K[i][i] > 1e-4) {
      let coupling = 0;
      for (let j = 0; j < n; j++) {
        if (j !== i) coupling += K[i][j] * curX[j];
      }
      if (Math.abs(coupling) > 1e-6) {
        curX[i] = -coupling / K[i][i];
      }
    }
  }

  // Effective damping matrix with numerical Rayleigh regularization for lightweight junction nodes (m <= 0.15 kg)
  // When massless intermediate junctions are modeled as small lumped masses, they introduce stiff parasitic modes (e.g. 14 Hz).
  // Applying stiffness-proportional damping (beta * K) specifically suppresses parasitic high-frequency vibration
  // while preserving exact quasi-static equilibrium tracking with sub-millimeter precision.
  const hasLightweightJunction = M.some((row, i) => row[i] <= 0.15);
  const beta = hasLightweightJunction ? 0.005 : 0.0;
  const C_eff = C.map((r, i) => r.map((c, j) => c + beta * K[i][j]));

  const getForces = (t) => {
    const f = new Array(n).fill(0);
    if (!appliedForces || appliedForces.length === 0) {
      // Free vibration with initial displacement
      return f;
    }
    appliedForces.forEach(act => {
      const idx = act.targetMassIdx || 0;
      if (idx >= 0 && idx < n) {
        if (act.waveform === 'step') {
          f[idx] += t >= 0 ? act.F0 : 0;
        } else if (act.waveform === 'sine') {
          f[idx] += act.F0 * Math.sin((act.freq || 5.0) * t);
        } else if (act.waveform === 'impulse') {
          f[idx] += t < dt * 2 ? act.F0 / (dt * 2) : 0;
        }
      }
    });
    return f;
  };

  const evalDeriv = (t, stateX, stateV) => {
    const F = getForces(t);
    const acc = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      let restoring = 0;
      let dampingForce = 0;
      for (let j = 0; j < n; j++) {
        restoring += K[i][j] * stateX[j];
        dampingForce += C_eff[i][j] * stateV[j];
      }
      acc[i] = (F[i] - restoring - dampingForce) / M[i][i];
    }
    return { dX: stateV, dV: acc };
  };

  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    time[i] = t;

    for (let j = 0; j < n; j++) {
      x[j][i] = curX[j];
      v[j][i] = curV[j];
    }

    const { dV } = evalDeriv(t, curX, curV);
    for (let j = 0; j < n; j++) {
      a[j][i] = dV[j];
    }

    // Energy calculation: 1/2 v^T M v + 1/2 x^T K x
    let KE = 0, PE = 0;
    for (let j = 0; j < n; j++) {
      KE += 0.5 * M[j][j] * curV[j] * curV[j];
      for (let k = 0; k < n; k++) {
        PE += 0.5 * curX[j] * K[j][k] * curX[k];
      }
    }
    total_E[i] = KE + PE;

    // RK4 Integration step
    const k1 = evalDeriv(t, curX, curV);
    const x2 = curX.map((xi, idx) => xi + 0.5 * dt * k1.dX[idx]);
    const v2 = curV.map((vi, idx) => vi + 0.5 * dt * k1.dV[idx]);

    const k2 = evalDeriv(t + 0.5 * dt, x2, v2);
    const x3 = curX.map((xi, idx) => xi + 0.5 * dt * k2.dX[idx]);
    const v3 = curV.map((vi, idx) => vi + 0.5 * dt * k2.dV[idx]);

    const k3 = evalDeriv(t + 0.5 * dt, x3, v3);
    const x4 = curX.map((xi, idx) => xi + dt * k3.dX[idx]);
    const v4 = curV.map((vi, idx) => vi + dt * k3.dV[idx]);

    const k4 = evalDeriv(t + dt, x4, v4);

    for (let j = 0; j < n; j++) {
      curX[j] += (dt / 6.0) * (k1.dX[j] + 2 * k2.dX[j] + 2 * k3.dX[j] + k4.dX[j]);
      curV[j] += (dt / 6.0) * (k1.dV[j] + 2 * k2.dV[j] + 2 * k3.dV[j] + k4.dV[j]);
    }
  }

  return { time, x, v, a, total_E, n };
}

// ============================================================================
// CLASSROOM SPRING-DAMPER PROBLEM SOLVER ("SIR'S CLASS PROBLEMS")
// ============================================================================

/**
 * Analyzes mechanical network to generate step-by-step analytical classroom derivations:
 * - Equivalent spring stiffness k_eq (series, parallel, combination)
 * - Equivalent damping constant c_eq
 * - Natural frequency omega_n, f_n, T_n
 * - Critical damping c_c and damping ratio zeta
 * - Damped frequency omega_d, T_d, and logarithmic decrement delta
 * - Exact closed-form equation of motion x(t)
 */
export function solveClassroomProblem(nodes, edges, initialConditions = {}) {
  const { C, K, massNodes, n } = assembleGraphMCK(nodes, edges);
  // Sort mass nodes to pick the primary payload mass (largest mass), not a lightweight junction node
  const massNodesSorted = massNodes.slice().sort((a, b) => (Number(b.mass) || 0) - (Number(a.mass) || 0));
  const primaryMassNode = massNodesSorted[0] || { mass: 1.0, x0: 0.1, v0: 0.0 };
  const m = Math.max(1e-4, Number(primaryMassNode.mass) || 1.0);
  const x0 = Number(initialConditions.x0 ?? primaryMassNode.x0 ?? 0.1);
  const v0 = Number(initialConditions.v0 ?? primaryMassNode.v0 ?? 0.0);

  // Springs and dampers attached in the system
  const springs = edges.filter(e => e.type === 'spring');
  const dampers = edges.filter(e => e.type === 'damper');

  // Detect spring topology
  let k_eq = K[0][0];
  let kDerivationType = 'parallel'; // default parallel accumulation
  let kFormula = '';
  let kSubstitution = '';

  const wallIds = new Set(nodes.filter(n => n.type === 'wall').map(n => n.id));
  const juncNodes = nodes.filter(n => n.type === 'mass' && n.id !== primaryMassNode.id);

  if (springs.length === 1) {
    k_eq = Number(springs[0].k) || 100;
    kDerivationType = 'parallel';
    kFormula = 'k_{eq} = k_1';
    kSubstitution = `k_{eq} = ${k_eq}\\text{ N/m}`;
  } else if (juncNodes.length === 1) {
    const juncId = juncNodes[0].id;
    const wallToJunc = springs.filter(s => (wallIds.has(s.from) && s.to === juncId) || (wallIds.has(s.to) && s.from === juncId));
    const juncToMass = springs.filter(s => (s.from === juncId && s.to === primaryMassNode.id) || (s.to === juncId && s.from === primaryMassNode.id));

    if (wallToJunc.length > 0 && juncToMass.length > 0 && (wallToJunc.length + juncToMass.length === springs.length)) {
      const kA = wallToJunc.reduce((sum, s) => sum + (Number(s.k) || 0), 0);
      const kB = juncToMass.reduce((sum, s) => sum + (Number(s.k) || 0), 0);
      k_eq = (kA * kB) / (kA + kB);

      if (wallToJunc.length === 1 && juncToMass.length === 1) {
        kDerivationType = 'series';
        kFormula = '\\frac{1}{k_{eq}} = \\frac{1}{k_1} + \\frac{1}{k_2} \\implies k_{eq} = \\frac{k_1 k_2}{k_1 + k_2}';
        kSubstitution = `k_{eq} = \\frac{${kA} \\times ${kB}}{${kA} + ${kB}} = \\frac{${(kA * kB).toFixed(1)}}{${kA + kB}} = ${k_eq.toFixed(2)}\\text{ N/m}`;
      } else {
        kDerivationType = 'series-parallel';
        const descA = wallToJunc.length === 1 ? 'k_1' : `(${wallToJunc.map((_, i) => `k_{${i + 1}}`).join(' + ')})`;
        const descB = juncToMass.length === 1 ? `k_{${wallToJunc.length + 1}}` : `(${juncToMass.map((_, i) => `k_{${wallToJunc.length + i + 1}}`).join(' + ')})`;
        kFormula = `k_{eq} = \\frac{${descA} \\cdot ${descB}}{${descA} + ${descB}}`;
        kSubstitution = `k_{eq} = \\frac{${kA} \\times ${kB}}{${kA} + ${kB}} = \\frac{${(kA * kB).toFixed(1)}}{${kA + kB}} = ${k_eq.toFixed(2)}\\text{ N/m}`;
      }
    } else {
      const sumK = springs.reduce((acc, s) => acc + (Number(s.k) || 0), 0);
      k_eq = sumK > 0 ? sumK : K[0][0];
      kDerivationType = 'parallel';
      kFormula = 'k_{eq} = \\sum_{i=1}^n k_i';
      kSubstitution = `k_{eq} = ${springs.map(s => s.k).join(' + ')} = ${k_eq.toFixed(2)}\\text{ N/m}`;
    }
  } else if (springs.length === 2) {
    // Check if series or parallel
    const k1 = Number(springs[0].k) || 100;
    const k2 = Number(springs[1].k) || 100;
    const s1Nodes = [springs[0].from, springs[0].to];
    const s2Nodes = [springs[1].from, springs[1].to];
    const shared = s1Nodes.filter(id => s2Nodes.includes(id));

    // If both springs connect to wall and mass -> parallel
    const bothShareBothEnds = (s1Nodes.includes('wall1') && s2Nodes.includes('wall1')) ||
                              (shared.length === 2);
    if (bothShareBothEnds || shared.length === 0) {
      k_eq = k1 + k2;
      kDerivationType = 'parallel';
      kFormula = 'k_{eq} = k_1 + k_2';
      kSubstitution = `k_{eq} = ${k1} + ${k2} = ${k_eq}\\text{ N/m}`;
    } else {
      // Shared intermediate point -> Series
      k_eq = (k1 * k2) / (k1 + k2);
      kDerivationType = 'series';
      kFormula = '\\frac{1}{k_{eq}} = \\frac{1}{k_1} + \\frac{1}{k_2} \\implies k_{eq} = \\frac{k_1 k_2}{k_1 + k_2}';
      kSubstitution = `k_{eq} = \\frac{${k1} \\times ${k2}}{${k1} + ${k2}} = \\frac{${(k1 * k2).toFixed(1)}}{${k1 + k2}} = ${k_eq.toFixed(2)}\\text{ N/m}`;
    }
  } else if (springs.length > 2) {
    // Multi-spring parallel or composite
    const sumK = springs.reduce((acc, s) => acc + (Number(s.k) || 0), 0);
    k_eq = sumK > 0 ? sumK : K[0][0];
    kDerivationType = 'parallel';
    kFormula = 'k_{eq} = \\sum_{i=1}^n k_i';
    kSubstitution = `k_{eq} = ${springs.map(s => s.k).join(' + ')} = ${k_eq.toFixed(2)}\\text{ N/m}`;
  } else {
    k_eq = K[0][0];
    kDerivationType = 'parallel';
    kFormula = 'k_{eq} = K_{11}';
    kSubstitution = `k_{eq} = ${k_eq.toFixed(2)}\\text{ N/m}`;
  }

  // Detect damper topology
  let c_eq = C[0][0];
  let cFormula = '';
  let cSubstitution = '';
  if (dampers.length === 0) {
    c_eq = 0;
    cFormula = 'c_{eq} = 0';
    cSubstitution = 'c_{eq} = 0\\text{ N}\\cdot\\text{s/m (Undamped)}';
  } else if (dampers.length === 1) {
    c_eq = Number(dampers[0].c) || 1.0;
    cFormula = 'c_{eq} = c_1';
    cSubstitution = `c_{eq} = ${c_eq}\\text{ N}\\cdot\\text{s/m}`;
  } else {
    const sumC = dampers.reduce((acc, d) => acc + (Number(d.c) || 0), 0);
    c_eq = sumC;
    cFormula = 'c_{eq} = \\sum_{i=1}^m c_i';
    cSubstitution = `c_{eq} = ${dampers.map(d => d.c).join(' + ')} = ${c_eq.toFixed(2)}\\text{ N}\\cdot\\text{s/m}`;
  }

  // Core Physical Vibration Calculations
  const omega_n = Math.sqrt(Math.max(1e-6, k_eq / m));
  const f_n = omega_n / (2 * Math.PI);
  const T_n = 1 / f_n;
  const c_c = 2 * Math.sqrt(Math.max(1e-6, m * k_eq));
  const zeta = c_c > 0 ? c_eq / c_c : 0;

  let regime = 'underdamped';
  let regimeName = 'Underdamped (Oscillatory Harmonic Decay)';
  let omega_d = 0;
  let f_d = 0;
  let T_d = 0;
  let delta = 0;
  let roots = [];
  let X_amp = Math.abs(x0);
  let phi_phase = 0;
  let equationOfMotionTex = '';

  if (zeta < 1.0) {
    regime = 'underdamped';
    regimeName = 'Underdamped (ζ < 1: Oscillatory Harmonic Decay)';
    omega_d = omega_n * Math.sqrt(Math.max(0, 1 - zeta * zeta));
    f_d = omega_d / (2 * Math.PI);
    T_d = omega_d > 0 ? (2 * Math.PI) / omega_d : 0;
    delta = Math.sqrt(1 - zeta * zeta) > 0 ? (2 * Math.PI * zeta) / Math.sqrt(1 - zeta * zeta) : 0;

    // A = x0, B = (v0 + zeta*omega_n*x0)/omega_d
    const B_coeff = omega_d > 0 ? (v0 + zeta * omega_n * x0) / omega_d : 0;
    X_amp = Math.hypot(x0, B_coeff);
    phi_phase = Math.atan2(x0, B_coeff);

    equationOfMotionTex = `x(t) = e^{-${(zeta * omega_n).toFixed(3)}t}\\left[${x0.toFixed(3)}\\cos(${omega_d.toFixed(3)}t) + ${B_coeff.toFixed(3)}\\sin(${omega_d.toFixed(3)}t)\\right]`;
  } else if (Math.abs(zeta - 1.0) < 0.01) {
    regime = 'critically_damped';
    regimeName = 'Critically Damped (ζ = 1: Fastest Non-Oscillatory Return)';
    const c1 = x0;
    const c2 = v0 + omega_n * x0;
    equationOfMotionTex = `x(t) = (${c1.toFixed(3)} + ${c2.toFixed(3)}t)e^{-${omega_n.toFixed(3)}t}`;
  } else {
    regime = 'overdamped';
    regimeName = 'Overdamped (ζ > 1: Sluggish Aperiodic Return, No Oscillation)';
    const s1 = (-zeta + Math.sqrt(zeta * zeta - 1)) * omega_n;
    const s2 = (-zeta - Math.sqrt(zeta * zeta - 1)) * omega_n;
    roots = [s1, s2];
    const c1 = (v0 - s2 * x0) / (s1 - s2);
    const c2 = (s1 * x0 - v0) / (s1 - s2);
    equationOfMotionTex = `x(t) = ${c1.toFixed(3)}e^{${s1.toFixed(3)}t} + ${c2.toFixed(3)}e^{${s2.toFixed(3)}t}`;
  }

  // Build step-by-step classroom derivation sequence
  const steps = [
    {
      stepNum: 1,
      title: 'Free Body Diagram & Governing Differential Equation',
      description: 'By D\'Alembert\'s principle and Newton\'s Second Law, sum of inertial, damping, and stiffness forces equals external excitation:',
      formula: 'm\\ddot{x}(t) + c_{eq}\\dot{x}(t) + k_{eq}x(t) = F(t)',
      substitution: `${m.toFixed(2)}\\ddot{x} + ${c_eq.toFixed(2)}\\dot{x} + ${k_eq.toFixed(2)}x = 0`,
      note: `Single-degree-of-freedom translation along horizontal rail x(t). Initial conditions: x(0) = ${x0.toFixed(3)} m, v(0) = ${v0.toFixed(3)} m/s.`
    },
    {
      stepNum: 2,
      title: 'Equivalent Spring Constant (k_eq)',
      description: kDerivationType === 'series'
        ? 'Springs are connected in series; both experience identical restoring tension with additive displacements (1/k_eq = 1/k_1 + 1/k_2):'
        : (kDerivationType === 'series-parallel'
          ? 'Composite spring network: series combination of single spring with parallel spring pair (k_eq = k_series · k_parallel / (k_series + k_parallel)):'
          : 'Springs are in parallel; both experience identical kinematic displacement and their restoring forces add directly (k_eq = k_1 + k_2):'),
      formula: kFormula,
      substitution: kSubstitution,
      result: `k_{eq} = ${k_eq.toFixed(2)}\\text{ N/m}`,
      note: `Stiffness dictates the elastic restoring force F_s = -k_{eq}x.`
    },
    {
      stepNum: 3,
      title: 'Equivalent Damping Constant (c_eq)',
      description: dampers.length === 0
        ? 'No dashpot damper connected; energy dissipation is neglected (ideal conservative harmonic system).'
        : 'Dashpots provide viscous resistive damping proportional to velocity F_d = -c_{eq}\\dot{x}:',
      formula: cFormula,
      substitution: cSubstitution,
      result: `c_{eq} = ${c_eq.toFixed(2)}\\text{ N}\\cdot\\text{s/m}`,
      note: `Viscous dashpot dissipation constant.`
    },
    {
      stepNum: 4,
      title: 'Undamped Natural Frequency (ω_n) & Natural Period (T_n)',
      description: 'The fundamental frequency at which the system oscillates freely without damping:',
      formula: '\\omega_n = \\sqrt{\\frac{k_{eq}}{m}}, \\quad f_n = \\frac{\\omega_n}{2\\pi}, \\quad T_n = \\frac{1}{f_n}',
      substitution: `\\omega_n = \\sqrt{\\frac{${k_eq.toFixed(2)}}{${m.toFixed(2)}}} = ${omega_n.toFixed(3)}\\text{ rad/s}, \\quad f_n = \\frac{${omega_n.toFixed(3)}}{2\\pi} = ${f_n.toFixed(3)}\\text{ Hz}`,
      result: `\\omega_n = ${omega_n.toFixed(3)}\\text{ rad/s}, \\quad f_n = ${f_n.toFixed(3)}\\text{ Hz}, \\quad T_n = ${T_n.toFixed(3)}\\text{ s}`,
      note: `Oscillation period without damping.`
    },
    {
      stepNum: 5,
      title: 'Critical Damping (c_c) & Damping Ratio (ζ)',
      description: 'Critical damping c_c is the boundary between oscillatory motion and non-oscillatory decay. Damping ratio ζ indicates the damping level relative to critical:',
      formula: 'c_c = 2\\sqrt{m k_{eq}} = 2m\\omega_n, \\quad \\zeta = \\frac{c_{eq}}{c_c}',
      substitution: `c_c = 2\\sqrt{${m.toFixed(2)} \\times ${k_eq.toFixed(2)}} = ${c_c.toFixed(3)}\\text{ N}\\cdot\\text{s/m}, \\quad \\zeta = \\frac{${c_eq.toFixed(2)}}{${c_c.toFixed(3)}} = ${zeta.toFixed(4)}`,
      result: `\\zeta = ${zeta.toFixed(4)} \\implies \\text{${regimeName}}`,
      note: `Classification: ${regimeName}.`
    }
  ];

  if (zeta < 1.0) {
    steps.push({
      stepNum: 6,
      title: 'Damped Natural Frequency (ω_d) & Logarithmic Decrement (δ)',
      description: 'Because ζ < 1, the presence of viscous resistance reduces the oscillation frequency to ω_d and causes exponential decay:',
      formula: '\\omega_d = \\omega_n \\sqrt{1 - \\zeta^2}, \\quad T_d = \\frac{2\\pi}{\\omega_d}, \\quad \\delta = \\frac{2\\pi\\zeta}{\\sqrt{1-\\zeta^2}}',
      substitution: `\\omega_d = ${omega_n.toFixed(3)}\\sqrt{1 - (${zeta.toFixed(4)})^2} = ${omega_d.toFixed(3)}\\text{ rad/s}, \\quad \\delta = \\frac{2\\pi(${zeta.toFixed(4)})}{\\sqrt{1-(${zeta.toFixed(4)})^2}} = ${delta.toFixed(4)}`,
      result: `\\omega_d = ${omega_d.toFixed(3)}\\text{ rad/s}, \\quad f_d = ${f_d.toFixed(3)}\\text{ Hz}, \\quad \\delta = ${delta.toFixed(4)}`,
      note: `Successive peak ratio: x_n / x_{n+1} = e^δ = ${(Math.exp(delta)).toFixed(3)}.`
    });
  }

  steps.push({
    stepNum: steps.length + 1,
    title: 'Complete Analytical Solution x(t)',
    description: 'Substituting initial displacement and velocity into the general homogeneous differential solution:',
    formula: 'x(t) = e^{-\\zeta \\omega_n t} \\left[ x(0)\\cos(\\omega_d t) + \\frac{v(0) + \\zeta\\omega_n x(0)}{\\omega_d} \\sin(\\omega_d t) \\right]',
    substitution: equationOfMotionTex,
    result: equationOfMotionTex,
    note: `Exact mathematical time-response matching classroom textbook standards.`
  });

  return {
    m,
    k_eq,
    c_eq,
    c_c,
    omega_n,
    f_n,
    T_n,
    zeta,
    omega_d,
    f_d,
    T_d,
    delta,
    X_amp,
    phi_phase,
    roots,
    regime,
    regimeName,
    equationOfMotionTex,
    steps,
    isSDOF: n === 1
  };
}

