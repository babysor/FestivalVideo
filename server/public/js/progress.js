/**
 * 进度追踪与结果展示模块
 */

import { state } from "./state.js";
import { escapeHtml, $ } from "./utils.js";

export function renderProgressItems(recipients) {
  const container = $("progressItems");
  container.innerHTML = recipients
    .map((r, i) => {
      const detail = r.background ? `${escapeHtml(r.relation)} · ${escapeHtml(r.background)}` : escapeHtml(r.relation);
      return `
      <div class="progress-item" id="progress-item-${i}">
        <div class="status-icon pending" id="progress-icon-${i}">⏳</div>
        <div class="item-info">
          <div class="item-name">${escapeHtml(r.name)}</div>
          <div class="item-detail">${detail}</div>
        </div>
      </div>
    `;
    })
    .join("");
}

export function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(pollStatus, 2000);
  pollStatus();
}

async function pollStatus() {
  if (!state.currentBatchId) return;

  try {
    const res = await fetch(`/api/batch-status/${state.currentBatchId}`);
    const data = await res.json();

    if (!res.ok) {
      console.error("轮询失败:", data.error);
      return;
    }

    const percent = data.total > 0 ? (data.completed / data.total) * 100 : 0;
    $("progressBar").style.width = percent + "%";

    data.items.forEach((item) => {
      const icon = document.getElementById(`progress-icon-${item.index}`);
      if (!icon) return;
      icon.classList.remove("pending", "processing", "done", "error");
      switch (item.status) {
        case "pending":
          icon.classList.add("pending");
          icon.textContent = "⏳";
          break;
        case "processing":
          icon.classList.add("processing");
          icon.textContent = "⚙️";
          break;
        case "done":
          icon.classList.add("done");
          icon.textContent = "✅";
          break;
        case "error":
          icon.classList.add("error");
          icon.textContent = "❌";
          break;
      }
    });

    if (data.status === "done" || data.status === "error") {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
      setTimeout(() => showResults(data), 800);
    }
  } catch (e) {
    console.error("轮询异常:", e);
  }
}

function showResults(data) {
  $("progressSection").classList.remove("active");
  $("resultSection").classList.add("active");

  const doneCount = data.items.filter((i) => i.status === "done").length;
  const errorCount = data.items.filter((i) => i.status === "error").length;

  let summary = `成功生成 ${doneCount} 个视频`;
  if (errorCount > 0) summary += `，${errorCount} 个失败`;
  $("resultSummary").textContent = summary;

  $("downloadAllBtn").style.display = doneCount > 0 ? "inline-flex" : "none";

  $("resultItems").innerHTML = data.items
    .map((item) => {
      if (item.status === "done" && item.videoUrl) {
        return `
        <div class="result-item">
          <video src="${item.videoUrl}" controls playsinline preload="metadata"></video>
          <div class="result-info">
            <div class="result-name">致 ${escapeHtml(item.recipientName)}</div>
            <div class="result-relation">${escapeHtml(item.relation)}${item.themeName ? ` · 🎨 ${item.themeName}` : ""}</div>
            <a class="btn-download-single" href="${item.videoUrl}" download="${item.filename || ""}">📥 下载视频</a>
          </div>
        </div>
      `;
      } else if (item.status === "error") {
        return `
        <div class="result-item" style="opacity: 0.6;">
          <div style="width:140px;aspect-ratio:9/16;background:rgba(255,60,60,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0;">❌</div>
          <div class="result-info">
            <div class="result-name">致 ${escapeHtml(item.recipientName)}</div>
            <div class="result-relation">${escapeHtml(item.relation)}${item.themeName ? ` · 🎨 ${item.themeName}` : ""}</div>
            <div class="result-status-error">生成失败: ${escapeHtml(item.error || "未知错误")}</div>
          </div>
        </div>
      `;
      }
      return "";
    })
    .join("");
}

export function downloadAll() {
  if (!state.currentBatchId) return;
  window.location.href = `/api/batch-download/${state.currentBatchId}`;
}
