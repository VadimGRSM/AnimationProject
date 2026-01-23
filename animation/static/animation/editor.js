// =======================
// Константы инструментов
// =======================

const TOOL_BRUSH = 'brush';
const TOOL_ERASER = 'eraser';
const TOOL_FILL = 'fill';
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
const ctx = canvas ? canvas.getContext('2d') : null;
const overlayCanvas = document.getElementById('editor-overlay');
const overlayCtx = overlayCanvas ? overlayCanvas.getContext('2d') : null;

const toolbar = document.querySelector('.editor-toolbar');
const toolButtons = document.querySelectorAll('.tool-button[data-tool]');
const selectionModeButtons = document.querySelectorAll('[data-select-mode]');
const wandSensitivityInput = document.getElementById('wand-sensitivity');
const colorInput = document.getElementById('color-picker');
const sizeInput = document.getElementById('brush-size');
const saveButton = document.getElementById('save-project-button');
const saveStatus = document.getElementById('save-status');
const saveIndicator = document.getElementById('save-indicator');
const lastSavedLabel = document.getElementById('last-saved-time');

const projectSaveUrl = (editorRoot && editorRoot.dataset.projectSaveUrl)
    || window.ANIM_PROJECT_SAVE_URL
    || '';
const frameSaveUrlTemplate = (editorRoot && editorRoot.dataset.frameSaveUrlTemplate)
    || window.ANIM_FRAME_SAVE_URL_TEMPLATE
    || '';
const currentFramePreviewUrl = (editorRoot && editorRoot.dataset.currentFramePreviewUrl)
    || window.ANIM_CURRENT_FRAME_PREVIEW_URL
    || '';
const currentFrameUpdatedAt = (editorRoot && editorRoot.dataset.currentFrameUpdatedAt)
    || window.ANIM_CURRENT_FRAME_UPDATED_AT
    || '';

// =======================
// Состояние рисования
// =======================

let currentTool = TOOL_BRUSH;
let currentColor = colorInput ? colorInput.value : '#000000';
let currentSize = sizeInput ? parseInt(sizeInput.value, 10) || 4 : 4;

let isDrawing = false;
let activeTool = null;
let lastX = 0;
let lastY = 0;
let startX = 0;
let startY = 0;

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

const AUTOSAVE_INTERVAL_MS = 30000;
const LAST_SAVED_TICK_MS = 1000;

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
    renderOverlay();

    toolButtons.forEach((btn) => {
        if (btn.dataset.tool === toolName) {
            btn.classList.add('tool-button--active');
        } else {
            btn.classList.remove('tool-button--active');
        }
    });

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
    const strokeColor = useEraser ? '#ffffff' : currentColor;
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    targetCtx.lineWidth = currentSize;
    targetCtx.strokeStyle = strokeColor;
}

function clearCanvas(targetCtx, targetCanvas) {
    if (!targetCtx || !targetCanvas) return;
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
}

function withTransformedContext(targetCtx, callback, options = {}) {
    if (!targetCtx) return;
    targetCtx.save();
    targetCtx.scale(scale, scale);
    targetCtx.translate(offsetX, offsetY);
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
    if (!selectionDraft && !selection) {
        updateSelectionAnimationState();
        return;
    }

    withTransformedContext(overlayCtx, () => {
        const targetSelection = selectionDraft || selection;
        if (!targetSelection) return;
        drawSelectionPath(overlayCtx, targetSelection);
    }, { clipToFrame: true });
    updateSelectionAnimationState();
}

function renderScene() {
    if (!ctx || !canvas || !bufferCanvas) return;
    clearCanvas(ctx, canvas);
    withTransformedContext(ctx, () => {
        ctx.drawImage(bufferCanvas, 0, 0);
    });
}

function syncCanvasSizes() {
    if (!canvas) return;
    const width = canvas.width;
    const height = canvas.height;

    if (overlayCanvas) {
        overlayCanvas.width = width;
        overlayCanvas.height = height;
    }

    if (!bufferCanvas) {
        bufferCanvas = document.createElement('canvas');
    }
    bufferCanvas.width = width;
    bufferCanvas.height = height;

    bufferCtx = bufferCanvas.getContext('2d');
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

    if (toolName === TOOL_BRUSH || toolName === TOOL_ERASER) {
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
    activeTool = null;
}

function drawStrokeSegment(fromX, fromY, toX, toY, toolName) {
    if (!bufferCtx || !bufferCanvas) return;
    const useEraser = toolName === TOOL_ERASER;

    drawBufferWithSelection((targetCtx) => {
        applyStrokeStyles(targetCtx, { useEraser });
        targetCtx.beginPath();
        targetCtx.moveTo(fromX, fromY);
        targetCtx.lineTo(toX, toY);
        targetCtx.stroke();
    });

    if (!ctx || !canvas) return;
    if (selection && selection.type === SELECT_MAGIC) {
        renderScene();
        return;
    }
    withTransformedContext(ctx, () => {
        applyStrokeStyles(ctx, { useEraser });
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
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
        applyStrokeStyles(targetCtx, { useEraser: false });
        drawShapePath(targetCtx, activeTool, startX, startY, x, y);
        targetCtx.stroke();
    });
}

function commitShape() {
    if (!bufferCtx || !bufferCanvas || !ctx || !canvas) return;
    if (startX === lastX && startY === lastY) {
        renderOverlay();
        return;
    }
    markUnsavedChanges();
    drawBufferWithSelection((targetCtx) => {
        applyStrokeStyles(targetCtx, { useEraser: false });
        drawShapePath(targetCtx, activeTool, startX, startY, lastX, lastY);
        targetCtx.stroke();
    });

    if (selection && selection.type === SELECT_MAGIC) {
        renderScene();
    } else {
        withTransformedContext(ctx, () => {
            applyStrokeStyles(ctx, { useEraser: false });
            drawShapePath(ctx, activeTool, startX, startY, lastX, lastY);
            ctx.stroke();
        }, { clipToFrame: true, clipToSelection: true });
    }

    renderOverlay();
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

function drawBufferWithSelection(drawCallback) {
    if (!bufferCtx || !bufferCanvas) return;
    if (selection && selection.type === SELECT_MAGIC && selection.maskCanvas) {
        if (!ensureSelectionScratchCanvas()) return;
        clearCanvas(selectionScratchCtx, selectionScratchCanvas);
        drawCallback(selectionScratchCtx);
        selectionScratchCtx.globalCompositeOperation = 'destination-in';
        selectionScratchCtx.drawImage(selection.maskCanvas, 0, 0);
        selectionScratchCtx.globalCompositeOperation = 'source-over';
        bufferCtx.drawImage(selectionScratchCanvas, 0, 0);
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

function copySelectionToClipboard() {
    if (!selection || !bufferCanvas) return false;
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
        clipboardCtx.drawImage(bufferCanvas, 0, 0);
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
        if (!ensureSelectionScratchCanvas()) return false;
        clearCanvas(selectionScratchCtx, selectionScratchCanvas);
        selectionScratchCtx.drawImage(selection.maskCanvas, 0, 0);
        selectionScratchCtx.globalCompositeOperation = 'source-in';
        selectionScratchCtx.fillStyle = '#ffffff';
        selectionScratchCtx.fillRect(0, 0, selectionScratchCanvas.width, selectionScratchCanvas.height);
        selectionScratchCtx.globalCompositeOperation = 'source-over';
        bufferCtx.drawImage(selectionScratchCanvas, 0, 0);
    } else {
        bufferCtx.save();
        appendSelectionPath(bufferCtx, selection);
        bufferCtx.clip();
        bufferCtx.fillStyle = '#ffffff';
        bufferCtx.fillRect(0, 0, bufferCanvas.width, bufferCanvas.height);
        bufferCtx.restore();
    }
    renderScene();
    markUnsavedChanges();
    return true;
}

function cutSelectionToClipboard() {
    const didCopy = copySelectionToClipboard();
    if (!didCopy) return false;
    clearSelectionContent();
    return true;
}

function pasteSelectionFromClipboard() {
    if (!selectionClipboard || !bufferCtx || !bufferCanvas) return false;
    const clipboardCanvas = selectionClipboard.canvas;
    if (!clipboardCanvas) return false;

    let pasteX = Number.isFinite(lastPointerX) ? lastPointerX : selectionClipboard.originX;
    let pasteY = Number.isFinite(lastPointerY) ? lastPointerY : selectionClipboard.originY;
    pasteX -= selectionClipboard.width / 2;
    pasteY -= selectionClipboard.height / 2;

    const deltaX = pasteX - selectionClipboard.originX;
    const deltaY = pasteY - selectionClipboard.originY;
    const pastedSelection = translateSelection(selectionClipboard.selection, deltaX, deltaY);

    if (selection && selection.type === SELECT_MAGIC && selection.maskCanvas) {
        if (!ensureSelectionScratchCanvas()) return false;
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
    selection = null;
    selectionDraft = null;
    isSelecting = false;
    lassoPoints = [];
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
        if (!isDrawing && !isSelecting && !isPanning) {
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

// =======================
// Получение координат внутри canvas
// =======================

/**
 * Переводим координаты мыши в систему координат canvas
 */
function getCanvasRawCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    return { x, y, rect };
}

function getCanvasCoords(event) {
    const { x: rawX, y: rawY } = getCanvasRawCoords(event);
    const normalizedScale = scale || 1;
    const x = rawX / normalizedScale - offsetX;
    const y = rawY / normalizedScale - offsetY;
    return { x, y };
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

function drawImageOnCanvas(image) {
    if (!bufferCtx || !bufferCanvas) return;
    clearCanvas(bufferCtx, bufferCanvas);
    bufferCtx.fillStyle = '#ffffff';
    bufferCtx.fillRect(0, 0, bufferCanvas.width, bufferCanvas.height);
    bufferCtx.drawImage(image, 0, 0, bufferCanvas.width, bufferCanvas.height);
    renderScene();
}

function hydrateSavedFrame() {
    if (!canvas || !ctx) return;

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
        drawImageOnCanvas(image);
        if (!lastSavedAt) {
            lastSavedAt = new Date();
        }
        setSaveIndicator('saved');
        setSaveStatus('Сохранено', 'saved');
        updateLastSavedLabel();
        updateSaveButtonState();
    };
    image.onerror = () => {
        console.warn('Не удалось загрузить сохраненный кадр');
        setSaveIndicator('error');
        setSaveStatus('Не удалось загрузить сохраненный кадр', 'error');
    };
    image.src = normalizeAssetUrl(currentFramePreviewUrl);
}

/**
 * Собираем данные текущего кадра для сохранения.
 */
function getCurrentFramePayload() {
    if (!bufferCanvas) return null;

    const dataUrl = bufferCanvas.toDataURL('image/png');
    return {
        image_data: dataUrl,
    };
}

/**
 * Отправляем текущий кадр на сервер.
 */
async function saveCurrentFrame(options = {}) {
    if (!frameSaveUrlTemplate) {
        setSaveStatus('Не найден адрес сохранения кадра', 'error');
        setSaveIndicator('error');
        return;
    }

    if (isSaving || isAutosaving || !hasUnsavedChanges) return;

    const saveUrl = getFrameSaveUrl(currentFrameIndex);
    if (!saveUrl) {
        setSaveStatus('Не найден адрес сохранения кадра', 'error');
        setSaveIndicator('error');
        return;
    }

    const payload = getCurrentFramePayload();
    if (!payload) {
        setSaveStatus('Нет данных для сохранения', 'error');
        setSaveIndicator('error');
        return;
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
        setSaveStatus('Сохранено', 'saved');
        setSaveIndicator('saved');
        updateLastSavedLabel();
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
    panStartX = event.clientX;
    panStartY = event.clientY;
    panStartOffsetX = offsetX;
    panStartOffsetY = offsetY;
    updateCursor();
}

function updatePan(event) {
    if (!isPanning) return;
    const deltaX = event.clientX - panStartX;
    const deltaY = event.clientY - panStartY;
    const normalizedScale = scale || 1;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    offsetX = panStartOffsetX + (deltaX * scaleX) / normalizedScale;
    offsetY = panStartOffsetY + (deltaY * scaleY) / normalizedScale;
    renderScene();
    renderOverlay();
}

function stopPan() {
    if (!isPanning) return;
    isPanning = false;
    updateCursor();
}

function handlePointerDown(event) {
    if (event.button !== 0) return;
    if (isSpacePressed || currentTool === TOOL_PAN) {
        startPan(event);
        return;
    }

    const { x, y } = getCanvasCoords(event);
    lastPointerX = x;
    lastPointerY = y;
    if (currentTool === TOOL_SELECT) {
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

    if (selection && !isPointInSelection(x, y, selection)) {
        return;
    }

    if (currentTool === TOOL_FILL) {
        const didFill = floodFill(x, y);
        if (didFill) {
            markUnsavedChanges();
        }
        return;
    }

    if (currentTool === TOOL_BRUSH || currentTool === TOOL_ERASER || isShapeTool(currentTool)) {
        startDrawing(x, y, currentTool);
    }
}

function handlePointerMove(event) {
    if (isPanning) {
        updatePan(event);
        return;
    }
    const { x, y } = getCanvasCoords(event);
    lastPointerX = x;
    lastPointerY = y;
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

    if (!isDrawing) return;
    continueDrawing(x, y);
}

function handlePointerUp() {
    if (isPanning) {
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
        return;
    }
    if (!isDrawing) return;
    if (isShapeTool(activeTool)) {
        commitShape();
    }
    stopDrawing();
}

function handlePointerLeave() {
    if (isPanning) {
        stopPan();
        return;
    }
    if (isSelecting) {
        selectionDraft = null;
        lassoPoints = [];
        isSelecting = false;
        renderOverlay();
        return;
    }
    if (!isDrawing) return;
    renderOverlay();
    stopDrawing();
}

function handleCanvasDoubleClick(event) {
    if (!selection || isSelecting || isPanning) return;
    const { x, y } = getCanvasCoords(event);
    if (!isPointInSelection(x, y, selection)) {
        clearSelection();
    }
}

function handleWheel(event) {
    if (!canvas) return;
    event.preventDefault();

    const { x: rawX, y: rawY } = getCanvasRawCoords(event);
    const normalizedScale = scale || 1;
    const pointerX = rawX / normalizedScale - offsetX;
    const pointerY = rawY / normalizedScale - offsetY;

    const direction = event.deltaY < 0 ? SCALE_STEP : 1 / SCALE_STEP;
    const nextScale = clamp(scale * direction, MIN_SCALE, MAX_SCALE);
    if (nextScale === scale) return;

    scale = nextScale;
    offsetX = rawX / scale - pointerX;
    offsetY = rawY / scale - pointerY;

    renderScene();
    renderOverlay();
}

function handleKeyDown(event) {
    const isCtrl = event.ctrlKey || event.metaKey;
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
    if (isCtrl && event.code === 'KeyV') {
        if (!isTextInputElement(event.target)) {
            event.preventDefault();
            pasteSelectionFromClipboard();
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
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
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
// Привязка UI сохранения
// =======================

function bindSaveEvents() {
    if (!saveButton) return;

    saveButton.addEventListener('click', () => {
        saveCurrentFrame();
    });
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
function initEditor() {
    if (!canvas || !ctx) {
        console.warn('Canvas редактора не найден');
        return;
    }

    syncCanvasSizes();
    if (!bufferCtx || !bufferCanvas) {
        console.warn('Не удалось подготовить буфер холста');
        return;
    }

    bufferCtx.fillStyle = '#ffffff';
    bufferCtx.fillRect(0, 0, bufferCanvas.width, bufferCanvas.height);
    renderScene();

    // устанавливаем стартовые значения
    setTool(currentTool);
    setColor(currentColor);
    setBrushSize(currentSize);
    setSelectionMode(selectionMode);

    bindCanvasEvents();
    bindToolbarEvents();
    bindSaveEvents();
    initSaveState();
    hydrateSavedFrame();
    startAutosave();
    startLastSavedTicker();
}

// Запускаем после загрузки скрипта
initEditor();