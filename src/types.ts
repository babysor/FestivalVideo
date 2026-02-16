/**
 * 共享类型定义
 * 跨前后端使用的类型的单一来源
 */

// 主题类型
export type ThemeType = "traditional" | "modern" | "cute" | "elegant";

// 节日类型
export type FestivalType = "spring";

// 关系分类类型
export type RelationType =
  | "elder" // 长辈
  | "friend" // 朋友
  | "colleague" // 同事
  | "lover" // 恋人
  | "junior" // 晚辈
  | "teacher" // 老师
  | "client" // 客户
  | "general"; // 通用

// 祝福对象信息
export interface Recipient {
  name: string; // 被祝福人名字，如 "张三"
  relation: string; // 与发送者的关系，如 "发小"
  background: string; // 背景/近况描述，如 "现在事业巅峰"
}

// AI 生成的祝福文案
export interface GeneratedNarration {
  openingText: string; // 视频 Scene 1 画面标题（自由格式，如 "想你了""老妈新年好"）
  blessings: string[]; // 视频 Scene 3 祝福语列表（3-6 个短语）
  ttsOpeningText: string; // TTS 开场语音（Scene 1，简短问候，10-35字）
  ttsBlessingText: string; // TTS 祝福语音（Scene 3，主体祝福，40-120字）
  theme: ThemeType; // LLM 根据收信人特征选择的视频主题风格
  joyful: number; // 开心程度 0-5，用于 TTS 情绪控制
}
