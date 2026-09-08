import React, { useState } from 'react';
import { PARAM_TOOLTIPS } from './tooltipData';

export const Tooltip = ({ paramKey, children }) => {
  const [visible, setVisible] = useState(false);
  const data = PARAM_TOOLTIPS[paramKey];

  if (!data) return <>{children}</>;

  return (
    <span 
      className="tooltip-container"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible(!visible)}
    >
      {children}
      <span className="tooltip-trigger" title="Click or hover for physics guide">ℹ️</span>
      {visible && (
        <div className="tooltip-popover">
          <div className="tooltip-header">
            <span className="tooltip-icon">📐</span>
            <span className="tooltip-title">{data.title}</span>
          </div>
          <div className="tooltip-body">
            <p className="tooltip-desc">{data.desc}</p>
            {data.formula && (
              <div className="tooltip-formula">
                <span className="tooltip-label">Governing Relation:</span>
                <code>{data.formula}</code>
              </div>
            )}
            <div className="tooltip-meta">
              <span className="tooltip-meta-item">
                <strong>Unit:</strong> {data.unit}
              </span>
              <span className="tooltip-meta-item">
                <strong>Typical:</strong> {data.typical}
              </span>
            </div>
          </div>
        </div>
      )}
    </span>
  );
};
