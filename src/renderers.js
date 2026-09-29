// renderers.js
// High-DPI Crisp CAD/CAE Canvas Renderers with Luminous Clarity & KyntriX Cool Blue Theme
// Styled for KyntriX Mechanical Simulation Workstation Platform

// ── Helper: Vector Arrow Draw Function ────────────────────────────────
function drawVectorArrow(ctx, fromX, fromY, vecX, vecY, color = '#DF7940', label = '', scale = 1.0) {
  const vx = vecX * scale;
  const vy = vecY * scale;
  const mag = Math.hypot(vx, vy);
  if (mag < 2) return;

  const toX = fromX + vx;
  const toY = fromY + vy;
  const angle = Math.atan2(vy, vx);
  const headLen = Math.min(12, Math.max(7, mag * 0.35));

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Arrow shaft
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Arrow head
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  // Vector label pill
  if (label) {
    const lx = toX + 12 * Math.cos(angle);
    const ly = toY + 12 * Math.sin(angle);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#DCE1F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(lx - 16, ly - 9, 32, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#173770';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly);
  }
  ctx.restore();
}

// ── Helper: On-Canvas Live CAD Telemetry HUD ──────────────────────────
function drawCanvasHUD(ctx, _w, _h, title, metrics = {}) {
  ctx.save();
  const hudX = 18;
  const hudY = 18;
  const hudW = 230;
  const hudH = 34 + Object.keys(metrics).length * 20;

  // Crisp white card floating with soft cool blue shadow
  ctx.shadowColor = 'rgba(23, 55, 112, 0.08)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(hudX, hudY, hudW, hudH, 10);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#DCE1F0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Blue vertical accent bar
  ctx.fillStyle = '#264CB2';
  ctx.beginPath();
  ctx.roundRect(hudX + 14, hudY + 12, 3.5, 15, 1.5);
  ctx.fill();

  // Title header
  ctx.fillStyle = '#07224E';
  ctx.font = '800 11px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title.toUpperCase(), hudX + 23, hudY + 19);

  // Subtle separator line
  ctx.strokeStyle = '#E8EAF4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hudX + 14, hudY + 32);
  ctx.lineTo(hudX + hudW - 14, hudY + 32);
  ctx.stroke();

  let y = hudY + 46;
  for (const [key, val] of Object.entries(metrics)) {
    ctx.fillStyle = '#526B8F';
    ctx.font = '600 11px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(key, hudX + 14, y);

    ctx.fillStyle = '#07224E';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${val}`, hudX + hudW - 14, y);
    y += 20;
  }
  ctx.restore();
}

// ── Helper: Cool Pale Periwinkle Engineering Grid ─────────────────────
function drawGrid(ctx, w, h) {
  ctx.save();
  // Cool, crisp Pale Periwinkle workstation canvas
  ctx.fillStyle = '#F1F1F8';
  ctx.fillRect(0, 0, w, h);

  // Subtle minor grid lines
  ctx.strokeStyle = '#E8EAF4';
  ctx.lineWidth = 0.8;
  const minorStep = 20;
  for (let i = minorStep; i < w; i += minorStep) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
  }
  for (let j = minorStep; j < h; j += minorStep) {
    ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke();
  }

  // Defined major grid lines
  ctx.strokeStyle = '#D7DDF1';
  ctx.lineWidth = 1.2;
  const majorStep = 100;
  for (let i = majorStep; i < w; i += majorStep) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
  }
  for (let j = majorStep; j < h; j += majorStep) {
    ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke();
  }

  // Crosshair markers at grid intersections
  ctx.fillStyle = '#8195B8';
  for (let i = majorStep; i < w; i += majorStep) {
    for (let j = majorStep; j < h; j += majorStep) {
      ctx.fillRect(i - 2, j - 0.5, 5, 1);
      ctx.fillRect(i - 0.5, j - 2, 1, 5);
    }
  }
  ctx.restore();
}

// ── Helper: CAD Joint Pivot Bearing ───────────────────────────────────
function drawCADJointPin(ctx, x, y, outerColor = '#173770', label = '', radius = 8) {
  ctx.save();
  // Soft outer drop shadow
  ctx.shadowColor = 'rgba(23, 55, 112, 0.12)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  // Outer white mounting washer
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x, y, radius + 4, 0, 2 * Math.PI);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  // Vibrant color ring
  ctx.strokeStyle = outerColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, radius + 2, 0, 2 * Math.PI);
  ctx.stroke();

  // Machined steel inner hub
  const hubGrad = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  hubGrad.addColorStop(0, '#FFFFFF');
  hubGrad.addColorStop(0.5, '#E2E8F0');
  hubGrad.addColorStop(1, '#8195B8');
  ctx.fillStyle = hubGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Central retaining pin
  ctx.fillStyle = '#07224E';
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.35, 0, 2 * Math.PI);
  ctx.fill();

  // Pin label badge if provided
  if (label) {
    const lx = x;
    const ly = y - radius - 12;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#DCE1F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lx, ly, 9, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#173770';
    ctx.font = '800 11px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly);
  }
  ctx.restore();
}

// ── 1. Simple Pendulum Renderer ───────────────────────────────────────
export function drawSimplePendulum(ctx, w, h, theta_deg, params = {}, omega = 0) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  const lengthVal = Number(params.length) || 1.0;
  const massVal = Number(params.mass) || 1.0;

  const pivotX = w / 2;
  const pivotY = h * 0.16;

  // DYNAMIC VISUAL SCALING: rod visually resizes directly with Length slider
  const minL = h * 0.22;
  const maxL = h * 0.65;
  const normL = Math.max(0, Math.min(1, (lengthVal - 0.2) / (5.0 - 0.2)));
  const L = minL + normL * (maxL - minL);

  // DYNAMIC VISUAL BOB RADIUS: scales visibly with Mass slider
  const bobRadius = 14 + Math.cbrt(massVal / 1.0) * 8;

  const theta = (theta_deg * Math.PI) / 180;
  const bobX = pivotX + L * Math.sin(theta);
  const bobY = pivotY + L * Math.cos(theta);

  // Soft periwinkle pivot shadow circle (hidden during active running playback)
  if (!params.isPlaying) {
    ctx.save();
    ctx.fillStyle = 'rgba(53, 97, 238, 0.12)';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 40, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }

  // 1. Ceiling Mount Bracket (Precision Machined Anodized Block with Ground Hatches)
  ctx.save();
  const mountW = 88;
  const mountH = 14;
  ctx.fillStyle = '#FAFAFC';
  ctx.fillRect(pivotX - mountW / 2, pivotY - mountH, mountW, mountH);
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pivotX - mountW / 2, pivotY - mountH, mountW, mountH);

  // Ground Hatches above plate
  ctx.beginPath();
  ctx.moveTo(pivotX - mountW / 2 - 6, pivotY - mountH);
  ctx.lineTo(pivotX + mountW / 2 + 6, pivotY - mountH);
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#8195B8';
  for (let hx = -mountW / 2 + 2; hx <= mountW / 2 - 2; hx += 8) {
    ctx.beginPath();
    ctx.moveTo(pivotX + hx, pivotY - mountH);
    ctx.lineTo(pivotX + hx + 6, pivotY - mountH - 7);
    ctx.stroke();
  }

  // Clevis mounting bracket extending down
  ctx.fillStyle = '#EEF0F8';
  ctx.beginPath();
  ctx.moveTo(pivotX - 14, pivotY - mountH);
  ctx.lineTo(pivotX - 14, pivotY + 4);
  ctx.arc(pivotX, pivotY + 4, 14, Math.PI, 0, true);
  ctx.lineTo(pivotX + 14, pivotY - mountH);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 2. Equilibrium Centerline
  ctx.save();
  ctx.setLineDash([5, 6]);
  ctx.strokeStyle = '#8195B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(pivotX, pivotY + maxL + 25);
  ctx.stroke();
  ctx.restore();

  // 3. Angular Arc with Dynamic Degree Readout (Hidden during running simulation)
  if (!params.isPlaying && Math.abs(theta_deg) > 0.5) {
    ctx.save();
    const arcR = Math.min(65, L * 0.4);
    const rodAngle = Math.PI / 2 - theta;
    const verticalAngle = Math.PI / 2;
    const startAngle = Math.min(rodAngle, verticalAngle);
    const endAngle = Math.max(rodAngle, verticalAngle);

    ctx.beginPath();
    ctx.arc(pivotX, pivotY, arcR, startAngle, endAngle, false);
    ctx.strokeStyle = '#DF7940';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Soft warm tint in arc sweep
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.arc(pivotX, pivotY, arcR, startAngle, endAngle, false);
    ctx.closePath();
    ctx.fillStyle = 'rgba(223, 121, 64, 0.12)';
    ctx.fill();

    // Degree label badge (Semantic Orange annotation)
    const midAngle = (startAngle + endAngle) / 2;
    const lblDist = arcR + 24;
    const lblX = pivotX + lblDist * Math.cos(midAngle);
    const lblY = pivotY + lblDist * Math.sin(midAngle);
    const angleText = `θ₀ = ${Math.abs(theta_deg).toFixed(0)}°`;

    ctx.font = '700 11px "JetBrains Mono", monospace';
    const textWidth = ctx.measureText(angleText).width;
    const pillW = textWidth + 12;
    const pillH = 20;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#DF7940';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(lblX - pillW / 2, lblY - pillH / 2, pillW, pillH, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#DF7940';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(angleText, lblX, lblY);
    ctx.restore();
  }

  // 4. Polished Engineering Pendulum Rod (Precision Navy/Steel Metallic Finish)
  ctx.save();
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(bobX, bobY);
  ctx.stroke();

  // Specular core highlight
  const rodGrad = ctx.createLinearGradient(pivotX, pivotY, bobX, bobY);
  rodGrad.addColorStop(0, '#FFFFFF');
  rodGrad.addColorStop(0.3, '#EEF0F8');
  rodGrad.addColorStop(0.7, '#6F8FF4');
  rodGrad.addColorStop(1, '#244AAF');
  ctx.strokeStyle = rodGrad;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(bobX, bobY);
  ctx.stroke();
  ctx.restore();

  // 5. Dimension Annotation: Length L
  ctx.save();
  const perpX = -Math.cos(theta) * 28;
  const perpY = Math.sin(theta) * 28;
  const dimStartX = pivotX + perpX;
  const dimStartY = pivotY + perpY;
  const dimEndX = bobX + perpX;
  const dimEndY = bobY + perpY;

  ctx.strokeStyle = '#8195B8';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY); ctx.lineTo(dimStartX, dimStartY);
  ctx.moveTo(bobX, bobY); ctx.lineTo(dimEndX, dimEndY);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(dimStartX, dimStartY); ctx.lineTo(dimEndX, dimEndY);
  ctx.stroke();

  // Dimension Text Pill
  const dimMidX = (dimStartX + dimEndX) / 2;
  const dimMidY = (dimStartY + dimEndY) / 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#DCE1F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(dimMidX - 32, dimMidY - 10, 64, 20, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#173770';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`L=${lengthVal.toFixed(2)} m`, dimMidX, dimMidY);
  ctx.restore();

  // 6. Pivot CAD Joint Bearing
  drawCADJointPin(ctx, pivotX, pivotY, '#173770', '', 8);

  // 7. Restrained Blue Engineering Bob (Spherical Specular Material)
  ctx.save();
  // Soft ambient cool blue aura
  const glowGrad = ctx.createRadialGradient(bobX, bobY, 0, bobX, bobY, bobRadius + 12);
  glowGrad.addColorStop(0, 'rgba(38, 76, 178, 0.20)');
  glowGrad.addColorStop(1, 'rgba(38, 76, 178, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(bobX, bobY, bobRadius + 12, 0, 2 * Math.PI);
  ctx.fill();

  // 3D Spherical Radial Gradient
  const bobGrad = ctx.createRadialGradient(
    bobX - bobRadius * 0.35, bobY - bobRadius * 0.35, bobRadius * 0.08,
    bobX, bobY, bobRadius
  );
  bobGrad.addColorStop(0, '#FFFFFF');     // Specular glint
  bobGrad.addColorStop(0.2, '#97AEF6');   // Soft blue highlight
  bobGrad.addColorStop(0.65, '#264CB2');  // Royal blue body
  bobGrad.addColorStop(1, '#07224E');     // Deep navy contour

  ctx.fillStyle = bobGrad;
  ctx.beginPath();
  ctx.arc(bobX, bobY, bobRadius, 0, 2 * Math.PI);
  ctx.fill();

  // Precision edge ring
  ctx.strokeStyle = '#07224E';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Mass readout pill
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#DCE1F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bobX - 26, bobY + bobRadius + 8, 52, 18, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#173770';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${massVal.toFixed(1)} kg`, bobX, bobY + bobRadius + 17);
  ctx.restore();

  // 8. Velocity Vector Arrow (Semantic Vector Annotation)
  const vScale = 18;
  const vMag = (omega || 0) * (L / 120);
  const _vPhysical = Math.abs((omega || 0) * lengthVal);
  if (!params.isDragging) {
    const vx = vMag * Math.cos(theta);
    const vy = -vMag * Math.sin(theta);
    drawVectorArrow(ctx, bobX, bobY, vx, vy, '#DF7940', 'v', vScale);
  } else {
    // Interactive Dragging Guide & Release Trajectory
    ctx.save();
    ctx.strokeStyle = '#3561EE';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobRadius + 7, 0, 2 * Math.PI);
    ctx.stroke();

    // Release Arc Path
    ctx.strokeStyle = '#DF7940';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, L, Math.PI / 2 - Math.abs(theta), Math.PI / 2, theta < 0);
    ctx.stroke();

    // "RELEASE TO SWING" callout tag
    ctx.setLineDash([]);
    ctx.fillStyle = '#DF7940';
    ctx.beginPath();
    ctx.roundRect(bobX - 62, bobY - bobRadius - 28, 124, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 10px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RELEASE TO SWING', bobX, bobY - bobRadius - 17);
    ctx.restore();
  }

  // HUD
  drawCanvasHUD(ctx, w, h, 'Simple Pendulum', {
    'Angle (θ)': `${theta_deg.toFixed(1)}°`,
    'Length (L)': `${lengthVal.toFixed(2)} m`,
    'Mass (m)': `${massVal.toFixed(1)} kg`,
    'Gravity (g)': `${(params.gravity || 9.81).toFixed(2)} m/s²`,
    'Velocity (v)': `${vMag.toFixed(2)} m/s`
  });
}

// ── 2. Compound Pendulum Renderer ─────────────────────────────────────
export function drawCompoundPendulum(ctx, w, h, theta_deg, params = {}) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  const lengthVal = Number(params.length) || 1.0;
  const massVal = Number(params.mass) || 2.0;

  const pivotX = w / 2;
  const pivotY = h * 0.16;

  // DYNAMIC VISUAL SCALING: lengthen/shorten rod proportionally with length parameter
  const minL = h * 0.25;
  const maxL = h * 0.68;
  const normL = Math.max(0, Math.min(1, (lengthVal - 0.2) / (4.0 - 0.2)));
  const L = minL + normL * (maxL - minL);

  // DYNAMIC BEAM WIDTH: scales visually with mass
  const rodW = 22 + Math.cbrt(massVal / 2.0) * 8;

  const theta = (theta_deg * Math.PI) / 180;

  // Soft periwinkle pivot shadow circle (hidden during active running playback)
  if (!params.isPlaying) {
    ctx.save();
    ctx.fillStyle = 'rgba(53, 97, 238, 0.12)';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 40, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }

  // 1. Pivot Bearing Pedestal Bracket
  ctx.save();
  const mountW = 92;
  const mountH = 16;
  ctx.fillStyle = '#FAFAFC';
  ctx.fillRect(pivotX - mountW / 2, pivotY - mountH, mountW, mountH);
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pivotX - mountW / 2, pivotY - mountH, mountW, mountH);

  // Ground Hatches
  ctx.beginPath();
  ctx.moveTo(pivotX - mountW / 2 - 6, pivotY - mountH);
  ctx.lineTo(pivotX + mountW / 2 + 6, pivotY - mountH);
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#8195B8';
  for (let hx = -mountW / 2 + 2; hx <= mountW / 2 - 2; hx += 8) {
    ctx.beginPath();
    ctx.moveTo(pivotX + hx, pivotY - mountH);
    ctx.lineTo(pivotX + hx + 6, pivotY - mountH - 7);
    ctx.stroke();
  }

  // Bearing Housing Clevis
  ctx.fillStyle = '#EEF0F8';
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 15, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 2. Equilibrium Centerline
  ctx.save();
  ctx.setLineDash([5, 6]);
  ctx.strokeStyle = '#8195B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(pivotX, pivotY + maxL + 30);
  ctx.stroke();
  ctx.restore();

  // 3. Angular Arc (Hidden during running simulation)
  if (!params.isPlaying && Math.abs(theta_deg) > 0.5) {
    ctx.save();
    const arcR = Math.min(65, L * 0.45);
    const rodAngle = Math.PI / 2 - theta;
    const verticalAngle = Math.PI / 2;
    const startAngle = Math.min(rodAngle, verticalAngle);
    const endAngle = Math.max(rodAngle, verticalAngle);

    ctx.beginPath();
    ctx.arc(pivotX, pivotY, arcR, startAngle, endAngle, false);
    ctx.strokeStyle = '#DF7940';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Soft warm tint in arc sweep
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.arc(pivotX, pivotY, arcR, startAngle, endAngle, false);
    ctx.closePath();
    ctx.fillStyle = 'rgba(223, 121, 64, 0.12)';
    ctx.fill();

    // Degree label badge (Semantic Orange annotation)
    const midAngle = (startAngle + endAngle) / 2;
    const lblDist = arcR + 24;
    const lblX = pivotX + lblDist * Math.cos(midAngle);
    const lblY = pivotY + lblDist * Math.sin(midAngle);
    const angleText = `θ₀ = ${Math.abs(theta_deg).toFixed(0)}°`;

    ctx.font = '700 11px "JetBrains Mono", monospace';
    const textWidth = ctx.measureText(angleText).width;
    const pillW = textWidth + 12;
    const pillH = 20;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#DF7940';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(lblX - pillW / 2, lblY - pillH / 2, pillW, pillH, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#DF7940';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(angleText, lblX, lblY);
    ctx.restore();
  }

  // 4. Rigid Body Beam (Rotated with Brushed Aluminum Chamfer & Navy Border)
  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(-theta);

  // Gleaming Aerospace Aluminum Gradient
  const beamGrad = ctx.createLinearGradient(-rodW / 2, 0, rodW / 2, 0);
  beamGrad.addColorStop(0, '#FFFFFF');
  beamGrad.addColorStop(0.2, '#EEF0F8');
  beamGrad.addColorStop(0.5, '#DCE1F0');
  beamGrad.addColorStop(0.85, '#CBD2E8');
  beamGrad.addColorStop(1, '#8195B8');

  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.roundRect(-rodW / 2, -14, rodW, L + 28, rodW / 2);
  ctx.fill();
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Central Weight Relief Channel
  const slotW = Math.max(6, rodW * 0.35);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(-slotW / 2, 16, slotW, L - 32, slotW / 2);
  ctx.fill();
  ctx.strokeStyle = '#CBD2E8';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center of Mass (CoM, G = L/2) Target Reticle (Semantic Orange Accent)
  const comY = L / 2;
  ctx.fillStyle = '#DF7940';
  ctx.beginPath(); ctx.arc(0, comY, 7, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#DF7940'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-10, comY); ctx.lineTo(10, comY);
  ctx.moveTo(0, comY - 10); ctx.lineTo(0, comY + 10);
  ctx.stroke();

  // Label G
  ctx.fillStyle = '#DF7940';
  ctx.font = '800 11px "Inter", sans-serif';
  ctx.fillText('G', 12, comY + 4);

  // Center of Percussion (CoP, Q = 2L/3) Target Reticle (Semantic Green)
  const copY = L * (2 / 3);
  ctx.fillStyle = '#2F7D5A';
  ctx.beginPath(); ctx.arc(0, copY, 6, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();

  // Label Q
  ctx.fillStyle = '#2F7D5A';
  ctx.font = '800 11px "Inter", sans-serif';
  ctx.fillText('Q', 12, copY + 4);

  ctx.restore();

  // 5. Dimension Annotation for Length & Center of Mass
  ctx.save();
  const perpX = -Math.cos(theta) * (rodW / 2 + 28);
  const perpY = Math.sin(theta) * (rodW / 2 + 28);
  const endX = pivotX + L * Math.sin(theta);
  const endY = pivotY + L * Math.cos(theta);

  const dimX1 = pivotX + perpX;
  const dimY1 = pivotY + perpY;
  const dimX2 = endX + perpX;
  const dimY2 = endY + perpY;

  ctx.strokeStyle = '#8195B8';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY); ctx.lineTo(dimX1, dimY1);
  ctx.moveTo(endX, endY); ctx.lineTo(dimX2, dimY2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(dimX1, dimY1); ctx.lineTo(dimX2, dimY2);
  ctx.stroke();

  // Dimension Pill
  const dimMidX = (dimX1 + dimX2) / 2;
  const dimMidY = (dimY1 + dimY2) / 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#DCE1F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(dimMidX - 32, dimMidY - 10, 64, 20, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#173770';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`L=${lengthVal.toFixed(2)} m`, dimMidX, dimMidY);
  ctx.restore();

  // 6. Pivot Bearing Axle
  drawCADJointPin(ctx, pivotX, pivotY, '#173770', 'O', 9);

  // HUD
  drawCanvasHUD(ctx, w, h, 'Compound Pendulum', {
    'Angle (θ)': `${theta_deg.toFixed(1)}°`,
    'Rod Length (L)': `${lengthVal.toFixed(2)} m`,
    'Mass (m)': `${massVal.toFixed(1)} kg`,
    'CoM (d = L/2)': `${(lengthVal / 2).toFixed(2)} m`,
    'CoP (Leff = 2L/3)': `${(2 * lengthVal / 3).toFixed(2)} m`
  });
}

// ── 3. Slider-Crank Renderer ──────────────────────────────────────────
export function drawSliderCrank(ctx, w, h, crank_angle_deg, simData, params = {}) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  const r_real = Number(params.crank_length) || 0.1;
  const l_real = Number(params.conn_length) || 0.3;
  const speed = Number(params.crank_speed) || 60;

  // Center horizontally and vertically for maximum prominence & clarity
  const originX = w * 0.26;
  const originY = h * 0.50;

  // DYNAMIC SCALING: scale mechanism to fill the viewport beautifully
  const totalMechLen = r_real + l_real;
  const scale = Math.min(w * 0.55, h * 0.44) / totalMechLen;

  const r = r_real * scale;
  const l = l_real * scale;
  const theta = (crank_angle_deg * Math.PI) / 180;

  const crankX = originX + r * Math.cos(theta);
  const crankY = originY - r * Math.sin(theta);

  const sinBeta = (r * Math.sin(theta)) / l;
  const cosBeta = Math.sqrt(Math.max(0, 1 - sinBeta * sinBeta));
  const sliderX = originX + r * Math.cos(theta) + l * cosBeta;
  const sliderY = originY;

  const xTDC = originX + (l - r);
  const xBDC = originX + (l + r);

  // 1. Slider Cylinder Guide Track (Precision Ground Bore with Hatches)
  ctx.save();
  const guideStart = xTDC - 45;
  const guideEnd = xBDC + 45;
  const guideLen = guideEnd - guideStart;
  const guideHalfH = 26;

  // Cylinder Top & Bottom Guide Walls (Machined Silver)
  ctx.fillStyle = '#FAFAFC';
  ctx.fillRect(guideStart, sliderY - guideHalfH - 12, guideLen, 12);
  ctx.fillRect(guideStart, sliderY + guideHalfH, guideLen, 12);

  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(guideStart, sliderY - guideHalfH - 12, guideLen, 12);
  ctx.strokeRect(guideStart, sliderY + guideHalfH, guideLen, 12);

  // Cylinder Hatchings
  ctx.strokeStyle = '#8195B8';
  ctx.lineWidth = 1.2;
  for (let hx = guideStart + 6; hx <= guideEnd - 6; hx += 12) {
    ctx.beginPath();
    ctx.moveTo(hx, sliderY - guideHalfH - 12);
    ctx.lineTo(hx + 8, sliderY - guideHalfH - 20);
    ctx.moveTo(hx, sliderY + guideHalfH + 12);
    ctx.lineTo(hx + 8, sliderY + guideHalfH + 20);
    ctx.stroke();
  }

  // Stroke Limits TDC / BDC Markers (Semantic Orange Limits)
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#DF7940';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(xTDC, sliderY - guideHalfH - 8); ctx.lineTo(xTDC, sliderY + guideHalfH + 8);
  ctx.moveTo(xBDC, sliderY - guideHalfH - 8); ctx.lineTo(xBDC, sliderY + guideHalfH + 8);
  ctx.stroke();
  ctx.setLineDash([]);

  // TDC & BDC Labels
  ctx.font = '800 11px "Inter", sans-serif';
  ctx.fillStyle = '#DF7940';
  ctx.textAlign = 'center';
  ctx.fillText('TDC', xTDC, sliderY - guideHalfH - 16);
  ctx.fillText('BDC', xBDC, sliderY - guideHalfH - 16);

  // Stroke Dimension Line
  ctx.strokeStyle = '#DF7940';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(xTDC, sliderY + guideHalfH + 22); ctx.lineTo(xBDC, sliderY + guideHalfH + 22);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#DCE1F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect((xTDC + xBDC) / 2 - 46, sliderY + guideHalfH + 12, 92, 20, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#173770';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Stroke=${(2 * r_real).toFixed(3)} m`, (xTDC + xBDC) / 2, sliderY + guideHalfH + 23);
  ctx.restore();

  // 2. Crank Pitch Orbit Circle
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = 'rgba(129, 149, 184, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(originX, originY, r, 0, 2 * Math.PI); ctx.stroke();
  ctx.restore();

  // 3. Main Bearing Pillar Support at Origin
  ctx.save();
  ctx.fillStyle = '#EEF0F8';
  ctx.beginPath();
  ctx.moveTo(originX - 16, originY + 36);
  ctx.lineTo(originX - 10, originY);
  ctx.arc(originX, originY, 14, Math.PI, 0);
  ctx.lineTo(originX + 16, originY + 36);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Foundation Ground Base
  ctx.fillStyle = '#DCE1F0';
  ctx.fillRect(originX - 24, originY + 36, 48, 8);
  ctx.strokeStyle = '#173770';
  ctx.strokeRect(originX - 24, originY + 36, 48, 8);
  ctx.restore();

  // 4. Crank Arm (Link 2 — Royal Blue Active Component)
  ctx.save();
  // Crank Arm Body
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 7.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(crankX, crankY); ctx.stroke();

  ctx.strokeStyle = '#264CB2';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(crankX, crankY); ctx.stroke();
  ctx.restore();

  // 5. Connecting Rod (Link 3 — Polished Active Cobalt Blue Link)
  ctx.save();
  ctx.strokeStyle = '#244AAF';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(crankX, crankY); ctx.lineTo(sliderX, sliderY); ctx.stroke();

  ctx.strokeStyle = '#6F8FF4';
  ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(crankX, crankY); ctx.lineTo(sliderX, sliderY); ctx.stroke();
  ctx.restore();

  // 6. Slider Block (Machined Aluminum Crosshead Piston with Navy Outline)
  ctx.save();
  const blockW = 58;
  const blockH = 40;
  const pGrad = ctx.createLinearGradient(sliderX - blockW / 2, 0, sliderX + blockW / 2, 0);
  pGrad.addColorStop(0, '#FFFFFF');
  pGrad.addColorStop(0.3, '#EEF0F8');
  pGrad.addColorStop(0.7, '#DCE1F0');
  pGrad.addColorStop(1, '#CBD2E8');

  ctx.fillStyle = pGrad;
  ctx.fillRect(sliderX - blockW / 2, sliderY - blockH / 2, blockW, blockH);
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 1.8;
  ctx.strokeRect(sliderX - blockW / 2, sliderY - blockH / 2, blockW, blockH);

  // 3 Compression ring grooves
  ctx.strokeStyle = '#8195B8';
  ctx.lineWidth = 1.5;
  for (const rx of [10, 16, 22]) {
    ctx.beginPath();
    ctx.moveTo(sliderX - blockW / 2 + rx, sliderY - blockH / 2 + 3);
    ctx.lineTo(sliderX - blockW / 2 + rx, sliderY + blockH / 2 - 3);
    ctx.stroke();
  }
  ctx.restore();

  // 7. Joint Pin Bearings (O, A, B)
  drawCADJointPin(ctx, originX, originY, '#173770', 'O', 8);
  drawCADJointPin(ctx, crankX, crankY, '#264CB2', 'A', 7);
  drawCADJointPin(ctx, sliderX, sliderY, '#3561EE', 'B', 7);

  // 8. Instantaneous Velocity Vector on Piston
  const omegaRad = speed * 2 * Math.PI / 60;
  const vInst = -r_real * omegaRad * (Math.sin(theta) + (r_real * Math.sin(2 * theta)) / (2 * l_real));
  drawVectorArrow(ctx, sliderX + (vInst >= 0 ? blockW / 2 : -blockW / 2), sliderY, vInst * 6, 0, '#DF7940', 'v_p', 2.0);

  // HUD
  drawCanvasHUD(ctx, w, h, 'Slider-Crank', {
    'Crank Angle (θ)': `${crank_angle_deg.toFixed(1)}°`,
    'Crank (r)': `${r_real.toFixed(3)} m`,
    'Conn Rod (l)': `${l_real.toFixed(3)} m`,
    'Speed (N)': `${speed} rpm`,
    'Obliquity (λ)': `${(r_real / l_real).toFixed(3)}`,
    'Piston Speed': `${Math.abs(vInst).toFixed(2)} m/s`
  });
}

// ── 4. Four-Bar Linkage Renderer ──────────────────────────────────────
export function drawFourBar(ctx, w, h, idx, simData, params = {}) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  const d_real = Number(params.link_ground) || 4.0;
  const a_real = Number(params.link_crank) || 1.0;
  const b_real = Number(params.link_coupler) || 2.5;
  const c_real = Number(params.link_rocker) || 3.0;

  // Kinematic bounding box calculation across full theoretical reach
  const xMinReal = Math.min(-a_real, d_real - c_real);
  const xMaxReal = Math.max(a_real, d_real + c_real);
  const yMinReal = -Math.max(a_real, c_real);
  const yMaxReal = Math.max(a_real, c_real);

  const spanX = Math.max(xMaxReal - xMinReal, 0.5);
  const spanY = Math.max(yMaxReal - yMinReal, 0.5);

  const marginX = w * 0.12;
  const marginY = h * 0.14;
  const availW = w - 2 * marginX;
  const availH = h - 2 * marginY;

  const scale = Math.min(availW / spanX, availH / spanY);

  const cxPhys = (xMinReal + xMaxReal) / 2;
  const cyPhys = (yMinReal + yMaxReal) / 2;

  const originX = w / 2 - cxPhys * scale;
  const originY = h / 2 + cyPhys * scale;

  let bx_m = simData?.bx?.[idx];
  let by_m = simData?.by?.[idx];
  let cx_m = simData?.cx?.[idx];
  let cy_m = simData?.cy?.[idx];
  let th2_deg = simData?.crank_angle_deg?.[idx];
  let th3_deg = simData?.coupler_angle_deg?.[idx];
  let th4_deg = simData?.rocker_angle_deg?.[idx];

  // If simData is not yet loaded, calculate static geometry at theta2 = 60°
  if (bx_m === undefined || by_m === undefined || cx_m === undefined || cy_m === undefined) {
    const th2 = Math.PI / 3;
    th2_deg = 60;
    bx_m = a_real * Math.cos(th2);
    by_m = a_real * Math.sin(th2);
    const distBD = Math.hypot(d_real - bx_m, by_m);
    const cosAngle = Math.max(-1, Math.min(1, (b_real * b_real + distBD * distBD - c_real * c_real) / (2 * b_real * distBD)));
    const angleB = Math.acos(cosAngle);
    const phi = Math.atan2(-by_m, d_real - bx_m);
    const th3 = phi + angleB;
    cx_m = bx_m + b_real * Math.cos(th3);
    cy_m = by_m + b_real * Math.sin(th3);
    th3_deg = (th3 * 180) / Math.PI;
    const th4 = Math.atan2(cy_m, cx_m - d_real);
    th4_deg = (th4 * 180) / Math.PI;
  }

  const ax = originX;
  const ay = originY;
  const bx = originX + bx_m * scale;
  const by = originY - by_m * scale;
  const cx = originX + cx_m * scale;
  const cy = originY - cy_m * scale;
  const dx = originX + d_real * scale;
  const dy = originY;

  // 1. Coupler Path Motion Trail (Active Blue Trajectory)
  if (simData?.coupler_x && simData.coupler_x.length > 1) {
    ctx.save();
    ctx.strokeStyle = 'rgba(53, 97, 238, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < simData.coupler_x.length; i += 2) {
      const px = originX + simData.coupler_x[i] * scale;
      const py = originY - simData.coupler_y[i] * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 2. Ground Frame Base Bar (Link 1) & Hatched Stands (A and D)
  ctx.save();
  ctx.strokeStyle = '#173770';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(dx, dy); ctx.stroke();

  const drawGroundSupport = (gx, gy) => {
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx - 15, gy + 18);
    ctx.lineTo(gx + 15, gy + 18);
    ctx.closePath();
    ctx.fillStyle = '#EEF0F8';
    ctx.fill();
    ctx.strokeStyle = '#173770';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ground hatches
    ctx.beginPath();
    ctx.moveTo(gx - 20, gy + 18);
    ctx.lineTo(gx + 20, gy + 18);
    ctx.stroke();

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#8195B8';
    for (let hx = -16; hx <= 16; hx += 7) {
      ctx.beginPath();
      ctx.moveTo(gx + hx, gy + 18);
      ctx.lineTo(gx + hx - 5, gy + 26);
      ctx.stroke();
    }
  };
  drawGroundSupport(ax, ay);
  drawGroundSupport(dx, dy);
  ctx.restore();

  // Helper to draw realistic mechanical link
  const drawDogboneLink = (x1, y1, x2, y2, colorBorder, colorFill, width) => {
    ctx.save();
    ctx.strokeStyle = colorBorder;
    ctx.lineWidth = width + 3;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    ctx.strokeStyle = colorFill;
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  };

  // 3. Link 2 (Crank — Blue Primary)
  drawDogboneLink(ax, ay, bx, by, '#173770', '#264CB2', 7);

  // 4. Link 3 (Coupler — Blue Active)
  drawDogboneLink(bx, by, cx, cy, '#244AAF', '#3561EE', 6.5);

  // 5. Link 4 (Rocker — Blue Light)
  drawDogboneLink(dx, dy, cx, cy, '#173770', '#6F8FF4', 7);

  // 6. Joint Pin Bearings (A, B, C, D) with Crisp CAD Labels
  drawCADJointPin(ctx, ax, ay, '#264CB2', 'A', 8);
  drawCADJointPin(ctx, bx, by, '#3561EE', 'B', 8);
  drawCADJointPin(ctx, cx, cy, '#6F8FF4', 'C', 8);
  drawCADJointPin(ctx, dx, dy, '#173770', 'D', 8);

  // 7. Link Dimension Tags
  const drawLinkTag = (x1, y1, x2, y2, text, color) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = color || '#DCE1F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx - 24, my - 9, 48, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color || '#173770';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, mx, my);
    ctx.restore();
  };

  drawLinkTag(ax, ay, bx, by, `a=${a_real.toFixed(1)}m`, '#264CB2');
  drawLinkTag(bx, by, cx, cy, `b=${b_real.toFixed(1)}m`, '#3561EE');
  drawLinkTag(dx, dy, cx, cy, `c=${c_real.toFixed(1)}m`, '#6F8FF4');
  drawLinkTag(ax, ay, dx, dy, `d=${d_real.toFixed(1)}m`, '#173770');

  // HUD
  drawCanvasHUD(ctx, w, h, 'Four-Bar Linkage', {
    'Crank (θ₂)': `${(th2_deg || 0).toFixed(1)}°`,
    'Coupler (θ₃)': `${(th3_deg || 0).toFixed(1)}°`,
    'Rocker (θ₄)': `${(th4_deg || 0).toFixed(1)}°`,
    'Crank Link (a)': `${a_real.toFixed(2)} m`,
    'Coupler Link (b)': `${b_real.toFixed(2)} m`,
    'Rocker Link (c)': `${c_real.toFixed(2)} m`,
    'Ground Link (d)': `${d_real.toFixed(2)} m`
  });
}
