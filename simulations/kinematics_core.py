"""
============================================================================
UNIFIED KINEMATICS & DYNAMICS CORE (PYTHON)
Module: simulations/kinematics_core.py
============================================================================

Single Python source of truth for:
  1. Planar Four-Bar Linkage Kinematics (Law of Cosines formulation)
     - Machine precision loop closure: ||B - C|| == b (< 1e-12 m)
     - Continuous branch tracking across continuous 360-deg crank rotation
     - Acute transmission angle mu = |theta4 - theta3|
     - Continuous angle unwrapping to prevent numerical gradient spikes
  2. Planar Slider-Crank Kinematics
     - Exact analytical loop closure and derivatives
  3. Simple & Compound Pendulum Benchmarks
     - Exact complete elliptic integral of the first kind K(k)
     - Unbiased period extraction from zero-crossings
"""

import numpy as np
from scipy.special import ellipk


# ============================================================================
# 1. PENDULUM EXACT ANALYTICAL BENCHMARKS
# ============================================================================

def exact_simple_pendulum_period(L, g, theta0_rad):
    """
    Computes exact nonlinear period T = 4 * sqrt(L/g) * K(sin^2(theta0/2)).
    """
    if L <= 0 or g <= 0:
        return 0.0
    k = np.sin(abs(theta0_rad) / 2.0)
    m = k * k
    return float(4.0 * np.sqrt(L / g) * ellipk(m))


def exact_compound_pendulum_period(L, g, theta0_rad):
    """
    Computes exact nonlinear period for uniform rod pivoted at end:
    L_eff = (2/3) * L
    """
    if L <= 0 or g <= 0:
        return 0.0
    L_eff = (2.0 / 3.0) * L
    k = np.sin(abs(theta0_rad) / 2.0)
    m = k * k
    return float(4.0 * np.sqrt(L_eff / g) * ellipk(m))


def measure_numerical_period(time_arr, theta_arr):
    """
    Calculates numerical period via sub-step linear zero-crossing interpolation.
    Returns None if fewer than 2 complete periods are found.
    """
    time = np.asarray(time_arr)
    theta = np.asarray(theta_arr)
    if len(time) < 10 or len(theta) < 10:
        return None

    crossings = []
    for i in range(len(theta) - 1):
        if theta[i] <= 0 and theta[i + 1] > 0:
            frac = -theta[i] / (theta[i + 1] - theta[i])
            crossings.append(time[i] + frac * (time[i + 1] - time[i]))

    if len(crossings) < 2:
        return None

    periods = np.diff(crossings)
    return float(np.mean(periods))


# ============================================================================
# 2. SLIDER-CRANK KINEMATICS
# ============================================================================

def solve_slider_crank(r, l, theta, omega=0.0, alpha=0.0, offset=0.0):
    """
    Exact analytical slider-crank kinematics.
    """
    sin_th = np.sin(theta)
    cos_th = np.cos(theta)

    bx = r * cos_th
    by = r * sin_th
    dy = by - offset

    rad = l * l - dy * dy
    if rad < 0:
        return {
            "success": False,
            "error": f"Slider-crank lockup: |r*sin(th) - offset| ({abs(dy):.3f}m) exceeds rod length ({l:.3f}m)",
            "x": 0.0, "v": 0.0, "a": 0.0, "phi": 0.0
        }

    sqrt_rad = np.sqrt(rad)
    x = bx + sqrt_rad
    phi = np.arcsin(-dy / l)

    v = -r * omega * sin_th - (dy * r * omega * cos_th) / sqrt_rad

    ddy = r * omega * cos_th
    term1 = -r * alpha * sin_th - r * omega * omega * cos_th
    num = dy * (r * alpha * cos_th - r * omega * omega * sin_th) + ddy * (r * omega * cos_th)
    d_sqrt_rad = -dy * ddy / sqrt_rad
    term2 = (num * sqrt_rad - (dy * r * omega * cos_th) * d_sqrt_rad) / rad
    a = term1 - term2

    return {
        "success": True,
        "x": float(x),
        "v": float(v),
        "a": float(a),
        "phi": float(phi),
        "B": (float(bx), float(by)),
        "C": (float(x), float(offset))
    }


# ============================================================================
# 3. FOUR-BAR LINKAGE (LAW OF COSINES)
# ============================================================================

def classify_grashof(d, a, b, c):
    """
    Evaluates Grashof criteria and returns structured condition conforming to:
    {
      "classification": "grashof" | "non_grashof" | "change_point",
      "subtype": "crank_rocker" | "double_crank" | "double_rocker" | "triple_rocker" | "deltoid" | "parallelogram",
      "grashof_sum": s + l,
      "other_sum": p + q,
      "slack": (p + q) - (s + l),
      "shortest_link": "a" | "b" | "c" | "d",
      "continuous_rotation_possible": bool
    }
    """
    link_map = {"d": d, "a": a, "b": b, "c": c}
    links = [
        {"name": "ground", "symbol": "d", "len": d},
        {"name": "crank", "symbol": "a", "len": a},
        {"name": "coupler", "symbol": "b", "len": b},
        {"name": "rocker", "symbol": "c", "len": c}
    ]
    links.sort(key=lambda x: x["len"])
    S = links[0]["len"]
    L = links[3]["len"]
    P = links[1]["len"]
    Q = links[2]["len"]

    SL = S + L
    PQ = P + Q
    diff = SL - PQ
    shortest = links[0]["name"]
    shortest_symbol = links[0]["symbol"]

    # Check for parallelogram or deltoid if change-point
    is_parallelogram = (abs(d - b) < 1e-9 and abs(a - c) < 1e-9)
    is_deltoid = (abs(d - a) < 1e-9 and abs(b - c) < 1e-9) or (abs(d - c) < 1e-9 and abs(a - b) < 1e-9)

    if abs(diff) < 1e-9:
        classification = "change_point"
        if is_parallelogram:
            subtype = "parallelogram"
        elif is_deltoid:
            subtype = "deltoid"
        else:
            subtype = "crank_rocker"
        return {
            "classification": classification,
            "subtype": subtype,
            "grashof_sum": float(SL),
            "other_sum": float(PQ),
            "slack": float(PQ - SL),
            "shortest_link": shortest_symbol,
            "continuous_rotation_possible": True,
            "is_grashof": True,
            "is_special": True,
            "type": "Special Grashof (Change Point)",
            "S": S, "L": L, "P": P, "Q": Q, "shortest": shortest,
            "description": "S + L = P + Q. Possesses change-point configurations with potential toggle bifurcation."
        }

    if diff < 0:
        classification = "grashof"
        if shortest == "crank":
            ctype = "Grashof Crank-Rocker"
            subtype = "crank_rocker"
        elif shortest == "ground":
            ctype = "Grashof Double-Crank (Drag Link)"
            subtype = "double_crank"
        elif shortest == "coupler":
            ctype = "Grashof Double-Rocker"
            subtype = "double_rocker"
        else:
            ctype = "Grashof Double-Rocker"
            subtype = "double_rocker"
        return {
            "classification": classification,
            "subtype": subtype,
            "grashof_sum": float(SL),
            "other_sum": float(PQ),
            "slack": float(PQ - SL),
            "shortest_link": shortest_symbol,
            "continuous_rotation_possible": True,
            "is_grashof": True,
            "is_special": False,
            "type": ctype,
            "S": S, "L": L, "P": P, "Q": Q, "shortest": shortest,
            "description": f"S + L < P + Q ({shortest} is shortest link)."
        }

    return {
        "classification": "non_grashof",
        "subtype": "triple_rocker",
        "grashof_sum": float(SL),
        "other_sum": float(PQ),
        "slack": float(PQ - SL),
        "shortest_link": shortest_symbol,
        "continuous_rotation_possible": False,
        "is_grashof": False,
        "is_special": False,
        "type": "Non-Grashof Double-Rocker (Triple Rocker)",
        "S": S, "L": L, "P": P, "Q": Q, "shortest": shortest,
        "description": "S + L > P + Q. No link can perform a full continuous revolution."
    }


def theoretical_four_bar_rocker_range(d, a, b, c):
    """
    Exact theoretical rocker angular range (degrees) for crank-rocker linkage
    using collinear extreme position triangles: cos(psi) = (d^2 + c^2 - (b -/+ a)^2) / (2*d*c).
    Returns None if the crank cannot rotate 360 deg.
    """
    g = classify_grashof(d, a, b, c)
    if not g["is_grashof"] or (d + a > b + c + 1e-7) or (abs(d - a) < abs(b - c) - 1e-7):
        return None
    cos_psi1 = (d**2 + c**2 - (b - a)**2) / (2.0 * d * c)
    cos_psi2 = (d**2 + c**2 - (b + a)**2) / (2.0 * d * c)
    if abs(cos_psi1) > 1.000001 or abs(cos_psi2) > 1.000001:
        return None
    psi1 = np.arccos(np.clip(cos_psi1, -1.0, 1.0))
    psi2 = np.arccos(np.clip(cos_psi2, -1.0, 1.0))
    return float(np.degrees(abs(psi2 - psi1)))


def compute_reachable_input_arc(d, a, b, c):
    """
    Computes reachable crank angle bounds [theta2_min, theta2_max] in radians.
    """
    c1 = (d**2 + a**2 - (b + c)**2) / (2.0 * a * d)
    c2 = (d**2 + a**2 - (b - c)**2) / (2.0 * a * d)

    if c1 <= -1.0 and c2 >= 1.0:
        return {"is_full_rotation": True, "min_angle": -np.pi, "max_angle": np.pi}

    min_cos = max(-1.0, c1)
    max_cos = min(1.0, c2)

    if min_cos > max_cos:
        return {"is_full_rotation": False, "min_angle": 0.0, "max_angle": 0.0, "impossible": True}

    max_angle = float(np.arccos(min_cos))
    min_angle = -max_angle
    return {"is_full_rotation": False, "min_angle": min_angle, "max_angle": max_angle}


def normalize_angle(rad):
    return (rad + np.pi) % (2 * np.pi) - np.pi


def solve_four_bar_position(d, a, b, c, theta2, prev_theta4=None, branch_mode=-1):
    """
    Solves planar four-bar vector loop closure using the Law of Cosines.
    Guarantees exact loop closure constraint: ||B - C|| == b and ||D - C|| == c.
    """
    bx = a * np.cos(theta2)
    by = a * np.sin(theta2)

    BDx = d - bx
    BDy = -by
    s2 = BDx * BDx + BDy * BDy
    s = np.sqrt(s2)

    if s > (b + c) + 1e-9 or s < abs(b - c) - 1e-9:
        return {
            "success": False,
            "error": f"Assembly constraint violated: diagonal BD ({s:.3f}m) outside reach [{abs(b-c):.3f}m, {(b+c):.3f}m]",
            "B": (bx, by), "C": (d, 0.0),
            "theta3": 0.0, "theta4": 0.0,
            "transmission_angle_deg": 0.0,
            "loop_error": float(max(0, s - (b + c), abs(b - c) - s))
        }

    psi_BD = np.arctan2(BDy, BDx)

    cos_alpha = np.clip((b * b + s2 - c * c) / (2.0 * b * s), -1.0, 1.0)
    cos_gamma = np.clip((c * c + s2 - b * b) / (2.0 * c * s), -1.0, 1.0)

    alpha = np.arccos(cos_alpha)
    gamma = np.arccos(cos_gamma)

    # Candidate solutions
    th3_open = psi_BD + alpha
    th3_cross = psi_BD - alpha

    C_open_x = bx + b * np.cos(th3_open)
    C_open_y = by + b * np.sin(th3_open)
    th4_open = np.arctan2(C_open_y, C_open_x - d)

    C_cross_x = bx + b * np.cos(th3_cross)
    C_cross_y = by + b * np.sin(th3_cross)
    th4_cross = np.arctan2(C_cross_y, C_cross_x - d)

    chosen_th3 = th3_open
    chosen_th4 = th4_open
    chosen_C = (C_open_x, C_open_y)

    if prev_theta4 is not None:
        diff_open = abs(normalize_angle(th4_open - prev_theta4))
        diff_cross = abs(normalize_angle(th4_cross - prev_theta4))
        if diff_cross < diff_open:
            chosen_th3 = th3_cross
            chosen_th4 = th4_cross
            chosen_C = (C_cross_x, C_cross_y)
        # Continuous phase unwrapping
        chosen_th4 = chosen_th4 + 2.0 * np.pi * np.round((prev_theta4 - chosen_th4) / (2.0 * np.pi))
    elif branch_mode > 0:
        chosen_th3 = th3_cross
        chosen_th4 = th4_cross
        chosen_C = (C_cross_x, C_cross_y)

    # Acute transmission angle
    mu = abs(chosen_th4 - chosen_th3) % (2 * np.pi)
    if mu > np.pi:
        mu = 2 * np.pi - mu
    acute_mu_deg = float(np.degrees(min(mu, np.pi - mu)))

    # Real measured error
    measured_b = np.hypot(chosen_C[0] - bx, chosen_C[1] - by)
    measured_c = np.hypot(chosen_C[0] - d, chosen_C[1])
    loop_error = float(abs(measured_b - b) + abs(measured_c - c))

    return {
        "success": True,
        "B": (float(bx), float(by)),
        "C": (float(chosen_C[0]), float(chosen_C[1])),
        "D": (float(d), 0.0),
        "A": (0.0, 0.0),
        "theta2": float(theta2),
        "theta3": float(chosen_th3),
        "theta4": float(chosen_th4),
        "transmission_angle_deg": acute_mu_deg,
        "loop_error": loop_error
    }


def solve_four_bar_velocity_and_acceleration(d, a, b, c, theta2, theta3, theta4, omega2, alpha2=0.0):
    """
    Computes analytical angular velocities (omega3, omega4) and angular accelerations (alpha3, alpha4)
    for planar four-bar mechanism via vector loop differentiation.
    """
    sin_34 = np.sin(theta3 - theta4)
    if abs(sin_34) < 1e-9:
        return {
            "success": False,
            "error": "Toggle / dead-center singular configuration (theta3 == theta4).",
            "omega3": 0.0, "omega4": 0.0, "alpha3": 0.0, "alpha4": 0.0
        }

    # Angular velocities
    omega3 = (a * omega2 * np.sin(theta4 - theta2)) / (b * np.sin(theta3 - theta4))
    omega4 = (a * omega2 * np.sin(theta3 - theta2)) / (c * np.sin(theta3 - theta4))

    # Angular accelerations via exact differentiated loop equations
    rhs1 = (a * alpha2 * np.sin(theta2) + a * (omega2**2) * np.cos(theta2) +
            b * (omega3**2) * np.cos(theta3) - c * (omega4**2) * np.cos(theta4))
    rhs2 = (-a * alpha2 * np.cos(theta2) + a * (omega2**2) * np.sin(theta2) +
            b * (omega3**2) * np.sin(theta3) - c * (omega4**2) * np.sin(theta4))

    det = b * c * np.sin(theta3 - theta4)
    alpha3 = (rhs1 * (-c * np.cos(theta4)) - rhs2 * (c * np.sin(theta4))) / det
    alpha4 = ((-b * np.sin(theta3)) * rhs2 - (b * np.cos(theta3)) * rhs1) / det

    return {
        "success": True,
        "omega3": float(omega3),
        "omega4": float(omega4),
        "alpha3": float(alpha3),
        "alpha4": float(alpha4)
    }


def solve_four_bar_full_cycle(d, a, b, c, crank_speed_rpm, dt, t_max):
    """
    Full-cycle kinematic simulation of planar four-bar with continuous angle unwrapping
    and exact analytical velocity and acceleration evaluation.
    """
    omega2 = crank_speed_rpm * 2.0 * np.pi / 60.0
    n_steps = max(2, int(round(t_max / dt)) + 1)
    t = np.linspace(0, t_max, n_steps)
    theta2 = omega2 * t

    theta3_list = []
    theta4_list = []
    bx_list = []
    by_list = []
    cx_list = []
    cy_list = []
    mu_list = []
    omega3_list = []
    omega4_list = []
    alpha3_list = []
    alpha4_list = []
    max_loop_error = 0.0

    prev_th4 = None
    for th2 in theta2:
        sol = solve_four_bar_position(d, a, b, c, th2, prev_theta4=prev_th4)
        if not sol["success"]:
            raise ValueError(f"Kinematic constraint violation at theta2={np.degrees(th2):.1f} deg: {sol['error']}")
        prev_th4 = sol["theta4"]
        theta3_list.append(sol["theta3"])
        theta4_list.append(sol["theta4"])
        bx_list.append(sol["B"][0])
        by_list.append(sol["B"][1])
        cx_list.append(sol["C"][0])
        cy_list.append(sol["C"][1])
        mu_list.append(sol["transmission_angle_deg"])
        if sol["loop_error"] > max_loop_error:
            max_loop_error = sol["loop_error"]

        vel_sol = solve_four_bar_velocity_and_acceleration(
            d, a, b, c, th2, sol["theta3"], sol["theta4"], omega2
        )
        if vel_sol["success"]:
            omega3_list.append(vel_sol["omega3"])
            omega4_list.append(vel_sol["omega4"])
            alpha3_list.append(vel_sol["alpha3"])
            alpha4_list.append(vel_sol["alpha4"])
        else:
            omega3_list.append(0.0)
            omega4_list.append(0.0)
            alpha3_list.append(0.0)
            alpha4_list.append(0.0)

    # Continuous angle unwrapping to eliminate 2pi wrapping jumps
    th3_unwrapped = np.unwrap(theta3_list)
    th4_unwrapped = np.unwrap(theta4_list)

    rocker_range_deg = float(np.degrees(np.max(th4_unwrapped) - np.min(th4_unwrapped)))

    return {
        "time": t.tolist(),
        "crank_angle_deg": np.degrees(theta2 % (2 * np.pi)).tolist(),
        "coupler_angle_deg": np.degrees(th3_unwrapped).tolist(),
        "rocker_angle_deg": np.degrees(th4_unwrapped).tolist(),
        "omega3": omega3_list,
        "omega4": omega4_list,
        "alpha3": alpha3_list,
        "alpha4": alpha4_list,
        "bx": bx_list,
        "by": by_list,
        "cx": cx_list,
        "cy": cy_list,
        "coupler_x": [(bx + cx) / 2.0 for bx, cx in zip(bx_list, cx_list)],
        "coupler_y": [(by + cy) / 2.0 for by, cy in zip(by_list, cy_list)],
        "transmission_angle_deg": mu_list,
        "rocker_range_deg": rocker_range_deg,
        "max_loop_error": max_loop_error
    }
