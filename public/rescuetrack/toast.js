/**
 * Toast notification system for RESCUETRACK
 * Usage: import { showToast } from "./toast.js";
 *        showToast("Message", "success"); // success | error | info
 */

let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
}

export function showToast(message, type = "info", duration = 3500) {
  ensureContainer();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  const marque = document.createElement("span");
  marque.style.fontWeight = "700";
  marque.style.fontSize = "16px";
  marque.textContent = icon;
  const texte = document.createElement("span");
  texte.textContent = message;
  toast.append(marque, texte);

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "toastSlideIn 0.3s ease reverse";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
