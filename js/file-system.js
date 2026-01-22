
import { state, setFiles, setCurrentIndex, setCurrentDirHandle } from './state.js';
import { dom } from './dom.js';
import { PLACEHOLDER, IMAGE_EXTENSIONS, formatBytes } from './utils.js';
import { 
  ensureMasonryColumns, 
  getMasonryColumnCount, 
  appendImageItem, 
  scheduleMasonryLayout, 
  resetLazyObserver,
  supportsCreateImageBitmap 
} from './gallery.js';
import { closeViewerFn, openViewer, updateItemIndices, updateViewerInfo } from './viewer.js';

export const canChooseDirectory = typeof window.showDirectoryPicker === 'function';
export const supportsFileSystemHandleDrop =
  typeof DataTransferItem !== 'undefined' &&
  !!DataTransferItem.prototype &&
  'getAsFileSystemHandle' in DataTransferItem.prototype;

export const defaultEmptyMessage = canChooseDirectory
  ? '支持将整个图片文件夹拖入或单击此区域选择；文件变更时可直接在弹窗中删除。'
  : '支持将整个图片文件夹拖入浏览器；文件变更时可直接在弹窗中删除。';

export async function pickDirectory() {
  if (!canChooseDirectory || state.pickingDirectory) return;
  try {
    state.pickingDirectory = true;
    const dirHandle = await window.showDirectoryPicker();
    setCurrentDirHandle(dirHandle);
    if (dom.dirLabel) dom.dirLabel.textContent = dirHandle.name;
    await loadImagesFromDir(dirHandle);
  } catch (err) {
    console.warn('目录选择被取消或不受支持', err);
  } finally {
    state.pickingDirectory = false;
  }
}

export async function extractDroppedDirectoryHandle(dataTransfer) {
  if (!dataTransfer) return null;
  const items = Array.from(dataTransfer.items || []);
  for (const item of items) {
    if (item.kind !== 'file' || !item.getAsFileSystemHandle) continue;
    try {
      const handle = await item.getAsFileSystemHandle();
      if (handle && handle.kind === 'directory') return handle;
    } catch (err) {
      console.error('读取拖拽目录失败', err);
    }
  }
  return null;
}

export async function loadImagesFromDir(dirHandle) {
  closeViewerFn();
  resetLazyObserver();
  cleanupFileUrls();
  dom.gallery.innerHTML = '';
  ensureMasonryColumns(getMasonryColumnCount());
  setFiles([]);
  syncEmptyState();

  const imageEntries = [];
  await collectImagesRecursive(dirHandle, '', imageEntries);

  imageEntries.sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));

  if (!imageEntries.length && dom.emptyStateText) {
    dom.emptyStateText.textContent = '所选目录未检测到支持的图片格式，请尝试其他文件夹。';
  }

  const newFiles = [];
  imageEntries.forEach((entry, idx) => {
    const item = {
      name: entry.name,
      displayName: entry.path,
      handle: entry.handle,
      parent: entry.parent,
      url: null,
      loadingPromise: null,
      filePromise: null,
      metaPromise: null,
      aspectRatio: null,
      width: null,
      height: null,
      fileSize: null,
      mimeType: '',
      detailsPromise: null,
      element: null,
      imgElement: null,
      preparing: false,
    };
    newFiles.push(item);
    // We must push to state.files gradually or all at once? 
    // The original code did `files.push(item); appendImageItem(item, idx);`
    // So we should update the local array and the global state.
  });
  setFiles(newFiles);
  
  newFiles.forEach((item, idx) => {
      appendImageItem(item, idx);
  });

  if (imageEntries.length && dom.emptyStateText) {
    dom.emptyStateText.textContent = defaultEmptyMessage;
  }

  syncEmptyState();
  scheduleMasonryLayout();
}

async function collectImagesRecursive(dirHandle, basePath, list) {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      if (!isImageFile(entry.name)) continue;
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      list.push({ handle: entry, parent: dirHandle, path: relativePath, name: entry.name });
    } else if (entry.kind === 'directory') {
      const nextPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      await collectImagesRecursive(entry, nextPath, list);
    }
  }
}

function isImageFile(name) {
  const lower = name.toLowerCase();
  for (const ext of IMAGE_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

export function syncEmptyState() {
  const hasItems = state.files.length > 0;
  if (dom.emptyState) dom.emptyState.classList.toggle('hidden', hasItems);
  dom.gallery.classList.toggle('hidden', !hasItems);
  if (!hasItems && !state.currentDirHandle && dom.emptyStateText) {
    dom.emptyStateText.textContent = defaultEmptyMessage;
  }
  if (!hasItems && dom.dirLabel) {
    dom.dirLabel.textContent = state.currentDirHandle ? state.currentDirHandle.name : '';
  }
  
  // 更新统计信息
  if (dom.statsLabel) {
    if (hasItems) {
      dom.statsLabel.textContent = `${state.files.length} 张图片`;
    } else {
      dom.statsLabel.textContent = '';
    }
  }
}

export function cleanupFileUrls() {
  state.files.forEach((item) => {
    cleanupItemResources(item);
  });
}

export function cleanupItemResources(item, { preserveElement = false } = {}) {
  if (!item) return;
  // Note: we can't easily access lazyObserver here if it's not exported from gallery.js or passed in.
  // But we can reset it globally using resetLazyObserver() when clearing all.
  // For individual items, we might need a way to unobserve.
  // Ideally, gallery.js should handle DOM related cleanup.
  
  if (item.url && !preserveElement) {
    URL.revokeObjectURL(item.url);
    item.url = null;
  }
  item.loadingPromise = null;
  item.metaPromise = null;
  item.filePromise = null;
  item.preparing = false;
  if (!preserveElement && item.element && item.element.parentElement) {
    item.element.remove();
  }
  if (!preserveElement) {
    item.element = null;
    item.imgElement = null;
  }
}

export function ensureFileForItem(item) {
  if (!item) return Promise.resolve(null);
  if (item.filePromise) return item.filePromise;
  item.filePromise = item.handle
    .getFile()
    .catch((err) => {
      item.filePromise = null;
      throw err;
    });
  return item.filePromise;
}

export function ensureImageMetaForItem(item) {
  if (!item) return Promise.resolve(null);
  if (Number.isFinite(item.width) && Number.isFinite(item.height) && item.width > 0 && item.height > 0) {
    const ratio = item.width / item.height;
    if (Number.isFinite(ratio) && ratio > 0) item.aspectRatio = ratio;
    return Promise.resolve({ width: item.width, height: item.height });
  }
  if (item.metaPromise) return item.metaPromise;

  if (supportsCreateImageBitmap) {
    item.metaPromise = ensureFileForItem(item)
      .then((file) => {
        if (!file) throw new Error('无法读取文件');
        return createImageBitmap(file);
      })
      .then((bitmap) => {
        item.width = bitmap.width;
        item.height = bitmap.height;
        bitmap.close();
        const ratio = item.width / item.height;
        if (Number.isFinite(ratio) && ratio > 0) item.aspectRatio = ratio;
        return { width: item.width, height: item.height };
      })
      .catch((err) => {
        item.metaPromise = null;
        throw err;
      });
  } else {
    item.metaPromise = ensureFileForItem(item)
      .then((file) => {
        if (!file) throw new Error('无法读取文件');
        return new Promise((resolve, reject) => {
          const tempUrl = URL.createObjectURL(file);
          const probe = new Image();
          probe.onload = () => {
            item.width = probe.naturalWidth;
            item.height = probe.naturalHeight;
            const ratio = item.width / item.height;
            if (Number.isFinite(ratio) && ratio > 0) item.aspectRatio = ratio;
            URL.revokeObjectURL(tempUrl);
            resolve({ width: item.width, height: item.height });
          };
          probe.onerror = (error) => {
            URL.revokeObjectURL(tempUrl);
            reject(error);
          };
          probe.src = tempUrl;
        });
      })
      .catch((err) => {
        item.metaPromise = null;
        throw err;
      });
  }
  return item.metaPromise;
}

export function ensureObjectURLForItem(item) {
  if (!item) return Promise.resolve(PLACEHOLDER);
  if (item.url) return Promise.resolve(item.url);
  if (!item.loadingPromise) {
    item.loadingPromise = ensureFileForItem(item)
      .then((file) => {
        if (!file) throw new Error('无法读取文件');
        const url = URL.createObjectURL(file);
        item.url = url;
        return url;
      })
      .catch((err) => {
        item.loadingPromise = null;
        throw err;
      });
  }
  return item.loadingPromise;
}

export function ensureViewerDetailsForItem(item) {
  if (!item) return Promise.resolve();
  if (item.detailsPromise) return item.detailsPromise;

  item.detailsPromise = Promise.all([ensureFileForItem(item), ensureImageMetaForItem(item)])
    .then(([file, meta]) => {
      if (file) {
        item.fileSize = file.size;
        item.mimeType = file.type || item.mimeType;
      }
      if (meta) {
        item.width = meta.width || item.width;
        item.height = meta.height || item.height;
      }
    })
    .catch(() => {
      // 忽略错误：保留已知信息
    });

  return item.detailsPromise;
}

function smoothRemoveItem(item) {
  if (!item || !item.element) return Promise.resolve();
  return new Promise((resolve) => {
    const element = item.element;
    element.style.pointerEvents = 'none';
    element.classList.add('removing');
    const handle = () => {
      element.removeEventListener('transitionend', handle);
      if (element.parentElement) element.parentElement.removeChild(element);
      resolve();
    };
    element.addEventListener('transitionend', handle, { once: true });
    setTimeout(() => {
      element.removeEventListener('transitionend', handle);
      if (element.parentElement) element.parentElement.removeChild(element);
      resolve();
    }, 260);
  });
}

export async function deleteFileAtIndex(index) {
  const item = state.files[index];
  if (!item) return;
  const parentHandle = item.parent || state.currentDirHandle;
  if (!parentHandle) {
    alert('未选择目录');
    return;
  }
  try {
    await parentHandle.removeEntry(item.name);
    cleanupItemResources(item, { preserveElement: true });
    const removalPromise = smoothRemoveItem(item);
    state.files.splice(index, 1);
    // updateItemIndices(index); // This needs to be imported from somewhere or moved here
    // Actually updateItemIndices is UI logic mostly.
    
    // We need to re-implement updateItemIndices here or import it.
    // Let's assume we import it from viewer.js (where it was in my mental map)
    updateItemIndices(index);

    syncEmptyState();
    if (!state.files.length) {
      await removalPromise;
      cleanupItemResources(item);
      closeViewerFn();
      return;
    }
    if (!dom.viewer.classList.contains('hidden')) {
      const nextIndex = Math.min(index, state.files.length - 1);
      openViewer(nextIndex);
    }
    await removalPromise;
    cleanupItemResources(item);
    scheduleMasonryLayout();
  } catch (err) {
    console.error('删除失败', err);
    alert('删除失败: ' + err.message);
  }
}
