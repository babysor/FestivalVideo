/**
 * API 请求验证 Schema（使用 zod）
 * 添加新字段时只需更新 schema，验证逻辑自动生效。
 */

import { z } from "zod";
import { validThemes } from "../../src/themes";
import { validFestivals } from "../../src/festivals";

// ==================== 基础类型 ====================

export const recipientSchema = z.object({
  name: z.string().min(1, "名字不能为空").max(20, "名字最长 20 字").transform((s) => s.trim()),
  relation: z.string().min(1, "关系不能为空").max(50, "关系描述最长 50 字").transform((s) => s.trim()),
  background: z.string().max(200, "背景描述最长 200 字").default("").transform((s) => s.trim()),
});

export type RecipientInput = z.infer<typeof recipientSchema>;

// ==================== 批量预览/渲染请求 ====================

export const batchRequestSchema = z.object({
  senderName: z.string().min(1, "请输入您的名字").max(20, "名字最长 20 字").transform((s) => s.trim()),
  recipients: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    },
    z.array(recipientSchema).min(1, "请添加至少一个祝福对象").max(50, "最多 50 个祝福对象")
  ),
  festival: z
    .enum(validFestivals as [string, ...string[]])
    .default("spring")
    .optional(),
});

export type BatchRequestInput = z.infer<typeof batchRequestSchema>;

// ==================== 确认渲染请求 ====================

export const batchConfirmSchema = z.object({
  batchId: z.string().min(1, "缺少 batchId"),
  narrations: z
    .array(
      z.object({
        index: z.number().int().min(0),
        openingText: z.string().max(50).optional(),
        ttsOpeningText: z.string().max(200).optional(),
        ttsBlessingText: z.string().max(500).optional(),
        blessings: z.array(z.string().max(20)).max(8).optional(),
        joyful: z.number().int().min(0).max(5).optional(),
        theme: z.enum(validThemes as [string, ...string[]]).optional(),
      })
    )
    .optional(),
});

export type BatchConfirmInput = z.infer<typeof batchConfirmSchema>;
