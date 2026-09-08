/**
 * @file tooltipData.js
 * @description Educational tooltips and engineering descriptions for all mechanism parameters.
 */

export const PARAM_TOOLTIPS = {
  // Simple Pendulum
  length: {
    title: 'Rod Length (L)',
    desc: 'The distance from the pivot axis to the center of mass of the bob. In simple harmonic motion, period scales with the square root of length: T ≈ 2π√(L/g).',
    unit: 'm (meters)',
    formula: 'T_0 = 2π√(L/g)',
    typical: '0.5 to 2.5 m in laboratory rigs; up to 20 m in Foucault pendulums'
  },
  mass: {
    title: 'Bob Mass (m)',
    desc: 'The mass concentrated at the pendulum tip. For an ideal undamped pendulum, period is mass-independent; however, mass dictates stored kinetic energy, momentum, and resistance to damping decay.',
    unit: 'kg (kilograms)',
    formula: 'KE = ½m(Lω)²',
    typical: '0.2 to 5.0 kg'
  },
  gravity: {
    title: 'Gravitational Acceleration (g)',
    desc: 'Local gravitational field providing the restoring torque (τ = -mgL sin θ). Higher gravity pulls the system toward equilibrium faster, increasing natural frequency.',
    unit: 'm/s²',
    formula: 'ω_n = √(g/L)',
    typical: 'Earth: 9.81 m/s² | Moon: 1.62 m/s² | Mars: 3.71 m/s² | Jupiter: 24.79 m/s²'
  },
  damping: {
    title: 'Viscous Damping Coefficient (b)',
    desc: 'Models energy dissipation from aerodynamic air resistance and pivot bearing friction (τ_damping = -b·ω). Governs the exponential decay envelope and damping ratio ζ.',
    unit: 'N·m·s/rad',
    formula: 'ζ = b / (2·m·L²·ω_n)',
    typical: '0.01 - 0.05 (clean air bearings), 0.1 - 0.5 (aerodynamic drag), > 1.0 (dashpot damper)'
  },
  theta0: {
    title: 'Initial Angle (θ₀)',
    desc: 'Starting angular displacement away from the downward equilibrium position. At small angles (< 15°), sin(θ) ≈ θ. At larger angles, true period exceeds the small-angle approximation due to elliptic integral nonlinearities.',
    unit: 'degrees (°)',
    formula: 'T = 4√(L/g) · K(sin²(θ₀/2))',
    typical: '5° to 30° (linear regime), 45° to 120° (strongly nonlinear regime)'
  },
  omega0: {
    title: 'Initial Angular Velocity (ω₀)',
    desc: 'Starting rotational velocity given to the pendulum at t = 0. Imparts initial kinetic energy to the system.',
    unit: 'rad/s (radians per second)',
    formula: 'KE₀ = ½m(Lω₀)²',
    typical: '0.0 rad/s (released from rest)'
  },

  // Compound Pendulum
  I_pivot: {
    title: 'Pivot Moment of Inertia (I_pivot)',
    desc: 'Rotational inertia about the suspension axis, computed via Parallel Axis Theorem: I_pivot = I_cm + m·d² = (1/3)m·L² for a uniform slender rod pivoted at its end.',
    unit: 'kg·m²',
    formula: 'I_pivot = ⅓ m L²',
    typical: 'Depends on rod geometry and mass'
  },
  L_eff: {
    title: 'Effective Length (L_eff)',
    desc: 'The length of an equivalent simple pendulum that has the exact same period: L_eff = I_pivot / (m·d) = (2/3)L for a uniform rod. The point at distance L_eff is called the Center of Oscillation (or Center of Percussion / Sweet Spot).',
    unit: 'm (meters)',
    formula: 'L_eff = ⅔ L',
    typical: 'Exactly 2/3 of total rod length'
  },

  // Slider-Crank
  crank_length: {
    title: 'Crank Length (r)',
    desc: 'The radius of the driving crank arm. For an inline slider-crank, total piston stroke is exactly twice the crank radius: Stroke = 2r.',
    unit: 'm (meters)',
    formula: 'Stroke = 2r',
    typical: '0.04 to 0.15 m in automotive internal combustion engines'
  },
  conn_length: {
    title: 'Connecting Rod Length (l)',
    desc: 'The link coupling the rotating crank pin to the reciprocating slider wrist pin. Must strictly be greater than the crank radius (l > r) to allow full 360° rotation.',
    unit: 'm (meters)',
    formula: 'λ = r / l < 1.0',
    typical: 'Typically 3x to 4x the crank radius (λ ≈ 0.25 to 0.33)'
  },
  crank_speed: {
    title: 'Crank Speed (N)',
    desc: 'Rotational input velocity of the crankshaft in revolutions per minute (RPM). Higher RPM dramatically escalates slider peak acceleration proportionally to ω².',
    unit: 'rpm (revolutions per minute)',
    formula: 'ω = N · (2π / 60) rad/s',
    typical: '600 - 6,000 RPM in automobile engines; 60 - 300 RPM in industrial compressors'
  },

  // Four-Bar Linkage
  link_ground: {
    title: 'Ground Frame Link (d)',
    desc: 'Fixed distance between base pivot Joint A and base pivot Joint D. Forms the stationary reference of the kinematic loop.',
    unit: 'm (meters)',
    formula: 'Loop: r_a + r_b = r_d + r_c',
    typical: 'Reference frame dimension'
  },
  link_crank: {
    title: 'Input Crank Link (a)',
    desc: 'The driving link pivoted to the frame at Joint A. If Grashof criteria is satisfied and this link is shortest, it can rotate continuously through 360° (Crank-Rocker mechanism).',
    unit: 'm (meters)',
    formula: 'S + L ≤ P + Q (Grashof Law)',
    typical: 'Shortest link in typical crank-rocker configurations'
  },
  link_coupler: {
    title: 'Coupler Link (b)',
    desc: 'The floating link connecting Joint B to Joint C. Undergoes complex planar motion (simultaneous translation and rotation), tracing intricate coupler curves utilized in automated assembly machinery.',
    unit: 'm (meters)',
    formula: 'x_coupler = a·cos(θ₂) + (b/2)·cos(θ₃)',
    typical: 'Sized to achieve desired output motion swing'
  },
  link_rocker: {
    title: 'Output Rocker Link (c)',
    desc: 'The output link pivoted to the frame at Joint D. Driven by the coupler through an oscillatory angular sweep (Rocker Range Δθ₄).',
    unit: 'm (meters)',
    formula: 'Δθ₄ = θ₄_max - θ₄_min',
    typical: 'Sized to achieve target stroke/swing amplitude'
  },

  // Simulation Controls
  t_max: {
    title: 'Time Span (t_max)',
    desc: 'Total duration of the simulation in seconds. Determines how many complete oscillation cycles or mechanism rotations are captured.',
    unit: 's (seconds)',
    formula: 'Cycles ≈ t_max / T',
    typical: '5 to 20 seconds'
  },
  dt: {
    title: 'Timestep (dt)',
    desc: 'Integration time increment used for trajectory sampling. The underlying RK45 solver uses adaptive step-sizes to bound local truncation error below 1e-8.',
    unit: 's (seconds)',
    formula: 'Δt ≤ T / 100',
    typical: '0.001 to 0.01 seconds'
  }
};
