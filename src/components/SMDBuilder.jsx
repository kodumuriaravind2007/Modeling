import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  assembleGraphMCK,
  solveGraphModal,
  computeGraphFRF,
  simulateGraphTimeDomain,
  solveClassroomProblem
} from '../core/smdSolver.js';
import { EquationBlock } from './EquationBlock.jsx';
import { SimulinkScopeModal } from './SimulinkScopeModal.jsx';

// ── Classroom Problem Templates ("Sir's Class Problems") ───────────────────
const PRESETS = {
  parallel_springs: {
    name: 'Parallel Springs (k₁ + k₂)',
    badge: 'Classroom Exam Problem',
    description: 'Two parallel springs (k₁ = 150 N/m, k₂ = 250 N/m) attached to mass m₁ with damper c₁',
    nodes: [
      { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Fixed Wall' },
      { id: 'm1', type: 'mass', x: 460, y: 220, mass: 2.0, x0: 0.15, v0: 0.0, label: 'm₁ (2.0 kg)' }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 150.0, yOffset: -38, label: 'k₁ = 150 N/m' },
      { id: 'k2', type: 'spring', from: 'wall1', to: 'm1', k: 250.0, yOffset: 38, label: 'k₂ = 250 N/m' },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 3.0, yOffset: 0, label: 'c₁ = 3.0 N·s/m' },
      { id: 'F1', type: 'force', from: 'm1', to: 'm1', F0: 20.0, waveform: 'sine', freq: 5.0, label: 'F(t) = 20·sin(5t)' }
    ]
  },
  series_springs: {
    name: 'Series Springs (k₁k₂/(k₁+k₂))',
    badge: 'Classroom Exam Problem',
    description: 'Two springs in series with an intermediate junction node before the main mass',
    nodes: [
      { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Fixed Wall' },
      { id: 'junc1', type: 'mass', x: 280, y: 220, mass: 0.05, x0: 0.075, v0: 0.0, label: 'Junction J₁' },
      { id: 'm1', type: 'mass', x: 500, y: 220, mass: 2.0, x0: 0.15, v0: 0.0, label: 'm₁ (2.0 kg)' }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'junc1', k: 200.0, label: 'k₁ = 200 N/m' },
      { id: 'k2', type: 'spring', from: 'junc1', to: 'm1', k: 200.0, label: 'k₂ = 200 N/m' },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 1.5, yOffset: 45, label: 'c₁ = 1.5 N·s/m' }
    ]
  },
  series_parallel: {
    name: 'Series-Parallel Network',
    badge: 'Textbook Challenge',
    description: 'Combined spring network: Spring k₁ in series with a parallel pair (k₂ || k₃)',
    nodes: [
      { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Fixed Wall' },
      { id: 'junc1', type: 'mass', x: 280, y: 220, mass: 0.05, x0: 0.06, v0: 0.0, label: 'Junction J₁' },
      { id: 'm1', type: 'mass', x: 520, y: 220, mass: 3.0, x0: 0.12, v0: 0.0, label: 'm₁ (3.0 kg)' }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'junc1', k: 300.0, label: 'k₁ = 300 N/m' },
      { id: 'k2', type: 'spring', from: 'junc1', to: 'm1', k: 150.0, yOffset: -35, label: 'k₂ = 150 N/m' },
      { id: 'k3', type: 'spring', from: 'junc1', to: 'm1', k: 150.0, yOffset: 35, label: 'k₃ = 150 N/m' },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 2.0, yOffset: -55, label: 'c₁ = 2.0 N·s/m' }
    ]
  },
  underdamped_sdof: {
    name: 'Underdamped SDOF (ζ < 1)',
    badge: 'Oscillation & Decay',
    description: 'Standard single degree of freedom system undergoing damped harmonic free vibration',
    nodes: [
      { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Fixed Base' },
      { id: 'm1', type: 'mass', x: 440, y: 220, mass: 2.0, x0: 0.15, v0: 0.0, label: 'm₁ (2.0 kg)' }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 180.0, yOffset: -25, label: 'k₁ = 180 N/m' },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 1.8, yOffset: 25, label: 'c₁ = 1.8 N·s/m' }
    ]
  },
  critically_damped: {
    name: 'Critically Damped (ζ = 1.0)',
    badge: 'Fast Return Boundary',
    description: 'Critical viscous damping coefficient c = 2√(m·k) for fastest non-oscillatory return',
    nodes: [
      { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Fixed Base' },
      { id: 'm1', type: 'mass', x: 440, y: 220, mass: 2.0, x0: 0.20, v0: 0.0, label: 'm₁ (2.0 kg)' }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 200.0, yOffset: -25, label: 'k₁ = 200 N/m' },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 40.0, yOffset: 25, label: 'c₁ = 40.0 N·s/m' }
    ]
  },
  overdamped: {
    name: 'Overdamped SDOF (ζ > 1)',
    badge: 'Sluggish Return',
    description: 'Heavy damping (c > c_c) causing exponential non-oscillatory decay',
    nodes: [
      { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Fixed Base' },
      { id: 'm1', type: 'mass', x: 440, y: 220, mass: 2.0, x0: 0.20, v0: 0.0, label: 'm₁ (2.0 kg)' }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 200.0, yOffset: -25, label: 'k₁ = 200 N/m' },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 75.0, yOffset: 25, label: 'c₁ = 75.0 N·s/m' }
    ]
  },
  tmd_system: {
    name: '2-DOF Tuned Mass Damper',
    badge: 'Industrial Absorber',
    description: 'Primary structure protected by an auxiliary tuned vibration absorber',
    nodes: [
      { id: 'wall1', type: 'wall', x: 70, y: 220, label: 'Fixed Base' },
      { id: 'm1', type: 'mass', x: 300, y: 220, mass: 5.0, x0: 0.0, v0: 0.0, label: 'm₁ Primary (5.0 kg)' },
      { id: 'm2', type: 'mass', x: 530, y: 220, mass: 0.5, x0: 0.0, v0: 0.0, label: 'm₂ Absorber (0.5 kg)' }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 200.0, yOffset: -22, label: 'k₁ = 200 N/m' },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 0.8, yOffset: 22, label: 'c₁ = 0.8 N·s/m' },
      { id: 'k2', type: 'spring', from: 'm1', to: 'm2', k: 20.0, yOffset: -22, label: 'k₂ = 20 N/m' },
      { id: 'c2', type: 'damper', from: 'm1', to: 'm2', c: 2.2, yOffset: 22, label: 'c₂ = 2.2 N·s/m' },
      { id: 'F1', type: 'force', from: 'm1', to: 'm1', F0: 10.0, waveform: 'sine', freq: 6.32, label: 'F_res = 10·sin(ωₙ₁t)' }
    ]
  },
  forced_harmonic: {
    name: '1-DOF Forced Harmonic (Resonance)',
    badge: 'Resonance Peak',
    description: 'Harmonic sinusoidal excitation near resonance (ω = 10 rad/s ≈ ω_n) demonstrating dynamic magnification',
    nodes: [
      { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Fixed Base' },
      { id: 'm1', type: 'mass', x: 440, y: 220, mass: 2.0, x0: 0.0, v0: 0.0, label: 'm₁ (2.0 kg)' }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 200.0, yOffset: -25, label: 'k₁ = 200 N/m' },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 2.0, yOffset: 25, label: 'c₁ = 2.0 N·s/m' },
      { id: 'F1', type: 'force', from: 'm1', to: 'm1', F0: 8.0, waveform: 'sine', freq: 10.0, label: 'F(t) = 8·sin(10t)' }
    ]
  },
  coupled_oscillators: {
    name: '2-DOF Coupled Oscillators (Beats)',
    badge: 'Beat Phenomenon',
    description: 'Two identical masses coupled by a spring showing energy transfer and periodic beat envelopes',
    nodes: [
      { id: 'wall1', type: 'wall', x: 70, y: 220, label: 'Left Anchor' },
      { id: 'm1', type: 'mass', x: 270, y: 220, mass: 1.0, x0: 0.15, v0: 0.0, label: 'm₁ (1.0 kg)' },
      { id: 'm2', type: 'mass', x: 490, y: 220, mass: 1.0, x0: 0.0, v0: 0.0, label: 'm₂ (1.0 kg)' },
      { id: 'wall2', type: 'wall', x: 670, y: 220, label: 'Right Anchor' }
    ],
    edges: [
      { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 100.0, yOffset: 0, label: 'k₁ = 100 N/m' },
      { id: 'k12', type: 'spring', from: 'm1', to: 'm2', k: 15.0, yOffset: 0, label: 'k_c = 15 N/m' },
      { id: 'k2', type: 'spring', from: 'm2', to: 'wall2', k: 100.0, yOffset: 0, label: 'k₂ = 100 N/m' },
      { id: 'c1', type: 'damper', from: 'wall1', to: 'm1', c: 0.05, yOffset: 35, label: 'c₁ = 0.05 N·s/m' },
      { id: 'c2', type: 'damper', from: 'm2', to: 'wall2', c: 0.05, yOffset: 35, label: 'c₂ = 0.05 N·s/m' }
    ]
  },
  quarter_car: {
    name: 'Quarter-Car Suspension Model',
    badge: 'Automotive 2-DOF',
    description: 'Two-mass vehicle dynamics: sprung body (m_s) and unsprung wheel/axle (m_u) on compliant tire and damper',
    nodes: [
      { id: 'road_wall', type: 'wall', x: 70, y: 220, label: 'Road Datum' },
      { id: 'm_wheel', type: 'mass', x: 280, y: 220, mass: 45.0, x0: 0.0, v0: 0.0, label: 'm_u Wheel (45 kg)' },
      { id: 'm_body', type: 'mass', x: 520, y: 220, mass: 350.0, x0: 0.05, v0: 0.0, label: 'm_s Body (350 kg)' }
    ],
    edges: [
      { id: 'k_tire', type: 'spring', from: 'road_wall', to: 'm_wheel', k: 190000.0, yOffset: 0, label: 'k_tire = 190 kN/m' },
      { id: 'k_susp', type: 'spring', from: 'm_wheel', to: 'm_body', k: 28000.0, yOffset: -25, label: 'k_s = 28 kN/m' },
      { id: 'c_susp', type: 'damper', from: 'm_wheel', to: 'm_body', c: 2500.0, yOffset: 25, label: 'c_s = 2.5 kN·s/m' }
    ]
  }
};

export function getDefaultSimulinkBlocks(massCount = 1) {
  if (massCount >= 2) {
    return {
      src_f1: { id: 'src_f1', type: 'source', x: 75, y: 110, w: 72, h: 42, label: 'Force F₁(t)' },
      sum1: { id: 'sum1', type: 'sum', x: 190, y: 110, r: 18, label: 'Sum Σ₁' },
      gain_m1: { id: 'gain_m1', type: 'gain', x: 280, y: 110, w: 56, h: 42, label: '1/m₁' },
      int_v1: { id: 'int_v1', type: 'integrator', x: 380, y: 110, w: 54, h: 44, label: '1/s' },
      int_x1: { id: 'int_x1', type: 'integrator', x: 500, y: 110, w: 54, h: 44, label: '1/s' },
      gain_c1: { id: 'gain_c1', type: 'gain_c', x: 380, y: 175, w: 52, h: 36, label: 'c₁' },
      gain_k1: { id: 'gain_k1', type: 'gain_k', x: 500, y: 175, w: 52, h: 36, label: 'k₁' },

      gain_c12: { id: 'gain_c12', type: 'gain_c12', x: 330, y: 250, w: 58, h: 38, label: 'c₁₂' },
      gain_k12: { id: 'gain_k12', type: 'gain_k', x: 440, y: 250, w: 58, h: 38, label: 'k₁₂' },

      sum2: { id: 'sum2', type: 'sum', x: 190, y: 365, r: 18, label: 'Sum Σ₂' },
      gain_m2: { id: 'gain_m2', type: 'gain', x: 280, y: 365, w: 56, h: 42, label: '1/m₂' },
      int_v2: { id: 'int_v2', type: 'integrator', x: 380, y: 365, w: 54, h: 44, label: '1/s' },
      int_x2: { id: 'int_x2', type: 'integrator', x: 500, y: 365, w: 54, h: 44, label: '1/s' },
      gain_c2: { id: 'gain_c2', type: 'gain_c', x: 380, y: 435, w: 52, h: 36, label: 'c₂' },
      gain_k2: { id: 'gain_k2', type: 'gain_k', x: 500, y: 435, w: 52, h: 36, label: 'k₂' },

      mux: { id: 'mux', type: 'mux', x: 605, y: 235, w: 12, h: 285, label: 'Mux' },
      scope: { id: 'scope', type: 'scope', x: 715, y: 235, w: 84, h: 72, label: 'Scope' },
      knob: { id: 'knob', type: 'knob', x: 75, y: 250, r: 34, label: 'Force Dial' }
    };
  }
  return {
    src_f: { id: 'src_f', type: 'source', x: 80, y: 140, w: 76, h: 46, label: 'Force F(t)' },
    sum: { id: 'sum', type: 'sum', x: 205, y: 140, r: 18, label: 'Sum Σ' },
    gain_m: { id: 'gain_m', type: 'gain', x: 295, y: 140, w: 56, h: 44, label: '1/m' },
    int_v: { id: 'int_v', type: 'integrator', x: 415, y: 140, w: 56, h: 46, label: '1/s' },
    gain_c: { id: 'gain_c', type: 'gain_c', x: 415, y: 240, w: 56, h: 40, label: 'c' },
    int_x: { id: 'int_x', type: 'integrator', x: 555, y: 140, w: 56, h: 46, label: '1/s' },
    gain_k: { id: 'gain_k', type: 'gain_k', x: 415, y: 330, w: 56, h: 40, label: 'k' },
    mux: { id: 'mux', type: 'mux', x: 655, y: 140, w: 10, h: 72, label: 'Mux' },
    scope: { id: 'scope', type: 'scope', x: 730, y: 140, w: 72, h: 58, label: 'Scope' },
    knob: { id: 'knob', type: 'knob', x: 95, y: 310, r: 38, label: 'Force Dial' }
  };
}

export const SMDBuilder = ({ onClose }) => {
  // Active Topology Graph State - default to classroom parallel_springs preset
  const [nodes, setNodes] = useState(PRESETS.parallel_springs.nodes);
  const [edges, setEdges] = useState(PRESETS.parallel_springs.edges);
  const [activePreset, setActivePreset] = useState('parallel_springs');

  // Selected item for Inspector
  const [selectedId, setSelectedId] = useState('m1');
  const [wiringTool, setWiringTool] = useState(null); // null, 'spring', 'damper', 'force'
  const [wireSource, setWireSource] = useState(null); // Node ID being connected from

  // Workspace Mode & Tabs - default to 'classroom' for academic problem solving
  const [activeTab, setActiveTab] = useState('classroom'); // 'classroom', 'simulate', 'matrices', 'bode'
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [copied, setCopied] = useState(false);
  const [exportedImg, setExportedImg] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [simTimeState, setSimTimeState] = useState(0);

  // Canvas View Mode: 'physical' (Mass-Spring schematic) or 'simulink' (Block diagram)
  const [canvasMode, setCanvasMode] = useState('simulink');
  const [copiedMatlab, setCopiedMatlab] = useState(false);
  const [showScopeModal, setShowScopeModal] = useState(false);
  const backdropMouseDownRef = useRef(false);

  // Dynamic mass count synchronization for Simulink block diagram
  const massCount = nodes.filter(n => n.type === 'mass').length;
  const prevMassCountRef = useRef(massCount);
  const [simulinkBlocks, setSimulinkBlocks] = useState(() => getDefaultSimulinkBlocks(massCount));

  useEffect(() => {
    if (prevMassCountRef.current !== massCount) {
      prevMassCountRef.current = massCount;
      setSimulinkBlocks(getDefaultSimulinkBlocks(massCount));
    }
  }, [massCount]);

  // Canvas Refs
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const simTimeRef = useRef(0);
  const lastStateTimeRef = useRef(0);
  const currentPosMapRef = useRef(new Map());
  const mousePosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // Dragging state on Canvas
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const draggingNodeIdRef = useRef(null);
  const draggingBlockIdRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // ── 1. Assemble Graph into M, C, K ──────────────────────────────────────────
  const system = useMemo(() => {
    return assembleGraphMCK(nodes, edges);
  }, [nodes, edges]);

  // ── 2. Modal Analysis (Eigenvalues & Mode Shapes) ───────────────────────────
  const modalData = useMemo(() => {
    return solveGraphModal(system.M, system.C, system.K);
  }, [system]);

  // ── 3. Frequency Response (Bode Plot) ───────────────────────────────────────
  const frfData = useMemo(() => {
    return computeGraphFRF(system.M, system.C, system.K, 0, 0.2, 40.0, 100);
  }, [system]);

  // ── 4. Transient State-Space RK4 Simulation ─────────────────────────────────
  const simData = useMemo(() => {
    const x0 = system.massNodes.map(m => Number(m.x0) || 0);
    const v0 = system.massNodes.map(m => Number(m.v0) || 0);
    return simulateGraphTimeDomain(system.M, system.C, system.K, system.appliedForces, {
      dt: 0.005,
      t_max: 8.0,
      x0,
      v0
    });
  }, [system]);

  // ── Adaptive Visual Displacement Scaling ─────────────────────────────────────
  // Scales physical displacement (meters) to visual travel (pixels) such that peak travel is bounded to ±38px.
  // Prevents large resonance amplitudes from causing high-speed collisions, shaking, or flying off-canvas,
  // while preserving exact physical numerical telemetry inside mass blocks.
  const visualScale = useMemo(() => {
    if (!simData || !simData.x || simData.x.length === 0) return 140;
    let maxAbs = 0;
    for (let i = 0; i < simData.x.length; i++) {
      for (let k = 0; k < simData.x[i].length; k++) {
        const v = Math.abs(simData.x[i][k]);
        if (v > maxAbs) maxAbs = v;
      }
    }
    if (maxAbs < 1e-4) return 140;
    return Math.max(30, Math.min(220, 38 / maxAbs));
  }, [simData]);

  // ── Custom Model Handlers ("Build From Scratch" / "Clear Canvas") ─────────────
  const handleNewCustomModel = () => {
    setActivePreset('custom');
    setNodes([
      { id: 'wall1', type: 'wall', x: 80, y: 220, label: 'Fixed Base' },
      { id: 'm1', type: 'mass', x: 360, y: 220, mass: 2.0, x0: 0.10, v0: 0.0, label: 'm₁ (2.0 kg)' }
    ]);
    setEdges([
      { id: 'k1', type: 'spring', from: 'wall1', to: 'm1', k: 150.0, yOffset: 0, label: 'k₁ = 150 N/m' }
    ]);
    setSelectedId('m1');
    setWiringTool(null);
    setWireSource(null);
    simTimeRef.current = 0;
    setSimTimeState(0);
  };

  const handleClearAll = () => {
    setActivePreset('custom');
    setNodes([]);
    setEdges([]);
    setSelectedId(null);
    setWiringTool(null);
    setWireSource(null);
    simTimeRef.current = 0;
    setSimTimeState(0);
  };

  // ── 5. Academic Step-by-Step Classroom Problem Solver ───────────────────────
  const classroomSolution = useMemo(() => {
    const massNodes = nodes.filter(n => n.type === 'mass');
    // Prefer actual payload mass over lightweight intermediate junction nodes
    const primaryMass = massNodes.slice().sort((a, b) => (Number(b.mass) || 0) - (Number(a.mass) || 0))[0] || massNodes[0];
    const x0 = Number(primaryMass?.x0) || 0.05;
    const v0 = Number(primaryMass?.v0) || 0.0;
    return solveClassroomProblem(nodes, edges, { x0, v0 });
  }, [nodes, edges]);

  // ── Copy Solution Handler ───────────────────────────────────────────────────
  const handleCopySolution = () => {
    if (!classroomSolution || !classroomSolution.steps) return;
    const header = `=== CLASSROOM VIBRATION PROBLEM DERIVATION ===\nRegime: ${classroomSolution.regimeName}\nm = ${classroomSolution.m.toFixed(2)} kg | k_eq = ${classroomSolution.k_eq.toFixed(2)} N/m | c_eq = ${classroomSolution.c_eq.toFixed(2)} N·s/m\nomega_n = ${classroomSolution.omega_n.toFixed(3)} rad/s | zeta = ${classroomSolution.zeta.toFixed(4)}\n\n`;
    const body = classroomSolution.steps.map(s => {
      return `[Step ${s.stepNum}: ${s.title}]\n${s.description}\nFormula: ${s.formula}\nSubstitution: ${s.substitution || ''}\nResult: ${s.result || ''}\n`;
    }).join('\n');
    navigator.clipboard.writeText(header + body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  // ── Paper Solution Image Generator ─────────────────────────────────────────
  const handleExportPaperImage = () => {
    if (!classroomSolution) return;
    try {
      const canvas = generatePaperSolutionImage(nodes, edges, classroomSolution);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Vibration_Problem_Solution_${activePreset || 'sdof'}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setExportedImg(true);
        setTimeout(() => setExportedImg(false), 2400);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to export solution image:', err);
      alert('Failed to generate paper solution image: ' + err.message);
    }
  };

// ── Robust Production-Grade MATLAB / Simulink Script Generator ───────────
function generateMatlabScript(system, nodes, edges, classroomSolution) {
  const massNodes = (nodes || []).filter(n => n.type === 'mass');
  const n = massNodes.length;

  if (n <= 1) {
    const primaryMass = massNodes[0] || { mass: 2.0 };
    const m = Number(primaryMass.mass) || 2.0;
    const k = Number(classroomSolution?.k_eq) || 150.0;
    const c = Number(classroomSolution?.c_eq) || 2.0;
    const forceEdge = (edges || []).find(e => e.type === 'force');
    const F0 = forceEdge ? (Number(forceEdge.F0) || 10.0) : 10.0;
    const freq = forceEdge ? (Number(forceEdge.freq) || 5.0) : 5.0;

    return `% =========================================================================
% MATLAB / SIMULINK 1-DOF MASS-SPRING-DAMPER DYNAMICAL SIMULATION
% Canonical Formulation: m*x''(t) + c*x'(t) + k*x(t) = F(t)
% Verified for MATLAB (R2018b-R2024b) & GNU Octave
% =========================================================================

clc; clear; close all;

%% 1. Lumped Physical Parameters
m = ${m.toFixed(2)};          % Lumped Mass (kg)
k = ${k.toFixed(2)};        % Equivalent Stiffness (N/m)
c = ${c.toFixed(2)};          % Viscous Damping Coefficient (N*s/m)
F0 = ${F0.toFixed(2)};        % Peak Excitation Force Amplitude (N)
omega_f = ${freq.toFixed(2)};   % Excitation Angular Frequency (rad/s)

%% 2. Analytical Modal Dynamics & Damping Characterization
omega_n = sqrt(k / m);
fn = omega_n / (2 * pi);
zeta = c / (2 * sqrt(m * k));
omega_d = omega_n * sqrt(max(0, 1 - zeta^2));

fprintf('-----------------------------------------------------\\n');
fprintf('        CLASSROOM VIBRATION DYNAMICS ANALYSIS        \\n');
fprintf('-----------------------------------------------------\\n');
fprintf(' Undamped Natural Frequency (omega_n): %8.3f rad/s\\n', omega_n);
fprintf(' Cyclic Natural Frequency   (f_n):     %8.3f Hz\\n', fn);
fprintf(' Damping Ratio              (zeta):    %8.4f\\n', zeta);
fprintf(' Damped Natural Frequency   (omega_d): %8.3f rad/s\\n', omega_d);
if zeta < 1
    fprintf(' Regime: Underdamped (Oscillatory Decay)\\n');
elseif abs(zeta - 1) < 1e-4
    fprintf(' Regime: Critically Damped (Fastest Return to Rest)\\n');
else
    fprintf(' Regime: Overdamped (Non-oscillatory Sluggish Return)\\n');
end
fprintf('-----------------------------------------------------\\n\\n');

%% 3. State-Space Realization [A, B, C, D]
% State vector: z = [x; x_dot]
A = [0, 1;
     -k/m, -c/m];
B = [0;
     1/m];
C_out = [1, 0];
D_out = 0;

%% 4. Numerical Time Integration via ODE45 (Standard Solver, Zero Toolboxes Required)
t_span = [0, 8.0];
dt = 0.005;
t_eval = t_span(1):dt:t_span(2);
z0 = [${(primaryMass.x0 || 0.05).toFixed(3)}; 0.0]; % Initial condition: [x0 (m); v0 (m/s)]

% Dynamic equations of motion: dz/dt = A*z + B*F(t)
eom = @(t, z) A * z + B * (F0 * sin(omega_f * t));
[t_out, z_out] = ode45(eom, t_eval, z0);

x_disp = z_out(:, 1);
x_vel  = z_out(:, 2);

%% 5. Control System Toolbox Verification (if available)
if exist('ss', 'file') == 2
    sys = ss(A, B, C_out, D_out);
    s = tf('s');
    G = 1 / (m*s^2 + c*s + k);
    disp('Continuous-Time Transfer Function G(s) = X(s)/F(s):');
    disp(G);
end

%% 6. Engineering Publication Visualization
figure('Name', 'Mass-Spring-Damper Dynamics', 'Color', 'w', 'Position', [100, 100, 900, 650]);

% Subplot 1: Displacement Response
subplot(2, 2, 1);
plot(t_out, x_disp * 100, 'b-', 'LineWidth', 1.8);
grid on;
title('Displacement Response x(t)', 'FontWeight', 'bold');
xlabel('Time t (s)'); ylabel('Displacement x (cm)');

% Subplot 2: Velocity Response
subplot(2, 2, 2);
plot(t_out, x_vel, 'r-', 'LineWidth', 1.8);
grid on;
title('Velocity Response \\dot{x}(t)', 'FontWeight', 'bold');
xlabel('Time t (s)'); ylabel('Velocity (m/s)');

% Subplot 3: Phase Space Trajectory (State Portrait)
subplot(2, 2, 3);
plot(x_disp * 100, x_vel, 'Color', [0.2, 0.6, 0.2], 'LineWidth', 1.8);
grid on;
title('Phase Space Portrait (\\dot{x} vs x)', 'FontWeight', 'bold');
xlabel('Displacement x (cm)'); ylabel('Velocity \\dot{x} (m/s)');

% Subplot 4: Excitation Force Input
subplot(2, 2, 4);
plot(t_out, F0 * sin(omega_f * t_out), 'm-', 'LineWidth', 1.5);
grid on;
title('Excitation Force F(t) = F_0\\cdot sin(\\omega t)', 'FontWeight', 'bold');
xlabel('Time t (s)'); ylabel('Force F(t) (N)');
`;
  }

  // Multi-DOF (N >= 2) System
  const M_mat = system && system.M ? system.M : [[2, 0], [0, 2]];
  const C_mat = system && system.C ? system.C : [[0.5, 0], [0, 0.5]];
  const K_mat = system && system.K ? system.K : [[100, -50], [-50, 100]];

  const M_str = M_mat.map(row => row.map(v => v.toFixed(2)).join(', ')).join(';\n     ');
  const C_str = C_mat.map(row => row.map(v => v.toFixed(2)).join(', ')).join(';\n     ');
  const K_str = K_mat.map(row => row.map(v => v.toFixed(2)).join(', ')).join(';\n     ');

  return `% =========================================================================
% MATLAB / SIMULINK ${n}-DOF MASS-SPRING-DAMPER DYNAMICAL SIMULATION
% Canonical Architecture: [M]*x''(t) + [C]*x'(t) + [K]*x(t) = {F(t)}
% Verified for MATLAB (R2018b-R2024b) & GNU Octave
% =========================================================================

clc; clear; close all;

%% 1. Lumped Mass, Damping, and Stiffness Matrices
% Number of Degrees of Freedom: N = ${n}
M = [${M_str}];

C = [${C_str}];

K = [${K_str}];

N = size(M, 1);

%% 2. Generalized Eigenvalue Problem (Natural Frequencies & Mode Shapes)
% Undamped Free Vibration: [K]*phi = omega_n^2 * [M]*phi
[phi, D] = eig(K, M);
omega_sq = diag(D);
omega_n = sqrt(abs(omega_sq));
[omega_n, sortIdx] = sort(omega_n);
phi = phi(:, sortIdx);

% Mass-normalize mode shapes: phi_i' * M * phi_i = 1
for i = 1:N
    modal_mass = phi(:, i)' * M * phi(:, i);
    if modal_mass > 0
        phi(:, i) = phi(:, i) / sqrt(modal_mass);
    end
end

fprintf('====================================================\\n');
fprintf('     ${n}-DOF SYSTEM NATURAL FREQUENCIES & MODES    \\n');
fprintf('====================================================\\n');
for i = 1:N
    fprintf(' Mode %d: omega_n = %8.3f rad/s   (f_n = %8.3f Hz)\\n', i, omega_n(i), omega_n(i) / (2*pi));
end
fprintf('====================================================\\n\\n');

%% 3. State-Space Representation (2N x 2N Canonical Form)
% State vector: z = [x_1; ...; x_N; x1_dot; ...; xN_dot]
invM = inv(M);
A = [zeros(N, N), eye(N, N);
     -invM * K,   -invM * C];
B = [zeros(N, N);
     invM];
C_out = [eye(N, N), zeros(N, N)]; % Measure all displacements
D_out = zeros(N, N);

%% 4. Numerical Time Integration via ODE45 (Standard Solver)
t_span = [0, 8.0];
dt = 0.005;
t_eval = t_span(1):dt:t_span(2);

% Initial displacements and velocities
z0 = zeros(2*N, 1);
${massNodes.map((m, idx) => `z0(${idx + 1}) = ${(m.x0 || 0).toFixed(3)}; % Initial x0 for Mass ${idx + 1} (m)`).join('\n')}

% Harmonic excitation force on Mass 1
F0 = 15.0;      % Force amplitude (N)
omega_f = 5.0;  % Forcing frequency (rad/s)
force_vector = @(t) [F0 * sin(omega_f * t); zeros(N - 1, 1)];

eom = @(t, z) A * z + B * force_vector(t);
[t_out, z_out] = ode45(eom, t_eval, z0);

x_disp = z_out(:, 1:N);
x_vel  = z_out(:, N+1:2*N);

%% 5. Publication-Grade Multi-DOF Plotting
figure('Name', '${n}-DOF Dynamic Response', 'Color', 'w', 'Position', [80, 80, 1000, 700]);

% Subplot 1: Displacements over time
subplot(2, 1, 1);
hold on;
colors = ['b', 'r', 'g', 'm', 'c'];
for i = 1:N
    c_idx = mod(i - 1, length(colors)) + 1;
    plot(t_out, x_disp(:, i) * 100, colors(c_idx), 'LineWidth', 1.8, 'DisplayName', sprintf('Mass %d (x_%d)', i, i));
end
hold off; grid on;
title('${n}-DOF System Transient Displacement Responses', 'FontWeight', 'bold');
xlabel('Time t (s)'); ylabel('Displacement x_i(t) (cm)');
legend('Location', 'northeast');

% Subplot 2: Mode Shapes Visualization
subplot(2, 1, 2);
bar(phi);
grid on;
title('Mass-Normalized Modal Matrix [\\Phi] Mode Shapes', 'FontWeight', 'bold');
xlabel('Degree of Freedom / Mass Index');
ylabel('Relative Modal Displacement');
legend(arrayfun(@(i) sprintf('Mode %d', i), 1:N, 'UniformOutput', false), 'Location', 'northeast');
`;
}

  // ── Copy MATLAB / Simulink Code Script ─────────────────────────────────────
  const handleCopyMatlabScript = () => {
    const script = generateMatlabScript(system, nodes, edges, classroomSolution);
    navigator.clipboard.writeText(script).then(() => {
      setCopiedMatlab(true);
      setTimeout(() => setCopiedMatlab(false), 2400);
    });
  };

  // ── Serialization: JSON Export & Import ────────────────────────────────────
  const fileInputRef = useRef(null);

  const handleSaveJSON = () => {
    const payload = {
      version: '1.0',
      activePreset,
      nodes,
      edges,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smd_${activePreset || 'schematic'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.nodes && Array.isArray(parsed.nodes) && parsed.edges && Array.isArray(parsed.edges)) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
          if (parsed.activePreset) setActivePreset(parsed.activePreset);
          setSelectedId(parsed.nodes.find(n => n.type === 'mass')?.id || null);
          simTimeRef.current = 0;
        } else {
          alert('Invalid SMD schematic JSON format. Expected { nodes: [], edges: [] }.');
        }
      } catch (err) {
        alert('Failed to parse JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Preset Loader ──────────────────────────────────────────────────────────
  const loadPreset = (key) => {
    if (!PRESETS[key]) return;
    setActivePreset(key);
    setNodes(JSON.parse(JSON.stringify(PRESETS[key].nodes)));
    setEdges(JSON.parse(JSON.stringify(PRESETS[key].edges)));
    setSelectedId(PRESETS[key].nodes.find(n => n.type === 'mass')?.id || null);
    simTimeRef.current = 0;
  };

  // ── Add New Node / Component ("Catch and Drop" / Palette Click) ─────────────
  const addNode = (type, wallSide = 'left') => {
    const isMass = type === 'mass';
    const isRightWall = type === 'wall' && wallSide === 'right';
    const count = nodes.filter(n => n.type === type).length + 1;
    const id = `${type}${Date.now().toString().slice(-4)}`;

    // Position intelligently so blocks don't overlap and stay level on y = 220
    const maxX = nodes.reduce((max, n) => Math.max(max, n.x), 60);
    let newX;
    if (isRightWall) {
      newX = Math.min(Math.max(maxX + 160, 560), 720);
    } else if (isMass) {
      newX = nodes.length === 0 ? 280 : Math.min(maxX + 160, 640);
    } else {
      newX = 80;
    }

    const newNode = {
      id,
      type,
      x: newX,
      y: 220,
      mass: isMass ? 2.0 : undefined,
      x0: isMass ? 0.05 : undefined,
      v0: 0.0,
      label: isMass ? `m_${count}` : (isRightWall ? 'Right Base' : (count === 1 ? 'Fixed Base' : `Wall ${count}`)),
      wallSide: type === 'wall' ? wallSide : undefined
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedId(id);
    setActivePreset('custom');
  };

  const handleAlignNodes = () => {
    setNodes(prev => prev.map(n => ({ ...n, y: 220 })));
  };

  // ── Add Component Edge between Nodes ───────────────────────────────────────
  const handleNodeClick = (nodeId) => {
    if (wiringTool) {
      if (wiringTool === 'force') {
        const targetNode = nodes.find(n => n.id === nodeId);
        if (targetNode?.type === 'mass') {
          const edgeId = `F${Date.now().toString().slice(-4)}`;
          const newForce = {
            id: edgeId,
            type: 'force',
            from: nodeId,
            to: nodeId,
            F0: 10.0,
            waveform: 'sine',
            freq: 5.0,
            label: `F(t) = 10·sin(5t)`
          };
          setEdges(prev => [...prev, newForce]);
          setSelectedId(edgeId);
          setWiringTool(null);
          setActivePreset('custom');
        }
        return;
      }

      if (!wireSource) {
        setWireSource(nodeId);
      } else {
        if (wireSource === nodeId) {
          setWireSource(null);
          return;
        }
        const edgeId = `${wiringTool[0]}${Date.now().toString().slice(-4)}`;

        // Parallel edge detection for clean vertical offset
        const parallelEdges = edges.filter(e =>
          (e.from === wireSource && e.to === nodeId) || (e.from === nodeId && e.to === wireSource)
        );
        let yOffset = 0;
        if (parallelEdges.length === 1) {
          yOffset = 30;
          setEdges(prev => prev.map(e => e.id === parallelEdges[0].id ? { ...e, yOffset: -30 } : e));
        } else if (parallelEdges.length >= 2) {
          yOffset = parallelEdges.length % 2 === 0 ? 45 : -45;
        }

        let newEdge;
        if (wiringTool === 'spring') {
          newEdge = { id: edgeId, type: 'spring', from: wireSource, to: nodeId, k: 150.0, yOffset, label: `k = 150 N/m` };
        } else if (wiringTool === 'damper') {
          newEdge = { id: edgeId, type: 'damper', from: wireSource, to: nodeId, c: 2.0, yOffset, label: `c = 2.0 N·s/m` };
        }

        if (newEdge) {
          setEdges(prev => [...prev, newEdge]);
          setSelectedId(edgeId);
          setActivePreset('custom');
        }
        setWireSource(null);
        setWiringTool(null);
      }
    } else {
      setSelectedId(nodeId);
    }
  };

  // ── Delete Selected Item ───────────────────────────────────────────────────
  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes(prev => prev.filter(n => n.id !== selectedId));
    setEdges(prev => prev.filter(e => e.id !== selectedId && e.from !== selectedId && e.to !== selectedId));
    setSelectedId(null);
  };

  // ── Inspector Field Updater ────────────────────────────────────────────────
  const updateSelectedNode = (field, val) => {
    setNodes(prev => prev.map(n => n.id === selectedId ? { ...n, [field]: val } : n));
  };

  const updateSelectedEdge = (field, val) => {
    setEdges(prev => prev.map(e => e.id === selectedId ? { ...e, [field]: val } : e));
  };

  const selectedNode = nodes.find(n => n.id === selectedId);
  const selectedEdge = edges.find(e => e.id === selectedId);

  // ── Canvas Drag Handlers ("Catch and Drop" Node Arrangement) ───────────────
  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    hasDraggedRef.current = false;

    if (canvasMode === 'simulink') {
      // Check hit on Simulink blocks
      for (const [key, b] of Object.entries(simulinkBlocks)) {
        let isHit = false;
        if (b.r) {
          isHit = Math.hypot(mx - b.x, my - b.y) <= b.r;
        } else {
          isHit = Math.abs(mx - b.x) <= b.w / 2 && Math.abs(my - b.y) <= b.h / 2;
        }
        if (isHit) {
          draggingBlockIdRef.current = b.id;
          dragOffsetRef.current = { x: mx - b.x, y: my - b.y };
          setSelectedId(b.id);
          return;
        }
      }
      return;
    }

    // Check hit on nodes using their currently rendered visual position
    for (const node of nodes) {
      const isMass = node.type === 'mass';
      const nw = isMass ? 72 : 36;
      const nh = isMass ? 50 : 80;
      const pos = currentPosMapRef.current.get(node.id) || node;
      if (mx >= pos.x - nw / 2 && mx <= pos.x + nw / 2 && my >= pos.y - nh / 2 && my <= pos.y + nh / 2) {
        draggingNodeIdRef.current = node.id;
        setDraggingNodeId(node.id);
        dragOffsetRef.current = { x: mx - node.x, y: my - node.y };
        setSelectedId(node.id);
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    mousePosRef.current = { x: mx, y: my };

    if (canvasMode === 'simulink') {
      const sc = simulinkBlocks.scope;
      const isOverScope = sc && Math.abs(mx - sc.x) <= sc.w / 2 && Math.abs(my - sc.y) <= sc.h / 2;
      canvas.style.cursor = isOverScope ? 'pointer' : (draggingBlockIdRef.current ? 'grabbing' : 'default');

      if (draggingBlockIdRef.current) {
        hasDraggedRef.current = true;
        const bId = draggingBlockIdRef.current;
        if (bId === 'knob') {
          // Adjust force amplitude based on knob angle
          const kb = simulinkBlocks.knob;
          const angle = Math.atan2(my - kb.y, mx - kb.x);
          const normalized = (angle + Math.PI) / (2 * Math.PI); // 0 to 1
          const newF0 = Math.round(normalized * 30 * 2) / 2;
          setEdges(prev => {
            const hasForce = prev.some(e => e.type === 'force');
            if (!hasForce) {
              const m = nodes.find(n => n.type === 'mass');
              if (!m) return prev;
              return [...prev, { id: 'F1', type: 'force', from: m.id, to: m.id, F0: Math.max(1, newF0), waveform: 'sine', freq: 5.0, label: `F(t) = ${newF0}N` }];
            }
            return prev.map(e => e.type === 'force' ? { ...e, F0: Math.max(1, newF0) } : e);
          });
        } else {
          const newX = Math.max(30, Math.min(canvas.width - 40, mx - dragOffsetRef.current.x));
          const newY = Math.max(40, Math.min(canvas.height - 40, my - dragOffsetRef.current.y));
          setSimulinkBlocks(prev => ({
            ...prev,
            [bId]: { ...prev[bId], x: newX, y: newY }
          }));
        }
      }
      return;
    }

    // Check hover state on nodes for wiring and selection
    let hovered = null;
    for (const node of nodes) {
      const isMass = node.type === 'mass';
      const nw = isMass ? 84 : 36;
      const nh = isMass ? 56 : 96;
      const pos = currentPosMapRef.current.get(node.id) || node;
      if (mx >= pos.x - nw / 2 && mx <= pos.x + nw / 2 && my >= pos.y - nh / 2 && my <= pos.y + nh / 2) {
        hovered = node.id;
        break;
      }
    }
    setHoveredNodeId(hovered);

    if (!draggingNodeIdRef.current) return;
    hasDraggedRef.current = true;

    const newX = Math.max(30, Math.min(canvas.width - 40, mx - dragOffsetRef.current.x));
    let newY = Math.max(40, Math.min(canvas.height - 40, my - dragOffsetRef.current.y));

    // Snap to horizontal centerline (y = 220) if within 14px for neat alignment
    if (Math.abs(newY - 220) < 14) {
      newY = 220;
    }

    setNodes(prev => prev.map(n => n.id === draggingNodeIdRef.current ? { ...n, x: newX, y: newY } : n));
  };

  const handleCanvasMouseUp = () => {
    if (draggingBlockIdRef.current) {
      draggingBlockIdRef.current = null;
    }
    if (draggingNodeIdRef.current) {
      draggingNodeIdRef.current = null;
      setDraggingNodeId(null);
    }
  };

  const handleCanvasDoubleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || canvasMode !== 'simulink') return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const sc = simulinkBlocks.scope;
    if (sc && Math.abs(mx - sc.x) <= sc.w / 2 && Math.abs(my - sc.y) <= sc.h / 2) {
      setShowScopeModal(true);
    }
  };

  // ── Physical Dynamic Animation Loop ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let lastTime = performance.now();

    const render = (now) => {
      const deltaSec = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (isPlaying) {
        simTimeRef.current += deltaSec * playbackSpeed;
        if (simTimeRef.current > 8.0) simTimeRef.current = 0;
        if (Math.abs(simTimeRef.current - lastStateTimeRef.current) > 0.08) {
          lastStateTimeRef.current = simTimeRef.current;
          setSimTimeState(simTimeRef.current);
        }
      }

      const t = simTimeRef.current;
      const dt = 0.005;
      const stepIdx = Math.min(simData.time.length - 1, Math.floor(t / dt));

      const parentW = canvas.parentElement ? canvas.parentElement.clientWidth : 800;
      const parentH = canvas.parentElement ? canvas.parentElement.clientHeight : 500;
      if (canvas.width !== parentW || canvas.height !== parentH) {
        canvas.width = parentW;
        canvas.height = parentH;
      }
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      if (canvasMode === 'simulink') {
        drawSimulinkCanvas(
          ctx,
          w,
          h,
          t,
          stepIdx,
          nodes,
          edges,
          classroomSolution,
          simData,
          simulinkBlocks,
          selectedId,
          isPlaying,
          hoveredNodeId,
          system,
          modalData
        );
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // 1. Draw Simulink Grid Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 24) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Dot grid
      ctx.fillStyle = '#CBD5E1';
      for (let x = 24; x < w; x += 48) {
        for (let y = 24; y < h; y += 48) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // Horizontal centerline snap guide when dragging
      if (draggingNodeIdRef.current) {
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, 220);
        ctx.lineTo(w, 220);
        ctx.stroke();
        ctx.restore();
      }

      // Empty Canvas Starting Guide Card
      if (nodes.length === 0) {
        ctx.save();
        const cx = w / 2;
        const cy = h / 2 - 20;

        ctx.fillStyle = '#F8FAFC';
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.roundRect(cx - 240, cy - 85, 480, 170, 12);
        ctx.fill();
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = '#0F172A';
        ctx.font = '700 16px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🛠️ Build Your Own System from Scratch', cx, cy - 46);

        ctx.fillStyle = '#475569';
        ctx.font = '500 12.5px system-ui';
        ctx.fillText('1. Click "🧱 +Wall" in the palette to place a fixed anchor datum', cx, cy - 16);
        ctx.fillText('2. Click "📦 +Mass" to add oscillating mass blocks', cx, cy + 10);
        ctx.fillText('3. Click "🌀 Wire Spring" or "💧 Wire Damper" to connect elements', cx, cy + 36);
        ctx.fillText('4. Drag any component freely to arrange your physical schematic', cx, cy + 62);

        ctx.restore();
      }

      // Map node current visual positions (bounded by visualScale so blocks never collide)
      const currentPosMap = new Map();
      nodes.forEach(node => {
        if (node.type === 'mass') {
          const massIdx = system.massIndexMap.get(node.id);
          const isBeingDragged = draggingNodeIdRef.current === node.id;
          const disp = (!isBeingDragged && massIdx !== undefined && simData.x[massIdx]) ? simData.x[massIdx][stepIdx] : 0;
          const visualPx = disp * visualScale;
          currentPosMap.set(node.id, { x: node.x + visualPx, y: node.y, rawX: node.x, rawY: node.y });
        } else {
          currentPosMap.set(node.id, { x: node.x, y: node.y, rawX: node.x, rawY: node.y });
        }
      });
      currentPosMapRef.current = currentPosMap;

      // 2. Draw Connecting Edges (Springs, Dampers, Forces)
      edges.forEach(edge => {
        const p1 = currentPosMap.get(edge.from);
        const p2 = currentPosMap.get(edge.to);
        if (!p1 || !p2) return;

        const isSelected = selectedId === edge.id;
        const n1 = nodes.find(n => n.id === edge.from);
        const n2 = nodes.find(n => n.id === edge.to);
        const isWall1 = n1?.type === 'wall';
        const isWall2 = n2?.type === 'wall';
        const isWall1Right = isWall1 && n1.wallSide === 'right';
        const isWall2Right = isWall2 && n2.wallSide === 'right';

        const offset = edge.yOffset || 0;

        let startX, endX;
        if (isWall1) {
          startX = p1.x + (isWall1Right ? -16 : 16);
        } else {
          startX = p1.x + (p1.x <= p2.x ? 42 : -42);
        }
        if (isWall2) {
          endX = p2.x + (isWall2Right ? -16 : 16);
        } else {
          endX = p2.x + (p1.x <= p2.x ? -42 : 42);
        }

        const startY = p1.y + offset;
        const endY = p2.y + offset;

        const springLabel = edge.label || `${edge.k} N/m`;
        const damperLabel = edge.label || `${edge.c} N·s/m`;
        const forceLabel = edge.label || `F(t) = ${edge.F0} N`;

        if (edge.type === 'spring') {
          drawSpring(ctx, startX, startY, endX, endY, isSelected ? '#2563EB' : '#3B82F6', springLabel);
        } else if (edge.type === 'damper') {
          drawDamper(ctx, startX, startY, endX, endY, isSelected ? '#D97706' : '#F59E0B', damperLabel);
        } else if (edge.type === 'force') {
          drawForceArrow(ctx, p2.x, p2.y, isSelected ? '#DC2626' : '#EF4444', forceLabel);
        }
      });

      // 3. Draw Nodes (Wall Anchors and Masses)
      nodes.forEach(node => {
        const pos = currentPosMap.get(node.id);
        const isSelected = selectedId === node.id;
        const isWireSrc = wireSource === node.id;

        if (node.type === 'wall') {
          // Fixed Ground Anchor Wall
          const wx = pos.x;
          const wy = pos.y;
          const isRightWall = node.wallSide === 'right';
          ctx.fillStyle = isSelected ? '#94A3B8' : '#CBD5E1';
          ctx.fillRect(wx - 16, wy - 48, 32, 96);
          ctx.strokeStyle = isSelected ? '#1E293B' : '#475569';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(wx - 16, wy - 48, 32, 96);

          // Wall ground hatch lines
          ctx.strokeStyle = '#64748B';
          ctx.lineWidth = 1.5;
          for (let hy = wy - 42; hy <= wy + 42; hy += 12) {
            ctx.beginPath();
            if (isRightWall) {
              ctx.moveTo(wx + 16, hy);
              ctx.lineTo(wx + 28, hy + 10);
            } else {
              ctx.moveTo(wx - 16, hy);
              ctx.lineTo(wx - 28, hy + 10);
            }
            ctx.stroke();
          }

          // Terminal connection circles
          const portX = isRightWall ? (wx - 16) : (wx + 16);
          [-28, 0, 28].forEach(offY => {
            ctx.fillStyle = isWireSrc ? '#22C55E' : '#3B82F6';
            ctx.beginPath();
            ctx.arc(portX, wy + offY, 4.5, 0, 2 * Math.PI);
            ctx.fill();
          });

          ctx.fillStyle = '#334155';
          ctx.font = '700 11px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(node.label || (isRightWall ? 'Right Base' : 'Fixed Base'), wx, wy + 64);
        } else if (node.type === 'mass') {
          // Vibrating Mass Block
          const mx = pos.x;
          const my = pos.y;
          const mw = 84;
          const mh = 56;

          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
          ctx.fillRect(mx - mw / 2 + 4, my - mh / 2 + 6, mw, mh);

          // Block Body
          ctx.fillStyle = isSelected ? '#EFF6FF' : '#FFFFFF';
          ctx.fillRect(mx - mw / 2, my - mh / 2, mw, mh);
          ctx.strokeStyle = isSelected ? '#2563EB' : isWireSrc ? '#22C55E' : '#1E40AF';
          ctx.lineWidth = isSelected || isWireSrc ? 2.8 : 2;
          ctx.strokeRect(mx - mw / 2, my - mh / 2, mw, mh);

          // Top header band
          ctx.fillStyle = isSelected ? '#2563EB' : '#1E40AF';
          ctx.fillRect(mx - mw / 2, my - mh / 2, mw, 18);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '700 10px monospace';
          ctx.textAlign = 'center';
          const headerLabel = node.label || `m = ${node.mass || 1.0} kg`;
          ctx.fillText(headerLabel, mx, my - mh / 2 + 13);

          // Live Telemetry inside Block
          const massIdx = system.massIndexMap.get(node.id);
          const curDisp = (massIdx !== undefined && simData.x[massIdx]) ? simData.x[massIdx][stepIdx] : 0;
          ctx.fillStyle = '#0F172A';
          ctx.font = '700 13px monospace';
          ctx.fillText(`x = ${(curDisp * 100).toFixed(1)} cm`, mx, my + (node.label ? 6 : 14));
          if (node.label) {
            ctx.fillStyle = '#64748B';
            ctx.font = '600 10px monospace';
            ctx.fillText(`${(node.mass || 1.0).toFixed(1)} kg`, mx, my + 20);
          }

          // Connection Terminals
          [-16, 0, 16].forEach(offY => {
            ctx.fillStyle = isWireSrc ? '#22C55E' : '#3B82F6';
            ctx.beginPath(); ctx.arc(mx - mw / 2, my + offY, 4, 0, 2 * Math.PI); ctx.fill();
            ctx.beginPath(); ctx.arc(mx + mw / 2, my + offY, 4, 0, 2 * Math.PI); ctx.fill();
          });

          // Rollers / Bearings beneath mass
          ctx.fillStyle = '#475569';
          ctx.beginPath(); ctx.arc(mx - 24, my + mh / 2 + 5, 5, 0, 2 * Math.PI); ctx.fill();
          ctx.beginPath(); ctx.arc(mx + 24, my + mh / 2 + 5, 5, 0, 2 * Math.PI); ctx.fill();

          // Continuous floor track that always extends under the rollers across the entire travel
          const trackLeft = Math.min(pos.rawX - 56, mx - 44);
          const trackRight = Math.max(pos.rawX + 56, mx + 44);
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(trackLeft, my + mh / 2 + 10);
          ctx.lineTo(trackRight, my + mh / 2 + 10);
          ctx.stroke();

          // Ground hatch marks under floor guide
          ctx.strokeStyle = '#CBD5E1';
          ctx.lineWidth = 1.2;
          for (let hx = trackLeft + 8; hx <= trackRight - 4; hx += 14) {
            ctx.beginPath();
            ctx.moveTo(hx, my + mh / 2 + 10);
            ctx.lineTo(hx - 5, my + mh / 2 + 16);
            ctx.stroke();
          }
        }
      });

      // 4. Active Wiring Live Rubber-Band Wire
      if (wiringTool && wireSource) {
        const srcPos = currentPosMap.get(wireSource);
        if (srcPos) {
          const srcNode = nodes.find(n => n.id === wireSource);
          const isSrcWall = srcNode?.type === 'wall';
          const isSrcRightWall = isSrcWall && srcNode.wallSide === 'right';
          const targetMouse = mousePosRef.current;
          const sx = srcPos.x + (isSrcWall ? (isSrcRightWall ? -16 : 16) : (targetMouse.x >= srcPos.x ? 42 : -42));
          const sy = srcPos.y;

          ctx.save();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = wiringTool === 'spring' ? '#3B82F6' : (wiringTool === 'damper' ? '#F59E0B' : '#EF4444');
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(targetMouse.x, targetMouse.y);
          ctx.stroke();

          // Tooltip following mouse
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.roundRect(targetMouse.x + 12, targetMouse.y - 12, 175, 24, 4);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '700 10.5px system-ui';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`Click target to connect ${wiringTool}`, targetMouse.x + 18, targetMouse.y);
          ctx.restore();
        }
      }

      // 5. Hover glow when wiring
      if (wiringTool && hoveredNodeId && hoveredNodeId !== wireSource) {
        const hPos = currentPosMap.get(hoveredNodeId);
        if (hPos) {
          ctx.save();
          ctx.strokeStyle = '#22C55E';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.roundRect(hPos.x - 46, hPos.y - 32, 92, 64, 6);
          ctx.stroke();
          ctx.restore();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [nodes, edges, isPlaying, playbackSpeed, selectedId, wiringTool, wireSource, simData, system, visualScale, hoveredNodeId, canvasMode, simulinkBlocks, classroomSolution, modalData]);

  // ── Chart Data for Real-Time Oscilloscope ───────────────────────────────────
  const timeChartData = useMemo(() => {
    const colors = ['#2563EB', '#D97706', '#059669', '#7C3AED'];
    const sampleRate = Math.max(1, Math.floor(simData.time.length / 250));
    const sampledTime = simData.time.filter((_, i) => i % sampleRate === 0);

    const datasets = system.massNodes.map((mNode, idx) => ({
      label: `${mNode.label || `Mass ${idx + 1}`} x(t)`,
      data: simData.x[idx]?.filter((_, i) => i % sampleRate === 0) || [],
      borderColor: colors[idx % colors.length],
      backgroundColor: colors[idx % colors.length] + '20',
      borderWidth: 2,
      pointRadius: 0
    }));

    return { labels: sampledTime.map(t => t.toFixed(2)), datasets };
  }, [simData, system]);

  // ── Bode Chart Data ────────────────────────────────────────────────────────
  const bodeChartData = useMemo(() => {
    const colors = ['#2563EB', '#D97706', '#059669', '#7C3AED'];
    const datasets = system.massNodes.map((mNode, idx) => ({
      label: `${mNode.label || `Mass ${idx + 1}`} |H(jω)| (dB)`,
      data: frfData.magDb[idx] || [],
      borderColor: colors[idx % colors.length],
      borderWidth: 2,
      pointRadius: 0
    }));

    return { labels: frfData.freqsHz.map(f => f.toFixed(1)), datasets };
  }, [frfData, system]);

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
    >
      <div
        className="smd-builder-dialog"
        onMouseDown={(e) => {
          backdropMouseDownRef.current = false;
          e.stopPropagation();
        }}
        onClick={e => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="smd-builder-header">
          <div className="smd-header-info">
            <div className="smd-title-badge">SIMULINK WORKSTATION</div>
            <h2 className="smd-title">Spring-Mass-Damper Network Modeler</h2>
            <p className="smd-desc">
              Arrange lumped mechanical elements via catch & drop, wire couplings, and simulate state-space equations of motion.
            </p>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>

        {/* Toolbar: Presets & Component Library Palette */}
        <div className="smd-toolbar-deck">
          {/* Canvas View Mode Toggle: Physical Mechanism vs Simulink Block Diagram */}
          <div className="smd-view-toggle-group">
            <button
              type="button"
              className={`smd-view-btn ${canvasMode === 'simulink' ? 'active' : ''}`}
              onClick={() => setCanvasMode('simulink')}
              title="Show MathWorks Simulink Block Diagram: 1/s integrators, 1/m, k, c gains, summing junction, scope"
            >
              🎛️ Simulink Blocks
            </button>
            <button
              type="button"
              className={`smd-view-btn ${canvasMode === 'physical' ? 'active' : ''}`}
              onClick={() => setCanvasMode('physical')}
              title="Show physical schematic: mass blocks, spring coils, dashpots, and floor"
            >
              🧱 Physical Mechanism
            </button>
            <button
              type="button"
              className="smd-view-btn"
              style={{ background: '#0F172A', color: '#38BDF8', border: '1px solid #0284C7', fontWeight: 700 }}
              onClick={() => setShowScopeModal(true)}
              title="Open full interactive Simulink Oscilloscope window"
            >
              📈 Scope Window
            </button>
          </div>

          <div className="smd-toolbar-divider"></div>

          {/* Custom Model & Preset Buttons */}
          <div className="smd-preset-group">
            <button
              type="button"
              className={`smd-blank-btn ${activePreset === 'custom' ? 'active-custom' : ''}`}
              onClick={handleNewCustomModel}
              title="Start a custom system to build and arrange manually"
            >
              ✨ Build Custom
            </button>
            <button
              type="button"
              className="smd-tool-btn danger"
              onClick={handleClearAll}
              title="Clear all components to start from an empty canvas"
            >
              🧹 Clear All
            </button>
            <div className="smd-toolbar-divider" style={{ height: '18px', margin: '0 4px' }}></div>
            <span className="smd-group-label">Templates:</span>
            {Object.entries(PRESETS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                className={`smd-preset-btn ${activePreset === key ? 'active' : ''}`}
                onClick={() => loadPreset(key)}
              >
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>

          <div className="smd-toolbar-divider"></div>

          {/* Add Component Palette ("Catch and Drop" / Click to Add) */}
          <div className="smd-palette-group">
            <span className="smd-group-label">Palette:</span>
            <button type="button" className="smd-tool-btn" onClick={() => addNode('mass')} title="Add Mass Block">
              📦 +Mass
            </button>
            <button type="button" className="smd-tool-btn" onClick={() => addNode('wall', 'left')} title="Add Fixed Ground Wall (Left Boundary Anchor)">
              🧱 +Left Wall
            </button>
            <button type="button" className="smd-tool-btn" onClick={() => addNode('wall', 'right')} title="Add Fixed Ground Wall (Right Boundary Anchor)">
              🧱 +Right Wall
            </button>
            <button type="button" className="smd-tool-btn" onClick={handleAlignNodes} title="Snap and align all mass blocks and walls to the horizontal centerline (y = 220)">
              📐 Align Axis
            </button>
            <button
              type="button"
              className={`smd-tool-btn ${wiringTool === 'spring' ? 'active-tool' : ''}`}
              onClick={() => { setWiringTool(wiringTool === 'spring' ? null : 'spring'); setWireSource(null); }}
              title="Click two components to connect with a spring"
            >
              🌀 Wire Spring
            </button>
            <button
              type="button"
              className={`smd-tool-btn ${wiringTool === 'damper' ? 'active-tool' : ''}`}
              onClick={() => { setWiringTool(wiringTool === 'damper' ? null : 'damper'); setWireSource(null); }}
              title="Click two components to connect with a dashpot damper"
            >
              💧 Wire Damper
            </button>
            <button
              type="button"
              className={`smd-tool-btn ${wiringTool === 'force' ? 'active-tool' : ''}`}
              onClick={() => { setWiringTool(wiringTool === 'force' ? null : 'force'); setWireSource(null); }}
              title="Attach an external excitation force actuator"
            >
              ⚡ +Force
            </button>
          </div>

          <div className="smd-toolbar-divider"></div>

          {/* Delete Action */}
          <button
            type="button"
            className="smd-tool-btn danger"
            onClick={deleteSelected}
            disabled={!selectedId}
            title="Delete selected component"
          >
            🗑️ Delete
          </button>

          <div className="smd-toolbar-divider"></div>

          {/* JSON Schematic IO */}
          <div className="smd-palette-group">
            <span className="smd-group-label">IO:</span>
            <button
              type="button"
              className="smd-tool-btn"
              onClick={handleSaveJSON}
              title="Export and download current schematic as JSON"
            >
              💾 Save JSON
            </button>
            <button
              type="button"
              className="smd-tool-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Import and load schematic from JSON"
            >
              📂 Load JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleLoadJSON}
            />
          </div>
        </div>

        {/* Ungrounded Mass Diagnostic Error Banner */}
        {!system.isGrounded && (
          <div className="smd-wiring-banner" style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B' }}>
            <span>⛔ <strong>Ungrounded mass:</strong> rigid-body mode detected, system has zero stiffness to ground ({system.groundingReason}). Natural frequency ω₁ = 0 rad/s.</span>
          </div>
        )}

        {/* Wiring Helper Notice */}
        {wiringTool && (
          <div className="smd-wiring-banner">
            <span>⚙️ Wiring Mode Active: Click <strong>{wireSource ? 'Target Node' : 'Source Node'}</strong> to attach {wiringTool}.</span>
            <button type="button" className="btn-cancel-wiring" onClick={() => { setWiringTool(null); setWireSource(null); }}>Cancel</button>
          </div>
        )}

        {/* Main Workstation Layout: Canvas + Inspector */}
        <div className="smd-workspace-layout">
          {/* Interactive Simulink Canvas */}
          <div className="smd-canvas-container">
            <canvas
              ref={canvasRef}
              className="smd-interactive-canvas"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onClick={(e) => {
                if (hasDraggedRef.current) {
                  hasDraggedRef.current = false;
                  return;
                }
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;

                if (canvasMode === 'simulink') {
                  const sc = simulinkBlocks.scope;
                  if (sc && Math.abs(mx - sc.x) <= sc.w / 2 && Math.abs(my - sc.y) <= sc.h / 2) {
                    setShowScopeModal(true);
                    setSelectedId('scope');
                    return;
                  }
                  for (const [key, b] of Object.entries(simulinkBlocks)) {
                    let hit = false;
                    if (b.r) hit = Math.hypot(mx - b.x, my - b.y) <= b.r;
                    else hit = Math.abs(mx - b.x) <= b.w / 2 && Math.abs(my - b.y) <= b.h / 2;
                    if (hit) {
                      setSelectedId(b.id);
                      return;
                    }
                  }
                  return;
                }

                for (const n of nodes) {
                  const isM = n.type === 'mass';
                  const pos = currentPosMapRef.current.get(n.id) || n;
                  if (Math.abs(mx - pos.x) < (isM ? 44 : 20) && Math.abs(my - pos.y) < (isM ? 32 : 48)) {
                    handleNodeClick(n.id);
                    return;
                  }
                }
              }}
              onDoubleClick={handleCanvasDoubleClick}
            />

            {/* Canvas Bottom Playback Overlay */}
            <div className="smd-canvas-controls">
              <button
                type="button"
                className="smd-btn-play"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                type="button"
                className="smd-btn-reset"
                onClick={() => { simTimeRef.current = 0; setSimTimeState(0); }}
              >
                ↺ Reset Time
              </button>
              <div className="smd-speed-selector">
                <span>Speed:</span>
                {[0.5, 1.0, 2.0].map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`smd-speed-btn ${playbackSpeed === s ? 'active' : ''}`}
                    onClick={() => setPlaybackSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
              <input
                type="range"
                className="smd-canvas-scrubber"
                min="0"
                max="8"
                step="0.02"
                value={simTimeState}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  simTimeRef.current = val;
                  setSimTimeState(val);
                }}
                title="Drag to scrub through simulation timeline"
              />
              <span className="smd-sim-clock">
                t = {simTimeState.toFixed(2)}s / 8.0s
              </span>
            </div>
          </div>

          {/* Component Parameter Inspector */}
          <div className="smd-inspector-panel">
            <h3 className="smd-panel-title">Component Inspector</h3>

            {selectedNode ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Type:</label>
                  <span className="smd-field-val">{selectedNode.type.toUpperCase()}</span>
                </div>
                <div className="smd-field-row">
                  <label>Label:</label>
                  <input
                    type="text"
                    className="smd-input"
                    value={selectedNode.label || ''}
                    onChange={e => updateSelectedNode('label', e.target.value)}
                  />
                </div>
                {selectedNode.type === 'wall' && (
                  <div className="smd-field-row">
                    <label>Wall Anchor:</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className={`smd-tool-btn ${selectedNode.wallSide !== 'right' ? 'active-tool' : ''}`}
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => updateSelectedNode('wallSide', 'left')}
                      >
                        Left (Ports Right)
                      </button>
                      <button
                        type="button"
                        className={`smd-tool-btn ${selectedNode.wallSide === 'right' ? 'active-tool' : ''}`}
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => updateSelectedNode('wallSide', 'right')}
                      >
                        Right (Ports Left)
                      </button>
                    </div>
                  </div>
                )}
                {selectedNode.type === 'mass' && (
                  <>
                    <div className="smd-field-row">
                      <label>Mass m (kg):</label>
                      <input
                        type="number"
                        className="smd-input"
                        step="0.1"
                        min="0.1"
                        max="20"
                        value={selectedNode.mass || 1.0}
                        onChange={e => updateSelectedNode('mass', parseFloat(e.target.value) || 0.1)}
                      />
                    </div>
                    <div className="smd-field-row">
                      <label>Initial x₀ (m):</label>
                      <input
                        type="number"
                        className="smd-input"
                        step="0.01"
                        min="-0.5"
                        max="0.5"
                        value={selectedNode.x0 || 0}
                        onChange={e => updateSelectedNode('x0', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </>
                )}
              </div>
            ) : selectedEdge ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Type:</label>
                  <span className="smd-field-val">{selectedEdge.type.toUpperCase()}</span>
                </div>
                <div className="smd-field-row">
                  <label>Label:</label>
                  <input
                    type="text"
                    className="smd-input"
                    value={selectedEdge.label || ''}
                    placeholder={selectedEdge.type === 'spring' ? `${selectedEdge.k} N/m` : selectedEdge.type === 'damper' ? `${selectedEdge.c} N·s/m` : 'F(t)'}
                    onChange={e => updateSelectedEdge('label', e.target.value)}
                  />
                </div>
                {selectedEdge.type === 'spring' && (
                  <div className="smd-field-row">
                    <label>Stiffness k (N/m):</label>
                    <input
                      type="number"
                      className="smd-input"
                      step="5"
                      min="1"
                      max="1000"
                      value={selectedEdge.k || 100}
                      onChange={e => updateSelectedEdge('k', parseFloat(e.target.value) || 1)}
                    />
                  </div>
                )}
                {selectedEdge.type === 'damper' && (
                  <div className="smd-field-row">
                    <label>Damping c (N·s/m):</label>
                    <input
                      type="number"
                      className="smd-input"
                      step="0.1"
                      min="0"
                      max="20"
                      value={selectedEdge.c || 1.0}
                      onChange={e => updateSelectedEdge('c', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}
                {selectedEdge.type === 'force' && (
                  <>
                    <div className="smd-field-row">
                      <label>Amplitude F₀ (N):</label>
                      <input
                        type="number"
                        className="smd-input"
                        step="5"
                        min="0"
                        max="200"
                        value={selectedEdge.F0 || 20}
                        onChange={e => updateSelectedEdge('F0', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="smd-field-row">
                      <label>Waveform:</label>
                      <select
                        className="smd-input"
                        value={selectedEdge.waveform || 'sine'}
                        onChange={e => updateSelectedEdge('waveform', e.target.value)}
                      >
                        <option value="sine">Harmonic Sine</option>
                        <option value="step">Step Input</option>
                        <option value="impulse">Impulse</option>
                      </select>
                    </div>
                    {selectedEdge.waveform === 'sine' && (
                      <div className="smd-field-row">
                        <label>Frequency ω (rad/s):</label>
                        <input
                          type="number"
                          className="smd-input"
                          step="0.5"
                          min="0.5"
                          max="50"
                          value={selectedEdge.freq || 5.0}
                          onChange={e => updateSelectedEdge('freq', parseFloat(e.target.value) || 1)}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : selectedId === 'scope' ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ color: '#0284C7', fontWeight: 800 }}>SIMULINK SCOPE</span>
                </div>
                <div className="smd-field-row">
                  <label>Signals:</label>
                  <span className="smd-field-val">{system.n >= 2 ? 'x₁(t), x₂(t), F₁(t) via Mux' : 'x(t), ẋ(t), F(t) via Mux'}</span>
                </div>
                <div className="smd-field-row">
                  <label>Mass 1 Disp x₁:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace', color: '#16A34A', fontWeight: 700 }}>
                    {((simData?.x?.[0]?.[Math.min((simData?.x?.[0]?.length || 1) - 1, Math.round(simTimeState / 0.005))] || 0) * 100).toFixed(2)} cm
                  </span>
                </div>
                {system.n >= 2 && (
                  <div className="smd-field-row">
                    <label>Mass 2 Disp x₂:</label>
                    <span className="smd-field-val" style={{ fontFamily: 'monospace', color: '#0284C7', fontWeight: 700 }}>
                      {((simData?.x?.[1]?.[Math.min((simData?.x?.[1]?.length || 1) - 1, Math.round(simTimeState / 0.005))] || 0) * 100).toFixed(2)} cm
                    </span>
                  </div>
                )}
                <div className="smd-field-row">
                  <label>Mass 1 Vel v₁:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace', color: '#7C3AED', fontWeight: 700 }}>
                    {(simData?.v?.[0]?.[Math.min((simData?.v?.[0]?.length || 1) - 1, Math.round(simTimeState / 0.005))] || 0).toFixed(3)} m/s
                  </span>
                </div>
                <div style={{ marginTop: '14px' }}>
                  <button
                    type="button"
                    className="btn-pill-action"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #0F172A, #1E293B)',
                      color: '#38BDF8',
                      border: '1px solid #0284C7',
                      borderRadius: '6px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onClick={() => setShowScopeModal(true)}
                  >
                    <span>📈</span> Open Scope Window
                  </button>
                </div>
              </div>
            ) : (selectedId === 'int_v' || selectedId === 'int_v1') ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>INTEGRATOR 1 (1/s)</span>
                </div>
                <div className="smd-field-row">
                  <label>Operation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>∫ ẍ₁ dt = ẋ₁ (Velocity)</span>
                </div>
                <div className="smd-field-row">
                  <label>Input:</label>
                  <span className="smd-field-val">Acceleration ẍ₁ = ∑F₁ / m₁</span>
                </div>
                <div className="smd-field-row">
                  <label>Output ẋ₁:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace', color: '#2563EB', fontWeight: 700 }}>
                    {(simData?.v?.[0]?.[Math.min((simData?.v?.[0]?.length || 1) - 1, Math.round(simTimeState / 0.005))] || 0).toFixed(3)} m/s
                  </span>
                </div>
              </div>
            ) : (selectedId === 'int_x' || selectedId === 'int_x1') ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>INTEGRATOR 2 (1/s)</span>
                </div>
                <div className="smd-field-row">
                  <label>Operation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>∫ ẋ₁ dt = x₁ (Displacement)</span>
                </div>
                <div className="smd-field-row">
                  <label>Input:</label>
                  <span className="smd-field-val">Velocity ẋ₁(t)</span>
                </div>
                <div className="smd-field-row">
                  <label>Output x₁:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace', color: '#16A34A', fontWeight: 700 }}>
                    {((simData?.x?.[0]?.[Math.min((simData?.x?.[0]?.length || 1) - 1, Math.round(simTimeState / 0.005))] || 0) * 100).toFixed(2)} cm
                  </span>
                </div>
              </div>
            ) : selectedId === 'int_v2' ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>INTEGRATOR 3 (1/s)</span>
                </div>
                <div className="smd-field-row">
                  <label>Operation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>∫ ẍ₂ dt = ẋ₂ (Velocity)</span>
                </div>
                <div className="smd-field-row">
                  <label>Input:</label>
                  <span className="smd-field-val">Acceleration ẍ₂ = ∑F₂ / m₂</span>
                </div>
                <div className="smd-field-row">
                  <label>Output ẋ₂:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace', color: '#2563EB', fontWeight: 700 }}>
                    {(simData?.v?.[1]?.[Math.min((simData?.v?.[1]?.length || 1) - 1, Math.round(simTimeState / 0.005))] || 0).toFixed(3)} m/s
                  </span>
                </div>
              </div>
            ) : selectedId === 'int_x2' ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>INTEGRATOR 4 (1/s)</span>
                </div>
                <div className="smd-field-row">
                  <label>Operation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>∫ ẋ₂ dt = x₂ (Displacement)</span>
                </div>
                <div className="smd-field-row">
                  <label>Input:</label>
                  <span className="smd-field-val">Velocity ẋ₂(t)</span>
                </div>
                <div className="smd-field-row">
                  <label>Output x₂:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace', color: '#0284C7', fontWeight: 700 }}>
                    {((simData?.x?.[1]?.[Math.min((simData?.x?.[1]?.length || 1) - 1, Math.round(simTimeState / 0.005))] || 0) * 100).toFixed(2)} cm
                  </span>
                </div>
              </div>
            ) : (selectedId === 'sum' || selectedId === 'sum1') ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>SUMMING JUNCTION (Σ₁)</span>
                </div>
                <div className="smd-field-row">
                  <label>Equation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    {system.n >= 2 ? '∑F₁ = F₁(t) - Fd₁ - Fs₁ - Fd₁₂ - Fs₁₂' : '∑F = F(t) - c·ẋ - k·x'}
                  </span>
                </div>
                <div className="smd-field-row">
                  <label>Signs:</label>
                  <span className="smd-field-val">+ Force F₁, - Damping, - Spring, - Coupling</span>
                </div>
              </div>
            ) : selectedId === 'sum2' ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>SUMMING JUNCTION (Σ₂)</span>
                </div>
                <div className="smd-field-row">
                  <label>Equation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    ∑F₂ = Fd₁₂ + Fs₁₂ - Fd₂ - Fs₂
                  </span>
                </div>
                <div className="smd-field-row">
                  <label>Signs:</label>
                  <span className="smd-field-val">+ Coupling Action (Fd₁₂, Fs₁₂), - Ground Feedback</span>
                </div>
              </div>
            ) : (selectedId === 'gain_m' || selectedId === 'gain_m1') ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>MASS 1 GAIN (1/m₁)</span>
                </div>
                <div className="smd-field-row">
                  <label>Mass Value m₁:</label>
                  <span className="smd-field-val" style={{ fontWeight: 700 }}>{(system.M?.[0]?.[0] || 2.0).toFixed(2)} kg</span>
                </div>
                <div className="smd-field-row">
                  <label>Gain Value:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>1/m₁ = {(1 / (system.M?.[0]?.[0] || 2.0)).toFixed(3)} kg⁻¹</span>
                </div>
                <div className="smd-field-row">
                  <label>Equation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>ẍ₁ = ∑F₁ / m₁</span>
                </div>
              </div>
            ) : selectedId === 'gain_m2' ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>MASS 2 GAIN (1/m₂)</span>
                </div>
                <div className="smd-field-row">
                  <label>Mass Value m₂:</label>
                  <span className="smd-field-val" style={{ fontWeight: 700 }}>{(system.M?.[1]?.[1] || 2.0).toFixed(2)} kg</span>
                </div>
                <div className="smd-field-row">
                  <label>Gain Value:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>1/m₂ = {(1 / (system.M?.[1]?.[1] || 2.0)).toFixed(3)} kg⁻¹</span>
                </div>
                <div className="smd-field-row">
                  <label>Equation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>ẍ₂ = ∑F₂ / m₂</span>
                </div>
              </div>
            ) : selectedId === 'gain_c12' ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ color: '#D97706', fontWeight: 800 }}>COUPLING DAMPER (c₁₂)</span>
                </div>
                <div className="smd-field-row">
                  <label>Damping Coeff:</label>
                  <span className="smd-field-val" style={{ fontWeight: 700 }}>{Math.max(0, -(system.C?.[0]?.[1] || 0)).toFixed(2)} N·s/m</span>
                </div>
                <div className="smd-field-row">
                  <label>Equation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>Fd₁₂ = c₁₂(ẋ₁ - ẋ₂)</span>
                </div>
                <div className="smd-field-row">
                  <label>Newton's 3rd Law:</label>
                  <span className="smd-field-val" style={{ fontSize: '11px' }}>Reaction opposes Mass 1 (-), action drives Mass 2 (+)</span>
                </div>
              </div>
            ) : selectedId === 'gain_k12' ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ color: '#2563EB', fontWeight: 800 }}>COUPLING SPRING (k₁₂)</span>
                </div>
                <div className="smd-field-row">
                  <label>Stiffness:</label>
                  <span className="smd-field-val" style={{ fontWeight: 700 }}>{Math.max(0, -(system.K?.[0]?.[1] || 0)).toFixed(1)} N/m</span>
                </div>
                <div className="smd-field-row">
                  <label>Equation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>Fs₁₂ = k₁₂(x₁ - x₂)</span>
                </div>
                <div className="smd-field-row">
                  <label>Newton's 3rd Law:</label>
                  <span className="smd-field-val" style={{ fontSize: '11px' }}>Reaction opposes Mass 1 (-), action drives Mass 2 (+)</span>
                </div>
              </div>
            ) : (selectedId === 'gain_c' || selectedId === 'gain_c1') ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>GROUND DAMPER (c₁)</span>
                </div>
                <div className="smd-field-row">
                  <label>Damping Coeff:</label>
                  <span className="smd-field-val" style={{ fontWeight: 700 }}>{Math.max(0, (system.C?.[0]?.[0] || 0) + (system.n >= 2 ? (system.C?.[0]?.[1] || 0) : 0)).toFixed(2)} N·s/m</span>
                </div>
                <div className="smd-field-row">
                  <label>Equation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>Fd₁ = c₁·ẋ₁</span>
                </div>
              </div>
            ) : (selectedId === 'gain_k' || selectedId === 'gain_k1') ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>GROUND SPRING (k₁)</span>
                </div>
                <div className="smd-field-row">
                  <label>Stiffness:</label>
                  <span className="smd-field-val" style={{ fontWeight: 700 }}>{Math.max(0, (system.K?.[0]?.[0] || 0) + (system.n >= 2 ? (system.K?.[0]?.[1] || 0) : 0)).toFixed(1)} N/m</span>
                </div>
                <div className="smd-field-row">
                  <label>Equation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>Fs₁ = k₁·x₁</span>
                </div>
              </div>
            ) : selectedId === 'gain_c2' ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>GROUND DAMPER (c₂)</span>
                </div>
                <div className="smd-field-row">
                  <label>Damping Coeff:</label>
                  <span className="smd-field-val" style={{ fontWeight: 700 }}>{Math.max(0, (system.C?.[1]?.[1] || 0) + (system.C?.[0]?.[1] || 0)).toFixed(2)} N·s/m</span>
                </div>
                <div className="smd-field-row">
                  <label>Equation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>Fd₂ = c₂·ẋ₂</span>
                </div>
              </div>
            ) : selectedId === 'gain_k2' ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>GROUND SPRING (k₂)</span>
                </div>
                <div className="smd-field-row">
                  <label>Stiffness:</label>
                  <span className="smd-field-val" style={{ fontWeight: 700 }}>{Math.max(0, (system.K?.[1]?.[1] || 0) + (system.K?.[0]?.[1] || 0)).toFixed(1)} N/m</span>
                </div>
                <div className="smd-field-row">
                  <label>Equation:</label>
                  <span className="smd-field-val" style={{ fontFamily: 'monospace' }}>Fs₂ = k₂·x₂</span>
                </div>
              </div>
            ) : selectedId === 'mux' ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ fontWeight: 800 }}>MULTIPLEXER (MUX)</span>
                </div>
                <div className="smd-field-row">
                  <label>Function:</label>
                  <span className="smd-field-val">{system.n >= 2 ? 'Multiplexes [x₁(t), x₂(t)] into bus for Scope' : 'Multiplexes signals into bus for Scope'}</span>
                </div>
              </div>
            ) : (selectedId === 'src_f' || selectedId === 'src_f1' || selectedId === 'knob') ? (
              <div className="smd-inspector-body">
                <div className="smd-field-row">
                  <label>Block:</label>
                  <span className="smd-field-val" style={{ color: '#DC2626', fontWeight: 800 }}>EXCITATION FORCE F₁(t)</span>
                </div>
                <div className="smd-field-row">
                  <label>Control:</label>
                  <span className="smd-field-val">Rotary Knob / Force Edge Settings</span>
                </div>
              </div>
            ) : (
              <div className="smd-inspector-empty">
                <p>Click any component on the canvas to inspect and tune its parameters.</p>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation Deck */}
        <div className="smd-tabs-deck">
          <button
            type="button"
            className={`smd-tab-btn ${activeTab === 'classroom' ? 'active' : ''}`}
            onClick={() => setActiveTab('classroom')}
          >
            🎓 Classroom Problem Solver (Step-by-Step Derivation)
          </button>
          <button
            type="button"
            className={`smd-tab-btn ${activeTab === 'simulate' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulate')}
          >
            📈 Motion Telemetry (Oscilloscope)
          </button>
          <button
            type="button"
            className={`smd-tab-btn ${activeTab === 'matrices' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrices')}
          >
            🔢 System Matrices & Modal Eigenvalues
          </button>
          <button
            type="button"
            className={`smd-tab-btn ${activeTab === 'bode' ? 'active' : ''}`}
            onClick={() => setActiveTab('bode')}
          >
            📊 Frequency Response (Bode Plot)
          </button>
          <button
            type="button"
            className={`smd-tab-btn ${activeTab === 'analogy' ? 'active' : ''}`}
            onClick={() => setActiveTab('analogy')}
          >
            ⚡ Electrical Analogy (Maxwell & Firestone)
          </button>
          <button
            type="button"
            className={`smd-tab-btn ${activeTab === 'simulink_model' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulink_model')}
          >
            🎛️ Simulink Model & State-Space
          </button>
        </div>

        {/* Tab Display Views */}
        <div className="smd-tab-viewport">
          {activeTab === 'classroom' && (
            <div className="smd-classroom-deck">
              <div className="smd-classroom-header">
                <div className="smd-classroom-title-box">
                  <div className="smd-classroom-badge">Academic Analytical Solver</div>
                  <h3 className="smd-classroom-h3">
                    Step-by-Step Textbook Derivation & Analytical Solution
                  </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="smd-classroom-regime">
                    <span>⚡ Regime:</span>
                    <strong>{classroomSolution.regimeName}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn-copy-solution"
                    onClick={handleCopySolution}
                    title="Copy formatted mathematical derivation steps to clipboard"
                  >
                    {copied ? '✓ Derivation Copied!' : '📋 Copy Solution Steps'}
                  </button>
                  <button
                    type="button"
                    className="btn-export-solution-img"
                    onClick={handleExportPaperImage}
                    title="Generate and download handwritten-style problem & solution sheet (PNG)"
                  >
                    {exportedImg ? '✓ Image Saved!' : '📸 Export Paper Solution (PNG)'}
                  </button>
                </div>
              </div>

              {/* Dynamic Summary Ribbon */}
              <div className="smd-classroom-param-ribbon">
                <div className="smd-ribbon-item">
                  <span className="smd-ribbon-label">Total Mass m</span>
                  <span className="smd-ribbon-val">{classroomSolution.m.toFixed(2)} kg</span>
                </div>
                <div className="smd-ribbon-item">
                  <span className="smd-ribbon-label">Equiv Stiffness k_eq</span>
                  <span className="smd-ribbon-val">{classroomSolution.k_eq.toFixed(2)} N/m</span>
                </div>
                <div className="smd-ribbon-item">
                  <span className="smd-ribbon-label">Equiv Damping c_eq</span>
                  <span className="smd-ribbon-val">{classroomSolution.c_eq.toFixed(2)} N·s/m</span>
                </div>
                <div className="smd-ribbon-item">
                  <span className="smd-ribbon-label">Natural Freq ω_n</span>
                  <span className="smd-ribbon-val">{classroomSolution.omega_n.toFixed(3)} rad/s</span>
                </div>
                <div className="smd-ribbon-item">
                  <span className="smd-ribbon-label">Damping Ratio ζ</span>
                  <span className="smd-ribbon-val">{classroomSolution.zeta.toFixed(4)}</span>
                </div>
                {classroomSolution.zeta < 1.0 && (
                  <div className="smd-ribbon-item">
                    <span className="smd-ribbon-label">Damped Freq ω_d</span>
                    <span className="smd-ribbon-val">{classroomSolution.omega_d.toFixed(3)} rad/s</span>
                  </div>
                )}
              </div>

              {/* Step Cards List */}
              <div className="smd-steps-list">
                {classroomSolution.steps.map(step => (
                  <div key={step.stepNum} className="smd-step-card">
                    <div className="smd-step-header">
                      <span className="smd-step-number-badge">Step {step.stepNum}</span>
                      <h4 className="smd-step-title">{step.title}</h4>
                    </div>
                    <p className="smd-step-desc">{step.description}</p>
                    <div className="smd-step-math-box">
                      <div className="smd-math-row">
                        <span className="smd-math-tag">Governing Formula:</span>
                        <div className="smd-math-formula">
                          <EquationBlock latex={step.formula} displayMode={false} />
                        </div>
                      </div>
                      {step.substitution && (
                        <div className="smd-math-row">
                          <span className="smd-math-tag">Substitution:</span>
                          <div className="smd-math-formula">
                            <EquationBlock latex={step.substitution} displayMode={false} />
                          </div>
                        </div>
                      )}
                    </div>
                    {step.result && (
                      <div className="smd-step-result-badge">
                        <span className="smd-step-result-label">Result:</span>
                        <div className="smd-step-result-val">
                          <EquationBlock latex={step.result} displayMode={false} />
                        </div>
                      </div>
                    )}
                    {step.note && <p className="smd-step-note">💡 {step.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'simulate' && (
            <div className="smd-chart-card">
              <div style={{ height: 250 }}>
                <Line
                  data={timeChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    responsiveAnimationDuration: 0,
                    normalized: true,
                    transitions: { active: { animation: { duration: 0 } } },
                    scales: {
                      x: { title: { display: true, text: 'Time t (s)' } },
                      y: { title: { display: true, text: 'Displacement x(t) (m)' } }
                    }
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'matrices' && (
            <div className="smd-matrices-deck">
              <div className="smd-modal-kpi-grid">
                {modalData.frequenciesHz.map((fn, i) => (
                  <div key={i} className="smd-kpi-box">
                    <div className="smd-kpi-badge">Mode {i + 1}</div>
                    <div className="smd-kpi-num">{fn.toFixed(2)} Hz</div>
                    <div className="smd-kpi-sub">
                      ωₙ = {modalData.frequenciesRad[i].toFixed(2)} rad/s | ζ = {(modalData.dampingRatios[i] || 0).toFixed(3)}
                    </div>
                    <div className="smd-mode-vec">
                      Mode Shape φ: [{modalData.modeShapes[i]?.map(v => v.toFixed(3)).join(', ')}]
                    </div>
                  </div>
                ))}
              </div>

              {/* Assembled Matrices */}
              <div className="smd-matrix-cards-grid">
                <div className="smd-matrix-card">
                  <h4>Mass Matrix [M] (kg)</h4>
                  <pre>{JSON.stringify(system.M, null, 2)}</pre>
                </div>
                <div className="smd-matrix-card">
                  <h4>Stiffness Matrix [K] (N/m)</h4>
                  <pre>{JSON.stringify(system.K, null, 2)}</pre>
                </div>
                <div className="smd-matrix-card">
                  <h4>Damping Matrix [C] (N·s/m)</h4>
                  <pre>{JSON.stringify(system.C, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bode' && (
            <div className="smd-chart-card">
              <div style={{ height: 250 }}>
                <Line
                  data={bodeChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    responsiveAnimationDuration: 0,
                    normalized: true,
                    transitions: { active: { animation: { duration: 0 } } },
                    scales: {
                      x: { title: { display: true, text: 'Frequency f (Hz)' } },
                      y: { title: { display: true, text: 'Magnitude 20·log₁₀|H(jω)| (dB)' } }
                    }
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'analogy' && (
            <div className="smd-analogy-deck" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.9)', borderRadius: '10px', overflowY: 'auto', maxHeight: '420px' }}>
              <div style={{ marginBottom: '14px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                  Electro-Mechanical Physical Network Duality
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                  Every lumped mechanical system has two exact electrical circuit duals: <strong>Force–Voltage (Maxwell / Impedance)</strong> and <strong>Force–Current (Firestone / Mobility)</strong>.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: '#DBEAFE', color: '#1D4ED8', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>SERIES / LOOP</span>
                    Force–Voltage (Maxwell / Impedance)
                  </h4>
                  <p style={{ fontSize: '11.5px', color: '#64748B', margin: '0 0 8px 0' }}>
                    Sum of forces at a junction maps to Kirchhoff's Voltage Law (KVL) around a loop (ΣV = 0).
                  </p>
                  <ul style={{ fontSize: '11.5px', color: '#334155', margin: 0, paddingLeft: '18px', lineHeight: 1.6 }}>
                    <li>Mass <em>m</em> ↔ Inductance <em>L</em> (<em>L = m</em> H)</li>
                    <li>Damper <em>c</em> ↔ Resistance <em>R</em> (<em>R = c</em> Ω)</li>
                    <li>Spring <em>k</em> ↔ Elastance <em>1/C</em> (<em>C = 1/k</em> F)</li>
                    <li>Force <em>F(t)</em> ↔ Voltage Source <em>V(t)</em> (<em>V = F</em> V)</li>
                    <li>Velocity <em>v(t)</em> ↔ Current <em>i(t)</em> (<em>i = v</em> A)</li>
                  </ul>
                </div>

                <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>PARALLEL / NODAL</span>
                    Force–Current (Firestone / Mobility)
                  </h4>
                  <p style={{ fontSize: '11.5px', color: '#64748B', margin: '0 0 8px 0' }}>
                    Sum of forces on a mass maps to Kirchhoff's Current Law (KCL) at a node (ΣI = 0).
                  </p>
                  <ul style={{ fontSize: '11.5px', color: '#334155', margin: 0, paddingLeft: '18px', lineHeight: 1.6 }}>
                    <li>Mass <em>m</em> ↔ Capacitance to Ground <em>C</em> (<em>C = m</em> F)</li>
                    <li>Damper <em>c</em> ↔ Conductance <em>G = 1/R</em> (<em>R = 1/c</em> Ω)</li>
                    <li>Spring <em>k</em> ↔ Inductance <em>1/L</em> (<em>L = 1/k</em> H)</li>
                    <li>Force <em>F(t)</em> ↔ Current Source <em>I(t)</em> (<em>I = F</em> A)</li>
                    <li>Velocity <em>v(t)</em> ↔ Node Voltage <em>V_node(t)</em> (<em>V = v</em> V)</li>
                  </ul>
                </div>
              </div>

              {/* Dynamic Mapping Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #CBD5E1', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', color: '#334155' }}>Mechanical Element</th>
                      <th style={{ padding: '8px 10px', color: '#334155' }}>Mechanical Value</th>
                      <th style={{ padding: '8px 10px', color: '#1D4ED8' }}>Force–Voltage (Maxwell)</th>
                      <th style={{ padding: '8px 10px', color: '#15803D' }}>Force–Current (Firestone)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.filter(n => n.type === 'mass').map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>{m.label || m.id}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>m = {m.mass || 1.0} kg</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#1D4ED8' }}>L = {m.mass || 1.0} H</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#15803D' }}>C = {m.mass || 1.0} F</td>
                      </tr>
                    ))}
                    {edges.filter(e => e.type === 'spring').map(sp => (
                      <tr key={sp.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>{sp.label || sp.id}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>k = {sp.k} N/m</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#1D4ED8' }}>C = {(1 / (sp.k || 1)).toExponential(3)} F</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#15803D' }}>L = {(1 / (sp.k || 1)).toExponential(3)} H</td>
                      </tr>
                    ))}
                    {edges.filter(e => e.type === 'damper').map(dp => (
                      <tr key={dp.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>{dp.label || dp.id}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>c = {dp.c} N·s/m</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#1D4ED8' }}>R = {dp.c} Ω</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#15803D' }}>R = {(1 / (dp.c || 1)).toFixed(3)} Ω (G = {dp.c} S)</td>
                      </tr>
                    ))}
                    {edges.filter(e => e.type === 'force').map(fc => (
                      <tr key={fc.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fc.label || fc.id}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>F₀ = {fc.F0} N</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#1D4ED8' }}>V(t) = {fc.F0} V</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#15803D' }}>I(t) = {fc.F0} A</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'simulink_model' && (
            <div className="smd-simulink-deck">
              <div className="smd-classroom-header">
                <div className="smd-classroom-title-box">
                  <div className="smd-classroom-badge">MathWorks Simulink Architecture</div>
                  <h3 className="smd-classroom-h3">
                    Signal Flow Dynamics, Transfer Function & State-Space Engine
                  </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-copy-solution"
                    onClick={handleCopyMatlabScript}
                    title="Copy ready-to-run MATLAB / Simulink .m script to clipboard"
                  >
                    {copiedMatlab ? '✓ MATLAB Script Copied!' : '📋 Copy MATLAB Script (.m)'}
                  </button>
                </div>
              </div>

              {/* Mathematical Equation & Block Diagram Mapping */}
              <div className="smd-simulink-grid">
                {system.n >= 2 ? (
                  <>
                    <div className="smd-simulink-card">
                      <h4>📐 1. Coupled 2-DOF State-Variable Formulation</h4>
                      <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 10px 0' }}>
                        Coupled Newton-Euler equations of motion written in vector matrix state format:
                      </p>
                      <EquationBlock latex={`\\mathbf{M} \\mathbf{\\ddot{x}} + \\mathbf{C} \\mathbf{\\dot{x}} + \\mathbf{K} \\mathbf{x} = \\mathbf{F}(t)`} />
                      <EquationBlock latex={`\\begin{bmatrix} ${(system.M[0][0] || 2).toFixed(1)} & 0 \\\\ 0 & ${(system.M[1][1] || 2).toFixed(1)} \\end{bmatrix} \\begin{bmatrix} \\ddot{x}_1 \\\\ \\ddot{x}_2 \\end{bmatrix} + \\begin{bmatrix} ${(system.C[0][0] || 0).toFixed(1)} & ${(system.C[0][1] || 0).toFixed(1)} \\\\ ${(system.C[1][0] || 0).toFixed(1)} & ${(system.C[1][1] || 0).toFixed(1)} \\end{bmatrix} \\begin{bmatrix} \\dot{x}_1 \\\\ \\dot{x}_2 \\end{bmatrix} + \\begin{bmatrix} ${(system.K[0][0] || 0).toFixed(0)} & ${(system.K[0][1] || 0).toFixed(0)} \\\\ ${(system.K[1][0] || 0).toFixed(0)} & ${(system.K[1][1] || 0).toFixed(0)} \\end{bmatrix} \\begin{bmatrix} x_1 \\\\ x_2 \\end{bmatrix} = \\begin{bmatrix} F_1(t) \\\\ 0 \\end{bmatrix}`} />
                      <div style={{ fontSize: '11.5px', color: '#334155', marginTop: '10px', lineHeight: '1.6' }}>
                        • <strong>Dual Integrator Lanes:</strong> Lane 1 handles Mass 1 ($1/m_1, 1/s, 1/s$), Lane 2 handles Mass 2 ($1/m_2, 1/s, 1/s$)<br />
                        • <strong>Coupling Blocks:</strong> Damper $c_{12}$ and spring $k_{12}$ driven by relative velocity $(\dot{x}_1 - \dot{x}_2)$ and relative displacement $(x_1 - x_2)$<br />
                        • <strong>Newton's 3rd Law:</strong> Action force enters $\Sigma_2$ with $(+)$, reaction force enters $\Sigma_1$ with $(-)$
                      </div>
                    </div>

                    <div className="smd-simulink-card">
                      <h4>⚡ 2. Modal Frequencies & Eigenvector Modes</h4>
                      <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 10px 0' }}>
                        Characteristic eigenvalues of <strong>M⁻¹K</strong> establishing natural resonance frequencies:
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                        <div className="smd-kpi-box" style={{ padding: '8px 10px' }}>
                          <div className="smd-kpi-badge">Mode 1 (Fundamental)</div>
                          <div className="smd-kpi-num" style={{ fontSize: '16px' }}>{(modalData?.frequenciesRad?.[0] || 0).toFixed(3)} rad/s</div>
                          <div className="smd-kpi-sub">f₁ = {((modalData?.frequenciesRad?.[0] || 0) / (2 * Math.PI)).toFixed(2)} Hz</div>
                        </div>
                        <div className="smd-kpi-box" style={{ padding: '8px 10px' }}>
                          <div className="smd-kpi-badge">Mode 2 (Coupled)</div>
                          <div className="smd-kpi-num" style={{ fontSize: '16px' }}>{(modalData?.frequenciesRad?.[1] || 0).toFixed(3)} rad/s</div>
                          <div className="smd-kpi-sub">f₂ = {((modalData?.frequenciesRad?.[1] || 0) / (2 * Math.PI)).toFixed(2)} Hz</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '8px', fontFamily: 'monospace' }}>
                        Mode 1 Shape: [{modalData?.modeShapes?.[0]?.map(v => v.toFixed(3)).join(', ')}]<br />
                        Mode 2 Shape: [{modalData?.modeShapes?.[1]?.map(v => v.toFixed(3)).join(', ')}]
                      </div>
                    </div>

                    <div className="smd-simulink-card">
                      <h4>🔢 3. 4×4 Continuous State-Space Realization</h4>
                      <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 10px 0' }}>
                        State vector <strong>z</strong> = [x₁, x₂, ẋ₁, ẋ₂]ᵀ, <strong>ż</strong> = <strong>Az</strong> + <strong>Bu</strong>:
                      </p>
                      <EquationBlock latex={`\\mathbf{\\dot{z}} = \\begin{bmatrix} \\mathbf{0}_{2\\times 2} & \\mathbf{I}_{2\\times 2} \\\\ -\\mathbf{M}^{-1}\\mathbf{K} & -\\mathbf{M}^{-1}\\mathbf{C} \\end{bmatrix} \\mathbf{z} + \\begin{bmatrix} \\mathbf{0}_{2\\times 2} \\\\ \\mathbf{M}^{-1} \\end{bmatrix} \\mathbf{u}(t)`} />
                      <div style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: '6px', fontSize: '10.5px', fontFamily: 'monospace', marginTop: '8px' }}>
                        A = [0, 0, 1, 0; 0, 0, 0, 1;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;{-(system.K[0][0]/system.M[0][0]).toFixed(1)}, {-(system.K[0][1]/system.M[0][0]).toFixed(1)}, {-(system.C[0][0]/system.M[0][0]).toFixed(1)}, {-(system.C[0][1]/system.M[0][0]).toFixed(1)};<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;{-(system.K[1][0]/system.M[1][1]).toFixed(1)}, {-(system.K[1][1]/system.M[1][1]).toFixed(1)}, {-(system.C[1][0]/system.M[1][1]).toFixed(1)}, {-(system.C[1][1]/system.M[1][1]).toFixed(1)}]<br />
                        B = [0; 0; {(1/system.M[0][0]).toFixed(3)}; 0]; C = [1, 0, 0, 0; 0, 1, 0, 0]; D = 0
                      </div>
                    </div>

                    <div className="smd-simulink-card">
                      <h4>📈 4. Multi-Channel Signal Flow Routing</h4>
                      <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 10px 0' }}>
                        Bus architecture and mutual energy exchange between masses:
                      </p>
                      <div style={{ fontSize: '12px', lineHeight: '1.7', color: '#1E293B' }}>
                        • <strong>Multiplexer (Mux):</strong> Bundles state signals $x_1(t)$ and $x_2(t)$ into a single vector bus<br />
                        • <strong>Scope Oscilloscope:</strong> Dual-channel phosphor tracing with separate colors for Mass 1 (green) and Mass 2 (cyan)<br />
                        • <strong>Beat Frequency / Resonance:</strong> Observable phase lag and modal energy transfer between oscillators
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="smd-simulink-card">
                      <h4>📐 1. Canonical State-Variable Formulation</h4>
                      <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 10px 0' }}>
                        Newton's 2nd Law rewritten in explicit acceleration form for cascaded integrator blocks:
                      </p>
                      <EquationBlock latex="m \ddot{x} + c \dot{x} + k x = F(t) \iff \ddot{x} = \frac{1}{m}\Big[ F(t) - c \dot{x} - k x \Big]" />
                      <div style={{ fontSize: '11.5px', color: '#334155', marginTop: '10px', lineHeight: '1.6' }}>
                        • <strong>Summing Junction (Σ):</strong> Computes net dynamic force F_net = F(t) - F_damping - F_spring<br />
                        • <strong>Mass Gain (1/m):</strong> Scales net dynamic force into acceleration a = F_net / m<br />
                        • <strong>Double Integrator Chain (1/s → 1/s):</strong> Cascaded time integrations yielding velocity v(t) and displacement x(t)<br />
                        • <strong>Negative State Feedback:</strong> -c·v (damper) and -k·x (spring) fed back to the summing junction
                      </div>
                    </div>

                    <div className="smd-simulink-card">
                      <h4>⚡ 2. Laplace Transfer Function $G(s)$</h4>
                      <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 10px 0' }}>
                        Input-to-output transfer function from excitation force $F(s)$ to displacement $X(s)$:
                      </p>
                      <EquationBlock latex={`G(s) = \\frac{X(s)}{F(s)} = \\frac{1}{m s^2 + c s + k} = \\frac{${(1 / (classroomSolution.m || 2)).toFixed(3)}}{s^2 + ${(classroomSolution.c_eq / (classroomSolution.m || 2)).toFixed(3)}s + ${(classroomSolution.k_eq / (classroomSolution.m || 2)).toFixed(2)}}`} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                        <div className="smd-kpi-box" style={{ padding: '8px 10px' }}>
                          <div className="smd-kpi-badge">Natural Frequency</div>
                          <div className="smd-kpi-num" style={{ fontSize: '16px' }}>{classroomSolution.omega_n.toFixed(3)} rad/s</div>
                          <div className="smd-kpi-sub">f_n = {(classroomSolution.omega_n / (2 * Math.PI)).toFixed(2)} Hz</div>
                        </div>
                        <div className="smd-kpi-box" style={{ padding: '8px 10px' }}>
                          <div className="smd-kpi-badge">Damping Ratio</div>
                          <div className="smd-kpi-num" style={{ fontSize: '16px' }}>ζ = {classroomSolution.zeta.toFixed(4)}</div>
                          <div className="smd-kpi-sub">{classroomSolution.regimeName}</div>
                        </div>
                      </div>
                    </div>

                    <div className="smd-simulink-card">
                      <h4>🔢 3. Continuous State-Space Realization</h4>
                      <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 10px 0' }}>
                        Standard Cauchy state-variable format dx/dt = A·x + B·u, y = C·x + D·u:
                      </p>
                      <EquationBlock latex={`\\begin{bmatrix} \\dot{x}_1 \\\\ \\dot{x}_2 \\end{bmatrix} = \\begin{bmatrix} 0 & 1 \\\\ -\\frac{k}{m} & -\\frac{c}{m} \\end{bmatrix} \\begin{bmatrix} x_1 \\\\ x_2 \\end{bmatrix} + \\begin{bmatrix} 0 \\\\ \\frac{1}{m} \\end{bmatrix} u(t)`} />
                      <EquationBlock latex={`\\mathbf{y} = \\begin{bmatrix} 1 & 0 \\end{bmatrix} \\begin{bmatrix} x_1 \\\\ x_2 \\end{bmatrix}, \\quad \\mathbf{D} = [0]`} />
                      <div style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace', marginTop: '8px' }}>
                        A = [0, 1; {-((classroomSolution.k_eq || 150) / (classroomSolution.m || 2)).toFixed(2)}, {-((classroomSolution.c_eq || 2) / (classroomSolution.m || 2)).toFixed(2)}]<br />
                        B = [0; {(1 / (classroomSolution.m || 2)).toFixed(3)}]<br />
                        C = [1, 0]; D = 0
                      </div>
                    </div>

                    <div className="smd-simulink-card">
                      <h4>📈 4. Poles, Zeros & Transient Dynamics</h4>
                      <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 10px 0' }}>
                        Characteristic roots in the complex s-plane dictating stability and oscillation envelopes:
                      </p>
                      <div style={{ fontSize: '12px', lineHeight: '1.7', color: '#1E293B' }}>
                        • <strong>Complex Conjugate Poles:</strong> s₁,₂ = {(-classroomSolution.zeta * classroomSolution.omega_n).toFixed(3)} ± j{(classroomSolution.omega_d || 0).toFixed(3)}<br />
                        • <strong>Finite Zeros:</strong> None (all-pole 2nd-order transfer function)<br />
                        • <strong>Estimated Rise Time:</strong> ${(1.8 / (classroomSolution.omega_n || 1)).toFixed(3)} s<br />
                        • <strong>Estimated Settling Time (2%):</strong> ${(4 / Math.max(1e-3, classroomSolution.zeta * classroomSolution.omega_n)).toFixed(3)} s<br />
                        • <strong>Peak Overshoot:</strong> {classroomSolution.zeta < 1 ? (Math.exp(-Math.PI * classroomSolution.zeta / Math.sqrt(Math.max(1e-4, 1 - classroomSolution.zeta * classroomSolution.zeta))) * 100).toFixed(1) + '%' : '0% (No overshoot)'}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* MATLAB Runnable Script Box */}
              <div className="smd-simulink-card" style={{ marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4>💻 Ready-to-Run MATLAB / Simulink Script</h4>
                  <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>simulink_model.m</span>
                </div>
                <pre className="smd-code-box">
{generateMatlabScript(system, nodes, edges, classroomSolution)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Simulink Scope Oscilloscope Window Modal */}
      <SimulinkScopeModal
        isOpen={showScopeModal}
        onClose={() => setShowScopeModal(false)}
        simData={simData}
        edges={edges}
        classroomSolution={classroomSolution}
        modalData={modalData}
        system={system}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(p => !p)}
        onReset={() => {
          simTimeRef.current = 0;
          setSimTimeState(0);
        }}
        simTime={simTimeState}
        onSeek={(newT) => {
          simTimeRef.current = newT;
          setSimTimeState(newT);
        }}
      />
    </div>
  );
};

// ── Graphical Canvas Helper Drawing Functions ─────────────────────────────────

function drawSpring(ctx, x1, y1, x2, y2, color, label) {
  const isAngled = Math.abs(y2 - y1) > 4;
  let p1x = x1, p1y = y1, p2x = x2, p2y = y2;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (isAngled) {
    const leadLen = Math.min(18, Math.max(10, Math.abs(x2 - x1) * 0.12));
    const dir = x2 >= x1 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + dir * leadLen, y1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - dir * leadLen, y2);
    ctx.stroke();

    p1x = x1 + dir * leadLen;
    p2x = x2 - dir * leadLen;
  }

  const dx = p2x - p1x;
  const dy = p2y - p1y;
  const dist = Math.hypot(dx, dy);
  if (dist < 15) { ctx.restore(); return; }
  const angle = Math.atan2(dy, dx);
  const numCoils = 8;
  const lead = Math.min(14, dist * 0.12);
  const coilWidth = dist - 2 * lead;
  const h = 11;

  ctx.translate(p1x, p1y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(lead, 0);

  for (let i = 0; i < numCoils; i++) {
    const cx1 = lead + (i + 0.25) * (coilWidth / numCoils);
    const cy1 = -h;
    const cx2 = lead + (i + 0.75) * (coilWidth / numCoils);
    const cy2 = h;
    ctx.lineTo(cx1, cy1);
    ctx.lineTo(cx2, cy2);
  }
  ctx.lineTo(dist - lead, 0);
  ctx.lineTo(dist, 0);
  ctx.stroke();

  // Label badge
  if (label) {
    ctx.save();
    ctx.translate(dist / 2, -h - 8);
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
      ctx.rotate(Math.PI);
    }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-34, -8, 68, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#60A5FA';
    ctx.font = '700 9.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

function drawDamper(ctx, x1, y1, x2, y2, color, label) {
  const isAngled = Math.abs(y2 - y1) > 4;
  let p1x = x1, p1y = y1, p2x = x2, p2y = y2;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (isAngled) {
    const leadLen = Math.min(18, Math.max(10, Math.abs(x2 - x1) * 0.12));
    const dir = x2 >= x1 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + dir * leadLen, y1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - dir * leadLen, y2);
    ctx.stroke();

    p1x = x1 + dir * leadLen;
    p2x = x2 - dir * leadLen;
  }

  const dx = p2x - p1x;
  const dy = p2y - p1y;
  const dist = Math.hypot(dx, dy);
  if (dist < 20) { ctx.restore(); return; }
  const angle = Math.atan2(dy, dx);
  const mid = dist / 2;
  const cylW = Math.min(34, dist * 0.4);
  const cylH = 18;

  ctx.translate(p1x, p1y);
  ctx.rotate(angle);

  // Left rod into cylinder housing
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(mid - cylW / 2, 0);
  ctx.stroke();

  // Cylinder housing
  ctx.beginPath();
  ctx.moveTo(mid + cylW / 2, -cylH / 2);
  ctx.lineTo(mid - cylW / 2, -cylH / 2);
  ctx.lineTo(mid - cylW / 2, cylH / 2);
  ctx.lineTo(mid + cylW / 2, cylH / 2);
  ctx.stroke();

  // Cylinder fluid fill
  ctx.fillStyle = color + '22';
  ctx.fillRect(mid - cylW / 2, -cylH / 2, cylW, cylH);

  // Piston plate & right rod
  ctx.beginPath();
  ctx.moveTo(mid - 3, -cylH / 2 + 3);
  ctx.lineTo(mid - 3, cylH / 2 - 3);
  ctx.moveTo(mid - 3, 0);
  ctx.lineTo(dist, 0);
  ctx.stroke();

  // Label badge
  if (label) {
    ctx.save();
    ctx.translate(mid, -cylH / 2 - 8);
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
      ctx.rotate(Math.PI);
    }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-34, -8, 68, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.font = '700 9.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

function drawForceArrow(ctx, x, y, color, label) {
  ctx.save();
  // Render top-mounted actuator horizontal force arrow so it never intersects horizontal springs/dampers
  const arrowY = y - 36;
  const arrowLen = 42;
  const arrowEnd = x + 16;
  const arrowStart = arrowEnd - arrowLen;

  // Vertical mounting bracket from mass top (y - 28) to actuator line
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 28);
  ctx.lineTo(x, arrowY);
  ctx.stroke();

  // Actuator Force Arrow
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(arrowStart, arrowY);
  ctx.lineTo(arrowEnd, arrowY);
  ctx.stroke();

  // Arrowhead pointing rightwards along force vector
  ctx.beginPath();
  ctx.moveTo(arrowEnd, arrowY);
  ctx.lineTo(arrowEnd - 9, arrowY - 5);
  ctx.lineTo(arrowEnd - 9, arrowY + 5);
  ctx.closePath();
  ctx.fill();

  // Actuator badge label
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(x - 38, arrowY - 18, 76, 15, 3);
  ctx.fill();

  ctx.fillStyle = '#F87171';
  ctx.font = '700 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, arrowY - 10);

  ctx.restore();
}

// ── MathWorks Simulink Block Diagram Canvas Renderer ─────────────────────────

function drawSimulinkCanvas(
  ctx,
  w,
  h,
  t,
  stepIdx,
  nodes,
  edges,
  classroomSolution,
  simData,
  blocks,
  selectedId,
  isPlaying,
  hoveredNodeId,
  system,
  modalData
) {
  // 1. Grid Background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, w, h);

  // Subtle dot/cross grid
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 24) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 24) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const is2DOF = (system?.n >= 2) || (nodes.filter(n => n.type === 'mass').length >= 2);

  // Header Title
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 13px system-ui';
  ctx.textAlign = 'left';
  if (is2DOF) {
    ctx.fillText('Simulink Model: 2-DOF Coupled Mass-Spring-Damper (Mẍ + Cẋ + Kx = F)', 18, 24);
  } else {
    ctx.fillText('Simulink Model: Single-DOF Mass-Spring-Damper (mẍ + cẋ + kx = F)', 18, 24);
  }

  ctx.fillStyle = '#64748B';
  ctx.font = '500 10.5px system-ui';
  if (is2DOF) {
    ctx.fillText('MathWorks® Multi-Body Signal Flow • Dual Integrator Chains with Inter-Mass Coupling (c₁₂, k₁₂)', 18, 40);
  } else {
    ctx.fillText('MathWorks® Signal Flow Architecture • Double Integrator with Negative State Feedback', 18, 40);
  }

  // Right Header Resonance Badge
  if (is2DOF && modalData?.frequenciesRad?.length >= 2) {
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0369A1';
    ctx.font = '700 10.5px monospace';
    ctx.fillText(`Mode 1: ωn₁ = ${modalData.frequenciesRad[0].toFixed(2)} rad/s  |  Mode 2: ωn₂ = ${modalData.frequenciesRad[1].toFixed(2)} rad/s`, w - 18, 24);
    ctx.restore();
  }

  // Watermark at bottom
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 9.5px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Copyright © MathWorks-Style Block Diagram Modeling Engine', w / 2, h - 8);

  // Reusable orthogonal wire drawing helper
  const drawWire = (pts, badgeText, badgeColor = '#0F172A', badgeBg = 'rgba(255, 255, 255, 0.95)') => {
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    // Arrowhead at end
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
    ctx.save();
    ctx.translate(last.x, last.y);
    ctx.rotate(angle);
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, -4);
    ctx.lineTo(-7, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Moving signal pulse dot
    if (isPlaying) {
      let totalL = 0;
      for (let i = 1; i < pts.length; i++) {
        totalL += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
      }
      if (totalL > 5) {
        let dist = ((t * 70) % totalL);
        for (let i = 1; i < pts.length; i++) {
          const segL = Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
          if (dist <= segL) {
            const ratio = dist / segL;
            const px = pts[i-1].x + (pts[i].x - pts[i-1].x) * ratio;
            const py = pts[i-1].y + (pts[i].y - pts[i-1].y) * ratio;
            ctx.fillStyle = '#38BDF8';
            ctx.beginPath();
            ctx.arc(px, py, 3.2, 0, 2 * Math.PI);
            ctx.fill();
            break;
          }
          dist -= segL;
        }
      }
    }

    // Badge label
    if (badgeText) {
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      ctx.save();
      ctx.fillStyle = badgeBg;
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(midX - 28, midY - 14, 56, 13, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = badgeColor;
      ctx.font = '700 8.5px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, midX, midY - 8);
      ctx.restore();
    }
  };

  // Extract Force Input Parameters
  const forceEdge = edges.find(e => e.type === 'force');
  const F0 = forceEdge ? (Number(forceEdge.F0) || 0) : 0;
  const freq = forceEdge ? (Number(forceEdge.freq) || 5.0) : 5.0;
  const waveform = forceEdge ? (forceEdge.waveform || 'sine') : 'none';

  let F_val = 0;
  if (forceEdge) {
    if (waveform === 'sine') F_val = F0 * Math.sin(freq * t);
    else if (waveform === 'step') F_val = F0;
    else if (waveform === 'impulse') F_val = t < 0.1 ? F0 * 10 : 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE A: 2-DOF / MULTI-DOF COUPLED TWO-MASS SIMULINK MODEL
  // ═══════════════════════════════════════════════════════════════════════════
  if (is2DOF) {
    const M = system?.M || [[2.0, 0], [0, 2.0]];
    const C = system?.C || [[5.0, -2.0], [-2.0, 2.0]];
    const K = system?.K || [[400.0, 0], [0, 0]];

    const m1 = Math.max(1e-4, M[0]?.[0] || 2.0);
    const m2 = Math.max(1e-4, M[1]?.[1] || 2.0);

    const k12 = Math.max(0, -(K[0]?.[1] || 0));
    const c12 = Math.max(0, -(C[0]?.[1] || 0));

    const k1 = Math.max(0, (K[0]?.[0] || 0) - k12);
    const c1 = Math.max(0, (C[0]?.[0] || 0) - c12);

    const k2 = Math.max(0, (K[1]?.[1] || 0) - k12);
    const c2 = Math.max(0, (C[1]?.[1] || 0) - c12);

    // Current time-domain signals
    const x1_val = (simData?.x?.[0]?.[stepIdx]) ?? 0;
    const v1_val = (simData?.v?.[0]?.[stepIdx]) ?? 0;
    const x2_val = (simData?.x?.[1]?.[stepIdx]) ?? 0;
    const v2_val = (simData?.v?.[1]?.[stepIdx]) ?? 0;

    const delta_x = x1_val - x2_val;
    const delta_v = v1_val - v2_val;

    const Fd12_val = c12 * delta_v;
    const Fs12_val = k12 * delta_x;

    const Fd1_val = c1 * v1_val;
    const Fs1_val = k1 * x1_val;

    const sumF1_val = F_val - Fd1_val - Fs1_val - Fd12_val - Fs12_val;
    const a1_val = sumF1_val / m1;

    const Fd2_val = c2 * v2_val;
    const Fs2_val = k2 * x2_val;

    const sumF2_val = Fd12_val + Fs12_val - Fd2_val - Fs2_val;
    const a2_val = sumF2_val / m2;

    const def = getDefaultSimulinkBlocks(2);
    const src_f1 = blocks.src_f1 || blocks.src_f || def.src_f1;
    const sum1 = blocks.sum1 || blocks.sum || def.sum1;
    const gain_m1 = blocks.gain_m1 || blocks.gain_m || def.gain_m1;
    const int_v1 = blocks.int_v1 || blocks.int_v || def.int_v1;
    const int_x1 = blocks.int_x1 || blocks.int_x || def.int_x1;
    const gain_c1 = blocks.gain_c1 || blocks.gain_c || def.gain_c1;
    const gain_k1 = blocks.gain_k1 || blocks.gain_k || def.gain_k1;

    const gain_c12 = blocks.gain_c12 || def.gain_c12;
    const gain_k12 = blocks.gain_k12 || def.gain_k12;

    const sum2 = blocks.sum2 || def.sum2;
    const gain_m2 = blocks.gain_m2 || def.gain_m2;
    const int_v2 = blocks.int_v2 || def.int_v2;
    const int_x2 = blocks.int_x2 || def.int_x2;
    const gain_c2 = blocks.gain_c2 || def.gain_c2;
    const gain_k2 = blocks.gain_k2 || def.gain_k2;

    const mux = blocks.mux || def.mux;
    const scope = blocks.scope || def.scope;
    const knob = blocks.knob || def.knob;

    // ── Signal Wires for Lane 1 (Mass 1) ──────────────────────────────────────
    drawWire([
      { x: src_f1.x + src_f1.w / 2, y: src_f1.y },
      { x: sum1.x - sum1.r, y: sum1.y }
    ], `F1=${F_val.toFixed(1)}N`, '#DC2626');

    drawWire([
      { x: sum1.x + sum1.r, y: sum1.y },
      { x: gain_m1.x - gain_m1.w / 2, y: gain_m1.y }
    ], `ΣF1=${sumF1_val.toFixed(1)}N`, '#1E293B');

    drawWire([
      { x: gain_m1.x + gain_m1.w / 2, y: gain_m1.y },
      { x: int_v1.x - int_v1.w / 2, y: int_v1.y }
    ], `ẍ1=${a1_val.toFixed(2)}`, '#7C3AED');

    const bx1 = (int_v1.x + int_x1.x) / 2;
    drawWire([
      { x: int_v1.x + int_v1.w / 2, y: int_v1.y },
      { x: int_x1.x - int_x1.w / 2, y: int_x1.y }
    ], `ẋ1=${v1_val.toFixed(2)}`, '#2563EB');

    // Branch 1 Dot
    ctx.fillStyle = '#1E293B';
    ctx.beginPath(); ctx.arc(bx1, int_v1.y, 3.5, 0, 2 * Math.PI); ctx.fill();

    // Mass 1 Ground Damper Feedback
    if (c1 > 0) {
      drawWire([
        { x: bx1, y: int_v1.y },
        { x: bx1, y: gain_c1.y },
        { x: gain_c1.x + gain_c1.w / 2, y: gain_c1.y }
      ]);
      drawWire([
        { x: gain_c1.x - gain_c1.w / 2, y: gain_c1.y },
        { x: sum1.x - 7, y: gain_c1.y },
        { x: sum1.x - 7, y: sum1.y + sum1.r }
      ], `Fd1=${Fd1_val.toFixed(1)}N`, '#D97706');
    }

    // Mass 1 Ground Spring Feedback
    const bx2 = (int_x1.x + mux.x) / 2 - 15;
    drawWire([
      { x: int_x1.x + int_x1.w / 2, y: int_x1.y },
      { x: mux.x - mux.w / 2, y: int_x1.y }
    ], `x1=${(x1_val * 100).toFixed(1)}cm`, '#059669');

    // Branch 2 Dot
    ctx.fillStyle = '#1E293B';
    ctx.beginPath(); ctx.arc(bx2, int_x1.y, 3.5, 0, 2 * Math.PI); ctx.fill();

    if (k1 > 0) {
      drawWire([
        { x: bx2, y: int_x1.y },
        { x: bx2, y: gain_k1.y },
        { x: gain_k1.x + gain_k1.w / 2, y: gain_k1.y }
      ]);
      drawWire([
        { x: gain_k1.x - gain_k1.w / 2, y: gain_k1.y },
        { x: sum1.x + 7, y: gain_k1.y },
        { x: sum1.x + 7, y: sum1.y + sum1.r }
      ], `Fs1=${Fs1_val.toFixed(1)}N`, '#2563EB');
    }

    // ── Inter-Mass Coupling Wires (Damper c12 & Spring k12) ───────────────────
    if (c12 > 0) {
      // Relative velocity input taps
      drawWire([
        { x: bx1, y: int_v1.y },
        { x: bx1, y: gain_c12.y - 7 },
        { x: gain_c12.x + gain_c12.w / 2, y: gain_c12.y - 7 }
      ]);
      drawWire([
        { x: bx1, y: int_v2.y },
        { x: bx1, y: gain_c12.y + 7 },
        { x: gain_c12.x + gain_c12.w / 2, y: gain_c12.y + 7 }
      ]);

      // Reaction on Mass 1 (Enters sum1 with -)
      drawWire([
        { x: gain_c12.x - gain_c12.w / 2, y: gain_c12.y - 7 },
        { x: sum1.x + 14, y: gain_c12.y - 7 },
        { x: sum1.x + 14, y: sum1.y + sum1.r }
      ], `Fd12=${Fd12_val.toFixed(1)}N`, '#D97706');

      // Action on Mass 2 (Enters sum2 with +)
      drawWire([
        { x: gain_c12.x - gain_c12.w / 2, y: gain_c12.y + 7 },
        { x: sum2.x - 7, y: gain_c12.y + 7 },
        { x: sum2.x - 7, y: sum2.y - sum2.r }
      ], `+Fd12`, '#15803D');
    }

    if (k12 > 0) {
      // Spring coupling outputs
      drawWire([
        { x: gain_k12.x - gain_k12.w / 2, y: gain_k12.y - 7 },
        { x: sum1.x + 21, y: gain_k12.y - 7 },
        { x: sum1.x + 21, y: sum1.y + sum1.r }
      ], `Fs12=${Fs12_val.toFixed(1)}N`, '#2563EB');

      drawWire([
        { x: gain_k12.x - gain_k12.w / 2, y: gain_k12.y + 7 },
        { x: sum2.x + 7, y: gain_k12.y + 7 },
        { x: sum2.x + 7, y: sum2.y - sum2.r }
      ], `+Fs12`, '#15803D');
    }

    // ── Signal Wires for Lane 2 (Mass 2) ──────────────────────────────────────
    drawWire([
      { x: sum2.x + sum2.r, y: sum2.y },
      { x: gain_m2.x - gain_m2.w / 2, y: gain_m2.y }
    ], `ΣF2=${sumF2_val.toFixed(1)}N`, '#1E293B');

    drawWire([
      { x: gain_m2.x + gain_m2.w / 2, y: gain_m2.y },
      { x: int_v2.x - int_v2.w / 2, y: int_v2.y }
    ], `ẍ2=${a2_val.toFixed(2)}`, '#7C3AED');

    const bx2_v = (int_v2.x + int_x2.x) / 2;
    drawWire([
      { x: int_v2.x + int_v2.w / 2, y: int_v2.y },
      { x: int_x2.x - int_x2.w / 2, y: int_x2.y }
    ], `ẋ2=${v2_val.toFixed(2)}`, '#2563EB');

    ctx.fillStyle = '#1E293B';
    ctx.beginPath(); ctx.arc(bx2_v, int_v2.y, 3.5, 0, 2 * Math.PI); ctx.fill();

    drawWire([
      { x: int_x2.x + int_x2.w / 2, y: int_x2.y },
      { x: mux.x - mux.w / 2, y: int_x2.y }
    ], `x2=${(x2_val * 100).toFixed(1)}cm`, '#0284C7');

    // ── Wires into Mux and Scope ─────────────────────────────────────────────
    drawWire([
      { x: mux.x + mux.w / 2, y: scope.y },
      { x: scope.x - scope.w / 2, y: scope.y }
    ], '[x1, x2]', '#1E293B');

    // Knob -> Force dashed wire
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#94A3B8';
    ctx.beginPath();
    ctx.moveTo(knob.x, knob.y - knob.r);
    ctx.lineTo(knob.x, src_f1.y + src_f1.h / 2 + 10);
    ctx.lineTo(src_f1.x, src_f1.y + src_f1.h / 2 + 10);
    ctx.lineTo(src_f1.x, src_f1.y + src_f1.h / 2);
    ctx.stroke();
    ctx.restore();

    // ── Draw 2-DOF Simulink Blocks ───────────────────────────────────────────
    // Source F1(t)
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(src_f1.x - src_f1.w / 2, src_f1.y - src_f1.h / 2, src_f1.w, src_f1.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let s = -16; s <= 16; s += 2) {
      const sy = src_f1.y + 6 + Math.sin(s * 0.25) * 5;
      if (s === -16) ctx.moveTo(src_f1.x + s, sy);
      else ctx.lineTo(src_f1.x + s, sy);
    }
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('F₁(t) Force', src_f1.x, src_f1.y - src_f1.h / 2 + 11);
    ctx.fillStyle = '#64748B';
    ctx.font = '600 8px monospace';
    ctx.fillText(`${F0}N ${waveform}`, src_f1.x, src_f1.y + src_f1.h / 2 + 11);
    ctx.restore();

    // Summing Junction 1 (Σ1)
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(sum1.x, sum1.y, sum1.r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1E293B';
    ctx.font = '700 13px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Σ₁', sum1.x, sum1.y - 1);

    ctx.font = '800 10.5px monospace';
    ctx.fillStyle = '#15803D';
    ctx.fillText('+', sum1.x - sum1.r + 5, sum1.y - 6);
    ctx.fillStyle = '#DC2626';
    ctx.fillText('-', sum1.x - 7, sum1.y + sum1.r - 4);
    ctx.fillText('-', sum1.x + 7, sum1.y + sum1.r - 4);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 8.5px monospace';
    ctx.fillText('Sum 1', sum1.x, sum1.y + sum1.r + 10);
    ctx.restore();

    // Gain 1/m1
    ctx.save();
    ctx.fillStyle = '#EFF6FF';
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(gain_m1.x - gain_m1.w / 2, gain_m1.y - gain_m1.h / 2);
    ctx.lineTo(gain_m1.x + gain_m1.w / 2, gain_m1.y);
    ctx.lineTo(gain_m1.x - gain_m1.w / 2, gain_m1.y + gain_m1.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1E40AF';
    ctx.font = '700 9.5px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1/m₁', gain_m1.x - 4, gain_m1.y);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 8.5px monospace';
    ctx.fillText(`1/${m1.toFixed(1)}kg`, gain_m1.x, gain_m1.y + gain_m1.h / 2 + 10);
    ctx.restore();

    // Integrator 1 (ẍ1 -> ẋ1)
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(int_v1.x - int_v1.w / 2, int_v1.y - int_v1.h / 2, int_v1.w, int_v1.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'italic bold 16px "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1/s', int_v1.x, int_v1.y - 1);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 8.5px system-ui';
    ctx.fillText('Integrator 1 (ẍ₁→ẋ₁)', int_v1.x, int_v1.y + int_v1.h / 2 + 10);
    ctx.restore();

    // Ground Gain c1 (Damper)
    if (c1 > 0) {
      ctx.save();
      ctx.fillStyle = '#FEF3C7';
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(gain_c1.x + gain_c1.w / 2, gain_c1.y - gain_c1.h / 2);
      ctx.lineTo(gain_c1.x - gain_c1.w / 2, gain_c1.y);
      ctx.lineTo(gain_c1.x + gain_c1.w / 2, gain_c1.y + gain_c1.h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#92400E';
      ctx.font = '700 11px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('c₁', gain_c1.x + 3, gain_c1.y);

      ctx.fillStyle = '#64748B';
      ctx.font = '600 8px monospace';
      ctx.fillText(`c₁=${c1.toFixed(1)}`, gain_c1.x, gain_c1.y + gain_c1.h / 2 + 9);
      ctx.restore();
    }

    // Integrator 2 (ẋ1 -> x1)
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(int_x1.x - int_x1.w / 2, int_x1.y - int_x1.h / 2, int_x1.w, int_x1.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'italic bold 16px "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1/s', int_x1.x, int_x1.y - 1);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 8.5px system-ui';
    ctx.fillText('Integrator 2 (ẋ₁→x₁)', int_x1.x, int_x1.y + int_x1.h / 2 + 10);
    ctx.restore();

    // Ground Gain k1 (Spring)
    if (k1 > 0) {
      ctx.save();
      ctx.fillStyle = '#EFF6FF';
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(gain_k1.x + gain_k1.w / 2, gain_k1.y - gain_k1.h / 2);
      ctx.lineTo(gain_k1.x - gain_k1.w / 2, gain_k1.y);
      ctx.lineTo(gain_k1.x + gain_k1.w / 2, gain_k1.y + gain_k1.h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#1E40AF';
      ctx.font = '700 11px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('k₁', gain_k1.x + 3, gain_k1.y);

      ctx.fillStyle = '#64748B';
      ctx.font = '600 8px monospace';
      ctx.fillText(`k₁=${k1.toFixed(0)}`, gain_k1.x, gain_k1.y + gain_k1.h / 2 + 9);
      ctx.restore();
    }

    // ── Inter-Mass Coupling Block c12 ────────────────────────────────────────
    ctx.save();
    ctx.fillStyle = '#FEF3C7';
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(gain_c12.x - gain_c12.w / 2, gain_c12.y - gain_c12.h / 2, gain_c12.w, gain_c12.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#92400E';
    ctx.font = '700 10.5px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('c₁₂', gain_c12.x, gain_c12.y - 2);

    ctx.fillStyle = '#B45309';
    ctx.font = '700 8px monospace';
    ctx.fillText(`c=${c12.toFixed(1)} N·s/m`, gain_c12.x, gain_c12.y + gain_c12.h / 2 + 9);
    ctx.restore();

    // Inter-Mass Coupling Block k12 (if present)
    if (k12 > 0) {
      ctx.save();
      ctx.fillStyle = '#EFF6FF';
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(gain_k12.x - gain_k12.w / 2, gain_k12.y - gain_k12.h / 2, gain_k12.w, gain_k12.h, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#1E40AF';
      ctx.font = '700 10.5px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('k₁₂', gain_k12.x, gain_k12.y - 2);

      ctx.fillStyle = '#1D4ED8';
      ctx.font = '700 8px monospace';
      ctx.fillText(`k=${k12.toFixed(0)} N/m`, gain_k12.x, gain_k12.y + gain_k12.h / 2 + 9);
      ctx.restore();
    }

    // ── Lane 2 Blocks (Mass 2) ───────────────────────────────────────────────
    // Summing Junction 2 (Σ2)
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(sum2.x, sum2.y, sum2.r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1E293B';
    ctx.font = '700 13px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Σ₂', sum2.x, sum2.y - 1);

    ctx.font = '800 10.5px monospace';
    ctx.fillStyle = '#15803D';
    ctx.fillText('+', sum2.x - 7, sum2.y - sum2.r + 7);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 8.5px monospace';
    ctx.fillText('Sum 2', sum2.x, sum2.y + sum2.r + 10);
    ctx.restore();

    // Gain 1/m2
    ctx.save();
    ctx.fillStyle = '#EFF6FF';
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(gain_m2.x - gain_m2.w / 2, gain_m2.y - gain_m2.h / 2);
    ctx.lineTo(gain_m2.x + gain_m2.w / 2, gain_m2.y);
    ctx.lineTo(gain_m2.x - gain_m2.w / 2, gain_m2.y + gain_m2.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1E40AF';
    ctx.font = '700 9.5px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1/m₂', gain_m2.x - 4, gain_m2.y);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 8.5px monospace';
    ctx.fillText(`1/${m2.toFixed(1)}kg`, gain_m2.x, gain_m2.y + gain_m2.h / 2 + 10);
    ctx.restore();

    // Integrator 3 (ẍ2 -> ẋ2)
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(int_v2.x - int_v2.w / 2, int_v2.y - int_v2.h / 2, int_v2.w, int_v2.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'italic bold 16px "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1/s', int_v2.x, int_v2.y - 1);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 8.5px system-ui';
    ctx.fillText('Integrator 3 (ẍ₂→ẋ₂)', int_v2.x, int_v2.y + int_v2.h / 2 + 10);
    ctx.restore();

    // Integrator 4 (ẋ2 -> x2)
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(int_x2.x - int_x2.w / 2, int_x2.y - int_x2.h / 2, int_x2.w, int_x2.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'italic bold 16px "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1/s', int_x2.x, int_x2.y - 1);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 8.5px system-ui';
    ctx.fillText('Integrator 4 (ẋ₂→x₂)', int_x2.x, int_x2.y + int_x2.h / 2 + 10);
    ctx.restore();

    // Mux Block
    ctx.save();
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(mux.x - mux.w / 2, mux.y - mux.h / 2, mux.w, mux.h);
    ctx.fillStyle = '#64748B';
    ctx.font = '700 8.5px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Mux [x₁, x₂]', mux.x, mux.y - mux.h / 2 - 6);
    ctx.restore();

    // ── Dual-Trace Scope Block ───────────────────────────────────────────────
    ctx.save();
    const isScopeSelected = selectedId === 'scope';
    ctx.fillStyle = isScopeSelected ? '#F0F9FF' : '#E2E8F0';
    ctx.strokeStyle = isScopeSelected ? '#0284C7' : '#475569';
    ctx.lineWidth = isScopeSelected ? 2.8 : 2.0;
    if (isScopeSelected) {
      ctx.shadowColor = 'rgba(2, 132, 199, 0.45)';
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.roundRect(scope.x - scope.w / 2, scope.y - scope.h / 2, scope.w, scope.h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.shadowColor = 'transparent';

    const scW = scope.w - 14;
    const scH = scope.h - 18;
    ctx.fillStyle = '#090D16';
    ctx.fillRect(scope.x - scW / 2, scope.y - scH / 2 - 2, scW, scH);

    // Oscilloscope grid lines
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(scope.x - scW / 2, scope.y - 2);
    ctx.lineTo(scope.x + scW / 2, scope.y - 2);
    ctx.moveTo(scope.x, scope.y - scH / 2 - 2);
    ctx.lineTo(scope.x, scope.y + scH / 2 - 2);
    ctx.stroke();

    // Dynamic scope traces:
    const nPoints = 32;
    const startIdx = Math.max(0, stepIdx - nPoints);

    // Trace 1: Mass 1 Displacement x1 (Phosphor Green #22C55E)
    if (simData?.x && simData.x[0]) {
      const trace1 = simData.x[0];
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i <= nPoints; i++) {
        const idx = startIdx + i;
        if (idx >= trace1.length) break;
        const sx = (scope.x - scW / 2 + 2) + (i / nPoints) * (scW - 4);
        const val = trace1[idx];
        const sy = (scope.y - 2) - Math.max(-scH/2 + 3, Math.min(scH/2 - 3, val * 160));
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Trace 2: Mass 2 Displacement x2 (Phosphor Cyan #06B6D4)
    if (simData?.x && simData.x[1]) {
      const trace2 = simData.x[1];
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i <= nPoints; i++) {
        const idx = startIdx + i;
        if (idx >= trace2.length) break;
        const sx = (scope.x - scW / 2 + 2) + (i / nPoints) * (scW - 4);
        const val = trace2[idx];
        const sy = (scope.y - 2) - Math.max(-scH/2 + 3, Math.min(scH/2 - 3, val * 160));
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // LED indicator
    ctx.fillStyle = isPlaying ? '#22C55E' : '#EF4444';
    ctx.beginPath();
    ctx.arc(scope.x + scope.w / 2 - 8, scope.y - scope.h / 2 + 7, 2.5, 0, 2 * Math.PI);
    ctx.fill();

    // Legend pills
    ctx.fillStyle = '#22C55E';
    ctx.beginPath(); ctx.arc(scope.x - 22, scope.y + scope.h/2 + 10, 3, 0, 2*Math.PI); ctx.fill();
    ctx.fillStyle = '#64748B';
    ctx.font = '700 8px system-ui';
    ctx.fillText('x₁', scope.x - 13, scope.y + scope.h/2 + 10);

    ctx.fillStyle = '#06B6D4';
    ctx.beginPath(); ctx.arc(scope.x + 8, scope.y + scope.h/2 + 10, 3, 0, 2*Math.PI); ctx.fill();
    ctx.fillStyle = '#64748B';
    ctx.fillText('x₂', scope.x + 17, scope.y + scope.h/2 + 10);

    ctx.fillStyle = isScopeSelected ? '#0284C7' : '#475569';
    ctx.font = '700 8.5px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Scope [x₁, x₂] 🔍', scope.x, scope.y + scope.h / 2 + 22);

    ctx.fillStyle = '#0284C7';
    ctx.font = '600 7.5px monospace';
    ctx.fillText('Click to Open', scope.x, scope.y + scope.h / 2 + 32);
    ctx.restore();

    // Rotary Knob
    ctx.save();
    ctx.translate(knob.x, knob.y);

    ctx.fillStyle = '#E2E8F0';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, knob.r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.2;
    for (let a = 0; a < 2 * Math.PI; a += Math.PI / 6) {
      const x1 = Math.cos(a) * (knob.r - 6);
      const y1 = Math.sin(a) * (knob.r - 6);
      const x2 = Math.cos(a) * (knob.r - 2);
      const y2 = Math.sin(a) * (knob.r - 2);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, knob.r - 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    const needleAngle = (F0 / 30) * (1.5 * Math.PI) - (0.75 * Math.PI);
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(needleAngle) * (knob.r - 12), Math.sin(needleAngle) * (knob.r - 12));
    ctx.stroke();

    ctx.fillStyle = '#DC2626';
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 2 * Math.PI); ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Set Point: Force', 0, -knob.r - 6);

    ctx.fillStyle = '#DC2626';
    ctx.font = '700 9.5px monospace';
    ctx.fillText(`${F0.toFixed(1)} N`, 0, knob.r + 14);
    ctx.restore();

    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE B: 1-DOF SINGLE MASS-SPRING-DAMPER SIMULINK MODEL
  // ═══════════════════════════════════════════════════════════════════════════
  const massNodes = nodes.filter(n => n.type === 'mass');
  const primaryMass = massNodes.sort((a,b)=>(Number(b.mass)||0)-(Number(a.mass)||0))[0] || { mass: 2.0 };
  const m = Number(primaryMass.mass) || 2.0;
  const k = Number(classroomSolution?.k_eq) || 150.0;
  const c = Number(classroomSolution?.c_eq) || 2.0;

  const x_val = (simData?.x?.[0]?.[stepIdx]) ?? 0;
  const v_val = (simData?.v?.[0]?.[stepIdx]) ?? 0;
  const Fd_val = c * v_val;
  const Fs_val = k * x_val;
  const sumF_val = F_val - Fd_val - Fs_val;
  const a_val = sumF_val / m;

  const def1 = getDefaultSimulinkBlocks(1);
  const src_f = blocks.src_f || def1.src_f;
  const sum = blocks.sum || def1.sum;
  const gain_m = blocks.gain_m || def1.gain_m;
  const int_v = blocks.int_v || def1.int_v;
  const gain_c = blocks.gain_c || def1.gain_c;
  const int_x = blocks.int_x || def1.int_x;
  const gain_k = blocks.gain_k || def1.gain_k;
  const mux = blocks.mux || def1.mux;
  const scope = blocks.scope || def1.scope;
  const knob = blocks.knob || def1.knob;

  // Wire 1: Force F(t) -> Sum (+)
  drawWire([
    { x: src_f.x + src_f.w / 2, y: src_f.y },
    { x: sum.x - sum.r, y: sum.y }
  ], `F=${F_val.toFixed(1)}N`, '#DC2626');

  // Wire 2: Sum -> Gain 1/m
  drawWire([
    { x: sum.x + sum.r, y: sum.y },
    { x: gain_m.x - gain_m.w / 2, y: gain_m.y }
  ], `ΣF=${sumF_val.toFixed(1)}N`, '#1E293B');

  // Wire 3: Gain 1/m -> Integrator 1 (v)
  drawWire([
    { x: gain_m.x + gain_m.w / 2, y: gain_m.y },
    { x: int_v.x - int_v.w / 2, y: int_v.y }
  ], `ẍ=${a_val.toFixed(2)}`, '#7C3AED');

  // Wire 4: Integrator 1 -> Branch 1 -> Integrator 2
  const bx1 = (int_v.x + int_x.x) / 2;
  drawWire([
    { x: int_v.x + int_v.w / 2, y: int_v.y },
    { x: int_x.x - int_x.w / 2, y: int_x.y }
  ], `ẋ=${v_val.toFixed(2)}`, '#2563EB');

  // Branch dot 1
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(bx1, int_v.y, 3.5, 0, 2 * Math.PI);
  ctx.fill();

  // Wire 5: Branch 1 down -> Gain c (Damper)
  drawWire([
    { x: bx1, y: int_v.y },
    { x: bx1, y: gain_c.y },
    { x: gain_c.x + gain_c.w / 2, y: gain_c.y }
  ]);

  // Wire 6: Gain c -> Sum (-)
  drawWire([
    { x: gain_c.x - gain_c.w / 2, y: gain_c.y },
    { x: sum.x - 5, y: gain_c.y },
    { x: sum.x - 5, y: sum.y + sum.r }
  ], `Fd=${Fd_val.toFixed(1)}N`, '#D97706');

  // Wire 7: Integrator 2 -> Branch 2 -> Mux
  const bx2 = (int_x.x + mux.x) / 2;
  drawWire([
    { x: int_x.x + int_x.w / 2, y: int_x.y },
    { x: mux.x - mux.w / 2, y: mux.y - 12 }
  ], `x=${(x_val * 100).toFixed(1)}cm`, '#059669');

  // Branch dot 2
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(bx2, int_x.y, 3.5, 0, 2 * Math.PI);
  ctx.fill();

  // Wire 8: Branch 2 down -> Gain k (Spring)
  drawWire([
    { x: bx2, y: int_x.y },
    { x: bx2, y: gain_k.y },
    { x: gain_k.x + gain_k.w / 2, y: gain_k.y }
  ]);

  // Wire 9: Gain k -> Sum (-)
  drawWire([
    { x: gain_k.x - gain_k.w / 2, y: gain_k.y },
    { x: sum.x + 5, y: gain_k.y },
    { x: sum.x + 5, y: sum.y + sum.r }
  ], `Fs=${Fs_val.toFixed(1)}N`, '#2563EB');

  // Wire 10: Velocity tap into Mux
  drawWire([
    { x: bx1, y: int_v.y },
    { x: bx1, y: int_v.y - 45 },
    { x: mux.x - mux.w / 2, y: int_v.y - 45 },
    { x: mux.x - mux.w / 2, y: mux.y + 12 }
  ]);

  // Wire 11: Mux -> Scope
  drawWire([
    { x: mux.x + mux.w / 2, y: mux.y },
    { x: scope.x - scope.w / 2, y: scope.y }
  ], 'Signals', '#1E293B');

  // Wire 12: Knob -> Force block dashed link
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = '#94A3B8';
  ctx.beginPath();
  ctx.moveTo(knob.x, knob.y - knob.r);
  ctx.lineTo(knob.x, src_f.y + src_f.h / 2 + 10);
  ctx.lineTo(src_f.x, src_f.y + src_f.h / 2 + 10);
  ctx.lineTo(src_f.x, src_f.y + src_f.h / 2);
  ctx.stroke();
  ctx.restore();

  // Block: Source F(t)
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(src_f.x - src_f.w / 2, src_f.y - src_f.h / 2, src_f.w, src_f.h, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(src_f.x - src_f.w / 2 + 1, src_f.y - src_f.h / 2 + 1, src_f.w - 2, 14);

  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let s = -18; s <= 18; s += 2) {
    const sy = src_f.y + 6 + Math.sin(s * 0.25) * 6;
    if (s === -18) ctx.moveTo(src_f.x + s, sy);
    else ctx.lineTo(src_f.x + s, sy);
  }
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 9.5px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('F(t) Force', src_f.x, src_f.y - src_f.h / 2 + 11);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 8.5px monospace';
  ctx.fillText(`${F0}N ${waveform}`, src_f.x, src_f.y + src_f.h / 2 + 12);
  ctx.restore();

  // Block: Summing Junction
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(sum.x, sum.y, sum.r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1E293B';
  ctx.font = '700 13px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Σ', sum.x, sum.y - 1);

  ctx.font = '800 10.5px monospace';
  ctx.fillStyle = '#15803D';
  ctx.fillText('+', sum.x - sum.r + 5, sum.y - 6);
  ctx.fillStyle = '#DC2626';
  ctx.fillText('-', sum.x - 7, sum.y + sum.r - 4);
  ctx.fillText('-', sum.x + 7, sum.y + sum.r - 4);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 8.5px monospace';
  ctx.fillText('Sum', sum.x, sum.y + sum.r + 10);
  ctx.restore();

  // Block: Gain 1/m
  ctx.save();
  ctx.fillStyle = '#EFF6FF';
  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(gain_m.x - gain_m.w / 2, gain_m.y - gain_m.h / 2);
  ctx.lineTo(gain_m.x + gain_m.w / 2, gain_m.y);
  ctx.lineTo(gain_m.x - gain_m.w / 2, gain_m.y + gain_m.h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1E40AF';
  ctx.font = '700 10px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1/m', gain_m.x - 4, gain_m.y);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 8.5px monospace';
  ctx.fillText(`1/${m.toFixed(1)}kg`, gain_m.x, gain_m.y + gain_m.h / 2 + 10);
  ctx.restore();

  // Block: Integrator 1 (ẍ -> ẋ)
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(int_v.x - int_v.w / 2, int_v.y - int_v.h / 2, int_v.w, int_v.h, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'italic bold 17px "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1/s', int_v.x, int_v.y - 1);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 8.5px system-ui';
  ctx.fillText('Integrator 1 (ẍ→ẋ)', int_v.x, int_v.y + int_v.h / 2 + 10);
  ctx.restore();

  // Block: Feedback Gain c (Damper)
  ctx.save();
  ctx.fillStyle = '#FEF3C7';
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(gain_c.x + gain_c.w / 2, gain_c.y - gain_c.h / 2);
  ctx.lineTo(gain_c.x - gain_c.w / 2, gain_c.y);
  ctx.lineTo(gain_c.x + gain_c.w / 2, gain_c.y + gain_c.h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#92400E';
  ctx.font = '700 11px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('c', gain_c.x + 4, gain_c.y);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 8.5px monospace';
  ctx.fillText(`c=${c} N·s/m`, gain_c.x, gain_c.y + gain_c.h / 2 + 10);
  ctx.restore();

  // Block: Integrator 2 (ẋ -> x)
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(int_x.x - int_x.w / 2, int_x.y - int_x.h / 2, int_x.w, int_x.h, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'italic bold 17px "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1/s', int_x.x, int_x.y - 1);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 8.5px system-ui';
  ctx.fillText('Integrator 2 (ẋ→x)', int_x.x, int_x.y + int_x.h / 2 + 10);
  ctx.restore();

  // Block: Feedback Gain k (Spring)
  ctx.save();
  ctx.fillStyle = '#EFF6FF';
  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(gain_k.x + gain_k.w / 2, gain_k.y - gain_k.h / 2);
  ctx.lineTo(gain_k.x - gain_k.w / 2, gain_k.y);
  ctx.lineTo(gain_k.x + gain_k.w / 2, gain_k.y + gain_k.h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1E40AF';
  ctx.font = '700 11px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('k', gain_k.x + 4, gain_k.y);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 8.5px monospace';
  ctx.fillText(`k=${k} N/m`, gain_k.x, gain_k.y + gain_k.h / 2 + 10);
  ctx.restore();

  // Block: Mux
  ctx.save();
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(mux.x - mux.w / 2, mux.y - mux.h / 2, mux.w, mux.h);

  ctx.fillStyle = '#64748B';
  ctx.font = '700 8.5px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Mux', mux.x, mux.y - mux.h / 2 - 4);
  ctx.restore();

  // Block: Scope
  ctx.save();
  const isScopeSelected = selectedId === 'scope';
  ctx.fillStyle = isScopeSelected ? '#F0F9FF' : '#E2E8F0';
  ctx.strokeStyle = isScopeSelected ? '#0284C7' : '#475569';
  ctx.lineWidth = isScopeSelected ? 2.8 : 2.0;
  if (isScopeSelected) {
    ctx.shadowColor = 'rgba(2, 132, 199, 0.45)';
    ctx.shadowBlur = 10;
  }
  ctx.beginPath();
  ctx.roundRect(scope.x - scope.w / 2, scope.y - scope.h / 2, scope.w, scope.h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';

  const scW = scope.w - 14;
  const scH = scope.h - 18;
  ctx.fillStyle = '#090D16';
  ctx.fillRect(scope.x - scW / 2, scope.y - scH / 2 - 2, scW, scH);

  // Oscilloscope grid lines
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(scope.x - scW / 2, scope.y - 2);
  ctx.lineTo(scope.x + scW / 2, scope.y - 2);
  ctx.moveTo(scope.x, scope.y - scH / 2 - 2);
  ctx.lineTo(scope.x, scope.y + scH / 2 - 2);
  ctx.stroke();

  // Real-time animated scope trace
  if (simData?.x && simData.x[0]) {
    const trace = simData.x[0];
    const nPoints = 32;
    const startIdx = Math.max(0, stepIdx - nPoints);
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= nPoints; i++) {
      const idx = startIdx + i;
      if (idx >= trace.length) break;
      const sx = (scope.x - scW / 2 + 2) + (i / nPoints) * (scW - 4);
      const val = trace[idx];
      const sy = (scope.y - 2) - Math.max(-scH/2 + 3, Math.min(scH/2 - 3, val * 180));
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  // LED indicator
  ctx.fillStyle = isPlaying ? '#22C55E' : '#EF4444';
  ctx.beginPath();
  ctx.arc(scope.x + scope.w / 2 - 8, scope.y - scope.h / 2 + 7, 2.5, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = isScopeSelected ? '#0284C7' : '#475569';
  ctx.font = '700 8.5px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Scope x(t) 🔍', scope.x, scope.y + scope.h / 2 + 10);

  // Interactive hint tag
  ctx.fillStyle = '#0284C7';
  ctx.font = '600 7.5px monospace';
  ctx.fillText('Click to Open', scope.x, scope.y + scope.h / 2 + 20);
  ctx.restore();

  // Rotary Knob / Dial
  ctx.save();
  ctx.translate(knob.x, knob.y);

  ctx.fillStyle = '#E2E8F0';
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, knob.r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  // Tick marks
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.2;
  for (let a = 0; a < 2 * Math.PI; a += Math.PI / 6) {
    const x1 = Math.cos(a) * (knob.r - 6);
    const y1 = Math.sin(a) * (knob.r - 6);
    const x2 = Math.cos(a) * (knob.r - 2);
    const y2 = Math.sin(a) * (knob.r - 2);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  // Knob face
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, knob.r - 10, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  // Needle pointer
  const needleAngle = (F0 / 30) * (1.5 * Math.PI) - (0.75 * Math.PI);
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(needleAngle) * (knob.r - 12), Math.sin(needleAngle) * (knob.r - 12));
  ctx.stroke();

  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 9px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Set Point: Force', 0, -knob.r - 6);

  ctx.fillStyle = '#DC2626';
  ctx.font = '700 9.5px monospace';
  ctx.fillText(`${F0.toFixed(1)} N`, 0, knob.r + 14);
  ctx.restore();
}

// ── Paper Solution Sheet Canvas Generator ("How it looks on paper") ───────────

function generatePaperSolutionImage(nodes, edges, classroomSolution) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1680;
  const ctx = canvas.getContext('2d');

  // 1. Paper Background: warm ivory notebook tone
  ctx.fillStyle = '#FAF8F5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Light blue horizontal ruled lines (like engineering calculation sheet)
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  for (let y = 100; y < canvas.height - 40; y += 32) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(canvas.width - 40, y);
    ctx.stroke();
  }

  // 3. Left red margin rule
  ctx.strokeStyle = '#FCA5A5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(110, 40);
  ctx.lineTo(110, canvas.height - 40);
  ctx.stroke();

  // 4. Header Bar
  ctx.fillStyle = '#1E3A8A';
  ctx.font = 'bold 24px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ENGINEERING MECHANICS & VIBRATIONS — PROBLEM SOLUTION', 130, 75);

  ctx.fillStyle = '#475569';
  ctx.font = '13.5px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(`Topic: Lumped SDOF Spring-Mass-Damper Network  |  Regime: ${classroomSolution.regimeName || 'Underdamped'}`, 130, 98);

  ctx.strokeStyle = '#1E3A8A';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(130, 108);
  ctx.lineTo(canvas.width - 60, 108);
  ctx.stroke();

  // Section 1: Problem Schematic Box ("As Given on Paper")
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 17px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('1. PROBLEM SCHEMATIC & GIVEN VALUES', 130, 140);

  // Diagram card box
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(130, 155, 990, 230, 8);
  ctx.fill();
  ctx.stroke();

  // Draw schematic inside card
  const wallX = 180, wallY = 270;
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(wallX - 16, wallY - 60, 24, 120);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.strokeRect(wallX - 16, wallY - 60, 24, 120);
  // Hatch marks
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.5;
  for (let hy = wallY - 55; hy <= wallY + 55; hy += 14) {
    ctx.beginPath();
    ctx.moveTo(wallX - 16, hy);
    ctx.lineTo(wallX - 28, hy + 10);
    ctx.stroke();
  }

  // Mass block
  const massX = 500, massY = 270;
  const massW = 92, massH = 66;
  ctx.fillStyle = '#EFF6FF';
  ctx.fillRect(massX - massW / 2, massY - massH / 2, massW, massH);
  ctx.strokeStyle = '#1E40AF';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(massX - massW / 2, massY - massH / 2, massW, massH);

  // Mass header
  ctx.fillStyle = '#1E40AF';
  ctx.fillRect(massX - massW / 2, massY - massH / 2, massW, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`m = ${classroomSolution.m.toFixed(2)} kg`, massX, massY - massH / 2 + 15);

  // Rollers under mass
  ctx.fillStyle = '#475569';
  ctx.beginPath(); ctx.arc(massX - 25, massY + massH / 2 + 6, 6, 0, 2 * Math.PI); ctx.fill();
  ctx.beginPath(); ctx.arc(massX + 25, massY + massH / 2 + 6, 6, 0, 2 * Math.PI); ctx.fill();

  // Ground track under rollers
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(massX - 60, massY + massH / 2 + 12);
  ctx.lineTo(massX + 60, massY + massH / 2 + 12);
  ctx.stroke();
  for (let gx = massX - 55; gx <= massX + 55; gx += 12) {
    ctx.beginPath();
    ctx.moveTo(gx, massY + massH / 2 + 12);
    ctx.lineTo(gx - 6, massY + massH / 2 + 18);
    ctx.stroke();
  }

  // Displacement coordinate arrow x(t) ->
  ctx.strokeStyle = '#059669';
  ctx.fillStyle = '#059669';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(massX - 30, massY - massH / 2 - 18);
  ctx.lineTo(massX + 35, massY - massH / 2 - 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(massX + 35, massY - massH / 2 - 18);
  ctx.lineTo(massX + 27, massY - massH / 2 - 23);
  ctx.lineTo(massX + 27, massY - massH / 2 - 13);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('x(t)', massX + 42, massY - massH / 2 - 14);

  // Springs & Dampers connecting wallX+8 to massX - massW/2
  const springs = edges.filter(e => e.type === 'spring');
  const dampers = edges.filter(e => e.type === 'damper');
  const forces = edges.filter(e => e.type === 'force');

  const startPtX = wallX + 8;
  const endPtX = massX - massW / 2;

  if (springs.length === 1 && dampers.length === 1) {
    drawSpring(ctx, startPtX, wallY - 22, endPtX, massY - 22, '#2563EB', `k = ${springs[0].k} N/m`);
    drawDamper(ctx, startPtX, wallY + 22, endPtX, massY + 22, '#D97706', `c = ${dampers[0].c} N·s/m`);
  } else if (springs.length === 2 && dampers.length === 1) {
    drawSpring(ctx, startPtX, wallY - 34, endPtX, massY - 34, '#2563EB', `k₁ = ${springs[0].k} N/m`);
    drawDamper(ctx, startPtX, wallY, endPtX, massY, '#D97706', `c₁ = ${dampers[0].c} N·s/m`);
    drawSpring(ctx, startPtX, wallY + 34, endPtX, massY + 34, '#2563EB', `k₂ = ${springs[1].k} N/m`);
  } else {
    springs.forEach((sp, idx) => {
      const yOffset = -28 + idx * 24;
      drawSpring(ctx, startPtX, wallY + yOffset, endPtX, massY + yOffset, '#2563EB', `k = ${sp.k} N/m`);
    });
    dampers.forEach((dp, idx) => {
      const yOffset = 18 + idx * 24;
      drawDamper(ctx, startPtX, wallY + yOffset, endPtX, massY + yOffset, '#D97706', `c = ${dp.c} N·s/m`);
    });
  }

  // Force arrow if applied
  if (forces.length > 0) {
    const fc = forces[0];
    ctx.strokeStyle = '#DC2626';
    ctx.fillStyle = '#DC2626';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(massX + massW / 2 + 55, massY);
    ctx.lineTo(massX + massW / 2 + 5, massY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(massX + massW / 2 + 5, massY);
    ctx.lineTo(massX + massW / 2 + 15, massY - 6);
    ctx.lineTo(massX + massW / 2 + 15, massY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`F(t) = ${fc.F0} N`, massX + massW / 2 + 15, massY - 10);
  }

  // Given Data on the Right Side of Diagram Card
  const dataX = 640;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 15px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('GIVEN PARAMETERS (From Question):', dataX, 185);

  ctx.fillStyle = '#334155';
  ctx.font = '14px "Segoe UI", Roboto, Arial, sans-serif';
  let dataY = 212;
  const lineH = 24;

  ctx.fillText(`• Mass m = ${classroomSolution.m.toFixed(2)} kg`, dataX, dataY); dataY += lineH;
  springs.forEach((sp, i) => {
    ctx.fillText(`• Spring k${springs.length > 1 ? i + 1 : ''} = ${sp.k} N/m`, dataX, dataY);
    dataY += lineH;
  });
  if (dampers.length === 0) {
    ctx.fillText(`• Damper c = 0 (Undamped System)`, dataX, dataY); dataY += lineH;
  } else {
    dampers.forEach((dp, i) => {
      ctx.fillText(`• Damper c${dampers.length > 1 ? i + 1 : ''} = ${dp.c} N·s/m`, dataX, dataY);
      dataY += lineH;
    });
  }
  const primMass = nodes.find(n => n.type === 'mass');
  const x0Val = Number(primMass?.x0 ?? 0.05);
  const v0Val = Number(primMass?.v0 ?? 0.0);
  ctx.fillText(`• Initial Displacement x(0) = ${x0Val} m`, dataX, dataY); dataY += lineH;
  ctx.fillText(`• Initial Velocity ẋ(0) = ${v0Val} m/s`, dataX, dataY);

  // Section 2: Main Solution Steps (Professor / Exam Style)
  let curY = 415;
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 17px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('2. KEY DERIVATION & SOLUTION STEPS', 130, curY);
  curY += 28;

  const drawStepCard = (stepNum, title, formula, sub, result, note, badgeColor = '#2563EB') => {
    const cardX = 130;
    const cardW = 990;
    const cardH = note ? 120 : 100;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(cardX, curY, cardW, cardH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    ctx.roundRect(cardX + 12, curY + 12, 68, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`STEP ${stepNum}`, cardX + 46, curY + 27);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 15px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, cardX + 90, curY + 28);

    ctx.fillStyle = '#1E3A8A';
    ctx.font = 'bold 14px "Courier New", Courier, monospace';
    ctx.fillText(formula, cardX + 30, curY + 58);

    ctx.fillStyle = '#334155';
    ctx.font = '13.5px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(sub, cardX + 30, curY + 80);

    if (result) {
      ctx.fillStyle = '#F0FDF4';
      ctx.strokeStyle = '#86EFAC';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cardX + cardW - 250, curY + 20, 235, 42, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#166534';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(result, cardX + cardW - 132, curY + 46);
    }

    if (note) {
      ctx.fillStyle = '#64748B';
      ctx.font = 'italic 12px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`💡 ${note}`, cardX + 30, curY + 104);
    }

    curY += cardH + 14;
  };

  // Step 1: Equivalent Spring & Damper
  const kType = classroomSolution.k_eq === (springs[0]?.k || 0) + (springs[1]?.k || 0) ? 'Parallel (k₁ + k₂)' : 'Equivalent Stiffness';
  drawStepCard(
    1,
    `Equivalent System Parameters (${kType})`,
    `k_eq = ${classroomSolution.k_eq.toFixed(2)} N/m    |    c_eq = ${classroomSolution.c_eq.toFixed(2)} N·s/m`,
    `Summation of stiffness & damping elements across active degrees of freedom.`,
    `k_eq = ${classroomSolution.k_eq.toFixed(1)} N/m`,
    `Total active system mass: m = ${classroomSolution.m.toFixed(2)} kg.`
  );

  // Step 2: Governing Differential Equation
  drawStepCard(
    2,
    `Differential Equation of Motion (Newton's 2nd Law / D'Alembert)`,
    `m · ẍ(t) + c_eq · ẋ(t) + k_eq · x(t) = F(t)`,
    `Substituting: ${classroomSolution.m.toFixed(2)} ẍ + ${classroomSolution.c_eq.toFixed(2)} ẋ + ${classroomSolution.k_eq.toFixed(2)} x = 0`,
    `mẍ + cẋ + kx = 0`,
    `Homogeneous second-order linear ordinary differential equation.`
  );

  // Step 3: Natural Frequency
  drawStepCard(
    3,
    `Undamped Natural Frequency (ω_n)`,
    `ω_n = √(k_eq / m) = √(${classroomSolution.k_eq.toFixed(2)} / ${classroomSolution.m.toFixed(2)})`,
    `Circular Frequency: ω_n = ${classroomSolution.omega_n.toFixed(3)} rad/s  |  Linear Frequency: f_n = ${(classroomSolution.omega_n / (2 * Math.PI)).toFixed(2)} Hz`,
    `ω_n = ${classroomSolution.omega_n.toFixed(3)} rad/s`,
    `Period of natural oscillation: T_n = ${(2 * Math.PI / classroomSolution.omega_n).toFixed(3)} seconds.`
  );

  // Step 4: Critical Damping & Damping Ratio (Regime)
  const regimeBadge = classroomSolution.zeta < 1.0 ? '#D97706' : '#DC2626';
  drawStepCard(
    4,
    `Critical Damping (c_c), Damping Ratio (ζ) & Vibration Regime`,
    `c_c = 2·√(m · k_eq) = 2·√(${classroomSolution.m.toFixed(2)} × ${classroomSolution.k_eq.toFixed(2)}) = ${(2 * Math.sqrt(classroomSolution.m * classroomSolution.k_eq)).toFixed(2)} N·s/m`,
    `Damping Ratio: ζ = c_eq / c_c = ${classroomSolution.c_eq.toFixed(2)} / ${(2 * Math.sqrt(classroomSolution.m * classroomSolution.k_eq)).toFixed(2)} = ${classroomSolution.zeta.toFixed(4)}`,
    classroomSolution.zeta < 1.0 ? `ζ = ${classroomSolution.zeta.toFixed(3)} < 1.0 (Underdamped)` : classroomSolution.zeta === 1.0 ? `ζ = 1.0 (Critical)` : `ζ = ${classroomSolution.zeta.toFixed(3)} > 1 (Overdamped)`,
    `System Classification: ${classroomSolution.regimeName}.`,
    regimeBadge
  );

  // Step 5: Damped Natural Frequency (if underdamped)
  if (classroomSolution.zeta < 1.0) {
    drawStepCard(
      5,
      `Damped Frequency (ω_d) & Logarithmic Decrement (δ)`,
      `ω_d = ω_n · √(1 - ζ²) = ${classroomSolution.omega_n.toFixed(3)} · √(1 - ${classroomSolution.zeta.toFixed(4)}²)`,
      `Damped Frequency: ω_d = ${classroomSolution.omega_d.toFixed(3)} rad/s  |  Damped Period: T_d = ${(2 * Math.PI / (classroomSolution.omega_d || 1)).toFixed(3)} s`,
      `ω_d = ${classroomSolution.omega_d.toFixed(3)} rad/s`,
      `Logarithmic decrement: δ = 2πζ / √(1-ζ²) = ${(classroomSolution.delta || 0).toFixed(4)}.`
    );
  }

  // Section 3: Final Boxed Answer
  curY += 10;
  ctx.fillStyle = '#065F46';
  ctx.font = 'bold 17px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('3. FINAL CLOSED-FORM EQUATION OF MOTION x(t) [FINAL ANSWER]:', 130, curY);
  curY += 18;

  // Double-bordered highlight solution box
  const boxX = 130, boxW = 990, boxH = 88;
  ctx.fillStyle = '#F0FDF4';
  ctx.fillRect(boxX, curY, boxW, boxH);
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(boxX, curY, boxW, boxH);
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX + 4, curY + 4, boxW - 8, boxH - 8);

  ctx.fillStyle = '#065F46';
  ctx.font = 'bold 18px "Courier New", Courier, monospace';
  ctx.textAlign = 'left';

  let eqStr = classroomSolution.equationOfMotionTex || '';
  eqStr = eqStr
    .replace(/\\left\[/g, '[')
    .replace(/\\right\]/g, ']')
    .replace(/\\cos/g, 'cos')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cdot/g, ' · ')
    .replace(/\\/g, '');

  ctx.fillText(`✓  ${eqStr}`, boxX + 24, curY + 40);

  ctx.fillStyle = '#047857';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`Where t is time in seconds, x(t) in meters. Evaluated with x(0) = ${x0Val} m, v(0) = ${v0Val} m/s.`, boxX + 46, curY + 68);

  // Footer Rule & Watermark
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(130, canvas.height - 48);
  ctx.lineTo(canvas.width - 60, canvas.height - 48);
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = '11.5px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`MechSim Pro — ARCHE Workstation Analytical Solver  |  Standard Paper Calculation Sheet`, 130, canvas.height - 30);
  ctx.textAlign = 'right';
  ctx.fillText(`Exported on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, canvas.width - 60, canvas.height - 30);

  return canvas;
}
