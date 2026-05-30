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

  // Refs to prevent stale closure inside the 3D render tick loop
  const isRunningRef = useRef(isRunning);
  const isPausedRef = useRef(isPaused);
  const clickPointsRef = useRef(clickPoints);
  const playSpeedRef = useRef(playSpeed);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    clickPointsRef.current = clickPoints;
  }, [clickPoints]);

  useEffect(() => {
    playSpeedRef.current = playSpeed;
  }, [playSpeed]);

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
    handleL.position.set(0.25, 0, 0.012);
    frontDoorLeft.add(handleL);

    const handleR = handleL.clone();
    handleR.position.set(-0.25, 0, 0.012);
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

    // Premium industrial robotic materials
    const armMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // High-gloss clean white shell
      roughness: 0.15,
      metalness: 0.1,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb, // High-gloss cobalt safety blue sleeves / bands
      metalness: 0.4,
      roughness: 0.15,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark titanium/carbide connector gears
      metalness: 0.85,
      roughness: 0.25,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Reflective chrome / polished steel rods and pistons
      metalness: 0.95,
      roughness: 0.1,
    });
    const darkCableMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Flexible black corrugated wire looms
      roughness: 0.9,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xeab308, // Dynamic bright brass fasteners/fastening caps
      metalness: 0.8,
      roughness: 0.15,
    });
    const ledGlowMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.5,
    });

    // 0. Solid Base Anchored Ground Plate (High Realism Foundation)
    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.02, 8), metalMat);
    basePlate.position.y = 0.01;
    basePlate.receiveShadow = true;
    basePlate.castShadow = true;
    robotGroup.add(basePlate);

    // 4 Heavy Golden Anchor Bolts holding the robot to the T-slots
    const boltAngles = [Math.PI / 4, (Math.PI * 3) / 4, (Math.PI * 5) / 4, (Math.PI * 7) / 4];
    boltAngles.forEach(angle => {
      const bx = Math.cos(angle) * 0.15;
      const bz = Math.sin(angle) * 0.15;
      
      const boltGroup = new THREE.Group();
      boltGroup.position.set(bx, 0.025, bz);
      
      const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.005, 8), steelMat);
      const boltHex = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 6), brassMat);
      boltHex.position.y = 0.008;
      
      boltGroup.add(washer);
      boltGroup.add(boltHex);
      basePlate.add(boltGroup);
    });

    // J1 Base Tower (Heavy rotational turret)
    const j1 = new THREE.Group();
    j1.position.set(0, 0, 0); // raised above heavy base plate
    j1Ref.current = j1;
    robotGroup.add(j1);

    // Turret shell (contoured step body)
    const turretBody1 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.06, 16), metalMat);
    turretBody1.position.y = 0.03;
    turretBody1.castShadow = true;
    j1.add(turretBody1);

    const turretBody2 = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.05, 16), armMat);
    turretBody2.position.y = 0.085;
    turretBody2.castShadow = true;
    j1.add(turretBody2);

    // Holographic Base Glowing LED Ring (Digital twin state feedback)
    const baseLedRing = new THREE.Mesh(new THREE.TorusGeometry(0.144, 0.006, 8, 24).rotateX(Math.PI / 2), ledGlowMat);
    baseLedRing.position.y = 0.11;
    baseLedRing.name = "base_led_ring";
    j1.add(baseLedRing);

    // Turret interface socket box (Pneumatic & Electrical main bus inputs)
    const socketBox = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.05), metalMat);
    socketBox.position.set(0, 0.06, -0.13);
    j1.add(socketBox);

    const auxCable = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 8).rotateX(Math.PI / 2), darkCableMat);
    auxCable.position.set(0, 0.06, -0.18);
    j1.add(auxCable);

    // J2 Shoulder Support Clevis (Two strong vertical forks holding J2 joint)
    const clevisLeft = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.12), armMat);
    clevisLeft.position.set(-0.08, 0.19, 0.02);
    clevisLeft.castShadow = true;
    j1.add(clevisLeft);

    const clevisRight = clevisLeft.clone();
    clevisRight.position.x = 0.08;
    j1.add(clevisRight);

    // J2 Shoulder Pitch Axis (Rotational sleeve inside clevis)
    const j2 = new THREE.Group();
    j2.position.set(0, 0.22, 0.02);
    j2Ref.current = j2;
    j1.add(j2);

    // Shoulder cap cross barrel
    const shoulderCap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.15, 12).rotateZ(Math.PI / 2), metalMat);
    shoulderCap.castShadow = true;
    j2.add(shoulderCap);

    const shoulderBlueCapL = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.015, 12).rotateZ(Math.PI / 2), jointMat);
    shoulderBlueCapL.position.x = -0.076;
    const shoulderBlueCapR = shoulderBlueCapL.clone();
    shoulderBlueCapR.position.x = 0.076;
    j2.add(shoulderBlueCapL);
    j2.add(shoulderBlueCapR);

    // Detailed side concentric planetary reducer plates
    const reducerRing = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.004, 12).rotateZ(Math.PI / 2), steelMat);
    reducerRing.position.x = 0.08;
    j2.add(reducerRing);

    // Bicep Main Structure (Anodized titanium core with white protective casings)
    const bicepGroup = new THREE.Group();
    j2.add(bicepGroup);

    // Core thick structural tube
    const bicepCore = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.45, 12), metalMat);
    bicepCore.position.y = 0.225;
    bicepCore.castShadow = true;
    bicepGroup.add(bicepCore);

    // Molded white aerodynamic cover shells clasped over bicep core
    const bicepShellL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.38, 0.08), armMat);
    bicepShellL.position.set(-0.04, 0.225, 0);
    bicepShellL.castShadow = true;
    
    const bicepShellR = bicepShellL.clone();
    bicepShellR.position.x = 0.04;
    bicepGroup.add(bicepShellL);
    bicepGroup.add(bicepShellR);

    // Visual Zebra Stripe Warning decal plate on Bicep
    const warningDecalPlate = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.07, 0.04), new THREE.MeshBasicMaterial({ color: 0xeab308 }));
    warningDecalPlate.position.set(0.054, 0.25, 0);
    bicepGroup.add(warningDecalPlate);

    for (let s = -0.025; s <= 0.025; s += 0.015) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.005, 0.042), new THREE.MeshBasicMaterial({ color: 0x111827 }));
      stripe.position.set(0.055, 0.25 + s, 0);
      stripe.rotation.x = Math.PI / 4;
      bicepGroup.add(stripe);
    }

    // Heavy Industrial Backpressure Hydraulic Damper (Gas Cylinder) mounted parallel to bicep
    const damperGroup = new THREE.Group();
    damperGroup.position.set(-0.05, 0.05, 0.05);
    bicepGroup.add(damperGroup);

    const damperCasing = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8), metalMat);
    damperCasing.position.y = 0.11;
    damperCasing.castShadow = true;
    damperGroup.add(damperCasing);

    const damperRod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8), steelMat);
    damperRod.position.y = 0.24;
    damperRod.castShadow = true;
    damperGroup.add(damperRod);

    const damperBaseFixture = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), steelMat);
    damperBaseFixture.position.y = 0.001;
    damperGroup.add(damperBaseFixture);

    // J3 Elbow Joint Group (Pitch Axis)
    const j3 = new THREE.Group();
    j3.position.set(0, 0.45, 0);
    j3Ref.current = j3;
    j2.add(j3);

    // Heavy mechanical elbow box
    const elbowHousing = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.11), armMat);
    elbowHousing.castShadow = true;
    j3.add(elbowHousing);

    // Center pitch shaft caps
    const elbowPitchCap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.10, 12).rotateZ(Math.PI / 2), metalMat);
    elbowPitchCap.position.x = 0.01;
    elbowPitchCap.castShadow = true;
    j3.add(elbowPitchCap);

    const elbowPitchBlueCap = new THREE.Mesh(new THREE.CylinderGeometry(0.051, 0.051, 0.015, 12).rotateZ(Math.PI / 2), jointMat);
    elbowPitchBlueCap.position.x = 0.058;
    j3.add(elbowPitchBlueCap);

    // Tapered Forearm (Lower Arm) Link
    const forearmGroup = new THREE.Group();
    j3.add(forearmGroup);

    const forearmTube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.4, 16), armMat);
    forearmTube.position.y = 0.2;
    forearmTube.castShadow = true;
    forearmGroup.add(forearmTube);

    // Embedded glowing neon LED indicator strip running down forearm
    const forearmGlowBar = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.22, 0.028), ledGlowMat);
    forearmGlowBar.position.set(0, 0.2, 0.026);
    forearmGlowBar.name = "forearm_glow_bar";
    forearmGroup.add(forearmGlowBar);

    // Brand plate on forearm "HB-C6 PRO"
    const infoPlate = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.06, 0.001), metalMat);
    infoPlate.position.set(0.028, 0.28, 0);
    infoPlate.rotation.y = Math.PI / 2;
    forearmGroup.add(infoPlate);

    const infoDecalText = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.04, 0.002), new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
    infoDecalText.position.set(0.029, 0.28, 0);
    infoDecalText.rotation.y = Math.PI / 2;
    forearmGroup.add(infoDecalText);

    // Ribbed black wire loom sweep: loops beautifully across elbow J3 (pure hardware physical geometry)
    for (let c = 0; c < 8; c++) {
      const sweepTorus = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 6, 12, Math.PI), darkCableMat);
      sweepTorus.position.set(-0.042, 0.0 + c * 0.004, -0.01);
      sweepTorus.rotation.y = Math.PI / 2;
      sweepTorus.rotation.z = Math.PI / 6 + c * 0.08;
      j3.add(sweepTorus);
    }

    // J4 Wrist Rotate Joint (Roll Axis)
    const j4 = new THREE.Group();
    j4.position.set(0, 0.4, 0);
    j4Ref.current = j4;
    j3.add(j4);

    const wristRollUpperCasing = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.04, 0.05, 12), metalMat);
    wristRollUpperCasing.position.y = 0.025;
    j4.add(wristRollUpperCasing);

    const wristRollBlueSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.015, 12), jointMat);
    wristRollBlueSleeve.position.y = 0.055;
    j4.add(wristRollBlueSleeve);

    const wristRollLowerCasing = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.041, 0.03, 12), armMat);
    wristRollLowerCasing.position.y = 0.075;
    wristRollLowerCasing.castShadow = true;
    j4.add(wristRollLowerCasing);

    // J5 Wrist Bend/Pitch Axis Bracket (Yoke clevis style)
    const j5 = new THREE.Group();
    j5.position.set(0, 0.1, 0);
    j5Ref.current = j5;
    j4.add(j5);

    const wristPitchBracket = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.07, 0.062), armMat);
    wristPitchBracket.position.y = 0.01;
    wristPitchBracket.castShadow = true;
    j5.add(wristPitchBracket);

    const wristPitchCore = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.072, 12).rotateX(Math.PI / 2), metalMat);
    wristPitchCore.position.y = 0.015;
    wristPitchCore.castShadow = true;
    j5.add(wristPitchCore);

    const wristPitchBlueCap = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.008, 12).rotateX(Math.PI / 2), jointMat);
    wristPitchBlueCap.position.set(0, 0.015, 0.037);
    j5.add(wristPitchBlueCap);

    // J6 End Tool Flange (Sleek rotating tool plate with dynamic status LED band)
    const j6 = new THREE.Group();
    j6.position.set(0, 0.052, 0);
    j6Ref.current = j6;
    j5.add(j6);

    const flangeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.018, 12), metalMat);
    flangeBase.position.y = 0.009;
    flangeBase.castShadow = true;
    j6.add(flangeBase);

    // Glow Ring at Tool Attachment Point
    const toolGlowBand = new THREE.Mesh(new THREE.CylinderGeometry(0.0355, 0.0355, 0.004, 12), ledGlowMat);
    toolGlowBand.position.y = 0.019;
    toolGlowBand.name = "wrist_led_ring";
    j6.add(toolGlowBand);

    const flangePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.035, 0.008, 12), steelMat);
    flangePlate.position.y = 0.024;
    j6.add(flangePlate);

    // Thick coiled wire conduit wrapping wrist to gun
    for (let w = 0; w < 12; w++) {
      const wireSegment = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 4, 10, Math.PI * 1.5), darkCableMat);
      wireSegment.position.set(0.022, 0.02 - w * 0.004, 0.0);
      wireSegment.rotation.y = Math.PI / 2;
      wireSegment.rotation.x = w * 0.45;
      j6.add(wireSegment);
    }

    // SWAPPABLE INDUSTRIAL TOOL HEAD GROUP
    const toolGroup = new THREE.Group();
    toolGroup.position.set(0, 0.028, 0);
    toolGroupRef.current = toolGroup;
    j6.add(toolGroup);

    // Build swappable tool head mechanics
    buildProcessToolhead(toolGroup);

    scene.add(robotGroup);
  };

  // Swappable Toolheads based on Active Craft Process (Highly Detailed CAD Equivalents)
  const buildProcessToolhead = (group: THREE.Group) => {
    // Clear any previous tools
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.2 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
    const goldenBrass = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.15 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8 });
    const brightOrange = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.2, roughness: 0.4 });
    const whitePlasticsDeviceMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.15, metalness: 0.1 });

    switch (activeProcess) {
      case "rebar_lay": {
        // High fidelity pneumatic rebar gripper
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.025, 0.04, 12), darkMetal);
        adapter.position.y = 0.015;
        group.add(adapter);

        // Core rectangular pneumatic gripper block matching Festo industrial guidelines
        const mainBlock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.032, 0.052), steel);
        mainBlock.position.y = 0.036;
        group.add(mainBlock);

        // Linear slide guide bars
        const slideBarL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 8).rotateZ(Math.PI / 2), steel);
        slideBarL.position.y = 0.036;
        group.add(slideBarL);

        // Right side claw fingers with safety high-vis rubber pads
        const clawL = new THREE.Group();
        clawL.position.set(-0.042, 0.04, 0);
        
        const fingerL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.065, 0.022), darkMetal);
        fingerL.position.y = 0.025;
        const padL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.035, 0.024), brightOrange);
        padL.position.set(0.008, 0.03, 0);
        
        clawL.add(fingerL);
        clawL.add(padL);
        group.add(clawL);

        const clawR = clawL.clone();
        clawR.position.x = 0.042;
        clawR.rotation.y = Math.PI; // Flip pad inwards
        group.add(clawR);
        break;
      }
      case "rebar_tie": {
        // High fidelity automatic wire tying nozzle gun with wire coil rolls
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.03, 12), darkMetal);
        adapter.position.y = 0.015;
        group.add(adapter);

        // Heavy dual-motor gun housing
        const gearCase = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.06), steel);
        gearCase.position.set(0, 0.045, 0);
        group.add(gearCase);

        const tieBody = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.12), darkMetal);
        tieBody.position.set(0, 0.075, 0.03);
        group.add(tieBody);

        // Metallic spool container loaded with real-looking copper/bronze wire coils
        const spoolDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.028, 16).rotateZ(Math.PI / 2), rubberMat);
        spoolDrum.position.set(-0.038, 0.075, 0.02);
        group.add(spoolDrum);

        // Copper core coils nested in spool drum
        const wireCoils = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.024, 16).rotateZ(Math.PI / 2), goldenBrass);
        wireCoils.position.copy(spoolDrum.position);
        group.add(wireCoils);

        // Curved steel loop guide needle tube pointing down
        const guideTube = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.07, 10), steel);
        guideTube.position.set(0, 0.115, 0.065);
        guideTube.rotation.x = -Math.PI / 5;
        group.add(guideTube);

        const wireGuideTip = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.002, 0.015, 8), goldenBrass);
        wireGuideTip.position.set(0, 0.148, 0.088);
        wireGuideTip.rotation.x = -Math.PI / 5;
        group.add(wireGuideTip);
        break;
      }
      case "concrete_pour": {
        // High fidelity modular slurry delivery head
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.03, 12), darkMetal);
        adapter.position.y = 0.012;
        group.add(adapter);

        const flowControlValve = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.052, 0.052), steel);
        flowControlValve.position.y = 0.04;
        group.add(flowControlValve);

        // Rotary manual override handles on valve
        const valveDial = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 8).rotateZ(Math.PI / 2), brightOrange);
        valveDial.position.set(0.028, 0.04, 0);
        group.add(valveDial);

        // Steel feed pipeline with heavy-duty black hose loop representation
        const pipeStem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.08, 12), steel);
        pipeStem.position.set(0, 0.09, 0.018);
        pipeStem.rotation.x = Math.PI / 8;
        group.add(pipeStem);

        // Corrugated feed hose exit nozzle
        const rubberExit = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.016, 0.04, 12), rubberMat);
        rubberExit.position.set(0, 0.14, 0.04);
        rubberExit.rotation.x = Math.PI / 8;
        group.add(rubberExit);
        break;
      }
      case "concrete_flat": {
        // High fidelity dual-spring adaptive pressure squeegee screed tamping plate
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.03, 12), darkMetal);
        adapter.position.y = 0.015;
        group.add(adapter);

        // Central cross bar frame
        const mountingBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.03), steel);
        mountingBar.position.y = 0.032;
        group.add(mountingBar);

        // Dual Shock Shock springs (Fender assemblies on left and right)
        [-0.05, 0.05].forEach(offsetX => {
          const damperGroup = new THREE.Group();
          damperGroup.position.set(offsetX, 0.035, 0);

          const damperBase = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.01, 0.016), darkMetal);
          damperGroup.add(damperBase);

          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.055), steel);
          shaft.position.y = 0.025;
          damperGroup.add(shaft);

          // Build procedural spring coil out of stacked torus rings
          for (let s = 1; s <= 5; s++) {
            const coil = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.0025, 6, 12).rotateX(Math.PI / 2), steel);
            coil.position.y = 0.005 + s * 0.007;
            damperGroup.add(coil);
          }

          group.add(damperGroup);
        });

        // The broad horizontal scraping blade in polished aluminum
        const scraperBlade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 0.06), steel);
        scraperBlade.position.set(0, 0.08, 0);
        group.add(scraperBlade);

        // Cylinder vibrator eccenter motor mounted centrally on the scraping blade
        const motorHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.042, 10).rotateZ(Math.PI / 2), brightOrange);
        motorHousing.position.set(0, 0.092, 0);
        group.add(motorHousing);
        break;
      }
      case "brick_lay": {
        // High fidelity vacuum manipulator cup with pneumatic lines and vacuum meter
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.03, 12), darkMetal);
        adapter.position.y = 0.012;
        group.add(adapter);

        const spacer = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10), steel);
        spacer.position.y = 0.03;
        group.add(spacer);

        // Suction bracket cross plate
        const crossPlate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 0.05), steel);
        crossPlate.position.y = 0.042;
        group.add(crossPlate);

        // Dual 3-fold bellows heavy duty suction cups in black matte vulcanized rubber
        [-0.04, 0.04].forEach(offsetX => {
          const bellowsCup = new THREE.Group();
          bellowsCup.position.set(offsetX, 0.045, 0);

          // Top thin steel stem
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012), steel);
          bellowsCup.add(stem);

          // Bellow layer 1 (Wide cylinder)
          const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.01, 16), rubberMat);
          b1.position.y = 0.013;
          bellowsCup.add(b1);

          // Bellow layer 2 (Medium cylinder)
          const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.01, 16), rubberMat);
          b2.position.y = 0.021;
          bellowsCup.add(b2);

          // Bellow layer 3 (Tapered base lip)
          const b3 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.028, 0.012, 16), rubberMat);
          b3.position.y = 0.03;
          bellowsCup.add(b3);

          group.add(bellowsCup);
        });

        // Vacuum feedback diagnostic gauge clock (high fidelity feature)
        const dialBox = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12).rotateX(Math.PI / 2), darkMetal);
        dialBox.position.set(0, 0.056, 0.026);
        group.add(dialBox);

        // Vibrant neon green glass screen face
        const dialFace = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
        dialFace.position.set(0, 0.056, 0.031);
        group.add(dialFace);
        break;
      }
      case "tile_lay": {
        // High fidelity carbon-fiber quad vacuum matrix tile gripper
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.03, 12), darkMetal);
        adapter.position.y = 0.015;
        group.add(adapter);

        // High gloss grid chassis frame (Carbon composite simulation)
        const frameCenter = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.04), steel);
        frameCenter.position.y = 0.03;
        group.add(frameCenter);

        // Left-right side carbon bar, front-back side carbon bar
        const carbonPlateH = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.008, 0.03), darkMetal);
        carbonPlateH.position.y = 0.036;
        const carbonPlateV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.15), darkMetal);
        carbonPlateV.position.y = 0.036;
        group.add(carbonPlateH);
        group.add(carbonPlateV);

        // 4 Blue silicone spring loaded cushion suction cup columns
        const positions = [
          [-0.065, -0.065], [0.065, -0.065],
          [-0.065, 0.065], [0.065, 0.065]
        ];

        const miniBellowsGeoLower = new THREE.CylinderGeometry(0.018, 0.02, 0.01, 12);
        const miniBellowsGeoUpper = new THREE.CylinderGeometry(0.012, 0.018, 0.01, 12);
        const blueSiliconeMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6 });

        positions.forEach(([cx, cz]) => {
          const cupGroup = new THREE.Group();
          cupGroup.position.set(cx, 0.04, cz);

          const metalSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.015), steel);
          cupGroup.add(metalSleeve);

          const b1 = new THREE.Mesh(miniBellowsGeoUpper, blueSiliconeMat);
          b1.position.y = 0.012;
          cupGroup.add(b1);

          const b2 = new THREE.Mesh(miniBellowsGeoLower, blueSiliconeMat);
          b2.position.y = 0.021;
          cupGroup.add(b2);

          group.add(cupGroup);
        });
        break;
      }
      case "spray_wall":
      default: {
        // High fidelity dual-port electrostatic spray painting block with air & fluid coiled inlets
        const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.03, 12), darkMetal);
        adapter.position.y = 0.012;
        group.add(adapter);

        const controlSubsystem = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.036, 0.11), whitePlasticsDeviceMat);
        controlSubsystem.position.y = 0.035;
        group.add(controlSubsystem);

        // Twin brass spray gun nozzles equipped with precision atomization guards
        const corePipeL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05), steel);
        corePipeL.position.set(-0.024, 0.055, 0.02);
        corePipeL.rotation.x = Math.PI / 8;
        group.add(corePipeL);

        const nozzleL = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.012, 0.025, 10), goldenBrass);
        nozzleL.position.set(-0.024, 0.082, 0.034);
        nozzleL.rotation.x = Math.PI / 8;
        group.add(nozzleL);

        const corePipeR = corePipeL.clone();
        corePipeR.position.x = 0.024;
        group.add(corePipeR);

        const nozzleR = nozzleL.clone();
        nozzleR.position.x = 0.024;
        group.add(nozzleR);

        // Air pressure regulation valves in safety blue
        const adjustmentValves = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 8).rotateZ(Math.PI / 2), steel);
        adjustmentValves.position.set(0.039, 0.035, -0.02);
        group.add(adjustmentValves);
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

    const isRunning = isRunningRef.current;
    const isPaused = isPausedRef.current;
    const clickPoints = clickPointsRef.current;
    const playSpeed = playSpeedRef.current;

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

    // Real-time Animated LED Status indicators (Base, Forearm & Wrist flange indicators)
    const robotGroup = robotGroupRef.current;
    if (robotGroup) {
      const baseLed = robotGroup.getObjectByName("base_led_ring") as THREE.Mesh;
      const forearmGlow = robotGroup.getObjectByName("forearm_glow_bar") as THREE.Mesh;
      const wristLed = robotGroup.getObjectByName("wrist_led_ring") as THREE.Mesh;

      [baseLed, forearmGlow, wristLed].forEach(led => {
        if (led && led.material instanceof THREE.MeshStandardMaterial) {
          const mat = led.material;
          if (isRunning && !isPaused) {
            // Active simulation execution: breathe energetic teal-emerald
            const pulse = (Math.sin(t * 8) + 1.0) * 0.5;
            mat.color.setHex(0x10b981); // auto emerald green
            mat.emissive.setHex(0x10b981);
            mat.emissiveIntensity = 1.0 + pulse * 1.5;
          } else if (isRunning && isPaused) {
            // PAUSED warning safety indicator: amber flashing
            const state = Math.floor(t * 5.0) % 2 === 0;
            mat.color.setHex(state ? 0xf59e0b : 0x1e293b);
            mat.emissive.setHex(state ? 0xf59e0b : 0x000000);
            mat.emissiveIntensity = state ? 2.5 : 0.0;
          } else {
            // Idle waiting: warm gentle sapphire blue wave
            const breathe = (Math.sin(t * 2.0) + 1.0) * 0.5;
            mat.color.setHex(0x2563eb); // cobalt sapphire
            mat.emissive.setHex(0x2563eb);
            mat.emissiveIntensity = 0.5 + breathe * 0.8;
          }
        }
      });
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
