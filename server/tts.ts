/**
 * TTS Service — 向后兼容的包装层
 * 实际实现已迁移到 providers/ttsProvider.ts
 */

import { NoizTTSProvider, type TTSResult } from "./providers/ttsProvider";

const provider = new NoizTTSProvider();

export function isCustomTTSConfigured(): boolean {
  return provider.isConfigured();
}

export type CustomTTSResult = TTSResult;

export async function uploadVoiceFromAudio(audioFilePath: string): Promise<string> {
  return provider.uploadVoice(audioFilePath);
}

export async function deleteVoice(voiceId: string): Promise<void> {
  return provider.deleteVoice(voiceId);
}

export async function generateCustomSpeech(
  text: string,
  voiceId: string
): Promise<CustomTTSResult> {
  return provider.generateSpeech(text, voiceId);
}
