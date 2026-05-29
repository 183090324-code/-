/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CodeBlock {
  id: string;
  type: "event" | "motion" | "action" | "control";
  name: string;
  color: string;
  description?: string;
}

export type ConstructionProcess =
  | "rebar_lay"      // 钢筋铺设
  | "rebar_tie"      // 钢筋绑扎
  | "concrete_pour"  // 模拟混凝土浇筑
  | "concrete_flat"  // 模拟混凝土刮平
  | "brick_lay"      // 砌墙
  | "tile_lay"       // 地砖铺贴
  | "spray_wall";    // 墙面喷涂

export interface WorkpieceModel {
  id: string;
  name: string;
  fileName: string;
  classification: "物料" | "夹具" | "台面夹具"; // "物料" must be present according to user instructions
  sizeDescription: string;
  isCustomImported?: boolean;
  status?: string;
}

export interface TelemetryData {
  // Desktop/Chassis spatial information
  chassisX: number;
  chassisY: number;
  chassisZ: number;
  chassisYaw: number;
  
  // Custom process parameters
  sprayDistance: number;    
  sprayWidth: number;       
  sprayPressure: number;    // MPa / Flow Bar / Clamp force
  powerConsumption: number; // kW

  // Robot joint angles (degrees)
  jointsJ1: number;
  jointsJ2: number;
  jointsJ3: number;
  jointsJ4: number;
  jointsJ5: number;
  jointsJ6: number;

  // Layer thickness details
  paintCoverage: number;    // percentage %
  paintThickness: number;   // mm
}

export interface LogMessage {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warn" | "error";
  message: string;
  category: "operation" | "running" | "error";
}
