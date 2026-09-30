import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { solveFourBarPosition, computeReachableInputArc } from './core/kinematics.js';
import { checkFeasibility, FEASIBILITY_STATUS } from './core/feasibility.js';

// ─── Exact Closed-Form Four-Bar Kinematic Loop Closure Solver ──────────────────
// Uses unified Law of Cosines formulation from src/core/kinematics.js
// Loop closure constraint ||B - C|| == b guaranteed to machine precision.
function solveFourBarContinuous(d, a, b, c, theta2, prevTheta4 = null, openCircuit = true) {
  const sol = solveFourBarPosition(d, a, b, c, theta2, prevTheta4, openCircuit ? -1 : 1);
  return {
    success: Boolean(sol && sol.success),
    bx: (sol && sol.B) ? sol.B.x : 0,
    by: (sol && sol.B) ? sol.B.y : 0,
    cx: (sol && sol.C) ? sol.C.x : (d || 4.0),
    cy: (sol && sol.C) ? sol.C.y : 0,
    theta3: (sol && sol.theta3 !== undefined) ? sol.theta3 : 0,
    theta4: (sol && sol.theta4 !== undefined) ? sol.theta4 : 0,
    transmissionAngleDeg: (sol && sol.transmissionAngleDeg !== undefined) ? sol.transmissionAngleDeg : 0
  };
}

// ─── Dynamic Bounded Pendulum Visual Length Calculator ─────────────────────────
// Maps physical length L in [0.2m, 4.0m] smoothly to visual length [0.55m, 1.35m].
// With base floor grid at y = -1.65m, the lowest point of the bob never reaches
// below y = -1.52m, guaranteeing a clean clearance gap (>13cm) above the base.
function calcVisualLength(L_phys) {
  const clamped = Math.max(0.2, Math.min(4.0, Number(L_phys) || 1.0));
  if (clamped <= 1.0) {
    return 0.55 + ((clamped - 0.2) / 0.8) * 0.40; // 0.55m to 0.95m
  } else {
    return 0.95 + ((clamped - 1.0) / 3.0) * 0.40; // 0.95m to 1.35m
  }
}

// ─── CAD Part Builders ────────────────────────────────────────────────────────

// Builds a CNC-machined aerospace dogbone link with rounded bearing hubs,
// lightening pockets, bronze bushings, and steel center pin bores
function buildDogboneLink(length, width, thickness, mainMat, accentMat, steelMat) {
  const linkGroup = new THREE.Group();
  const hubRadius = Math.max(0.048, width * 0.74);
  const boreRadius = hubRadius * 0.42;

  // 1. Central CNC connecting beam
  const beamGeo = new THREE.BoxGeometry(length, width * 0.72, thickness);
  beamGeo.translate(length / 2, 0, 0);
  const beam = new THREE.Mesh(beamGeo, mainMat);
  beam.castShadow = true;
  beam.receiveShadow = true;
  linkGroup.add(beam);

  // 1b. Recessed weight-reduction pocket (billet aesthetic)
  if (length > width * 1.3) {
    const pocketLen = Math.max(0.03, length - hubRadius * 2.1);
    const pocketGeo = new THREE.BoxGeometry(pocketLen, width * 0.42, thickness * 1.05);
    pocketGeo.translate(length / 2, 0, 0);
    const pocket = new THREE.Mesh(pocketGeo, accentMat);
    linkGroup.add(pocket);
  }

  // 2. Hub Bosses at Joint 1 (x=0) and Joint 2 (x=length)
  const hubGeo = new THREE.CylinderGeometry(hubRadius, hubRadius, thickness, 32);
  hubGeo.rotateX(Math.PI / 2);

  const hubA = new THREE.Mesh(hubGeo, mainMat);
  hubA.castShadow = true;
  linkGroup.add(hubA);

  const hubB = new THREE.Mesh(hubGeo, mainMat);
  hubB.position.set(length, 0, 0);
  hubB.castShadow = true;
  linkGroup.add(hubB);

  // 3. Precision Bushing Rings
  const bushGeo = new THREE.CylinderGeometry(boreRadius * 1.35, boreRadius * 1.35, thickness * 1.02, 24);
  bushGeo.rotateX(Math.PI / 2);

  const bushA = new THREE.Mesh(bushGeo, accentMat);
  linkGroup.add(bushA);

  const bushB = new THREE.Mesh(bushGeo, accentMat);
  bushB.position.set(length, 0, 0);
  linkGroup.add(bushB);

  // 4. Center Bearing Core
  const coreGeo = new THREE.CylinderGeometry(boreRadius, boreRadius, thickness * 1.08, 24);
  coreGeo.rotateX(Math.PI / 2);

  const coreA = new THREE.Mesh(coreGeo, steelMat);
  linkGroup.add(coreA);

  const coreB = new THREE.Mesh(coreGeo, steelMat);
  coreB.position.set(length, 0, 0);
  linkGroup.add(coreB);

  return linkGroup;
}

// Builds high-performance H-beam connecting rod with split big-end cap & rod bolts
function buildHBeamConnectingRod(length, width, thickness, mainMat, capMat, steelMat) {
  const rodGroup = new THREE.Group();
  const bigEndRadius = width * 0.85;
  const smallEndRadius = width * 0.65;
  const webThickness = thickness * 0.42;

  // 1. Central H-beam flanges
  const topFlangeGeo = new THREE.BoxGeometry(length - bigEndRadius - smallEndRadius, width * 0.18, thickness);
  topFlangeGeo.translate(length / 2, width * 0.28, 0);
  const topFlange = new THREE.Mesh(topFlangeGeo, mainMat);
  topFlange.castShadow = true;
  rodGroup.add(topFlange);

  const botFlangeGeo = new THREE.BoxGeometry(length - bigEndRadius - smallEndRadius, width * 0.18, thickness);
  botFlangeGeo.translate(length / 2, -width * 0.28, 0);
  const botFlange = new THREE.Mesh(botFlangeGeo, mainMat);
  botFlange.castShadow = true;
  rodGroup.add(botFlange);

  // Central recessed web
  const webGeo = new THREE.BoxGeometry(length - bigEndRadius - smallEndRadius, width * 0.65, webThickness);
  webGeo.translate(length / 2, 0, 0);
  const web = new THREE.Mesh(webGeo, capMat);
  rodGroup.add(web);

  // 2. Big-End Journal & Split Bearing Cap (x=0)
  const bigHubGeo = new THREE.CylinderGeometry(bigEndRadius, bigEndRadius, thickness, 32);
  bigHubGeo.rotateX(Math.PI / 2);
  const bigHub = new THREE.Mesh(bigHubGeo, mainMat);
  bigHub.castShadow = true;
  rodGroup.add(bigHub);

  // Big-end split cap separation line & rod bolts
  [-bigEndRadius * 0.72, bigEndRadius * 0.72].forEach(yPos => {
    const boltGeo = new THREE.CylinderGeometry(0.012, 0.012, thickness * 1.15, 12);
    boltGeo.rotateX(Math.PI / 2);
    const bolt = new THREE.Mesh(boltGeo, steelMat);
    bolt.position.set(-0.02, yPos, 0);
    rodGroup.add(bolt);
  });

  // Big-end bronze bearing shell
  const bigBushGeo = new THREE.CylinderGeometry(bigEndRadius * 0.58, bigEndRadius * 0.58, thickness * 1.05, 24);
  bigBushGeo.rotateX(Math.PI / 2);
  const bigBush = new THREE.Mesh(bigBushGeo, capMat);
  rodGroup.add(bigBush);

  // 3. Small-End Wrist Pin Eyelet (x=length)
  const smallHubGeo = new THREE.CylinderGeometry(smallEndRadius, smallEndRadius, thickness * 0.9, 32);
  smallHubGeo.rotateX(Math.PI / 2);
  const smallHub = new THREE.Mesh(smallHubGeo, mainMat);
  smallHub.position.set(length, 0, 0);
  smallHub.castShadow = true;
  rodGroup.add(smallHub);

  const smallBushGeo = new THREE.CylinderGeometry(smallEndRadius * 0.55, smallEndRadius * 0.55, thickness * 0.95, 24);
  smallBushGeo.rotateX(Math.PI / 2);
  const smallBush = new THREE.Mesh(smallBushGeo, capMat);
  smallBush.position.set(length, 0, 0);
  rodGroup.add(smallBush);

  return rodGroup;
}

// Builds high-detail cylindrical piston with 3 compression ring grooves and wrist pin
function buildDetailedPiston(radius, length, bodyMat, ringMat, pinMat) {
  const pistonGroup = new THREE.Group();

  // Piston cylindrical body (aligned along X axis)
  const bodyGeo = new THREE.CylinderGeometry(radius, radius, length, 32);
  bodyGeo.rotateZ(Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  pistonGroup.add(bodyMesh);

  // Machined dome crown on piston head (faces +X direction toward cylinder head & combustion chamber)
  const crownGeo = new THREE.CylinderGeometry(radius, radius * 0.96, 0.03, 32);
  crownGeo.rotateZ(Math.PI / 2);
  crownGeo.translate(length / 2 + 0.015, 0, 0);
  const crownMesh = new THREE.Mesh(crownGeo, bodyMat);
  pistonGroup.add(crownMesh);

  // 3 Distinct Dark Steel Piston Rings near crown (Top compression, second compression, oil control)
  [0.32, 0.22, 0.12].forEach(offsetFrac => {
    const ringGeo = new THREE.TorusGeometry(radius + 0.003, 0.005, 12, 32);
    ringGeo.rotateY(Math.PI / 2);
    ringGeo.translate(length * offsetFrac, 0, 0);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    pistonGroup.add(ringMesh);
  });

  // Skirt window lightening cutouts (faces -X direction toward connecting rod entrance)
  const skirtCutGeo = new THREE.BoxGeometry(length * 0.45, radius * 1.5, radius * 0.7);
  skirtCutGeo.translate(-length * 0.22, 0, 0);
  const skirtCut = new THREE.Mesh(skirtCutGeo, ringMat);
  pistonGroup.add(skirtCut);

  // Through Gudgeon Wrist Pin
  const wristGeo = new THREE.CylinderGeometry(radius * 0.32, radius * 0.32, radius * 2.1, 24);
  wristGeo.rotateX(Math.PI / 2);
  const wristMesh = new THREE.Mesh(wristGeo, pinMat);
  pistonGroup.add(wristMesh);

  return pistonGroup;
}

// ── Dimension Label Sprite Creator (Engineered Floating HUD Badges) ─────────
function createDimensionLabel(text, position, color = '#f8fafc', bgColor = 'rgba(23, 55, 112, 0.88)') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 256, 64);

  // Rounded pill background
  ctx.fillStyle = bgColor;
  const r = 12;
  const w = 240;
  const h = 48;
  const x = 8;
  const y = 8;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();

  // Cool blue border
  ctx.strokeStyle = 'rgba(53, 97, 238, 0.6)';
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // Monospace engineering label typography
  ctx.font = 'bold 20px "JetBrains Mono", Consolas, monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);

  const spriteTex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: spriteTex,
    transparent: true,
    depthTest: false,
    sizeAttenuation: true
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.copy(position);
  sprite.scale.set(0.55, 0.14, 1);
  return sprite;
}

const createLabelSprite = (text, position, color = '#f8fafc', bgColor = 'rgba(23, 55, 112, 0.88)') =>
  createDimensionLabel(text, position, color, bgColor);

// ── Dynamic Updatable HUD Badge for Real-time Velocity & Angle Telemetry ────
function createDynamicHUDLabel(initialText, position, scale = [0.65, 0.16, 1]) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  const spriteTex = new THREE.CanvasTexture(canvas);
  spriteTex.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: spriteTex,
    transparent: true,
    depthTest: false,
    sizeAttenuation: true
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.copy(position);
  sprite.scale.set(scale[0], scale[1], scale[2]);

  let lastText = '';
  let lastCol = '';

  const update = (text, color = '#38bdf8', borderColor = 'rgba(56, 189, 248, 0.65)', bgColor = 'rgba(15, 23, 42, 0.88)') => {
    if (text === lastText && color === lastCol) return;
    lastText = text;
    lastCol = color;

    ctx.clearRect(0, 0, 320, 72);
    const r = 12, w = 304, h = 56, x = 8, y = 8;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.font = 'bold 22px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 160, 36);
    spriteTex.needsUpdate = true;
  };

  update(initialText);
  return { sprite, update, canvas, spriteTex, spriteMat };
}

// ── Precision Rotary Protractor Dial for Drive Spindle Axis ─────────────────
function buildRotaryProtractor(radius, color = 0x3561ee) {
  const dialGroup = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(radius * 0.985, radius * 1.015, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  dialGroup.add(new THREE.Mesh(ringGeo, ringMat));

  const tickMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 });
  const majorTickMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 });

  for (let deg = 0; deg < 360; deg += 30) {
    const rad = (deg * Math.PI) / 180;
    const isMajor = deg % 90 === 0;
    const innerR = radius * (isMajor ? 0.86 : 0.92);
    const outerR = radius * 1.08;
    const pts = [
      new THREE.Vector3(innerR * Math.cos(rad), innerR * Math.sin(rad), 0.002),
      new THREE.Vector3(outerR * Math.cos(rad), outerR * Math.sin(rad), 0.002)
    ];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    dialGroup.add(new THREE.Line(lineGeo, isMajor ? majorTickMat : tickMat));
  }
  return dialGroup;
}

// ── 3D Kinematic Velocity Vector Arrow Mesh Builder ─────────────────────────
function createVectorMesh(material) {
  const group = new THREE.Group();
  const stemGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.32, 16);
  stemGeo.translate(0, 0.16, 0);
  const stem = new THREE.Mesh(stemGeo, material);
  stem.castShadow = true;
  group.add(stem);

  const coneGeo = new THREE.ConeGeometry(0.038, 0.10, 16);
  coneGeo.translate(0, 0.37, 0);
  const cone = new THREE.Mesh(coneGeo, material);
  cone.castShadow = true;
  group.add(cone);

  group.visible = false;
  return group;
}

// ── Heavy CNC Machine Bed Plate with Center T-Slot and Chamfers ─────────────
function buildMachineBed(length, width, height, mountMat, darkMat, steelMat) {
  const bedGroup = new THREE.Group();

  // 1. Heavy CNC Extruded Aluminum Bed Beam
  const beamGeo = new THREE.BoxGeometry(length, height, width);
  beamGeo.translate(length / 2, -height / 2, 0);
  const beam = new THREE.Mesh(beamGeo, mountMat);
  beam.castShadow = true;
  beam.receiveShadow = true;
  bedGroup.add(beam);

  // 1b. Beveled Top Chamfer Strips along front and rear edges
  const bevelThick = 0.016;
  [-width / 2 + bevelThick / 2, width / 2 - bevelThick / 2].forEach(zPos => {
    const bevelGeo = new THREE.BoxGeometry(length, bevelThick, bevelThick);
    bevelGeo.translate(length / 2, -bevelThick / 2, zPos);
    const bevelMesh = new THREE.Mesh(bevelGeo, steelMat);
    bedGroup.add(bevelMesh);
  });

  // 2. Center Milled Longitudinal T-Slot Guide Channel
  const slotWidth = 0.08;
  const slotDepth = 0.022;
  const slotGeo = new THREE.BoxGeometry(length * 0.94, slotDepth, slotWidth);
  slotGeo.translate(length / 2, -slotDepth / 2, 0);
  const slotMesh = new THREE.Mesh(slotGeo, darkMat);
  bedGroup.add(slotMesh);

  // 3. Front End Cap with Socket-Head Cap Screws (Hex Bolts)
  const capThickness = 0.04;
  const frontCapGeo = new THREE.BoxGeometry(capThickness, height * 1.08, width * 1.04);
  frontCapGeo.translate(-capThickness / 2, -height / 2, 0);
  const frontCap = new THREE.Mesh(frontCapGeo, mountMat);
  frontCap.castShadow = true;
  bedGroup.add(frontCap);

  // Rear End Cap
  const rearCapGeo = new THREE.BoxGeometry(capThickness, height * 1.08, width * 1.04);
  rearCapGeo.translate(length + capThickness / 2, -height / 2, 0);
  const rearCap = new THREE.Mesh(rearCapGeo, mountMat);
  rearCap.castShadow = true;
  bedGroup.add(rearCap);

  // Hex Socket Bolts on Front Cap
  [
    [-capThickness - 0.005, -height * 0.25, -width * 0.35],
    [-capThickness - 0.005, -height * 0.75, -width * 0.35],
    [-capThickness - 0.005, -height * 0.25, width * 0.35],
    [-capThickness - 0.005, -height * 0.75, width * 0.35]
  ].forEach(([bx, by, bz]) => {
    const bGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.018, 6);
    bGeo.rotateZ(Math.PI / 2);
    const bMesh = new THREE.Mesh(bGeo, steelMat);
    bMesh.position.set(bx, by, bz);
    bedGroup.add(bMesh);
  });

  return bedGroup;
}

// ── Schematic Slider-Crank CAD Builders (Matching Reference Image) ──────────

// 1. Circular Dark Housing Disc with Gold Perimeter Rim, Pedestal & Arched Cap
function buildSchematicHousingAndStand(r, discRadius, darkDiscMat, goldRimMat, standMat, archMat, pinMat) {
  const root = new THREE.Group();

  // Dark Circular Housing Disc (Behind mechanism)
  const discThickness = 0.035;
  const discGeo = new THREE.CylinderGeometry(discRadius, discRadius, discThickness, 64);
  discGeo.rotateX(Math.PI / 2);
  discGeo.translate(0, 0, -discThickness / 2 - 0.015);
  const discMesh = new THREE.Mesh(discGeo, darkDiscMat);
  discMesh.receiveShadow = true;
  root.add(discMesh);

  // Gold / Brass Outer Rim Ring
  const rimGeo = new THREE.TorusGeometry(discRadius, 0.010, 16, 64);
  rimGeo.translate(0, 0, -0.015);
  const rimMesh = new THREE.Mesh(rimGeo, goldRimMat);
  root.add(rimMesh);

  // Center Pedestal Stand below center pivot
  const standWidth = discRadius * 0.52;
  const standHeight = discRadius * 0.72;
  const standThick = 0.028;
  const standGeo = new THREE.BoxGeometry(standWidth, standHeight, standThick);
  standGeo.translate(0, -standHeight / 2, -0.008);
  const standMesh = new THREE.Mesh(standGeo, standMat);
  standMesh.castShadow = true;
  root.add(standMesh);

  // Stand Horizontal Foot Pad at bottom
  const footWidth = standWidth * 1.35;
  const footThick = 0.022;
  const footDepth = 0.065;
  const footGeo = new THREE.BoxGeometry(footWidth, footThick, footDepth);
  footGeo.translate(0, -standHeight - footThick / 2, -0.008);
  const footMesh = new THREE.Mesh(footGeo, standMat);
  footMesh.castShadow = true;
  root.add(footMesh);

  // Silver / Chrome Semicircular Arched Bearing Cap over center pivot
  const archInnerR = 0.048;
  const archOuterR = 0.072;
  const archGeo = new THREE.TorusGeometry((archInnerR + archOuterR) / 2, (archOuterR - archInnerR) / 2, 16, 32, Math.PI);
  archGeo.translate(0, 0, 0.026);
  const archMesh = new THREE.Mesh(archGeo, archMat);
  archMesh.castShadow = true;
  root.add(archMesh);

  // Central bearing pivot pin
  const pinGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.065, 24);
  pinGeo.rotateX(Math.PI / 2);
  pinGeo.translate(0, 0, 0.015);
  const pinMesh = new THREE.Mesh(pinGeo, pinMat);
  root.add(pinMesh);

  return root;
}

// 2. Golden-Yellow Crank Link with Counter-Tail and Crankpin
function buildSchematicCrankLink(r, goldMat, pinMat) {
  const rotatingGroup = new THREE.Group();

  const crankWidth = 0.068;
  const crankThick = 0.030;
  const tailLen = r * 0.65; // Left extension matching reference
  const totalLen = r + tailLen;

  // Main golden link bar spanning [-tailLen, r]
  const barGeo = new THREE.BoxGeometry(totalLen, crankWidth, crankThick);
  barGeo.translate((r - tailLen) / 2, 0, 0);
  const barMesh = new THREE.Mesh(barGeo, goldMat);
  barMesh.castShadow = true;
  rotatingGroup.add(barMesh);

  // Left counter-tail rounded end
  const leftEndGeo = new THREE.CylinderGeometry(crankWidth / 2, crankWidth / 2, crankThick, 24);
  leftEndGeo.rotateX(Math.PI / 2);
  leftEndGeo.translate(-tailLen, 0, 0);
  const leftEnd = new THREE.Mesh(leftEndGeo, goldMat);
  leftEnd.castShadow = true;
  rotatingGroup.add(leftEnd);

  // Right crankpin hub at x = r
  const rightHubGeo = new THREE.CylinderGeometry(crankWidth * 0.60, crankWidth * 0.60, crankThick * 1.08, 32);
  rightHubGeo.rotateX(Math.PI / 2);
  rightHubGeo.translate(r, 0, 0);
  const rightHub = new THREE.Mesh(rightHubGeo, goldMat);
  rightHub.castShadow = true;
  rotatingGroup.add(rightHub);

  // Silver crankpin at x = r
  const crankpinGeo = new THREE.CylinderGeometry(0.022, 0.022, crankThick * 1.35, 24);
  crankpinGeo.rotateX(Math.PI / 2);
  crankpinGeo.translate(r, 0, 0);
  const crankpin = new THREE.Mesh(crankpinGeo, pinMat);
  crankpin.castShadow = true;
  rotatingGroup.add(crankpin);

  // Center pivot boss at x = 0
  const centerHubGeo = new THREE.CylinderGeometry(crankWidth * 0.58, crankWidth * 0.58, crankThick * 1.05, 32);
  centerHubGeo.rotateX(Math.PI / 2);
  const centerHub = new THREE.Mesh(centerHubGeo, goldMat);
  rotatingGroup.add(centerHub);

  return rotatingGroup;
}

// 3. Sleek Light-Cyan Connecting Rod Link
function buildSchematicConnectingRod(l, cyanMat, pinMat) {
  const rodGroup = new THREE.Group();

  const rodWidth = 0.046;
  const rodThick = 0.026;
  const hubR = 0.040;

  // Main cyan connecting beam
  const beamGeo = new THREE.BoxGeometry(l, rodWidth, rodThick);
  beamGeo.translate(l / 2, 0, 0);
  const beam = new THREE.Mesh(beamGeo, cyanMat);
  beam.castShadow = true;
  rodGroup.add(beam);

  // Big-end hub (x = 0)
  const hubA = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR, rodThick * 1.10, 24), cyanMat);
  hubA.rotateX(Math.PI / 2);
  hubA.castShadow = true;
  rodGroup.add(hubA);

  // Small-end hub (x = l)
  const hubB = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR, rodThick * 1.10, 24), cyanMat);
  hubB.rotateX(Math.PI / 2);
  hubB.position.set(l, 0, 0);
  hubB.castShadow = true;
  rodGroup.add(hubB);

  // Center wrist pin at small-end
  const pinGeo = new THREE.CylinderGeometry(0.018, 0.018, rodThick * 1.30, 20);
  pinGeo.rotateX(Math.PI / 2);
  pinGeo.translate(l, 0, 0);
  const pin = new THREE.Mesh(pinGeo, pinMat);
  rodGroup.add(pin);

  return rodGroup;
}

// 4. Horizontal Guide Rails & Translucent Cyan Glass Chamber
function buildSchematicCylinderAndRails(l, r, pistonHeight, pistonWidth, railMat, cyanGlassMat, shelfMat) {
  const cylGroup = new THREE.Group();

  const stroke = 2 * r;
  const chamberLen = stroke + pistonWidth + 0.30;
  const chamberCenter = l;
  const chamberHeight = pistonHeight * 1.25;
  const chamberDepth = pistonHeight * 1.15;

  // 1. Horizontal Guide Rails (Top and Bottom dark rails extending past chamber)
  const railLen = chamberLen + 0.50;
  const railThick = 0.020;
  const railWidth = 0.035;

  // Top Rail
  const topRailGeo = new THREE.BoxGeometry(railLen, railThick, railWidth);
  topRailGeo.translate(chamberCenter, chamberHeight / 2 + railThick / 2, 0.015);
  const topRail = new THREE.Mesh(topRailGeo, railMat);
  topRail.castShadow = true;
  cylGroup.add(topRail);

  // Bottom Rail
  const btmRailGeo = new THREE.BoxGeometry(railLen, railThick, railWidth);
  btmRailGeo.translate(chamberCenter, -chamberHeight / 2 - railThick / 2, 0.015);
  const btmRail = new THREE.Mesh(btmRailGeo, railMat);
  btmRail.castShadow = true;
  cylGroup.add(btmRail);

  // 2. Translucent Cyan Glass Cylinder Body
  const glassGeo = new THREE.BoxGeometry(chamberLen, chamberHeight, chamberDepth);
  glassGeo.translate(chamberCenter, 0, 0.015);
  const glassMesh = new THREE.Mesh(glassGeo, cyanGlassMat);
  cylGroup.add(glassMesh);

  // 3. Subtle Glowing Cyan Shelf Underneath
  const shelfLen = chamberLen * 0.72;
  const shelfGeo = new THREE.BoxGeometry(shelfLen, 0.008, 0.032);
  shelfGeo.translate(chamberCenter, -chamberHeight / 2 - 0.045, 0.015);
  const shelfMesh = new THREE.Mesh(shelfGeo, shelfMat);
  cylGroup.add(shelfMesh);

  return { cylGroup, chamberCenter, chamberLen };
}

// 5. Royal Blue Rectangular Piston Block with Golden Compression Rings & Wrist Pin
function buildSchematicPiston(width, height, depth, blueMat, goldMat, pinMat) {
  const pistonGroup = new THREE.Group();

  // Royal Blue Piston Body Block
  const bodyGeo = new THREE.BoxGeometry(width, height, depth);
  const bodyMesh = new THREE.Mesh(bodyGeo, blueMat);
  bodyMesh.castShadow = true;
  pistonGroup.add(bodyMesh);

  // Two Vertical Golden Yellow Rings
  const ringWidth = 0.016;
  const ringHeight = height * 1.02;
  const ringDepth = depth * 1.02;

  // Left ring at x = -width * 0.30
  const leftRingGeo = new THREE.BoxGeometry(ringWidth, ringHeight, ringDepth);
  leftRingGeo.translate(-width * 0.30, 0, 0);
  const leftRing = new THREE.Mesh(leftRingGeo, goldMat);
  pistonGroup.add(leftRing);

  // Right ring at x = +width * 0.30
  const rightRingGeo = new THREE.BoxGeometry(ringWidth, ringHeight, ringDepth);
  rightRingGeo.translate(width * 0.30, 0, 0);
  const rightRing = new THREE.Mesh(rightRingGeo, goldMat);
  pistonGroup.add(rightRing);

  // Central Silver Circular Wrist Pin
  const pinGeo = new THREE.CylinderGeometry(0.024, 0.024, depth * 1.08, 24);
  pinGeo.rotateX(Math.PI / 2);
  const pinMesh = new THREE.Mesh(pinGeo, pinMat);
  pistonGroup.add(pinMesh);

  return pistonGroup;
}

// ── Precision Brushed Flywheel & Dual-Balanced Crank Arm Assembly ───────────
function buildFlywheelAndCrank(r, rFlywheel, mountMat, discMat, blueMat, webMat, pinMat, chromeMat) {
  const root = new THREE.Group();

  // Stationary Bearing Pedestal Block behind the flywheel (x=0)
  const pedestalGeo = new THREE.BoxGeometry(0.32, 0.46, 0.36);
  pedestalGeo.translate(0, -0.16, -0.18);
  const pedestal = new THREE.Mesh(pedestalGeo, mountMat);
  pedestal.castShadow = true;
  root.add(pedestal);

  // Bearing Cap bolted to Pedestal
  const capGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.38, 24);
  capGeo.rotateX(Math.PI / 2);
  capGeo.translate(0, 0, -0.18);
  const cap = new THREE.Mesh(capGeo, mountMat);
  root.add(cap);

  // 4 Hex Bolts on Bearing Cap
  [
    [-0.10, 0.05, -0.05],
    [0.10, 0.05, -0.05],
    [-0.10, -0.05, -0.05],
    [0.10, -0.05, -0.05]
  ].forEach(([bx, by, bz]) => {
    const boltGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6);
    boltGeo.rotateX(Math.PI / 2);
    const bolt = new THREE.Mesh(boltGeo, pinMat);
    bolt.position.set(bx, by, bz);
    root.add(bolt);
  });

  // Main Shaft through bearing
  const shaftGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.38, 24);
  shaftGeo.rotateX(Math.PI / 2);
  shaftGeo.translate(0, 0, -0.12);
  const shaft = new THREE.Mesh(shaftGeo, pinMat);
  root.add(shaft);

  // ── ROTATING ASSEMBLY (Flywheel Disc + Crank Arm + Counterweight Arm) ──
  const rotatingGroup = new THREE.Group();

  // 1. Large Brushed Aluminum Flywheel Disc
  const discGeo = new THREE.CylinderGeometry(rFlywheel, rFlywheel, 0.045, 64);
  discGeo.rotateX(Math.PI / 2);
  discGeo.translate(0, 0, -0.04);
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.castShadow = true;
  rotatingGroup.add(disc);

  // 1b. Concentric Machined Face Grooves
  [rFlywheel * 0.42, rFlywheel * 0.72, rFlywheel * 0.94].forEach(rRing => {
    const ringGeo = new THREE.TorusGeometry(rRing, 0.004, 8, 64);
    ringGeo.translate(0, 0, -0.016);
    const ringMesh = new THREE.Mesh(ringGeo, pinMat);
    rotatingGroup.add(ringMesh);
  });

  // 1c. Radial Graduation Tick Marks (24 divisions, with 4 primary quadrant lines highlighted in cyan/blue)
  const tickMatMinor = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.65 });
  const tickMatMajor = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2, transparent: true, opacity: 0.95 });

  for (let deg = 0; deg < 360; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    const isMajor = deg % 90 === 0;
    const innerR = rFlywheel * (isMajor ? 0.25 : 0.65);
    const outerR = rFlywheel * 0.95;
    const pts = [
      new THREE.Vector3(innerR * Math.cos(rad), innerR * Math.sin(rad), -0.015),
      new THREE.Vector3(outerR * Math.cos(rad), outerR * Math.sin(rad), -0.015)
    ];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), isMajor ? tickMatMajor : tickMatMinor);
    rotatingGroup.add(line);
  }

  // 2. Stepped Center Hub Collar
  const hubGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 32);
  hubGeo.rotateX(Math.PI / 2);
  hubGeo.translate(0, 0, -0.01);
  const hubMesh = new THREE.Mesh(hubGeo, blueMat);
  rotatingGroup.add(hubMesh);

  // Inner chrome faceplate
  const innerFaceGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.055, 32);
  innerFaceGeo.rotateX(Math.PI / 2);
  innerFaceGeo.translate(0, 0, -0.005);
  const innerFace = new THREE.Mesh(innerFaceGeo, chromeMat);
  rotatingGroup.add(innerFace);

  // 3. Main Crank Arm (x=0 to x=r)
  const armWidth = 0.082;
  const armThick = 0.044;

  // Blue outer border
  const armFlangeGeo = new THREE.BoxGeometry(r, armWidth, armThick);
  armFlangeGeo.translate(r / 2, 0, 0.02);
  const armFlange = new THREE.Mesh(armFlangeGeo, blueMat);
  armFlange.castShadow = true;
  rotatingGroup.add(armFlange);

  // Silver inner web
  const armWebGeo = new THREE.BoxGeometry(r * 0.85, armWidth * 0.60, armThick * 1.05);
  armWebGeo.translate(r / 2, 0, 0.02);
  const armWeb = new THREE.Mesh(armWebGeo, webMat);
  rotatingGroup.add(armWeb);

  // Hub boss at crankpin (x=r)
  const crankBossGeo = new THREE.CylinderGeometry(armWidth * 0.65, armWidth * 0.65, armThick, 32);
  crankBossGeo.rotateX(Math.PI / 2);
  crankBossGeo.translate(r, 0, 0.02);
  const crankBoss = new THREE.Mesh(crankBossGeo, blueMat);
  crankBoss.castShadow = true;
  rotatingGroup.add(crankBoss);

  // Crankpin Journal Pin extending forward to receive the connecting rod
  const pinGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.16, 24);
  pinGeo.rotateX(Math.PI / 2);
  pinGeo.translate(r, 0, 0.08);
  const crankPin = new THREE.Mesh(pinGeo, pinMat);
  crankPin.castShadow = true;
  rotatingGroup.add(crankPin);

  // 4. 180° Counterweight Arm (extending opposite at x = -r * 0.72)
  const cwLen = r * 0.72;
  const cwFlangeGeo = new THREE.BoxGeometry(cwLen, armWidth * 0.90, armThick);
  cwFlangeGeo.translate(-cwLen / 2, 0, 0.02);
  const cwFlange = new THREE.Mesh(cwFlangeGeo, blueMat);
  cwFlange.castShadow = true;
  rotatingGroup.add(cwFlange);

  const cwWebGeo = new THREE.BoxGeometry(cwLen * 0.80, armWidth * 0.55, armThick * 1.05);
  cwWebGeo.translate(-cwLen / 2, 0, 0.02);
  const cwWeb = new THREE.Mesh(cwWebGeo, webMat);
  rotatingGroup.add(cwWeb);

  // Royal blue cylindrical counterweight boss at the end (matching reference image!)
  const cwBossRadius = armWidth * 0.68;
  const cwBossGeo = new THREE.CylinderGeometry(cwBossRadius, cwBossRadius, 0.075, 32);
  cwBossGeo.rotateX(Math.PI / 2);
  cwBossGeo.translate(-cwLen, 0, 0.025);
  const cwBoss = new THREE.Mesh(cwBossGeo, blueMat);
  cwBoss.castShadow = true;
  rotatingGroup.add(cwBoss);

  // Center axle cap on counterweight boss
  const cwCapGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.082, 20);
  cwCapGeo.rotateX(Math.PI / 2);
  cwCapGeo.translate(-cwLen, 0, 0.025);
  const cwCap = new THREE.Mesh(cwCapGeo, pinMat);
  rotatingGroup.add(cwCap);

  root.add(rotatingGroup);

  return { root, rotatingGroup };
}

// ── Builds High-Detail Cylindrical Piston with 3 Copper Rings and Pushrod ───
function buildDetailedPistonWithRings(radius, length, steelMat, copperMat, chromeMat) {
  const pistonGroup = new THREE.Group();

  // 1. Polished Solid Steel Piston Body
  const bodyGeo = new THREE.CylinderGeometry(radius, radius, length, 36);
  bodyGeo.rotateZ(Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyGeo, steelMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  pistonGroup.add(bodyMesh);

  // 2. Machined Dome Crown (faces +X)
  const crownGeo = new THREE.CylinderGeometry(radius, radius * 0.95, 0.03, 36);
  crownGeo.rotateZ(Math.PI / 2);
  crownGeo.translate(length / 2 + 0.015, 0, 0);
  const crownMesh = new THREE.Mesh(crownGeo, steelMat);
  pistonGroup.add(crownMesh);

  // 3. 3 Visible Copper / Bronze Compression Rings (Matching reference image!)
  [0.32, 0.20, 0.08].forEach(offsetFrac => {
    const ringGeo = new THREE.TorusGeometry(radius + 0.003, 0.006, 12, 36);
    ringGeo.rotateY(Math.PI / 2);
    ringGeo.translate(length * offsetFrac, 0, 0);
    const ringMesh = new THREE.Mesh(ringGeo, copperMat);
    pistonGroup.add(ringMesh);
  });

  // 4. Polished Chrome Pushrod extending from front of piston (-X direction)
  const pushrodLen = 0.28;
  const pushrodGeo = new THREE.CylinderGeometry(0.024, 0.024, pushrodLen, 24);
  pushrodGeo.rotateZ(Math.PI / 2);
  pushrodGeo.translate(-length / 2 - pushrodLen / 2, 0, 0);
  const pushrodMesh = new THREE.Mesh(pushrodGeo, chromeMat);
  pushrodMesh.castShadow = true;
  pistonGroup.add(pushrodMesh);

  // 5. Connecting clevis joint collar at tip of pushrod to meet connecting rod
  const clevisGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.048, 24);
  clevisGeo.rotateX(Math.PI / 2);
  clevisGeo.translate(-length / 2 - pushrodLen, 0, 0);
  const clevisMesh = new THREE.Mesh(clevisGeo, copperMat);
  pistonGroup.add(clevisMesh);

  return { pistonGroup, pushrodLen };
}

// ── Builds Transparent Borosilicate Cylinder Assembly with Copper Rings ───
function buildTransparentCylinderAssembly(
  l,
  r,
  pistonRadius,
  pistonLength,
  mountMat,
  copperMat,
  chromeMat
) {
  const cylGroup = new THREE.Group();
  const strokeLen = 2 * r;
  const sleeveLen = strokeLen + pistonLength + 0.36;
  const sleeveCenter = l;

  // 1. Transparent Borosilicate Glass Cylinder
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    transmission: 0.90,
    opacity: 1.0,
    transparent: true,
    roughness: 0.05,
    metalness: 0.08,
    ior: 1.52,
    thickness: 0.06,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const sleeveGeo = new THREE.CylinderGeometry(pistonRadius * 1.10, pistonRadius * 1.10, sleeveLen, 48, 1, true);
  sleeveGeo.rotateZ(Math.PI / 2);
  const sleeveMesh = new THREE.Mesh(sleeveGeo, glassMat);
  sleeveMesh.position.set(sleeveCenter, 0, 0.05);
  cylGroup.add(sleeveMesh);

  // 2. Polished Copper / Bronze Front & Rear Retaining Rings (Matching reference image!)
  const ringRadius = pistonRadius * 1.14;
  const ringThick = 0.016;

  // Front Copper Ring
  const frontRingGeo = new THREE.TorusGeometry(ringRadius, ringThick, 16, 48);
  frontRingGeo.rotateY(Math.PI / 2);
  const frontRing = new THREE.Mesh(frontRingGeo, copperMat);
  frontRing.position.set(sleeveCenter - sleeveLen / 2 + 0.05, 0, 0.05);
  cylGroup.add(frontRing);

  // Rear Copper Ring
  const rearRingGeo = new THREE.TorusGeometry(ringRadius, ringThick, 16, 48);
  rearRingGeo.rotateY(Math.PI / 2);
  const rearRing = new THREE.Mesh(rearRingGeo, copperMat);
  rearRing.position.set(sleeveCenter + sleeveLen / 2 - 0.05, 0, 0.05);
  cylGroup.add(rearRing);

  // 3. Front & Rear Mounting Stanchions (Machined brackets holding cylinder to bedplate rail)
  [-sleeveLen * 0.42, sleeveLen * 0.42].forEach(xOffset => {
    const stanchionGeo = new THREE.BoxGeometry(0.08, 0.22, 0.26);
    stanchionGeo.translate(sleeveCenter + xOffset, -0.11, 0.05);
    const stanchion = new THREE.Mesh(stanchionGeo, mountMat);
    stanchion.castShadow = true;
    cylGroup.add(stanchion);

    // Collar ring around glass
    const collarGeo = new THREE.CylinderGeometry(pistonRadius * 1.18, pistonRadius * 1.18, 0.04, 32);
    collarGeo.rotateZ(Math.PI / 2);
    collarGeo.translate(sleeveCenter + xOffset, 0, 0.05);
    const collar = new THREE.Mesh(collarGeo, mountMat);
    cylGroup.add(collar);
  });

  // 4. Cylinder Head End Cap (at rear)
  const headGeo = new THREE.CylinderGeometry(pistonRadius * 1.25, pistonRadius * 1.25, 0.05, 32);
  headGeo.rotateZ(Math.PI / 2);
  headGeo.translate(sleeveCenter + sleeveLen / 2 + 0.025, 0, 0.05);
  const headMesh = new THREE.Mesh(headGeo, chromeMat);
  headMesh.castShadow = true;
  cylGroup.add(headMesh);

  // Combustion ignition flash glow inside cylinder head near TDC
  const tdcX = l + r;
  const combustionGeo = new THREE.SphereGeometry(pistonRadius * 0.88, 24, 24);
  const combustionMat = new THREE.MeshBasicMaterial({
    color: 0xff8822,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending
  });
  const combustionGlow = new THREE.Mesh(combustionGeo, combustionMat);
  combustionGlow.position.set(tdcX, 0, 0.05);
  cylGroup.add(combustionGlow);

  return { cylGroup, combustionGlow, sleeveLen, sleeveCenter };
}

// ── Precision CNC Binary Coupler Link with Configurable Centerline/Tracer Stylus ──
function buildTriangularCoupler(length, width, thickness, mainMat, accentMat, steelMat, uRatio = 0.5, vOffset = 0) {
  const couplerGroup = new THREE.Group();
  const hubRadius = Math.max(0.048, width * 0.74);
  const boreRadius = hubRadius * 0.42;

  // 1. Sleek CNC Binary Dogbone Body (Double-web I-Beam structure)
  const beamGeo = new THREE.BoxGeometry(length, width * 0.68, thickness * 0.90);
  beamGeo.translate(length / 2, 0, 0);
  const beam = new THREE.Mesh(beamGeo, mainMat);
  beam.castShadow = true;
  couplerGroup.add(beam);

  // Recessed center pocket for weight reduction and mechanical aesthetics
  const pocketGeo = new THREE.BoxGeometry(length * 0.72, width * 0.36, thickness * 0.95);
  pocketGeo.translate(length / 2, 0, 0);
  const pocket = new THREE.Mesh(pocketGeo, accentMat);
  couplerGroup.add(pocket);

  // 2. Precision Hub Bosses at Joint B and Joint C
  const hubB = new THREE.Mesh(new THREE.CylinderGeometry(hubRadius, hubRadius, thickness, 32), mainMat);
  hubB.rotateX(Math.PI / 2);
  hubB.castShadow = true;
  couplerGroup.add(hubB);

  const hubC = new THREE.Mesh(new THREE.CylinderGeometry(hubRadius, hubRadius, thickness, 32), mainMat);
  hubC.rotateX(Math.PI / 2);
  hubC.position.set(length, 0, 0);
  hubC.castShadow = true;
  couplerGroup.add(hubC);

  // Bronze Bushings & Ground Steel Pin Sleeves
  [0, length].forEach(xPos => {
    const bushGeo = new THREE.CylinderGeometry(boreRadius * 1.35, boreRadius * 1.35, thickness * 1.02, 24);
    bushGeo.rotateX(Math.PI / 2);
    bushGeo.translate(xPos, 0, 0);
    couplerGroup.add(new THREE.Mesh(bushGeo, accentMat));

    const coreGeo = new THREE.CylinderGeometry(boreRadius, boreRadius, thickness * 1.08, 24);
    coreGeo.rotateX(Math.PI / 2);
    coreGeo.translate(xPos, 0, 0);
    couplerGroup.add(new THREE.Mesh(coreGeo, steelMat));
  });

  const clampedU = Math.max(0.0, Math.min(1.0, Number(uRatio) || 0.5));
  const effectiveV = Number(vOffset) || 0;
  const apexX = length * clampedU;
  const apexY = effectiveV;

  // 3. Lightweight Tubular Truss Struts ONLY if user specifies an offset tracer (|effectiveV| > 0.01)
  if (Math.abs(effectiveV) > 0.01) {
    const p1 = new THREE.Vector3(length * 0.15, 0, 0);
    const p2 = new THREE.Vector3(length * 0.85, 0, 0);
    const apex = new THREE.Vector3(apexX, apexY, 0);

    const makeStrut = (from, to) => {
      const v = new THREE.Vector3().subVectors(to, from);
      const len = v.length();
      const strutGeo = new THREE.CylinderGeometry(0.007, 0.007, len, 12);
      strutGeo.rotateZ(-Math.atan2(v.x, v.y));
      strutGeo.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
      return new THREE.Mesh(strutGeo, steelMat);
    };
    couplerGroup.add(makeStrut(p1, apex));
    couplerGroup.add(makeStrut(p2, apex));
  }

  // 4. Stylus Pin & Radiant Jewel Stylus Tip at Apex/Tracer point
  const apexPos = new THREE.Vector3(apexX, apexY, thickness * 0.85);

  const stylusStemGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.06, 16);
  stylusStemGeo.rotateX(Math.PI / 2);
  const stylusStem = new THREE.Mesh(stylusStemGeo, steelMat);
  stylusStem.position.set(apexPos.x, apexPos.y, apexPos.z - 0.025);
  couplerGroup.add(stylusStem);

  const jewelMat = new THREE.MeshStandardMaterial({
    color: 0x3561ee,
    emissive: 0x173770,
    roughness: 0.15,
    metalness: 0.75
  });
  const jewelMesh = new THREE.Mesh(new THREE.SphereGeometry(0.028, 20, 20), jewelMat);
  jewelMesh.position.copy(apexPos);
  couplerGroup.add(jewelMesh);

  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x6f8ff4,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending
  });
  const tracerHalo = new THREE.Mesh(new THREE.SphereGeometry(0.046, 16, 16), haloMat);
  tracerHalo.position.copy(apexPos);
  couplerGroup.add(tracerHalo);

  return { couplerGroup, uRatio: clampedU, apexOffset: effectiveV, jewelMesh, tracerHalo };
}

// Builds engineering fixed-ground hatched symbol
function buildGroundHatchingGroup(xCenter, yTop, width = 0.32, color = 0x526b8f) {
  const hatchGroup = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 });
  const basePoints = [
    new THREE.Vector3(xCenter - width / 2, yTop, 0.05),
    new THREE.Vector3(xCenter + width / 2, yTop, 0.05)
  ];
  hatchGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(basePoints), mat));
  const nHatch = 6;
  const spacing = width / nHatch;
  const hatchLen = 0.045;
  for (let i = 0; i <= nHatch; i++) {
    const xStart = xCenter - width / 2 + i * spacing;
    const hatchPoints = [
      new THREE.Vector3(xStart, yTop, 0.05),
      new THREE.Vector3(xStart - hatchLen * 0.7, yTop - hatchLen * 0.7, 0.05)
    ];
    hatchGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hatchPoints), mat));
  }
  return hatchGroup;
}

// Builds industrial gearmotor housing with counterweight hub for Four-Bar Joint A
function buildElectricGearMotorWithCounterweight(scale, motorMat, finMat, steelMat, chromeMat, blueMat) {
  const motorGroup = new THREE.Group();

  // 1. Cylindrical Stator Housing in Industrial Motor Blue
  const motorLen = 0.32 * scale;
  const motorRad = 0.12 * scale;
  const statorGeo = new THREE.CylinderGeometry(motorRad, motorRad, motorLen, 32);
  statorGeo.rotateX(Math.PI / 2);
  statorGeo.translate(0, 0, -motorLen / 2 - 0.05);
  const statorMesh = new THREE.Mesh(statorGeo, motorMat);
  statorMesh.castShadow = true;
  motorGroup.add(statorMesh);

  // 2. Horizontal/Circumferential Heat Dissipation Cooling Fins
  for (let i = 0; i < 7; i++) {
    const zFin = -0.06 - (i * (motorLen * 0.82)) / 7;
    const finGeo = new THREE.TorusGeometry(motorRad + 0.014 * scale, 0.005 * scale, 8, 32);
    const finMesh = new THREE.Mesh(finGeo, finMat);
    finMesh.position.set(0, 0, zFin);
    motorGroup.add(finMesh);
  }

  // 3. Top Electrical Terminal Junction Box with Indicator Block
  const boxGeo = new THREE.BoxGeometry(0.09 * scale, 0.07 * scale, 0.14 * scale);
  boxGeo.translate(0, motorRad + 0.035 * scale, -motorLen / 2);
  const boxMesh = new THREE.Mesh(boxGeo, motorMat);
  motorGroup.add(boxMesh);

  const ledGeo = new THREE.BoxGeometry(0.03 * scale, 0.02 * scale, 0.03 * scale);
  ledGeo.translate(0, motorRad + 0.072 * scale, -motorLen / 2 + 0.03);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const ledMesh = new THREE.Mesh(ledGeo, ledMat);
  motorGroup.add(ledMesh);

  // 4. Front Gearbox Reduction Flange with Bolt Pattern
  const flangeGeo = new THREE.CylinderGeometry(motorRad * 1.18, motorRad * 1.18, 0.04 * scale, 32);
  flangeGeo.rotateX(Math.PI / 2);
  flangeGeo.translate(0, 0, -0.02 * scale);
  const flangeMesh = new THREE.Mesh(flangeGeo, steelMat);
  motorGroup.add(flangeMesh);

  // Circular Bolt Ring on Flange
  for (let b = 0; b < 6; b++) {
    const angle = (b * Math.PI * 2) / 6;
    const bRad = motorRad * 0.95;
    const bGeo = new THREE.CylinderGeometry(0.008 * scale, 0.008 * scale, 0.045 * scale, 8);
    bGeo.rotateX(Math.PI / 2);
    const bMesh = new THREE.Mesh(bGeo, chromeMat);
    bMesh.position.set(bRad * Math.cos(angle), bRad * Math.sin(angle), -0.015 * scale);
    motorGroup.add(bMesh);
  }

  // 5. Heavy Cast Foot Mounting Bracket bolted to Bedplate
  const footGeo = new THREE.BoxGeometry(0.22 * scale, 0.16 * scale, motorLen * 1.15);
  footGeo.translate(0, -0.11 * scale, -motorLen / 2);
  const footMesh = new THREE.Mesh(footGeo, steelMat);
  footMesh.castShadow = true;
  motorGroup.add(footMesh);

  // 4 Hex Fasteners on Foot
  [
    [-0.08 * scale, -0.18 * scale, -0.08],
    [0.08 * scale, -0.18 * scale, -0.08],
    [-0.08 * scale, -0.18 * scale, -motorLen + 0.02],
    [0.08 * scale, -0.18 * scale, -motorLen + 0.02]
  ].forEach(([bx, by, bz]) => {
    const boltGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6);
    const bolt = new THREE.Mesh(boltGeo, chromeMat);
    bolt.position.set(bx, by, bz);
    motorGroup.add(bolt);
  });

  // ── ROTATING MOTOR SPINDLE & COUNTERWEIGHT HUB ──
  const rotatingSpindle = new THREE.Group();

  // Central Output Drive Hub
  const hubGeo = new THREE.CylinderGeometry(0.055 * scale, 0.055 * scale, 0.06 * scale, 24);
  hubGeo.rotateX(Math.PI / 2);
  hubGeo.translate(0, 0, 0.02 * scale);
  const hubMesh = new THREE.Mesh(hubGeo, chromeMat);
  rotatingSpindle.add(hubMesh);

  // 180° Counterweight Arm extending downward with blue boss (Matching reference image!)
  const cwArmLen = 0.16 * scale;
  const cwArmGeo = new THREE.BoxGeometry(0.045 * scale, cwArmLen, 0.032 * scale);
  cwArmGeo.translate(0, -cwArmLen / 2, 0.02 * scale);
  const cwArm = new THREE.Mesh(cwArmGeo, steelMat);
  rotatingSpindle.add(cwArm);

  const cwBossRadius = 0.042 * scale;
  const cwBossGeo = new THREE.CylinderGeometry(cwBossRadius, cwBossRadius, 0.055 * scale, 24);
  cwBossGeo.rotateX(Math.PI / 2);
  cwBossGeo.translate(0, -cwArmLen, 0.025 * scale);
  const cwBoss = new THREE.Mesh(cwBossGeo, blueMat);
  cwBoss.castShadow = true;
  rotatingSpindle.add(cwBoss);

  motorGroup.add(rotatingSpindle);

  return { motorGroup, rotatingSpindle };
}

// Builds industrial pillow-block bearing pedestal for ground Joint D with full 360° front link clearance
function buildClevisStand(height, width, depth, mountMat, steelMat, chromeMat) {
  const stand = new THREE.Group();

  // Foundation foot plate positioned on rear bed plate (z < 0)
  const footWidth = width * 1.6;
  const footHeight = 0.035;
  const footDepth = depth * 1.4;
  const footGeo = new THREE.BoxGeometry(footWidth, footHeight, footDepth);
  footGeo.translate(0, -height - footHeight / 2, -depth * 0.45);
  const foot = new THREE.Mesh(footGeo, mountMat);
  foot.castShadow = true;
  stand.add(foot);

  // Hex Anchor Bolts on rear foot
  const boltOffsets = [
    [-width * 0.6, -height, -depth * 0.90],
    [width * 0.6, -height, -depth * 0.90],
    [-width * 0.6, -height, -depth * 0.10],
    [width * 0.6, -height, -depth * 0.10]
  ];
  boltOffsets.forEach(([bx, by, bz]) => {
    const bGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 12);
    const bMesh = new THREE.Mesh(bGeo, steelMat);
    bMesh.position.set(bx, by + 0.015, bz);
    stand.add(bMesh);
  });

  // Heavy rear structural upright pedestal supporting the pivot bearing (located at z = -0.055)
  const rearZ = -depth * 0.50;
  const uprightGeo = new THREE.BoxGeometry(width, height, 0.035);
  uprightGeo.translate(0, -height / 2, 0);
  const upright = new THREE.Mesh(uprightGeo, mountMat);
  upright.position.z = rearZ;
  upright.castShadow = true;
  stand.add(upright);

  // Rounded cylindrical bearing hub on rear upright
  const hubGeo = new THREE.CylinderGeometry(width * 0.58, width * 0.58, 0.045, 24);
  hubGeo.rotateX(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, mountMat);
  hub.position.z = rearZ;
  hub.castShadow = true;
  stand.add(hub);

  // Main precision pivot spindle pin extending forward from rear bearing through Link 4 bore (z in [-0.09, 0.056])
  const pinLength = 0.15;
  const pinGeo = new THREE.CylinderGeometry(0.022, 0.022, pinLength, 20);
  pinGeo.rotateX(Math.PI / 2);
  pinGeo.translate(0, 0, -0.015);
  const pin = new THREE.Mesh(pinGeo, steelMat);
  stand.add(pin);

  // Polished chrome retaining end caps: rear cap at z = -0.09, front retaining washer cap at z = 0.056
  const capGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.010, 6);
  capGeo.rotateX(Math.PI / 2);

  const rearCap = new THREE.Mesh(capGeo, chromeMat);
  rearCap.position.z = -0.09;
  stand.add(rearCap);

  const frontCap = new THREE.Mesh(capGeo, chromeMat);
  frontCap.position.z = 0.056;
  stand.add(frontCap);

  return stand;
}

// Builds connecting pivot pin with retaining washers
function buildPivotPin(depth, steelMat, chromeMat) {
  const pinGroup = new THREE.Group();
  const pinGeo = new THREE.CylinderGeometry(0.022, 0.022, depth, 20);
  pinGeo.rotateX(Math.PI / 2);
  const pin = new THREE.Mesh(pinGeo, steelMat);
  pinGroup.add(pin);

  [-depth / 2, depth / 2].forEach(zPos => {
    const capGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.012, 6);
    capGeo.rotateX(Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, chromeMat);
    cap.position.z = zPos;
    pinGroup.add(cap);
  });

  return pinGroup;
}

// ── Heavy CNC Precision Ground Machine Bed Plate with Dual T-Slots ───────────
// Directly supports Joint A (gearmotor) and Joint D (pillow-block pedestal) with full clearance for rotating links
function buildProfessionalFourBarBed(dx, a_vis, mountMat, steelMat, chromeMat, darkSteelMat) {
  const bedGroup = new THREE.Group();

  const bedWidth = Math.max(dx + 0.90, 1.4);
  const bedHeight = 0.09;
  const bedY = -0.18;
  const bedTopY = bedY + bedHeight / 2; // -0.135
  const bedBottomY = bedY - bedHeight / 2; // -0.225

  // 1. Heavy CNC Cast Iron Bed Plate Base (Rear section supporting motor & clevis)
  // Positioned from z = -0.36 to z = -0.01 across full width (never penetrates rotation plane z > 0)
  const mainBedDepth = 0.35;
  const mainBedZ = -0.36 + mainBedDepth / 2; // -0.185
  const mainBedGeo = new THREE.BoxGeometry(bedWidth, bedHeight, mainBedDepth);
  mainBedGeo.translate(dx / 2, bedY, mainBedZ);
  const mainBed = new THREE.Mesh(mainBedGeo, mountMat);
  mainBed.castShadow = true;
  mainBed.receiveShadow = true;
  bedGroup.add(mainBed);

  // 1b. Precision Ground Machined Top Plate with Beveled Edges
  const topPlateGeo = new THREE.BoxGeometry(bedWidth * 0.99, 0.012, mainBedDepth * 0.96);
  topPlateGeo.translate(dx / 2, bedTopY + 0.006, mainBedZ);
  const topPlate = new THREE.Mesh(topPlateGeo, darkSteelMat);
  topPlate.receiveShadow = true;
  bedGroup.add(topPlate);

  // 2. Dual Precision Machined T-Slots along the top surface
  [-0.26, -0.11].forEach(zSlot => {
    const slotGeo = new THREE.BoxGeometry(bedWidth * 0.94, 0.015, 0.04);
    slotGeo.translate(dx / 2, bedTopY + 0.008, zSlot);
    const slotMesh = new THREE.Mesh(slotGeo, chromeMat);
    bedGroup.add(slotMesh);

    // Inner dark groove
    const grooveGeo = new THREE.BoxGeometry(bedWidth * 0.92, 0.016, 0.018);
    grooveGeo.translate(dx / 2, bedTopY + 0.009, zSlot);
    const grooveMesh = new THREE.Mesh(grooveGeo, darkSteelMat);
    bedGroup.add(grooveMesh);
  });

  // 3. Engineering Ground Hatching under Joint A and Joint D
  bedGroup.add(buildGroundHatchingGroup(0, bedBottomY - 0.005, 0.38, 0x526b8f));
  bedGroup.add(buildGroundHatchingGroup(dx, bedBottomY - 0.005, 0.38, 0x526b8f));

  // 4. Anchor Fasteners (4 Hex bolts securing bedplate to foundation)
  [
    [-bedWidth * 0.44 + dx / 2, -0.30],
    [-bedWidth * 0.44 + dx / 2, -0.06],
    [bedWidth * 0.44 + dx / 2, -0.30],
    [bedWidth * 0.44 + dx / 2, -0.06]
  ].forEach(([bx, bz]) => {
    const boltGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.025, 6);
    boltGeo.translate(bx, bedTopY + 0.012, bz);
    const bolt = new THREE.Mesh(boltGeo, chromeMat);
    bedGroup.add(bolt);
  });

  return bedGroup;
}

// ── CAD 3D Orientation Cube Gizmo (Synchronized with Viewport Camera) ───────
function drawOrientationGizmo(canvas, camera) {
  if (!canvas || !camera) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const size = w * 0.28;

  // Extract camera view rotation matrix
  const m = camera.matrixWorldInverse.elements;

  // In Three.js: X is along bed (right), Y is up, Z is forward out of screen.
  // In our CAD orientation cube (matching reference image):
  // Red 'X': world (1, 0, 0)
  // Blue 'Z': world (0, 1, 0) (points up)
  // Green 'Y': world (0, 0, -1) (points in depth)
  const project = (wx, wy, wz) => {
    const camX = m[0] * wx + m[4] * wy + m[8] * wz;
    const camY = m[1] * wx + m[5] * wy + m[9] * wz;
    const camZ = m[2] * wx + m[6] * wy + m[10] * wz;
    return {
      x: cx + camX * size,
      y: cy - camY * size,
      z: camZ
    };
  };

  // 1. Semi-transparent 3D Isometric Cube Wireframe
  const s = 0.52;
  const cubeVerts = [
    project(-s, -s, -s), project(s, -s, -s),
    project(s, s, -s), project(-s, s, -s),
    project(-s, -s, s), project(s, -s, s),
    project(s, s, s), project(-s, s, s)
  ];

  const cubeEdges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = 1.0;
  cubeEdges.forEach(([i, j]) => {
    ctx.beginPath();
    ctx.moveTo(cubeVerts[i].x, cubeVerts[i].y);
    ctx.lineTo(cubeVerts[j].x, cubeVerts[j].y);
    ctx.stroke();
  });

  // 2. 3 Coordinate Axes (Red X, Green Y, Blue Z)
  const origin = project(0, 0, 0);
  const axes = [
    { label: 'X', color: '#ef4444', end: project(1.15, 0, 0) }, // Red (Rail)
    { label: 'Z', color: '#2563eb', end: project(0, 1.15, 0) }, // Blue (Up)
    { label: 'Y', color: '#10b981', end: project(0, 0, -1.15) } // Green (Depth)
  ];

  // Sort axes by camera depth (farthest first so nearest render in front)
  axes.sort((a, b) => a.end.z - b.end.z);

  axes.forEach(axis => {
    ctx.strokeStyle = axis.color;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(axis.end.x, axis.end.y);
    ctx.stroke();

    // Axis label circular badge
    ctx.fillStyle = axis.color;
    ctx.beginPath();
    ctx.arc(axis.end.x, axis.end.y, 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(axis.label, axis.end.x, axis.end.y);
  });
}

// ── Subtitle Title Generator for Mechanism Workspace ───────────────────────
function getSubtitle(type) {
  if (type === 'slider_crank') return 'Converts rotary motion to reciprocating motion';
  if (type === 'four_bar') return 'Converts rotary motion to complex motion';
  if (type === 'simple_pendulum') return 'Harmonic periodic oscillation in a gravitational field';
  if (type === 'compound_pendulum') return 'Rigid body pendulum with physical mass distribution';
  return 'Interactive Mechanical Simulation';
}

// ─── Main Scene3D Component ───────────────────────────────────────────────────
export const Scene3D = ({
  simType,
  params,
  paramsRef: externalParamsRef,
  simData,
  animIdx = 0,
  isPlaying = false,
  animSpeed = 1.0,
  onPause,
  onBobDragMove,
  onBobDragRelease,
  isModalOpen = false,
}) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const mechanismGroupRef = useRef(null);

  const [cameraView, setCameraView] = useState('iso');
  const cameraViewRef = useRef(cameraView);
  cameraViewRef.current = cameraView;
  const [webglError, setWebglError] = useState(false);

  // References for live 60/120 FPS hardware rendering loop without React lag
  const simDataRef = useRef(simData);
  simDataRef.current = simData;
  const fallbackParamsRef = useRef(params);
  fallbackParamsRef.current = params;
  const paramsRef = externalParamsRef || fallbackParamsRef;
  const animIdxRef = useRef(animIdx);
  animIdxRef.current = animIdx;
  const simTypeRef = useRef(simType);
  simTypeRef.current = simType;
  const lastFramedSimTypeRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const animSpeedRef = useRef(animSpeed);
  animSpeedRef.current = animSpeed;

  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  const onBobDragMoveRef = useRef(onBobDragMove);
  onBobDragMoveRef.current = onBobDragMove;
  const onBobDragReleaseRef = useRef(onBobDragRelease);
  onBobDragReleaseRef.current = onBobDragRelease;

  // Continuous physical time accumulator and drag status refs
  const continuousTimeRef = useRef(0);
  const lastTickTimeRef = useRef(performance.now());
  const isDraggingRef = useRef(false);
  const currentDragAngleDegRef = useRef(params?.theta0 ?? 30);
  const lastTh4Ref = useRef(null);
  const crankThetaRef = useRef(0);
  const lastCurIdxRef = useRef(animIdx);
  const prevPlayingRef = useRef(isPlaying);
  const feasCacheRef = useRef({ params: null, type: null, isCaseCorrect: true });

  const gizmoCanvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const floorRef = useRef(null);
  const gridRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const dynamicPartsRef = useRef(null);
  const targetCenterRef = useRef(new THREE.Vector3(0, 0, 0));
  const viewDistRef = useRef(3.0);
  const updateTransformsRef = useRef(null);

  // Disable OrbitControls whenever a modal is open to strictly prevent background movement
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !isModalOpen;
    }
  }, [isModalOpen]);

  // ── Setup Three.js Scene, Camera, Lights, Grid ────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 500;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      console.warn("WebGL initialization failed:", e);
      setWebglError(true);
      return;
    }

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xf1f1f8);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2.0, 1.4, 2.5);
    cameraRef.current = camera;

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 15;
    controls.minDistance = 0.5;
    controls.target.set(0, 0, 0);
    controls.autoRotate = false;
    controls.autoRotateSpeed = 2.4;
    controlsRef.current = controls;

    // High-Clarity Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdce1f0, 1.4);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.35);
    dirLight.position.set(4, 7, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const fillLight = new THREE.PointLight(0xeef0f8, 0.95, 20);
    fillLight.position.set(-4, 3, 3);
    scene.add(fillLight);

    const softRim = new THREE.DirectionalLight(0xeef0f8, 0.5);
    softRim.position.set(0, -3, -4);
    scene.add(softRim);

    // Floor Shadow Receiver Plane (Subtle soft ambient ground reflection)
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.16 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -1.40;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
    floorRef.current = floorMesh;

    // Floor Grid with Blue Accent Lines and Periwinkle Muted Lines
    const grid = new THREE.GridHelper(14, 28, 0x264cb2, 0xdce1f0);
    grid.position.y = -1.40;
    scene.add(grid);
    gridRef.current = grid;

    // Mechanism parent group
    const mechGroup = new THREE.Group();
    mechanismGroupRef.current = mechGroup;
    scene.add(mechGroup);
    window.__scene3d = { scene, mechGroup, camera, controls, renderer, mechanismGroupRef };

    // Continuous Native 60/120 FPS Animation Loop via renderer.setAnimationLoop
    lastTickTimeRef.current = performance.now();

    const renderTick = () => {
      controls.update();

      const now = performance.now();
      const deltaSec = Math.min(Math.max(0, (now - lastTickTimeRef.current) / 1000), 0.08);
      lastTickTimeRef.current = now;

      // Advance continuous physical time and crank phase smoothly ONLY when playing and case is physically valid
      const currentFeas = checkFeasibility(simTypeRef.current, paramsRef.current);
      const isCaseCorrect = currentFeas.status === FEASIBILITY_STATUS.OK;

      if (isPlayingRef.current && !isDraggingRef.current && isCaseCorrect) {
        const deltaAdvance = deltaSec * (animSpeedRef.current || 1.0);
        continuousTimeRef.current += deltaAdvance;

        const currentSpeed = Number(paramsRef.current?.crank_speed) || 60.0;
        const currentOmega = (currentSpeed * 2 * Math.PI) / 60;
        crankThetaRef.current += deltaAdvance * currentOmega;
      }

      // Directly update mechanism kinematics on GPU tick without React state bottleneck
      if (updateTransformsRef.current) {
        try {
          updateTransformsRef.current();
        } catch (err) {
          console.warn("Kinematics frame update note:", err);
        }
      }

      renderer.render(scene, camera);

      // Render 3D CAD Orientation Cube Gizmo in top-right HUD
      if (gizmoCanvasRef.current) {
        drawOrientationGizmo(gizmoCanvasRef.current, camera);
      }
    };

    renderer.setAnimationLoop(renderTick);

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight || 500;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (renderer) {
        renderer.setAnimationLoop(null);
        renderer.forceContextLoss();
        renderer.dispose();
        if (container && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }
      if (controls) controls.dispose();
      lastBuiltTopologyKey.current = '';
      dynamicPartsRef.current = null;
      // Thorough cleanup of all scene objects, geometries, and materials
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    };
  }, []);

  // ── Sync continuousTimeRef with animIdx ONLY when paused or scrubbed ──────
  useEffect(() => {
    if (!isPlaying) {
      continuousTimeRef.current = (simData?.time && simData.time[animIdx] !== undefined)
        ? simData.time[animIdx]
        : 0;

      if (simData?.crank_angle_deg && simData.crank_angle_deg[animIdx] !== undefined) {
        crankThetaRef.current = THREE.MathUtils.degToRad(simData.crank_angle_deg[animIdx]);
      }
    }
  }, [animIdx, isPlaying, simData]);

  // Reset physical continuous clock whenever pendulum initial conditions change when paused
  useEffect(() => {
    if (!isPlaying) {
      continuousTimeRef.current = 0;
    }
  }, [params?.theta0, params?.length, params?.mass]);

  // ── Interactive 3D Pendulum Bob Dragging Raycaster Setup ────────────────────
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!renderer || !camera || !controls) return;

    const domElement = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const swingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const planeIntersect = new THREE.Vector3();

    const handlePointerDown = (e) => {
      if (simTypeRef.current !== 'simple_pendulum') return;
      const parts = dynamicPartsRef.current;
      if (!parts || !parts.hitSphere) return;

      const rect = domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(parts.hitSphere);

      if (intersects.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        isDraggingRef.current = true;
        controls.enabled = false;
        domElement.style.cursor = 'grabbing';

        if (parts.bobMesh) {
          parts.bobMesh.material.emissive.setHex(0x3561ee);
        }

        if (onPauseRef.current) {
          onPauseRef.current();
        }

        if (raycaster.ray.intersectPlane(swingPlane, planeIntersect)) {
          const angleRad = Math.atan2(planeIntersect.x, -planeIntersect.y);
          let deg = THREE.MathUtils.radToDeg(angleRad);
          deg = Math.max(-85, Math.min(85, deg));
          currentDragAngleDegRef.current = deg;
          parts.armGroup.rotation.z = THREE.MathUtils.degToRad(deg);
          if (onBobDragMoveRef.current) {
            onBobDragMoveRef.current(Math.round(deg * 10) / 10);
          }
        }
      }
    };

    const handlePointerMove = (e) => {
      const parts = dynamicPartsRef.current;
      if (!parts) return;

      const rect = domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (isDraggingRef.current && parts.armGroup) {
        if (raycaster.ray.intersectPlane(swingPlane, planeIntersect)) {
          const angleRad = Math.atan2(planeIntersect.x, -planeIntersect.y);
          let deg = THREE.MathUtils.radToDeg(angleRad);
          deg = Math.max(-85, Math.min(85, deg));
          currentDragAngleDegRef.current = deg;
          parts.armGroup.rotation.z = THREE.MathUtils.degToRad(deg);
          if (onBobDragMoveRef.current) {
            onBobDragMoveRef.current(Math.round(deg * 10) / 10);
          }
        }
        return;
      }

      if (simTypeRef.current === 'simple_pendulum' && parts.hitSphere) {
        const intersects = raycaster.intersectObject(parts.hitSphere);
        if (intersects.length > 0) {
          domElement.style.cursor = 'grab';
          if (parts.bobMesh && parts.bobMesh.material.emissive.getHex() === 0) {
            parts.bobMesh.material.emissive.setHex(0x1b357d);
          }
        } else {
          if (!isDraggingRef.current) {
            domElement.style.cursor = 'default';
            if (parts.bobMesh && parts.bobMesh.material.emissive.getHex() === 0x1b357d) {
              parts.bobMesh.material.emissive.setHex(0x000000);
            }
          }
        }
      }
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        controls.enabled = true;
        domElement.style.cursor = 'default';
        const parts = dynamicPartsRef.current;
        if (parts && parts.bobMesh) {
          parts.bobMesh.material.emissive.setHex(0x000000);
        }
        continuousTimeRef.current = 0;
        if (onBobDragReleaseRef.current) {
          onBobDragReleaseRef.current(Math.round(currentDragAngleDegRef.current * 10) / 10);
        }
      }
    };

    domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  // ── Preset Camera Positions & 360° Orbit Rotation ───────────────────
  const setView = useCallback((viewKey) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const center = targetCenterRef.current;
    const d = viewDistRef.current;

    controls.target.copy(center);

    if (viewKey === 'rotate360') {
      if (cameraViewRef.current === 'rotate360') {
        controls.autoRotate = false;
        controls.update();
        setCameraView('iso');
        return;
      }

      const currentElevation = Math.abs(camera.position.y - center.y);
      if (currentElevation > d * 0.85 || currentElevation < d * 0.12) {
        camera.position.set(center.x + d * 0.65, center.y + d * 0.45, center.z + d * 0.85);
      }

      controls.autoRotate = true;
      controls.autoRotateSpeed = 2.4;
      controls.update();
      setCameraView('rotate360');
      return;
    }

    controls.autoRotate = false;
    if (viewKey === 'iso') {
      camera.position.set(center.x + d * 0.65, center.y + d * 0.45, center.z + d * 0.85);
    } else if (viewKey === 'front') {
      camera.position.set(center.x, center.y, center.z + d * 1.05);
    } else if (viewKey === 'top') {
      camera.position.set(center.x, center.y + d * 1.25, center.z + 0.01);
    } else if (viewKey === 'side') {
      camera.position.set(center.x + d * 1.15, center.y, center.z);
    }
    controls.update();
    setCameraView(viewKey);
  }, []);

  // ── Quick-Action Floating CAD Tool Handlers ─────────────────────────
  const handleZoomFit = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const center = targetCenterRef.current;
    const d = viewDistRef.current;
    controls.target.copy(center);
    camera.position.set(center.x + d * 0.65, center.y + d * 0.45, center.z + d * 0.85);
    controls.update();
  }, []);

  const handleCenterFocus = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.target.copy(targetCenterRef.current);
    controls.update();
  }, []);

  const handleFullscreenToggle = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // ── Build 3D CAD Geometries (Decoupled from live slider jitter) ──────
  // Only rebuilds when simType changes, or when physical mechanism link lengths change.
  // For pendulums, adjusting mass or length does NOT rebuild geometry, guaranteeing buttery smooth playback!
  const lastBuiltTopologyKey = useRef('');

  useEffect(() => {
    const group = mechanismGroupRef.current;
    if (!group) return;

    // Determine if structural geometry topology actually changed
    const currentTopologyKey = simType === 'slider_crank'
      ? `${simType}_${params?.crank_length}_${params?.conn_length}`
      : simType === 'four_bar'
      ? `${simType}_${params?.link_ground}_${params?.link_crank}_${params?.link_coupler}_${params?.link_rocker}`
      : simType;

    if (currentTopologyKey === lastBuiltTopologyKey.current && dynamicPartsRef.current && group.children.length > 0) {
      // Structure already built; skip teardown!
      return;
    }
    lastBuiltTopologyKey.current = currentTopologyKey;

    // Clear previous mechanism children cleanly
    while (group.children.length > 0) {
      const obj = group.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
      group.remove(obj);
    }

    // Material definitions for high-end industrial engineering aesthetic
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.85,
      roughness: 0.15
    });
    const polishedSteelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.88,
      roughness: 0.16
    });
    const brushedAluminumMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.75,
      roughness: 0.28
    });
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.22
    });
    const royalBlueMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      metalness: 0.48,
      roughness: 0.25
    });
    const motorBlueMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      metalness: 0.42,
      roughness: 0.30
    });
    const bluePrimaryMat = new THREE.MeshStandardMaterial({
      color: 0x264cb2,
      metalness: 0.35,
      roughness: 0.28
    });
    const blueActiveMat = new THREE.MeshStandardMaterial({
      color: 0x3561ee,
      metalness: 0.35,
      roughness: 0.26
    });
    const blueLightMat = new THREE.MeshStandardMaterial({
      color: 0x6f8ff4,
      metalness: 0.30,
      roughness: 0.30
    });
    const palePeriwinkleMat = new THREE.MeshStandardMaterial({
      color: 0xeef0f8,
      metalness: 0.25,
      roughness: 0.35
    });
    const mountMat = new THREE.MeshStandardMaterial({
      color: 0xdce1f0,
      metalness: 0.45,
      roughness: 0.32
    });
    const steelPinMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.65,
      roughness: 0.22
    });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.72,
      roughness: 0.28
    });
    const accentOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xdf7940,
      metalness: 0.35,
      roughness: 0.30
    });
    const emeraldMat = new THREE.MeshStandardMaterial({
      color: 0x2f7d5a,
      metalness: 0.35,
      roughness: 0.30
    });

    // ── 1. SIMPLE PENDULUM ──────────────────────────────────────────────
    if (simType === 'simple_pendulum') {
      const m_real = Number(params?.mass) || 1.0;
      const L_real = Number(params?.length) || 1.0;
      const L_vis = calcVisualLength(L_real);
      const initialBobScale = Math.max(0.6, Math.min(1.5, Math.cbrt(m_real / 1.0)));

      // Base Mounting Ceiling Plate
      const mountGeo = new THREE.BoxGeometry(0.9, 0.08, 0.45);
      const mountMesh = new THREE.Mesh(mountGeo, mountMat);
      mountMesh.position.set(0, 0.04, 0);
      mountMesh.castShadow = true;
      group.add(mountMesh);

      // Ceiling Mounting Bolts
      for (const [bx, bz] of [[-0.35, -0.15], [0.35, -0.15], [-0.35, 0.15], [0.35, 0.15]]) {
        const boltGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 12);
        const boltMesh = new THREE.Mesh(boltGeo, steelPinMat);
        boltMesh.position.set(bx, 0.09, bz);
        group.add(boltMesh);
      }

      // Pivot Bearing Axle Pin
      const pinGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 20);
      pinGeo.rotateX(Math.PI / 2);
      const pinMesh = new THREE.Mesh(pinGeo, steelPinMat);
      pinMesh.position.set(0, 0, 0);
      group.add(pinMesh);

      // Rotating Arm Group
      const armGroup = new THREE.Group();

      // Standard unit rod translated by -0.5 on Y, so scale.y = L_vis extends cleanly to -L_vis
      const rodGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.0, 24);
      rodGeo.translate(0, -0.5, 0);
      const rodMesh = new THREE.Mesh(rodGeo, chromeMat);
      rodMesh.scale.set(1, L_vis, 1);
      rodMesh.castShadow = true;
      armGroup.add(rodMesh);

      const bandGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.06, 20);
      bandGeo.translate(0, -0.05, 0);
      const bandMesh = new THREE.Mesh(bandGeo, bluePrimaryMat);
      armGroup.add(bandMesh);

      const bobRadius = 0.13;
      const bobGeo = new THREE.SphereGeometry(bobRadius, 32, 32);
      const bobMat = new THREE.MeshStandardMaterial({
        color: 0x264cb2,
        metalness: 0.35,
        roughness: 0.25,
        emissive: 0x000000
      });
      const bobMesh = new THREE.Mesh(bobGeo, bobMat);
      bobMesh.position.set(0, -L_vis, 0);
      bobMesh.scale.setScalar(initialBobScale);
      bobMesh.castShadow = true;
      armGroup.add(bobMesh);

      const ringGeo = new THREE.TorusGeometry(bobRadius * 1.08, 0.012, 16, 32);
      const ringMesh = new THREE.Mesh(ringGeo, palePeriwinkleMat);
      ringMesh.position.set(0, -L_vis, 0);
      ringMesh.scale.setScalar(initialBobScale);
      armGroup.add(ringMesh);

      // Invisible Raycasting Hit Sphere for smooth direct bob dragging
      const hitGeo = new THREE.SphereGeometry(0.32, 16, 16);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitSphere = new THREE.Mesh(hitGeo, hitMat);
      hitSphere.position.set(0, -L_vis, 0);
      armGroup.add(hitSphere);

      // Equilibrium vertical reference line
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x8195b8,
        dashSize: 0.08,
        gapSize: 0.05
      });
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -L_vis - 0.25, 0)
      ]);
      const eqLine = new THREE.Line(lineGeo, lineMat);
      eqLine.computeLineDistances();
      group.add(eqLine);

      const thetaRad = THREE.MathUtils.degToRad(params?.theta0 || 30);
      armGroup.rotation.z = thetaRad;
      group.add(armGroup);

      dynamicPartsRef.current = {
        type: 'simple_pendulum',
        armGroup,
        rodMesh,
        bobMesh,
        ringMesh,
        hitSphere,
        eqLine,
        bobRadius,
        L_vis
      };

      targetCenterRef.current.set(0, -L_vis * 0.45, 0);
      viewDistRef.current = Math.max(2.6, L_vis * 1.45);
    }

    // ── 2. COMPOUND PENDULUM ────────────────────────────────────────────
    else if (simType === 'compound_pendulum') {
      const L_real = Number(params?.length) || 1.0;
      const L_vis = calcVisualLength(L_real);
      const rodW = 0.14;
      const rodD = 0.07;

      const bearingGeo = new THREE.BoxGeometry(0.35, 0.16, 0.32);
      const bearingMesh = new THREE.Mesh(bearingGeo, mountMat);
      bearingMesh.position.set(0, 0.06, 0);
      bearingMesh.castShadow = true;
      group.add(bearingMesh);

      const axleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.44, 20);
      axleGeo.rotateX(Math.PI / 2);
      const axleMesh = new THREE.Mesh(axleGeo, steelPinMat);
      group.add(axleMesh);

      const beamGroup = new THREE.Group();

      const beamGeo = new THREE.BoxGeometry(rodW, 1.0, rodD);
      beamGeo.translate(0, -0.5, 0);
      const beamMesh = new THREE.Mesh(beamGeo, chromeMat);
      beamMesh.scale.set(1, L_vis, 1);
      beamMesh.castShadow = true;
      beamGroup.add(beamMesh);

      // Center of Mass (CoM) Marker
      const comGeo = new THREE.SphereGeometry(0.048, 20, 20);
      const comMesh = new THREE.Mesh(comGeo, accentOrangeMat);
      comMesh.position.set(0, -L_vis / 2, rodD / 2 + 0.015);
      beamGroup.add(comMesh);

      // Center of Percussion (CoP) Marker
      const copGeo = new THREE.SphereGeometry(0.044, 20, 20);
      const copMesh = new THREE.Mesh(copGeo, emeraldMat);
      copMesh.position.set(0, -L_vis * (2 / 3), rodD / 2 + 0.015);
      beamGroup.add(copMesh);

      const thetaRad = THREE.MathUtils.degToRad(params?.theta0 || 25);
      beamGroup.rotation.z = thetaRad;
      group.add(beamGroup);

      dynamicPartsRef.current = {
        type: 'compound_pendulum',
        beamGroup,
        beamMesh,
        comMesh,
        copMesh,
        rodD,
        L_vis
      };

      targetCenterRef.current.set(0, -L_vis * 0.45, 0);
      viewDistRef.current = Math.max(2.6, L_vis * 1.45);
    }

    // ── 3. SLIDER-CRANK MECHANISM (Schematic Model Matching Reference Image) ──
    else if (simType === 'slider_crank') {
      const r_real = Number(params?.crank_length) || 0.1;
      const l_real = Number(params?.conn_length) || 0.3;

      const scale = 2.4 / (r_real + l_real);
      const r = r_real * scale;
      const l = l_real * scale;

      // Dark Materials & Color Palette matching user reference image media_1789912462882.png
      const darkDiscMat = new THREE.MeshStandardMaterial({
        color: 0x162032,
        roughness: 0.42,
        metalness: 0.25
      });
      const goldRimMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.25,
        metalness: 0.75
      });
      const goldCrankMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.28,
        metalness: 0.45
      });
      const standSlateMat = new THREE.MeshStandardMaterial({
        color: 0x2b394e,
        roughness: 0.35,
        metalness: 0.35
      });
      const cyanRodMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.22,
        metalness: 0.35
      });
      const pistonBlueMat = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        roughness: 0.25,
        metalness: 0.35
      });
      const railSteelMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.30,
        metalness: 0.65
      });
      const cyanGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transmission: 0.72,
        opacity: 0.45,
        transparent: true,
        roughness: 0.12,
        metalness: 0.05,
        ior: 1.45,
        thickness: 0.08,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const cyanShelfMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.70
      });

      // 1. Left Dark Housing Disc with Gold Perimeter Ring & Center Arched Bearing Pedestal
      const discRadius = Math.max(r * 1.35, 0.45);
      const housingRoot = buildSchematicHousingAndStand(
        r, discRadius, darkDiscMat, goldRimMat, standSlateMat, chromeMat, steelPinMat
      );
      group.add(housingRoot);

      // 2. Golden-Yellow Crank Link with Counter-Tail
      const crankGroup = buildSchematicCrankLink(r, goldCrankMat, chromeMat);
      crankGroup.position.set(0, 0, 0.025);
      group.add(crankGroup);

      // 3. Sleek Light-Cyan Connecting Rod
      const connMesh = buildSchematicConnectingRod(l, cyanRodMat, chromeMat);
      group.add(connMesh);

      // 4. Cylinder Guide Rails & Translucent Cyan Glass Chamber
      const pistonWidth = 0.28;
      const pistonHeight = 0.22;
      const pistonDepth = 0.20;
      const { cylGroup } = buildSchematicCylinderAndRails(
        l, r, pistonHeight, pistonWidth, railSteelMat, cyanGlassMat, cyanShelfMat
      );
      group.add(cylGroup);

      // 5. Royal Blue Rectangular Piston Block with Golden Compression Rings
      const pistonGroup = buildSchematicPiston(
        pistonWidth, pistonHeight, pistonDepth, pistonBlueMat, goldRimMat, chromeMat
      );
      group.add(pistonGroup);

      // 6. Floating Glassmorphic Dimension Badges (matching reference image!)
      const rBadge = createDynamicHUDLabel(`r = ${r_real.toFixed(3)} m`, new THREE.Vector3(r * 0.35, discRadius * 0.58, 0.08), [0.55, 0.14, 1]);
      group.add(rBadge.sprite);

      const lBadge = createDynamicHUDLabel(`l = ${l_real.toFixed(3)} m`, new THREE.Vector3(l * 0.72, pistonHeight * 0.95, 0.08), [0.55, 0.14, 1]);
      group.add(lBadge.sprite);

      // Crankpin Motion Trail Line
      const maxTrailSC = 80;
      const trailPositionsSC = new Float32Array(maxTrailSC * 3);
      const trailGeoSC = new THREE.BufferGeometry();
      trailGeoSC.setAttribute('position', new THREE.BufferAttribute(trailPositionsSC, 3));
      const trailMatSC = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });
      const trailLineSC = new THREE.Line(trailGeoSC, trailMatSC);
      group.add(trailLineSC);

      // Dynamic 3D Piston Velocity Vector Arrow (Cyan)
      const cyanVectorMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        metalness: 0.6,
        roughness: 0.2
      });
      const pistonArrow = createVectorMesh(cyanVectorMat);
      group.add(pistonArrow);

      dynamicPartsRef.current = {
        type: 'slider_crank',
        crankGroup,
        connMesh,
        pistonMesh: pistonGroup,
        rBadge,
        lBadge,
        pistonArrow,
        scale,
        trailPositions: trailPositionsSC,
        trailLine: trailLineSC,
        trailCount: 0,
        maxTrail: maxTrailSC,
        r,
        l,
        r_real,
        l_real
      };

      targetCenterRef.current.set(l / 2, 0, 0);
      viewDistRef.current = Math.max(2.5, (l + r) * 1.35);
    }

    // ── 4. FOUR-BAR LINKAGE (Industrial Machinery with Base) ───────────
    else if (simType === 'four_bar') {
      const d_real = Number(params?.link_ground) || 4.0;
      const a_real = Number(params?.link_crank) || 1.0;
      const b_real = Number(params?.link_coupler) || 2.5;
      const c_real = Number(params?.link_rocker) || 3.0;

      // Kinematic bounding box calculation across full theoretical reach
      const xMinReal = Math.min(-a_real, d_real - c_real);
      const xMaxReal = Math.max(a_real, d_real + c_real);
      const yMinReal = -Math.max(a_real, c_real);
      const yMaxReal = Math.max(a_real, c_real);

      const spanX = Math.max(xMaxReal - xMinReal, 1.0);
      const spanY = Math.max(yMaxReal - yMinReal, 1.0);
      const maxSpan = Math.max(spanX, spanY);

      // Desired visual span ~2.5 units in 3D world space
      const scale = 2.5 / maxSpan;
      const dx = d_real * scale;
      const a_vis = a_real * scale;
      const b_vis = b_real * scale;
      const c_vis = c_real * scale;
      const centerX = ((xMinReal + xMaxReal) / 2) * scale;

      // Heavy CNC Precision Ground Machine Bed Plate with Dual T-Slots (Like Before, Zero Collision)
      const baseBed = buildProfessionalFourBarBed(dx, a_vis, mountMat, steelPinMat, chromeMat, darkSteelMat);
      group.add(baseBed);

      // Joint A: Industrial Electric Gearmotor with 180° Counterweight Spindle
      const { motorGroup, rotatingSpindle: motorSpindle } = buildElectricGearMotorWithCounterweight(
        1.0, motorBlueMat, darkSteelMat, steelPinMat, chromeMat, royalBlueMat
      );
      motorGroup.position.set(0, 0, 0);
      group.add(motorGroup);

      // Joint D: Heavy Industrial Pillow-Block Clevis Stand (x=dx, y=0)
      const clevisStandD = buildClevisStand(0.14, 0.11, 0.11, mountMat, steelPinMat, chromeMat);
      clevisStandD.position.set(dx, 0, 0);
      group.add(clevisStandD);

      // Link 2: Input Crank - Royal Blue Anodized I-Beam Link
      const crankGroup = buildDogboneLink(a_vis, 0.075, 0.034, royalBlueMat, brushedAluminumMat, chromeMat);
      crankGroup.position.set(0, 0, 0.035);
      group.add(crankGroup);

      // Cyan Dashed Circular Orbit Line of Crankpin (Matching reference image!)
      const orbitPts = [];
      for (let k = 0; k <= 72; k++) {
        const a = (k / 72) * Math.PI * 2;
        orbitPts.push(new THREE.Vector3(a_vis * Math.cos(a), a_vis * Math.sin(a), 0.038));
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
      const orbitMat = new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 0.04,
        gapSize: 0.03,
        transparent: true,
        opacity: 0.85
      });
      const crankOrbitLine = new THREE.Line(orbitGeo, orbitMat);
      crankOrbitLine.computeLineDistances();
      group.add(crankOrbitLine);

      // Dynamic Crank Sweep Arc (from 0 to th2)
      const sweepArcSegs = 32;
      const sweepArcPositions = new Float32Array((sweepArcSegs + 1) * 3);
      const sweepArcGeo = new THREE.BufferGeometry();
      sweepArcGeo.setAttribute('position', new THREE.BufferAttribute(sweepArcPositions, 3));
      const sweepArcMat = new THREE.LineBasicMaterial({
        color: 0x0ea5e9,
        linewidth: 2.4,
        transparent: true,
        opacity: 0.95
      });
      const sweepArcLine = new THREE.Line(sweepArcGeo, sweepArcMat);
      group.add(sweepArcLine);

      const sweepArrow = createVectorMesh(new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0284c7 }));
      sweepArrow.scale.setScalar(0.40);
      group.add(sweepArrow);

      // Floating Dark HUD Angle Pill Badge: "θ = 88.2°" (Matching reference image!)
      const angleHUD = createDynamicHUDLabel('θ = 0.0°', new THREE.Vector3(0, a_vis * 1.12 + 0.24, 0.12), [0.55, 0.14, 1]);
      group.add(angleHUD.sprite);

      // Link 4: Output Rocker - Royal Blue Anodized I-Beam Link
      const rockerGroup = buildDogboneLink(c_vis, 0.075, 0.034, royalBlueMat, brushedAluminumMat, chromeMat);
      rockerGroup.position.set(dx, 0, 0.035);
      group.add(rockerGroup);

      // Link 3: Precision CNC Binary Coupler Link
      const uRatio = params?.coupler_offset_u !== undefined ? Number(params.coupler_offset_u) : 0.5;
      const vOffset = (params?.coupler_offset_v !== undefined ? Number(params.coupler_offset_v) : (Number(params?.coupler_tracer_offset) || 0.0)) * scale;
      const { couplerGroup, uRatio: usedU, apexOffset, jewelMesh, tracerHalo } = buildTriangularCoupler(
        b_vis, 0.070, 0.034, royalBlueMat, brushedAluminumMat, chromeMat,
        uRatio, vOffset
      );
      group.add(couplerGroup);

      // Precision Floating Connecting Pins
      const pinB = buildPivotPin(0.13, steelPinMat, chromeMat);
      group.add(pinB);

      const pinC = buildPivotPin(0.13, steelPinMat, chromeMat);
      group.add(pinC);

      // Live Transmission Angle Arc at Joint C (Preallocated buffer)
      const arcSegs = 24;
      const arcPositions = new Float32Array((arcSegs + 1) * 3);
      const arcGeo = new THREE.BufferGeometry();
      arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
      const arcMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2.5, transparent: true, opacity: 0.95 });
      const transmissionArcLine = new THREE.Line(arcGeo, arcMat);
      group.add(transmissionArcLine);

      // Coupler Apex Motion Trail Line
      const maxTrailFB = 240;
      const trailPositionsFB = new Float32Array(maxTrailFB * 3);
      const trailGeoFB = new THREE.BufferGeometry();
      trailGeoFB.setAttribute('position', new THREE.BufferAttribute(trailPositionsFB, 3));
      const trailMatFB = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
      const trailLineFB = new THREE.Line(trailGeoFB, trailMatFB);
      group.add(trailLineFB);

      // Dynamic 3D Rocker Velocity Vector Arrow at Joint C
      const cyanVectorMatFB = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        metalness: 0.6,
        roughness: 0.2
      });
      const rockerArrow = createVectorMesh(cyanVectorMatFB);
      group.add(rockerArrow);

      // Live Dynamic Transmission Angle Floating HUD Badge
      const transmissionBadge = createDynamicHUDLabel('μ = 90.0°', new THREE.Vector3(dx, 0.40, 0.12));
      group.add(transmissionBadge.sprite);

      dynamicPartsRef.current = {
        type: 'four_bar',
        motorSpindle,
        crankGroup,
        couplerGroup,
        rockerGroup,
        pinB,
        pinC,
        jewelMesh,
        tracerHalo,
        transmissionArcLine,
        arcPositions,
        arcGeo,
        arcMat,
        rockerArrow,
        transmissionBadge,
        angleHUD,
        sweepArcLine,
        sweepArcPositions,
        sweepArrow,
        trailPositions: trailPositionsFB,
        trailLine: trailLineFB,
        trailCount: 0,
        maxTrail: maxTrailFB,
        a_vis,
        b_vis,
        uRatio: usedU,
        apexOffset,
        scale,
        dx,
        a_real,
        b_real,
        c_real,
        d_real
      };

      targetCenterRef.current.set(centerX, 0, 0);
      viewDistRef.current = Math.max(3.2, maxSpan * scale * 1.45);
      lastTh4Ref.current = null;
      crankThetaRef.current = 0;
    }

    // Dynamic Floor & Grid Elevation Adjustment
    if (gridRef.current && floorRef.current) {
      const floorY = (simType === 'simple_pendulum' || simType === 'compound_pendulum') ? -1.65 : -1.40;
      gridRef.current.position.y = floorY;
      floorRef.current.position.y = floorY;
    }

    // Reframe camera target ONLY when switching mechanism types or on initial mount!
    // When adjusting parameters or presets, preserve user's exact camera orientation
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const isNewMechanism = lastFramedSimTypeRef.current !== simType;
    if (camera && controls) {
      if (isNewMechanism) {
        lastFramedSimTypeRef.current = simType;
        const center = targetCenterRef.current;
        const d = viewDistRef.current;
        controls.target.copy(center);
        const currentView = cameraViewRef.current;
        if (currentView === 'front') {
          camera.position.set(center.x, center.y, center.z + d * 1.05);
        } else if (currentView === 'top') {
          camera.position.set(center.x, center.y + d * 1.25, center.z + 0.01);
        } else if (currentView === 'side') {
          camera.position.set(center.x + d * 1.15, center.y, center.z);
        } else if (currentView !== 'rotate360') {
          camera.position.set(center.x + d * 0.65, center.y + d * 0.45, center.z + d * 0.85);
        }
        controls.update();
      } else {
        const offset = camera.position.clone().sub(controls.target);
        controls.target.copy(targetCenterRef.current);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      }
    }
  }, [simType, params?.crank_length, params?.conn_length, params?.link_ground, params?.link_crank, params?.link_coupler, params?.link_rocker, params?.coupler_offset_u, params?.coupler_offset_v, params?.coupler_tracer_offset]);

  // ── Continuous 60/120 FPS Hardware-Accelerated Kinematics Loop ───────
  useEffect(() => {
    updateTransformsRef.current = () => {
      const parts = dynamicPartsRef.current;
      if (!parts) return;
      const curIdx = animIdxRef.current || 0;

      const liveData = simDataRef.current;
      const liveParams = paramsRef.current;
      if (feasCacheRef.current.params !== liveParams || feasCacheRef.current.type !== parts.type) {
        const feas = checkFeasibility(parts.type, liveParams);
        feasCacheRef.current = {
          params: liveParams,
          type: parts.type,
          isCaseCorrect: feas.status === FEASIBILITY_STATUS.OK
        };
      }
      const isCaseCorrect = feasCacheRef.current.isCaseCorrect;
      const playing = isPlayingRef.current && isCaseCorrect;

      // Clear motion trail on manual seek/scrub while paused
      if (lastCurIdxRef.current !== null && Math.abs(curIdx - lastCurIdxRef.current) > 1 && !playing) {
        if (parts.trailLine) {
          parts.trailCount = 0;
          parts.trailLine.geometry.setDrawRange(0, 0);
          parts.trailLine.geometry.attributes.position.needsUpdate = true;
        }
      }
      lastCurIdxRef.current = curIdx;

      // ── Smooth In-Place Parameter Adjustments (Zero Rebuild, Zero Freeze) ──
      // Whenever the user adjusts pendulum mass or rod length, scale and reposition
      // meshes in-place instantly directly in the animation loop from mutable paramsRef!
      if (parts.type === 'simple_pendulum') {
        const L_real = Number(liveParams?.length) || 1.0;
        const m_real = Number(liveParams?.mass) || 1.0;
        if (parts.lastAppliedL_real !== L_real || parts.lastAppliedM_real !== m_real) {
          parts.lastAppliedL_real = L_real;
          parts.lastAppliedM_real = m_real;
          const L_vis = calcVisualLength(L_real);
          const bobScale = Math.max(0.6, Math.min(1.5, Math.cbrt(m_real / 1.0)));

          if (parts.rodMesh) parts.rodMesh.scale.set(1, L_vis, 1);
          if (parts.bobMesh) {
            parts.bobMesh.position.set(0, -L_vis, 0);
            parts.bobMesh.scale.setScalar(bobScale);
          }
          if (parts.ringMesh) {
            parts.ringMesh.position.set(0, -L_vis, 0);
            parts.ringMesh.scale.setScalar(bobScale);
          }
          if (parts.hitSphere) {
            parts.hitSphere.position.set(0, -L_vis, 0);
            const hitR = Math.max(0.28, (parts.bobRadius || 0.13) * bobScale * 1.8);
            parts.hitSphere.scale.setScalar(hitR / 0.32);
          }
          if (parts.eqLine) {
            parts.eqLine.geometry.setFromPoints([
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(0, -L_vis - 0.25, 0)
            ]);
            parts.eqLine.computeLineDistances();
          }
          parts.L_vis = L_vis;
        }
      } else if (parts.type === 'compound_pendulum') {
        const L_real = Number(liveParams?.length) || 1.0;
        if (parts.lastAppliedL_real !== L_real) {
          parts.lastAppliedL_real = L_real;
          const L_vis = calcVisualLength(L_real);
          if (parts.beamMesh) parts.beamMesh.scale.set(1, L_vis, 1);
          if (parts.comMesh) parts.comMesh.position.set(0, -L_vis / 2, (parts.rodD || 0.07) / 2 + 0.015);
          if (parts.copMesh) parts.copMesh.position.set(0, -L_vis * (2 / 3), (parts.rodD || 0.07) / 2 + 0.015);
          parts.L_vis = L_vis;
        }
      }

      // 1. SIMPLE PENDULUM KINEMATICS
      if (parts.type === 'simple_pendulum' && parts.armGroup) {
        // If user is actively dragging the bob in 3D, drag handler controls rotation directly
        if (isDraggingRef.current) return;

        if (playing) {
          const tMax = liveData?.time?.[liveData.time.length - 1] || 5.0;
          const curT = continuousTimeRef.current % tMax;

          // Continuous sub-frame interpolation between discrete simulation points
          if (liveData?.time && liveData?.theta && liveData.time.length > 1) {
            const times = liveData.time;
            const dt = liveData.params?.dt || (times[1] - times[0]) || 0.01;
            const floatIdx = curT / dt;
            const i0 = Math.max(0, Math.min(times.length - 2, Math.floor(floatIdx)));
            const frac = Math.max(0, Math.min(1, floatIdx - i0));
            const th0 = liveData.theta[i0];
            const th1 = liveData.theta[i0 + 1];
            const thetaRad = th0 + (th1 - th0) * frac;
            parts.armGroup.rotation.z = thetaRad;
          } else {
            const thetaRad = liveData?.theta?.[curIdx] ?? THREE.MathUtils.degToRad(liveParams?.theta0 || 30);
            parts.armGroup.rotation.z = thetaRad;
          }
        } else {
          // Paused / Scrubbing
          const thetaRad = (liveData?.theta && liveData.theta[curIdx] !== undefined)
            ? liveData.theta[curIdx]
            : THREE.MathUtils.degToRad(liveParams?.theta0 || 30);
          parts.armGroup.rotation.z = thetaRad;
        }
      }

      // 2. COMPOUND PENDULUM KINEMATICS
      else if (parts.type === 'compound_pendulum' && parts.beamGroup) {
        if (playing) {
          const tMax = liveData?.time?.[liveData.time.length - 1] || 5.0;
          const curT = continuousTimeRef.current % tMax;

          if (liveData?.time && liveData?.theta && liveData.time.length > 1) {
            const times = liveData.time;
            const dt = liveData.params?.dt || (times[1] - times[0]) || 0.01;
            const floatIdx = curT / dt;
            const i0 = Math.max(0, Math.min(times.length - 2, Math.floor(floatIdx)));
            const frac = Math.max(0, Math.min(1, floatIdx - i0));
            const th0 = liveData.theta[i0];
            const th1 = liveData.theta[i0 + 1];
            const thetaRad = th0 + (th1 - th0) * frac;
            parts.beamGroup.rotation.z = thetaRad;
          } else {
            const thetaRad = liveData?.theta?.[curIdx] ?? THREE.MathUtils.degToRad(liveParams?.theta0 || 25);
            parts.beamGroup.rotation.z = thetaRad;
          }
        } else {
          const thetaRad = (liveData?.theta && liveData.theta[curIdx] !== undefined)
            ? liveData.theta[curIdx]
            : THREE.MathUtils.degToRad(liveParams?.theta0 || 25);
          parts.beamGroup.rotation.z = thetaRad;
        }
      }

      // 3. SLIDER-CRANK KINEMATICS (Continuous analytical closed-form)
      else if (parts.type === 'slider_crank' && parts.crankGroup) {
        const { r, l } = parts;
        const speed = Number(liveParams?.crank_speed) || 60.0;
        const omega = (speed * 2 * Math.PI) / 60;

        let theta;
        if (playing) {
          theta = crankThetaRef.current;
        } else {
          const deg = (liveData?.crank_angle_deg && liveData.crank_angle_deg[curIdx] !== undefined)
            ? liveData.crank_angle_deg[curIdx]
            : ((curIdx % 120) / 120) * 360;
          theta = THREE.MathUtils.degToRad(deg);
          crankThetaRef.current = theta;
        }

        const crankPinX = r * Math.cos(theta);
        const crankPinY = r * Math.sin(theta);
        const sinBeta = (r * Math.sin(theta)) / l;
        const cosBeta = Math.sqrt(Math.max(0, 1 - sinBeta * sinBeta));
        const sliderX = crankPinX + l * cosBeta;

        // Rotate golden crank arm & counter-tail
        parts.crankGroup.rotation.z = theta;

        // Connecting rod connects crankpin to piston wrist pin
        const connAngle = Math.atan2(-crankPinY, sliderX - crankPinX);
        if (parts.connMesh) {
          parts.connMesh.position.set(crankPinX, crankPinY, 0.035);
          parts.connMesh.rotation.z = connAngle;
        }

        // Royal blue piston reciprocates inside transparent cylinder
        if (parts.pistonMesh) {
          parts.pistonMesh.position.set(sliderX, 0, 0.025);
        }

        // Dynamic 3D Piston Velocity Vector Arrow (Cyan)
        const vSlider = -r * omega * (Math.sin(theta) + (r * Math.sin(2 * theta)) / (2 * l * (cosBeta || 1)));
        if (parts.pistonArrow) {
          if (Math.abs(vSlider) > 0.02) {
            parts.pistonArrow.visible = true;
            parts.pistonArrow.position.set(sliderX, 0.22, 0.04);
            parts.pistonArrow.rotation.z = vSlider >= 0 ? -Math.PI / 2 : Math.PI / 2;
            const vScale = Math.min(2.0, Math.max(0.2, (Math.abs(vSlider) / (r * omega || 1)) * 1.1));
            parts.pistonArrow.scale.set(1, vScale, 1);
          } else {
            parts.pistonArrow.visible = false;
          }
        }

        // Crankpin Motion Trail
        if (parts.trailPositions && parts.trailLine) {
          const arr = parts.trailPositions;
          const maxT = parts.maxTrail;
          if (parts.trailCount < maxT) {
            const idx = parts.trailCount * 3;
            arr[idx] = crankPinX;
            arr[idx + 1] = crankPinY;
            arr[idx + 2] = 0.035;
            parts.trailCount++;
          } else {
            arr.copyWithin(0, 3);
            const idx = (maxT - 1) * 3;
            arr[idx] = crankPinX;
            arr[idx + 1] = crankPinY;
            arr[idx + 2] = 0.035;
          }
          parts.trailLine.geometry.setDrawRange(0, parts.trailCount);
          parts.trailLine.geometry.attributes.position.needsUpdate = true;
        }
      }

      // 4. FOUR-BAR LINKAGE KINEMATICS
      else if (parts.type === 'four_bar' && parts.crankGroup) {
        const { scale, dx, a_real, b_real, c_real, d_real, a_vis, b_vis, apexOffset, uRatio } = parts;
        let th2;

        const speed = Number(liveParams?.crank_speed) || 75.0;
        const omega2 = (speed * 2 * Math.PI) / 60;

        const arcInfo = computeReachableInputArc(d_real, a_real, b_real, c_real);

        if (playing) {
          if (arcInfo.isFullRotation) {
            th2 = crankThetaRef.current;
          } else if (!arcInfo.impossible) {
            const span = (arcInfo.maxAngle - arcInfo.minAngle) / 2;
            const center = (arcInfo.maxAngle + arcInfo.minAngle) / 2;
            th2 = center + (span * 0.98) * Math.sin(continuousTimeRef.current * omega2);
          } else {
            th2 = 0;
          }
        } else {
          lastTh4Ref.current = null;
          if (liveData?.time && liveData?.crank_angle_deg && liveData.crank_angle_deg[curIdx] !== undefined) {
            th2 = THREE.MathUtils.degToRad(liveData.crank_angle_deg[curIdx]);
          } else {
            const total = liveData?.time?.length || 120;
            th2 = (curIdx / total) * 2 * Math.PI;
          }
          crankThetaRef.current = th2;
        }

        const pose = solveFourBarContinuous(d_real, a_real, b_real, c_real, th2, lastTh4Ref.current);
        if (!pose.success) {
          // Kinematic loop closure fails at this angle — do not corrupt link geometry or append invalid trail points!
          return;
        }
        lastTh4Ref.current = pose.theta4;

        const bx = pose.bx * scale;
        const by = pose.by * scale;
        const cx = pose.cx * scale;
        const cy = pose.cy * scale;

        // Rotate motor spindle with counterweight hub
        if (parts.motorSpindle) {
          parts.motorSpindle.rotation.z = th2;
        }

        // Rotate crank arm
        parts.crankGroup.rotation.z = th2;

        // Position and rotate coupler
        const couplerAngle = Math.atan2(cy - by, cx - bx);
        parts.couplerGroup.position.set(bx, by, 0.065);
        parts.couplerGroup.rotation.z = couplerAngle;

        // Rotate output rocker
        const rockerAngle = Math.atan2(cy, cx - dx);
        parts.rockerGroup.rotation.z = rockerAngle;

        if (parts.pinB) parts.pinB.position.set(bx, by, 0.035);
        if (parts.pinC) parts.pinC.position.set(cx, cy, 0.035);

        // Dynamic Angle HUD Pill Badge "θ = 88.2°"
        const degVal = ((th2 * 180 / Math.PI) % 360 + 360) % 360;
        if (parts.angleHUD) {
          parts.angleHUD.update(
            `θ = ${degVal.toFixed(1)}°`,
            '#38bdf8',
            'rgba(56, 189, 248, 0.75)',
            'rgba(15, 23, 42, 0.92)'
          );
          parts.angleHUD.sprite.position.set(0, a_vis * 1.12 + 0.24, 0.12);
        }

        // Curved Sweep Arc from 0 to th2 on radius rArc
        if (parts.sweepArcLine && parts.sweepArcPositions) {
          const rArc = Math.max(0.12, Math.min(a_vis * 0.72, 0.40));
          const sweepTheta = ((th2 % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          const pos = parts.sweepArcPositions;
          for (let k = 0; k <= 32; k++) {
            const a = (k / 32) * sweepTheta;
            pos[k * 3] = rArc * Math.cos(a);
            pos[k * 3 + 1] = rArc * Math.sin(a);
            pos[k * 3 + 2] = 0.045;
          }
          parts.sweepArcLine.geometry.attributes.position.needsUpdate = true;
          if (parts.sweepArrow) {
            parts.sweepArrow.visible = Math.abs(sweepTheta) > 0.05;
            parts.sweepArrow.position.set(rArc * Math.cos(sweepTheta), rArc * Math.sin(sweepTheta), 0.045);
            parts.sweepArrow.rotation.z = sweepTheta + Math.PI / 2;
          }
        }

        // Radiant jewel stylus & halo pulse effect at tracer apex
        if (parts.tracerHalo) {
          const pulse = 1.0 + 0.18 * Math.sin(th2 * 2);
          parts.tracerHalo.scale.setScalar(pulse);
        }

        // Configurable Tracer world position (on-link or offset)
        const effU = uRatio !== undefined ? uRatio : 0.5;
        const uDist = effU * b_vis;
        const effOffset = (apexOffset !== undefined) ? apexOffset : 0;
        const apexWorldX = bx + Math.cos(couplerAngle) * uDist - Math.sin(couplerAngle) * effOffset;
        const apexWorldY = by + Math.sin(couplerAngle) * uDist + Math.cos(couplerAngle) * effOffset;

        // Coupler Apex Motion Trail with Discontinuity Rejection
        if (parts.trailPositions && parts.trailLine) {
          const arr = parts.trailPositions;
          const maxT = parts.maxTrail;
          if (Number.isFinite(apexWorldX) && Number.isFinite(apexWorldY)) {
            // Guard against large discontinuity jumps (which cause vertical or cross-screen spike lines)
            let isJump = false;
            if (parts.trailCount > 0) {
              const lastI = (parts.trailCount < maxT ? parts.trailCount - 1 : maxT - 1) * 3;
              const dxJump = apexWorldX - arr[lastI];
              const dyJump = apexWorldY - arr[lastI + 1];
              if (dxJump * dxJump + dyJump * dyJump > 0.8) {
                isJump = true;
              }
            }

            if (!isJump) {
              if (parts.trailCount < maxT) {
                const idx = parts.trailCount * 3;
                arr[idx] = apexWorldX;
                arr[idx + 1] = apexWorldY;
                arr[idx + 2] = 0.085;
                parts.trailCount++;
              } else {
                arr.copyWithin(0, 3);
                const idx = (maxT - 1) * 3;
                arr[idx] = apexWorldX;
                arr[idx + 1] = apexWorldY;
                arr[idx + 2] = 0.085;
              }
              parts.trailLine.geometry.setDrawRange(0, parts.trailCount);
              parts.trailLine.geometry.attributes.position.needsUpdate = true;
            } else {
              // Reset trail at new apex location on sudden teleportation so no spike lines are drawn
              parts.trailCount = 1;
              arr[0] = apexWorldX;
              arr[1] = apexWorldY;
              arr[2] = 0.085;
              parts.trailLine.geometry.setDrawRange(0, 1);
              parts.trailLine.geometry.attributes.position.needsUpdate = true;
            }
          }
        }

        // Live Transmission Angle at Joint C
        const angCB = Math.atan2(by - cy, bx - cx);
        const angCD = Math.atan2(-cy, dx - cx);

        let diff = angCB - angCD;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;

        const acuteMuDeg = (Math.min(Math.abs(diff), Math.PI - Math.abs(diff)) * 180) / Math.PI;

        // Dynamic Transmission Angle Arc
        if (parts.transmissionArcLine && parts.arcPositions && parts.arcGeo && parts.arcMat) {
          let startAng = angCD;
          let span = diff;
          if (Math.abs(diff) > Math.PI / 2) {
            if (diff > 0) {
              startAng = angCD + Math.PI;
              span = diff - Math.PI;
            } else {
              startAng = angCD - Math.PI;
              span = diff + Math.PI;
            }
          }

          const rArc = 0.22 * Math.min(1.0, scale * b_real);
          const posArr = parts.arcPositions;
          for (let k = 0; k <= 24; k++) {
            const a = startAng + (k / 24) * span;
            posArr[k * 3] = cx + rArc * Math.cos(a);
            posArr[k * 3 + 1] = cy + rArc * Math.sin(a);
            posArr[k * 3 + 2] = 0.088;
          }
          parts.arcGeo.attributes.position.needsUpdate = true;

          if (acuteMuDeg > 50.0) {
            parts.arcMat.color.setHex(0x10b981);
          } else if (acuteMuDeg >= 40.0) {
            parts.arcMat.color.setHex(0xf59e0b);
          } else {
            parts.arcMat.color.setHex(0xef4444);
          }
        }

        // Dynamic Velocity Vector Arrow on Joint C
        if (parts.rockerArrow) {
          const sin_34 = Math.sin(pose.theta3 - pose.theta4) || 1e-5;
          const w4 = (a_real * omega2 * Math.sin(pose.theta3 - th2)) / (c_real * sin_34);
          const vC = w4 * c_real * scale;
          if (Math.abs(vC) > 0.02) {
            parts.rockerArrow.visible = true;
            parts.rockerArrow.position.set(cx, cy, 0.095);
            const tangentAngle = rockerAngle + (w4 >= 0 ? Math.PI / 2 : -Math.PI / 2);
            parts.rockerArrow.rotation.z = tangentAngle;
            const vScale = Math.min(2.0, Math.max(0.20, Math.abs(vC) * 0.45));
            parts.rockerArrow.scale.set(1, vScale, 1);
          } else {
            parts.rockerArrow.visible = false;
          }
        }

        // Live Dynamic Transmission Angle Floating HUD Badge
        if (parts.transmissionBadge) {
          const degStr = acuteMuDeg.toFixed(1) + '°';
          let badgeCol = '#10b981', badgeBorder = 'rgba(16, 185, 129, 0.75)';
          if (acuteMuDeg < 40) {
            badgeCol = '#ef4444';
            badgeBorder = 'rgba(239, 68, 68, 0.85)';
          } else if (acuteMuDeg <= 50) {
            badgeCol = '#f59e0b';
            badgeBorder = 'rgba(245, 158, 11, 0.75)';
          }
          parts.transmissionBadge.update(`μ = ${degStr}`, badgeCol, badgeBorder);
          parts.transmissionBadge.sprite.position.set(cx, cy + 0.34, 0.12);
        }
      }
    };
  }, [simType]);

  return (
    <div ref={wrapperRef} className="scene3d-wrapper">
      {/* Top Floating Context Header Badge */}
      <div className="scene3d-header-badge">
        <span className="scene3d-header-dot" />
        <span className="scene3d-header-title">{getSubtitle(simType)}</span>
      </div>

      {/* Left Glassmorphic Quick Action CAD Tools */}
      <div className="scene3d-floating-tools">
        <button
          type="button"
          className={`scene3d-tool-btn ${cameraView === 'rotate360' ? 'active' : ''}`}
          onClick={() => setView('rotate360')}
          title="Toggle 360° Continuous Orbit"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        </button>
        <button
          type="button"
          className="scene3d-tool-btn"
          onClick={handleZoomFit}
          title="Zoom to Fit CAD Model"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <button
          type="button"
          className="scene3d-tool-btn"
          onClick={handleCenterFocus}
          title="Re-center CAD View"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <button
          type="button"
          className={`scene3d-tool-btn ${isFullscreen ? 'active' : ''}`}
          onClick={handleFullscreenToggle}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
        >
          {isFullscreen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          )}
        </button>
      </div>

      <div ref={mountRef} className="scene3d-viewport" />

      {webglError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F1F1F8',
          color: '#173770',
          padding: 24,
          textAlign: 'center',
          zIndex: 5
        }}>
          <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>3D CAD Viewport Initialized</p>
          <p style={{ fontSize: 13, color: '#526B8F', maxWidth: 450 }}>
            WebGL 3D hardware acceleration requires a WebGL2-compatible environment. Switch to 2D for ultra-high-resolution CAD kinematics visualization.
          </p>
        </div>
      )}

      {/* 3D Viewport HUD Overlay */}
      <div className="scene3d-hud">
        <div className="scene3d-top-right-bar">
          <canvas
            ref={gizmoCanvasRef}
            className="scene3d-gizmo-canvas"
            width={120}
            height={120}
            title="CAD 3D Orientation Reference"
          />
          <div className="scene3d-view-buttons">
            <span className="scene3d-hud-label">View:</span>
            <button
              type="button"
              className={`scene3d-view-btn ${cameraView === 'iso' ? 'active' : ''}`}
              onClick={() => setView('iso')}
            >
              Isometric
            </button>
            <button
              type="button"
              className={`scene3d-view-btn ${cameraView === 'front' ? 'active' : ''}`}
              onClick={() => setView('front')}
            >
              Front
            </button>
            <button
              type="button"
              className={`scene3d-view-btn ${cameraView === 'top' ? 'active' : ''}`}
              onClick={() => setView('top')}
            >
              Top
            </button>
            <button
              type="button"
              className={`scene3d-view-btn ${cameraView === 'side' ? 'active' : ''}`}
              onClick={() => setView('side')}
            >
              Side
            </button>
            <button
              type="button"
              className={`scene3d-view-btn btn-rotate-360 ${cameraView === 'rotate360' ? 'active' : ''}`}
              onClick={() => setView('rotate360')}
              title="Toggle continuous 360° orbit rotation"
            >
              <svg
                className={`rotate-360-icon ${cameraView === 'rotate360' ? 'spinning' : ''}`}
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>360° Rotate</span>
            </button>
          </div>
        </div>

        <div className="scene3d-hud-hint">
          {cameraView === 'rotate360' ? (
            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              ⟳ Continuous 360° Orbit • Click any view to stop
            </span>
          ) : simType === 'simple_pendulum' ? (
            'Left-drag bob to set initial angle • Drag space to orbit • Scroll to zoom'
          ) : (
            'Left-drag space to orbit • Right-drag to pan • Scroll to zoom'
          )}
        </div>
      </div>
    </div>
  );
};
