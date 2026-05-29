import React, { useState, useEffect, useRef } from "react";
import { LogMessage } from "../types";
import { Terminal, ShieldAlert, CheckCircle, FileText, Trash2, ShieldCheck } from "lucide-react";

interface ConsoleLogsProps {
  logs: LogMessage[];
  activeCategory: "operation" | "running" | "error";
  setActiveCategory: (category: "operation" | "running" | "error") => void;
  onClearLogs: () => void;
  collisionOccurred: boolean;
}

export const ConsoleLogs: React.FC<ConsoleLogsProps> = ({
  logs,
  activeCategory,
  setActiveCategory,
  onClearLogs,
  collisionOccurred,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs as they come in.
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, activeCategory]);

  // Filter messages mapping
  const filteredLogs = logs.filter((log) => log.category === activeCategory);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans">
      
      {/* Console Tab headers & Controls */}
      <div className="flex items-center justify-between px-4 bg-slate-950 border-b border-slate-800 flex-shrink-0">
        
        {/* TAB BUTTONS */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5 pr-3 py-3 border-r border-slate-800 text-slate-400">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold">日志诊断台</span>
          </div>

          {[
            { id: "operation", label: "操作日志", icon: FileText },
            { id: "running", label: "运行日志", icon: Terminal },
            { id: "error", label: "错误日志", icon: ShieldAlert, alert: collisionOccurred },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as any)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition relative ${
                  isActive
                    ? tab.id === "error" && collisionOccurred
                      ? "text-red-500 border-red-500 bg-red-950/20"
                      : "text-indigo-400 border-indigo-500 bg-slate-900"
                    : "text-slate-400 border-transparent hover:text-slate-300 hover:bg-slate-900/40"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive && tab.id === "error" && collisionOccurred ? "text-red-500 animate-pulse" : ""}`} />
                <span>{tab.label}</span>

                {/* Pulsing red alarm badge on collision triggers */}
                {tab.alert && (
                  <span className="absolute top-1 right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Action button bar */}
        <div className="flex items-center gap-2">
          {collisionOccurred && activeCategory === "error" && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-950/50 border border-red-800/80 rounded text-[10px] text-red-400 uppercase font-mono animate-pulse">
              <ShieldAlert className="w-3 h-3" />
              <span>5级最高碰撞防护锁</span>
            </div>
          )}

          {!collisionOccurred && (
            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-950/40 border border-emerald-900/60 rounded text-[10px] text-emerald-400 font-mono">
              <ShieldCheck className="w-3 h-3" />
              <span>防护正常</span>
            </div>
          )}

          <button
            onClick={onClearLogs}
            className="p-1 px-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition text-xs flex items-center gap-1 font-mono"
            title="清空日志类别"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>CLR</span>
          </button>
        </div>

      </div>

      {/* Terminal View area */}
      <div
        ref={containerRef}
        className="flex-1 p-4 overflow-y-auto bg-slate-950/80 font-mono text-[11px] leading-relaxed space-y-2 select-text scroll-smooth"
      >
        {filteredLogs.map((log) => {
          // Check for collision specific text line
          const isErrorCollision = log.message.includes("ERROR:") || log.message.includes("5级");
          
          return (
            <div
              key={log.id}
              className={`flex items-start gap-2 py-0.5 border-b border-slate-900/60 font-mono ${
                isErrorCollision
                  ? "text-red-500 bg-red-950/15 py-1 px-1.5 rounded border-l-2 border-l-red-500 font-bold"
                  : log.type === "success"
                  ? "text-emerald-400"
                  : log.type === "warn"
                  ? "text-yellow-500 font-bold"
                  : "text-slate-300"
              }`}
            >
              <span className="text-slate-600 select-none">[{log.timestamp}]</span>
              <span className="flex-1 whitespace-pre-wrap">{log.message}</span>
            </div>
          );
        })}

        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <span className="text-slate-605 text-[10px] text-slate-600 font-mono">
              -- SYSTEM IDLE / NO LOG ENTRIES AT CURRENT TAB --
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
