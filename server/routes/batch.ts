/**
 * 批量视频生成 API 路由
 */

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { UPLOADS_DIR, OUTPUT_DIR, TEMP_DIR, PUBLIC_DIR, ZIP_TIMEOUT_MS, MAX_FILE_SIZE } from "../config";
import type { BatchJob, BatchItem, ValidatedBatchInput, FestivalType, Recipient, GeneratedNarration } from "../types";
import type { JobStore } from "../stores/jobStore";
import type { TTSProvider } from "../providers/ttsProvider";
import type { LLMProvider } from "../providers/llmProvider";
import { batchRequestSchema, batchConfirmSchema } from "../schemas/batch";
import { themes, validThemes } from "../../src/themes";
import { validFestivals } from "../../src/festivals";
import { asyncHandler, generateId, convertToWav } from "../utils";
import { generateNarration, isLLMConfigured } from "../narration";
import { extractAudioFromVideo } from "../services/mediaService";
import { processBatchJob } from "../services/batchProcessor";

const execFileAsync = promisify(execFile);

// ==================== Multer 配置 ====================

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname === "audio" ? "audio" : "video";
    const name = `${prefix}_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "audio") {
      const allowedAudioExts = [".wav", ".mp3", ".m4a", ".ogg", ".webm", ".aac", ".flac", ".wma"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (file.mimetype.startsWith("audio/") || allowedAudioExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error("只支持音频文件"));
      }
    } else {
      const allowedVideoExts = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv", ".m4v", ".mpeg", ".mpg"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (file.mimetype.startsWith("video/") || allowedVideoExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error("只支持视频文件"));
      }
    }
  },
});

const uploadFields = upload.fields([
  { name: "video", maxCount: 1 },
  { name: "audio", maxCount: 1 },
]);

// ==================== 请求验证 ====================

function validateBatchRequest(
  req: express.Request
): ValidatedBatchInput | { error: string; status: number } {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const videoFile = files?.video?.[0] || (req as any).file;
  const audioFile = files?.audio?.[0];

  if (!videoFile) {
    return { error: "请上传祝福视频", status: 400 };
  }

  // 使用 zod schema 验证
  const result = batchRequestSchema.safeParse({
    senderName: req.body.senderName,
    recipients: req.body.recipients,
    festival: req.body.festival,
  });

  if (!result.success) {
    const firstError = result.error.errors[0];
    return { error: firstError.message, status: 400 };
  }

  const { senderName, recipients, festival } = result.data;

  return {
    senderName,
    recipients: recipients as Recipient[],
    festival: (festival || "spring") as FestivalType,
    videoFile: `uploads/${videoFile.filename}`,
    audioFile: audioFile ? `uploads/${audioFile.filename}` : undefined,
    batchId: generateId("batch"),
  };
}

function isValidationError(
  result: ValidatedBatchInput | { error: string; status: number }
): result is { error: string; status: number } {
  return "error" in result;
}

// ==================== 批量任务创建 ====================

async function createBatchJob(
  validated: ValidatedBatchInput,
  previewOnly: boolean,
  jobStore: JobStore,
  ttsProvider: TTSProvider,
  llmProvider: LLMProvider
): Promise<{ batchId: string; total: number; items?: any[] }> {
  const { senderName, recipients, festival, videoFile, audioFile, batchId } = validated;

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `🧧 ${previewOnly ? "台词预览任务" : "批量渲染任务"}: ${batchId} (${festival})`
  );
  console.log(`   发送者: ${senderName}`);
  console.log(`   视频: ${videoFile}`);
  console.log(`   专用音频: ${audioFile ? `✅ ${audioFile}` : "❌ (将从视频提取)"}`);
  console.log(`   LLM: ${llmProvider.isConfigured() ? "✅" : "❌ (模板模式)"}`);
  console.log(`   TTS: ${ttsProvider.isConfigured() ? "✅" : "❌"}`);
  console.log(`   收信人数量: ${recipients.length}`);
  if (!previewOnly) {
    recipients.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.name} (${r.relation}) ${r.background ? `- ${r.background}` : ""}`);
    });
  }
  console.log(`${"=".repeat(60)}\n`);

  if (previewOnly) {
    const videoAbsPath = path.join(PUBLIC_DIR, videoFile);
    const dedicatedAudioAbsPath = audioFile ? path.join(PUBLIC_DIR, audioFile) : undefined;

    let previewAudioPath: string | undefined;
    let dedicatedAudioWavPath: string | undefined;
    const needAudio = llmProvider.isConfigured() || ttsProvider.isConfigured();

    if (dedicatedAudioAbsPath && needAudio) {
      console.log("🎙️ 用户提供了专用声音样本，正在转换...");
      const wavPath = path.join(TEMP_DIR, `dedicated_audio_${batchId}.wav`);
      const success = await convertToWav(dedicatedAudioAbsPath, wavPath);
      if (success && fs.existsSync(wavPath) && fs.statSync(wavPath).size > 0) {
        dedicatedAudioWavPath = wavPath;
        previewAudioPath = wavPath;
        const audioSizeMB = fs.statSync(wavPath).size / (1024 * 1024);
        console.log(`✅ 专用声音样本转换成功 (${audioSizeMB.toFixed(1)}MB)`);
      } else {
        console.warn("⚠️ 专用声音样本转换失败，将从视频提取");
      }
    }

    if (!previewAudioPath && needAudio) {
      console.log("🎵 正在从视频中提取音轨...");
      const audioPath = path.join(TEMP_DIR, `audio_${batchId}.wav`);
      const hasAudio = await extractAudioFromVideo(videoAbsPath, audioPath);
      if (hasAudio) {
        previewAudioPath = audioPath;
        const audioSizeMB = fs.statSync(audioPath).size / (1024 * 1024);
        console.log(`✅ 音轨提取成功 (${audioSizeMB.toFixed(1)}MB)`);
      } else {
        console.warn("⚠️ 视频没有可用的音轨");
      }
    }

    const previewItems: Array<{
      index: number;
      recipient: Recipient;
      narration: GeneratedNarration;
    }> = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      console.log(`📝 [${i + 1}/${recipients.length}] 正在为 ${recipient.name} 生成台词...`);
      const narration = await generateNarration(recipient, senderName, festival, previewAudioPath);
      console.log(`   开场: ${narration.openingText}`);
      console.log(`   祝福: ${narration.blessings.join(" | ")}`);
      previewItems.push({ index: i, recipient, narration });
    }

    const job: BatchJob = {
      id: batchId,
      senderName,
      videoFile,
      audioFile,
      festival,
      extractedAudioPath: previewAudioPath,
      dedicatedAudioPath: dedicatedAudioWavPath,
      items: previewItems.map((p) => ({
        index: p.index,
        recipient: p.recipient,
        status: "pending" as const,
        narration: p.narration,
        theme: p.narration.theme,
      })),
      createdAt: Date.now(),
      previewOnly: true,
      status: "processing",
    };
    jobStore.set(batchId, job);

    console.log(`✅ 台词预览生成完成，等待用户确认`);

    return {
      batchId,
      total: recipients.length,
      items: previewItems.map((p) => ({
        index: p.index,
        recipientName: p.recipient.name,
        relation: p.recipient.relation,
        background: p.recipient.background,
        narration: {
          openingText: p.narration.openingText,
          blessings: p.narration.blessings,
          ttsOpeningText: p.narration.ttsOpeningText,
          ttsBlessingText: p.narration.ttsBlessingText,
          theme: p.narration.theme,
          themeName: themes[p.narration.theme].name,
          joyful: p.narration.joyful,
        },
      })),
    };
  } else {
    const job: BatchJob = {
      id: batchId,
      senderName,
      videoFile,
      festival,
      items: recipients.map((r, i) => ({
        index: i,
        recipient: r,
        status: "pending" as const,
      })),
      createdAt: Date.now(),
      status: "processing",
    };

    jobStore.set(batchId, job);

    processBatchJob(batchId, jobStore, ttsProvider, llmProvider).catch((err) => {
      console.error("批量处理出错:", err);
      const j = jobStore.get(batchId);
      if (j) j.status = "error";
    });

    return { batchId, total: recipients.length };
  }
}

// ==================== 路由注册 ====================

export function registerBatchRoutes(
  app: express.Application,
  jobStore: JobStore,
  ttsProvider: TTSProvider,
  llmProvider: LLMProvider
) {
  // Step 1: 生成台词预览
  app.post(
    "/api/batch-preview",
    uploadFields,
    asyncHandler(async (req, res) => {
      const validated = validateBatchRequest(req);
      if (isValidationError(validated)) {
        return res.status(validated.status).json({ error: validated.error });
      }
      const result = await createBatchJob(validated, true, jobStore, ttsProvider, llmProvider);
      res.json(result);
    })
  );

  // Step 2: 确认台词并开始渲染
  app.post(
    "/api/batch-confirm",
    express.json(),
    asyncHandler(async (req, res) => {
      const parseResult = batchConfirmSchema.safeParse(req.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0];
        return res.status(400).json({ error: firstError.message });
      }

      const { batchId, narrations } = parseResult.data;

      const job = jobStore.get(batchId);
      if (!job) {
        return res.status(404).json({ error: "任务不存在或已过期" });
      }

      if (narrations && Array.isArray(narrations)) {
        for (const n of narrations) {
          const item = job.items.find((i) => i.index === n.index);
          if (item && item.narration) {
            if (n.openingText) item.narration.openingText = n.openingText;
            if (n.blessings && Array.isArray(n.blessings)) item.narration.blessings = n.blessings;
            if (n.ttsOpeningText) item.narration.ttsOpeningText = n.ttsOpeningText;
            if (n.ttsBlessingText) item.narration.ttsBlessingText = n.ttsBlessingText;
            if (typeof n.joyful === "number" && n.joyful >= 0 && n.joyful <= 5) {
              item.narration.joyful = Math.round(n.joyful);
            }
            if (n.theme && validThemes.includes(n.theme)) {
              item.narration.theme = n.theme;
              item.theme = n.theme;
            }
          }
        }
      }

      job.previewOnly = false;
      job.status = "processing";

      console.log(`\n${"=".repeat(60)}`);
      console.log(`🎬 用户确认台词，开始渲染: ${batchId}`);
      console.log(`   TTS: ${ttsProvider.isConfigured() ? "✅" : "❌"}`);
      console.log(`   声音来源: ${job.dedicatedAudioPath ? "专用录音" : "视频提取"}`);
      console.log(`${"=".repeat(60)}\n`);

      processBatchJob(batchId, jobStore, ttsProvider, llmProvider).catch((err) => {
        console.error("批量处理出错:", err);
        const j = jobStore.get(batchId);
        if (j) j.status = "error";
      });

      res.json({ batchId, total: job.items.length });
    })
  );

  // 旧接口兼容
  app.post(
    "/api/batch-render",
    uploadFields,
    asyncHandler(async (req, res) => {
      const validated = validateBatchRequest(req);
      if (isValidationError(validated)) {
        return res.status(validated.status).json({ error: validated.error });
      }
      const result = await createBatchJob(validated, false, jobStore, ttsProvider, llmProvider);
      res.json(result);
    })
  );

  // 查询批次状态
  app.get("/api/batch-status/:batchId", (req, res) => {
    const job = jobStore.get(req.params.batchId);
    if (!job) {
      return res.status(404).json({ error: "任务不存在或已过期" });
    }

    const items = job.items.map((item) => ({
      index: item.index,
      recipientName: item.recipient.name,
      relation: item.recipient.relation,
      theme: item.theme || null,
      themeName: item.theme ? themes[item.theme].name : null,
      status: item.status,
      videoUrl: item.videoUrl,
      filename: item.filename,
      error: item.error,
      narration: item.narration
        ? {
            openingText: item.narration.openingText,
            blessings: item.narration.blessings,
            ttsOpeningText: item.narration.ttsOpeningText,
            ttsBlessingText: item.narration.ttsBlessingText,
            joyful: item.narration.joyful,
          }
        : null,
    }));

    const completed = items.filter((i) => i.status === "done" || i.status === "error").length;

    res.json({
      batchId: job.id,
      status: job.status,
      total: items.length,
      completed,
      items,
    });
  });

  // 批量下载 ZIP
  app.get(
    "/api/batch-download/:batchId",
    asyncHandler(async (req, res) => {
      const job = jobStore.get(req.params.batchId);
      if (!job) {
        return res.status(404).json({ error: "任务不存在或已过期" });
      }

      const doneItems = job.items.filter((i) => i.status === "done" && i.filename);
      if (doneItems.length === 0) {
        return res.status(400).json({ error: "没有已完成的视频" });
      }

      const zipFilename = `blessings_${job.senderName}_${Date.now()}.zip`;
      const zipPath = path.join(TEMP_DIR, zipFilename);

      const filePaths = doneItems.map((i) => path.join(OUTPUT_DIR, i.filename!));
      await execFileAsync("zip", ["-j", zipPath, ...filePaths], {
        timeout: ZIP_TIMEOUT_MS,
      });

      res.download(zipPath, zipFilename, () => {
        try {
          fs.unlinkSync(zipPath);
        } catch {}
      });
    })
  );

  // 节日配置 API（供前端动态获取）
  app.get("/api/festival-config/:festivalId?", (req, res) => {
    const festivalId = (req.params.festivalId || "spring") as FestivalType;
    const { getFestivalUI, getFestivalBase } = require("../../src/festivals");
    const ui = getFestivalUI(festivalId);
    const base = getFestivalBase(festivalId);
    res.json({ ...base, ui });
  });
}
