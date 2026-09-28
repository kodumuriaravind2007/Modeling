"""
Engineering Design Mode — backend/analysis/design.py

Given a set of CONSTRAINTS (target output ranges) and PARAMETER RANGES,
sweeps the parameter space and returns:
  - Feasibility map (which combinations pass all constraints)
  - Top ranked parameter sets
  - Design margins (how much headroom each candidate has)

All computation delegates to the EXISTING simulation engine in mechanics.py.
"""

import numpy as np
from itertools import product

from simulations.mechanics import (
    simple_pendulum_rk45,
    compound_pendulum_rk45,
    slider_crank_kinematics,
    four_bar_kinematics,
)
from validation.analytical import (
    simple_pendulum_elliptic_period,
    compound_pendulum_period,
    slider_crank_stroke,
    slider_crank_max_velocity,
    grashof_condition,
)


# ─── Metric extraction helpers ────────────────────────────────────────────────

def _extract_metrics_simple(params):
    """Run simple pendulum and return scalar KPIs."""
    r = simple_pendulum_rk45(
        params["length"], params["mass"], params["gravity"],
        params["damping"], params["theta0"], params.get("omega0", 0),
        params.get("dt", 0.01), params.get("t_max", 15),
    )
    period = simple_pendulum_elliptic_period(params["length"], params["gravity"], params["theta0"])
    total_E = r["total_E"]
    energy_drift = float((max(total_E) - min(total_E)) / total_E[0]) if total_E[0] != 0 else 0.0
    return {
        "period": period,
        "energy_drift_pct": energy_drift * 100,
        "max_omega": float(max(abs(w) for w in r["omega"])),
    }


def _extract_metrics_compound(params):
    r = compound_pendulum_rk45(
        params["length"], params["mass"], params["gravity"],
        params["damping"], params["theta0"], 0,
        params.get("dt", 0.01), params.get("t_max", 15),
    )
    period = compound_pendulum_period(params["length"], params["gravity"])
    total_E = r["total_E"]
    energy_drift = float((max(total_E) - min(total_E)) / total_E[0]) if total_E[0] != 0 else 0.0
    return {
        "period": period,
        "L_eff": r["L_eff"],
        "energy_drift_pct": energy_drift * 100,
        "max_omega": float(max(abs(w) for w in r["omega"])),
    }


def _extract_metrics_slider(params):
    r = slider_crank_kinematics(
        params["crank_length"], params["conn_length"],
        params["crank_speed"], params.get("dt", 0.001), params.get("t_max", 2.0),
    )
    return {
        "stroke": r["stroke"],
        "v_max": r["v_max"],
        "a_max": r["a_max"],
        "lambda": params["crank_length"] / params["conn_length"],
    }


def _extract_metrics_fourbar(params):
    r = four_bar_kinematics(
        params["link_ground"], params["link_crank"], params["link_coupler"],
        params["link_rocker"], params["crank_speed"],
        params.get("dt", 0.005), params.get("t_max", 5.0),
    )
    grashof = grashof_condition(
        params["link_ground"], params["link_crank"],
        params["link_coupler"], params["link_rocker"]
    )
    return {
        "rocker_range_deg": r["rocker_range_deg"],
        "grashof": grashof,
        "max_omega4": float(max(abs(w) for w in r["omega4"])),
    }


EXTRACTORS = {
    "simple_pendulum": _extract_metrics_simple,
    "compound_pendulum": _extract_metrics_compound,
    "slider_crank": _extract_metrics_slider,
    "four_bar": _extract_metrics_fourbar,
}


# ─── Constraint checking ──────────────────────────────────────────────────────

def _check_constraints(metrics, constraints):
    """
    constraints: dict of {metric_key: {"min": float|None, "max": float|None}} or [lo, hi]
    Returns (passed: bool, margins: dict)
    """
    margins = {}
    all_pass = True

    for key, bounds in constraints.items():
        val = metrics.get(key)
        if val is None:
            continue

        if isinstance(bounds, (list, tuple)):
            lo = float(bounds[0]) if len(bounds) > 0 and bounds[0] is not None else None
            hi = float(bounds[1]) if len(bounds) > 1 and bounds[1] is not None else None
        elif isinstance(bounds, dict):
            lo = float(bounds["min"]) if bounds.get("min") is not None and bounds.get("min") != '' else None
            hi = float(bounds["max"]) if bounds.get("max") is not None and bounds.get("max") != '' else None
        else:
            lo = None
            hi = None

        if lo is not None and hi is not None:
            centre = (lo + hi) / 2
            half_range = (hi - lo) / 2
            margin = (half_range - abs(val - centre)) / half_range if half_range > 0 else 0
            ok = lo <= val <= hi
        elif lo is not None:
            margin = (val - lo) / abs(lo) if lo != 0 else val
            ok = val >= lo
        elif hi is not None:
            margin = (hi - val) / abs(hi) if hi != 0 else -val
            ok = val <= hi
        else:
            margin = 1.0
            ok = True

        margins[key] = {"value": val, "margin": float(margin), "pass": bool(ok)}
        if not ok:
            all_pass = False

    return all_pass, margins


# ─── Main entry point ─────────────────────────────────────────────────────────

def run_design_sweep(sim_type, constraints, param_ranges, fixed_params, n_points=6):
    """
    Sweep each varying parameter independently (1-D sweeps + 2-D grid for top 2 params).

    Parameters
    ----------
    sim_type      : str
    constraints   : {metric: {min, max}}
    param_ranges  : {param_key: {min, max}}  — params to vary
    fixed_params  : {param_key: value}       — params held constant
    n_points      : int — grid resolution per axis

    Returns
    -------
    {
      sweep_results: [{params, metrics, pass, margins, score}],
      feasible_count: int,
      total_count: int,
      ranked_designs: [...top-10...],
      param_keys: [list of varied params],
      heatmap_data: {  for 2-D grid of top-2 params  }
    }
    """
    extractor = EXTRACTORS.get(sim_type)
    if extractor is None:
        raise ValueError(f"Unknown sim_type: {sim_type}")

    varied_keys = list(param_ranges.keys())

    # Build 1-D sweep arrays for each param
    def _parse_bounds(b):
        if isinstance(b, (list, tuple)):
            return float(b[0]), float(b[1])
        return float(b["min"]), float(b["max"])

    sweep_grids = {}
    for k, bounds in param_ranges.items():
        lo, hi = _parse_bounds(bounds)
        sweep_grids[k] = np.linspace(lo, hi, n_points).tolist()

    # Cartesian product (cap at 1000 total evals)
    all_axes = [sweep_grids[k] for k in varied_keys]
    total = 1
    for ax in all_axes:
        total *= len(ax)
    
    # If too many points, reduce resolution
    if total > 500:
        n_points = max(3, int(500 ** (1 / max(1, len(varied_keys)))))
        for k, bounds in param_ranges.items():
            lo, hi = _parse_bounds(bounds)
            sweep_grids[k] = np.linspace(lo, hi, n_points).tolist()
        all_axes = [sweep_grids[k] for k in varied_keys]

    results = []
    errors = []

    for combo in product(*all_axes):
        params = dict(fixed_params)
        for k, v in zip(varied_keys, combo):
            params[k] = v

        try:
            metrics = extractor(params)
            passed, margins = _check_constraints(metrics, constraints)

            # Composite score: average margin across all constrained metrics
            passing_margins = [m["margin"] for m in margins.values() if m["pass"]]
            all_margins = [m["margin"] for m in margins.values()]
            score = float(np.mean(all_margins)) if all_margins else 0.0

            results.append({
                "params": {k: round(float(v), 5) for k, v in params.items()
                           if k in varied_keys},
                "metrics": {k: round(float(v), 5) if isinstance(v, float) else v
                            for k, v in metrics.items()},
                "pass": passed,
                "margins": margins,
                "score": score,
            })
        except Exception as ex:
            errors.append(str(ex))

    feasible = [r for r in results if r["pass"]]
    ranked   = sorted(feasible, key=lambda r: r["score"], reverse=True)[:10]

    # ── 2-D heatmap data for top 2 params ────────────────────────────────────
    heatmap_data = None
    if len(varied_keys) >= 2:
        k0, k1 = varied_keys[0], varied_keys[1]
        ax0 = sweep_grids[k0]
        ax1 = sweep_grids[k1]
        grid_pass = []
        grid_score = []

        for v0 in ax0:
            row_pass = []
            row_score = []
            for v1 in ax1:
                params = dict(fixed_params)
                params[k0] = v0
                params[k1] = v1
                # Set remaining varied params to midpoint
                for k in varied_keys:
                    if k not in (k0, k1):
                        lo, hi = _parse_bounds(param_ranges[k])
                        params[k] = (lo + hi) / 2

                try:
                    metrics = extractor(params)
                    passed, margins = _check_constraints(metrics, constraints)
                    all_margins = [m["margin"] for m in margins.values()]
                    score = float(np.mean(all_margins)) if all_margins else 0.0
                    row_pass.append(int(passed))
                    row_score.append(round(score, 4))
                except:
                    row_pass.append(0)
                    row_score.append(-1.0)

            grid_pass.append(row_pass)
            grid_score.append(row_score)

        heatmap_data = {
            "x_key": k1,
            "y_key": k0,
            "x_values": [round(v, 4) for v in ax1],
            "y_values": [round(v, 4) for v in ax0],
            "pass_grid": grid_pass,
            "score_grid": grid_score,
        }

    return {
        "sweep_results": results,
        "feasible_count": len(feasible),
        "total_count": len(results),
        "ranked_designs": ranked,
        "param_keys": varied_keys,
        "heatmap_data": heatmap_data,
        "errors": errors[:5],
    }
