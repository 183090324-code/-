import React from "react";
import { CodeBlock } from "../types";
import { Play, Pause, ChevronRight, RotateCcw, Box } from "lucide-react";

interface BlocksPanelProps {
  sceneType: "spray" | "pour";
  blocks: CodeBlock[];
  currentStepIndex: number;
  isRunning: boolean;
  isPaused: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  playSpeed: number;
  setPlaySpeed: (speed: number) => void;
}

export const BlocksPanel: React.FC<BlocksPanelProps> = ({
  sceneType,
  blocks,
  currentStepIndex,
  isRunning,
  isPaused,
  onPlay,
  onPause,
  onStep,
  onReset,
  playSpeed,
  setPlaySpeed,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans">
      {/* Header controls pane */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Box className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200">离线积木编程区</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded border border-slate-800 text-[10px] text-slate-400">
          <span>低代码仿真控制</span>
        </div>
      </div>

      {/* Operation Toolbar buttons */}
      <div className="flex items-center gap-2 p-3 bg-slate-950/40 border-b border-slate-800/60">
        <button
          onClick={onPlay}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium transition ${
            isRunning && !isPaused
              ? "bg-indigo-600 hover:bg-indigo-700 text-white"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          {isRunning && !isPaused ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>暂停</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>程序运行</span>
            </>
          )}
        </button>

        <button
          onClick={onStep}
          disabled={isRunning && !isPaused}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded text-xs font-medium transition"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          <span>单步调试</span>
        </button>

        <button
          onClick={onReset}
          className="flex items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition"
          title="重置仿真"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Playback speed dial */}
        <div className="flex items-center gap-1 ml-auto border border-slate-800 rounded bg-slate-950 px-1.5 py-1">
          <span className="text-[10px] text-slate-500 font-mono">速度:</span>
          <select
            value={playSpeed}
            onChange={(e) => setPlaySpeed(parseFloat(e.target.value))}
            className="bg-transparent text-[10px] text-slate-300 font-mono border-none focus:outline-none cursor-pointer"
          >
            <option value="0.5">0.5x</option>
            <option value="1.0">1.0x</option>
            <option value="2.0">2.0x</option>
            <option value="4.0">4.0x</option>
          </select>
        </div>
      </div>

      {/* Visual Block list area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-900/40 pattern-grid">
        {blocks.map((block, index) => {
          const isActive = isRunning && currentStepIndex === index;
          return (
            <div
              key={block.id}
              className={`relative flex items-center gap-3.5 p-3 rounded-lg border text-sm font-mono font-medium select-none transform transition duration-200 ${
                isActive
                  ? "ring-2 ring-emerald-500 border-emerald-400 bg-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.15)] scale-[1.02]"
                  : "border-slate-800/80 hover:border-slate-700 bg-slate-950/60"
              }`}
              style={{ paddingLeft: block.type === "control" ? "2rem" : "1rem" }}
            >
              {/* Highlight flash dot when active */}
              {isActive && (
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-10 bg-emerald-500 rounded-r" />
              )}

              {/* Categoric structural icon puzzle connector */}
              <div
                className="w-3.5 h-7 rounded-sm flex-shrink-0"
                style={{ backgroundColor: block.color }}
              />

              <div className="flex-1 flex flex-col min-w-0">
                <span className="text-slate-200 truncate">{block.name}</span>
                {block.description && (
                  <span className="text-[10px] text-slate-500 font-sans mt-0.5 mt-0.5 truncate uppercase">
                    {block.description}
                  </span>
                )}
              </div>

              {/* Step indicator tag */}
              <div className="text-[10px] text-slate-600 font-mono self-end">
                STEP_0{index + 1}
              </div>
            </div>
          );
        })}

        {blocks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <span className="text-slate-500 text-xs font-mono">暂无下达算法积木</span>
            <span className="text-slate-600 text-[10px] mt-1">请使用AI规划器或重置程序路径</span>
          </div>
        )}
      </div>

      {/* Quick sidebar category dictionary tags */}
      <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span>事件类</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>控制类</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <span>运动类</span>
        </div>
      </div>
    </div>
  );
};
