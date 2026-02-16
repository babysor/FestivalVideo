/**
 * JobStore 抽象层
 * 提供任务存储接口，方便切换存储后端（内存 / Redis / Firestore 等）
 */

import type { BatchJob } from "../types";

// ==================== 接口定义 ====================

export interface JobStore {
  get(id: string): BatchJob | undefined;
  set(id: string, job: BatchJob): void;
  delete(id: string): void;
  has(id: string): boolean;
  entries(): IterableIterator<[string, BatchJob]>;
}

// ==================== 内存实现 ====================

export class InMemoryJobStore implements JobStore {
  private store = new Map<string, BatchJob>();

  get(id: string): BatchJob | undefined {
    return this.store.get(id);
  }

  set(id: string, job: BatchJob): void {
    this.store.set(id, job);
  }

  delete(id: string): void {
    this.store.delete(id);
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  entries(): IterableIterator<[string, BatchJob]> {
    return this.store.entries();
  }
}
