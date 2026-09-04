import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Scatter } from 'react-chartjs-2';
import axios from 'axios';
import './index.css';
import {
  drawSimplePendulum, drawCompoundPendulum,
  drawSliderCrank, drawFourBar
} from './renderers';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const API = 'http://localhost:5000';

// ─── Simulation Configs & Presets ─────────────────────────────────
const SIMULATIONS = {
  simple_pendulum: {
    label: 'Simple Pendulum', icon: '🔵',
    defaults: { length: 1.0, mass: 1.0, gravity: 9.81, damping: 0.1, theta0: 30, omega0: 0, dt: 0.01, t_max: 15 },
    presets: [
      { label: 'Earth Standard', params: { length: 1.0, mass: 1.0, gravity: 9.81, damping: 0.1, theta0: 30, omega0: 0 } },
      { label: 'Moon Gravity',   params: { length: 1.0, mass: 1.0, gravity: 1.62, damping: 0.0, theta0: 30, omega0: 0 } },
      { label: 'High Damping',   params: { length: 1.5, mass: 2.0, gravity: 9.81, damping: 1.2, theta0: 45, omega0: 0 } },
      { label: 'Large Angle',    params: { length: 2.0, mass: 1.5, gravity: 9.81, damping: 0.05, theta0: 90, omega0: 0 } },
    ],
    sliders: [
      { key: 'length',  label: 'Length L', min: 0.2, max: 5, step: 0.1, unit: 'm' },
      { key: 'mass',    label: 'Mass m',   min: 0.1, max: 10, step: 0.1, unit: 'kg' },
      { key: 'gravity', label: 'Gravity g', min: 1, max: 25, step: 0.1, unit: 'm/s²' },
      { key: 'damping', label: 'Damping b', min: 0, max: 5, step: 0.05, unit: 'N·m·s' },
      { key: 'theta0',  label: 'Init Angle θ₀', min: 1, max: 170, step: 1, unit: '°' },
      { key: 'omega0',  label: 'Init Vel ω₀', min: -10, max: 10, step: 0.1, unit: 'rad/s' },
    ]
  },
  compound_pendulum: {
    label: 'Compound Pendulum', icon: '🟣',
    defaults: { length: 1.0, mass: 2.0, gravity: 9.81, damping: 0.05, theta0: 25, omega0: 0, dt: 0.01, t_max: 15 },
    presets: [
      { label: 'Standard Rod', params: { length: 1.0, mass: 2.0, gravity: 9.81, damping: 0.05, theta0: 25 } },
      { label: 'Heavy Beam',   params: { length: 2.5, mass: 10.0, gravity: 9.81, damping: 0.1, theta0: 40 } },
      { label: 'Mars Gravity', params: { length: 1.2, mass: 1.5, gravity: 3.71, damping: 0.02, theta0: 30 } },
    ],
    sliders: [
      { key: 'length',  label: 'Rod Length L', min: 0.2, max: 4, step: 0.1, unit: 'm' },
      { key: 'mass',    label: 'Mass m', min: 0.1, max: 20, step: 0.1, unit: 'kg' },
      { key: 'gravity', label: 'Gravity g', min: 1, max: 25, step: 0.1, unit: 'm/s²' },
      { key: 'damping', label: 'Damping b', min: 0, max: 5, step: 0.05, unit: 'N·m·s' },
      { key: 'theta0',  label: 'Init Angle θ₀', min: 1, max: 120, step: 1, unit: '°' },
    ]
  },
  slider_crank: {
    label: 'Slider-Crank', icon: '⚙️',
    defaults: { crank_length: 0.1, conn_length: 0.3, crank_speed: 300, dt: 0.001, t_max: 2.0 },
    presets: [
      { label: 'Standard Engine', params: { crank_length: 0.1, conn_length: 0.3, crank_speed: 300 } },
      { label: 'High RPM Racing', params: { crank_length: 0.08, conn_length: 0.25, crank_speed: 1200 } },
      { label: 'Long Conn Rod',   params: { crank_length: 0.05, conn_length: 0.45, crank_speed: 600 } },
    ],
    sliders: [
      { key: 'crank_length', label: 'Crank r', min: 0.02, max: 0.5, step: 0.01, unit: 'm' },
      { key: 'conn_length',  label: 'Conn. Rod l', min: 0.05, max: 1.0, step: 0.01, unit: 'm' },
      { key: 'crank_speed',  label: 'Speed N', min: 30, max: 3000, step: 10, unit: 'rpm' },
    ]
  },
  four_bar: {
    label: 'Four-Bar Linkage', icon: '🔷',
    defaults: { link_ground: 4.0, link_crank: 1.0, link_coupler: 2.5, link_rocker: 3.0, crank_speed: 60, dt: 0.005, t_max: 5.0 },
    presets: [
      { label: 'Crank-Rocker', params: { link_ground: 4.0, link_crank: 1.0, link_coupler: 2.5, link_rocker: 3.0, crank_speed: 60 } },
      { label: 'Double-Rocker',params: { link_ground: 4.0, link_crank: 2.5, link_coupler: 2.0, link_rocker: 3.0, crank_speed: 45 } },
      { label: 'Drag Link',    params: { link_ground: 2.0, link_crank: 3.0, link_coupler: 3.5, link_rocker: 4.0, crank_speed: 60 } },
    ],
    sliders: [
      { key: 'link_ground',  label: 'Ground d', min: 1, max: 10, step: 0.1, unit: 'm' },
      { key: 'link_crank',   label: 'Crank a',  min: 0.5, max: 5, step: 0.1, unit: 'm' },
      { key: 'link_coupler', label: 'Coupler b', min: 0.5, max: 8, step: 0.1, unit: 'm' },
      { key: 'link_rocker',  label: 'Rocker c',  min: 0.5, max: 8, step: 0.1, unit: 'm' },
      { key: 'crank_speed',  label: 'Speed N', min: 10, max: 300, step: 5, unit: 'rpm' },
    ]
  }
};

// ─── Chart Styling Helpers ────────────────────────────────────────
const chartOpts = (yLabel) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { size: 10, family: 'JetBrains Mono' }, boxWidth: 12 } },
    tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', borderColor: '#6366f1', borderWidth: 1 }
  },
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 9 }, maxTicksLimit: 8 }, grid: { color: 'rgba(99,102,241,0.08)' } },
    y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(99,102,241,0.08)' }, title: { display: true, text: yLabel, color: '#94a3b8', font: { size: 10, weight: '700' } } }
  }
});

const scatterOpts = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { size: 10, family: 'JetBrains Mono' }, boxWidth: 12 } },
    tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', borderColor: '#06b6d4', borderWidth: 1 }
  },
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(99,102,241,0.08)' }, title: { display: true, text: 'θ (rad)', color: '#94a3b8', font: { size: 10 } } },
    y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(99,102,241,0.08)' }, title: { display: true, text: 'ω (rad/s)', color: '#94a3b8', font: { size: 10 } } }
  }
};


export default function App() {
  const [simType, setSimType] = useState('simple_pendulum');
  const [params, setParams] = useState({ ...SIMULATIONS.simple_pendulum.defaults });
  const [simData, setSimData] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [animIdx, setAnimIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(1);

  // Analysis state
  const [designRes, setDesignRes] = useState(null);
  const [optRes, setOptRes] = useState(null);
  const [sensRes, setSensRes] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Multi-variable optimizer state
  const [optSelectedParams, setOptSelectedParams] = useState({});
  const [optObjective, setOptObjective] = useState('');
  const [optDirection, setOptDirection] = useState('maximize');

  // Design constraints state
  const [designConstraints, setDesignConstraints] = useState({});

  // Reverse solver state
  const [reverseResult, setReverseResult] = useState(null);
  const [reverseTarget, setReverseTarget] = useState('period');
  const [reverseTargetVal, setReverseTargetVal] = useState(2.0);
  const [reverseVarKey, setReverseVarKey] = useState('length');
  const [reverseVarBounds, setReverseVarBounds] = useState([0.2, 5.0]);

  // Chat state
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const [verifyRes, setVerifyRes] = useState(null);

  useEffect(() => {
    // Reset Reverse Solver when changing mechanisms
    if (simType === 'simple_pendulum') {
      setReverseTarget('period');
      setReverseVarKey('length');
    } else if (simType === 'compound_pendulum') {
      setReverseTarget('period');
      setReverseVarKey('length');
    } else if (simType === 'slider_crank') {
      setReverseTarget('stroke');
      setReverseVarKey('crank_length');
    } else if (simType === 'four_bar') {
      setReverseTarget('rocker_range_deg');
      setReverseVarKey('link_ground');
    }
    setReverseResult(null);
  }, [simType]);

  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const frameRef  = useRef(0);
  const playingRef = useRef(false);
  const chatEndRef = useRef(null);

  // ─── Switch Simulation Module ───────────────────────────────────
  const switchSim = useCallback((type) => {
    setSimType(type);
    setParams({ ...SIMULATIONS[type].defaults });
    setSimData(null);
    setValidation(null);
    setDesignRes(null);
    setOptRes(null);
    setSensRes(null);
    setReverseResult(null);
    setAnimIdx(0);
    setIsPlaying(false);
    playingRef.current = false;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    // Reset optimizer selections when switching mechanism
    setOptSelectedParams({});
    setOptObjective('');
    setDesignConstraints({});
  }, []);

  // ─── Apply Preset ───────────────────────────────────────────────
  const applyPreset = (presetParams) => {
    setParams(p => ({ ...p, ...presetParams }));
  };

  // ─── Run Simulation Engine ───────────────────────────────────────
  const runSimulation = useCallback(async () => {
    setLoading(true);
    setAnimIdx(0);
    setIsPlaying(false);
    playingRef.current = false;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    try {
      const res = await axios.post(`${API}/simulate`, { sim_type: simType, params });
      const data = res.data.data;
      setSimData(data);

      const valRes = await axios.post(`${API}/validate`, {
        sim_type: simType, params, sim_data: data
      });
      setValidation(valRes.data);
    } catch (e) {
      alert('Backend Engine Error: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  }, [simType, params]);

  // ─── Animation Loop (60 FPS Canvas) ────────────────────────────
  useEffect(() => {
    if (!simData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    canvas.width  = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    let localIdx = frameRef.current;

    const drawFrame = () => {
      const idx = localIdx;
      const len = simData.time?.length || simData.crank_angle_deg?.length || 1;

      if (simType === 'simple_pendulum') {
        drawSimplePendulum(ctx, w, h, simData.theta_deg?.[idx] ?? 0, params, simData.omega?.[idx] ?? 0);
      } else if (simType === 'compound_pendulum') {
        drawCompoundPendulum(ctx, w, h, simData.theta_deg?.[idx] ?? 0, params);
      } else if (simType === 'slider_crank') {
        drawSliderCrank(ctx, w, h, simData.crank_angle_deg?.[idx] ?? 0, simData, params);
      } else if (simType === 'four_bar') {
        drawFourBar(ctx, w, h, idx, simData, params);
      }

      if (playingRef.current) {
        localIdx = (localIdx + Math.ceil(animSpeed)) % len;
        frameRef.current = localIdx;
        setAnimIdx(localIdx);
        animRef.current = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();
  }, [simData, isPlaying, simType, params, animSpeed]);

  // Static scrub redraw
  useEffect(() => {
    if (!simData || !canvasRef.current || isPlaying) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const idx = animIdx;

    if (simType === 'simple_pendulum') drawSimplePendulum(ctx, w, h, simData.theta_deg?.[idx] ?? 0, params, simData.omega?.[idx] ?? 0);
    else if (simType === 'compound_pendulum') drawCompoundPendulum(ctx, w, h, simData.theta_deg?.[idx] ?? 0, params);
    else if (simType === 'slider_crank') drawSliderCrank(ctx, w, h, simData.crank_angle_deg?.[idx] ?? 0, simData, params);
    else if (simType === 'four_bar') drawFourBar(ctx, w, h, idx, simData, params);
  }, [animIdx, simData, simType, isPlaying, params]);

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (!simData) return;
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);
    playingRef.current = newPlaying;
    frameRef.current = animIdx;
  }, [isPlaying, simData, animIdx]);

  const stepAnim = (direction) => {
    if (!simData) return;
    const len = simData.time?.length || simData.crank_angle_deg?.length || 1;
    const nextIdx = (animIdx + direction + len) % len;
    setAnimIdx(nextIdx);
    frameRef.current = nextIdx;
  };

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  // ─── Analysis Engine Calls ───────────────────────────────────────
  const runDesign = async () => {
    setAnalysisLoading(true);
    try {
      const pKeys = SIMULATIONS[simType].sliders.map(s => s.key);
      const param_ranges = {};
      const fixed_params = {};

      // Use first 2 sliders as variable params
      pKeys.forEach((k, i) => {
        if (i < 2) {
          const s = SIMULATIONS[simType].sliders.find(x => x.key === k);
          param_ranges[k] = { min: s.min, max: s.max };
        } else {
          fixed_params[k] = params[k];
        }
      });

      // Build mechanism-specific constraints from UI state
      const constraints = {};
      Object.entries(designConstraints).forEach(([key, val]) => {
        if (val.min !== '' || val.max !== '') {
          constraints[key] = {};
          if (val.min !== '') constraints[key].min = parseFloat(val.min);
          if (val.max !== '') constraints[key].max = parseFloat(val.max);
        }
      });

      // Fallback default constraints if none set
      if (Object.keys(constraints).length === 0) {
        if (simType === 'simple_pendulum' || simType === 'compound_pendulum') {
          constraints.period = { min: 1.0, max: 5.0 };
        } else if (simType === 'slider_crank') {
          constraints.stroke = { min: 0.05, max: 0.5 };
        } else if (simType === 'four_bar') {
          constraints.rocker_range_deg = { min: 30 };
        }
      }

      const res = await axios.post(`${API}/design`, { sim_type: simType, constraints, param_ranges, fixed_params, n_points: 7 });
      setDesignRes(res.data.data);
    } catch (e) { alert('Design Sweep Error: ' + (e.response?.data?.message || e.message)); }
    setAnalysisLoading(false);
  };

  const runOptimization = async () => {
    setAnalysisLoading(true);
    try {
      const param_bounds = {};
      const fixed_params = {};

      // Use user-selected parameters, fall back to first slider
      const selectedKeys = Object.entries(optSelectedParams).filter(([,v]) => v).map(([k]) => k);
      const activeKeys = selectedKeys.length > 0 ? selectedKeys : [SIMULATIONS[simType].sliders[0].key];

      SIMULATIONS[simType].sliders.forEach(s => {
        if (activeKeys.includes(s.key)) {
          param_bounds[s.key] = [s.min, s.max];
        } else {
          fixed_params[s.key] = params[s.key];
        }
      });

      const objMap = { simple_pendulum: 'period', compound_pendulum: 'period', slider_crank: 'stroke', four_bar: 'rocker_range_deg' };
      const objective = optObjective || objMap[simType];

      const res = await axios.post(`${API}/optimize`, {
        sim_type: simType,
        objective,
        direction: optDirection,
        param_bounds,
        fixed_params
      });
      setOptRes(res.data.data);
    } catch (e) { alert('Optimization Error: ' + (e.response?.data?.message || e.message)); }
    setAnalysisLoading(false);
  };

  const runSensitivity = async () => {
    setAnalysisLoading(true);
    try {
      const pKeys = SIMULATIONS[simType].sliders.map(s => s.key);
      const res = await axios.post(`${API}/sensitivity`, { sim_type: simType, base_params: params, perturbation_pct: 10, param_keys: pKeys });
      setSensRes(res.data.data);
    } catch (e) { alert('Sensitivity Error'); }
    setAnalysisLoading(false);
  };

  const runReverseSolve = async () => {
    setAnalysisLoading(true);
    setReverseResult(null);
    try {
      const sliders = SIMULATIONS[simType].sliders;
      const varSlider = sliders.find(s => s.key === reverseVarKey);
      const fixed_params = {};
      sliders.forEach(s => {
        if (s.key !== reverseVarKey) fixed_params[s.key] = params[s.key];
      });
      const bounds = varSlider ? [varSlider.min, varSlider.max] : reverseVarBounds;
      const res = await axios.post(`${API}/reverse_solve`, {
        sim_type: simType,
        output_key: reverseTarget,
        target_value: parseFloat(reverseTargetVal),
        variable_key: reverseVarKey,
        variable_bounds: bounds,
        fixed_params,
      });
      setReverseResult(res.data.data);
    } catch (e) { alert('Reverse Solve Error: ' + (e.response?.data?.message || e.message)); }
    setAnalysisLoading(false);
  };

  const runVerification = async () => {
    setAnalysisLoading(true);
    try {
      const res = await axios.post(`${API}/verify_timestep`, { sim_type: simType, params });
      setVerifyRes(res.data.data);
    } catch (e) { alert('Verification Error'); }
    setAnalysisLoading(false);
  };

  // ─── AI Chat Query ───────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const q = chatInput.trim();
    setChatInput('');
    setChatHistory(h => [...h, { role: 'user', text: q }]);
    setChatLoading(true);
    try {
      const res = await axios.post(`${API}/ai-query`, {
        query: q, sim_type: simType, params,
        results: simData ? {
          period: validation?.summary?.T_numerical || validation?.summary?.T_exact,
          energy_drift: simData.energy_drift,
          energy_dissipated: simData.energy_dissipated,
          stroke: simData.stroke,
          grashof: validation?.summary?.grashof_condition,
        } : {}
      });
      setChatHistory(h => [...h, { role: 'ai', text: res.data.response }]);
    } catch (e) {
      setChatHistory(h => [...h, { role: 'ai', text: '⚠️ AI service offline. Please check Flask server logs.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Exports
  const exportCSV = async () => {
    if (!simData) return;
    const res = await axios.post(`${API}/export/csv`, { sim_data: simData, params, sim_type: simType }, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = `${simType}_data.csv`; a.click();
  };

  const exportPDF = async () => {
    if (!simData) return;
    const res = await axios.post(`${API}/export/pdf`, { sim_data: simData, params, sim_type: simType, validation: validation || {} }, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = `${simType}_report.pdf`; a.click();
  };

  const simLen = simData?.time?.length || simData?.crank_angle_deg?.length || 0;
  const cfg    = SIMULATIONS[simType];

  return (
    <div className="app-layout">
      {/* ── Header Bar ── */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">⚙️</div>
          <div>
            <div className="header-title">MechSim Pro</div>
            <div className="header-subtitle">Planar Mechanism & Pendulum Visualizer</div>
          </div>
        </div>
        <div className="header-actions">
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <span className={`status-dot ${loading ? 'running' : 'idle'}`}></span>
            {loading ? 'Computing RK45...' : simData ? 'Simulation Ready' : 'Idle'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV} disabled={!simData}>📊 CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={exportPDF} disabled={!simData}>📄 PDF</button>
          <button className="btn btn-primary" onClick={runSimulation} disabled={loading}>
            {loading ? <><div className="spinner"></div> Computing...</> : '▶ Run Simulation'}
          </button>
        </div>
      </header>

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Module Selector */}
        <div className="card">
          <div className="card-title">Mechanism Module</div>
          {Object.entries(SIMULATIONS).map(([key, s]) => (
            <button
              key={key}
              className={`sim-btn ${simType === key ? 'active' : ''}`}
              onClick={() => switchSim(key)}
            >
              <span className="sim-btn-icon">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Presets Bar */}
        {cfg.presets && (
          <div className="card">
            <div className="card-title">Quick Presets</div>
            <div className="preset-bar">
              {cfg.presets.map((p, idx) => (
                <button key={idx} className="preset-btn" onClick={() => applyPreset(p.params)}>
                  ⚡ {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dual Parameter Inputs */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">System Parameters</div>
          {cfg.sliders.map(s => (
            <div className="param-row" key={s.key}>
              <div className="param-label">
                <span>{s.label}</span>
                <div className="param-value-container">
                  <input
                    type="number"
                    className="param-number-input"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={params[s.key] ?? s.min}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) setParams(p => ({ ...p, [s.key]: val }));
                    }}
                  />
                  <span className="param-unit">{s.unit}</span>
                </div>
              </div>
              <input
                type="range" min={s.min} max={s.max} step={s.step}
                value={params[s.key] ?? s.min}
                onChange={e => setParams(p => ({ ...p, [s.key]: parseFloat(e.target.value) }))}
              />
            </div>
          ))}

          <div className="param-row" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div className="param-label">
              <span>Time Span (t_max)</span>
              <div className="param-value-container">
                <input
                  type="number" className="param-number-input" min={1} max={30} step={0.5}
                  value={params.t_max ?? 15}
                  onChange={e => setParams(p => ({ ...p, t_max: parseFloat(e.target.value) }))}
                />
                <span className="param-unit">s</span>
              </div>
            </div>
            <input type="range" min={1} max={30} step={0.5} value={params.t_max ?? 15}
              onChange={e => setParams(p => ({ ...p, t_max: parseFloat(e.target.value) }))} />
          </div>
        </div>

        {/* Live Metrics */}
        {validation?.summary && (
          <div className="card">
            <div className="card-title">Key Indicators</div>
            <div className="metric-grid">
              {validation.summary.T_exact && (
                <div className="metric-card">
                  <div className="metric-label">Period (Theoretical)</div>
                  <div className="metric-value">{parseFloat(validation.summary.T_exact).toFixed(3)}<span className="metric-unit">s</span></div>
                </div>
              )}
              {validation.summary.T_numerical && (
                <div className="metric-card">
                  <div className="metric-label">Period (RK45)</div>
                  <div className="metric-value">{parseFloat(validation.summary.T_numerical).toFixed(3)}<span className="metric-unit">s</span></div>
                </div>
              )}
              {validation.summary.energy_conservation && (
                <div className="metric-card">
                  <div className="metric-label">Energy Pass</div>
                  <div className="metric-value" style={{ fontSize: 13, color: validation.summary.energy_conservation === 'PASS' ? 'var(--accent2)' : 'var(--danger)' }}>
                    {validation.summary.energy_conservation}
                  </div>
                </div>
              )}
              {validation.summary.grashof_condition && (
                <div className="metric-card">
                  <div className="metric-label">Grashof Type</div>
                  <div className="metric-value" style={{ fontSize: 11 }}>{validation.summary.grashof_condition}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ── Main Content ── */}
      <div className="main-content">
        {/* Navigation Tabs */}
        <div className="tab-bar">
          {[
            { id: 'dashboard', label: '🏠 Dashboard' },
            { id: 'animation', label: '1. Model & Simulate' },
            { id: 'charts', label: '2. Results & Charts' },
            { id: 'validation', label: '3. Validate (Physics)' },
            { id: 'verification', label: '4. Verify (Solver)' },
            { id: 'design', label: '5. Design (Sweep)' },
            { id: 'sensitivity', label: '6. Sensitivity (OAT)' },
            { id: 'optimize', label: '7. Optimize (Global)' },
            { id: 'reverse', label: '8. Reverse Solve' },
            { id: 'ai', label: '9. AI Assistant' },
          ].map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Dashboard Tab ── */}
        {tab === 'dashboard' && (
          <div style={{ padding: 40, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 64, fontWeight: 800, background: 'linear-gradient(135deg, var(--primary-light), var(--accent2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-1px' }}>
              MechSim Pro
            </div>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 640, lineHeight: 1.6 }}>
              Interactive Modelling, Simulation, Validation, Analysis and Optimization Platform for Dynamic Mechanical Systems.
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
              <button className="btn btn-primary" onClick={() => setTab('animation')} style={{ padding: '14px 28px', fontSize: 14 }}>
                Start Modeling Workflow 🚀
              </button>
            </div>
            
            <div className="metric-grid" style={{ marginTop: 40, width: '100%', maxWidth: 800 }}>
              <div className="card" style={{ textAlign: 'left' }}>
                <div className="card-title">Active Engine</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-light)' }}>Adaptive RK45 Integrator</div>
              </div>
              <div className="card" style={{ textAlign: 'left' }}>
                <div className="card-title">Analytical Precision</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>Verification & Validation</div>
              </div>
              <div className="card" style={{ textAlign: 'left' }}>
                <div className="card-title">Design Sweep</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--warn)' }}>Multi-Dimensional Feasibility</div>
              </div>
              <div className="card" style={{ textAlign: 'left' }}>
                <div className="card-title">Global Optimization</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent2)' }}>Differential Evolution</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Animation Viewport Tab ── */}
        {tab === 'animation' && (
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            <div className="canvas-viewport">
              <canvas ref={canvasRef} id="mechCanvas" />
              {!simData && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 44, marginBottom: 10 }}>{cfg.icon}</div>
                    <div>Set parameters & click <strong style={{ color: 'var(--primary-light)' }}>▶ Run Simulation</strong></div>
                  </div>
                </div>
              )}
            </div>

            {/* Viewport Playback HUD Controls */}
            {simData && (
              <div className="card" style={{ padding: '12px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => stepAnim(-1)}>⏮ Step</button>
                    <button className="btn btn-primary btn-sm" onClick={togglePlay} style={{ minWidth: 90 }}>
                      {isPlaying ? '⏸ Pause' : '▶ Play'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => stepAnim(1)}>Step ⏭</button>
                  </div>

                  <input
                    type="range" min={0} max={simLen - 1} step={1} value={animIdx}
                    onChange={e => { setAnimIdx(parseInt(e.target.value)); frameRef.current = parseInt(e.target.value); }}
                    style={{ flex: 1 }}
                  />

                  {/* Speed Pill Multipliers */}
                  <div className="speed-pill-group">
                    {[0.25, 0.5, 1, 2, 5].map(s => (
                      <button key={s} className={`speed-pill ${animSpeed === s ? 'active' : ''}`} onClick={() => setAnimSpeed(s)}>
                        {s}×
                      </button>
                    ))}
                  </div>

                  <span className="mono" style={{ fontSize: 11, color: 'var(--accent)', minWidth: 90, textAlign: 'right' }}>
                    {simData.time ? `t=${(simData.time[animIdx] || 0).toFixed(2)}s` : `Frame ${animIdx}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Kinematic Charts Tab — Mechanism Specific ── */}
        {tab === 'charts' && (
          <div className="charts-grid">
            {/* ── PENDULUMS ── */}
            {(simType === 'simple_pendulum' || simType === 'compound_pendulum') && (<>
              <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
                <div className="chart-card-title">Position History — θ (rad) vs Time</div>
                <div className="chart-container">
                  {simData ? <Line data={{ labels: simData.time.filter((_,i)=>i%5===0).map(v=>v.toFixed(2)), datasets: [{ label: 'θ (rad)', data: simData.theta.filter((_,i)=>i%5===0), borderColor: '#6366f1', borderWidth: 2, pointRadius: 0, tension: 0.3 }] }} options={chartOpts('θ (rad)')} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation to display plots</div>}
                </div>
              </div>
              <div className="chart-card">
                <div className="chart-card-title">Angular Velocity — ω (rad/s) vs Time</div>
                <div className="chart-container">
                  {simData ? <Line data={{ labels: simData.time.filter((_,i)=>i%5===0).map(v=>v.toFixed(2)), datasets: [{ label: 'ω (rad/s)', data: simData.omega.filter((_,i)=>i%5===0), borderColor: '#06b6d4', borderWidth: 2, pointRadius: 0, tension: 0.3 }] }} options={chartOpts('ω (rad/s)')} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation</div>}
                </div>
              </div>
              <div className="chart-card">
                <div className="chart-card-title">Angular Acceleration — α (rad/s²) vs Time</div>
                <div className="chart-container">
                  {simData ? <Line data={{ labels: simData.time.filter((_,i)=>i%5===0).map(v=>v.toFixed(2)), datasets: [{ label: 'α (rad/s²)', data: simData.alpha.filter((_,i)=>i%5===0), borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0, tension: 0.3 }] }} options={chartOpts('α (rad/s²)')} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation</div>}
                </div>
              </div>
              <div className="chart-card">
                <div className="chart-card-title">Energy Conservation — KE, PE, Total (J)</div>
                <div className="chart-container">
                  {simData && simData.KE ? <Line data={{ labels: simData.time.filter((_,i)=>i%5===0).map(v=>v.toFixed(2)), datasets: [
                    { label: 'KE (J)', data: simData.KE.filter((_,i)=>i%5===0), borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0 },
                    { label: 'PE (J)', data: simData.PE.filter((_,i)=>i%5===0), borderColor: '#f43f5e', borderWidth: 2, pointRadius: 0 },
                    { label: 'Total E (J)', data: simData.total_E.filter((_,i)=>i%5===0), borderColor: '#10b981', borderWidth: 2.5, pointRadius: 0, borderDash: [4,3] }
                  ] }} options={chartOpts('Energy (J)')} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation</div>}
                </div>
              </div>
              <div className="chart-card">
                <div className="chart-card-title">Phase Portrait — θ vs ω</div>
                <div className="chart-container">
                  {simData && simData.theta && simData.omega ? <Scatter data={{ datasets: [{ label: 'Phase Portrait', data: simData.theta.filter((_,i)=>i%4===0).map((th,i)=>({x:th,y:simData.omega[i*4]})), borderColor:'#818cf8', backgroundColor:'rgba(99,102,241,0.6)', pointRadius:1.5, showLine:true }] }} options={scatterOpts} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation</div>}
                </div>
              </div>
            </>)}

            {/* ── SLIDER-CRANK ── */}
            {simType === 'slider_crank' && (<>
              <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
                <div className="chart-card-title">Slider Displacement x(t) vs Time</div>
                <div className="chart-container">
                  {simData ? <Line data={{ labels: simData.time.filter((_,i)=>i%3===0).map(v=>v.toFixed(3)), datasets: [{ label: 'x (m)', data: simData.x_slider.filter((_,i)=>i%3===0), borderColor: '#6366f1', borderWidth: 2, pointRadius: 0, tension: 0.3 }] }} options={chartOpts('Displacement (m)')} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation to display plots</div>}
                </div>
              </div>
              <div className="chart-card">
                <div className="chart-card-title">Slider Velocity v(t) — m/s</div>
                <div className="chart-container">
                  {simData ? <Line data={{ labels: simData.time.filter((_,i)=>i%3===0).map(v=>v.toFixed(3)), datasets: [{ label: 'v (m/s)', data: simData.v_slider.filter((_,i)=>i%3===0), borderColor: '#06b6d4', borderWidth: 2, pointRadius: 0, tension: 0.3 }] }} options={chartOpts('Velocity (m/s)')} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation</div>}
                </div>
              </div>
              <div className="chart-card">
                <div className="chart-card-title">Slider Acceleration a(t) — m/s²</div>
                <div className="chart-container">
                  {simData ? <Line data={{ labels: simData.time.filter((_,i)=>i%3===0).map(v=>v.toFixed(3)), datasets: [{ label: 'a (m/s²)', data: simData.a_slider.filter((_,i)=>i%3===0), borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0, tension: 0.3 }] }} options={chartOpts('Acceleration (m/s²)')} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation</div>}
                </div>
              </div>
              <div className="chart-card">
                <div className="chart-card-title">Stroke vs Crank Angle (x vs θ)</div>
                <div className="chart-container">
                  {simData ? <Scatter data={{ datasets: [{ label: 'x vs θ', data: simData.crank_angle_deg.filter((_,i)=>i%3===0).map((th,i)=>({x:th,y:simData.x_slider[i*3]})), borderColor:'#10b981', pointRadius:1.5, showLine:true }] }} options={{ ...scatterOpts, scales: { x: { ...scatterOpts.scales.x, title: { display:true, text:'Crank Angle (°)', color:'#94a3b8' } }, y: { ...scatterOpts.scales.y, title: { display:true, text:'Displacement (m)', color:'#94a3b8' } } } }} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation</div>}
                </div>
              </div>
            </>)}

            {/* ── FOUR-BAR ── */}
            {simType === 'four_bar' && (<>
              <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
                <div className="chart-card-title">Link Angles vs Time — θ₂ (Crank), θ₃ (Coupler), θ₄ (Rocker)</div>
                <div className="chart-container">
                  {simData ? <Line data={{ labels: simData.time.filter((_,i)=>i%5===0).map(v=>v.toFixed(2)), datasets: [
                    { label: 'θ₂ Crank (°)', data: simData.crank_angle_deg.filter((_,i)=>i%5===0), borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0, tension: 0.3 },
                    { label: 'θ₃ Coupler (°)', data: simData.coupler_angle_deg.filter((_,i)=>i%5===0), borderColor: '#06b6d4', borderWidth: 2, pointRadius: 0, tension: 0.3 },
                    { label: 'θ₄ Rocker (°)', data: simData.rocker_angle_deg.filter((_,i)=>i%5===0), borderColor: '#10b981', borderWidth: 2, pointRadius: 0, tension: 0.3 },
                  ] }} options={chartOpts('Angle (°)')} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation to display plots</div>}
                </div>
              </div>
              <div className="chart-card">
                <div className="chart-card-title">Angular Velocities — ω₃ & ω₄ (rad/s)</div>
                <div className="chart-container">
                  {simData ? <Line data={{ labels: simData.time.filter((_,i)=>i%5===0).map(v=>v.toFixed(2)), datasets: [
                    { label: 'ω₃ Coupler (rad/s)', data: simData.omega3.filter((_,i)=>i%5===0), borderColor: '#06b6d4', borderWidth: 2, pointRadius: 0 },
                    { label: 'ω₄ Rocker (rad/s)', data: simData.omega4.filter((_,i)=>i%5===0), borderColor: '#10b981', borderWidth: 2, pointRadius: 0 }
                  ] }} options={chartOpts('Angular Velocity (rad/s)')} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation</div>}
                </div>
              </div>
              <div className="chart-card">
                <div className="chart-card-title">Angular Accelerations — α₃ & α₄ (rad/s²)</div>
                <div className="chart-container">
                  {simData ? <Line data={{ labels: simData.time.filter((_,i)=>i%5===0).map(v=>v.toFixed(2)), datasets: [
                    { label: 'α₃ Coupler (rad/s²)', data: simData.alpha3.filter((_,i)=>i%5===0), borderColor: '#818cf8', borderWidth: 2, pointRadius: 0 },
                    { label: 'α₄ Rocker (rad/s²)', data: simData.alpha4.filter((_,i)=>i%5===0), borderColor: '#f43f5e', borderWidth: 2, pointRadius: 0 }
                  ] }} options={chartOpts('Angular Acceleration (rad/s²)')} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation</div>}
                </div>
              </div>
              <div className="chart-card">
                <div className="chart-card-title">Coupler Point Trajectory (x, y)</div>
                <div className="chart-container">
                  {simData && simData.coupler_x ? <Scatter data={{ datasets: [{ label: 'Coupler Path', data: simData.coupler_x.filter((_,i)=>i%3===0).map((x,i)=>({x,y:simData.coupler_y[i*3]})), borderColor:'#06b6d4', pointRadius:1.5, showLine:true }] }} options={{ ...scatterOpts, scales: { x: { ...scatterOpts.scales.x, title:{display:true,text:'x (m)',color:'#94a3b8'} }, y: { ...scatterOpts.scales.y, title:{display:true,text:'y (m)',color:'#94a3b8'} } } }} />
                    : <div style={{color:'var(--text-muted)',textAlign:'center',paddingTop:80}}>Run simulation</div>}
                </div>
              </div>
            </>)}
          </div>
        )}

        {/* ── Validation Tab ── */}
        {tab === 'validation' && (
          <div style={{ padding: 20, flex: 1 }}>
            {!validation ? (
              <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 44 }}>📊</div>
                <div style={{ marginTop: 12 }}>Run a simulation to generate analytical benchmarks</div>
              </div>
            ) : (
              <>
                {validation.paper_info?.source && (
                  <div style={{ padding: '12px 18px', background: 'rgba(99,102,241,0.08)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                    <span style={{ color: 'var(--primary-light)', fontWeight: 700 }}>📚 Benchmark Source: </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{validation.paper_info.source}</span>
                  </div>
                )}

                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-title">Numerical (RK45) vs Analytical Error Matrix</div>
                  <table className="val-table">
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Theoretical</th>
                        <th>Numerical (RK45)</th>
                        <th>Paper Reference</th>
                        <th>Abs Error</th>
                        <th>% Error</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(validation.rows || []).map((row, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.name}</td>
                          <td>{row.theoretical}</td>
                          <td style={{ color: 'var(--accent)' }}>{row.numerical}</td>
                          <td style={{ color: 'var(--warn)' }}>{row.paper}</td>
                          <td>{row.abs_error}</td>
                          <td>{row.pct_error}</td>
                          <td>
                            <span className={`badge ${row.pass ? 'badge-pass' : 'badge-fail'}`}>
                              {row.pass ? '✓ PASS' : '✗ FAIL'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Verification Tab ── */}
        {tab === 'verification' && (
          <div className="analysis-panel">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="card-title" style={{ margin: 0 }}>Numerical convergence / output-resolution verification</div>
                <button className="btn btn-primary btn-sm" onClick={runVerification} disabled={analysisLoading}>
                  {analysisLoading ? <><div className="spinner"></div> Computing...</> : '⚡ Run Timestep Convergence'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzes numerical stability by sweeping through different integration timesteps (dt). Used to verify the solver, not the physics model.</p>
            </div>
            
            {verifyRes && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-title">Convergence Table</div>
                <table className="val-table">
                  <thead>
                    <tr>
                      <th>Timestep (dt)</th>
                      {Object.keys(verifyRes[0]).filter(k => k !== 'dt').map(k => <th key={k}>{k.replace(/_/g, ' ').toUpperCase()}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {verifyRes.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{r.dt} s</td>
                        {Object.entries(r).filter(([k]) => k !== 'dt').map(([k, v]) => (
                          <td key={k}>{typeof v === 'number' ? v.toFixed(6) : v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Design Sweep Tab — Mechanism-Specific Constraints ── */}
        {tab === 'design' && (
          <div className="analysis-panel">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="card-title" style={{ margin: 0 }}>Engineering Design Mode</div>
                <button className="btn btn-primary btn-sm" onClick={runDesign} disabled={analysisLoading}>
                  {analysisLoading ? <><div className="spinner"></div> Sweeping Grid...</> : '⚡ Run Parameter Sweep'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Set output constraints below then sweep the first two parameters to find feasible designs.</p>

              {/* Mechanism-Specific Constraint Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-light)', marginBottom: 4 }}>Output Constraints</div>

                {(simType === 'simple_pendulum' || simType === 'compound_pendulum') && [
                  { key: 'period', label: 'Period T', unit: 's' },
                  { key: 'max_omega', label: 'Max Angular Velocity ω', unit: 'rad/s' },
                ].map(c => (
                  <div key={c.key} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
                    <span style={{ width: 160, color: 'var(--text-secondary)' }}>{c.label} ({c.unit})</span>
                    <input type="number" placeholder="Min" step="any" className="param-number-input" style={{ width: 80 }}
                      value={designConstraints[c.key]?.min ?? ''}
                      onChange={e => setDesignConstraints(d => ({...d, [c.key]: {...(d[c.key]||{}), min: e.target.value}}))} />
                    <span style={{ color: 'var(--text-muted)' }}>to</span>
                    <input type="number" placeholder="Max" step="any" className="param-number-input" style={{ width: 80 }}
                      value={designConstraints[c.key]?.max ?? ''}
                      onChange={e => setDesignConstraints(d => ({...d, [c.key]: {...(d[c.key]||{}), max: e.target.value}}))} />
                  </div>
                ))}

                {simType === 'slider_crank' && [
                  { key: 'stroke', label: 'Stroke', unit: 'm' },
                  { key: 'v_max', label: 'Max Velocity', unit: 'm/s' },
                  { key: 'a_max', label: 'Max Acceleration', unit: 'm/s²' },
                ].map(c => (
                  <div key={c.key} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
                    <span style={{ width: 160, color: 'var(--text-secondary)' }}>{c.label} ({c.unit})</span>
                    <input type="number" placeholder="Min" step="any" className="param-number-input" style={{ width: 80 }}
                      value={designConstraints[c.key]?.min ?? ''}
                      onChange={e => setDesignConstraints(d => ({...d, [c.key]: {...(d[c.key]||{}), min: e.target.value}}))} />
                    <span style={{ color: 'var(--text-muted)' }}>to</span>
                    <input type="number" placeholder="Max" step="any" className="param-number-input" style={{ width: 80 }}
                      value={designConstraints[c.key]?.max ?? ''}
                      onChange={e => setDesignConstraints(d => ({...d, [c.key]: {...(d[c.key]||{}), max: e.target.value}}))} />
                  </div>
                ))}

                {simType === 'four_bar' && [
                  { key: 'rocker_range_deg', label: 'Rocker Range', unit: '°' },
                  { key: 'max_omega4', label: 'Max Rocker ω₄', unit: 'rad/s' },
                ].map(c => (
                  <div key={c.key} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
                    <span style={{ width: 160, color: 'var(--text-secondary)' }}>{c.label} ({c.unit})</span>
                    <input type="number" placeholder="Min" step="any" className="param-number-input" style={{ width: 80 }}
                      value={designConstraints[c.key]?.min ?? ''}
                      onChange={e => setDesignConstraints(d => ({...d, [c.key]: {...(d[c.key]||{}), min: e.target.value}}))} />
                    <span style={{ color: 'var(--text-muted)' }}>to</span>
                    <input type="number" placeholder="Max" step="any" className="param-number-input" style={{ width: 80 }}
                      value={designConstraints[c.key]?.max ?? ''}
                      onChange={e => setDesignConstraints(d => ({...d, [c.key]: {...(d[c.key]||{}), max: e.target.value}}))} />
                  </div>
                ))}
              </div>
            </div>

            {designRes && (
              <div className="analysis-grid">
                <div className="card">
                  <div className="card-title">Top Recommended Configurations ({designRes.feasible_count} / {designRes.total_count} feasible)</div>
                  {designRes.ranked_designs?.length === 0 && <div style={{ fontSize: 12, color: 'var(--danger)' }}>No feasible designs found. Try relaxing the constraints.</div>}
                  {designRes.ranked_designs?.map((d, i) => (
                    <div key={i} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 10, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)' }} onClick={() => setParams({...params, ...d.params})}>
                      <div style={{ color: 'var(--primary-light)', fontWeight: 700, marginBottom: 4 }}>Rank #{i+1} (Score: {d.score.toFixed(2)})</div>
                      {Object.entries(d.params).map(([k,v]) => <div key={k}>{k}: <span className="mono">{v.toFixed(3)}</span></div>)}
                      {Object.entries(d.metrics).map(([k,v]) => <div key={k} style={{ color: 'var(--text-secondary)' }}>{k}: <span className="mono">{typeof v === 'number' ? v.toFixed(3) : v}</span></div>)}
                      <div style={{ color: 'var(--accent2)', marginTop: 6, fontWeight: 700 }}>↩ Click to Apply Parameters</div>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <div className="card-title">2D Feasibility Heatmap</div>
                  {designRes.heatmap_data ? (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>X: <span className="mono" style={{ color: 'var(--accent)' }}>{designRes.heatmap_data.x_key}</span> | Y: <span className="mono" style={{ color: 'var(--accent)' }}>{designRes.heatmap_data.y_key}</span></div>
                      <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${designRes.heatmap_data.x_values.length}, 1fr)` }}>
                        {designRes.heatmap_data.pass_grid.flatMap((row, rIdx) =>
                          row.map((pass, cIdx) => (
                            <div key={`${rIdx}-${cIdx}`} className={`heatmap-cell ${pass ? 'heatmap-cell-pass' : 'heatmap-cell-fail'}`} title={`Score: ${designRes.heatmap_data.score_grid[rIdx][cIdx]}`}>{pass ? '✓' : '✗'}</div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Run sweep to generate heatmap.</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Global Optimization Tab — Multi-Variable ── */}
        {tab === 'optimize' && (
          <div className="analysis-panel">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div className="card-title" style={{ margin: 0 }}>Differential Evolution Optimizer</div>
                <button className="btn btn-primary btn-sm" onClick={runOptimization} disabled={analysisLoading}>
                  {analysisLoading ? <><div className="spinner"></div> Optimizing...</> : '⚡ Run Optimization'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
                {/* Parameter Selection */}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-light)', marginBottom: 8 }}>Parameters to Optimize</div>
                  {SIMULATIONS[simType].sliders.map(s => (
                    <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!optSelectedParams[s.key]}
                        onChange={e => setOptSelectedParams(p => ({...p, [s.key]: e.target.checked}))}
                        style={{ accentColor: 'var(--primary-light)', width: 14, height: 14 }} />
                      <span style={{ color: optSelectedParams[s.key] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {s.label} <span style={{ color: 'var(--text-muted)' }}>({s.min} – {s.max} {s.unit})</span>
                      </span>
                    </label>
                  ))}
                </div>

                {/* Objective & Direction */}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-light)', marginBottom: 8 }}>Objective Target</div>
                  <select value={optObjective || (simType === 'simple_pendulum' || simType === 'compound_pendulum' ? 'period' : simType === 'slider_crank' ? 'stroke' : 'rocker_range_deg')}
                    onChange={e => setOptObjective(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, marginBottom: 12 }}>
                    {simType === 'simple_pendulum' && <>
                      <option value="period">Period T (s)</option>
                      <option value="energy_drift_pct">Energy Drift (%)</option>
                      <option value="max_omega">Peak Angular Velocity (rad/s)</option>
                    </>}
                    {simType === 'compound_pendulum' && <>
                      <option value="period">Period T (s)</option>
                      <option value="energy_drift_pct">Energy Drift (%)</option>
                    </>}
                    {simType === 'slider_crank' && <>
                      <option value="stroke">Stroke (m)</option>
                      <option value="v_max">Max Velocity (m/s)</option>
                      <option value="a_max">Max Acceleration (m/s²)</option>
                    </>}
                    {simType === 'four_bar' && <>
                      <option value="rocker_range_deg">Rocker Range (°)</option>
                      <option value="max_omega4">Max Rocker ω₄ (rad/s)</option>
                    </>}
                  </select>

                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-light)', marginBottom: 8 }}>Direction</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['minimize', 'maximize'].map(d => (
                      <button key={d} onClick={() => setOptDirection(d)}
                        className={`btn btn-sm ${optDirection === d ? 'btn-primary' : 'btn-ghost'}`}>
                        {d === 'minimize' ? '▼ Minimize' : '▲ Maximize'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {optRes && (
              <div className="analysis-grid">
                <div className="card">
                  <div className="card-title">Optimum Result</div>
                  <div style={{ marginBottom: 16 }}>
                    <div className="metric-label">Objective: {optRes.objective_label}</div>
                    <div className="metric-value">{optRes.optimal_value?.toFixed(4) || '--'}</div>
                    <div style={{ fontSize: 11, color: optRes.success ? 'var(--accent2)' : 'var(--danger)', marginTop: 4 }}>
                      {optRes.success ? '✓ Converged successfully' : '✗ Failed to converge'}
                    </div>
                  </div>
                  <div className="card-title">Optimal Parameters</div>
                  <table className="val-table">
                    <tbody>
                      {Object.entries(optRes.optimal_params || {}).map(([k,v]) => (
                        <tr key={k}>
                          <td>{k}</td>
                          <td style={{ color: 'var(--primary-light)', fontWeight: 'bold' }}>{v.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 14 }} onClick={() => setParams({...params, ...optRes.optimal_params})}>
                    Apply Optimal Parameters to Simulator
                  </button>
                </div>
                <div className="card">
                  <div className="card-title">Optimization Convergence History</div>
                  <div style={{ height: 260, position: 'relative' }}>
                    <Line data={{ labels: optRes.convergence_history?.map(h => h.iteration), datasets: [{ label: 'Best Objective Value', data: optRes.convergence_history?.map(h => h.best_value), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)', fill: true, tension: 0.1 }] }} options={chartOpts('Objective Value')} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Sensitivity Tornado Tab ── */}
        {tab === 'sensitivity' && (
          <div className="analysis-panel">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="card-title" style={{ margin: 0 }}>OAT Sensitivity Analysis</div>
                <button className="btn btn-primary btn-sm" onClick={runSensitivity} disabled={analysisLoading}>
                  {analysisLoading ? <><div className="spinner"></div> Computing Perturbations...</> : '⚡ Compute Sensitivity'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Evaluates the non-dimensional Sensitivity Index S_i by perturbing parameters by ±10%.</p>
            </div>

            {sensRes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {sensRes.metric_keys.map(m_key => (
                  <div key={m_key} className="card">
                    <div className="card-title">Tornado Chart: {m_key.toUpperCase()}</div>
                    <div style={{ padding: '10px 0' }}>
                      {sensRes.tornado_data[m_key].map((d) => (
                        <div key={d.param} className="tornado-row">
                          <div className="tornado-label">{d.param}</div>
                          <div className="tornado-bar-container">
                            <div className="tornado-centerline" />
                            {d.pos_impact > 0 ? (
                              <div className="tornado-bar-pos" style={{ width: `${Math.min(100, (d.pos_impact / sensRes.tornado_data[m_key][0].abs_max_impact) * 45)}%` }} />
                            ) : (
                              <div className="tornado-bar-neg" style={{ width: `${Math.min(100, (Math.abs(d.pos_impact) / sensRes.tornado_data[m_key][0].abs_max_impact) * 45)}%` }} />
                            )}
                          </div>
                          <div className="tornado-value">S = {d.S_i.toFixed(3)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Reverse Solver Tab ── */}
        {tab === 'reverse' && (
          <div className="analysis-panel">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div className="card-title" style={{ margin: 0 }}>🔁 Reverse Engineering Solver</div>
                <button className="btn btn-primary btn-sm" onClick={runReverseSolve} disabled={analysisLoading}>
                  {analysisLoading ? <><div className="spinner"></div> Solving...</> : '⚡ Solve'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Given a desired output value, find the exact parameter that achieves it.
                Brent's method provides reliable convergence when a valid solution bracket exists.
              </p>

              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 16 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-light)', marginBottom: 6 }}>Target Output</div>
                  <select value={reverseTarget} onChange={e => setReverseTarget(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, marginBottom: 10 }}>
                    {simType === 'simple_pendulum' && <>
                      <option value="period">Period T (s)</option>
                      <option value="max_omega">Peak Angular Velocity (rad/s)</option>
                    </>}
                    {simType === 'compound_pendulum' && <option value="period">Period T (s)</option>}
                    {simType === 'slider_crank' && <>
                      <option value="stroke">Stroke (m)</option>
                      <option value="v_max">Max Velocity (m/s)</option>
                      <option value="a_max">Max Acceleration (m/s²)</option>
                    </>}
                    {simType === 'four_bar' && <option value="rocker_range_deg">Rocker Range (°)</option>}
                  </select>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-light)', marginBottom: 6 }}>Target Value</div>
                  <input type="number" className="param-number-input" step="any" value={reverseTargetVal} onChange={e => setReverseTargetVal(e.target.value)}
                    style={{ width: '100%', marginBottom: 0 }} />
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-light)', marginBottom: 6 }}>Variable Parameter</div>
                  <select value={reverseVarKey} onChange={e => setReverseVarKey(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
                    {SIMULATIONS[simType].sliders.map(s => (
                      <option key={s.key} value={s.key}>{s.label} ({s.unit})</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                    Search bounds: {SIMULATIONS[simType].sliders.find(s=>s.key===reverseVarKey)?.min ?? '?'} – {SIMULATIONS[simType].sliders.find(s=>s.key===reverseVarKey)?.max ?? '?'} {SIMULATIONS[simType].sliders.find(s=>s.key===reverseVarKey)?.unit ?? ''}
                  </div>
                </div>
              </div>
            </div>

            {reverseResult && (
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-title">Reverse Solver Result</div>
                <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(99,102,241,0.08)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>TARGET</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-light)' }}>{parseFloat(reverseTargetVal).toFixed(4)}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px', background: reverseResult.success ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)', borderRadius: 10, border: `1px solid ${reverseResult.success ? 'var(--accent2)' : 'var(--danger)'}` }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>MODEL RESULT</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: reverseResult.success ? 'var(--accent2)' : 'var(--danger)' }}>{reverseResult.achieved_value?.toFixed(4) ?? '--'}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(234,179,8,0.08)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>SIMULATION RESULT</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#eab308' }}>{reverseResult.simulation_result?.toFixed(4) ?? '--'}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(6,182,212,0.08)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>ERROR</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{reverseResult.error_pct != null ? reverseResult.error_pct.toFixed(4) + '%' : '--'}</div>
                    </div>
                  </div>

                  {reverseResult.solved_value != null && (
                    <div style={{ padding: '14px 18px', background: 'rgba(16,185,129,0.06)', borderRadius: 10, border: '1px solid var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Required {reverseVarKey}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent2)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {reverseResult.solved_value.toFixed(6)} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{SIMULATIONS[simType].sliders.find(s=>s.key===reverseVarKey)?.unit}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: reverseResult.success ? 'var(--accent2)' : 'var(--warn)', fontWeight: 700 }}>
                          {reverseResult.success ? '✓ VERIFIED' : '⚠ NEAREST'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{reverseResult.iterations} evaluations</div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => setParams(p => ({...p, [reverseVarKey]: reverseResult.solved_value}))}>Apply →</button>
                    </div>
                  )}

                  {reverseResult.message && !reverseResult.success && (
                    <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,0.07)', borderRadius: 8, fontSize: 12, color: 'var(--danger)', border: '1px solid rgba(244,63,94,0.3)' }}>
                      ⚠ {reverseResult.message}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI Assistant Tab ── */}
        {tab === 'ai' && (
          <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="chat-container" style={{ flex: 1 }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: 'linear-gradient(135deg, #4f46e5, #a855f7)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Gemini Dynamics Assistant</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Active Context: {simType.replace(/_/g, ' ')}</div>
                </div>
              </div>

              <div className="chat-messages">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`chat-msg ${msg.role === 'user' ? 'chat-msg-user' : ''}`}>
                    <div className={`chat-avatar ${msg.role === 'ai' ? 'chat-avatar-ai' : 'chat-avatar-user'}`}>
                      {msg.role === 'ai' ? '🤖' : '👤'}
                    </div>
                    <div className={`chat-bubble ${msg.role === 'ai' ? 'chat-bubble-ai' : 'chat-bubble-user'}`} style={{ whiteSpace: 'pre-wrap' }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="chat-msg">
                    <div className="chat-avatar chat-avatar-ai">🤖</div>
                    <div className="chat-bubble chat-bubble-ai" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div className="spinner"></div> Analyzing equations...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="chat-input-bar">
                <input
                  className="chat-input"
                  placeholder="Ask about formulas, energy conservation, RK45 solver accuracy, or mechanical advantage..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                />
                <button className="btn btn-primary btn-sm" onClick={sendChat} disabled={chatLoading}>Send</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
