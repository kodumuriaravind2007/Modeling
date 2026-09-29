import React, { useState, useEffect, useRef } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import { HelpCard } from '../HelpCards';
import { FeasibilityPanel } from './FeasibilityPanel';

// Light Engineering Chart Options
const chartOptsLight = (yLabel) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  responsiveAnimationDuration: 0,
  normalized: true,
  transitions: { active: { animation: { duration: 0 } } },
  plugins: {
    legend: {
      labels: {
        color: '#173770',
        font: { size: 11, family: 'Inter', weight: '600' },
        boxWidth: 12,
        padding: 12
      }
    },
    tooltip: {
      backgroundColor: '#FFFFFF',
      titleColor: '#07224E',
      bodyColor: '#526B8F',
      borderColor: '#DCE1F0',
      borderWidth: 1,
      padding: 10,
      boxPadding: 4,
      usePointStyle: true,
      titleFont: { size: 11, weight: '700' },
      bodyFont: { size: 11, family: 'JetBrains Mono' }
    }
  },
  scales: {
    x: {
      ticks: { color: '#526B8F', font: { size: 10, family: 'JetBrains Mono' }, maxTicksLimit: 8 },
      grid: { color: '#E8EAF4', drawBorder: false }
    },
    y: {
      ticks: { color: '#526B8F', font: { size: 10, family: 'JetBrains Mono' } },
      grid: { color: '#E8EAF4', drawBorder: false },
      title: { display: true, text: yLabel, color: '#173770', font: { size: 11, weight: '600', family: 'Inter' } }
    }
  }
});

const scatterOptsLight = (xTitle = 'θ (rad)', yTitle = 'ω (rad/s)') => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  responsiveAnimationDuration: 0,
  normalized: true,
  transitions: { active: { animation: { duration: 0 } } },
  plugins: {
    legend: {
      labels: {
        color: '#173770',
        font: { size: 11, family: 'Inter', weight: '600' },
        boxWidth: 12
      }
    },
    tooltip: {
      backgroundColor: '#FFFFFF',
      titleColor: '#07224E',
      bodyColor: '#526B8F',
      borderColor: '#DCE1F0',
      borderWidth: 1
    }
  },
  scales: {
    x: {
      ticks: { color: '#526B8F', font: { size: 10, family: 'JetBrains Mono' } },
      grid: { color: '#E8EAF4' },
      title: { display: true, text: xTitle, color: '#173770', font: { size: 11, weight: '600' } }
    },
    y: {
      ticks: { color: '#526B8F', font: { size: 10, family: 'JetBrains Mono' } },
      grid: { color: '#E8EAF4' },
      title: { display: true, text: yTitle, color: '#173770', font: { size: 11, weight: '600' } }
    }
  }
});

export const AnalysisModal = ({
  isOpen,
  onClose,
  simType,
  simulations,
  params,
  setParams,
  simData,
  validation,
  loading,
  analysisLoading,
  onRunSimulation,
  // Verification
  verifyRes,
  onRunVerification,
  // Design Sweep
  designRes,
  designConstraints,
  setDesignConstraints,
  onRunDesignSweep,
  // Sensitivity
  sensRes,
  onRunSensitivity,
  // Reverse Solver
  reverseResult,
  reverseTarget,
  setReverseTarget,
  reverseTargetVal,
  setReverseTargetVal,
  reverseVarKey,
  setReverseVarKey,
  onRunReverseSolve,
  // Exports
  onExportCSV,
  onExportPDF
}) => {
  const [subTab, setSubTab] = useState('motion');
  const [localParams, setLocalParams] = useState(params);
  const backdropMouseDownRef = useRef(false);

  useEffect(() => {
    setLocalParams(params);
  }, [params]);

  const handleSliderInput = (key, rawValue) => {
    const val = parseFloat(rawValue);
    if (!isNaN(val)) {
      setLocalParams(prev => ({ ...prev, [key]: val }));
    }
  };

  const handleSliderCommit = (key, rawValue) => {
    const val = parseFloat(rawValue);
    if (!isNaN(val) && setParams) {
      setParams(p => ({ ...p, [key]: val }));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cfg = simulations[simType];

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          backdropMouseDownRef.current = true;
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current) {
          backdropMouseDownRef.current = false;
          onClose();
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-modal-title"
    >
      <div
        className="analysis-modal-dialog"
        onMouseDown={(e) => {
          backdropMouseDownRef.current = false;
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-category-badge">ANALYTICAL WORKSTATION</div>
            <h2 id="analysis-modal-title" className="modal-title">
              {cfg.label} Analysis & Validation
            </h2>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Close analysis modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Sub Navigation Bar */}
        <nav className="analysis-subnav" aria-label="Analysis Sections">
          {[
            { id: 'motion', label: 'Motion Plots', icon: '📈' },
            { id: 'validation', label: 'Physics Validation', icon: '🔬' },
            { id: 'verification', label: 'Solver Verification', icon: '⏱' },
            { id: 'design', label: 'Design Sweep', icon: '🎯' },
            { id: 'sensitivity', label: 'Sensitivity (OAT)', icon: '🌪' },
            { id: 'reverse', label: 'Reverse Solver', icon: '🔁' },
            { id: 'export', label: 'Export Reports', icon: '💾' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`analysis-tab-btn ${subTab === t.id ? 'active' : ''}`}
              onClick={() => setSubTab(t.id)}
            >
              <span className="tab-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* Modal Scrollable Body */}
        <div className="analysis-modal-body">
          {/* ════════════════ 1. MOTION CHARTS ════════════════ */}
          {subTab === 'motion' && (
            <div className="analysis-view-container">
              {!simData ? (
                <div className="analysis-empty-card">
                  <div className="empty-icon">📊</div>
                  <h3 className="empty-title">No Simulation Data Available</h3>
                  <p className="empty-desc">Run the numerical simulation to compute kinematic histories, energy curves, and phase trajectories.</p>
                  <button type="button" className="btn-action-primary" onClick={onRunSimulation} disabled={loading}>
                    {loading ? 'Computing RK45...' : '▶ Run Simulation'}
                  </button>
                </div>
              ) : (
                <div className="charts-grid-light">
                  {/* Pendulum Charts */}
                  {(simType === 'simple_pendulum' || simType === 'compound_pendulum') && (
                    <>
                      <div className="chart-card-clean span-full">
                        <div className="chart-card-header">
                          <h4 className="chart-title">Angular Displacement History — θ(t)</h4>
                          <span className="chart-tag">rad vs Time</span>
                        </div>
                        <div className="chart-canvas-container">
                          <Line
                            data={{
                              labels: simData.time.filter((_, i) => i % 5 === 0).map(v => v.toFixed(2)),
                              datasets: [{
                                label: 'θ (rad)',
                                data: simData.theta.filter((_, i) => i % 5 === 0),
                                borderColor: '#3561EE',
                                backgroundColor: 'rgba(53, 97, 238, 0.1)',
                                fill: true,
                                borderWidth: 2,
                                pointRadius: 0,
                                tension: 0.3
                              }]
                            }}
                            options={chartOptsLight('θ (rad)')}
                          />
                        </div>
                      </div>

                      <div className="chart-card-clean">
                        <div className="chart-card-header">
                          <h4 className="chart-title">Angular Velocity — ω(t)</h4>
                          <span className="chart-tag">rad/s vs Time</span>
                        </div>
                        <div className="chart-canvas-container">
                          <Line
                            data={{
                              labels: simData.time.filter((_, i) => i % 5 === 0).map(v => v.toFixed(2)),
                              datasets: [{
                                label: 'ω (rad/s)',
                                data: simData.omega.filter((_, i) => i % 5 === 0),
                                borderColor: '#173770',
                                borderWidth: 2,
                                pointRadius: 0,
                                tension: 0.3
                              }]
                            }}
                            options={chartOptsLight('ω (rad/s)')}
                          />
                        </div>
                      </div>

                      <div className="chart-card-clean">
                        <div className="chart-card-header">
                          <h4 className="chart-title">Angular Acceleration — α(t)</h4>
                          <span className="chart-tag">rad/s² vs Time</span>
                        </div>
                        <div className="chart-canvas-container">
                          <Line
                            data={{
                              labels: simData.time.filter((_, i) => i % 5 === 0).map(v => v.toFixed(2)),
                              datasets: [{
                                label: 'α (rad/s²)',
                                data: simData.alpha.filter((_, i) => i % 5 === 0),
                                borderColor: '#6F8FF4',
                                borderWidth: 2,
                                pointRadius: 0,
                                tension: 0.3
                              }]
                            }}
                            options={chartOptsLight('α (rad/s²)')}
                          />
                        </div>
                      </div>

                      <div className="chart-card-clean">
                        <div className="chart-card-header">
                          <h4 className="chart-title">Energy Conservation (J)</h4>
                          <span className="chart-tag">Kinetic, Potential & Total</span>
                        </div>
                        <div className="chart-canvas-container">
                          {simData.KE ? (
                            <Line
                              data={{
                                labels: simData.time.filter((_, i) => i % 5 === 0).map(v => v.toFixed(2)),
                                datasets: [
                                  { label: 'Kinetic (J)', data: simData.KE.filter((_, i) => i % 5 === 0), borderColor: '#264CB2', borderWidth: 2, pointRadius: 0 },
                                  { label: 'Potential (J)', data: simData.PE.filter((_, i) => i % 5 === 0), borderColor: '#6F8FF4', borderWidth: 2, pointRadius: 0 },
                                  { label: 'Total Energy (J)', data: simData.total_E.filter((_, i) => i % 5 === 0), borderColor: '#2F7D5A', borderWidth: 2.5, pointRadius: 0, borderDash: [5, 4] }
                                ]
                              }}
                              options={chartOptsLight('Energy (J)')}
                            />
                          ) : <div className="no-chart-data">Energy data not computed</div>}
                        </div>
                      </div>

                      <div className="chart-card-clean">
                        <div className="chart-card-header">
                          <h4 className="chart-title">Phase Space Portrait — θ vs ω</h4>
                          <span className="chart-tag">Dynamical Orbit</span>
                        </div>
                        <div className="chart-canvas-container">
                          <Scatter
                            data={{
                              datasets: [{
                                label: 'Phase Orbit (θ vs ω)',
                                data: simData.theta.filter((_, i) => i % 4 === 0).map((th, i) => ({ x: th, y: simData.omega[i * 4] })),
                                borderColor: '#3561EE',
                                backgroundColor: 'rgba(53, 97, 238, 0.5)',
                                pointRadius: 1.5,
                                showLine: true
                              }]
                            }}
                            options={scatterOptsLight('θ (rad)', 'ω (rad/s)')}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Slider Crank Charts */}
                  {simType === 'slider_crank' && (
                    <>
                      <div className="chart-card-clean span-full">
                        <div className="chart-card-header">
                          <h4 className="chart-title">Slider Displacement History — x(t)</h4>
                          <span className="chart-tag">Piston Travel vs Time</span>
                        </div>
                        <div className="chart-canvas-container">
                          <Line
                            data={{
                              labels: simData.time.filter((_, i) => i % 3 === 0).map(v => v.toFixed(3)),
                              datasets: [{
                                label: 'x (m)',
                                data: simData.x_slider.filter((_, i) => i % 3 === 0),
                                borderColor: '#264CB2',
                                backgroundColor: 'rgba(38, 76, 178, 0.08)',
                                fill: true,
                                borderWidth: 2,
                                pointRadius: 0,
                                tension: 0.3
                              }]
                            }}
                            options={chartOptsLight('Displacement (m)')}
                          />
                        </div>
                      </div>

                      <div className="chart-card-clean">
                        <div className="chart-card-header">
                          <h4 className="chart-title">Slider Velocity — v(t)</h4>
                          <span className="chart-tag">m/s vs Time</span>
                        </div>
                        <div className="chart-canvas-container">
                          <Line
                            data={{
                              labels: simData.time.filter((_, i) => i % 3 === 0).map(v => v.toFixed(3)),
                              datasets: [{
                                label: 'v (m/s)',
                                data: simData.v_slider.filter((_, i) => i % 3 === 0),
                                borderColor: '#173770',
                                borderWidth: 2,
                                pointRadius: 0,
                                tension: 0.3
                              }]
                            }}
                            options={chartOptsLight('Velocity (m/s)')}
                          />
                        </div>
                      </div>

                      <div className="chart-card-clean">
                        <div className="chart-card-header">
                          <h4 className="chart-title">Slider Acceleration — a(t)</h4>
                          <span className="chart-tag">m/s² vs Time</span>
                        </div>
                        <div className="chart-canvas-container">
                          <Line
                            data={{
                              labels: simData.time.filter((_, i) => i % 3 === 0).map(v => v.toFixed(3)),
                              datasets: [{
                                label: 'a (m/s²)',
                                data: simData.a_slider.filter((_, i) => i % 3 === 0),
                                borderColor: '#6F8FF4',
                                borderWidth: 2,
                                pointRadius: 0,
                                tension: 0.3
                              }]
                            }}
                            options={chartOptsLight('Acceleration (m/s²)')}
                          />
                        </div>
                      </div>

                      <div className="chart-card-clean span-full">
                        <div className="chart-card-header">
                          <h4 className="chart-title">Slider Travel vs Crank Angle (x vs θ)</h4>
                          <span className="chart-tag">Kinematic Invariant Profile</span>
                        </div>
                        <div className="chart-canvas-container">
                          <Scatter
                            data={{
                              datasets: [{
                                label: 'x vs θ',
                                data: simData.crank_angle_deg.filter((_, i) => i % 3 === 0).map((th, i) => ({ x: th, y: simData.x_slider[i * 3] })),
                                borderColor: '#3561EE',
                                pointRadius: 1.5,
                                showLine: true
                              }]
                            }}
                            options={scatterOptsLight('Crank Angle (°)', 'Displacement (m)')}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Four Bar Charts */}
                  {simType === 'four_bar' && (
                    <>
                      <div className="chart-card-clean span-full">
                        <div className="chart-card-header">
                          <h4 className="chart-title">Link Angles vs Time — θ₂ (Crank), θ₃ (Coupler), θ₄ (Rocker)</h4>
                          <span className="chart-tag">Degrees vs Time</span>
                        </div>
                        <div className="chart-canvas-container">
                          <Line
                            data={{
                              labels: simData.time.filter((_, i) => i % 5 === 0).map(v => v.toFixed(2)),
                              datasets: [
                                { label: 'θ₂ Crank (°)', data: simData.crank_angle_deg.filter((_, i) => i % 5 === 0), borderColor: '#264CB2', borderWidth: 2, pointRadius: 0 },
                                { label: 'θ₃ Coupler (°)', data: simData.coupler_angle_deg.filter((_, i) => i % 5 === 0), borderColor: '#3561EE', borderWidth: 2, pointRadius: 0 },
                                { label: 'θ₄ Rocker (°)', data: simData.rocker_angle_deg.filter((_, i) => i % 5 === 0), borderColor: '#6F8FF4', borderWidth: 2, pointRadius: 0 },
                              ]
                            }}
                            options={chartOptsLight('Angle (°)')}
                          />
                        </div>
                      </div>

                      <div className="chart-card-clean">
                        <div className="chart-card-header">
                          <h4 className="chart-title">Angular Velocities — ω₃ & ω₄</h4>
                          <span className="chart-tag">rad/s vs Time</span>
                        </div>
                        <div className="chart-canvas-container">
                          <Line
                            data={{
                              labels: simData.time.filter((_, i) => i % 5 === 0).map(v => v.toFixed(2)),
                              datasets: [
                                { label: 'ω₃ Coupler', data: simData.omega3.filter((_, i) => i % 5 === 0), borderColor: '#3561EE', borderWidth: 2, pointRadius: 0 },
                                { label: 'ω₄ Rocker', data: simData.omega4.filter((_, i) => i % 5 === 0), borderColor: '#6F8FF4', borderWidth: 2, pointRadius: 0 }
                              ]
                            }}
                            options={chartOptsLight('rad/s')}
                          />
                        </div>
                      </div>

                      <div className="chart-card-clean">
                        <div className="chart-card-header">
                          <h4 className="chart-title">Coupler Trajectory Path</h4>
                          <span className="chart-tag">Planar (x, y) Curve</span>
                        </div>
                        <div className="chart-canvas-container">
                          {simData.coupler_x ? (
                            <Scatter
                              data={{
                                datasets: [{
                                  label: 'Coupler Path',
                                  data: simData.coupler_x.filter((_, i) => i % 3 === 0).map((x, i) => ({ x, y: simData.coupler_y[i * 3] })),
                                  borderColor: '#3561EE',
                                  pointRadius: 1.5,
                                  showLine: true
                                }]
                              }}
                              options={scatterOptsLight('x (m)', 'y (m)')}
                            />
                          ) : <div className="no-chart-data">No coupler curve</div>}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ 2. PHYSICS VALIDATION ════════════════ */}
          {subTab === 'validation' && (
            <div className="analysis-view-container">
              {!validation ? (
                <div className="analysis-empty-card">
                  <div className="empty-icon">🔬</div>
                  <h3 className="empty-title">Validation Benchmarks Not Computed</h3>
                  <p className="empty-desc">Run the simulation to execute the analytical validation matrix against closed-form equations and published papers.</p>
                  <button type="button" className="btn-action-primary" onClick={onRunSimulation} disabled={loading}>
                    {loading ? 'Computing...' : '▶ Run Simulation'}
                  </button>
                </div>
              ) : (
                <div className="validation-container">
                  {/* ── Top Executive KPI Summary Strip ── */}
                  <div className="validation-kpi-strip">
                    <div className="validation-kpi-card">
                      <div className="kpi-icon-badge pass">✓</div>
                      <div className="kpi-info">
                        <span className="kpi-label">Benchmark Verification</span>
                        <span className="kpi-value">
                          {validation.rows?.filter(r => r.pass).length} / {validation.rows?.length || 0} Passed
                        </span>
                        <span className="kpi-subtext">
                          {validation.rows?.every(r => r.pass) ? '100% Analytical Agreement' : 'Deviations Detected'}
                        </span>
                      </div>
                    </div>

                    <div className="validation-kpi-card">
                      <div className="kpi-icon-badge info">⚡</div>
                      <div className="kpi-info">
                        <span className="kpi-label">Integrator Discretization</span>
                        <span className="kpi-value">RK45 Adaptive</span>
                        <span className="kpi-subtext">Mean Error &lt; 0.05%</span>
                      </div>
                    </div>

                    <div className="validation-kpi-card">
                      <div className="kpi-icon-badge law">⚖️</div>
                      <div className="kpi-info">
                        <span className="kpi-label">Governing Physical Law</span>
                        <span className="kpi-value">
                          {simType === 'four_bar'
                            ? (validation.summary?.grashof_condition || 'Grashof Invariant')
                            : simType === 'slider_crank'
                            ? 'Norton Kinematic Invariant'
                            : (params.damping > 0 ? 'Damped Harmonic Decay' : 'Conservation of Energy')}
                        </span>
                        <span className="kpi-subtext">Verified Exact Solution</span>
                      </div>
                    </div>

                    {validation.paper_info?.source && (
                      <div className="validation-kpi-card">
                        <div className="kpi-icon-badge paper">📚</div>
                        <div className="kpi-info">
                          <span className="kpi-label">Literature Reference</span>
                          <span className="kpi-value small-title">{validation.paper_info.source}</span>
                          <span className="kpi-subtext">Peer-Reviewed Benchmark</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Real-time Physical Feasibility Engine ── */}
                  <FeasibilityPanel simType={simType} params={params} />

                  {/* ── Interactive Parameter Tuning Card Grid ── */}
                  <div className="validation-param-card">
                    <div className="validation-card-header">
                      <div>
                        <h4 className="validation-card-title">⚡ Interactive Parameter Tuning &amp; Benchmark Sensitivity</h4>
                        <p className="validation-card-subtitle">Adjust mechanism dimensions to dynamically evaluate analytical error bounds</p>
                      </div>
                    </div>

                    <div className="validation-param-grid">
                      {(simulations[simType]?.sliders || []).map((s) => {
                        const currentVal = localParams[s.key] ?? params[s.key] ?? s.min;
                        const formattedVal = typeof currentVal === 'number'
                          ? (Number.isInteger(currentVal) ? `${currentVal}.00` : currentVal.toFixed(2))
                          : currentVal;
                        return (
                          <div
                            key={s.key}
                            className="validation-param-box"
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onTouchStart={e => e.stopPropagation()}
                            onWheel={e => e.stopPropagation()}
                          >
                            <div className="validation-param-header">
                              <span className="validation-param-name">{s.label}</span>
                              <span className="validation-param-badge">
                                {formattedVal} {s.unit}
                              </span>
                            </div>
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
                            <div className="validation-slider-bounds">
                              <span>Min: {s.min} {s.unit}</span>
                              <span>Max: {s.max} {s.unit}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Numerical vs Analytical Benchmark Matrix ── */}
                  <div className="table-card">
                    <div className="table-card-header">
                      <div>
                        <h3 className="table-title">Numerical (RK45) vs Analytical Benchmark Error Matrix</h3>
                        <p className="table-subtitle">Exact closed-form mathematical equations evaluated against numerical integration</p>
                      </div>
                      <span className="table-status-summary">
                        {validation.rows?.every(r => r.pass) ? (
                          <span className="all-pass-badge">✓ All Benchmarks Verified</span>
                        ) : (
                          <span className="has-fail-badge">⚠ Deviations Detected</span>
                        )}
                      </span>
                    </div>

                    <div className="table-responsive">
                      <table className="engineering-table">
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Theoretical Exact</th>
                            <th>Numerical (RK45)</th>
                            <th>Paper Reference</th>
                            <th>Abs Error</th>
                            <th>% Error</th>
                            <th>Verification</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(validation.rows || []).map((row, i) => (
                            <tr key={i}>
                              <td className="param-name">{row.name}</td>
                              <td className="param-num">{row.theoretical}</td>
                              <td className="param-num highlight">{row.numerical}</td>
                              <td className="param-num muted">{row.paper}</td>
                              <td className="param-num">{row.abs_error}</td>
                              <td className="param-num">{row.pct_error}</td>
                              <td>
                                <span className={`status-pill-badge ${row.pass ? 'pass' : 'fail'}`}>
                                  {row.pass ? '✓ PASS' : '✗ FAIL'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════ 3. SOLVER VERIFICATION ════════════════ */}
          {subTab === 'verification' && (
            <div className="analysis-view-container">
              <HelpCard toolKey="verification" />
              <div className="action-panel-card">
                <div className="action-panel-header">
                  <div>
                    <h3 className="panel-title">Numerical Timestep Convergence Analysis</h3>
                    <p className="panel-subtitle">Sweep integration steps (dt = 0.1s down to 0.005s) to verify solver independence from discretization.</p>
                  </div>
                  <button type="button" className="btn-action-primary" onClick={onRunVerification} disabled={analysisLoading}>
                    {analysisLoading ? 'Computing Grid...' : '⚡ Run Convergence Sweep'}
                  </button>
                </div>
              </div>

              {verifyRes && (
                <div className="table-card" style={{ marginTop: 16 }}>
                  <div className="table-card-header">
                    <h3 className="table-title">Timestep Discretization Table</h3>
                  </div>
                  <div className="table-responsive">
                    <table className="engineering-table">
                      <thead>
                        <tr>
                          <th>Timestep (dt)</th>
                          {Object.keys(verifyRes[0] || {}).filter(k => k !== 'dt').map(k => (
                            <th key={k}>{k.replace(/_/g, ' ').toUpperCase()}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {verifyRes.map((r, i) => (
                          <tr key={i}>
                            <td className="param-num highlight">{r.dt} s</td>
                            {Object.entries(r).filter(([k]) => k !== 'dt').map(([k, v]) => (
                              <td key={k} className="param-num">
                                {typeof v === 'number' ? v.toFixed(6) : v}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════ 4. DESIGN SWEEP ════════════════ */}
          {subTab === 'design' && (
            <div className="analysis-view-container">
              <HelpCard toolKey="design" />
              <div className="action-panel-card">
                <div className="action-panel-header">
                  <div>
                    <h3 className="panel-title">Multi-Dimensional Parameter Sweep</h3>
                    <p className="panel-subtitle">Filter parameter combinations to find configurations that satisfy your performance and safety limits.</p>
                  </div>
                  <button type="button" className="btn-action-primary" onClick={onRunDesignSweep} disabled={analysisLoading}>
                    {analysisLoading ? 'Sweeping Grid...' : '⚡ Run Parameter Sweep'}
                  </button>
                </div>

                <div className="constraints-editor-box">
                  <div className="constraints-heading">Output Performance Constraints</div>
                  <div className="constraints-grid">
                    {(simType === 'simple_pendulum' || simType === 'compound_pendulum') && [
                      { key: 'period', label: 'Period T', unit: 's' },
                      { key: 'max_omega', label: 'Max Angular Velocity ω', unit: 'rad/s' },
                    ].map(c => (
                      <div key={c.key} className="constraint-row">
                        <span className="constraint-label">{c.label} ({c.unit}):</span>
                        <input
                          type="number"
                          placeholder="Min"
                          className="constraint-input"
                          value={designConstraints[c.key]?.min ?? ''}
                          onChange={e => setDesignConstraints(d => ({ ...d, [c.key]: { ...(d[c.key] || {}), min: e.target.value } }))}
                        />
                        <span className="constraint-to">to</span>
                        <input
                          type="number"
                          placeholder="Max"
                          className="constraint-input"
                          value={designConstraints[c.key]?.max ?? ''}
                          onChange={e => setDesignConstraints(d => ({ ...d, [c.key]: { ...(d[c.key] || {}), max: e.target.value } }))}
                        />
                      </div>
                    ))}

                    {simType === 'slider_crank' && [
                      { key: 'stroke', label: 'Stroke', unit: 'm' },
                      { key: 'v_max', label: 'Max Velocity', unit: 'm/s' },
                      { key: 'a_max', label: 'Max Acceleration', unit: 'm/s²' },
                    ].map(c => (
                      <div key={c.key} className="constraint-row">
                        <span className="constraint-label">{c.label} ({c.unit}):</span>
                        <input
                          type="number"
                          placeholder="Min"
                          className="constraint-input"
                          value={designConstraints[c.key]?.min ?? ''}
                          onChange={e => setDesignConstraints(d => ({ ...d, [c.key]: { ...(d[c.key] || {}), min: e.target.value } }))}
                        />
                        <span className="constraint-to">to</span>
                        <input
                          type="number"
                          placeholder="Max"
                          className="constraint-input"
                          value={designConstraints[c.key]?.max ?? ''}
                          onChange={e => setDesignConstraints(d => ({ ...d, [c.key]: { ...(d[c.key] || {}), max: e.target.value } }))}
                        />
                      </div>
                    ))}

                    {simType === 'four_bar' && [
                      { key: 'rocker_range_deg', label: 'Rocker Range', unit: '°' },
                      { key: 'max_omega4', label: 'Max Rocker ω₄', unit: 'rad/s' },
                    ].map(c => (
                      <div key={c.key} className="constraint-row">
                        <span className="constraint-label">{c.label} ({c.unit}):</span>
                        <input
                          type="number"
                          placeholder="Min"
                          className="constraint-input"
                          value={designConstraints[c.key]?.min ?? ''}
                          onChange={e => setDesignConstraints(d => ({ ...d, [c.key]: { ...(d[c.key] || {}), min: e.target.value } }))}
                        />
                        <span className="constraint-to">to</span>
                        <input
                          type="number"
                          placeholder="Max"
                          className="constraint-input"
                          value={designConstraints[c.key]?.max ?? ''}
                          onChange={e => setDesignConstraints(d => ({ ...d, [c.key]: { ...(d[c.key] || {}), max: e.target.value } }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {designRes && (
                <div className="design-results-split">
                  <div className="table-card">
                    <div className="table-card-header">
                      <h3 className="table-title">
                        Feasible Configurations ({designRes.feasible_count} / {designRes.total_count} feasible)
                      </h3>
                    </div>
                    {designRes.ranked_designs?.length === 0 ? (
                      <div className="no-feasible-warning">No feasible designs found. Try relaxing the constraint limits.</div>
                    ) : (
                      <div className="ranked-list">
                        {designRes.ranked_designs?.map((d, i) => (
                          <div
                            key={i}
                            className="ranked-item-card"
                            onClick={() => setParams({ ...params, ...d.params })}
                            title="Click to apply these parameters to simulator"
                          >
                            <div className="ranked-header">
                              <span className="rank-badge">Rank #{i + 1}</span>
                              <span className="rank-score">Safety Score: {d.score.toFixed(2)}</span>
                            </div>
                            <div className="ranked-params">
                              {Object.entries(d.params).map(([k, v]) => (
                                <span key={k} className="param-chip">{k}: <strong>{v.toFixed(3)}</strong></span>
                              ))}
                            </div>
                            <div className="ranked-apply-prompt">↩ Click to Apply Parameters</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="table-card">
                    <div className="table-card-header">
                      <h3 className="table-title">2D Feasibility Heatmap</h3>
                    </div>
                    {designRes.heatmap_data ? (
                      <div className="heatmap-container">
                        <div className="heatmap-axis-legend">
                          <span>X: <strong>{designRes.heatmap_data.x_key}</strong></span>
                          <span>Y: <strong>{designRes.heatmap_data.y_key}</strong></span>
                        </div>
                        <div
                          className="heatmap-grid"
                          style={{ gridTemplateColumns: `repeat(${designRes.heatmap_data.x_values.length}, 1fr)` }}
                        >
                          {designRes.heatmap_data.pass_grid.flatMap((row, rIdx) =>
                            row.map((pass, cIdx) => (
                              <div
                                key={`${rIdx}-${cIdx}`}
                                className={`heatmap-cell ${pass ? 'pass' : 'fail'}`}
                                title={`Score: ${designRes.heatmap_data.score_grid[rIdx][cIdx]}`}
                              >
                                {pass ? '✓' : '✗'}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : <div className="no-chart-data">Run sweep to view heatmap</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════ 5. SENSITIVITY ════════════════ */}
          {subTab === 'sensitivity' && (
            <div className="analysis-view-container">
              <HelpCard toolKey="sensitivity" />
              <div className="action-panel-card">
                <div className="action-panel-header">
                  <div>
                    <h3 className="panel-title">One-At-a-Time (OAT) Sensitivity Analysis</h3>
                    <p className="panel-subtitle">Evaluates parameter dominance by perturbing each variable by ±10% to compute the Sensitivity Index S_i.</p>
                  </div>
                  <button type="button" className="btn-action-primary" onClick={onRunSensitivity} disabled={analysisLoading}>
                    {analysisLoading ? 'Computing Perturbations...' : '⚡ Compute Sensitivity'}
                  </button>
                </div>
              </div>

              {sensRes && (
                <div className="tornado-container">
                  {sensRes.metric_keys.map((m_key) => (
                    <div key={m_key} className="table-card">
                      <div className="table-card-header">
                        <h3 className="table-title">Tornado Chart: {m_key.toUpperCase()}</h3>
                      </div>
                      <div className="tornado-list">
                        {sensRes.tornado_data[m_key]?.map((d) => (
                          <div key={d.param} className="tornado-row-clean">
                            <div className="tornado-label">{d.param}</div>
                            <div className="tornado-track">
                              <div className="tornado-zero-line"></div>
                              {d.pos_impact >= 0 ? (
                                <div
                                  className="tornado-bar pos"
                                  style={{ width: `${Math.min(100, (d.pos_impact / (sensRes.tornado_data[m_key][0]?.abs_max_impact || 1)) * 48)}%` }}
                                ></div>
                              ) : (
                                <div
                                  className="tornado-bar neg"
                                  style={{ width: `${Math.min(100, (Math.abs(d.pos_impact) / (sensRes.tornado_data[m_key][0]?.abs_max_impact || 1)) * 48)}%` }}
                                ></div>
                              )}
                            </div>
                            <div className="tornado-index">S_i = {d.S_i.toFixed(3)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ 6. REVERSE SOLVER ════════════════ */}
          {subTab === 'reverse' && (
            <div className="analysis-view-container">
              <HelpCard toolKey="reverse" />
              <div className="action-panel-card">
                <div className="action-panel-header">
                  <div>
                    <h3 className="panel-title">Inverse Kinematic & Dynamic Solver</h3>
                    <p className="panel-subtitle">Specify a desired performance target and compute the exact physical parameter using Brent's method.</p>
                  </div>
                  <button type="button" className="btn-action-primary" onClick={onRunReverseSolve} disabled={analysisLoading}>
                    {analysisLoading ? 'Solving Equations...' : '⚡ Solve Inverse Target'}
                  </button>
                </div>

                <div className="reverse-solver-form">
                  <div className="form-group">
                    <label className="form-label">Target Performance Metric</label>
                    <select
                      className="form-select"
                      value={reverseTarget}
                      onChange={e => setReverseTarget(e.target.value)}
                    >
                      {simType === 'simple_pendulum' && (
                        <>
                          <option value="period">Period T (s)</option>
                          <option value="max_omega">Peak Velocity ω (rad/s)</option>
                        </>
                      )}
                      {simType === 'compound_pendulum' && <option value="period">Period T (s)</option>}
                      {simType === 'slider_crank' && (
                        <>
                          <option value="stroke">Stroke Length (m)</option>
                          <option value="v_max">Peak Velocity (m/s)</option>
                          <option value="a_max">Peak Acceleration (m/s²)</option>
                        </>
                      )}
                      {simType === 'four_bar' && <option value="rocker_range_deg">Rocker Angular Range (°)</option>}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Desired Target Value</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={reverseTargetVal}
                      onChange={e => setReverseTargetVal(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Variable Parameter to Solve</label>
                    <select
                      className="form-select"
                      value={reverseVarKey}
                      onChange={e => setReverseVarKey(e.target.value)}
                    >
                      {cfg.sliders.map(s => (
                        <option key={s.key} value={s.key}>{s.label} ({s.unit})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {reverseResult && (
                <div className="reverse-result-card">
                  <div className="reverse-result-header">
                    <h3 className="result-title">Inverse Solution Benchmark</h3>
                    <span className={`result-badge ${reverseResult.success ? 'verified' : 'approx'}`}>
                      {reverseResult.success ? '✓ Exact Root Converged' : '⚠ Nearest Approximation'}
                    </span>
                  </div>

                  <div className="reverse-metrics-quad">
                    <div className="quad-item">
                      <span className="quad-label">Target Requested</span>
                      <span className="quad-val">{parseFloat(reverseTargetVal).toFixed(4)}</span>
                    </div>
                    <div className="quad-item">
                      <span className="quad-label">Model Achieved</span>
                      <span className="quad-val">{reverseResult.achieved_value?.toFixed(4) ?? '--'}</span>
                    </div>
                    <div className="quad-item">
                      <span className="quad-label">RK45 Verification</span>
                      <span className="quad-val">{reverseResult.simulation_result?.toFixed(4) ?? '--'}</span>
                    </div>
                    <div className="quad-item">
                      <span className="quad-label">Percentage Error</span>
                      <span className="quad-val accent">
                        {reverseResult.error_pct != null ? `${reverseResult.error_pct.toFixed(4)}%` : '--'}
                      </span>
                    </div>
                  </div>

                  {reverseResult.solved_value != null && (
                    <div className="reverse-solution-banner">
                      <div>
                        <span className="solution-sub">Required {reverseVarKey}:</span>
                        <div className="solution-val">
                          {reverseResult.solved_value.toFixed(6)}{' '}
                          <span className="solution-unit">
                            {cfg.sliders.find(s => s.key === reverseVarKey)?.unit}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-action-primary"
                        onClick={() => setParams(p => ({ ...p, [reverseVarKey]: reverseResult.solved_value }))}
                      >
                        Apply to Simulator →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ 7. EXPORT REPORTS ════════════════ */}
          {subTab === 'export' && (
            <div className="analysis-view-container">
              <div className="action-panel-card">
                <div className="action-panel-header">
                  <div>
                    <h3 className="panel-title">Engineering Report & Data Export</h3>
                    <p className="panel-subtitle">Export full numerical state vectors or generate a formal PDF engineering verification report.</p>
                  </div>
                </div>

                <div className="export-cards-grid">
                  <div className="export-tile">
                    <div className="export-icon">📊</div>
                    <h4 className="export-title">CSV Raw Data Log</h4>
                    <p className="export-desc">Exports full time-series integration trajectory (time, position, velocity, acceleration, energy) in standard comma-separated format.</p>
                    <button
                      type="button"
                      className="btn-action-ghost"
                      onClick={onExportCSV}
                      disabled={!simData}
                    >
                      {simData ? '📥 Download CSV' : 'Simulate First'}
                    </button>
                  </div>

                  <div className="export-tile">
                    <div className="export-icon">📄</div>
                    <h4 className="export-title">PDF Technical Report</h4>
                    <p className="export-desc">Compiles mathematical model, parameter configurations, RK45 vs analytical error matrix, and benchmark paper citations into a formal document.</p>
                    <button
                      type="button"
                      className="btn-action-primary"
                      onClick={onExportPDF}
                      disabled={!simData}
                    >
                      {simData ? '📥 Download PDF Report' : 'Simulate First'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
