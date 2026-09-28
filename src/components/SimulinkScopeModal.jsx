import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

/**
 * SimulinkScopeModal
 * Full-fidelity interactive Tektronix / Keysight / MathWorks Simulink Oscilloscope viewer.
 * Supports both Single-DOF (x, v, F) and 2-DOF / Multi-DOF (x1, x2, v1, v2, F) real-time waveforms.
 */
export const SimulinkScopeModal = ({
  isOpen,
  onClose,
  simData,
  edges = [],
  classroomSolution = {},
  modalData = null,
  system = null,
  isPlaying = true,
  onTogglePlay,
  onReset,
  simTime = 0,
  onSeek
}) => {
  const canvasRef = useRef(null);

  const numMasses = simData?.x?.length || 1;
  const is2DOF = numMasses >= 2;

  // Channel toggles
  const [channels, setChannels] = useState({
    x1: true,
    x2: true,
    v1: false,
    v2: false,
    F: true
  });

  const [timeSpan, setTimeSpan] = useState(8.0); // 2.0, 4.0, 8.0
  const [hoverTime, setHoverTime] = useState(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Force edge extraction
  const forceEdge = useMemo(() => edges.find(e => e.type === 'force'), [edges]);
  const F0 = forceEdge ? (Number(forceEdge.F0) || 0) : 0;
  const freq = forceEdge ? (Number(forceEdge.freq) || 5.0) : 5.0;
  const waveform = forceEdge ? (forceEdge.waveform || 'sine') : 'none';

  // Compute maximum peak values for scaling & telemetry
  const x1Trace = simData?.x?.[0] || [];
  const x2Trace = is2DOF ? (simData?.x?.[1] || []) : [];
  const v1Trace = simData?.v?.[0] || [];
  const v2Trace = is2DOF ? (simData?.v?.[1] || []) : [];
  const timeArr = simData?.time || [];
  const nSteps = timeArr.length || 1;
  const dt = nSteps > 1 ? (timeArr[1] - timeArr[0]) : 0.005;

  const maxDispAbs = useMemo(() => {
    let m = 0.001;
    for (let i = 0; i < x1Trace.length; i++) {
      const a = Math.abs(x1Trace[i]);
      if (a > m) m = a;
    }
    if (is2DOF) {
      for (let i = 0; i < x2Trace.length; i++) {
        const a = Math.abs(x2Trace[i]);
        if (a > m) m = a;
      }
    }
    return m;
  }, [x1Trace, x2Trace, is2DOF]);

  const maxVelAbs = useMemo(() => {
    let m = 0.01;
    for (let i = 0; i < v1Trace.length; i++) {
      const a = Math.abs(v1Trace[i]);
      if (a > m) m = a;
    }
    if (is2DOF) {
      for (let i = 0; i < v2Trace.length; i++) {
        const a = Math.abs(v2Trace[i]);
        if (a > m) m = a;
      }
    }
    return m;
  }, [v1Trace, v2Trace, is2DOF]);

  // Current values at simTime
  const curStepIdx = Math.max(0, Math.min(nSteps - 1, Math.round(simTime / dt)));
  const curX1 = x1Trace[curStepIdx] || 0;
  const curX2 = is2DOF ? (x2Trace[curStepIdx] || 0) : 0;
  const curV1 = v1Trace[curStepIdx] || 0;
  const curV2 = is2DOF ? (v2Trace[curStepIdx] || 0) : 0;
  let curF = 0;
  if (forceEdge) {
    if (waveform === 'sine') curF = F0 * Math.sin(freq * simTime);
    else if (waveform === 'step') curF = F0;
    else if (waveform === 'impulse') curF = simTime < 0.1 ? F0 * 10 : 0;
  }

  // Value at hover cursor (if hovered)
  const hoverStepIdx = hoverTime !== null ? Math.max(0, Math.min(nSteps - 1, Math.round(hoverTime / dt))) : null;
  const hoverX1 = hoverStepIdx !== null ? (x1Trace[hoverStepIdx] || 0) : null;
  const hoverX2 = (hoverStepIdx !== null && is2DOF) ? (x2Trace[hoverStepIdx] || 0) : null;
  const hoverV1 = hoverStepIdx !== null ? (v1Trace[hoverStepIdx] || 0) : null;
  const hoverV2 = (hoverStepIdx !== null && is2DOF) ? (v2Trace[hoverStepIdx] || 0) : null;
  let hoverF = null;
  if (hoverTime !== null && forceEdge) {
    if (waveform === 'sine') hoverF = F0 * Math.sin(freq * hoverTime);
    else if (waveform === 'step') hoverF = F0;
    else if (waveform === 'impulse') hoverF = hoverTime < 0.1 ? F0 * 10 : 0;
  }

  // ── Render High-Resolution Oscilloscope Screen ────────────────────────────
  const drawScope = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth || 860;
    const h = canvas.offsetHeight || 380;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. CRT Screen Background with Bezel Vignette
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h));
    bgGrad.addColorStop(0, '#0A1124');
    bgGrad.addColorStop(1, '#040711');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Plot Dimensions (Margins for Axes & Labels)
    const padL = 68;
    const padR = 24;
    const padT = 32;
    const padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const midY = padT + plotH / 2;

    // 3. Phosphor Oscilloscope Grid
    ctx.save();
    ctx.strokeStyle = '#111C38';
    ctx.lineWidth = 0.8;
    const nGridX = 8;
    for (let i = 1; i < nGridX; i++) {
      const gx = padL + (i / nGridX) * plotW;
      ctx.beginPath(); ctx.moveTo(gx, padT); ctx.lineTo(gx, padT + plotH); ctx.stroke();
    }
    const nGridY = 6;
    for (let j = 1; j < nGridY; j++) {
      const gy = padT + (j / nGridY) * plotH;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + plotW, gy); ctx.stroke();
    }

    // Major Zero-Line Axis
    ctx.strokeStyle = '#2A4374';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, midY);
    ctx.lineTo(padL + plotW, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Outer CRT Plot Border
    ctx.strokeStyle = '#1E3A8A';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padL, padT, plotW, plotH);

    // Grid labels (Time Axis)
    ctx.fillStyle = '#64748B';
    ctx.font = '600 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= nGridX; i++) {
      const tVal = (i / nGridX) * timeSpan;
      const gx = padL + (i / nGridX) * plotW;
      ctx.fillText(`${tVal.toFixed(1)}s`, gx, padT + plotH + 8);
    }

    // Amplitude Axis Labels (Displacement cm)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const dispScaleMax = Math.max(0.02, Math.ceil(maxDispAbs * 120) / 100); // meters
    ctx.fillStyle = '#10B981';
    ctx.fillText(`+${(dispScaleMax * 100).toFixed(1)}cm`, padL - 8, padT);
    ctx.fillText(`0.0cm`, padL - 8, midY);
    ctx.fillText(`-${(dispScaleMax * 100).toFixed(1)}cm`, padL - 8, padT + plotH);
    ctx.restore();

    // 4. Waveform Traces
    const maxVisibleTime = timeSpan;
    const maxIndex = Math.min(nSteps, Math.ceil(maxVisibleTime / dt) + 1);

    // Channel 5: Input Force F(t) (Amber dashed trace)
    if (channels.F && forceEdge && F0 > 0) {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i < maxIndex; i++) {
        const ti = i * dt;
        let fi = 0;
        if (waveform === 'sine') fi = F0 * Math.sin(freq * ti);
        else if (waveform === 'step') fi = F0;
        else if (waveform === 'impulse') fi = ti < 0.1 ? F0 * 10 : 0;

        const px = padL + (ti / maxVisibleTime) * plotW;
        const normF = F0 > 0 ? (fi / (F0 * 1.5)) : 0;
        const py = midY - normF * (plotH * 0.4);

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Channel 3: Velocity v1(t) (Violet trace)
    if (channels.v1 && v1Trace.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#A855F7';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      const velScale = Math.max(0.1, maxVelAbs * 1.25);
      for (let i = 0; i < maxIndex; i++) {
        const ti = i * dt;
        const vi = v1Trace[i] || 0;
        const px = padL + (ti / maxVisibleTime) * plotW;
        const py = midY - (vi / velScale) * (plotH * 0.44);

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Channel 4: Velocity v2(t) (Yellow trace, 2-DOF)
    if (is2DOF && channels.v2 && v2Trace.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      const velScale = Math.max(0.1, maxVelAbs * 1.25);
      for (let i = 0; i < maxIndex; i++) {
        const ti = i * dt;
        const vi = v2Trace[i] || 0;
        const px = padL + (ti / maxVisibleTime) * plotW;
        const py = midY - (vi / velScale) * (plotH * 0.44);

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Channel 2: Displacement x2(t) (Cyan trace, 2-DOF)
    if (is2DOF && channels.x2 && x2Trace.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 2.4;
      ctx.shadowColor = '#06B6D4';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < maxIndex; i++) {
        const ti = i * dt;
        const xi = x2Trace[i] || 0;
        const px = padL + (ti / maxVisibleTime) * plotW;
        const py = midY - (xi / dispScaleMax) * (plotH * 0.44);

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Channel 1: Displacement x1(t) (Phosphor Green glowing trace)
    if (channels.x1 && x1Trace.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.4;
      ctx.shadowColor = '#10B981';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < maxIndex; i++) {
        const ti = i * dt;
        const xi = x1Trace[i] || 0;
        const px = padL + (ti / maxVisibleTime) * plotW;
        const py = midY - (xi / dispScaleMax) * (plotH * 0.44);

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. Vertical Playhead Cursor (Bright Live Scanning Head)
    const playheadX = padL + (Math.min(maxVisibleTime, simTime) / maxVisibleTime) * plotW;
    ctx.save();
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = '#FACC15';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(playheadX, padT);
    ctx.lineTo(playheadX, padT + plotH);
    ctx.stroke();

    // Playhead top marker triangle
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.moveTo(playheadX - 6, padT - 8);
    ctx.lineTo(playheadX + 6, padT - 8);
    ctx.lineTo(playheadX, padT);
    ctx.closePath();
    ctx.fill();

    // Playhead time & value pill
    const pillText = is2DOF
      ? `t=${simTime.toFixed(2)}s | x₁=${(curX1 * 100).toFixed(1)}cm | x₂=${(curX2 * 100).toFixed(1)}cm`
      : `t=${simTime.toFixed(2)}s | x=${(curX1 * 100).toFixed(1)}cm`;
    ctx.font = '700 9px monospace';
    const pillW = is2DOF ? 200 : 130;
    const pillH = 17;
    const pillX = Math.max(padL + 4, Math.min(padL + plotW - pillW - 4, playheadX - pillW / 2));
    const pillY = padT + 6;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FACC15';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, pillX + pillW / 2, pillY + pillH / 2);
    ctx.restore();

    // 6. Inspection Crosshairs under mouse pointer
    if (hoverTime !== null && hoverTime >= 0 && hoverTime <= maxVisibleTime) {
      const hx = padL + (hoverTime / maxVisibleTime) * plotW;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, padT);
      ctx.lineTo(hx, padT + plotH);
      ctx.stroke();

      if (hoverX1 !== null) {
        const hy1 = midY - (hoverX1 / dispScaleMax) * (plotH * 0.44);
        ctx.fillStyle = '#10B981';
        ctx.beginPath(); ctx.arc(hx, hy1, 4, 0, 2 * Math.PI); ctx.fill();
      }
      if (is2DOF && hoverX2 !== null) {
        const hy2 = midY - (hoverX2 / dispScaleMax) * (plotH * 0.44);
        ctx.fillStyle = '#06B6D4';
        ctx.beginPath(); ctx.arc(hx, hy2, 4, 0, 2 * Math.PI); ctx.fill();
      }

      // Hover Tooltip Box
      const hoverTooltip = is2DOF
        ? `T=${hoverTime.toFixed(3)}s | x₁=${((hoverX1||0)*100).toFixed(2)}cm | x₂=${((hoverX2||0)*100).toFixed(2)}cm`
        : `T=${hoverTime.toFixed(3)}s | x=${((hoverX1||0)*100).toFixed(2)}cm | v=${(hoverV1||0).toFixed(3)}m/s`;
      const tipW = is2DOF ? 220 : 180;
      const tipX = Math.max(padL + 2, Math.min(padL + plotW - tipW - 2, hx - tipW / 2));
      const tipY = padT + plotH - 24;

      ctx.fillStyle = 'rgba(7, 13, 30, 0.92)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tipX, tipY, tipW, 18, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.font = '600 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hoverTooltip, tipX + tipW / 2, tipY + 9);
      ctx.restore();
    }

    ctx.restore();
  }, [timeSpan, simTime, hoverTime, channels, x1Trace, x2Trace, v1Trace, v2Trace, nSteps, dt, maxDispAbs, maxVelAbs, forceEdge, F0, freq, waveform, is2DOF, curX1, curX2, hoverX1, hoverX2, hoverV1]);

  useEffect(() => {
    if (isOpen) drawScope();
  }, [isOpen, drawScope]);

  // Scrubbing & Seeking Interaction
  const handlePointerDown = (e) => {
    setIsScrubbing(true);
    handlePointerMove(e);
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const padL = 68;
    const padR = 24;
    const plotW = canvas.offsetWidth - padL - padR;

    const ratio = Math.max(0, Math.min(1, (mx - padL) / plotW));
    const targetT = ratio * timeSpan;
    setHoverTime(targetT);

    if (isScrubbing && onSeek) {
      onSeek(targetT);
    }
  };

  const handlePointerUp = () => {
    setIsScrubbing(false);
  };

  const handleSaveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `simulink_scope_${is2DOF ? '2dof' : '1dof'}_${simTime.toFixed(2)}s.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          background: '#070D1E',
          border: '1.5px solid #1E3A8A',
          borderRadius: '12px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(30, 58, 138, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Scope Top Header Bar (Simulink Tektronix Bezel) */}
        <div
          style={{
            padding: '10px 18px',
            background: 'linear-gradient(180deg, #111C38, #0B1428)',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📈</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#F8FAFC', letterSpacing: '0.5px' }}>
                Simulink Oscilloscope Viewer — {is2DOF ? '2-DOF Coupled System' : 'Single-DOF Oscillator'}
              </div>
              <div style={{ fontSize: '10px', color: '#64748B' }}>
                Tektronix / MathWorks CRT Real-Time Waveform Monitor • Synchronized Playhead Scrubbing
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                background: isPlaying ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isPlaying ? '#22C55E' : '#EF4444',
                border: `1px solid ${isPlaying ? '#22C55E' : '#EF4444'}`
              }}
            >
              {isPlaying ? '● LIVE RUNNING' : '■ PAUSED'}
            </span>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                lineHeight: 1
              }}
              title="Close Scope Viewer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Oscilloscope Hardware Channel Controls Strip */}
        <div
          style={{
            padding: '8px 18px',
            background: '#0A1224',
            borderBottom: '1px solid #152243',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          {/* Channel Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              CHANNELS:
            </span>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: '#10B981' }}>
              <input
                type="checkbox"
                checked={channels.x1}
                onChange={e => setChannels(c => ({ ...c, x1: e.target.checked }))}
                style={{ accentColor: '#10B981' }}
              />
              <span>Ch 1: {is2DOF ? 'x₁(t) Mass 1' : 'x(t) Disp'}</span>
            </label>

            {is2DOF && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: '#06B6D4' }}>
                <input
                  type="checkbox"
                  checked={channels.x2}
                  onChange={e => setChannels(c => ({ ...c, x2: e.target.checked }))}
                  style={{ accentColor: '#06B6D4' }}
                />
                <span>Ch 2: x₂(t) Mass 2</span>
              </label>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: '#A855F7' }}>
              <input
                type="checkbox"
                checked={channels.v1}
                onChange={e => setChannels(c => ({ ...c, v1: e.target.checked }))}
                style={{ accentColor: '#A855F7' }}
              />
              <span>{is2DOF ? 'Ch 3: v₁(t)' : 'Ch 2: v(t)'}</span>
            </label>

            {is2DOF && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: '#FACC15' }}>
                <input
                  type="checkbox"
                  checked={channels.v2}
                  onChange={e => setChannels(c => ({ ...c, v2: e.target.checked }))}
                  style={{ accentColor: '#FACC15' }}
                />
                <span>Ch 4: v₂(t)</span>
              </label>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: '#F59E0B' }}>
              <input
                type="checkbox"
                checked={channels.F}
                onChange={e => setChannels(c => ({ ...c, F: e.target.checked }))}
                style={{ accentColor: '#F59E0B' }}
              />
              <span>{is2DOF ? 'Ch 5: F₁(t)' : 'Ch 3: F(t)'}</span>
            </label>
          </div>

          {/* Time Span & Transport Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', background: '#111C38', borderRadius: '5px', padding: '2px', border: '1px solid #1E293B' }}>
              {[2.0, 4.0, 8.0].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTimeSpan(s)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: timeSpan === s ? '#2563EB' : 'transparent',
                    color: timeSpan === s ? '#FFFFFF' : '#94A3B8',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  {s.toFixed(0)}s
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onTogglePlay}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #334155',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>

            <button
              type="button"
              onClick={onReset}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #334155',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
              title="Reset playhead to t=0"
            >
              ⏮ t=0
            </button>

            <button
              type="button"
              onClick={handleSaveImage}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                background: 'rgba(56, 189, 248, 0.1)',
                color: '#38BDF8',
                border: '1px solid #0284C7',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
              title="Save scope oscilloscope screenshot as PNG"
            >
              📷 Snapshot
            </button>
          </div>
        </div>

        {/* The Oscilloscope CRT Screen Canvas */}
        <div style={{ position: 'relative', width: '100%', height: '360px', background: '#040711', cursor: 'crosshair' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => { setHoverTime(null); setIsScrubbing(false); }}
          />
        </div>

        {/* Measurement Dashboard Readout Strip */}
        <div
          style={{
            padding: '10px 18px',
            background: '#070D1E',
            borderTop: '1px solid #14203D',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '10px'
          }}
        >
          {is2DOF ? (
            <>
              <div style={{ background: '#0F172A', padding: '6px 10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Mass 1 Disp x₁(t)</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#10B981', fontFamily: 'monospace', marginTop: '2px' }}>
                  {(curX1 * 100).toFixed(2)} cm <span style={{ fontSize: '10px', color: '#64748B' }}>({curX1.toFixed(4)} m)</span>
                </div>
                <div style={{ fontSize: '9px', color: '#94A3B8' }}>Peak: {(maxDispAbs * 100).toFixed(2)} cm</div>
              </div>

              <div style={{ background: '#0F172A', padding: '6px 10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Mass 2 Disp x₂(t)</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#06B6D4', fontFamily: 'monospace', marginTop: '2px' }}>
                  {(curX2 * 100).toFixed(2)} cm <span style={{ fontSize: '10px', color: '#64748B' }}>({curX2.toFixed(4)} m)</span>
                </div>
                <div style={{ fontSize: '9px', color: '#94A3B8' }}>Vel v₂: {curV2.toFixed(3)} m/s</div>
              </div>

              <div style={{ background: '#0F172A', padding: '6px 10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Mode 1 Natural Freq</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#F8FAFC', fontFamily: 'monospace', marginTop: '2px' }}>
                  {(modalData?.frequenciesRad?.[0] || classroomSolution?.omega_n || 0).toFixed(3)} rad/s
                </div>
                <div style={{ fontSize: '9px', color: '#94A3B8' }}>
                  f₁ = {((modalData?.frequenciesRad?.[0] || classroomSolution?.omega_n || 0) / (2 * Math.PI)).toFixed(2)} Hz
                </div>
              </div>

              <div style={{ background: '#0F172A', padding: '6px 10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Mode 2 Natural Freq</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#F8FAFC', fontFamily: 'monospace', marginTop: '2px' }}>
                  {(modalData?.frequenciesRad?.[1] || 0).toFixed(3)} rad/s
                </div>
                <div style={{ fontSize: '9px', color: '#94A3B8' }}>
                  f₂ = {((modalData?.frequenciesRad?.[1] || 0) / (2 * Math.PI)).toFixed(2)} Hz
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ background: '#0F172A', padding: '6px 10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Current Value x(t)</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#10B981', fontFamily: 'monospace', marginTop: '2px' }}>
                  {(curX1 * 100).toFixed(2)} cm <span style={{ fontSize: '10px', color: '#64748B' }}>({curX1.toFixed(4)} m)</span>
                </div>
                <div style={{ fontSize: '9px', color: '#94A3B8' }}>Peak: {(maxDispAbs * 100).toFixed(2)} cm</div>
              </div>

              <div style={{ background: '#0F172A', padding: '6px 10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Current Velocity ẋ(t)</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#06B6D4', fontFamily: 'monospace', marginTop: '2px' }}>
                  {curV1.toFixed(3)} m/s
                </div>
                <div style={{ fontSize: '9px', color: '#94A3B8' }}>Peak: {maxVelAbs.toFixed(3)} m/s</div>
              </div>

              <div style={{ background: '#0F172A', padding: '6px 10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Natural Frequency ω_n</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#F8FAFC', fontFamily: 'monospace', marginTop: '2px' }}>
                  {(classroomSolution?.omega_n || 0).toFixed(3)} rad/s
                </div>
                <div style={{ fontSize: '9px', color: '#94A3B8' }}>
                  f_n = {((classroomSolution?.omega_n || 0) / (2 * Math.PI)).toFixed(2)} Hz
                </div>
              </div>

              <div style={{ background: '#0F172A', padding: '6px 10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Damping Ratio ζ</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#F8FAFC', fontFamily: 'monospace', marginTop: '2px' }}>
                  {(classroomSolution?.zeta || 0).toFixed(4)}
                </div>
                <div style={{ fontSize: '9px', color: '#94A3B8' }}>
                  {classroomSolution?.regimeName || 'Underdamped'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
