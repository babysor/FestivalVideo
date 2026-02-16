/**
 * 媒体处理服务
 * 音频提取、TTS 生成、视频渲染等操作
 */

import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { UPLOADS_DIR, OUTPUT_DIR, TEMP_DIR, RENDER_TIMEOUT_MS, PROJECT_ROOT } from "../config";
import { convertToWav, getMediaDuration, generateId } from "../utils";
import type { TTSProvider } from "../providers/ttsProvider";

const execFileAsync = promisify(execFile);

/**
 * 从视频文件中提取音频
 */
export async function extractAudioFromVideo(
  videoPath: string,
  outputPath: string
): Promise<boolean> {
  const success = await convertToWav(videoPath, outputPath);
  if (!success) {
    console.warn("⚠️ 音频提取失败（视频可能没有音轨）");
  } else if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    return false;
  }
  return success;
}

/**
 * 为单个收信人生成 TTS 音频
 */
export async function generateTTSForRecipient(
  ttsText: string,
  recipientName: string,
  voiceId: string,
  ttsProvider: TTSProvider
): Promise<{ relativePath: string; durationSec: number } | undefined> {
  try {
    console.log(`🔊 正在为 ${recipientName} 生成 TTS 语音...`);
    console.log(`   朗读文本 (${ttsText.length}字): ${ttsText.slice(0, 80)}...`);

    const ttsResult = await ttsProvider.generateSpeech(ttsText, voiceId);

    const ttsFilename = `tts_${generateId()}.mp3`;
    const ttsAbsPath = path.join(UPLOADS_DIR, ttsFilename);
    fs.writeFileSync(ttsAbsPath, Buffer.from(ttsResult.audioData, "base64"));
    console.log(`✅ TTS 音频已保存: ${ttsFilename}`);

    const durationSec = (await getMediaDuration(ttsAbsPath)) ?? 6;
    console.log(`   TTS 时长: ${durationSec.toFixed(1)}s`);

    return { relativePath: `uploads/${ttsFilename}`, durationSec };
  } catch (err: any) {
    console.error(`❌ TTS 生成失败 (${recipientName}):`, err.message);
    return undefined;
  }
}

/**
 * 渲染单个视频
 */
export async function renderSingleVideo(
  props: Record<string, any>,
  outputFilename: string
): Promise<string> {
  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  const propsFile = path.join(TEMP_DIR, `props_${generateId()}.json`);

  try {
    fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));

    const args = [
      "remotion",
      "render",
      "SpringFestivalVideo",
      outputPath,
      `--props=${propsFile}`,
    ];
    console.log(`   命令: npx ${args.join(" ")}`);

    await execFileAsync("npx", args, {
      cwd: PROJECT_ROOT,
      timeout: RENDER_TIMEOUT_MS,
      env: { ...process.env },
    });

    return outputFilename;
  } finally {
    try {
      fs.unlinkSync(propsFile);
    } catch {}
  }
}
