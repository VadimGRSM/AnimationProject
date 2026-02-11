// =======================
// Константы инструментов
// =======================

const TOOL_BRUSH = 'brush';
const TOOL_ERASER = 'eraser';
const TOOL_FILL = 'fill';
const TOOL_EYEDROPPER = 'eyedropper';
const TOOL_RECTANGLE = 'rectangle';
const TOOL_ELLIPSE = 'ellipse';
const TOOL_LINE = 'line';
const TOOL_SELECT = 'select';
const TOOL_PAN = 'pan';

const SELECT_RECT = 'rect';
const SELECT_ELLIPSE = 'ellipse';
const SELECT_LASSO = 'lasso';
const SELECT_MAGIC = 'magic';

const TOOL_SET = new Set([
    TOOL_BRUSH,
    TOOL_ERASER,
    TOOL_FILL,
    TOOL_EYEDROPPER,
    TOOL_RECTANGLE,
    TOOL_ELLIPSE,
    TOOL_LINE,
    TOOL_SELECT,
    TOOL_PAN,
]);

// =======================
// Глобальные ссылки на DOM
// =======================

const editorRoot = document.querySelector('.editor-root');
const canvas = document.getElementById('editor-canvas');
let ctx = null;
const overlayCanvas = document.getElementById('editor-overlay');
const overlayCtx = overlayCanvas ? overlayCanvas.getContext('2d') : null;
const onionPrevCanvas = document.getElementById('editor-onion-prev');
const onionPrevCtx = onionPrevCanvas ? onionPrevCanvas.getContext('2d') : null;
const onionNextCanvas = document.getElementById('editor-onion-next');
const onionNextCtx = onionNextCanvas ? onionNextCanvas.getContext('2d') : null;

const toolbar = document.querySelector('.editor-toolbar');
const canvasWrapper = document.querySelector('.canvas-wrapper');
const editorMain = document.querySelector('.editor-main');
const toolButtons = document.querySelectorAll('.tool-button[data-tool]');
const selectionModeButtons = document.querySelectorAll('[data-select-mode]');
const wandSensitivityInput = document.getElementById('wand-sensitivity');
const colorInput = document.getElementById('color-picker');
const sizeInput = document.getElementById('brush-size');
const saveButton = document.getElementById('save-project-button');
const exportButton = document.getElementById('export-project-button');
const saveStatus = document.getElementById('save-status');
const saveIndicator = document.getElementById('save-indicator');
const lastSavedLabel = document.getElementById('last-saved-time');

const exportModal = document.getElementById('export-modal');
const exportModalCloseButton = document.getElementById('export-modal-close');
const exportCancelButton = document.getElementById('export-cancel-button');
const exportConfirmButton = document.getElementById('export-confirm-button');
const exportResolutionSelect = document.getElementById('export-resolution');
const exportFpsInput = document.getElementById('export-fps');
const exportGifOptions = document.getElementById('export-gif-options');
const exportGifInfiniteCheckbox = document.getElementById('export-gif-infinite');
const exportGifLoopCountInput = document.getElementById('export-gif-loop-count');
const exportErrorLabel = document.getElementById('export-error');
const exportProgress = document.getElementById('export-progress');
const exportResult = document.getElementById('export-result');
const exportDownloadLink = document.getElementById('export-download-link');
const exportFormatInputs = exportModal
    ? exportModal.querySelectorAll('input[name="export-format"]')
    : [];
const eyedropperZoom = document.getElementById('eyedropper-zoom');
const eyedropperZoomCanvas = document.getElementById('eyedropper-zoom-canvas');
const eyedropperZoomCtx = eyedropperZoomCanvas ? eyedropperZoomCanvas.getContext('2d') : null;
const layersList = document.getElementById('layers-list');
const layersEmpty = document.getElementById('layers-empty');
const addLayerButton = document.getElementById('add-layer-button');
const layersPanel = document.querySelector('.layers-panel');
const layersPanelHeader = layersPanel ? layersPanel.querySelector('.layers-panel__header') : null;
const historyPanel = document.querySelector('.history-panel');
const historyPanelHeader = historyPanel ? historyPanel.querySelector('.history-panel__header') : null;
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');

const editorProjectId = (editorRoot && editorRoot.dataset.projectId) || 'unknown';
const PANEL_POSITION_STORAGE_PREFIX = `anim.editor.${editorProjectId}.panelPosition.`;

const timelineStrip = document.getElementById('timeline-strip');
const addFrameButton = document.getElementById('add-frame-button');
const duplicateFrameButton = document.getElementById('duplicate-frame-button');
const deleteFrameButton = document.getElementById('delete-frame-button');
const onionToggleButton = document.getElementById('onion-skin-toggle');
const onionPanel = document.getElementById('onion-skin-panel');
const onionPanelHeader = onionPanel ? onionPanel.querySelector('.onion-panel__header') : null;
const onionCloseButton = document.getElementById('onion-skin-close');
const onionCountInput = document.getElementById('onion-skin-count');
const onionCountValueLabel = document.getElementById('onion-skin-count-value');
const onionOpacityPrevInput = document.getElementById('onion-skin-opacity-prev');
const onionOpacityPrevValueLabel = document.getElementById('onion-skin-opacity-prev-value');
const onionOpacityNextInput = document.getElementById('onion-skin-opacity-next');
const onionOpacityNextValueLabel = document.getElementById('onion-skin-opacity-next-value');
const onionModePrevInput = document.getElementById('onion-skin-mode-prev');
const onionModeNextInput = document.getElementById('onion-skin-mode-next');
const onionModeBothInput = document.getElementById('onion-skin-mode-both');

const projectSaveUrl = (editorRoot && editorRoot.dataset.projectSaveUrl)
    || window.ANIM_PROJECT_SAVE_URL
    || '';
const projectExportUrl = (editorRoot && editorRoot.dataset.projectExportUrl)
    || window.ANIM_PROJECT_EXPORT_URL
    || '';
const framesListUrl = (editorRoot && editorRoot.dataset.framesListUrl) || '';
const frameDetailUrlTemplate = (editorRoot && editorRoot.dataset.frameDetailUrlTemplate) || '';
const frameCreateUrl = (editorRoot && editorRoot.dataset.frameCreateUrl) || '';
const frameDeleteUrlTemplate = (editorRoot && editorRoot.dataset.frameDeleteUrlTemplate) || '';
const frameReorderUrl = (editorRoot && editorRoot.dataset.frameReorderUrl) || '';
const frameSaveUrlTemplate = (editorRoot && editorRoot.dataset.frameSaveUrlTemplate)
    || window.ANIM_FRAME_SAVE_URL_TEMPLATE
    || '';
const layerListUrlTemplate = (editorRoot && editorRoot.dataset.layerListUrlTemplate)
    || '';
const layerReorderUrlTemplate = (editorRoot && editorRoot.dataset.layerReorderUrlTemplate)
    || '';
const layerUpdateUrlTemplate = (editorRoot && editorRoot.dataset.layerUpdateUrlTemplate)
    || '';
const layerDeleteUrlTemplate = (editorRoot && editorRoot.dataset.layerDeleteUrlTemplate)
    || '';
const iconRename = (editorRoot && editorRoot.dataset.iconRename) || '';
const iconEyeOpen = (editorRoot && editorRoot.dataset.iconEyeOpen) || '';
const iconEyeClosed = (editorRoot && editorRoot.dataset.iconEyeClosed) || '';
const iconTrash = (editorRoot && editorRoot.dataset.iconTrash) || '';
const iconPlus = (editorRoot && editorRoot.dataset.iconPlus) || '';
let currentFramePreviewUrl = (editorRoot && editorRoot.dataset.currentFramePreviewUrl)
    || window.ANIM_CURRENT_FRAME_PREVIEW_URL
    || '';
let currentFrameUpdatedAt = (editorRoot && editorRoot.dataset.currentFrameUpdatedAt)
    || window.ANIM_CURRENT_FRAME_UPDATED_AT
    || '';
const projectFps = (() => {
    const raw = editorRoot ? editorRoot.dataset.projectFps : null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
})();

// =======================
// Состояние рисования
// =======================

let currentTool = TOOL_BRUSH;
let currentColor = colorInput ? colorInput.value : '#000000';
let currentSize = sizeInput ? parseInt(sizeInput.value, 10) || 4 : 4;

// =======================
// Состояние слоёв
// =======================

let layers = [];
let activeLayerId = null;
let activeLayer = null;
let dragLayerId = null;
let flattenCanvas = null;
let flattenCtx = null;
let didInitBackground = false;
let isDraggingLayersPanel = false;
let layersPanelOffsetX = 0;
let layersPanelOffsetY = 0;
let isDraggingHistoryPanel = false;
let historyPanelOffsetX = 0;
let historyPanelOffsetY = 0;
let isOpacityDragging = false;

let isDrawing = false;
let activeTool = null;
let lastX = 0;
let lastY = 0;
let startX = 0;
let startY = 0;
let pendingCanvasStartFromOutside = null;

let isSelecting = false;
let selectionMode = SELECT_RECT;
let selectionDraft = null;
let selection = null;
let selectionStartX = 0;
let selectionStartY = 0;
let lassoPoints = [];
let selectionClipboard = null;
let selectionDashOffset = 0;
let selectionAnimationId = null;
let lastPointerX = null;
let lastPointerY = null;
let selectionScratchCanvas = null;
let selectionScratchCtx = null;
let lastDebugAt = 0;

let isTransformingSelection = false;
let selectionTransform = null;
let transformClipboard = null;
let hoverTransformHandle = null;
let transformHintEl = null;
let transformCompositeCanvas = null;
let transformCompositeCtx = null;

let bufferCanvas = null;
let bufferCtx = null;

let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panStartOffsetX = 0;
let panStartOffsetY = 0;
let isSpacePressed = false;
let isShiftPressed = false;

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
const SCALE_STEP = 1.1;
const SELECTION_MIN_SIZE = 4;
const LASSO_POINT_DISTANCE = 2;
const SELECTION_DASH_SPEED = 0.8;
const WAND_DEFAULT_TOLERANCE = 32;
const EYEDROPPER_ZOOM_SIZE = 120;
const EYEDROPPER_ZOOM_PIXELS = 15;
const EYEDROPPER_ZOOM_OFFSET = 18;
const LAYER_PREVIEW_SIZE = 32;
const DEBUG_COORDS = true;
const DEBUG_COORDS_THROTTLE_MS = 200;
const TRANSFORM_HANDLE_SIZE_PX = 10;
const TRANSFORM_HANDLE_HIT_PX = 16;
const TRANSFORM_HINT_OFFSET = 14;
let wandTolerance = wandSensitivityInput
    ? parseInt(wandSensitivityInput.value, 10) || WAND_DEFAULT_TOLERANCE
    : WAND_DEFAULT_TOLERANCE;

// =======================
// Состояние сохранения
// =======================

const storedFrameIndex = editorRoot ? editorRoot.dataset.currentFrameIndex : null;
let currentFrameIndex = Number(storedFrameIndex || window.ANIM_CURRENT_FRAME_INDEX) || 1;
let hasUnsavedChanges = false;
let isSaving = false;
let isAutosaving = false;
let lastSavedAt = null;
let autosaveTimerId = null;
let lastSavedTickerId = null;
let currentFrameId = null;
let timelineFrames = [];
let isSwitchingFrame = false;
let dragFrameId = null;
let panStartedByMiddle = false;
let isExporting = false;

// =======================
// Onion-Skin (соседние кадры)
// =======================

const ONION_SKIN_STORAGE_KEY = `anim.editor.${editorProjectId}.onionSkin`;
let onionEnabled = false;
let onionFrameCount = 2;
let onionOpacityPrev = 35;
let onionOpacityNext = 35;
let onionMode = 'both'; // prev | next | both
let onionSuppressed = false;
const onionFrameCache = new Map();
let onionRenderRequestId = null;
let isDraggingOnionPanel = false;
let onionPanelOffsetX = 0;
let onionPanelOffsetY = 0;

const AUTOSAVE_INTERVAL_MS = 30000;
const LAST_SAVED_TICK_MS = 1000;

// =======================
// История действий
// =======================

const HISTORY_LIMIT = 50;
const HISTORY_VISIBLE_ACTIONS = 5;
const LAYERS_VISIBLE_COUNT = 3;
const frameHistories = new Map();
let isHistoryApplying = false;
let didDrawStroke = false;
let lastDrawTool = null;
let historyPending = null;

const LEGACY_HISTORY_LABEL_KEYS = {
    'Старт кадра': 'frame_start',
    'Начало истории': 'history_start',
    'Действие': 'action',
    'Кисть': 'brush',
    'Ластик': 'eraser',
    'Заливка': 'fill',
    'Линия': 'line',
    'Прямоугольник': 'rectangle',
    'Окружность': 'ellipse',
    'Слой: добавить': 'layer_add',
    'Слой: удалить': 'layer_delete',
    'Слой: прозрачность': 'layer_opacity_action',
    'Слой: показать': 'layer_show_action',
    'Слой: скрыть': 'layer_hide_action',
    'Слой: переименовать': 'layer_rename_action',
    'Слой: порядок': 'layer_order',
    'Трансформация выделения': 'selection_transform',
    'Вырезать': 'cut',
    'Вставка': 'paste',
    'Вставка изображения': 'paste_image',
};

// =======================
// Функции установки параметров
// =======================

/**
 * Устанавливаем активный инструмент
 * и визуально подсвечиваем кнопку
 */
function setTool(toolName) {
    if (!TOOL_SET.has(toolName)) return;

    currentTool = toolName;
    activeTool = null;
    isDrawing = false;
    isPanning = false;
    if (hasFloatingSelection()) {
        commitSelectionTransform();
    }
    hideTransformHint();
    setCanvasCursorOverride(null);
    hoverTransformHandle = null;
    renderOverlay();

    toolButtons.forEach((btn) => {
        if (btn.dataset.tool === toolName) {
            btn.classList.add('tool-button--active');
        } else {
            btn.classList.remove('tool-button--active');
        }
    });

    if (toolName !== TOOL_EYEDROPPER) {
        hideEyedropperZoom();
    }
    updateCursor();
}

/**
 * Устанавливаем текущий цвет кисти
 */
function setColor(colorValue) {
    currentColor = colorValue;
}

/**
 * Устанавливаем толщину кисти
 */
function setBrushSize(size) {
    currentSize = size;
}

function setSelectionMode(mode) {
    if (mode !== SELECT_RECT && mode !== SELECT_ELLIPSE && mode !== SELECT_LASSO && mode !== SELECT_MAGIC) {
        return;
    }
    selectionMode = mode;
    selectionModeButtons.forEach((button) => {
        if (button.dataset.selectMode === mode) {
            button.classList.add('tool-button--active');
        } else {
            button.classList.remove('tool-button--active');
        }
    });

    if (wandSensitivityInput) {
        wandSensitivityInput.disabled = mode !== SELECT_MAGIC;
    }
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function toHex(value) {
    return Math.max(0, Math.min(255, value))
        .toString(16)
        .padStart(2, '0');
}

function rgbToHex(r, g, b) {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function setCanvasCursorOverride(cursorValue) {
    if (!canvas) return;
    canvas.style.cursor = cursorValue || '';
}

function ensureTransformHintElement() {
    if (transformHintEl) return transformHintEl;
    if (!canvasWrapper) return null;
    const hint = document.createElement('div');
    hint.className = 'transform-hint';
    hint.hidden = true;
    canvasWrapper.appendChild(hint);
    transformHintEl = hint;
    return transformHintEl;
}

function showTransformHint(text, event) {
    const hint = ensureTransformHintElement();
    if (!hint) return;
    hint.textContent = text || '';
    hint.hidden = false;

    if (!event || !canvasWrapper) return;
    const wrapperRect = canvasWrapper.getBoundingClientRect();
    const maxLeft = Math.max(0, wrapperRect.width - 10);
    const maxTop = Math.max(0, wrapperRect.height - 10);
    const left = clamp(event.clientX - wrapperRect.left + TRANSFORM_HINT_OFFSET, 8, maxLeft);
    const top = clamp(event.clientY - wrapperRect.top + TRANSFORM_HINT_OFFSET, 8, maxTop);
    hint.style.left = `${left}px`;
    hint.style.top = `${top}px`;
}

function hideTransformHint() {
    if (!transformHintEl) return;
    transformHintEl.hidden = true;
}

// =======================
// История действий
// =======================

function getHistoryKey() {
    const indexKey = `index:${currentFrameIndex}`;
    if (!currentFrameId) return indexKey;
    const idKey = `frame:${currentFrameId}`;
    if (frameHistories.has(indexKey) && !frameHistories.has(idKey)) {
        const stored = frameHistories.get(indexKey);
        stored.key = idKey;
        frameHistories.set(idKey, stored);
        frameHistories.delete(indexKey);
    }
    return idKey;
}

function getFrameHistory() {
    const key = getHistoryKey();
    if (!frameHistories.has(key)) {
        frameHistories.set(key, {
            key,
            entries: [],
            position: 0,
            baselineLabel: 'frame_start',
            isTrimmed: false,
        });
    }
    return frameHistories.get(key);
}

function getToolHistoryLabel(toolName) {
    if (toolName === TOOL_BRUSH) return 'brush';
    if (toolName === TOOL_ERASER) return 'eraser';
    if (toolName === TOOL_FILL) return 'fill';
    if (toolName === TOOL_LINE) return 'line';
    if (toolName === TOOL_RECTANGLE) return 'rectangle';
    if (toolName === TOOL_ELLIPSE) return 'ellipse';
    return 'action';
}

function resolveHistoryLabelKey(label) {
    if (!label) return 'action';
    return LEGACY_HISTORY_LABEL_KEYS[label] || label;
}

function captureLayerImage(layer) {
    if (!layer || !layer.bufferCtx || !layer.bufferCanvas) return null;
    try {
        return layer.bufferCtx.getImageData(0, 0, layer.bufferCanvas.width, layer.bufferCanvas.height);
    } catch (error) {
        console.warn('Не удалось сохранить слой для истории', error);
        return null;
    }
}

function captureFullSnapshot() {
    if (!canvas || !layers.length) return null;
    const snapshotLayers = layers.map((layer) => {
        ensureLayerCanvases(layer);
        return {
            id: layer.id,
            name: layer.name,
            order: layer.order,
            visible: layer.visible,
            opacity: layer.opacity,
            imageData: captureLayerImage(layer),
        };
    });
    return {
        activeLayerId,
        layers: snapshotLayers,
    };
}

function ensureHistoryBaseline() {
    getFrameHistory();
    updateHistoryPanel();
}

function cancelPendingHistory() {
    historyPending = null;
}

function beginLayerHistory(label) {
    if (isHistoryApplying) return;
    if (historyPending) {
        cancelPendingHistory();
    }
    if (!canvas || !layers.length) return;
    const layer = getLayerById(activeLayerId);
    if (!layer) return;
    ensureLayerCanvases(layer);
    const beforeImage = captureLayerImage(layer);
    if (!beforeImage) return;
    historyPending = {
        type: 'layer',
        label: label || 'action',
        layerId: layer.id,
        beforeImage,
    };
}

function commitLayerHistory() {
    if (!historyPending || historyPending.type !== 'layer') return;
    const layer = getLayerById(historyPending.layerId);
    if (!layer) {
        historyPending = null;
        return;
    }
    ensureLayerCanvases(layer);
    const afterImage = captureLayerImage(layer);
    if (!afterImage || !historyPending.beforeImage) {
        historyPending = null;
        return;
    }
    pushHistoryEntry({
        type: 'layer',
        label: historyPending.label,
        createdAt: Date.now(),
        layerId: historyPending.layerId,
        beforeImage: historyPending.beforeImage,
        afterImage,
    });
    historyPending = null;
}

function beginFullHistory(label) {
    if (isHistoryApplying) return;
    cancelPendingHistory();
    const beforeSnapshot = captureFullSnapshot();
    if (!beforeSnapshot) return;
    historyPending = {
        type: 'full',
        label: label || 'action',
        beforeSnapshot,
    };
}

function commitFullHistory() {
    if (!historyPending || historyPending.type !== 'full') return;
    const afterSnapshot = captureFullSnapshot();
    if (!afterSnapshot || !historyPending.beforeSnapshot) {
        historyPending = null;
        return;
    }
    pushHistoryEntry({
        type: 'full',
        label: historyPending.label,
        createdAt: Date.now(),
        beforeSnapshot: historyPending.beforeSnapshot,
        afterSnapshot,
    });
    historyPending = null;
}

function pushHistoryEntry(entry) {
    if (isHistoryApplying) return;
    if (!entry) return;
    const history = getFrameHistory();
    if (history.position < history.entries.length) {
        history.entries = history.entries.slice(0, history.position);
    }
    history.entries.push(entry);
    history.position = history.entries.length;

    if (history.entries.length > HISTORY_LIMIT) {
        const overflow = history.entries.length - HISTORY_LIMIT;
        history.entries.splice(0, overflow);
        history.position = Math.max(0, history.position - overflow);
        history.baselineLabel = 'history_start';
        history.isTrimmed = true;
    }

    updateHistoryPanel();
}

function updateHistoryPanel() {
    if (!historyPanel || !historyList || !historyEmpty) return;
    const history = getFrameHistory();
    if (!history || !history.entries.length) {
        historyList.innerHTML = '';
        historyEmpty.hidden = false;
        return;
    }
    historyEmpty.hidden = true;
    historyList.innerHTML = '';

    const rows = [
        {
            label: resolveHistoryLabelKey(history.baselineLabel || 'frame_start'),
            isBaseline: true,
            index: -1,
        },
        ...history.entries.map((entry, index) => ({
            label: resolveHistoryLabelKey(entry.label || 'action'),
            isBaseline: false,
            index,
        })),
    ];

    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const item = document.createElement('li');
        item.className = 'history-item';
        item.dataset.historyPosition = String(row.isBaseline ? 0 : row.index + 1);
        const isCurrent = row.isBaseline
            ? history.position === 0
            : row.index === history.position - 1;
        const isFuture = !row.isBaseline && row.index >= history.position;
        if (isCurrent) {
            item.classList.add('history-item--current');
        } else if (isFuture) {
            item.classList.add('history-item--future');
        }
        item.textContent = t(row.label || 'action');
        historyList.appendChild(item);
    }

    // ограничиваем видимую высоту (5 действий + базовая строка) и включаем скролл внутри списка
    applyListMaxVisibleHeight(historyList, '.history-item', HISTORY_VISIBLE_ACTIONS + 1);
}

function discardSelectionState() {
    selection = null;
    selectionDraft = null;
    isSelecting = false;
    lassoPoints = [];
    resetSelectionTransformState();
    renderOverlay();
    updateSelectionAnimationState();
}

function applyFullSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.layers)) return;
    isHistoryApplying = true;
    discardSelectionState();

    const layerPayloads = snapshot.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        order: layer.order,
        visible: layer.visible,
        opacity: layer.opacity,
    }));
    mergeLayerList(layerPayloads);

    snapshot.layers.forEach((layerSnapshot) => {
        const layer = getLayerById(layerSnapshot.id);
        if (!layer) return;
        ensureLayerCanvases(layer);
        if (!layer.bufferCtx || !layer.bufferCanvas) return;
        clearCanvas(layer.bufferCtx, layer.bufferCanvas);
        if (layerSnapshot.imageData) {
            try {
                layer.bufferCtx.putImageData(layerSnapshot.imageData, 0, 0);
            } catch (error) {
                console.warn('Не удалось восстановить слой из истории', error);
            }
        }
    });

    const nextActive = snapshot.activeLayerId && getLayerById(snapshot.activeLayerId)
        ? snapshot.activeLayerId
        : (layers.length ? layers[layers.length - 1].id : null);
    activeLayerId = nextActive;
    updateActiveLayerPointers();
    applyAllLayerStyles();
    renderLayerList();
    renderScene();
    renderOverlay();
    syncOverlayPlacement();
    isHistoryApplying = false;
}

function applyLayerEntry(entry, direction) {
    if (!entry || entry.type !== 'layer') return;
    const imageData = direction === 'undo' ? entry.beforeImage : entry.afterImage;
    if (!imageData) return;
    const layer = getLayerById(entry.layerId);
    if (!layer) return;
    isHistoryApplying = true;
    discardSelectionState();
    ensureLayerCanvases(layer);
    if (layer.bufferCtx && layer.bufferCanvas) {
        try {
            layer.bufferCtx.putImageData(imageData, 0, 0);
        } catch (error) {
            console.warn('Не удалось восстановить слой из истории', error);
        }
    }
    activeLayerId = layer.id;
    updateActiveLayerPointers();
    applyAllLayerStyles();
    renderLayerList();
    renderScene();
    renderOverlay();
    syncOverlayPlacement();
    isHistoryApplying = false;
}

function applyHistoryEntry(entry, direction) {
    if (!entry) return;
    if (entry.type === 'full') {
        const snapshot = direction === 'undo' ? entry.beforeSnapshot : entry.afterSnapshot;
        applyFullSnapshot(snapshot);
        return;
    }
    if (entry.type === 'layer') {
        applyLayerEntry(entry, direction);
    }
}

function undoHistory() {
    const history = getFrameHistory();
    if (!history || history.position <= 0) return;
    const entry = history.entries[history.position - 1];
    applyHistoryEntry(entry, 'undo');
    history.position -= 1;
    markUnsavedChanges();
    updateHistoryPanel();
}

function redoHistory() {
    const history = getFrameHistory();
    if (!history || history.position >= history.entries.length) return;
    const entry = history.entries[history.position];
    applyHistoryEntry(entry, 'redo');
    history.position += 1;
    markUnsavedChanges();
    updateHistoryPanel();
}

function jumpToHistoryPosition(targetPosition) {
    if (isHistoryApplying) return;
    const history = getFrameHistory();
    if (!history) return;
    const nextPosition = clamp(Number(targetPosition) || 0, 0, history.entries.length);
    if (nextPosition === history.position) return;

    if (nextPosition < history.position) {
        while (history.position > nextPosition) {
            const entry = history.entries[history.position - 1];
            applyHistoryEntry(entry, 'undo');
            history.position -= 1;
        }
    } else {
        while (history.position < nextPosition) {
            const entry = history.entries[history.position];
            applyHistoryEntry(entry, 'redo');
            history.position += 1;
        }
    }

    markUnsavedChanges();
    updateHistoryPanel();
}

function bindHistoryEvents() {
    if (!historyList) return;
    historyList.addEventListener('click', (event) => {
        const item = event.target.closest('.history-item');
        if (!item) return;
        const raw = item.dataset.historyPosition;
        const nextPosition = Number(raw);
        if (!Number.isFinite(nextPosition)) return;
        jumpToHistoryPosition(nextPosition);
    });
}

// =======================
// Работа со слоями
// =======================

function fillLayerUrl(template, frameIndex, layerId) {
    if (!template) return '';
    let result = template;
    if (typeof frameIndex === 'number') {
        result = result.replace('/0/', `/${frameIndex}/`);
    }
    if (typeof layerId === 'number') {
        result = result.replace('/0/', `/${layerId}/`);
    }
    return result;
}

// =======================
// Работа с кадрами (таймлайн)
// =======================

function fillFrameUrl(template, frameIndex) {
    if (!template) return '';
    let result = template;
    if (typeof frameIndex === 'number') {
        result = result.replace('/0/', `/${frameIndex}/`);
    }
    return result;
}

function getFrameDetailUrl(index) {
    return fillFrameUrl(frameDetailUrlTemplate, index);
}

function getFrameDeleteUrl(index) {
    return fillFrameUrl(frameDeleteUrlTemplate, index);
}

function setTimelineControlsDisabled(isDisabled) {
    if (addFrameButton) addFrameButton.disabled = Boolean(isDisabled);
    if (duplicateFrameButton) duplicateFrameButton.disabled = Boolean(isDisabled);
    if (deleteFrameButton) deleteFrameButton.disabled = Boolean(isDisabled);
}

function getLayerListUrl() {
    return fillLayerUrl(layerListUrlTemplate, currentFrameIndex);
}

function getLayerReorderUrl() {
    return fillLayerUrl(layerReorderUrlTemplate, currentFrameIndex);
}

function getLayerUpdateUrl(layerId) {
    return fillLayerUrl(layerUpdateUrlTemplate, currentFrameIndex, layerId);
}

function getLayerDeleteUrl(layerId) {
    return fillLayerUrl(layerDeleteUrlTemplate, currentFrameIndex, layerId);
}

function getLayerById(id) {
    return layers.find((layer) => layer.id === id) || null;
}

function sortLayersByOrder() {
    layers.sort((a, b) => {
        if (a.order !== b.order) {
            return a.order - b.order;
        }
        return a.id - b.id;
    });
}

function getDisplayLayers() {
    return [...layers].sort((a, b) => {
        if (a.order !== b.order) {
            return b.order - a.order;
        }
        return b.id - a.id;
    });
}

function getBackgroundLayer() {
    if (!layers.length) return null;
    sortLayersByOrder();
    return layers[0] || null;
}

function ensureLayerCanvases(layer) {
    if (!canvas || !canvasWrapper) return;
    if (!layer.canvas) {
        layer.canvas = document.createElement('canvas');
        layer.canvas.classList.add('layer-canvas');
        layer.canvas.dataset.layerId = String(layer.id);
        if (overlayCanvas && overlayCanvas.parentNode) {
            overlayCanvas.parentNode.insertBefore(layer.canvas, overlayCanvas);
        } else {
            canvasWrapper.appendChild(layer.canvas);
        }
    }
    if (!layer.ctx) {
        layer.ctx = layer.canvas.getContext('2d');
    }
    if (!layer.bufferCanvas) {
        layer.bufferCanvas = document.createElement('canvas');
    }
    if (!layer.bufferCtx) {
        layer.bufferCtx = layer.bufferCanvas.getContext('2d');
    }
}

function syncLayerSizes() {
    if (!canvas) return;
    const width = canvas.width;
    const height = canvas.height;

    layers.forEach((layer) => {
        ensureLayerCanvases(layer);
        if (layer.canvas.width !== width) {
            layer.canvas.width = width;
        }
        if (layer.canvas.height !== height) {
            layer.canvas.height = height;
        }
        if (layer.bufferCanvas.width !== width) {
            layer.bufferCanvas.width = width;
        }
        if (layer.bufferCanvas.height !== height) {
            layer.bufferCanvas.height = height;
        }
    });
}

function applyLayerStyles(layer) {
    if (!layer || !layer.canvas) return;
    layer.canvas.style.display = layer.visible ? 'block' : 'none';
    layer.canvas.style.opacity = String(clamp(layer.opacity, 0, 100) / 100);
    layer.canvas.style.zIndex = String(10 + layer.order);
}

function applyAllLayerStyles() {
    layers.forEach((layer) => applyLayerStyles(layer));
}

function updateLayerPreview(layer) {
    if (!layer || !layer.previewCanvas || !layer.bufferCanvas) return;
    if (!layer.previewCtx) {
        layer.previewCtx = layer.previewCanvas.getContext('2d');
    }
    if (!layer.previewCtx) return;
    if (layer.previewCanvas.width !== LAYER_PREVIEW_SIZE) {
        layer.previewCanvas.width = LAYER_PREVIEW_SIZE;
    }
    if (layer.previewCanvas.height !== LAYER_PREVIEW_SIZE) {
        layer.previewCanvas.height = LAYER_PREVIEW_SIZE;
    }

    const previewCtx = layer.previewCtx;
    previewCtx.setTransform(1, 0, 0, 1, 0, 0);
    previewCtx.clearRect(0, 0, layer.previewCanvas.width, layer.previewCanvas.height);

    const scale = Math.min(
        layer.previewCanvas.width / layer.bufferCanvas.width,
        layer.previewCanvas.height / layer.bufferCanvas.height,
    );
    const drawWidth = layer.bufferCanvas.width * scale;
    const drawHeight = layer.bufferCanvas.height * scale;
    const offsetX = (layer.previewCanvas.width - drawWidth) / 2;
    const offsetY = (layer.previewCanvas.height - drawHeight) / 2;
    previewCtx.drawImage(layer.bufferCanvas, offsetX, offsetY, drawWidth, drawHeight);
}

function renderLayer(layer) {
    if (!layer || !layer.ctx || !layer.canvas || !layer.bufferCanvas) return;
    clearCanvas(layer.ctx, layer.canvas);
    layer.ctx.save();
    layer.ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    layer.ctx.drawImage(layer.bufferCanvas, 0, 0);
    if (layer.id === activeLayerId
        && selectionTransform
        && transformClipboard
        && transformClipboard.canvas) {
        const bounds = selectionTransform.currentBounds || selectionTransform.startBounds;
        if (bounds && bounds.width > 0 && bounds.height > 0) {
            layer.ctx.drawImage(
                transformClipboard.canvas,
                bounds.x,
                bounds.y,
                bounds.width,
                bounds.height,
            );
        }
    }
    layer.ctx.restore();
    updateLayerPreview(layer);
}

function renderAllLayers() {
    layers.forEach((layer) => {
        renderLayer(layer);
    });
}

function updateActiveLayerPointers() {
    const nextLayer = getLayerById(activeLayerId);
    activeLayer = nextLayer;
    if (activeLayer) {
        ensureLayerCanvases(activeLayer);
        ctx = activeLayer.ctx;
        bufferCanvas = activeLayer.bufferCanvas;
        bufferCtx = activeLayer.bufferCtx;
    } else {
        ctx = null;
        bufferCanvas = null;
        bufferCtx = null;
    }
}

function setActiveLayer(layerId, options = {}) {
    if (!layerId) return;
    if (hasFloatingSelection()) {
        commitSelectionTransform();
    }
    activeLayerId = layerId;
    updateActiveLayerPointers();
    if (options.clearSelection) {
        clearSelection();
    } else {
        renderOverlay();
    }
    renderLayerList();
}

function updateLayersEmptyState() {
    if (!layersEmpty) return;
    const hasLayers = layers.length > 0;
    layersEmpty.hidden = hasLayers;
}

function renderLayerList() {
    if (!layersList) return;
    const displayLayers = getDisplayLayers();
    layersList.innerHTML = '';
    displayLayers.forEach((layer) => {
        const item = document.createElement('li');
        item.className = 'layer-item';
        if (layer.id === activeLayerId) {
            item.classList.add('layer-item--active');
        }
        if (layer.isRenaming) {
            item.classList.add('layer-item--renaming');
        }
        item.dataset.layerId = String(layer.id);
        item.draggable = true;

        const content = document.createElement('div');
        content.className = 'layer-content';

        const headerRow = document.createElement('div');
        headerRow.className = 'layer-row';

        const info = document.createElement('div');
        info.className = 'layer-info';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'layer-title';

        const previewCanvas = document.createElement('canvas');
        previewCanvas.className = 'layer-preview';
        previewCanvas.width = LAYER_PREVIEW_SIZE;
        previewCanvas.height = LAYER_PREVIEW_SIZE;
        layer.previewCanvas = previewCanvas;
        layer.previewCtx = previewCanvas.getContext('2d');
        updateLayerPreview(layer);

        const nameLabel = document.createElement('div');
        nameLabel.className = 'layer-name';
        nameLabel.textContent = layer.name;
        nameLabel.dataset.action = 'select-layer';

        const opacityWrap = document.createElement('label');
        opacityWrap.className = 'layer-opacity';
        opacityWrap.innerHTML = `<span>${t('opacity')}</span>`;
        const opacityInput = document.createElement('input');
        opacityInput.type = 'range';
        opacityInput.min = '0';
        opacityInput.max = '100';
        opacityInput.value = String(layer.opacity);
        opacityInput.dataset.action = 'opacity';
        opacityWrap.appendChild(opacityInput);

        const actions = document.createElement('div');
        actions.className = 'layer-actions layer-actions--primary';

        const visibilityButton = document.createElement('button');
        visibilityButton.type = 'button';
        visibilityButton.className = 'layer-visibility';
        visibilityButton.dataset.action = 'toggle-visibility';
        visibilityButton.title = layer.visible ? t('hide_layer') : t('show_layer');
        visibilityButton.setAttribute('aria-label', visibilityButton.title);
        if (!layer.visible) {
            visibilityButton.classList.add('is-hidden');
        }
        const visibilityIcon = document.createElement('img');
        visibilityIcon.className = 'layer-icon';
        visibilityIcon.src = layer.visible ? iconEyeOpen : iconEyeClosed;
        visibilityIcon.alt = '';
        visibilityButton.appendChild(visibilityIcon);

        const renameButton = document.createElement('button');
        renameButton.type = 'button';
        renameButton.className = 'layer-action';
        renameButton.dataset.action = 'rename';
        renameButton.title = t('rename_layer');
        renameButton.setAttribute('aria-label', renameButton.title);
        const renameIcon = document.createElement('img');
        renameIcon.className = 'layer-icon';
        renameIcon.src = iconRename;
        renameIcon.alt = '';
        renameButton.appendChild(renameIcon);
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'layer-action layer-action--danger';
        deleteButton.dataset.action = 'delete';
        deleteButton.title = t('delete_layer');
        deleteButton.setAttribute('aria-label', deleteButton.title);
        const deleteIcon = document.createElement('img');
        deleteIcon.className = 'layer-icon';
        deleteIcon.src = iconTrash;
        deleteIcon.alt = '';
        deleteButton.appendChild(deleteIcon);
        actions.appendChild(visibilityButton);
        actions.appendChild(renameButton);
        actions.appendChild(deleteButton);

        const renameBlock = document.createElement('div');
        renameBlock.className = 'layer-rename';
        renameBlock.hidden = !layer.isRenaming;
        const renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.value = layer.name;
        renameInput.maxLength = 200;
        renameInput.dataset.action = 'rename-input';
        const renameActions = document.createElement('div');
        renameActions.className = 'layer-actions';
        const saveRename = document.createElement('button');
        saveRename.type = 'button';
        saveRename.className = 'layer-action';
        saveRename.dataset.action = 'rename-save';
        saveRename.textContent = t('save');
        const cancelRename = document.createElement('button');
        cancelRename.type = 'button';
        cancelRename.className = 'layer-action';
        cancelRename.dataset.action = 'rename-cancel';
        cancelRename.textContent = t('cancel');
        renameActions.appendChild(saveRename);
        renameActions.appendChild(cancelRename);
        renameBlock.appendChild(renameInput);
        renameBlock.appendChild(renameActions);

        titleWrap.appendChild(nameLabel);
        titleWrap.appendChild(renameBlock);
        info.appendChild(previewCanvas);
        info.appendChild(titleWrap);
        headerRow.appendChild(info);
        headerRow.appendChild(actions);
        content.appendChild(headerRow);
        content.appendChild(opacityWrap);

        item.appendChild(content);
        layersList.appendChild(item);
    });
    updateLayersEmptyState();
    applyListMaxVisibleHeight(layersList, '.layer-item', LAYERS_VISIBLE_COUNT);
}


function mergeLayerList(layerItems) {
    const previousActiveId = activeLayerId;
    const existing = new Map(layers.map((layer) => [layer.id, layer]));
    const nextLayers = [];

    layerItems.forEach((item) => {
        const stored = existing.get(item.id);
        if (stored) {
            stored.name = item.name;
            stored.order = item.order;
            stored.visible = item.visible;
            stored.opacity = item.opacity;
            nextLayers.push(stored);
            existing.delete(item.id);
        } else {
            nextLayers.push({
                ...item,
                canvas: null,
                ctx: null,
                bufferCanvas: null,
                bufferCtx: null,
                previewCanvas: null,
                previewCtx: null,
            });
        }
    });

    existing.forEach((layer) => {
        if (layer.canvas && layer.canvas.parentNode) {
            layer.canvas.parentNode.removeChild(layer.canvas);
        }
    });

    layers = nextLayers;
    sortLayersByOrder();
    layers.forEach((layer) => ensureLayerCanvases(layer));
    syncLayerSizes();
    applyAllLayerStyles();
    if (activeLayerId && !getLayerById(activeLayerId)) {
        activeLayerId = null;
    }
    if (!activeLayerId && layers.length) {
        const topLayer = layers[layers.length - 1];
        activeLayerId = topLayer.id;
    }
    updateActiveLayerPointers();
    if (previousActiveId !== activeLayerId) {
        clearSelection();
    }
    renderLayerList();
    renderScene();
    syncOverlayPlacement();
}

function addLayerFromPayload(item) {
    const layer = {
        ...item,
        canvas: null,
        ctx: null,
        bufferCanvas: null,
        bufferCtx: null,
        previewCanvas: null,
        previewCtx: null,
    };
    layers.push(layer);
    sortLayersByOrder();
    ensureLayerCanvases(layer);
    syncLayerSizes();
    applyLayerStyles(layer);
    syncOverlayPlacement();
    return layer;
}

async function loadLayers() {
    const listUrl = getLayerListUrl();
    if (!listUrl) return;
    try {
        const response = await fetch(listUrl, { credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Не удалось загрузить слои.');
        }
        mergeLayerList(data.layers || []);
    } catch (error) {
        console.error('Ошибка загрузки слоёв', error);
    }
}

function fillBackgroundLayerIfNeeded() {
    if (didInitBackground) return;
    if (currentFramePreviewUrl) return;
    const backgroundLayer = getBackgroundLayer();
    if (!backgroundLayer || !backgroundLayer.bufferCtx || !backgroundLayer.bufferCanvas) return;
    backgroundLayer.bufferCtx.fillStyle = '#ffffff';
    backgroundLayer.bufferCtx.fillRect(0, 0, backgroundLayer.bufferCanvas.width, backgroundLayer.bufferCanvas.height);
    renderScene();
    didInitBackground = true;
    ensureHistoryBaseline();
}

async function createLayer() {
    const listUrl = getLayerListUrl();
    if (!listUrl) return;
    beginFullHistory('layer_add');
    try {
        const response = await fetch(listUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({}),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Не удалось создать слой.');
        }
        const layer = addLayerFromPayload(data.layer);
        applyAllLayerStyles();
        setActiveLayer(layer.id);
        renderScene();
        commitFullHistory();
    } catch (error) {
        cancelPendingHistory();
        console.error('Ошибка создания слоя', error);
    }
}

async function updateLayer(layerId, updates) {
    const url = getLayerUpdateUrl(layerId);
    if (!url) return null;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify(updates || {}),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Не удалось обновить слой.');
        }
        return data.layer || null;
    } catch (error) {
        console.error('Ошибка обновления слоя', error);
        return null;
    }
}

async function deleteLayer(layerId) {
    const url = getLayerDeleteUrl(layerId);
    if (!url) return;
    beginFullHistory('layer_delete');
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({}),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Не удалось удалить слой.');
        }
        mergeLayerList(data.layers || []);
        commitFullHistory();
    } catch (error) {
        cancelPendingHistory();
        console.error('Ошибка удаления слоя', error);
    }
}

async function saveLayerOrder(orderedIds) {
    const url = getLayerReorderUrl();
    if (!url) return;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ ordered_ids: orderedIds }),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Не удалось сохранить порядок слоёв.');
        }
        mergeLayerList(data.layers || []);
        commitFullHistory();
    } catch (error) {
        cancelPendingHistory();
        console.error('Ошибка сохранения порядка слоёв', error);
    }
}

function getSnappedPoint(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (dx === 0 && dy === 0) {
        return { x: toX, y: toY };
    }
    const angle = Math.atan2(dy, dx);
    const step = Math.PI / 4;
    const snappedAngle = Math.round(angle / step) * step;
    const distance = Math.hypot(dx, dy);
    return {
        x: fromX + Math.cos(snappedAngle) * distance,
        y: fromY + Math.sin(snappedAngle) * distance,
    };
}

function getSquareConstrainedEnd(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    const endX = fromX + (dx === 0 ? 0 : Math.sign(dx) * size);
    const endY = fromY + (dy === 0 ? 0 : Math.sign(dy) * size);
    return { x: endX, y: endY };
}

function getConstrainedShapeEnd(toolName, fromX, fromY, toX, toY) {
    if (!isShiftPressed) {
        return { x: toX, y: toY };
    }
    if (toolName === TOOL_LINE) {
        return getSnappedPoint(fromX, fromY, toX, toY);
    }
    if (toolName === TOOL_RECTANGLE || toolName === TOOL_ELLIPSE) {
        return getSquareConstrainedEnd(fromX, fromY, toX, toY);
    }
    return { x: toX, y: toY };
}

function getConstrainedSelectionEnd(mode, fromX, fromY, toX, toY) {
    if (!isShiftPressed) {
        return { x: toX, y: toY };
    }
    if (mode === SELECT_RECT || mode === SELECT_ELLIPSE) {
        return getSquareConstrainedEnd(fromX, fromY, toX, toY);
    }
    return { x: toX, y: toY };
}

function isShapeTool(toolName) {
    return toolName === TOOL_RECTANGLE
        || toolName === TOOL_ELLIPSE
        || toolName === TOOL_LINE;
}

function applyStrokeStyles(targetCtx, options = {}) {
    if (!targetCtx) return;
    const useEraser = Boolean(options.useEraser);
    const strokeColor = useEraser ? '#000000' : currentColor;
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    targetCtx.lineWidth = currentSize;
    targetCtx.strokeStyle = strokeColor;
    targetCtx.globalCompositeOperation = useEraser ? 'destination-out' : 'source-over';
}

function clearCanvas(targetCtx, targetCanvas) {
    if (!targetCtx || !targetCanvas) return;
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
}

function withTransformedContext(targetCtx, callback, options = {}) {
    if (!targetCtx) return;
    targetCtx.save();
    targetCtx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    if (options.clipToFrame && bufferCanvas) {
        targetCtx.beginPath();
        targetCtx.rect(0, 0, bufferCanvas.width, bufferCanvas.height);
        targetCtx.clip();
    }
    if (options.clipToSelection && selection && selection.type !== SELECT_MAGIC) {
        appendSelectionPath(targetCtx, selection);
        targetCtx.clip();
    }
    callback();
    targetCtx.restore();
}

function clearOverlay() {
    if (!overlayCtx || !overlayCanvas) return;
    clearCanvas(overlayCtx, overlayCanvas);
}

function renderOverlay() {
    if (!overlayCtx || !overlayCanvas) return;
    clearCanvas(overlayCtx, overlayCanvas);
    renderFrameOutline();
    if (!selectionDraft && !selection) {
        updateSelectionAnimationState();
        return;
    }

    withTransformedContext(overlayCtx, () => {
        const targetSelection = selectionDraft || selection;
        if (targetSelection) {
            drawSelectionPath(overlayCtx, targetSelection);
        }

        if (!selectionDraft && shouldShowSelectionTransformUI()) {
            const bounds = selectionTransform && selectionTransform.currentBounds
                ? selectionTransform.currentBounds
                : getSelectionBounds(selection);
            const clamped = clampSelectionBounds(bounds);
            if (clamped && clamped.width > 0 && clamped.height > 0) {
                drawSelectionTransformControls(overlayCtx, clamped);
            }
        }
    }, { clipToFrame: true });
    updateSelectionAnimationState();
}

function renderFrameOutline() {
    if (!overlayCtx || !overlayCanvas || !bufferCanvas) return;
    const outlineWidth = Math.max(0.5, 1 / (scale || 1));
    const dashSize = 6 / (scale || 1);
    const gapSize = 4 / (scale || 1);

    withTransformedContext(overlayCtx, () => {
        overlayCtx.save();
        overlayCtx.lineWidth = outlineWidth;
        overlayCtx.strokeStyle = 'rgba(17, 24, 39, 0.35)';
        overlayCtx.setLineDash([dashSize, gapSize]);
        overlayCtx.strokeRect(0.5, 0.5, bufferCanvas.width - 1, bufferCanvas.height - 1);
        overlayCtx.restore();
    });
}

function renderScene() {
    if (!layers.length) return;
    renderAllLayers();
    renderOnionSkin();
}

function syncCanvasSizes() {
    if (!canvas) return;
    const width = canvas.width;
    const height = canvas.height;

    if (onionPrevCanvas) {
        onionPrevCanvas.width = width;
        onionPrevCanvas.height = height;
    }
    if (onionNextCanvas) {
        onionNextCanvas.width = width;
        onionNextCanvas.height = height;
    }

    if (overlayCanvas) {
        overlayCanvas.width = width;
        overlayCanvas.height = height;
    }
    syncLayerSizes();
    updateActiveLayerPointers();
    syncOverlayPlacement();
}

function syncOverlayPlacement() {
    if (!overlayCanvas || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (onionPrevCanvas) {
        onionPrevCanvas.style.width = `${rect.width}px`;
        onionPrevCanvas.style.height = `${rect.height}px`;
        onionPrevCanvas.style.left = `${canvas.offsetLeft}px`;
        onionPrevCanvas.style.top = `${canvas.offsetTop}px`;
    }
    if (onionNextCanvas) {
        onionNextCanvas.style.width = `${rect.width}px`;
        onionNextCanvas.style.height = `${rect.height}px`;
        onionNextCanvas.style.left = `${canvas.offsetLeft}px`;
        onionNextCanvas.style.top = `${canvas.offsetTop}px`;
    }
    overlayCanvas.style.width = `${rect.width}px`;
    overlayCanvas.style.height = `${rect.height}px`;
    overlayCanvas.style.left = `${canvas.offsetLeft}px`;
    overlayCanvas.style.top = `${canvas.offsetTop}px`;
    layers.forEach((layer) => {
        if (!layer.canvas) return;
        layer.canvas.style.width = `${rect.width}px`;
        layer.canvas.style.height = `${rect.height}px`;
        layer.canvas.style.left = `${canvas.offsetLeft}px`;
        layer.canvas.style.top = `${canvas.offsetTop}px`;
    });
}

function toPxNumber(value) {
    if (typeof value !== 'string') return 0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getListGapPx(listEl) {
    if (!listEl) return 0;
    const styles = window.getComputedStyle(listEl);
    return toPxNumber(styles.rowGap || styles.gap);
}

function applyListMaxVisibleHeight(listEl, itemSelector, maxVisible) {
    if (!listEl) return;
    const maxCount = Number(maxVisible);
    if (!Number.isFinite(maxCount) || maxCount <= 0) return;

    const items = itemSelector
        ? [...listEl.querySelectorAll(itemSelector)]
        : [...listEl.children];

    if (!items.length || items.length <= maxCount) {
        listEl.style.maxHeight = '';
        listEl.style.overflowY = '';
        return;
    }

    const gap = getListGapPx(listEl);
    const count = Math.min(maxCount, items.length);
    let height = 0;
    for (let i = 0; i < count; i += 1) {
        height += items[i].offsetHeight || 0;
    }
    height += gap * Math.max(0, count - 1);
    if (!Number.isFinite(height) || height <= 0) return;

    listEl.style.maxHeight = `${Math.ceil(height)}px`;
    listEl.style.overflowY = 'auto';
}

/**
 * Подгоняем отображаемую высоту canvas под высоту экрана,
 * чтобы на экране помещались тулбар + таймлайн.
 */
function syncResponsiveCanvasSize() {
    if (!editorRoot || !canvas) return;

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportHeight) return;

    const rootRect = editorRoot.getBoundingClientRect();
    const availableFromRootTop = viewportHeight - rootRect.top;
    if (!Number.isFinite(availableFromRootTop) || availableFromRootTop <= 0) return;

    const rootStyles = window.getComputedStyle(editorRoot);
    const paddingTop = toPxNumber(rootStyles.paddingTop);
    const paddingBottom = toPxNumber(rootStyles.paddingBottom);
    const rowGap = toPxNumber(rootStyles.rowGap || rootStyles.gap);

    const headerEl = editorRoot.querySelector('.editor-header');
    const toolbarEl = editorRoot.querySelector('.editor-toolbar');
    const timelineEl = editorRoot.querySelector('.timeline-wrapper');

    const fixedHeight = (headerEl ? headerEl.offsetHeight : 0)
        + (toolbarEl ? toolbarEl.offsetHeight : 0)
        + (timelineEl ? timelineEl.offsetHeight : 0);

    const visibleChildren = [...editorRoot.children].filter((el) => !el.hidden);
    const gapsTotal = rowGap * Math.max(0, visibleChildren.length - 1);

    let availableForMain = availableFromRootTop - paddingTop - paddingBottom - gapsTotal - fixedHeight;
    if (!Number.isFinite(availableForMain)) return;

    // вычитаем внутренние отступы обертки canvas, чтобы сам canvas мог влезть целиком
    let wrapperPaddingY = 24;
    let wrapperBorderY = 0;
    if (canvasWrapper) {
        const wrapperStyles = window.getComputedStyle(canvasWrapper);
        wrapperPaddingY = toPxNumber(wrapperStyles.paddingTop) + toPxNumber(wrapperStyles.paddingBottom);
        wrapperBorderY = toPxNumber(wrapperStyles.borderTopWidth) + toPxNumber(wrapperStyles.borderBottomWidth);
    }

    const minCanvasH = 160;
    const maxCanvasH = Math.max(minCanvasH, Math.floor(availableForMain - wrapperPaddingY - wrapperBorderY));
    canvas.style.maxHeight = `${maxCanvasH}px`;
}

function syncEditorLayout() {
    syncResponsiveCanvasSize();
    // после изменения размеров даём браузеру пересчитать layout и синхронизируем оверлей/слои
    requestAnimationFrame(() => {
        syncOverlayPlacement();
        hydratePanelPositions();
    });
}

function updateCursor() {
    if (!canvas) return;
    const isPanMode = isSpacePressed || currentTool === TOOL_PAN || isPanning;
    canvas.classList.toggle('canvas--bucket', currentTool === TOOL_FILL && !isPanMode);
    canvas.classList.toggle('canvas--pan', isPanMode);
    canvas.classList.toggle('canvas--panning', isPanning);
}

// =======================
// Функции рисования
// =======================

/**
 * Начало рисования
 */
function startDrawing(x, y, toolName) {
    isDrawing = true;
    activeTool = toolName;
    lastX = x;
    lastY = y;
    startX = x;
    startY = y;

    if (toolName === TOOL_BRUSH || toolName === TOOL_ERASER || isShapeTool(toolName)) {
        beginLayerHistory(getToolHistoryLabel(toolName));
    }

    if (toolName === TOOL_BRUSH || toolName === TOOL_ERASER) {
        didDrawStroke = true;
        lastDrawTool = toolName;
        markUnsavedChanges();
        drawStrokeSegment(x, y, x, y, toolName);
    }
}

/**
 * Продолжение рисования
 * Рисуем линию от предыдущей точки до новой
 */
function continueDrawing(x, y) {
    if (!isDrawing) return;

    if (activeTool === TOOL_BRUSH || activeTool === TOOL_ERASER) {
        const target = isShiftPressed ? getSnappedPoint(startX, startY, x, y) : { x, y };
        drawStrokeSegment(lastX, lastY, target.x, target.y, activeTool);
        lastX = target.x;
        lastY = target.y;
        return;
    }

    if (isShapeTool(activeTool)) {
        const target = getConstrainedShapeEnd(activeTool, startX, startY, x, y);
        drawShapePreview(target.x, target.y);
        lastX = target.x;
        lastY = target.y;
        return;
    }
}

/**
 * Завершение рисования
 */
function stopDrawing() {
    isDrawing = false;
    if (didDrawStroke && (lastDrawTool === TOOL_BRUSH || lastDrawTool === TOOL_ERASER)) {
        commitLayerHistory();
    }
    didDrawStroke = false;
    lastDrawTool = null;
    activeTool = null;
}

function drawStrokeSegment(fromX, fromY, toX, toY, toolName) {
    if (!bufferCtx || !bufferCanvas) return;
    const useEraser = toolName === TOOL_ERASER;
    const isMagicErase = useEraser && selection && selection.type === SELECT_MAGIC && selection.maskCanvas;

    drawBufferWithSelection((targetCtx) => {
        targetCtx.save();
        applyStrokeStyles(targetCtx, { useEraser: isMagicErase ? false : useEraser });
        targetCtx.beginPath();
        targetCtx.moveTo(fromX, fromY);
        targetCtx.lineTo(toX, toY);
        targetCtx.stroke();
        targetCtx.restore();
    }, { useEraser: isMagicErase });

    if (!ctx || !canvas) return;
    if (selection && selection.type === SELECT_MAGIC) {
        renderScene();
        return;
    }
    withTransformedContext(ctx, () => {
        ctx.save();
        applyStrokeStyles(ctx, { useEraser });
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        ctx.restore();
    }, { clipToFrame: true, clipToSelection: true });
}

function drawShapePath(targetCtx, toolName, fromX, fromY, toX, toY) {
    if (!targetCtx) return;
    targetCtx.beginPath();

    if (toolName === TOOL_LINE) {
        targetCtx.moveTo(fromX, fromY);
        targetCtx.lineTo(toX, toY);
        return;
    }

    const left = Math.min(fromX, toX);
    const top = Math.min(fromY, toY);
    const width = Math.abs(toX - fromX);
    const height = Math.abs(toY - fromY);

    if (toolName === TOOL_RECTANGLE) {
        targetCtx.rect(left, top, width, height);
        return;
    }

    if (toolName === TOOL_ELLIPSE) {
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        const radiusX = Math.max(0, width / 2);
        const radiusY = Math.max(0, height / 2);
        targetCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    }
}

function drawShapePreview(x, y) {
    if (!overlayCtx || !overlayCanvas) return;
    renderOverlay();
    drawOverlayWithSelection((targetCtx) => {
        targetCtx.save();
        applyStrokeStyles(targetCtx, { useEraser: false });
        drawShapePath(targetCtx, activeTool, startX, startY, x, y);
        targetCtx.stroke();
        targetCtx.restore();
    });
}

function commitShape() {
    if (!bufferCtx || !bufferCanvas || !ctx || !canvas) return;
    if (startX === lastX && startY === lastY) {
        renderOverlay();
        cancelPendingHistory();
        return;
    }
    markUnsavedChanges();
    drawBufferWithSelection((targetCtx) => {
        targetCtx.save();
        applyStrokeStyles(targetCtx, { useEraser: false });
        drawShapePath(targetCtx, activeTool, startX, startY, lastX, lastY);
        targetCtx.stroke();
        targetCtx.restore();
    });

    if (selection && selection.type === SELECT_MAGIC) {
        renderScene();
    } else {
        withTransformedContext(ctx, () => {
            ctx.save();
            applyStrokeStyles(ctx, { useEraser: false });
            drawShapePath(ctx, activeTool, startX, startY, lastX, lastY);
            ctx.stroke();
            ctx.restore();
        }, { clipToFrame: true, clipToSelection: true });
    }

    renderOverlay();
    commitLayerHistory();
}

function normalizeRect(fromX, fromY, toX, toY) {
    const left = Math.min(fromX, toX);
    const top = Math.min(fromY, toY);
    const width = Math.abs(toX - fromX);
    const height = Math.abs(toY - fromY);
    return { x: left, y: top, width, height };
}

function buildRectSelection(fromX, fromY, toX, toY) {
    const rect = normalizeRect(fromX, fromY, toX, toY);
    return {
        type: SELECT_RECT,
        ...rect,
    };
}

function buildEllipseSelection(fromX, fromY, toX, toY) {
    const rect = normalizeRect(fromX, fromY, toX, toY);
    return {
        type: SELECT_ELLIPSE,
        centerX: rect.x + rect.width / 2,
        centerY: rect.y + rect.height / 2,
        radiusX: Math.max(0, rect.width / 2),
        radiusY: Math.max(0, rect.height / 2),
    };
}

function appendSelectionPath(targetCtx, selectionShape) {
    if (!targetCtx || !selectionShape) return;
    if (selectionShape.type === SELECT_MAGIC) return;
    targetCtx.beginPath();
    if (selectionShape.type === SELECT_RECT) {
        targetCtx.rect(selectionShape.x, selectionShape.y, selectionShape.width, selectionShape.height);
    } else if (selectionShape.type === SELECT_ELLIPSE) {
        targetCtx.ellipse(
            selectionShape.centerX,
            selectionShape.centerY,
            selectionShape.radiusX,
            selectionShape.radiusY,
            0,
            0,
            Math.PI * 2,
        );
    } else if (selectionShape.type === SELECT_LASSO) {
        const points = selectionShape.points || [];
        if (points.length > 0) {
            targetCtx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i += 1) {
                targetCtx.lineTo(points[i].x, points[i].y);
            }
            targetCtx.closePath();
        }
    }
}

function ensureSelectionScratchCanvas() {
    if (!bufferCanvas) return false;
    if (!selectionScratchCanvas) {
        selectionScratchCanvas = document.createElement('canvas');
    }
    if (selectionScratchCanvas.width !== bufferCanvas.width
        || selectionScratchCanvas.height !== bufferCanvas.height) {
        selectionScratchCanvas.width = bufferCanvas.width;
        selectionScratchCanvas.height = bufferCanvas.height;
        selectionScratchCtx = selectionScratchCanvas.getContext('2d');
    }
    if (!selectionScratchCtx) {
        selectionScratchCtx = selectionScratchCanvas.getContext('2d');
    }
    return Boolean(selectionScratchCtx);
}

function drawBufferWithSelection(drawCallback, options = {}) {
    if (!bufferCtx || !bufferCanvas) return;
    const useEraser = Boolean(options.useEraser);
    if (selection && selection.type === SELECT_MAGIC && selection.maskCanvas) {
        if (!ensureSelectionScratchCanvas()) return;
        clearCanvas(selectionScratchCtx, selectionScratchCanvas);
        drawCallback(selectionScratchCtx);
        selectionScratchCtx.globalCompositeOperation = 'destination-in';
        selectionScratchCtx.drawImage(selection.maskCanvas, 0, 0);
        selectionScratchCtx.globalCompositeOperation = 'source-over';
        if (useEraser) {
            bufferCtx.save();
            bufferCtx.globalCompositeOperation = 'destination-out';
            bufferCtx.drawImage(selectionScratchCanvas, 0, 0);
            bufferCtx.restore();
        } else {
            bufferCtx.drawImage(selectionScratchCanvas, 0, 0);
        }
        return;
    }
    withSelectionClip(bufferCtx, () => {
        drawCallback(bufferCtx);
    });
}

function drawOverlayWithSelection(drawCallback) {
    if (!overlayCtx || !overlayCanvas) return;
    if (selection && selection.type === SELECT_MAGIC && selection.maskCanvas) {
        if (!ensureSelectionScratchCanvas()) return;
        clearCanvas(selectionScratchCtx, selectionScratchCanvas);
        drawCallback(selectionScratchCtx);
        selectionScratchCtx.globalCompositeOperation = 'destination-in';
        selectionScratchCtx.drawImage(selection.maskCanvas, 0, 0);
        selectionScratchCtx.globalCompositeOperation = 'source-over';
        withTransformedContext(overlayCtx, () => {
            overlayCtx.drawImage(selectionScratchCanvas, 0, 0);
        }, { clipToFrame: true });
        return;
    }
    withTransformedContext(overlayCtx, () => {
        drawCallback(overlayCtx);
    }, { clipToFrame: true, clipToSelection: true });
}

function withSelectionClip(targetCtx, callback) {
    if (!targetCtx) return;
    if (!selection || selection.type === SELECT_MAGIC) {
        callback();
        return;
    }
    targetCtx.save();
    appendSelectionPath(targetCtx, selection);
    targetCtx.clip();
    callback();
    targetCtx.restore();
}

function drawSelectionPath(targetCtx, selectionShape) {
    if (!targetCtx || !selectionShape) return;
    if (selectionShape.type === SELECT_MAGIC) {
        drawMagicSelectionOutline(targetCtx, selectionShape);
        return;
    }
    const strokeWidth = 1 / (scale || 1);
    const dashSize = 6 / (scale || 1);
    const gapSize = 4 / (scale || 1);

    targetCtx.save();
    targetCtx.lineWidth = strokeWidth;
    targetCtx.strokeStyle = '#2563eb';
    targetCtx.setLineDash([dashSize, gapSize]);
    targetCtx.lineDashOffset = selectionDashOffset;
    appendSelectionPath(targetCtx, selectionShape);

    targetCtx.stroke();
    targetCtx.restore();
}

function drawMagicSelectionOutline(targetCtx, selectionShape) {
    const mask = selectionShape.mask;
    if (!mask) return;
    const width = selectionShape.width;
    const height = selectionShape.height;
    const bounds = selectionShape.bounds;
    if (!width || !height || !bounds) return;

    const offset = Math.floor(selectionDashOffset);
    const dashPeriod = 8;
    const dashOn = 4;

    targetCtx.save();
    targetCtx.fillStyle = '#2563eb';

    const maxY = Math.min(height, bounds.y + bounds.height);
    const maxX = Math.min(width, bounds.x + bounds.width);

    for (let y = Math.max(0, bounds.y); y < maxY; y += 1) {
        const rowOffset = y * width;
        for (let x = Math.max(0, bounds.x); x < maxX; x += 1) {
            const index = rowOffset + x;
            if (!mask[index]) continue;
            const isEdge = (x > 0 && !mask[index - 1])
                || (x < width - 1 && !mask[index + 1])
                || (y > 0 && !mask[index - width])
                || (y < height - 1 && !mask[index + width]);
            if (!isEdge) continue;
            if (((x + y + offset) % dashPeriod) < dashOn) {
                targetCtx.fillRect(x, y, 1, 1);
            }
        }
    }

    targetCtx.restore();
}

function getLassoBounds(points) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    points.forEach((point) => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    });

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

function getSelectionBounds(selectionShape) {
    if (!selectionShape) return null;
    if (selectionShape.type === SELECT_RECT) {
        return {
            x: selectionShape.x,
            y: selectionShape.y,
            width: selectionShape.width,
            height: selectionShape.height,
        };
    }
    if (selectionShape.type === SELECT_ELLIPSE) {
        const diameterX = selectionShape.radiusX * 2;
        const diameterY = selectionShape.radiusY * 2;
        return {
            x: selectionShape.centerX - selectionShape.radiusX,
            y: selectionShape.centerY - selectionShape.radiusY,
            width: diameterX,
            height: diameterY,
        };
    }
    if (selectionShape.type === SELECT_MAGIC) {
        return selectionShape.bounds || null;
    }
    if (selectionShape.type === SELECT_LASSO) {
        const bounds = getLassoBounds(selectionShape.points || []);
        return {
            x: bounds.minX,
            y: bounds.minY,
            width: bounds.width,
            height: bounds.height,
        };
    }
    return null;
}

function cloneSelectionShape(selectionShape) {
    if (!selectionShape) return null;
    if (selectionShape.type === SELECT_RECT) {
        return { ...selectionShape };
    }
    if (selectionShape.type === SELECT_ELLIPSE) {
        return { ...selectionShape };
    }
    if (selectionShape.type === SELECT_LASSO) {
        const points = (selectionShape.points || []).map((point) => ({ ...point }));
        return { ...selectionShape, points };
    }
    return null;
}

function translateSelection(selectionShape, deltaX, deltaY) {
    if (!selectionShape) return null;
    if (selectionShape.type === SELECT_MAGIC) {
        return null;
    }
    if (selectionShape.type === SELECT_RECT) {
        return {
            ...selectionShape,
            x: selectionShape.x + deltaX,
            y: selectionShape.y + deltaY,
        };
    }
    if (selectionShape.type === SELECT_ELLIPSE) {
        return {
            ...selectionShape,
            centerX: selectionShape.centerX + deltaX,
            centerY: selectionShape.centerY + deltaY,
        };
    }
    if (selectionShape.type === SELECT_LASSO) {
        const points = (selectionShape.points || []).map((point) => ({
            x: point.x + deltaX,
            y: point.y + deltaY,
        }));
        return { ...selectionShape, points };
    }
    return null;
}

function clampSelectionBounds(bounds) {
    if (!bounds || !bufferCanvas) return null;
    const maxWidth = bufferCanvas.width;
    const maxHeight = bufferCanvas.height;
    const startX = clamp(bounds.x, 0, maxWidth);
    const startY = clamp(bounds.y, 0, maxHeight);
    const endX = clamp(bounds.x + bounds.width, 0, maxWidth);
    const endY = clamp(bounds.y + bounds.height, 0, maxHeight);
    return {
        x: startX,
        y: startY,
        width: Math.max(0, endX - startX),
        height: Math.max(0, endY - startY),
    };
}

function shouldShowSelectionTransformUI() {
    return currentTool === TOOL_PAN
        && !isSpacePressed
        && Boolean(selection)
        && selection.type !== SELECT_MAGIC;
}

function getTransformHandleCursor(handleId) {
    if (!handleId) return null;
    if (handleId === 'n' || handleId === 's') return 'ns-resize';
    if (handleId === 'e' || handleId === 'w') return 'ew-resize';
    if (handleId === 'nw' || handleId === 'se') return 'nwse-resize';
    if (handleId === 'ne' || handleId === 'sw') return 'nesw-resize';
    return null;
}

function getTransformHandleHint(handleId) {
    if (!handleId) return '';
    const hints = {
        nw: 'Растягивание: левый верхний угол',
        n: 'Растягивание: верхняя грань',
        ne: 'Растягивание: правый верхний угол',
        e: 'Растягивание: правая грань',
        se: 'Растягивание: правый нижний угол',
        s: 'Растягивание: нижняя грань',
        sw: 'Растягивание: левый нижний угол',
        w: 'Растягивание: левая грань',
    };
    return hints[handleId] || '';
}

function getTransformHandles(bounds) {
    if (!bounds) return [];
    const left = bounds.x;
    const top = bounds.y;
    const right = bounds.x + bounds.width;
    const bottom = bounds.y + bounds.height;
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    return [
        { id: 'nw', x: left, y: top },
        { id: 'n', x: centerX, y: top },
        { id: 'ne', x: right, y: top },
        { id: 'e', x: right, y: centerY },
        { id: 'se', x: right, y: bottom },
        { id: 's', x: centerX, y: bottom },
        { id: 'sw', x: left, y: bottom },
        { id: 'w', x: left, y: centerY },
    ];
}

function getTransformHandleAtPoint(x, y, bounds) {
    if (!bounds) return null;
    const normalizedScale = scale || 1;
    const hitSize = TRANSFORM_HANDLE_HIT_PX / normalizedScale;
    const half = hitSize / 2;

    for (const handle of getTransformHandles(bounds)) {
        if (Math.abs(x - handle.x) <= half && Math.abs(y - handle.y) <= half) {
            return handle.id;
        }
    }
    return null;
}

function drawSelectionTransformControls(targetCtx, bounds) {
    if (!targetCtx || !bounds) return;
    const normalizedScale = scale || 1;
    const strokeWidth = Math.max(0.5, 1 / normalizedScale);
    const handleSize = TRANSFORM_HANDLE_SIZE_PX / normalizedScale;
    const halfHandle = handleSize / 2;

    targetCtx.save();
    targetCtx.lineWidth = strokeWidth;
    targetCtx.setLineDash([]);
    targetCtx.strokeStyle = 'rgba(37, 99, 235, 0.75)';
    targetCtx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    for (const handle of getTransformHandles(bounds)) {
        const isHover = hoverTransformHandle && handle.id === hoverTransformHandle;
        targetCtx.fillStyle = isHover ? '#2563eb' : '#ffffff';
        targetCtx.strokeStyle = '#2563eb';
        targetCtx.beginPath();
        targetCtx.rect(handle.x - halfHandle, handle.y - halfHandle, handleSize, handleSize);
        targetCtx.fill();
        targetCtx.stroke();
    }

    targetCtx.restore();
}

function scaleSelectionShape(selectionShape, fromBounds, toBounds) {
    if (!selectionShape || !fromBounds || !toBounds) return null;
    if (selectionShape.type === SELECT_MAGIC) return null;

    if (selectionShape.type === SELECT_RECT) {
        return {
            type: SELECT_RECT,
            x: toBounds.x,
            y: toBounds.y,
            width: toBounds.width,
            height: toBounds.height,
        };
    }

    if (selectionShape.type === SELECT_ELLIPSE) {
        return {
            type: SELECT_ELLIPSE,
            centerX: toBounds.x + toBounds.width / 2,
            centerY: toBounds.y + toBounds.height / 2,
            radiusX: Math.max(0, toBounds.width / 2),
            radiusY: Math.max(0, toBounds.height / 2),
        };
    }

    if (selectionShape.type === SELECT_LASSO) {
        const points = selectionShape.points || [];
        if (fromBounds.width <= 0 || fromBounds.height <= 0) {
            const dx = toBounds.x - fromBounds.x;
            const dy = toBounds.y - fromBounds.y;
            return translateSelection(selectionShape, dx, dy);
        }
        const nextPoints = points.map((point) => ({
            x: toBounds.x + ((point.x - fromBounds.x) / fromBounds.width) * toBounds.width,
            y: toBounds.y + ((point.y - fromBounds.y) / fromBounds.height) * toBounds.height,
        }));
        return {
            type: SELECT_LASSO,
            points: nextPoints,
        };
    }

    return null;
}

function clampMoveBoundsToCanvas(bounds) {
    if (!bounds || !bufferCanvas) return bounds;
    let width = bounds.width;
    let height = bounds.height;
    if (width > bufferCanvas.width) width = bufferCanvas.width;
    if (height > bufferCanvas.height) height = bufferCanvas.height;
    const x = clamp(bounds.x, 0, Math.max(0, bufferCanvas.width - width));
    const y = clamp(bounds.y, 0, Math.max(0, bufferCanvas.height - height));
    return { x, y, width, height };
}

function getResizedBoundsFromHandle(startBounds, handleId, deltaX, deltaY) {
    if (!startBounds || !bufferCanvas) return startBounds;
    const minSize = SELECTION_MIN_SIZE;

    const moveLeft = handleId && handleId.includes('w');
    const moveRight = handleId && handleId.includes('e');
    const moveTop = handleId && handleId.includes('n');
    const moveBottom = handleId && handleId.includes('s');

    let left = startBounds.x;
    let top = startBounds.y;
    let right = startBounds.x + startBounds.width;
    let bottom = startBounds.y + startBounds.height;

    if (moveLeft) left += deltaX;
    if (moveRight) right += deltaX;
    if (moveTop) top += deltaY;
    if (moveBottom) bottom += deltaY;

    if (moveLeft) {
        left = clamp(left, 0, right - minSize);
    }
    if (moveRight) {
        right = clamp(right, left + minSize, bufferCanvas.width);
    }
    if (moveTop) {
        top = clamp(top, 0, bottom - minSize);
    }
    if (moveBottom) {
        bottom = clamp(bottom, top + minSize, bufferCanvas.height);
    }

    left = clamp(left, 0, bufferCanvas.width - minSize);
    top = clamp(top, 0, bufferCanvas.height - minSize);
    right = clamp(right, left + minSize, bufferCanvas.width);
    bottom = clamp(bottom, top + minSize, bufferCanvas.height);

    return {
        x: left,
        y: top,
        width: Math.max(minSize, right - left),
        height: Math.max(minSize, bottom - top),
    };
}

function captureSelectionPixels(selectionShape) {
    if (!selectionShape || !bufferCanvas) return null;
    const bounds = clampSelectionBounds(getSelectionBounds(selectionShape));
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;

    const snapshotCanvas = document.createElement('canvas');
    snapshotCanvas.width = Math.ceil(bounds.width);
    snapshotCanvas.height = Math.ceil(bounds.height);
    const snapshotCtx = snapshotCanvas.getContext('2d');
    if (!snapshotCtx) return null;

    if (selectionShape.type === SELECT_MAGIC && selectionShape.maskCanvas) {
        snapshotCtx.drawImage(bufferCanvas, -bounds.x, -bounds.y);
        snapshotCtx.globalCompositeOperation = 'destination-in';
        snapshotCtx.drawImage(selectionShape.maskCanvas, -bounds.x, -bounds.y);
        snapshotCtx.globalCompositeOperation = 'source-over';
    } else {
        snapshotCtx.save();
        snapshotCtx.translate(-bounds.x, -bounds.y);
        appendSelectionPath(snapshotCtx, selectionShape);
        snapshotCtx.clip();
        snapshotCtx.drawImage(bufferCanvas, 0, 0);
        snapshotCtx.restore();
    }

    return {
        canvas: snapshotCanvas,
        bounds,
    };
}

function hasFloatingSelection() {
    return Boolean(selectionTransform && transformClipboard && transformClipboard.canvas);
}

function getActiveLayerCompositeCanvas() {
    if (!bufferCanvas) return null;
    if (!hasFloatingSelection()) return bufferCanvas;
    if (!transformCompositeCanvas) {
        transformCompositeCanvas = document.createElement('canvas');
    }
    if (transformCompositeCanvas.width !== bufferCanvas.width) {
        transformCompositeCanvas.width = bufferCanvas.width;
    }
    if (transformCompositeCanvas.height !== bufferCanvas.height) {
        transformCompositeCanvas.height = bufferCanvas.height;
    }
    if (!transformCompositeCtx) {
        transformCompositeCtx = transformCompositeCanvas.getContext('2d');
    }
    if (!transformCompositeCtx) {
        transformCompositeCtx = transformCompositeCanvas.getContext('2d');
    }
    if (!transformCompositeCtx) return bufferCanvas;

    transformCompositeCtx.setTransform(1, 0, 0, 1, 0, 0);
    transformCompositeCtx.clearRect(0, 0, transformCompositeCanvas.width, transformCompositeCanvas.height);
    transformCompositeCtx.drawImage(bufferCanvas, 0, 0);

    const bounds = selectionTransform.currentBounds || selectionTransform.startBounds;
    if (bounds && bounds.width > 0 && bounds.height > 0) {
        transformCompositeCtx.drawImage(
            transformClipboard.canvas,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
        );
    }
    return transformCompositeCanvas;
}

function resetSelectionTransformState() {
    isTransformingSelection = false;
    selectionTransform = null;
    transformClipboard = null;
    hoverTransformHandle = null;
    hideTransformHint();
    setCanvasCursorOverride(null);
}

function startSelectionTransform(mode, handleId, startX, startY, event) {
    if (!selection || !bufferCtx || !bufferCanvas) return false;
    if (selection.type === SELECT_MAGIC) return false;
    const bounds = clampSelectionBounds(getSelectionBounds(selection));
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return false;

    const snapshot = captureSelectionPixels(selection);
    if (!snapshot || !snapshot.canvas) return false;

    const selectionClone = cloneSelectionShape(selection);
    if (!selectionClone) return false;

    transformClipboard = snapshot;
    selectionTransform = {
        mode,
        handleId: handleId || null,
        startPointerX: startX,
        startPointerY: startY,
        startBounds: bounds,
        currentBounds: bounds,
        startSelection: selectionClone,
    };

    isTransformingSelection = true;
    beginLayerHistory('selection_transform');
    const didClear = clearSelectionContent();
    if (!didClear) {
        cancelPendingHistory();
        resetSelectionTransformState();
        renderScene();
        renderOverlay();
        return false;
    }

    hideTransformHint();
    if (mode === 'resize' && handleId) {
        setCanvasCursorOverride(getTransformHandleCursor(handleId));
    } else {
        setCanvasCursorOverride('move');
    }
    renderOverlay();
    return true;
}

function startFloatingSelectionTransform(mode, handleId, startX, startY) {
    if (!hasFloatingSelection()) return false;
    if (!selection || selection.type === SELECT_MAGIC) return false;
    const bounds = selectionTransform.currentBounds || clampSelectionBounds(getSelectionBounds(selection));
    const clamped = clampSelectionBounds(bounds);
    if (!clamped || clamped.width <= 0 || clamped.height <= 0) return false;
    const selectionClone = cloneSelectionShape(selection);
    if (!selectionClone) return false;

    selectionTransform.mode = mode;
    selectionTransform.handleId = handleId || null;
    selectionTransform.startPointerX = startX;
    selectionTransform.startPointerY = startY;
    selectionTransform.startBounds = clamped;
    selectionTransform.currentBounds = clamped;
    selectionTransform.startSelection = selectionClone;

    isTransformingSelection = true;
    hideTransformHint();
    if (mode === 'resize' && handleId) {
        setCanvasCursorOverride(getTransformHandleCursor(handleId));
    } else {
        setCanvasCursorOverride('move');
    }
    renderOverlay();
    return true;
}

function tryStartSelectionTransformAt(x, y, event) {
    if (!shouldShowSelectionTransformUI()) return false;
    if (!selection || selection.type === SELECT_MAGIC) return false;
    const bounds = hasFloatingSelection()
        ? (selectionTransform.currentBounds || clampSelectionBounds(getSelectionBounds(selection)))
        : clampSelectionBounds(getSelectionBounds(selection));
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return false;

    const handleId = getTransformHandleAtPoint(x, y, bounds);
    if (handleId) {
        return hasFloatingSelection()
            ? startFloatingSelectionTransform('resize', handleId, x, y)
            : startSelectionTransform('resize', handleId, x, y, event);
    }
    if (isPointInSelection(x, y, selection)) {
        return hasFloatingSelection()
            ? startFloatingSelectionTransform('move', null, x, y)
            : startSelectionTransform('move', null, x, y, event);
    }
    return false;
}

function updateSelectionTransform(event) {
    if (!isTransformingSelection || !selectionTransform) return;
    const { x, y } = getCanvasCoords(event);
    lastPointerX = x;
    lastPointerY = y;

    const dx = x - selectionTransform.startPointerX;
    const dy = y - selectionTransform.startPointerY;

    let nextBounds = selectionTransform.startBounds;
    let nextSelection = null;

    if (selectionTransform.mode === 'move') {
        const moved = {
            x: selectionTransform.startBounds.x + dx,
            y: selectionTransform.startBounds.y + dy,
            width: selectionTransform.startBounds.width,
            height: selectionTransform.startBounds.height,
        };
        nextBounds = clampMoveBoundsToCanvas(moved);
        const appliedDx = nextBounds.x - selectionTransform.startBounds.x;
        const appliedDy = nextBounds.y - selectionTransform.startBounds.y;
        nextSelection = translateSelection(selectionTransform.startSelection, appliedDx, appliedDy);
    } else if (selectionTransform.mode === 'resize') {
        nextBounds = getResizedBoundsFromHandle(
            selectionTransform.startBounds,
            selectionTransform.handleId,
            dx,
            dy,
        );
        nextSelection = scaleSelectionShape(selectionTransform.startSelection, selectionTransform.startBounds, nextBounds);
    }

    if (nextSelection) {
        selection = nextSelection;
    }
    selectionTransform.currentBounds = nextBounds;
    if (activeLayer) {
        renderLayer(activeLayer);
    }
    renderOverlay();
}

function commitSelectionTransform() {
    if (!selectionTransform || !transformClipboard || !transformClipboard.canvas) {
        resetSelectionTransformState();
        renderScene();
        renderOverlay();
        return;
    }
    isTransformingSelection = false;

    if (!bufferCtx || !bufferCanvas) {
        resetSelectionTransformState();
        renderScene();
        renderOverlay();
        return;
    }

    const bounds = selectionTransform.currentBounds || selectionTransform.startBounds;
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        resetSelectionTransformState();
        renderScene();
        renderOverlay();
        return;
    }

    bufferCtx.save();
    bufferCtx.globalCompositeOperation = 'source-over';
    bufferCtx.drawImage(
        transformClipboard.canvas,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
    );
    bufferCtx.restore();

    markUnsavedChanges();
    commitLayerHistory();

    resetSelectionTransformState();
    renderScene();
    renderOverlay();
}

function updateSelectionTransformHover(event, x, y) {
    if (isTransformingSelection) return;
    if (!shouldShowSelectionTransformUI() || selectionDraft || !selection) {
        if (hoverTransformHandle) {
            hoverTransformHandle = null;
            renderOverlay();
        }
        hideTransformHint();
        setCanvasCursorOverride(null);
        return;
    }

    const bounds = hasFloatingSelection()
        ? (selectionTransform.currentBounds || clampSelectionBounds(getSelectionBounds(selection)))
        : clampSelectionBounds(getSelectionBounds(selection));
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        hideTransformHint();
        setCanvasCursorOverride(null);
        return;
    }

    const handleId = getTransformHandleAtPoint(x, y, bounds);
    if (handleId) {
        const cursor = getTransformHandleCursor(handleId);
        setCanvasCursorOverride(cursor);
        showTransformHint(getTransformHandleHint(handleId), event);
        if (hoverTransformHandle !== handleId) {
            hoverTransformHandle = handleId;
            renderOverlay();
        }
        return;
    }

    if (isPointInSelection(x, y, selection)) {
        setCanvasCursorOverride('move');
        showTransformHint('Перемещение: потяните выделение мышью', event);
        if (hoverTransformHandle) {
            hoverTransformHandle = null;
            renderOverlay();
        }
        return;
    }

    if (hoverTransformHandle) {
        hoverTransformHandle = null;
        renderOverlay();
    }
    hideTransformHint();
    setCanvasCursorOverride(null);
}

function copySelectionToClipboard() {
    if (!selection || !bufferCanvas) return false;
    const sourceCanvas = hasFloatingSelection() ? (getActiveLayerCompositeCanvas() || bufferCanvas) : bufferCanvas;
    const bounds = getSelectionBounds(selection);
    const clampedBounds = clampSelectionBounds(bounds);
    if (!clampedBounds || clampedBounds.width <= 0 || clampedBounds.height <= 0) {
        return false;
    }

    const clipboardCanvas = document.createElement('canvas');
    clipboardCanvas.width = Math.ceil(clampedBounds.width);
    clipboardCanvas.height = Math.ceil(clampedBounds.height);
    const clipboardCtx = clipboardCanvas.getContext('2d');
    if (!clipboardCtx) return false;

    if (selection.type === SELECT_MAGIC && selection.maskCanvas) {
        clipboardCtx.drawImage(bufferCanvas, -clampedBounds.x, -clampedBounds.y);
        clipboardCtx.globalCompositeOperation = 'destination-in';
        clipboardCtx.drawImage(selection.maskCanvas, -clampedBounds.x, -clampedBounds.y);
        clipboardCtx.globalCompositeOperation = 'source-over';
    } else {
        clipboardCtx.save();
        clipboardCtx.translate(-clampedBounds.x, -clampedBounds.y);
        appendSelectionPath(clipboardCtx, selection);
        clipboardCtx.clip();
        clipboardCtx.drawImage(sourceCanvas, 0, 0);
        clipboardCtx.restore();
    }

    selectionClipboard = {
        canvas: clipboardCanvas,
        width: clipboardCanvas.width,
        height: clipboardCanvas.height,
        originX: clampedBounds.x,
        originY: clampedBounds.y,
        selection: selection.type === SELECT_MAGIC ? null : cloneSelectionShape(selection),
    };
    return true;
}

function clearSelectionContent() {
    if (!selection || !bufferCtx || !bufferCanvas) return false;
    if (selection.type === SELECT_MAGIC && selection.maskCanvas) {
        bufferCtx.save();
        bufferCtx.globalCompositeOperation = 'destination-out';
        bufferCtx.drawImage(selection.maskCanvas, 0, 0);
        bufferCtx.restore();
    } else {
        bufferCtx.save();
        appendSelectionPath(bufferCtx, selection);
        bufferCtx.clip();
        bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
        bufferCtx.restore();
    }
    renderScene();
    markUnsavedChanges();
    return true;
}

function cutSelectionToClipboard() {
    const didCopy = copySelectionToClipboard();
    if (!didCopy) return false;
    if (hasFloatingSelection()) {
        resetSelectionTransformState();
        renderScene();
        renderOverlay();
        return true;
    }
    beginLayerHistory('cut');
    const didClear = clearSelectionContent();
    if (didClear) {
        commitLayerHistory();
    } else {
        cancelPendingHistory();
    }
    return true;
}

function pasteSelectionFromClipboard() {
    if (!selectionClipboard || !bufferCtx || !bufferCanvas) return false;
    if (hasFloatingSelection()) {
        commitSelectionTransform();
    }
    const clipboardCanvas = selectionClipboard.canvas;
    if (!clipboardCanvas) return false;
    beginLayerHistory('paste');

    let pasteX = Number.isFinite(lastPointerX) ? lastPointerX : selectionClipboard.originX;
    let pasteY = Number.isFinite(lastPointerY) ? lastPointerY : selectionClipboard.originY;
    pasteX -= selectionClipboard.width / 2;
    pasteY -= selectionClipboard.height / 2;

    const deltaX = pasteX - selectionClipboard.originX;
    const deltaY = pasteY - selectionClipboard.originY;
    const pastedSelection = translateSelection(selectionClipboard.selection, deltaX, deltaY);

    if (selection && selection.type === SELECT_MAGIC && selection.maskCanvas) {
        if (!ensureSelectionScratchCanvas()) {
            cancelPendingHistory();
            return false;
        }
        clearCanvas(selectionScratchCtx, selectionScratchCanvas);
        selectionScratchCtx.drawImage(clipboardCanvas, pasteX, pasteY);
        selectionScratchCtx.globalCompositeOperation = 'destination-in';
        selectionScratchCtx.drawImage(selection.maskCanvas, 0, 0);
        selectionScratchCtx.globalCompositeOperation = 'source-over';
        bufferCtx.drawImage(selectionScratchCanvas, 0, 0);
    } else {
        bufferCtx.save();
        if (selection) {
            appendSelectionPath(bufferCtx, selection);
            bufferCtx.clip();
        }
        bufferCtx.drawImage(clipboardCanvas, pasteX, pasteY);
        bufferCtx.restore();
    }

    renderScene();
    markUnsavedChanges();
    if (!selection && pastedSelection) {
        selection = pastedSelection;
        selectionDashOffset = 0;
    }
    renderOverlay();
    commitLayerHistory();
    return true;
}

function isPointInSelection(x, y, selectionShape) {
    if (!selectionShape) return false;
    if (selectionShape.type === SELECT_RECT) {
        return x >= selectionShape.x
            && y >= selectionShape.y
            && x <= selectionShape.x + selectionShape.width
            && y <= selectionShape.y + selectionShape.height;
    }
    if (selectionShape.type === SELECT_ELLIPSE) {
        const radiusX = selectionShape.radiusX || 0;
        const radiusY = selectionShape.radiusY || 0;
        if (radiusX === 0 || radiusY === 0) return false;
        const dx = (x - selectionShape.centerX) / radiusX;
        const dy = (y - selectionShape.centerY) / radiusY;
        return dx * dx + dy * dy <= 1;
    }
    if (selectionShape.type === SELECT_LASSO) {
        const points = selectionShape.points || [];
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
            const xi = points[i].x;
            const yi = points[i].y;
            const xj = points[j].x;
            const yj = points[j].y;
            const intersect = ((yi > y) !== (yj > y))
                && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
    if (selectionShape.type === SELECT_MAGIC) {
        const width = selectionShape.width;
        const height = selectionShape.height;
        const mask = selectionShape.mask;
        if (!width || !height || !mask) return false;
        const px = Math.floor(x);
        const py = Math.floor(y);
        if (px < 0 || py < 0 || px >= width || py >= height) return false;
        return Boolean(mask[py * width + px]);
    }
    return false;
}

function clearSelection() {
    if (hasFloatingSelection()) {
        commitSelectionTransform();
    }
    selection = null;
    selectionDraft = null;
    isSelecting = false;
    lassoPoints = [];
    hideTransformHint();
    setCanvasCursorOverride(null);
    hoverTransformHandle = null;
    renderOverlay();
    updateSelectionAnimationState();
}

function buildSelectionMaskCanvas(mask, width, height) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return null;
    const imageData = maskCtx.createImageData(width, height);
    const data = imageData.data;
    for (let i = 0; i < mask.length; i += 1) {
        if (mask[i]) {
            const offset = i * 4;
            data[offset] = 0;
            data[offset + 1] = 0;
            data[offset + 2] = 0;
            data[offset + 3] = 255;
        }
    }
    maskCtx.putImageData(imageData, 0, 0);
    return maskCanvas;
}

function createMagicWandSelection(startX, startY) {
    if (!bufferCtx || !bufferCanvas) return false;
    const width = bufferCanvas.width;
    const height = bufferCanvas.height;
    const x = Math.floor(startX);
    const y = Math.floor(startY);
    if (x < 0 || y < 0 || x >= width || y >= height) return false;

    const imageData = bufferCtx.getImageData(0, 0, width, height);
    const { data } = imageData;
    const startIndex = (y * width + x) * 4;
    const targetColor = [
        data[startIndex],
        data[startIndex + 1],
        data[startIndex + 2],
        data[startIndex + 3],
    ];
    const tolerance = clamp(wandTolerance, 0, 255);
    const toleranceSq = tolerance * tolerance;

    const mask = new Uint8Array(width * height);
    const stack = [x, y];
    let minX = x;
    let maxX = x;
    let minY = y;
    let maxY = y;

    while (stack.length > 0) {
        const currentY = stack.pop();
        const currentX = stack.pop();
        if (currentX === undefined || currentY === undefined) break;
        if (currentX < 0 || currentY < 0 || currentX >= width || currentY >= height) {
            continue;
        }
        const offset = currentY * width + currentX;
        if (mask[offset]) continue;

        const dataIndex = offset * 4;
        const dr = data[dataIndex] - targetColor[0];
        const dg = data[dataIndex + 1] - targetColor[1];
        const db = data[dataIndex + 2] - targetColor[2];
        const distanceSq = dr * dr + dg * dg + db * db;
        if (distanceSq > toleranceSq) continue;

        mask[offset] = 1;
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);

        stack.push(currentX + 1, currentY);
        stack.push(currentX - 1, currentY);
        stack.push(currentX, currentY + 1);
        stack.push(currentX, currentY - 1);
    }

    if (minX > maxX || minY > maxY) return false;

    const maskCanvas = buildSelectionMaskCanvas(mask, width, height);
    if (!maskCanvas) return false;

    isSelecting = false;
    selectionDraft = null;
    lassoPoints = [];
    selection = {
        type: SELECT_MAGIC,
        mask,
        maskCanvas,
        width,
        height,
        bounds: {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
        },
    };
    selectionDashOffset = 0;
    renderOverlay();
    return true;
}

function startSelectionAnimation() {
    if (selectionAnimationId) return;
    const tick = () => {
        if (!selection) {
            selectionAnimationId = null;
            return;
        }
        if (!isDrawing && !isSelecting && !isPanning && !isTransformingSelection) {
            selectionDashOffset -= SELECTION_DASH_SPEED;
            renderOverlay();
        }
        selectionAnimationId = requestAnimationFrame(tick);
    };
    selectionAnimationId = requestAnimationFrame(tick);
}

function stopSelectionAnimation() {
    if (!selectionAnimationId) return;
    cancelAnimationFrame(selectionAnimationId);
    selectionAnimationId = null;
}

function updateSelectionAnimationState() {
    if (selection) {
        startSelectionAnimation();
    } else {
        stopSelectionAnimation();
    }
}

function logCoordDebug(label, event, extra = {}) {
    if (!DEBUG_COORDS || !event || !canvas) return;
    const now = performance.now();
    if (now - lastDebugAt < DEBUG_COORDS_THROTTLE_MS) return;
    lastDebugAt = now;

    const metrics = getCanvasMetrics();
    const raw = getCanvasRawCoords(event);
    const world = getCanvasCoords(event);
    const overlayRect = overlayCanvas ? overlayCanvas.getBoundingClientRect() : null;

    console.log(`[coord-debug] ${label}`, {
        tool: currentTool,
        selectionMode,
        scale,
        offsetX,
        offsetY,
        canvasSize: { width: canvas.width, height: canvas.height },
        rectSize: { width: metrics.rect.width, height: metrics.rect.height },
        contentSize: { width: metrics.contentWidth, height: metrics.contentHeight },
        border: {
            left: metrics.borderLeft,
            top: metrics.borderTop,
            right: metrics.borderRight,
            bottom: metrics.borderBottom,
        },
        scaleXY: { x: metrics.scaleX, y: metrics.scaleY },
        raw: { x: raw.rawX, y: raw.rawY },
        canvasXY: { x: raw.x, y: raw.y },
        worldXY: { x: world.x, y: world.y },
        overlayRect: overlayRect
            ? {
                width: overlayRect.width,
                height: overlayRect.height,
                left: overlayRect.left,
                top: overlayRect.top,
            }
            : null,
        devicePixelRatio: window.devicePixelRatio,
        ...extra,
    });
}

// =======================
// Получение координат внутри canvas
// =======================

/**
 * Переводим координаты мыши в систему координат canvas
 */
function getCanvasMetrics() {
    const rect = canvas.getBoundingClientRect();
    const style = window.getComputedStyle(canvas);
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderRight = parseFloat(style.borderRightWidth) || 0;
    const borderBottom = parseFloat(style.borderBottomWidth) || 0;
    const contentWidth = rect.width - borderLeft - borderRight;
    const contentHeight = rect.height - borderTop - borderBottom;
    const scaleX = canvas.width / contentWidth;
    const scaleY = canvas.height / contentHeight;

    return {
        rect,
        borderLeft,
        borderTop,
        borderRight,
        borderBottom,
        contentWidth,
        contentHeight,
        scaleX,
        scaleY,
    };
}

function getCanvasRawCoords(event) {
    const {
        rect,
        borderLeft,
        borderTop,
        scaleX,
        scaleY,
    } = getCanvasMetrics();
    // `offsetX/offsetY` корректны только когда target — сам canvas.
    // При drag за пределами canvas события приходят с target=document/body/etc,
    // и offsetX/offsetY начинают "прыгать" -> фигуры/выделение ведут себя странно.
    const isCanvasEventTarget = event && (event.target === canvas || event.currentTarget === canvas);
    const hasOffset = isCanvasEventTarget
        && typeof event.offsetX === 'number'
        && typeof event.offsetY === 'number';
    const rawX = hasOffset ? event.offsetX : event.clientX - rect.left - borderLeft;
    const rawY = hasOffset ? event.offsetY : event.clientY - rect.top - borderTop;
    const x = rawX * scaleX;
    const y = rawY * scaleY;
    return { x, y, rect, rawX, rawY };
}

function getCanvasCoords(event) {
    const { x: rawX, y: rawY } = getCanvasRawCoords(event);
    const normalizedScale = scale || 1;
    const x = (rawX - offsetX) / normalizedScale;
    const y = (rawY - offsetY) / normalizedScale;
    return { x, y };
}

function pickColorAt(x, y) {
    if (!bufferCtx || !bufferCanvas) return;
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || py < 0 || px >= bufferCanvas.width || py >= bufferCanvas.height) {
        return;
    }
    const pixel = bufferCtx.getImageData(px, py, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    if (colorInput) {
        colorInput.value = hex;
    }
    setColor(hex);
}

function showEyedropperZoom() {
    if (!eyedropperZoom) return;
    eyedropperZoom.classList.add('is-visible');
}

function hideEyedropperZoom() {
    if (!eyedropperZoom) return;
    eyedropperZoom.classList.remove('is-visible');
}

function positionEyedropperZoom(event) {
    if (!eyedropperZoom || !canvasWrapper) return;
    const wrapperRect = canvasWrapper.getBoundingClientRect();
    const left = event.clientX - wrapperRect.left + EYEDROPPER_ZOOM_OFFSET;
    const top = event.clientY - wrapperRect.top + EYEDROPPER_ZOOM_OFFSET;
    eyedropperZoom.style.left = `${left}px`;
    eyedropperZoom.style.top = `${top}px`;
}

function drawEyedropperZoom(x, y) {
    if (!eyedropperZoomCtx || !eyedropperZoomCanvas || !bufferCanvas) return;
    const zoomSize = EYEDROPPER_ZOOM_SIZE;
    if (eyedropperZoomCanvas.width !== zoomSize || eyedropperZoomCanvas.height !== zoomSize) {
        eyedropperZoomCanvas.width = zoomSize;
        eyedropperZoomCanvas.height = zoomSize;
    }
    const pixels = EYEDROPPER_ZOOM_PIXELS;
    const scale = zoomSize / pixels;
    const half = Math.floor(pixels / 2);
    const centerX = Math.floor(x);
    const centerY = Math.floor(y);
    const startX = centerX - half;
    const startY = centerY - half;

    eyedropperZoomCtx.imageSmoothingEnabled = false;
    eyedropperZoomCtx.clearRect(0, 0, zoomSize, zoomSize);
    eyedropperZoomCtx.fillStyle = '#ffffff';
    eyedropperZoomCtx.fillRect(0, 0, zoomSize, zoomSize);

    const srcX = clamp(startX, 0, bufferCanvas.width);
    const srcY = clamp(startY, 0, bufferCanvas.height);
    const offsetX = srcX - startX;
    const offsetY = srcY - startY;
    const srcWidth = Math.min(pixels - offsetX, bufferCanvas.width - srcX);
    const srcHeight = Math.min(pixels - offsetY, bufferCanvas.height - srcY);
    const destX = offsetX * scale;
    const destY = offsetY * scale;

    if (srcWidth > 0 && srcHeight > 0) {
        eyedropperZoomCtx.drawImage(
            bufferCanvas,
            srcX,
            srcY,
            srcWidth,
            srcHeight,
            destX,
            destY,
            srcWidth * scale,
            srcHeight * scale,
        );
    }

    eyedropperZoomCtx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    eyedropperZoomCtx.lineWidth = 1;
    for (let i = 0; i <= pixels; i += 1) {
        const pos = Math.round(i * scale) + 0.5;
        eyedropperZoomCtx.beginPath();
        eyedropperZoomCtx.moveTo(pos, 0);
        eyedropperZoomCtx.lineTo(pos, zoomSize);
        eyedropperZoomCtx.stroke();

        eyedropperZoomCtx.beginPath();
        eyedropperZoomCtx.moveTo(0, pos);
        eyedropperZoomCtx.lineTo(zoomSize, pos);
        eyedropperZoomCtx.stroke();
    }

    const centerPos = Math.round(half * scale) + 0.5;
    eyedropperZoomCtx.strokeStyle = '#000000';
    eyedropperZoomCtx.lineWidth = 2;
    eyedropperZoomCtx.strokeRect(centerPos, centerPos, scale, scale);
    eyedropperZoomCtx.strokeStyle = '#ffffff';
    eyedropperZoomCtx.lineWidth = 1;
    eyedropperZoomCtx.strokeRect(centerPos + 0.5, centerPos + 0.5, scale - 1, scale - 1);
}

function updateEyedropperZoom(event) {
    if (currentTool !== TOOL_EYEDROPPER) {
        hideEyedropperZoom();
        return;
    }
    const { x, y } = getCanvasCoords(event);
    positionEyedropperZoom(event);
    drawEyedropperZoom(x, y);
    showEyedropperZoom();
}

function hexToRgba(hex) {
    if (!hex) return [0, 0, 0, 255];
    const normalized = hex.replace('#', '').trim();
    if (normalized.length === 3) {
        const r = parseInt(normalized[0] + normalized[0], 16);
        const g = parseInt(normalized[1] + normalized[1], 16);
        const b = parseInt(normalized[2] + normalized[2], 16);
        return [r, g, b, 255];
    }
    if (normalized.length === 6) {
        const r = parseInt(normalized.substring(0, 2), 16);
        const g = parseInt(normalized.substring(2, 4), 16);
        const b = parseInt(normalized.substring(4, 6), 16);
        return [r, g, b, 255];
    }
    return [0, 0, 0, 255];
}

function colorsMatch(data, index, color) {
    return data[index] === color[0]
        && data[index + 1] === color[1]
        && data[index + 2] === color[2]
        && data[index + 3] === color[3];
}

function setPixelColor(data, index, color) {
    data[index] = color[0];
    data[index + 1] = color[1];
    data[index + 2] = color[2];
    data[index + 3] = color[3];
}

function floodFill(startX, startY) {
    if (!bufferCtx || !bufferCanvas) return false;
    const width = bufferCanvas.width;
    const height = bufferCanvas.height;
    const x = Math.floor(startX);
    const y = Math.floor(startY);
    const hasSelection = Boolean(selection);

    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    if (hasSelection && !isPointInSelection(x + 0.5, y + 0.5, selection)) return false;

    const imageData = bufferCtx.getImageData(0, 0, width, height);
    const { data } = imageData;
    const startIndex = (y * width + x) * 4;
    const targetColor = [
        data[startIndex],
        data[startIndex + 1],
        data[startIndex + 2],
        data[startIndex + 3],
    ];
    const fillColor = hexToRgba(currentColor);

    if (colorsMatch(data, startIndex, fillColor)) return false;

    const visited = new Uint8Array(width * height);
    const stack = [x, y];

    while (stack.length > 0) {
        const currentY = stack.pop();
        const currentX = stack.pop();
        if (currentX === undefined || currentY === undefined) break;
        if (currentX < 0 || currentY < 0 || currentX >= width || currentY >= height) {
            continue;
        }

        const offset = currentY * width + currentX;
        if (visited[offset]) continue;
        visited[offset] = 1;

        if (hasSelection && !isPointInSelection(currentX + 0.5, currentY + 0.5, selection)) {
            continue;
        }

        const pixelIndex = offset * 4;
        if (!colorsMatch(data, pixelIndex, targetColor)) continue;

        setPixelColor(data, pixelIndex, fillColor);

        stack.push(currentX + 1, currentY);
        stack.push(currentX - 1, currentY);
        stack.push(currentX, currentY + 1);
        stack.push(currentX, currentY - 1);
    }

    bufferCtx.putImageData(imageData, 0, 0);
    renderScene();
    return true;
}

// =======================
// Сохранение проекта
// =======================

function getCookie(name) {
    if (!document.cookie) return null;

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const trimmed = cookie.trim();
        if (trimmed.startsWith(`${name}=`)) {
            return decodeURIComponent(trimmed.substring(name.length + 1));
        }
    }

    return null;
}

function getCsrfToken() {
    return getCookie('csrftoken');
}

function getFrameSaveUrl(index) {
    if (!frameSaveUrlTemplate) return '';
    if (frameSaveUrlTemplate.includes('/0/save/')) {
        return frameSaveUrlTemplate.replace('/0/save/', `/${index}/save/`);
    }
    return frameSaveUrlTemplate.replace('0', String(index));
}

function setSaveIndicator(state) {
    if (!saveIndicator) return;

    saveIndicator.classList.remove(
        'save-indicator--idle',
        'save-indicator--saved',
        'save-indicator--dirty',
        'save-indicator--saving',
        'save-indicator--error',
    );

    if (state) {
        saveIndicator.classList.add(`save-indicator--${state}`);
    }
}

function setSaveStatus(text, state) {
    if (!saveStatus) return;

    saveStatus.textContent = text;
    saveStatus.classList.remove(
        'save-status--saving',
        'save-status--saved',
        'save-status--dirty',
        'save-status--error',
    );

    if (state) {
        saveStatus.classList.add(`save-status--${state}`);
    }
}

function formatTimeAgo(date) {
    const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

    if (diffSeconds < 5) {
        return 'несколько секунд назад';
    }
    if (diffSeconds < 60) {
        return `${diffSeconds} сек. назад`;
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
        return `${diffMinutes} мин. назад`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours} ч. назад`;
}

function updateLastSavedLabel() {
    if (!lastSavedLabel) return;

    if (!lastSavedAt) {
        lastSavedLabel.textContent = '';
        return;
    }

    lastSavedLabel.textContent = `Последнее сохранение: ${formatTimeAgo(lastSavedAt)}`;
}

function updateSaveButtonState() {
    if (!saveButton) return;
    saveButton.disabled = isSaving || isAutosaving || !hasUnsavedChanges;
}

/**
 * Помечаем, что в проекте появились несохраненные изменения.
 */
function markUnsavedChanges() {
    if (hasUnsavedChanges) return;

    hasUnsavedChanges = true;
    setSaveIndicator('dirty');
    setSaveStatus('Есть несохраненные изменения', 'dirty');
    updateSaveButtonState();
}

function initSaveState() {
    setSaveIndicator('idle');
    setSaveStatus('Нет изменений');
    updateLastSavedLabel();
    updateSaveButtonState();
}

function parseSavedDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}

function normalizeAssetUrl(url) {
    if (!url) return '';
    try {
        return new URL(url, window.location.origin).toString();
    } catch (error) {
        return url;
    }
}

function getTimelineFrameById(frameId) {
    return timelineFrames.find((frame) => frame.id === frameId) || null;
}

function getTimelineFrameByIndex(frameIndex) {
    return timelineFrames.find((frame) => frame.index === frameIndex) || null;
}

function syncCurrentFrameIdFromTimeline() {
    if (currentFrameId) return;
    const found = getTimelineFrameByIndex(currentFrameIndex);
    if (found) {
        currentFrameId = found.id;
    }
}

function coerceIntInRange(value, minValue, maxValue, fallbackValue) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallbackValue;
    return clamp(parsed, minValue, maxValue);
}

function coerceOnionMode(value) {
    if (value === 'prev' || value === 'next' || value === 'both') return value;
    return 'both';
}

function loadOnionSkinSettings() {
    try {
        const raw = window.localStorage.getItem(ONION_SKIN_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;

        onionFrameCount = coerceIntInRange(parsed.frameCount, 1, 3, onionFrameCount);
        onionOpacityPrev = coerceIntInRange(parsed.opacityPrev, 0, 100, onionOpacityPrev);
        onionOpacityNext = coerceIntInRange(parsed.opacityNext, 0, 100, onionOpacityNext);
        onionMode = coerceOnionMode(parsed.mode);
    } catch (error) {
        // localStorage может быть недоступен (private mode / блокировки) — не падаем
    }
}

function storeOnionSkinSettings() {
    try {
        window.localStorage.setItem(ONION_SKIN_STORAGE_KEY, JSON.stringify({
            frameCount: onionFrameCount,
            opacityPrev: onionOpacityPrev,
            opacityNext: onionOpacityNext,
            mode: onionMode,
        }));
    } catch (error) {
        // localStorage может быть недоступен — не падаем
    }
}

function updateOnionSkinValueLabels() {
    if (onionCountValueLabel) {
        onionCountValueLabel.textContent = String(onionFrameCount);
    }
    if (onionOpacityPrevValueLabel) {
        onionOpacityPrevValueLabel.textContent = `${onionOpacityPrev}%`;
    }
    if (onionOpacityNextValueLabel) {
        onionOpacityNextValueLabel.textContent = `${onionOpacityNext}%`;
    }
}

function clearOnionCanvases() {
    if (onionPrevCtx && onionPrevCanvas) {
        clearCanvas(onionPrevCtx, onionPrevCanvas);
    }
    if (onionNextCtx && onionNextCanvas) {
        clearCanvas(onionNextCtx, onionNextCanvas);
    }
}

function shouldShowOnionPrev() {
    return onionEnabled
        && !onionSuppressed
        && (onionMode === 'prev' || onionMode === 'both');
}

function shouldShowOnionNext() {
    return onionEnabled
        && !onionSuppressed
        && (onionMode === 'next' || onionMode === 'both');
}

function syncOnionCanvasVisibility() {
    const showPrev = shouldShowOnionPrev();
    const showNext = shouldShowOnionNext();

    if (onionPrevCanvas) {
        onionPrevCanvas.hidden = !showPrev;
        if (!showPrev && onionPrevCtx) {
            clearCanvas(onionPrevCtx, onionPrevCanvas);
        }
    }

    if (onionNextCanvas) {
        onionNextCanvas.hidden = !showNext;
        if (!showNext && onionNextCtx) {
            clearCanvas(onionNextCtx, onionNextCanvas);
        }
    }
}

function syncOnionUI() {
    if (onionToggleButton) {
        onionToggleButton.classList.toggle('tool-button--active', onionEnabled);
    }
    if (onionPanel) {
        onionPanel.hidden = !onionEnabled;
    }
    if (onionCountInput) {
        onionCountInput.value = String(onionFrameCount);
    }
    if (onionOpacityPrevInput) {
        onionOpacityPrevInput.value = String(onionOpacityPrev);
    }
    if (onionOpacityNextInput) {
        onionOpacityNextInput.value = String(onionOpacityNext);
    }
    if (onionModePrevInput) {
        onionModePrevInput.checked = onionMode === 'prev';
    }
    if (onionModeNextInput) {
        onionModeNextInput.checked = onionMode === 'next';
    }
    if (onionModeBothInput) {
        onionModeBothInput.checked = onionMode === 'both';
    }
    updateOnionSkinValueLabels();
    syncOnionCanvasVisibility();
}

function startOnionPanelDrag(event) {
    if (!event) return;
    if (!onionPanel || !onionPanelHeader || !editorMain) return;
    if (onionPanel.hidden) return;
    if (event.button !== 0) return;
    if (event.target && event.target.closest && event.target.closest('button')) return;
    event.preventDefault();

    const mainRect = editorMain.getBoundingClientRect();
    const panelRect = onionPanel.getBoundingClientRect();

    onionPanelOffsetX = event.clientX - panelRect.left;
    onionPanelOffsetY = event.clientY - panelRect.top;

    const left = panelRect.left - mainRect.left;
    const top = panelRect.top - mainRect.top;

    onionPanel.style.left = `${Math.round(left)}px`;
    onionPanel.style.top = `${Math.round(top)}px`;
    onionPanel.style.right = 'auto';
    onionPanel.style.bottom = 'auto';
    onionPanel.style.transform = 'none';

    isDraggingOnionPanel = true;
    onionPanel.classList.add('is-dragging');
}

function updateOnionPanelDrag(event) {
    if (!event) return;
    if (!isDraggingOnionPanel) return;
    if (!onionPanel || !editorMain) return;

    const mainRect = editorMain.getBoundingClientRect();
    const panelWidth = onionPanel.offsetWidth || 0;
    const panelHeight = onionPanel.offsetHeight || 0;

    const maxLeft = Math.max(0, mainRect.width - panelWidth);
    const maxTop = Math.max(0, mainRect.height - panelHeight);

    const nextLeft = clamp(event.clientX - mainRect.left - onionPanelOffsetX, 0, maxLeft);
    const nextTop = clamp(event.clientY - mainRect.top - onionPanelOffsetY, 0, maxTop);

    onionPanel.style.left = `${Math.round(nextLeft)}px`;
    onionPanel.style.top = `${Math.round(nextTop)}px`;
}

function stopOnionPanelDrag() {
    if (!isDraggingOnionPanel) return;
    isDraggingOnionPanel = false;
    if (onionPanel) {
        onionPanel.classList.remove('is-dragging');
        savePanelPosition('onion', onionPanel);
    }
}

function bindOnionPanelDrag() {
    if (!onionPanelHeader) return;
    onionPanelHeader.addEventListener('mousedown', startOnionPanelDrag);
    window.addEventListener('mousemove', updateOnionPanelDrag);
    window.addEventListener('mouseup', stopOnionPanelDrag);
}

function positionOnionPanelOnOpen() {
    if (!onionPanel || !editorMain || !canvas) return;

    const storedPos = normalizeLoadedPanelPosition(loadPanelPosition('onion'));
    if (storedPos && storedPos.position) {
        applyPanelPosition(onionPanel, storedPos.position);
        onionPanel.style.transform = 'none';
        if (storedPos.didMigrate) {
            storePanelPosition('onion', storedPos.position);
        }
        return;
    }

    const mainRect = editorMain.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const panelWidth = onionPanel.offsetWidth || 0;
    const panelHeight = onionPanel.offsetHeight || 0;
    const centerX = (canvasRect.left - mainRect.left) + canvasRect.width / 2;
    const centerY = (canvasRect.top - mainRect.top) + canvasRect.height / 2;
    const targetLeft = centerX - panelWidth / 2;
    const targetTop = centerY - panelHeight / 2;

    applyPanelPosition(onionPanel, { left: targetLeft, top: targetTop });
    onionPanel.style.transform = 'none';
}

function setOnionSuppressed(nextSuppressed) {
    const normalized = Boolean(nextSuppressed);
    if (onionSuppressed === normalized) return;
    onionSuppressed = normalized;
    syncOnionCanvasVisibility();
    if (onionSuppressed) {
        clearOnionCanvases();
    } else {
        prefetchOnionFramesForCurrent();
        requestOnionSkinRender();
    }
}

function setOnionEnabled(nextEnabled) {
    onionEnabled = Boolean(nextEnabled);
    if (!onionEnabled) {
        stopOnionPanelDrag();
        clearOnionCanvases();
    } else {
        // на всякий случай синхронизируем размещение, т.к. canvases могут быть скрыты/показаны
        syncOverlayPlacement();
    }
    if (onionEnabled && onionPanel) {
        // скрываем визуально, но оставляем в layout, чтобы корректно измерить размеры
        onionPanel.style.visibility = 'hidden';
    }
    syncOnionUI();
    storeOnionSkinSettings();
    if (onionEnabled) {
        positionOnionPanelOnOpen();
        if (onionPanel) {
            onionPanel.style.visibility = '';
        }
        prefetchOnionFramesForCurrent();
        requestOnionSkinRender();
    } else if (onionPanel) {
        onionPanel.style.visibility = '';
    }
}

function getOnionNeighborFrameIndices() {
    const count = clamp(Number(onionFrameCount) || 1, 1, 3);
    const prev = [];
    const next = [];

    for (let step = 1; step <= count; step += 1) {
        const prevIndex = currentFrameIndex - step;
        const nextIndex = currentFrameIndex + step;
        if (prevIndex > 0 && getTimelineFrameByIndex(prevIndex)) {
            prev.push(prevIndex);
        }
        if (getTimelineFrameByIndex(nextIndex)) {
            next.push(nextIndex);
        }
    }
    return { prev, next };
}

function buildOnionPreviewImageUrl(previewUrl, updatedAt) {
    const normalized = normalizeAssetUrl(previewUrl);
    if (!normalized) return '';
    const token = updatedAt ? encodeURIComponent(updatedAt) : '0';
    return `${normalized}${normalized.includes('?') ? '&' : '?'}v=${token}`;
}

function getOnionCacheEntry(frameIndex) {
    const index = Number(frameIndex);
    if (!Number.isFinite(index) || index <= 0) return null;
    const existing = onionFrameCache.get(index);
    if (existing) return existing;

    const entry = {
        index,
        previewUrl: '',
        updatedAt: '',
        didFetchDetail: false,
        detailPromise: null,
        image: null,
        imageUrl: '',
        imagePromise: null,
    };
    onionFrameCache.set(index, entry);
    return entry;
}

async function fetchOnionFrameDetail(frameIndex) {
    const url = getFrameDetailUrl(frameIndex);
    if (!url) return null;
    try {
        const response = await fetch(url, { credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            return null;
        }
        return data.frame || null;
    } catch (error) {
        return null;
    }
}

function shouldRefetchOnionDetail(entry, hint) {
    if (!entry) return true;
    // Если в таймлайне уже есть превью — этого достаточно для onion-skin,
    // не тратим лишний запрос на detail.
    if (hint && hint.previewUrl) return false;
    if (!entry.didFetchDetail) return true;
    return false;
}

function ensureOnionFrameImage(frameIndex) {
    const entry = getOnionCacheEntry(frameIndex);
    if (!entry) return;

    const timelineFrame = getTimelineFrameByIndex(entry.index);
    const hint = {
        previewUrl: timelineFrame && timelineFrame.preview_url ? timelineFrame.preview_url : '',
        updatedAt: timelineFrame && timelineFrame.updated_at ? timelineFrame.updated_at : '',
    };

    // Подтягиваем значения из таймлайна (быстрее, чем API).
    // Если они меняются — сбрасываем изображение, чтобы перезагрузить.
    if (hint.previewUrl && hint.previewUrl !== entry.previewUrl) {
        entry.previewUrl = hint.previewUrl;
        entry.image = null;
        entry.imagePromise = null;
        entry.imageUrl = '';
    }
    if (hint.updatedAt && hint.updatedAt !== entry.updatedAt) {
        entry.updatedAt = hint.updatedAt;
        entry.image = null;
        entry.imagePromise = null;
        entry.imageUrl = '';
    }

    if (shouldRefetchOnionDetail(entry, hint)) {
        if (entry.detailPromise) return;
        entry.detailPromise = fetchOnionFrameDetail(entry.index)
            .then((frame) => {
                if (frame) {
                    entry.previewUrl = frame.preview_url || entry.previewUrl || '';
                    entry.updatedAt = frame.updated_at || entry.updatedAt || '';
                }
                return frame;
            })
            .catch(() => null)
            .finally(() => {
                entry.didFetchDetail = true;
                entry.detailPromise = null;
            });
        entry.detailPromise.then(() => {
            // после получения detail пробуем догрузить изображение
            ensureOnionFrameImage(entry.index);
        });
        return;
    }

    if (!entry.previewUrl) {
        entry.image = null;
        entry.imageUrl = '';
        requestOnionSkinRender();
        return;
    }

    const desiredUrl = buildOnionPreviewImageUrl(entry.previewUrl, entry.updatedAt);
    if (!desiredUrl) return;

    if (entry.image
        && entry.imageUrl === desiredUrl
        && entry.image.complete
        && entry.image.naturalWidth > 0) {
        return;
    }
    if (entry.imagePromise && entry.imageUrl === desiredUrl) {
        return;
    }

    const expectedUrl = desiredUrl;
    entry.imageUrl = expectedUrl;
    entry.imagePromise = new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            if (entry.imageUrl !== expectedUrl) {
                resolve(false);
                return;
            }
            entry.image = img;
            entry.imagePromise = null;
            resolve(true);
            requestOnionSkinRender();
        };
        img.onerror = () => {
            if (entry.imageUrl !== expectedUrl) {
                resolve(false);
                return;
            }
            entry.image = null;
            entry.imagePromise = null;
            resolve(false);
            requestOnionSkinRender();
        };
        img.src = expectedUrl;
    });
}

function resetOnionFrameCache(options = {}) {
    onionFrameCache.clear();
    if (options.clearCanvas !== false) {
        clearOnionCanvases();
    }
}

function prefetchOnionFramesForCurrent() {
    if (!onionEnabled || onionSuppressed) return;
    const { prev, next } = getOnionNeighborFrameIndices();

    if (shouldShowOnionPrev()) {
        prev.forEach((index) => ensureOnionFrameImage(index));
    }
    if (shouldShowOnionNext()) {
        next.forEach((index) => ensureOnionFrameImage(index));
    }
}

function requestOnionSkinRender() {
    if (!onionEnabled || onionSuppressed) return;
    if (onionRenderRequestId) return;
    onionRenderRequestId = requestAnimationFrame(() => {
        onionRenderRequestId = null;
        renderOnionSkin();
    });
}

function drawOnionFrames(targetCtx, indices, opacityPercent) {
    if (!targetCtx) return;
    const alpha = clamp(Number(opacityPercent) || 0, 0, 100) / 100;
    if (!alpha) return;

    targetCtx.save();
    targetCtx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    targetCtx.globalAlpha = alpha;

    indices.forEach((frameIndex) => {
        const entry = onionFrameCache.get(frameIndex);
        const img = entry && entry.image ? entry.image : null;
        if (!img || !img.complete || img.naturalWidth <= 0) return;
        targetCtx.drawImage(img, 0, 0);
    });

    targetCtx.restore();
}

function renderOnionSkin() {
    if (!onionEnabled || onionSuppressed) return;
    if (!onionPrevCanvas && !onionNextCanvas) return;

    const { prev, next } = getOnionNeighborFrameIndices();
    const prevOrder = [...prev].reverse(); // дальние → ближние
    const nextOrder = [...next].reverse(); // дальние → ближние

    if (shouldShowOnionPrev() && onionPrevCtx && onionPrevCanvas && !onionPrevCanvas.hidden) {
        clearCanvas(onionPrevCtx, onionPrevCanvas);
        drawOnionFrames(onionPrevCtx, prevOrder, onionOpacityPrev);
    }

    if (shouldShowOnionNext() && onionNextCtx && onionNextCanvas && !onionNextCanvas.hidden) {
        clearCanvas(onionNextCtx, onionNextCanvas);
        drawOnionFrames(onionNextCtx, nextOrder, onionOpacityNext);
    }
}

function onionSkinNotifyFrameUpdated(framePayload) {
    if (!framePayload) return;
    const frameIndex = Number(framePayload.index);
    if (!Number.isFinite(frameIndex) || frameIndex <= 0) return;

    const entry = getOnionCacheEntry(frameIndex);
    if (!entry) return;

    const nextPreview = framePayload.preview_url || '';
    const nextUpdatedAt = framePayload.updated_at || '';

    const didChange = (nextPreview && nextPreview !== entry.previewUrl)
        || (nextUpdatedAt && nextUpdatedAt !== entry.updatedAt);

    if (nextPreview) entry.previewUrl = nextPreview;
    if (nextUpdatedAt) entry.updatedAt = nextUpdatedAt;
    if (didChange) {
        entry.image = null;
        entry.imagePromise = null;
        entry.imageUrl = '';
    }
    entry.didFetchDetail = true;

    if (onionEnabled && !onionSuppressed) {
        ensureOnionFrameImage(frameIndex);
        requestOnionSkinRender();
    }
}

function bindOnionSkinEvents() {
    if (!onionToggleButton) return;

    onionToggleButton.addEventListener('click', () => {
        setOnionEnabled(!onionEnabled);
    });

    if (onionCloseButton) {
        onionCloseButton.addEventListener('click', () => {
            setOnionEnabled(false);
        });
    }

    if (onionCountInput) {
        onionCountInput.addEventListener('input', () => {
            onionFrameCount = coerceIntInRange(onionCountInput.value, 1, 3, onionFrameCount);
            updateOnionSkinValueLabels();
            storeOnionSkinSettings();
            prefetchOnionFramesForCurrent();
            requestOnionSkinRender();
        });
    }

    if (onionOpacityPrevInput) {
        onionOpacityPrevInput.addEventListener('input', () => {
            onionOpacityPrev = coerceIntInRange(onionOpacityPrevInput.value, 0, 100, onionOpacityPrev);
            updateOnionSkinValueLabels();
            storeOnionSkinSettings();
            requestOnionSkinRender();
        });
    }

    if (onionOpacityNextInput) {
        onionOpacityNextInput.addEventListener('input', () => {
            onionOpacityNext = coerceIntInRange(onionOpacityNextInput.value, 0, 100, onionOpacityNext);
            updateOnionSkinValueLabels();
            storeOnionSkinSettings();
            requestOnionSkinRender();
        });
    }

    if (onionModePrevInput) {
        onionModePrevInput.addEventListener('change', () => {
            if (!onionModePrevInput.checked) return;
            onionMode = 'prev';
            syncOnionUI();
            storeOnionSkinSettings();
            prefetchOnionFramesForCurrent();
            requestOnionSkinRender();
        });
    }
    if (onionModeNextInput) {
        onionModeNextInput.addEventListener('change', () => {
            if (!onionModeNextInput.checked) return;
            onionMode = 'next';
            syncOnionUI();
            storeOnionSkinSettings();
            prefetchOnionFramesForCurrent();
            requestOnionSkinRender();
        });
    }
    if (onionModeBothInput) {
        onionModeBothInput.addEventListener('change', () => {
            if (!onionModeBothInput.checked) return;
            onionMode = 'both';
            syncOnionUI();
            storeOnionSkinSettings();
            prefetchOnionFramesForCurrent();
            requestOnionSkinRender();
        });
    }

    // Поддержка "playback": пока в проекте нет явного плеера, но слушаем события на будущее.
    window.addEventListener('anim-playback-start', () => setOnionSuppressed(true));
    window.addEventListener('anim-playback-stop', () => setOnionSuppressed(false));
    window.addEventListener('anim-playback', (event) => {
        const playing = Boolean(event && event.detail && event.detail.playing);
        setOnionSuppressed(playing);
    });
}

function initOnionSkin() {
    if (!onionToggleButton || !onionPanel) return;
    loadOnionSkinSettings();
    onionEnabled = false;
    syncOnionUI();
    bindOnionSkinEvents();
    bindOnionPanelDrag();
}

function renderTimelineFrames() {
    if (!timelineStrip) return;

    const previousScroll = timelineStrip.scrollLeft;
    timelineStrip.innerHTML = '';

    timelineFrames.forEach((frame) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'timeline-frame';
        if (frame.index === currentFrameIndex) {
            button.classList.add('timeline-frame--active');
        }
        button.dataset.frameId = String(frame.id);
        button.dataset.frameIndex = String(frame.index);
        button.draggable = true;
        button.title = `Кадр ${frame.index}`;

        const number = document.createElement('span');
        number.className = 'timeline-frame__number';
        number.textContent = String(frame.index);
        button.appendChild(number);

        if (frame.preview_url) {
            const img = document.createElement('img');
            img.className = 'timeline-frame__img';
            img.alt = `Кадр ${frame.index}`;
            img.src = normalizeAssetUrl(frame.preview_url);
            img.onerror = () => {
                img.remove();
                if (!button.querySelector('.timeline-frame__placeholder')) {
                    const placeholder = document.createElement('span');
                    placeholder.className = 'timeline-frame__placeholder';
                    placeholder.textContent = String(frame.index);
                    button.appendChild(placeholder);
                }
            };
            button.appendChild(img);
        } else {
            const placeholder = document.createElement('span');
            placeholder.className = 'timeline-frame__placeholder';
            placeholder.textContent = String(frame.index);
            button.appendChild(placeholder);
        }

        timelineStrip.appendChild(button);
    });

    timelineStrip.scrollLeft = previousScroll;
    setTimelineControlsDisabled(isSwitchingFrame || isSaving || isAutosaving);
    if (deleteFrameButton) {
        deleteFrameButton.disabled = Boolean(isSwitchingFrame || isSaving || isAutosaving);
    }
}

function setActiveTimelineIndex(frameIndex) {
    if (!timelineStrip) return;
    timelineStrip.querySelectorAll('.timeline-frame').forEach((el) => {
        const idx = Number(el.dataset.frameIndex);
        if (idx === frameIndex) {
            el.classList.add('timeline-frame--active');
        } else {
            el.classList.remove('timeline-frame--active');
        }
    });
}

function updateTimelineFramePreview(framePayload) {
    if (!framePayload) return;

    const frameId = Number(framePayload.id);
    const frameIndex = Number(framePayload.index);
    const previewUrl = framePayload.preview_url || '';
    const updatedAt = framePayload.updated_at || '';

    const stored = Number.isFinite(frameId) ? getTimelineFrameById(frameId) : null;
    const storedByIndex = stored || (Number.isFinite(frameIndex) ? getTimelineFrameByIndex(frameIndex) : null);
    if (storedByIndex) {
        storedByIndex.preview_url = previewUrl || storedByIndex.preview_url || '';
        storedByIndex.updated_at = updatedAt || storedByIndex.updated_at || '';
        if (Number.isFinite(frameIndex) && frameIndex > 0) {
            storedByIndex.index = frameIndex;
        }
    }

    if (!timelineStrip) return;
    const selector = Number.isFinite(frameId) ? `.timeline-frame[data-frame-id="${frameId}"]` : null;
    const el = selector ? timelineStrip.querySelector(selector) : null;
    if (!el) {
        renderTimelineFrames();
        return;
    }

    if (Number.isFinite(frameIndex) && frameIndex > 0) {
        el.dataset.frameIndex = String(frameIndex);
        const badge = el.querySelector('.timeline-frame__number');
        if (badge) badge.textContent = String(frameIndex);
    }

    if (previewUrl) {
        const normalized = normalizeAssetUrl(previewUrl);
        const cacheBusted = `${normalized}${normalized.includes('?') ? '&' : '?'}v=${Date.now()}`;
        let img = el.querySelector('img.timeline-frame__img');
        if (!img) {
            img = document.createElement('img');
            img.className = 'timeline-frame__img';
            img.alt = `Кадр ${frameIndex || ''}`.trim();
            const placeholder = el.querySelector('.timeline-frame__placeholder');
            if (placeholder) placeholder.remove();
            el.appendChild(img);
        }
        img.src = cacheBusted;
        img.onerror = () => {
            img.remove();
            if (!el.querySelector('.timeline-frame__placeholder')) {
                const placeholder = document.createElement('span');
                placeholder.className = 'timeline-frame__placeholder';
                placeholder.textContent = String(frameIndex || '');
                el.appendChild(placeholder);
            }
        };
    }

    onionSkinNotifyFrameUpdated(framePayload);
}

async function loadTimelineFrames() {
    if (!framesListUrl) return;
    try {
        const response = await fetch(framesListUrl, { credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Не удалось загрузить кадры.');
        }
        timelineFrames = Array.isArray(data.frames) ? data.frames : [];
        syncCurrentFrameIdFromTimeline();
        renderTimelineFrames();
    } catch (error) {
        console.error('Ошибка загрузки таймлайна', error);
    }
}

async function loadFrameByIndex(targetIndex) {
    const index = Number(targetIndex);
    if (!Number.isFinite(index) || index <= 0) return false;

    const url = getFrameDetailUrl(index);
    if (!url) return false;

    isSwitchingFrame = true;
    setTimelineControlsDisabled(true);

    try {
        const response = await fetch(url, { credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Не удалось загрузить кадр.');
        }

        currentFrameIndex = index;
        currentFrameId = data.frame && data.frame.id ? Number(data.frame.id) : currentFrameId;

        const hasPersistedData = Boolean(data.frame && (data.frame.preview_url || data.frame.content_json));
        currentFramePreviewUrl = (data.frame && data.frame.preview_url) ? data.frame.preview_url : '';
        currentFrameUpdatedAt = hasPersistedData && data.frame && data.frame.updated_at ? data.frame.updated_at : '';

        didInitBackground = false;
        clearSelection();
        cancelPendingHistory();
        hasUnsavedChanges = false;
        lastSavedAt = null;

        if (Array.isArray(data.layers)) {
            mergeLayerList(data.layers);
        } else {
            await loadLayers();
        }

        initSaveState();
        hydrateSavedFrame();
        fillBackgroundLayerIfNeeded();

        setActiveTimelineIndex(currentFrameIndex);
        updateSaveButtonState();
        updateHistoryPanel();
        prefetchOnionFramesForCurrent();
        requestOnionSkinRender();
        return true;
    } catch (error) {
        console.error('Ошибка загрузки кадра', error);
        setSaveStatus('Не удалось загрузить кадр', 'error');
        setSaveIndicator('error');
        return false;
    } finally {
        isSwitchingFrame = false;
        setTimelineControlsDisabled(false);
        renderTimelineFrames();
    }
}

async function switchToFrameIndex(targetIndex) {
    const index = Number(targetIndex);
    if (!Number.isFinite(index) || index <= 0) return;
    if (index === currentFrameIndex) return;
    if (isSwitchingFrame) return;

    setTimelineControlsDisabled(true);
    const savedOk = await saveCurrentFrame();
    if (!savedOk && hasUnsavedChanges) {
        setTimelineControlsDisabled(false);
        return;
    }
    await loadFrameByIndex(index);
}

async function createFrameOnServer(options = {}) {
    if (!frameCreateUrl) return;
    if (isSwitchingFrame) return;

    setTimelineControlsDisabled(true);

    const shouldDuplicate = Boolean(options.duplicate);
    const savedOk = await saveCurrentFrame();
    if (!savedOk && hasUnsavedChanges) {
        setTimelineControlsDisabled(false);
        return;
    }

    try {
        const payload = shouldDuplicate ? { duplicate_from_index: currentFrameIndex } : {};
        const response = await fetch(frameCreateUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Не удалось создать кадр.');
        }

        timelineFrames = Array.isArray(data.frames) ? data.frames : timelineFrames;
        currentFrameIndex = Number(data.active_index) || currentFrameIndex;
        currentFrameId = data.frame && data.frame.id ? Number(data.frame.id) : currentFrameId;
        renderTimelineFrames();
        await loadFrameByIndex(currentFrameIndex);
    } catch (error) {
        console.error('Ошибка создания кадра', error);
        setSaveStatus('Не удалось создать кадр', 'error');
        setSaveIndicator('error');
    } finally {
        setTimelineControlsDisabled(false);
    }
}

async function deleteCurrentFrameOnServer() {
    if (isSwitchingFrame) return;
    const deleteUrl = getFrameDeleteUrl(currentFrameIndex);
    if (!deleteUrl) return;

    const confirmDelete = window.confirm(`Удалить кадр ${currentFrameIndex}?`);
    if (!confirmDelete) return;

    setTimelineControlsDisabled(true);

    const savedOk = await saveCurrentFrame();
    if (!savedOk && hasUnsavedChanges) {
        setTimelineControlsDisabled(false);
        return;
    }

    try {
        const response = await fetch(deleteUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({}),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Не удалось удалить кадр.');
        }

        timelineFrames = Array.isArray(data.frames) ? data.frames : [];
        const nextIndex = Number(data.active_index) || 1;
        currentFrameId = null;
        resetOnionFrameCache();
        renderTimelineFrames();
        await loadFrameByIndex(nextIndex);
    } catch (error) {
        console.error('Ошибка удаления кадра', error);
        setSaveStatus('Не удалось удалить кадр', 'error');
        setSaveIndicator('error');
    } finally {
        setTimelineControlsDisabled(false);
    }
}

async function saveFrameOrder(orderedIds) {
    if (!frameReorderUrl) return;
    if (!Array.isArray(orderedIds) || orderedIds.length < 2) return;

    try {
        const response = await fetch(frameReorderUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ ordered_ids: orderedIds }),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Не удалось сохранить порядок кадров.');
        }

        const activeId = currentFrameId;
        timelineFrames = Array.isArray(data.frames) ? data.frames : timelineFrames;
        if (activeId) {
            const activeFrame = getTimelineFrameById(activeId);
            if (activeFrame) {
                currentFrameIndex = activeFrame.index;
            }
        }
        resetOnionFrameCache();
        renderTimelineFrames();
        setActiveTimelineIndex(currentFrameIndex);
        prefetchOnionFramesForCurrent();
        requestOnionSkinRender();
    } catch (error) {
        console.error('Ошибка сохранения порядка кадров', error);
    }
}

function bindTimelineEvents() {
    if (addFrameButton) {
        addFrameButton.addEventListener('click', () => {
            createFrameOnServer({ duplicate: false });
        });
    }

    if (duplicateFrameButton) {
        duplicateFrameButton.addEventListener('click', () => {
            createFrameOnServer({ duplicate: true });
        });
    }

    if (deleteFrameButton) {
        deleteFrameButton.addEventListener('click', () => {
            deleteCurrentFrameOnServer();
        });
    }

    if (!timelineStrip) return;

    timelineStrip.addEventListener('click', (event) => {
        const item = event.target.closest('.timeline-frame');
        if (!item) return;
        const index = Number(item.dataset.frameIndex);
        if (!Number.isFinite(index) || index <= 0) return;
        switchToFrameIndex(index);
    });

    timelineStrip.addEventListener('dragstart', (event) => {
        const item = event.target.closest('.timeline-frame');
        if (!item) return;
        dragFrameId = Number(item.dataset.frameId);
        item.classList.add('is-dragging');
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
    });

    timelineStrip.addEventListener('dragend', (event) => {
        const item = event.target.closest('.timeline-frame');
        if (item) {
            item.classList.remove('is-dragging');
        }
        dragFrameId = null;
    });

    timelineStrip.addEventListener('dragover', (event) => {
        event.preventDefault();
        const dragging = timelineStrip.querySelector('.timeline-frame.is-dragging');
        const target = event.target.closest('.timeline-frame');
        if (!dragging || !target || dragging === target) return;
        const rect = target.getBoundingClientRect();
        const shouldInsertBefore = event.clientX < rect.left + rect.width / 2;
        if (shouldInsertBefore) {
            timelineStrip.insertBefore(dragging, target);
        } else {
            timelineStrip.insertBefore(dragging, target.nextSibling);
        }
    });

    timelineStrip.addEventListener('drop', (event) => {
        event.preventDefault();
        const orderedIds = [...timelineStrip.querySelectorAll('.timeline-frame')]
            .map((item) => Number(item.dataset.frameId))
            .filter((value) => Number.isFinite(value));
        saveFrameOrder(orderedIds);
    });
}

function flattenLayers() {
    if (!canvas || !layers.length) return null;
    if (!flattenCanvas) {
        flattenCanvas = document.createElement('canvas');
    }
    if (flattenCanvas.width !== canvas.width) {
        flattenCanvas.width = canvas.width;
    }
    if (flattenCanvas.height !== canvas.height) {
        flattenCanvas.height = canvas.height;
    }
    if (!flattenCtx) {
        flattenCtx = flattenCanvas.getContext('2d');
    }
    if (!flattenCtx) return null;

    flattenCtx.setTransform(1, 0, 0, 1, 0, 0);
    flattenCtx.clearRect(0, 0, flattenCanvas.width, flattenCanvas.height);

    const ordered = [...layers].sort((a, b) => {
        if (a.order !== b.order) {
            return a.order - b.order;
        }
        return a.id - b.id;
    });

    const activeCompositeCanvas = hasFloatingSelection() ? getActiveLayerCompositeCanvas() : null;
    ordered.forEach((layer) => {
        if (!layer.visible) return;
        const sourceCanvas = (activeCompositeCanvas && layer.id === activeLayerId)
            ? activeCompositeCanvas
            : layer.bufferCanvas;
        if (!sourceCanvas) return;
        flattenCtx.globalAlpha = clamp(layer.opacity, 0, 100) / 100;
        flattenCtx.drawImage(sourceCanvas, 0, 0);
    });
    flattenCtx.globalAlpha = 1;
    return flattenCanvas.toDataURL('image/png');
}

function drawImageOnLayer(layer, image, options = {}) {
    if (!layer || !layer.bufferCtx || !layer.bufferCanvas) return;
    clearCanvas(layer.bufferCtx, layer.bufferCanvas);
    if (options.fillWhite) {
        layer.bufferCtx.fillStyle = '#ffffff';
        layer.bufferCtx.fillRect(0, 0, layer.bufferCanvas.width, layer.bufferCanvas.height);
    }
    layer.bufferCtx.drawImage(image, 0, 0, layer.bufferCanvas.width, layer.bufferCanvas.height);
    renderScene();
}

function hydrateSavedFrame() {
    if (!canvas || !layers.length) return;

    const savedAt = parseSavedDate(currentFrameUpdatedAt);
    if (savedAt) {
        lastSavedAt = savedAt;
    }

    if (!currentFramePreviewUrl) {
        if (lastSavedAt) {
            setSaveIndicator('saved');
            setSaveStatus('Сохранено', 'saved');
            updateLastSavedLabel();
        }
        return;
    }

    const image = new Image();
    image.onload = () => {
        const backgroundLayer = getBackgroundLayer();
        if (backgroundLayer) {
            drawImageOnLayer(backgroundLayer, image);
        }
        if (!lastSavedAt) {
            lastSavedAt = new Date();
        }
        setSaveIndicator('saved');
        setSaveStatus('Сохранено', 'saved');
        updateLastSavedLabel();
        updateSaveButtonState();
        ensureHistoryBaseline();
    };
    image.onerror = () => {
        console.warn('Не удалось загрузить сохраненный кадр');
        setSaveIndicator('error');
        setSaveStatus('Не удалось загрузить сохраненный кадр', 'error');
        ensureHistoryBaseline();
    };
    image.src = normalizeAssetUrl(currentFramePreviewUrl);
}

/**
 * Собираем данные текущего кадра для сохранения.
 */
function getCurrentFramePayload() {
    const flattened = flattenLayers();
    if (flattened) {
        return { image_data: flattened };
    }
    return null;
}

/**
 * Отправляем текущий кадр на сервер.
 */
async function saveCurrentFrame(options = {}) {
    if (!frameSaveUrlTemplate) {
        setSaveStatus('Не найден адрес сохранения кадра', 'error');
        setSaveIndicator('error');
        return false;
    }

    if (isSaving || isAutosaving) return false;
    if (!hasUnsavedChanges) return true;

    const saveUrl = getFrameSaveUrl(currentFrameIndex);
    if (!saveUrl) {
        setSaveStatus('Не найден адрес сохранения кадра', 'error');
        setSaveIndicator('error');
        return false;
    }

    const payload = getCurrentFramePayload();
    if (!payload) {
        setSaveStatus('Нет данных для сохранения', 'error');
        setSaveIndicator('error');
        return false;
    }

    const isAuto = Boolean(options.isAuto);
    if (isAuto) {
        isAutosaving = true;
    } else {
        isSaving = true;
    }

    updateSaveButtonState();
    setSaveStatus('Идёт сохранение…', 'saving');
    setSaveIndicator('saving');

    try {
        const response = await fetch(saveUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });

        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        if (!response.ok || !data || !data.ok) {
            const errorMessage = data && data.error ? data.error : 'Не удалось сохранить кадр.';
            throw new Error(errorMessage);
        }

        hasUnsavedChanges = false;
        lastSavedAt = new Date();
        if (data.frame) {
            currentFramePreviewUrl = data.frame.preview_url || currentFramePreviewUrl || '';
            currentFrameUpdatedAt = data.frame.updated_at || currentFrameUpdatedAt || '';
            updateTimelineFramePreview(data.frame);
        }
        setSaveStatus('Сохранено', 'saved');
        setSaveIndicator('saved');
        updateLastSavedLabel();
        return true;
    } catch (error) {
        console.error('Ошибка сохранения кадра', error);
        let errorText = 'Не удалось сохранить кадр.';
        if (error instanceof Error && error.message) {
            errorText = error.message;
        }
        if (errorText === 'Failed to fetch') {
            errorText = 'Не удалось связаться с сервером.';
        }
        setSaveStatus(errorText, 'error');
        setSaveIndicator('error');
        return false;
    } finally {
        if (isAuto) {
            isAutosaving = false;
        } else {
            isSaving = false;
        }
        updateSaveButtonState();
    }
}

// =======================
// Привязка событий к Canvas
// =======================

function isTextInputElement(element) {
    if (!element) return false;
    const tag = element.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return true;
    }
    return Boolean(element.isContentEditable);
}

function startPan(event) {
    isPanning = true;
    panStartedByMiddle = Boolean(event && event.button === 1);
    panStartX = event.clientX;
    panStartY = event.clientY;
    panStartOffsetX = offsetX;
    panStartOffsetY = offsetY;
    hideEyedropperZoom();
    hideTransformHint();
    setCanvasCursorOverride(null);
    hoverTransformHandle = null;
    updateCursor();
}

function updatePan(event) {
    if (!isPanning) return;
    const deltaX = event.clientX - panStartX;
    const deltaY = event.clientY - panStartY;
    const { scaleX, scaleY } = getCanvasMetrics();
    offsetX = panStartOffsetX + deltaX * scaleX;
    offsetY = panStartOffsetY + deltaY * scaleY;
    renderScene();
    renderOverlay();
}

function stopPan() {
    if (!isPanning) return;
    isPanning = false;
    panStartedByMiddle = false;
    updateCursor();
}

function handlePointerDown(event) {
    // Средняя кнопка мыши (колёсико): временная панорама без смены инструмента.
    if (event.button === 1) {
        event.preventDefault();
        if (isTransformingSelection) return;
        startPan(event);
        return;
    }

    if (event.button !== 0) return;
    if (isTransformingSelection) return;
    if (isSpacePressed) {
        startPan(event);
        return;
    }
    if (currentTool === TOOL_PAN) {
        if (bufferCtx && bufferCanvas) {
            const { x, y } = getCanvasCoords(event);
            lastPointerX = x;
            lastPointerY = y;
            if (tryStartSelectionTransformAt(x, y, event)) {
                return;
            }
        }
        startPan(event);
        return;
    }
    if (!bufferCtx || !bufferCanvas) {
        return;
    }

    const { x, y } = getCanvasCoords(event);
    lastPointerX = x;
    lastPointerY = y;
    if (currentTool === TOOL_SELECT) {
        logCoordDebug('select-down', event);
        if (selectionMode === SELECT_MAGIC) {
            createMagicWandSelection(x, y);
            return;
        }
        isSelecting = true;
        selectionStartX = x;
        selectionStartY = y;
        selectionDraft = null;
        lassoPoints = [{ x, y }];
        renderOverlay();
        return;
    }

    if (currentTool === TOOL_EYEDROPPER) {
        updateEyedropperZoom(event);
        pickColorAt(x, y);
        hideEyedropperZoom();
        setTool(TOOL_BRUSH);
        return;
    }

    if (selection && !isPointInSelection(x, y, selection)) {
        return;
    }

    if (currentTool === TOOL_FILL) {
        beginLayerHistory(getToolHistoryLabel(TOOL_FILL));
        const didFill = floodFill(x, y);
        if (didFill) {
            markUnsavedChanges();
            commitLayerHistory();
        } else {
            cancelPendingHistory();
        }
        return;
    }

    if (currentTool === TOOL_BRUSH || currentTool === TOOL_ERASER || isShapeTool(currentTool)) {
        startDrawing(x, y, currentTool);
    }
}

function handlePointerMove(event) {
    if (isTransformingSelection) {
        updateSelectionTransform(event);
        return;
    }
    if (isPanning) {
        updatePan(event);
        return;
    }
    const { x, y } = getCanvasCoords(event);
    lastPointerX = x;
    lastPointerY = y;
    if (currentTool === TOOL_EYEDROPPER) {
        updateEyedropperZoom(event);
        return;
    }
    if (isSelecting) {
        if (selectionMode === SELECT_LASSO) {
            const lastPoint = lassoPoints[lassoPoints.length - 1];
            const dx = x - lastPoint.x;
            const dy = y - lastPoint.y;
            if (Math.hypot(dx, dy) >= LASSO_POINT_DISTANCE) {
                lassoPoints.push({ x, y });
                selectionDraft = {
                    type: SELECT_LASSO,
                    points: [...lassoPoints],
                };
                renderOverlay();
            }
        } else {
            const target = getConstrainedSelectionEnd(selectionMode, selectionStartX, selectionStartY, x, y);
            const rect = normalizeRect(selectionStartX, selectionStartY, target.x, target.y);
            if (Math.max(rect.width, rect.height) >= SELECTION_MIN_SIZE) {
                selectionDraft = selectionMode === SELECT_RECT
                    ? buildRectSelection(selectionStartX, selectionStartY, target.x, target.y)
                    : buildEllipseSelection(selectionStartX, selectionStartY, target.x, target.y);
            } else {
                selectionDraft = null;
            }
            renderOverlay();
        }
        return;
    }

    if (!isDrawing) {
        updateSelectionTransformHover(event, x, y);
        return;
    }
    continueDrawing(x, y);
}

function handlePointerUp(event) {
    pendingCanvasStartFromOutside = null;
    if (isTransformingSelection) {
        isTransformingSelection = false;
        hideTransformHint();
        setCanvasCursorOverride(null);
        hoverTransformHandle = null;
        renderScene();
        renderOverlay();
        return;
    }
    if (isPanning) {
        // Если панорама запущена средней кнопкой, останавливаем только при её отпускании.
        if (panStartedByMiddle) {
            const buttons = typeof event.buttons === 'number' ? event.buttons : 0;
            const middleStillDown = (buttons & 4) === 4;
            if (event.button === 1 || !middleStillDown) {
                stopPan();
            }
            return;
        }
        stopPan();
        return;
    }
    if (isSelecting) {
        let nextSelection = null;
        if (selectionMode === SELECT_LASSO) {
            if (lassoPoints.length >= 3) {
                const bounds = getLassoBounds(lassoPoints);
                if (Math.max(bounds.width, bounds.height) >= SELECTION_MIN_SIZE) {
                    nextSelection = {
                        type: SELECT_LASSO,
                        points: [...lassoPoints],
                    };
                }
            }
        } else {
            const endX = Number.isFinite(lastPointerX) ? lastPointerX : selectionStartX;
            const endY = Number.isFinite(lastPointerY) ? lastPointerY : selectionStartY;
            const target = getConstrainedSelectionEnd(selectionMode, selectionStartX, selectionStartY, endX, endY);
            const rect = normalizeRect(selectionStartX, selectionStartY, target.x, target.y);
            if (Math.max(rect.width, rect.height) >= SELECTION_MIN_SIZE) {
                nextSelection = selectionMode === SELECT_RECT
                    ? buildRectSelection(selectionStartX, selectionStartY, target.x, target.y)
                    : buildEllipseSelection(selectionStartX, selectionStartY, target.x, target.y);
            }
        }
        if (nextSelection) {
            selection = nextSelection;
            selectionDashOffset = 0;
        }
        selectionDraft = null;
        lassoPoints = [];
        isSelecting = false;
        renderOverlay();
        if (event) {
            logCoordDebug('select-up', event);
        }
        return;
    }
    if (!isDrawing) return;
    if (isShapeTool(activeTool)) {
        commitShape();
    }
    stopDrawing();
}

function handlePointerLeave() {
    hideEyedropperZoom();
    hideTransformHint();
    setCanvasCursorOverride(null);
    hoverTransformHandle = null;
}

function handleWindowPointerDown(event) {
    if (!event) return;
    if (event.button !== 0) return;

    const target = event.target && event.target.nodeType === 1
        ? event.target
        : (event.target && event.target.parentElement ? event.target.parentElement : null);
    const startedOnCanvas = Boolean(target && target === canvas);

    // Если нажали прямо на canvas — обычный обработчик mousedown на canvas всё сделает сам.
    if (startedOnCanvas) {
        pendingCanvasStartFromOutside = { allow: false };
        return;
    }

    const startedInsideEditor = Boolean(editorRoot && target && editorRoot.contains(target));
    const startedInsideCanvasWrapper = Boolean(canvasWrapper && target && canvasWrapper.contains(target));

    const startedOnOverlayPanel = Boolean(
        (layersPanel && target && layersPanel.contains(target))
        || (historyPanel && target && historyPanel.contains(target))
        || (onionPanel && target && onionPanel.contains(target)),
    );

    const startedOnInteractive = Boolean(
        (target && isTextInputElement(target))
        || (target && target.closest && target.closest('button, a, input, select, textarea, [role="button"]'))
        || (target && target.closest && target.closest('.editor-toolbar, .timeline-wrapper, .editor-header')),
    );

    const allowStart = !startedOnOverlayPanel
        && !startedOnInteractive
        && (startedInsideCanvasWrapper || !startedInsideEditor);

    pendingCanvasStartFromOutside = { allow: allowStart };
}

function tryStartCanvasInteractionFromOutside(event) {
    if (!event || !canvas) return false;
    if (isDrawing || isSelecting || isPanning || isTransformingSelection) return false;
    if (isDraggingLayersPanel || isDraggingHistoryPanel || isDraggingOnionPanel || isOpacityDragging) return false;

    const buttons = typeof event.buttons === 'number' ? event.buttons : 0;
    const leftDown = (buttons & 1) === 1;
    if (!leftDown) {
        pendingCanvasStartFromOutside = null;
        return false;
    }

    // Если mousedown был внутри окна и мы точно знаем, что он был на UI — не стартуем.
    // Если mousedown не поймали (например, старт за пределами окна) — разрешаем.
    if (pendingCanvasStartFromOutside && pendingCanvasStartFromOutside.allow !== true) {
        return false;
    }

    // Стартуем только если под курсором реально canvas (не панель onion/layers/history).
    const topEl = document.elementFromPoint(event.clientX, event.clientY);
    if (topEl !== canvas) return false;

    pendingCanvasStartFromOutside = null;
    handlePointerDown(event);
    return true;
}

function handleWindowPointerMove(event) {
    if (!isDrawing && !isSelecting && !isPanning && !isTransformingSelection) {
        tryStartCanvasInteractionFromOutside(event);
        return;
    }
    handlePointerMove(event);
}

function handleCanvasDoubleClick(event) {
    if (!selection || isSelecting || isPanning || isTransformingSelection) return;
    const { x, y } = getCanvasCoords(event);
    if (!isPointInSelection(x, y, selection)) {
        clearSelection();
    }
}

function handleWheel(event) {
    if (!canvas) return;
    event.preventDefault();

    const before = {
        scale,
        offsetX,
        offsetY,
    };
    const { x: rawX, y: rawY } = getCanvasRawCoords(event);
    const normalizedScale = scale || 1;
    const pointerX = (rawX - offsetX) / normalizedScale;
    const pointerY = (rawY - offsetY) / normalizedScale;

    const direction = event.deltaY < 0 ? SCALE_STEP : 1 / SCALE_STEP;
    const nextScale = clamp(scale * direction, MIN_SCALE, MAX_SCALE);
    if (nextScale === scale) return;

    scale = nextScale;
    offsetX = rawX - pointerX * scale;
    offsetY = rawY - pointerY * scale;

    renderScene();
    renderOverlay();
    logCoordDebug('wheel', event, {
        before,
        after: { scale, offsetX, offsetY },
    });
}

function pasteExternalImage(image, options = {}) {
    if (!image || !bufferCtx || !bufferCanvas) return false;

    let centerX = bufferCanvas.width / 2;
    let centerY = bufferCanvas.height / 2;
    if (Number.isFinite(lastPointerX)) centerX = lastPointerX;
    if (Number.isFinite(lastPointerY)) centerY = lastPointerY;

    const naturalWidth = image.naturalWidth || image.width || 0;
    const naturalHeight = image.naturalHeight || image.height || 0;
    if (!naturalWidth || !naturalHeight) return false;

    beginLayerHistory('paste_image');

    const fitScale = Math.min(
        1,
        bufferCanvas.width / naturalWidth,
        bufferCanvas.height / naturalHeight,
    );
    const drawWidth = naturalWidth * fitScale;
    const drawHeight = naturalHeight * fitScale;

    const pasteX = centerX - drawWidth / 2;
    const pasteY = centerY - drawHeight / 2;

    if (selection && selection.type === SELECT_MAGIC && selection.maskCanvas) {
        if (!ensureSelectionScratchCanvas()) {
            cancelPendingHistory();
            return false;
        }
        clearCanvas(selectionScratchCtx, selectionScratchCanvas);
        selectionScratchCtx.drawImage(image, pasteX, pasteY, drawWidth, drawHeight);
        selectionScratchCtx.globalCompositeOperation = 'destination-in';
        selectionScratchCtx.drawImage(selection.maskCanvas, 0, 0);
        selectionScratchCtx.globalCompositeOperation = 'source-over';
        bufferCtx.drawImage(selectionScratchCanvas, 0, 0);
    } else {
        bufferCtx.save();
        if (selection) {
            appendSelectionPath(bufferCtx, selection);
            bufferCtx.clip();
        }
        bufferCtx.drawImage(image, pasteX, pasteY, drawWidth, drawHeight);
        bufferCtx.restore();
    }

    renderScene();
    markUnsavedChanges();

    const shouldSelectPasted = options.selectPasted !== false;
    if (shouldSelectPasted && !selection) {
        selection = buildRectSelection(pasteX, pasteY, pasteX + drawWidth, pasteY + drawHeight);
        selectionDashOffset = 0;
        updateSelectionAnimationState();
    }
    renderOverlay();
    commitLayerHistory();
    return true;
}

function pasteImageFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
        URL.revokeObjectURL(url);
        pasteExternalImage(image, { selectPasted: true });
    };
    image.onerror = () => {
        URL.revokeObjectURL(url);
        console.warn('Не удалось вставить изображение из буфера обмена.');
    };
    image.src = url;
}

function handlePaste(event) {
    if (!event) return;
    if (isTextInputElement(event.target)) return;
    if (!bufferCtx || !bufferCanvas) return;

    const data = event.clipboardData;
    const items = data && data.items ? [...data.items] : [];

    const imageItem = items.find((item) => item.kind === 'file' && item.type && item.type.startsWith('image/'));
    if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
            event.preventDefault();
            pasteImageFile(file);
        }
        return;
    }

    if (selectionClipboard) {
        event.preventDefault();
        pasteSelectionFromClipboard();
    }
}

function handleKeyDown(event) {
    if (isExportModalOpen()) {
        if (event.code === 'Escape') {
            event.preventDefault();
            closeExportModal();
        }
        return;
    }

    const isCtrl = event.ctrlKey || event.metaKey;
    if (isCtrl && event.code === 'KeyZ') {
        if (!isTextInputElement(event.target)) {
            event.preventDefault();
            if (event.shiftKey) {
                redoHistory();
            } else {
                undoHistory();
            }
        }
        return;
    }
    if (isCtrl && event.code === 'KeyY') {
        if (!isTextInputElement(event.target)) {
            event.preventDefault();
            redoHistory();
        }
        return;
    }
    if (isCtrl && event.code === 'KeyC') {
        if (!isTextInputElement(event.target)) {
            event.preventDefault();
            copySelectionToClipboard();
        }
        return;
    }
    if (isCtrl && event.code === 'KeyX') {
        if (!isTextInputElement(event.target)) {
            event.preventDefault();
            cutSelectionToClipboard();
        }
        return;
    }
    if (isCtrl && event.code === 'KeyD') {
        if (!isTextInputElement(event.target)) {
            event.preventDefault();
            if (selection) {
                clearSelection();
            }
        }
        return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        isShiftPressed = true;
    }
    if (event.code !== 'Space') return;
    if (isTextInputElement(event.target)) return;
    event.preventDefault();
    if (!isSpacePressed) {
        isSpacePressed = true;
        updateCursor();
    }
}

function handleKeyUp(event) {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        isShiftPressed = false;
    }
    if (event.code !== 'Space') return;
    if (!isSpacePressed) return;
    isSpacePressed = false;
    updateCursor();
}

/**
 * Навешиваем обработчики мыши на canvas
 */
function bindCanvasEvents() {
    if (!canvas) return;

    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('mouseup', handlePointerUp);
    canvas.addEventListener('mouseleave', handlePointerLeave);
    canvas.addEventListener('dblclick', handleCanvasDoubleClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('mousemove', handleWindowPointerMove);
    window.addEventListener('mousedown', handleWindowPointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('paste', handlePaste);
}

// =======================
// Привязка UI элементов панели инструментов
// =======================

/**
 * Навешиваем обработчики на кнопки инструментов
 * и контролы цвета/размера
 */
function bindToolbarEvents() {
    if (toolbar) {
        toolbar.addEventListener('click', (event) => {
            const button = event.target.closest('[data-tool], [data-select-mode]');
            if (!button) return;

            const toolName = button.dataset.tool;
            const modeName = button.dataset.selectMode;

            if (toolName && TOOL_SET.has(toolName)) {
                setTool(toolName);
            } else if (modeName) {
                setSelectionMode(modeName);
                setTool(TOOL_SELECT);
            }
        });
    }

    if (colorInput) {
        colorInput.addEventListener('input', (event) => {
            setColor(event.target.value);
        });
    }

    if (sizeInput) {
        sizeInput.addEventListener('input', (event) => {
            const value = parseInt(event.target.value, 10) || 1;
            setBrushSize(value);
        });
    }

    if (wandSensitivityInput) {
        wandSensitivityInput.addEventListener('input', (event) => {
            const value = parseInt(event.target.value, 10);
            if (!Number.isNaN(value)) {
                wandTolerance = clamp(value, 0, 255);
            }
        });
    }
}

// =======================
// Привязка UI слоёв
// =======================

function bindLayerEvents() {
    if (addLayerButton) {
        addLayerButton.addEventListener('click', () => {
            createLayer();
        });
    }

    if (!layersList) return;

    layersList.addEventListener('pointerdown', (event) => {
        if (event.target.matches('input[type="range"]')) {
            isOpacityDragging = true;
            beginFullHistory('layer_opacity_action');
        }
    });

    layersList.addEventListener('click', async (event) => {
        const actionTarget = event.target.closest('[data-action]');
        const action = actionTarget ? actionTarget.dataset.action : null;
        const item = event.target.closest('.layer-item');
        if (!item) return;
        const layerId = Number(item.dataset.layerId);
        const layer = getLayerById(layerId);
        if (!layer) return;

        if (action === 'toggle-visibility') {
            const nextVisible = !layer.visible;
            const historyLabel = nextVisible ? 'layer_show_action' : 'layer_hide_action';
            beginFullHistory(historyLabel);
            const updated = await updateLayer(layerId, { visible: nextVisible });
            if (updated) {
                layer.visible = updated.visible;
                applyLayerStyles(layer);
                renderLayerList();
                commitFullHistory();
            } else {
                cancelPendingHistory();
            }
            return;
        }

        if (action === 'rename') {
            layer.isRenaming = true;
            renderLayerList();
            const renameInput = layersList.querySelector(
                `.layer-item[data-layer-id="${layerId}"] [data-action="rename-input"]`,
            );
            if (renameInput) {
                renameInput.focus();
                renameInput.select();
            }
            return;
        }

        if (action === 'rename-cancel') {
            layer.isRenaming = false;
            renderLayerList();
            return;
        }

        if (action === 'rename-save') {
            const input = item.querySelector('[data-action="rename-input"]');
            const value = input ? input.value.trim() : '';
            if (!value) return;
            beginFullHistory('layer_rename_action');
            const updated = await updateLayer(layerId, { name: value });
            if (updated) {
                layer.name = updated.name;
                layer.isRenaming = false;
                renderLayerList();
                commitFullHistory();
            } else {
                cancelPendingHistory();
            }
            return;
        }

        if (action === 'delete') {
            await deleteLayer(layerId);
            return;
        }

        if (action === 'select-layer' || !action) {
            setActiveLayer(layerId);
        }
    });

    layersList.addEventListener('input', (event) => {
        if (event.target.dataset.action !== 'opacity') return;
        const item = event.target.closest('.layer-item');
        if (!item) return;
        const layerId = Number(item.dataset.layerId);
        const layer = getLayerById(layerId);
        if (!layer) return;
        const value = parseInt(event.target.value, 10);
        if (Number.isNaN(value)) return;
        layer.opacity = clamp(value, 0, 100);
        applyLayerStyles(layer);
    });

    layersList.addEventListener('change', async (event) => {
        if (event.target.dataset.action !== 'opacity') return;
        const item = event.target.closest('.layer-item');
        if (!item) return;
        const layerId = Number(item.dataset.layerId);
        const layer = getLayerById(layerId);
        if (!layer) return;
        const value = parseInt(event.target.value, 10);
        if (Number.isNaN(value)) return;
        const updated = await updateLayer(layerId, { opacity: value });
        if (updated) {
            layer.opacity = updated.opacity;
            applyLayerStyles(layer);
            commitFullHistory();
        } else {
            cancelPendingHistory();
        }
    });

    layersList.addEventListener('dragstart', (event) => {
        if (isOpacityDragging) {
            event.preventDefault();
            return;
        }
        if (event.target.closest('input[type="range"]')) {
            event.preventDefault();
            return;
        }
        const item = event.target.closest('.layer-item');
        if (!item) return;
        dragLayerId = Number(item.dataset.layerId);
        const layer = getLayerById(dragLayerId);
        if (layer && layer.isRenaming) {
            dragLayerId = null;
            return;
        }
        item.classList.add('is-dragging');
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
    });

    layersList.addEventListener('dragend', (event) => {
        const item = event.target.closest('.layer-item');
        if (item) {
            item.classList.remove('is-dragging');
        }
        dragLayerId = null;
    });

    layersList.addEventListener('dragover', (event) => {
        event.preventDefault();
        const dragging = layersList.querySelector('.layer-item.is-dragging');
        const target = event.target.closest('.layer-item');
        if (!dragging || !target || dragging === target) return;
        const rect = target.getBoundingClientRect();
        const shouldInsertBefore = event.clientY < rect.top + rect.height / 2;
        if (shouldInsertBefore) {
            layersList.insertBefore(dragging, target);
        } else {
            layersList.insertBefore(dragging, target.nextSibling);
        }
    });

    layersList.addEventListener('drop', (event) => {
        event.preventDefault();
        beginFullHistory('layer_order');
        const orderedIds = [...layersList.querySelectorAll('.layer-item')]
            .map((item) => Number(item.dataset.layerId))
            .filter((value) => Number.isFinite(value));

        const total = orderedIds.length;
        orderedIds.forEach((id, index) => {
            const layer = getLayerById(id);
            if (layer) {
                layer.order = total - index;
            }
        });
        sortLayersByOrder();
        applyAllLayerStyles();
        renderLayerList();
        saveLayerOrder(orderedIds);
    });

    window.addEventListener('pointerup', () => {
        isOpacityDragging = false;
    });
    window.addEventListener('pointercancel', () => {
        isOpacityDragging = false;
    });
}

function getPanelPositionStorageKey(panelName) {
    const safeName = (typeof panelName === 'string' && panelName.trim())
        ? panelName.trim()
        : 'panel';
    return `${PANEL_POSITION_STORAGE_PREFIX}${safeName}`;
}

const PANEL_POSITION_CONTAINER = 'editor-main';

function loadPanelPosition(panelName) {
    try {
        const raw = window.localStorage.getItem(getPanelPositionStorageKey(panelName));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const left = Number(parsed.left);
        const top = Number(parsed.top);
        const container = typeof parsed.container === 'string' ? parsed.container : null;
        if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
        return { left, top, container };
    } catch (error) {
        return null;
    }
}

function storePanelPosition(panelName, position) {
    if (!position) return;
    try {
        window.localStorage.setItem(getPanelPositionStorageKey(panelName), JSON.stringify({
            left: Math.round(position.left),
            top: Math.round(position.top),
            container: PANEL_POSITION_CONTAINER,
        }));
    } catch (error) {
        // localStorage может быть недоступен (private mode / блокировки) — не падаем
    }
}

function normalizeLoadedPanelPosition(position) {
    if (!position) return { position: null, didMigrate: false };
    if (position.container === PANEL_POSITION_CONTAINER) {
        return { position: { left: position.left, top: position.top }, didMigrate: false };
    }
    // Легаси-значения (до расширения области drag): были относительно `.canvas-wrapper`.
    if (!editorMain || !canvasWrapper) {
        return { position: { left: position.left, top: position.top }, didMigrate: false };
    }
    const mainRect = editorMain.getBoundingClientRect();
    const wrapperRect = canvasWrapper.getBoundingClientRect();
    const migrated = {
        left: (wrapperRect.left - mainRect.left) + position.left,
        top: (wrapperRect.top - mainRect.top) + position.top,
    };
    return { position: migrated, didMigrate: true };
}

function getPanelPositionRelativeToMain(panelEl) {
    if (!panelEl || !editorMain) return null;
    const mainRect = editorMain.getBoundingClientRect();
    const panelRect = panelEl.getBoundingClientRect();
    const left = panelRect.left - mainRect.left;
    const top = panelRect.top - mainRect.top;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left, top };
}

function savePanelPosition(panelName, panelEl) {
    const position = getPanelPositionRelativeToMain(panelEl);
    if (!position) return;
    storePanelPosition(panelName, position);
}

function applyPanelPosition(panelEl, position) {
    if (!panelEl || !editorMain || !position) return;
    const mainRect = editorMain.getBoundingClientRect();
    const panelWidth = panelEl.offsetWidth;
    const panelHeight = panelEl.offsetHeight;
    const maxLeft = Math.max(0, mainRect.width - panelWidth);
    const maxTop = Math.max(0, mainRect.height - panelHeight);
    const nextLeft = clamp(position.left, 0, maxLeft);
    const nextTop = clamp(position.top, 0, maxTop);
    panelEl.style.left = `${nextLeft}px`;
    panelEl.style.top = `${nextTop}px`;
    panelEl.style.right = 'auto';
    panelEl.style.bottom = 'auto';
}

function hydratePanelPositions() {
    if (!editorMain) return;

    const storedLayersPos = loadPanelPosition('layers');
    const normalizedLayers = normalizeLoadedPanelPosition(storedLayersPos);
    if (layersPanel && normalizedLayers.position) {
        applyPanelPosition(layersPanel, normalizedLayers.position);
        if (normalizedLayers.didMigrate) {
            storePanelPosition('layers', normalizedLayers.position);
        }
    }

    const storedHistoryPos = loadPanelPosition('history');
    const normalizedHistory = normalizeLoadedPanelPosition(storedHistoryPos);
    if (historyPanel && normalizedHistory.position) {
        applyPanelPosition(historyPanel, normalizedHistory.position);
        if (normalizedHistory.didMigrate) {
            storePanelPosition('history', normalizedHistory.position);
        }
    }
}

function startLayersPanelDrag(event) {
    if (!layersPanel || !layersPanelHeader || !editorMain) return;
    if (event.button !== 0) return;
    if (event.target.closest('button')) return;
    event.preventDefault();

    const mainRect = editorMain.getBoundingClientRect();
    const panelRect = layersPanel.getBoundingClientRect();
    layersPanelOffsetX = event.clientX - panelRect.left;
    layersPanelOffsetY = event.clientY - panelRect.top;

    const left = panelRect.left - mainRect.left;
    const top = panelRect.top - mainRect.top;
    layersPanel.style.left = `${left}px`;
    layersPanel.style.top = `${top}px`;
    layersPanel.style.right = 'auto';
    layersPanel.style.bottom = 'auto';
    isDraggingLayersPanel = true;
}

function updateLayersPanelDrag(event) {
    if (!isDraggingLayersPanel || !layersPanel || !editorMain) return;
    const mainRect = editorMain.getBoundingClientRect();
    const panelWidth = layersPanel.offsetWidth;
    const panelHeight = layersPanel.offsetHeight;
    const maxLeft = Math.max(0, mainRect.width - panelWidth);
    const maxTop = Math.max(0, mainRect.height - panelHeight);
    const nextLeft = clamp(event.clientX - mainRect.left - layersPanelOffsetX, 0, maxLeft);
    const nextTop = clamp(event.clientY - mainRect.top - layersPanelOffsetY, 0, maxTop);
    layersPanel.style.left = `${nextLeft}px`;
    layersPanel.style.top = `${nextTop}px`;
}

function stopLayersPanelDrag() {
    if (!isDraggingLayersPanel) return;
    isDraggingLayersPanel = false;
    savePanelPosition('layers', layersPanel);
}

function bindLayersPanelDrag() {
    if (!layersPanelHeader) return;
    layersPanelHeader.addEventListener('mousedown', startLayersPanelDrag);
    window.addEventListener('mousemove', updateLayersPanelDrag);
    window.addEventListener('mouseup', stopLayersPanelDrag);
}

function startHistoryPanelDrag(event) {
    if (!historyPanel || !historyPanelHeader || !editorMain) return;
    if (event.button !== 0) return;
    if (event.target.closest('button')) return;
    event.preventDefault();

    const mainRect = editorMain.getBoundingClientRect();
    const panelRect = historyPanel.getBoundingClientRect();
    historyPanelOffsetX = event.clientX - panelRect.left;
    historyPanelOffsetY = event.clientY - panelRect.top;

    const left = panelRect.left - mainRect.left;
    const top = panelRect.top - mainRect.top;
    historyPanel.style.left = `${left}px`;
    historyPanel.style.top = `${top}px`;
    historyPanel.style.right = 'auto';
    historyPanel.style.bottom = 'auto';
    isDraggingHistoryPanel = true;
}

function updateHistoryPanelDrag(event) {
    if (!isDraggingHistoryPanel || !historyPanel || !editorMain) return;
    const mainRect = editorMain.getBoundingClientRect();
    const panelWidth = historyPanel.offsetWidth;
    const panelHeight = historyPanel.offsetHeight;
    const maxLeft = Math.max(0, mainRect.width - panelWidth);
    const maxTop = Math.max(0, mainRect.height - panelHeight);
    const nextLeft = clamp(event.clientX - mainRect.left - historyPanelOffsetX, 0, maxLeft);
    const nextTop = clamp(event.clientY - mainRect.top - historyPanelOffsetY, 0, maxTop);
    historyPanel.style.left = `${nextLeft}px`;
    historyPanel.style.top = `${nextTop}px`;
}

function stopHistoryPanelDrag() {
    if (!isDraggingHistoryPanel) return;
    isDraggingHistoryPanel = false;
    savePanelPosition('history', historyPanel);
}

function bindHistoryPanelDrag() {
    if (!historyPanelHeader) return;
    historyPanelHeader.addEventListener('mousedown', startHistoryPanelDrag);
    window.addEventListener('mousemove', updateHistoryPanelDrag);
    window.addEventListener('mouseup', stopHistoryPanelDrag);
}

// =======================
// Привязка UI сохранения
// =======================

function bindSaveEvents() {
    if (!saveButton) return;

    saveButton.addEventListener('click', () => {
        saveCurrentFrame();
    });
}

// =======================
// Экспорт (модалка)
// =======================

function isExportModalOpen() {
    return Boolean(exportModal && !exportModal.hidden);
}

function setExportError(message) {
    if (!exportErrorLabel) return;
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) {
        exportErrorLabel.textContent = '';
        exportErrorLabel.hidden = true;
        return;
    }
    exportErrorLabel.textContent = text;
    exportErrorLabel.hidden = false;
}

function setExportProgressVisible(visible) {
    if (!exportProgress) return;
    exportProgress.hidden = !visible;
}

function setExportResult(downloadUrl, filename) {
    if (exportResult) {
        exportResult.hidden = !downloadUrl;
    }
    if (exportDownloadLink) {
        exportDownloadLink.href = downloadUrl || '#';
        exportDownloadLink.download = filename || '';
    }
}

function setExportControlsDisabled(disabled) {
    if (exportConfirmButton) exportConfirmButton.disabled = disabled;
    if (exportCancelButton) exportCancelButton.disabled = disabled;
    if (exportModalCloseButton) exportModalCloseButton.disabled = disabled;
    if (exportResolutionSelect) exportResolutionSelect.disabled = disabled;
    if (exportFpsInput) exportFpsInput.disabled = disabled;

    if (exportFormatInputs && exportFormatInputs.forEach) {
        exportFormatInputs.forEach((input) => {
            if (input) input.disabled = disabled;
        });
    }

    if (exportGifInfiniteCheckbox) exportGifInfiniteCheckbox.disabled = disabled;
    if (exportGifLoopCountInput) {
        const infinite = exportGifInfiniteCheckbox ? exportGifInfiniteCheckbox.checked : true;
        exportGifLoopCountInput.disabled = disabled || infinite;
    }
}

function getSelectedExportFormat() {
    if (exportFormatInputs && exportFormatInputs.length) {
        for (const input of exportFormatInputs) {
            if (input && input.checked) {
                return input.value;
            }
        }
    }
    return 'png_zip';
}

function syncGifLoopControls() {
    if (!exportGifLoopCountInput) return;
    const isGif = getSelectedExportFormat() === 'gif';
    if (!isGif) {
        exportGifLoopCountInput.disabled = true;
        return;
    }

    const infinite = exportGifInfiniteCheckbox ? exportGifInfiniteCheckbox.checked : true;
    exportGifLoopCountInput.disabled = infinite;
    if (infinite) {
        exportGifLoopCountInput.value = '0';
    }
}

function updateExportOptionsVisibility() {
    const isGif = getSelectedExportFormat() === 'gif';
    if (exportGifOptions) {
        exportGifOptions.hidden = !isGif;
    }
    syncGifLoopControls();
}

function resetExportModalUi() {
    setExportError('');
    setExportProgressVisible(false);
    setExportResult('', '');
    setExportControlsDisabled(false);
    updateExportOptionsVisibility();
}

function openExportModal() {
    if (!exportModal) return;
    resetExportModalUi();
    exportModal.hidden = false;
    document.body.classList.add('modal-open');
    if (exportFpsInput) {
        exportFpsInput.focus();
        exportFpsInput.select();
    }
}

function closeExportModal() {
    if (!exportModal) return;
    if (isExporting) return;
    exportModal.hidden = true;
    document.body.classList.remove('modal-open');
}

function triggerDownload(url) {
    const safeUrl = typeof url === 'string' ? url.trim() : '';
    if (!safeUrl) return;
    const a = document.createElement('a');
    a.href = safeUrl;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

async function performProjectExport() {
    if (isExporting) return;
    if (!projectExportUrl) {
        setExportError('Не найден адрес экспорта.');
        return;
    }

    const format = getSelectedExportFormat();
    const resolution = exportResolutionSelect ? exportResolutionSelect.value : 'original';
    const fpsRaw = exportFpsInput ? parseInt(exportFpsInput.value, 10) : projectFps;
    if (!Number.isFinite(fpsRaw) || fpsRaw <= 0) {
        setExportError('Укажите корректный FPS (1–60).');
        return;
    }
    const fps = clamp(fpsRaw, 1, 60);
    if (exportFpsInput) {
        exportFpsInput.value = String(fps);
    }

    // Быстрые клиентские подсказки (сервер всё равно проверит).
    const totalFrames = Array.isArray(timelineFrames) ? timelineFrames.length : 0;
    if (format === 'gif' && totalFrames && totalFrames > 250) {
        setExportError(`Слишком много кадров для GIF (${totalFrames}). Рекомендуем PNG‑последовательность.`);
        return;
    }
    if (format === 'png_zip' && totalFrames && totalFrames > 2000) {
        setExportError(`Слишком много кадров для экспорта (${totalFrames}). Уменьшите количество кадров.`);
        return;
    }

    let loopInfinite = true;
    let loopCount = 0;
    if (format === 'gif') {
        loopInfinite = exportGifInfiniteCheckbox ? Boolean(exportGifInfiniteCheckbox.checked) : true;
        loopCount = exportGifLoopCountInput ? parseInt(exportGifLoopCountInput.value, 10) : 0;
        if (!Number.isFinite(loopCount) || loopCount < 0) {
            loopCount = 0;
        }
    }

    isExporting = true;
    setExportError('');
    setExportResult('', '');
    setExportControlsDisabled(true);
    setExportProgressVisible(true);

    try {
        const savedOk = await saveCurrentFrame();
        if (!savedOk && hasUnsavedChanges) {
            throw new Error('Не удалось сохранить текущий кадр перед экспортом.');
        }

        const payload = {
            format,
            resolution,
            fps,
        };
        if (format === 'gif') {
            payload.loop_infinite = loopInfinite;
            payload.loop_count = loopCount;
        }

        const response = await fetch(projectExportUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });

        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        if (!response.ok || !data || !data.ok) {
            const serverMessage = data && (data.message || data.error) ? (data.message || data.error) : '';
            const fallback = 'Не удалось экспортировать.';
            throw new Error(serverMessage || fallback);
        }

        const downloadUrl = data.download_url || '';
        const filename = data.filename || '';
        if (!downloadUrl) {
            throw new Error('Сервер не вернул ссылку для скачивания.');
        }

        setExportProgressVisible(false);
        setExportControlsDisabled(false);
        setExportResult(downloadUrl, filename);
        triggerDownload(downloadUrl);
    } catch (error) {
        console.error('Ошибка экспорта', error);
        let errorText = 'Не удалось экспортировать.';
        if (error instanceof Error && error.message) {
            errorText = error.message;
        }
        if (errorText === 'Failed to fetch') {
            errorText = 'Не удалось связаться с сервером.';
        }
        setExportError(errorText);
    } finally {
        isExporting = false;
        setExportProgressVisible(false);
        setExportControlsDisabled(false);
        updateExportOptionsVisibility();
    }
}

function bindExportEvents() {
    if (!exportButton || !exportModal) return;

    if (exportFpsInput && !exportFpsInput.value) {
        exportFpsInput.value = String(projectFps);
    }
    updateExportOptionsVisibility();

    exportButton.addEventListener('click', () => {
        openExportModal();
    });

    exportModal.addEventListener('click', (event) => {
        const closeTarget = event.target && event.target.closest('[data-export-action="close"]');
        if (closeTarget) {
            closeExportModal();
        }
    });

    if (exportModalCloseButton) {
        exportModalCloseButton.addEventListener('click', () => closeExportModal());
    }
    if (exportCancelButton) {
        exportCancelButton.addEventListener('click', () => closeExportModal());
    }
    if (exportConfirmButton) {
        exportConfirmButton.addEventListener('click', () => performProjectExport());
    }

    if (exportFormatInputs && exportFormatInputs.forEach) {
        exportFormatInputs.forEach((input) => {
            if (!input) return;
            input.addEventListener('change', () => {
                updateExportOptionsVisibility();
                setExportError('');
                setExportResult('', '');
            });
        });
    }

    if (exportGifInfiniteCheckbox) {
        exportGifInfiniteCheckbox.addEventListener('change', () => {
            syncGifLoopControls();
        });
    }
}

// =======================
// Автосохранение и таймеры
// =======================

function startAutosave() {
    if (autosaveTimerId) {
        clearInterval(autosaveTimerId);
    }

    autosaveTimerId = setInterval(() => {
        if (!hasUnsavedChanges || isSaving || isAutosaving) return;
        saveCurrentFrame({ isAuto: true });
    }, AUTOSAVE_INTERVAL_MS);
}

function startLastSavedTicker() {
    if (lastSavedTickerId) {
        clearInterval(lastSavedTickerId);
    }

    lastSavedTickerId = setInterval(() => {
        updateLastSavedLabel();
    }, LAST_SAVED_TICK_MS);
}

// =======================
// Инициализация редактора
// =======================

/**
 * Главная точка входа
 * Настраиваем canvas и панель инструментов
 */
async function initEditor() {
    if (!canvas || !overlayCanvas) {
        console.warn('Canvas редактора не найден');
        return;
    }

    syncCanvasSizes();
    hydratePanelPositions();
    await loadLayers();
    bindTimelineEvents();
    await loadTimelineFrames();
    initOnionSkin();
    syncEditorLayout();
    fillBackgroundLayerIfNeeded();

    // устанавливаем стартовые значения
    setTool(currentTool);
    setColor(currentColor);
    setBrushSize(currentSize);
    setSelectionMode(selectionMode);

    bindCanvasEvents();
    bindToolbarEvents();
    bindLayerEvents();
    bindLayersPanelDrag();
    bindHistoryPanelDrag();
    bindHistoryEvents();
    bindSaveEvents();
    bindExportEvents();
    initSaveState();
    hydrateSavedFrame();
    hydratePanelPositions();
    window.addEventListener('i18n:language-changed', () => {
        renderLayerList();
        updateHistoryPanel();
        updateLastSavedLabel();
    });
    startLastSavedTicker();
    window.addEventListener('resize', syncEditorLayout);
}

// Запускаем после загрузки скрипта
initEditor().catch((error) => {
    console.error('Ошибка инициализации редактора', error);
});