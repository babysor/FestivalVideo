/**
 * 个性化祝福文案生成
 * 优先使用 LLM 根据收信人信息深度定制，LLM 不可用时回退到模板
 */

import fetch from "node-fetch";
import fs from "fs";
import { suggestTheme, type FestivalType } from "../src/themes";

// ==================== 类型定义 ====================

export type ThemeType = "traditional" | "modern" | "cute" | "elegant";

export interface Recipient {
  name: string; // 被祝福人名字，如 "张三"
  relation: string; // 与发送者的关系，如 "发小"
  background: string; // 背景/近况描述，如 "现在事业巅峰"
}

export interface GeneratedNarration {
  openingText: string; // 视频 Scene 1 画面标题（自由格式，如 "想你了""老妈新年好"）
  blessings: string[]; // 视频 Scene 3 祝福语列表（3-6 个短语）
  ttsOpeningText: string; // TTS 开场语音（Scene 1，简短问候，10-35字）
  ttsBlessingText: string; // TTS 祝福语音（Scene 3，主体祝福，40-120字）
  theme: ThemeType; // LLM 根据收信人特征选择的视频主题风格
  joyful: number; // 开心程度 0-5，用于 TTS 情绪控制
}

export { FestivalType };

// ==================== Gemini LLM 配置 ====================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta";

export function isLLMConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

// ==================== LLM 生成 ====================

const SYSTEM_PROMPTS: Record<string, string> = {
  spring: `你是一个帮人写春节祝福视频台词的助手。2026年是丙午马年。

核心原则：写出来的东西必须像「人话」——就是一个普通人对着手机镜头随口说出来的那种，不是写作文。

风格要求：
- 口语化、随意、非正式，像微信语音或朋友面对面聊天
- 可以用语气词（哈、啊、嘿、哎、诶、嗯）、口头禅、感叹句
- 可以用不完整的句子、口语化的断句
- 绝对禁止：成语堆砌、排比句、"愿你xxx"句式、"祝你xxx"的套话、任何听起来像群发短信的内容
- 要有具体的、私人的、只有你们之间才懂的感觉
- 根据对方的身份和关系，说话的方式应该完全不同：给长辈要温暖踏实，给朋友要放飞自我，给同事要轻松得体

如果附带了发送者录制的祝福视频音频，请仔细听音频，模仿发送者的说话方式和语气来写台词。`,

  valentine: `你是一个帮人写情人节视频台词的助手。2026年情人节是2月14日。

核心原则：写出来的东西必须像「人话」——年轻人之间真实的说话方式，不是写贺卡。

风格要求：
- 完全口语化，像发微信语音、打视频电话时随口说的
- 情侣之间可以撒娇、调侃、吐槽、肉麻、搞怪，怎么真实怎么来
- 朋友之间可以损、可以煽情、可以搞笑，别端着
- 语气词随便用（哈哈、嘿嘿、啊啊啊、呜呜、嘻嘻、噗）
- 可以用网络用语、流行梗，但别太过
- 绝对禁止：成语、排比句、"愿你xxx"句式、文艺腔、诗歌体、任何听起来像贺卡/群发短信的东西
- 绝对禁止：空洞的甜言蜜语，要说就说具体的、有画面感的
- 不同关系的台词风格必须有明显区别：情侣要甜/皮，暧昧对象要试探/心动，闺蜜要疯/真诚

如果附带了发送者录制的祝福视频音频，请仔细听音频，模仿发送者的说话方式和语气来写台词。`,
};

function buildUserPrompt(recipient: Recipient, senderName: string, festival: FestivalType = "spring", hasAudio: boolean = false): string {
  const audioHint = hasAudio
    ? `\n\n⚠️ 重要：我附了发送者录的视频音频。先听听他/她怎么说话的，然后：
- 模仿音频里的说话方式和语气
- 别重复音频里已经说过的内容
- 写出来要像同一个人在继续说`
    : "";

  if (festival === "valentine") {
    return `帮我写情人节视频的台词。

发送者：${senderName}
收信人：${recipient.name}
关系：${recipient.relation}
背景/近况：${recipient.background || "没啥特别的"}${audioHint}

视频结构：开场动画（配音+画面文字）→ 发送者自己录的视频 → 祝福画面（配音+画面文字）
开场和祝福画面会用 AI 克隆发送者的声音来配音。

请根据两人的关系自由发挥台词风格，不要套模板。举几个例子感受一下（别照抄）：
- 情侣：可以甜、可以皮、可以肉麻到起鸡皮疙瘩，像平时跟对象说话
- 暧昧/喜欢的人：小心翼翼又藏不住的心动，可以借机表白
- 闺蜜/好兄弟：可以损、可以煽情、可以疯，"虽然你丑但我爱你"这种
- 朋友：轻松自然，可以调侃可以温暖

选一个视频风格：
- "traditional"：红金经典风，适合传统浪漫
- "modern"：蓝紫科技风，适合酷/潮的年轻人
- "cute"：粉色甜美风，适合可爱/甜系
- "elegant"：墨绿文艺风，适合知性/文艺

返回 JSON：
{
  "theme": "选一个最适合这对关系的风格",
  "opening": "开场配音，10-35字。就是拿起手机随口说的一句话，引导对方看视频。不要用固定句式，根据关系自由发挥。",
  "narration": "主体配音，40-120字。这是整个视频最重要的部分！要像${senderName}真的在跟${recipient.name}说话。结合背景信息说具体的东西。风格完全取决于两人关系——情侣就甜/皮，朋友就真诚/搞笑，暧昧就心动/试探。结尾可以自然地带上${senderName}的名字，但不是必须的。",
  "blessings": ["画面短语1", "画面短语2", "画面短语3", "画面短语4"],
  "openingText": "画面标题，3-8个字，自由发挥，可以是一句短话、一个词组、一个表达，不限于四字格式",
  "joyful": 3
}

⚠️ 核心要求：
- 台词风格必须匹配两人关系！情侣和朋友的台词不应该长一个样
- opening 别用"嘿xx情人节快乐给你录了个东西"这种万能模板，根据关系来
- narration 要有细节、有画面感、有情绪，不要空洞的甜言蜜语
- blessings 是画面上显示的短语（2-8字），要有个性，别千篇一律"天天开心""越来越好"
- openingText 是画面标题，自由发挥，可以是"想你了""笨蛋情人节快乐""致我最好的你""嘿 帅哥"之类的，别拘泥于四字格式
- 禁止"愿你""祝你""愿我们"句式，禁止成语排比，禁止贺卡腔
- 如果有背景信息，自然地融入对话，别生硬地"听说你最近xxx"
- joyful 是语音情绪（0=低沉 1=温和 2=微笑 3=开心 4=很嗨 5=超兴奋），根据内容定`;
  }

  return `帮我写马年春节祝福视频的台词。2026丙午马年。

发送者：${senderName}
收信人：${recipient.name}
关系：${recipient.relation}
背景/近况：${recipient.background || "没啥特别的"}${audioHint}

视频结构：开场动画（配音+画面文字）→ 发送者自己录的视频 → 祝福画面（配音+画面文字）
开场和祝福画面会用 AI 克隆发送者的声音来配音。

请根据两人的关系自由发挥台词风格：
- 给爸妈/长辈：温暖、踏实、报喜不报忧，像过年打电话回家
- 给发小/好友：放飞自我、可以损、可以煽情、可以回忆往事
- 给同事/领导：轻松得体、可以幽默但不失分寸
- 给对象：甜、皮、撒娇都行
- 给晚辈：鼓励、关心、可以逗趣

选一个视频风格：
- "traditional"：红金喜庆风，适合长辈、传统
- "modern"：蓝紫科技风，适合年轻人、同事
- "cute"：粉色可爱风，适合女生、孩子
- "elegant"：墨绿文艺风，适合老师、文艺范

返回 JSON：
{
  "theme": "选一个最适合的风格",
  "opening": "开场配音，10-35字。拿起手机随口说的一句话，引导对方看视频。根据关系自由发挥，别用固定句式。",
  "narration": "主体配音，40-120字。像${senderName}真的在跟${recipient.name}说话。结合背景信息说具体的东西，风格取决于关系。结尾可以自然带上${senderName}的名字。",
  "blessings": ["画面短语1", "画面短语2", "画面短语3", "画面短语4"],
  "openingText": "画面标题，3-8个字，自由发挥，不限于四字·四字格式，可以是一句短话或词组",
  "joyful": 3
}

⚠️ 核心要求：
- 台词风格必须匹配关系！给爸妈和给兄弟的台词不应该长一个样
- opening 根据关系自由发挥，别套"哟xx新年好给你录了个祝福"的模板
- narration 要有细节有情感，不要空话套话
- blessings 是画面短语（2-8字），要接地气有个性
- openingText 是画面标题，自由发挥，比如"老妈新年好""兄弟们冲""马年大吉利""新年暴富"之类，别拘泥格式
- 禁止"愿你""祝你""愿新的一年"句式，禁止成语排比，禁止"阖家幸福万事如意"群发套话
- 背景信息要自然融入对话
- joyful 是语音情绪（0=低沉 1=温和 2=微笑 3=开心 4=很嗨 5=超兴奋），根据内容定`;
}

/**
 * 从 LLM 响应文本中提取 JSON（处理 markdown code block 包裹的情况）
 */
function extractJSON(text: string): any {
  // 尝试直接解析
  try {
    return JSON.parse(text.trim());
  } catch {}

  // 尝试提取 ```json ... ``` 或 ``` ... ``` 中的内容
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  // 尝试找到第一个 { 和最后一个 } 之间的内容
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  throw new Error("无法从 LLM 响应中解析 JSON");
}

/**
 * 调用 Gemini API 生成个性化祝福文案
 * @param audioFilePath 可选，发送者录制视频的音频文件路径（WAV），会作为上下文发给 Gemini
 */
async function generateNarrationWithLLM(
  recipient: Recipient,
  senderName: string,
  festival: FestivalType = "spring",
  audioFilePath?: string
): Promise<GeneratedNarration> {
  const hasAudio = !!audioFilePath && fs.existsSync(audioFilePath);
  const userPrompt = buildUserPrompt(recipient, senderName, festival, hasAudio);
  const systemPrompt = SYSTEM_PROMPTS[festival] || SYSTEM_PROMPTS.spring;
  const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  // 构造 user message parts：音频（可选）+ 文本提示
  const userParts: Array<Record<string, any>> = [];

  if (hasAudio) {
    try {
      const audioBytes = fs.readFileSync(audioFilePath!);
      const audioBase64 = audioBytes.toString("base64");
      const audioSizeMB = audioBytes.length / (1024 * 1024);
      console.log(`   🎵 附加音频到 Gemini 请求 (${audioSizeMB.toFixed(1)}MB)`);

      // 音频文件不超过 20MB 才用 inlineData
      if (audioSizeMB < 18) {
        userParts.push({
          inlineData: {
            mimeType: "audio/wav",
            data: audioBase64,
          },
        });
      } else {
        console.warn(`   ⚠️ 音频文件过大 (${audioSizeMB.toFixed(1)}MB)，跳过附加`);
      }
    } catch (err: any) {
      console.warn(`   ⚠️ 读取音频文件失败: ${err.message}`);
    }
  }

  userParts.push({ text: userPrompt });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: userParts,
        },
      ],
      generationConfig: {
        temperature: 0.92,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 错误 (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as any;
  const content =
    data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Gemini 返回内容为空");
  }

  const parsed = extractJSON(content);

  // 验证返回结构
  if (!parsed.opening || typeof parsed.opening !== "string") {
    throw new Error("LLM 返回缺少 opening 字段");
  }
  if (!parsed.narration || typeof parsed.narration !== "string") {
    throw new Error("LLM 返回缺少 narration 字段");
  }
  if (!Array.isArray(parsed.blessings) || parsed.blessings.length < 2) {
    throw new Error("LLM 返回 blessings 格式不正确");
  }
  if (!parsed.openingText || typeof parsed.openingText !== "string") {
    throw new Error("LLM 返回缺少 openingText 字段");
  }

  // 验证 theme（容错：无效值回退 traditional）
  const validThemes: ThemeType[] = ["traditional", "modern", "cute", "elegant"];
  const theme: ThemeType = validThemes.includes(parsed.theme) ? parsed.theme : "traditional";

  // 验证 joyful（容错：无效值回退 3）
  const joyful = typeof parsed.joyful === "number" && parsed.joyful >= 0 && parsed.joyful <= 5
    ? Math.round(parsed.joyful)
    : 3;

  return {
    ttsOpeningText: parsed.opening,
    ttsBlessingText: parsed.narration,
    blessings: parsed.blessings.slice(0, 6),
    openingText: parsed.openingText,
    theme,
    joyful,
  };
}

// ==================== 模板回退（LLM 不可用时） ====================

type RelationType =
  | "elder" | "friend" | "colleague" | "lover"
  | "junior" | "teacher" | "client" | "general";

const RELATION_KEYWORDS: Record<RelationType, string[]> = {
  elder: ["爸", "妈", "父", "母", "爷", "奶", "外公", "外婆", "姥", "爹", "姑", "姨", "舅", "叔", "伯", "婆婆", "公公", "岳", "长辈", "大爷", "大妈", "阿姨"],
  friend: ["发小", "朋友", "闺蜜", "兄弟", "哥们", "姐妹", "好友", "室友", "同学", "死党", "伙伴", "基友", "损友", "挚友"],
  colleague: ["同事", "领导", "老板", "同僚", "上司", "下属", "合伙人", "搭档", "总监", "经理", "主管", "CEO"],
  lover: ["老婆", "老公", "女朋友", "男朋友", "对象", "爱人", "媳妇", "另一半", "女友", "男友", "未婚", "恋人"],
  junior: ["儿子", "女儿", "孩子", "侄子", "侄女", "外甥", "宝宝", "闺女", "小朋友", "弟弟", "妹妹", "学生"],
  teacher: ["老师", "导师", "教授", "师父", "教练", "师傅"],
  client: ["客户", "甲方", "合作方", "商业伙伴", "合作伙伴"],
  general: [],
};

function classifyRelation(relation: string): RelationType {
  for (const [type, keywords] of Object.entries(RELATION_KEYWORDS)) {
    if (type === "general") continue;
    if (keywords.some((kw) => relation.includes(kw))) return type as RelationType;
  }
  return "general";
}

function seededPick<T>(arr: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) { hash = (hash << 5) - hash + seed.charCodeAt(i); hash |= 0; }
  return arr[Math.abs(hash) % arr.length];
}

// ---- 春节模板 ----
const SPRING_OPENING_TEXTS: Record<RelationType, string[]> = {
  elder: ["老妈新年好", "爸 过年好", "新年平安", "回家过年啦"],
  friend: ["兄弟新年好", "新年暴富", "马年冲冲冲", "过年好呀"],
  colleague: ["新年开工大吉", "马年搞钱顺利", "同事们新年好", "新年不加班"],
  lover: ["宝贝新年好", "和你跨年", "新年第一个想你", "马年继续甜"],
  junior: ["小朋友新年好", "新年快乐鸭", "马年加油", "又长一岁啦"],
  teacher: ["老师新年好", "感谢您这一年", "新春快乐", "马年顺遂"],
  client: ["新年合作愉快", "马年一起发财", "新春大吉", "新年好运来"],
  general: ["新年快乐", "马年大吉", "过年好呀", "新年暴富"],
};

const SPRING_BLESSINGS_POOL: Record<RelationType, string[][]> = {
  elder: [["身体倍儿棒", "吃嘛嘛香", "天天开心", "少操点心"], ["健健康康", "多享享福", "想吃啥吃啥", "我们的靠山"]],
  friend: [["搞钱顺利", "越来越帅", "啥都顺", "继续浪"], ["发大财", "交好运", "别秃头", "一起冲"]],
  colleague: [["升职加薪", "准时下班", "不加班", "年终翻倍"], ["搞钱顺利", "老板看不见", "摸鱼愉快", "早日财务自由"]],
  lover: [["永远喜欢你", "天天黏一起", "甜到齁", "继续宠我"], ["你最好看", "一直在一起", "超爱你", "明年也要在一起"]],
  junior: [["快高长大", "开开心心", "考试全对", "压岁钱翻倍"], ["越来越棒", "天天快乐", "想干嘛干嘛", "未来可期"]],
  teacher: [["少操心我们", "多休息", "身体健康", "您辛苦了"], ["别太累了", "开开心心", "学生们想您", "永远的恩师"]],
  client: [["合作愉快", "一起发财", "越做越大", "订单翻倍"], ["继续搞钱", "合作顺利", "双赢双赢", "明年更猛"]],
  general: [["啥都顺", "发大财", "身体好", "开心就行"], ["万事顺利", "天天开心", "越来越好", "马年冲"]],
};

// ---- 情人节模板 ----
const VALENTINE_OPENING_TEXTS: Record<RelationType, string[]> = {
  elder: ["爸妈永远恩爱", "最甜的你们", "爱意不减当年", "一直这么好"],
  friend: ["单身狗快乐", "友谊比爱情香", "谁说非得有对象", "有你就够了"],
  colleague: ["搞钱不搞对象", "同事也要爱", "工位情人节", "今天不加班"],
  lover: ["想你了", "笨蛋情人节快乐", "你是我的", "超喜欢你"],
  junior: ["小可爱节日快乐", "被爱包围的你", "最可爱的存在", "爱你哟"],
  teacher: ["感谢遇见您", "老师节日快乐", "最温暖的人", "谢谢您"],
  client: ["合作愉快", "一起搞事业", "最佳拍档", "搞钱搞爱两不误"],
  general: ["情人节快乐", "今天要开心", "爱意满满", "快乐就好"],
};

const VALENTINE_BLESSINGS_POOL: Record<RelationType, string[][]> = {
  elder: [["永远恩爱", "甜甜蜜蜜", "越活越年轻", "我们的榜样"], ["一直幸福", "羡慕你们", "天天开心", "最佳CP"]],
  friend: [["有你真好", "友谊万岁", "一起搞事", "比心"], ["脱单随缘", "快乐至上", "永远年轻", "姐妹/兄弟情深"]],
  colleague: [["搞钱搞爱", "两不误", "升职加薪", "顺便脱单"], ["工作顺利", "早日下班", "偷偷摸鱼", "开心最重要"]],
  lover: [["超级爱你", "你最好看", "一直在一起", "么么哒"], ["想你想你", "永远喜欢你", "不许离开", "我的人"]],
  junior: [["快乐长大", "被爱包围", "天天开心", "最可爱"], ["越来越棒", "开开心心", "全世界最好", "爱你呀"]],
  teacher: [["别太辛苦", "多休息", "天天开心", "我们爱您"], ["少操心", "多享受", "永远年轻", "最好的老师"]],
  client: [["合作愉快", "一起搞钱", "越做越大", "双赢"], ["继续合作", "一起发财", "最佳拍档", "明年更猛"]],
  general: [["天天开心", "被人疼着", "越来越好", "爱自己"], ["开心就好", "做自己", "笑口常开", "值得被爱"]],
};

function generateNarrationFromTemplate(
  recipient: Recipient,
  senderName: string,
  festival: FestivalType = "spring"
): GeneratedNarration {
  const relType = classifyRelation(recipient.relation);
  const seed = `${recipient.name}_${recipient.relation}`;

  const OPENING_TEXTS = festival === "valentine" ? VALENTINE_OPENING_TEXTS : SPRING_OPENING_TEXTS;
  const BLESSINGS_POOL = festival === "valentine" ? VALENTINE_BLESSINGS_POOL : SPRING_BLESSINGS_POOL;

  const openingText = seededPick(OPENING_TEXTS[relType], seed);
  const blessings = [...seededPick(BLESSINGS_POOL[relType], seed + "_b")];

  if (festival === "valentine") {
    // 情人节开场语音 — 根据关系类型差异化
    const openersByType: Record<RelationType, string[]> = {
      lover: [
        `${recipient.name}～情人节快乐呀，给你录了个东西快看！`,
        `嘿笨蛋，情人节快乐，看看我给你准备了啥～`,
        `宝贝儿情人节快乐！我给你录了段话你听听哈哈`,
      ],
      friend: [
        `${recipient.name}！情人节快乐哈哈，虽然咱俩不是情侣但我也想给你录一个！`,
        `哎${recipient.name}，别以为情人节跟你没关系，来看看这个～`,
        `${recipient.name}！谁说情人节只能给对象过的，看看这个！`,
      ],
      elder: [
        `${recipient.name}，情人节快乐呀！给您录了段话～`,
        `情人节快乐！给您录了个视频，快看看吧～`,
        `${recipient.name}，今天情人节，给您录了段祝福！`,
      ],
      colleague: [
        `${recipient.name}！情人节快乐～给你录了个东西看看哈`,
        `哎${recipient.name}，情人节快乐！今天不聊工作，看看这个～`,
        `${recipient.name}情人节快乐！别加班了来看看这个哈哈`,
      ],
      junior: [
        `${recipient.name}！情人节快乐呀，给你录了个东西～`,
        `小${recipient.name}情人节快乐！看看这个视频哈哈`,
        `${recipient.name}！情人节快乐，给你录了段话听听～`,
      ],
      teacher: [
        `老师好！情人节快乐，给您录了段祝福～`,
        `${recipient.name}老师，情人节快乐！给您录了个视频看看吧`,
        `老师情人节快乐！学生给您录了段话～`,
      ],
      client: [
        `${recipient.name}！情人节快乐，给您录了段祝福～`,
        `情人节快乐！给您录了个东西看看哈～`,
        `${recipient.name}情人节快乐！来看看这个～`,
      ],
      general: [
        `${recipient.name}！情人节快乐呀，给你录了个东西快看～`,
        `嘿${recipient.name}，情人节快乐！看看这个视频哈哈`,
        `${recipient.name}情人节快乐！给你录了段话～`,
      ],
    };
    const ttsOpeningText = seededPick(openersByType[relType] || openersByType.general, seed + "_vo");

    // 情人节主体祝福语音 — 根据关系差异化
    const blessingParts: string[] = [];
    if (recipient.background?.trim()) {
      const bgIntros: Record<string, string[]> = {
        lover: [`你最近${recipient.background}，我都看在眼里`, `知道你最近${recipient.background}，辛苦啦宝贝`],
        friend: [`你最近${recipient.background}吧，挺好的`, `听说你${recipient.background}了，不错嘛`],
        general: [`你最近${recipient.background}，挺好的`, `知道你最近${recipient.background}`],
      };
      const bgKey = relType === "lover" ? "lover" : relType === "friend" ? "friend" : "general";
      blessingParts.push(seededPick(bgIntros[bgKey], seed + "_bg"));
    }
    if (relType === "lover") {
      blessingParts.push(`${blessings.slice(0, 2).join("，")}，以后也要${blessings.slice(2, 3).join("")}`);
      blessingParts.push(`${senderName}永远站你这边`);
    } else if (relType === "friend") {
      blessingParts.push(`今天不管有没有对象，反正有我呢`);
      blessingParts.push(`${blessings.slice(0, 2).join("，")}，咱们的友谊比爱情靠谱多了哈哈`);
    } else {
      blessingParts.push(`${blessings.slice(0, 2).join("，")}`);
      blessingParts.push(`${blessings.slice(2).join("，")}，${senderName}祝你情人节快乐`);
    }
    const ttsBlessingText = blessingParts.join("。") + "！";

    const theme = suggestTheme(recipient.relation, recipient.background);
    // 情人节模板 joyful: lover=4, friend=4, 其他=3
    const joyful = ["lover", "friend"].includes(relType) ? 4 : 3;
    return { openingText, blessings, ttsOpeningText, ttsBlessingText, theme, joyful };
  }

  // 春节开场语音 — 根据关系差异化
  const openersByType: Record<RelationType, string[]> = {
    elder: [
      `${recipient.name}，过年好！给您录了段拜年的话，您听听～`,
      `${recipient.name}新年好！今年不能回去，给您录了个视频拜年～`,
      `${recipient.name}！过年好呀，给您拜年啦！`,
    ],
    friend: [
      `哟${recipient.name}！新年好啊！给你录了个东西你看看哈哈`,
      `${recipient.name}！过年好！好久没见了，给你录了段话～`,
      `嘿${recipient.name}！马年快乐！来看看这个～`,
    ],
    colleague: [
      `${recipient.name}新年好！给你录了段拜年的话哈～`,
      `${recipient.name}！过年好！新年第一天不聊工作，看看这个～`,
      `嘿${recipient.name}，新年快乐！给你录了个东西～`,
    ],
    lover: [
      `宝贝新年快乐！给你录了个东西快看～`,
      `${recipient.name}～过年好呀！看看我给你录了啥哈哈`,
      `新年快乐宝贝！给你录了段话你听听～`,
    ],
    junior: [
      `${recipient.name}！新年快乐呀，给你录了个东西看看～`,
      `小${recipient.name}过年好！看看这个视频哈哈`,
      `${recipient.name}新年好！给你录了段话～`,
    ],
    teacher: [
      `老师新年好！给您录了段拜年的话～`,
      `${recipient.name}老师过年好！学生给您拜年啦～`,
      `老师新年快乐！给您录了个视频～`,
    ],
    client: [
      `${recipient.name}新年好！给您录了段拜年的话～`,
      `${recipient.name}！过年好，新年第一个祝福给您！`,
      `新年快乐！给您录了个东西看看～`,
    ],
    general: [
      `${recipient.name}！新年好呀，给你录了个东西快看～`,
      `嘿${recipient.name}，过年好！看看这个视频哈哈`,
      `${recipient.name}新年快乐！给你录了段话～`,
    ],
  };
  const ttsOpeningText = seededPick(openersByType[relType] || openersByType.general, seed + "_so");

  // 主体祝福语音 — 根据关系差异化
  const blessingParts: string[] = [];
  if (recipient.background?.trim()) {
    const bgIntros: Record<string, string[]> = {
      elder: [`知道您最近${recipient.background}，真替您高兴`, `您最近${recipient.background}，我们都放心了`],
      friend: [`你最近${recipient.background}吧，不错嘛`, `听说你${recipient.background}了，可以啊`],
      lover: [`你最近${recipient.background}，辛苦啦`, `知道你${recipient.background}，心疼你`],
      general: [`你最近${recipient.background}，挺好的`, `知道你最近${recipient.background}`],
    };
    const bgKey = ["elder", "friend", "lover"].includes(relType) ? relType : "general";
    blessingParts.push(seededPick(bgIntros[bgKey], seed + "_bg"));
  }
  if (relType === "elder") {
    blessingParts.push(`新的一年就希望您${blessings.slice(0, 2).join("，")}`);
    blessingParts.push(`${blessings.slice(2).join("，")}，${senderName}给您拜年了`);
  } else if (relType === "friend") {
    blessingParts.push(`新的一年嘛，${blessings.slice(0, 2).join("，")}`);
    blessingParts.push(`${blessings.slice(2).join("，")}，${senderName}给你拜年啦`);
  } else if (relType === "lover") {
    blessingParts.push(`新的一年继续在一起，${blessings.slice(0, 2).join("，")}`);
    blessingParts.push(`${senderName}爱你，马年也要甜甜的`);
  } else {
    blessingParts.push(`新的一年希望你${blessings.slice(0, 2).join("，")}`);
    blessingParts.push(`${blessings.slice(2).join("，")}，${senderName}给你拜年啦`);
  }
  const ttsBlessingText = blessingParts.join("。") + "！";

  // 模板回退时用关键词匹配选主题
  const theme = suggestTheme(recipient.relation, recipient.background);
  // 春节模板默认 joyful: friend=4, lover=4, junior=4, 其他=3
  const joyful = ["friend", "lover", "junior"].includes(relType) ? 4 : 3;

  return { openingText, blessings, ttsOpeningText, ttsBlessingText, theme, joyful };
}

// ==================== 统一入口 ====================

/**
 * 生成个性化祝福文案
 * 优先 LLM，失败回退模板
 * @param audioFilePath 可选，发送者录制视频的音频文件路径，会作为上下文发给 Gemini
 */
export async function generateNarration(
  recipient: Recipient,
  senderName: string,
  festival: FestivalType = "spring",
  audioFilePath?: string
): Promise<GeneratedNarration> {
  if (isLLMConfigured()) {
    try {
      console.log(`🤖 正在为 ${recipient.name} 调用 LLM 生成个性化文案 (${festival})${audioFilePath ? " [含音频上下文]" : ""}...`);
      const result = await generateNarrationWithLLM(recipient, senderName, festival, audioFilePath);
      console.log(`✅ LLM 文案生成成功 (开场${result.ttsOpeningText.length}字 + 祝福${result.ttsBlessingText.length}字, 主题: ${result.theme})`);
      return result;
    } catch (err: any) {
      console.warn(`⚠️ LLM 生成失败，回退到模板: ${err.message}`);
    }
  }

  console.log(`📝 使用模板为 ${recipient.name} 生成文案 (${festival})`);
  return generateNarrationFromTemplate(recipient, senderName, festival);
}
