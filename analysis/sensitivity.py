"""
Sensitivity Analysis Mode — backend/analysis/sensitivity.py

Quantifies the effect of each parameter on the simulation outputs.
Uses a One-At-a-Time (OAT) perturbation method.

Calculates normalized sensitivity index:
  S_i = (Δoutput / output_base) / (Δparam / param_base)

Delegates to existing simulation engine in mechanics.py.
"""

import numpy as np
import copy

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

# Reuse the extractors from design.py
from analysis.design import EXTRACTORS


def run_sensitivity(sim_type, base_params, perturbation_pct, param_keys):
    """
    Perform OAT sensitivity analysis.

    Parameters
    ----------
    sim_type         : str
    base_params      : {param_key: value} — the nominal design
    perturbation_pct : float — e.g. 5.0 for ±5%
    param_keys       : list of str — which params to perturb

    Returns
    -------
    {
      base_metrics: dict,
      sensitivities: { metric_key: { param_key: sensitivity_index } },
      ranked_params: { metric_key: [param_keys sorted by impact] },
      tornado_data: { metric_key: [{param, pos_impact, neg_impact}] }
    }
    """
    extractor = EXTRACTORS.get(sim_type)
    if extractor is None:
        raise ValueError(f"Unknown sim_type: {sim_type}")

    dp = float(perturbation_pct) / 100.0

    # 1. Base simulation
    try:
        base_metrics = extractor(base_params)
    except Exception as e:
        raise RuntimeError(f"Base simulation failed: {str(e)}")

    metric_keys = list(base_metrics.keys())
    
    # Filter out non-numeric metrics (like grashof string)
    numeric_metrics = []
    for k, v in base_metrics.items():
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            numeric_metrics.append(k)

    sensitivities = {m: {} for m in numeric_metrics}
    tornado_data = {m: [] for m in numeric_metrics}

    # 2. Perturb each parameter
    for p_key in param_keys:
        p_base = base_params.get(p_key)
        if p_base is None or p_base == 0:
            # Skip or handle zero base
            if p_base == 0:
                p_base = 1e-6
            else:
                continue
                
        # Perturb UP
        params_up = copy.deepcopy(base_params)
        params_up[p_key] = p_base * (1.0 + dp)
        
        # Perturb DOWN
        params_dn = copy.deepcopy(base_params)
        params_dn[p_key] = p_base * (1.0 - dp)
        
        try:
            metrics_up = extractor(params_up)
            metrics_dn = extractor(params_dn)
            
            for m_key in numeric_metrics:
                m_base = base_metrics[m_key]
                m_up = metrics_up.get(m_key, m_base)
                m_dn = metrics_dn.get(m_key, m_base)
                
                # Absolute impacts
                impact_pos = (m_up - m_base)
                impact_neg = (m_dn - m_base)
                
                # Central difference sensitivity index (normalized)
                if m_base != 0:
                    dm_norm = (m_up - m_dn) / abs(m_base)
                    dp_norm = (params_up[p_key] - params_dn[p_key]) / abs(p_base)
                    S_i = dm_norm / dp_norm if dp_norm != 0 else 0
                else:
                    S_i = (m_up - m_dn) / ((params_up[p_key] - params_dn[p_key]) / abs(p_base)) if p_base != 0 else 0
                
                sensitivities[m_key][p_key] = float(S_i)
                
                tornado_data[m_key].append({
                    "param": p_key,
                    "pos_impact": float(impact_pos),
                    "neg_impact": float(impact_neg),
                    "abs_max_impact": float(max(abs(impact_pos), abs(impact_neg))),
                    "S_i": float(S_i)
                })
                
        except Exception as e:
            # If perturbation fails, record zero sensitivity
            for m_key in numeric_metrics:
                sensitivities[m_key][p_key] = 0.0
                tornado_data[m_key].append({
                    "param": p_key,
                    "pos_impact": 0.0,
                    "neg_impact": 0.0,
                    "abs_max_impact": 0.0,
                    "S_i": 0.0
                })

    # 3. Sort tornado data and rank parameters
    ranked_params = {}
    for m_key in numeric_metrics:
        # Sort by absolute max impact (descending)
        tornado_data[m_key].sort(key=lambda x: x["abs_max_impact"], reverse=True)
        ranked_params[m_key] = [x["param"] for x in tornado_data[m_key]]

    return {
        "base_metrics": {k: float(v) if isinstance(v, (int, float)) else v for k, v in base_metrics.items()},
        "sensitivities": sensitivities,
        "ranked_params": ranked_params,
        "tornado_data": tornado_data,
        "metric_keys": numeric_metrics,
        "param_keys": param_keys
    }
