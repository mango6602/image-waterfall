
import { state } from './state.js';
import { dom } from './dom.js';
import { PLACEHOLDER } from './utils.js';
import { openViewer } from './viewer.js';

export const imgToItem = new WeakMap();
export const wrapperToItem = new WeakMap();

let masonryLayoutRaf = 0;
const supportsIntersectionObserver = 'IntersectionObserver' in window;

const lazyObserver = supportsIntersectionObserver
  ? new IntersectionObserver(handleLazyEntries, { root: null, rootMargin: '400px' })
  : null;

export const supportsCreateImageBitmap = typeof window.createImageBitmap === 'function';

export function getMasonryColumnCount() {
  if (!dom.gallery) return 1;
  
  if (state.settings && state.settings.minColWidth) {
    const containerWidth = dom.gallery.clientWidth;
    // If containerWidth is 0 (e.g. hidden), we can't calculate accurately.
    // Fallback to default logic or return a safe guess.
    if (containerWidth > 0) {
      const gap = 12; // Must match CSS --gutter
      const minW = state.settings.minColWidth;
      const cols = Math.floor((containerWidth + gap) / (minW + gap));
      return Math.max(1, cols);
    }
  }

  const raw = getComputedStyle(dom.gallery).getPropertyValue('--masonry-cols').trim();
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 4;
}

export function ensureMasonryColumns(colCount) {
  if (!dom.gallery) return [];
  const count = Math.max(1, Number.isFinite(colCount) ? colCount : 1);
  const existing = Array.from(dom.gallery.querySelectorAll(':scope > .masonry-col'));
  if (existing.length === count) return existing;

  dom.gallery.textContent = '';
  const cols = [];
  for (let i = 0; i < count; i += 1) {
    const col = document.createElement('div');
    col.className = 'masonry-col';
    col.dataset.col = i.toString();
    dom.gallery.appendChild(col);
    cols.push(col);
  }
  return cols;
}

export function applyMasonryLayout() {
  if (!dom.gallery) return;

  // Use Row Layout for horizontal mode
  if (state.layoutMode === 'horizontal') {
    applyRowLayout();
    return;
  }

  // Vertical Masonry Logic
  dom.gallery.classList.remove('row-layout');
  dom.gallery.classList.add('masonry');
  
  const colCount = getMasonryColumnCount();
  const cols = ensureMasonryColumns(colCount);
  if (!cols.length) return;

  if (!state.files.length) return;
  const perCol = Math.ceil(state.files.length / colCount);

  for (let i = 0; i < state.files.length; i += 1) {
    const item = state.files[i];
    if (!item || !item.element) continue;

    // Reset row layout styles if any
    item.element.style.width = '';
    item.element.style.height = '';
    item.element.style.flexGrow = '';
    item.element.style.flexBasis = '';

    const colIndex = Math.floor(i / perCol);
    const targetIndex = (colIndex >= colCount) ? colCount - 1 : colIndex;
    const targetCol = cols[targetIndex] || cols[0];
    targetCol.appendChild(item.element);
  }
}

function applyRowLayout() {
  if (!dom.gallery || !state.files.length) return;

  // Reset gallery container styles
  dom.gallery.classList.remove('masonry');
  dom.gallery.classList.add('row-layout');

  // Check if we need to rebuild DOM structure (switching from Masonry)
  // or just update styles (Resize or Data update)
  const isStructureValid = dom.gallery.children.length === state.files.length && 
                           !dom.gallery.querySelector('.masonry-col');

  if (!isStructureValid) {
    dom.gallery.innerHTML = '';
    const fragment = document.createDocumentFragment();
    state.files.forEach(item => {
      if (item && item.element) {
        // Reset styles
        item.element.style.cssText = ''; 
        if (item.aspectRatio) {
           item.element.style.setProperty('--aspect-ratio', item.aspectRatio.toString());
        }
        fragment.appendChild(item.element);
      }
    });
    dom.gallery.appendChild(fragment);
  }

  // Calculate Geometry
  const containerWidth = dom.gallery.clientWidth;
  if (!containerWidth) return; // not visible

  const targetHeight = (state.settings && state.settings.rowHeight) ? state.settings.rowHeight : 320; 
  const gutter = 12; // Must match CSS --gutter

  let currentRow = [];
  let currentWidth = 0;

  for (let i = 0; i < state.files.length; i++) {
    const item = state.files[i];
    if (!item || !item.element) continue;

    // Ensure we have aspect ratio (default to 1 if missing)
    const ratio = (Number.isFinite(item.aspectRatio) && item.aspectRatio > 0) ? item.aspectRatio : 1;
    const itemWidth = targetHeight * ratio;

    currentRow.push({ item, ratio, width: itemWidth });
    currentWidth += itemWidth;

    // Check if row is full
    // Formula: (sum(widths) + (count-1)*gutter) > containerWidth
    const gutterTotal = Math.max(0, currentRow.length - 1) * gutter;
    
    if (currentWidth + gutterTotal > containerWidth) {
      // Calculate exact height to fit container
      // H_new = (ContainerWidth - Gutters) / Sum(Ratios)
      const sumRatios = currentRow.reduce((acc, curr) => acc + curr.ratio, 0);
      const exactHeight = (containerWidth - gutterTotal) / sumRatios;

      // Apply to items in this row
      for (const rowItem of currentRow) {
        // We use flex-basis to set the width, and height is fixed.
        // However, to ensure perfect alignment, we should set explicit width and height.
        // But using flex-grow: 0 and flex-basis is cleaner.
        const w = exactHeight * rowItem.ratio;
        
        // Update styles directly
        const s = rowItem.item.element.style;
        s.height = `${exactHeight}px`;
        s.width = `${w}px`;
        s.flexGrow = '0';
        s.flexBasis = `${w}px`;
        s.maxWidth = 'none'; // Ensure no CSS constraint
      }

      currentRow = [];
      currentWidth = 0;
    }
  }

  // Handle last row
  if (currentRow.length > 0) {
    for (const rowItem of currentRow) {
      const s = rowItem.item.element.style;
      // Keep target height, do not stretch
      const w = targetHeight * rowItem.ratio;
      s.height = `${targetHeight}px`;
      s.width = `${w}px`;
      s.flexGrow = '0';
      s.flexBasis = `${w}px`;
      s.maxWidth = 'none';
    }
  }
}

export function scheduleMasonryLayout() {
  if (masonryLayoutRaf) cancelAnimationFrame(masonryLayoutRaf);
  masonryLayoutRaf = requestAnimationFrame(() => {
    masonryLayoutRaf = 0;
    applyMasonryLayout();
  });
}

export function appendImageItem(item, index) {
  const wrapper = document.createElement('div');
  wrapper.className = 'item';
  wrapper.dataset.index = index.toString();

  const img = document.createElement('img');
  img.dataset.index = index.toString();
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = PLACEHOLDER;
  img.alt = item.displayName;
  img.title = item.displayName;
  img.addEventListener('click', onItemClick);
  img.addEventListener('load', () => {
    if (img.src === PLACEHOLDER) return;
    img.classList.add('loaded');
    wrapper.classList.add('loaded');
  });

  wrapper.appendChild(img);
  // Note: We don't append to DOM here immediately if we are rebuilding everything, 
  // but the original code appended to mount. 
  // In loadImagesFromDir, we clear gallery then append.
  const mount = dom.gallery.querySelector('.masonry-col') || dom.gallery;
  mount.appendChild(wrapper);

  item.element = wrapper;
  item.imgElement = img;
  wrapperToItem.set(wrapper, item);
  imgToItem.set(img, item);
  applyAspectRatio(item);

  if (lazyObserver) {
    lazyObserver.observe(img);
  } else {
    prepareItemForLoad(item);
    loadImageIntoElement(item, img);
  }
}

function onItemClick(ev) {
  const target = ev.currentTarget;
  if (!(target instanceof HTMLImageElement)) return;
  const index = Number(target.dataset.index);
  if (!Number.isFinite(index)) return;
  openViewer(index);
}

export function applyAspectRatio(item) {
  if (!item || !item.element) return;
  if (!Number.isFinite(item.aspectRatio) || item.aspectRatio <= 0) return;
  item.element.style.setProperty('--aspect-ratio', item.aspectRatio.toString());
  
  // If we are in horizontal mode, an update to aspect ratio requires a relayout
  // because the widths depend on aspect ratios.
  if (state.layoutMode === 'horizontal') {
    scheduleMasonryLayout();
  }
}

export function prepareItemForLoad(item) {
  if (!item) return;
  applyAspectRatio(item);
  if (Number.isFinite(item.aspectRatio) && item.aspectRatio > 0) return;
  if (item.preparing) return;
  item.preparing = true;
  ensureImageMetaForItem(item)
    .then(() => {
      applyAspectRatio(item);
    })
    .catch((err) => {
      console.warn('读取图片信息失败', err);
    })
    .finally(() => {
      item.preparing = false;
    });
}

export function loadImageIntoElement(item, img) {
  ensureObjectURLForItem(item)
    .then((url) => {
      if (!item || item.imgElement !== img) return;
      if (!state.files.includes(item)) return;
      img.src = url;
    })
    .catch((err) => console.error('图片加载失败', err));
}

function handleLazyEntries(entries) {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const target = entry.target;
    if (!(target instanceof HTMLImageElement)) return;
    lazyObserver.unobserve(target);
    const item = imgToItem.get(target);
    if (!item) return;
    prepareItemForLoad(item);
    loadImageIntoElement(item, target);
  });
}

export function resetLazyObserver() {
  if (lazyObserver) lazyObserver.disconnect();
}

// These helper functions (ensureImageMetaForItem, ensureObjectURLForItem) 
// depend on file handling. 
// I should probably move them to `file-system.js` or `utils.js` if they are pure data fetchers.
// `ensureImageMetaForItem` uses `createImageBitmap` or `Image` object.
// `ensureObjectURLForItem` uses `URL.createObjectURL`.
// They are intimately tied to the item object structure.

// Let's import them from file-system.js to avoid duplication/cycles?
// Actually `gallery.js` calls them.
// So `gallery.js` -> `file-system.js`.

import { ensureImageMetaForItem, ensureObjectURLForItem } from './file-system.js';
