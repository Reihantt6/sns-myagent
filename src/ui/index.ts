/** SNS-MyAgent terminal UI components — barrel export. */
export * from "./colors.js";
export { showBanner } from "./banner.js";
export { createSpinner } from "./spinner.js";
export { createPrompt } from "./chat-prompt.js";
export { renderStatusBar, clearStatusBar, type StatusBarState } from "./status-bar.js";
export {
  brandGradient,
  accentGradient,
  subtleGradient,
  brand,
  accentGrad,
  subtle,
  gradientLine,
  labeledGradientLine,
  roleGradient,
  statusGradient,
  gradientBg,
} from "./gradient.js";
export { renderErrorDisplay, renderQuickError, renderWarning, type ErrorDisplayOptions, type ErrorSeverity } from "./error-display.js";
export { renderMemoryToast, renderMemoryRecall, renderMemorySave, clearToastLine, type MemoryToastOptions, type ToastType } from "./memory-toast.js";
