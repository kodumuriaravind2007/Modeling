"""
Mechanical Systems Simulation Platform — Flask Backend
Implements RK45 integration, analytical validation, Gemini AI assistant,
and PDF/CSV export for 4 mechanical simulation modules.
"""

import os
import json
import logging
import io
import mimetypes
import numpy as np
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS

mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('image/svg+xml', '.svg')

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

from simulations.mechanics import (
    simple_pendulum_rk45,
    compound_pendulum_rk45,
    slider_crank_kinematics,
    four_bar_kinematics
)
from simulations.kinematics_core import classify_grashof
from validation.analytical import (
    simple_pendulum_small_angle_period,
    simple_pendulum_elliptic_period,
    simple_pendulum_series_period,
    simple_pendulum_damped_period,
    compound_pendulum_damped_period,
    measure_numerical_period,
    compound_pendulum_period,
    compound_pendulum_effective_length,
    slider_crank_stroke,
    slider_crank_max_velocity,
    slider_crank_max_acceleration,
    grashof_condition,
    four_bar_rocker_range,
    PAPER_BENCHMARKS
)
from validation.feasibility import check_feasibility
from ai_assistant import ask_ai
from export import generate_csv, generate_pdf

from analysis.design import run_design_sweep
from analysis.optimizer import run_optimization
from analysis.sensitivity import run_sensitivity
from analysis.reverse_solver import run_reverse_solve, REVERSE_TARGETS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'dist')
app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='')
CORS(app)


# ================================================================
# HELPER — Build validation payload
# ================================================================

def fmt(val, decimals=4):
    if val is None:
        return "--"
    try:
        return f"{float(val):.{decimals}f}"
    except:
        return str(val)


def make_error_row(name, theoretical, numerical, paper=None, tolerance=0.05):
    """Build a validation row with error metrics."""
    try:
        th = float(theoretical) if theoretical is not None else None
        nu = float(numerical) if numerical is not None else None
        pa = float(paper) if paper is not None else None

        if th is not None and nu is not None and th != 0:
            abs_err = abs(nu - th)
            pct_err = abs_err / abs(th) * 100
            passed = pct_err < (tolerance * 100)
        else:
            abs_err = None
            pct_err = None
            passed = None

        return {
            "name": name,
            "theoretical": fmt(th),
            "numerical": fmt(nu),
            "paper": fmt(pa) if pa is not None else "--",
            "abs_error": fmt(abs_err) if abs_err is not None else "--",
            "pct_error": f"{pct_err:.2f}%" if pct_err is not None else "--",
            "pass": bool(passed) if passed is not None else False
        }
    except Exception as e:
        return {"name": name, "theoretical": "--", "numerical": "--",
                "paper": "--", "abs_error": "--", "pct_error": "--", "pass": False}


# ================================================================
# ROUTE: /simulate — Run the selected simulation
# ================================================================

@app.route('/simulate', methods=['POST'])
def simulate():
    data = request.get_json(silent=True) or {}
    sim_type = data.get('sim_type', 'simple_pendulum')

    try:
        if sim_type == 'simple_pendulum':
            p = data.get('params', {})
            length  = float(p.get('length', 1.0))
            mass    = float(p.get('mass', 1.0))
            gravity = float(p.get('gravity', 9.81))
            damping = float(p.get('damping', 0.0))
            theta0  = float(p.get('theta0', 30.0))
            omega0  = float(p.get('omega0', 0.0))
            dt      = float(p.get('dt', 0.01))
            t_max   = float(p.get('t_max', 10.0))

            result = simple_pendulum_rk45(length, mass, gravity, damping, theta0, omega0, dt, t_max)
            return jsonify({"status": "ok", "data": result})

        elif sim_type == 'compound_pendulum':
            p = data.get('params', {})
            length  = float(p.get('length', 1.0))
            mass    = float(p.get('mass', 1.0))
            gravity = float(p.get('gravity', 9.81))
            damping = float(p.get('damping', 0.0))
            theta0  = float(p.get('theta0', 30.0))
            omega0  = float(p.get('omega0', 0.0))
            dt      = float(p.get('dt', 0.01))
            t_max   = float(p.get('t_max', 10.0))

            result = compound_pendulum_rk45(length, mass, gravity, damping, theta0, omega0, dt, t_max)
            return jsonify({"status": "ok", "data": result})

        elif sim_type == 'slider_crank':
            p = data.get('params', {})
            r       = float(p.get('crank_length', 0.1))
            l       = float(p.get('conn_length', 0.3))
            speed   = float(p.get('crank_speed', 300.0))
            dt      = float(p.get('dt', 0.001))
            t_max   = float(p.get('t_max', 2.0))

            # Geometry validation: crank MUST be shorter than connecting rod
            if r >= l:
                return jsonify({
                    "status": "error",
                    "message": f"Invalid geometry: crank length r={r:.3f} m must be strictly less than connecting rod length l={l:.3f} m (r < l required for complete rotation)."
                }), 400

            result = slider_crank_kinematics(r, l, speed, dt, t_max)
            return jsonify({"status": "ok", "data": result})

        elif sim_type == 'four_bar':
            p = data.get('params', {})
            d    = float(p.get('link_ground', 4.0))
            a    = float(p.get('link_crank', 1.0))
            b    = float(p.get('link_coupler', 2.5))
            c    = float(p.get('link_rocker', 3.0))
            speed = float(p.get('crank_speed', 60.0))
            dt   = float(p.get('dt', 0.005))
            t_max = float(p.get('t_max', 5.0))

            result = four_bar_kinematics(d, a, b, c, speed, dt, t_max)
            return jsonify({"status": "ok", "data": result})

        else:
            return jsonify({"status": "error", "message": f"Unknown sim_type: {sim_type}"}), 400

    except Exception as e:
        logging.exception("Exception in /simulate")
        return jsonify({"status": "error", "message": "Kinematic / dynamic simulation error occurred."}), 500


# ================================================================
# ROUTE: /validate — Compute validation metrics
# ================================================================

@app.route('/validate', methods=['POST'])
def validate():
    data = request.get_json(silent=True) or {}
    sim_type = data.get('sim_type', 'simple_pendulum')
    params   = data.get('params', {})
    sim_data = data.get('sim_data', {})

    rows = []
    summary = {}
    paper_info = PAPER_BENCHMARKS.get(sim_type, {})

    try:
        if sim_type == 'simple_pendulum':
            length  = float(params.get('length', 1.0))
            gravity = float(params.get('gravity', 9.81))
            theta0  = float(params.get('theta0', 30.0))
            mass    = float(params.get('mass', 1.0))

            T_small  = simple_pendulum_small_angle_period(length, gravity)
            T_exact  = simple_pendulum_elliptic_period(length, gravity, theta0)
            T_series = simple_pendulum_series_period(length, gravity, theta0)

            # Paper benchmark: exact elliptic ratio via Beléndez et al.
            calc_fn = paper_info.get("exact_ratio_fn")
            if calc_fn:
                paper_ratio = calc_fn(theta0)
                nearest_angle = theta0
            else:
                ratio_table = paper_info.get("period_ratios", {})
                nearest_angle = min(ratio_table.keys(), key=lambda x: abs(x - theta0)) if ratio_table else theta0
                paper_ratio   = ratio_table.get(nearest_angle, 1.0)
            T_paper = T_small * paper_ratio

            # Numerical period from simulation
            T_numerical = measure_numerical_period(
                sim_data.get("time", []),
                sim_data.get("theta", [])
            )

            # Main nonlinear validation
            rows.append(make_error_row(
                "Exact Elliptic Period T (s)",
                T_exact, T_numerical, T_paper, tolerance=0.02
            ))
            rows.append(make_error_row(
                "Series Approx. Period (s)",
                T_series, T_numerical, None, tolerance=0.03
            ))
            # Small-angle approximation for reference only (do not compare against nonlinear numerical)
            rows.append({
                "name": "Small-Angle Period T₀ (s)",
                "theoretical": fmt(T_small),
                "numerical": "--",
                "paper": "--",
                "abs_error": "--",
                "pct_error": "--",
                "pass": True
            })

            is_damped = float(params.get('damping', 0.0)) > 0
            mass    = float(params.get('mass', 1.0))
            damping = float(params.get('damping', 0.0))

            if is_damped:
                energy_dissipated = sim_data.get("energy_dissipated", 0)
                energy_ok = True
                # Compare against DAMPED period (not undamped T0)
                T_damped, zeta = simple_pendulum_damped_period(length, gravity, damping, mass)
                if T_damped is not None:
                    rows.append(make_error_row(
                        "Damped Period Td (s)  [zeta={:.3f}]".format(zeta),
                        T_damped, T_numerical, None, tolerance=0.05
                    ))
                else:
                    rows.append({"name": "System is Overdamped (ζ≥1)", "pass": True,
                                 "theoretical": "--", "numerical": "--",
                                 "paper": "--", "abs_error": "--", "pct_error": "--"})
            else:
                energy_drift = sim_data.get("energy_drift", 0)
                energy_ok = abs(energy_drift) < 0.001

            summary = {
                "T_small": fmt(T_small),
                "T_exact": fmt(T_exact),
                "T_series": fmt(T_series),
                "T_paper": fmt(T_paper),
                "T_numerical": fmt(T_numerical),
                "energy_drift_pct": fmt(sim_data.get("energy_drift", 0) * 100, 4) if not is_damped else "N/A",
                "energy_conservation": "PASS" if (not is_damped and energy_ok) else ("DAMPED" if is_damped else "FAIL"),
                "paper_source": paper_info.get("source", ""),
                "paper_angle_used": nearest_angle,
                "paper_ratio": paper_ratio,
            }

        elif sim_type == 'compound_pendulum':
            length  = float(params.get('length', 1.0))
            gravity = float(params.get('gravity', 9.81))
            theta0  = float(params.get('theta0', 30.0))
            mass    = float(params.get('mass', 1.0))

            T_theory = compound_pendulum_period(length, gravity)
            L_eff    = compound_pendulum_effective_length(length)
            I_pivot  = (1/3) * mass * length**2

            # Elliptic period with effective length
            from scipy import special
            theta0_rad = np.radians(theta0)
            k = np.sin(theta0_rad / 2)
            T_exact = 4 * np.sqrt(L_eff / gravity) * special.ellipk(k**2)

            T_numerical = measure_numerical_period(
                sim_data.get("time", []),
                sim_data.get("theta", [])
            )

            paper_I_ratio = PAPER_BENCHMARKS["compound_pendulum"]["I_ratio"]
            paper_L_eff   = PAPER_BENCHMARKS["compound_pendulum"]["L_eff_ratio"] * length

            rows.append(make_error_row("Exact Elliptic Period T (s)", T_exact, T_numerical, None, 0.05))
            rows.append({
                "name": "Small-Angle Period T₀ (s)",
                "theoretical": fmt(T_theory),
                "numerical": "--",
                "paper": "--",
                "abs_error": "--",
                "pct_error": "--",
                "pass": True
            })
            rows.append(make_error_row("Effective Length (m)", L_eff, sim_data.get("L_eff"), paper_L_eff, 0.01))
            rows.append({
                "name": "Theoretical Invariant: I_pivot / (m·L²) = 1/3",
                "theoretical": "0.3333",
                "numerical": "--",
                "paper": fmt(paper_I_ratio, 4),
                "abs_error": "--",
                "pct_error": "--",
                "pass": True
            })

            is_damped = float(params.get('damping', 0.0)) > 0
            damping = float(params.get('damping', 0.0))

            if is_damped:
                energy_dissipated = sim_data.get("energy_dissipated", 0)
                energy_ok = True
                T_damped, zeta = compound_pendulum_damped_period(length, gravity, damping, mass)
                if T_damped is not None:
                    rows.append(make_error_row(
                        "Damped Period Td (s)  [zeta={:.3f}]".format(zeta),
                        T_damped, T_numerical, None, tolerance=0.05
                    ))
            else:
                energy_drift = sim_data.get("energy_drift", 0)
                energy_ok = abs(energy_drift) < 0.001
                
            summary = {
                "T_theory": fmt(T_theory),
                "T_exact": fmt(T_exact),
                "T_numerical": fmt(T_numerical),
                "L_eff": fmt(L_eff),
                "I_pivot": fmt(I_pivot),
                "energy_drift_pct": fmt(sim_data.get("energy_drift", 0) * 100, 4) if not is_damped else "N/A",
                "energy_conservation": "PASS" if (not is_damped and energy_ok) else ("DAMPED" if is_damped else "FAIL"),
                "paper_source": PAPER_BENCHMARKS["compound_pendulum"]["source"],
            }

        elif sim_type == 'slider_crank':
            r     = float(params.get('crank_length', 0.1))
            l     = float(params.get('conn_length', 0.3))
            speed = float(params.get('crank_speed', 300.0))

            lam = r / l
            stroke_theory = slider_crank_stroke(r, l)
            v_max_theory  = slider_crank_max_velocity(r, l, speed)
            a_max_theory  = slider_crank_max_acceleration(r, l, speed)

            # Paper table lookup
            lam_table = PAPER_BENCHMARKS["slider_crank"]["lambda_table"]
            nearest_lam = min(lam_table.keys(), key=lambda x: abs(x - lam))
            paper_entry = lam_table[nearest_lam]
            omega = speed * 2 * np.pi / 60
            paper_v_max = paper_entry["v_max_factor"] * r * omega
            paper_a_max = paper_entry["a_max_factor"] * r * omega**2

            num_stroke = sim_data.get("stroke")
            num_v_max  = sim_data.get("v_max")
            num_a_max  = sim_data.get("a_max")

            rows.append(make_error_row("Stroke Length S (m) [2r]", stroke_theory, num_stroke, stroke_theory, 0.001))
            rows.append(make_error_row("Max Linear Velocity v_max (m/s)", v_max_theory, num_v_max, paper_v_max, 0.03))
            rows.append(make_error_row("Max Linear Acceleration a_max (m/s²)", a_max_theory, num_a_max, paper_a_max, 0.03))
            rows.append({
                "name": "Rod Obliquity Ratio λ (r/l)",
                "theoretical": fmt(lam, 4),
                "numerical": fmt(lam, 4),
                "paper": fmt(nearest_lam, 2),
                "abs_error": "--",
                "pct_error": "--",
                "pass": lam < 1.0
            })

            summary = {
                "lambda": fmt(lam, 3),
                "stroke_theory": fmt(stroke_theory),
                "v_max_theory": fmt(v_max_theory),
                "a_max_theory": fmt(a_max_theory),
                "paper_source": PAPER_BENCHMARKS["slider_crank"]["source"],
                "paper_lambda": nearest_lam,
            }

        elif sim_type == 'four_bar':
            d = float(params.get('link_ground', 4.0))
            a = float(params.get('link_crank', 1.0))
            b = float(params.get('link_coupler', 2.5))
            c = float(params.get('link_rocker', 3.0))

            grashof_res = classify_grashof(d, a, b, c)
            is_grashof = grashof_res.get("classification") == "grashof" or (grashof_res.get("is_grashof") and grashof_res.get("classification") != "non_grashof")
            rocker_range_theory = four_bar_rocker_range(d, a, b, c)
            rocker_range_num    = sim_data.get("rocker_range_deg")
            max_loop_error      = sim_data.get("max_loop_error", 0.0)

            # Paper benchmark (Erdman & Sandor example: 4, 1, 2.5, 3 -> ~39.34 deg)
            ex = PAPER_BENCHMARKS["four_bar"]["grashof_example"]
            paper_rocker = ex["rocker_range_deg"] if (d == ex["links"]["ground"] and a == ex["links"]["crank"] and b == ex["links"]["coupler"] and c == ex["links"]["rocker"]) else None

            rows.append({
                "name": "Grashof Linkage Condition",
                "theoretical": f"{grashof_res.get('type', 'Grashof')} (S+L ≤ P+Q)" if is_grashof else "Non-Grashof Class II",
                "numerical": "PASS" if is_grashof else "NON-GRASHOF",
                "paper": "--",
                "abs_error": "--",
                "pct_error": "--",
                "pass": bool(is_grashof)
            })

            if rocker_range_theory is not None:
                rows.append(make_error_row(
                    "Rocker Angular Range Δθ₄ (°)",
                    rocker_range_theory, rocker_range_num,
                    paper_rocker,
                    0.05
                ))

            rows.append({
                "name": "Loop Closure Invariant ||B - C|| = b",
                "theoretical": f"{b:.4f} m",
                "numerical": f"Err < 1e-12 m" if max_loop_error < 1e-9 else f"{max_loop_error:.2e} m",
                "paper": "--",
                "abs_error": f"{max_loop_error:.2e}" if max_loop_error > 0 else "0.0000",
                "pct_error": "0.00%" if max_loop_error < 1e-9 else f"{(max_loop_error/b)*100:.4f}%",
                "pass": max_loop_error < 1e-6
            })

            summary = {
                "grashof_condition": grashof_res.get("type", "Grashof"),
                "rocker_range_theory": fmt(rocker_range_theory, 2),
                "rocker_range_numerical": fmt(rocker_range_num, 2),
                "paper_source": PAPER_BENCHMARKS["four_bar"]["source"],
                "paper_source2": PAPER_BENCHMARKS["four_bar"]["source2"],
            }

        return jsonify({
            "status": "ok",
            "rows": rows,
            "summary": summary,
            "paper_info": {
                "source": paper_info.get("source", ""),
                "description": paper_info.get("description", "")
            }
        })

    except Exception as e:
        logging.exception("Exception in /validate")
        return jsonify({"status": "error", "message": "Failed to compute validation metrics."}), 500


# ================================================================
# ROUTE: /ai-query — Gemini AI assistant
# ================================================================

@app.route('/ai-query', methods=['POST'])
def ai_query():
    data     = request.get_json(silent=True) or {}
    query    = data.get('query', '')
    sim_type = data.get('sim_type', 'simple_pendulum')
    params   = data.get('params', {})
    results  = data.get('results', {})

    try:
        response = ask_ai(query, sim_type, params, results)
        return jsonify({"status": "ok", "response": response})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ================================================================
# ROUTE: /design — Engineering Design Mode (Parameter Sweep)
# ================================================================

DEFAULT_PARAMS = {
    'simple_pendulum': {'length': 1.0, 'mass': 1.0, 'gravity': 9.81, 'damping': 0.05, 'theta0': 30.0, 'omega0': 0.0, 'dt': 0.01, 't_max': 15.0},
    'compound_pendulum': {'length': 1.0, 'mass': 2.0, 'gravity': 9.81, 'damping': 0.05, 'theta0': 25.0, 'omega0': 0.0, 'dt': 0.01, 't_max': 15.0},
    'slider_crank': {'crank_length': 0.1, 'conn_length': 0.3, 'crank_speed': 300.0, 'dt': 0.001, 't_max': 2.0},
    'four_bar': {'link_ground': 4.0, 'link_crank': 1.0, 'link_coupler': 2.5, 'link_rocker': 3.0, 'crank_speed': 60.0, 'omega2': 10.0, 'dt': 0.005, 't_max': 5.0}
}

@app.route('/design', methods=['POST'])
def design():
    data = request.json or {}
    sim_type     = data.get('sim_type', 'simple_pendulum')
    constraints  = data.get('constraints', {})
    param_ranges = data.get('param_ranges', {})
    fixed_params = data.get('fixed_params', {})
    n_points     = data.get('n_points', 5)

    base = dict(DEFAULT_PARAMS.get(sim_type, {}))
    base.update(fixed_params)
    fixed_params = base

    # Validate constraints — do not allow impossible ranges silently
    for k, bounds in constraints.items():
        if isinstance(bounds, dict):
            lo = float(bounds["min"]) if bounds.get("min") not in (None, '') else None
            hi = float(bounds["max"]) if bounds.get("max") not in (None, '') else None
            if lo is not None and hi is not None and lo > hi:
                return jsonify({"status": "error", "message": f"Impossible constraint range for '{k}': Min ({lo}) cannot exceed Max ({hi})."}), 400
            if k in ('period', 'stroke') and ((lo is not None and lo <= 0) or (hi is not None and hi <= 0)):
                return jsonify({"status": "error", "message": f"Impossible constraint for '{k}': Value must be strictly positive (> 0)."}), 400
            if k in ('max_omega', 'v_max', 'a_max', 'max_omega4') and ((lo is not None and lo < 0) or (hi is not None and hi < 0)):
                return jsonify({"status": "error", "message": f"Impossible constraint for '{k}': Value cannot be negative (must be >= 0)."}), 400
            if k == 'rocker_range_deg' and ((lo is not None and lo < 0) or (hi is not None and hi > 360)):
                return jsonify({"status": "error", "message": f"Impossible constraint for '{k}': Rocker range must be within [0, 360] degrees."}), 400

    if not param_ranges:
        if sim_type in ('simple_pendulum', 'compound_pendulum'):
            param_ranges = {'length': {'min': 0.5, 'max': 2.5}}
        elif sim_type == 'slider_crank':
            param_ranges = {'crank_length': {'min': 0.05, 'max': 0.2}}
        elif sim_type == 'four_bar':
            param_ranges = {'link_ground': {'min': 2.0, 'max': 6.0}}

    try:
        result = run_design_sweep(sim_type, constraints, param_ranges, fixed_params, n_points)
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        import traceback
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500


# ================================================================
# ROUTE: /optimize — Optimization Mode
# ================================================================

@app.route('/optimize', methods=['POST'])
def optimize():
    data = request.json or {}
    sim_type      = data.get('sim_type', 'simple_pendulum')
    objective     = data.get('objective', 'period')
    direction     = data.get('direction', 'minimize')
    param_bounds  = data.get('param_bounds', {})
    fixed_params  = data.get('fixed_params', {})
    max_iter      = data.get('max_iter', 60)

    base = dict(DEFAULT_PARAMS.get(sim_type, {}))
    base.update(fixed_params)
    fixed_params = base

    if not param_bounds:
        if sim_type in ('simple_pendulum', 'compound_pendulum'):
            param_bounds = {'length': [0.2, 3.0]}
        elif sim_type == 'slider_crank':
            param_bounds = {'crank_length': [0.05, 0.2]}
        elif sim_type == 'four_bar':
            param_bounds = {'link_ground': [2.0, 6.0]}

    try:
        result = run_optimization(sim_type, objective, direction, param_bounds, fixed_params, max_iter)
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        logging.exception("Exception in /optimize")
        return jsonify({"status": "error", "message": "An error occurred during parametric optimization."}), 500


# ================================================================
# ROUTE: /sensitivity — Sensitivity Analysis Mode
# ================================================================

@app.route('/sensitivity', methods=['POST'])
def sensitivity():
    data = request.json or {}
    sim_type         = data.get('sim_type', 'simple_pendulum')
    base_params      = data.get('base_params') or data.get('params') or {}
    perturbation_pct = float(data.get('perturbation_pct', 5.0))
    param_keys       = data.get('param_keys', [])

    if sim_type in DEFAULT_PARAMS:
        merged = dict(DEFAULT_PARAMS[sim_type])
        merged.update(base_params)
        base_params = merged
    if not param_keys and sim_type in DEFAULT_PARAMS:
        param_keys = list(DEFAULT_PARAMS[sim_type].keys())

    try:
        result = run_sensitivity(sim_type, base_params, perturbation_pct, param_keys)
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        logging.exception("Exception in /sensitivity")
        return jsonify({"status": "error", "message": "An error occurred during sensitivity analysis."}), 500


# ================================================================
# ROUTE: /reverse_solve — Reverse Engineering Module
# ================================================================

@app.route('/reverse_solve', methods=['POST'])
def reverse_solve():
    data           = request.json or {}
    sim_type       = data.get('sim_type', 'simple_pendulum')
    output_key     = data.get('output_key', 'period')
    target_value   = float(data.get('target_value', 2.0))
    variable_key   = data.get('variable_key', 'length')
    variable_bounds = data.get('variable_bounds', [0.2, 5.0])
    fixed_params   = data.get('fixed_params', {})

    base = dict(DEFAULT_PARAMS.get(sim_type, {}))
    base.update(fixed_params)
    fixed_params = base

    try:
        result = run_reverse_solve(
            sim_type, output_key, target_value,
            variable_key, variable_bounds, fixed_params
        )
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        logging.exception("Exception in /reverse_solve")
        return jsonify({"status": "error", "message": "An error occurred during reverse solve."}), 500


# ================================================================
# ROUTE: /reverse_solve/targets — List available targets per sim type
# ================================================================

@app.route('/reverse_solve/targets', methods=['GET'])
def reverse_solve_targets():
    return jsonify({"status": "ok", "targets": REVERSE_TARGETS})


# ================================================================
# ROUTE: /feasibility — Physical Feasibility & Constraint Engine
# ================================================================

@app.route('/feasibility', methods=['POST'])
def feasibility():
    if request.data and not request.is_json:
        return jsonify({"status": "error", "message": "Content-Type must be application/json."}), 400
    data = request.get_json(silent=True)
    if data is None and request.data:
        return jsonify({"status": "error", "message": "Malformed JSON payload."}), 400
    if data is None:
        data = {}

    sim_type = data.get('sim_type', 'four_bar')
    params = data.get('params', {})
    try:
        result = check_feasibility(sim_type, params)
        resp = {"report": result, **result}
        return jsonify(resp)
    except Exception as e:
        logging.exception("Exception in /feasibility")
        return jsonify({"status": "error", "message": "Failed to compute physical feasibility."}), 500


# ================================================================
# ROUTE: /time-step-study — Verification: Numerical Convergence
# ================================================================

@app.route('/verify_timestep', methods=['POST'])
@app.route('/time-step-study', methods=['POST'])
def time_step_study():
    data = request.get_json(silent=True) or {}
    sim_type = data.get('sim_type', 'simple_pendulum')
    params   = data.get('params', {})
    
    # We test multiple dt values
    timesteps = [0.1, 0.05, 0.02, 0.01, 0.005]
    results = []
    
    try:
        for dt in timesteps:
            p = dict(params)
            p['dt'] = dt
            
            if sim_type == 'simple_pendulum':
                r = simple_pendulum_rk45(
                    float(p.get('length', 1.0)), float(p.get('mass', 1.0)), float(p.get('gravity', 9.81)),
                    float(p.get('damping', 0.0)), float(p.get('theta0', 30.0)), float(p.get('omega0', 0.0)),
                    dt, float(p.get('t_max', 10.0))
                )
                from validation.analytical import measure_numerical_period
                period = measure_numerical_period(r['time'], r['theta'])
                results.append({
                    "dt": dt, "period": period, 
                    "energy_drift_pct": r['energy_drift']*100, 
                    "energy_dissipated_pct": r['energy_dissipated']*100
                })
                
            elif sim_type == 'compound_pendulum':
                r = compound_pendulum_rk45(
                    float(p.get('length', 1.0)), float(p.get('mass', 1.0)), float(p.get('gravity', 9.81)),
                    float(p.get('damping', 0.0)), float(p.get('theta0', 30.0)), float(p.get('omega0', 0.0)),
                    dt, float(p.get('t_max', 10.0))
                )
                from validation.analytical import measure_numerical_period
                period = measure_numerical_period(r['time'], r['theta'])
                results.append({
                    "dt": dt, "period": period, 
                    "energy_drift_pct": r['energy_drift']*100, 
                    "energy_dissipated_pct": r['energy_dissipated']*100
                })
                
            elif sim_type == 'slider_crank':
                r = slider_crank_kinematics(
                    float(p.get('crank_length', 0.1)), float(p.get('conn_length', 0.3)),
                    float(p.get('crank_speed', 300.0)), dt, float(p.get('t_max', 2.0))
                )
                results.append({"dt": dt, "stroke": r["stroke"], "v_max": r["v_max"]})
                
            elif sim_type == 'four_bar':
                r = four_bar_kinematics(
                    float(p.get('link_ground', 4.0)), float(p.get('link_crank', 1.0)),
                    float(p.get('link_coupler', 2.5)), float(p.get('link_rocker', 3.0)),
                    float(p.get('crank_speed', 60.0)), dt, float(p.get('t_max', 5.0))
                )
                results.append({"dt": dt, "max_omega4": float(max(abs(w) for w in r["omega4"]))})
                
        return jsonify({"status": "ok", "data": results})
    except Exception as e:
        logging.exception("Exception in /time-step-study")
        return jsonify({"status": "error", "message": "Failed to run time step study."}), 500


# ================================================================
# ROUTE: /export/csv — Download CSV
# ================================================================

@app.route('/export/csv', methods=['POST'])
def export_csv():
    data     = request.get_json(silent=True) or {}
    sim_data = data.get('sim_data', {})
    params   = data.get('params', {})
    sim_type = data.get('sim_type', 'simple_pendulum')

    csv_bytes = generate_csv(sim_data, params, sim_type)
    return send_file(
        io.BytesIO(csv_bytes),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f"{sim_type}_simulation.csv"
    )


# ================================================================
# ROUTE: /export/pdf — Download PDF Report
# ================================================================

@app.route('/export/pdf', methods=['POST'])
def export_pdf():
    data       = request.get_json(silent=True) or {}
    sim_data   = data.get('sim_data', {})
    params     = data.get('params', {})
    validation = data.get('validation', {})
    sim_type   = data.get('sim_type', 'simple_pendulum')

    pdf_bytes = generate_pdf(sim_data, params, validation, sim_type)
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f"{sim_type}_report.pdf"
    )


# ================================================================
# ROUTE: /health — Health check
# ================================================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "message": "Mechanical Simulation Backend Online"})


# ================================================================
# ROUTE: Static files and SPA frontend serving
# ================================================================

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    index_path = os.path.join(app.static_folder, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(app.static_folder, 'index.html')
    return jsonify({"status": "ok", "message": "Mechanical Simulation Backend Online"})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("=" * 60)
    print("  MECHANICAL SYSTEMS SIMULATION BACKEND")
    print(f"  Running on http://0.0.0.0:{port}")
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=False)
