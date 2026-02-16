/**
 * 服务端常量和路径配置
 */

import path from "path";

export const PORT = 3210;
export const PROJECT_ROOT = path.resolve(__dirname, "..");
export const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
export const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
export const OUTPUT_DIR = path.join(PROJECT_ROOT, "out");
export const TEMP_DIR = path.join(PROJECT_ROOT, "tmp");

// 批量任务过期时间（1小时）
export const JOB_EXPIRY_MS = 3600_000;
// 过期检查间隔（10分钟）
export const JOB_CLEANUP_INTERVAL_MS = 600_000;

// Remotion 渲染超时（10分钟）
export const RENDER_TIMEOUT_MS = 600_000;
// ZIP 打包超时（1分钟）
export const ZIP_TIMEOUT_MS = 60_000;
// 文件大小上限（50MB）
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
