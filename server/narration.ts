/**
 * 个性化祝福文案生成
 * 优先使用 LLM 根据收信人信息深度定制，LLM 不可用时回退到模板。
 * 节日模板数据统一从 festivals.ts 读取，无需为新节日修改此文件。
 */

import { suggestTheme } from "../src/themes";
import { classifyRelation } from "../src/relationClassifier";
import { getFestivalNarration } from "../src/festivals";
import { GeminiLLMProvider } from "./providers/llmProvider";
import type {
  ThemeType,
  FestivalType,
  RelationType,
  Recipient,
  GeneratedNarration,
} from "../src/types";

// 导出类型以保持向后兼容
export type { ThemeType, FestivalType, Recipient, GeneratedNarration };

// ==================== LLM Provider 实例 ====================

const llmProvider = new GeminiLLMProvider();

export function isLLMConfigured(): boolean {
  return llmProvider.isConfigured();
}

// ==================== 模板回退（LLM 不可用时） ====================

function seededPick<T>(arr: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return arr[Math.abs(hash) % arr.length];
}

function generateNarrationFromTemplate(
  recipient: Recipient,
  senderName: string,
  festival: FestivalType = "spring"
): GeneratedNarration {
  const relType = classifyRelation(recipient.relation);
  const seed = `${recipient.name}_${recipient.relation}`;
  const templates = getFestivalNarration(festival);

  // 开场标题
  const openingTexts = templates.openingTexts[relType] || templates.openingTexts.general;
  const openingText = seededPick(openingTexts, seed);

  // 祝福短语
  const blessingsPool = templates.blessingsPool[relType] || templates.blessingsPool.general;
  const blessings = [...seededPick(blessingsPool, seed + "_b")];

  // 开场语音
  const voiceTemplates = templates.openingVoiceTemplates[relType] || templates.openingVoiceTemplates.general;
  const ttsOpeningText = seededPick(voiceTemplates, seed + "_so").replace(/{name}/g, recipient.name);

  // 祝福语音（通过配置中的 builder 函数构建）
  const ttsBlessingText = templates.blessingVoiceBuilder(relType, recipient, senderName, blessings);

  // 主题推荐
  const theme = suggestTheme(recipient.relation, recipient.background);

  // 默认 joyful
  const joyful = ["friend", "lover", "junior"].includes(relType) ? 4 : 3;

  return { openingText, blessings, ttsOpeningText, ttsBlessingText, theme, joyful };
}

// ==================== 统一入口 ====================

/**
 * 生成个性化祝福文案
 * 优先 LLM，失败回退模板
 */
export async function generateNarration(
  recipient: Recipient,
  senderName: string,
  festival: FestivalType = "spring",
  audioFilePath?: string
): Promise<GeneratedNarration> {
  if (llmProvider.isConfigured()) {
    try {
      console.log(
        `🤖 正在为 ${recipient.name} 调用 LLM 生成个性化文案 (${festival})${audioFilePath ? " [含音频上下文]" : ""}...`
      );
      const result = await llmProvider.generateNarration(recipient, senderName, festival, audioFilePath);
      console.log(
        `✅ LLM 文案生成成功 (开场${result.ttsOpeningText.length}字 + 祝福${result.ttsBlessingText.length}字, 主题: ${result.theme})`
      );
      return result;
    } catch (err: any) {
      console.warn(`⚠️ LLM 生成失败，回退到模板: ${err.message}`);
    }
  }

  console.log(`📝 使用模板为 ${recipient.name} 生成文案 (${festival})`);
  return generateNarrationFromTemplate(recipient, senderName, festival);
}
