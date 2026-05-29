import React, { useState } from "react";
import { CodeBlock } from "../types";
import { Sparkles, Terminal, ArrowRight, CornerDownLeft, Loader2, Info } from "lucide-react";

interface AIPanelProps {
  sceneType: "spray" | "pour";
  currentBlocks: CodeBlock[];
  onApplyOptimizedBlocks: (suggestions: string, blocks: CodeBlock[]) => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({
  sceneType,
  currentBlocks,
  onApplyOptimizedBlocks,
}) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [errorStr, setErrorStr] = useState<string | null>(null);

  // Suggested quick industrial queries
  const examples = sceneType === "spray" 
    ? [
        "优化喷涂工艺：调大强度，均匀覆盖",
        "添加末端扫描校验并重置起始底盘位角",
      ]
    : [
        "J4避障碍偏移：增大向外偏置15cm防碰撞",
        "增加浇筑速度并稳定左侧机械锁死夹",
      ];

  const handleAISubmit = async (selectedPrompt?: string) => {
    const finalPrompt = selectedPrompt || prompt;
    if (!finalPrompt.trim()) return;

    setLoading(true);
    setSuggestion(null);
    setErrorStr(null);

    try {
      const response = await fetch("/api/ai/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          sceneType,
          currentBlocks,
        }),
      });

      if (!response.ok) {
        throw new Error("模型响应失败，请重试");
      }

      const data = await response.json();
      if (data.success) {
        setSuggestion(data.suggestion);
        // Dispatch callback to parent to feed state back to application blocks!
        onApplyOptimizedBlocks(data.suggestion, data.codeBlocks);
      } else {
        throw new Error(data.error || "发生了未知异常");
      }

    } catch (err: any) {
      console.error(err);
      setErrorStr(err.message || "请求服务器失败，请检查连接");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans">
      
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-950 border-b border-slate-800 flex-shrink-0">
        <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
        <span className="text-sm font-semibold text-slate-205 text-slate-200">
          AI 联动轨迹规划与离线求解辅助
        </span>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        
        {/* Intro description block */}
        <div className="flex gap-2.5 p-3.5 bg-slate-950/40 border border-slate-800 rounded-lg text-xs leading-relaxed text-slate-400">
          <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-slate-300">工业级离线编程求解器:</span>
            <p>
              您可以采用自然语言控制建筑机器人进行空间姿态平移动作、参数修改。模型将自动优化反向运动学解并直接重整低代码。
            </p>
          </div>
        </div>

        {/* Suggest Examples */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono block">推荐工程优化指令</span>
          <div className="flex flex-col gap-1.5">
            {examples.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setPrompt(ex);
                  handleAISubmit(ex);
                }}
                disabled={loading}
                className="w-full text-left p-2.5 bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/60 transition rounded text-xs text-slate-300 flex items-center justify-between group disabled:opacity-50"
              >
                <span className="truncate">{ex}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition shrink-0 ml-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Suggested Result view */}
        {suggestion && (
          <div className="p-3.5 bg-indigo-950/15 border border-indigo-900/40 rounded-lg space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono font-bold uppercase">
              <Terminal className="w-3.5 h-3.5" />
              <span>求解引擎分析决策报告</span>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
              {suggestion}
            </div>
            <div className="text-[10px] text-emerald-400 font-mono">
              ✓ 工艺积木块参数已自动调整并应用于当前路径。
            </div>
          </div>
        )}

        {/* Error reporting */}
        {errorStr && (
          <div className="p-3 bg-red-950/20 border border-red-900/40 rounded text-xs text-red-400 font-mono">
            ⚠️ 协同端异常: {errorStr}
          </div>
        )}

      </div>

      {/* Input query form */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex-shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAISubmit();
          }}
          className="relative flex items-center bg-slate-900 border border-slate-700/80 rounded focus-within:border-indigo-500 transition"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            placeholder="下达离线优化与碰撞规避命令..."
            className="w-full bg-transparent px-3.5 py-2.5 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:ring-0 pr-10"
          />
          
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="absolute right-1.5 p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            ) : (
              <CornerDownLeft className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

    </div>
  );
};
