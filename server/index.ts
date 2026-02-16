/**
 * 祝福视频批量生成器 — 服务端入口
 *
 * 架构：
 *   server/index.ts          — Express 启动 + 中间件
 *   server/config.ts         — 常量 & 路径
 *   server/types.ts          — 共享类型
 *   server/schemas/batch.ts  — Zod API 验证
 *   server/stores/jobStore.ts— JobStore 抽象（内存 / Redis）
 *   server/providers/        — TTS / LLM Provider 抽象
 *   server/services/         — 媒体处理 & 批量渲染逻辑
 *   server/routes/batch.ts   — API 路由
 */

import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";

import {
  PORT,
  PUBLIC_DIR,
  UPLOADS_DIR,
  OUTPUT_DIR,
  TEMP_DIR,
  JOB_EXPIRY_MS,
  JOB_CLEANUP_INTERVAL_MS,
} from "./config";
import { InMemoryJobStore } from "./stores/jobStore";
import { NoizTTSProvider } from "./providers/ttsProvider";
import { GeminiLLMProvider } from "./providers/llmProvider";
import { registerBatchRoutes } from "./routes/batch";
import { isLLMConfigured } from "./narration";

// ==================== 初始化依赖 ====================

const jobStore = new InMemoryJobStore();
const ttsProvider = new NoizTTSProvider();
const llmProvider = new GeminiLLMProvider();

// ==================== 定期清理过期任务 ====================

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobStore.entries()) {
    if (now - job.createdAt > JOB_EXPIRY_MS) {
      if (job.extractedAudioPath) {
        try { fs.unlinkSync(job.extractedAudioPath); } catch {}
      }
      if (job.dedicatedAudioPath) {
        try { fs.unlinkSync(job.dedicatedAudioPath); } catch {}
      }
      if (job.voiceId) {
        ttsProvider.deleteVoice(job.voiceId).catch(() => {});
      }
      jobStore.delete(id);
    }
  }
}, JOB_CLEANUP_INTERVAL_MS);

// ==================== 确保目录存在 ====================

[PUBLIC_DIR, UPLOADS_DIR, OUTPUT_DIR, TEMP_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==================== Express App ====================

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/output", express.static(OUTPUT_DIR));

// ==================== 注册路由 ====================

registerBatchRoutes(app, jobStore, ttsProvider, llmProvider);

// ==================== 全局错误处理 ====================

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("⚠️ 请求处理错误:", {
      path: req.path,
      method: req.method,
      error: err.message || err,
      stack: err.stack?.split("\n").slice(0, 3).join("\n"),
    });

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "视频文件超过 50MB 上限" });
    }
    if (err.message === "只支持视频文件") {
      return res.status(400).json({ error: "只支持视频文件格式" });
    }
    if (err.message === "只支持音频文件") {
      return res.status(400).json({ error: "只支持音频文件格式" });
    }

    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error: err.message || "服务器内部错误",
    });
  }
);

// ==================== 启动服务器 ====================

app.listen(PORT, () => {
  console.log(`🧧 祝福视频批量生成器已启动`);
  console.log(`🌐 打开 http://localhost:${PORT}`);
  console.log(`🤖 LLM: ${isLLMConfigured() ? "✅ Gemini 已配置" : "❌ 未配置 (设置 GEMINI_API_KEY 启用 AI 文案)"}`);
  console.log(`🎙️ TTS: ${ttsProvider.isConfigured() ? "✅ Noiz TTS 已配置（动态声音克隆）" : "❌ 未配置 (设置 NOIZ_API_KEY 启用语音克隆)"}`);
  console.log(`💾 存储: ${jobStore.constructor.name}`);
  console.log(`⚠️ 注意: 本服务使用内存存储任务状态，请确保部署为单实例 (--max-instances=1)`);
});
