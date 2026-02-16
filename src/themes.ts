// 主题配置系统
import type { ThemeType, FestivalType } from "./types";

export type { ThemeType, FestivalType };

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textSecondary: string;
  background: string;
  particleColors: string[];
  glowColor: string;
}

// Scene 1 (开场动画 TextReveal) 专用配色
export interface ThemeScene1Config {
  fireworkColors: string[];
  background: string;
  textColor: string;
  textGlow: string;
  barAccent: string;
  catFill: string;
}

export interface ThemeConfig {
  id: ThemeType;
  name: string;
  description: string;
  colors: ThemeColors;
  suitableFor: string[];
  scene1: ThemeScene1Config;
}

// 节日配置 — 从 festivals.ts 统一导入
export type { FestivalConfig } from "./festivals";
export { getFestivalBase as getFestival, festivalBaseMap as festivals } from "./festivals";

export const themes: Record<ThemeType, ThemeConfig> = {
  // 传统红金 - 适合长辈、传统家庭
  traditional: {
    id: "traditional",
    name: "传统红金",
    description: "经典喜庆，适合长辈和传统场合",
    suitableFor: ["长辈", "父母", "亲戚", "传统"],
    colors: {
      primary: "#ffd700",
      secondary: "#ff3333",
      accent: "#ffaa00",
      text: "#fff5e6",
      textSecondary: "#ffd700",
      background: "radial-gradient(ellipse at center, #8b0000 0%, #5c0000 40%, #2d0000 70%, #1a0000 100%)",
      particleColors: ["#ffd700", "#ff6b6b", "#fff5e6"],
      glowColor: "#ffd700",
    },
    scene1: {
      fireworkColors: [
        "#ffd700", "#ffaa00", "#ff6b3d", "#ff4444", "#ff8c00",
        "#ffcc33", "#ff5533", "#ffe066", "#ff9966", "#fff5cc",
      ],
      background: "radial-gradient(ellipse at 50% 40%, #2a0a08 0%, #1a0500 35%, #0a0200 65%, #000000 100%)",
      textColor: "#ffe4b5",
      textGlow: "rgba(255,215,0,0.4)",
      barAccent: "#c4a050",
      catFill: "#1a0a08",
    },
  },

  // 现代简约 - 适合年轻人、同事
  modern: {
    id: "modern",
    name: "现代科技",
    description: "时尚简约，适合年轻人和职场",
    suitableFor: ["年轻人", "同事", "朋友", "商务"],
    colors: {
      primary: "#00d9ff",
      secondary: "#a855f7",
      accent: "#06b6d4",
      text: "#e0f2fe",
      textSecondary: "#00d9ff",
      background: "radial-gradient(ellipse at center, #1e1b4b 0%, #0f172a 40%, #020617 70%, #000000 100%)",
      particleColors: ["#00d9ff", "#a855f7", "#c084fc"],
      glowColor: "#00d9ff",
    },
    scene1: {
      fireworkColors: [
        "#00d9ff", "#00b4ff", "#6366f1", "#a855f7", "#38bdf8",
        "#818cf8", "#c084fc", "#22d3ee", "#67e8f9", "#e0f2fe",
      ],
      background: "radial-gradient(ellipse at 50% 40%, #0f1035 0%, #080a1e 35%, #030412 65%, #000000 100%)",
      textColor: "#c7e0f4",
      textGlow: "rgba(0,217,255,0.35)",
      barAccent: "#5b8fb9",
      catFill: "#0a0c22",
    },
  },

  // 粉色可爱 - 适合女性、孩子
  cute: {
    id: "cute",
    name: "粉色温馨",
    description: "甜美可爱，适合女性和孩子",
    suitableFor: ["女性", "孩子", "闺蜜", "姐妹"],
    colors: {
      primary: "#ff85c0",
      secondary: "#ffd700",
      accent: "#ffb3d9",
      text: "#fff0f7",
      textSecondary: "#ff85c0",
      background: "radial-gradient(ellipse at center, #831843 0%, #4c1d3b 40%, #2d1b3d 70%, #1a1625 100%)",
      particleColors: ["#ff85c0", "#ffd700", "#ffb3d9"],
      glowColor: "#ff85c0",
    },
    scene1: {
      fireworkColors: [
        "#ff69b4", "#ff85c8", "#da70d6", "#ee82ee", "#ff1493",
        "#c084fc", "#f0abfc", "#ffb6c1", "#e879f9", "#f472b6",
      ],
      background: "radial-gradient(ellipse at 50% 40%, #1a0a20 0%, #0d0510 35%, #050208 65%, #000000 100%)",
      textColor: "#ddc998",
      textGlow: "rgba(221,201,152,0.4)",
      barAccent: "#c4a86c",
      catFill: "#1a1228",
    },
  },

  // 墨绿优雅 - 适合文艺、中年人
  elegant: {
    id: "elegant",
    name: "墨绿优雅",
    description: "典雅内敛，适合文艺和成熟人士",
    suitableFor: ["文艺", "中年", "老师", "知识分子"],
    colors: {
      primary: "#a3d9a5",
      secondary: "#ffd700",
      accent: "#7bc96f",
      text: "#f0fdf4",
      textSecondary: "#a3d9a5",
      background: "radial-gradient(ellipse at center, #14532d 0%, #1c3d2c 40%, #1a2c25 70%, #0f1419 100%)",
      particleColors: ["#a3d9a5", "#ffd700", "#7bc96f"],
      glowColor: "#a3d9a5",
    },
    scene1: {
      fireworkColors: [
        "#a3d9a5", "#7bc96f", "#4ade80", "#86efac", "#6ee7b7",
        "#a7f3d0", "#34d399", "#bef264", "#d9f99d", "#fde68a",
      ],
      background: "radial-gradient(ellipse at 50% 40%, #0a1a10 0%, #050f08 35%, #020804 65%, #000000 100%)",
      textColor: "#d4e8d0",
      textGlow: "rgba(163,217,165,0.35)",
      barAccent: "#7aab7c",
      catFill: "#0a1510",
    },
  },
};

export function getTheme(themeId: ThemeType = "traditional"): ThemeConfig {
  return themes[themeId] || themes.traditional;
}

// 导出有效主题列表（从 themes 对象的键派生，避免硬编码）
export const validThemes = Object.keys(themes) as ThemeType[];

// 导出统一的关系分类和主题推荐逻辑
export { suggestTheme, classifyRelation } from "./relationClassifier";
