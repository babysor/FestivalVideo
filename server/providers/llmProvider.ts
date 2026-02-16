/**
 * LLM Provider 抽象层
 * 定义 LLM 提供商接口，支持 Gemini / OpenAI / Claude 等切换。
 */

import fetch from "node-fetch";
import fs from "fs";
import type { GeneratedNarration, FestivalType, ThemeType } from "../types";
import { validThemes } from "../../src/themes";
import { getFestivalNarration } from "../../src/festivals";
import type { Recipient } from "../../src/types";

// ==================== 接口定义 ====================

export interface LLMProvider {
  readonly name: string;

  /** 检查是否已配置 */
  isConfigured(): boolean;

  /**
   * 生成祝福文案
   * @param recipient - 收信人信息
   * @param senderName - 发送者名字
   * @param festival - 节日类型
   * @param audioFilePath - 可选参考音频
   */
  generateNarration(
    recipient: Recipient,
    senderName: string,
    festival: FestivalType,
    audioFilePath?: string
  ): Promise<GeneratedNarration>;
}

// ==================== Gemini 实现 ====================

export class GeminiLLMProvider implements LLMProvider {
  readonly name = "Gemini";
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey?: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || "";
    this.model = model || process.env.GEMINI_MODEL || "gemini-2.0-flash";
    this.baseUrl =
      baseUrl ||
      process.env.GEMINI_BASE_URL ||
      "https://generativelanguage.googleapis.com/v1beta";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async generateNarration(
    recipient: Recipient,
    senderName: string,
    festival: FestivalType = "spring",
    audioFilePath?: string
  ): Promise<GeneratedNarration> {
    const hasAudio = !!audioFilePath && fs.existsSync(audioFilePath);
    const festivalNarration = getFestivalNarration(festival);

    const themeOptions = validThemes
      .map((t) => `"${t}"`)
      .join(", ");

    const userPrompt = this.buildUserPrompt(recipient, senderName, festival, hasAudio, themeOptions);
    const systemPrompt = festivalNarration.systemPrompt;
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const userParts: Array<Record<string, any>> = [];

    if (hasAudio) {
      try {
        const audioBytes = fs.readFileSync(audioFilePath!);
        const audioBase64 = audioBytes.toString("base64");
        const audioSizeMB = audioBytes.length / (1024 * 1024);
        console.log(`   🎵 附加音频到 Gemini 请求 (${audioSizeMB.toFixed(1)}MB)`);

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
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: userParts }],
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
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error("Gemini 返回内容为空");
    }

    const parsed = this.extractJSON(content);

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

    const theme: ThemeType = validThemes.includes(parsed.theme)
      ? parsed.theme
      : "traditional";

    const joyful =
      typeof parsed.joyful === "number" && parsed.joyful >= 0 && parsed.joyful <= 5
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

  private buildUserPrompt(
    recipient: Recipient,
    senderName: string,
    festival: FestivalType,
    hasAudio: boolean,
    themeOptions: string
  ): string {
    const audioHint = hasAudio
      ? `\n\n⚠️ 重要：我附了发送者录的视频音频。先听听他/她怎么说话的，然后：
- 模仿音频里的说话方式和语气
- 别重复音频里已经说过的内容
- 写出来要像同一个人在继续说`
      : "";

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

选一个视频风格（${themeOptions}）。

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

  private extractJSON(text: string): any {
    try {
      return JSON.parse(text.trim());
    } catch {}

    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {}
    }

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {}
    }

    throw new Error("无法从 LLM 响应中解析 JSON");
  }
}
