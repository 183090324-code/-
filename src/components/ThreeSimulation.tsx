import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TelemetryData, ConstructionProcess, WorkpieceModel } from "../types";

interface ThreeSimulationProps {
  activeProcess: ConstructionProcess;
  activeWorkpiece: WorkpieceModel | null;
  isRunning: boolean;
  isPaused: boolean;
  currentStep: number;
  playSpeed: number; // multiplier
  onTelemetryUpdate: (data: Partial<TelemetryData>) => void;
  clickPoints: THREE.Vector3[];
  setClickPoints: React.Dispatch<React.SetStateAction<THREE.Vector3[]>>;
}

export const ThreeSimulation: React.FC<ThreeSimulationProps> = ({
  activeProcess,
  activeWorkpiece,
  isRunning,
  isPaused,
  currentStep,
  playSpeed,
  onTelemetryUpdate,
  clickPoints,
  setClickPoints,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // References to robot parts for animation
  const robotGroupRef = useRef<THREE.Group | null>(null);
  const j1Ref = useRef<THREE.Group | null>(null);
  const j2Ref = useRef<THREE.Group | null>(null);
  const j3Ref = useRef<THREE.Group | null>(null);
  const j4Ref = useRef<THREE.Group | null>(null);
  const j5Ref = useRef<THREE.Group | null>(null);
  const j6Ref = useRef<THREE.Group | null>(null);
  const toolGroupRef = useRef<THREE.Group | null>(null);

  // References to simulation objects
  const workpieceMeshRef = useRef<THREE.Group | null>(null);
  const pointerSphereRef = useRef<THREE.Mesh | null>(null);
  const trajectoryLineRef = useRef<THREE.Line | null>(null);
  const pointMarkersRef = useRef<THREE.Group | null>(null);
  const processParticlesRef = useRef<THREE.Points | null>(null);
  const buildProgressGroupRef = useRef<THREE.Group | null>(null);

  // Animation internal variables
  const pathProgressRef = useRef<number>(0);
  const simulatedTimeRef = useRef<number>(0);
  const [hoveredPoint, setHoveredPoint] = useState<THREE.Vector3 | null>(null);

  // Handle environment setup and updates
  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Create Scene with realistic light-blue/gray lab look
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9); // Clean laboratory light gray
    scene.fog = new THREE.FogExp2(0xf1f5f9, 0.02);
    sceneRef.current = scene;

    // 2. Camera setup to view target training table
    const aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(4.5, 3.2, 5.0);
    cameraRef.current = camera;

    // 3. WebGL Renderer with Shadow maps
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);

    // 4. Orbit Controls to inspect training bench
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.03; // constrain orbital camera to be above floor
    controls.minDistance = 2;
    controls.maxDistance = 15;
    controls.target.set(0, 0.8, 0); // focus on table top height
    controlsRef.current = controls;

    // 5. Bright Classroom/Lab Lighting
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    sunLight.position.set(5, 10, 5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 18;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Warm desk spotlight accent
    const spotLight = new THREE.SpotLight(0xfff0dd, 0.8, 10, Math.PI / 4, 0.5, 1);
    spotLight.position.set(-2, 6, 2);
    scene.add(spotLight);

    // 6. Ground grid and smooth gray studio floor
    const gridHelper = new THREE.GridHelper(20, 20, 0xd1d5db, 0xe5e7eb);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.8,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 7. BUILD EXPENDABLE MATERIALS LAB SETUP OR REACTION MESH
    buildTrainingTableChassis(scene);
    buildRoboticArm(scene);
    buildProcessSpecificWorkpieces(scene);

    // Pointer helper sphere for hovered trajectory plotting
    const pointerGeo = new THREE.SphereGeometry(0.025, 16, 16);
    const pointerMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.8 });
    const pointerSphere = new THREE.Mesh(pointerGeo, pointerMat);
    pointerSphere.visible = false;
    scene.add(pointerSphere);
    pointerSphereRef.current = pointerSphere;

    // Group for point pins
    const ptGroup = new THREE.Group();
    scene.add(ptGroup);
    pointMarkersRef.current = ptGroup;

    // Handle Resize
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // 8. Animated tick updates
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (controlsRef.current) controlsRef.current.update();

      updateSimulationKinematics(delta);

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      if (rendererRef.current) rendererRef.current.dispose();
    };
  }, [activeProcess, activeWorkpiece]);

  // Redraw path coordinates when clicked points changes
  useEffect(() => {
    refreshTrajectoryLine();
    drawPointIndicators();
  }, [clickPoints]);

  // Reset trajectory progress when play state resets
  useEffect(() => {
    if (!isRunning) {
      pathProgressRef.current = 0;
    }
  }, [isRunning]);

  // =========================================================================
  // MODEL BUILDER: EXPERIMENT METALLIC TABLE (HUIBO ROBOTICS AESTHETICS)
  // =========================================================================
  const buildTrainingTableChassis = (scene: THREE.Scene) => {
    const tableGroup = new THREE.Group();
    tableGroup.position.set(0, 0, 0);

    // 1. Sleek Aluminum extrusion frame base structure (Box dimensions 2.0 x 1.2, height 0.85)
    const frameWidth = 1.8;
    const frameDepth = 1.1;
    const frameHeight = 0.85;

    // Aluminum frame legs (metallic silver/gray lines)
    const legGeo = new THREE.BoxGeometry(0.06, frameHeight, 0.06);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Silver brushed profile
      metalness: 0.9,
      roughness: 0.2,
    });

    const offsets = [
      [-frameWidth / 2 + 0.03, -frameDepth / 2 + 0.03],
      [frameWidth / 2 - 0.03, -frameDepth / 2 + 0.03],
      [-frameWidth / 2 + 0.03, frameDepth / 2 - 0.03],
      [frameWidth / 2 - 0.03, frameDepth / 2 - 0.03],
    ];

    offsets.forEach(([ox, oz]) => {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(ox, frameHeight / 2, oz);
      leg.castShadow = true;
      leg.receiveShadow = true;
      tableGroup.add(leg);
    });

    // Horizontal top/bottom extrusion struts
    const strutXGeo = new THREE.BoxGeometry(frameWidth, 0.06, 0.06);
    const strutZGeo = new THREE.BoxGeometry(0.06, 0.06, frameDepth);

    // Bottom struts
    const bStrut1 = new THREE.Mesh(strutXGeo, frameMat);
    bStrut1.position.set(0, 0.1, -frameDepth / 2 + 0.03);
    const bStrut2 = bStrut1.clone();
    bStrut2.position.set(0, 0.1, frameDepth / 2 - 0.03);
    tableGroup.add(bStrut1);
    tableGroup.add(bStrut2);

    const bStrut3 = new THREE.Mesh(strutZGeo, frameMat);
    bStrut3.position.set(-frameWidth / 2 + 0.03, 0.1, 0);
    const bStrut4 = bStrut3.clone();
    bStrut4.position.set(frameWidth / 2 - 0.03, 0.1, 0);
    tableGroup.add(bStrut3);
    tableGroup.add(bStrut4);

    // Top struts (framing table edge)
    const tStrut1 = bStrut1.clone(); tStrut1.position.y = frameHeight - 0.03; tableGroup.add(tStrut1);
    const tStrut2 = bStrut2.clone(); tStrut2.position.y = frameHeight - 0.03; tableGroup.add(tStrut2);
    const tStrut3 = bStrut3.clone(); tStrut3.position.y = frameHeight - 0.03; tableGroup.add(tStrut3);
    const tStrut4 = bStrut4.clone(); tStrut4.position.y = frameHeight - 0.03; tableGroup.add(tStrut4);

    // 2. STRIKING ORANGE CABINET DOORS matching the user image
    const orangeDoorMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48, // Crimson-orange deep hue
      roughness: 0.3,
      metalness: 0.4,
    });

    const sidePanelMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Dark slate metal paneling
      roughness: 0.4,
      metalness: 0.7,
    });

    // Front orange sliding doors
    const fDoorGeo = new THREE.BoxGeometry(0.75, frameHeight - 0.15, 0.012);
    const frontDoorLeft = new THREE.Mesh(fDoorGeo, orangeDoorMat);
    frontDoorLeft.position.set(-0.4, frameHeight / 2, frameDepth / 2 - 0.02);
    frontDoorLeft.castShadow = true;
    tableGroup.add(frontDoorLeft);

    const frontDoorRight = new THREE.Mesh(fDoorGeo, orangeDoorMat);
    frontDoorRight.position.set(0.4, frameHeight / 2, frameDepth / 2 - 0.02);
    frontDoorRight.castShadow = true;
    tableGroup.add(frontDoorRight);

    // Black heavy-duty industrial handles
    const handleGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    
    const handleL = new THREE.Mesh(handleGeo, handleMat);
    handleL.position.set(-0.05, frameHeight / 2, frameDepth / 2);
    frontDoorLeft.add(handleL);

    const handleR = handleL.clone();
    handleR.position.set(0.05, frameHeight / 2, frameDepth / 2);
    frontDoorRight.add(handleR);

    // Left and right Slate side panels
    const sidePanelGeo = new THREE.BoxGeometry(0.012, frameHeight - 0.15, frameDepth - 0.1);
    const leftPanel = new THREE.Mesh(sidePanelGeo, sidePanelMat);
    leftPanel.position.set(-frameWidth / 2 + 0.02, frameHeight / 2, 0);
    tableGroup.add(leftPanel);

    const rightPanel = leftPanel.clone();
    rightPanel.position.x = frameWidth / 2 - 0.02;
    tableGroup.add(rightPanel);

    // Labeled panel brand plate on left door matching real thing
    const plateGeo = new THREE.BoxGeometry(0.32, 0.08, 0.015);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const brandPlate = new THREE.Mesh(plateGeo, plateMat);
    brandPlate.position.set(-0.25, 0.22, 0.01);
    frontDoorLeft.add(brandPlate);

    // 3. TABLE TOP WORKPLATE (T-slot groove plate, gray brushed aluminum with parallel grooves)
    const workPlateGeo = new THREE.BoxGeometry(frameWidth - 0.02, 0.04, frameDepth - 0.02);
    const workPlateMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, // T-slot anodized silver plate
      roughness: 0.4,
      metalness: 0.6,
    });
    const workPlate = new THREE.Mesh(workPlateGeo, workPlateMat);
    workPlate.position.set(0, frameHeight - 0.01, 0);
    workPlate.receiveShadow = true;
    tableGroup.add(workPlate);

    // Render slot lines parallel to the long edge
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    for (let offsetZ = -0.4; offsetZ <= 0.4; offsetZ += 0.12) {
      const slotLineGeo = new THREE.BoxGeometry(frameWidth - 0.05, 0.005, 0.008);
      const slotLine = new THREE.Mesh(slotLineGeo, slotMat);
      slotLine.position.set(0, 0.021, offsetZ);
      workPlate.add(slotLine);
    }

    // 4. HMI GREEN CONTROL PANEL AND PEDESTAL AT FRONT LEFT
    const pedestalSupportGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 12);
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 });
    const pHandle = new THREE.Mesh(pedestalSupportGeo, pedestalMat);
    pHandle.position.set(-0.7, frameHeight + 0.25, 0.5);
    pHandle.rotation.z = -0.15; // angled slightly forward
    tableGroup.add(pHandle);

    // Green Touchscreen console box (HUIBO specific green)
    const hmiBoxGeo = new THREE.BoxGeometry(0.3, 0.2, 0.08);
    const hmiBoxMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 }); // HUIBO vibrant green housing
    const hmiBox = new THREE.Mesh(hmiBoxGeo, hmiBoxMat);
    hmiBox.position.set(0, 0.3, 0.04);
    hmiBox.rotation.x = -Math.PI / 6; // tilt touchscreen towards student
    pHandle.add(hmiBox);

    // Blue screen inset face
    const screenFaceGeo = new THREE.PlaneGeometry(0.24, 0.15);
    const screenFaceMat = new THREE.MeshBasicMaterial({ color: 0x1e3a8a }); // glowing dark blue screen
    const screenFace = new THREE.Mesh(screenFaceGeo, screenFaceMat);
    screenFace.position.set(0, 0, 0.041);
    hmiBox.add(screenFace);

    // Little red mushroom button on right side of screen
    const buttonBaseGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.01, 8);
    const buttonCapGeo = new THREE.SphereGeometry(0.016, 8, 8);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2 }); // amber physical buttons
    const redEStop = new THREE.Mesh(buttonCapGeo, new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
    redEStop.position.set(0.11, 0.05, 0.05);
    hmiBox.add(redEStop);
    
    // Green power dial
    const powerB = new THREE.Mesh(buttonBaseGeo, new THREE.MeshStandardMaterial({ color: 0x16a34a }));
    powerB.position.set(0.11, -0.05, 0.045);
    powerB.rotation.x = Math.PI / 2;
    hmiBox.add(powerB);

    // 5. ROTARY RAW-MATERIAL FEEDER DISK ON THE LEFT OF THE WORKBENCH
    const diskGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.02, 24);
    const diskMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.4 });
    const feederDisk = new THREE.Mesh(diskGeo, diskMat);
    feederDisk.position.set(-0.45, frameHeight + 0.01, -0.2);
    tableGroup.add(feederDisk);

    // Add multiple circular RED bricks/materials nested around it (as exact visual matching)
    const redRingGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.025, 12);
    const darkRingInnerGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.028, 12);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.2, roughness: 0.5 }); // vibrant red
    const spacerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

    for (let r = 0; r < 6; r++) {
      const angle = (Math.PI * 2 / 6) * r;
      const rx = Math.cos(angle) * 0.12;
      const rz = Math.sin(angle) * 0.12;

      const ringOuter = new THREE.Mesh(redRingGeo, ringMat);
      ringOuter.position.set(rx, 0.02, rz);
      ringOuter.castShadow = true;
      
      const ringInner = new THREE.Mesh(darkRingInnerGeo, spacerMat);
      ringInner.position.y = 0.001;
      ringOuter.add(ringInner);

      feederDisk.add(ringOuter);
    }

    // 6. VERTICAL STACK FEEDER TRAY ON THE RIGHT CARRYING THE RED MATERIALS (AS IN USER SCREENSHOTS)
    const shelfBaseGeo = new THREE.BoxGeometry(0.25, 0.02, 0.45);
    const shelfBase = new THREE.Mesh(shelfBaseGeo, diskMat);
    shelfBase.position.set(0.55, frameHeight + 0.01, -0.15);
    shelfBase.castShadow = true;
    tableGroup.add(shelfBase);

    // Vertical frame racks
    const rackGeo = new THREE.BoxGeometry(0.015, 0.35, 0.02);
    const rack1 = new THREE.Mesh(rackGeo, frameMat);
    rack1.position.set(-0.1, 0.175, -0.15);
    shelfBase.add(rack1);

    const rack2 = rack1.clone();
    rack2.position.set(0.1, 0.175, -0.15);
    shelfBase.add(rack2);

    const rack3 = rack1.clone();
    rack3.position.z = 0.15;
    shelfBase.add(rack3);

    const rack4 = rack2.clone();
    rack4.position.z = 0.15;
    shelfBase.add(rack4);

    // Multiple red trays loaded with circular objects exactly mimicking the red trays on page top
    const trayGeo = new THREE.BoxGeometry(0.18, 0.015, 0.35);
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    
    // Level 1 Tray
    const tray1 = new THREE.Mesh(trayGeo, trayMat);
    tray1.position.set(0, 0.12, 0);
    shelfBase.add(tray1);

    // Level 2 Tray
    const tray2 = tray1.clone();
    tray2.position.y = 0.28;
    shelfBase.add(tray2);

    // Add shiny red parts nested inside both levels of trays
    for (let levelY of [0.13, 0.29]) {
      for (let offsetZ of [-0.08, 0.08]) {
        const p1 = new THREE.Mesh(redRingGeo, ringMat);
        p1.position.set(0, levelY, offsetZ);
        p1.castShadow = true;
        
        const pin = new THREE.Mesh(darkRingInnerGeo, spacerMat);
        p1.add(pin);

        shelfBase.add(p1);
      }
    }

    scene.add(tableGroup);
  };

  // =========================================================================
  // MECHANICAL MODEL: COLLABORATIVE ROBOT DESIGN (ROBOTIC WHITE & BLUE COBOT)
  // =========================================================================
  const buildRoboticArm = (scene: THREE.Scene) => {
    const robotGroup = new THREE.Group();
    robotGroup.position.set(0, 0.86, 0.25); // secure atop slot table
    robotGroupRef.current = robotGroup;

    // cobot aesthetic materials matching image A
    const armMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // premium clean robot white link covers
      roughness: 0.3,
      metalness: 0.1,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // signature blue sleeves / bands
      metalness: 0.6,
      roughness: 0.2,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // dark titanium connector links
      metalness: 0.8,
      roughness: 0.3,
    });

    // J1 Base Tower (Turret)
    const j1 = new THREE.Group();
    j1.position.set(0, 0, 0);
    j1Ref.current = j1;
    robotGroup.add(j1);

    const baseTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.12, 16), armMat);
    baseTurret.position.y = 0.06;
    baseTurret.castShadow = true;
    j1.add(baseTurret);

    const baseBlueRing = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.03, 16), jointMat);
    baseBlueRing.position.y = 0.13;
    j1.add(baseBlueRing);

    // J2 Shoulder (Pitch)
    const j2 = new THREE.Group();
    j2.position.set(0, 0.15, 0);
    j2Ref.current = j2;
    j1.add(j2);

    const shoulderCap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.18, 12).rotateZ(Math.PI / 2), metalMat);
    shoulderCap.castShadow = true;
    j2.add(shoulderCap);

    const blueCapL = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.03, 12).rotateZ(Math.PI / 2), jointMat);
    blueCapL.position.x = -0.095;
    const blueCapR = blueCapL.clone();
    blueCapR.position.x = 0.095;
    j2.add(blueCapL);
    j2.add(blueCapR);

    // Bicep cylindrical link
    const bicep = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 16), armMat);
    bicep.position.y = 0.225;
    bicep.castShadow = true;
    j2.add(bicep);

    // J3 Elbow (Pitch)
    const j3 = new THREE.Group();
    j3.position.set(0, 0.45, 0);
    j3Ref.current = j3;
    j2.add(j3);

    const elbowCap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.15, 12).rotateZ(Math.PI / 2), metalMat);
    elbowCap.castShadow = true;
    j3.add(elbowCap);

    const elbowCapL = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.076, 0.03, 12).rotateZ(Math.PI / 2), jointMat);
    elbowCapL.position.x = 0.08;
    j3.add(elbowCapL);

    // Forearm cylindrical link
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 16), armMat);
    forearm.position.y = 0.2;
    forearm.castShadow = true;
    j3.add(forearm);

    // J4 Wrist Rotate
    const j4 = new THREE.Group();
    j4.position.set(0, 0.4, 0);
    j4Ref.current = j4;
    j3.add(j4);

    const wristRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 12), metalMat);
    wristRoll.position.y = 0.05;
    j4.add(wristRoll);

    const wristBlueRing = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 12), jointMat);
    wristBlueRing.position.y = 0.1;
    j4.add(wristBlueRing);

    // J5 Wrist Bend
    const j5 = new THREE.Group();
    j5.position.set(0, 0.11, 0);
    j5Ref.current = j5;
    j4.add(j5);

    const wristPitch = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 12).rotateX(Math.PI / 2), metalMat);
    wristPitch.castShadow = true;
    j5.add(wristPitch);

    const wristPitchCap = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.02, 12).rotateX(Math.PI / 2), jointMat);
    wristPitchCap.position.z = 0.055;
    j5.add(wristPitchCap);

    // J6 End Tool Flange
    const j6 = new THREE.Group();
    j6.position.set(0, 0.07, 0);
    j6Ref.current = j6;
    j5.add(j6);

    const flangePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.02, 12), metalMat);
    flangePlate.position.y = 0.01;
    j6.add(flangePlate);

    // SWAPPABLE INDUSTRIAL TOOL HEAD GROUP
    const toolGroup = new THREE.Group();
    toolGroup.position.set(0, 0.02, 0);
    toolGroupRef.current = toolGroup;
    j6.add(toolGroup);

    // Build the specific tool head based on process
    buildProcessToolhead(toolGroup);

    scene.add(robotGroup);
  };

  // Swappable Toolheads based on Active Craft Process
  const buildProcessToolhead = (group: THREE.Group) => {
    // Clear any previous tools
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
    const goldenBrass = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 });

    switch (activeProcess) {
      case "rebar_lay": {
        // Hydralic prongs rebar gripper
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.05, 12), darkMetal);
        adapter.position.y = 0.025;
        group.add(adapter);

        const corePanel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.04), steel);
        corePanel.position.y = 0.055;
        group.add(corePanel);

        // Prong 1
        const prong1 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.06, 0.015), steel);
        prong1.position.set(-0.04, 0.08, 0);
        prong1.rotation.z = -0.1;
        group.add(prong1);

        // Prong 2
        const prong2 = prong1.clone();
        prong2.position.x = 0.04;
        prong2.rotation.z = 0.1;
        group.add(prong2);
        break;
      }
      case "rebar_tie": {
        // Tying nozzle needle + wire loader roll
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.05, 12), darkMetal);
        adapter.position.y = 0.025;
        group.add(adapter);

        // Tying gun housing
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.12), darkMetal);
        body.position.set(0, 0.075, 0.02);
        group.add(body);

        // Cylindrical tie gun wire roll on side
        const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12).rotateZ(Math.PI / 2), goldenBrass);
        roll.position.set(-0.045, 0.075, 0);
        group.add(roll);

        // Needle tip protrusion pointed downwards
        const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.002, 0.06, 8), steel);
        needle.position.set(0, 0.12, 0.04);
        needle.rotation.x = -Math.PI / 6;
        group.add(needle);
        break;
      }
      case "concrete_pour": {
        // High-viscosity wet concrete slurry nozzle + tube lines
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.04, 12), darkMetal);
        adapter.position.y = 0.02;
        group.add(adapter);

        // Slurry conduit head angled downward
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.1, 12), steel);
        pipe.position.set(0, 0.06, 0.02);
        pipe.rotation.x = Math.PI / 8;
        group.add(pipe);

        const rubberBumper = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.022, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0x111827 }));
        rubberBumper.position.y = 0.11;
        group.add(rubberBumper);
        break;
      }
      case "concrete_flat": {
        // Micro-vibrating trowel leveling flat squeegee plate
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.05, 12), darkMetal);
        adapter.position.y = 0.025;
        group.add(adapter);

        // Long metallic tamping plate
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.01, 0.08), steel);
        plate.position.set(0, 0.055, 0);
        group.add(plate);

        // Vibrator motor box in center
        const vBox = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.04), darkMetal);
        vBox.position.set(0, 0.07, 0);
        group.add(vBox);
        break;
      }
      case "brick_lay": {
        // Vacuum slab manipulator gripper block
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.04, 12), darkMetal);
        adapter.position.y = 0.02;
        group.add(adapter);

        const blockY = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.08), darkMetal);
        blockY.position.y = 0.04;
        group.add(blockY);

        // Two circular industrial vacuum suction cups
        const cupGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.015, 16);
        const cupMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
        
        const cup1 = new THREE.Mesh(cupGeo, cupMat);
        cup1.position.set(-0.03, 0.05, 0);
        group.add(cup1);

        const cup2 = cup1.clone();
        cup2.position.set(0.03, 0.05, 0);
        group.add(cup2);
        break;
      }
      case "tile_lay": {
        // Multi-cup flat coordinate tiling sucker tool head
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.04, 12), darkMetal);
        adapter.position.y = 0.02;
        group.add(adapter);

        // Cruciform suction plate frame
        const cross = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.14), steel);
        cross.position.y = 0.035;
        group.add(cross);

        // 4 micro suction nodes
        const miniCupGeo = new THREE.CylinderGeometry(0.018, 0.02, 0.01, 12);
        const miniCupMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });

        const positions = [
          [-0.05, -0.05], [0.05, -0.05],
          [-0.05, 0.05], [0.05, 0.05],
        ];

        positions.forEach(([cx, cz]) => {
          const cup = new THREE.Mesh(miniCupGeo, miniCupMat);
          cup.position.set(cx, 0.045, cz);
          group.add(cup);
        });
        break;
      }
      case "spray_wall":
      default: {
        // Dual laser sensor + dual spray valve nozzles
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.04, 12), darkMetal);
        adapter.position.y = 0.02;
        group.add(adapter);

        const valveBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.12), steel);
        valveBox.position.set(0, 0.05, 0);
        group.add(valveBox);

        // Brass spray nozzle outlets
        const nozzleGeo = new THREE.CylinderGeometry(0.008, 0.01, 0.03, 10);
        
        const n1 = new THREE.Mesh(nozzleGeo, goldenBrass);
        n1.position.set(-0.025, 0.08, 0.02);
        n1.rotation.x = Math.PI / 8;
        group.add(n1);

        const n2 = n1.clone();
        n2.position.x = 0.025;
        group.add(n2);
        break;
      }
    }
  };

  // =========================================================================
  // PROCESS SPECIFIC ACTIVE WORKPIECES DISPLAY (CENTER STAGE METALLIC T-SLOT)
  // =========================================================================
  const buildProcessSpecificWorkpieces = (scene: THREE.Scene) => {
    // Clean old models
    if (workpieceMeshRef.current) {
      scene.remove(workpieceMeshRef.current);
    }
    if (buildProgressGroupRef.current) {
      scene.remove(buildProgressGroupRef.current);
    }

    const group = new THREE.Group();
    group.position.set(0, 0.88, 0); // rest on top of table plate
    workpieceMeshRef.current = group;
    scene.add(group);

    // Create a container group for dynamic simulation layers (bricks, cement mounds, etc.)
    const progressGroup = new THREE.Group();
    progressGroup.position.set(0, 0.88, 0);
    buildProgressGroupRef.current = progressGroup;
    scene.add(progressGroup);

    const rebarMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 }); // gray/beige cement
    const dryCementMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.4 });
    const brickMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 }); // red solid brick color
    const groutLineMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.9 });

    // Render corresponding workpiece mesh depending on process
    switch (activeProcess) {
      case "rebar_lay":
      case "rebar_tie": {
        // Render concrete formwork box cage carrying cross rebar bars
        const boxGeo = new THREE.BoxGeometry(0.8, 0.15, 0.6);
        const formBox = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.8 }));
        formBox.position.set(0, 0.075, -0.1);
        formBox.receiveShadow = true;
        group.add(formBox);

        // Glass boundary
        const borderGeo = new THREE.BoxGeometry(0.82, 0.25, 0.62);
        const helperBorder = new THREE.Mesh(borderGeo, glassMat);
        helperBorder.position.set(0, 0.125, -0.1);
        group.add(helperBorder);

        // Pre-laid rebar grids
        for (let x = -0.3; x <= 0.3; x += 0.15) {
          const barY = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.52, 8).rotateX(Math.PI / 2), rebarMat);
          barY.position.set(x, 0.08, -0.1);
          barY.castShadow = true;
          group.add(barY);
        }

        for (let z = -0.3; z <= 0.1; z += 0.12) {
          const barX = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.72, 8).rotateZ(Math.PI / 2), rebarMat);
          barX.position.set(0, 0.09, z);
          barX.castShadow = true;
          group.add(barX);
        }

        // Target target area mesh for raycaster click listeners tagged as "workpiece_target"
        const raycastPlate = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.02, 0.58), new THREE.MeshBasicMaterial({ visible: false }));
        raycastPlate.position.set(0, 0.1, -0.1);
        raycastPlate.name = "workpiece_target";
        group.add(raycastPlate);
        break;
      }
      case "concrete_pour":
      case "concrete_flat": {
        // Empty timber framework box waiting for grout
        const boxGeo = new THREE.BoxGeometry(0.8, 0.1, 0.5);
        const formBox = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })); // brownish plywood wood
        formBox.position.set(0, 0.05, -0.05);
        formBox.receiveShadow = true;
        group.add(formBox);

        // Inner basin cavity raycast target (metal color)
        const innerPlate = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.08, 0.44), concreteMat);
        innerPlate.position.set(0, 0.045, -0.05);
        innerPlate.name = "workpiece_target";
        innerPlate.receiveShadow = true;
        group.add(innerPlate);

        // Dynamic concrete mound elements inside progressGroup
        const fluidConcreteGeo = new THREE.BoxGeometry(0.73, 0.01, 0.43);
        const fluidConcrete = new THREE.Mesh(fluidConcreteGeo, new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.8, metalness: 0.2 }));
        fluidConcrete.position.set(0, 0.08, -0.05);
        fluidConcrete.name = "dynamic_concrete_mass";
        fluidConcrete.visible = false;
        progressGroup.add(fluidConcrete);
        break;
      }
      case "brick_lay": {
        // Red Bricklaying workbench segment baseplate
        const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.35), new THREE.MeshStandardMaterial({ color: 0x44403c }));
        basePlate.position.set(0, 0.01, -0.08);
        basePlate.receiveShadow = true;
        group.add(basePlate);

        // Target target box to raycast clicked placement
        const rayPlate = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.01, 0.32), new THREE.MeshBasicMaterial({ visible: false }));
        rayPlate.position.set(0, 0.022, -0.08);
        rayPlate.name = "workpiece_target";
        group.add(rayPlate);

        // Prebuilt base layer bricks (2 bricks pre-placed on left and right)
        const singleBrickGeo = new THREE.BoxGeometry(0.22, 0.05, 0.1);
        const b1 = new THREE.Mesh(singleBrickGeo, brickMat); b1.position.set(-0.24, 0.045, -0.08); b1.castShadow = true; group.add(b1);
        const b2 = new THREE.Mesh(singleBrickGeo, brickMat); b2.position.set(0.24, 0.045, -0.08); b2.castShadow = true; group.add(b2);

        // Dynamic bricks container in progressGroup
        // To be spawned matching clicks or path progress
        break;
      }
      case "tile_lay": {
        // Pre-laid adhesive mortar floor baseplate
        const adhesivePlate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.7), new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 }));
        adhesivePlate.position.set(0, 0.015, -0.05);
        adhesivePlate.receiveShadow = true;
        group.add(adhesivePlate);

        // Target grid lines
        for (let l = -0.35; l <= 0.35; l += 0.175) {
          const lineL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.032, 0.7), groutLineMat);
          lineL.position.set(l, 0.015, -0.05);
          group.add(lineL);

          const lineW = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.032, 0.005), groutLineMat);
          lineW.position.set(0, 0.015, l - 0.05);
          group.add(lineW);
        }

        const rtPlate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.01, 0.68), new THREE.MeshBasicMaterial({ visible: false }));
        rtPlate.position.set(0, 0.032, -0.05);
        rtPlate.name = "workpiece_target";
        group.add(rtPlate);
        break;
      }
      case "spray_wall":
      default: {
        // Vertical building cement wall partition mounted on two vertical clamping jigs on table
        const wallGeo = new THREE.BoxGeometry(0.9, 0.5, 0.04);
        const dryWallMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.9 });
        const wall = new THREE.Mesh(wallGeo, dryWallMat);
        wall.position.set(0, 0.25, -0.15);
        wall.receiveShadow = true;
        wall.castShadow = true;
        wall.name = "workpiece_target"; // Target directly
        group.add(wall);

        // Left fixture clamp
        const jGeo = new THREE.BoxGeometry(0.06, 0.15, 0.1);
        const clampJigMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
        
        const f1 = new THREE.Mesh(jGeo, clampJigMat);
        f1.position.set(-0.48, 0.075, -0.15);
        f1.castShadow = true;
        group.add(f1);

        const f2 = f1.clone();
        f2.position.x = 0.48;
        group.add(f2);

        // Visual coloring highlights on wall panel when sprayed inside progressGroup
        break;
      }
    }

    // OVERRIDE: IF custom loaded workpiece exists, show CAD bounding box overlay around the active mesh
    if (activeWorkpiece && activeWorkpiece.isCustomImported) {
      // Add neon green wireframe highlighting to reinforce custom workpiece upload categorization success!
      const helperFrameGeo = new THREE.BoxGeometry(0.84, 0.16, 0.64);
      const helperFrameEdgeMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
      const helperLines = new THREE.LineSegments(new THREE.EdgesGeometry(helperFrameGeo), helperFrameEdgeMat);
      helperLines.position.set(0, 0.08, -0.08);
      group.add(helperLines);
    }
  };

  // Trajectory Spline Line drawing based on student's custom coordinate points clicked
  const refreshTrajectoryLine = () => {
    if (!sceneRef.current) return;
    if (trajectoryLineRef.current) {
      sceneRef.current.remove(trajectoryLineRef.current);
    }

    if (clickPoints.length < 2) return;

    // Build ribbon or neon trajectory path connecting clickPoints
    const splineCurve = new THREE.CatmullRomCurve3(clickPoints);
    const splinePoints = splineCurve.getPoints(40);

    const lineGeo = new THREE.BufferGeometry().setFromPoints(splinePoints);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x0ea5e9, // Glowing Sky Blue path
      linewidth: 3,
    });

    const trajectory = new THREE.Line(lineGeo, lineMat);
    trajectoryLineRef.current = trajectory;
    sceneRef.current.add(trajectory);
  };

  // Place numeric circular coordinate pins at clicked vertices (P1, P2, P3...)
  const drawPointIndicators = () => {
    if (!pointMarkersRef.current) return;

    // Clear previous
    const markersGroup = pointMarkersRef.current;
    while (markersGroup.children.length > 0) {
      markersGroup.remove(markersGroup.children[0]);
    }

    const pinGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.05, 8);
    const headGeo = new THREE.SphereGeometry(0.02, 12, 12);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }); // Sky blue pinheads

    clickPoints.forEach((pt, index) => {
      const pinContainer = new THREE.Group();
      pinContainer.position.copy(pt);

      // Support shaft
      const shaft = new THREE.Mesh(pinGeo, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1 }));
      shaft.position.y = 0.025;
      pinContainer.add(shaft);

      // Spherical coordinate dot
      const dot = new THREE.Mesh(headGeo, pinMat);
      dot.position.y = 0.05;
      pinContainer.add(dot);

      // Custom coordinate ring decoration
      const ringGeo = new THREE.RingGeometry(0.03, 0.04, 16);
      ringGeo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x00f3ff, side: THREE.DoubleSide }));
      pinContainer.add(ring);

      markersGroup.add(pinContainer);
    });
  };

  // =========================================================================
  // CORE INVERSE KINEMATICS AND ANIMATION TIMERS CALCULATION (ROBOT MOTION)
  // =========================================================================
  const updateSimulationKinematics = (delta: number) => {
    if (!j1Ref.current || !j2Ref.current || !j3Ref.current || !j4Ref.current || !j5Ref.current || !j6Ref.current) return;

    // Increment simulated timestamp
    simulatedTimeRef.current += delta * playSpeed;
    const t = simulatedTimeRef.current;

    const j1 = j1Ref.current;
    const j2 = j2Ref.current;
    const j3 = j3Ref.current;
    const j4 = j4Ref.current;
    const j5 = j5Ref.current;
    const j6 = j6Ref.current;

    // 1. Trace planning path if simulator running
    if (isRunning && !isPaused && clickPoints.length >= 2) {
      pathProgressRef.current += delta * 0.12 * playSpeed;
      if (pathProgressRef.current >= 1.0) {
        pathProgressRef.current = 1.0;
      }

      const splineCurve = new THREE.CatmullRomCurve3(clickPoints);
      const targetTipPos = splineCurve.getPointAt(pathProgressRef.current);

      // Run Inverse joint alignment toward physical workpiece targetTipPos coordinates
      // Calculate dx, dz off base (0, 0.86, 0.25)
      const baseWorldX = 0;
      const baseWorldZ = 0.25;

      const dx = targetTipPos.x - baseWorldX;
      const dz = targetTipPos.z - baseWorldZ;
      const height = targetTipPos.y - 0.86; // Relative to base plate flange

      // Rotate J1 base heading
      const targetJ1Angle = -Math.atan2(dz, dx) - Math.PI / 2;
      j1.rotation.y = THREE.MathUtils.lerp(j1.rotation.y, targetJ1Angle, 0.15);

      // Rotate J2 / J3 to solve reach height
      const dist2d = Math.sqrt(dx * dx + dz * dz);
      const targetJ2Angle = -0.15 - (height * 0.4) + (dist2d - 0.5) * 0.3;
      const targetJ3Angle = 0.5 + (height * 0.5) - (dist2d - 0.5) * 0.5;

      j2.rotation.z = THREE.MathUtils.lerp(j2.rotation.z, targetJ2Angle, 0.15);
      j3.rotation.z = THREE.MathUtils.lerp(j3.rotation.z, targetJ3Angle, 0.15);

      // Small dynamic micro wrist adjustments
      j4.rotation.y = THREE.MathUtils.lerp(j4.rotation.y, Math.sin(t * 2) * 0.15, 0.15);
      j5.rotation.z = THREE.MathUtils.lerp(j5.rotation.z, Math.cos(t * 2) * 0.15, 0.15);
      j6.rotation.x = THREE.MathUtils.lerp(j6.rotation.x, t * 0.5, 0.12);

      // Perform process actions visually (concrete extrusions, suction clamps)
      triggerDynamicProcessVisualEffects();

      // Feed Telemetry details to dashboard
      onTelemetryUpdate({
        jointsJ1: Math.round(THREE.MathUtils.radToDeg(j1.rotation.y)),
        jointsJ2: Math.round(THREE.MathUtils.radToDeg(j2.rotation.z)),
        jointsJ3: Math.round(THREE.MathUtils.radToDeg(j3.rotation.z)),
        jointsJ4: Math.round(THREE.MathUtils.radToDeg(j4.rotation.y)),
        jointsJ5: Math.round(THREE.MathUtils.radToDeg(j5.rotation.z)),
        jointsJ6: Math.round(THREE.MathUtils.radToDeg(j6.rotation.x)),
        chassisX: parseFloat(targetTipPos.x.toFixed(2)),
        chassisY: parseFloat(targetTipPos.y.toFixed(2)),
        chassisZ: parseFloat(targetTipPos.z.toFixed(2)),
        chassisYaw: Math.round(THREE.MathUtils.radToDeg(j1.rotation.y)),
        sprayDistance: parseFloat(Math.max(0.12, 0.45 - height * 0.1).toFixed(2)),
        sprayWidth: Math.round(180 + Math.abs(Math.sin(t * 3)) * 60),
        sprayPressure: parseFloat((3.4 + Math.sin(t * 6) * 0.18).toFixed(1)),
        powerConsumption: parseFloat((5.8 + Math.abs(Math.cos(t * 1.5)) * 1.8).toFixed(1)),
        paintCoverage: Math.round(pathProgressRef.current * 100),
        paintThickness: parseFloat((0.12 + pathProgressRef.current * 0.08).toFixed(2)),
      });

    } else {
      // 2. Stationary idling cycles (Small physical system breathing angles)
      j1.rotation.y = Math.sin(t * 0.5) * 0.2;
      j2.rotation.z = -0.1 + Math.cos(t * 0.4) * 0.08;
      j3.rotation.z = 0.42 + Math.sin(t * 0.4) * 0.1;
      j4.rotation.y = Math.cos(t * 0.6) * 0.15;
      j5.rotation.z = Math.sin(t * 0.8) * 0.1;
      j6.rotation.x = t * 0.05;

      // Telemetry feed in idle status
      onTelemetryUpdate({
        jointsJ1: Math.round(THREE.MathUtils.radToDeg(j1.rotation.y)),
        jointsJ2: Math.round(THREE.MathUtils.radToDeg(j2.rotation.z)),
        jointsJ3: Math.round(THREE.MathUtils.radToDeg(j3.rotation.z)),
        jointsJ4: Math.round(THREE.MathUtils.radToDeg(j4.rotation.y)),
        jointsJ5: Math.round(THREE.MathUtils.radToDeg(j5.rotation.z)),
        jointsJ6: Math.round(THREE.MathUtils.radToDeg(j6.rotation.x)),
        chassisX: 0.0,
        chassisY: 1.05,
        chassisZ: 0.25,
        chassisYaw: Math.round(THREE.MathUtils.radToDeg(j1.rotation.y)),
        sprayDistance: 0.0,
        sprayWidth: 0,
        sprayPressure: 0.0,
        powerConsumption: 1.1, // Minimal draw
        paintCoverage: 0,
        paintThickness: 0.0,
      });

      // Turn off dynamic visual meshes
      toggleVisualProcessMashing(false);
    }
  };

  // Perform dynamic visual actions (extrude mortar layers, drop gray mortar, highlight sprayed surfaces)
  const triggerDynamicProcessVisualEffects = () => {
    if (!buildProgressGroupRef.current) return;
    const progressGroup = buildProgressGroupRef.current;

    toggleVisualProcessMashing(true);

    if (activeProcess === "concrete_pour" || activeProcess === "concrete_flat") {
      const slab = progressGroup.getObjectByName("dynamic_concrete_mass") as THREE.Mesh;
      if (slab) {
        slab.visible = true;
        slab.scale.y = pathProgressRef.current * 6.0;
        slab.position.y = 0.04 + slab.scale.y * 0.005;
      }
    } else if (activeProcess === "brick_lay") {
      // Dynamically spawn small orange brick meshes in rows as arm sweeps path
      // Brick count matches progress
      const targetBrickCount = Math.floor(pathProgressRef.current * 4);
      const brickMat = new THREE.MeshStandardMaterial({ color: 0xb45309 });
      const brickGeo = new THREE.BoxGeometry(0.18, 0.045, 0.08);

      // Render custom bricks array inside workspace
      while (progressGroup.children.length < targetBrickCount) {
        const index = progressGroup.children.length;
        const brick = new THREE.Mesh(brickGeo, brickMat);
        const offsetX = -0.27 + index * 0.18;
        brick.position.set(offsetX, 0.095, -0.08);
        brick.castShadow = true;
        progressGroup.add(brick);
      }
    } else if (activeProcess === "tile_lay") {
      // Spawn polished marble tiles as arm sweeps
      const targetTileCount = Math.floor(pathProgressRef.current * 6);
      const marbleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1, metalness: 0.1 });
      const tileGeo = new THREE.BoxGeometry(0.16, 0.015, 0.16);

      const positions = [
        [-0.18, -0.23], [0, -0.23], [0.18, -0.23],
        [-0.18, -0.05], [0, -0.05], [0.18, -0.05]
      ];

      while (progressGroup.children.length < targetTileCount) {
        const index = progressGroup.children.length;
        if (index >= positions.length) break;
        const [tx, tz] = positions[index];
        const tile = new THREE.Mesh(tileGeo, marbleMat);
        tile.position.set(tx, 0.035, tz);
        tile.castShadow = true;
        progressGroup.add(tile);
      }
    } else if (activeProcess === "spray_wall") {
      // Color target panel partition with rainbow glowing spray lines on wall
      const wallTargetObj = sceneRef.current?.getObjectByName("workpiece_target");
      if (wallTargetObj && wallTargetObj instanceof THREE.Mesh) {
        const mat = wallTargetObj.material as THREE.MeshStandardMaterial;
        mat.color.setHSL(0.55 + Math.sin(pathProgressRef.current * 2) * 0.05, 0.8, 0.5);
      }
    }
  };

  const toggleVisualProcessMashing = (active: boolean) => {
    if (!buildProgressGroupRef.current) return;
    const progressGroup = buildProgressGroupRef.current;

    if (!active) {
      // Reset concrete scale and clear child bricks/tiles
      const slab = progressGroup.getObjectByName("dynamic_concrete_mass") as THREE.Mesh;
      if (slab) {
        slab.visible = false;
        slab.scale.y = 1.0;
        slab.position.y = 0.08;
      }
      while (progressGroup.children.length > 0) {
        // remove custom spawned bricks, but keep the concrete box reference if it's there
        if (progressGroup.children[0].name === "dynamic_concrete_mass") {
          progressGroup.children[0].visible = false;
          break;
        }
        progressGroup.remove(progressGroup.children[0]);
      }
    }
  };

  // =========================================================================
  // VIEWPORT CLICK INTERACTION METHOD (RAYCASTING COORDS ON WORKPIECE)
  // =========================================================================
  const handleViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Filter interactive candidate layers
    const targetMesh = sceneRef.current.getObjectByName("workpiece_target");
    if (!targetMesh) return;

    // Direct intersect checking
    const intersects = raycaster.intersectObjects([targetMesh], true);
    if (intersects.length > 0) {
      const pt = intersects[0].point;
      
      // Limit to 5 points max
      if (clickPoints.length < 5) {
        setClickPoints(prev => [...prev, pt.clone()]);
      }
    }
  };

  const handleViewportMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const targetMesh = sceneRef.current.getObjectByName("workpiece_target");
    if (!targetMesh) {
      if (pointerSphereRef.current) pointerSphereRef.current.visible = false;
      return;
    }

    const intersects = raycaster.intersectObjects([targetMesh], true);
    if (intersects.length > 0) {
      const pt = intersects[0].point;
      setHoveredPoint(pt);
      if (pointerSphereRef.current) {
        pointerSphereRef.current.position.copy(pt);
        pointerSphereRef.current.visible = true;
      }
    } else {
      setHoveredPoint(null);
      if (pointerSphereRef.current) pointerSphereRef.current.visible = false;
    }
  };

  return (
    <div className="relative w-full h-full group select-none">
      <div
        ref={mountRef}
        onClick={handleViewportClick}
        onMouseMove={handleViewportMouseMove}
        onMouseLeave={() => {
          setHoveredPoint(null);
          if (pointerSphereRef.current) pointerSphereRef.current.visible = false;
        }}
        className="w-full h-full cursor-crosshair"
      />

      {/* Guide tags in screen view overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-1.5 p-3.5 bg-slate-900/95 border border-slate-700/80 rounded-lg backdrop-blur-md pointer-events-none text-xs font-mono text-slate-200">
        <div className="flex items-center gap-2 text-cyan-400 font-bold">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>智能工艺轨迹规划中...</span>
        </div>
        <div className="text-slate-400 mt-1">
          • 请在工作台中心的物料材料表面连续点击，规划精确施工点/线
        </div>
        <div className="text-slate-400">
          • 规划节点数: <span className="text-cyan-300 font-bold">{clickPoints.length} / 5</span>
        </div>
        {hoveredPoint && (
          <div className="text-slate-500 border-t border-slate-800 pt-1 mt-1 text-[10px]">
            当前作业鼠标落点: X:{hoveredPoint.x.toFixed(2)}, Y:{hoveredPoint.y.toFixed(2)}, Z:{hoveredPoint.z.toFixed(2)}
          </div>
        )}
      </div>

      {/* Camera angle display tag */}
      <div className="absolute bottom-4 right-4 p-2 bg-slate-950/80 border border-slate-850 rounded text-[10px] text-slate-500 font-mono">
        教学实训台孪生视角 • 3D ENVIRONMENT ACTIVE
      </div>
    </div>
  );
};
