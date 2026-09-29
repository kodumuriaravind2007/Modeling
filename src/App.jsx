import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import axios from 'axios';
import './index.css';

import {
  drawSimplePendulum, drawCompoundPendulum,
  drawSliderCrank, drawFourBar
} from './renderers';
import { computeLiveValidation } from './liveValidation';
import { simulateClient } from './clientSimulation';
import { checkFeasibility, FEASIBILITY_STATUS } from './core/feasibility.js';

import { Navbar } from './components/Navbar';
import { MechanismModal } from './components/MechanismModal';
import { ControlsDrawer } from './components/ControlsDrawer';
import { PlaybackBar } from './components/PlaybackBar';
import { AnalysisModal } from './components/AnalysisModal';
import { LearnModal } from './components/LearnModal';
import { SimulationViewport } from './components/SimulationViewport';
import { SMDBuilder } from './components/SMDBuilder';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Unified same-origin API endpoint (routed through Vite dev proxy or Flask production origin)
const API = '';

// ─── Simulation Configurations & Defaults ─────────────────────────────
const SIMULATIONS = {
  simple_pendulum: {
    label: 'Simple Pendulum',
    icon: '🔵',
    defaults: { length: 1.0, mass: 1.0, gravity: 9.81, damping: 0.1, theta0: 30, omega0: 0, dt: 0.01, t_max: 15 },
    presets: [
      { label: 'Earth Standard', params: { length: 1.0, mass: 1.0, gravity: 9.81, damping: 0.1, theta0: 30, omega0: 0 } },
      { label: 'Moon Gravity',   params: { length: 1.0, mass: 1.0, gravity: 1.62, damping: 0.0, theta0: 30, omega0: 0, t_max: 20 } },
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
    label: 'Compound Pendulum',
    icon: '🟣',
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
    label: 'Slider-Crank',
    icon: '⚙️',
    defaults: { crank_length: 0.1, conn_length: 0.3, crank_speed: 60, dt: 0.005, t_max: 5.0 },
    presets: [
      { label: 'Standard Engine', params: { crank_length: 0.1, conn_length: 0.3, crank_speed: 60 } },
      { label: 'High RPM Demo',   params: { crank_length: 0.08, conn_length: 0.25, crank_speed: 180 } },
      { label: 'Long Conn Rod',   params: { crank_length: 0.05, conn_length: 0.35, crank_speed: 60 } },
    ],
    sliders: [
      { key: 'crank_length', label: 'Crank r', min: 0.02, max: 0.5, step: 0.01, unit: 'm' },
      { key: 'conn_length',  label: 'Conn. Rod l', min: 0.05, max: 1.0, step: 0.01, unit: 'm' },
      { key: 'crank_speed',  label: 'Speed N', min: 10, max: 600, step: 5, unit: 'rpm' },
    ]
  },
  four_bar: {
    label: 'Four-Bar Linkage',
    icon: '🔷',
    defaults: { link_ground: 4.0, link_crank: 1.0, link_coupler: 2.5, link_rocker: 3.0, crank_speed: 75, dt: 0.005, t_max: 5.0 },
    presets: [
      { label: 'Crank-Rocker',             params: { link_ground: 4.0, link_crank: 1.0, link_coupler: 2.5, link_rocker: 3.0, crank_speed: 75 } },
      { label: 'Quick-Return Rocker',       params: { link_ground: 3.5, link_crank: 1.0, link_coupler: 3.0, link_rocker: 2.8, crank_speed: 60 } },
      { label: 'Drag Link (Double Crank)', params: { link_ground: 1.0, link_crank: 3.2, link_coupler: 3.0, link_rocker: 3.0, crank_speed: 75 } },
    ],
    sliders: [
      { key: 'link_ground',  label: 'Ground Link Length (d)', min: 1, max: 10, step: 0.1, unit: 'm' },
      { key: 'link_crank',   label: 'Crank Link Length (a)',  min: 0.5, max: 5, step: 0.1, unit: 'm' },
      { key: 'link_coupler', label: 'Coupler Link Length (b)', min: 0.5, max: 8, step: 0.1, unit: 'm' },
      { key: 'link_rocker',  label: 'Rocker Link Length (c)',  min: 0.5, max: 8, step: 0.1, unit: 'm' },
      { key: 'crank_speed',  label: 'Crank Angular Speed (N)', min: 10, max: 300, step: 5, unit: 'rpm' },
    ]
  }
};

export default function App() {
  // ─── Primary Application State ───
  const [simType, setSimType] = useState('simple_pendulum');
  const [params, setParams] = useState({ ...SIMULATIONS.simple_pendulum.defaults });
  const [simData, setSimData] = useState(() => simulateClient('simple_pendulum', SIMULATIONS.simple_pendulum.defaults));
  const [validation, setValidation] = useState(() => {
    const initData = simulateClient('simple_pendulum', SIMULATIONS.simple_pendulum.defaults);
    return computeLiveValidation('simple_pendulum', SIMULATIONS.simple_pendulum.defaults, initData);
  });
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('2d');

  // Active Contextual Panel (only one open at once for zero clutter)
  // 'mechanism' | 'controls' | 'analysis' | 'learn' | null
  const [activePanel, setActivePanel] = useState(null);

  // ─── Animation & Playback State ───
  const [animIdx, setAnimIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(1);

  // ─── Analysis States ───
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [verifyRes, setVerifyRes] = useState(null);
  const [designRes, setDesignRes] = useState(null);
  const [designConstraints, setDesignConstraints] = useState({});
  const [sensRes, setSensRes] = useState(null);

  // Reverse Solver State
  const [reverseResult, setReverseResult] = useState(null);
  const [reverseTarget, setReverseTarget] = useState('period');
  const [reverseTargetVal, setReverseTargetVal] = useState(2.0);
  const [reverseVarKey, setReverseVarKey] = useState('length');

  // Backend Connectivity Status
  const [backendOnline, setBackendOnline] = useState(true);

  useEffect(() => {
    axios.get('/health', { timeout: 2500 })
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  // Synchronous State References to eliminate stale closure bugs during rapid slider drags
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const debounceSimRef = useRef(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const simTypeRef = useRef(simType);
  simTypeRef.current = simType;
  const simDataRef = useRef(simData);
  simDataRef.current = simData;

  // Keep solver targets aligned with active mechanism
  useEffect(() => {
    if (simType === 'simple_pendulum' || simType === 'compound_pendulum') {
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

  // Toggle or open a contextual panel
  const handleTogglePanel = useCallback((panelName) => {
    setActivePanel(prev => prev === panelName ? null : panelName);
  }, []);

  const handleClosePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  // Toast notification state for professional in-app feedback
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'warning') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev && prev.message === message ? null : prev);
    }, 4500);
  }, []);

  // ─── 2D Canvas Unified Renderer & Resize Observer ───
  const drawCanvas = useCallback((targetIdx = 0, overrideParams = null, overrideData = null) => {
    if (!canvasRef.current || viewMode !== '2d') return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (w === 0 || h === 0) return;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.save();
    ctx.scale(dpr, dpr);

    const isPlaying = overrideParams?.isPlaying ?? playingRef.current;
    const activeParams = { ...(overrideParams || paramsRef.current), isPlaying };
    const activeData = overrideData || simDataRef.current;
    const currentSimType = simTypeRef.current;

    const isFrameZero = (targetIdx === 0);
    const thetaDeg = (isFrameZero && activeParams.theta0 !== undefined)
      ? activeParams.theta0
      : (activeData?.theta_deg?.[targetIdx] ?? activeParams.theta0 ?? 30);
    const omegaVal = (isFrameZero && activeParams.omega0 !== undefined)
      ? activeParams.omega0
      : (activeData?.omega?.[targetIdx] ?? activeParams.omega0 ?? 0);
    const crankDeg = activeData?.crank_angle_deg?.[targetIdx] ?? 0;

    if (currentSimType === 'simple_pendulum') {
      drawSimplePendulum(ctx, w, h, thetaDeg, activeParams, omegaVal);
    } else if (currentSimType === 'compound_pendulum') {
      drawCompoundPendulum(ctx, w, h, thetaDeg, activeParams);
    } else if (currentSimType === 'slider_crank') {
      drawSliderCrank(ctx, w, h, crankDeg, activeData, activeParams);
    } else if (currentSimType === 'four_bar') {
      drawFourBar(ctx, w, h, targetIdx, activeData, activeParams);
    }
    ctx.restore();
  }, [viewMode]);

  // Window resize observer to keep canvas crisp
  useEffect(() => {
    const handleResize = () => {
      drawCanvas(frameRef.current);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas]);

  // Redraw canvas immediately when switching back to 2D
  useEffect(() => {
    if (viewMode === '2d') {
      requestAnimationFrame(() => {
        drawCanvas(frameRef.current);
      });
    }
  }, [viewMode, drawCanvas]);

  // ─── Run Simulation Engine (Bulletproof with Client-Side Fallback) ───
  const runSimulation = useCallback(async (targetType, targetParams, startPlayback = true) => {
    const sType = (typeof targetType === 'string' ? targetType : null) || simTypeRef.current || simType;
    const sParams = (targetParams && typeof targetParams === 'object' && !targetParams.nativeEvent && !targetParams.target ? targetParams : null) || paramsRef.current || params;
    
    // Pre-flight kinematics validation
    if (sType === 'slider_crank') {
      const r = Number(sParams.crank_length ?? 0.1);
      const l = Number(sParams.conn_length ?? 0.3);
      if (r >= l) {
        showToast(`Invalid Slider-Crank: Crank radius r (${r}m) must be strictly less than conn rod l (${l}m).`, 'error');
        return;
      }
    } else if (sType === 'four_bar') {
      const d = Number(sParams.link_ground ?? 4.0);
      const a = Number(sParams.link_crank ?? 1.0);
      const b = Number(sParams.link_coupler ?? 2.5);
      const c = Number(sParams.link_rocker ?? 3.0);
      const sorted = [d, a, b, c].sort((x, y) => x - y);
      if (sorted[3] >= sorted[0] + sorted[1] + sorted[2]) {
        showToast(`Invalid Four-Bar: Longest link (${sorted[3]}m) cannot assemble.`, 'error');
        return;
      }
    }

    setLoading(true);

    if (debounceSimRef.current) {
      clearTimeout(debounceSimRef.current);
      debounceSimRef.current = null;
    }

    // 1. Instantly compute client-side simulation so animation starts with ZERO freeze or delay
    const clientData = simulateClient(sType, sParams);
    simDataRef.current = clientData;
    setSimData(clientData);

    const liveVal = computeLiveValidation(sType, sParams, clientData);
    setValidation(liveVal);

    const feas = checkFeasibility(sType, sParams);
    const canPlay = startPlayback && (feas.status === FEASIBILITY_STATUS.OK);

    if (startPlayback) {
      setAnimIdx(0);
      frameRef.current = 0;
      setIsPlaying(canPlay);
      playingRef.current = canPlay;
      drawCanvas(0, sParams, clientData);
    }

    // 2. Query Flask backend for server-side verification and benchmark parity
    try {
      const res = await axios.post(`${API}/simulate`, { sim_type: sType, params: sParams }, { timeout: 8000 });
      const data = res.data.data;
      if (data && data.time && data.time.length > 0) {
        simDataRef.current = data;
        setSimData(data);
        if (!playingRef.current && viewMode === '2d') {
          drawCanvas(frameRef.current, sParams, data);
        }
      }

      const valRes = await axios.post(`${API}/validate`, {
        sim_type: sType,
        params: sParams,
        sim_data: data || clientData
      }, { timeout: 8000 });
      if (valRes.data && valRes.data.rows) {
        setValidation(valRes.data);
      }
    } catch (e) {
      // Backend offline or slow: smooth client-side simulation continues seamlessly
      console.warn('Backend service note:', e.message);
    } finally {
      setLoading(false);
    }
  }, [simType, params, drawCanvas, showToast, viewMode]);

  // ─── Live Parameter Drag Handler (Zero-Latency, Zero React Reconciliations) ───
  const handleParamDragLive = useCallback((keyOrObj, value) => {
    let next;
    let isAngleOrIC = false;

    if (typeof keyOrObj === 'string') {
      next = { ...paramsRef.current, [keyOrObj]: value };
      if (keyOrObj === 'theta0' || keyOrObj === 'omega0') {
        isAngleOrIC = true;
      }
    } else if (keyOrObj && typeof keyOrObj === 'object') {
      next = { ...paramsRef.current, ...keyOrObj };
      if ('theta0' in keyOrObj || 'omega0' in keyOrObj) {
        isAngleOrIC = true;
      }
    } else {
      next = { ...paramsRef.current };
    }
    paramsRef.current = next;

    const currentType = simTypeRef.current;
    const feas = checkFeasibility(currentType, next);

    // If initial angle (theta0) or velocity (omega0) or feasibility warning, pause animation & preview at t=0
    if (isAngleOrIC || feas.status !== FEASIBILITY_STATUS.OK) {
      if (playingRef.current) {
        setIsPlaying(false);
        playingRef.current = false;
        if (animRef.current) cancelAnimationFrame(animRef.current);
      }
      frameRef.current = 0;
      setAnimIdx(0);
    }

    // Recompute trajectory data so animation adapts in real-time during drag
    const newSimData = simulateClient(currentType, next);
    simDataRef.current = newSimData;

    // When setting initial angle / IC, or when paused, ALWAYS render at frame 0 (exact initial conditions)
    const targetIdx = (isAngleOrIC || !playingRef.current) ? 0 : frameRef.current;
    if (isAngleOrIC || !playingRef.current) {
      frameRef.current = 0;
      setAnimIdx(0);
    }

    // Instantly update 2D canvas directly without triggering React reconciliations
    drawCanvas(targetIdx, next, newSimData);
  }, [drawCanvas]);

  // ─── Parameter Commit Handler (Fires when user finishes dragging / on blur) ───
  const handleParamCommit = useCallback((updaterOrNewParams) => {
    const nextParams = typeof updaterOrNewParams === 'function'
      ? updaterOrNewParams(paramsRef.current)
      : { ...paramsRef.current, ...updaterOrNewParams };

    const isAngleOrIC = (updaterOrNewParams && typeof updaterOrNewParams === 'object' && ('theta0' in updaterOrNewParams || 'omega0' in updaterOrNewParams)) ||
      (nextParams.theta0 !== paramsRef.current.theta0) ||
      (nextParams.omega0 !== paramsRef.current.omega0);

    paramsRef.current = nextParams;
    setParams(nextParams);

    const currentType = simTypeRef.current;
    const feas = checkFeasibility(currentType, nextParams);

    // If initial conditions were updated or if simulation was paused, reset timeline to frame 0
    if (isAngleOrIC || !playingRef.current) {
      if (playingRef.current && isAngleOrIC) {
        setIsPlaying(false);
        playingRef.current = false;
        if (animRef.current) cancelAnimationFrame(animRef.current);
      }
      frameRef.current = 0;
      setAnimIdx(0);
    }

    // ── Kinematic feasibility check — pause animation if parameters are constrained or invalid ──
    if (feas.status !== FEASIBILITY_STATUS.OK) {
      setIsPlaying(false);
      playingRef.current = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);

      const clientData = simulateClient(currentType, nextParams);
      simDataRef.current = clientData;
      setSimData(clientData);

      const liveVal = computeLiveValidation(currentType, nextParams, clientData);
      setValidation(liveVal);

      // Still redraw canvas so user sees the geometry update
      drawCanvas(0, nextParams, clientData);
      return;
    }

    // 1. Immediately compute ultra-fast client-side simulation
    const clientData = simulateClient(currentType, nextParams);
    simDataRef.current = clientData;
    setSimData(clientData);

    // 2. Immediately compute live analytical validation matrix & key output indicators (badges update here)
    const liveVal = computeLiveValidation(currentType, nextParams, clientData);
    setValidation(liveVal);

    // 3. Immediately redraw canvas for instant visual feedback with nextParams and clientData
    drawCanvas(frameRef.current, nextParams, clientData);

    // 4. Debounce full backend RK45 simulation by 250ms for server-side verification and exports
    if (debounceSimRef.current) clearTimeout(debounceSimRef.current);
    debounceSimRef.current = setTimeout(() => {
      runSimulation(currentType, nextParams, false);
    }, 250);
  }, [drawCanvas, runSimulation]);

  const handleUpdateParams = handleParamCommit;

  // ─── Direct Bob Drag Handlers (2D & 3D Interactive Release) ───
  const handleBobDragMove = useCallback((dragAngleDeg) => {
    paramsRef.current = { ...paramsRef.current, theta0: dragAngleDeg };
    drawCanvas(0, { ...paramsRef.current, theta0: dragAngleDeg, isDragging: true });
  }, [drawCanvas]);

  const handleBobDragRelease = useCallback((releasedAngleDeg) => {
    const nextParams = { ...paramsRef.current, theta0: releasedAngleDeg, omega0: 0 };
    handleUpdateParams(nextParams);
    runSimulation(simTypeRef.current, nextParams, true);
  }, [handleUpdateParams, runSimulation]);

  const initialMountedRef = useRef(false);

  // Initial simulation on mount
  useEffect(() => {
    if (!initialMountedRef.current) {
      initialMountedRef.current = true;
      runSimulation('simple_pendulum', SIMULATIONS.simple_pendulum.defaults, true);
    }
  }, [runSimulation]);

  // ─── Switch Mechanism ───
  const handleSelectMechanism = useCallback((type) => {
    if (type === 'smd') {
      setActivePanel('smd');
      return;
    }
    setActivePanel(null);
    setSimType(type);
    simTypeRef.current = type;
    const newDefaults = { ...SIMULATIONS[type].defaults };
    paramsRef.current = newDefaults;
    setParams(newDefaults);

    const clientData = simulateClient(type, newDefaults);
    simDataRef.current = clientData;
    setSimData(clientData);
    setValidation(computeLiveValidation(type, newDefaults, clientData));

    const feas = checkFeasibility(type, newDefaults);
    const canPlay = feas.status === FEASIBILITY_STATUS.OK;
    setDesignRes(null);
    setSensRes(null);
    setVerifyRes(null);
    setReverseResult(null);
    setAnimIdx(0);
    frameRef.current = 0;
    setIsPlaying(canPlay);
    playingRef.current = canPlay;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setDesignConstraints({});

    drawCanvas(0, newDefaults, clientData);
    runSimulation(type, newDefaults, canPlay);
  }, [drawCanvas, runSimulation]);

  // ─── Playback Controls ───
  const togglePlay = useCallback(() => {
    if (!simData) {
      runSimulation(simType, params, true);
      return;
    }
    if (!isPlaying) {
      const feas = checkFeasibility(simTypeRef.current, paramsRef.current);
      if (feas.status !== FEASIBILITY_STATUS.OK) {
        const isConstrained = feas.status === FEASIBILITY_STATUS.WARNING;
        showToast(
          `Cannot play: Mechanism is ${isConstrained ? 'Functionally Constrained' : 'Infeasible'}. ${feas.summary || 'Adjust parameters to satisfy kinematic constraints.'}`,
          isConstrained ? 'warning' : 'error'
        );
        return;
      }
    }
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);
    playingRef.current = newPlaying;
    frameRef.current = animIdx;
  }, [isPlaying, simData, animIdx, runSimulation, simType, params, showToast]);

  const stepAnim = useCallback((direction) => {
    if (!simData) return;
    const feas = checkFeasibility(simTypeRef.current, paramsRef.current);
    if (feas.status !== FEASIBILITY_STATUS.OK) return;
    const len = simData.time?.length || simData.crank_angle_deg?.length || 1;
    const nextIdx = (animIdx + direction + len) % len;
    setAnimIdx(nextIdx);
    frameRef.current = nextIdx;
    if (viewMode === '2d') {
      drawCanvas(nextIdx);
    }
  }, [animIdx, simData, viewMode, drawCanvas]);

  const resetSimulation = useCallback(() => {
    setIsPlaying(false);
    playingRef.current = false;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setAnimIdx(0);
    frameRef.current = 0;
    if (viewMode === '2d') {
      drawCanvas(0);
    }
  }, [viewMode, drawCanvas]);

  const handleSetAnimIdx = useCallback((idx) => {
    setAnimIdx(idx);
    frameRef.current = idx;
    // Pause the active rAF loop so it doesn't overwrite frameRef during scrubbing
    if (playingRef.current) {
      setIsPlaying(false);
      playingRef.current = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
    if (viewMode === '2d') {
      drawCanvas(idx);
    }
  }, [viewMode, drawCanvas]);

  const resetDefaults = useCallback(() => {
    const defaults = { ...SIMULATIONS[simType].defaults };
    handleUpdateParams(defaults);
  }, [simType, handleUpdateParams]);

  // (Keyboard shortcuts: Space for Play/Pause and Left/Right arrows are managed in PlaybackBar)

  // ─── Physical Delta-Time Animation Clock Stepping ───
  useEffect(() => {
    if (!isPlaying) return;

    const initialFeas = checkFeasibility(simTypeRef.current, paramsRef.current);
    if (initialFeas.status !== FEASIBILITY_STATUS.OK) {
      setIsPlaying(false);
      playingRef.current = false;
      return;
    }

    const len = simData?.time?.length || simData?.crank_angle_deg?.length || 1;
    let localIdx = frameRef.current;
    let lastTimestamp = null;
    let lastReactUpdate = 0;
    let stepAccumulator = 0;

    const dt = simData?.params?.dt || params?.dt || (simType === 'slider_crank' ? 0.005 : simType === 'four_bar' ? 0.005 : 0.01);

    const renderLoop = (timestamp) => {
      if (!playingRef.current) return;

      const loopFeas = checkFeasibility(simTypeRef.current, paramsRef.current);
      if (loopFeas.status !== FEASIBILITY_STATUS.OK) {
        setIsPlaying(false);
        playingRef.current = false;
        return;
      }

      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
        lastReactUpdate = timestamp;
      }
      const deltaMs = Math.min(timestamp - lastTimestamp, 100);
      lastTimestamp = timestamp;

      // Real-world physical time advance: (deltaSec * animSpeed) / dt
      stepAccumulator += ((deltaMs / 1000) * animSpeed) / dt;
      if (stepAccumulator > 20) stepAccumulator = 20; // Cap accumulator to prevent lag bursts
      const stepsToAdvance = Math.min(Math.floor(stepAccumulator), 10);

      if (stepsToAdvance > 0) {
        stepAccumulator -= stepsToAdvance;
        localIdx = (localIdx + stepsToAdvance) % len;
        frameRef.current = localIdx;
        if (viewMode === '2d') {
          drawCanvas(localIdx);
        }

        // Decouple heavy React reconciliation from 60-144 FPS animation loop
        // Throttling state update to ~30 FPS eliminates micro-stutters and dropped frames
        if (timestamp - lastReactUpdate >= 32) {
          lastReactUpdate = timestamp;
          setAnimIdx(localIdx);
        }
      }

      if (playingRef.current) {
        animRef.current = requestAnimationFrame(renderLoop);
      }
    };

    animRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      setAnimIdx(frameRef.current);
    };
  }, [isPlaying, simData, animSpeed, viewMode, drawCanvas, simType, params]);

  // Redraw when scrubber is moved while paused or params changed
  useEffect(() => {
    if (!isPlaying && viewMode === '2d') {
      drawCanvas(animIdx);
    }
  }, [animIdx, isPlaying, viewMode, drawCanvas, params]);

  // Clean animation frame on unmount
  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (debounceSimRef.current) clearTimeout(debounceSimRef.current);
  }, []);

  // ─── Analytical Engine Operations ───
  const runVerification = async () => {
    setAnalysisLoading(true);
    try {
      const res = await axios.post(`${API}/verify_timestep`, { sim_type: simType, params });
      setVerifyRes(res.data.data);
    } catch (e) {
      showToast('Verification Notice: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const runDesignSweep = async () => {
    setAnalysisLoading(true);
    try {
      const pKeys = SIMULATIONS[simType].sliders.map(s => s.key);
      const param_ranges = {};
      const fixed_params = {};

      pKeys.forEach((k, i) => {
        if (i < 2) {
          const s = SIMULATIONS[simType].sliders.find(x => x.key === k);
          param_ranges[k] = { min: s.min, max: s.max };
        } else {
          fixed_params[k] = params[k];
        }
      });

      const constraints = {};
      Object.entries(designConstraints).forEach(([key, val]) => {
        if (val.min !== '' || val.max !== '') {
          constraints[key] = {};
          if (val.min !== '') constraints[key].min = parseFloat(val.min);
          if (val.max !== '') constraints[key].max = parseFloat(val.max);
        }
      });

      if (Object.keys(constraints).length === 0) {
        if (simType === 'simple_pendulum' || simType === 'compound_pendulum') {
          constraints.period = { min: 1.0, max: 5.0 };
        } else if (simType === 'slider_crank') {
          constraints.stroke = { min: 0.05, max: 0.5 };
        } else if (simType === 'four_bar') {
          constraints.rocker_range_deg = { min: 30 };
        }
      }

      const res = await axios.post(`${API}/design`, {
        sim_type: simType,
        constraints,
        param_ranges,
        fixed_params,
        n_points: 7
      });
      setDesignRes(res.data.data);
    } catch (e) {
      showToast('Design Sweep Notice: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const runSensitivity = async () => {
    setAnalysisLoading(true);
    try {
      const pKeys = SIMULATIONS[simType].sliders.map(s => s.key);
      const res = await axios.post(`${API}/sensitivity`, {
        sim_type: simType,
        base_params: params,
        perturbation_pct: 10,
        param_keys: pKeys
      });
      setSensRes(res.data.data);
    } catch (e) {
      showToast('Sensitivity Notice: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setAnalysisLoading(false);
    }
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
      const bounds = varSlider ? [varSlider.min, varSlider.max] : [0.1, 10.0];
      const res = await axios.post(`${API}/reverse_solve`, {
        sim_type: simType,
        output_key: reverseTarget,
        target_value: parseFloat(reverseTargetVal),
        variable_key: reverseVarKey,
        variable_bounds: bounds,
        fixed_params,
      });
      setReverseResult(res.data.data);
    } catch (e) {
      showToast('Reverse Solver Notice: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setAnalysisLoading(false);
    }
  };



  const exportCSV = async () => {
    if (!simData) return;
    try {
      const res = await axios.post(`${API}/export/csv`, { sim_data: simData, params, sim_type: simType }, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${simType}_telemetry.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast('CSV Export Notice: ' + e.message, 'error');
    }
  };

  const exportPDF = async () => {
    if (!simData) return;
    try {
      const res = await axios.post(`${API}/export/pdf`, {
        sim_data: simData,
        params,
        sim_type: simType,
        validation: validation || {}
      }, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${simType}_engineering_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast('PDF Export Notice: ' + e.message, 'error');
    }
  };

  return (
    <div className="kyntrix-app-shell">
      {/* Toast Notification Container */}
      {toast && (
        <div className={`kyntrix-toast ${toast.type}`} role="alert">
          <span className="toast-icon">{toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
          <span className="toast-text">{toast.message}</span>
          <button type="button" className="btn-toast-close" onClick={() => setToast(null)} aria-label="Dismiss message">✕</button>
        </div>
      )}

      {/* ── Compact Top Navigation Bar ── */}
      <Navbar
        simType={simType}
        simulations={SIMULATIONS}
        activePanel={activePanel}
        onTogglePanel={handleTogglePanel}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        loading={loading}
        simData={simData}
        backendOnline={backendOnline}
        onRunSimulation={() => runSimulation(simType, params, true)}
        onResetSimulation={resetSimulation}
      />

      {/* ── Central Simulation Workspace ── */}
      <SimulationViewport
        simType={simType}
        simulations={SIMULATIONS}
        params={params}
        paramsRef={paramsRef}
        simData={simData}
        animIdx={animIdx}
        viewMode={viewMode}
        canvasRef={canvasRef}
        loading={loading}
        isPlaying={isPlaying}
        animSpeed={animSpeed}
        onPause={() => setIsPlaying(false)}
        onRunSimulation={() => runSimulation(simType, params, true)}
        onOpenControls={() => handleTogglePanel('controls')}
        onUpdateParams={handleUpdateParams}
        onBobDragMove={handleBobDragMove}
        onBobDragRelease={handleBobDragRelease}
        isModalOpen={['analysis', 'mechanism', 'learn', 'smd'].includes(activePanel)}
      />

      {/* ── Bottom Playback Control Bar ── */}
      <PlaybackBar
        simData={simData}
        animIdx={animIdx}
        onSetAnimIdx={handleSetAnimIdx}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onStepAnim={stepAnim}
        animSpeed={animSpeed}
        onSpeedChange={setAnimSpeed}
        onReset={resetSimulation}
      />

      {/* ── Contextual Overlays & Drawers (Details on Demand) ── */}

      {/* 1. Mechanism Selection Modal */}
      <MechanismModal
        isOpen={activePanel === 'mechanism'}
        activeSim={simType}
        onSelect={handleSelectMechanism}
        onClose={handleClosePanel}
      />

      {/* 2. Simulation Controls Drawer */}
      <ControlsDrawer
        isOpen={activePanel === 'controls'}
        simType={simType}
        simulations={SIMULATIONS}
        params={params}
        paramsRef={paramsRef}
        setParams={handleUpdateParams}
        onParamDragLive={handleParamDragLive}
        onParamCommit={handleParamCommit}
        validation={validation}
        loading={loading}
        onRunSimulation={() => runSimulation(simType, params, true)}
        onResetDefaults={resetDefaults}
        onClose={handleClosePanel}
      />

      {/* 3. Analysis Modal Workstation */}
      <AnalysisModal
        isOpen={activePanel === 'analysis'}
        onClose={handleClosePanel}
        simType={simType}
        simulations={SIMULATIONS}
        params={params}
        setParams={handleUpdateParams}
        simData={simData}
        validation={validation}
        loading={loading}
        analysisLoading={analysisLoading}
        onRunSimulation={() => runSimulation(simType, params, true)}
        verifyRes={verifyRes}
        onRunVerification={runVerification}
        designRes={designRes}
        designConstraints={designConstraints}
        setDesignConstraints={setDesignConstraints}
        onRunDesignSweep={runDesignSweep}
        sensRes={sensRes}
        onRunSensitivity={runSensitivity}
        reverseResult={reverseResult}
        reverseTarget={reverseTarget}
        setReverseTarget={setReverseTarget}
        reverseTargetVal={reverseTargetVal}
        setReverseTargetVal={setReverseTargetVal}
        reverseVarKey={reverseVarKey}
        setReverseVarKey={setReverseVarKey}
        onRunReverseSolve={runReverseSolve}
        onExportCSV={exportCSV}
        onExportPDF={exportPDF}
      />

      {/* 4. Learn & Theory Modal */}
      <LearnModal
        isOpen={activePanel === 'learn'}
        onClose={handleClosePanel}
        simType={simType}
        params={params}
      />

      {/* 5. Simulink-Style Spring-Mass-Damper Network Builder */}
      {activePanel === 'smd' && (
        <SMDBuilder onClose={handleClosePanel} />
      )}
    </div>
  );
}
