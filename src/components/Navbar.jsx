import React from 'react';

export const Navbar = ({
  simType,
  simulations,
  activePanel,
  onTogglePanel,
  viewMode,
  onViewModeChange,
  loading,
  simData,
  backendOnline = true,
  onRunSimulation,
  onResetSimulation
}) => {
  const currentSim = simulations[simType] || simulations.simple_pendulum;

  return (
    <header className="kyntrix-navbar">
      {/* ── Brand ── */}
      <div className="navbar-brand">
        <div className="brand-icon brand-icon-arche">
          <img src="/arche-logo.png" alt="ARCHE Logo" className="navbar-arche-logo" />
        </div>
        <div className="brand-text">
          <div className="brand-title">ARCHE</div>
          <span className="brand-badge">WORKSTATION</span>
        </div>
      </div>

      {/* ── Center 4 Contextual Navigation Items ── */}
      <nav className="navbar-nav" aria-label="Main Navigation">
        {/* 1. Mechanism selector */}
        <button
          type="button"
          className={`nav-item ${activePanel === 'mechanism' ? 'active' : ''}`}
          onClick={() => onTogglePanel('mechanism')}
          aria-expanded={activePanel === 'mechanism'}
          title="Select Mechanism Module"
        >
          <span className="nav-item-icon">{currentSim.icon}</span>
          <span className="nav-item-label">{currentSim.label}</span>
          <svg className="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {/* 2. Controls */}
        <button
          type="button"
          className={`nav-item ${activePanel === 'controls' ? 'active' : ''}`}
          onClick={() => onTogglePanel('controls')}
          aria-expanded={activePanel === 'controls'}
          title="Adjust Simulation Parameters"
        >
          <svg className="nav-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
          <span className="nav-item-label">Controls</span>
        </button>

        {/* 3. Analysis */}
        <button
          type="button"
          className={`nav-item ${activePanel === 'analysis' ? 'active' : ''}`}
          onClick={() => onTogglePanel('analysis')}
          aria-expanded={activePanel === 'analysis'}
          title="Motion Plots, Validation & Optimization"
        >
          <svg className="nav-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span className="nav-item-label">Analysis</span>
          {simData && <span className="nav-badge-dot" title="Data available"></span>}
        </button>

        {/* 4. Learn */}
        <button
          type="button"
          className={`nav-item ${activePanel === 'learn' ? 'active' : ''}`}
          onClick={() => onTogglePanel('learn')}
          aria-expanded={activePanel === 'learn'}
          title="Theory, Free Body Diagrams & AI Tutor"
        >
          <svg className="nav-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span className="nav-item-label">Learn</span>
        </button>

        {/* 5. SMD Vibration Network Modeler */}
        <button
          type="button"
          className={`nav-item ${activePanel === 'smd' ? 'active' : ''}`}
          onClick={() => onTogglePanel('smd')}
          aria-expanded={activePanel === 'smd'}
          title="Simulink-Style Multi-DOF Vibration Modeler"
        >
          <span className="nav-item-icon" style={{ fontSize: '14px', lineHeight: 1 }}>⚡</span>
          <span className="nav-item-label">SMD Modeler</span>
        </button>
      </nav>

      {/* ── Right Actions ── */}
      <div className="navbar-actions">
        {/* 2D / 3D Toggle */}
        <div className="mode-toggle-group" role="group" aria-label="Viewport Mode">
          <button
            type="button"
            className={`mode-toggle-btn ${viewMode === '2d' ? 'active' : ''}`}
            onClick={() => onViewModeChange('2d')}
          >
            2D
          </button>
          <button
            type="button"
            className={`mode-toggle-btn ${viewMode === '3d' ? 'active' : ''}`}
            onClick={() => onViewModeChange('3d')}
          >
            3D
          </button>
        </div>

        {/* Backend API Health Indicator */}
        <div
          className={`backend-status-pill ${backendOnline ? 'online' : 'offline'}`}
          title={backendOnline ? 'Flask Python API connected (same-origin proxy active)' : 'Flask API offline: running in client-side kinematics mode'}
        >
          <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`}></span>
          <span>{backendOnline ? 'API Active' : 'Client Mode'}</span>
        </div>

        {/* Status Indicator */}
        <div className="status-pill">
          <span className={`status-indicator ${loading ? 'loading' : simData ? 'ready' : 'idle'}`}></span>
          <span className="status-text">
            {loading ? 'Computing RK45...' : simData ? 'Ready' : 'Idle'}
          </span>
        </div>

        {/* Reset */}
        <button
          type="button"
          className="btn-action-ghost"
          onClick={onResetSimulation}
          title="Reset Simulation Frame"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          <span>Reset</span>
        </button>

        {/* Run Simulation */}
        <button
          type="button"
          className="btn-action-primary"
          onClick={() => onRunSimulation()}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-inline"></span>
              <span>Computing...</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Run Simulation</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
