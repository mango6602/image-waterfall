
export const state = {
  files: [], // { name, displayName, handle, parent, url, ... }
  currentIndex: -1,
  currentDirHandle: null,
  layoutMode: localStorage.getItem('layoutMode') === 'horizontal' ? 'horizontal' : 'vertical',
  settings: {
    minColWidth: parseInt(localStorage.getItem('minColWidth') || '200', 10),
    rowHeight: parseInt(localStorage.getItem('rowHeight') || '320', 10),
  },
  viewerState: { scale: 1, x: 0, y: 0, minScale: 1, maxScale: 8 },
  isPanning: false,
  panStart: { x: 0, y: 0 },
  pointerStart: { x: 0, y: 0 },
  activePointerId: null,
  dragDepth: 0,
  pickingDirectory: false,
  lastPointer: null,
};

export function setFiles(newFiles) {
  state.files = newFiles;
}

export function setCurrentIndex(index) {
  state.currentIndex = index;
}

export function setCurrentDirHandle(handle) {
  state.currentDirHandle = handle;
}

export function setLayoutMode(mode) {
  state.layoutMode = mode;
  localStorage.setItem('layoutMode', mode);
}

export function updateSettings(key, value) {
  state.settings[key] = value;
  localStorage.setItem(key, value);
}
