/**
 * 视频上传与录制模块
 */

import { state } from "./state.js";
import { $ } from "./utils.js";

// ==================== 视频上传 ====================

export function setupUpload() {
  const area = $("uploadArea");
  const input = $("videoInput");

  area.addEventListener("dragover", (e) => {
    e.preventDefault();
    area.style.borderColor = "rgba(255, 215, 0, 0.8)";
  });
  area.addEventListener("dragleave", () => {
    area.style.borderColor = "";
  });
  area.addEventListener("drop", (e) => {
    e.preventDefault();
    area.style.borderColor = "";
    if (e.dataTransfer.files[0]) {
      input.files = e.dataTransfer.files;
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });
  input.addEventListener("change", () => {
    if (input.files[0]) handleFileSelect(input.files[0]);
  });
}

export function handleFileSelect(file) {
  const area = $("uploadArea");
  area.classList.add("has-file");
  state.selectedVideoFile = file;

  const video = document.createElement("video");
  video.preload = "metadata";
  video.onloadedmetadata = () => {
    URL.revokeObjectURL(video.src);
    const duration = video.duration;
    if (duration < 2 || duration > 30) {
      state.selectedVideoFile = null;
      area.innerHTML = `
        <div class="upload-icon">⚠️</div>
        <div class="upload-text" style="color: #ff6b6b;">视频时长 ${duration.toFixed(1)}秒，建议3-10秒</div>
        <div class="upload-hint">点击重新选择</div>
        <input type="file" id="videoInput" accept="video/mp4,video/*">
      `;
      area.classList.remove("has-file");
      setupUpload();
      return;
    }
    area.innerHTML = `
      <div class="upload-icon">✅</div>
      <div class="upload-text">视频已选择</div>
      <div class="file-name">${file.name} (${duration.toFixed(1)}秒, ${(file.size / 1024 / 1024).toFixed(1)}MB)</div>
      <video src="${URL.createObjectURL(file)}" muted loop autoplay playsinline></video>
      <div class="upload-hint" style="margin-top: 8px;">点击更换视频</div>
      <input type="file" id="videoInput" accept="video/mp4,video/*">
    `;
    setupUpload();
  };
  video.src = URL.createObjectURL(file);
}

// ==================== 视频模式切换 ====================

export function switchVideoMode(mode) {
  state.currentVideoMode = mode;
  document.querySelectorAll(".video-tab").forEach((tab, i) => {
    tab.classList.toggle("active", (i === 0 && mode === "upload") || (i === 1 && mode === "record"));
  });
  $("panelUpload").classList.toggle("active", mode === "upload");
  $("panelRecord").classList.toggle("active", mode === "record");

  if (mode === "upload") {
    stopCamera();
  }
}

// ==================== 摄像头 & 录制 ====================

export async function openCamera() {
  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } },
      audio: true,
    });

    const cameraFeed = $("cameraFeed");
    cameraFeed.srcObject = state.cameraStream;
    cameraFeed.style.display = "block";
    $("recordPlayback").style.display = "none";
    $("recordPlaceholder").style.display = "none";
    $("btnOpenCamera").style.display = "none";
    $("btnRecord").style.display = "flex";
    $("recordDoneBar").classList.remove("active");
  } catch (err) {
    console.error("摄像头访问失败:", err);
    if (err.name === "NotAllowedError") {
      alert("请允许访问摄像头和麦克风权限后重试");
    } else if (err.name === "NotFoundError") {
      alert("未检测到摄像头设备");
    } else {
      alert("摄像头开启失败: " + err.message);
    }
  }
}

export function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((t) => t.stop());
    state.cameraStream = null;
  }
  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
    state.mediaRecorder = null;
  }
  clearInterval(state.recordTimerInterval);
  state.recordTimerInterval = null;
}

export function toggleRecording() {
  if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") {
    startRecording();
  } else {
    stopRecording();
  }
}

function startRecording() {
  if (!state.cameraStream) return;

  state.recordedChunks = [];

  const mimeOptions = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  let mimeType = "";
  for (const m of mimeOptions) {
    if (MediaRecorder.isTypeSupported(m)) { mimeType = m; break; }
  }

  state.mediaRecorder = new MediaRecorder(state.cameraStream, mimeType ? { mimeType } : {});
  state.mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) state.recordedChunks.push(e.data);
  };
  state.mediaRecorder.onstop = () => { onRecordingStopped(); };
  state.mediaRecorder.start(100);

  $("btnRecord").classList.add("recording");
  $("btnRecord").title = "停止录制";

  state.recordStartTime = Date.now();
  $("recordTimer").classList.add("active");
  updateRecordTimer();
  state.recordTimerInterval = setInterval(updateRecordTimer, 200);

  setTimeout(() => {
    if (state.mediaRecorder && state.mediaRecorder.state === "recording") {
      stopRecording();
    }
  }, 15000);
}

function stopRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state === "recording") {
    state.mediaRecorder.stop();
  }
  clearInterval(state.recordTimerInterval);
  state.recordTimerInterval = null;
  $("recordTimer").classList.remove("active");
  $("btnRecord").classList.remove("recording");
  $("btnRecord").title = "开始录制";
}

function updateRecordTimer() {
  const elapsed = (Date.now() - state.recordStartTime) / 1000;
  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(Math.floor(elapsed % 60)).padStart(2, "0");
  $("recordTimerText").textContent = `${mins}:${secs}`;
}

function onRecordingStopped() {
  stopCamera();

  const blob = new Blob(state.recordedChunks, { type: state.recordedChunks[0]?.type || "video/webm" });
  const duration = ((Date.now() - state.recordStartTime) / 1000).toFixed(1);

  if (parseFloat(duration) < 2) {
    alert("录制太短啦，请至少录 3 秒");
    retakeRecording();
    return;
  }

  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const file = new File([blob], `recording_${Date.now()}.${ext}`, { type: blob.type });
  state.selectedVideoFile = file;

  $("cameraFeed").style.display = "none";
  $("recordPlayback").src = URL.createObjectURL(blob);
  $("recordPlayback").style.display = "block";
  $("btnRecord").style.display = "none";
  $("recordDoneBar").classList.add("active");
  $("recordDoneText").textContent = `✅ 录制完成 (${duration}秒, ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
}

export function retakeRecording() {
  state.selectedVideoFile = null;
  state.recordedChunks = [];

  $("cameraFeed").style.display = "none";
  $("cameraFeed").srcObject = null;
  $("recordPlayback").style.display = "none";
  $("recordPlayback").src = "";
  $("recordPlaceholder").style.display = "block";
  $("btnOpenCamera").style.display = "inline-flex";
  $("btnRecord").style.display = "none";
  $("btnRecord").classList.remove("recording");
  $("recordDoneBar").classList.remove("active");
  $("recordTimer").classList.remove("active");

  openCamera();
}

export function resetVideoUI() {
  stopCamera();
  state.recordedChunks = [];

  $("cameraFeed").style.display = "none";
  $("cameraFeed").srcObject = null;
  $("recordPlayback").style.display = "none";
  $("recordPlayback").src = "";
  $("recordPlaceholder").style.display = "block";
  $("btnOpenCamera").style.display = "inline-flex";
  $("btnRecord").style.display = "none";
  $("btnRecord").classList.remove("recording");
  $("recordDoneBar").classList.remove("active");
  $("recordTimer").classList.remove("active");

  const area = $("uploadArea");
  area.classList.remove("has-file");
  area.innerHTML = `
    <div class="upload-icon">🎥</div>
    <div class="upload-text">点击上传或拖拽视频到此处</div>
    <div class="upload-hint">支持 MP4 格式，3-10秒，最大 50MB · 视频中请包含你的说话声音</div>
    <input type="file" id="videoInput" accept="video/mp4,video/*">
  `;
  setupUpload();
}
