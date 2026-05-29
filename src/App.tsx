import React, { useState, useEffect } from "react";
import { CodeBlock, TelemetryData, LogMessage, ConstructionProcess, WorkpieceModel } from "./types";
import { ThreeSimulation } from "./components/ThreeSimulation";
import { BlocksPanel } from "./components/BlocksPanel";
import { ParametersPanel } from "./components/ParametersPanel";
import { ConsoleLogs } from "./components/ConsoleLogs";
import { AIPanel } from "./components/AIPanel";
import { 
  ShieldCheck, ShieldAlert, Sliders, Box, HelpCircle, 
  Upload, Database, Layers, Check, Sparkles, Activity, FileText, PlusCircle
} from "lucide-react";
import * as THREE from "three";

// Predefined Workpieces Library (Public Database)
const PUBLIC_WORKPIECES: WorkpieceModel[] = [
  { id: "wp_rebar", name: "HR-G2 十字抗弯拉结钢筋桁架", fileName: "standard_rebar_cage.obj", classification: "物料", sizeDescription: "尺寸: 800x600x120 mm (Φ12级拉结筋)" },
  { id: "wp_concrete", name: "HR-M4 基础现浇钢筋混凝土楼板模盒", fileName: "pouring_form_basin.step", classification: "物料", sizeDescription: "尺寸: 800x500x100 mm (轻质抗裂基底)" },
  { id: "wp_brick", name: "HR-B1 建筑标准粘土实心标砖", fileName: "clay_solid_brick.fbx", classification: "物料", sizeDescription: "尺寸: 240x115x53 mm (粘土烧结一级)" },
  { id: "wp_tile", name: "HR-T1 拋光抗滑大理石室外地砖", fileName: "marble_outdoor_tile.step", classification: "物料", sizeDescription: "尺寸: 600x600x15 mm (抛光花岗岩结构)" },
  { id: "wp_wall", name: "HR-S5 水泥混凝土室内隔壁墙板", fileName: "cement_partition_wall.obj", classification: "物料", sizeDescription: "尺寸: 900x500x40 mm (轻质保温石膏)" }
];

// 7 modular technical craft process-specific programming blocks
const INITIAL_PROCESS_BLOCKS: Record<ConstructionProcess, CodeBlock[]> = {
  rebar_lay: [
    { id: "rl1", type: "event", name: "当程序启动：准备高强度建筑钢筋骨架编织", color: "#3B82F6", description: "事件触发" },
    { id: "rl2", type: "action", name: "换装机械端：双卡爪液压端拾夹钳", color: "#10B981", description: "末端执行器定位" },
    { id: "rl3", type: "motion", name: "移动至送料架：真空负压夹持一级Φ12受拉拉结筋", color: "#8B5CF6", description: "抓取定位法" },
    { id: "rl4", type: "motion", name: "对准骨架定位卡槽，执行水平缓慢下放定位", color: "#EC4899", description: "巡角插装" },
    { id: "rl5", type: "action", name: "释放液压夹紧抱闸，关节复位返回安全就绪区", color: "#EF4444", description: "步进结束" }
  ],
  rebar_tie: [
    { id: "rt1", type: "event", name: "单步调试启动：开启受力节点气动强度拧合绑扎", color: "#3B82F6", description: "事件触发" },
    { id: "rt2", type: "action", name: "自动快换端拾器：气动强力自动送丝绑扎拧丝枪", color: "#10B981", description: "执行器组态" },
    { id: "rt3", type: "motion", name: "配合视觉对点：对准十字叠合钢筋绑扎节点", color: "#8B5CF6", description: "视觉对点标定" },
    { id: "rt4", type: "motion", name: "执行强力送丝，拧紧拉断（拧合扭矩: 14.5 N·m）", color: "#EC4899", description: "恒定应力拉结" },
    { id: "rt5", type: "action", name: "拉拔力检测：声学超声阻抗检验，完成强韧绑扎", color: "#EF4444", description: "拉拔力检查" }
  ],
  concrete_pour: [
    { id: "cp1", type: "event", name: "启动：基础钢筋混凝土协同分层浇筑程序", color: "#3B82F6", description: "事件触发" },
    { id: "cp2", type: "action", name: "换装：高层建筑防堵式混凝土排浆喷枪头", color: "#10B981", description: "重型出料头" },
    { id: "cp3", type: "action", name: "开启出料主阀板（设置初始匀质流速: 4.5 L/s）", color: "#F59E0B", description: "高压泵送流速" },
    { id: "cp4", type: "motion", name: "依轨迹在模盒中由内向外匀速巡径铺排（防溢包络）", color: "#8B5CF6", description: "防溢布料路线" },
    { id: "cp5", type: "action", name: "关闭气动滑阀板，开启高压氮气管路吹扫防堵", color: "#EF4444", description: "排堵吹洗" }
  ],
  concrete_flat: [
    { id: "cf1", type: "event", name: "单步流程控制：现浇面密实振动及精密刮平板复位", color: "#3B82F6", description: "事件触发" },
    { id: "cf2", type: "action", name: "换装：刚性附着气动微振激振器刮抹木板", color: "#10B981", description: "力敏随动端面" },
    { id: "cf3", type: "action", name: "自适应力控开启：保持垂直向下 25 N 恒定压紧拉力", color: "#F59E0B", description: "力矩自适应" },
    { id: "cf4", type: "motion", name: "贴合湿滑浆面：沿点击平直轨迹以 80mm/s 恒速扫抹刮平", color: "#EC4899", description: "恒速抹平" },
    { id: "cf5", type: "action", name: "激光高度传感器校核：平面平整度检测误差 <= 2.0mm", color: "#EF4444", description: "高程控制校验" }
  ],
  brick_lay: [
    { id: "bl1", type: "event", name: "当砌筑程序唤醒：轻质免烧红砖多层墙体砌筑", color: "#3B82F6", description: "事件触发" },
    { id: "bl2", type: "action", name: "自适应执行爪：气动大吸力耐磨防滑橡胶吸盘夹钳", color: "#10B981", description: "多点吸附器" },
    { id: "bl3", type: "motion", name: "从圆盘送料架拾取粘土红砖，视觉纠正位姿偏角", color: "#8B5CF6", description: "视觉对齐" },
    { id: "bl4", type: "motion", name: "依智能轨迹坐标，将其精准放落至预铺胶浆带上方", color: "#EC4899", description: "三维卡点落砖" },
    { id: "bl5", type: "action", name: "末端执行器轻微碰击击实、确保坐浆砂浆饱满度达标", color: "#EF4444", description: "力学敲实" }
  ],
  tile_lay: [
    { id: "tl1", type: "event", name: "开启：精装花岗耐磨地砖平面格网精密贴设", color: "#3B82F6", description: "事件触发" },
    { id: "tl2", type: "action", name: "快换气缸爪：四端抗滑地质地砖专用柔性大面积吸盘", color: "#10B981", description: "真空承载板" },
    { id: "tl3", type: "motion", name: "真空低压抱死（配气表真空度达: -0.06MPa 负压）", color: "#8B5CF6", description: "真空临界力吸附" },
    { id: "tl4", type: "motion", name: "向贴砖原点行进，平行贴近水泥粘结胶层（缓降）", color: "#EC4899", description: "垂直零高差控制" },
    { id: "tl5", type: "action", name: "开启高频端面气动压实微振，破除粘合空气并精准释放", color: "#EF4444", description: "激振密合" }
  ],
  spray_wall: [
    { id: "sw1", type: "event", name: "室内装配式隔墙：高速大压强双孔气混雾化扫刷", color: "#3B82F6", description: "事件触发" },
    { id: "sw2", type: "action", name: "自动对准墙面：高压电磁柱塞式压力喷枪头 (3.2MPa)", color: "#10B981", description: "雾化执行组" },
    { id: "sw3", type: "motion", name: "锁定移动底盘，开启视觉动态扫描建立墙板坐标系", color: "#8B5CF6", description: "坐标系矫正" },
    { id: "sw4", type: "motion", name: "沿规划的折线轨迹匀速扫掠，确保重合度达 35% 误差", color: "#EC4899", description: "精密路径喷刷" },
    { id: "sw5", type: "action", name: "喷洒终止，电磁柱塞滑阀瞬时闭锁阻止飞尘与滴漏", color: "#EF4444", description: "滴空防护" }
  ]
};

export default function App() {
  const [activeProcess, setActiveProcess] = useState<ConstructionProcess>("rebar_lay");
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(1.0);

  // Trajectory points on the workpiece surface
  const [clickPoints, setClickPoints] = useState<THREE.Vector3[]>([]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [activeLogCategory, setActiveLogCategory] = useState<"operation" | "running" | "error">("operation");

  // Telemetry details
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    chassisX: 0.0, chassisY: 1.05, chassisZ: 0.25, chassisYaw: 0,
    sprayDistance: 0.0, sprayWidth: 0, sprayPressure: 0.0, powerConsumption: 1.1,
    jointsJ1: 0, jointsJ2: 0, jointsJ3: 0, jointsJ4: 0, jointsJ5: 0, jointsJ6: 0,
    paintCoverage: 0, paintThickness: 0.0
  });

  // Material selection configuration
  const [workpieces, setWorkpieces] = useState<WorkpieceModel[]>(PUBLIC_WORKPIECES);
  const [activeWorkpiece, setActiveWorkpiece] = useState<WorkpieceModel | null>(PUBLIC_WORKPIECES[0]);

  // Model Import Form states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importModelName, setImportModelName] = useState("");
  const [importClassification, setImportClassification] = useState<"物料" | "夹具" | "台面夹具">("物料"); // default to 物料 as highlighted
  const [importSize, setImportSize] = useState("");

  const [processBlocks, setProcessBlocks] = useState<Record<ConstructionProcess, CodeBlock[]>>(INITIAL_PROCESS_BLOCKS);
  const activeBlocks = processBlocks[activeProcess];

  // Auto-switch material preset when swapping process mode for student comfort
  useEffect(() => {
    setClickPoints([]);
    setIsRunning(false);
    setIsPaused(false);
    setCurrentStepIndex(0);

    let presetIndex = 0;
    if (activeProcess === "rebar_lay" || activeProcess === "rebar_tie") presetIndex = 0;
    else if (activeProcess === "concrete_pour" || activeProcess === "concrete_flat") presetIndex = 1;
    else if (activeProcess === "brick_lay") presetIndex = 2;
    else if (activeProcess === "tile_lay") presetIndex = 3;
    else if (activeProcess === "spray_wall") presetIndex = 4;

    const matchedWp = workpieces.find(w => w.id === PUBLIC_WORKPIECES[presetIndex].id) || PUBLIC_WORKPIECES[presetIndex];
    setActiveWorkpiece(matchedWp);

    // Initial logs notification
    const craftNames: Record<ConstructionProcess, string> = {
      rebar_lay: "钢筋铺设",
      rebar_tie: "钢筋绑扎",
      concrete_pour: "混凝土浇筑",
      concrete_flat: "混凝土刮平",
      brick_lay: "智能砌墙",
      tile_lay: "地砖铺贴",
      spray_wall: "墙面喷涂"
    };

    setLogs([
      { id: "l1", timestamp: new Date().toTimeString().split(' ')[0], type: "info", message: `系统就绪：智能建造实训台已成功加载「${craftNames[activeProcess]}」工艺虚拟仿真模块。`, category: "operation" },
      { id: "l2", timestamp: new Date().toTimeString().split(' ')[0], type: "info", message: `绑定物料：${matchedWp.name}。请在三维场景中的物料表层点击创建定位坐标系。`, category: "running" }
    ]);
  }, [activeProcess]);

  // Kinematic simulator interval sweeps
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const stepInterval = 4000 / playSpeed;

    const timer = setTimeout(() => {
      if (clickPoints.length < 2) {
        addLog("⚠️ 轨迹规划节点过低：请先在三维工作区域的物料表面标记点击至少 2-5 个折线控制点！", "warn", "operation");
        setIsRunning(false);
        return;
      }

      if (currentStepIndex < activeBlocks.length - 1) {
        const nextIndex = currentStepIndex + 1;
        setCurrentStepIndex(nextIndex);
        addLog(`[轴运动控制器]: 正在执行步骤0${nextIndex + 1}: ${activeBlocks[nextIndex].name}`, "success", "running");
      } else {
        setIsRunning(false);
        addLog(`✓ 智能建造工艺「${activeBlocks[0].name.split('：')[1] || activeProcess}」智能轨迹运行完毕，全部节点精对贴合。`, "success", "operation");
      }
    }, stepInterval);

    return () => clearTimeout(timer);
  }, [isRunning, isPaused, currentStepIndex, playSpeed, clickPoints, activeProcess, activeBlocks]);

  const addLog = (message: string, type: LogMessage["type"], category: LogMessage["category"]) => {
    const formattedTime = new Date().toTimeString().split(' ')[0];
    const newLog: LogMessage = {
      id: `l_${Date.now()}_${Math.random()}`,
      timestamp: formattedTime,
      type,
      message,
      category
    };
    setLogs(prev => [...prev, newLog]);
  };

  const handleTelemetryUpdate = (data: Partial<TelemetryData>) => {
    setTelemetry(prev => ({ ...prev, ...data }));
  };

  const handlePlaySimulation = () => {
    if (clickPoints.length < 2) {
      addLog("⚠️ 请先在三维空间物料表面标记连续 2-5 个作业点再启动控制程序！", "warn", "operation");
      return;
    }

    if (!isRunning) {
      setIsRunning(true);
      setIsPaused(false);
      setCurrentStepIndex(0);
      addLog(`⚡ 离线控制程序已生成，成功向 6轴 协作机械臂下达轨迹路径，正在逆Kinematics求解...`, "info", "operation");
      addLog(`[调试起动]: 开始执行步骤 01 : ${activeBlocks[0].name}`, "success", "running");
    } else {
      setIsPaused(!isPaused);
      addLog(isPaused ? "▶ 仿真恢复运行中..." : "⏸ 仿真程序已手动挂起暂停", "info", "operation");
    }
  };

  const handleStepDebug = () => {
    if (clickPoints.length < 2) {
      addLog("⚠️ 请先在水泥材料面标定至少 2 个路径点位再起动单步测试！", "warn", "operation");
      return;
    }

    if (!isRunning) {
      setIsRunning(true);
      setIsPaused(true);
      setCurrentStepIndex(0);
      addLog("⚡ 开启单步调试模式：逐帧校对协作机器人空间运动干涉防碰撞。", "info", "operation");
      addLog(`[单步调试步骤 01] -> ${activeBlocks[0].name}`, "info", "running");
    } else {
      if (currentStepIndex < activeBlocks.length - 1) {
        const nextIndex = currentStepIndex + 1;
        setCurrentStepIndex(nextIndex);
        addLog(`[单步调试步骤 0${nextIndex + 1}] -> ${activeBlocks[nextIndex].name}`, "info", "running");
      } else {
        setIsRunning(false);
        addLog("✓ [单步离线工艺测试通过]：反馈标定点公差完美。离线控制序列上传至 HUIBO HMI。", "success", "operation");
      }
    }
  };

  const handleResetSimulation = () => {
    setIsRunning(false);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setClickPoints([]);
    addLog("↺ 实训仿真系统复位成功，已规划航路及机械臂空间扫略涂层全部清除。", "info", "operation");
  };

  const handleApplyAISuggestions = (suggestionMsg: string, newAIBlocks: CodeBlock[]) => {
    if (newAIBlocks && newAIBlocks.length > 0) {
      setProcessBlocks(prev => ({
        ...prev,
        [activeProcess]: newAIBlocks
      }));
    }
    addLog("💡 AI建造路径求解器分析成功！已生成高精度离线控制点并应用于当前工艺积木系列。", "success", "operation");
  };

  // Custom Model Importer solver
  const handleImportWorkpiece = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importModelName.trim() || !importFileName.trim()) {
      alert("请填写完整的 3D 模型文件名及物料名称！");
      return;
    }

    const newWp: WorkpieceModel = {
      id: `wp_custom_${Date.now()}`,
      name: `[导入外部] ${importModelName}`,
      fileName: importFileName,
      classification: importClassification,
      sizeDescription: importSize ? `尺寸: ${importSize}` : "尺寸: 800x600x150 mm",
      isCustomImported: true,
      status: "物料数据加载正常"
    };

    setWorkpieces(prev => [newWp, ...prev]);
    setActiveWorkpiece(newWp);
    setIsImportModalOpen(false);

    addLog(`📥 外部 3D 实物模型「${importModelName}」导入成功。已强制注册为分类「${importClassification}」。`, "success", "operation");
    addLog(`💡 [物料属性注册]: 请直接点击三维场景中的物料高亮框，为其规划全新工艺作业轨迹！`, "info", "running");

    // Reset fields
    setImportModelName("");
    setImportFileName("");
    setImportClassification("物料");
    setImportSize("");
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* 1. TOP MAIN HEADER BRANDING */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 flex-shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-lg shadow-lg">
            <Layers className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              智能建造施工机器人实训台虚拟仿真系统
              <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 font-mono px-2 py-0.5 rounded uppercase font-normal">
                教学系统 v3.8 • 汇博机器人
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 tracking-wide font-medium mt-0.5">
              可开展对实训台的虚拟仿真教学和相关技术仿真实训，高保真还原建造工艺流程。
            </p>
          </div>
        </div>

        {/* Realtime Safety Status indicator */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-slate-400 text-[10px]">HMI 联动: NORMAL</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/40 border border-emerald-900/60 rounded text-emerald-400 font-semibold text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>仿真防护网已部署</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN TECHNICAL PROCESSES MODE TABS (钢筋铺设、绑扎、浇筑、刮平、砌墙、地铺、喷涂) */}
      <section className="flex items-center px-6 py-2.5 bg-slate-950 border-b border-slate-800 flex-shrink-0 overflow-x-auto gap-2">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold mr-2 whitespace-nowrap">
          工艺实训模块:
        </span>
        {[
          { id: "rebar_lay", label: "钢筋铺设" },
          { id: "rebar_tie", label: "钢筋绑扎" },
          { id: "concrete_pour", label: "模拟混凝土浇筑" },
          { id: "concrete_flat", label: "模拟混凝土刮平" },
          { id: "brick_lay", label: "砌墙工艺" },
          { id: "tile_lay", label: "地砖铺贴" },
          { id: "spray_wall", label: "墙面喷涂" }
        ].map((proc) => (
          <button
            key={proc.id}
            onClick={() => setActiveProcess(proc.id as ConstructionProcess)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition duration-150 whitespace-nowrap ${
              activeProcess === proc.id
                ? "bg-indigo-600 text-white shadow-md border-b-2 border-indigo-400"
                : "bg-slate-900 hover:bg-slate-850 hover:text-slate-100 border border-slate-800 text-slate-400"
            }`}
          >
            {proc.label}
          </button>
        ))}
      </section>

      {/* 3. CORE COOPERATIVE BENTO BOX WORKSPACE */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6 relative">
        
        {/* COLUMN A: CAD WORKPIECE AND MODEL RESOURCE CENTER (LEFT, Width: 320px) */}
        <aside className="w-[325px] flex flex-col flex-shrink-0 gap-5 bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Database className="w-4.5 h-4.5 text-indigo-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">实物物料与公共器件库</span>
            </div>
            
            {/* Import Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold text-white rounded transition shadow-md"
              title="自行导入外部材料类型，注意分类选择为物料"
            >
              <Upload className="w-3 h-3" />
              <span>导入材料</span>
            </button>
          </div>

          {/* Quick guidance alert */}
          <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg text-[10px] leading-relaxed text-slate-400">
            <p className="font-semibold text-slate-300">💡 拖拽与公共库物料定义说明:</p>
            <p className="mt-1">
              用户可自行导入模型作为被砌筑、喷涂等工艺操作对象。点击库位或导入的物料，即可在其中选择施工作业点/线坐标。
            </p>
          </div>

          {/* Preset Workpieces scroll container */}
          <div className="space-y-2.5 flex-1">
            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 block">物料分类列表 (物料 / Material)</span>
            
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {workpieces.map((wp) => {
                const isSelected = activeWorkpiece?.id === wp.id;
                return (
                  <div
                    key={wp.id}
                    onClick={() => setActiveWorkpiece(wp)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition select-none ${
                      isSelected
                        ? "border-emerald-500 bg-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                        : "border-slate-800/80 hover:border-slate-700 bg-slate-950/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isSelected ? "text-emerald-400" : "text-slate-300"}`}>
                        {wp.name}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      CAD文件: {wp.fileName}
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1.5 border-t border-slate-900 pt-1.5 font-mono">
                      <span>{wp.sizeDescription}</span>
                      <span className="bg-indigo-950/60 text-indigo-400 px-1 py-0.5 rounded border border-indigo-900/40 text-[9px]">
                        分类: {wp.classification}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Display coordinates tracking info of active workpiece */}
          {activeWorkpiece && (
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2 font-mono text-[10px] text-slate-400 mt-auto">
              <span className="text-[10px] font-bold text-slate-300 block border-b border-slate-900 pb-1 uppercase tracking-wider">
                🏷️ 当前物料在台自标定参数
              </span>
              <div className="flex justify-between">
                <span>绑定基轴姿态:</span>
                <span className="text-slate-200">BASE_LINK_0</span>
              </div>
              <div className="flex justify-between">
                <span>仿真网位置 offset:</span>
                <span className="text-slate-200">X: 0.00, Y: 0.88, Z: 0.00</span>
              </div>
              <div className="flex justify-between">
                <span>注册分类属性:</span>
                <span className="text-emerald-400 font-bold bg-emerald-950/40 px-1 rounded">
                  {activeWorkpiece.classification} (物料)
                </span>
              </div>
            </div>
          )}
        </aside>

        {/* COLUMN B: INTEGRATED CAD DIGITAL VIEWPORT & CONSOLE (MIDDLE, FLEXIBLE) */}
        <section className="flex-1 flex flex-col gap-6 overflow-hidden">
          
          {/* Real 3D Canvas Box container */}
          <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden relative shadow-inner">
            <ThreeSimulation
              activeProcess={activeProcess}
              activeWorkpiece={activeWorkpiece}
              isRunning={isRunning}
              isPaused={isPaused}
              currentStep={currentStepIndex + 1}
              playSpeed={playSpeed}
              onTelemetryUpdate={handleTelemetryUpdate}
              clickPoints={clickPoints}
              setClickPoints={setClickPoints}
            />
          </div>

          {/* Console Diagnostics system */}
          <div className="h-[210px] flex-shrink-0">
            <ConsoleLogs
              logs={logs}
              activeCategory={activeLogCategory}
              setActiveCategory={setActiveLogCategory}
              onClearLogs={() => setLogs([])}
              collisionOccurred={false}
            />
          </div>

        </section>

        {/* COLUMN C: LOGIC BLOCKS & CONTROL (RIGHT, Width: 380px) */}
        <aside className="w-[365px] flex flex-col flex-shrink-0 gap-6">
          
          {/* Joint Telemetry readout board */}
          <div className="h-[260px] flex-shrink-0">
            <ParametersPanel
              sceneType={activeProcess === "spray_wall" ? "spray" : "pour"}
              telemetry={telemetry}
            />
          </div>

          {/* Live low-code logic program blocks */}
          <div className="flex-1 min-h-[180px]">
            <BlocksPanel
              sceneType={activeProcess === "spray_wall" ? "spray" : "pour"}
              blocks={activeBlocks}
              currentStepIndex={currentStepIndex}
              isRunning={isRunning}
              isPaused={isPaused}
              onPlay={handlePlaySimulation}
              onPause={() => setIsPaused(!isPaused)}
              onStep={handleStepDebug}
              onReset={handleResetSimulation}
              playSpeed={playSpeed}
              setPlaySpeed={setPlaySpeed}
            />
          </div>

          {/* AI Optimizer planner solver helper */}
          <div className="h-[270px] flex-shrink-0">
            <AIPanel
              sceneType={activeProcess === "spray_wall" ? "spray" : "pour"}
              currentBlocks={activeBlocks}
              onApplyOptimizedBlocks={handleApplyAISuggestions}
            />
          </div>

        </aside>

      </main>

      {/* 4. MODAL COMPONENT: SMART WORKLOAD IMPORTER WIZARD */}
      {isImportModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-md z-50 p-4">
          <div className="w-[450px] bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl relative font-sans">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <Upload className="w-5 h-5 text-indigo-400 animate-pulse" />
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">智能建造模型/物料导入向导</h2>
            </div>

            <form onSubmit={handleImportWorkpiece} className="space-y-4 text-xs font-mono text-slate-300">
              <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-[11px] text-yellow-500 leading-normal mb-1">
                ⚠️ 注意提示: 根据教育部实训系统轨迹规划安全内核，请将「导入的分类」一栏选择为「物料」，以便后台系统能正常在对应的模型表面捕获您的鼠标规划控制点。
              </div>

              {/* Name field */}
              <div className="space-y-1.5">
                <label className="text-slate-400 block font-bold">1. 被砌筑/喷涂实物名称:</label>
                <input
                  type="text"
                  required
                  placeholder="例如: HR-B2 轻质空心加气保温砌块"
                  value={importModelName}
                  onChange={(e) => setImportModelName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {/* CAD Local filename */}
              <div className="space-y-1.5">
                <label className="text-slate-400 block font-bold">2. 指定 CAD 模型源路径文件 (OBJ/STEP/FBX):</label>
                <input
                  type="text"
                  required
                  placeholder="例如: custom_concrete_block_B.step"
                  value={importFileName}
                  onChange={(e) => setImportFileName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Classification dropdown where select classification option as '物料' is MANDATORY */}
              <div className="space-y-1.5">
                <label className="text-slate-400 block font-bold">3. 导入注册分类选择 (Classification Category):</label>
                <select
                  value={importClassification}
                  onChange={(e) => setImportClassification(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 font-mono font-bold text-emerald-400"
                >
                  <option value="物料">物料 (Material / Workpiece) - 激活三维作业表面</option>
                  <option value="夹具">夹具 (Robic Sleeve End-effector)</option>
                  <option value="台面夹具">台面夹具 (Table Fixture Clamping)</option>
                </select>
              </div>

              {/* Spatial Sizes */}
              <div className="space-y-1.5">
                <label className="text-slate-400 block font-bold">4. 物理外包络尺寸 (x/y/z Width):</label>
                <input
                  type="text"
                  placeholder="例如: 240x115x90 mm"
                  value={importSize}
                  onChange={(e) => setImportSize(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Actions submit details */}
              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4 mt-5">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded transition shadow-md"
                >
                  确认导入注册
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
