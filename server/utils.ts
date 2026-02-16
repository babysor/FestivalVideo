/**
 * 服务端通用工具函数
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { Request, Response, NextFunction } from "express";
import { AUDIO_CONVERSION_PARAMS } from "../src/constants";

const execFileAsync = promisify(execFile);

/**
 * 生成随机 ID
 * @param prefix - ID 前缀（可选）
 * @returns 随机 ID 字符串
 */
export function generateId(prefix: string = ""): string {
  const random = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${Date.now()}_${random}` : random;
}

/**
 * 将音频/视频文件转换为 WAV 格式（16kHz, 单声道, PCM16）
 * 用于声音克隆和语音识别
 * @param inputPath - 输入文件路径
 * @param outputPath - 输出 WAV 文件路径
 * @returns 转换是否成功
 */
export async function convertToWav(
  inputPath: string,
  outputPath: string
): Promise<boolean> {
  try {
    await execFileAsync(
      "ffmpeg",
      ["-i", inputPath, ...AUDIO_CONVERSION_PARAMS, outputPath, "-y"],
      { timeout: 30_000 }
    );
    return true;
  } catch (err: any) {
    console.warn(
      `⚠️ 音频转换失败（${inputPath}）:`,
      err.message?.slice(0, 200)
    );
    return false;
  }
}

/**
 * 用 ffprobe 获取媒体文件时长（秒）
 * @param filePath - 媒体文件路径
 * @returns 时长秒数，失败返回 undefined
 */
export async function getMediaDuration(
  filePath: string
): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "quiet",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { timeout: 10_000 }
    );
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) ? undefined : duration;
  } catch {
    return undefined;
  }
}

/**
 * Express 异步路由错误处理包装器
 * 统一处理异步路由中的错误，避免每个路由都写 try-catch
 * 
 * @example
 * app.post("/api/example", asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json(data);
 * }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
