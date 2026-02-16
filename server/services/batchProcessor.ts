/**
 * 批量处理服务
 * 管理批量视频生成的全流程
 */

import path from "path";
import fs from "fs";
import { PUBLIC_DIR, TEMP_DIR } from "../config";
import type { BatchJob, GeneratedNarration, Recipient, FestivalType } from "../types";
import type { JobStore } from "../stores/jobStore";
import type { TTSProvider } from "../providers/ttsProvider";
import type { LLMProvider } from "../providers/llmProvider";
import { themes, validThemes } from "../../src/themes";
import {
  FPS,
  OUTRO_FRAMES,
  DEFAULT_SCENE1_FRAMES,
  MIN_SCENE1_FRAMES,
  SCENE1_PADDING_FRAMES,
  DEFAULT_SCENE3_FRAMES,
  MIN_SCENE3_FRAMES,
  SCENE3_PADDING_FRAMES,
} from "../../src/constants";
import { convertToWav, getMediaDuration, generateId } from "../utils";
import {
  extractAudioFromVideo,
  generateTTSForRecipient,
  renderSingleVideo,
} from "./mediaService";
import { generateNarration } from "../narration";

// ==================== 帧数计算 ====================

export function calculateSceneTiming(
  userVideoDurationSec: number | undefined,
  ttsOpeningDurationSec: number | undefined,
  ttsBlessingDurationSec: number | undefined
): { scene1Frames: number; scene2Frames: number; scene3Frames: number } {
  let scene1Frames: number;
  if (ttsOpeningDurationSec !== undefined) {
    scene1Frames = Math.max(
      Math.round(ttsOpeningDurationSec * FPS) + SCENE1_PADDING_FRAMES,
      MIN_SCENE1_FRAMES
    );
  } else {
    scene1Frames = DEFAULT_SCENE1_FRAMES;
  }

  const scene2Sec = userVideoDurationSec ?? 5;
  const scene2Frames = Math.round(scene2Sec * FPS);

  let scene3Frames: number;
  if (ttsBlessingDurationSec !== undefined) {
    scene3Frames = Math.max(
      Math.round(ttsBlessingDurationSec * FPS) + SCENE3_PADDING_FRAMES,
      MIN_SCENE3_FRAMES
    );
  } else {
    scene3Frames = DEFAULT_SCENE3_FRAMES;
  }

  return { scene1Frames, scene2Frames, scene3Frames };
}

// ==================== 批量处理入口 ====================

export async function processBatchJob(
  batchId: string,
  jobStore: JobStore,
  ttsProvider: TTSProvider,
  llmProvider: LLMProvider
) {
  const job = jobStore.get(batchId);
  if (!job) return;

  const videoAbsPath = path.join(PUBLIC_DIR, job.videoFile);

  // Step 1: 检测用户视频时长
  const userVideoDuration = await getMediaDuration(videoAbsPath);
  job.userVideoDurationSec = userVideoDuration;
  if (userVideoDuration) {
    console.log(`📹 用户视频时长: ${userVideoDuration.toFixed(1)}s`);
  }

  // Step 2: 获取参考音频 → 上传创建声音克隆
  if (ttsProvider.isConfigured()) {
    let audioPath: string | undefined;

    if (job.dedicatedAudioPath && fs.existsSync(job.dedicatedAudioPath)) {
      audioPath = job.dedicatedAudioPath;
      console.log("🎙️ 使用用户专门录制的声音样本进行克隆");
    } else if (job.extractedAudioPath && fs.existsSync(job.extractedAudioPath)) {
      audioPath = job.extractedAudioPath;
      console.log("♻️ 复用预览阶段已提取的参考音轨");
    } else {
      console.log("🎤 正在从视频中提取参考音轨...");
      audioPath = path.join(TEMP_DIR, `ref_audio_${batchId}.wav`);
      const hasAudio = await extractAudioFromVideo(videoAbsPath, audioPath);
      if (!hasAudio) {
        audioPath = undefined;
        console.warn("⚠️ 视频没有可用的音轨，将跳过语音克隆（静默模式）");
      }
    }

    if (audioPath) {
      try {
        console.log("🎙️ 正在上传音频创建声音克隆...");
        job.voiceId = await ttsProvider.uploadVoice(audioPath);
        console.log(`✅ 声音克隆成功，voice_id: ${job.voiceId}`);
      } catch (err: any) {
        console.error("❌ 声音克隆失败:", err.message);
      }
    }
  } else {
    console.log("ℹ️ TTS 未配置，将生成无语音版本");
  }

  // Step 3: 为每个收信人依次生成
  for (const item of job.items) {
    try {
      item.status = "processing";
      console.log(
        `\n🎬 [${item.index + 1}/${job.items.length}] 正在处理: ${item.recipient.name} (${item.recipient.relation})`
      );

      // 3a. 生成个性化文案 + 主题
      let narration: GeneratedNarration;
      if (item.narration) {
        narration = item.narration;
        console.log(`   ♻️ 复用预览阶段已生成的台词`);
      } else {
        narration = await generateNarration(
          item.recipient,
          job.senderName,
          job.festival
        );
        item.narration = narration;
        item.theme = narration.theme;
      }
      console.log(`   主题: ${themes[narration.theme].name} (${narration.theme})`);
      console.log(`   开场: ${narration.openingText}`);
      console.log(`   祝福: ${narration.blessings.join(" | ")}`);

      // 3b. 并行生成两段 TTS
      let ttsOpeningAudioFile: string | undefined;
      let ttsOpeningDurationSec: number | undefined;
      let ttsBlessingAudioFile: string | undefined;
      let ttsBlessingDurationSec: number | undefined;

      if (job.voiceId) {
        const [openingResult, blessingResult] = await Promise.all([
          generateTTSForRecipient(
            narration.ttsOpeningText,
            `${item.recipient.name}_opening`,
            job.voiceId,
            ttsProvider
          ),
          generateTTSForRecipient(
            narration.ttsBlessingText,
            `${item.recipient.name}_blessing`,
            job.voiceId,
            ttsProvider
          ),
        ]);
        if (openingResult) {
          ttsOpeningAudioFile = openingResult.relativePath;
          ttsOpeningDurationSec = openingResult.durationSec;
        }
        if (blessingResult) {
          ttsBlessingAudioFile = blessingResult.relativePath;
          ttsBlessingDurationSec = blessingResult.durationSec;
        }
      }

      // 3c. 计算场景帧数
      const timing = calculateSceneTiming(
        job.userVideoDurationSec,
        ttsOpeningDurationSec,
        ttsBlessingDurationSec
      );
      const totalFrames =
        timing.scene1Frames + timing.scene2Frames + timing.scene3Frames + OUTRO_FRAMES;

      console.log(
        `   帧数: Scene1=${timing.scene1Frames} Scene2=${timing.scene2Frames} Scene3=${timing.scene3Frames} Outro=${OUTRO_FRAMES} Total=${totalFrames} (${(totalFrames / FPS).toFixed(1)}s)`
      );

      // 3d. 构造 Remotion props
      const props: Record<string, any> = {
        senderName: job.senderName,
        recipientName: item.recipient.name,
        openingText: narration.openingText,
        blessings: narration.blessings,
        videoFile: job.videoFile,
        ttsOpeningText: narration.ttsOpeningText,
        theme: narration.theme,
        festival: job.festival,
        scene1Frames: timing.scene1Frames,
        scene2Frames: timing.scene2Frames,
        scene3Frames: timing.scene3Frames,
      };
      if (ttsOpeningAudioFile) props.ttsOpeningAudioFile = ttsOpeningAudioFile;
      if (ttsBlessingAudioFile) props.ttsBlessingAudioFile = ttsBlessingAudioFile;

      // 3e. 渲染视频
      const safeRecipientName = item.recipient.name.replace(
        /[^a-zA-Z0-9\u4e00-\u9fff]/g,
        ""
      );
      const outputFilename = `blessing_${safeRecipientName}_${Date.now()}.mp4`;

      console.log(`🎥 开始渲染视频: ${outputFilename}`);
      await renderSingleVideo(props, outputFilename);

      item.videoUrl = `/output/${outputFilename}`;
      item.filename = outputFilename;
      item.status = "done";
      console.log(`✅ 完成: ${item.recipient.name}`);
    } catch (err: any) {
      item.status = "error";
      item.error = (err.stderr || err.message || "渲染失败").slice(0, 200);
      console.error(`❌ 失败 (${item.recipient.name}):`, item.error);
    }
  }

  // Step 4: 清理临时音频文件 + 声音
  if (job.extractedAudioPath) {
    try { fs.unlinkSync(job.extractedAudioPath); } catch {}
    job.extractedAudioPath = undefined;
  }
  if (job.dedicatedAudioPath) {
    try { fs.unlinkSync(job.dedicatedAudioPath); } catch {}
    job.dedicatedAudioPath = undefined;
  }
  if (job.voiceId) {
    console.log(`🧹 清理声音: ${job.voiceId}`);
    await ttsProvider.deleteVoice(job.voiceId);
    job.voiceId = undefined;
  }

  // 标记批次完成
  const allError = job.items.every((i) => i.status === "error");
  job.status = allError ? "error" : "done";

  const doneCount = job.items.filter((i) => i.status === "done").length;
  console.log(
    `\n🏁 批次 ${batchId} 完成: ${doneCount}/${job.items.length} 个视频成功`
  );
}
