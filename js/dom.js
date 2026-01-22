
export const dom = {
  dirLabel: document.getElementById('dirLabel'),
  statsLabel: document.getElementById('statsLabel'),
  gallery: document.getElementById('gallery'),
  viewer: document.getElementById('viewer'),
  viewerStage: document.getElementById('viewerStage'),
  viewerImg: document.getElementById('viewerImg'),
  viewerInfo: document.getElementById('viewerInfo'),
  layoutVerticalBtn: document.getElementById('layoutVertical'),
  layoutHorizontalBtn: document.getElementById('layoutHorizontal'),
  closeViewer: document.getElementById('closeViewer'),
  viewerBackdrop: document.getElementById('viewerBackdrop'),
  deleteBtn: document.getElementById('deleteBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  fullscreenBtn: document.getElementById('fullscreenBtn'),
  emptyState: document.getElementById('emptyState'),
  dropOverlay: document.getElementById('dropOverlay'),
  openBtn: document.getElementById('openDir'),
  viewerActions: document.querySelector('.viewer-actions'),
  
  // Settings elements
  settingsBtn: document.getElementById('settingsBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  colWidthSlider: document.getElementById('colWidthSlider'),
  colWidthValue: document.getElementById('colWidthValue'),
  rowHeightSlider: document.getElementById('rowHeightSlider'),
  rowHeightValue: document.getElementById('rowHeightValue'),
  verticalSetting: document.getElementById('verticalSetting'),
  horizontalSetting: document.getElementById('horizontalSetting'),
  
  // Editor elements
  editBtn: document.getElementById('editBtn'),
  editor: document.getElementById('editor'),
  editorCanvas: document.getElementById('editorCanvas'),
  rotateLeftBtn: document.getElementById('rotateLeftBtn'),
  rotateRightBtn: document.getElementById('rotateRightBtn'),
  flipHBtn: document.getElementById('flipHBtn'),
  flipVBtn: document.getElementById('flipVBtn'),
  cropBtn: document.getElementById('cropBtn'),
  cropTools: document.getElementById('cropTools'),
  applyCropBtn: document.getElementById('applyCropBtn'),
  cancelCropBtn: document.getElementById('cancelCropBtn'),
  cropContainer: document.getElementById('cropContainer'),
  cropBox: document.getElementById('cropBox'),
  filterSelect: document.getElementById('filterSelect'),
  saveBtn: document.getElementById('saveBtn'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  
  // Save Dialog elements
  saveDialog: document.getElementById('saveDialog'),
  saveFormat: document.getElementById('saveFormat'),
  saveQuality: document.getElementById('saveQuality'),
  saveQualityValue: document.getElementById('saveQualityValue'),
  overwriteBtn: document.getElementById('overwriteBtn'),
  confirmSaveBtn: document.getElementById('confirmSaveBtn'),
  cancelSaveBtn: document.getElementById('cancelSaveBtn'),

  // Will be populated later
  emptyStateText: document.getElementById('emptyState') ? document.getElementById('emptyState').querySelector('p') : null,
};

// Ensure viewerActions is appended to stage if it exists (logic from original app.js)
if (dom.viewerStage && dom.viewerActions) {
  dom.viewerStage.appendChild(dom.viewerActions);
}
