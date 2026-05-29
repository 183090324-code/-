import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini safely to avoid crashing on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return aiClient;
}

// AI Planner and Kinematics optimizer endpoint
app.post("/api/ai/planner", async (req, res) => {
  const { prompt, sceneType, currentBlocks } = req.body;
  
  try {
    const client = getGeminiClient();
    if (!client) {
      // Graceful fallback with high-fidelity industrial mock instructions if key is absent
      return res.json({
        success: true,
        mocked: true,
        suggestion: `[离线仿真调试优化报告]\n优化建议：在${sceneType === "spray" ? "墙面均匀喷涂工艺" : "双机混凝土防碰撞浇筑"}作业中，建议微调机械臂末端J4关节位角姿态(+12°)，提高刚度响应。\n已为您生成针对此方案的低代码运动序列。`,
        codeBlocks: sceneType === "spray" 
          ? [
              { id: "evt_1", type: "event", name: "当程序运行", color: "#3B82F6" },
              { id: "chassis_1", type: "action", name: "锁定移动AGV底盘 (X:0.0, Y:0.0, Z:0.0)", color: "#10B981" },
              { id: "path_1", type: "action", name: "执行智能扫略轨迹 (J1-J6 丝滑拟合)", color: "#8B5CF6" },
              { id: "spray_on", type: "action", name: "开启双喷头喷枪 (压力:3.2MPa)", color: "#F59E0B" },
              { id: "move_loop", type: "motion", name: "末端顺滑扫抹墙面 (重叠率35%)", color: "#EC4899" },
              { id: "spray_off", type: "action", name: "关闭双喷头喷枪", color: "#EF4444" }
            ]
          : [
              { id: "evt_2", type: "event", name: "单步调试: 启动浇筑程序", color: "#3B82F6" },
              { id: "left_clamp", type: "motion", name: "左机械臂：抓持并稳固浇筑盒边缘", color: "#10B981" },
              { id: "right_safe", type: "motion", name: "右机械臂 (轴偏移x:+15cm)：路径J4防碰避让", color: "#8B5CF6" },
              { id: "pour_open", type: "action", name: "开启出料口 (流速: 4.5 L/s)", color: "#F59E0B" },
              { id: "pour_step", type: "motion", name: "同步浇筑 (高格栅地基浇筑盒)", color: "#EC4899" }
            ]
      });
    }

    const systemInstruction = 
      "You are a stellar industrial simulation and offline programming advisor for Dual-Arm cooperative and AGV-tracked heavy construction robots.\n" +
      "The user asks questions or provides optimization requests about simulation scene: " + (sceneType === "spray" ? "Wall Spraying Simulation" : "Concrete Pouring Simulation") + ".\n" +
      "Help optimize their joint movements, coordinate vectors (X, Y, Z), joint angles (J1-J6) and code-block sequences.\n" +
      "Keep responses highly professional, structural, using high-end engineering terminology. " +
      "You MUST return a JSON object with the following fields:\n" +
      "{ \"suggestion\": \"analytical review of the kinematics & path details\", \"codeBlocks\": [ { \"id\": \"string\", \"type\": \"event|motion|action\", \"name\": \"human-readable instruction string matching their intent\", \"color\": \"tailwind color hex like #3B82F6\" } ] }";

    const contentPrompt = `User request: "${prompt}". Currently configured blocks: ${JSON.stringify(currentBlocks)}. Optimize or fix this program path and return the structured JSON strictly containing suggestions and codeBlocks.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contentPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const textResult = response.text || "{}";
    const parsedData = JSON.parse(textResult.trim());
    
    res.json({
      success: true,
      suggestion: parsedData.suggestion || "路径配置已成功优化。",
      codeBlocks: parsedData.codeBlocks || []
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Setup Vite middleware & boot server
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const viteServer = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteServer.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to 0.0.0.0 and port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[TwinBuild WS] Industrial Simulator listening on port ${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error("Failed to start TwinBuild Server:", err);
});
