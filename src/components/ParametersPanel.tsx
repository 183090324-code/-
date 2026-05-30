import React, { useEffect, useState } from "react";
import * as THREE from "three";
import { TelemetryData, ConstructionProcess } from "../types";
import { Activity, Compass, Cpu, Zap } from "lucide-react";

interface ParametersPanelProps {
  activeProcess: ConstructionProcess;
  sceneType: "spray" | "pour";
  telemetry: TelemetryData;
  clickPoints: THREE.Vector3[];
  setClickPoints: React.Dispatch<React.SetStateAction<THREE.Vector3[]>>;
}

export const ParametersPanel: React.FC<ParametersPanelProps> = ({
  activeProcess,
  sceneType,
  telemetry,
  clickPoints,
  setClickPoints,
}) => {
  // Input fields for coordinates custom planner
  const [posX, setPosX] = useState<string>("0.10");
  const [posY, setPosY] = useState<string>("0.98");
  const [posZ, setPosZ] = useState<string>("-0.10");

  // Automatically update input presets according to active process
  useEffect(() => {
    switch (activeProcess) {
      case "rebar_lay":
      case "rebar_tie":
        setPosX("0.10");
        setPosY("0.98");
        setPosZ("-0.10");
        break;
      case "concrete_pour":
      case "concrete_flat":
        setPosX("0.05");
        setPosY("0.93");
        setPosZ("-0.05");
        break;
      case "brick_lay":
        setPosX("0.10");
        setPosY("0.90");
        setPosZ("-0.08");
        break;
      case "tile_lay":
        setPosX("0.10");
        setPosY("0.91");
        setPosZ("-0.05");
        break;
      case "spray_wall":
        setPosX("0.10");
        setPosY("1.10");
        setPosZ("-0.15");
        break;
      default:
        setPosX("0.10");
        setPosY("0.98");
        setPosZ("-0.10");
    }
  }, [activeProcess]);

  const handleAddNode = () => {
    const x = parseFloat(posX);
    const y = parseFloat(posY);
    const z = parseFloat(posZ);
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      alert("请输入有效的x, y, z坐标参数！");
      return;
    }

    if (clickPoints.length >= 5) {
      alert("智能建造算法最多支持规划5个核心控制节点！");
      return;
    }

    const newPt = new THREE.Vector3(x, y, z);
    setClickPoints((prev) => [...prev, newPt]);
  };

  const handleClearNodes = () => {
    setClickPoints([]);
  };

  // Add slight dynamic flickering noise to power and pressure readings to resemble real physical system
  const [flickeredTelemetry, setFlickeredTelemetry] = useState<TelemetryData>(telemetry);

  useEffect(() => {
    setFlickeredTelemetry(telemetry);
  }, [telemetry]);

  // Periodic subtle signal noise
  useEffect(() => {
    const timer = setInterval(() => {
      setFlickeredTelemetry((prev) => {
        if (prev.powerConsumption <= 1.5) return prev; // idle is steady
        const noisePower = (Math.random() - 0.5) * 0.15;
        const noisePressure = (Math.random() - 0.5) * 0.08;
        return {
          ...prev,
          powerConsumption: parseFloat((prev.powerConsumption + noisePower).toFixed(1)),
          sprayPressure: parseFloat((prev.sprayPressure + noisePressure).toFixed(1)),
        };
      });
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans">
      {/* Box Panel Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-950 border-b border-slate-800">
        <Activity className="w-5 h-5 text-indigo-400" />
        <span className="text-sm font-semibold text-slate-200">工程工艺参数面板</span>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-5">
        
        {/* SECTION 1: Base/Chassis Spatial tracker */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono font-medium tracking-wider uppercase">
            <Compass className="w-4 h-4 text-slate-400" />
            <span>底盘空间信息 (AGV Base)</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded font-mono">
              <span className="text-[10px] text-slate-500 block">X 坐标定位</span>
              <span className="text-base text-slate-200 font-bold transition">
                {flickeredTelemetry.chassisX.toFixed(2)} <span className="text-xs text-slate-500">m</span>
              </span>
            </div>
            <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded font-mono">
              <span className="text-[10px] text-slate-500 block">Y 坐标定位</span>
              <span className="text-base text-slate-200 font-bold transition">
                {flickeredTelemetry.chassisY.toFixed(2)} <span className="text-xs text-slate-500">m</span>
              </span>
            </div>
            <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded font-mono">
              <span className="text-[10px] text-slate-500 block">Z 坐标位移</span>
              <span className="text-base text-slate-200 font-bold transition">
                {flickeredTelemetry.chassisZ.toFixed(2)} <span className="text-xs text-slate-500">m</span>
              </span>
            </div>
            <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded font-mono">
              <span className="text-[10px] text-slate-500 block">航向角 Yaw</span>
              <span className="text-base text-slate-200 font-bold transition">
                {flickeredTelemetry.chassisYaw}°
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Dynamic Process parameters based on modes */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono font-medium tracking-wider uppercase">
            <Zap className="w-4 h-4 text-slate-400" />
            <span>{sceneType === "spray" ? "喷涂工艺信息" : "浇筑工艺信息"}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {sceneType === "spray" ? (
              <>
                <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded font-mono">
                  <span className="text-[10px] text-slate-500 block">喷涂距离</span>
                  <span className="text-base text-slate-200 font-bold">
                    {flickeredTelemetry.sprayDistance > 0 ? `${flickeredTelemetry.sprayDistance} m` : "离线置零"}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded font-mono">
                  <span className="text-[10px] text-slate-500 block">喷涂宽度</span>
                  <span className="text-base text-slate-200 font-bold">
                    {flickeredTelemetry.sprayWidth > 0 ? `${flickeredTelemetry.sprayWidth} mm` : "离线置零"}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded font-mono">
                  <span className="text-[10px] text-slate-500 block">喷嘴强度/压力</span>
                  <span className="text-base text-slate-200 font-bold text-cyan-400">
                    {flickeredTelemetry.sprayPressure > 0 ? `${flickeredTelemetry.sprayPressure} MPa` : "0.0 MPa"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded font-mono">
                  <span className="text-[10px] text-slate-500 block">格栅浇筑盒容量</span>
                  <span className="text-base text-slate-200 font-bold">
                    120.0 L
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded font-mono">
                  <span className="text-[10px] text-slate-500 block">格栅网配筋率</span>
                  <span className="text-base text-slate-200 font-bold">
                    1.42 %
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded font-mono">
                  <span className="text-[10px] text-slate-500 block">浆料输送压力</span>
                  <span className="text-base text-slate-200 font-bold text-amber-500">
                    {flickeredTelemetry.sprayPressure > 0 ? `${flickeredTelemetry.sprayPressure} MPa` : "0.0 MPa"}
                  </span>
                </div>
              </>
            )}

            <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded font-mono">
              <span className="text-[10px] text-slate-500 block">系统功耗 kW</span>
              <span className="text-base text-slate-200 font-bold text-emerald-400">
                {flickeredTelemetry.powerConsumption} kW
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 3: Robot Joint angles representation (J1 to J6) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono font-medium tracking-wider uppercase">
            <Cpu className="w-4 h-4 text-slate-400" />
            <span>机械臂关节角度状态 (J1 - J6)</span>
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-3.5">
            {[
              { label: "J1 轴旋转 (Base)", val: telemetry.jointsJ1, max: 180 },
              { label: "J2 臂俯仰 (Shoulder)", val: telemetry.jointsJ2, max: 150 },
              { label: "J3 肘俯仰 (Elbow)", val: telemetry.jointsJ3, max: 150 },
              { label: "J4 腕回转 (Forearm)", val: telemetry.jointsJ4, max: 360 },
              { label: "J5 腕摆动 (Wrist)", val: telemetry.jointsJ5, max: 120 },
              { label: "J6 喷爪偏航 (End Joint)", val: telemetry.jointsJ6, max: 360 },
            ].map((j, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 font-medium">{j.label}</span>
                  <span className="text-slate-300 font-bold">{j.val}°</span>
                </div>
                
                {/* Micro engineering bar */}
                <div className="relative w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.min(
                        Math.max(((Math.abs(j.val) + (j.max * 0.1)) / j.max) * 100, 5),
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4: Paint layer thickness (Only for Spraying) */}
        {sceneType === "spray" && (
          <div className="p-3 bg-slate-950/40 border border-indigo-900/40 rounded-lg space-y-2.5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400">墙面涂料覆盖进度</span>
              <span className="text-cyan-400 font-bold">{telemetry.paintCoverage}%</span>
            </div>
            
            {/* Visual circle percentage */}
            <div className="relative w-full h-2 bg-slate-905 overflow-hidden rounded bg-slate-850">
              <div
                className="absolute top-0 left-0 h-full bg-cyan-500 rounded transition-all duration-300"
                style={{ width: `${telemetry.paintCoverage}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-xs font-mono border-t border-slate-800/80 pt-2">
              <span className="text-slate-500 text-[10px]">工艺厚度规范: 0.15 - 0.20 mm</span>
              <span className="text-slate-300 font-bold">
                当前: {telemetry.paintThickness.toFixed(2)} mm
              </span>
            </div>
          </div>
        )}

        {/* SECTION 5: CUSTOM COORDINATES INPUT (作业节点自定义规划) */}
        <div className="space-y-3 border-t border-slate-800 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-indigo-400 font-mono font-medium tracking-wider uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span>工艺轨迹节点规划 (x, y, z Coordinates)</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
              节点数: <span className="text-indigo-400 font-bold">{clickPoints.length} / 5</span>
            </span>
          </div>

          {/* Guidelines details */}
          <div className="text-[9px] text-slate-500 font-sans leading-relaxed">
            坐标范围建议: X[-0.4,0.4], Y[0.88,1.25], Z[-0.4,0.4] (Y为高度)
          </div>

          {/* Coordinate Inputs Form */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-950 border border-slate-800 rounded px-2 py-1 flex items-center gap-1">
              <span className="text-[10px] text-slate-500 font-mono">X:</span>
              <input
                type="number"
                step="0.01"
                min="-0.8"
                max="0.8"
                value={posX}
                onChange={(e) => setPosX(e.target.value)}
                className="bg-transparent w-full font-mono text-xs text-slate-200 border-none outline-none p-0 focus:ring-0 focus:outline-none"
              />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded px-2 py-1 flex items-center gap-1">
              <span className="text-[10px] text-slate-500 font-mono">Y:</span>
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="1.6"
                value={posY}
                onChange={(e) => setPosY(e.target.value)}
                className="bg-transparent w-full font-mono text-xs text-slate-200 border-none outline-none p-0 focus:ring-0 focus:outline-none"
              />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded px-2 py-1 flex items-center gap-1">
              <span className="text-[10px] text-slate-500 font-mono">Z:</span>
              <input
                type="number"
                step="0.01"
                min="-0.8"
                max="0.8"
                value={posZ}
                onChange={(e) => setPosZ(e.target.value)}
                className="bg-transparent w-full font-mono text-xs text-slate-200 border-none outline-none p-0 focus:ring-0 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddNode}
              className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>+ 添加节点</span>
            </button>
            <button
              onClick={handleClearNodes}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs rounded transition cursor-pointer"
              title="清空所有坐标节点"
            >
              清空
            </button>
          </div>

          {/* List of current nodes coordinates, interactive delete */}
          {clickPoints.length > 0 && (
            <div className="max-h-[110px] overflow-y-auto border border-slate-800/80 bg-slate-950/40 rounded p-1 space-y-1">
              {clickPoints.map((pt, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] font-mono bg-slate-950 px-2 py-1 border border-slate-850 rounded">
                  <span className="text-indigo-400 font-bold">P{idx + 1}</span>
                  <span className="text-slate-400">
                    X:{pt.x.toFixed(2)} Y:{pt.y.toFixed(2)} Z:{pt.z.toFixed(2)}
                  </span>
                  <button
                    onClick={() => {
                      setClickPoints((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    className="text-red-500 hover:text-red-400 cursor-pointer font-bold px-1"
                    title="删除该节点"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
