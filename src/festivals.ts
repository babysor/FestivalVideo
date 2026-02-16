/**
 * 节日配置中心
 * 所有节日相关的配置集中在此，添加新节日只需在此文件增加一个条目。
 */

import type { FestivalType, RelationType } from "./types";

// ==================== 节日基础配置 ====================

export interface FestivalConfig {
  id: FestivalType;
  name: string;
  emoji: string;
  stampText: string;
  footerText: string;
  yearText: string;
}

// ==================== 节日文案模板（模板回退用） ====================

export interface FestivalNarrationTemplates {
  /** LLM 系统 Prompt */
  systemPrompt: string;
  /** 模板回退用：每种关系对应的开场标题 */
  openingTexts: Record<RelationType, string[]>;
  /** 模板回退用：每种关系对应的祝福短语组 */
  blessingsPool: Record<RelationType, string[][]>;
  /** 模板回退用：每种关系对应的开场语音模板 */
  openingVoiceTemplates: Record<RelationType, string[]>;
  /** 模板回退用：根据背景生成的祝福语音前缀（按关系大类） */
  backgroundIntros: Record<string, string[]>;
  /** 模板回退用：祝福语音拼接逻辑（按关系类型） */
  blessingVoiceBuilder: (
    relType: RelationType,
    recipient: { name: string; relation: string; background: string },
    senderName: string,
    blessings: string[]
  ) => string;
}

// ==================== 前端 UI 配置 ====================

export interface FestivalUIConfig {
  headerEmoji: string;
  title: string;
  description: string;
  videoLabel: string;
  submitText: string;
  footer: string;
  particleColors: string[];
  recipientHint: string;
  namePlaceholder: string;
  relationPlaceholder: string;
}

// ==================== 完整节日配置 ====================

export interface FullFestivalConfig {
  base: FestivalConfig;
  narration: FestivalNarrationTemplates;
  ui: FestivalUIConfig;
}

// ==================== LLM User Prompt 构建器 ====================

export interface LLMPromptConfig {
  /** 生成 LLM user prompt */
  buildUserPrompt: (
    recipient: { name: string; relation: string; background: string },
    senderName: string,
    hasAudio: boolean,
    themeOptions: string
  ) => string;
}

// ==================== 春节配置 ====================

const springBlessingVoiceBuilder: FestivalNarrationTemplates["blessingVoiceBuilder"] = (
  relType, recipient, senderName, blessings
) => {
  const parts: string[] = [];

  if (recipient.background?.trim()) {
    const bgIntros: Record<string, string[]> = {
      elder: [`知道您最近${recipient.background}，真替您高兴`, `您最近${recipient.background}，我们都放心了`],
      friend: [`你最近${recipient.background}吧，不错嘛`, `听说你${recipient.background}了，可以啊`],
      lover: [`你最近${recipient.background}，辛苦啦`, `知道你${recipient.background}，心疼你`],
      general: [`你最近${recipient.background}，挺好的`, `知道你最近${recipient.background}`],
    };
    const bgKey = ["elder", "friend", "lover"].includes(relType) ? relType : "general";
    const pool = bgIntros[bgKey];
    let hash = 0;
    const seed = `${recipient.name}_${recipient.relation}_bg`;
    for (let i = 0; i < seed.length; i++) { hash = (hash << 5) - hash + seed.charCodeAt(i); hash |= 0; }
    parts.push(pool[Math.abs(hash) % pool.length]);
  }

  if (relType === "elder") {
    parts.push(`新的一年就希望您${blessings.slice(0, 2).join("，")}`);
    parts.push(`${blessings.slice(2).join("，")}，${senderName}给您拜年了`);
  } else if (relType === "friend") {
    parts.push(`新的一年嘛，${blessings.slice(0, 2).join("，")}`);
    parts.push(`${blessings.slice(2).join("，")}，${senderName}给你拜年啦`);
  } else if (relType === "lover") {
    parts.push(`新的一年继续在一起，${blessings.slice(0, 2).join("，")}`);
    parts.push(`${senderName}爱你，马年也要甜甜的`);
  } else {
    parts.push(`新的一年希望你${blessings.slice(0, 2).join("，")}`);
    parts.push(`${blessings.slice(2).join("，")}，${senderName}给你拜年啦`);
  }

  return parts.join("。") + "！";
};

const SPRING_CONFIG: FullFestivalConfig = {
  base: {
    id: "spring",
    name: "春节",
    emoji: "🧧",
    stampText: "吉",
    footerText: "丙午年 · 新春快乐",
    yearText: "2026 丙午马年 · 新春快乐",
  },

  narration: {
    systemPrompt: `你是一个帮人写春节祝福视频台词的助手。2026年是丙午马年。

核心原则：写出来的东西必须像「人话」——就是一个普通人对着手机镜头随口说出来的那种，不是写作文。

风格要求：
- 口语化、随意、非正式，像微信语音或朋友面对面聊天
- 可以用语气词（哈、啊、嘿、哎、诶、嗯）、口头禅、感叹句
- 可以用不完整的句子、口语化的断句
- 绝对禁止：成语堆砌、排比句、"愿你xxx"句式、"祝你xxx"的套话、任何听起来像群发短信的内容
- 要有具体的、私人的、只有你们之间才懂的感觉
- 根据对方的身份和关系，说话的方式应该完全不同：给长辈要温暖踏实，给朋友要放飞自我，给同事要轻松得体

如果附带了发送者录制的祝福视频音频，请仔细听音频，模仿发送者的说话方式和语气来写台词。`,

    openingTexts: {
      elder: ["老妈新年好", "爸 过年好", "新年平安", "回家过年啦"],
      friend: ["兄弟新年好", "新年暴富", "马年冲冲冲", "过年好呀"],
      colleague: ["新年开工大吉", "马年搞钱顺利", "同事们新年好", "新年不加班"],
      lover: ["宝贝新年好", "和你跨年", "新年第一个想你", "马年继续甜"],
      junior: ["小朋友新年好", "新年快乐鸭", "马年加油", "又长一岁啦"],
      teacher: ["老师新年好", "感谢您这一年", "新春快乐", "马年顺遂"],
      client: ["新年合作愉快", "马年一起发财", "新春大吉", "新年好运来"],
      general: ["新年快乐", "马年大吉", "过年好呀", "新年暴富"],
    },

    blessingsPool: {
      elder: [["身体倍儿棒", "吃嘛嘛香", "天天开心", "少操点心"], ["健健康康", "多享享福", "想吃啥吃啥", "我们的靠山"]],
      friend: [["搞钱顺利", "越来越帅", "啥都顺", "继续浪"], ["发大财", "交好运", "别秃头", "一起冲"]],
      colleague: [["升职加薪", "准时下班", "不加班", "年终翻倍"], ["搞钱顺利", "老板看不见", "摸鱼愉快", "早日财务自由"]],
      lover: [["永远喜欢你", "天天黏一起", "甜到齁", "继续宠我"], ["你最好看", "一直在一起", "超爱你", "明年也要在一起"]],
      junior: [["快高长大", "开开心心", "考试全对", "压岁钱翻倍"], ["越来越棒", "天天快乐", "想干嘛干嘛", "未来可期"]],
      teacher: [["少操心我们", "多休息", "身体健康", "您辛苦了"], ["别太累了", "开开心心", "学生们想您", "永远的恩师"]],
      client: [["合作愉快", "一起发财", "越做越大", "订单翻倍"], ["继续搞钱", "合作顺利", "双赢双赢", "明年更猛"]],
      general: [["啥都顺", "发大财", "身体好", "开心就行"], ["万事顺利", "天天开心", "越来越好", "马年冲"]],
    },

    openingVoiceTemplates: {
      elder: [
        "{name}，过年好！给您录了段拜年的话，您听听～",
        "{name}新年好！今年不能回去，给您录了个视频拜年～",
        "{name}！过年好呀，给您拜年啦！",
      ],
      friend: [
        "哟{name}！新年好啊！给你录了个东西你看看哈哈",
        "{name}！过年好！好久没见了，给你录了段话～",
        "嘿{name}！马年快乐！来看看这个～",
      ],
      colleague: [
        "{name}新年好！给你录了段拜年的话哈～",
        "{name}！过年好！新年第一天不聊工作，看看这个～",
        "嘿{name}，新年快乐！给你录了个东西～",
      ],
      lover: [
        "宝贝新年快乐！给你录了个东西快看～",
        "{name}～过年好呀！看看我给你录了啥哈哈",
        "新年快乐宝贝！给你录了段话你听听～",
      ],
      junior: [
        "{name}！新年快乐呀，给你录了个东西看看～",
        "小{name}过年好！看看这个视频哈哈",
        "{name}新年好！给你录了段话～",
      ],
      teacher: [
        "老师新年好！给您录了段拜年的话～",
        "{name}老师过年好！学生给您拜年啦～",
        "老师新年快乐！给您录了个视频～",
      ],
      client: [
        "{name}新年好！给您录了段拜年的话～",
        "{name}！过年好，新年第一个祝福给您！",
        "新年快乐！给您录了个东西看看～",
      ],
      general: [
        "{name}！新年好呀，给你录了个东西快看～",
        "嘿{name}，过年好！看看这个视频哈哈",
        "{name}新年快乐！给你录了段话～",
      ],
    },

    backgroundIntros: {
      elder: ["知道您最近{bg}，真替您高兴", "您最近{bg}，我们都放心了"],
      friend: ["你最近{bg}吧，不错嘛", "听说你{bg}了，可以啊"],
      lover: ["你最近{bg}，辛苦啦", "知道你{bg}，心疼你"],
      general: ["你最近{bg}，挺好的", "知道你最近{bg}"],
    },

    blessingVoiceBuilder: springBlessingVoiceBuilder,
  },

  ui: {
    headerEmoji: "🏮",
    title: "春节祝福视频批量生成",
    description: "上传或现场录制极短示例祝福，输入朋友列表，为每个人生成专属祝福视频",
    videoLabel: "提供一段祝福视频（录一句通用的新年祝福语，3-10秒）",
    submitText: "🧧 一键生成全部祝福视频",
    footer: "🧧 2026 丙午马年 · 新春快乐 🧧",
    particleColors: ["#ffd700", "#ff6b6b", "#ffaa00", "#ff4444", "#fff5b0"],
    recipientHint: `💡 在「关系与背景」中填写关系和背景信息，用逗号分隔<br>💡 例如：发小，刚升职 / 妈妈，身体健康 / 领导，事业巅峰<br>🎨 AI 会根据对方身份自动选择最匹配的视频风格`,
    namePlaceholder: "张三",
    relationPlaceholder: "发小，事业巅峰",
  },
};

// ==================== 节日注册表 ====================

const ALL_FESTIVALS: Record<FestivalType, FullFestivalConfig> = {
  spring: SPRING_CONFIG,
};

// ==================== 公开 API ====================

export function getFestivalConfig(festivalId: FestivalType = "spring"): FullFestivalConfig {
  return ALL_FESTIVALS[festivalId] || ALL_FESTIVALS.spring;
}

export function getFestivalBase(festivalId: FestivalType = "spring"): FestivalConfig {
  return getFestivalConfig(festivalId).base;
}

export function getFestivalNarration(festivalId: FestivalType = "spring"): FestivalNarrationTemplates {
  return getFestivalConfig(festivalId).narration;
}

export function getFestivalUI(festivalId: FestivalType = "spring"): FestivalUIConfig {
  return getFestivalConfig(festivalId).ui;
}

/** 所有可用节日 ID */
export const validFestivals = Object.keys(ALL_FESTIVALS) as FestivalType[];

/** 快速获取节日基础信息映射（供 themes.ts 向后兼容） */
export const festivalBaseMap: Record<FestivalType, FestivalConfig> = Object.fromEntries(
  Object.entries(ALL_FESTIVALS).map(([k, v]) => [k, v.base])
) as Record<FestivalType, FestivalConfig>;
