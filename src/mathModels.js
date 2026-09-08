// mathModels.js
// Data and utility module for mechanical simulation application.
// Contains governing equations, parameter definitions, and mechanical-electrical analogy calculations.

export const MATH_MODELS = {
  simple_pendulum: {
    title: 'Simple Pendulum',
    governingEqn: 'm L^2 \\ddot{\\theta} + b \\dot{\\theta} + m g L \\sin(\\theta) = 0',
    linearizedEqn: 'm L^2 \\ddot{\\theta} + b \\dot{\\theta} + m g L \\theta = 0',
    standardForm: '\\ddot{\\theta} + 2 \\zeta \\omega_n \\dot{\\theta} + \\omega_n^2 \\theta = 0',
    stateVector: '\\begin{bmatrix} \\dot{\\theta} \\\\ \\ddot{\\theta} \\end{bmatrix} = \\begin{bmatrix} \\omega \\\\ -\\frac{b}{m L^2}\\omega - \\frac{g}{L}\\sin(\\theta) \\end{bmatrix}',
    parameters: [
      { symbol: 'm', name: 'Mass', unit: 'kg', description: 'Mass of the pendulum bob' },
      { symbol: 'L', name: 'Length', unit: 'm', description: 'Length of the pendulum string' },
      { symbol: 'g', name: 'Gravity', unit: 'm/s²', description: 'Acceleration due to gravity' },
      { symbol: 'b', name: 'Damping', unit: 'kg·m²/s', description: 'Viscous damping coefficient' }
    ],
    energyEquations: {
      KE: 'T = \\frac{1}{2} m (L \\dot{\\theta})^2',
      PE: 'V = m g L (1 - \\cos(\\theta))',
      total: 'E = T + V'
    },
    analogyType: 'rlc'
  },
  compound_pendulum: {
    title: 'Compound Pendulum',
    governingEqn: 'I \\ddot{\\theta} + b \\dot{\\theta} + m g d \\sin(\\theta) = 0',
    linearizedEqn: 'I \\ddot{\\theta} + b \\dot{\\theta} + m g d \\theta = 0',
    standardForm: '\\ddot{\\theta} + 2 \\zeta \\omega_n \\dot{\\theta} + \\omega_n^2 \\theta = 0',
    stateVector: '\\begin{bmatrix} \\dot{\\theta} \\\\ \\ddot{\\theta} \\end{bmatrix} = \\begin{bmatrix} \\omega \\\\ -\\frac{b}{I}\\omega - \\frac{m g d}{I}\\sin(\\theta) \\end{bmatrix}',
    parameters: [
      { symbol: 'm', name: 'Mass', unit: 'kg', description: 'Mass of the pendulum rod' },
      { symbol: 'L', name: 'Length', unit: 'm', description: 'Total length of the uniform rod' },
      { symbol: 'g', name: 'Gravity', unit: 'm/s²', description: 'Acceleration due to gravity' },
      { symbol: 'b', name: 'Damping', unit: 'kg·m²/s', description: 'Viscous damping coefficient' },
      { symbol: 'd', name: 'CG Distance', unit: 'm', description: 'Distance to center of gravity (L/2 for uniform rod)' }
    ],
    energyEquations: {
      KE: 'T = \\frac{1}{2} I \\dot{\\theta}^2',
      PE: 'V = m g d (1 - \\cos(\\theta))',
      total: 'E = T + V'
    },
    analogyType: 'rlc'
  },
  slider_crank: {
    title: 'Slider-Crank Mechanism',
    governingEqn: 'x_p = r \\cos(\\theta) + \\sqrt{l^2 - r^2 \\sin^2(\\theta)}',
    linearizedEqn: 'x_p \\approx r \\cos(\\theta) + l - \\frac{r^2}{2l}\\sin^2(\\theta)',
    standardForm: 'v_p = -r \\omega \\left(\\sin(\\theta) + \\frac{\\lambda \\sin(2\\theta)}{2 \\sqrt{1 - \\lambda^2 \\sin^2(\\theta)}}\\right)',
    stateVector: '\\begin{bmatrix} x_p \\\\ v_p \\\\ a_p \\end{bmatrix}',
    parameters: [
      { symbol: 'r', name: 'Crank Radius', unit: 'm', description: 'Length of the driving crank' },
      { symbol: 'l', name: 'Connecting Rod', unit: 'm', description: 'Length of the connecting rod' },
      { symbol: 'N', name: 'Speed', unit: 'rpm', description: 'Crank rotational speed' }
    ],
    energyEquations: {
      KE: '-',
      PE: '-',
      total: '-'
    },
    analogyType: 'kinematic'
  },
  four_bar: {
    title: 'Four-Bar Linkage',
    governingEqn: 'K_1 \\cos(\\theta_4) - K_2 \\cos(\\theta_2) + K_3 = \\cos(\\theta_2 - \\theta_4)',
    linearizedEqn: '-',
    standardForm: '-',
    stateVector: '\\begin{bmatrix} \\theta_2 \\\\ \\theta_3 \\\\ \\theta_4 \\end{bmatrix}',
    parameters: [
      { symbol: 'a', name: 'Link a', unit: 'm', description: 'Crank length (input)' },
      { symbol: 'b', name: 'Link b', unit: 'm', description: 'Coupler length' },
      { symbol: 'c', name: 'Link c', unit: 'm', description: 'Rocker length (output)' },
      { symbol: 'd', name: 'Link d', unit: 'm', description: 'Ground link length' }
    ],
    energyEquations: {
      KE: '-',
      PE: '-',
      total: '-'
    },
    analogyType: 'kinematic'
  }
};

export function computeAnalogy(simType, params) {
  if (simType === 'simple_pendulum') {
    const m = params.mass ?? 1;
    const L = params.length ?? 1;
    const g = params.gravity ?? 9.81;
    const b = params.damping ?? 0;
    const L_e = m * L * L;
    const R = b;
    const C = 1 / (m * g * L);
    const omega_n = Math.sqrt(g / L);
    const zeta = b / (2 * m * L * L * omega_n);
    let omega_d = 0;
    let T_d = null;
    if (zeta < 1 && zeta > 0) {
      omega_d = omega_n * Math.sqrt(1 - zeta * zeta);
      T_d = (2 * Math.PI) / omega_d;
    }
    const T_n = (2 * Math.PI) / omega_n;
    return { L_e, R, C, omega_n, zeta, omega_d, T_n, T_d };
  } else if (simType === 'compound_pendulum') {
    const m = params.mass ?? 2;
    const L = params.length ?? 1;
    const g = params.gravity ?? 9.81;
    const b = params.damping ?? 0;
    const d = L / 2;
    const I_pivot = (1 / 3) * m * L * L;
    const L_e = I_pivot;
    const R = b;
    const C = 1 / (m * g * d);
    const omega_n = Math.sqrt((m * g * d) / I_pivot);
    const zeta = b / (2 * I_pivot * omega_n);
    let omega_d = 0;
    let T_d = null;
    if (zeta < 1 && zeta > 0) {
      omega_d = omega_n * Math.sqrt(1 - zeta * zeta);
      T_d = (2 * Math.PI) / omega_d;
    }
    const T_n = (2 * Math.PI) / omega_n;
    return { d, I_pivot, L_e, R, C, omega_n, zeta, omega_d, T_n, T_d };
  } else if (simType === 'slider_crank') {
    const r = params.crank_length ?? 0.1;
    const l = params.conn_length ?? 0.3;
    const N = params.crank_speed ?? 300;
    const lambda = r / l;
    const stroke = 2 * r;
    const omega = N * (2 * Math.PI) / 60;
    return { lambda, stroke, omega, r, l, N };
  } else if (simType === 'four_bar') {
    const a = params.link_crank ?? 1;
    const b = params.link_coupler ?? 2.5;
    const c = params.link_rocker ?? 3;
    const d = params.link_ground ?? 4;
    const K1 = d / a;
    const K2 = d / c;
    const K3 = (a * a - b * b + c * c + d * d) / (2 * a * c);
    const links = [a, b, c, d].sort((x, y) => x - y);
    const S = links[0];
    const L_max = links[3];
    const P = links[1];
    const Q = links[2];
    const grashof = (S + L_max) <= (P + Q);
    return { K1, K2, K3, grashof, S, L: L_max, P, Q, a, b, c, d };
  }
  return {};
}


export function getSubstitutedEqn(simType, params) {
  if (simType === 'simple_pendulum') {
    const m = params.mass ?? 1;
    const L = params.length ?? 1;
    const g = params.gravity ?? 9.81;
    const b = params.damping ?? 0;
    const eqn = `${m} \\times ${L}^2 \\ddot{\\theta} + ${b} \\dot{\\theta} + ${m} \\times ${g} \\times ${L} \\sin(\\theta) = 0`;
    const analogy = computeAnalogy(simType, params);
    const computed = `\\omega_n = ${analogy.omega_n.toFixed(3)} \\text{ rad/s}, \\; \\zeta = ${analogy.zeta.toFixed(4)}, \\; T_n = ${analogy.T_n.toFixed(3)} \\text{ s}`;
    return { eqn, computed };
  } else if (simType === 'compound_pendulum') {
    const m = params.mass ?? 2;
    const L = params.length ?? 1;
    const g = params.gravity ?? 9.81;
    const b = params.damping ?? 0;
    const I = (1/3) * m * L * L;
    const d = L / 2;
    const eqn = `${I.toFixed(3)} \\ddot{\\theta} + ${b} \\dot{\\theta} + ${m} \\times ${g} \\times ${d.toFixed(3)} \\sin(\\theta) = 0`;
    const analogy = computeAnalogy(simType, params);
    const computed = `\\omega_n = ${analogy.omega_n.toFixed(3)} \\text{ rad/s}, \\; \\zeta = ${analogy.zeta.toFixed(4)}, \\; T_n = ${analogy.T_n.toFixed(3)} \\text{ s}`;
    return { eqn, computed };
  } else if (simType === 'slider_crank') {
    const r = params.crank_length ?? 0.1;
    const l = params.conn_length ?? 0.3;
    const eqn = `x_p = ${r} \\cos(\\theta) + \\sqrt{${l}^2 - ${r}^2 \\sin^2(\\theta)}`;
    const analogy = computeAnalogy(simType, params);
    const computed = `\\lambda = ${analogy.lambda.toFixed(3)}, \\; \\text{stroke} = ${analogy.stroke.toFixed(4)} \\text{ m}, \\; \\omega = ${analogy.omega.toFixed(2)} \\text{ rad/s}`;
    return { eqn, computed };
  } else if (simType === 'four_bar') {
    const analogy = computeAnalogy(simType, params);
    const eqn = `${analogy.K1.toFixed(3)} \\cos(\\theta_4) - ${analogy.K2.toFixed(3)} \\cos(\\theta_2) + ${analogy.K3.toFixed(3)} = \\cos(\\theta_2 - \\theta_4)`;
    const grashofStr = analogy.grashof ? '\\text{Yes (Grashof)}' : '\\text{No (Non-Grashof)}';
    const computed = `S+L = ${(analogy.S + analogy.L).toFixed(2)}, \\; P+Q = ${(analogy.P + analogy.Q).toFixed(2)}, \\; \\text{Grashof: } ${grashofStr}`;
    return { eqn, computed };
  }
  return { eqn: '', computed: '' };
}

export const ANALOGY_TABLE = [
  { mechanical: 'Force F', electrical: 'Voltage V', unit_mech: 'N', unit_elec: 'V' },
  { mechanical: 'Velocity dx/dt', electrical: 'Current I', unit_mech: 'm/s', unit_elec: 'A' },
  { mechanical: 'Mass m', electrical: 'Inductance L', unit_mech: 'kg', unit_elec: 'H' },
  { mechanical: 'Damping b', electrical: 'Resistance R', unit_mech: 'N·s/m', unit_elec: 'Ω' },
  { mechanical: 'Stiffness k', electrical: '1/Capacitance 1/C', unit_mech: 'N/m', unit_elec: '1/F' },
  { mechanical: 'Displacement x', electrical: 'Charge q', unit_mech: 'm', unit_elec: 'C' }
];
