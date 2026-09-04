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

def four_bar_kinematics(link_ground, link_crank, link_coupler, link_rocker,
                        crank_speed_rpm, dt, t_max):
    """
    Kinematic analysis of four-bar linkage using Freudenstein equations.
    Links: d=ground, a=crank, b=coupler, c=rocker

    Raises ValueError if the configuration is non-Grashof or singular
    (>5% of frames fail to converge).
    """
    d = link_ground
    a = link_crank
    b = link_coupler
    c = link_rocker
    omega2 = crank_speed_rpm * 2 * np.pi / 60.0

    # Freudenstein constants
    K1 = d / a
    K2 = d / c
    K3 = (a**2 - b**2 + c**2 + d**2) / (2 * a * c)

    n_steps = max(2, int(round(t_max / dt)) + 1)
    t = np.linspace(0, t_max, n_steps)
    theta2 = omega2 * t    # crank angle

    theta3_list = []   # coupler angle
    theta4_list = []   # rocker angle
    valid = []
    invalid_count = 0

    theta4_prev = None

    for i, th2 in enumerate(theta2):
        # Standard Freudenstein form:
        # (K1 - cos(th2))*cos(th4) - sin(th2)*sin(th4) = K2*cos(th2) - K3
        P = K1 - np.cos(th2)
        Q = -np.sin(th2)
        R = K2 * np.cos(th2) - K3

        # Half-angle substitution for th4: u = tan(th4/2)
        # => (R+P)*u^2 - 2*Q*u + (R-P) = 0
        A_quad = R + P
        B_quad = -2 * Q
        C_quad = R - P

        disc = B_quad**2 - 4 * A_quad * C_quad

        if disc < 0 or abs(A_quad) < 1e-12:
            invalid_count += 1
            valid.append(False)
            theta3_list.append(theta3_list[-1] if theta3_list else 0)
            theta4_list.append(theta4_list[-1] if theta4_list else 0)
            continue

        sqrt_disc = np.sqrt(disc)
        u1 = (-B_quad + sqrt_disc) / (2 * A_quad)
        u2 = (-B_quad - sqrt_disc) / (2 * A_quad)

        th4_1 = 2 * np.arctan(u1)
        th4_2 = 2 * np.arctan(u2)

        # Select the open circuit solution (closest to previous = same branch)
        if theta4_prev is None:
            th4 = th4_1
        else:
            if abs(th4_1 - theta4_prev) < abs(th4_2 - theta4_prev):
                th4 = th4_1
            else:
                th4 = th4_2

        theta4_prev = th4

        # Coupler angle from vector loop closure
        # x: a*cos(th2) + b*cos(th3) = d + c*cos(th4)
        # y: a*sin(th2) + b*sin(th3) = c*sin(th4)
        cx_ = d + c * np.cos(th4) - a * np.cos(th2)
        cy_ = c * np.sin(th4) - a * np.sin(th2)
        th3 = np.arctan2(cy_, cx_)

        theta3_list.append(th3)
        theta4_list.append(th4)
        valid.append(True)

    total_frames = len(theta2)
    valid_pct = (total_frames - invalid_count) / total_frames * 100

    if invalid_count / total_frames > 0.05:
        raise ValueError(
            f"Four-bar configuration is kinematically degenerate: "
            f"{invalid_count}/{total_frames} frames failed to solve "
            f"({100*invalid_count/total_frames:.1f}% stale). "
            f"Check Grashof condition and link length ratios."
        )

    theta3 = np.array(theta3_list)
    theta4 = np.array(theta4_list)

    # Angular velocities (numerical differentiation)
    omega3 = np.gradient(theta3, t)
    omega4 = np.gradient(theta4, t)
    alpha3 = np.gradient(omega3, t)
    alpha4 = np.gradient(omega4, t)

    # Coupler point (midpoint of coupler link)
    coupler_x = a * np.cos(theta2) + (b/2) * np.cos(theta3)
    coupler_y = a * np.sin(theta2) + (b/2) * np.sin(theta3)

    # Joint coordinates for frontend rendering
    bx = a * np.cos(theta2)
    by = a * np.sin(theta2)
    cx_joint = d + c * np.cos(theta4)
    cy_joint = c * np.sin(theta4)

    return {
        "time": t.tolist(),
        "crank_angle_deg": np.degrees(theta2 % (2*np.pi)).tolist(),
        "coupler_angle_deg": np.degrees(theta3).tolist(),
        "rocker_angle_deg": np.degrees(theta4).tolist(),
        "omega3": omega3.tolist(),
        "omega4": omega4.tolist(),
        "alpha3": alpha3.tolist(),
        "alpha4": alpha4.tolist(),
        "coupler_x": coupler_x.tolist(),
        "coupler_y": coupler_y.tolist(),
        "bx": bx.tolist(),
        "by": by.tolist(),
        "cx": cx_joint.tolist(),
        "cy": cy_joint.tolist(),
        "rocker_range_deg": float(np.degrees(np.max(theta4) - np.min(theta4))),
        "valid_frame_pct": round(valid_pct, 1),
        "sim_type": "four_bar"
    }
