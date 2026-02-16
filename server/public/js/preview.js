/**
 * 台词预览与倒计时模块
 */

import { state } from "./state.js";
import { escapeHtml, $ } from "./utils.js";

export function showPreview(data) {
  const section = $("previewSection");
  section.classList.add("active");

  const container = $("previewItems");
  container.innerHTML = data.items
    .map((item, i) => {
      const blessingTags = item.narration.blessings
        .map(
          (b, bi) =>
            `<input type="text" class="preview-blessing-tag" data-idx="${i}" data-bidx="${bi}" value="${escapeHtml(b)}" onfocus="window.__app.pauseCountdown()" onblur="window.__app.resumeCountdown()">`
        )
        .join("");

      return `
      <div class="preview-card" id="preview-card-${i}">
        <div class="preview-card-header">
          <div class="preview-avatar">${i + 1}</div>
          <div>
            <div class="preview-name">致 ${escapeHtml(item.recipientName)}</div>
            <div class="preview-relation">${escapeHtml(item.relation)}${item.background ? " · " + escapeHtml(item.background) : ""}</div>
          </div>
          <div class="preview-theme-badge">🎨 ${escapeHtml(item.narration.themeName)}</div>
        </div>

        <div class="preview-field">
          <div class="preview-field-label">🏮 开场标题</div>
          <input type="text" class="preview-field-value" data-idx="${i}" data-field="openingText" value="${escapeHtml(item.narration.openingText)}" onfocus="window.__app.pauseCountdown()" onblur="window.__app.resumeCountdown()">
        </div>

        <div class="preview-field">
          <div class="preview-field-label">🎤 开场语音文案</div>
          <textarea class="preview-field-value" data-idx="${i}" data-field="ttsOpeningText" rows="2" onfocus="window.__app.pauseCountdown()" onblur="window.__app.resumeCountdown()">${escapeHtml(item.narration.ttsOpeningText)}</textarea>
        </div>

        <div class="preview-field">
          <div class="preview-field-label">✨ 祝福短语（画面展示）</div>
          <div class="preview-blessings-row">${blessingTags}</div>
        </div>

        <div class="preview-field">
          <div class="preview-field-label">💬 主体祝福语音文案</div>
          <textarea class="preview-field-value" data-idx="${i}" data-field="ttsBlessingText" rows="3" onfocus="window.__app.pauseCountdown()" onblur="window.__app.resumeCountdown()">${escapeHtml(item.narration.ttsBlessingText)}</textarea>
        </div>

        <div class="preview-field">
          <div class="preview-field-label">😊 语音开心程度</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="range" class="preview-joyful-slider" data-idx="${i}" min="0" max="5" step="1" value="${item.narration.joyful ?? 3}" oninput="this.nextElementSibling.textContent=['😐','🙂','😊','😄','😆','🤩'][this.value]+' '+this.value" onfocus="window.__app.pauseCountdown()" onblur="window.__app.resumeCountdown()" style="flex:1;accent-color:var(--primary);height:6px;">
            <span style="font-size:14px;min-width:36px;text-align:center;">${["😐", "🙂", "😊", "😄", "😆", "🤩"][item.narration.joyful ?? 3]} ${item.narration.joyful ?? 3}</span>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  state.countdownTotal = Math.min(data.items.length * 5, 15);
  state.countdownRemaining = state.countdownTotal;
  state.countdownPaused = false;
  startCountdown();
}

function startCountdown() {
  updateCountdownUI();
  if (state.countdownTimer) clearInterval(state.countdownTimer);
  state.countdownTimer = setInterval(() => {
    if (state.countdownPaused) return;
    state.countdownRemaining -= 0.1;
    if (state.countdownRemaining <= 0) {
      state.countdownRemaining = 0;
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
      updateCountdownUI();
      window.__app.confirmAndRender();
      return;
    }
    updateCountdownUI();
  }, 100);
}

function updateCountdownUI() {
  const fill = $("countdownFill");
  const num = $("countdownNum");
  const pct = state.countdownTotal > 0 ? (state.countdownRemaining / state.countdownTotal) * 100 : 0;
  fill.style.width = pct + "%";
  num.textContent = Math.ceil(state.countdownRemaining);
}

export function pauseCountdown() {
  state.countdownPaused = true;
  const countdownText = document.querySelector(".preview-countdown .countdown-text");
  if (countdownText) {
    countdownText.innerHTML = `<span style="color: var(--primary);">⏸ 编辑中 — 倒计时已暂停</span>`;
  }
}

export function resumeCountdown() {
  setTimeout(() => {
    const active = document.activeElement;
    if (active && (active.classList.contains("preview-field-value") || active.classList.contains("preview-blessing-tag"))) {
      return;
    }
    state.countdownPaused = false;
    const countdownText = document.querySelector(".preview-countdown .countdown-text");
    if (countdownText) {
      countdownText.innerHTML = `<span class="countdown-num" id="countdownNum">${Math.ceil(state.countdownRemaining)}</span> 秒后自动开始制作视频`;
    }
    updateCountdownUI();
  }, 200);
}

export function stopCountdown() {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
  state.countdownPaused = false;
}

export function collectNarrations() {
  return state.previewData.items.map((item, i) => {
    const card = document.getElementById(`preview-card-${i}`);
    if (!card) return { index: i };

    const openingText = card.querySelector('[data-field="openingText"]')?.value || item.narration.openingText;
    const ttsOpeningText = card.querySelector('[data-field="ttsOpeningText"]')?.value || item.narration.ttsOpeningText;
    const ttsBlessingText = card.querySelector('[data-field="ttsBlessingText"]')?.value || item.narration.ttsBlessingText;
    const blessingInputs = card.querySelectorAll(".preview-blessing-tag");
    const blessings = Array.from(blessingInputs).map((input) => input.value.trim()).filter(Boolean);
    const joyfulSlider = card.querySelector(".preview-joyful-slider");
    const joyful = joyfulSlider ? parseInt(joyfulSlider.value, 10) : (item.narration.joyful ?? 3);

    return {
      index: i,
      openingText,
      ttsOpeningText,
      ttsBlessingText,
      blessings: blessings.length > 0 ? blessings : item.narration.blessings,
      joyful,
    };
  });
}
