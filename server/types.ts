/**
 * 服务端共享类型定义
 */

import type { Recipient, GeneratedNarration, ThemeType, FestivalType } from "../src/types";

export type { Recipient, GeneratedNarration, ThemeType, FestivalType };

// ==================== 批量任务相关类型 ====================

export interface BatchItem {
  index: number;
  recipient: Recipient;
  status: "pending" | "processing" | "done" | "error";
  narration?: GeneratedNarration;
  theme?: ThemeType;
  videoUrl?: string;
  filename?: string;
  error?: string;
}

export interface BatchJob {
  id: string;
  senderName: string;
  videoFile: string;
  audioFile?: string;
  festival: FestivalType;
  extractedAudioPath?: string;
  dedicatedAudioPath?: string;
  voiceId?: string;
  userVideoDurationSec?: number;
  items: BatchItem[];
  createdAt: number;
  previewOnly?: boolean;
  status: "processing" | "done" | "error";
}

// ==================== API 请求/响应类型 ====================

export interface ValidatedBatchInput {
  senderName: string;
  recipients: Recipient[];
  festival: FestivalType;
  videoFile: string;
  audioFile?: string;
  batchId: string;
}

export interface BatchPreviewResult {
  batchId: string;
  total: number;
  items?: Array<{
    index: number;
    recipientName: string;
    relation: string;
    background: string;
    narration: {
      openingText: string;
      blessings: string[];
      ttsOpeningText: string;
      ttsBlessingText: string;
      theme: ThemeType;
      themeName: string;
      joyful: number;
    };
  }>;
}

export interface BatchStatusResponse {
  batchId: string;
  status: BatchJob["status"];
  total: number;
  completed: number;
  items: Array<{
    index: number;
    recipientName: string;
    relation: string;
    theme: ThemeType | null;
    themeName: string | null;
    status: BatchItem["status"];
    videoUrl?: string;
    filename?: string;
    error?: string;
    narration: {
      openingText: string;
      blessings: string[];
      ttsOpeningText: string;
      ttsBlessingText: string;
      joyful: number;
    } | null;
  }>;
}
