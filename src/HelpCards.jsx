import React, { useState } from 'react';

const HELP_CONTENT = {
  design: {
    title: 'How Design Sweep Works',
    subtitle: 'Multi-Dimensional Parametric Feasibility Analysis',
    badge: 'Design Exploration',
    summary: 'Evaluate hundreds of parameter permutations simultaneously against engineering constraints to find valid design candidates.',
    steps: [
      'Define min and max acceptable bounds for key output performance metrics (e.g. Period, Stroke, Rocker Range).',
      'The engine automatically constructs a multi-dimensional grid across parameter bounds and simulates every combination.',
      'Feasible designs are scored and ranked by constraint safety margins. Click any candidate to load its parameters directly into the simulator.'
    ],
    example: 'Automotive Engine Design: Exploring combinations of crank radius r and connecting rod l that achieve target stroke while keeping peak piston acceleration below material fatigue limits.'
  },
  sensitivity: {
    title: 'How Sensitivity Analysis Works',
    subtitle: 'One-At-a-Time (OAT) Parameter Perturbation',
    badge: 'Tolerance & Influence',
    summary: 'Perturb each parameter by ±10% to compute the non-dimensional Sensitivity Index S_i and rank parameter dominance.',
    steps: [
      'A baseline simulation is executed with your current parameters.',
      'Each parameter is perturbed up (+10%) and down (-10%) individually while holding all others fixed.',
      'The Tornado Plot displays parameter influence visually: wider bars indicate parameters with dominant leverage over the system.'
    ],
    example: 'Horology & Clocks: A clockmaker discovers that pendulum rod length L has a sensitivity index of ~0.50 on period, whereas bob mass m has an index of 0.00. Manufacturing tolerances must focus strictly on length.'
  },
  optimize: {
    title: 'How Global Optimization Works',
    subtitle: 'Hybrid Differential Evolution + L-BFGS-B Pipeline',
    badge: 'Automated Optimization',
    summary: 'Two-stage optimization algorithm combining stochastic global exploration with high-precision gradient refinement.',
    steps: [
      'Select which design parameters the algorithm is permitted to vary and choose your objective metric.',
      'Phase 1 (Global): Differential Evolution explores the bounded parameter space, jumping out of local minima.',
      'Phase 2 (Local): L-BFGS-B polish hones in on the exact numerical optimum with high precision.',
      'Inspect the convergence history curve and click "Apply Optimal Parameters" to update your model.'
    ],
    example: 'Linkage Synthesis: Automatically finding link lengths (a, b, c, d) in a Four-Bar mechanism that maximize output rocker range while strictly satisfying Grashof continuous rotation criteria.'
  },
  reverse: {
    title: 'How the Reverse Solver Works',
    subtitle: 'Inverse Problem Solving via Brent\'s Root-Finding',
    badge: 'Target-Driven Synthesis',
    summary: 'Find the exact input parameter required to hit a specific desired output performance target.',
    steps: [
      'Choose the performance metric you want to achieve (e.g., Period = 2.000 s or Stroke = 0.200 m).',
      'Pick the parameter you want the solver to tune (e.g. pendulum length or crank radius).',
      'The solver uses Brent\'s method (bisection + secant interpolation) to converge on the exact parameter value within 1e-8 tolerance.',
      'A full simulation is automatically re-run to verify the solved parameter before applying.'
    ],
    example: 'Precision Timing: An engineer needs a compound pendulum test bench with a natural period of exactly 1.500 seconds. The solver calculates the exact rod length required, accounting for rigid-body mass distribution.'
  },
  verification: {
    title: 'How Solver Verification Works',
    subtitle: 'Numerical Timestep Convergence Analysis',
    badge: 'V&V Assurance',
    summary: 'Verify that the adaptive Runge-Kutta solver produces stable, timestep-independent results across varying integration resolutions.',
    steps: [
      'The system runs the simulation across 5 distinct timesteps (dt = 0.1s down to 0.005s).',
      'Compares computed period, energy drift, and peak values across the timesteps.',
      'A converging metric across diminishing dt confirms the numerical solution is robust and free from discretization artifacts.'
    ],
    example: 'Computational Mechanics V&V: In aerospace and mechanical qualification, ASME V&V standards mandate verifying numerical convergence before trusting simulation results.'
  }
};

export const HelpCard = ({ toolKey }) => {
  const [expanded, setExpanded] = useState(true);
  const info = HELP_CONTENT[toolKey];

  if (!info) return null;

  return (
    <div className="smart-tool-help-card">
      <div className="smart-tool-help-header" onClick={() => setExpanded(!expanded)}>
        <div className="smart-tool-help-left">
          <span className="smart-tool-badge">{info.badge}</span>
          <span className="smart-tool-title">{info.title}</span>
          <span className="smart-tool-subtitle">— {info.subtitle}</span>
        </div>
        <button className="smart-tool-toggle-btn" type="button">
          {expanded ? '▲ Hide Guide' : '▼ How to Use'}
        </button>
      </div>

      {expanded && (
        <div className="smart-tool-help-body">
          <p className="smart-tool-summary">{info.summary}</p>
          <div className="smart-tool-steps">
            <h4 className="smart-tool-section-heading">Quick Workflow Steps:</h4>
            <ol className="smart-tool-step-list">
              {info.steps.map((step, idx) => (
                <li key={idx}><strong>Step {idx + 1}:</strong> {step}</li>
              ))}
            </ol>
          </div>
          <div className="smart-tool-example">
            <span className="smart-tool-example-icon">💡</span>
            <div>
              <strong>Real-World Engineering Application:</strong>
              <p>{info.example}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
