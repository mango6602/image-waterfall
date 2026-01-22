
import { state, setLayoutMode, updateSettings } from './js/state.js';
import { dom } from './js/dom.js';
import { 
  pickDirectory, 
  extractDroppedDirectoryHandle, 
  loadImagesFromDir, 
  deleteFileAtIndex, 
  syncEmptyState,
  supportsFileSystemHandleDrop,
  canChooseDirectory
} from './js/file-system.js';
import { 
  getMasonryColumnCount, 
  ensureMasonryColumns, 
  scheduleMasonryLayout, 
  applyMasonryLayout 
} from './js/gallery.js';

// Add resize observer to handle layout updates efficiently
const resizeObserver = new ResizeObserver((entries) => {
  // Use debounce or requestAnimationFrame to throttle
  scheduleMasonryLayout();
});

// Start observing the gallery container
if (dom.gallery) {
  resizeObserver.observe(dom.gallery);
}

import { 
  openViewer, 
  closeViewerFn, 
  syncViewerStageChrome, 
  hideEdgeTip, 
  flashEdgeTip,
  updateNavButtons,
  isViewerFullscreen,
  syncFullscreenState,
  enterFullscreen,
  exitFullscreen,
  updateViewerTransform,
  applyZoom,
  fitImageToStage,
  fullscreenSupported
} from './js/viewer.js';
import { ensureObjectURLForItem } from './js/image-loader.js';
import { initEditor } from './js/editor.js';

// Initialize Editor
initEditor();

// PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      // Silent fail
    });
  });
}

// Layout Switch
if (dom.layoutVerticalBtn) {
  dom.layoutVerticalBtn.addEventListener('click', () => {
    setLayoutMode('vertical');
    syncLayoutSwitchUI();
    scheduleMasonryLayout();
  });
}
if (dom.layoutHorizontalBtn) {
  dom.layoutHorizontalBtn.addEventListener('click', () => {
    setLayoutMode('horizontal');
    syncLayoutSwitchUI();
    scheduleMasonryLayout();
  });
}

function updateSettingsVisibility() {
  if (!dom.settingsPanel) return;
  const isVertical = state.layoutMode !== 'horizontal';
  if (dom.verticalSetting) dom.verticalSetting.classList.toggle('hidden', !isVertical);
  if (dom.horizontalSetting) dom.horizontalSetting.classList.toggle('hidden', isVertical);
}

function syncLayoutSwitchUI() {
  if (!dom.layoutVerticalBtn || !dom.layoutHorizontalBtn) return;
  const verticalActive = state.layoutMode !== 'horizontal';
  dom.layoutVerticalBtn.setAttribute('aria-pressed', verticalActive ? 'true' : 'false');
  dom.layoutHorizontalBtn.setAttribute('aria-pressed', verticalActive ? 'false' : 'true');
  updateSettingsVisibility();
}

syncLayoutSwitchUI();

// Settings UI Initialization
if (dom.settingsBtn) {
  // Initialize values
  if (dom.colWidthSlider) {
    dom.colWidthSlider.value = state.settings.minColWidth;
    if (dom.colWidthValue) dom.colWidthValue.textContent = `${state.settings.minColWidth}px`;
    
    dom.colWidthSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      updateSettings('minColWidth', val);
      if (dom.colWidthValue) dom.colWidthValue.textContent = `${val}px`;
      scheduleMasonryLayout();
    });
  }
  
  if (dom.rowHeightSlider) {
    dom.rowHeightSlider.value = state.settings.rowHeight;
    if (dom.rowHeightValue) dom.rowHeightValue.textContent = `${state.settings.rowHeight}px`;
    
    dom.rowHeightSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      updateSettings('rowHeight', val);
      if (dom.rowHeightValue) dom.rowHeightValue.textContent = `${val}px`;
      scheduleMasonryLayout();
    });
  }

  // Toggle Panel
  dom.settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.settingsPanel.classList.toggle('hidden');
    updateSettingsVisibility();
  });

  // Close when clicking outside
  window.addEventListener('click', (e) => {
    if (dom.settingsPanel && !dom.settingsPanel.classList.contains('hidden') && 
        !dom.settingsPanel.contains(e.target) && 
        !dom.settingsBtn.contains(e.target)) {
      dom.settingsPanel.classList.add('hidden');
    }
  });
}

// Open Button
if (dom.openBtn) {
  if (supportsFileSystemHandleDrop && canChooseDirectory) {
    dom.openBtn.remove();
  } else if (!canChooseDirectory) {
    dom.openBtn.hidden = false;
    dom.openBtn.disabled = true;
    dom.openBtn.textContent = '浏览器不支持文件夹访问';
  } else {
    dom.openBtn.hidden = false;
    dom.openBtn.addEventListener('click', () => {
      void pickDirectory();
    });
  }
}

// Empty State
if (dom.emptyState && canChooseDirectory) {
  dom.emptyState.classList.add('interactive');
  dom.emptyState.addEventListener('click', (ev) => {
    if (state.dragDepth > 0) return;
    ev.preventDefault();
    void pickDirectory();
  });
}

// Drag & Drop
window.addEventListener('dragover', (ev) => {
  if (!supportsFileSystemHandleDrop) return;
  ev.preventDefault();
  ev.dataTransfer.dropEffect = 'copy';
  showDropOverlay();
});

window.addEventListener('dragenter', (ev) => {
  if (!supportsFileSystemHandleDrop) return;
  ev.preventDefault();
  state.dragDepth += 1;
  showDropOverlay();
});

window.addEventListener('dragleave', () => {
  if (!supportsFileSystemHandleDrop) return;
  state.dragDepth = Math.max(0, state.dragDepth - 1);
  if (!state.dragDepth) hideDropOverlay();
});

window.addEventListener('dragend', () => {
  if (!supportsFileSystemHandleDrop) return;
  state.dragDepth = 0;
  hideDropOverlay();
});

window.addEventListener('drop', async (ev) => {
  if (!supportsFileSystemHandleDrop) return;
  ev.preventDefault();
  state.dragDepth = 0;
  hideDropOverlay();
  const dirHandle = await extractDroppedDirectoryHandle(ev.dataTransfer);
  if (!dirHandle) {
    console.warn('未检测到有效的目录拖拽');
    return;
  }
  state.currentDirHandle = dirHandle;
  if (dom.dirLabel) dom.dirLabel.textContent = dirHandle.name;
  await loadImagesFromDir(dirHandle);
});

function showDropOverlay() {
  if (!dom.dropOverlay) return;
  dom.dropOverlay.classList.remove('hidden');
}

function hideDropOverlay() {
  if (!dom.dropOverlay) return;
  dom.dropOverlay.classList.add('hidden');
}

// Viewer Controls
dom.closeViewer.addEventListener('click', closeViewerFn);
dom.viewerBackdrop.addEventListener('click', closeViewerFn);

dom.prevBtn.addEventListener('click', () => {
  if (state.currentIndex > 0) openViewer(state.currentIndex - 1);
});

dom.nextBtn.addEventListener('click', () => {
  if (state.currentIndex < state.files.length - 1) openViewer(state.currentIndex + 1);
});

dom.deleteBtn.addEventListener('click', async () => {
  if (state.currentIndex < 0) return;
  await deleteFileAtIndex(state.currentIndex);
});

dom.downloadBtn.addEventListener('click', async () => {
  if (state.currentIndex < 0) return;
  const item = state.files[state.currentIndex];
  if (!item) return;
  const url = await ensureObjectURLForItem(item);
  const a = document.createElement('a');
  a.href = url;
  a.download = item.name;
  a.click();
});

dom.fullscreenBtn.addEventListener('click', async () => {
  if (!fullscreenSupported) return;
  if (isViewerFullscreen()) {
    await exitFullscreen();
  } else {
    await enterFullscreen();
  }
});

// Viewer Interaction (Pan/Zoom)
dom.viewerStage.addEventListener('mousemove', (ev) => {
  if (dom.viewer.classList.contains('hidden')) return;
  const pointer = { x: ev.clientX, y: ev.clientY };
  state.lastPointer = pointer;
  syncViewerStageChrome(pointer);
});

dom.viewerStage.addEventListener('mouseleave', () => {
  state.lastPointer = null;
  dom.viewerStage.classList.remove('show-left', 'show-right', 'show-controls');
  hideEdgeTip();
});

dom.viewerStage.addEventListener(
  'wheel',
  (ev) => {
    if (dom.viewer.classList.contains('hidden')) return;
    ev.preventDefault();
    const direction = ev.deltaY < 0 ? 1 : -1;
    const factor = direction > 0 ? 1.12 : 0.9;
    applyZoom(factor, ev.clientX, ev.clientY);
  },
  { passive: false }
);

dom.viewerImg.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  ev.preventDefault();
  state.isPanning = true;
  state.activePointerId = ev.pointerId;
  state.pointerStart = { x: ev.clientX, y: ev.clientY };
  state.panStart = { x: state.viewerState.x, y: state.viewerState.y };
  dom.viewerImg.setPointerCapture(state.activePointerId);
  dom.viewerImg.classList.add('grabbing');
});

dom.viewerImg.addEventListener('pointermove', (ev) => {
  if (!state.isPanning || ev.pointerId !== state.activePointerId) return;
  const dx = ev.clientX - state.pointerStart.x;
  const dy = ev.clientY - state.pointerStart.y;
  state.viewerState.x = state.panStart.x + dx;
  state.viewerState.y = state.panStart.y + dy;
  updateViewerTransform();
});

const endPan = (ev) => {
  if (!state.isPanning || (ev && ev.pointerId !== state.activePointerId)) return;
  state.isPanning = false;
  dom.viewerImg.classList.remove('grabbing');
  if (state.activePointerId !== null) dom.viewerImg.releasePointerCapture(state.activePointerId);
  state.activePointerId = null;
};

dom.viewerImg.addEventListener('pointerup', endPan);
dom.viewerImg.addEventListener('pointercancel', endPan);

dom.viewerImg.addEventListener('dblclick', () => {
  if (dom.viewer.classList.contains('hidden')) return;
  if (Math.abs(state.viewerState.scale - state.viewerState.minScale) < 0.01) {
    applyZoom(2, dom.viewerStage.getBoundingClientRect().left + dom.viewerStage.clientWidth / 2, dom.viewerStage.getBoundingClientRect().top + dom.viewerStage.clientHeight / 2);
  } else {
    state.viewerState.scale = state.viewerState.minScale;
    state.viewerState.x = 0;
    state.viewerState.y = 0;
    updateViewerTransform();
  }
});

dom.viewerImg.addEventListener('load', () => {
  fitImageToStage();
});

// Keyboard
document.addEventListener('keydown', async (ev) => {
  if (dom.viewer.classList.contains('hidden')) return;
  if (ev.key === 'ArrowRight') {
    ev.preventDefault();
    if (state.currentIndex < state.files.length - 1) {
      openViewer(state.currentIndex + 1);
    } else if (state.files.length > 0) {
      flashEdgeTip('最后一张', 'right');
    }
  } else if (ev.key === 'ArrowLeft') {
    ev.preventDefault();
    if (state.currentIndex > 0) openViewer(state.currentIndex - 1);
  } else if (ev.key === 'f' || ev.key === 'F') {
    if (!fullscreenSupported) return;
    ev.preventDefault();
    if (isViewerFullscreen()) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  } else if (ev.key === 'Delete') {
    ev.preventDefault();
    await deleteFileAtIndex(state.currentIndex);
  } else if (ev.key === 'Escape') {
    ev.preventDefault();
    closeViewerFn();
  }
});

if (fullscreenSupported) {
  document.addEventListener('fullscreenchange', () => {
    syncFullscreenState();
  });
  document.addEventListener('fullscreenerror', (ev) => {
    console.error('全屏出现错误', ev);
  });
}

// Initial Setup
if (fullscreenSupported) syncFullscreenState();
syncEmptyState();
ensureMasonryColumns(getMasonryColumnCount());
scheduleMasonryLayout();
window.addEventListener('resize', scheduleMasonryLayout);
