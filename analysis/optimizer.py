"""
Optimization Mode — backend/analysis/optimizer.py

Uses scipy.optimize.differential_evolution (global) to find parameters that
MINIMIZE or MAXIMIZE a chosen objective function.

The objective function delegates entirely to the EXISTING simulation engine
in mechanics.py — no separate physics is implemented here.
"""

import numpy as np
from scipy.optimize import differential_evolution, minimize

from simulations.mechanics import (
    simple_pendulum_rk45,
    compound_pendulum_rk45,
    slider_crank_kinematics,
    four_bar_kinematics,
)
from validation.analytical import (
    simple_pendulum_elliptic_period,
    compound_pendulum_period,
    grashof_condition,
)


# ─── Objectives available per sim_type ───────────────────────────────────────

OBJECTIVES = {
    "simple_pendulum": {
        "period":           "Oscillation Period (s)",
        "energy_drift_pct": "Energy Drift (%)",
        "max_omega":        "Peak Angular Velocity (rad/s)",
    },
    "compound_pendulum": {
        "period":           "Oscillation Period (s)",
        "L_eff":            "Effective Length (m)",
        "energy_drift_pct": "Energy Drift (%)",
    },
    "slider_crank": {
        "stroke":   "Slider Stroke (m)",
        "v_max":    "Peak Slider Velocity (m/s)",
        "a_max":    "Peak Slider Acceleration (m/s²)",
    },
    "four_bar": {
        "rocker_range_deg": "Rocker Oscillation Range (°)",
        "max_omega4":       "Peak Rocker Angular Velocity (rad/s)",
    },
}


# ─── Compute objective value from params dict ─────────────────────────────────

def _compute_objective(sim_type, params, objective_key):
    try:
        if sim_type == "simple_pendulum":
            r = simple_pendulum_rk45(
                params["length"], params["mass"], params["gravity"],
                params.get("damping", 0.0), params.get("theta0", 30),
                params.get("omega0", 0), params.get("dt", 0.01), params.get("t_max", 10),
            )
            if objective_key == "period":
                return simple_pendulum_elliptic_period(
                    params["length"], params["gravity"], params.get("theta0", 30)
                )
            elif objective_key == "energy_drift_pct":
                e = r["total_E"]
                return (max(e) - min(e)) / e[0] * 100 if e[0] != 0 else 0.0
            elif objective_key == "max_omega":
                return max(abs(w) for w in r["omega"])

        elif sim_type == "compound_pendulum":
            r = compound_pendulum_rk45(
                params["length"], params["mass"], params["gravity"],
                params.get("damping", 0.0), params.get("theta0", 30),
                0, params.get("dt", 0.01), params.get("t_max", 10),
            )
            if objective_key == "period":
                return compound_pendulum_period(params["length"], params["gravity"])
            elif objective_key == "L_eff":
                return r["L_eff"]
            elif objective_key == "energy_drift_pct":
                e = r["total_E"]
                return (max(e) - min(e)) / e[0] * 100 if e[0] != 0 else 0.0

        elif sim_type == "slider_crank":
            r = slider_crank_kinematics(
                params["crank_length"], params["conn_length"],
                params["crank_speed"], params.get("dt", 0.001), params.get("t_max", 2.0),
            )
            if objective_key == "stroke":   return r["stroke"]
            if objective_key == "v_max":    return r["v_max"]
            if objective_key == "a_max":    return r["a_max"]

        elif sim_type == "four_bar":
            r = four_bar_kinematics(
                params["link_ground"], params["link_crank"],
                params["link_coupler"], params["link_rocker"],
                params["crank_speed"], params.get("dt", 0.005), params.get("t_max", 5.0),
            )
            if objective_key == "rocker_range_deg": return r["rocker_range_deg"]
            if objective_key == "max_omega4":
                return max(abs(w) for w in r["omega4"])

    except Exception:
        return None

    return None


# ─── Main entry point ─────────────────────────────────────────────────────────

def run_optimization(sim_type, objective_key, direction, param_bounds, fixed_params,
                     max_iter=60, popsize=10):
    """
    Parameters
    ----------
    sim_type       : str
    objective_key  : str — one of OBJECTIVES[sim_type].keys()
    direction      : "minimize" | "maximize"
    param_bounds   : {param_key: [lo, hi]}  — params to optimize
    fixed_params   : {param_key: value}     — held constant
    max_iter       : int — differential evolution iterations
    popsize        : int — population size multiplier

    Returns
    -------
    {
      optimal_params, optimal_value,
      convergence_history: [{iteration, best_value}],
      all_params,
      objective_label, direction,
      success, message,
      n_evaluations
    }
    """
    opt_keys  = list(param_bounds.keys())
    bounds    = [(float(param_bounds[k][0]), float(param_bounds[k][1])) for k in opt_keys]
    sign      = 1.0 if direction == "minimize" else -1.0

    convergence_history = []
    eval_count = [0]

    def objective(x):
        params = dict(fixed_params)
        for k, v in zip(opt_keys, x):
            params[k] = float(v)

        val = _compute_objective(sim_type, params, objective_key)
        eval_count[0] += 1
        if val is None:
            return 1e9

        # Log best every 5 evals
        if len(convergence_history) == 0 or eval_count[0] % 5 == 0:
            convergence_history.append({
                "iteration": eval_count[0],
                "value": round(float(val), 6),
            })

        return sign * float(val)

    # ── Phase 1: Differential evolution (global) ─────────────────────────────
    try:
        de_result = differential_evolution(
            objective,
            bounds=bounds,
            maxiter=max_iter,
            popsize=popsize,
            tol=1e-6,
            seed=42,
            mutation=(0.5, 1.5),
            recombination=0.7,
            polish=False,
        )
        x0 = de_result.x
        de_success = de_result.success or de_result.fun < 1e8
    except Exception as e:
        x0 = [(b[0] + b[1]) / 2 for b in bounds]
        de_success = False

    # ── Phase 2: Local refinement (L-BFGS-B) ─────────────────────────────────
    try:
        local_result = minimize(
            objective, x0, method="L-BFGS-B", bounds=bounds,
            options={"maxiter": 100, "ftol": 1e-10}
        )
        x_final = local_result.x
        success = local_result.success or de_success
        message = local_result.message
    except Exception as e:
        x_final = x0
        success = de_success
        message = str(e)

    # Build final param dict
    optimal_params = dict(fixed_params)
    for k, v in zip(opt_keys, x_final):
        optimal_params[k] = round(float(v), 6)

    optimal_value = _compute_objective(sim_type, optimal_params, objective_key)

    # Ensure convergence history is populated
    if not convergence_history:
        convergence_history = [{"iteration": 1, "value": round(float(optimal_value), 6)}]

    # Add final point
    convergence_history.append({
        "iteration": eval_count[0],
        "value": round(float(optimal_value), 6),
    })

    # Sort by iteration
    convergence_history = sorted(convergence_history, key=lambda r: r["iteration"])

    # Build running-best
    best_so_far = convergence_history[0]["value"]
    for pt in convergence_history:
        if direction == "minimize":
            best_so_far = min(best_so_far, pt["value"])
        else:
            best_so_far = max(best_so_far, pt["value"])
        pt["best_value"] = round(best_so_far, 6)

    return {
        "optimal_params": {k: round(v, 5) for k, v in optimal_params.items()
                           if k in opt_keys},
        "all_params": {k: round(float(v), 5) for k, v in optimal_params.items()},
        "optimal_value": round(float(optimal_value), 6) if optimal_value is not None else None,
        "convergence_history": convergence_history,
        "objective_key": objective_key,
        "objective_label": OBJECTIVES.get(sim_type, {}).get(objective_key, objective_key),
        "direction": direction,
        "success": bool(success),
        "message": message,
        "n_evaluations": eval_count[0],
        "opt_keys": opt_keys,
    }
