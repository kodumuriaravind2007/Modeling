import React, { useEffect } from 'react';

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 5];

export const PlaybackBar = ({
  simData,
  animIdx,
  onSetAnimIdx,
  isPlaying,
  onTogglePlay,
  onStepAnim,
  animSpeed,
  onSpeedChange,
  onReset
}) => {
  const simLen = simData?.time?.length || simData?.crank_angle_deg?.length || 0;
  const currentTime = simData?.time?.[animIdx] !== undefined
    ? `${simData.time[animIdx].toFixed(2)} s`
    : simData?.crank_angle_deg?.[animIdx] !== undefined
      ? `${simData.crank_angle_deg[animIdx].toFixed(1)}°`
      : `Frame ${animIdx}`;

  const maxTime = simData?.time && simData.time.length > 0
    ? `${simData.time[simData.time.length - 1].toFixed(2)} s`
    : simData?.crank_angle_deg && simData.crank_angle_deg.length > 0
      ? `${simData.crank_angle_deg[simData.crank_angle_deg.length - 1].toFixed(1)}°`
      : `--`;

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onStepAnim(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onStepAnim(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onStepAnim]);

  if (!simData) {
    return (
      <footer className="playback-bar disabled" aria-label="Simulation Timeline">
        <div className="playback-empty-hint">
          <span>Simulation timeline inactive. Adjust parameters and click <strong>Run Simulation</strong> above.</span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="playback-bar" aria-label="Simulation Timeline">
      {/* ── Playback Action Buttons ── */}
      <div className="playback-transport-buttons">
        {/* Reset to Start */}
        <button
          type="button"
          className="btn-transport"
          onClick={onReset}
          title="Reset to Start (Frame 0)"
          aria-label="Reset to frame 0"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="19 20 9 12 19 4 19 20"></polygon>
            <line x1="5" y1="19" x2="5" y2="5"></line>
          </svg>
        </button>

        {/* Step Backward */}
        <button
          type="button"
          className="btn-transport"
          onClick={() => onStepAnim(-1)}
          title="Step Backward (Left Arrow)"
          aria-label="Step backward"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="15 18 9 12 15 6 15 18"></polygon>
          </svg>
        </button>

        {/* Play / Pause Toggle */}
        <button
          type="button"
          className={`btn-transport-play ${isPlaying ? 'playing' : ''}`}
          onClick={onTogglePlay}
          title={isPlaying ? 'Pause (Spacebar)' : 'Play (Spacebar)'}
          aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 3 20 12 6 21 6 3"></polygon>
            </svg>
          )}
        </button>

        {/* Step Forward */}
        <button
          type="button"
          className="btn-transport"
          onClick={() => onStepAnim(1)}
          title="Step Forward (Right Arrow)"
          aria-label="Step forward"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="9 18 15 12 9 6 9 18"></polygon>
          </svg>
        </button>
      </div>

      {/* ── Scrubber Slider ── */}
      <div className="playback-scrubber-container">
        <span className="playback-time-badge">{currentTime}</span>
        <input
          type="range"
          className="playback-slider"
          min={0}
          max={Math.max(0, simLen - 1)}
          step={1}
          value={animIdx}
          onChange={(e) => onSetAnimIdx(parseInt(e.target.value, 10))}
          aria-label="Simulation time scrubber"
        />
        <span className="playback-max-time">{maxTime}</span>
      </div>

      {/* ── Speed Multiplier Pills ── */}
      <div className="playback-speed-group" role="group" aria-label="Playback Speed">
        <span className="speed-label">Speed:</span>
        {SPEED_OPTIONS.map((spd) => (
          <button
            key={spd}
            type="button"
            className={`btn-speed-pill ${animSpeed === spd ? 'active' : ''}`}
            onClick={() => onSpeedChange(spd)}
          >
            {spd}×
          </button>
        ))}
      </div>
    </footer>
  );
};
