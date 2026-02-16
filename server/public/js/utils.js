/**
 * 通用工具函数
 */

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function $(id) {
  return document.getElementById(id);
}
