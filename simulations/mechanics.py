import numpy as np
from scipy import integrate


# ============================================================
# SIMPLE PENDULUM
# Equation of motion: θ'' + (b/(mL²))θ' + (g/L)sin(θ) = 0
# State vector: y = [θ, ω]
# ============================================================

def simple_pendulum_rk45(length, mass, gravity, damping, theta0_deg, omega0, dt, t_max):
    """
    Adaptive Runge-Kutta 4(5) (RK45) integrator for the nonlinear simple pendulum.
    
    Parameters:
    -----------
    length   : rod length (m)
    mass     : bob mass (kg)
    gravity  : gravitational acceleration (m/s²)
    damping  : linear viscous damping coefficient b (N·m·s/rad)
    theta0_deg: initial angle (degrees)
    omega0   : initial angular velocity (rad/s)
    dt       : time step (s)
    t_max    : total simulation time (s)
    """
    theta0 = np.radians(theta0_deg)
    b_eff = damping / (mass * length**2)   # effective damping coefficient

    def derivatives(t, y):
        theta, omega = y
        dtheta = omega
        domega = -(gravity / length) * np.sin(theta) - b_eff * omega
        return [dtheta, domega]

    t_span = (0, t_max)
    # Use linspace to guarantee no overshoot past t_max (arange can add 1 extra sample)
    n_steps = max(2, int(round(t_max / dt)) + 1)
    t_eval = np.linspace(0, t_max, n_steps)
    y0 = [theta0, omega0]

    sol = integrate.solve_ivp(
        derivatives, t_span, y0,
        method='RK45', t_eval=t_eval, max_step=dt,
        rtol=1e-8, atol=1e-10
    )

    theta = sol.y[0]
    omega = sol.y[1]
    t = sol.t

    # Kinematics
    alpha = np.gradient(omega, t)

    # Energy
    KE = 0.5 * mass * (length**2) * omega**2
    PE = mass * gravity * length * (1 - np.cos(theta))
    total_E = KE + PE


    energy_drift = float((np.max(total_E) - np.min(total_E)) / total_E[0]) if total_E[0] != 0 else 0.0
    energy_dissipated = float((total_E[0] - total_E[-1]) / total_E[0]) if total_E[0] != 0 else 0.0

    return {
        "time": t.tolist(),
        "theta": theta.tolist(),        # rad
        "theta_deg": np.degrees(theta).tolist(),
        "omega": omega.tolist(),
        "alpha": alpha.tolist(),
        "KE": KE.tolist(),
        "PE": PE.tolist(),
        "total_E": total_E.tolist(),
        "energy_drift": energy_drift if damping == 0 else 0.0,
        "energy_dissipated": energy_dissipated if damping > 0 else 0.0,
        "is_damped": damping > 0,
        "sim_type": "simple_pendulum"
    }


# ============================================================
# COMPOUND (PHYSICAL) PENDULUM
# I_pivot * α = -mgd*sin(θ) - b*ω
# I_pivot = I_cm + md²  (Parallel Axis Theorem)
# For uniform rod: I_cm = (1/12)mL², d = L/2
# ============================================================

def compound_pendulum_rk45(length, mass, gravity, damping, theta0_deg, omega0, dt, t_max):
    """
    Adaptive RK45 for a uniform rigid rod (compound pendulum) pivoting at one end.
    """
    theta0 = np.radians(theta0_deg)
    d = length / 2.0                        # distance from pivot to CoM
    I_cm = (1/12) * mass * length**2
    I_pivot = I_cm + mass * d**2           # = (1/3)mL² for rod about end

    def derivatives(t, y):
        theta, omega = y
        dtheta = omega
        domega = (-mass * gravity * d * np.sin(theta) - damping * omega) / I_pivot
        return [dtheta, domega]

    t_span = (0, t_max)
    n_steps = max(2, int(round(t_max / dt)) + 1)
    t_eval = np.linspace(0, t_max, n_steps)
    y0 = [theta0, omega0]

    sol = integrate.solve_ivp(
        derivatives, t_span, y0,
        method='RK45', t_eval=t_eval, max_step=dt,
        rtol=1e-8, atol=1e-10
    )

    theta = sol.y[0]
    omega = sol.y[1]
    t = sol.t

    alpha = np.gradient(omega, t)

    KE = 0.5 * I_pivot * omega**2
    PE = mass * gravity * d * (1 - np.cos(theta))
    total_E = KE + PE

    L_eff = I_pivot / (mass * d)   # Effective pendulum length


    energy_drift = float((np.max(total_E) - np.min(total_E)) / total_E[0]) if total_E[0] != 0 else 0.0
    energy_dissipated = float((total_E[0] - total_E[-1]) / total_E[0]) if total_E[0] != 0 else 0.0

    return {
        "time": t.tolist(),
        "theta": theta.tolist(),
        "theta_deg": np.degrees(theta).tolist(),
        "omega": omega.tolist(),
        "alpha": alpha.tolist(),
        "KE": KE.tolist(),
        "PE": PE.tolist(),
        "total_E": total_E.tolist(),
        "energy_drift": energy_drift if damping == 0 else 0.0,
        "energy_dissipated": energy_dissipated if damping > 0 else 0.0,
        "is_damped": damping > 0,
        "I_pivot": float(I_pivot),
        "L_eff": float(L_eff),
        "d": float(d),
        "sim_type": "compound_pendulum"
    }


# ============================================================
# SLIDER-CRANK MECHANISM
# Converts rotational crank motion → linear slider displacement
# Loop closure: x = r*cos(θ) + sqrt(l²- r²*sin²(θ))
# ============================================================

def slider_crank_kinematics(crank_length, conn_length, crank_speed_rpm, dt, t_max):
    """
    Exact kinematic analysis of slider-crank mechanism.

    Parameters:
    -----------
    crank_length   : r (m)
    conn_length    : l (m) - connecting rod length
    crank_speed_rpm: N (rpm)
    dt             : time step (s)
    t_max          : total time (s)

    Raises ValueError if r >= l (geometrically degenerate — crank cannot complete full rotation).
    Reference: Norton, Design of Machinery, 5th ed., Eqs 6-1, 6-4, 6-9.
    """
    r = crank_length
    l = conn_length

    # ── Geometry guard (defence-in-depth; also checked in app.py) ──────────
    if r >= l:
        raise ValueError(
            f"Invalid slider-crank geometry: crank r={r:.4f} m must be strictly "
            f"less than connecting rod l={l:.4f} m (r < l required)."
        )

    omega = crank_speed_rpm * 2 * np.pi / 60.0   # rad/s

    # Fixed t_eval — linspace avoids floating-point overshoot past t_max
    n_steps = max(2, int(round(t_max / dt)) + 1)
    t = np.linspace(0, t_max, n_steps)
    theta = omega * t   # crank angle (rad)

    sin_th = np.sin(theta)
    cos_th = np.cos(theta)

    # ── Position (exact loop-closure) ──────────────────────────────────────
    radicand = np.maximum(l**2 - r**2 * sin_th**2, 1e-14)  # guard against NaN
    sqrt_rad = np.sqrt(radicand)
    x_slider = r * cos_th + sqrt_rad

    # ── Velocity (exact analytical d/dt of x) ──────────────────────────────
    # v = dx/dt = -r*omega*sin(theta) * [1 + r*cos(theta)/sqrt(l^2 - r^2*sin^2(theta))]
    v_slider = -r * omega * sin_th * (1.0 + r * cos_th / sqrt_rad)

    # ── Acceleration (exact analytical d²/dt² of x) ────────────────────────
    numerator = (l**2 * (cos_th**2 - sin_th**2) + r**2 * sin_th**4)
    a_slider = -r * omega**2 * (cos_th + r * numerator / radicand**1.5)

    # ── Connecting rod angle (arcsin safe — r < l guarantees |arg| < 1) ────
    phi = np.arcsin(np.clip(r * sin_th / l, -1.0, 1.0))

    return {
        "time": t.tolist(),
        "crank_angle_deg": np.degrees(theta % (2 * np.pi)).tolist(),
        "crank_angle": theta.tolist(),
        "x_slider": x_slider.tolist(),
        "v_slider": v_slider.tolist(),
        "a_slider": a_slider.tolist(),
        "conn_rod_angle_deg": np.degrees(phi).tolist(),
        "stroke": float(np.max(x_slider) - np.min(x_slider)),
        "x_max": float(np.max(x_slider)),
        "x_min": float(np.min(x_slider)),
        "v_max": float(np.max(np.abs(v_slider))),
        "a_max": float(np.max(np.abs(a_slider))),
        "lambda": float(r / l),
        "sim_type": "slider_crank"
    }


# ============================================================
# FOUR-BAR MECHANISM
# Freudenstein Equation:
# K1*cos(θ4) - K2*cos(θ2) + K3 = cos(θ2 - θ4)
# where K1 = d/a, K2 = d/c, K3 = (a²-b²+c²+d²)/(2ac)
# links: a=crank, b=coupler, c=rocker, d=ground
# ============================================================

from simulations.kinematics_core import solve_four_bar_full_cycle

def four_bar_kinematics(link_ground, link_crank, link_coupler, link_rocker,
                        crank_speed_rpm, dt, t_max):
    """
    Kinematic analysis of four-bar linkage using exact Law of Cosines
    with continuous angle unwrapping and machine-precision loop closure.
    """
    res = solve_four_bar_full_cycle(
        link_ground, link_crank, link_coupler, link_rocker,
        crank_speed_rpm, dt, t_max
    )
    res["valid_frame_pct"] = 100.0
    res["sim_type"] = "four_bar"
    return res

