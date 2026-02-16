/**
 * TTS Provider 抽象层
 * 定义 TTS 提供商接口，支持 Noiz / ElevenLabs / Azure 等切换。
 */

// ==================== 接口定义 ====================

export interface TTSResult {
  audioData: string; // base64-encoded audio
  mimeType: string;
}

export interface TTSProvider {
  readonly name: string;

  /** 检查是否已配置 */
  isConfigured(): boolean;

  /** 上传参考音频，创建声音克隆，返回 voice ID */
  uploadVoice(audioFilePath: string): Promise<string>;

  /** 删除克隆的声音 */
  deleteVoice(voiceId: string): Promise<void>;

  /** 使用克隆声音生成 TTS 语音 */
  generateSpeech(text: string, voiceId: string): Promise<TTSResult>;
}

// ==================== Noiz 实现 ====================

import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import path from "path";

export class NoizTTSProvider implements TTSProvider {
  readonly name = "Noiz";
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.NOIZ_API_KEY || "";
    this.baseUrl = baseUrl || "https://noiz.ai/v1";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async uploadVoice(audioFilePath: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("Noiz API key not configured (set NOIZ_API_KEY)");
    }
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    const ext = path.extname(audioFilePath).slice(1) || "wav";
    const mimeType = `audio/${ext}`;

    const formData = new FormData();
    formData.append("file", fs.createReadStream(audioFilePath), {
      filename: path.basename(audioFilePath),
      contentType: mimeType,
    });
    formData.append("display_name", `voice_clone_${Date.now()}`);

    const response = await fetch(`${this.baseUrl}/voices`, {
      method: "POST",
      headers: {
        Authorization: this.apiKey,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Noiz voice upload error: ${response.status}, ${errorText}`);
    }

    const result = (await response.json()) as any;
    if (result.code !== 0) {
      throw new Error(`Noiz voice upload failed: ${result.message}`);
    }

    const voiceId = result.data?.voice_id;
    if (!voiceId) {
      throw new Error("Noiz voice upload returned no voice_id");
    }

    return voiceId;
  }

  async deleteVoice(voiceId: string): Promise<void> {
    if (!this.apiKey) return;

    try {
      await fetch(`${this.baseUrl}/voices/${voiceId}`, {
        method: "DELETE",
        headers: { Authorization: this.apiKey },
      });
    } catch (err: any) {
      console.warn(`⚠️ Failed to delete voice ${voiceId}:`, err.message);
    }
  }

  async generateSpeech(text: string, voiceId: string): Promise<TTSResult> {
    if (!this.apiKey) {
      throw new Error("Noiz API key not configured (set NOIZ_API_KEY)");
    }

    const sanitized = this.sanitizeText(text);
    if (!sanitized) {
      throw new Error("TTS text is empty");
    }

    const params = new URLSearchParams();
    params.append("text", sanitized);
    params.append("voice_id", voiceId);
    params.append("output_format", "mp3");

    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/text-to-speech`, {
          method: "POST",
          headers: {
            Authorization: this.apiKey,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Noiz TTS error: ${response.status}, ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);

        return {
          audioData: audioBuffer.toString("base64"),
          mimeType: "audio/mp3",
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`TTS attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(3, attempt), 9000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("TTS generation failed after retries");
  }

  private sanitizeText(text: string): string {
    if (!text) return "";
    let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    sanitized = sanitized.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    sanitized = sanitized.replace(/\n\s*\n/g, "\n").replace(/[ \t]+/g, " ");
    sanitized = sanitized.trim();
    const maxLength = 10000;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.slice(0, maxLength) + "...";
    }
    return sanitized;
  }
}
