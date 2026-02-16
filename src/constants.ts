/**
 * 共享常量定义
 * 视频制作核心参数的单一来源
 */

// 视频帧率和时序常量
export const FPS = 30;
export const TRANSITION_FRAMES = 20;
export const OUTRO_FRAMES = 90; // 片尾 3 秒

// Scene 1 (开场动画) 时长控制
export const DEFAULT_SCENE1_FRAMES = 150; // 5s 开场动画（无TTS时的默认值）
export const MIN_SCENE1_FRAMES = 120; // Scene 1 最短 4 秒
export const SCENE1_PADDING_FRAMES = 30; // 开场 TTS 后留 1 秒缓冲

// Scene 3 (祝福文本) 时长控制
export const DEFAULT_SCENE3_FRAMES = 180; // 6s 祝福文本（无TTS时的默认值）
export const MIN_SCENE3_FRAMES = 150; // Scene 3 最短 5 秒
export const SCENE3_PADDING_FRAMES = 45; // 祝福 TTS 音频后留 1.5 秒缓冲

// ffmpeg 音频转换参数（用于声音克隆和语音识别）
export const AUDIO_CONVERSION_PARAMS = [
  "-vn", // 不包含视频
  "-acodec", "pcm_s16le", // PCM 16-bit 编码
  "-ar", "16000", // 采样率 16kHz
  "-ac", "1", // 单声道
] as const;
