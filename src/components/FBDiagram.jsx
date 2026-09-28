import React from 'react';

const FBDiagram = ({ simType, params = {}, width = 400, height = 350 }) => {
  // Renders the specific FBD
  const renderSimplePendulum = () => {
    const L_real = Number(params.length) || 1.0;
    const m_real = Number(params.mass) || 1.0;
    const g_real = Number(params.gravity) || 9.81;
    const b_real = Number(params.damping) || 0.1;

    // Visual scale
    const normL = Math.max(0, Math.min(1, (L_real - 0.2) / (5.0 - 0.2)));
    const visL = 130 + normL * 70;
    const bobR = 8 + Math.cbrt(m_real / 1.0) * 6;
    const angleRad = 25 * (Math.PI / 180);
    const bobX = visL * Math.sin(angleRad);
    const bobY = visL * Math.cos(angleRad);

    return (
      <g transform="translate(190, 45)">
        {/* Support structure */}
        <line x1="-50" y1="0" x2="50" y2="0" stroke="#8195B8" strokeWidth="4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={i} x1={-40 + i * 16} y1="0" x2={-30 + i * 16} y2="-10" stroke="#8195B8" strokeWidth="2" />
        ))}
        {/* Vertical dashed line */}
        <line x1="0" y1="0" x2="0" y2={visL + 35} stroke="#8195B8" strokeDasharray="5,5" />
        
        {/* Angle arc */}
        <path d={`M 0 60 A 60 60 0 0 1 ${60 * Math.sin(angleRad)} ${60 * Math.cos(angleRad)}`} fill="none" stroke="#DF7940" strokeWidth="2" />
        <text x="12" y="75" fill="#DF7940" fontSize="13" fontWeight="700">θ₀</text>
        
        {/* Rod */}
        <line x1="0" y1="0" x2={bobX} y2={bobY} stroke="#173770" strokeWidth="3" />
        
        {/* Dimension L */}
        <path d={`M 14 4 L ${bobX + 14} ${bobY}`} stroke="#526B8F" strokeWidth="1.2" strokeDasharray="3,3" />
        <text x={bobX / 2 + 18} y={bobY / 2} fill="#173770" fontSize="12" fontWeight="600">L={L_real.toFixed(2)}m</text>

        {/* Pivot */}
        <circle cx="0" cy="0" r="5" fill="#264CB2" stroke="#173770" strokeWidth="1.5" />
        
        {/* Damping Torque */}
        {b_real > 0 && (
          <>
            <path d="M -20 -15 A 25 25 0 0 0 -25 15" fill="none" stroke="#DF7940" strokeWidth="2" markerEnd="url(#arrow-damping)" />
            <text x="-56" y="0" fill="#DF7940" fontSize="12" fontWeight="600">b={b_real.toFixed(2)}</text>
          </>
        )}

        {/* Bob */}
        <circle cx={bobX} cy={bobY} r={bobR} fill="#264CB2" stroke="#07224E" strokeWidth="2" />
        <text x={bobX + bobR + 8} y={bobY + 4} fill="#173770" fontSize="12" fontWeight="700">m={m_real.toFixed(1)}kg</text>

        {/* Weight Force mg */}
        <line x1={bobX} y1={bobY} x2={bobX} y2={bobY + 50} stroke="#EF4444" strokeWidth="2" markerEnd="url(#arrow-force)" />
        <text x={bobX + 6} y={bobY + 52} fill="#DC2626" fontSize="12" fontWeight="700">W={(m_real * g_real).toFixed(1)}N</text>

        {/* Tension T */}
        <line x1={bobX} y1={bobY} x2={bobX - 35 * Math.sin(angleRad)} y2={bobY - 35 * Math.cos(angleRad)} stroke="#3561EE" strokeWidth="2" markerEnd="url(#arrow-tension)" />
        <text x={bobX - 42 * Math.sin(angleRad)} y={bobY - 42 * Math.cos(angleRad)} fill="#3561EE" fontSize="12" fontWeight="700">T</text>
      </g>
    );
  };

  const renderCompoundPendulum = () => {
    const L_real = Number(params.length) || 1.0;
    const m_real = Number(params.mass) || 2.0;
    const g_real = Number(params.gravity) || 9.81;
    const b_real = Number(params.damping) || 0.05;

    const normL = Math.max(0, Math.min(1, (L_real - 0.2) / (4.0 - 0.2)));
    const visL = 140 + normL * 70;
    const rodW = 16 + Math.cbrt(m_real / 2.0) * 6;
    const comY = visL / 2;
    const copY = visL * (2 / 3);

    return (
      <g transform="translate(190, 45)">
        {/* Support structure */}
        <line x1="-50" y1="0" x2="50" y2="0" stroke="#8195B8" strokeWidth="4" />
        {/* Vertical dashed line */}
        <line x1="0" y1="0" x2="0" y2={visL + 35} stroke="#8195B8" strokeDasharray="5,5" />
        
        {/* Angle arc */}
        <path d="M 0 60 A 60 60 0 0 1 25.3 54.4" fill="none" stroke="#DF7940" strokeWidth="2" />
        <text x="12" y="75" fill="#DF7940" fontSize="13" fontWeight="700">θ₀</text>
        
        {/* Rod body */}
        <g transform="rotate(25)">
          <rect x={-rodW / 2} y="0" width={rodW} height={visL} rx={rodW / 4} fill="#EEF0F8" stroke="#173770" strokeWidth="2" />
          {/* CoM */}
          <circle cx="0" cy={comY} r="5" fill="#DF7940" />
          <path d={`M -8 ${comY} L 8 ${comY} M 0 ${comY - 8} L 0 ${comY + 8}`} stroke="#DF7940" strokeWidth="1.5" />
          
          {/* CoP */}
          <circle cx="0" cy={copY} r="4" fill="#2F7D5A" />

          {/* Dimension L & d */}
          <line x1={rodW / 2 + 10} y1="0" x2={rodW / 2 + 10} y2={visL} stroke="#526B8F" strokeWidth="1.2" strokeDasharray="3,3" />
          <text x={rodW / 2 + 16} y={visL / 2} fill="#173770" fontSize="11" fontWeight="600">L={L_real.toFixed(2)}m</text>
          
          <text x={-rodW / 2 - 58} y={comY / 2} fill="#DF7940" fontSize="11" fontWeight="600">d={(L_real / 2).toFixed(2)}m</text>
        </g>
        
        {/* Pivot */}
        <circle cx="0" cy="0" r="6" fill="#FFFFFF" stroke="#173770" strokeWidth="2.5" />
        
        {/* Damping Torque */}
        {b_real > 0 && (
          <>
            <path d="M -20 -15 A 25 25 0 0 0 -25 15" fill="none" stroke="#DF7940" strokeWidth="2" markerEnd="url(#arrow-damping)" />
            <text x="-56" y="0" fill="#DF7940" fontSize="12" fontWeight="600">b={b_real.toFixed(2)}</text>
          </>
        )}

        {/* Forces */}
        <text x="60" y={comY + 20} fill="#DC2626" fontSize="12" fontWeight="700">W={(m_real * g_real).toFixed(1)}N</text>
        <text x={rodW + 20} y={visL - 10} fill="#2F7D5A" fontSize="11" fontWeight="600">CoP={(2 * L_real / 3).toFixed(2)}m</text>
      </g>
    );
  };

  const renderSliderCrank = () => {
    return (
      <g transform="translate(100, 200)">
        {/* Ground */}
        <path d="M -15 0 L 15 0 M -10 0 L -15 10 M 0 0 L -5 10 M 10 0 L 5 10" stroke="#8195B8" strokeWidth="2" />
        
        {/* Guide rails */}
        <line x1="50" y1="12" x2="250" y2="12" stroke="#173770" strokeWidth="2" />
        <line x1="50" y1="-12" x2="250" y2="-12" stroke="#173770" strokeWidth="2" />
        
        {/* Slider */}
        <rect x="155.8" y="-10" width="40" height="20" fill="#264CB2" fillOpacity="0.85" rx="3" />
        <text x="175.8" y="5" fill="#FFFFFF" fontSize="14" fontWeight="600" textAnchor="middle">x</text>
        
        {/* Velocity arrow v */}
        <line x1="175.8" y1="-15" x2="215.8" y2="-15" stroke="#DF7940" strokeWidth="2" markerEnd="url(#arrow-motion)" />
        <text x="225" y="-15" fill="#DF7940" fontSize="14" fontWeight="600">v</text>
        
        {/* Crank r */}
        <line x1="0" y1="0" x2="42.42" y2="-42.42" stroke="#264CB2" strokeWidth="4" />
        <text x="15" y="-30" fill="#173770" fontSize="14" fontWeight="600">r</text>
        
        {/* Connecting rod l */}
        <line x1="42.42" y1="-42.42" x2="175.8" y2="0" stroke="#3561EE" strokeWidth="4" />
        <text x="100" y="-30" fill="#3561EE" fontSize="14" fontWeight="600">l</text>
        
        {/* Joints */}
        <circle cx="0" cy="0" r="4" fill="#FFFFFF" stroke="#173770" strokeWidth="2" />
        <circle cx="42.42" cy="-42.42" r="4" fill="#FFFFFF" stroke="#173770" strokeWidth="2" />
        <circle cx="175.8" cy="0" r="4" fill="#FFFFFF" stroke="#173770" strokeWidth="2" />
        
        {/* Angle θ */}
        <path d="M 25 0 A 25 25 0 0 0 17.67 -17.67" fill="none" stroke="#DF7940" strokeWidth="2" />
        <text x="30" y="-10" fill="#DF7940" fontSize="14" fontWeight="600">θ</text>
        
        {/* Angular vel ω */}
        <path d="M -15 -15 A 21 21 0 0 1 10 -25" fill="none" stroke="#3561EE" strokeWidth="2" markerEnd="url(#arrow-motion)" />
        <text x="0" y="-30" fill="#3561EE" fontSize="14" fontWeight="600">ω</text>
        
        {/* Angle φ */}
        <line x1="175.8" y1="0" x2="140" y2="0" stroke="#8195B8" strokeDasharray="3,3" />
        <path d="M 150.8 0 A 25 25 0 0 1 155 -7" fill="none" stroke="#3561EE" strokeWidth="2" />
        <text x="140" y="-15" fill="#3561EE" fontSize="14" fontWeight="600">φ</text>
      </g>
    );
  };

  const renderFourBar = () => {
    return (
      <g transform="translate(100, 250)">
        {/* Ground d */}
        <line x1="0" y1="0" x2="200" y2="0" stroke="#8195B8" strokeWidth="4" />
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={i} x1={i * 20} y1="0" x2={i * 20 - 10} y2="10" stroke="#8195B8" strokeWidth="2" />
        ))}
        <text x="100" y="25" fill="#173770" fontSize="14" fontWeight="600">d</text>
        
        {/* Crank a */}
        <line x1="0" y1="0" x2="35" y2="-60.4" stroke="#264CB2" strokeWidth="4" />
        <text x="10" y="-35" fill="#173770" fontSize="14" fontWeight="600">a</text>
        <path d="M 25 0 A 25 25 0 0 0 12.5 -21.65" fill="none" stroke="#DF7940" strokeWidth="2" />
        <text x="30" y="-10" fill="#DF7940" fontSize="14" fontWeight="600">θ₂</text>
        <path d="M -15 -15 A 21 21 0 0 1 10 -25" fill="none" stroke="#3561EE" strokeWidth="2" markerEnd="url(#arrow-motion)" />
        <text x="0" y="-30" fill="#3561EE" fontSize="14" fontWeight="600">ω₂</text>
        
        {/* Rocker c */}
        <line x1="200" y1="0" x2="165.8" y2="-93.9" stroke="#6F8FF4" strokeWidth="4" />
        <text x="195" y="-50" fill="#173770" fontSize="14" fontWeight="600">c</text>
        <path d="M 175 0 A 25 25 0 0 1 191.45 -23.49" fill="none" stroke="#6F8FF4" strokeWidth="2" />
        <text x="160" y="-10" fill="#6F8FF4" fontSize="14" fontWeight="600">θ₄</text>
        
        {/* Coupler b */}
        <line x1="35" y1="-60.4" x2="165.8" y2="-93.9" stroke="#3561EE" strokeWidth="4" />
        <text x="100" y="-90" fill="#3561EE" fontSize="14" fontWeight="600">b</text>
        
        {/* Horizontal ref for theta3 */}
        <line x1="35" y1="-60.4" x2="70" y2="-60.4" stroke="#8195B8" strokeDasharray="3,3" />
        <path d="M 60 -60.4 A 25 25 0 0 0 55 -65" fill="none" stroke="#3561EE" strokeWidth="2" />
        <text x="75" y="-65" fill="#3561EE" fontSize="14" fontWeight="600">θ₃</text>
        
        {/* Joints */}
        <circle cx="0" cy="0" r="5" fill="#FFFFFF" stroke="#173770" strokeWidth="2" />
        <circle cx="200" cy="0" r="5" fill="#FFFFFF" stroke="#173770" strokeWidth="2" />
        <circle cx="35" cy="-60.4" r="4" fill="#FFFFFF" stroke="#173770" strokeWidth="2" />
        <circle cx="165.8" cy="-93.9" r="4" fill="#FFFFFF" stroke="#173770" strokeWidth="2" />
      </g>
    );
  };

  const renderContent = () => {
    switch(simType) {
      case 'simple_pendulum': return renderSimplePendulum();
      case 'compound_pendulum': return renderCompoundPendulum();
      case 'slider_crank': return renderSliderCrank();
      case 'four_bar': return renderFourBar();
      default: return null;
    }
  };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <defs>
        {/* Force arrow (rose/red) */}
        <marker id="arrow-force" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#EF4444" />
        </marker>
        {/* Tension/Reaction arrow (blue active) */}
        <marker id="arrow-tension" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3561EE" />
        </marker>
        {/* Damping arrow (technical orange) */}
        <marker id="arrow-damping" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#DF7940" />
        </marker>
        {/* Motion arrow (blue active) */}
        <marker id="arrow-motion" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3561EE" />
        </marker>
        {/* Dimension arrow (slate blue) */}
        <marker id="arrow-dim" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#526B8F" />
        </marker>
      </defs>
      
      {renderContent()}
    </svg>
  );
};

export { FBDiagram };
export default FBDiagram;
