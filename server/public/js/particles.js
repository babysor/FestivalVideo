/**
 * 背景粒子动画
 */

import { state } from "./state.js";
import { getCurrentConfig } from "./festivalConfig.js";

export function createParticles() {
  const container = document.getElementById("particles");
  const config = getCurrentConfig(state.currentFestival);
  const colors = config.particleColors;
  for (let i = 0; i < 25; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const size = 3 + Math.random() * 6;
    p.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      background: ${colors[i % colors.length]};
      opacity: ${0.15 + Math.random() * 0.2};
      animation-delay: ${Math.random() * 6}s;
      animation-duration: ${4 + Math.random() * 4}s;
    `;
    container.appendChild(p);
  }
}

export function recreateParticles() {
  const container = document.getElementById("particles");
  container.innerHTML = "";
  createParticles();
}
