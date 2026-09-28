"""
============================================================================
PHYSICAL FEASIBILITY & MECHANISM CONSTRAINTS ENGINE (PYTHON)
Module: validation/feasibility.py
============================================================================

Evaluates geometric assembly, kinematic feasibility, transmission angle bounds,
and dynamic stability. Provides structured error and warning diagnostics.
"""

import numpy as np
from simulations.kinematics_core import (
    classify_grashof,
    compute_reachable_input_arc
)


def check_feasibility(sim_type, params=None):
    if params is None:
        params = {}

    checks = []

    _check_universal(sim_type, params, checks)

    if sim_type == 'four_bar':
        _check_four_bar(params, checks)
    elif sim_type == 'slider_crank':
        _check_slider_crank(params, checks)
    elif sim_type == 'simple_pendulum':
        _check_simple_pendulum(params, checks)
    elif sim_type == 'compound_pendulum':
        _check_compound_pendulum(params, checks)

    has_error = any(c['severity'] == 'error' for c in checks)
    has_warning = any(c['severity'] == 'warning' for c in checks)

    if has_error:
        status = 'impossible'
        score = 0
        title = 'Infeasible Kinematic Configuration'
    elif has_warning:
        status = 'warning'
        score = max(20, 100 - len(checks) * 20)
        title = 'Functionally Constrained Configuration'
    else:
        status = 'ok'
        score = 100
        title = 'Valid Parameter Space'

    summary = checks[0]['what'] if checks else 'All parameters satisfy physical constraints.'

    violations = [
        {
            'severity': c['severity'],
            'message': f"{c['title']}: {c['what']}",
            'recommendation': '; '.join(c.get('fix', []))
        }
        for c in checks
    ]

    metrics = {}
    if sim_type == 'four_bar':
        d = float(params.get('link_ground', 4.0))
        a = float(params.get('link_crank', 1.0))
        b = float(params.get('link_coupler', 2.5))
        c = float(params.get('link_rocker', 3.0))
        if d > 0 and a > 0 and b > 0 and c > 0:
            g = classify_grashof(d, a, b, c)
            metrics['grashof_type'] = g['type']
            metrics['shortest_link'] = g['shortest']
            s0 = abs(d - a)
            s180 = d + a
            c_mu1 = (b**2 + c**2 - s0**2) / (2.0 * b * c)
            c_mu2 = (b**2 + c**2 - s180**2) / (2.0 * b * c)
            mu_angs = []
            for c_mu in (c_mu1, c_mu2):
                if -1.0 <= c_mu <= 1.0:
                    ang = np.arccos(c_mu)
                    mu_angs.append(ang)
                    mu_angs.append(np.pi - ang)
            if mu_angs:
                metrics['min_trans_deg'] = float(np.degrees(min(mu_angs)))
                metrics['max_trans_deg'] = float(np.degrees(max(mu_angs)))
    elif sim_type == 'slider_crank':
        r = float(params.get('crank_length', 0.1))
        l = float(params.get('conn_length', 0.3))
        if l > 0:
            metrics['lambda'] = f"{r / l:.3f}"
            metrics['stroke_m'] = f"{2 * r:.3f}"

    return {
        'status': status,
        'checks': checks,
        'is_feasible': not has_error,
        'score': score,
        'title': title,
        'summary': summary,
        'violations': violations,
        'metrics': metrics
    }


def _check_universal(sim_type, params, checks):
    b = float(params.get('damping', 0.0))
    if b < 0:
        checks.append({
            'id': 'universal.damping',
            'severity': 'error',
            'title': 'Negative Damping Injects Energy',
            'what': f"Viscous damping coefficient b = {b:.4f} is strictly negative.",
            'why': "Negative damping injects energy continuously into the mechanical system rather than dissipating it.",
            'consequence': "Dynamic states undergo exponential runaway; no bounded physical solution exists.",
            'fix': ["Set damping to zero for conservative motion or a positive value (b >= 0.0)."]
        })

    dt = float(params.get('dt', 0.01))
    t_max = float(params.get('t_max', 10.0))

    if dt <= 0:
        checks.append({
            'id': 'universal.dt_positivity',
            'severity': 'error',
            'title': 'Non-Positive Time Step',
            'what': f"Time step dt = {dt} must be strictly positive.",
            'why': "Time cannot stand still or run backward in forward initial value integration.",
            'consequence': "Simulation cannot progress.",
            'fix': ["Set dt to a positive value between 0.001 s and 0.02 s."]
        })

    expected_period = None
    if sim_type in ('simple_pendulum', 'compound_pendulum'):
        L = float(params.get('length', 1.0))
        g = float(params.get('gravity', 9.81))
        if L > 0 and g > 0:
            factor = 1.0 if sim_type == 'simple_pendulum' else np.sqrt(2.0 / 3.0)
            expected_period = 2.0 * np.pi * np.sqrt(L / g) * factor
    elif sim_type in ('slider_crank', 'four_bar'):
        rpm = float(params.get('crank_speed', 60.0))
        if rpm > 0:
            expected_period = 60.0 / rpm

    if expected_period is not None and expected_period > 0:
        if dt > expected_period / 20.0:
            checks.append({
                'id': 'universal.dt',
                'severity': 'warning',
                'title': 'Time Step is Coarse Relative to System Dynamics',
                'what': f"dt = {dt:.4f} s exceeds 1/20th of the dynamic period (T ~ {expected_period:.3f} s; recommended dt <= {expected_period / 20.0:.4f} s).",
                'why': "Coarse time-stepping introduces artificial numerical dissipation and truncation phase lag.",
                'consequence': "Energy conservation metrics will degrade and peak amplitude will be clipped.",
                'fix': [f"Reduce dt to {expected_period / 40.0:.4f} s or smaller."]
            })

        if t_max < 3.0 * expected_period:
            checks.append({
                'id': 'universal.t_max',
                'severity': 'warning',
                'title': 'Simulation Window is Too Short for Reliable Period Detection',
                'what': f"Total simulation time t_max = {t_max:.2f} s is less than 3 complete periods (3 T ~ {3.0 * expected_period:.2f} s).",
                'why': "Statistical zero-crossing interpolation and spectral FFT require multiple complete cycles to resolve frequency without aliasing.",
                'consequence': "Numerical period measurement will report unavailable ('—') or have high variance.",
                'fix': [f"Increase t_max to at least {3.5 * expected_period:.1f} s."]
            })


def _check_simple_pendulum(params, checks):
    L = float(params.get('length', 1.0))
    m = float(params.get('mass', 1.0))
    g = float(params.get('gravity', 9.81))
    b = float(params.get('damping', 0.0))
    th0_deg = float(params.get('theta0', 30.0))
    w0 = float(params.get('omega0', 0.0))
    suspension = params.get('suspension_type', 'rod')

    if L <= 0 or m <= 0 or g <= 0:
        checks.append({
            'id': 'pendulum.positivity',
            'severity': 'error',
            'title': 'Non-Positive Physical Dimension or Mass',
            'what': f"Length L={L}, mass m={m}, and gravity g={g} must all be strictly positive.",
            'why': "A pendulum with zero or negative length/mass cannot be constructed in Euclidean mechanics.",
            'consequence': "Natural frequency is imaginary or undefined.",
            'fix': ["Ensure length L >= 0.1 m, mass m >= 0.01 kg, and gravity g >= 0.1 m/s²."]
        })
        return

    if suspension == 'string' and abs(th0_deg) > 90.0:
        checks.append({
            'id': 'pendulum.string_suspension',
            'severity': 'error',
            'title': 'String Cannot Push in Upper Hemisphere',
            'what': f"Initial release angle θ₀ = {th0_deg:.1f}° exceeds 90° with a flexible string suspension.",
            'why': "A flexible string cannot sustain compressive axial loads (it cannot push).",
            'consequence': "The cord goes slack immediately, entering chaotic freefall rather than circular pendular motion.",
            'fix': ["Switch suspension to rigid rod, or limit string angle to |θ₀| <= 90°."]
        })

    th0_rad = np.radians(th0_deg)
    E0 = 0.5 * m * (L * w0)**2 + m * g * L * (1.0 - np.cos(th0_rad))
    E_crit = 2.0 * m * g * L
    if E0 >= E_crit:
        w_crit = np.sqrt(max(0.0, (E_crit - m * g * L * (1.0 - np.cos(th0_rad))) * 2.0 / (m * L**2)))
        checks.append({
            'id': 'pendulum.over_the_top',
            'severity': 'warning',
            'title': 'Pendulum Energy Exceeds Inversion Barrier (Over-the-Top)',
            'what': f"Initial mechanical energy E₀ = {E0:.2f} J exceeds the potential barrier for top-dead-center (2 m g L = {E_crit:.2f} J).",
            'why': "Kinetic and potential energy are sufficient to cross theta = 180°.",
            'consequence': "The pendulum continuously rotates full 360° revolutions rather than oscillating; elliptic libration period does not apply.",
            'fix': [
                f"Reduce initial angle theta0 below {np.degrees(np.arccos(max(-1.0, 1.0 - E_crit / (m*g*L)))):.1f}°",
                f"Reduce initial angular velocity omega0 below {w_crit:.2f} rad/s."
            ]
        })

    omega0 = np.sqrt(g / L)
    b_eff = b / (m * L**2)
    zeta = b_eff / (2.0 * omega0)

    if zeta >= 1.0:
        checks.append({
            'id': 'pendulum.overdamped',
            'severity': 'info',
            'title': 'System is Overdamped (Non-Oscillatory)',
            'what': f"Viscous damping ratio ζ = {zeta:.3f} >= 1.0.",
            'why': "Viscous damping completely suppresses harmonic oscillation.",
            'consequence': "Displacement decays asymptotically to vertical without zero-crossings. No period exists.",
            'fix': [f"To observe oscillations, reduce damping b below critical damping b_c = {2.0 * m * L**2 * omega0:.3f} N·m·s/rad."]
        })
    elif abs(zeta - 1.0) < 0.01:
        checks.append({
            'id': 'pendulum.critically_damped',
            'severity': 'info',
            'title': 'Critically Damped Transition Boundary',
            'what': f"Damping ratio ζ = {zeta:.3f} is within 1% of critical damping (ζ = 1.0).",
            'why': "System provides the fastest possible return to equilibrium without oscillatory overshoot.",
            'consequence': "Borderline oscillatory; exact periodic tracking is suppressed.",
            'fix': ["Slightly decrease damping if harmonic cycles are desired."]
        })


def _check_compound_pendulum(params, checks):
    L = float(params.get('length', 1.0))
    m = float(params.get('mass', 2.0))
    g = float(params.get('gravity', 9.81))
    b = float(params.get('damping', 0.0))
    d_pivot = float(params.get('pivot_distance', L / 2.0))

    if L <= 0 or m <= 0 or g <= 0:
        checks.append({
            'id': 'compound_pendulum.positivity',
            'severity': 'error',
            'title': 'Non-Positive Physical Parameters',
            'what': f"Beam length L={L}, mass m={m}, and gravity g={g} must be strictly positive.",
            'why': "Physical rigid body properties cannot be zero or negative.",
            'consequence': "Dynamics cannot be computed.",
            'fix': ["Ensure length L >= 0.1 m and mass m >= 0.01 kg."]
        })
        return

    if abs(d_pivot) < 1e-4:
        checks.append({
            'id': 'compound_pendulum.com_pivot',
            'severity': 'error',
            'title': 'Pivot Located at Center of Mass (Zero Restoring Torque)',
            'what': f"Pivot-to-CoM distance d = {d_pivot:.4f} m is essentially zero.",
            'why': "Gravitational force line of action passes through the pivot axis, producing zero restoring moment.",
            'consequence': "The rigid body has neutral equilibrium and will not oscillate under gravity.",
            'fix': ["Offset pivot axis away from Center of Mass by setting pivot_distance >= 0.05 m."]
        })
        return

    I_pivot = (1.0 / 3.0) * m * L**2
    omega0 = np.sqrt(m * g * d_pivot / I_pivot)
    zeta = b / (2.0 * I_pivot * omega0)

    if zeta >= 1.0:
        checks.append({
            'id': 'compound_pendulum.overdamped',
            'severity': 'info',
            'title': 'Compound Pendulum is Overdamped',
            'what': f"Damping ratio ζ = {zeta:.3f} >= 1.0.",
            'why': "Viscous pivot friction dissipates all kinetic energy before a cycle completes.",
            'consequence': "Body decays monotonically to rest with no zero crossings.",
            'fix': [f"Reduce pivot friction below {2.0 * I_pivot * omega0:.3f} N·m·s/rad."]
        })

def _check_slider_crank(params, checks):
    r = float(params.get('crank_length', 0.1))
    l = float(params.get('conn_length', 0.3))
    rpm = float(params.get('crank_speed', 60.0))
    e = float(params.get('offset', params.get('eccentricity', 0.0)))

    if r <= 0 or l <= 0:
        checks.append({
            'id': 'slider_crank.positivity',
            'severity': 'error',
            'title': 'Non-Positive Dimensions',
            'what': f"Crank radius r={r} m and rod length l={l} m must be strictly positive.",
            'why': "Geometric link lengths cannot be zero or negative.",
            'consequence': "Mechanism geometry is undefined.",
            'fix': ["Set crank length r >= 0.01 m and connecting rod length l >= 0.02 m."]
        })
        return

    if l <= r + abs(e):
        checks.append({
            'id': 'slider_crank.lockup',
            'severity': 'error',
            'title': 'Connecting Rod Too Short (Kinematic Lockup)',
            'what': f"Connecting rod length l={l:.3f} m is less than or equal to crank radius plus offset (r + |e| = {r + abs(e):.3f} m).",
            'why': "The connecting rod cannot span the distance between the crank pin and the slider axis at top dead center / dead centers.",
            'consequence': "Mechanism cannot rotate through 360°. It locks at the limit positions.",
            'fix': [
                f"Increase connecting rod length l to at least {1.5 * (r + abs(e)):.3f} m.",
                f"Reduce crank radius r below {l - abs(e):.3f} m."
            ]
        })
        return

    lam = r / l
    if lam > 0.45:
        checks.append({
            'id': 'slider_crank.high_obliquity',
            'severity': 'warning',
            'title': 'High Connecting Rod Obliquity Ratio (Severe Side-Thrust)',
            'what': f"Rod obliquity ratio λ = r/l = {lam:.3f} exceeds 0.45 (standard automotive range is 0.22 - 0.30).",
            'why': "Large rod angle φ creates high lateral force component against the cylinder wall (F_N = F_rod * sin φ).",
            'consequence': "Excessive cylinder wall and piston skirt wear, high frictional power losses, and potential piston slap.",
            'fix': [
                f"Increase rod length l to at least {r / 0.30:.3f} m to bring λ <= 0.30.",
                f"Reduce crank radius r to {0.30 * l:.3f} m."
            ]
        })

    if abs(rpm) > 3000:
        checks.append({
            'id': 'slider_crank.high_rpm',
            'severity': 'info',
            'title': 'High Reciprocating Inertia Acceleration',
            'what': f"Crank speed |N| = {abs(rpm):.0f} rpm.",
            'why': "Reciprocating acceleration scales with ω² (r + r²/l), producing large secondary shaking forces.",
            'consequence': "Substantial dynamic imbalance loads on main bearings and engine mounting frame.",
            'fix': ["Ensure crank counterweights are sized for dynamic balance or reduce operating RPM."]
        })


def _check_four_bar(params, checks):
    d = float(params.get('link_ground', 4.0))
    a = float(params.get('link_crank', 1.0))
    b = float(params.get('link_coupler', 2.5))
    c = float(params.get('link_rocker', 3.0))

    if d <= 0 or a <= 0 or b <= 0 or c <= 0:
        checks.append({
            'id': 'four_bar.positivity',
            'severity': 'error',
            'title': 'Non-Positive Link Lengths',
            'what': f"All link lengths (d={d}, a={a}, b={b}, c={c}) must be strictly positive.",
            'why': "Rigid bodies in planar linkage mechanics cannot have zero or negative dimension.",
            'consequence': "Kinematic loop closure is undefined.",
            'fix': ["Specify positive link lengths greater than 0.01 m."]
        })
        return

    lengths = [d, a, b, c]
    max_len = max(lengths)
    sum_others = sum(lengths) - max_len

    if max_len >= sum_others:
        checks.append({
            'id': 'four_bar.assembly_impossible',
            'severity': 'error',
            'title': 'Triangle Assembly Inequality Violated (Cannot Form Closed Loop)',
            'what': f"Longest link ({max_len:.3f} m) >= sum of remaining links ({sum_others:.3f} m).",
            'why': "In any planar quadrilateral, no single side can be longer than or equal to the sum of the other three sides.",
            'consequence': "The four links cannot be connected at the revolute joints in any planar configuration. The mechanism cannot assemble.",
            'fix': [
                f"Decrease the longest link below {sum_others:.3f} m.",
                f"Increase the shorter links so their sum exceeds {max_len:.3f} m."
            ]
        })
        return

    g_info = classify_grashof(d, a, b, c)
    s_plus_l = g_info.get('s_plus_l', g_info['S'] + g_info['L'])
    p_plus_q = g_info.get('p_plus_q', g_info['P'] + g_info['Q'])
    is_change_point = g_info.get('is_change_point', g_info.get('is_special', False))

    if not g_info['is_grashof']:
        reachable = compute_reachable_input_arc(d, a, b, c)
        arc_str = "limited arc"
        if reachable and not reachable.get("is_full_rotation", False):
            min_a = reachable.get('min_angle', reachable.get('min', 0.0))
            max_a = reachable.get('max_angle', reachable.get('max', 0.0))
            arc_str = f"[{np.degrees(min_a):.1f}°, {np.degrees(max_a):.1f}°]"
        checks.append({
            'id': 'four_bar.non_grashof',
            'severity': 'warning',
            'title': 'Non-Grashof Linkage (Triple-Rocker: No Continuous 360° Rotation)',
            'what': f"Grashof condition s + l <= p + q fails: s + l = {s_plus_l:.3f} > p + q = {p_plus_q:.3f}.",
            'why': "By Grashof's Theorem, if the sum of the shortest and longest links exceeds the sum of the remaining two, no link can rotate through 360° relative to any other link.",
            'consequence': f"All movable links rock back and forth within limited angular bounds (input crank reaches only {arc_str}). Driving the crank continuously will jam the mechanism.",
            'fix': [
                "Adjust link dimensions so s + l <= p + q if continuous 360° input rotation is required.",
                "Make the input crank the shortest link to obtain a Crank-Rocker."
            ]
        })
    elif is_change_point:
        checks.append({
            'id': 'four_bar.change_point',
            'severity': 'warning',
            'title': 'Change-Point Condition (s + l = p + q)',
            'what': f"Sum of shortest and longest links exactly equals sum of other two: s + l = p + q = {s_plus_l:.3f}.",
            'why': "All four links can become collinear simultaneously at toggle positions.",
            'consequence': "Degrees of freedom become indeterminate at toggle positions; mechanism can flip unexpectedly into folded or crossed configurations unless guided by springs or flywheel inertia.",
            'fix': ["Vary one link length slightly (by ~2-5%) to avoid exact change-point singularity."]
        })

    s0 = abs(d - a)
    s180 = d + a
    cos_mu1 = (b**2 + c**2 - s0**2) / (2.0 * b * c)
    cos_mu2 = (b**2 + c**2 - s180**2) / (2.0 * b * c)

    mu_angles = []
    for c_mu in (cos_mu1, cos_mu2):
        if -1.0 <= c_mu <= 1.0:
            ang = np.arccos(c_mu)
            mu_angles.append(ang)
            mu_angles.append(np.pi - ang)

    if mu_angles:
        min_mu_deg = np.degrees(min(mu_angles))
        if min_mu_deg < 40.0:
            checks.append({
                'id': 'four_bar.poor_transmission_angle',
                'severity': 'warning',
                'title': f'Sub-Optimal Transmission Angle (μ_min = {min_mu_deg:.1f}° < 40°)',
                'what': f"Minimum transmission angle μ_min is {min_mu_deg:.1f}° (recommended range is 40° - 140°, ideal ~90°).",
                'why': "Transmission angle μ between coupler and output rocker determines the mechanical advantage: torque τ_out ∝ sin(μ).",
                'consequence': "At acute angles, force transmission efficiency plummets, joint bearing forces spike drastically, and risk of toggle locking increases.",
                'fix': [
                    "Increase coupler length b or adjust ground distance d to expand the transmission angle envelope.",
                    "Ensure μ stays above 45° across the entire operational stroke."
                ]
            })

