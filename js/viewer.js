
import { state, setCurrentIndex } from './state.js';
import { dom } from './dom.js';
import { PLACEHOLDER, formatBytes, formatMegaPixels } from './utils.js';
import { ensureObjectURLForItem, ensureViewerDetailsForItem } from './image-loader.js';

export const fullscreenSupported = !!(dom.viewer.requestFullscreen && document.exitFullscreen);

export function syncViewerStageChrome(pointer = null) {
  if (!dom.viewerStage) return;
  if (dom.viewer.classList.contains('hidden')) {
    dom.viewerStage.classList.remove('show-left', 'show-right', 'show-controls');
    return;
  }
  if (!pointer) {
    dom.viewerStage.classList.remove('show-left', 'show-right', 'show-controls');
    return;
  }

  const rect = dom.viewerStage.getBoundingClientRect();
  const EDGE_THRESHOLD_MIN = 80;
  const EDGE_THRESHOLD_RATIO = 0.22;
  const BOTTOM_CONTROLS_THRESHOLD = 96;
  
  const edgeThreshold = Math.min(EDGE_THRESHOLD_MIN, rect.width * EDGE_THRESHOLD_RATIO);
  const offsetX = pointer.x - rect.left;
  const fromRight = rect.right - pointer.x;
  const fromBottom = rect.bottom - pointer.y;

  const hasPrev = state.currentIndex > 0;
  const hasNext = state.currentIndex >= 0 && state.currentIndex < state.files.length - 1;

  dom.viewerStage.classList.toggle('show-left', offsetX < edgeThreshold && hasPrev);
  dom.viewerStage.classList.toggle('show-right', fromRight < edgeThreshold && hasNext);
  dom.viewerStage.classList.toggle('show-controls', fromBottom < BOTTOM_CONTROLS_THRESHOLD);
}

let navHintTimer = null;

export function openViewer(index) {
  const item = state.files[index];
  if (!item) return;
  setCurrentIndex(index);
  dom.viewer.classList.remove('hidden');
  syncViewerStageChrome(state.lastPointer);
  if (fullscreenSupported) syncFullscreenState();
  resetViewerState();
  dom.viewerImg.src = PLACEHOLDER;
  dom.viewerImg.classList.remove('loaded');
  dom.viewerImg.alt = item.displayName;
  updateViewerInfo();
  updateNavButtons();
  syncViewerStageChrome(state.lastPointer);

  // Show navigation hints temporarily
  if (navHintTimer) clearTimeout(navHintTimer);
  const hasPrev = state.currentIndex > 0;
  const hasNext = state.currentIndex >= 0 && state.currentIndex < state.files.length - 1;
  if (hasPrev) dom.viewerStage.classList.add('show-left');
  if (hasNext) dom.viewerStage.classList.add('show-right');
  
  navHintTimer = setTimeout(() => {
    navHintTimer = null;
    syncViewerStageChrome(state.lastPointer);
  }, 1000);

  const targetItem = item;
  ensureObjectURLForItem(item)
    .then((url) => {
      if (state.files[state.currentIndex] !== targetItem) return;
      dom.viewerImg.src = url;
      if (dom.viewerImg.decode) {
        dom.viewerImg.decode().then(fitImageToStage).catch(fitImageToStage);
      } else {
        fitImageToStage();
      }

      // Preload adjacent images
      const nextIdx = state.currentIndex + 1;
      if (nextIdx < state.files.length) {
        ensureObjectURLForItem(state.files[nextIdx]);
      }
      const prevIdx = state.currentIndex - 1;
      if (prevIdx >= 0) {
        ensureObjectURLForItem(state.files[prevIdx]);
      }
    })
    .catch((err) => console.error('大图加载失败', err));
}

export function closeViewerFn() {
  if (navHintTimer) {
    clearTimeout(navHintTimer);
    navHintTimer = null;
  }
  if (viewerInfoTimer) {
    clearTimeout(viewerInfoTimer);
    viewerInfoTimer = null;
  }
  if (dom.viewerInfo) dom.viewerInfo.classList.remove('visible');
  
  if (fullscreenSupported && isViewerFullscreen()) exitFullscreen();
  dom.viewer.classList.add('hidden');
  dom.viewer.classList.remove('fullscreen');
  dom.viewerStage.classList.remove('show-left', 'show-right', 'show-controls');
  state.lastPointer = null;
  dom.viewerImg.src = PLACEHOLDER;
  setCurrentIndex(-1);
  updateViewerInfo();
  updateNavButtons();
}

export function updateNavButtons() {
  const hasPrev = state.currentIndex > 0;
  const hasNext = state.currentIndex >= 0 && state.currentIndex < state.files.length - 1;
  dom.prevBtn.disabled = !hasPrev;
  dom.nextBtn.disabled = !hasNext;
}

export function isViewerFullscreen() {
  const element = document.fullscreenElement;
  return !!element && dom.viewer.contains(element);
}

export function syncFullscreenState() {
  if (!fullscreenSupported) return;
  const active = isViewerFullscreen();
  dom.viewer.classList.toggle('fullscreen', active);
  dom.fullscreenBtn.textContent = active ? '退出全屏' : '全屏';
  if (active) {
    requestAnimationFrame(() => fitImageToStage());
  } else {
    fitImageToStage();
  }
}

export async function enterFullscreen() {
  if (!fullscreenSupported || !dom.viewer.requestFullscreen) return;
  try {
    await dom.viewer.requestFullscreen();
  } catch (err) {
    console.error('进入全屏失败', err);
  }
}

export async function exitFullscreen() {
  if (!fullscreenSupported || !document.fullscreenElement) return;
  try {
    await document.exitFullscreen();
  } catch (err) {
    console.error('退出全屏失败', err);
  }
}

export function resetViewerState() {
  state.viewerState.scale = 1;
  state.viewerState.x = 0;
  state.viewerState.y = 0;
  state.viewerState.minScale = 1;
  state.viewerState.maxScale = 8;
  updateViewerTransform();
}

export function updateViewerTransform() {
  dom.viewerImg.style.transform = `translate(${state.viewerState.x}px, ${state.viewerState.y}px) scale(${state.viewerState.scale})`;
}

export function fitImageToStage() {
  if (dom.viewer.classList.contains('hidden')) return;
  if (dom.viewerImg.naturalWidth <= 1 || dom.viewerImg.naturalHeight <= 1) return;
  const bounds = dom.viewerStage.getBoundingClientRect();
  const scaleX = bounds.width / dom.viewerImg.naturalWidth;
  const scaleY = bounds.height / dom.viewerImg.naturalHeight;
  const minScale = Math.min(scaleX, scaleY);
  state.viewerState.minScale = Number.isFinite(minScale) && minScale > 0 ? minScale : 1;
  state.viewerState.maxScale = Math.max(state.viewerState.minScale * 8, state.viewerState.minScale * 2);
  state.viewerState.scale = state.viewerState.minScale;
  state.viewerState.x = 0;
  state.viewerState.y = 0;
  updateViewerTransform();
  updateViewerInfo();
}

export function updateViewerInfo() {
  if (state.currentIndex < 0 || !state.files[state.currentIndex]) {
    dom.viewerInfo.textContent = '';
    return;
  }

  const item = state.files[state.currentIndex];
  const primaryText = `${item.displayName} · ${state.currentIndex + 1}/${state.files.length}`;

  const liveWidth = dom.viewerImg.naturalWidth > 1 ? dom.viewerImg.naturalWidth : item.width;
  const liveHeight = dom.viewerImg.naturalHeight > 1 ? dom.viewerImg.naturalHeight : item.height;
  const secondaryText = buildViewerDetailsText(item, { width: liveWidth, height: liveHeight });
  renderViewerInfo(primaryText, secondaryText);

  const targetItem = item;
  ensureViewerDetailsForItem(item).then(() => {
    if (dom.viewer.classList.contains('hidden')) return;
    if (state.files[state.currentIndex] !== targetItem) return;

    const width = dom.viewerImg.naturalWidth > 1 ? dom.viewerImg.naturalWidth : targetItem.width;
    const height = dom.viewerImg.naturalHeight > 1 ? dom.viewerImg.naturalHeight : targetItem.height;
    const details = buildViewerDetailsText(targetItem, { width, height });
    renderViewerInfo(primaryText, details);
  });
}

let viewerInfoTimer = null;

function flashViewerInfo() {
  if (!dom.viewerInfo) return;
  dom.viewerInfo.classList.add('visible');
  if (viewerInfoTimer) clearTimeout(viewerInfoTimer);
  viewerInfoTimer = setTimeout(() => {
    dom.viewerInfo.classList.remove('visible');
    viewerInfoTimer = null;
  }, 500);
}

function renderViewerInfo(primaryText, secondaryText) {
  if (!dom.viewerInfo) return;
  dom.viewerInfo.textContent = '';

  const primary = document.createElement('div');
  primary.className = 'viewer-info-primary';
  primary.textContent = primaryText;
  dom.viewerInfo.appendChild(primary);

  if (secondaryText) {
    const secondary = document.createElement('div');
    secondary.className = 'viewer-info-secondary';
    secondary.textContent = secondaryText;
    dom.viewerInfo.appendChild(secondary);
  }

  flashViewerInfo();
}

function getViewerZoomPercent() {
  if (!Number.isFinite(state.viewerState.minScale) || state.viewerState.minScale <= 0) return null;
  if (!Number.isFinite(state.viewerState.scale) || state.viewerState.scale <= 0) return null;
  const percent = Math.round((state.viewerState.scale / state.viewerState.minScale) * 100);
  if (!Number.isFinite(percent) || percent <= 0) return null;
  return percent;
}

function buildViewerDetailsText(item, { width, height } = {}) {
  if (!item) return '';
  const parts = [];

  const w = Number.isFinite(width) && width > 0 ? width : null;
  const h = Number.isFinite(height) && height > 0 ? height : null;
  if (w && h) {
    const mp = formatMegaPixels(w, h);
    parts.push(`分辨率 ${w}×${h}${mp ? `（${mp}）` : ''}`);
  }

  if (Number.isFinite(item.fileSize) && item.fileSize >= 0) {
    parts.push(`大小 ${formatBytes(item.fileSize)}`);
  }

  if (item.mimeType) {
    parts.push(`类型 ${item.mimeType}`);
  }

  const zoomPercent = getViewerZoomPercent();
  if (zoomPercent) parts.push(`缩放 ${zoomPercent}%`);

  return parts.join(' · ');
}

export function updateItemIndices(startIndex = 0) {
  for (let idx = startIndex; idx < state.files.length; idx += 1) {
    const item = state.files[idx];
    if (!item) continue;
    if (item.element) item.element.dataset.index = idx.toString();
    if (item.imgElement) item.imgElement.dataset.index = idx.toString();
  }
  if (state.files.length === 0) {
    setCurrentIndex(-1);
  } else if (state.currentIndex >= state.files.length) {
    setCurrentIndex(state.files.length - 1);
  }
  updateViewerInfo();
  updateNavButtons();
}

export function applyZoom(factor, clientX, clientY) {
  const prevScale = state.viewerState.scale;
  let targetScale = prevScale * factor;
  if (targetScale < state.viewerState.minScale) targetScale = state.viewerState.minScale;
  if (targetScale > state.viewerState.maxScale) targetScale = state.viewerState.maxScale;
  const actualFactor = targetScale / prevScale;
  if (!Number.isFinite(actualFactor) || actualFactor === 1) {
    state.viewerState.scale = targetScale;
    updateViewerTransform();
    updateViewerInfo();
    return;
  }
  const rect = dom.viewerStage.getBoundingClientRect();
  const offsetX = clientX - (rect.left + rect.width / 2);
  const offsetY = clientY - (rect.top + rect.height / 2);
  state.viewerState.x = state.viewerState.x * actualFactor - offsetX * (actualFactor - 1);
  state.viewerState.y = state.viewerState.y * actualFactor - offsetY * (actualFactor - 1);
  state.viewerState.scale = targetScale;
  updateViewerTransform();
  updateViewerInfo();
}
