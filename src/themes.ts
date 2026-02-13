// 主题配置系统
export type ThemeType = "traditional" | "modern" | "cute" | "elegant";
export type FestivalType = "spring" | "valentine";

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

export interface ThemeConfig {
  id: ThemeType;
  name: string;
  description: string;
  colors: ThemeColors;
  // 适合的人群
  suitableFor: string[];
}

// 节日配置
export interface FestivalConfig {
  id: FestivalType;
  name: string;
  emoji: string;
  stampText: string;
  footerText: string;
  yearText: string;
}

export const festivals: Record<FestivalType, FestivalConfig> = {
  spring: {
    id: "spring",
    name: "春节",
    emoji: "🧧",
    stampText: "吉",
    footerText: "丙午年 · 新春快乐",
    yearText: "2026 丙午马年 · 新春快乐",
  },
  valentine: {
    id: "valentine",
    name: "情人节",
    emoji: "💝",
    stampText: "爱",
    footerText: "2.14 · 情人节快乐",
    yearText: "2026 · Happy Valentine's Day",
  },
};

export function getFestival(festivalId: FestivalType = "spring"): FestivalConfig {
  return festivals[festivalId] || festivals.spring;
}

export const themes: Record<ThemeType, ThemeConfig> = {
  // 传统红金 - 适合长辈、传统家庭
  traditional: {
    id: "traditional",
    name: "传统红金",
    description: "经典喜庆，适合长辈和传统场合",
    suitableFor: ["长辈", "父母", "亲戚", "传统"],
    colors: {
      primary: "#ffd700", // 金色
      secondary: "#ff3333", // 红色
      accent: "#ffaa00",
      text: "#fff5e6",
      textSecondary: "#ffd700",
      background: "radial-gradient(ellipse at center, #8b0000 0%, #5c0000 40%, #2d0000 70%, #1a0000 100%)",
      particleColors: ["#ffd700", "#ff6b6b", "#fff5e6"],
      glowColor: "#ffd700",
    },
  },

  // 现代简约 - 适合年轻人、同事
  modern: {
    id: "modern",
    name: "现代科技",
    description: "时尚简约，适合年轻人和职场",
    suitableFor: ["年轻人", "同事", "朋友", "商务"],
    colors: {
      primary: "#00d9ff", // 青蓝色
      secondary: "#a855f7", // 紫色
      accent: "#06b6d4",
      text: "#e0f2fe",
      textSecondary: "#00d9ff",
      background: "radial-gradient(ellipse at center, #1e1b4b 0%, #0f172a 40%, #020617 70%, #000000 100%)",
      particleColors: ["#00d9ff", "#a855f7", "#c084fc"],
      glowColor: "#00d9ff",
    },
  },

  // 粉色可爱 - 适合女性、孩子
  cute: {
    id: "cute",
    name: "粉色温馨",
    description: "甜美可爱，适合女性和孩子",
    suitableFor: ["女性", "孩子", "闺蜜", "姐妹"],
    colors: {
      primary: "#ff85c0", // 粉色
      secondary: "#ffd700", // 金色
      accent: "#ffb3d9",
      text: "#fff0f7",
      textSecondary: "#ff85c0",
      background: "radial-gradient(ellipse at center, #831843 0%, #4c1d3b 40%, #2d1b3d 70%, #1a1625 100%)",
      particleColors: ["#ff85c0", "#ffd700", "#ffb3d9"],
      glowColor: "#ff85c0",
    },
  },

  // 墨绿优雅 - 适合文艺、中年人
  elegant: {
    id: "elegant",
    name: "墨绿优雅",
    description: "典雅内敛，适合文艺和成熟人士",
    suitableFor: ["文艺", "中年", "老师", "知识分子"],
    colors: {
      primary: "#a3d9a5", // 浅绿
      secondary: "#ffd700", // 金色
      accent: "#7bc96f",
      text: "#f0fdf4",
      textSecondary: "#a3d9a5",
      background: "radial-gradient(ellipse at center, #14532d 0%, #1c3d2c 40%, #1a2c25 70%, #0f1419 100%)",
      particleColors: ["#a3d9a5", "#ffd700", "#7bc96f"],
      glowColor: "#a3d9a5",
    },
  },
};

export function getTheme(themeId: ThemeType = "traditional"): ThemeConfig {
  return themes[themeId] || themes.traditional;
}

// 根据关系和背景信息推荐主题
export function suggestTheme(relation: string, background: string = ""): ThemeType {
  const text = `${relation} ${background}`.toLowerCase();

  // 长辈、父母 -> 传统红金
  if (text.match(/父母|爸爸|妈妈|爷爷|奶奶|外公|外婆|长辈|叔叔|阿姨|伯伯/)) {
    return "traditional";
  }

  // 孩子、女性 -> 粉色可爱
  if (text.match(/女儿|孙女|妹妹|姐姐|闺蜜|女朋友|老婆|妻子|孩子|小朋友|宝宝/)) {
    return "cute";
  }

  // 同事、商务 -> 现代简约
  if (text.match(/同事|老板|领导|客户|合作伙伴|商务|职场|工作/)) {
    return "modern";
  }

  // 老师、文艺 -> 墨绿优雅
  if (text.match(/老师|教授|导师|文艺|作家|艺术家|知识分子/)) {
    return "elegant";
  }

  // 年轻人 -> 现代简约
  if (text.match(/朋友|同学|兄弟|哥们|室友|年轻/)) {
    return "modern";
  }

  // 默认传统红金
  return "traditional";
}
