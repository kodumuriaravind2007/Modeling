import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Scene3D } from '../Scene3D';

export const SimulationViewport = ({
  simType,
  simulations,
  params,
  paramsRef,
  simData,
  animIdx,
  viewMode,
  canvasRef,
  loading,
  isPlaying,
  animSpeed = 1.0,
  onRunSimulation,
  onOpenControls,
  _onUpdateParams,
  onBobDragMove,
  onBobDragRelease,
  onPause,
  isModalOpen = false
}) => {
  const cfg = simulations[simType] || simulations.simple_pendulum;

  // 2D Direct Bob Manipulation State
  const [isDraggingBob, setIsDraggingBob] = useState(false);
  const [dragAngle, setDragAngle] = useState(params?.theta0 ?? 30);
  const [isHoveringBob, setIsHoveringBob] = useState(false);
  const containerRef = useRef(null);

  // Synchronize dragAngle with external theta0 updates when not actively dragging
  useEffect(() => {
    if (!isDraggingBob && params?.theta0 !== undefined) {
      setDragAngle(params.theta0);
    }
  }, [params?.theta0, isDraggingBob]);

  // Compute live geometry coordinates of the 2D bob
  const getBobCoords = useCallback(() => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
    const w = canvas.offsetWidth || 800;
    const h = canvas.offsetHeight || 600;

    const liveParams = paramsRef?.current || params;
    const lengthVal = Number(liveParams?.length) || 1.0;
    const massVal = Number(liveParams?.mass) || 1.0;

    const pivotX = w / 2;
    const pivotY = h * 0.16;

    const minL = h * 0.22;
    const maxL = h * 0.65;
    const normL = Math.max(0, Math.min(1, (lengthVal - 0.2) / (5.0 - 0.2)));
    const L = minL + normL * (maxL - minL);

    const bobRadius = 14 + Math.cbrt(massVal / 1.0) * 8;

    let currentAngleDeg;
    if (isDraggingBob) {
      currentAngleDeg = dragAngle;
    } else if (animIdx === 0 && (liveParams?.theta0 !== undefined || params?.theta0 !== undefined)) {
      currentAngleDeg = liveParams?.theta0 ?? params?.theta0;
    } else {
      currentAngleDeg = simData?.theta_deg?.[animIdx] ?? liveParams?.theta0 ?? params?.theta0 ?? 30;
    }

    const thetaRad = (currentAngleDeg * Math.PI) / 180;
    const bobX = pivotX + L * Math.sin(thetaRad);
    const bobY = pivotY + L * Math.cos(thetaRad);

    return { pivotX, pivotY, L, bobRadius, bobX, bobY, w, h, currentAngleDeg, lengthVal, massVal };
  }, [params, paramsRef, animIdx, simData, isDraggingBob, dragAngle, canvasRef]);

  // Pointer event handlers for direct bob drag
  const handlePointerDown = (e) => {
    if (simType !== 'simple_pendulum' && simType !== 'compound_pendulum') return;
    const coords = getBobCoords();
    if (!coords || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const dist = Math.hypot(px - coords.bobX, py - coords.bobY);
    if (dist <= coords.bobRadius + 24) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDraggingBob(true);
      if (onPause && isPlaying) onPause();

      // Initial angle calculation
      const dx = px - coords.pivotX;
      const dy = py - coords.pivotY;
      let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
      deg = Math.max(-170, Math.min(170, Math.round(deg * 10) / 10));
      setDragAngle(deg);
      if (onBobDragMove) onBobDragMove(deg);
    }
  };

  const handlePointerMove = (e) => {
    if (simType !== 'simple_pendulum' && simType !== 'compound_pendulum') return;
    const coords = getBobCoords();
    if (!coords || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (isDraggingBob) {
      const dx = px - coords.pivotX;
      const dy = py - coords.pivotY;
      let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
      deg = Math.max(-170, Math.min(170, Math.round(deg * 10) / 10));
      setDragAngle(deg);
      if (onBobDragMove) onBobDragMove(deg);
    } else {
      const dist = Math.hypot(px - coords.bobX, py - coords.bobY);
      const isNear = dist <= coords.bobRadius + 24;
      setIsHoveringBob(isNear);
      canvasRef.current.style.cursor = isNear ? 'grab' : 'default';
    }
  };

  const handlePointerUp = (e) => {
    if (!isDraggingBob) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDraggingBob(false);
    if (onBobDragRelease) {
      onBobDragRelease(dragAngle);
    }
  };

  return (
    <main
      className="simulation-viewport"
      aria-label="Simulation Workspace"
      ref={containerRef}
      style={isModalOpen ? { pointerEvents: 'none', userSelect: 'none' } : undefined}
    >
      <div className="canvas-container" style={{ display: viewMode === '2d' ? 'block' : 'none', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          className="simulation-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            touchAction: 'none',
            cursor: isDraggingBob ? 'grabbing' : isHoveringBob ? 'grab' : 'default'
          }}
        />

        {/* Non-intrusive Live Status Pills */}
        {loading && (
          <div className="viewport-status-pill" role="status">
            <span className="spinner-inline"></span>
            <span>Computing RK45 integration...</span>
          </div>
        )}

        {!simData && !loading && (
          <div className="viewport-status-pill idle">
            <span className="unsimulated-dot"></span>
            <span>{cfg.label} initialized at resting state. Click <strong>Run Simulation</strong> or drag bob</span>
            {onOpenControls && (
              <button
                type="button"
                className="btn-pill-action"
                onClick={onOpenControls}
                style={{ marginLeft: '8px', background: 'none', border: 'none', color: 'var(--kx-blue-primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Configure
              </button>
            )}
          </div>
        )}
      </div>

      {viewMode === '3d' && (
        <div className="scene3d-container">
          <Scene3D
            simType={simType}
            params={params}
            paramsRef={paramsRef}
            simData={simData}
            animIdx={animIdx}
            isPlaying={isPlaying}
            animSpeed={animSpeed}
            onPause={onPause}
            onBobDragMove={onBobDragMove}
            onBobDragRelease={onBobDragRelease}
            isModalOpen={isModalOpen}
          />
          {!simData && (
            <div className="viewport-unsimulated-banner">
              <span className="unsimulated-dot"></span>
              <span>{cfg.label} initial state loaded in 3D. Click <strong>Run Simulation</strong> to compute dynamics.</span>
              <button
                type="button"
                className="btn-banner-run"
                onClick={() => onRunSimulation()}
                disabled={loading}
              >
                {loading ? 'Computing...' : 'Run Simulation ▶'}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
};

