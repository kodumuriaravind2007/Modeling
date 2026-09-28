import React, { useState, useRef, useEffect } from 'react';
import { PARAM_TOOLTIPS } from './tooltipData';

export const Tooltip = ({ paramKey, children }) => {
  const [visible, setVisible] = useState(false);
  const data = PARAM_TOOLTIPS[paramKey];
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setVisible(false);
      }
    };
    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible]);

  if (!data) return <>{children}</>;

  return (
    <span 
      ref={containerRef}
      className="tooltip-container"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <button
        type="button"
        className="tooltip-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setVisible(!visible);
        }}
        aria-label={`Help for ${data.title}`}
        title="Physics parameter guide"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </button>

      {visible && (
        <div className="tooltip-popover" role="tooltip">
          <div className="tooltip-header">
            <span className="tooltip-title">{data.title}</span>
          </div>
          <div className="tooltip-body">
            <p className="tooltip-desc">{data.desc}</p>
            {data.formula && (
              <div className="tooltip-formula">
                <span className="tooltip-label">Governing Relation</span>
                <code>{data.formula}</code>
              </div>
            )}
            <div className="tooltip-meta">
              <span className="tooltip-meta-item">
                <span className="tooltip-meta-label">Unit:</span> {data.unit}
              </span>
              <span className="tooltip-meta-item">
                <span className="tooltip-meta-label">Typical:</span> {data.typical}
              </span>
            </div>
          </div>
        </div>
      )}
    </span>
  );
};
