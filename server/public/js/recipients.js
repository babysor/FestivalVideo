/**
 * 收信人列表管理模块
 */

import { state } from "./state.js";
import { escapeHtml, $ } from "./utils.js";
import { getCurrentConfig } from "./festivalConfig.js";

export function addRecipient(name = "", relation = "", background = "") {
  state.recipientCount++;
  const list = $("recipientList");
  const idx = state.recipientCount;
  const config = getCurrentConfig(state.currentFestival);

  const combinedValue = background ? `${relation}, ${background}` : relation;

  const row = document.createElement("div");
  row.className = "recipient-row";
  row.id = `recipient-${idx}`;
  row.innerHTML = `
    <span class="row-num">${list.children.length + 1}</span>
    <div class="field">
      <label>姓名</label>
      <input type="text" class="r-name" placeholder="${config.namePlaceholder}" maxlength="20" value="${escapeHtml(name)}">
    </div>
    <div class="field">
      <label>关系与背景</label>
      <input type="text" class="r-relation-bg" placeholder="${config.relationPlaceholder}" maxlength="80" value="${escapeHtml(combinedValue)}">
    </div>
    <button class="btn-remove" onclick="window.__app.removeRecipient('recipient-${idx}')" title="删除">✕</button>
  `;
  list.appendChild(row);
  updateRowNumbers();
}

export function removeRecipient(id) {
  const list = $("recipientList");
  if (list.children.length <= 1) return;
  const row = document.getElementById(id);
  if (row) {
    row.remove();
    updateRowNumbers();
  }
}

function updateRowNumbers() {
  const rows = document.querySelectorAll(".recipient-row");
  rows.forEach((row, i) => {
    const num = row.querySelector(".row-num");
    if (num) num.textContent = i + 1;
  });
}

export function getRecipients() {
  const rows = document.querySelectorAll(".recipient-row");
  const recipients = [];
  rows.forEach((row) => {
    const name = row.querySelector(".r-name").value.trim();
    const relationBg = row.querySelector(".r-relation-bg").value.trim();

    if (name && relationBg) {
      const parts = relationBg.split(/[,，、；;]/);
      const relation = parts[0].trim();
      const background = parts.slice(1).join(",").trim();
      recipients.push({ name, relation, background });
    }
  });
  return recipients;
}
