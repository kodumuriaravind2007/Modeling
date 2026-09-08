import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const Scene3D = ({
  simType,
  params,
  simData,
  animIdx,
  isPlaying,
  animSpeed,
  onTogglePlay,
  onStepAnim,
  onSetAnimIdx,
  onSpeedChange
}) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const mechanismGroupRef = useRef(null);
  const trailLineRef = useRef(null);

  const [cameraView, setCameraView] = useState('iso');

  // ── Setup Three.js Scene, Camera, Lights, Grid ────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x050814);
    scene.fog = new THREE.FogExp2(0x050814, 0.04);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2.6, 2.0, 3.4);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 15;
    controls.minDistance = 0.5;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(5, 8, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const fillLight = new THREE.PointLight(0x06b6d4, 1.2, 15);
    fillLight.position.set(-4, 3, -3);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x6366f1, 1.0, 15);
    rimLight.position.set(2, -3, -4);
    scene.add(rimLight);

    // Floor Grid
    const grid = new THREE.GridHelper(12, 24, 0x6366f1, 0x1e293b);
    grid.position.y = -1.8;
    scene.add(grid);

    // Mechanism parent group
    const mechGroup = new THREE.Group();
    mechanismGroupRef.current = mechGroup;
    scene.add(mechGroup);

    // Animation Loop
    let animFrameId;
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Observer
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
      cancelAnimationFrame(animFrameId);
      controls.dispose();
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ── Preset Camera Positions ───────────────────────────────────────────
  const setView = (viewKey) => {
    setCameraView(viewKey);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (viewKey === 'iso') {
      camera.position.set(2.6, 2.0, 3.4);
      controls.target.set(0, 0, 0);
    } else if (viewKey === 'front') {
      camera.position.set(0, 0, 4.2);
      controls.target.set(0, 0, 0);
    } else if (viewKey === 'top') {
      camera.position.set(0, 5.0, 0.01);
      controls.target.set(0, 0, 0);
    } else if (viewKey === 'side') {
      camera.position.set(4.2, 0, 0);
      controls.target.set(0, 0, 0);
    }
  };

  // ── Build & Update 3D Geometry Based on Mechanism & animIdx ───────────
  useEffect(() => {
    const group = mechanismGroupRef.current;
    if (!group) return;

    // Clear previous mechanism children
    while (group.children.length > 0) {
      const obj = group.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
      group.remove(obj);
    }

    // Material definitions
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.15
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.25
    });
    const cyanMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.6,
      roughness: 0.3
    });
    const indigoMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      metalness: 0.7,
      roughness: 0.25
    });
    const emeraldMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.7,
      roughness: 0.3
    });
    const slateDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.5,
      roughness: 0.5
    });

    // ── 1. SIMPLE PENDULUM ──────────────────────────────────────────────
    if (simType === 'simple_pendulum') {
      const L_real = params?.length || 1.0;
      const m_real = params?.mass || 1.0;
      // Visual scale
      const L_vis = Math.min(2.5, Math.max(0.8, L_real * 1.2));
      const bobRadius = Math.min(0.24, Math.max(0.09, 0.11 * Math.cbrt(m_real)));

      // Current angle
      const thetaRad = simData?.theta && simData.theta[animIdx] !== undefined
        ? simData.theta[animIdx]
        : THREE.MathUtils.degToRad(params?.theta0 || 30);

      // Base Mounting Ceiling Plate
      const mountGeo = new THREE.BoxGeometry(0.8, 0.08, 0.4);
      const mountMesh = new THREE.Mesh(mountGeo, slateDarkMat);
      mountMesh.position.set(0, 0.04, 0);
      mountMesh.castShadow = true;
      group.add(mountMesh);

      // Pivot Bearing Pin
      const pinGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 16);
      pinGeo.rotateX(Math.PI / 2);
      const pinMesh = new THREE.Mesh(pinGeo, brassMat);
      pinMesh.position.set(0, 0, 0);
      group.add(pinMesh);

      // Pendulum Rotating Arm (pivoted at 0,0,0)
      const armGroup = new THREE.Group();

      // Rod
      const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, L_vis, 16);
      rodGeo.translate(0, -L_vis / 2, 0);
      const rodMesh = new THREE.Mesh(rodGeo, chromeMat);
      rodMesh.castShadow = true;
      armGroup.add(rodMesh);

      // Bob
      const bobGeo = new THREE.SphereGeometry(bobRadius, 32, 32);
      const bobMesh = new THREE.Mesh(bobGeo, cyanMat);
      bobMesh.position.set(0, -L_vis, 0);
      bobMesh.castShadow = true;
      armGroup.add(bobMesh);

      // Bob highlight ring
      const ringGeo = new THREE.TorusGeometry(bobRadius + 0.015, 0.008, 16, 32);
      const ringMesh = new THREE.Mesh(ringGeo, brassMat);
      ringMesh.position.set(0, -L_vis, 0);
      armGroup.add(ringMesh);

      // Equilibrium vertical reference line (dashed)
      const eqPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -L_vis * 1.1, 0)];
      const eqGeo = new THREE.BufferGeometry().setFromPoints(eqPoints);
      const eqMat = new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.08, gapSize: 0.05 });
      const eqLine = new THREE.Line(eqGeo, eqMat);
      eqLine.computeLineDistances();
      group.add(eqLine);

      // Rotate arm around Z axis
      armGroup.rotation.z = thetaRad;
      group.add(armGroup);
    }

    // ── 2. COMPOUND PENDULUM ────────────────────────────────────────────
    else if (simType === 'compound_pendulum') {
      const L_real = params?.length || 1.0;
      const L_vis = Math.min(2.5, Math.max(0.8, L_real * 1.1));
      const rodW = 0.12;
      const rodD = 0.06;

      const thetaRad = simData?.theta && simData.theta[animIdx] !== undefined
        ? simData.theta[animIdx]
        : THREE.MathUtils.degToRad(params?.theta0 || 25);

      // Bearing Block Mount
      const bearingGeo = new THREE.BoxGeometry(0.3, 0.15, 0.25);
      const bearingMesh = new THREE.Mesh(bearingGeo, slateDarkMat);
      bearingMesh.position.set(0, 0.05, 0);
      group.add(bearingMesh);

      // Pivot Axle
      const axleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 16);
      axleGeo.rotateX(Math.PI / 2);
      const axleMesh = new THREE.Mesh(axleGeo, brassMat);
      group.add(axleMesh);

      // Rotating Beam Arm
      const beamGroup = new THREE.Group();

      // Rectangular Beam
      const beamGeo = new THREE.BoxGeometry(rodW, L_vis, rodD);
      beamGeo.translate(0, -L_vis / 2, 0);
      const beamMesh = new THREE.Mesh(beamGeo, indigoMat);
      beamMesh.castShadow = true;
      beamGroup.add(beamMesh);

      // Center of Mass (CoM) Marker at L/2
      const comGeo = new THREE.SphereGeometry(0.045, 16, 16);
      const comMesh = new THREE.Mesh(comGeo, brassMat);
      comMesh.position.set(0, -L_vis / 2, rodD / 2 + 0.01);
      beamGroup.add(comMesh);

      // Center of Percussion (Effective Length L_eff = 2/3 L) Marker
      const copGeo = new THREE.SphereGeometry(0.04, 16, 16);
      const copMesh = new THREE.Mesh(copGeo, emeraldMat);
      copMesh.position.set(0, -L_vis * (2 / 3), rodD / 2 + 0.01);
      beamGroup.add(copMesh);

      beamGroup.rotation.z = thetaRad;
      group.add(beamGroup);
    }

    // ── 3. SLIDER-CRANK MECHANISM ───────────────────────────────────────
    else if (simType === 'slider_crank') {
      const r_real = params?.crank_length || 0.1;
      const l_real = params?.conn_length || 0.3;

      // Coordinate scaling
      const scale = 2.4 / (r_real + l_real);
      const r = r_real * scale;
      const l = l_real * scale;

      const thetaDeg = simData?.crank_angle_deg && simData.crank_angle_deg[animIdx] !== undefined
        ? simData.crank_angle_deg[animIdx]
        : 0;
      const theta = THREE.MathUtils.degToRad(thetaDeg);

      // Kinematics:
      const bx = r * Math.cos(theta);
      const by = r * Math.sin(theta);
      const sinBeta = (r * Math.sin(theta)) / l;
      const cosBeta = Math.sqrt(Math.max(0, 1 - sinBeta * sinBeta));
      const sliderX = bx + l * cosBeta;

      // Crank Shaft Origin Bearing Block
      const baseBlockGeo = new THREE.BoxGeometry(0.28, 0.4, 0.3);
      const baseBlockMesh = new THREE.Mesh(baseBlockGeo, slateDarkMat);
      baseBlockMesh.position.set(0, -0.2, 0);
      group.add(baseBlockMesh);

      // Crank Arm (from 0,0,0 to bx,by,0)
      const crankGeo = new THREE.BoxGeometry(r, 0.07, 0.05);
      crankGeo.translate(r / 2, 0, 0);
      const crankMesh = new THREE.Mesh(crankGeo, brassMat);
      crankMesh.rotation.z = theta;
      crankMesh.position.set(0, 0, 0.04);
      crankMesh.castShadow = true;
      group.add(crankMesh);

      // Crank Pin
      const crankPinGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 16);
      crankPinGeo.rotateX(Math.PI / 2);
      const crankPinMesh = new THREE.Mesh(crankPinGeo, chromeMat);
      crankPinMesh.position.set(bx, by, 0.04);
      group.add(crankPinMesh);

      // Connecting Rod (from bx,by to sliderX, 0)
      const connLen = Math.hypot(sliderX - bx, -by);
      const connAngle = Math.atan2(-by, sliderX - bx);
      const connGeo = new THREE.BoxGeometry(connLen, 0.05, 0.04);
      connGeo.translate(connLen / 2, 0, 0);
      const connMesh = new THREE.Mesh(connGeo, cyanMat);
      connMesh.position.set(bx, by, 0);
      connMesh.rotation.z = connAngle;
      connMesh.castShadow = true;
      group.add(connMesh);

      // Slider Piston Block
      const pistonGeo = new THREE.BoxGeometry(0.36, 0.22, 0.18);
      const pistonMesh = new THREE.Mesh(pistonGeo, indigoMat);
      pistonMesh.position.set(sliderX, 0, 0);
      pistonMesh.castShadow = true;
      group.add(pistonMesh);

      // Guide Rails
      const railGeo = new THREE.CylinderGeometry(0.015, 0.015, 3.8, 16);
      railGeo.rotateZ(Math.PI / 2);
      const railMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });

      const rail1 = new THREE.Mesh(railGeo, railMat);
      rail1.position.set(1.5, 0.15, 0.08);
      group.add(rail1);

      const rail2 = new THREE.Mesh(railGeo, railMat);
      rail2.position.set(1.5, -0.15, 0.08);
      group.add(rail2);

      // Crank Trajectory Circle
      const crankCircleGeo = new THREE.RingGeometry(r - 0.005, r + 0.005, 48);
      const crankCircleMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
      const circleMesh = new THREE.Mesh(crankCircleGeo, crankCircleMat);
      circleMesh.position.set(0, 0, -0.01);
      group.add(circleMesh);
    }

    // ── 4. FOUR-BAR LINKAGE ─────────────────────────────────────────────
    else if (simType === 'four_bar') {
      const d_real = params?.link_ground || 4.0;
      const scale = 2.4 / Math.max(1, d_real);

      // Scaled joint coordinates
      const Ax = 0;
      const Ay = 0;
      const Dx = d_real * scale;
      const Dy = 0;

      const bx = (simData?.bx && simData.bx[animIdx] !== undefined ? simData.bx[animIdx] : params?.link_crank || 1.0) * scale;
      const by = (simData?.by && simData.by[animIdx] !== undefined ? simData.by[animIdx] : 0) * scale;
      const cx = (simData?.cx && simData.cx[animIdx] !== undefined ? simData.cx[animIdx] : 2.5) * scale;
      const cy = (simData?.cy && simData.cy[animIdx] !== undefined ? simData.cy[animIdx] : 2.0) * scale;

      // Ground Frame Link AD (Slate)
      const groundGeo = new THREE.BoxGeometry(Dx, 0.08, 0.08);
      groundGeo.translate(Dx / 2, 0, 0);
      const groundMesh = new THREE.Mesh(groundGeo, slateDarkMat);
      groundMesh.position.set(Ax, Ay, -0.06);
      group.add(groundMesh);

      // Pivot A & D Support Posts
      const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.3, 16);
      const postA = new THREE.Mesh(postGeo, slateDarkMat);
      postA.position.set(Ax, Ay - 0.15, 0);
      group.add(postA);

      const postD = new THREE.Mesh(postGeo, slateDarkMat);
      postD.position.set(Dx, Dy - 0.15, 0);
      group.add(postD);

      // Link 2: Input Crank AB (Rose / Amber)
      const lenAB = Math.hypot(bx - Ax, by - Ay);
      const angleAB = Math.atan2(by - Ay, bx - Ax);
      const crankGeo = new THREE.BoxGeometry(lenAB, 0.06, 0.04);
      crankGeo.translate(lenAB / 2, 0, 0);
      const crankMesh = new THREE.Mesh(crankGeo, brassMat);
      crankMesh.position.set(Ax, Ay, 0.04);
      crankMesh.rotation.z = angleAB;
      crankMesh.castShadow = true;
      group.add(crankMesh);

      // Link 3: Coupler BC (Cyan)
      const lenBC = Math.hypot(cx - bx, cy - by);
      const angleBC = Math.atan2(cy - by, cx - bx);
      const couplerGeo = new THREE.BoxGeometry(lenBC, 0.05, 0.04);
      couplerGeo.translate(lenBC / 2, 0, 0);
      const couplerMesh = new THREE.Mesh(couplerGeo, cyanMat);
      couplerMesh.position.set(bx, by, 0.08);
      couplerMesh.rotation.z = angleBC;
      couplerMesh.castShadow = true;
      group.add(couplerMesh);

      // Link 4: Output Rocker CD (Emerald)
      const lenCD = Math.hypot(cx - Dx, cy - Dy);
      const angleCD = Math.atan2(cy - Dy, cx - Dx);
      const rockerGeo = new THREE.BoxGeometry(lenCD, 0.06, 0.04);
      rockerGeo.translate(lenCD / 2, 0, 0);
      const rockerMesh = new THREE.Mesh(rockerGeo, emeraldMat);
      rockerMesh.position.set(Dx, Dy, 0.04);
      rockerMesh.rotation.z = angleCD;
      rockerMesh.castShadow = true;
      group.add(rockerMesh);

      // 4 Joint Pins (A, B, C, D)
      const jointGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.2, 16);
      jointGeo.rotateX(Math.PI / 2);

      const jointA = new THREE.Mesh(jointGeo, chromeMat);
      jointA.position.set(Ax, Ay, 0.05);
      group.add(jointA);

      const jointB = new THREE.Mesh(jointGeo, chromeMat);
      jointB.position.set(bx, by, 0.06);
      group.add(jointB);

      const jointC = new THREE.Mesh(jointGeo, chromeMat);
      jointC.position.set(cx, cy, 0.06);
      group.add(jointC);

      const jointD = new THREE.Mesh(jointGeo, chromeMat);
      jointD.position.set(Dx, Dy, 0.05);
      group.add(jointD);

      // Coupler Trajectory Trail Line (Cyan)
      if (simData?.coupler_x && simData?.coupler_y) {
        const trailPoints = [];
        for (let i = 0; i < simData.coupler_x.length; i += 2) {
          trailPoints.push(new THREE.Vector3(simData.coupler_x[i] * scale, simData.coupler_y[i] * scale, 0.09));
        }
        if (trailPoints.length > 1) {
          const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPoints);
          const trailMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.65 });
          const trailLine = new THREE.Line(trailGeo, trailMat);
          group.add(trailLine);
        }
      }
    }
  }, [simType, params, simData, animIdx]);

  return (
    <div className="scene3d-wrapper">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="scene3d-viewport" />

      {/* 3D Viewport Controls HUD */}
      <div className="scene3d-hud">
        <div className="scene3d-view-buttons">
          <span className="scene3d-hud-label">Camera Angle:</span>
          <button
            type="button"
            className={`scene3d-view-btn ${cameraView === 'iso' ? 'active' : ''}`}
            onClick={() => setView('iso')}
          >
            🎲 Iso 3D
          </button>
          <button
            type="button"
            className={`scene3d-view-btn ${cameraView === 'front' ? 'active' : ''}`}
            onClick={() => setView('front')}
          >
            ⏹ Front
          </button>
          <button
            type="button"
            className={`scene3d-view-btn ${cameraView === 'top' ? 'active' : ''}`}
            onClick={() => setView('top')}
          >
            ⬆ Top
          </button>
          <button
            type="button"
            className={`scene3d-view-btn ${cameraView === 'side' ? 'active' : ''}`}
            onClick={() => setView('side')}
          >
            ➡ Side
          </button>
        </div>

        <div className="scene3d-hud-hint">
          <span>🖱️ Left-drag to Rotate</span> • <span>Scroll to Zoom</span> • <span>Right-drag to Pan</span>
        </div>
      </div>
    </div>
  );
};
