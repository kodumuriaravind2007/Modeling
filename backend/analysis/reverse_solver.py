"""
Reverse Solver -- backend/analysis/reverse_solver.py

Given a TARGET output value and a VARIABLE parameter with bounds,
finds the exact parameter value that achieves the target using
scipy.optimize.brentq (guaranteed convergence, bracket-based root-finding).

Example:
    Target period = 2.00 s, variable = length, bounds = [0.2, 5.0]
    => Finds L such that T_elliptic(L, g, theta0) = 2.00 s exactly.
"""

import numpy as np
from scipy.optimize import brentq

from simulations.mechanics import (
    simple_pendulum_rk45,
    compound_pendulum_rk45,
    slider_crank_kinematics,
    four_bar_kinematics,
)
from validation.analytical import (
    simple_pendulum_elliptic_period,
    simple_pendulum_small_angle_period,
    compound_pendulum_period,
    slider_crank_stroke,
    slider_crank_max_velocity,
    slider_crank_max_acceleration,
    four_bar_rocker_range,
    measure_numerical_period,
)


# ---- Supported reverse-solve targets per mechanism -------------------------

REVERSE_TARGETS = {
    "simple_pendulum": {
        "period":    "Oscillation Period T (s)",
        "max_omega": "Peak Angular Velocity (rad/s)",
    },
    "compound_pendulum": {
        "period": "Oscillation Period T (s)",
    },
    "slider_crank": {
        "stroke": "Slider Stroke (m)",
        "v_max":  "Peak Slider Velocity (m/s)",
        "a_max":  "Peak Slider Acceleration (m/s^2)",
    },
    "four_bar": {
        "rocker_range_deg": "Rocker Oscillation Range (deg)",
    },
}


def _compute_output(sim_type, params, output_key):
    """Compute a single scalar output from the simulation."""
    if sim_type == "simple_pendulum":
        if output_key == "period":
            return simple_pendulum_elliptic_period(
                params["length"], params["gravity"], params.get("theta0", 30)
            )
        elif output_key == "max_omega":
            r = simple_pendulum_rk45(
                params["length"], params["mass"], params["gravity"],
                params.get("damping", 0), params.get("theta0", 30),
                params.get("omega0", 0), params.get("dt", 0.01), params.get("t_max", 15)
            )
            return float(max(abs(w) for w in r["omega"]))

    elif sim_type == "compound_pendulum":
        if output_key == "period":
            return compound_pendulum_period(params["length"], params["gravity"])

    elif sim_type == "slider_crank":
        if output_key == "stroke":
            return slider_crank_stroke(params["crank_length"], params["conn_length"])
        elif output_key == "v_max":
            return slider_crank_max_velocity(
                params["crank_length"], params["conn_length"], params["crank_speed"]
            )
        elif output_key == "a_max":
            return slider_crank_max_acceleration(
                params["crank_length"], params["conn_length"], params["crank_speed"]
            )

    elif sim_type == "four_bar":
        if output_key == "rocker_range_deg":
            return four_bar_rocker_range(
                params["link_ground"], params["link_crank"],
                params["link_coupler"], params["link_rocker"]
            )

    return None


def _measure_simulation_output(sim_type, params, output_key):
    """Run the actual numerical simulation and return the measured result."""
    try:
        if sim_type == "simple_pendulum":
            r = simple_pendulum_rk45(
                params["length"], params.get("mass", 1), params.get("gravity", 9.81),
                params.get("damping", 0), params.get("theta0", 30),
                params.get("omega0", 0), params.get("dt", 0.01), params.get("t_max", 15)
            )
            if output_key == "period":
                return measure_numerical_period(r["time"], r["theta"])
            elif output_key == "max_omega":
                return float(max(abs(w) for w in r["omega"]))
                
        elif sim_type == "compound_pendulum":
            r = compound_pendulum_rk45(
                params["length"], params.get("mass", 1), params.get("gravity", 9.81),
                params.get("damping", 0), params.get("theta0", 30),
                params.get("omega0", 0), params.get("dt", 0.01), params.get("t_max", 15)
            )
            if output_key == "period":
                return measure_numerical_period(r["time"], r["theta"])
                
        elif sim_type == "slider_crank":
            r = slider_crank_kinematics(
                params["crank_length"], params["conn_length"], params.get("crank_speed", 300),
                params.get("dt", 0.001), params.get("t_max", 2)
            )
            if output_key == "stroke": return float(r["stroke"])
            elif output_key == "v_max": return float(r["v_max"])
            elif output_key == "a_max": return float(r["a_max"])
            
        elif sim_type == "four_bar":
            r = four_bar_kinematics(
                params["link_ground"], params["link_crank"], params["link_coupler"], params["link_rocker"],
                params.get("crank_speed", 60), params.get("dt", 0.005), params.get("t_max", 5)
            )
            if output_key == "rocker_range_deg": return float(r["rocker_range_deg"])
    except Exception:
        pass
    return None


def run_reverse_solve(sim_type, output_key, target_value, variable_key, variable_bounds, fixed_params):
    """
    Find the value of `variable_key` such that the simulation output
    for `output_key` equals `target_value`.

    Parameters
    ----------
    sim_type        : str
    output_key      : str -- the output to target (e.g. "period")
    target_value    : float -- desired output value
    variable_key    : str -- parameter to vary (e.g. "length")
    variable_bounds : [lo, hi] -- search interval
    fixed_params    : dict -- all other parameters held constant

    Returns
    -------
    dict with: solved_value, achieved_value, target_value, error_pct,
               variable_key, output_key, success, message, iterations
    """
    lo, hi = float(variable_bounds[0]), float(variable_bounds[1])
    eval_count = [0]

    # Sample the parameter space to find valid regions and brackets
    x_samples = np.linspace(lo, hi, 100)
    valid_points = []
    
    for xs in x_samples:
        params = dict(fixed_params)
        params[variable_key] = float(xs)
        try:
            val = _compute_output(sim_type, params, output_key)
            if val is not None:
                valid_points.append((xs, float(val)))
        except Exception:
            pass
            
    eval_count[0] += len(x_samples)

    if not valid_points:
        return {
            "success": False,
            "message": f"No valid mechanical configurations found in bounds [{lo}, {hi}].",
            "solved_value": None, "achieved_value": None,
            "simulation_result": None,
            "target_value": target_value, "error_pct": None,
            "variable_key": variable_key, "output_key": output_key,
        }

    # Check for bracketing intervals
    bracket_lo = None
    bracket_hi = None
    
    for i in range(len(valid_points) - 1):
        x1, y1 = valid_points[i]
        x2, y2 = valid_points[i+1]
        
        diff1 = y1 - target_value
        diff2 = y2 - target_value
        
        if diff1 * diff2 <= 0:
            # We found a bracket!
            bracket_lo, bracket_hi = x1, x2
            break
            
    if bracket_lo is None:
        # Not bracketed. Find nearest valid point.
        best_x, best_out = min(valid_points, key=lambda p: abs(p[1] - target_value))
        err = abs(best_out - target_value) / abs(target_value) * 100 if target_value != 0 else 0
        out_min = min(p[1] for p in valid_points)
        out_max = max(p[1] for p in valid_points)
        best_sim = _measure_simulation_output(sim_type, dict(fixed_params, **{variable_key: best_x}), output_key)
        
        return {
            "success": False,
            "message": (
                f"Target {target_value:.4f} is outside achievable range. "
                f"Valid output ranges from {out_min:.4f} to {out_max:.4f}. "
            ),
            "solved_value": round(float(best_x), 6),
            "achieved_value": round(float(best_out), 6),
            "simulation_result": round(float(best_sim), 6) if best_sim is not None else None,
            "target_value": float(target_value),
            "error_pct": round(err, 4),
            "variable_key": variable_key,
            "output_key": output_key,
            "iterations": eval_count[0],
        }

    # We have a valid bracket, use brentq
    def residual(x):
        params = dict(fixed_params)
        params[variable_key] = float(x)
        try:
            val = _compute_output(sim_type, params, output_key)
            eval_count[0] += 1
            if val is None: return 1e9  # Fallback, shouldn't be hit within valid bracket
            return float(val) - float(target_value)
        except Exception:
            return 1e9

    try:
        x_sol = brentq(residual, bracket_lo, bracket_hi, xtol=1e-8, rtol=1e-8, maxiter=100, full_output=False)
        params_sol = dict(fixed_params)
        params_sol[variable_key] = float(x_sol)
        achieved = _compute_output(sim_type, params_sol, output_key)
        err_pct = abs(achieved - target_value) / abs(target_value) * 100 if target_value != 0 else 0
        sim_val = _measure_simulation_output(sim_type, params_sol, output_key)
        
        return {
            "success": True,
            "message": "Converged successfully.",
            "solved_value": round(float(x_sol), 6),
            "achieved_value": round(float(achieved), 6),
            "simulation_result": round(float(sim_val), 6) if sim_val is not None else None,
            "target_value": float(target_value),
            "error_pct": round(err_pct, 6),
            "variable_key": variable_key,
            "output_key": output_key,
            "output_label": REVERSE_TARGETS.get(sim_type, {}).get(output_key, output_key),
            "iterations": eval_count[0],
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Solver failed within bracket: {e}",
            "solved_value": None, "achieved_value": None,
            "simulation_result": None,
            "target_value": target_value, "error_pct": None,
            "variable_key": variable_key, "output_key": output_key,
            "iterations": eval_count[0],
        }
