import numpy as np
from scipy import special

# ============================================================
# ANALYTICAL / THEORETICAL SOLUTIONS
# Reference: Beléndez et al. (2007), Lima & Arun (2006),
#            Norton "Design of Machinery" 5th ed.,
#            Erdman, Sandor & Kota "Mechanism Design" 5th ed.
# ============================================================


# ---- SIMPLE PENDULUM ----------------------------------------

def simple_pendulum_small_angle_period(length, gravity):
    """T0 = 2pi*sqrt(L/g) -- linearized (small-angle approximation)"""
    return 2 * np.pi * np.sqrt(length / gravity)


def simple_pendulum_elliptic_period(length, gravity, theta0_deg):
    """
    Exact period via complete elliptic integral of the first kind:
    T = 4*sqrt(L/g) * K(sin(theta0/2))
    Reference: Beléndez et al., Eur. J. Phys. 28 (2007) 901-905
    """
    theta0 = np.radians(theta0_deg)
    k = np.sin(theta0 / 2)
    K_k = special.ellipk(k**2)
    return 4 * np.sqrt(length / gravity) * K_k


def simple_pendulum_series_period(length, gravity, theta0_deg):
    """
    Series expansion (Kidd & Fogg approximation):
    T approx T0 * (1 + theta0^2/16 + 11*theta0^4/3072 + ...)
    """
    T0 = simple_pendulum_small_angle_period(length, gravity)
    theta0 = np.radians(theta0_deg)
    correction = (1
                  + (1/16) * theta0**2
                  + (11/3072) * theta0**4
                  + (173/737280) * theta0**6)
    return T0 * correction


def simple_pendulum_damped_period(length, gravity, damping, mass):
    """
    Damped natural period: Td = 2pi / omega_d
    omega_d = sqrt(omega0^2 - zeta^2) where omega0 = sqrt(g/L)
    b_eff = b / (m*L^2),  zeta = b_eff / (2*omega0)
    Reference: Thomson & Dahleh, Theory of Vibration (1998) Eq. 2-4
    Returns (Td, zeta) or (None, zeta) if overdamped.
    """
    omega0 = np.sqrt(gravity / length)
    b_eff = damping / (mass * length**2)
    zeta = b_eff / (2 * omega0)
    if zeta >= 1.0:
        return None, zeta
    omega_d = omega0 * np.sqrt(1 - zeta**2)
    return 2 * np.pi / omega_d, zeta


def compound_pendulum_damped_period(length, gravity, damping, mass):
    """
    Damped period for compound pendulum (uniform rod).
    I_pivot = (1/3)mL^2, d = L/2
    omega0 = sqrt(mgd / I_pivot) = sqrt(3g/2L)
    zeta = b / (2 * I_pivot * omega0)
    """
    d = length / 2.0
    I_pivot = (1.0/3.0) * mass * length**2
    omega0 = np.sqrt(mass * gravity * d / I_pivot)
    zeta = damping / (2 * I_pivot * omega0)
    if zeta >= 1.0:
        return None, zeta
    omega_d = omega0 * np.sqrt(1 - zeta**2)
    return 2 * np.pi / omega_d, zeta


def measure_numerical_period(time_array, theta_array):
    """Detect period from zero-crossings of theta (with positive slope)."""
    t = np.array(time_array)
    th = np.array(theta_array)
    crossings = []
    for i in range(1, len(th)):
        if th[i-1] <= 0 < th[i]:
            t_cross = t[i-1] + (0 - th[i-1]) * (t[i] - t[i-1]) / (th[i] - th[i-1])
            crossings.append(t_cross)
    if len(crossings) >= 3:
        periods = np.diff(crossings)
        return float(np.mean(periods[1:]))
    elif len(crossings) >= 2:
        return float(crossings[-1] - crossings[0])
    return None


# ---- COMPOUND PENDULUM ----------------------------------------

def compound_pendulum_period(length, gravity):
    """
    Period for uniform rod pivoting at end:
    T = 2pi*sqrt(2L/3g)  [L_eff = 2L/3]
    """
    L_eff = 2 * length / 3
    return 2 * np.pi * np.sqrt(L_eff / gravity)


def compound_pendulum_effective_length(length):
    """L_eff = I_pivot / (m*d) = (1/3 mL^2) / (m * L/2) = 2L/3"""
    return 2 * length / 3


# ---- SLIDER-CRANK ----------------------------------------

def slider_crank_stroke(crank_length, conn_length):
    """
    Exact stroke = 2r for inline slider-crank (exact, independent of lambda).
    Reference: Norton D.O.M. 5th ed. Eq. 6-1
    """
    return 2 * crank_length


def slider_crank_max_velocity(crank_length, conn_length, crank_speed_rpm):
    """
    Numerically exact maximum piston velocity.
    v = -r*omega*[sin(theta) + r*sin(theta)*cos(theta)/sqrt(l^2-r^2*sin^2(theta))]
    Sweeps full cycle at 0.1 degree resolution.
    Reference: Norton D.O.M. 5th ed. Eq. 6-4
    """
    r = crank_length
    l = conn_length
    omega = crank_speed_rpm * 2 * np.pi / 60
    theta = np.linspace(0, 2 * np.pi, 3600)
    sin_th = np.sin(theta)
    cos_th = np.cos(theta)
    radicand = np.maximum(l**2 - r**2 * sin_th**2, 1e-12)
    v = -r * omega * sin_th * (1 + r * cos_th / np.sqrt(radicand))
    return float(np.max(np.abs(v)))


def slider_crank_max_acceleration(crank_length, conn_length, crank_speed_rpm):
    """
    Numerically exact maximum piston acceleration.
    Sweeps full cycle at 0.1 degree resolution.
    Reference: Norton D.O.M. 5th ed. Eq. 6-9
    """
    r = crank_length
    l = conn_length
    omega = crank_speed_rpm * 2 * np.pi / 60
    theta = np.linspace(0, 2 * np.pi, 3600)
    sin_th = np.sin(theta)
    cos_th = np.cos(theta)
    radicand = np.maximum(l**2 - r**2 * sin_th**2, 1e-12)
    a = -r * omega**2 * (
        cos_th
        + r * (l**2 * (cos_th**2 - sin_th**2) + r**2 * sin_th**4)
        / radicand**1.5
    )
    return float(np.max(np.abs(a)))


# ---- FOUR-BAR ----------------------------------------

def grashof_condition(ground, crank, coupler, rocker):
    """
    Grashof condition: S + L <= P + Q
    Returns: 'Grashof', 'Non-Grashof', or 'Special Grashof'
    Reference: Erdman & Sandor, Mechanism Design, 5th ed.
    """
    links = sorted([ground, crank, coupler, rocker])
    S = links[0]
    L = links[3]
    P, Q = links[1], links[2]
    diff = S + L - (P + Q)
    if diff < 0:
        return "Grashof"
    elif diff == 0:
        return "Special Grashof"
    else:
        return "Non-Grashof"


def four_bar_rocker_range(ground, crank, coupler, rocker):
    """
    Numerically compute rocker angle range by sweeping the full 360 degree
    crank cycle and tracking the consistent open-circuit branch.
    This avoids the bug of mixing two algebraic circuit solutions.
    Reference: Freudenstein, Trans. ASME 76 (1955) 853-861
    """
    d = ground; a = crank; b = coupler; c = rocker

    try:
        K1 = d / a
        K2 = d / c
        K3 = (a**2 - b**2 + c**2 + d**2) / (2 * a * c)
    except ZeroDivisionError:
        return None

    theta2_vals = np.linspace(0, 2 * np.pi, 720)
    theta4_track = []
    theta4_prev = None

    for th2 in theta2_vals:
        P = K1 - np.cos(th2)
        Q = -np.sin(th2)
        R = K2 * np.cos(th2) - K3
        A_q = R + P
        B_q = -2 * Q
        C_q = R - P

        if abs(A_q) < 1e-12:
            continue

        disc = B_q**2 - 4 * A_q * C_q
        if disc < 0:
            continue

        sqrt_disc = np.sqrt(disc)
        u1 = (-B_q + sqrt_disc) / (2 * A_q)
        u2 = (-B_q - sqrt_disc) / (2 * A_q)
        th4_1 = 2 * np.arctan(u1)
        th4_2 = 2 * np.arctan(u2)

        if theta4_prev is None:
            th4 = th4_1
        else:
            if abs(th4_1 - theta4_prev) <= abs(th4_2 - theta4_prev):
                th4 = th4_1
            else:
                th4 = th4_2

        theta4_prev = th4
        theta4_track.append(th4)

    if len(theta4_track) < 10:
        return None

    theta4_arr = np.array(theta4_track)
    return float(np.degrees(np.max(theta4_arr) - np.min(theta4_arr)))


# ============================================================
# RESEARCH PAPER BENCHMARK VALUES
# ============================================================

PAPER_BENCHMARKS = {
    "simple_pendulum": {
        "source": "Belendez et al., Eur. J. Phys. 28 (2007) 901-905",
        "description": "Exact period ratios T/T0 for nonlinear pendulum",
        "period_ratios": {
            5:  1.001,
            10: 1.003,
            15: 1.008,
            20: 1.014,
            30: 1.032,
            45: 1.073,
            60: 1.133,
            75: 1.218,
            90: 1.340,
            120: 1.733,
            150: 2.622,
            170: 4.665,
        },
        "source2": "Lima & Arun, Am. J. Phys. 74 (2006) 892-895",
        "series_formula": "T approx T0(1 + theta0^2/16 + 11*theta0^4/3072)"
    },
    "compound_pendulum": {
        "source": "Meirovitch, Fundamentals of Vibrations (2001)",
        "description": "Uniform rod compound pendulum -- effective length = 2L/3",
        "L_eff_ratio": 2.0 / 3.0,
        "source2": "Thomson & Dahleh, Theory of Vibration (1998)",
        "I_ratio": 1.0/3.0,
    },
    "slider_crank": {
        "source": "Norton, Design of Machinery, 5th ed. (2012)",
        "description": "Slider-crank kinematics -- exact loop-closure derivatives",
        "lambda_table": {
            0.0:  {"stroke_factor": 2.000, "v_max_factor": 1.000, "a_max_factor": 1.000},
            0.25: {"stroke_factor": 2.000, "v_max_factor": 1.031, "a_max_factor": 1.250},
            0.33: {"stroke_factor": 2.000, "v_max_factor": 1.056, "a_max_factor": 1.333},
            0.50: {"stroke_factor": 2.000, "v_max_factor": 1.118, "a_max_factor": 1.500},
        }
    },
    "four_bar": {
        "source": "Erdman, Sandor & Kota, Mechanism Design, 5th ed. (2001)",
        "description": "Grashof condition and rocker range for standard linkages",
        "grashof_example": {
            "links": {"ground": 4.0, "crank": 1.0, "coupler": 2.5, "rocker": 3.0},
            "condition": "Grashof",
            "rocker_range_deg": 39.34   # Computed by full-cycle numerical sweep
        },
        "source2": "Freudenstein, Trans. ASME 76 (1955) 853-861",
        "note": "Original Freudenstein equation derivation"
    }
}
