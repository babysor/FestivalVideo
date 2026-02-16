/**
 * 音频录制模块
 */

import { state } from "./state.js";
import { $ } from "./utils.js";

export function toggleAudioRecord() {
  state.audioRecordEnabled = !state.audioRecordEnabled;
  $("audioToggle").classList.toggle("active", state.audioRecordEnabled);
  $("audioRecordPanel").classList.toggle("active", state.audioRecordEnabled);
  $("audioRecordSwitch").checked = state.audioRecordEnabled;

  if (!state.audioRecordEnabled) {
    stopAudioStream();
    state.selectedAudioFile = null;
  }
}

function stopAudioStream() {
  if (state.audioStream) {
    state.audioStream.getTracks().forEach((t) => t.stop());
    state.audioStream = null;
  }
  if (state.audioRecorder && state.audioRecorder.state !== "inactive") {
    state.audioRecorder.stop();
    state.audioRecorder = null;
  }
  if (state.audioAnimFrame) {
    cancelAnimationFrame(state.audioAnimFrame);
    state.audioAnimFrame = null;
  }
  clearInterval(state.audioTimerInterval);
  state.audioTimerInterval = null;
  state.audioAnalyser = null;
}

async function startAudioStream() {
  try {
    state.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    const barsContainer = $("audioWaveBars");
    if (barsContainer.children.length === 0) {
      for (let i = 0; i < 32; i++) {
        const bar = document.createElement("div");
        bar.className = "audio-wave-bar";
        barsContainer.appendChild(bar);
      }
    }
    return true;
  } catch (err) {
    console.error("麦克风访问失败:", err);
    if (err.name === "NotAllowedError") {
      alert("请允许访问麦克风权限后重试");
    } else if (err.name === "NotFoundError") {
      alert("未检测到麦克风设备");
    } else {
      alert("麦克风开启失败: " + err.message);
    }
    return false;
  }
}

export async function toggleAudioRecording() {
  if (!state.audioRecorder || state.audioRecorder.state === "inactive") {
    await startAudioRecording();
  } else {
    stopAudioRecording();
  }
}

async function startAudioRecording() {
  if (!state.audioStream) {
    const ok = await startAudioStream();
    if (!ok) return;
  }

  state.audioChunks = [];

  const mimeOptions = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  let mimeType = "";
  for (const m of mimeOptions) {
    if (MediaRecorder.isTypeSupported(m)) { mimeType = m; break; }
  }

  state.audioRecorder = new MediaRecorder(state.audioStream, mimeType ? { mimeType } : {});
  state.audioRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) state.audioChunks.push(e.data);
  };
  state.audioRecorder.onstop = () => { onAudioRecordingStopped(); };
  state.audioRecorder.start(100);

  $("btnAudioRecord").classList.add("recording");
  $("btnAudioRecord").title = "停止录音";
  $("audioPlaceholder").style.display = "none";
  $("audioWaveBars").classList.add("active");
  $("audioPlayback").style.display = "none";

  state.audioRecordStartTime = Date.now();
  $("audioTimer").classList.add("active");
  updateAudioTimer();
  state.audioTimerInterval = setInterval(updateAudioTimer, 200);

  startAudioVisualizer();

  setTimeout(() => {
    if (state.audioRecorder && state.audioRecorder.state === "recording") {
      stopAudioRecording();
    }
  }, 30000);
}

function stopAudioRecording() {
  if (state.audioRecorder && state.audioRecorder.state === "recording") {
    state.audioRecorder.stop();
  }
  clearInterval(state.audioTimerInterval);
  state.audioTimerInterval = null;
  if (state.audioAnimFrame) {
    cancelAnimationFrame(state.audioAnimFrame);
    state.audioAnimFrame = null;
  }

  $("audioTimer").classList.remove("active");
  $("btnAudioRecord").classList.remove("recording");
  $("btnAudioRecord").title = "开始录音";
  $("audioWaveBars").classList.remove("active");
}

function updateAudioTimer() {
  const elapsed = (Date.now() - state.audioRecordStartTime) / 1000;
  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(Math.floor(elapsed % 60)).padStart(2, "0");
  $("audioTimerText").textContent = `${mins}:${secs}`;
}

function startAudioVisualizer() {
  if (!state.audioStream) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(state.audioStream);
    state.audioAnalyser = audioCtx.createAnalyser();
    state.audioAnalyser.fftSize = 64;
    source.connect(state.audioAnalyser);

    const bars = document.querySelectorAll("#audioWaveBars .audio-wave-bar");
    const dataArray = new Uint8Array(state.audioAnalyser.frequencyBinCount);

    function draw() {
      if (!state.audioAnalyser) return;
      state.audioAnimFrame = requestAnimationFrame(draw);
      state.audioAnalyser.getByteFrequencyData(dataArray);
      bars.forEach((bar, i) => {
        const val = dataArray[i] || 0;
        const h = Math.max(4, (val / 255) * 80);
        bar.style.height = h + "px";
        bar.style.opacity = 0.4 + (val / 255) * 0.6;
      });
    }
    draw();
  } catch (err) {
    console.warn("音频可视化失败:", err);
  }
}

function onAudioRecordingStopped() {
  stopAudioStream();

  const blob = new Blob(state.audioChunks, { type: state.audioChunks[0]?.type || "audio/webm" });
  const duration = ((Date.now() - state.audioRecordStartTime) / 1000).toFixed(1);

  if (parseFloat(duration) < 2) {
    alert("录音太短啦，请至少录 3 秒");
    retakeAudioRecording();
    return;
  }

  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: blob.type });
  state.selectedAudioFile = file;

  const playback = $("audioPlayback");
  playback.src = URL.createObjectURL(blob);
  playback.style.display = "block";

  $("btnAudioRecord").style.display = "none";
  $("audioDoneBar").classList.add("active");
  $("audioDoneText").textContent = `✅ 录音完成 (${duration}秒, ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
}

export function retakeAudioRecording() {
  state.selectedAudioFile = null;
  state.audioChunks = [];

  $("audioPlaceholder").style.display = "block";
  $("audioWaveBars").classList.remove("active");
  $("audioPlayback").style.display = "none";
  $("audioPlayback").src = "";
  $("btnAudioRecord").style.display = "flex";
  $("btnAudioRecord").classList.remove("recording");
  $("audioDoneBar").classList.remove("active");
  $("audioTimer").classList.remove("active");
}

export function resetAudioUI() {
  stopAudioStream();
  state.audioRecordEnabled = false;
  state.selectedAudioFile = null;
  state.audioChunks = [];
  $("audioToggle").classList.remove("active");
  $("audioRecordPanel").classList.remove("active");
  $("audioRecordSwitch").checked = false;
  retakeAudioRecording();
}
