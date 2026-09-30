import React, { useEffect } from 'react';
import { Tooltip as ParamTooltip } from '../Tooltip';
import { FeasibilityPanel } from './FeasibilityPanel';
import { checkFeasibility, FEASIBILITY_STATUS } from '../core/feasibility.js';

export const ControlsDrawer = ({
  isOpen,
  simType,
  simulations,
  params,
  paramsRef: _paramsRef,
  setParams,
  onParamDragLive,
  onParamCommit,
  validation,
  loading,
  onRunSimulation,
  onResetDefaults,
  onClose
}) => {
  const [localParams, setLocalParams] = React.useState(params);

  useEffect(() => {
    setLocalParams(params);
  }, [params]);

  const handleSliderInput = (key, rawValue) => {
    const val = parseFloat(rawValue);
    if (!isNaN(val)) {
      setLocalParams(prev => ({ ...prev, [key]: val }));
      if (onParamDragLive) {
        onParamDragLive(key, val);
      } else if (setParams) {
        setParams(p => ({ ...p, [key]: val }));
      }
    }
  };

  const handleSliderCommit = (key, rawValue) => {
    const val = parseFloat(rawValue);
    if (!isNaN(val)) {
      if (onParamCommit) {
        onParamCommit({ [key]: val });
      } else if (setParams) {
        setParams(p => ({ ...p, [key]: val }));
      }
    }
  };

  const handleNumberInput = (key, rawValue) => {
    setLocalParams(prev => ({ ...prev, [key]: rawValue }));
    const val = parseFloat(rawValue);
    if (!isNaN(val) && onParamDragLive) {
      onParamDragLive(key, val);
    }
  };

  const handleNumberCommit = (key, rawValue, min, max) => {
    let parsed = parseFloat(rawValue);
    if (isNaN(parsed)) {
      setLocalParams(prev => ({ ...prev, [key]: params[key] }));
      return;
    }
    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;
    setLocalParams(prev => ({ ...prev, [key]: parsed }));
    if (onParamCommit) {
      onParamCommit({ [key]: parsed });
    } else if (setParams) {
      setParams(p => ({ ...p, [key]: parsed }));
    }
  };
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cfg = simulations[simType];
  if (!cfg) return null;

  const durationCfg = {
    slider_crank: { min: 0.5, max: 15.0, step: 0.5, default: 5.0 },
    four_bar: { min: 1.0, max: 10.0, step: 0.5, default: 5.0 },
    compound_pendulum: { min: 1.0, max: 30.0, step: 1.0, default: 15.0 },
    simple_pendulum: { min: 1.0, max: 30.0, step: 1.0, default: 15.0 },
  }[simType] || { min: 1.0, max: 30.0, step: 1.0, default: 15.0 };

  // Live Kinematic & Assembly Constraints Verification
  const activeParams = localParams || params;
  const feas = checkFeasibility(simType, activeParams);
  const isImpossible = feas.status === FEASIBILITY_STATUS.IMPOSSIBLE;
  const isWarning = feas.status === FEASIBILITY_STATUS.WARNING;
  const isConstrainedOrInvalid = feas.status !== FEASIBILITY_STATUS.OK;
  let grashofInfo = null;

  if (simType === 'four_bar') {
    const d = Number(activeParams.link_ground ?? 4.0);
    const a = Number(activeParams.link_crank ?? 1.0);
    const b = Number(activeParams.link_coupler ?? 2.5);
    const c = Number(activeParams.link_rocker ?? 3.0);

    const linkLengths = [d, a, b, c].sort((x, y) => x - y);
    const S = linkLengths[0];
    const L = linkLengths[3];
    const P = linkLengths[1];
    const Q = linkLengths[2];

    const sumOthers = S + P + Q;
    if (L < sumOthers) {
      const diff = (S + L) - (P + Q);
      if (diff < -1e-5) {
        if (a === S) grashofInfo = { class: 'Class I (Grashof)', type: 'Crank-Rocker' };
        else if (d === S) grashofInfo = { class: 'Class I (Grashof)', type: 'Double-Crank (Drag Link)' };
        else if (b === S) grashofInfo = { class: 'Class I (Grashof)', type: 'Coupler-Driven' };
        else grashofInfo = { class: 'Class I (Grashof)', type: 'Double-Rocker' };
      } else if (Math.abs(diff) <= 1e-5) {
        grashofInfo = { class: 'Change Point Linkage', type: 'Neutral / Singular Bounds' };
      } else {
        grashofInfo = { class: 'Class II (Non-Grashof)', type: 'Triple-Rocker' };
      }
    }
  }


  return (
    <>
      <aside
        className="controls-drawer"
        aria-label="Simulation Controls"
        onPointerDown={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-header-info">
            <div className="drawer-sim-icon">{cfg.icon}</div>
            <div>
              <h2 className="drawer-title">{cfg.label} Controls</h2>
              <span className="drawer-subtitle">Dynamic & Kinematic Parameters</span>
            </div>
          </div>
          <button type="button" className="btn-drawer-close" onClick={onClose} aria-label="Close parameters drawer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          {/* Engineering Feasibility & Dynamic Validation Panel */}
          <FeasibilityPanel simType={simType} params={activeParams} compact={true} />

          {/* Real-time Grashof Classification */}
          {grashofInfo && (
            <div className="controls-grashof-banner">
              <div className="grashof-badge">{grashofInfo.class}</div>
              <div className="grashof-detail">{grashofInfo.type}</div>
            </div>
          )}

          {/* Quick Presets */}
          {cfg.presets && cfg.presets.length > 0 && (
            <div className="controls-section">
              <div className="section-label">Engineering Presets</div>
              <div className="preset-pill-grid">
                {cfg.presets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="preset-pill-btn"
                    onClick={() => {
                      setLocalParams(p => ({ ...p, ...preset.params }));
                      if (onParamCommit) {
                        onParamCommit(preset.params);
                      } else if (setParams) {
                        setParams(p => ({ ...p, ...preset.params }));
                      }
                    }}
                    title={`Apply preset: ${preset.label}`}
                  >
                    <span className="preset-pill-bolt">⚡</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Physical Parameter Sliders + Numeric Inputs */}
          <div className="controls-section">
            <div className="section-label">System Parameters</div>
            <div className="parameters-list">
              {cfg.sliders.map((s) => {
                const currentVal = localParams[s.key] ?? params[s.key] ?? s.min;
                return (
                  <div
                    key={s.key}
                    className="control-param-group"
                    onPointerDown={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    onWheel={e => e.stopPropagation()}
                  >
                    <div className="param-header-row">
                      <ParamTooltip paramKey={s.key}>
                        <span className="param-label-text">{s.label}</span>
                      </ParamTooltip>
                      <div className="param-numeric-box">
                        <input
                          type="number"
                          className="param-num-input"
                          min={s.min}
                          max={s.max}
                          step={s.step}
                          value={currentVal}
                          onChange={(e) => handleNumberInput(s.key, e.target.value)}
                          onBlur={(e) => handleNumberCommit(s.key, e.target.value, s.min, s.max)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleNumberCommit(s.key, e.target.value, s.min, s.max);
                            }
                          }}
                        />
                        <span className="param-unit-tag">{s.unit}</span>
                      </div>
                    </div>

                    <div className="param-slider-wrapper">
                      <input
                        type="range"
                        className="param-range-slider"
                        min={s.min}
                        max={s.max}
                        step={s.step}
                        value={currentVal}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onInput={(e) => handleSliderInput(s.key, e.target.value)}
                        onChange={(e) => handleSliderInput(s.key, e.target.value)}
                        onPointerUp={(e) => handleSliderCommit(s.key, e.target.value)}
                        onMouseUp={(e) => handleSliderCommit(s.key, e.target.value)}
                        onTouchEnd={(e) => handleSliderCommit(s.key, e.target.value)}
                        onKeyUp={(e) => {
                          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                            handleSliderCommit(s.key, e.target.value);
                          }
                        }}
                      />
                      <div className="param-slider-bounds">
                        <span>{s.min}</span>
                        <span>{s.max}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Simulation Time Span */}
          <div className="controls-section">
            <div className="section-label">Simulation Time Span</div>
            <div className="control-param-group">
              <div className="param-header-row">
                <ParamTooltip paramKey="t_max">
                  <span className="param-label-text">Duration (t_max)</span>
                </ParamTooltip>
                <div className="param-numeric-box">
                  <input
                    type="number"
                    className="param-num-input"
                    min={durationCfg.min}
                    max={durationCfg.max}
                    step={durationCfg.step}
                    value={localParams.t_max ?? params.t_max ?? durationCfg.default}
                    onChange={(e) => handleNumberInput('t_max', e.target.value)}
                    onBlur={(e) => handleNumberCommit('t_max', e.target.value, durationCfg.min, durationCfg.max)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleNumberCommit('t_max', e.target.value, durationCfg.min, durationCfg.max);
                      }
                    }}
                  />
                  <span className="param-unit-tag">s</span>
                </div>
              </div>
              <div className="param-slider-wrapper">
                <input
                  type="range"
                  className="param-range-slider"
                  min={durationCfg.min}
                  max={durationCfg.max}
                  step={durationCfg.step}
                  value={localParams.t_max ?? params.t_max ?? durationCfg.default}
                  onInput={(e) => handleSliderInput('t_max', e.target.value)}
                  onChange={(e) => handleSliderInput('t_max', e.target.value)}
                  onPointerUp={(e) => handleSliderCommit('t_max', e.target.value)}
                  onMouseUp={(e) => handleSliderCommit('t_max', e.target.value)}
                  onTouchEnd={(e) => handleSliderCommit('t_max', e.target.value)}
                  onKeyUp={(e) => {
                    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                      handleSliderCommit('t_max', e.target.value);
                    }
                  }}
                />
                <div className="param-slider-bounds">
                  <span>{durationCfg.min} s</span>
                  <span>{durationCfg.max} s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Simulation Indicators (if available) */}
          {validation?.summary && (
            <div className="controls-section">
              <div className="section-label">Key Output Indicators</div>
              <div className="indicators-grid">
                {validation.summary.T_exact && (
                  <div className="indicator-tile">
                    <span className="indicator-label">Theoretical Period</span>
                    <span className="indicator-value">
                      {parseFloat(validation.summary.T_exact).toFixed(3)} <span className="indicator-unit">s</span>
                    </span>
                  </div>
                )}
                {validation.summary.T_numerical && (
                  <div className="indicator-tile">
                    <span className="indicator-label">RK45 Period</span>
                    <span className="indicator-value">
                      {parseFloat(validation.summary.T_numerical).toFixed(3)} <span className="indicator-unit">s</span>
                    </span>
                  </div>
                )}
                {validation.summary.energy_conservation && (
                  <div className="indicator-tile">
                    <span className="indicator-label">{Number(params?.damping) > 0 ? 'Energy State' : 'Energy Conservation'}</span>
                    <span className={`indicator-status ${Number(params?.damping) > 0 ? 'pass' : validation.summary.energy_conservation === 'PASS' ? 'pass' : 'fail'}`}>
                      {Number(params?.damping) > 0 ? '✓ DISSIPATIVE (Damped)' : validation.summary.energy_conservation === 'PASS' ? '✓ CONSERVED' : '✗ UNCONSERVED'}
                    </span>
                  </div>
                )}
                {validation.summary.stroke && (
                  <div className="indicator-tile">
                    <span className="indicator-label">Piston Stroke</span>
                    <span className="indicator-value">
                      {parseFloat(validation.summary.stroke).toFixed(3)} <span className="indicator-unit">m</span>
                    </span>
                  </div>
                )}
                {validation.summary.v_max && (
                  <div className="indicator-tile">
                    <span className="indicator-label">Max Linear Vel</span>
                    <span className="indicator-value">
                      {parseFloat(validation.summary.v_max).toFixed(2)} <span className="indicator-unit">m/s</span>
                    </span>
                  </div>
                )}
                {validation.summary.a_max && (
                  <div className="indicator-tile">
                    <span className="indicator-label">Max Linear Accel</span>
                    <span className="indicator-value">
                      {parseFloat(validation.summary.a_max).toFixed(1)} <span className="indicator-unit">m/s²</span>
                    </span>
                  </div>
                )}
                {validation.summary.rocker_range_deg && (
                  <div className="indicator-tile">
                    <span className="indicator-label">Rocker Range</span>
                    <span className="indicator-value">
                      {parseFloat(validation.summary.rocker_range_deg).toFixed(1)} <span className="indicator-unit">°</span>
                    </span>
                  </div>
                )}
                {validation.summary.grashof_condition && (
                  <div className="indicator-tile">
                    <span className="indicator-label">Grashof Type</span>
                    <span className="indicator-value grashof">{validation.summary.grashof_condition}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="drawer-footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isConstrainedOrInvalid && (
            <div style={{
              background: isImpossible ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              border: `1.5px solid ${isImpossible ? '#EF4444' : '#F59E0B'}`,
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '11px',
              color: '#1E293B',
              lineHeight: 1.45
            }}>
              <div style={{ fontWeight: 800, color: isImpossible ? '#DC2626' : '#D97706', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
                <span>{isImpossible ? '⛔' : '⚠️'}</span>
                <span>{feas.title}</span>
              </div>
              <div style={{ marginTop: '3px', color: '#334155', fontWeight: 500 }}>
                {feas.summary}
              </div>
              {feas.checks?.[0]?.fix?.[0] && (
                <div style={{ marginTop: '5px', fontSize: '10.5px', color: isImpossible ? '#DC2626' : '#1D4ED8', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                  <span>💡</span>
                  <span>{feas.checks[0].fix[0]}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="btn-drawer-secondary"
              onClick={onResetDefaults}
              style={{ flex: 1 }}
            >
              Reset Defaults
            </button>
            <button
              type="button"
              className="btn-drawer-primary"
              onClick={() => {
                if (isImpossible) return;
                onRunSimulation();
                onClose();
              }}
              disabled={loading || isImpossible}
              style={{
                flex: 2,
                opacity: isImpossible ? 0.6 : 1,
                cursor: isImpossible ? 'not-allowed' : 'pointer'
              }}
              title={isImpossible ? `Cannot run: ${feas.title}. Please resolve geometric constraints.` : isWarning ? `Run simulation (Note: ${feas.summary})` : 'Apply parameters and run simulation'}
            >
              {loading ? 'Computing...' : isImpossible ? 'Infeasible (Cannot Run)' : isWarning ? 'Run Simulation ⚠️' : 'Run Simulation ▶'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
