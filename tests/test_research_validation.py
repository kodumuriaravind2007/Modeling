"""
Test suite for Research Validation and Exact Analytical Benchmarks.
Verifies loop-closure machine precision, continuous branch unwrapping,
Erdman-Sandor rocker range benchmark, exact elliptic integral period ratios,
and full Grashof classification structures.
"""

import numpy as np
from scipy import special
from simulations.kinematics_core import (
    solve_four_bar_position,
    classify_grashof,
    theoretical_four_bar_rocker_range,
    solve_slider_crank
)
from validation.analytical import (
    exact_belendez_ratio,
    simple_pendulum_elliptic_period,
    simple_pendulum_small_angle_period,
    four_bar_rocker_range
)


def test_rocker_range_erdman_sandor_benchmark():
    """
    Erdman, Sandor & Kota (Mechanism Design) benchmark for [4, 1, 2.5, 3]:
    Collinear extreme limit triangles: cos(psi) = (d^2 + c^2 - (b -/+ a)^2) / (2*d*c).
    Expected range is ~39.34 degrees.
    """
    d, a, b, c = 4.0, 1.0, 2.5, 3.0
    th_range = theoretical_four_bar_rocker_range(d, a, b, c)
    assert th_range is not None
    assert abs(th_range - 39.3386) < 0.05, f"Theoretical range {th_range:.4f}° deviated from 39.34°"

    # Sweep crank angle and compare numerical sweep to theoretical
    theta2_vals = np.linspace(0, 2 * np.pi, 720)
    th4_vals = []
    prev_th4 = None
    for th2 in theta2_vals:
        sol = solve_four_bar_position(d, a, b, c, th2, prev_theta4=prev_th4)
        assert sol["success"] is True
        prev_th4 = sol["theta4"]
        th4_vals.append(sol["theta4"])

    th4_unwrapped = np.unwrap(th4_vals)
    num_range = float(np.degrees(np.max(th4_unwrapped) - np.min(th4_unwrapped)))
    assert abs(num_range - th_range) < 0.02, f"Numerical sweep {num_range:.4f}° differs from theoretical {th_range:.4f}°"


def test_four_bar_loop_closure_machine_precision():
    """
    Verify exact analytical loop closure ||B - C|| == b and ||D - C|| == c
    to machine precision (< 1e-12 m) across full cycle for various topologies.
    """
    # 1. Full 360° input rotation mechanisms: Crank-Rocker and Drag-Link
    full_rot_topologies = [
        ("Crank-Rocker", 4.0, 1.0, 2.5, 3.0),
        ("Drag-Link", 2.0, 4.0, 3.0, 3.5)
    ]

    for name, d, a, b, c in full_rot_topologies:
        prev_th4 = None
        for deg in range(360):
            th2 = np.radians(deg)
            sol = solve_four_bar_position(d, a, b, c, th2, prev_theta4=prev_th4)
            assert sol["success"] is True, f"{name} failed at {deg}°: {sol.get('error')}"
            prev_th4 = sol["theta4"]

            bx, by = sol["B"]
            cx, cy = sol["C"]

            # Coupler link constraint: ||B - C|| == b
            dist_BC = np.sqrt((cx - bx)**2 + (cy - by)**2)
            coupler_err = abs(dist_BC - b)
            assert coupler_err < 1e-12, f"{name} coupler error {coupler_err:.2e} m at {deg}° exceeds 1e-12"

            # Rocker link constraint: ||D - C|| == c (Joint D is at (d, 0))
            dist_DC = np.sqrt((cx - d)**2 + cy**2)
            rocker_err = abs(dist_DC - c)
            assert rocker_err < 1e-12, f"{name} rocker error {rocker_err:.2e} m at {deg}° exceeds 1e-12"

    # 2. Rocker mechanism: Double-Rocker within reachable arc [18.6°, 78.6°]
    d, a, b, c = 4.0, 3.0, 1.5, 3.0  # b is shortest -> Double-Rocker
    prev_th4 = None
    for deg in np.linspace(25, 75, 60):
        th2 = np.radians(deg)
        sol = solve_four_bar_position(d, a, b, c, th2, prev_theta4=prev_th4)
        assert sol["success"] is True
        prev_th4 = sol["theta4"]
        bx, by = sol["B"]
        cx, cy = sol["C"]
        dist_BC = np.sqrt((cx - bx)**2 + (cy - by)**2)
        assert abs(dist_BC - b) < 1e-12
        dist_DC = np.sqrt((cx - d)**2 + cy**2)
        assert abs(dist_DC - c) < 1e-12


def test_drag_link_continuous_unwrapping_no_jumps():
    """
    Ensure Drag-Link [2, 4, 3, 3.5] undergoes continuous rotation without
    artificial jumps (e.g., historical 257.5° branch flip bug).
    """
    d, a, b, c = 2.0, 4.0, 3.0, 3.5
    prev_th4 = None
    th4_steps = []

    for deg in range(360):
        th2 = np.radians(deg)
        sol = solve_four_bar_position(d, a, b, c, th2, prev_theta4=prev_th4)
        assert sol["success"] is True
        if prev_th4 is not None:
            delta = abs(sol["theta4"] - prev_th4)
            # 1 degree step should produce step << pi (typically < 0.15 rad)
            assert delta < 0.2, f"Discontinuity detected at {deg}°: delta = {delta:.4f} rad"
        prev_th4 = sol["theta4"]
        th4_steps.append(sol["theta4"])


def test_exact_belendez_elliptic_ratio():
    """
    Exact period ratio T / T0 = (2 / pi) * K(sin^2(theta0 / 2))
    Reference: Beléndez et al., Eur. J. Phys. 28 (2007) 901-905
    """
    angles = [10.0, 20.0, 45.0, 60.0, 90.0]
    for deg in angles:
        ratio = exact_belendez_ratio(deg)
        th0 = np.radians(deg)
        k = np.sin(th0 / 2.0)
        expected = float((2.0 / np.pi) * special.ellipk(k**2))
        assert abs(ratio - expected) < 1e-14

        # Check against simple_pendulum_elliptic_period
        L = 1.0
        g = 9.81
        T_exact = simple_pendulum_elliptic_period(L, g, deg)
        T0 = simple_pendulum_small_angle_period(L, g)
        assert abs(T_exact / T0 - ratio) < 1e-12


def test_grashof_classification_structure():
    """
    Verify structured Grashof classification output for all canonical categories.
    """
    # 1. Crank-Rocker
    cr = classify_grashof(4.0, 1.0, 2.5, 3.0)
    assert cr["classification"] == "grashof"
    assert cr["subtype"] == "crank_rocker"
    assert cr["shortest_link"] == "a"
    assert cr["is_grashof"] is True
    assert cr["continuous_rotation_possible"] is True

    # 2. Drag-Link (Double-Crank)
    dl = classify_grashof(2.0, 4.0, 3.0, 3.5)
    assert dl["classification"] == "grashof"
    assert dl["subtype"] == "double_crank"
    assert dl["shortest_link"] == "d"
    assert dl["is_grashof"] is True

    # 3. Double-Rocker (Coupler shortest: S=1.5, L=4.0, P=3.0, Q=3.0 -> S+L=5.5 < P+Q=6.0)
    dr = classify_grashof(4.0, 3.0, 1.5, 3.0)
    assert dr["classification"] == "grashof"
    assert dr["subtype"] == "double_rocker"
    assert dr["shortest_link"] == "b"

    # 4. Non-Grashof (Triple Rocker)
    ng = classify_grashof(5.0, 4.0, 2.0, 2.0)
    assert ng["classification"] == "non_grashof"
    assert ng["subtype"] == "triple_rocker"
    assert ng["is_grashof"] is False
    assert ng["continuous_rotation_possible"] is False

    # 5. Change-Point
    cp = classify_grashof(3.0, 1.0, 2.0, 2.0)
    assert cp["classification"] == "change_point"
    assert cp["is_grashof"] is True
    assert cp["is_special"] is True


def test_slider_crank_exactness():
    """
    Slider-Crank kinematics exact loop-closure check at 90 degrees crank angle.
    At theta = 90°, r = 0.1, l = 0.3:
    B = (0, 0.1), C = (sqrt(0.3^2 - 0.1^2), 0) = (0.2828427, 0)
    ||B - C||^2 = 0.2828427^2 + 0.1^2 = 0.08 + 0.01 = 0.09 = l^2.
    """
    r = 0.1
    l = 0.3
    theta = np.pi / 2.0
    omega = 10.0
    sol = solve_slider_crank(r, l, theta, omega=omega)
    assert sol["success"] is True
    expected_x = np.sqrt(l**2 - r**2)
    assert abs(sol["x"] - expected_x) < 1e-12
    bx, by = sol["B"]
    cx, cy = sol["C"]
    rod_len = np.sqrt((cx - bx)**2 + (cy - by)**2)
    assert abs(rod_len - l) < 1e-12
    # Velocity at 90 deg: -r * omega - (r * r * omega * cos(th)) / sqrt(...) = -r * omega
    assert abs(sol["v"] - (-r * omega)) < 1e-12
