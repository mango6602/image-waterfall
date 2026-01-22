import { dom } from './dom.js';
import { state } from './state.js';

let editorState = {
  rotation: 0,
  flipH: 1, // 1 or -1
  flipV: 1, // 1 or -1
  filter: 'none',
  originalImage: null,
  canvasContext: null,
  src: ''
};

let cropState = {
  isDragging: false,
  isResizing: false,
  dragStartX: 0,
  dragStartY: 0,
  initialBox: { x: 0, y: 0, w: 0, h: 0 },
  handle: null
};

export function initEditor() {
  if (!dom.editBtn) return;

  // Edit button in viewer
  dom.editBtn.addEventListener('click', () => {
    if (dom.viewerImg.src) {
      openEditor(dom.viewerImg.src);
    }
  });

  // Editor Toolbar Buttons
  dom.rotateLeftBtn.addEventListener('click', () => {
    editorState.rotation = (editorState.rotation - 90) % 360;
    drawImage();
  });

  dom.rotateRightBtn.addEventListener('click', () => {
    editorState.rotation = (editorState.rotation + 90) % 360;
    drawImage();
  });

  dom.flipHBtn.addEventListener('click', () => {
    editorState.flipH *= -1;
    drawImage();
  });

  dom.flipVBtn.addEventListener('click', () => {
    editorState.flipV *= -1;
    drawImage();
  });

  dom.filterSelect.addEventListener('change', (e) => {
    editorState.filter = e.target.value;
    drawImage();
  });

  dom.cancelEditBtn.addEventListener('click', closeEditor);

  dom.saveBtn.addEventListener('click', openSaveDialog);
  
  // Crop Buttons
  if (dom.cropBtn) {
    dom.cropBtn.addEventListener('click', enterCropMode);
    dom.applyCropBtn.addEventListener('click', applyCrop);
    dom.cancelCropBtn.addEventListener('click', exitCropMode);
    
    // Crop interaction
    dom.cropContainer.addEventListener('mousedown', onCropMouseDown);
    window.addEventListener('mousemove', onCropMouseMove);
    window.addEventListener('mouseup', onCropMouseUp);
  }

  // Save Dialog Buttons
  dom.saveQuality.addEventListener('input', (e) => {
    dom.saveQualityValue.textContent = e.target.value;
  });

  if (dom.overwriteBtn) {
    dom.overwriteBtn.addEventListener('click', overwriteOriginal);
  }
  dom.saveFormat.addEventListener('change', updateOverwriteBtnVisibility);

  dom.cancelSaveBtn.addEventListener('click', closeSaveDialog);
  dom.confirmSaveBtn.addEventListener('click', executeSave);
}

function updateOverwriteBtnVisibility() {
  if (!dom.overwriteBtn) return;
  
  const item = state.files[state.currentIndex];
  const format = dom.saveFormat.value;
  
  // Check if we have a file handle
  if (!item || !item.handle) {
    dom.overwriteBtn.classList.add('hidden');
    return;
  }
  
  // Check if extension matches format
  const name = item.name.toLowerCase();
  const ext = name.substring(name.lastIndexOf('.') + 1);
  
  const formatExts = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'image/avif': ['avif'],
    'image/bmp': ['bmp']
  };
  
  const allowed = formatExts[format] || [];
  
  if (allowed.includes(ext)) {
    dom.overwriteBtn.classList.remove('hidden');
  } else {
    dom.overwriteBtn.classList.add('hidden');
  }
}

async function overwriteOriginal() {
  if (!confirm('确定要覆盖原图吗？此操作不可撤销。')) return;

  let format = dom.saveFormat.value;
  const quality = parseFloat(dom.saveQuality.value);
  const canvas = dom.editorCanvas;
  const item = state.files[state.currentIndex];
  
  if (!item || !item.handle) return;

  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality));
    
    if (!blob) {
      alert('生成图片失败');
      return;
    }

    // Check for format mismatch
    if (blob.type !== format) {
      if (format === 'image/avif') {
        alert('当前浏览器不支持 AVIF 编码，将自动保存为 PNG 格式。');
      }
      format = blob.type;
    }

    const writable = await item.handle.createWritable();
    await writable.write(blob);
    await writable.close();
    
    // Update local state and UI
    const newUrl = URL.createObjectURL(blob);
    if (item.url) URL.revokeObjectURL(item.url);
    item.url = newUrl;
    
    // Refresh viewer image
    dom.viewerImg.src = newUrl;
    
    // Refresh grid item if exists
    // We rely on data-index attribute if it exists, or just reload logic
    // But since we are in editor (on top of viewer), updating viewerImg is crucial.
    // The gallery item might need updating too.
    // The gallery items are lazily loaded.
    // We can try to find the image in gallery.
    const allImages = dom.gallery.querySelectorAll('img');
    // This is inefficient but functional for now.
    // Better: state.files[index].imgElement if we stored it?
    // In file-system.js we saw item.imgElement = null;
    
    // Just finding by src is tricky if src was revoked.
    // But we updated item.url.
    // If the gallery item uses item.url, we need to update the img src.
    
    // Let's assume gallery refresh is secondary or handled by next render.
    // But we should try to update the visible thumbnail.
    // We can use state.currentIndex to find the element if we can.
    // The gallery layout doesn't strictly map index to DOM order if sorted/filtered?
    // Actually file-system.js sorts files.
    
    // Ideally we re-render or update the specific node.
    // For now, let's just update editor/viewer and alert success.
    
    alert('覆盖成功！');
    closeSaveDialog();
    closeEditor();
    
  } catch (e) {
    console.error(e);
    alert('覆盖失败：' + e.message);
  }
}


function enterCropMode() {
  // Hide main tools, show crop tools
  document.querySelectorAll('.editor-toolbar .editor-tools-group').forEach(el => {
      if (el.id === 'cropTools') el.classList.remove('hidden');
      else el.classList.add('hidden');
  });

  dom.cropContainer.classList.remove('hidden');
  
  // Initialize crop box size and position to match canvas
  const canvas = dom.editorCanvas;
  
  dom.cropContainer.style.width = `${canvas.clientWidth}px`;
  dom.cropContainer.style.height = `${canvas.clientHeight}px`;
  dom.cropContainer.style.left = `${canvas.offsetLeft}px`;
  dom.cropContainer.style.top = `${canvas.offsetTop}px`;
  
  // Initial box: 90% of area centered
  const w = canvas.clientWidth * 0.9;
  const h = canvas.clientHeight * 0.9;
  const x = (canvas.clientWidth - w) / 2;
  const y = (canvas.clientHeight - h) / 2;
  
  updateCropBox(x, y, w, h);
}

function exitCropMode() {
  document.querySelectorAll('.editor-toolbar .editor-tools-group').forEach(el => {
      if (el.id === 'cropTools') el.classList.add('hidden');
      else el.classList.remove('hidden');
  });
  dom.cropContainer.classList.add('hidden');
}

function updateCropBox(x, y, w, h) {
  const box = dom.cropBox;
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  box.style.width = `${w}px`;
  box.style.height = `${h}px`;
}

function onCropMouseDown(e) {
  if (dom.cropContainer.classList.contains('hidden')) return;

  if (e.target.classList.contains('crop-handle')) {
    cropState.isResizing = true;
    cropState.handle = e.target.dataset.handle;
  } else if (e.target.id === 'cropBox' || e.target.closest('#cropBox')) {
    cropState.isDragging = true;
  } else {
    return;
  }
  
  cropState.dragStartX = e.clientX;
  cropState.dragStartY = e.clientY;
  
  const box = dom.cropBox;
  cropState.initialBox = {
    x: box.offsetLeft,
    y: box.offsetTop,
    w: box.offsetWidth,
    h: box.offsetHeight
  };
  
  e.preventDefault();
}

function onCropMouseMove(e) {
  if (!cropState.isDragging && !cropState.isResizing) return;
  
  const dx = e.clientX - cropState.dragStartX;
  const dy = e.clientY - cropState.dragStartY;
  const containerW = dom.cropContainer.clientWidth;
  const containerH = dom.cropContainer.clientHeight;
  
  if (cropState.isDragging) {
    let newX = cropState.initialBox.x + dx;
    let newY = cropState.initialBox.y + dy;
    
    // Constrain
    newX = Math.max(0, Math.min(newX, containerW - cropState.initialBox.w));
    newY = Math.max(0, Math.min(newY, containerH - cropState.initialBox.h));
    
    updateCropBox(newX, newY, cropState.initialBox.w, cropState.initialBox.h);
  } else if (cropState.isResizing) {
    let { x, y, w, h } = cropState.initialBox;
    const handle = cropState.handle;
    
    if (handle.includes('e')) w += dx;
    if (handle.includes('w')) { x += dx; w -= dx; }
    if (handle.includes('s')) h += dy;
    if (handle.includes('n')) { y += dy; h -= dy; }
    
    // Min size check
    if (w < 20) w = 20;
    if (h < 20) h = 20;
    
    // Constrain to container
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > containerW) w = containerW - x;
    if (y + h > containerH) h = containerH - y;
    
    updateCropBox(x, y, w, h);
  }
}

function onCropMouseUp() {
  cropState.isDragging = false;
  cropState.isResizing = false;
  cropState.handle = null;
}

async function applyCrop() {
  const canvas = dom.editorCanvas;
  const box = dom.cropBox;
  
  const scaleX = canvas.width / canvas.clientWidth;
  const scaleY = canvas.height / canvas.clientHeight;
  
  const cropX = box.offsetLeft * scaleX;
  const cropY = box.offsetTop * scaleY;
  const cropW = box.offsetWidth * scaleX;
  const cropH = box.offsetHeight * scaleY;
  
  try {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const ctx = tempCanvas.getContext('2d');
    
    ctx.drawImage(
      canvas,
      cropX, cropY, cropW, cropH,
      0, 0, cropW, cropH
    );
    
    const newImage = new Image();
    newImage.src = tempCanvas.toDataURL();
    
    await new Promise(resolve => newImage.onload = resolve);
    
    editorState.originalImage = newImage;
    editorState.rotation = 0;
    editorState.flipH = 1;
    editorState.flipV = 1;
    editorState.filter = 'none';
    dom.filterSelect.value = 'none';
    
    drawImage();
    exitCropMode();
    
  } catch (e) {
    console.error("Crop failed", e);
    alert("裁剪失败");
  }
}

function openEditor(src) {
  editorState = {
    rotation: 0,
    flipH: 1,
    flipV: 1,
    filter: 'none',
    originalImage: new Image(),
    canvasContext: dom.editorCanvas.getContext('2d'),
    src: src
  };

  editorState.originalImage.onload = () => {
    dom.editor.classList.remove('hidden');
    drawImage();
  };
  editorState.originalImage.src = src;
}

function closeEditor() {
  dom.editor.classList.add('hidden');
  // Reset input values if needed
  dom.filterSelect.value = 'none';
}

function drawImage() {
  const { originalImage, rotation, flipH, flipV, filter } = editorState;
  const canvas = dom.editorCanvas;
  const ctx = editorState.canvasContext;

  // Determine canvas size based on rotation
  if (Math.abs(rotation) % 180 === 90) {
    canvas.width = originalImage.naturalHeight;
    canvas.height = originalImage.naturalWidth;
  } else {
    canvas.width = originalImage.naturalWidth;
    canvas.height = originalImage.naturalHeight;
  }

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Save context state
  ctx.save();

  // Apply Filter
  if (filter !== 'none') {
    switch (filter) {
      case 'grayscale': ctx.filter = 'grayscale(100%)'; break;
      case 'sepia': ctx.filter = 'sepia(100%)'; break;
      case 'invert': ctx.filter = 'invert(100%)'; break;
      case 'blur': ctx.filter = 'blur(5px)'; break;
      case 'brightness': ctx.filter = 'brightness(150%)'; break;
      case 'contrast': ctx.filter = 'contrast(150%)'; break;
    }
  }

  // Translate to center
  ctx.translate(canvas.width / 2, canvas.height / 2);

  // Rotate
  ctx.rotate((rotation * Math.PI) / 180);

  // Flip
  ctx.scale(flipH, flipV);

  // Draw image centered
  ctx.drawImage(
    originalImage,
    -originalImage.naturalWidth / 2,
    -originalImage.naturalHeight / 2
  );

  // Restore context
  ctx.restore();
}

function openSaveDialog() {
  dom.saveDialog.classList.remove('hidden');
  // Reset quality to default
  dom.saveQuality.value = 0.9;
  dom.saveQualityValue.textContent = '0.9';
  
  updateOverwriteBtnVisibility();
}

function closeSaveDialog() {
  dom.saveDialog.classList.add('hidden');
}

async function executeSave() {
  let format = dom.saveFormat.value;
  const quality = parseFloat(dom.saveQuality.value);
  const canvas = dom.editorCanvas;

  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality));
    
    if (!blob) {
      alert('保存失败：无法生成图片数据');
      return;
    }

    // Check if browser supports the requested format
    if (blob.type !== format) {
      if (format === 'image/avif') {
        alert('当前浏览器不支持 AVIF 编码，将自动保存为 PNG 格式。');
      }
      format = blob.type;
    }

    // Try File System Access API
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: getSuggestedName(format),
          types: [{
            description: 'Image File',
            accept: { [format]: ['.' + format.split('/')[1].replace('jpeg', 'jpg')] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        closeSaveDialog();
        closeEditor();
        alert('保存成功！');
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Save failed:', err);
          fallbackDownload(blob, format);
        }
      }
    } else {
      fallbackDownload(blob, format);
    }
  } catch (error) {
    console.error('Error saving image:', error);
    alert('保存出错');
  }
}

function getSuggestedName(format) {
  const originalName = state.files[state.currentIndex]?.name || 'image';
  const namePart = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
  const ext = format.split('/')[1].replace('jpeg', 'jpg');
  return `${namePart}_edited.${ext}`;
}

function fallbackDownload(blob, format) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getSuggestedName(format);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  closeSaveDialog();
  closeEditor();
}
