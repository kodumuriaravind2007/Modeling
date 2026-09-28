import React from 'react';

const formatNum = (num, fractionDigits = 3) => {
  if (num == null || isNaN(num)) return 'N/A';
  return Number(num).toFixed(fractionDigits);
};

export const CircuitDiagram = ({
  simType,
  params = {},
  analogyValues = {},
  width = 450,
  height = 280,
}) => {
  const isPendulum = simType === 'simple_pendulum' || simType === 'compound_pendulum';
  const isSliderCrank = simType === 'slider_crank';
  const isFourBar = simType === 'four_bar';

  if (!simType) return null;

  if (isPendulum) {
    const { L_e, R, C, omega_n, zeta, omega_d, T_d } = analogyValues;
    const lText = simType === 'simple_pendulum' ? '(= mL² = I)' : '(= I_pivot)';
    const cText = simType === 'simple_pendulum' ? '(= 1/mgL)' : '(= 1/mgd)';

    let dampingClass = 'Undamped';
    if (zeta > 0 && zeta < 1) dampingClass = 'Underdamped';
    else if (zeta === 1) dampingClass = 'Critically damped';
    else if (zeta > 1) dampingClass = 'Overdamped';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <svg width={width} height={height} viewBox={`0 0 450 280`} style={{ color: '#94a3b8' }}>
          <style>
            {`
              .wire { stroke: #8195B8; stroke-width: 2; fill: none; }
              .inductor { stroke: #264CB2; stroke-width: 3; fill: none; stroke-linejoin: round; }
              .resistor { stroke: #173770; stroke-width: 3; fill: none; stroke-linejoin: round; }
              .capacitor { stroke: #3561EE; stroke-width: 3; fill: none; }
              .voltage { stroke: #8195B8; stroke-width: 2; fill: none; }
              .label-symbol { fill: #173770; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 700; text-anchor: middle; }
              .label-value { fill: #264CB2; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; text-anchor: middle; }
              .label-meaning { fill: #526B8F; font-family: 'Inter', sans-serif; font-size: 11px; text-anchor: middle; }
            `}
          </style>

          {/* Wires */}
          <path d="M 50 60 L 110 60" className="wire" />
          <path d="M 150 60 L 210 60" className="wire" />
          <path d="M 250 60 L 325 60" className="wire" />
          <path d="M 335 60 L 400 60" className="wire" />
          
          <path d="M 50 60 L 50 180" className="wire" />
          <path d="M 400 60 L 400 180" className="wire" />
          
          <path d="M 50 180 L 205 180" className="wire" />
          <path d="M 245 180 L 400 180" className="wire" />

          {/* Inductor L_e (110 to 150) */}
          <path d="M 110,60 a 5,5 0 1,1 10,0 a 5,5 0 1,1 10,0 a 5,5 0 1,1 10,0 a 5,5 0 1,1 10,0" className="inductor" />
          <text x="130" y="30" className="label-symbol">L_e</text>
          <text x="130" y="85" className="label-value">{formatNum(L_e)} H</text>
          <text x="130" y="105" className="label-meaning">{lText}</text>

          {/* Resistor R (210 to 250) */}
          <path d="M 210,60 L 215,48 L 225,72 L 235,48 L 245,72 L 250,60" className="resistor" />
          <text x="230" y="30" className="label-symbol">R</text>
          <text x="230" y="85" className="label-value">{formatNum(R)} Ω</text>
          <text x="230" y="105" className="label-meaning">(= b, damping)</text>

          {/* Capacitor C (325 to 335) */}
          <path d="M 325,45 L 325,75 M 335,45 L 335,75" className="capacitor" />
          <text x="330" y="30" className="label-symbol">C</text>
          <text x="330" y="85" className="label-value">{formatNum(C)} F</text>
          <text x="330" y="105" className="label-meaning">{cText}</text>

          {/* Voltage Source V(t) (Center 225, 180) */}
          <circle cx="225" cy="180" r="20" className="voltage" />
          <text x="225" y="170" fill="#8195B8" fontSize="12" textAnchor="middle">+</text>
          <text x="225" y="195" fill="#8195B8" fontSize="12" textAnchor="middle">-</text>
          <text x="225" y="225" className="label-symbol">V(t)</text>
          <text x="225" y="240" className="label-meaning">(= τ_ext, external torque)</text>

        </svg>

        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.875rem',
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--kx-text-primary, #173770)',
          backgroundColor: 'var(--kx-periwinkle-pale, #EEF0F8)',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--kx-border, #DCE1F0)',
          width: '100%',
          maxWidth: '28rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
            <div><span style={{ color: '#264CB2', fontWeight: 600 }}>ω_n</span> = {formatNum(omega_n)} rad/s</div>
            <div><span style={{ color: '#173770', fontWeight: 600 }}>ζ</span> = {formatNum(zeta)}</div>
            {zeta < 1 && zeta > 0 ? (
              <>
                <div><span style={{ color: '#3561EE', fontWeight: 600 }}>ω_d</span> = {formatNum(omega_d)} rad/s</div>
                <div><span style={{ color: '#2F7D5A', fontWeight: 600 }}>T_d</span> = {formatNum(T_d)} s</div>
              </>
            ) : (
              <div style={{ gridColumn: 'span 2', color: '#526B8F', fontStyle: 'italic' }}>No oscillation (ζ ≥ 1)</div>
            )}
            <div style={{ gridColumn: 'span 2', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--kx-border, #DCE1F0)' }}>
              Class: <span style={{ color: 'var(--kx-text-primary, #173770)', fontWeight: 600 }}>{dampingClass}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSliderCrank || isFourBar) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        padding: '1.5rem',
        color: 'var(--color-text, #1F2937)'
      }}>
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border, #E5E7EB)',
          maxWidth: '28rem',
          width: '100%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            color: 'var(--color-text, #1F2937)',
            marginBottom: '0.5rem',
            marginTop: 0
          }}>Kinematic Mechanism</h3>
          <p style={{
            fontSize: '0.875rem',
            fontFamily: "'Inter', sans-serif",
            color: 'var(--color-text-secondary, #6B7280)',
            marginBottom: '1.5rem',
            marginTop: '0.5rem',
            lineHeight: 1.5
          }}>
            This is a pure kinematic mechanism. Motion is determined geometrically by linkages rather than by a dynamic ODE, so there is no equivalent RLC circuit analogy.
          </p>

          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isSliderCrank && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--kx-border, #DCE1F0)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: '#264CB2', fontWeight: 600 }}>Stroke (2r)</span>
                  <span style={{ color: '#173770' }}>{formatNum(2 * (params.crank_length || 0))} m</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--kx-border, #DCE1F0)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: '#173770', fontWeight: 600 }}>Crank/Rod ratio (λ)</span>
                  <span style={{ color: '#173770' }}>{formatNum((params.crank_length || 0) / (params.conn_length || 1))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
                  <span style={{ color: '#3561EE', fontWeight: 600 }}>Crank Speed (ω)</span>
                  <span style={{ color: '#173770' }}>{formatNum((params.crank_speed || 0) * 2 * Math.PI / 60)} rad/s</span>
                </div>
              </>
            )}

            {isFourBar && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--kx-text-secondary, #526B8F)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Link Lengths</div>
                    <div>a: <span style={{ color: '#264CB2', fontWeight: 600 }}>{formatNum(params.link_crank)} m</span></div>
                    <div>b: <span style={{ color: '#3561EE', fontWeight: 600 }}>{formatNum(params.link_coupler)} m</span></div>
                    <div>c: <span style={{ color: '#6F8FF4', fontWeight: 600 }}>{formatNum(params.link_rocker)} m</span></div>
                    <div>d: <span style={{ color: '#8195B8', fontWeight: 600 }}>{formatNum(params.link_ground)} m</span></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--kx-text-secondary, #526B8F)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Freudenstein Coeffs</div>
                    <div>K₁ = <span style={{ color: '#173770', fontWeight: 600 }}>{formatNum(params.link_ground / params.link_crank)}</span></div>
                    <div>K₂ = <span style={{ color: '#173770', fontWeight: 600 }}>{formatNum(params.link_ground / params.link_rocker)}</span></div>
                    <div>K₃ = <span style={{ color: '#173770', fontWeight: 600 }}>{formatNum((Math.pow(params.link_crank || 0, 2) - Math.pow(params.link_coupler || 0, 2) + Math.pow(params.link_rocker || 0, 2) + Math.pow(params.link_ground || 0, 2)) / (2 * (params.link_crank || 1) * (params.link_rocker || 1)))}</span></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
