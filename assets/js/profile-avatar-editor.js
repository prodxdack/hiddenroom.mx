const MAX_PROFILE_AVATAR_BYTES = 12 * 1024 * 1024;
const PROFILE_AVATAR_TYPES = /\.(jpg|jpeg|png|webp)$/i;

export function resolveProfileAvatarUrl(value, cloudOrigin = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(?:https?:|data:|blob:)/i.test(raw)) return raw;
  if (/^\/api\/beat-store\/producer-avatar(?:\?|$)/i.test(raw) && cloudOrigin) {
    return new URL(raw, cloudOrigin).href;
  }
  if (raw.startsWith('/')) {
    return new URL(raw, window.location.origin).href;
  }
  return raw;
}

export function initProfileAvatarEditor(options = {}) {
  const {
    input,
    editor,
    preview,
    stage,
    zoom,
    resetButton,
    cancelButton,
    saveButton,
    status,
    onSave,
  } = options;

  if (!input || !editor || !preview || !stage || !zoom || !resetButton || !cancelButton || !saveButton || !status || typeof onSave !== 'function') {
    return { destroy() {}, cancel() {} };
  }

  let objectUrl = '';
  const pointers = new Map();
  let pinchStart = null;
  let dragStart = null;
  const cropState = { x: 0.5, y: 0.5, zoom: 1 };

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', Boolean(isError));
  };

  const clearObjectUrl = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  };

  const imageRatio = () => (preview.naturalWidth || 1) / (preview.naturalHeight || 1);

  const axisCanMove = () => {
    const ratio = imageRatio();
    const currentZoom = cropState.zoom;
    return {
      x: Math.max(ratio, 1) * currentZoom > 1.001,
      y: Math.max(1 / ratio, 1) * currentZoom > 1.001,
    };
  };

  const clampCrop = () => {
    cropState.zoom = Math.max(1, Math.min(3, cropState.zoom));
    const movable = axisCanMove();
    cropState.x = movable.x ? Math.max(0, Math.min(1, cropState.x)) : 0.5;
    cropState.y = movable.y ? Math.max(0, Math.min(1, cropState.y)) : 0.5;
  };

  const updatePreview = () => {
    clampCrop();
    const { x, y, zoom: currentZoom } = cropState;
    const extraPan = currentZoom > 1 ? ((currentZoom - 1) / currentZoom) * 50 : 0;
    preview.style.objectPosition = `${x * 100}% ${y * 100}%`;
    preview.style.transform = `translate(${(0.5 - x) * extraPan}%, ${(0.5 - y) * extraPan}%) scale(${currentZoom})`;
  };

  const resetCrop = () => {
    cropState.x = 0.5;
    cropState.y = 0.5;
    cropState.zoom = 1;
    zoom.value = '1';
    updatePreview();
  };

  const cancel = () => {
    clearObjectUrl();
    input.value = '';
    preview.removeAttribute('src');
    editor.hidden = true;
    pointers.clear();
    pinchStart = null;
    dragStart = null;
    stage.classList.remove('is-dragging');
    setStatus('');
  };

  const handleSelection = () => {
    const file = input.files?.[0];
    clearObjectUrl();
    if (!file) {
      editor.hidden = true;
      return;
    }
    const isImage = file.type.startsWith('image/') || PROFILE_AVATAR_TYPES.test(file.name);
    if (!isImage || file.size > MAX_PROFILE_AVATAR_BYTES) {
      setStatus(file.size > MAX_PROFILE_AVATAR_BYTES ? 'La imagen supera el límite de 12 MB.' : 'Selecciona una imagen válida.', true);
      input.value = '';
      editor.hidden = true;
      return;
    }
    objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    preview.onload = updatePreview;
    editor.hidden = false;
    setStatus('');
    resetCrop();
  };

  const pointerSnapshot = (event) => ({ x: event.clientX, y: event.clientY });

  const pointerDistance = () => {
    const points = Array.from(pointers.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const handlePointerDown = (event) => {
    if (!preview.src) return;
    event.preventDefault();
    stage.setPointerCapture?.(event.pointerId);
    stage.classList.add('is-dragging');
    pointers.set(event.pointerId, pointerSnapshot(event));
    if (pointers.size === 2) {
      pinchStart = { distance: pointerDistance(), zoom: cropState.zoom };
      dragStart = null;
      return;
    }
    dragStart = { x: event.clientX, y: event.clientY, cropX: cropState.x, cropY: cropState.y };
  };

  const handlePointerMove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, pointerSnapshot(event));
    if (pointers.size >= 2 && pinchStart?.distance) {
      cropState.zoom = pinchStart.zoom * (pointerDistance() / pinchStart.distance);
      zoom.value = String(cropState.zoom);
      updatePreview();
      return;
    }
    if (!dragStart) return;
    const rect = stage.getBoundingClientRect();
    const movable = axisCanMove();
    const dragRangeX = movable.x ? Math.max(0.25, cropState.zoom - 0.5) : Number.POSITIVE_INFINITY;
    const dragRangeY = movable.y ? Math.max(0.25, cropState.zoom - 0.5) : Number.POSITIVE_INFINITY;
    cropState.x = dragStart.cropX - ((event.clientX - dragStart.x) / Math.max(1, rect.width) / dragRangeX);
    cropState.y = dragStart.cropY - ((event.clientY - dragStart.y) / Math.max(1, rect.height) / dragRangeY);
    updatePreview();
  };

  const handlePointerEnd = (event) => {
    pointers.delete(event.pointerId);
    stage.releasePointerCapture?.(event.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (!pointers.size) {
      dragStart = null;
      stage.classList.remove('is-dragging');
    }
  };

  const handleWheel = (event) => {
    if (!preview.src) return;
    event.preventDefault();
    cropState.zoom += event.deltaY < 0 ? 0.08 : -0.08;
    zoom.value = String(cropState.zoom);
    updatePreview();
  };

  const currentCrop = () => {
    clampCrop();
    return { x: cropState.x, y: cropState.y, size: 1 / cropState.zoom };
  };

  const handleSave = async () => {
    const file = input.files?.[0];
    if (!file) return;
    saveButton.disabled = true;
    setStatus('Procesando foto...');
    try {
      await onSave({ file, crop: currentCrop(), setStatus, cancel });
      cancel();
    } catch (error) {
      setStatus(error?.message || 'No se pudo guardar la foto.', true);
    } finally {
      saveButton.disabled = false;
    }
  };

  input.addEventListener('change', handleSelection);
  resetButton.addEventListener('click', resetCrop);
  cancelButton.addEventListener('click', cancel);
  saveButton.addEventListener('click', handleSave);
  zoom.addEventListener('input', () => {
    cropState.zoom = Number(zoom.value) || 1;
    updatePreview();
  });
  stage.addEventListener('pointerdown', handlePointerDown);
  stage.addEventListener('pointermove', handlePointerMove);
  stage.addEventListener('pointerup', handlePointerEnd);
  stage.addEventListener('pointercancel', handlePointerEnd);
  stage.addEventListener('wheel', handleWheel, { passive: false });

  return {
    cancel,
    destroy() {
      cancel();
      input.removeEventListener('change', handleSelection);
      resetButton.removeEventListener('click', resetCrop);
      cancelButton.removeEventListener('click', cancel);
      saveButton.removeEventListener('click', handleSave);
      stage.removeEventListener('pointerdown', handlePointerDown);
      stage.removeEventListener('pointermove', handlePointerMove);
      stage.removeEventListener('pointerup', handlePointerEnd);
      stage.removeEventListener('pointercancel', handlePointerEnd);
      stage.removeEventListener('wheel', handleWheel);
    },
  };
}
