import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { isCustomTTSConfigured, generateCustomSpeech } from "./tts";
import {
  generateNarration,
  isLLMConfigured,
  type Recipient,
  type GeneratedNarration,
  type ThemeType,
  type FestivalType,
} from "./narration";
import { themes } from "../src/themes";

const execFileAsync = promisify(execFile);

const app = express();
const PORT = 3210;
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "out");
const TEMP_DIR = path.join(PROJECT_ROOT, "tmp");

const FPS = 30;
const TRANSITION_FRAMES = 20;
const DEFAULT_SCENE1_FRAMES = 150; // 5s 开场动画（无TTS时的默认值）
const MIN_SCENE1_FRAMES = 120; // Scene 1 最短 4 秒
const SCENE1_PADDING_FRAMES = 30; // 开场 TTS 后留 1 秒缓冲
const DEFAULT_SCENE3_FRAMES = 180; // 6s 祝福文本（无TTS时的默认值）
const MIN_SCENE3_FRAMES = 150; // Scene 3 最短 5 秒
const SCENE3_PADDING_FRAMES = 45; // 祝福 TTS 音频后留 1.5 秒缓冲

// ==================== 媒体时长检测 ====================

/**
 * 用 ffprobe 获取媒体文件时长（秒）——异步版本，不阻塞事件循环
 * @returns 时长秒数，失败返回 undefined
 */
async function getMediaDuration(filePath: string): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "quiet", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
      { timeout: 10_000 }
    );
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) ? undefined : duration;
  } catch {
    return undefined;
  }
}

// ==================== 批量任务管理 ====================
//
// ⚠️ 注意：batchJobs 是内存存储，仅适用于单实例部署
// 如需多实例支持，请改用 Redis 或 Cloud Firestore
//

interface BatchItem {
  index: number;
  recipient: Recipient;
  status: "pending" | "processing" | "done" | "error";
  narration?: GeneratedNarration;
  theme?: ThemeType; // 由 LLM/模板生成后填入
  videoUrl?: string;
  filename?: string;
  error?: string;
}

interface BatchJob {
  id: string;
  senderName: string;
  videoFile: string;
  festival: FestivalType;
  refAudioPath?: string;
  extractedAudioPath?: string; // 预览阶段提取的音频，渲染阶段可复用
  userVideoDurationSec?: number; // 用户上传视频的时长
  items: BatchItem[];
  createdAt: number;
  previewOnly?: boolean; // 是否仅预览（尚未渲染）
  status: "processing" | "done" | "error";
}

const batchJobs = new Map<string, BatchJob>();

// 定期清理过期任务（1小时）
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of batchJobs) {
    if (now - job.createdAt > 3600_000) {
      // 清理关联的临时音频文件
      for (const p of [job.refAudioPath, job.extractedAudioPath]) {
        if (p) { try { fs.unlinkSync(p); } catch {} }
      }
      batchJobs.delete(id);
    }
  }
}, 600_000);

// ==================== 音频提取 & TTS ====================

async function extractAudioFromVideo(
  videoPath: string,
  outputPath: string
): Promise<boolean> {
  try {
    await execFileAsync(
      "ffmpeg",
      ["-i", videoPath, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", outputPath, "-y"],
      { timeout: 30_000 }
    );
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch (err: any) {
    console.warn(
      "⚠️ 音频提取失败（视频可能没有音轨）:",
      err.message?.slice(0, 200)
    );
    return false;
  }
}

/**
 * 为单个收信人生成 TTS 音频
 * @param joyful 开心程度 0-5，用于 TTS 情绪控制
 * @returns { relativePath, durationSec } 或 undefined
 */
async function generateTTSForRecipient(
  refAudioPath: string,
  ttsText: string,
  recipientName: string,
  joyful: number = 3
): Promise<{ relativePath: string; durationSec: number } | undefined> {
  try {
    console.log(`🔊 正在为 ${recipientName} 生成 TTS 语音 (joy=${joyful})...`);
    console.log(`   朗读文本 (${ttsText.length}字): ${ttsText.slice(0, 80)}...`);

    // 构造 emo 字段：JSON dict 转字符串
    const emo = JSON.stringify({ joy: joyful/10.0 });

    const ttsResult = await generateCustomSpeech(ttsText, {
      refAudioPath,
      speed: 0.9,
      targetLanguage: "zh",
      promptLanguage: "zh",
      emo,
    });

    const ttsFilename = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`;
    const ttsAbsPath = path.join(UPLOADS_DIR, ttsFilename);
    fs.writeFileSync(ttsAbsPath, Buffer.from(ttsResult.audioData, "base64"));
    console.log(`✅ TTS 音频已保存: ${ttsFilename}`);

    // 检测 TTS 音频时长
    const durationSec = (await getMediaDuration(ttsAbsPath)) ?? 6;
    console.log(`   TTS 时长: ${durationSec.toFixed(1)}s`);

    return { relativePath: `uploads/${ttsFilename}`, durationSec };
  } catch (err: any) {
    console.error(`❌ TTS 生成失败 (${recipientName}):`, err.message);
    return undefined;
  }
}

/**
 * 计算 Scene 帧数
 */
function calculateSceneTiming(
  userVideoDurationSec: number | undefined,
  ttsOpeningDurationSec: number | undefined,
  ttsBlessingDurationSec: number | undefined
): { scene1Frames: number; scene2Frames: number; scene3Frames: number } {
  // Scene 1: 由开场 TTS 时长决定，没有则用默认值
  let scene1Frames: number;
  if (ttsOpeningDurationSec !== undefined) {
    scene1Frames = Math.max(
      Math.round(ttsOpeningDurationSec * FPS) + SCENE1_PADDING_FRAMES,
      MIN_SCENE1_FRAMES
    );
  } else {
    scene1Frames = DEFAULT_SCENE1_FRAMES;
  }

  // Scene 2: 用户视频时长，默认 5s
  const scene2Sec = userVideoDurationSec ?? 5;
  const scene2Frames = Math.round(scene2Sec * FPS);

  // Scene 3: 由祝福 TTS 音频时长决定，没有则用默认值
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

/**
 * 渲染单个视频——异步版本，不阻塞事件循环
 */
async function renderSingleVideo(
  props: Record<string, any>,
  outputFilename: string
): Promise<string> {
  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  const propsFile = path.join(
    TEMP_DIR,
    `props_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.json`
  );

  try {
    fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));

    const args = ["remotion", "render", "SpringFestivalVideo", outputPath, `--props=${propsFile}`];
    console.log(`   命令: npx ${args.join(" ")}`);

    await execFileAsync("npx", args, {
      cwd: PROJECT_ROOT,
      timeout: 600_000, // 10 分钟超时（长视频需更多时间）
      env: { ...process.env },
    });

    return outputFilename;
  } finally {
    try {
      fs.unlinkSync(propsFile);
    } catch {}
  }
}

/**
 * 后台处理整个批次的视频
 */
async function processBatchJob(batchId: string) {
  const job = batchJobs.get(batchId);
  if (!job) return;

  const videoAbsPath = path.join(PUBLIC_DIR, job.videoFile);

  // Step 1: 检测用户视频时长
  const userVideoDuration = await getMediaDuration(videoAbsPath);
  job.userVideoDurationSec = userVideoDuration;
  if (userVideoDuration) {
    console.log(`📹 用户视频时长: ${userVideoDuration.toFixed(1)}s`);
  }

  // Step 2: 尝试提取参考音频用于 TTS（优先复用预览阶段已提取的音频）
  if (isCustomTTSConfigured()) {
    if (job.extractedAudioPath && fs.existsSync(job.extractedAudioPath)) {
      // 复用预览阶段已提取的音频，无需二次提取
      job.refAudioPath = job.extractedAudioPath;
      console.log("♻️ 复用预览阶段已提取的参考音轨，跳过重复提取");
    } else {
      console.log("🎤 正在从视频中提取参考音轨...");
      const refAudioPath = path.join(TEMP_DIR, `ref_audio_${batchId}.wav`);
      const hasAudio = await extractAudioFromVideo(videoAbsPath, refAudioPath);
      if (hasAudio) {
        job.refAudioPath = refAudioPath;
        console.log("✅ 参考音轨提取成功，将为每个人生成 AI 语音祝福");
      } else {
        console.warn("⚠️ 视频没有可用的音轨，将跳过语音克隆（静默模式）");
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

      // 3a. 生成个性化文案 + 主题（如果预览阶段已生成则复用）
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
      console.log(`   开场语音 (${narration.ttsOpeningText.length}字): ${narration.ttsOpeningText.slice(0, 60)}...`);
      console.log(`   祝福语音 (${narration.ttsBlessingText.length}字): ${narration.ttsBlessingText.slice(0, 60)}...`);

      // 3b. 并行生成两段 TTS（有参考音频就尝试，失败则静默继续）
      let ttsOpeningAudioFile: string | undefined;
      let ttsOpeningDurationSec: number | undefined;
      let ttsBlessingAudioFile: string | undefined;
      let ttsBlessingDurationSec: number | undefined;

      if (job.refAudioPath) {
        // 开场 TTS 和祝福 TTS 并行生成，减少约 50% 等待时间
        const [openingResult, blessingResult] = await Promise.all([
          generateTTSForRecipient(
            job.refAudioPath,
            narration.ttsOpeningText,
            `${item.recipient.name}_opening`,
            narration.joyful ?? 3
          ),
          generateTTSForRecipient(
            job.refAudioPath,
            narration.ttsBlessingText,
            `${item.recipient.name}_blessing`,
            narration.joyful ?? 3
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
      const OUTRO_FRAMES = 90; // 片尾 3 秒
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
        ttsOpeningText: narration.ttsOpeningText, // 开场语音文字内容
        theme: narration.theme, // LLM 选择的主题风格
        festival: job.festival, // 节日类型
        scene1Frames: timing.scene1Frames,
        scene2Frames: timing.scene2Frames,
        scene3Frames: timing.scene3Frames,
      };
      if (ttsOpeningAudioFile) {
        props.ttsOpeningAudioFile = ttsOpeningAudioFile;
      }
      if (ttsBlessingAudioFile) {
        props.ttsBlessingAudioFile = ttsBlessingAudioFile;
      }

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

  // Step 4: 清理参考音频（refAudioPath 和 extractedAudioPath 可能指向同一文件）
  const audioPathsToClean = new Set<string>();
  if (job.refAudioPath) audioPathsToClean.add(job.refAudioPath);
  if (job.extractedAudioPath) audioPathsToClean.add(job.extractedAudioPath);
  for (const p of audioPathsToClean) {
    try { fs.unlinkSync(p); } catch {}
  }
  job.refAudioPath = undefined;
  job.extractedAudioPath = undefined;

  // 标记批次完成
  const allError = job.items.every((i) => i.status === "error");
  job.status = allError ? "error" : "done";

  const doneCount = job.items.filter((i) => i.status === "done").length;
  console.log(
    `\n🏁 批次 ${batchId} 完成: ${doneCount}/${job.items.length} 个视频成功`
  );
}

// ==================== 确保目录存在 ====================

[PUBLIC_DIR, UPLOADS_DIR, OUTPUT_DIR, TEMP_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==================== Multer 配置 ====================

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `video_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("只支持视频文件"));
    }
  },
});

// ==================== Express 中间件 ====================

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/output", express.static(OUTPUT_DIR));

// ==================== 共用验证逻辑 ====================

interface ValidatedBatchInput {
  senderName: string;
  recipients: Recipient[];
  festival: FestivalType;
  videoFile: string;
  batchId: string;
}

/**
 * 验证批量请求的公共参数（视频文件、发送者名字、收信人列表、节日类型）
 * @returns 验证通过返回解析后的数据，失败返回 { error, status } 用于响应
 */
function validateBatchRequest(
  req: express.Request
): ValidatedBatchInput | { error: string; status: number } {
  const { senderName, recipients: recipientsJSON, festival: festivalRaw } = req.body;

  const validFestivals: FestivalType[] = ["spring", "valentine"];
  const festival: FestivalType = validFestivals.includes(festivalRaw) ? festivalRaw : "spring";

  if (!req.file) {
    return { error: "请上传祝福视频", status: 400 };
  }
  if (!senderName || !senderName.trim()) {
    return { error: "请输入您的名字", status: 400 };
  }
  if (!recipientsJSON) {
    return { error: "请添加至少一个祝福对象", status: 400 };
  }

  let recipients: Recipient[];
  try {
    recipients = JSON.parse(recipientsJSON);
  } catch {
    return { error: "祝福对象数据格式错误", status: 400 };
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { error: "请添加至少一个祝福对象", status: 400 };
  }

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (!r.name || !r.name.trim()) {
      return { error: `第 ${i + 1} 个祝福对象缺少名字`, status: 400 };
    }
    if (!r.relation || !r.relation.trim()) {
      return { error: `第 ${i + 1} 个祝福对象缺少关系描述`, status: 400 };
    }
  }

  // 规范化收信人数据
  const normalizedRecipients: Recipient[] = recipients.map((r) => ({
    name: r.name.trim(),
    relation: r.relation.trim(),
    background: (r.background || "").trim(),
  }));

  return {
    senderName: senderName.trim(),
    recipients: normalizedRecipients,
    festival,
    videoFile: `uploads/${req.file.filename}`,
    batchId: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
}

function isValidationError(
  result: ValidatedBatchInput | { error: string; status: number }
): result is { error: string; status: number } {
  return "error" in result;
}

// ==================== API 路由 ====================

// Step 1: 生成台词预览（不渲染视频）
app.post("/api/batch-preview", upload.single("video"), async (req, res) => {
  try {
    const validated = validateBatchRequest(req);
    if (isValidationError(validated)) {
      return res.status(validated.status).json({ error: validated.error });
    }
    const { senderName, recipients, festival, videoFile, batchId } = validated;

    const videoAbsPath = path.join(PUBLIC_DIR, videoFile);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`${festival === "valentine" ? "💝" : "🧧"} 台词预览任务: ${batchId} (${festival === "valentine" ? "情人节" : "春节"})`);
    console.log(`   发送者: ${senderName}`);
    console.log(`   视频: ${videoFile}`);
    console.log(`   LLM: ${isLLMConfigured() ? "✅" : "❌ (模板模式)"}`);
    console.log(`   收信人数量: ${recipients.length}`);
    console.log(`${"=".repeat(60)}\n`);

    // 提取视频音轨，作为 Gemini 上下文 + 后续 TTS 参考音频复用
    let previewAudioPath: string | undefined;
    const needAudio = isLLMConfigured() || isCustomTTSConfigured();
    if (needAudio) {
      console.log("🎵 正在从视频中提取音轨（供 Gemini 参考 + TTS 复用）...");
      const audioPath = path.join(TEMP_DIR, `audio_${batchId}.wav`);
      const hasAudio = await extractAudioFromVideo(videoAbsPath, audioPath);
      if (hasAudio) {
        previewAudioPath = audioPath;
        const audioSizeMB = fs.statSync(audioPath).size / (1024 * 1024);
        console.log(`✅ 音轨提取成功 (${audioSizeMB.toFixed(1)}MB)，将作为上下文发送给 Gemini，并保留供 TTS 复用`);
      } else {
        console.warn("⚠️ 视频没有可用的音轨，将仅使用文本生成台词");
      }
    }

    // 为每个收信人生成台词（不渲染视频）
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
      console.log(`   开场语音: ${narration.ttsOpeningText.slice(0, 60)}...`);
      console.log(`   祝福语音: ${narration.ttsBlessingText.slice(0, 60)}...`);
      previewItems.push({ index: i, recipient, narration });
    }

    // 将预览数据存入 batchJobs
    // 注意：不删除 previewAudioPath，保留给渲染阶段 TTS 复用
    const job: BatchJob = {
      id: batchId,
      senderName,
      videoFile,
      festival,
      extractedAudioPath: previewAudioPath, // 保留音频路径供渲染阶段复用
      items: previewItems.map((p) => ({
        index: p.index,
        recipient: p.recipient,
        status: "pending" as const,
        narration: p.narration,
        theme: p.narration.theme,
      })),
      createdAt: Date.now(),
      previewOnly: true,
      status: "processing", // will be set to "processing" when confirmed
    };
    batchJobs.set(batchId, job);

    console.log(`✅ 台词预览生成完成，等待用户确认`);

    res.json({
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
    });
  } catch (err: any) {
    console.error("台词预览生成失败:", err.message);
    res.status(500).json({ error: err.message || "服务器内部错误" });
  }
});

// Step 2: 确认台词并开始渲染视频
app.post("/api/batch-confirm", express.json(), async (req, res) => {
  try {
    const { batchId, narrations } = req.body;

    if (!batchId) {
      return res.status(400).json({ error: "缺少 batchId" });
    }

    const job = batchJobs.get(batchId);
    if (!job) {
      return res.status(404).json({ error: "任务不存在或已过期" });
    }

    // 如果用户编辑了台词，更新到 job 中
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
          if (n.theme) {
            const validThemes: ThemeType[] = ["traditional", "modern", "cute", "elegant"];
            if (validThemes.includes(n.theme)) {
              item.narration.theme = n.theme;
              item.theme = n.theme;
            }
          }
        }
      }
    }

    // 标记为正式处理
    job.previewOnly = false;
    job.status = "processing";

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🎬 用户确认台词，开始渲染: ${batchId}`);
    console.log(`   TTS: ${isCustomTTSConfigured() ? "✅" : "❌"}`);
    console.log(`${"=".repeat(60)}\n`);

    // 开始后台渲染（使用已有的 narration 数据）
    processBatchJob(batchId).catch((err) => {
      console.error("批量处理出错:", err);
      const j = batchJobs.get(batchId);
      if (j) j.status = "error";
    });

    res.json({ batchId, total: job.items.length });
  } catch (err: any) {
    console.error("确认渲染请求失败:", err.message);
    res.status(500).json({ error: err.message || "服务器内部错误" });
  }
});

// 启动批量渲染（保留旧接口兼容）
app.post("/api/batch-render", upload.single("video"), async (req, res) => {
  try {
    const validated = validateBatchRequest(req);
    if (isValidationError(validated)) {
      return res.status(validated.status).json({ error: validated.error });
    }
    const { senderName, recipients, festival, videoFile, batchId } = validated;

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

    batchJobs.set(batchId, job);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`${festival === "valentine" ? "💝" : "🧧"} 新批量任务: ${batchId} (${festival === "valentine" ? "情人节" : "春节"})`);
    console.log(`   发送者: ${senderName}`);
    console.log(`   视频: ${videoFile}`);
    console.log(`   LLM: ${isLLMConfigured() ? "✅" : "❌ (模板模式)"}`);
    console.log(`   TTS: ${isCustomTTSConfigured() ? "✅" : "❌"}`);
    console.log(`   收信人数量: ${recipients.length}`);
    recipients.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.name} (${r.relation}) ${r.background ? `- ${r.background}` : ""}`);
    });
    console.log(`   🎨 主题将由 ${isLLMConfigured() ? "Gemini 智能选择" : "关键词匹配"}`);
    console.log(`${"=".repeat(60)}\n`);

    processBatchJob(batchId).catch((err) => {
      console.error("批量处理出错:", err);
      const j = batchJobs.get(batchId);
      if (j) j.status = "error";
    });

    res.json({ batchId, total: recipients.length });
  } catch (err: any) {
    console.error("批量渲染请求失败:", err.message);
    res.status(500).json({ error: err.message || "服务器内部错误" });
  }
});

// 查询批次状态
app.get("/api/batch-status/:batchId", (req, res) => {
  const job = batchJobs.get(req.params.batchId);
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
    narration: item.narration ? {
      openingText: item.narration.openingText,
      blessings: item.narration.blessings,
      ttsOpeningText: item.narration.ttsOpeningText,
      ttsBlessingText: item.narration.ttsBlessingText,
      joyful: item.narration.joyful,
    } : null,
  }));

  const completed = items.filter(
    (i) => i.status === "done" || i.status === "error"
  ).length;

  res.json({
    batchId: job.id,
    status: job.status,
    total: items.length,
    completed,
    items,
  });
});

// 批量下载（zip）——异步，不阻塞事件循环
app.get("/api/batch-download/:batchId", async (req, res) => {
  const job = batchJobs.get(req.params.batchId);
  if (!job) {
    return res.status(404).json({ error: "任务不存在或已过期" });
  }

  const doneItems = job.items.filter((i) => i.status === "done" && i.filename);
  if (doneItems.length === 0) {
    return res.status(400).json({ error: "没有已完成的视频" });
  }

  const zipFilename = `blessings_${job.senderName}_${Date.now()}.zip`;
  const zipPath = path.join(TEMP_DIR, zipFilename);

  try {
    const filePaths = doneItems.map((i) => path.join(OUTPUT_DIR, i.filename!));
    await execFileAsync("zip", ["-j", zipPath, ...filePaths], {
      timeout: 60_000,
    });

    res.download(zipPath, zipFilename, () => {
      try { fs.unlinkSync(zipPath); } catch {}
    });
  } catch (err: any) {
    console.error("打包 zip 失败:", err.message);
    res.status(500).json({ error: "打包失败" });
  }
});

// ==================== 全局错误处理（返回 JSON 而非 HTML）====================

// 处理 Multer 错误和其他中间件错误，确保 API 路由始终返回 JSON
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("⚠️ 请求处理错误:", err.message || err);

    // Multer 错误（文件过大、类型不匹配等）
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "视频文件超过 50MB 上限" });
    }
    if (err.message === "只支持视频文件") {
      return res.status(400).json({ error: "只支持视频文件格式" });
    }

    // 其他错误
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error: err.message || "服务器内部错误",
    });
  }
);

// ==================== 启动服务器 ====================

app.listen(PORT, () => {
  console.log(`🧧 春节祝福视频批量生成器已启动`);
  console.log(`🌐 打开 http://localhost:${PORT}`);
  console.log(`🤖 LLM: ${isLLMConfigured() ? "✅ Gemini 已配置" : "❌ 未配置 (设置 GEMINI_API_KEY 启用 AI 文案)"}`);
  console.log(`🎙️ TTS: ${isCustomTTSConfigured() ? "✅ 已配置" : "❌ 未配置 (设置 TTS_ENDPOINT 启用语音克隆)"}`);
  console.log(`⚠️ 注意: 本服务使用内存存储任务状态，请确保部署为单实例 (--max-instances=1)`);
});
