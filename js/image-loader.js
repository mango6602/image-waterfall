
import { PLACEHOLDER } from './utils.js';

export const supportsCreateImageBitmap = typeof window.createImageBitmap === 'function';

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
