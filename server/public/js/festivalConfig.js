/**
 * 节日配置（前端）
 * 与 src/festivals.ts 中的 FestivalUIConfig 对应。
 * 将来可通过 /api/festival-config 从服务端动态获取。
 */

export const FESTIVAL_CONFIG = {
  spring: {
    emoji: "🏮",
    title: "春节祝福视频批量生成",
    desc: "上传或现场录制极短示例祝福，输入朋友列表，为每个人生成专属祝福视频",
    videoLabel: "提供一段祝福视频（录一句通用的新年祝福语，3-10秒）",
    submitText: "🧧 一键生成全部祝福视频",
    footer: "🧧 2026 丙午马年 · 新春快乐 🧧",
    particleColors: ["#ffd700", "#ff6b6b", "#ffaa00", "#ff4444", "#fff5b0"],
    recipientHint: `💡 在「关系与背景」中填写关系和背景信息，用逗号分隔<br>💡 例如：发小，刚升职 / 妈妈，身体健康 / 领导，事业巅峰<br>🎨 AI 会根据对方身份自动选择最匹配的视频风格`,
    namePlaceholder: "张三",
    relationPlaceholder: "发小，事业巅峰",
  },
};

export function getCurrentConfig(festival) {
  return FESTIVAL_CONFIG[festival] || FESTIVAL_CONFIG.spring;
}
