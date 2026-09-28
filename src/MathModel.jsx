/**
 * @file MathModel.jsx
 * @description Main Mathematical Model panel for MechSim Pro.
 * Shows governing equations, free body diagrams, energy equations,
 * mechanical-electrical analogy, and equivalent circuit diagrams.
 */

import React, { useMemo, useState } from 'react';
import { EquationBlock, EquationCard, ParamSubstitution } from './components/EquationBlock';
import { FBDiagram } from './components/FBDiagram';
import { CircuitDiagram } from './components/CircuitDiagram';
import { MATH_MODELS, computeAnalogy, getSubstitutedEqn, getStateSpaceMatrix, ANALOGY_TABLE } from './mathModels';

const MathModel = ({ simType, params }) => {
  const [showAnalogy, setShowAnalogy] = useState(true);

  const model = MATH_MODELS[simType];
  const analogy = useMemo(() => computeAnalogy(simType, params), [simType, params]);
  const substituted = useMemo(() => getSubstitutedEqn(simType, params), [simType, params]);
  const stateMatrix = useMemo(() => getStateSpaceMatrix(simType, params), [simType, params]);

  const isPendulum = simType === 'simple_pendulum' || simType === 'compound_pendulum';

  // Build parameter chips for display
  const paramChips = useMemo(() => {
    if (!analogy) return [];
    const chips = [];
    if (analogy.omega_n !== undefined) chips.push({ symbol: 'ωₙ', value: analogy.omega_n.toFixed(3), unit: 'rad/s' });
    if (analogy.zeta !== undefined) chips.push({ symbol: 'ζ', value: analogy.zeta.toFixed(4) });
    if (analogy.T_n !== undefined) chips.push({ symbol: 'Tₙ', value: analogy.T_n.toFixed(3), unit: 's' });
    if (analogy.omega_d && analogy.omega_d > 0) chips.push({ symbol: 'ω_d', value: analogy.omega_d.toFixed(3), unit: 'rad/s' });
    if (analogy.T_d) chips.push({ symbol: 'T_d', value: analogy.T_d.toFixed(3), unit: 's' });
    if (analogy.lambda !== undefined) chips.push({ symbol: 'λ', value: analogy.lambda.toFixed(3) });
    if (analogy.stroke !== undefined) chips.push({ symbol: 'Stroke', value: analogy.stroke.toFixed(4), unit: 'm' });
    if (analogy.omega !== undefined) chips.push({ symbol: 'ω', value: analogy.omega.toFixed(2), unit: 'rad/s' });
    if (analogy.K1 !== undefined) chips.push({ symbol: 'K₁', value: analogy.K1.toFixed(3) });
    if (analogy.K2 !== undefined) chips.push({ symbol: 'K₂', value: analogy.K2.toFixed(3) });
    if (analogy.K3 !== undefined) chips.push({ symbol: 'K₃', value: analogy.K3.toFixed(3) });
    return chips;
  }, [analogy]);

  // Damping classification for pendulums
  const dampingClass = useMemo(() => {
    if (!isPendulum || analogy.zeta === undefined) return '';
    if (analogy.zeta === 0) return 'Undamped';
    if (analogy.zeta < 1) return 'Underdamped';
    if (analogy.zeta === 1) return 'Critically Damped';
    return 'Overdamped';
  }, [isPendulum, analogy]);

  if (!model) return null;

  return (
    <div className="math-model-panel">
      {/* Section Header */}
      <div className="math-model-header">
        <h2 className="math-model-title">📐 Mathematical Model — {model.title}</h2>
        <p className="math-model-subtitle">
          Governing equations, free body diagram, and {isPendulum ? 'mechanical-electrical analogy' : 'kinematic relationships'}
        </p>
      </div>

      {/* Computed Parameters Row */}
      {paramChips.length > 0 && (
        <ParamSubstitution label="Computed Values" items={paramChips} />
      )}

      {/* Main Grid: 2 columns */}
      <div className="math-model-grid">
        {/* LEFT COLUMN: Equations */}
        <div className="math-model-col">
          {/* Governing Equation */}
          <EquationCard title="Governing Equation" icon="📝">
            <EquationBlock latex={model.governingEqn} label="General (Nonlinear)" />
            {model.linearizedEqn && model.linearizedEqn !== '-' && (
              <EquationBlock latex={model.linearizedEqn} label="Linearized (Small Angle)" />
            )}
          </EquationCard>

          {/* With Current Values */}
          {substituted.eqn && (
            <EquationCard title="With Your Parameter Values" icon="🔢">
              <EquationBlock latex={substituted.eqn} label="Substituted Values" />
              {substituted.computed && (
                <EquationBlock latex={substituted.computed} label="Computed Results" />
              )}
            </EquationCard>
          )}

          {/* Standard Vibration Form */}
          {model.standardForm && model.standardForm !== '-' && (
            <EquationCard title={isPendulum ? "Standard Vibration Form" : "Velocity Equation"} icon="📊">
              <EquationBlock latex={model.standardForm} />
              {isPendulum && dampingClass && (
                <div className="damping-badge-row">
                  <span className="damping-label">Damping Classification:</span>
                  <span className={`damping-badge damping-${dampingClass.toLowerCase().replace(' ', '-')}`}>
                    {dampingClass}
                  </span>
                </div>
              )}
            </EquationCard>
          )}

          {/* State Space Form */}
          <EquationCard title="State Space & Matrix Form" icon="🔄">
            <EquationBlock latex={stateMatrix.symbolic || model.stateVector} label="Symbolic State Derivative Vector" />
            {stateMatrix.evaluated && (
              <EquationBlock latex={stateMatrix.evaluated} label="Live Evaluated Dynamic Matrix (Substituted)" />
            )}
            {stateMatrix.linearEvaluated && (
              <EquationBlock latex={stateMatrix.linearEvaluated} label="Linear State Matrix / System Metric" />
            )}
          </EquationCard>

          {/* Energy Equations (pendulums only) */}
          {isPendulum && model.energyEquations && (
            <EquationCard title="Energy Equations" icon="⚡">
              <EquationBlock latex={model.energyEquations.KE} label="Kinetic Energy" />
              <EquationBlock latex={model.energyEquations.PE} label="Potential Energy" />
              <EquationBlock latex={model.energyEquations.total} label="Total Energy" />
            </EquationCard>
          )}
        </div>

        {/* RIGHT COLUMN: Diagrams */}
        <div className="math-model-col">
          {/* Free Body Diagram */}
          <EquationCard title="Free Body Diagram" icon="🖼️">
            <div className="fbd-container">
              <FBDiagram simType={simType} params={params} width={420} height={360} />
            </div>
          </EquationCard>

          {/* Equivalent Circuit / Kinematic Ratios */}
          <EquationCard
            title={isPendulum ? "Equivalent RLC Circuit" : "Kinematic Relationships"}
            icon={isPendulum ? "🔌" : "🔗"}
          >
            <CircuitDiagram
              simType={simType}
              params={params}
              analogyValues={analogy}
              width={420}
              height={280}
            />
          </EquationCard>

          {/* Analogy Table (pendulums only) */}
          {isPendulum && (
            <EquationCard title="Mechanical ↔ Electrical Analogy" icon="⚡">
              <div className="analogy-toggle-row">
                <button
                  className={`analogy-toggle-btn ${showAnalogy ? 'active' : ''}`}
                  onClick={() => setShowAnalogy(!showAnalogy)}
                >
                  {showAnalogy ? 'Hide' : 'Show'} Analogy Table
                </button>
              </div>
              {showAnalogy && (
                <>
                  <table className="analogy-table">
                    <thead>
                      <tr>
                        <th>Mechanical Domain</th>
                        <th>Electrical Domain</th>
                        <th>Mech. Unit</th>
                        <th>Elec. Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ANALOGY_TABLE.map((row, i) => (
                        <tr key={i}>
                          <td>{row.mechanical}</td>
                          <td>{row.electrical}</td>
                          <td className="unit-cell">{row.unit_mech}</td>
                          <td className="unit-cell">{row.unit_elec}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Computed component values */}
                  <div className="circuit-values-card">
                    <h4 className="circuit-values-title">Your Circuit Component Values</h4>
                    <div className="circuit-values-grid">
                      <div className="circuit-value-item">
                        <span className="circuit-value-symbol" style={{color:'#6366f1'}}>L_e</span>
                        <span className="circuit-value-num">{analogy.L_e?.toFixed(4)} H</span>
                        <span className="circuit-value-meaning">
                          {simType === 'simple_pendulum' ? '= mL²' : '= I_pivot = mL²/3'}
                        </span>
                      </div>
                      <div className="circuit-value-item">
                        <span className="circuit-value-symbol" style={{color:'#f59e0b'}}>R</span>
                        <span className="circuit-value-num">{analogy.R?.toFixed(4)} Ω</span>
                        <span className="circuit-value-meaning">= b (damping)</span>
                      </div>
                      <div className="circuit-value-item">
                        <span className="circuit-value-symbol" style={{color:'#06b6d4'}}>C</span>
                        <span className="circuit-value-num">{analogy.C?.toFixed(4)} F</span>
                        <span className="circuit-value-meaning">
                          {simType === 'simple_pendulum' ? '= 1/(mgL)' : '= 1/(mgd)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </EquationCard>
          )}

          {/* Parameter Definitions */}
          <EquationCard title="Parameter Definitions" icon="📋">
            <div className="param-specs-container">
              <div className="param-spec-grid">
                {model.parameters.map((p, i) => {
                  // Resolve live value from params
                  let liveVal = null;
                  if (simType === 'slider_crank') {
                    if (p.symbol === 'r') liveVal = Number(params?.crank_length || 0.1).toFixed(3);
                    if (p.symbol === 'l') liveVal = Number(params?.conn_length || 0.3).toFixed(3);
                    if (p.symbol === 'N') liveVal = Number(params?.crank_speed || 60).toFixed(0);
                  } else if (simType === 'four_bar') {
                    if (p.symbol === 'a') liveVal = Number(params?.link_crank || 1.0).toFixed(2);
                    if (p.symbol === 'b') liveVal = Number(params?.link_coupler || 2.5).toFixed(2);
                    if (p.symbol === 'c') liveVal = Number(params?.link_rocker || 3.0).toFixed(2);
                    if (p.symbol === 'd') liveVal = Number(params?.link_ground || 4.0).toFixed(2);
                  } else if (simType === 'simple_pendulum') {
                    if (p.symbol === 'm') liveVal = Number(params?.mass || 1.0).toFixed(2);
                    if (p.symbol === 'L') liveVal = Number(params?.length || 1.0).toFixed(2);
                    if (p.symbol === 'g') liveVal = Number(params?.gravity || 9.81).toFixed(2);
                    if (p.symbol === 'b') liveVal = Number(params?.damping || 0.05).toFixed(3);
                  } else if (simType === 'compound_pendulum') {
                    if (p.symbol === 'm') liveVal = Number(params?.mass || 2.0).toFixed(2);
                    if (p.symbol === 'L') liveVal = Number(params?.length || 1.0).toFixed(2);
                    if (p.symbol === 'g') liveVal = Number(params?.gravity || 9.81).toFixed(2);
                    if (p.symbol === 'b') liveVal = Number(params?.damping || 0.1).toFixed(3);
                    if (p.symbol === 'd') liveVal = ((Number(params?.length || 1.0)) / 2).toFixed(2);
                  }

                  return (
                    <div key={i} className="param-spec-card">
                      <div className="param-card-top">
                        <div className="param-symbol-badge">
                          <EquationBlock latex={p.symbol} displayMode={false} />
                        </div>
                        <div className="param-title-group">
                          <span className="param-spec-name">{p.name}</span>
                          <span className="param-unit-pill">{p.unit}</span>
                        </div>
                        {liveVal !== null && (
                          <div className="param-live-badge" title="Live configured value">
                            <span className="live-dot"></span>
                            <span className="live-val-text">{liveVal} {p.unit}</span>
                          </div>
                        )}
                      </div>
                      <div className="param-card-desc">
                        {p.description}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </EquationCard>
        </div>
      </div>
    </div>
  );
};

export default React.memo(MathModel);
