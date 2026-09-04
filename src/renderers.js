// High-DPI Crisp Retina Canvas Renderers with Motion Trail & Kinematic Vector Arrows

// Helper: Vector Arrow Draw Function
function drawVectorArrow(ctx, fromX, fromY, vecX, vecY, color, label, scale = 1.0) {
  const vx = vecX * scale;
  const vy = vecY * scale;
  const mag = Math.hypot(vx, vy);
  if (mag < 2) return;

  const toX = fromX + vx;
  const toY = fromY + vy;
  const angle = Math.atan2(vy, vx);
  const headLen = Math.min(10, mag * 0.4);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

  // Arrow line
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

  // Vector label
  if (label) {
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText(label, toX + 6 * Math.cos(angle), toY + 6 * Math.sin(angle));
  }
  ctx.restore();
}

// Helper: On-Canvas Live HUD
function drawCanvasHUD(ctx, w, h, title, metrics = {}) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 8, 20, 0.75)';
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(14, 14, 210, 24 + Object.keys(metrics).length * 16, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#6366f1';
  ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`SYSTEM HUD // ${title.toUpperCase()}`, 24, 30);

  let y = 46;
  ctx.font = '600 11px "JetBrains Mono", monospace';
  for (const [key, val] of Object.entries(metrics)) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${key}:`, 24, y);
    ctx.fillStyle = '#06b6d4';
    ctx.fillText(`${val}`, 120, y);
    y += 16;
  }
  ctx.restore();
}

// Helper: Background Cyber Grid
function drawGrid(ctx, w, h) {
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.06)';
  ctx.lineWidth = 1;
  const step = 40;
  for (let i = step; i < w; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
  }
  for (let j = step; j < h; j += step) {
    ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke();
  }
}


// ─── Simple Pendulum Renderer ──────────────────────────────────────
export function drawSimplePendulum(ctx, w, h, theta_deg, params, omega = 0) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  const pivotX = w / 2;
  const pivotY = h * 0.18;
  const L = Math.min(h * 0.55, w * 0.35);
  const theta = (theta_deg * Math.PI) / 180;

  const bobX = pivotX + L * Math.sin(theta);
  const bobY = pivotY + L * Math.cos(theta);

  // Equilibrium Line
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(pivotX, pivotY + L + 30); ctx.stroke();
  ctx.setLineDash([]);

  // Arc Angle Overlay
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 50, Math.PI / 2 - Math.abs(theta), Math.PI / 2, theta < 0);
  ctx.stroke();

  // Glow under Bob
  const glowGrad = ctx.createRadialGradient(bobX, bobY, 0, bobX, bobY, 35);
  glowGrad.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
  glowGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath(); ctx.arc(bobX, bobY, 35, 0, 2 * Math.PI); ctx.fill();

  // Rod Line (Gradient)
  const rodGrad = ctx.createLinearGradient(pivotX, pivotY, bobX, bobY);
  rodGrad.addColorStop(0, 'rgba(148, 163, 184, 0.9)');
  rodGrad.addColorStop(1, '#6366f1');
  ctx.strokeStyle = rodGrad;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(bobX, bobY); ctx.stroke();

  // Pivot Base Pin
  ctx.fillStyle = '#1e293b';
  ctx.beginPath(); ctx.arc(pivotX, pivotY, 8, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2; ctx.stroke();

  // Pendulum Bob (Multi-stop Metallic Gradient)
  const bobGrad = ctx.createRadialGradient(bobX - 4, bobY - 4, 2, bobX, bobY, 18);
  bobGrad.addColorStop(0, '#818cf8');
  bobGrad.addColorStop(0.5, '#4f46e5');
  bobGrad.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = bobGrad;
  ctx.beginPath(); ctx.arc(bobX, bobY, 18, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 2; ctx.stroke();

  // Velocity Vector Arrow (\vec{v})
  const vMag = (omega || 0) * (L / 100);
  const vx = vMag * Math.cos(theta);
  const vy = -vMag * Math.sin(theta);
  drawVectorArrow(ctx, bobX, bobY, vx, vy, '#06b6d4', 'v', 25);

  // HUD
  drawCanvasHUD(ctx, w, h, 'Simple Pendulum', {
    'Angle (θ)': `${theta_deg.toFixed(1)}°`,
    'Length (L)': `${params.length || 1.0} m`,
    'Mass (m)': `${params.mass || 1.0} kg`
  });
}


// ─── Compound Pendulum Renderer ───────────────────────────────────
export function drawCompoundPendulum(ctx, w, h, theta_deg, params) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  const pivotX = w / 2;
  const pivotY = h * 0.15;
  const L = Math.min(h * 0.65, w * 0.38);
  const theta = (theta_deg * Math.PI) / 180;
  const rodW = 24;

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(theta);

  // Rectangular Rigid Body Bar
  const rodGrad = ctx.createLinearGradient(-rodW / 2, 0, rodW / 2, 0);
  rodGrad.addColorStop(0, '#0f172a');
  rodGrad.addColorStop(0.5, '#475569');
  rodGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = rodGrad;
  ctx.beginPath();
  ctx.roundRect(-rodW / 2, -10, rodW, L + 20, 10);
  ctx.fill();
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center of Mass (CoM) Marker
  const comY = L / 2;
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath(); ctx.arc(0, comY, 6, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.restore();

  // Pivot Bearing Pin
  ctx.fillStyle = '#0f172a';
  ctx.beginPath(); ctx.arc(pivotX, pivotY, 8, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 2; ctx.stroke();

  // HUD
  drawCanvasHUD(ctx, w, h, 'Compound Pendulum', {
    'Angle (θ)': `${theta_deg.toFixed(1)}°`,
    'Rod Length (L)': `${params.length || 1.0} m`,
    'Mass (m)': `${params.mass || 2.0} kg`
  });
}


// ─── Slider-Crank Renderer ─────────────────────────────────────────
export function drawSliderCrank(ctx, w, h, crank_angle_deg, simData, params) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  const originX = w * 0.22;
  const originY = h * 0.55;
  const scale = Math.min(w * 0.55, h * 0.4) / ((params.crank_length || 0.1) + (params.conn_length || 0.3));

  const r = (params.crank_length || 0.1) * scale;
  const l = (params.conn_length || 0.3) * scale;
  const theta = (crank_angle_deg * Math.PI) / 180;

  const crankX = originX + r * Math.cos(theta);
  const crankY = originY - r * Math.sin(theta);

  const sinBeta = (r * Math.sin(theta)) / l;
  const cosBeta = Math.sqrt(Math.max(0, 1 - sinBeta * sinBeta));
  const sliderX = originX + r * Math.cos(theta) + l * cosBeta;
  const sliderY = originY;

  // Slider Guide Track
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
  ctx.lineWidth = 2;
  ctx.fillRect(originX + r * 0.5, originY + 18, w * 0.65, 8);
  ctx.fillRect(originX + r * 0.5, originY - 26, w * 0.65, 8);
  ctx.strokeRect(originX + r * 0.5, originY + 18, w * 0.65, 8);
  ctx.strokeRect(originX + r * 0.5, originY - 26, w * 0.65, 8);

  // Crank Circle Trajectory Path
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
  ctx.beginPath(); ctx.arc(originX, originY, r, 0, 2 * Math.PI); ctx.stroke();
  ctx.setLineDash([]);

  // Crank Link (Red/Purple Metallic)
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(crankX, crankY); ctx.stroke();

  // Connecting Rod (Cyan Neon)
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(crankX, crankY); ctx.lineTo(sliderX, sliderY); ctx.stroke();

  // Crank Pin Joint
  ctx.fillStyle = '#6366f1';
  ctx.beginPath(); ctx.arc(crankX, crankY, 7, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

  // Slider Block
  const blockW = 44;
  const blockH = 32;
  ctx.fillStyle = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
  ctx.fillRect(sliderX - blockW / 2, sliderY - blockH / 2, blockW, blockH);
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2;
  ctx.strokeRect(sliderX - blockW / 2, sliderY - blockH / 2, blockW, blockH);

  // Origin Pin
  ctx.fillStyle = '#1e293b';
  ctx.beginPath(); ctx.arc(originX, originY, 9, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 2.5; ctx.stroke();

  // HUD
  drawCanvasHUD(ctx, w, h, 'Slider-Crank', {
    'Crank Angle (θ)': `${crank_angle_deg.toFixed(1)}°`,
    'Crank r': `${(params.crank_length || 0.1).toFixed(2)} m`,
    'Conn Rod l': `${(params.conn_length || 0.3).toFixed(2)} m`,
    'Speed N': `${params.crank_speed || 300} rpm`
  });
}


// ─── Four-Bar Mechanism Renderer ───────────────────────────────────
export function drawFourBar(ctx, w, h, idx, simData, params) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  if (!simData || !simData.coupler_x) return;

  const originX = w * 0.28;
  const originY = h * 0.65;
  const scale = Math.min(w * 0.45, h * 0.45) / Math.max(1, params.link_ground || 4.0);

  const ax = originX;
  const ay = originY;
  const bx = originX + (simData.bx?.[idx] || 0) * scale;
  const by = originY - (simData.by?.[idx] || 0) * scale;
  const cx = originX + (simData.cx?.[idx] || 0) * scale;
  const cy = originY - (simData.cy?.[idx] || 0) * scale;
  const dx = originX + (params.link_ground || 4.0) * scale;
  const dy = originY;

  // Coupler Path Motion Trail
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < simData.coupler_x.length; i += 2) {
    const px = originX + simData.coupler_x[i] * scale;
    const py = originY - simData.coupler_y[i] * scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Ground Frame Base Line
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(dx, dy); ctx.stroke();

  // Link 2 (Crank - Amber)
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();

  // Link 3 (Coupler - Cyan)
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();

  // Link 4 (Rocker - Emerald)
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke();

  // Joints Pins (A, B, C, D)
  const joints = [[ax, ay, '#f59e0b'], [bx, by, '#06b6d4'], [cx, cy, '#10b981'], [dx, dy, '#475569']];
  for (const [jx, jy, color] of joints) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(jx, jy, 7, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  }

  // HUD
  drawCanvasHUD(ctx, w, h, 'Four-Bar Linkage', {
    'Crank θ₂': `${(simData.crank_angle_deg?.[idx] || 0).toFixed(1)}°`,
    'Coupler θ₃': `${(simData.coupler_angle_deg?.[idx] || 0).toFixed(1)}°`,
    'Rocker θ₄': `${(simData.rocker_angle_deg?.[idx] || 0).toFixed(1)}°`
  });
}
