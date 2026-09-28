import React, { useMemo, useState } from 'react';
import { checkFeasibility, FEASIBILITY_STATUS } from '../core/feasibility.js';

export const FeasibilityPanel = React.memo(({ simType, params }) => {
  const report = useMemo(() => {
    return checkFeasibility(simType, params);
  }, [simType, params]);

  const { status, score, title, summary, checks = [], metrics = {} } = report;

  // Track expanded check cards by check id or index
  const [expandedChecks, setExpandedChecks] = useState({});

  const toggleCheck = (id) => {
    setExpandedChecks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const statusClass = status === FEASIBILITY_STATUS.OK
    ? 'optimal'
    : status === FEASIBILITY_STATUS.WARNING
    ? 'marginal'
    : 'infeasible';

  const statusLabel = status === FEASIBILITY_STATUS.OK
    ? '✓ Kinematically Feasible'
    : status === FEASIBILITY_STATUS.WARNING
    ? '⚠️ Functionally Constrained'
    : '⛔ Infeasible Configuration';

  return (
    <div className={`feasibility-panel ${statusClass}`} role="region" aria-label="Mechanism Feasibility Analysis">
      <div className="feasibility-header">
        <div className="feasibility-title-row">
          <span className={`feasibility-badge ${statusClass}`}>
            {statusLabel}
          </span>
          <span className="feasibility-score" title="Design Feasibility Score">
            Index: <strong>{score}</strong>/100
          </span>
        </div>
        <h4 className="feasibility-headline">{title}</h4>
        <p className="feasibility-summary">{summary}</p>
      </div>

      {/* Dynamic Key Metric Badges */}
      {Object.keys(metrics).length > 0 && (
        <div className="feasibility-metrics-strip">
          {Object.entries(metrics).map(([key, val]) => (
            <div key={key} className="feasibility-metric-item">
              <span className="feasibility-metric-key">{key.replace(/_/g, ' ')}</span>
              <span className="feasibility-metric-val">{String(val)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actionable Engineering Diagnostic Checks */}
      {checks.length > 0 && (
        <div className="feasibility-violations-list">
          {checks.map((c, i) => {
            const checkKey = c.id || `check-${i}`;
            const isExpanded = expandedChecks[checkKey] ?? (c.severity === 'error' || c.severity === 'warning');
            const icon = c.severity === 'error' ? '❌' : c.severity === 'warning' ? '⚠️' : 'ℹ️';

            return (
              <div
                key={checkKey}
                className={`feasibility-violation-card ${c.severity}`}
                style={{ cursor: 'pointer' }}
                onClick={() => toggleCheck(checkKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleCheck(checkKey); }}
                aria-expanded={isExpanded}
              >
                <div className="violation-msg-row" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span className="violation-icon">{icon}</span>
                    <div>
                      <span className="violation-text" style={{ fontWeight: 700 }}>{c.title}: </span>
                      <span style={{ fontWeight: 500 }}>{c.what}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '8px', flexShrink: 0 }}>
                    {isExpanded ? '▲ Less' : '▼ Details'}
                  </span>
                </div>

                {/* Collapsible details: Why, Consequence, Fix */}
                {isExpanded && (
                  <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px dashed rgba(0, 0, 0, 0.08)',
                    fontSize: '11.5px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px'
                  }}>
                    {c.why && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <strong style={{ color: '#475569', minWidth: '85px', flexShrink: 0 }}>Physical Law:</strong>
                        <span style={{ color: '#1E293B' }}>{c.why}</span>
                      </div>
                    )}
                    {c.consequence && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <strong style={{ color: '#475569', minWidth: '85px', flexShrink: 0 }}>Consequence:</strong>
                        <span style={{ color: '#B91C1C' }}>{c.consequence}</span>
                      </div>
                    )}
                    {c.fix && c.fix.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <strong style={{ color: '#2563EB', minWidth: '85px', flexShrink: 0 }}>Recommended Fix:</strong>
                        <ul style={{ margin: 0, paddingLeft: '16px', color: '#1E293B' }}>
                          {c.fix.map((f, fi) => (
                            <li key={fi}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

