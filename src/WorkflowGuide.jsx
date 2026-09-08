import React, { useState } from 'react';

const OBJECTIVES = [
  {
    id: 'target',
    icon: '🎯',
    title: 'I have a specific target output value',
    subtitle: 'e.g. "I want a period of exactly 2.0s" or "I want a stroke of 150mm"',
    recommendedTool: 'reverse',
    toolName: '8. Reverse Solve (Inverse Solver)',
    why: 'Uses Brent\'s root-finding method to calculate the exact physical parameter (such as length or crank radius) needed to achieve your target, without manual guess-and-check.',
    example: 'Calculate the pendulum length L needed for a clock grandfather pendulum to beat at exactly 1.000 Hz.'
  },
  {
    id: 'explore',
    icon: '🔍',
    title: 'I want to explore parameter tradeoffs & feasibility',
    subtitle: 'e.g. "Which parameter ranges produce safe accelerations?"',
    recommendedTool: 'design',
    toolName: '5. Design Sweep (Parametric Grid)',
    why: 'Simultaneously sweeps multi-dimensional parameter grids against safety and performance constraints, producing a 2D feasibility heatmap and ranked designs.',
    example: 'Filter connecting rod and crank combinations that keep peak reciprocating accelerations below 500 m/s².'
  },
  {
    id: 'sensitivity',
    icon: '📊',
    title: 'I want to know which parameter has the biggest impact',
    subtitle: 'e.g. "Does changing mass matter as much as changing length?"',
    recommendedTool: 'sensitivity',
    toolName: '6. Sensitivity Analysis (OAT)',
    why: 'Perturbs each parameter by ±10% one-at-a-time to generate Tornado charts and calculate the non-dimensional sensitivity index S_i.',
    example: 'Discover that pendulum rod length dominates frequency (S_i ≈ 0.50), while mass has zero effect on natural frequency (S_i = 0.00).'
  },
  {
    id: 'optimize',
    icon: '⚡',
    title: 'I want to find the optimal design mathematically',
    subtitle: 'e.g. "Maximize rocker range" or "Minimize energy drift"',
    recommendedTool: 'optimize',
    toolName: '7. Global Optimization (Differential Evolution)',
    why: 'Employs a two-phase hybrid genetic algorithm (Differential Evolution) and gradient polish (L-BFGS-B) to find global parameter optima.',
    example: 'Optimize four-bar linkage link lengths to maximize angular swing amplitude while satisfying Grashof criteria.'
  },
  {
    id: 'math',
    icon: '📐',
    title: 'I want to study the differential equations & circuits',
    subtitle: 'e.g. "How does damping b translate to an electrical resistor R?"',
    recommendedTool: 'math_model',
    toolName: '10. Mathematical Model & Circuit Analogy',
    why: 'Renders complete LaTeX equations with your actual numbers substituted, displays SVG free-body diagrams, and models equivalent RLC circuits.',
    example: 'Understand that a damped pendulum (mL²θ̈ + bθ̇ + mgLθ = 0) is mathematically identical to a series RLC circuit with L_e = mL², R = b, and C = 1/(mgL).'
  },
  {
    id: 'validate',
    icon: '🛡️',
    title: 'I want to verify accuracy against textbooks & papers',
    subtitle: 'e.g. "Is the RK45 numerical solution trustworthy?"',
    recommendedTool: 'validation',
    toolName: '3. Validate (Physics Benchmarks)',
    why: 'Compares numerical outputs directly against closed-form elliptic integrals, series expansions, and published literature benchmarks (Beléndez et al., Norton, Freudenstein).',
    example: 'Verify that large-angle pendulum periods match complete elliptic integral K(k²) values within 0.01% error.'
  },
  {
    id: 'ai',
    icon: '🤖',
    title: 'I need an engineering tutor to explain the derivation',
    subtitle: 'e.g. "Derive the equation of motion step-by-step for me"',
    recommendedTool: 'ai',
    toolName: '9. AI Engineering Assistant',
    why: 'Embedded Google Gemini mechanical engineering tutor provides step-by-step proofs, error diagnosis, and physical interpretations of your current simulation state.',
    example: 'Ask "Why does the slider-crank velocity curve have two peaks?" and receive immediate physics derivations.'
  }
];

export const WorkflowGuide = ({ onSelectTab }) => {
  const [selectedObjective, setSelectedObjective] = useState(OBJECTIVES[0].id);
  const activeObj = OBJECTIVES.find(o => o.id === selectedObjective) || OBJECTIVES[0];

  return (
    <div className="workflow-guide-container">
      {/* Header */}
      <div className="workflow-header">
        <div className="workflow-title-row">
          <span className="workflow-icon">🧭</span>
          <div>
            <h2 className="workflow-title">Engineering Student Workflow Guide</h2>
            <p className="workflow-subtitle">
              Select your engineering objective below to get guided recommendations on which smart tool to use and why.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Selection Grid */}
      <div className="workflow-grid">
        {/* Left Column: Objectives */}
        <div className="workflow-objectives-list">
          <h3 className="workflow-col-heading">Step 1: Choose Your Objective</h3>
          {OBJECTIVES.map(obj => (
            <div
              key={obj.id}
              className={`workflow-obj-card ${selectedObjective === obj.id ? 'active' : ''}`}
              onClick={() => setSelectedObjective(obj.id)}
            >
              <span className="workflow-obj-icon">{obj.icon}</span>
              <div className="workflow-obj-info">
                <h4 className="workflow-obj-title">{obj.title}</h4>
                <p className="workflow-obj-sub">{obj.subtitle}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Detailed Recommendation & Action */}
        <div className="workflow-recommendation-panel">
          <h3 className="workflow-col-heading">Step 2: Recommended Smart Tool</h3>
          <div className="workflow-rec-card">
            <div className="workflow-rec-header">
              <span className="workflow-rec-icon">{activeObj.icon}</span>
              <div>
                <span className="workflow-rec-badge">Recommended Tool</span>
                <h3 className="workflow-rec-title">{activeObj.toolName}</h3>
              </div>
            </div>

            <div className="workflow-rec-body">
              <div className="workflow-rec-section">
                <strong>Why use this tool?</strong>
                <p>{activeObj.why}</p>
              </div>

              <div className="workflow-rec-section example-box">
                <span className="example-bulb">💡</span>
                <div>
                  <strong>Real Engineering Example:</strong>
                  <p>{activeObj.example}</p>
                </div>
              </div>

              <div className="workflow-rec-action">
                <button
                  className="workflow-launch-btn"
                  onClick={() => onSelectTab(activeObj.recommendedTool)}
                >
                  Launch {activeObj.toolName} →
                </button>
              </div>
            </div>
          </div>

          {/* Quick Concept Map */}
          <div className="workflow-concept-map">
            <h4>Engineering Concept Flow</h4>
            <div className="concept-flow-steps">
              <span className="flow-step">1. Model & Simulate</span>
              <span className="flow-arrow">➔</span>
              <span className="flow-step">2. Math & Circuits</span>
              <span className="flow-arrow">➔</span>
              <span className="flow-step">3. Validate (V&V)</span>
              <span className="flow-arrow">➔</span>
              <span className="flow-step">4. Design & Optimize</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
