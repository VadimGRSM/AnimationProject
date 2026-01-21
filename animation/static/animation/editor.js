// =======================
// Константы инструментов
// =======================

const TOOL_BRUSH = 'brush';
const TOOL_ERASER = 'eraser';

// =======================
// Глобальные ссылки на DOM
// =======================

const canvas = document.getElementById('editor-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

const toolbar = document.querySelector('.editor-toolbar');
const toolButtons = document.querySelectorAll('.tool-button');
const colorInput = document.getElementById('color-picker');
const sizeInput = document.getElementById('brush-size');

// =======================
// Состояние рисования
// =======================

let currentTool = TOOL_BRUSH;
let currentColor = colorInput ? colorInput.value : '#000000';
let currentSize = sizeInput ? parseInt(sizeInput.value, 10) || 4 : 4;

let isDrawing = false;
let lastX = 0;
let lastY = 0;

// =======================
// Функции установки параметров
// =======================

/**
 * Устанавливаем активный инструмент
 * и визуально подсвечиваем кнопку
 */
function setTool(toolName) {
    currentTool = toolName;

    toolButtons.forEach((btn) => {
        if (btn.dataset.tool === toolName) {
            btn.classList.add('tool-button--active');
        } else {
            btn.classList.remove('tool-button--active');
        }
    });
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

// =======================
// Функции рисования
// =======================

/**
 * Начало рисования
 */
function startDrawing(x, y) {
    isDrawing = true;
    lastX = x;
    lastY = y;
}

/**
 * Продолжение рисования
 * Рисуем линию от предыдущей точки до новой
 */
function continueDrawing(x, y) {
    if (!isDrawing || !ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = currentSize;

    if (currentTool === TOOL_ERASER) {
        // пока считаем фон белым
        ctx.strokeStyle = '#ffffff';
    } else {
        ctx.strokeStyle = currentColor;
    }

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;
}

/**
 * Завершение рисования
 */
function stopDrawing() {
    isDrawing = false;
}

// =======================
// Получение координат внутри canvas
// =======================

/**
 * Переводим координаты мыши в систему координат canvas
 */
function getCanvasCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x, y };
}

// =======================
// Привязка событий к Canvas
// =======================

/**
 * Навешиваем обработчики мыши на canvas
 */
function bindCanvasEvents() {
    if (!canvas) return;

    canvas.addEventListener('mousedown', (event) => {
        const { x, y } = getCanvasCoords(event);
        startDrawing(x, y);
    });

    canvas.addEventListener('mousemove', (event) => {
        if (!isDrawing) return;
        const { x, y } = getCanvasCoords(event);
        continueDrawing(x, y);
    });

    canvas.addEventListener('mouseup', () => {
        stopDrawing();
    });

    canvas.addEventListener('mouseleave', () => {
        stopDrawing();
    });
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
            const button = event.target.closest('.tool-button');
            if (!button) return;

            const toolName = button.dataset.tool;
            if (toolName === TOOL_BRUSH || toolName === TOOL_ERASER) {
                setTool(toolName);
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

    // можно задать начальный фон (белый)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // устанавливаем стартовые значения
    setTool(currentTool);
    setColor(currentColor);
    setBrushSize(currentSize);

    bindCanvasEvents();
    bindToolbarEvents();
}

// Запускаем после загрузки скрипта
initEditor();