import React, { useEffect, useRef } from 'react';

const MECHANISMS = [
  {
    id: 'simple_pendulum',
    name: 'Simple Pendulum',
    icon: '🔵',
    category: '1-DOF Oscillatory System',
    description: 'Study angular motion, displacement, velocity, and acceleration under gravitational restoring torque and viscous damping.',
    features: ['Non-linear RK45 Dynamics', 'Large Angle Elliptic Integrals', 'Phase Space Portrait'],
    badge: 'Oscillation & Resonance'
  },
  {
    id: 'compound_pendulum',
    name: 'Compound Pendulum',
    icon: '🟣',
    category: 'Rigid Body Oscillations',
    description: 'Analyze rigid-body oscillatory motion considering distributed mass, radius of gyration, and center of percussion.',
    features: ['Parallel Axis Theorem', 'Effective Pendulum Length', 'Damped Oscillations'],
    badge: 'Rigid Body Dynamics'
  },
  {
    id: 'slider_crank',
    name: 'Slider-Crank Mechanism',
    icon: '⚙️',
    category: 'Kinematic Inversion',
    description: 'Study rotary-to-linear motion conversion fundamental to internal combustion engines, pumps, and compressors.',
    features: ['Exact Kinematic Tracing', 'Slider Velocity & Acceleration', 'Obliquity Ratio (λ)'],
    badge: 'Engine Kinematics'
  },
  {
    id: 'four_bar',
    name: 'Four-Bar Mechanism',
    icon: '🔷',
    category: 'Planar Linkage System',
    description: 'Analyze planar 1-DOF linkage motion, rocker angular limits, coupler curves, transmission angles, and Grashof criteria.',
    features: ['Freudenstein Equation Solver', 'Grashof Class Verification', 'Coupler Path Generation'],
    badge: 'Linkage Synthesis'
  },
  {
    id: 'smd',
    name: 'Spring-Mass-Damper Network',
    icon: '⚡',
    category: 'Lumped Multi-DOF Vibration',
    description: 'Simulink-style multi-DOF vibration modeler with matrix assembly, modal analysis, Bode frequency response, and RK4 transient integration.',
    features: ['[M], [C], [K] Matrix Assembly', 'Modal Frequencies & Mode Shapes', 'Bode Magnitude & Phase FRF', 'Transient RK4 Time Integrator'],
    badge: 'Simulink Network'
  }
];

export const MechanismModal = ({ isOpen, activeSim, onSelect, onClose }) => {
  const backdropMouseDownRef = useRef(false);

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
      aria-labelledby="mech-modal-title"
    >
      <div
        className="mechanism-modal-dialog"
        onMouseDown={(e) => {
          backdropMouseDownRef.current = false;
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2 id="mech-modal-title" className="modal-title">Select Mechanism</h2>
            <p className="modal-subtitle">Choose a dynamic system or planar mechanism to simulate and analyze</p>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Mechanism Cards Grid */}
        <div className="mechanism-grid">
          {MECHANISMS.map((m) => {
            const isSelected = activeSim === m.id;
            return (
              <div
                key={m.id}
                className={`mechanism-card ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  if (m.id === 'smd') {
                    onSelect('smd');
                  } else {
                    onSelect(m.id);
                    onClose();
                  }
                }}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if (m.id === 'smd') {
                      onSelect('smd');
                    } else {
                      onSelect(m.id);
                      onClose();
                    }
                  }
                }}
              >
                <div className="mechanism-card-top">
                  <div className="mechanism-icon-box">{m.icon}</div>
                  <span className="mechanism-badge">{m.badge}</span>
                </div>

                <div className="mechanism-card-content">
                  <div className="mechanism-category">{m.category}</div>
                  <h3 className="mechanism-name">{m.name}</h3>
                  <p className="mechanism-desc">{m.description}</p>
                </div>

                <div className="mechanism-features">
                  {m.features.map((feat, idx) => (
                    <span key={idx} className="mechanism-feature-tag">
                      ✓ {feat}
                    </span>
                  ))}
                </div>

                <div className="mechanism-card-action">
                  {isSelected ? (
                    <span className="mechanism-active-indicator">
                      <span className="active-dot"></span> Active Simulation
                    </span>
                  ) : (
                    <span className="mechanism-select-prompt">Select & Simulate →</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
