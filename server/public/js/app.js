/**
 * 应用主入口 — 模块协调
 */

import { state } from "./state.js";
import { $ } from "./utils.js";
import { getCurrentConfig } from "./festivalConfig.js";
import { createParticles } from "./particles.js";
import { setupUpload, switchVideoMode, openCamera, toggleRecording, retakeRecording, resetVideoUI, stopCamera } from "./video.js";
import { toggleAudioRecord, toggleAudioRecording, retakeAudioRecording, resetAudioUI } from "./audio.js";
import { addRecipient, removeRecipient, getRecipients } from "./recipients.js";
import { showPreview, pauseCountdown, resumeCountdown, stopCountdown, collectNarrations } from "./preview.js";
import { renderProgressItems, startPolling, downloadAll } from "./progress.js";

// ==================== 表单提交 ====================

async function handleSubmit() {
  const senderName = $("senderNameInput").value.trim();
  const btn = $("submitBtn");

  if (!senderName) { alert("请输入您的名字"); return; }
  if (!state.selectedVideoFile) { alert("请上传或录制一段祝福视频"); return; }
  const recipients = getRecipients();
  if (recipients.length === 0) { alert("请至少添加一个有效的祝福对象（名字和关系不能为空）"); return; }

  const formData = new FormData();
  formData.append("senderName", senderName);
  formData.append("video", state.selectedVideoFile);
  formData.append("recipients", JSON.stringify(recipients));
  formData.append("festival", state.currentFestival);
  if (state.audioRecordEnabled && state.selectedAudioFile) {
    formData.append("audio", state.selectedAudioFile);
  }

  btn.disabled = true;
  $("submitBtnText").textContent = "⏳ 正在生成台词预览...";

  try {
    const res = await fetch("/api/batch-preview", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "请求失败");

    state.previewData = data;
    state.currentBatchId = data.batchId;

    $("formSection").style.display = "none";
    showPreview(data);
  } catch (err) {
    alert("台词生成失败：" + err.message);
  } finally {
    btn.disabled = false;
    $("submitBtnText").textContent = getCurrentConfig(state.currentFestival).submitText;
  }
}

// ==================== 返回表单 ====================

function backToForm() {
  stopCountdown();
  $("previewSection").classList.remove("active");
  $("formSection").style.display = "block";
  state.previewData = null;
  state.currentBatchId = null;
}

// ==================== 确认台词并渲染 ====================

async function confirmAndRender() {
  stopCountdown();
  if (!state.previewData || !state.currentBatchId || state.isConfirming) return;
  state.isConfirming = true;

  const btnConfirm = $("btnConfirm");
  btnConfirm.disabled = true;
  btnConfirm.textContent = "⏳ 正在启动视频制作...";

  const narrations = collectNarrations();

  try {
    const res = await fetch("/api/batch-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: state.currentBatchId, narrations }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "确认失败");

    $("previewSection").classList.remove("active");
    $("progressSection").classList.add("active");

    const recipients = state.previewData.items.map((item) => ({
      name: item.recipientName,
      relation: item.relation,
      background: item.background,
    }));

    $("progressTitle").textContent = "🎬 正在制作祝福视频...";
    $("progressSub").textContent = `共 ${recipients.length} 个视频，AI 语音克隆 + 视频渲染，每个约 1-2 分钟`;

    renderProgressItems(recipients);
    startPolling();
  } catch (err) {
    state.isConfirming = false;
    alert("启动渲染失败：" + err.message);
    btnConfirm.disabled = false;
    btnConfirm.textContent = "✨ 确认台词，开始制作";
  }
}

// ==================== 重置 ====================

function resetForm() {
  state.currentBatchId = null;
  state.previewData = null;
  state.isConfirming = false;
  stopCountdown();
  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }

  $("formSection").style.display = "block";
  $("previewSection").classList.remove("active");
  $("progressSection").classList.remove("active");
  $("resultSection").classList.remove("active");
  $("submitBtn").disabled = false;
  $("senderNameInput").value = "";
  state.selectedVideoFile = null;

  resetVideoUI();
  resetAudioUI();
  switchVideoMode("record");

  $("recipientList").innerHTML = "";
  state.recipientCount = 0;
  addRecipient();
  addRecipient();
  addRecipient();
}

// ==================== 暴露给 HTML onclick 的全局 API ====================

window.__app = {
  switchVideoMode,
  openCamera,
  toggleRecording,
  retakeRecording,
  toggleAudioRecord,
  toggleAudioRecording,
  retakeAudioRecording,
  addRecipient,
  removeRecipient,
  handleSubmit,
  backToForm,
  confirmAndRender,
  resetForm,
  downloadAll,
  pauseCountdown,
  resumeCountdown,
};

// ==================== 初始化 ====================

function init() {
  createParticles();
  setupUpload();
  addRecipient();
  addRecipient();
  addRecipient();
}

init();
