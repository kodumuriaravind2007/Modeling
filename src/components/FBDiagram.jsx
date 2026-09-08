import React from 'react';

const FBDiagram = ({ simType, params = {}, width = 400, height = 350 }) => {
  // Renders the specific FBD
  const renderSimplePendulum = () => {
    // pivot at (200, 50)
    return (
      <g transform="translate(200, 50)">
        {/* Support structure */}
        <line x1="-50" y1="0" x2="50" y2="0" stroke="#94a3b8" strokeWidth="4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={i} x1={-40 + i * 16} y1="0" x2={-30 + i * 16} y2="-10" stroke="#94a3b8" strokeWidth="2" />
        ))}
        {/* Vertical dashed line */}
        <line x1="0" y1="0" x2="0" y2="200" stroke="#94a3b8" strokeDasharray="5,5" />
        
        {/* Angle arc */}
        <path d="M 0 80 A 80 80 0 0 1 33.8 72.5" fill="none" stroke="#06b6d4" strokeWidth="2" />
        <text x="15" y="95" fill="#06b6d4" fontSize="14">θ</text>
        
        {/* Rod */}
        <line x1="0" y1="0" x2="84.5" y2="181.26" stroke="#94a3b8" strokeWidth="3" />
        
        {/* Dimension L */}
        <path d="M 10 4 L 94.5 185.26" stroke="#a855f7" strokeWidth="1" strokeDasharray="3,3" />
        <text x="60" y="90" fill="#a855f7" fontSize="14" transform="rotate(65 60 90)">L</text>

        {/* Pivot */}
        <circle cx="0" cy="0" r="4" fill="#94a3b8" />
        
        {/* Damping Torque */}
        <path d="M -20 -15 A 25 25 0 0 0 -25 15" fill="none" stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arrow-damping)" />
        <text x="-40" y="0" fill="#f59e0b" fontSize="14">bθ̇</text>

        {/* Bob */}
        <circle cx="84.5" cy="181.26" r="12" fill="#94a3b8" />
        <text x="100" y="185" fill="#e2e8f0" fontSize="14">m</text>

        {/* Forces */}
        <line x1="84.5" y1="181.26" x2="84.5" y2="240" stroke="#f43f5e" strokeWidth="2" markerEnd="url(#arrow-force)" />
        <text x="95" y="240" fill="#f43f5e" fontSize="14">mg</text>

        <line x1="84.5" y1="181.26" x2="42.25" y2="90.63" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow-tension)" />
        <text x="45" y="85" fill="#6366f1" fontSize="14">T</text>
      </g>
    );
  };

  const renderCompoundPendulum = () => {
    return (
      <g transform="translate(200, 50)">
        {/* Vertical dashed line */}
        <line x1="0" y1="0" x2="0" y2="220" stroke="#94a3b8" strokeDasharray="5,5" />
        
        {/* Angle arc */}
        <path d="M 0 80 A 80 80 0 0 1 33.8 72.5" fill="none" stroke="#06b6d4" strokeWidth="2" />
        <text x="15" y="95" fill="#06b6d4" fontSize="14">θ</text>
        
        {/* Rod body */}
        <g transform="rotate(25)">
          <rect x="-10" y="0" width="20" height="200" fill="#94a3b8" fillOpacity="0.3" stroke="#94a3b8" strokeWidth="2" />
          {/* CoM */}
          <circle cx="0" cy="100" r="4" fill="#f43f5e" />
          <path d="M -8 100 L 8 100 M 0 92 L 0 108" stroke="#f43f5e" strokeWidth="1" />
          
          {/* Dimension L & d */}
          <line x1="15" y1="0" x2="15" y2="200" stroke="#a855f7" strokeWidth="1" markerEnd="url(#arrow-dim)" />
          <line x1="15" y1="200" x2="15" y2="0" stroke="#a855f7" strokeWidth="1" markerEnd="url(#arrow-dim)" />
          <text x="25" y="100" fill="#a855f7" fontSize="14">L</text>
          
          <line x1="-15" y1="0" x2="-15" y2="100" stroke="#a855f7" strokeWidth="1" markerEnd="url(#arrow-dim)" />
          <line x1="-15" y1="100" x2="-15" y2="0" stroke="#a855f7" strokeWidth="1" markerEnd="url(#arrow-dim)" />
          <text x="-45" y="50" fill="#a855f7" fontSize="14">d=L/2</text>
        </g>
        
        {/* Pivot */}
        <circle cx="0" cy="0" r="6" fill="#050814" stroke="#94a3b8" strokeWidth="2" />
        <path d="M -4 -4 L 4 4 M -4 4 L 4 -4" stroke="#94a3b8" strokeWidth="1" />
        
        {/* Damping Torque */}
        <path d="M -20 -15 A 25 25 0 0 0 -25 15" fill="none" stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arrow-damping)" />
        <text x="-40" y="0" fill="#f59e0b" fontSize="14">bθ̇</text>

        {/* Forces */}
        {/* CoM is at (100*sin(25), 100*cos(25)) = (42.26, 90.63) */}
        <line x1="42.26" y1="90.63" x2="42.26" y2="150" stroke="#f43f5e" strokeWidth="2" markerEnd="url(#arrow-force)" />
        <text x="50" y="150" fill="#f43f5e" fontSize="14">mg</text>

        {/* Reactions at pivot */}
        <line x1="0" y1="0" x2="40" y2="0" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow-tension)" />
        <text x="45" y="5" fill="#6366f1" fontSize="14">Rx</text>
        
        <line x1="0" y1="0" x2="0" y2="-40" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow-tension)" />
        <text x="5" y="-45" fill="#6366f1" fontSize="14">Ry</text>
      </g>
    );
  };

  const renderSliderCrank = () => {
    return (
      <g transform="translate(100, 200)">
        {/* Ground */}
        <path d="M -15 0 L 15 0 M -10 0 L -15 10 M 0 0 L -5 10 M 10 0 L 5 10" stroke="#94a3b8" strokeWidth="2" />
        
        {/* Guide rails */}
        <line x1="50" y1="12" x2="250" y2="12" stroke="#94a3b8" strokeWidth="2" />
        <line x1="50" y1="-12" x2="250" y2="-12" stroke="#94a3b8" strokeWidth="2" />
        
        {/* Slider */}
        <rect x="155.8" y="-10" width="40" height="20" fill="#6366f1" fillOpacity="0.8" />
        <text x="175.8" y="5" fill="#e2e8f0" fontSize="14" textAnchor="middle">x</text>
        
        {/* Velocity arrow v */}
        <line x1="175.8" y1="-15" x2="215.8" y2="-15" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrow-motion)" />
        <text x="225" y="-15" fill="#06b6d4" fontSize="14">v</text>
        
        {/* Crank r (rose) */}
        <line x1="0" y1="0" x2="42.42" y2="-42.42" stroke="#f43f5e" strokeWidth="4" />
        <text x="15" y="-30" fill="#f43f5e" fontSize="14">r</text>
        
        {/* Connecting rod l (cyan) */}
        <line x1="42.42" y1="-42.42" x2="175.8" y2="0" stroke="#06b6d4" strokeWidth="4" />
        <text x="100" y="-30" fill="#06b6d4" fontSize="14">l</text>
        
        {/* Joints */}
        <circle cx="0" cy="0" r="4" fill="#050814" stroke="#94a3b8" strokeWidth="2" />
        <circle cx="42.42" cy="-42.42" r="4" fill="#050814" stroke="#94a3b8" strokeWidth="2" />
        <circle cx="175.8" cy="0" r="4" fill="#050814" stroke="#94a3b8" strokeWidth="2" />
        
        {/* Angle θ */}
        <path d="M 25 0 A 25 25 0 0 0 17.67 -17.67" fill="none" stroke="#06b6d4" strokeWidth="2" />
        <text x="30" y="-10" fill="#06b6d4" fontSize="14">θ</text>
        
        {/* Angular vel ω */}
        <path d="M -15 -15 A 21 21 0 0 1 10 -25" fill="none" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrow-motion)" />
        <text x="0" y="-30" fill="#06b6d4" fontSize="14">ω</text>
        
        {/* Angle φ */}
        <line x1="175.8" y1="0" x2="140" y2="0" stroke="#94a3b8" strokeDasharray="3,3" />
        <path d="M 150.8 0 A 25 25 0 0 1 155 -7" fill="none" stroke="#06b6d4" strokeWidth="2" />
        <text x="140" y="-15" fill="#06b6d4" fontSize="14">φ</text>
      </g>
    );
  };

  const renderFourBar = () => {
    return (
      <g transform="translate(100, 250)">
        {/* Ground d (slate) */}
        <line x1="0" y1="0" x2="200" y2="0" stroke="#94a3b8" strokeWidth="4" />
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={i} x1={i * 20} y1="0" x2={i * 20 - 10} y2="10" stroke="#94a3b8" strokeWidth="2" />
        ))}
        <text x="100" y="25" fill="#94a3b8" fontSize="14">d</text>
        
        {/* Crank a (rose) */}
        <line x1="0" y1="0" x2="35" y2="-60.4" stroke="#f43f5e" strokeWidth="4" />
        <text x="10" y="-35" fill="#f43f5e" fontSize="14">a</text>
        <path d="M 25 0 A 25 25 0 0 0 12.5 -21.65" fill="none" stroke="#06b6d4" strokeWidth="2" />
        <text x="30" y="-10" fill="#06b6d4" fontSize="14">θ₂</text>
        <path d="M -15 -15 A 21 21 0 0 1 10 -25" fill="none" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrow-motion)" />
        <text x="0" y="-30" fill="#06b6d4" fontSize="14">ω₂</text>
        
        {/* Rocker c (emerald) */}
        <line x1="200" y1="0" x2="165.8" y2="-93.9" stroke="#10b981" strokeWidth="4" />
        <text x="195" y="-50" fill="#10b981" fontSize="14">c</text>
        <path d="M 175 0 A 25 25 0 0 1 191.45 -23.49" fill="none" stroke="#06b6d4" strokeWidth="2" />
        <text x="160" y="-10" fill="#06b6d4" fontSize="14">θ₄</text>
        
        {/* Coupler b (cyan) */}
        <line x1="35" y1="-60.4" x2="165.8" y2="-93.9" stroke="#06b6d4" strokeWidth="4" />
        <text x="100" y="-90" fill="#06b6d4" fontSize="14">b</text>
        
        {/* Horizontal ref for theta3 */}
        <line x1="35" y1="-60.4" x2="70" y2="-60.4" stroke="#94a3b8" strokeDasharray="3,3" />
        <path d="M 60 -60.4 A 25 25 0 0 0 55 -65" fill="none" stroke="#06b6d4" strokeWidth="2" />
        <text x="75" y="-65" fill="#06b6d4" fontSize="14">θ₃</text>
        
        {/* Joints */}
        <circle cx="0" cy="0" r="5" fill="#050814" stroke="#94a3b8" strokeWidth="2" />
        <circle cx="200" cy="0" r="5" fill="#050814" stroke="#94a3b8" strokeWidth="2" />
        <circle cx="35" cy="-60.4" r="4" fill="#050814" stroke="#94a3b8" strokeWidth="2" />
        <circle cx="165.8" cy="-93.9" r="4" fill="#050814" stroke="#94a3b8" strokeWidth="2" />
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
        {/* Force arrow (rose) */}
        <marker id="arrow-force" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
        </marker>
        {/* Tension/Reaction arrow (indigo) */}
        <marker id="arrow-tension" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
        </marker>
        {/* Damping arrow (amber) */}
        <marker id="arrow-damping" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
        </marker>
        {/* Motion arrow (cyan) */}
        <marker id="arrow-motion" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
        </marker>
        {/* Dimension arrow (purple) */}
        <marker id="arrow-dim" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#a855f7" />
        </marker>
      </defs>
      
      {renderContent()}
    </svg>
  );
};

export { FBDiagram };
export default FBDiagram;
