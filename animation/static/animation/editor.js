// =======================
// Tool constants
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
// Global DOM references
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

const toolbarPanel = document.querySelector('.editor-toolbar-panel');
const toolbarPanelHeader = toolbarPanel ? toolbarPanel.querySelector('.editor-toolbar-panel__header') : null;
const toolbar = document.querySelector('.editor-toolbar');
const toolSettingsPopover = document.getElementById('tool-settings-popover');
const toolSettingsSelectionModes = document.getElementById('tool-settings-selection-modes');
const toolSettingsSize = document.getElementById('tool-settings-size');
const toolSettingsOpacity = document.getElementById('tool-settings-opacity');
const toolSettingsBlur = document.getElementById('tool-settings-blur');
const toolSettingsSensitivity = document.getElementById('tool-settings-sensitivity');
const selectToolIcon = document.getElementById('select-tool-icon');
const canvasStage = document.getElementById('canvas-stage');
const canvasStageControls = canvasStage ? canvasStage.querySelector('.canvas-stage__controls') : null;
const canvasWrapper = document.querySelector('.canvas-wrapper');
const resetCanvasViewButton = document.getElementById('reset-canvas-view-button');
const fitCanvasFrameButton = document.getElementById('fit-canvas-frame-button');
const toggleCanvasFullscreenButton = document.getElementById('toggle-canvas-fullscreen-button');
const editorMain = document.querySelector('.editor-main');
const toolButtons = document.querySelectorAll('.tool-button[data-tool]');
const selectionModeButtons = document.querySelectorAll('[data-select-mode]');
const wandSensitivityInput = document.getElementById('wand-sensitivity');
const colorInput = document.getElementById('color-picker');
const secondaryColorInput = document.getElementById('secondary-color-picker');
const sizeInput = document.getElementById('brush-size');
const opacityInput = document.getElementById('brush-opacity');
const blurInput = document.getElementById('brush-blur');
const saveButton = document.getElementById('save-project-button');
const exportButton = document.getElementById('export-project-button');
const saveStatus = document.getElementById('save-status');
const saveIndicator = document.getElementById('save-indicator');
const lastSavedLabel = document.getElementById('last-saved-time');
const projectPresencePanel = document.getElementById('project-presence');
const projectPresenceCount = document.getElementById('project-presence-count');
const projectPresenceList = document.getElementById('project-presence-list');
const projectPresenceEmpty = document.getElementById('project-presence-empty');
const frameLockStatus = document.getElementById('frame-lock-status');
const frameLockStatusText = document.getElementById('frame-lock-status-text');

const exportModal = document.getElementById('export-modal');
const exportModalCloseButton = document.getElementById('export-modal-close');
const exportCancelButton = document.getElementById('export-cancel-button');
const exportConfirmButton = document.getElementById('export-confirm-button');
const editorPopupBackdrop = document.getElementById('editor-popup-backdrop');
const exportResolutionSelect = document.getElementById('export-resolution');
const exportFpsField = document.getElementById('export-fps-field');
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

function parseDatasetBoolean(value) {
    return String(value).trim().toLowerCase() === 'true';
}

const currentUserRole = (editorRoot && editorRoot.dataset.currentUserRole) || '';
const projectCanEdit = parseDatasetBoolean(editorRoot && editorRoot.dataset.canEdit);
const projectCanManageMembers = parseDatasetBoolean(editorRoot && editorRoot.dataset.canManageMembers);

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
const playbackControls = document.getElementById('playback-controls');
const playbackPlayButton = document.getElementById('playback-play-button');
const playbackStopButton = document.getElementById('playback-stop-button');
const playbackLoopToggle = document.getElementById('playback-loop-toggle');
const playbackFpsInput = document.getElementById('playback-fps-input');

const projectSaveUrl = (editorRoot && editorRoot.dataset.projectSaveUrl)
    || window.ANIM_PROJECT_SAVE_URL
    || '';
const projectUpdateUrl = (editorRoot && editorRoot.dataset.projectUpdateUrl) || '';
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
let currentFrameContentJson = '';
const projectFrameWidth = (() => {
    const raw = editorRoot ? editorRoot.dataset.projectWidth : null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : (canvas ? canvas.width : 1280);
})();
const projectFrameHeight = (() => {
    const raw = editorRoot ? editorRoot.dataset.projectHeight : null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : (canvas ? canvas.height : 720);
})();
let projectFps = (() => {
    const raw = editorRoot ? editorRoot.dataset.projectFps : null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
})();

// =======================
// Drawing state
// =======================

let currentTool = TOOL_BRUSH;
let autoPanSelectionHoverActive = false;
let currentColor = colorInput ? colorInput.value : '#000000';
let secondaryColor = secondaryColorInput ? secondaryColorInput.value : '#ffffff';
let currentSize = sizeInput ? parseInt(sizeInput.value, 10) || 4 : 4;
let brushOpacity = opacityInput ? (parseInt(opacityInput.value, 10) || 100) : 100;
let brushBlur = blurInput ? parseInt(blurInput.value, 10) || 0 : 0;
let activeStrokeColor = currentColor;
let activeStrokeOpacity = 1;
let activeStrokeBlur = 0;
let brushStampCanvas = null;
let brushStampCtx = null;
let brushStampRadius = 0;
let brushStampSpacing = 1;
let brushStampCarryDistance = 0;
let activePointerButton = 0;
let toolSettingsAnchorButton = null;
let activeEditorPopupId = null;

// =======================
// Layer state
// =======================

let layers = [];
let activeLayerId = null;
let activeLayer = null;
let dragLayerId = null;
let flattenCanvas = null;
let flattenCtx = null;
let didInitBackground = false;
let isDraggingToolbarPanel = false;
let toolbarPanelOffsetX = 0;
let toolbarPanelOffsetY = 0;
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
let isCanvasStageFullscreen = false;
let fullscreenCanvasDisplayScale = null;
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
// Save state
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
let timelineControlsTemporarilyDisabled = false;
let isUpdatingProjectFps = false;
const projectPresence = new Map();
const frameLocksById = new Map();
let presenceSocket = null;
let presenceCurrentUserId = null;
let presenceSessionId = null;
let collaborationConnectionReady = false;
let presencePingTimerId = null;
let frameLockHeartbeatTimerId = null;
let presenceReconnectTimerId = null;
let presenceIsClosing = false;
let pendingFrameLockId = null;
let currentHeldFrameLockId = null;
const localProjectEventRequestIds = new Set();
let projectEventRequestCounter = 0;
let presenceReconnectAttempt = 0;
let collaborationRecoveryPending = false;
let collaborationRecoveryInFlight = false;
let collaborationHasConnected = false;
const PRESENCE_PING_INTERVAL_MS = 30000;
const FRAME_LOCK_HEARTBEAT_INTERVAL_MS = 12000;
const PRESENCE_RECONNECT_BASE_DELAY_MS = 2000;
const PRESENCE_RECONNECT_MAX_DELAY_MS = 15000;

const PLAYBACK_IDLE = 'idle';
const PLAYBACK_PLAYING = 'playing';
const PLAYBACK_PAUSED = 'paused';
let playbackMode = PLAYBACK_IDLE;
let playbackLoopEnabled = false;
let playbackRafId = null;
let playbackLastTickAt = 0;
let playbackAccumulatedMs = 0;
let playbackStepInFlight = false;
let playbackStartFrameIndex = null;
let playbackMarkerFrameIndex = null;
let playbackAudioElement = null;
let playbackStopping = false;
let playbackFrameOrder = [];
let playbackFramePosition = -1;
let playbackPreviewCanvas = null;
let playbackPreviewCtx = null;
const playbackFrameImageCache = new Map();

// =======================
// Onion-Skin (adjacent frames)
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
// Action history
// =======================

const HISTORY_LIMIT = 50;
const HISTORY_VISIBLE_ACTIONS = 5;
const LAYERS_VISIBLE_COUNT = 3;
const frameHistories = new Map();
let isHistoryApplying = false;
let frameHydrationToken = 0;
let didDrawStroke = false;
let lastDrawTool = null;
let historyPending = null;

const UI_TEXT = {
    action: 'Action',
    frame_start: 'Frame start',
    history_start: 'History start',
    brush: 'Brush',
    eraser: 'Eraser',
    fill: 'Fill',
    line: 'Line',
    rectangle: 'Rectangle',
    ellipse: 'Ellipse',
    opacity: 'Opacity',
    hide_layer: 'Hide layer',
    show_layer: 'Show layer',
    rename_layer: 'Rename layer',
    delete_layer: 'Delete layer',
    save: 'Save',
    cancel: 'Cancel',
    layer_add: 'Layer: add',
    layer_delete: 'Layer: delete',
    layer_opacity_action: 'Layer: opacity',
    layer_show_action: 'Layer: show',
    layer_hide_action: 'Layer: hide',
    layer_rename_action: 'Layer: rename',
    layer_order: 'Layer: order',
    selection_transform: 'Transform selection',
    cut: 'Cut',
    paste: 'Paste',
    paste_image: 'Paste image',
    a_few_seconds_ago: 'a few seconds ago',
    seconds_ago: '%{count}s ago',
    minutes_ago: '%{count}m ago',
    hours_ago: '%{count}h ago',
    last_saved_label: 'Last saved: %{time}',
    unsaved_changes: 'Unsaved changes',
    no_changes: 'No changes',
    project_fps_update_failed: 'Could not update project FPS.',
    project_fps_updating: 'Updating project FPS...',
    project_fps_updated: 'Project FPS updated.',
    project_fps_invalid: 'Enter a valid project FPS (1-60).',
};

function interpolateText(template, params = null) {
    if (!params || typeof template !== 'string') return template;
    return template.replace(/%\{(\w+)\}/g, (_, paramKey) => {
        const value = params[paramKey];
        return value === undefined || value === null ? '' : String(value);
    });
}

function getText(key, params = null) {
    return interpolateText(UI_TEXT[key] || key, params);
}

function capitalizePresenceLabel(value) {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizePresenceUser(rawUser) {
    if (!rawUser || typeof rawUser !== 'object') return null;
    const userId = Number(rawUser.user_id);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    const currentFrameId = rawUser.current_frame_id === null || rawUser.current_frame_id === undefined
        ? null
        : Number(rawUser.current_frame_id);
    const currentFrameIndex = rawUser.current_frame_index === null || rawUser.current_frame_index === undefined
        ? null
        : Number(rawUser.current_frame_index);
    return {
        user_id: userId,
        display_name: rawUser.display_name || rawUser.email || `User ${userId}`,
        email: rawUser.email || '',
        role: rawUser.role || '',
        current_frame_id: Number.isFinite(currentFrameId) ? currentFrameId : null,
        current_frame_index: Number.isFinite(currentFrameIndex) ? currentFrameIndex : null,
    };
}

function normalizeFrameLock(rawLock) {
    if (!rawLock || typeof rawLock !== 'object') return null;
    const frameId = Number(rawLock.frame_id);
    const frameIndex = Number(rawLock.frame_index);
    const userId = Number(rawLock.user_id);
    const presenceSession = Number(rawLock.presence_session_id);
    if (!Number.isFinite(frameId) || frameId <= 0) return null;
    return {
        frame_id: frameId,
        frame_index: Number.isFinite(frameIndex) ? frameIndex : null,
        user_id: Number.isFinite(userId) ? userId : null,
        display_name: rawLock.display_name || rawLock.email || 'Unknown user',
        email: rawLock.email || '',
        role: rawLock.role || '',
        presence_session_id: Number.isFinite(presenceSession) ? presenceSession : null,
        expires_at: rawLock.expires_at || '',
    };
}

function canCurrentUserUseFrameLocks() {
    return Boolean(projectCanEdit);
}

function isCollaborationReady() {
    return collaborationConnectionReady && Number.isFinite(presenceSessionId) && presenceSessionId > 0;
}

function getFrameLock(frameId) {
    const numericFrameId = Number(frameId);
    if (!Number.isFinite(numericFrameId) || numericFrameId <= 0) return null;
    return frameLocksById.get(numericFrameId) || null;
}

function getCurrentFrameLock() {
    return getFrameLock(currentFrameId);
}

function isLockOwnedByCurrentSession(lock) {
    return Boolean(
        lock
        && Number.isFinite(lock.presence_session_id)
        && Number.isFinite(presenceSessionId)
        && lock.presence_session_id === presenceSessionId,
    );
}

function getCurrentFrameLockOwnerName() {
    const lock = getCurrentFrameLock();
    return lock ? lock.display_name : '';
}

function refreshHeldFrameLockId() {
    currentHeldFrameLockId = null;
    for (const lock of frameLocksById.values()) {
        if (isLockOwnedByCurrentSession(lock)) {
            currentHeldFrameLockId = lock.frame_id;
            if (lock.frame_id === currentFrameId) {
                break;
            }
        }
    }
}

function isCurrentFrameReadOnlyByLock() {
    if (!canCurrentUserUseFrameLocks()) {
        return false;
    }
    if (!isCollaborationReady()) {
        return true;
    }
    if (!Number.isFinite(currentFrameId) || currentFrameId <= 0) {
        return true;
    }
    if (pendingFrameLockId === currentFrameId) {
        return true;
    }
    const lock = getCurrentFrameLock();
    return !isLockOwnedByCurrentSession(lock);
}

function getCurrentFrameEditingState() {
    if (!canCurrentUserUseFrameLocks()) {
        return {
            mode: 'readonly',
            text: Number.isFinite(currentFrameIndex) && currentFrameIndex > 0
                ? `Frame ${currentFrameIndex} is read-only for your role.`
                : 'Read-only project access.',
        };
    }
    if (isEditingLockedByPlayback()) {
        return {
            mode: 'pending',
            text: 'Playback is active. Editing is temporarily paused.',
        };
    }
    if (!isCollaborationReady()) {
        return {
            mode: 'pending',
            text: 'Connecting collaborative lock...',
        };
    }
    if (!Number.isFinite(currentFrameIndex) || currentFrameIndex <= 0) {
        return {
            mode: 'pending',
            text: 'Loading frame lock...',
        };
    }
    if (pendingFrameLockId === currentFrameId) {
        return {
            mode: 'pending',
            text: `Requesting frame ${currentFrameIndex} lock...`,
        };
    }

    const currentLock = getCurrentFrameLock();
    if (isLockOwnedByCurrentSession(currentLock)) {
        return {
            mode: 'editable',
            text: `Editing frame ${currentLock.frame_index || currentFrameIndex}.`,
        };
    }
    if (currentLock) {
        return {
            mode: 'readonly',
            text: `Frame ${currentLock.frame_index || currentFrameIndex} locked by ${currentLock.display_name}. Read-only.`,
        };
    }
    return {
        mode: 'readonly',
        text: `Frame ${currentFrameIndex} is not locked yet. Read-only.`,
    };
}

function syncFrameLockStatusUi() {
    if (!frameLockStatus || !frameLockStatusText) return;
    const state = getCurrentFrameEditingState();
    frameLockStatus.classList.remove(
        'frame-lock-status--pending',
        'frame-lock-status--editable',
        'frame-lock-status--readonly',
    );
    frameLockStatus.classList.add(`frame-lock-status--${state.mode}`);
    frameLockStatusText.textContent = state.text;
}

function stopFrameLockHeartbeat() {
    if (frameLockHeartbeatTimerId) {
        clearInterval(frameLockHeartbeatTimerId);
        frameLockHeartbeatTimerId = null;
    }
}

function startFrameLockHeartbeat() {
    stopFrameLockHeartbeat();
    if (!isProjectPresenceSocketOpen()) return;
    if (!Number.isFinite(currentHeldFrameLockId) || currentHeldFrameLockId <= 0) return;
    frameLockHeartbeatTimerId = window.setInterval(() => {
        if (!isProjectPresenceSocketOpen()) return;
        if (!Number.isFinite(currentHeldFrameLockId) || currentHeldFrameLockId <= 0) return;
        sendProjectPresenceMessage('frame_lock_heartbeat', { frame_id: currentHeldFrameLockId });
    }, FRAME_LOCK_HEARTBEAT_INTERVAL_MS);
}

function syncFrameLockHeartbeat() {
    const currentLock = getCurrentFrameLock();
    if (isLockOwnedByCurrentSession(currentLock) && currentLock.frame_id === currentHeldFrameLockId) {
        startFrameLockHeartbeat();
        return;
    }
    stopFrameLockHeartbeat();
}

function syncCollaborativeEditorUi() {
    refreshHeldFrameLockId();
    syncFrameLockStatusUi();
    syncEditorInteractionLockUi();
    updateSaveButtonState();
    renderTimelineFrames();
    syncFrameLockHeartbeat();
}

function setProjectPresenceEmptyState(text) {
    if (!projectPresenceEmpty) return;
    projectPresenceEmpty.textContent = text;
}

function renderProjectPresence() {
    if (!projectPresenceList || !projectPresenceEmpty || !projectPresenceCount) return;

    const users = [...projectPresence.values()].sort((left, right) => {
        const leftIsSelf = presenceCurrentUserId && left.user_id === presenceCurrentUserId;
        const rightIsSelf = presenceCurrentUserId && right.user_id === presenceCurrentUserId;
        if (leftIsSelf !== rightIsSelf) {
            return leftIsSelf ? -1 : 1;
        }
        return left.display_name.localeCompare(right.display_name, undefined, { sensitivity: 'base' });
    });

    projectPresenceCount.textContent = String(users.length);
    projectPresenceList.innerHTML = '';
    projectPresenceEmpty.hidden = users.length > 0;
    if (!users.length) {
        if (!projectPresenceEmpty.textContent) {
            setProjectPresenceEmptyState('No one online right now.');
        }
        return;
    }

    users.forEach((user) => {
        const isSelf = presenceCurrentUserId && user.user_id === presenceCurrentUserId;
        const item = document.createElement('li');
        item.className = 'project-presence__item';
        if (isSelf) {
            item.classList.add('project-presence__item--self');
        }

        const indicator = document.createElement('span');
        indicator.className = 'project-presence__indicator';
        indicator.setAttribute('aria-hidden', 'true');

        const body = document.createElement('span');
        body.className = 'project-presence__body';

        const name = document.createElement('span');
        name.className = 'project-presence__name';
        name.textContent = user.display_name;
        body.appendChild(name);

        if (isSelf) {
            const selfLabel = document.createElement('span');
            selfLabel.className = 'project-presence__you';
            selfLabel.textContent = 'You';
            body.appendChild(selfLabel);
        }

        const metaParts = [];
        if (user.role) {
            metaParts.push(capitalizePresenceLabel(user.role));
        }
        if (user.current_frame_index !== null) {
            metaParts.push(`Frame ${user.current_frame_index}`);
        }
        if (metaParts.length) {
            const meta = document.createElement('span');
            meta.className = 'project-presence__meta';
            meta.textContent = metaParts.join(' · ');
            body.appendChild(meta);
        }

        item.appendChild(indicator);
        item.appendChild(body);
        projectPresenceList.appendChild(item);
    });
}

function setProjectPresenceSnapshot(users) {
    projectPresence.clear();
    (Array.isArray(users) ? users : []).forEach((rawUser) => {
        const user = normalizePresenceUser(rawUser);
        if (!user) return;
        projectPresence.set(user.user_id, user);
    });
    setProjectPresenceEmptyState('No one online right now.');
    renderProjectPresence();
}

function upsertProjectPresenceUser(rawUser) {
    const user = normalizePresenceUser(rawUser);
    if (!user) return;
    projectPresence.set(user.user_id, user);
    renderProjectPresence();
}

function removeProjectPresenceUser(userId) {
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId)) return;
    projectPresence.delete(numericUserId);
    if (!projectPresence.size) {
        setProjectPresenceEmptyState('No one online right now.');
    }
    renderProjectPresence();
}

function buildProjectPresenceSocketUrl() {
    if (!editorRoot || !editorProjectId || editorProjectId === 'unknown') return '';
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/ws/projects/${editorProjectId}/`;
}

function isProjectPresenceSocketOpen() {
    return Boolean(presenceSocket && presenceSocket.readyState === WebSocket.OPEN);
}

function sendProjectPresenceMessage(type, payload = {}) {
    if (!isProjectPresenceSocketOpen()) return false;
    presenceSocket.send(JSON.stringify({ type, payload }));
    return true;
}

function createProjectEventRequestId() {
    projectEventRequestCounter += 1;
    return `${editorProjectId}:${Date.now()}:${projectEventRequestCounter}`;
}

function rememberLocalProjectEventRequest(requestId) {
    if (!requestId) return;
    localProjectEventRequestIds.add(requestId);
    window.setTimeout(() => {
        localProjectEventRequestIds.delete(requestId);
    }, 30000);
}

function forgetLocalProjectEventRequest(requestId) {
    if (!requestId) return;
    localProjectEventRequestIds.delete(requestId);
}

function shouldIgnoreProjectRealtimeEvent(payload) {
    const requestId = payload && payload.client_request_id;
    if (!requestId || !localProjectEventRequestIds.has(requestId)) {
        return false;
    }
    localProjectEventRequestIds.delete(requestId);
    return true;
}

function stopProjectPresencePing() {
    if (presencePingTimerId) {
        clearInterval(presencePingTimerId);
        presencePingTimerId = null;
    }
}

function startProjectPresencePing() {
    stopProjectPresencePing();
    presencePingTimerId = window.setInterval(() => {
        sendProjectPresenceMessage('ping', { at: Date.now() });
    }, PRESENCE_PING_INTERVAL_MS);
}

function notifyCurrentFramePresence() {
    const frameId = Number.isFinite(currentFrameId) ? currentFrameId : null;
    sendProjectPresenceMessage('presence_set_frame', { frame_id: frameId });
}

function setFrameLockSnapshot(locks) {
    frameLocksById.clear();
    (Array.isArray(locks) ? locks : []).forEach((rawLock) => {
        const lock = normalizeFrameLock(rawLock);
        if (!lock) return;
        frameLocksById.set(lock.frame_id, lock);
    });
    syncCollaborativeEditorUi();
}

function upsertFrameLock(rawLock) {
    const lock = normalizeFrameLock(rawLock);
    if (!lock) return;
    frameLocksById.set(lock.frame_id, lock);
    if (pendingFrameLockId === lock.frame_id && isLockOwnedByCurrentSession(lock)) {
        pendingFrameLockId = null;
    }
    syncCollaborativeEditorUi();
}

function removeFrameLock(frameId) {
    const numericFrameId = Number(frameId);
    if (!Number.isFinite(numericFrameId) || numericFrameId <= 0) return;
    if (pendingFrameLockId === numericFrameId) {
        pendingFrameLockId = null;
    }
    if (currentHeldFrameLockId === numericFrameId) {
        currentHeldFrameLockId = null;
    }
    frameLocksById.delete(numericFrameId);
    syncCollaborativeEditorUi();
}

function requestFrameLock(frameId) {
    const numericFrameId = Number(frameId);
    if (!canCurrentUserUseFrameLocks()) {
        syncCollaborativeEditorUi();
        return false;
    }
    if (!Number.isFinite(numericFrameId) || numericFrameId <= 0) {
        syncCollaborativeEditorUi();
        return false;
    }
    if (!isProjectPresenceSocketOpen() || !isCollaborationReady()) {
        pendingFrameLockId = numericFrameId;
        syncCollaborativeEditorUi();
        return false;
    }
    pendingFrameLockId = numericFrameId;
    syncCollaborativeEditorUi();
    return sendProjectPresenceMessage('frame_lock_acquire', { frame_id: numericFrameId });
}

function releaseFrameLock(frameId) {
    const numericFrameId = Number(frameId);
    if (!Number.isFinite(numericFrameId) || numericFrameId <= 0) return false;
    const lock = getFrameLock(numericFrameId);
    if (!isLockOwnedByCurrentSession(lock) && currentHeldFrameLockId !== numericFrameId) {
        return false;
    }
    if (pendingFrameLockId === numericFrameId) {
        pendingFrameLockId = null;
    }
    if (!isProjectPresenceSocketOpen()) {
        syncCollaborativeEditorUi();
        return false;
    }
    return sendProjectPresenceMessage('frame_lock_release', { frame_id: numericFrameId });
}

function syncCurrentFrameLock(previousFrameId = null) {
    const previousId = Number(previousFrameId);
    if (Number.isFinite(previousId) && previousId > 0 && previousId !== currentFrameId) {
        releaseFrameLock(previousId);
    }

    if (!canCurrentUserUseFrameLocks()) {
        pendingFrameLockId = null;
        syncCollaborativeEditorUi();
        return;
    }

    if (!Number.isFinite(currentFrameId) || currentFrameId <= 0) {
        pendingFrameLockId = null;
        syncCollaborativeEditorUi();
        return;
    }

    const currentLock = getCurrentFrameLock();
    if (isLockOwnedByCurrentSession(currentLock)) {
        pendingFrameLockId = null;
        currentHeldFrameLockId = currentFrameId;
        syncCollaborativeEditorUi();
        return;
    }

    requestFrameLock(currentFrameId);
}

async function applyRemoteFrameCreated(payload) {
    if (Array.isArray(payload.frames)) {
        timelineFrames = payload.frames;
    }
    playbackFrameImageCache.clear();
    renderTimelineFrames();
    if (currentFrameId) {
        const activeFrame = getTimelineFrameById(currentFrameId);
        if (activeFrame) {
            currentFrameIndex = activeFrame.index;
            setActiveTimelineIndex(currentFrameIndex);
        }
    }
}

async function applyRemoteFrameDeleted(payload) {
    if (Array.isArray(payload.frames)) {
        timelineFrames = payload.frames;
    } else {
        timelineFrames = [];
    }
    playbackFrameImageCache.clear();
    resetOnionFrameCache();
    removeFrameLock(payload.frame_id);

    const activeFrame = currentFrameId ? getTimelineFrameById(currentFrameId) : null;
    renderTimelineFrames();

    if (activeFrame) {
        currentFrameIndex = activeFrame.index;
        setActiveTimelineIndex(currentFrameIndex);
        prefetchOnionFramesForCurrent();
        requestOnionSkinRender();
        return;
    }

    currentFrameId = null;
    const nextIndex = Number(payload.active_index) || 1;
    await loadFrameByIndex(nextIndex);
}

async function applyRemoteFrameReordered(payload) {
    if (Array.isArray(payload.frames)) {
        timelineFrames = payload.frames;
    }
    playbackFrameImageCache.clear();
    const activeFrame = currentFrameId ? getTimelineFrameById(currentFrameId) : null;
    if (activeFrame) {
        currentFrameIndex = activeFrame.index;
    }
    resetOnionFrameCache();
    renderTimelineFrames();
    setActiveTimelineIndex(currentFrameIndex);
    prefetchOnionFramesForCurrent();
    requestOnionSkinRender();
}

async function applyRemoteLayerStructureChange(payload) {
    const frameId = Number(payload.frame_id);
    if (!Number.isFinite(frameId) || frameId !== currentFrameId) {
        return;
    }
    await loadLayers();
}

async function applyRemoteLayerUpdate(payload) {
    const frameId = Number(payload.frame_id);
    if (!Number.isFinite(frameId) || frameId !== currentFrameId) {
        return;
    }

    const updatedLayer = payload.layer;
    if (!updatedLayer || typeof updatedLayer !== 'object') {
        await loadLayers();
        return;
    }

    const layer = getLayerById(updatedLayer.id);
    if (!layer) {
        await loadLayers();
        return;
    }

    layer.name = updatedLayer.name;
    layer.order = updatedLayer.order;
    layer.visible = updatedLayer.visible;
    layer.opacity = updatedLayer.opacity;
    sortLayersByOrder();
    applyLayerStyles(layer);
    renderLayerList();
    renderScene();
}

function getPresenceReconnectDelayMs() {
    const exponent = Math.max(0, presenceReconnectAttempt - 1);
    const baseDelay = Math.min(
        PRESENCE_RECONNECT_MAX_DELAY_MS,
        PRESENCE_RECONNECT_BASE_DELAY_MS * (2 ** exponent),
    );
    const jitter = Math.floor(Math.random() * 350);
    return baseDelay + jitter;
}

async function recoverCollaborativeStateAfterReconnect() {
    if (collaborationRecoveryInFlight) return;
    collaborationRecoveryInFlight = true;
    try {
        await loadTimelineFrames();

        if (!timelineFrames.length) {
            return;
        }

        const currentTimelineFrame = currentFrameId ? getTimelineFrameById(currentFrameId) : null;
        if (currentTimelineFrame) {
            currentFrameIndex = currentTimelineFrame.index;
            setActiveTimelineIndex(currentFrameIndex);
            await loadLayers();
            prefetchOnionFramesForCurrent();
            requestOnionSkinRender();
            syncCurrentFrameLock();
            syncCollaborativeEditorUi();
            return;
        }

        const fallbackFrame = getTimelineFrameByIndex(currentFrameIndex) || timelineFrames[0] || null;
        if (fallbackFrame && Number.isFinite(Number(fallbackFrame.index))) {
            await loadFrameByIndex(Number(fallbackFrame.index));
        }
    } catch (error) {
        console.error('Collaborative reconnect recovery error', error);
    } finally {
        collaborationRecoveryInFlight = false;
    }
}

function scheduleProjectPresenceReconnect() {
    if (presenceIsClosing || presenceReconnectTimerId) return;
    presenceReconnectAttempt += 1;
    const reconnectDelayMs = getPresenceReconnectDelayMs();
    setProjectPresenceEmptyState(
        `Realtime connection lost. Reconnecting in ${Math.max(1, Math.ceil(reconnectDelayMs / 1000))}s...`,
    );
    presenceReconnectTimerId = window.setTimeout(() => {
        presenceReconnectTimerId = null;
        connectProjectPresence();
    }, reconnectDelayMs);
}

function disconnectProjectPresence() {
    presenceIsClosing = true;
    stopProjectPresencePing();
    stopFrameLockHeartbeat();
    if (Number.isFinite(currentHeldFrameLockId) && currentHeldFrameLockId > 0) {
        sendProjectPresenceMessage('frame_lock_release', { frame_id: currentHeldFrameLockId });
    }
    if (presenceReconnectTimerId) {
        clearTimeout(presenceReconnectTimerId);
        presenceReconnectTimerId = null;
    }
    if (presenceSocket) {
        presenceSocket.close();
        presenceSocket = null;
    }
}

async function handleProjectPresenceMessage(message) {
    if (!message || typeof message !== 'object') return;
    const payload = message.payload || {};

    if (message.type === 'connection_ready') {
        const userId = Number(payload.user_id);
        const sessionId = Number(payload.presence_session_id);
        if (Number.isFinite(userId) && userId > 0) {
            presenceCurrentUserId = userId;
        }
        presenceSessionId = Number.isFinite(sessionId) && sessionId > 0 ? sessionId : null;
        collaborationConnectionReady = true;
        const shouldRecoverState = collaborationHasConnected;
        collaborationHasConnected = true;
        collaborationRecoveryPending = shouldRecoverState;
        presenceReconnectAttempt = 0;
        renderProjectPresence();
        syncCollaborativeEditorUi();
        notifyCurrentFramePresence();
        syncCurrentFrameLock();
        return;
    }

    if (message.type === 'presence_snapshot') {
        setProjectPresenceSnapshot(payload.users);
        return;
    }

    if (message.type === 'presence_user_joined') {
        upsertProjectPresenceUser(payload.user);
        return;
    }

    if (message.type === 'presence_user_left') {
        removeProjectPresenceUser(payload.user_id);
        return;
    }

    if (message.type === 'presence_frame_changed') {
        upsertProjectPresenceUser(payload.user);
        return;
    }

    if (message.type === 'frame_lock_snapshot') {
        setFrameLockSnapshot(payload.locks);
        syncCurrentFrameLock();
        if (collaborationRecoveryPending) {
            collaborationRecoveryPending = false;
            void recoverCollaborativeStateAfterReconnect();
        }
        return;
    }

    if (message.type === 'frame_lock_acquired') {
        upsertFrameLock(payload.lock);
        return;
    }

    if (message.type === 'frame_lock_released') {
        const releasedLock = normalizeFrameLock(payload.lock);
        if (!releasedLock) return;
        const wasCurrentFrame = releasedLock.frame_id === currentFrameId;
        removeFrameLock(releasedLock.frame_id);
        if (wasCurrentFrame && canCurrentUserUseFrameLocks() && isCollaborationReady()) {
            syncCurrentFrameLock();
        }
        return;
    }

    if (message.type === 'frame_lock_denied') {
        if (payload.lock) {
            upsertFrameLock(payload.lock);
        }
        const deniedFrameId = Number(payload.frame_id);
        if (Number.isFinite(deniedFrameId) && deniedFrameId > 0 && pendingFrameLockId === deniedFrameId) {
            pendingFrameLockId = null;
        }
        syncCollaborativeEditorUi();
        return;
    }

    if (shouldIgnoreProjectRealtimeEvent(payload)) {
        return;
    }

    if (message.type === 'frame_created') {
        await applyRemoteFrameCreated(payload);
        return;
    }

    if (message.type === 'frame_deleted') {
        await applyRemoteFrameDeleted(payload);
        return;
    }

    if (message.type === 'frame_reordered') {
        await applyRemoteFrameReordered(payload);
        return;
    }

    if (message.type === 'layer_created' || message.type === 'layer_deleted' || message.type === 'layer_reordered') {
        await applyRemoteLayerStructureChange(payload);
        return;
    }

    if (
        message.type === 'layer_renamed'
        || message.type === 'layer_visibility_changed'
        || message.type === 'layer_opacity_changed'
    ) {
        await applyRemoteLayerUpdate(payload);
    }
}

function connectProjectPresence() {
    if (
        !window.WebSocket
        || !projectPresencePanel
        || presenceIsClosing
        || (presenceSocket && presenceSocket.readyState !== WebSocket.CLOSED)
    ) {
        return;
    }

    const socketUrl = buildProjectPresenceSocketUrl();
    if (!socketUrl) return;

    setProjectPresenceEmptyState('Connecting realtime presence...');

    const socket = new WebSocket(socketUrl);
    presenceSocket = socket;

    socket.addEventListener('open', () => {
        collaborationConnectionReady = false;
        startProjectPresencePing();
        syncCollaborativeEditorUi();
    });

    socket.addEventListener('message', (event) => {
        try {
            const message = JSON.parse(event.data);
            void handleProjectPresenceMessage(message);
        } catch (error) {
            console.error('Presence message parsing error', error);
        }
    });

    socket.addEventListener('close', () => {
        if (presenceSocket === socket) {
            presenceSocket = null;
        }
        stopProjectPresencePing();
        stopFrameLockHeartbeat();
        collaborationConnectionReady = false;
        presenceSessionId = null;
        pendingFrameLockId = null;
        currentHeldFrameLockId = null;
        frameLocksById.clear();
        if (!presenceIsClosing) {
            collaborationRecoveryPending = collaborationHasConnected;
            projectPresence.clear();
            renderProjectPresence();
            syncCollaborativeEditorUi();
            scheduleProjectPresenceReconnect();
        }
    });

    socket.addEventListener('error', () => {
        socket.close();
    });
}

// =======================
// Parameter setup helpers
// =======================

/**
 * Set the active tool and highlight its button.
 */
function getToolButtonByName(toolName) {
    for (const button of toolButtons) {
        if (button.dataset.tool === toolName) return button;
    }
    return null;
}

function getColorByMouseButton(button) {
    return button === 2 ? secondaryColor : currentColor;
}

function getToolSettingsConfig(toolName) {
    const showSelectionModes = toolName === TOOL_SELECT;
    const showSensitivity = toolName === TOOL_SELECT && selectionMode === SELECT_MAGIC;
    const showOpacity = toolName === TOOL_BRUSH;
    const showBlur = toolName === TOOL_BRUSH;
    const showSize = toolName === TOOL_BRUSH
        || toolName === TOOL_ERASER
        || toolName === TOOL_LINE
        || toolName === TOOL_RECTANGLE
        || toolName === TOOL_ELLIPSE;
    return {
        showSelectionModes,
        showSensitivity,
        showOpacity,
        showBlur,
        showSize,
    };
}

function applyToolSettingsVisibility(toolName) {
    if (!toolSettingsPopover) return false;
    const config = getToolSettingsConfig(toolName);
    if (toolSettingsSelectionModes) {
        toolSettingsSelectionModes.hidden = !config.showSelectionModes;
    }
    if (toolSettingsSize) {
        toolSettingsSize.hidden = !config.showSize;
    }
    if (toolSettingsOpacity) {
        toolSettingsOpacity.hidden = !config.showOpacity;
    }
    if (toolSettingsBlur) {
        toolSettingsBlur.hidden = !config.showBlur;
    }
    if (toolSettingsSensitivity) {
        toolSettingsSensitivity.hidden = !config.showSensitivity;
    }
    return config.showSelectionModes
        || config.showSize
        || config.showOpacity
        || config.showBlur
        || config.showSensitivity;
}

function isToolSettingsPopoverOpen() {
    return Boolean(toolSettingsPopover && !toolSettingsPopover.hidden);
}

function isOnionPanelOpen() {
    return Boolean(onionPanel && !onionPanel.hidden);
}

function getOpenEditorPopupIds() {
    const openIds = [];
    if (isOnionPanelOpen()) {
        openIds.push('onion');
    }
    if (isToolSettingsPopoverOpen()) {
        openIds.push('tool-settings');
    }
    return openIds;
}

function getResolvedActiveEditorPopupId() {
    const openIds = getOpenEditorPopupIds();
    if (!openIds.length) {
        return null;
    }
    if (activeEditorPopupId && openIds.includes(activeEditorPopupId)) {
        return activeEditorPopupId;
    }
    return openIds[openIds.length - 1];
}

function setActiveEditorPopup(popupId) {
    activeEditorPopupId = popupId || null;
    syncPopupBackdropState();
}

function applyEditorPopupVisualState(popupEl, isActive) {
    if (!popupEl) return;
    popupEl.classList.toggle('editor-popup--active', Boolean(isActive));
}

function applyGlobalModalSuppressionState(element, isSuppressed) {
    if (!element) return;
    const suppressed = Boolean(isSuppressed);
    element.classList.toggle('editor-ui--global-modal-suppressed', suppressed);
    const ariaHidden = suppressed || Boolean(element.hidden);
    element.setAttribute('aria-hidden', ariaHidden ? 'true' : 'false');
    if ('inert' in element) {
        element.inert = suppressed;
    }
}

function syncPopupBackdropState() {
    const exportOpen = isExportModalOpen();
    const openEditorPopups = getOpenEditorPopupIds();
    const hasEditorPopup = openEditorPopups.length > 0;
    const resolvedActivePopup = getResolvedActiveEditorPopupId();
    if (resolvedActivePopup) {
        activeEditorPopupId = resolvedActivePopup;
    } else if (!hasEditorPopup) {
        activeEditorPopupId = null;
    }

    if (editorPopupBackdrop) {
        editorPopupBackdrop.hidden = exportOpen || !hasEditorPopup;
    }
    document.body.classList.toggle('modal-open', exportOpen || hasEditorPopup);

    const activeEditorPopup = exportOpen ? null : resolvedActivePopup;
    const suppressToolSettingsForGlobalModal = exportOpen && isToolSettingsPopoverOpen();
    const suppressOnionForGlobalModal = exportOpen && isOnionPanelOpen();
    const suppressToolbarForGlobalModal = suppressToolSettingsForGlobalModal;

    if (toolbarPanel) {
        toolbarPanel.classList.toggle(
            'editor-toolbar-panel--popup-active',
            activeEditorPopup === 'tool-settings' && !suppressToolbarForGlobalModal,
        );
    }
    applyEditorPopupVisualState(toolSettingsPopover, activeEditorPopup === 'tool-settings');
    applyEditorPopupVisualState(onionPanel, activeEditorPopup === 'onion');
    applyGlobalModalSuppressionState(toolbarPanel, suppressToolbarForGlobalModal);
    applyGlobalModalSuppressionState(toolSettingsPopover, suppressToolSettingsForGlobalModal);
    applyGlobalModalSuppressionState(onionPanel, suppressOnionForGlobalModal);
}

function closeToolSettingsPopover() {
    if (!toolSettingsPopover) return;
    toolSettingsPopover.hidden = true;
    toolSettingsAnchorButton = null;
    if (activeEditorPopupId === 'tool-settings') {
        activeEditorPopupId = null;
    }
    syncPopupBackdropState();
}

function positionToolSettingsPopover(anchorButton) {
    if (!toolSettingsPopover || !toolbarPanel || !anchorButton) return;
    const panelRect = toolbarPanel.getBoundingClientRect();
    const buttonRect = anchorButton.getBoundingClientRect();
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
    const popoverWidth = toolSettingsPopover.offsetWidth || 240;
    const popoverHeight = toolSettingsPopover.offsetHeight || 120;
    const margin = 8;

    let top = Math.round(buttonRect.top - panelRect.top);
    if (Number.isFinite(viewportH) && viewportH > 0) {
        const maxTopOnViewport = viewportH - popoverHeight - margin;
        const absoluteTop = clamp(panelRect.top + top, margin, Math.max(margin, maxTopOnViewport));
        top = Math.round(absoluteTop - panelRect.top);
    }

    let left = Math.round(buttonRect.right - panelRect.left + 10);
    if (Number.isFinite(viewportW) && viewportW > 0) {
        const absoluteLeft = panelRect.left + left;
        const overflowRight = absoluteLeft + popoverWidth > viewportW - margin;
        if (overflowRight) {
            left = Math.round(buttonRect.left - panelRect.left - popoverWidth - 10);
        }
    }

    toolSettingsPopover.style.left = `${left}px`;
    toolSettingsPopover.style.top = `${top}px`;
}

function openToolSettingsPopover(anchorButton, options = {}) {
    if (!toolSettingsPopover || !anchorButton) return;
    const hasContent = applyToolSettingsVisibility(currentTool);
    if (!hasContent) {
        closeToolSettingsPopover();
        return;
    }
    toolSettingsPopover.hidden = false;
    toolSettingsAnchorButton = anchorButton;
    positionToolSettingsPopover(anchorButton);
    activeEditorPopupId = 'tool-settings';
    syncPopupBackdropState();
}

function setTool(toolName) {
    if (isEditingLocked()) return;
    if (!TOOL_SET.has(toolName)) return;

    autoPanSelectionHoverActive = false;
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
    applyToolSettingsVisibility(toolName);
    if (toolSettingsPopover && !toolSettingsPopover.hidden) {
        const anchorButton = getToolButtonByName(toolName) || toolSettingsAnchorButton;
        if (anchorButton) {
            openToolSettingsPopover(anchorButton);
        } else {
            closeToolSettingsPopover();
        }
    }
    updateCursor();
}

function canAutoPanSelectionHover() {
    return currentTool === TOOL_SELECT
        && !isSpacePressed
        && Boolean(selection)
        && selection.type !== SELECT_MAGIC
        && !isSelecting
        && !isTransformingSelection;
}

function setAutoPanSelectionHover(enabled) {
    const nextValue = Boolean(enabled) && canAutoPanSelectionHover();
    if (autoPanSelectionHoverActive === nextValue) return;
    autoPanSelectionHoverActive = nextValue;
    updateCursor();
}

function getEffectiveTool() {
    return autoPanSelectionHoverActive ? TOOL_PAN : currentTool;
}

/**
 * Set the current brush color.
 */
function setColor(colorValue, options = {}) {
    const useSecondary = Boolean(options.secondary);
    if (useSecondary) {
        secondaryColor = colorValue;
        if (secondaryColorInput && secondaryColorInput.value !== colorValue) {
            secondaryColorInput.value = colorValue;
        }
        return;
    }
    currentColor = colorValue;
    if (colorInput && colorInput.value !== colorValue) {
        colorInput.value = colorValue;
    }
}

/**
 * Set the brush size.
 */
function setBrushSize(size) {
    currentSize = size;
}

function setBrushOpacity(value) {
    const parsed = parseInt(value, 10);
    brushOpacity = Number.isNaN(parsed) ? 100 : clamp(parsed, 1, 100);
    if (opacityInput && parseInt(opacityInput.value, 10) !== brushOpacity) {
        opacityInput.value = String(brushOpacity);
    }
}

function setBrushBlur(value) {
    const parsed = parseInt(value, 10);
    brushBlur = Number.isNaN(parsed) ? 0 : clamp(parsed, 0, 40);
    if (blurInput && parseInt(blurInput.value, 10) !== brushBlur) {
        blurInput.value = String(brushBlur);
    }
}

function setSelectionMode(mode) {
    if (isEditingLocked()) return;
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

    if (selectToolIcon) {
        const modeButton = [...selectionModeButtons].find((button) => button.dataset.selectMode === mode) || null;
        const modeIcon = modeButton ? modeButton.querySelector('.tool-icon') : null;
        const nextSrc = modeIcon ? modeIcon.getAttribute('src') : null;
        if (nextSrc) {
            selectToolIcon.setAttribute('src', nextSrc);
        }
    }

    if (wandSensitivityInput) {
        wandSensitivityInput.disabled = mode !== SELECT_MAGIC;
    }
    applyToolSettingsVisibility(currentTool);
    if (toolSettingsPopover && !toolSettingsPopover.hidden && toolSettingsAnchorButton) {
        positionToolSettingsPopover(toolSettingsAnchorButton);
    }
}

function isPlaybackSessionActive() {
    return playbackMode === PLAYBACK_PLAYING || playbackMode === PLAYBACK_PAUSED;
}

function isPlaybackRunning() {
    return playbackMode === PLAYBACK_PLAYING;
}

function isReadOnlyProject() {
    return !projectCanEdit;
}

function isCurrentFrameReadOnly() {
    return isReadOnlyProject() || isCurrentFrameReadOnlyByLock();
}

function isEditingLockedByPlayback() {
    return isPlaybackSessionActive() || playbackStopping;
}

function isEditingLocked() {
    return isCurrentFrameReadOnly() || isEditingLockedByPlayback();
}

function getOrderedTimelineIndexes() {
    const unique = new Set();
    timelineFrames.forEach((frame) => {
        const index = Number(frame && frame.index);
        if (Number.isFinite(index) && index > 0) {
            unique.add(index);
        }
    });
    return [...unique].sort((a, b) => a - b);
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
// Action history
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
    return label;
}

function captureLayerImage(layer) {
    if (!layer || !layer.bufferCtx || !layer.bufferCanvas) return null;
    try {
        return layer.bufferCtx.getImageData(0, 0, layer.bufferCanvas.width, layer.bufferCanvas.height);
    } catch (error) {
        console.warn('Could not save the layer for history', error);
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
        item.textContent = getText(row.label || 'action');
        historyList.appendChild(item);
    }

    // Limit the visible height (5 actions + baseline row) and enable internal scrolling.
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
                console.warn('Could not restore the layer from history', error);
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
            console.warn('Could not restore the layer from history', error);
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
// Layer operations
// =======================

function fillLayerUrl(template, frameIndex, layerId) {
    if (!template) return '';
    let result = template;
    if (typeof frameIndex === 'number' && Number.isFinite(frameIndex)) {
        result = result.replace(/\/frame\/0\//, `/frame/${frameIndex}/`);
    }
    if (typeof layerId === 'number' && Number.isFinite(layerId)) {
        result = result.replace(/\/layers\/0\//, `/layers/${layerId}/`);
    }
    return result;
}

// =======================
// Frame and timeline operations
// =======================

function fillFrameUrl(template, frameIndex) {
    if (!template) return '';
    let result = template;
    if (typeof frameIndex === 'number' && Number.isFinite(frameIndex)) {
        result = result.replace(/\/frame\/0\//, `/frame/${frameIndex}/`);
    }
    return result;
}

function getFrameDetailUrl(index) {
    return fillFrameUrl(frameDetailUrlTemplate, index);
}

function getFrameDeleteUrl(index) {
    return fillFrameUrl(frameDeleteUrlTemplate, index);
}

function shouldDisableTimelineNavigation() {
    return timelineControlsTemporarilyDisabled || isPlaybackSessionActive() || playbackStopping;
}

function shouldDisableTimelineControls() {
    return shouldDisableTimelineNavigation() || isCurrentFrameReadOnly();
}

function syncTimelineControlsState() {
    const areMutationsDisabled = shouldDisableTimelineControls();
    const isNavigationDisabled = shouldDisableTimelineNavigation();
    if (addFrameButton) addFrameButton.disabled = areMutationsDisabled;
    if (duplicateFrameButton) duplicateFrameButton.disabled = areMutationsDisabled;
    if (deleteFrameButton) deleteFrameButton.disabled = areMutationsDisabled;
    if (onionToggleButton) onionToggleButton.disabled = isNavigationDisabled;

    if (timelineStrip) {
        timelineStrip.classList.toggle('timeline-strip--locked', isNavigationDisabled);
        timelineStrip.querySelectorAll('.timeline-frame').forEach((el) => {
            el.draggable = !areMutationsDisabled;
        });
    }
}

function syncToolbarControlsState() {
    const isDisabled = isEditingLocked();
    toolButtons.forEach((button) => {
        button.disabled = isDisabled;
    });
    selectionModeButtons.forEach((button) => {
        button.disabled = isDisabled;
    });
    if (colorInput) colorInput.disabled = isDisabled;
    if (secondaryColorInput) secondaryColorInput.disabled = isDisabled;
    if (sizeInput) sizeInput.disabled = isDisabled;
    if (opacityInput) opacityInput.disabled = isDisabled;
    if (blurInput) blurInput.disabled = isDisabled;
    if (wandSensitivityInput) {
        wandSensitivityInput.disabled = isDisabled || selectionMode !== SELECT_MAGIC;
    }
    if (isDisabled) {
        closeToolSettingsPopover();
    }
}

function syncLayerControlsState() {
    const isDisabled = isEditingLocked();
    if (addLayerButton) addLayerButton.disabled = isDisabled;
    if (!layersList) return;

    layersList.querySelectorAll('.layer-item').forEach((item) => {
        item.draggable = !isDisabled;
        item.classList.toggle('layer-item--locked', isDisabled);
    });
    layersList.querySelectorAll('button, input, select, textarea').forEach((control) => {
        control.disabled = isDisabled;
    });
}

function syncEditorInteractionLockUi() {
    const isReadOnly = isCurrentFrameReadOnly();
    if (editorRoot) {
        editorRoot.dataset.currentUserRole = currentUserRole;
        editorRoot.classList.toggle('editor-root--playback', isEditingLockedByPlayback());
        editorRoot.classList.toggle('editor-root--readonly', isReadOnly);
        editorRoot.classList.toggle('editor-root--can-manage-members', projectCanManageMembers);
    }
    syncToolbarControlsState();
    syncLayerControlsState();
    syncTimelineControlsState();
}

function setTimelineControlsDisabled(isDisabled) {
    timelineControlsTemporarilyDisabled = Boolean(isDisabled);
    syncTimelineControlsState();
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
    const workspaceWidth = canvas.width;
    const workspaceHeight = canvas.height;
    const frameWidth = projectFrameWidth;
    const frameHeight = projectFrameHeight;

    layers.forEach((layer) => {
        ensureLayerCanvases(layer);
        if (layer.canvas.width !== workspaceWidth) {
            layer.canvas.width = workspaceWidth;
        }
        if (layer.canvas.height !== workspaceHeight) {
            layer.canvas.height = workspaceHeight;
        }
        if (layer.bufferCanvas.width !== frameWidth) {
            layer.bufferCanvas.width = frameWidth;
        }
        if (layer.bufferCanvas.height !== frameHeight) {
            layer.bufferCanvas.height = frameHeight;
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
    const frameOrigin = getFrameOrigin();
    layer.ctx.save();
    layer.ctx.setTransform(
        scale,
        0,
        0,
        scale,
        offsetX + frameOrigin.x * scale,
        offsetY + frameOrigin.y * scale,
    );
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
        opacityWrap.innerHTML = `<span>${getText('opacity')}</span>`;
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
        visibilityButton.title = layer.visible ? getText('hide_layer') : getText('show_layer');
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
        renameButton.title = getText('rename_layer');
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
        deleteButton.title = getText('delete_layer');
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
        saveRename.textContent = getText('save');
        const cancelRename = document.createElement('button');
        cancelRename.type = 'button';
        cancelRename.className = 'layer-action';
        cancelRename.dataset.action = 'rename-cancel';
        cancelRename.textContent = getText('cancel');
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
    syncLayerControlsState();
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
            throw new Error('Could not load layers.');
        }
        mergeLayerList(data.layers || []);
    } catch (error) {
        console.error('Layer loading error', error);
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
    if (isEditingLocked()) return;
    const listUrl = getLayerListUrl();
    if (!listUrl) return;
    beginFullHistory('layer_add');
    const clientRequestId = createProjectEventRequestId();
    rememberLocalProjectEventRequest(clientRequestId);
    try {
        const response = await fetch(listUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ client_request_id: clientRequestId }),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Could not create layer.');
        }
        const layer = addLayerFromPayload(data.layer);
        applyAllLayerStyles();
        setActiveLayer(layer.id);
        renderScene();
        commitFullHistory();
    } catch (error) {
        forgetLocalProjectEventRequest(clientRequestId);
        cancelPendingHistory();
        console.error('Layer creation error', error);
    }
}

async function updateLayer(layerId, updates) {
    if (isEditingLocked()) return null;
    const url = getLayerUpdateUrl(layerId);
    if (!url) return null;
    const clientRequestId = createProjectEventRequestId();
    rememberLocalProjectEventRequest(clientRequestId);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                ...(updates || {}),
                client_request_id: clientRequestId,
            }),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Could not update layer.');
        }
        return data.layer || null;
    } catch (error) {
        forgetLocalProjectEventRequest(clientRequestId);
        console.error('Layer update error', error);
        return null;
    }
}

async function deleteLayer(layerId) {
    if (isEditingLocked()) return;
    const url = getLayerDeleteUrl(layerId);
    if (!url) return;
    beginFullHistory('layer_delete');
    const clientRequestId = createProjectEventRequestId();
    rememberLocalProjectEventRequest(clientRequestId);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ client_request_id: clientRequestId }),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Could not delete layer.');
        }
        mergeLayerList(data.layers || []);
        commitFullHistory();
    } catch (error) {
        forgetLocalProjectEventRequest(clientRequestId);
        cancelPendingHistory();
        console.error('Layer deletion error', error);
    }
}

async function saveLayerOrder(orderedIds) {
    const url = getLayerReorderUrl();
    if (!url) return;
    const clientRequestId = createProjectEventRequestId();
    rememberLocalProjectEventRequest(clientRequestId);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                ordered_ids: orderedIds,
                client_request_id: clientRequestId,
            }),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Could not save layer order.');
        }
        mergeLayerList(data.layers || []);
        commitFullHistory();
    } catch (error) {
        forgetLocalProjectEventRequest(clientRequestId);
        cancelPendingHistory();
        console.error('Layer order save error', error);
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
    const explicitColor = typeof options.color === 'string' ? options.color : null;
    const strokeColor = useEraser ? '#000000' : (explicitColor || currentColor);
    const opacity = Number.isFinite(options.opacity) ? clamp(options.opacity, 0, 1) : 1;
    const blurStrength = Number.isFinite(options.blur) ? Math.max(0, options.blur) : 0;
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    targetCtx.lineWidth = currentSize;
    targetCtx.strokeStyle = strokeColor;
    targetCtx.globalCompositeOperation = useEraser ? 'destination-out' : 'source-over';
    targetCtx.globalAlpha = opacity;
    if (!useEraser && blurStrength > 0) {
        targetCtx.shadowBlur = blurStrength;
        targetCtx.shadowColor = strokeColor;
    } else {
        targetCtx.shadowBlur = 0;
        targetCtx.shadowColor = 'transparent';
    }
}

function clearCanvas(targetCtx, targetCanvas) {
    if (!targetCtx || !targetCanvas) return;
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
}

function withTransformedContext(targetCtx, callback, options = {}) {
    if (!targetCtx) return;
    const frameOrigin = getFrameOrigin();
    targetCtx.save();
    targetCtx.setTransform(
        scale,
        0,
        0,
        scale,
        offsetX + frameOrigin.x * scale,
        offsetY + frameOrigin.y * scale,
    );
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
            if (bounds && bounds.width > 0 && bounds.height > 0) {
                drawSelectionTransformControls(overlayCtx, bounds);
            }
        }
    });
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
    const workspaceSize = getWorkspaceCanvasSize();
    canvas.width = workspaceSize.width;
    canvas.height = workspaceSize.height;
    const width = canvas.width;
    const height = canvas.height;

    if (playbackPreviewCanvas) {
        playbackPreviewCanvas.width = width;
        playbackPreviewCanvas.height = height;
    }
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
    if (playbackPreviewCanvas) {
        playbackPreviewCanvas.style.width = `${rect.width}px`;
        playbackPreviewCanvas.style.height = `${rect.height}px`;
        playbackPreviewCanvas.style.left = `${canvas.offsetLeft}px`;
        playbackPreviewCanvas.style.top = `${canvas.offsetTop}px`;
    }
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

function getCanvasDisplayFitSize() {
    if (!canvas) return null;

    const availableSize = getCanvasStageAvailableDisplaySize();
    if (!availableSize) return null;

    if (isCanvasStageFullscreen && fullscreenCanvasDisplayScale) {
        return {
            width: Math.max(1, Math.floor(canvas.width * fullscreenCanvasDisplayScale)),
            height: Math.max(1, Math.floor(canvas.height * fullscreenCanvasDisplayScale)),
        };
    }

    const widthRatio = availableSize.width / Math.max(1, canvas.width);
    const heightRatio = availableSize.height / Math.max(1, canvas.height);
    const displayScale = Math.max(0.1, Math.min(widthRatio, heightRatio));

    return {
        width: Math.max(1, Math.floor(canvas.width * displayScale)),
        height: Math.max(1, Math.floor(canvas.height * displayScale)),
    };
}

function getWorkspacePadding() {
    const ratio = 0.18;
    const minPadding = 96;
    return {
        x: Math.max(minPadding, Math.round(projectFrameWidth * ratio)),
        y: Math.max(minPadding, Math.round(projectFrameHeight * ratio)),
    };
}

function getCanvasStageAvailableDisplaySize() {
    if (!editorMain || !canvasStage || !canvasWrapper) return null;

    const stageRect = canvasStage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return null;

    const wrapperStyles = window.getComputedStyle(canvasWrapper);
    const wrapperPaddingX = toPxNumber(wrapperStyles.paddingLeft) + toPxNumber(wrapperStyles.paddingRight);
    const wrapperPaddingY = toPxNumber(wrapperStyles.paddingTop) + toPxNumber(wrapperStyles.paddingBottom);
    const wrapperBorderX = toPxNumber(wrapperStyles.borderLeftWidth) + toPxNumber(wrapperStyles.borderRightWidth);
    const wrapperBorderY = toPxNumber(wrapperStyles.borderTopWidth) + toPxNumber(wrapperStyles.borderBottomWidth);

    const outerPaddingX = isCanvasStageFullscreen ? 24 : 40;
    const outerPaddingY = isCanvasStageFullscreen ? 24 : 40;
    return {
        width: Math.max(
            160,
            Math.floor(stageRect.width - outerPaddingX - wrapperPaddingX - wrapperBorderX),
        ),
        height: Math.max(
            160,
            Math.floor(stageRect.height - outerPaddingY - wrapperPaddingY - wrapperBorderY),
        ),
    };
}

function getCurrentCanvasDisplayScale() {
    if (!canvas || !canvas.width) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return rect.width / canvas.width;
}

function getWorkspaceCanvasSize() {
    const padding = getWorkspacePadding();
    const baseSize = {
        width: projectFrameWidth + padding.x * 2,
        height: projectFrameHeight + padding.y * 2,
    };

    if (!isCanvasStageFullscreen || !fullscreenCanvasDisplayScale) {
        return baseSize;
    }

    const availableSize = getCanvasStageAvailableDisplaySize();
    if (!availableSize) {
        return baseSize;
    }

    return {
        width: Math.max(
            baseSize.width,
            Math.floor(availableSize.width / fullscreenCanvasDisplayScale),
        ),
        height: Math.max(
            baseSize.height,
            Math.floor(availableSize.height / fullscreenCanvasDisplayScale),
        ),
    };
}

function getFrameOrigin() {
    const workspace = getWorkspaceCanvasSize();
    return {
        x: Math.floor((workspace.width - projectFrameWidth) / 2),
        y: Math.floor((workspace.height - projectFrameHeight) / 2),
    };
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
 * Fit the visible canvas height to the available screen space
 * so the toolbar and timeline still fit on screen.
 */
function syncResponsiveCanvasSize() {
    if (!canvas) return;

    const fitSize = getCanvasDisplayFitSize();
    if (!fitSize) return;

    canvas.style.width = `${fitSize.width}px`;
    canvas.style.height = `${fitSize.height}px`;
}

function syncCanvasStageUi() {
    if (editorMain) {
        editorMain.classList.toggle('editor-main--canvas-fullscreen', isCanvasStageFullscreen);
    }
    if (canvasStage) {
        canvasStage.classList.toggle('canvas-stage--fullscreen', isCanvasStageFullscreen);
    }
    if (toggleCanvasFullscreenButton) {
        toggleCanvasFullscreenButton.textContent = isCanvasStageFullscreen ? 'Exit fullscreen' : 'Fullscreen';
        toggleCanvasFullscreenButton.setAttribute(
            'title',
            isCanvasStageFullscreen
                ? 'Return canvas to the regular stage size'
                : 'Expand canvas to the full editor area',
        );
    }
}

function resetCanvasViewport() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    renderScene();
    renderOverlay();
    updateCursor();
}

function fitCanvasViewportToFrame() {
    if (!canvas) return;

    const frameOrigin = getFrameOrigin();
    const targetScaleX = canvas.width / Math.max(1, projectFrameWidth);
    const targetScaleY = canvas.height / Math.max(1, projectFrameHeight);
    const targetScale = Math.max(0.1, Math.min(targetScaleX, targetScaleY));
    const targetLeft = (canvas.width - projectFrameWidth * targetScale) / 2;
    const targetTop = (canvas.height - projectFrameHeight * targetScale) / 2;

    scale = targetScale;
    offsetX = targetLeft - frameOrigin.x * targetScale;
    offsetY = targetTop - frameOrigin.y * targetScale;

    renderScene();
    renderOverlay();
    updateCursor();
}

function bindCanvasStageEvents() {
    if (resetCanvasViewButton) {
        resetCanvasViewButton.addEventListener('click', () => {
            resetCanvasViewport();
        });
    }

    if (fitCanvasFrameButton) {
        fitCanvasFrameButton.addEventListener('click', () => {
            fitCanvasViewportToFrame();
        });
    }

    if (toggleCanvasFullscreenButton) {
        toggleCanvasFullscreenButton.addEventListener('click', () => {
            const previousDisplayScale = getCurrentCanvasDisplayScale();
            isCanvasStageFullscreen = !isCanvasStageFullscreen;
            fullscreenCanvasDisplayScale = isCanvasStageFullscreen ? previousDisplayScale : null;
            syncCanvasStageUi();
            syncCanvasSizes();
            syncEditorLayout();
            renderScene();
            renderOverlay();
        });
    }
}

function syncEditorLayout() {
    syncResponsiveCanvasSize();
    // Let the browser recalculate layout, then sync overlays and layers.
    requestAnimationFrame(() => {
        syncOverlayPlacement();
        hydratePanelPositions();
    });
}

function updateCursor() {
    if (!canvas) return;
    const activeTool = getEffectiveTool();
    const isPanMode = isSpacePressed || activeTool === TOOL_PAN || isPanning;
    canvas.classList.toggle('canvas--bucket', activeTool === TOOL_FILL && !isPanMode);
    canvas.classList.toggle('canvas--pan', isPanMode);
    canvas.classList.toggle('canvas--panning', isPanning);
}

// =======================
// Drawing helpers
// =======================

/**
 * Start drawing.
 */
function startDrawing(x, y, toolName) {
    isDrawing = true;
    activeTool = toolName;
    activeStrokeColor = getColorByMouseButton(activePointerButton);
    activeStrokeOpacity = toolName === TOOL_BRUSH ? (brushOpacity / 100) : 1;
    activeStrokeBlur = toolName === TOOL_BRUSH ? brushBlur : 0;
    lastX = x;
    lastY = y;
    startX = x;
    startY = y;

    if (toolName === TOOL_BRUSH || toolName === TOOL_ERASER || isShapeTool(toolName)) {
        beginLayerHistory(getToolHistoryLabel(toolName));
    }

    if (toolName === TOOL_BRUSH) {
        didDrawStroke = true;
        lastDrawTool = toolName;
        markUnsavedChanges();
        beginBrushStroke(x, y);
        return;
    }

    if (toolName === TOOL_ERASER) {
        didDrawStroke = true;
        lastDrawTool = toolName;
        markUnsavedChanges();
        drawStrokeSegment(x, y, x, y, toolName, {
            color: activeStrokeColor,
            opacity: activeStrokeOpacity,
            blur: activeStrokeBlur,
        });
    }
}

/**
 * Continue drawing by connecting the previous point to the new one.
 */
function continueDrawing(x, y) {
    if (!isDrawing) return;

    if (activeTool === TOOL_BRUSH) {
        const target = isShiftPressed ? getSnappedPoint(startX, startY, x, y) : { x, y };
        appendBrushStrokePoint(target.x, target.y);
        lastX = target.x;
        lastY = target.y;
        return;
    }

    if (activeTool === TOOL_ERASER) {
        const target = isShiftPressed ? getSnappedPoint(startX, startY, x, y) : { x, y };
        drawStrokeSegment(lastX, lastY, target.x, target.y, activeTool, {
            color: activeStrokeColor,
            opacity: activeStrokeOpacity,
            blur: activeStrokeBlur,
        });
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
 * Finish drawing.
 */
function stopDrawing() {
    isDrawing = false;
    activePointerButton = 0;
    activeStrokeOpacity = 1;
    activeStrokeBlur = 0;
    brushStampCarryDistance = 0;
    if (didDrawStroke && (lastDrawTool === TOOL_BRUSH || lastDrawTool === TOOL_ERASER)) {
        commitLayerHistory();
    }
    didDrawStroke = false;
    lastDrawTool = null;
    activeTool = null;
}

function toRgbaCss(hex, alpha = 1) {
    const [r, g, b] = hexToRgba(hex);
    return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function computeBrushStampAlpha(targetOpacity, radius, spacing) {
    const normalizedOpacity = clamp(targetOpacity, 0, 1);
    if (normalizedOpacity <= 0 || radius <= 0 || spacing <= 0) {
        return 0;
    }
    if (normalizedOpacity >= 1) {
        return 1;
    }
    const overlapCount = Math.max(1, Math.ceil((radius * 2) / spacing));
    return 1 - Math.pow(1 - normalizedOpacity, 1 / overlapCount);
}

function ensureBrushStampCanvas(size) {
    if (!brushStampCanvas) {
        brushStampCanvas = document.createElement('canvas');
    }
    if (brushStampCanvas.width !== size || brushStampCanvas.height !== size) {
        brushStampCanvas.width = size;
        brushStampCanvas.height = size;
        brushStampCtx = brushStampCanvas.getContext('2d');
    }
    if (!brushStampCtx) {
        brushStampCtx = brushStampCanvas.getContext('2d');
    }
    return Boolean(brushStampCtx);
}

function rebuildBrushStamp() {
    const radius = Math.max(0.75, currentSize / 2);
    const softness = clamp(activeStrokeBlur / 40, 0, 1);
    const spacingFactor = softness > 0 ? 0.32 : 0.5;
    const spacing = Math.max(1, radius * spacingFactor);
    const stampAlpha = computeBrushStampAlpha(activeStrokeOpacity, radius, spacing);
    const size = Math.max(4, Math.ceil(radius * 2 + 6));

    if (!ensureBrushStampCanvas(size) || !brushStampCtx) return false;

    brushStampRadius = radius;
    brushStampSpacing = spacing;

    clearCanvas(brushStampCtx, brushStampCanvas);

    const center = size / 2;
    const innerRadius = radius * Math.max(0, 1 - softness * 0.92);
    const colorSolid = toRgbaCss(activeStrokeColor, stampAlpha);
    const colorTransparent = toRgbaCss(activeStrokeColor, 0);

    brushStampCtx.save();
    brushStampCtx.fillStyle = colorSolid;
    if (softness <= 0.001 || innerRadius >= radius - 0.25) {
        brushStampCtx.beginPath();
        brushStampCtx.arc(center, center, radius, 0, Math.PI * 2);
        brushStampCtx.fill();
    } else {
        const gradient = brushStampCtx.createRadialGradient(
            center,
            center,
            Math.max(0, innerRadius),
            center,
            center,
            radius,
        );
        const innerStop = clamp(innerRadius / radius, 0, 0.98);
        gradient.addColorStop(0, colorSolid);
        gradient.addColorStop(innerStop, colorSolid);
        gradient.addColorStop(1, colorTransparent);
        brushStampCtx.fillStyle = gradient;
        brushStampCtx.beginPath();
        brushStampCtx.arc(center, center, radius, 0, Math.PI * 2);
        brushStampCtx.fill();
    }
    brushStampCtx.restore();
    return true;
}

function drawBrushStampAt(targetCtx, x, y) {
    if (!targetCtx || !brushStampCanvas) return;
    const offset = brushStampCanvas.width / 2;
    targetCtx.drawImage(brushStampCanvas, x - offset, y - offset);
}

function drawBrushStampPoint(x, y) {
    if (!brushStampCanvas) return;
    drawBufferWithSelection((targetCtx) => {
        drawBrushStampAt(targetCtx, x, y);
    });

    if (!ctx || !canvas) return;
    if (selection && selection.type === SELECT_MAGIC) {
        renderScene();
        return;
    }

    withTransformedContext(ctx, () => {
        drawBrushStampAt(ctx, x, y);
    }, { clipToFrame: true, clipToSelection: true });
}

function drawBrushSegment(fromX, fromY, toX, toY) {
    if (!brushStampCanvas) return;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength <= 0) return;

    const unitX = dx / segmentLength;
    const unitY = dy / segmentLength;
    const positions = [];
    let distance = brushStampSpacing - brushStampCarryDistance;

    while (distance <= segmentLength) {
        positions.push({
            x: fromX + unitX * distance,
            y: fromY + unitY * distance,
        });
        distance += brushStampSpacing;
    }

    brushStampCarryDistance = (brushStampCarryDistance + segmentLength) % brushStampSpacing;

    if (!positions.length) return;

    drawBufferWithSelection((targetCtx) => {
        positions.forEach((point) => {
            drawBrushStampAt(targetCtx, point.x, point.y);
        });
    });

    if (!ctx || !canvas) return;
    if (selection && selection.type === SELECT_MAGIC) {
        renderScene();
        return;
    }

    withTransformedContext(ctx, () => {
        positions.forEach((point) => {
            drawBrushStampAt(ctx, point.x, point.y);
        });
    }, { clipToFrame: true, clipToSelection: true });
}

function beginBrushStroke(x, y) {
    if (!bufferCtx || !bufferCanvas) return;
    if (!rebuildBrushStamp()) return;
    brushStampCarryDistance = 0;
    drawBrushStampPoint(x, y);
}

function appendBrushStrokePoint(x, y) {
    drawBrushSegment(lastX, lastY, x, y);
}

function drawStrokeSegment(fromX, fromY, toX, toY, toolName, options = {}) {
    if (!bufferCtx || !bufferCanvas) return;
    const useEraser = toolName === TOOL_ERASER;
    const strokeColor = typeof options.color === 'string' ? options.color : activeStrokeColor;
    const strokeOpacity = Number.isFinite(options.opacity) ? clamp(options.opacity, 0, 1) : activeStrokeOpacity;
    const strokeBlur = Number.isFinite(options.blur) ? Math.max(0, options.blur) : activeStrokeBlur;
    const isMagicErase = useEraser && selection && selection.type === SELECT_MAGIC && selection.maskCanvas;

    drawBufferWithSelection((targetCtx) => {
        targetCtx.save();
        applyStrokeStyles(targetCtx, {
            useEraser: isMagicErase ? false : useEraser,
            color: strokeColor,
            opacity: strokeOpacity,
            blur: strokeBlur,
        });
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
        applyStrokeStyles(ctx, {
            useEraser,
            color: strokeColor,
            opacity: strokeOpacity,
            blur: strokeBlur,
        });
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
        applyStrokeStyles(targetCtx, { useEraser: false, color: activeStrokeColor });
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
        applyStrokeStyles(targetCtx, { useEraser: false, color: activeStrokeColor });
        drawShapePath(targetCtx, activeTool, startX, startY, lastX, lastY);
        targetCtx.stroke();
        targetCtx.restore();
    });

    if (selection && selection.type === SELECT_MAGIC) {
        renderScene();
    } else {
        withTransformedContext(ctx, () => {
            ctx.save();
            applyStrokeStyles(ctx, { useEraser: false, color: activeStrokeColor });
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

function alignRasterBoundsToPixelGrid(x, y, width, height) {
    const left = Math.floor(x);
    const top = Math.floor(y);
    const right = Math.ceil(x + width);
    const bottom = Math.ceil(y + height);
    return {
        x: left,
        y: top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
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
    return (currentTool === TOOL_PAN || currentTool === TOOL_SELECT || autoPanSelectionHoverActive)
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
        nw: 'Resize: top-left corner',
        n: 'Resize: top edge',
        ne: 'Resize: top-right corner',
        e: 'Resize: right edge',
        se: 'Resize: bottom-right corner',
        s: 'Resize: bottom edge',
        sw: 'Resize: bottom-left corner',
        w: 'Resize: left edge',
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
    if (!bounds) return bounds;
    return {
        x: bounds.x,
        y: bounds.y,
        width: Math.max(0, bounds.width),
        height: Math.max(0, bounds.height),
    };
}

function snapMoveBoundsToPixels(bounds) {
    if (!bounds) return bounds;
    return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: bounds.width,
        height: bounds.height,
    };
}

function getResizedBoundsFromHandle(startBounds, handleId, deltaX, deltaY) {
    if (!startBounds) return startBounds;
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
        left = Math.min(left, right - minSize);
    }
    if (moveRight) {
        right = Math.max(right, left + minSize);
    }
    if (moveTop) {
        top = Math.min(top, bottom - minSize);
    }
    if (moveBottom) {
        bottom = Math.max(bottom, top + minSize);
    }

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
    setAutoPanSelectionHover(false);
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
    const bounds = selectionTransform.currentBounds || getSelectionBounds(selection);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return false;
    const selectionClone = cloneSelectionShape(selection);
    if (!selectionClone) return false;

    selectionTransform.mode = mode;
    selectionTransform.handleId = handleId || null;
    selectionTransform.startPointerX = startX;
    selectionTransform.startPointerY = startY;
    selectionTransform.startBounds = bounds;
    selectionTransform.currentBounds = bounds;
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
        ? (selectionTransform.currentBounds || getSelectionBounds(selection))
        : getSelectionBounds(selection);
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
        nextBounds = snapMoveBoundsToPixels(clampMoveBoundsToCanvas(moved));
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
        setAutoPanSelectionHover(false);
        if (hoverTransformHandle) {
            hoverTransformHandle = null;
            renderOverlay();
        }
        hideTransformHint();
        setCanvasCursorOverride(null);
        return;
    }

    const bounds = hasFloatingSelection()
        ? (selectionTransform.currentBounds || getSelectionBounds(selection))
        : getSelectionBounds(selection);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        setAutoPanSelectionHover(false);
        hideTransformHint();
        setCanvasCursorOverride(null);
        return;
    }

    const handleId = getTransformHandleAtPoint(x, y, bounds);
    if (handleId) {
        setAutoPanSelectionHover(currentTool === TOOL_SELECT);
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
        setAutoPanSelectionHover(currentTool === TOOL_SELECT);
        setCanvasCursorOverride(null);
        showTransformHint('Move: drag the selection with the mouse', event);
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
    setAutoPanSelectionHover(false);
    hideTransformHint();
    setCanvasCursorOverride(null);
}

function buildSelectionClipboardCanvas(selectionShape = selection) {
    if (!selectionShape || !bufferCanvas) return null;
    const sourceCanvas = hasFloatingSelection() ? (getActiveLayerCompositeCanvas() || bufferCanvas) : bufferCanvas;
    const bounds = getSelectionBounds(selectionShape);
    const clampedBounds = clampSelectionBounds(bounds);
    if (!clampedBounds || clampedBounds.width <= 0 || clampedBounds.height <= 0) {
        return null;
    }

    const clipboardCanvas = document.createElement('canvas');
    clipboardCanvas.width = Math.ceil(clampedBounds.width);
    clipboardCanvas.height = Math.ceil(clampedBounds.height);
    const clipboardCtx = clipboardCanvas.getContext('2d');
    if (!clipboardCtx) return null;

    if (selectionShape.type === SELECT_MAGIC && selectionShape.maskCanvas) {
        clipboardCtx.drawImage(bufferCanvas, -clampedBounds.x, -clampedBounds.y);
        clipboardCtx.globalCompositeOperation = 'destination-in';
        clipboardCtx.drawImage(selectionShape.maskCanvas, -clampedBounds.x, -clampedBounds.y);
        clipboardCtx.globalCompositeOperation = 'source-over';
    } else {
        clipboardCtx.save();
        clipboardCtx.translate(-clampedBounds.x, -clampedBounds.y);
        appendSelectionPath(clipboardCtx, selectionShape);
        clipboardCtx.clip();
        clipboardCtx.drawImage(sourceCanvas, 0, 0);
        clipboardCtx.restore();
    }

    return {
        canvas: clipboardCanvas,
        bounds: clampedBounds,
    };
}

function canvasToBlob(canvas, type = 'image/png') {
    return new Promise((resolve) => {
        if (!canvas || typeof canvas.toBlob !== 'function') {
            resolve(null);
            return;
        }
        canvas.toBlob((blob) => resolve(blob), type);
    });
}

async function copySelectionImageToSystemClipboard(clipboardEntry = selectionClipboard) {
    if (!clipboardEntry || !clipboardEntry.canvas) return false;
    if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || typeof ClipboardItem === 'undefined') {
        return false;
    }

    try {
        const blob = await canvasToBlob(clipboardEntry.canvas, 'image/png');
        if (!blob) return false;
        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': blob,
            }),
        ]);
        if (selectionClipboard === clipboardEntry) {
            clipboardEntry.systemImage = {
                type: blob.type || 'image/png',
                size: blob.size,
                width: clipboardEntry.width,
                height: clipboardEntry.height,
            };
        }
        return true;
    } catch (error) {
        if (selectionClipboard === clipboardEntry) {
            clipboardEntry.systemImage = null;
        }
        console.warn('Could not copy the selection image to the system clipboard.', error);
        return false;
    }
}

function copySelectionToClipboard() {
    if (!selection || !bufferCanvas) return false;
    const clipboardCapture = buildSelectionClipboardCanvas(selection);
    if (!clipboardCapture || !clipboardCapture.canvas) return false;
    const clipboardCanvas = clipboardCapture.canvas;
    const clampedBounds = clipboardCapture.bounds;

    selectionClipboard = {
        canvas: clipboardCanvas,
        width: clipboardCanvas.width,
        height: clipboardCanvas.height,
        originX: clampedBounds.x,
        originY: clampedBounds.y,
        selection: selection.type === SELECT_MAGIC ? null : cloneSelectionShape(selection),
        systemImage: null,
    };
    return true;
}

function getFrameImageSourceSize(image) {
    if (!image) return null;
    const sourceWidth = Math.min(
        projectFrameWidth,
        image.naturalWidth || image.width || 0,
    );
    const sourceHeight = Math.min(
        projectFrameHeight,
        image.naturalHeight || image.height || 0,
    );
    if (!sourceWidth || !sourceHeight) return null;
    return {
        width: sourceWidth,
        height: sourceHeight,
    };
}

function drawFrameImageToContext(targetCtx, image, dx, dy, dWidth, dHeight) {
    if (!targetCtx || !image) return false;
    const sourceSize = getFrameImageSourceSize(image);
    if (!sourceSize) return false;
    targetCtx.drawImage(
        image,
        0,
        0,
        sourceSize.width,
        sourceSize.height,
        dx,
        dy,
        dWidth,
        dHeight,
    );
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

function deleteSelectionContent() {
    if (!selection || !bufferCtx || !bufferCanvas) return false;

    if (hasFloatingSelection()) {
        if (historyPending && historyPending.type === 'layer') {
            historyPending.label = 'delete';
        }
        markUnsavedChanges();
        commitLayerHistory();
        resetSelectionTransformState();
        renderScene();
        renderOverlay();
        return true;
    }

    beginLayerHistory('delete');
    const didClear = clearSelectionContent();
    if (didClear) {
        commitLayerHistory();
    } else {
        cancelPendingHistory();
    }
    return didClear;
}

function cutSelectionToClipboard() {
    const didCopy = copySelectionToClipboard();
    if (!didCopy) return false;
    void copySelectionImageToSystemClipboard(selectionClipboard);
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
    pasteX = Math.round(pasteX);
    pasteY = Math.round(pasteY);

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
    setAutoPanSelectionHover(false);
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

function resolveActiveSelectionForNewGesture() {
    if (!selection && !selectionDraft && !hasFloatingSelection()) {
        return false;
    }
    clearSelection();
    return true;
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
// Canvas coordinate helpers
// =======================

/**
 * Convert mouse coordinates into the canvas coordinate system.
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
    // `offsetX/offsetY` are only reliable when the target is the canvas itself.
    // During drags outside the canvas the event target may become document/body/etc,
    // which makes offsets jump and causes odd shape or selection behavior.
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
    const frameOrigin = getFrameOrigin();
    const x = (rawX - offsetX) / normalizedScale - frameOrigin.x;
    const y = (rawY - offsetY) / normalizedScale - frameOrigin.y;
    return { x, y };
}

function pickColorAt(x, y, options = {}) {
    if (!bufferCtx || !bufferCanvas) return;
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || py < 0 || px >= bufferCanvas.width || py >= bufferCanvas.height) {
        return;
    }
    const pixel = bufferCtx.getImageData(px, py, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    const useSecondary = Boolean(options.secondary);
    if (useSecondary) {
        if (secondaryColorInput) {
            secondaryColorInput.value = hex;
        }
        setColor(hex, { secondary: true });
        return;
    }
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

function floodFill(startX, startY, options = {}) {
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
    const fillColorHex = typeof options.color === 'string' ? options.color : currentColor;
    const fillColor = hexToRgba(fillColorHex);

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
// Project saving
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
        return getText('a_few_seconds_ago');
    }
    if (diffSeconds < 60) {
        return getText('seconds_ago', { count: diffSeconds });
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
        return getText('minutes_ago', { count: diffMinutes });
    }

    const diffHours = Math.floor(diffMinutes / 60);
    return getText('hours_ago', { count: diffHours });
}

function updateLastSavedLabel() {
    if (!lastSavedLabel) return;

    if (!lastSavedAt) {
        lastSavedLabel.textContent = '';
        return;
    }

    const agoText = formatTimeAgo(lastSavedAt);
    lastSavedLabel.textContent = getText('last_saved_label', { time: agoText });
}

function updateSaveButtonState() {
    if (!saveButton) return;
    if (isCurrentFrameReadOnly()) {
        saveButton.disabled = true;
        return;
    }
    saveButton.disabled = isSaving || isAutosaving || !hasUnsavedChanges;
}

/**
 * Mark that the project has unsaved changes.
 */
function markUnsavedChanges() {
    if (isCurrentFrameReadOnly()) return;
    if (hasUnsavedChanges) return;

    hasUnsavedChanges = true;
    setSaveIndicator('dirty');
    setSaveStatus(getText('unsaved_changes'), 'dirty');
    updateSaveButtonState();
}

function initSaveState() {
    setSaveIndicator('idle');
    if (isCurrentFrameReadOnly()) {
        setSaveStatus(getCurrentFrameEditingState().text);
    } else {
        setSaveStatus(getText('no_changes'));
    }
    updateLastSavedLabel();
    updateSaveButtonState();
}

function syncProjectFpsUi() {
    if (editorRoot) {
        editorRoot.dataset.projectFps = String(projectFps);
    }
    if (playbackFpsInput) {
        playbackFpsInput.value = String(projectFps);
    }
    if (exportFpsInput) {
        exportFpsInput.value = String(projectFps);
    }
}

function syncPlaybackFpsControlState() {
    if (!playbackFpsInput) return;
    playbackFpsInput.disabled = isCurrentFrameReadOnly() || isUpdatingProjectFps;
}

async function updateProjectFpsOnServer(nextFps) {
    if (isCurrentFrameReadOnly()) {
        setSaveStatus(getCurrentFrameEditingState().text, 'error');
        setSaveIndicator('error');
        return false;
    }
    if (!projectUpdateUrl) {
        setSaveStatus(getText('project_fps_update_failed'), 'error');
        setSaveIndicator('error');
        return false;
    }

    if (isUpdatingProjectFps) return false;

    isUpdatingProjectFps = true;
    syncPlaybackFpsControlState();
    setSaveStatus(getText('project_fps_updating'), 'saving');
    setSaveIndicator('saving');

    try {
        const response = await fetch(projectUpdateUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ fps: nextFps }),
        });

        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        if (!response.ok || !data || !data.ok || !data.project) {
            const errorMessage = data && data.error ? data.error : getText('project_fps_update_failed');
            throw new Error(errorMessage);
        }

        projectFps = Number(data.project.fps) || projectFps;
        syncProjectFpsUi();
        lastSavedAt = new Date();
        updateLastSavedLabel();

        if (isPlaybackSessionActive()) {
            playbackAccumulatedMs = 0;
            playbackLastTickAt = performance.now();
            setPlaybackAudioToCurrentFrame();
        }

        if (hasUnsavedChanges) {
            setSaveStatus(getText('unsaved_changes'), 'dirty');
            setSaveIndicator('dirty');
        } else {
            setSaveStatus(getText('project_fps_updated'), 'saved');
            setSaveIndicator('saved');
        }

        updatePlaybackControlsState();
        return true;
    } catch (error) {
        console.error('Project FPS update error', error);
        let errorText = getText('project_fps_update_failed');
        if (error instanceof Error && error.message) {
            if (error.message === 'invalid_fps') {
                errorText = getText('project_fps_invalid');
            } else if (error.message !== 'Failed to fetch') {
                errorText = error.message;
            }
        }
        if (error instanceof Error && error.message === 'Failed to fetch') {
            errorText = 'Could not reach the server.';
        }
        if (playbackFpsInput) {
            playbackFpsInput.value = String(projectFps);
        }
        setSaveStatus(errorText, 'error');
        setSaveIndicator('error');
        updatePlaybackControlsState();
        return false;
    } finally {
        isUpdatingProjectFps = false;
        syncPlaybackFpsControlState();
    }
}

async function commitPlaybackFpsInputValue() {
    if (!playbackFpsInput) return false;
    const parsed = parseInt(playbackFpsInput.value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        playbackFpsInput.value = String(projectFps);
        setSaveStatus(getText('project_fps_invalid'), 'error');
        setSaveIndicator('error');
        return false;
    }

    const normalized = clamp(parsed, 1, 60);
    playbackFpsInput.value = String(normalized);
    if (normalized === projectFps) {
        syncProjectFpsUi();
        return true;
    }

    return updateProjectFpsOnServer(normalized);
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

function loadImageAsync(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('image_load_failed'));
        image.src = src;
    });
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
        // localStorage may be unavailable (private mode, blocked storage, etc.).
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
        // localStorage may be unavailable.
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
        if (activeEditorPopupId === 'onion') {
            activeEditorPopupId = null;
        }
    } else {
        // Keep panel placement in sync because canvases may be hidden or shown.
        syncOverlayPlacement();
        activeEditorPopupId = 'onion';
    }
    if (onionEnabled && onionPanel) {
        // Hide visually but keep the element in layout so measurements remain valid.
        onionPanel.style.visibility = 'hidden';
    }
    syncOnionUI();
    syncPopupBackdropState();
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
    // If the timeline already has a preview, that is enough for onion-skin,
    // so skip an extra detail request.
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

    // Reuse values from the timeline when possible because it is faster than the API.
    // If they change, reset the image so it can be reloaded.
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
            // After the detail request completes, try loading the image again.
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
    const frameOrigin = getFrameOrigin();

    targetCtx.save();
    targetCtx.setTransform(
        scale,
        0,
        0,
        scale,
        offsetX + frameOrigin.x * scale,
        offsetY + frameOrigin.y * scale,
    );
    targetCtx.globalAlpha = alpha;

    indices.forEach((frameIndex) => {
        const entry = onionFrameCache.get(frameIndex);
        const img = entry && entry.image ? entry.image : null;
        if (!img || !img.complete || img.naturalWidth <= 0) return;
        drawFrameImageToContext(targetCtx, img, 0, 0, projectFrameWidth, projectFrameHeight);
    });

    targetCtx.restore();
}

function renderOnionSkin() {
    if (!onionEnabled || onionSuppressed) return;
    if (!onionPrevCanvas && !onionNextCanvas) return;

    const { prev, next } = getOnionNeighborFrameIndices();
    const prevOrder = [...prev].reverse(); // farthest -> nearest
    const nextOrder = [...next].reverse(); // farthest -> nearest

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

    if (onionPanel) {
        onionPanel.addEventListener('mousedown', () => {
            if (!isOnionPanelOpen() || isExportModalOpen()) return;
            setActiveEditorPopup('onion');
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

    // Playback event support for future integrations.
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

function ensurePlaybackPreviewCanvas() {
    if (playbackPreviewCanvas) return playbackPreviewCanvas;
    if (!canvasWrapper || !canvas) return null;

    const previewCanvas = document.createElement('canvas');
    previewCanvas.id = 'editor-playback-preview';
    previewCanvas.className = 'playback-preview-canvas';
    previewCanvas.hidden = true;
    previewCanvas.width = canvas.width;
    previewCanvas.height = canvas.height;

    if (overlayCanvas && overlayCanvas.parentNode) {
        overlayCanvas.parentNode.insertBefore(previewCanvas, overlayCanvas);
    } else {
        canvasWrapper.appendChild(previewCanvas);
    }

    playbackPreviewCanvas = previewCanvas;
    playbackPreviewCtx = previewCanvas.getContext('2d');
    syncOverlayPlacement();
    return playbackPreviewCanvas;
}

function clearPlaybackPreviewCanvas() {
    if (!playbackPreviewCanvas || !playbackPreviewCtx) return;
    playbackPreviewCtx.clearRect(0, 0, playbackPreviewCanvas.width, playbackPreviewCanvas.height);
}

function setPlaybackPreviewVisible(visible) {
    const canvasEl = ensurePlaybackPreviewCanvas();
    if (!canvasEl) return;
    canvasEl.hidden = !visible;
    if (!visible) {
        clearPlaybackPreviewCanvas();
    }
}

function getPlaybackFrameCacheEntry(frameIndex) {
    const index = Number(frameIndex);
    if (!Number.isFinite(index) || index <= 0) return null;
    if (!playbackFrameImageCache.has(index)) {
        playbackFrameImageCache.set(index, {
            imageUrl: '',
            image: null,
            promise: null,
        });
    }
    return playbackFrameImageCache.get(index);
}

function primePlaybackCurrentFrameCache() {
    const flattened = flattenLayers();
    const entry = getPlaybackFrameCacheEntry(currentFrameIndex);
    if (!entry || !flattened) return;
    entry.imageUrl = flattened;
    entry.image = null;
    entry.promise = null;
}

function getPlaybackFrameImageUrl(frameIndex) {
    const index = Number(frameIndex);
    if (!Number.isFinite(index) || index <= 0) return '';

    const timelineFrame = getTimelineFrameByIndex(index);
    if (timelineFrame && timelineFrame.preview_url) {
        return normalizeAssetUrl(timelineFrame.preview_url);
    }

    if (index === currentFrameIndex) {
        const currentEntry = getPlaybackFrameCacheEntry(index);
        if (currentEntry && currentEntry.imageUrl) {
            return currentEntry.imageUrl;
        }
    }
    return '';
}

function ensurePlaybackFrameImage(frameIndex) {
    const entry = getPlaybackFrameCacheEntry(frameIndex);
    if (!entry) return Promise.resolve(null);

    const nextImageUrl = getPlaybackFrameImageUrl(frameIndex);
    if (!nextImageUrl) {
        entry.image = null;
        entry.imageUrl = '';
        entry.promise = null;
        return Promise.resolve(null);
    }

    if (entry.image && entry.imageUrl === nextImageUrl) {
        return Promise.resolve(entry.image);
    }
    if (entry.promise && entry.imageUrl === nextImageUrl) {
        return entry.promise;
    }

    entry.imageUrl = nextImageUrl;
    const targetUrl = nextImageUrl;
    entry.promise = new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            if (entry.imageUrl === targetUrl) {
                entry.image = image;
                entry.promise = null;
                resolve(image);
                return;
            }
            resolve(null);
        };
        image.onerror = () => {
            if (entry.imageUrl === targetUrl) {
                entry.image = null;
                entry.promise = null;
            }
            resolve(null);
        };
        image.src = targetUrl;
    });
    return entry.promise;
}

function prefetchPlaybackFrameImages(frameIndexes) {
    frameIndexes.forEach((frameIndex) => {
        void ensurePlaybackFrameImage(frameIndex);
    });
}

async function renderPlaybackFrameByIndex(frameIndex) {
    const canvasEl = ensurePlaybackPreviewCanvas();
    if (!canvasEl || !playbackPreviewCtx) return false;

    const image = await ensurePlaybackFrameImage(frameIndex);
    if (!isPlaybackSessionActive()) return false;

    clearPlaybackPreviewCanvas();
    if (image) {
        withTransformedContext(playbackPreviewCtx, () => {
            drawFrameImageToContext(
                playbackPreviewCtx,
                image,
                0,
                0,
                projectFrameWidth,
                projectFrameHeight,
            );
        }, { clipToFrame: true });
    }
    setPlaybackMarkerFrame(frameIndex);
    emitPlaybackSignal('anim-playback');
    return true;
}

function resolvePlaybackAudioElement() {
    if (playbackAudioElement) return playbackAudioElement;

    const fromDom = document.querySelector('audio[data-playback-audio], #playback-audio, #editor-audio-track');
    if (fromDom && typeof fromDom.play === 'function') {
        playbackAudioElement = fromDom;
        return playbackAudioElement;
    }

    const audioUrl = (editorRoot && editorRoot.dataset && editorRoot.dataset.projectAudioUrl)
        || window.ANIM_PROJECT_AUDIO_URL
        || '';
    if (!audioUrl || !editorRoot) {
        return null;
    }

    const audio = document.createElement('audio');
    audio.id = 'playback-audio';
    audio.dataset.playbackAudio = 'true';
    audio.preload = 'auto';
    audio.src = normalizeAssetUrl(audioUrl);
    audio.hidden = true;
    editorRoot.appendChild(audio);
    playbackAudioElement = audio;
    return playbackAudioElement;
}

function setPlaybackAudioToCurrentFrame() {
    const audio = resolvePlaybackAudioElement();
    if (!audio) return;
    const safeFps = Math.max(1, projectFps);
    const frameIndex = Number.isFinite(playbackMarkerFrameIndex)
        ? playbackMarkerFrameIndex
        : currentFrameIndex;
    const frameOffsetSeconds = Math.max(0, (Number(frameIndex) - 1) / safeFps);
    try {
        audio.currentTime = frameOffsetSeconds;
    } catch (error) {
        // ignore seek errors for unsupported streams
    }
}

function playbackAudioPlay(options = {}) {
    const audio = resolvePlaybackAudioElement();
    if (!audio) return;
    if (options.seekToFrameStart) {
        setPlaybackAudioToCurrentFrame();
    }
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
            // Browsers may block autoplay without a user gesture.
        });
    }
}

function playbackAudioPause() {
    const audio = resolvePlaybackAudioElement();
    if (!audio) return;
    audio.pause();
}

function playbackAudioStop() {
    const audio = resolvePlaybackAudioElement();
    if (!audio) return;
    audio.pause();
    try {
        audio.currentTime = 0;
    } catch (error) {
        // ignore seek errors for unsupported streams
    }
}

function emitPlaybackSignal(eventName) {
    const detail = {
        state: playbackMode,
        active: isPlaybackSessionActive(),
        playing: isPlaybackSessionActive(),
        frameIndex: Number.isFinite(playbackMarkerFrameIndex) ? playbackMarkerFrameIndex : currentFrameIndex,
        loop: playbackLoopEnabled,
    };
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    if (eventName !== 'anim-playback') {
        window.dispatchEvent(new CustomEvent('anim-playback', { detail }));
    }
}

function setPlaybackMarkerFrame(frameIndex) {
    if (Number.isFinite(frameIndex) && frameIndex > 0) {
        playbackMarkerFrameIndex = frameIndex;
    } else {
        playbackMarkerFrameIndex = null;
    }
    if (!timelineStrip) return;
    timelineStrip.querySelectorAll('.timeline-frame').forEach((el) => {
        const idx = Number(el.dataset.frameIndex);
        const isMarkerActive = Number.isFinite(playbackMarkerFrameIndex)
            && idx === playbackMarkerFrameIndex
            && isPlaybackSessionActive();
        el.classList.toggle('timeline-frame--playback-current', isMarkerActive);
    });
}

function updatePlaybackControlsState() {
    const hasFrames = getOrderedTimelineIndexes().length > 0;

    if (playbackPlayButton) {
        const isPlaying = isPlaybackRunning();
        const isPaused = playbackMode === PLAYBACK_PAUSED;
        playbackPlayButton.textContent = isPlaying ? 'Pause' : 'Play';
        playbackPlayButton.setAttribute('aria-label', playbackPlayButton.textContent);
        playbackPlayButton.classList.toggle('tool-button--active', isPlaying);
        const idleBlocked = playbackMode === PLAYBACK_IDLE && (isSwitchingFrame || isSaving || isAutosaving || !hasFrames);
        playbackPlayButton.disabled = playbackStopping || idleBlocked;
        playbackPlayButton.dataset.playbackState = isPlaying ? 'playing' : (isPaused ? 'paused' : 'idle');
    }

    if (playbackStopButton) {
        playbackStopButton.disabled = playbackStopping || !isPlaybackSessionActive();
    }

    if (playbackLoopToggle) {
        playbackLoopToggle.checked = playbackLoopEnabled;
        playbackLoopToggle.disabled = playbackStopping;
    }

    syncPlaybackFpsControlState();
}

function getNextPlaybackFramePosition() {
    if (!playbackFrameOrder.length) return -1;
    const nextPosition = playbackFramePosition + 1;
    if (nextPosition < playbackFrameOrder.length) {
        return nextPosition;
    }
    if (playbackLoopEnabled) {
        return 0;
    }
    return -1;
}

function stopPlaybackLoop() {
    if (playbackRafId) {
        cancelAnimationFrame(playbackRafId);
        playbackRafId = null;
    }
    playbackLastTickAt = 0;
    playbackAccumulatedMs = 0;
}

async function stepPlaybackForward() {
    if (playbackStepInFlight || !isPlaybackRunning()) return;

    const nextPosition = getNextPlaybackFramePosition();
    if (nextPosition < 0) {
        await stopPlaybackPreview({ restoreStartFrame: true });
        return;
    }

    const nextFrameIndex = playbackFrameOrder[nextPosition];
    playbackStepInFlight = true;
    try {
        const rendered = await renderPlaybackFrameByIndex(nextFrameIndex);
        if (rendered && isPlaybackSessionActive()) {
            playbackFramePosition = nextPosition;
        }
    } finally {
        playbackStepInFlight = false;
    }
}

function playbackLoopTick(now) {
    if (!isPlaybackRunning()) {
        stopPlaybackLoop();
        return;
    }
    if (!playbackLastTickAt) {
        playbackLastTickAt = now;
    }

    let delta = now - playbackLastTickAt;
    playbackLastTickAt = now;
    if (!Number.isFinite(delta) || delta < 0) {
        delta = 0;
    }

    const frameDuration = 1000 / Math.max(1, projectFps);
    playbackAccumulatedMs = Math.min(playbackAccumulatedMs + delta, frameDuration * 2);

    if (playbackAccumulatedMs >= frameDuration && !playbackStepInFlight) {
        playbackAccumulatedMs -= frameDuration;
        void stepPlaybackForward();
    }

    playbackRafId = requestAnimationFrame(playbackLoopTick);
}

function startPlaybackLoop() {
    stopPlaybackLoop();
    playbackRafId = requestAnimationFrame(playbackLoopTick);
}

function cancelLiveCanvasInteractionsForPlayback() {
    pendingCanvasStartFromOutside = null;

    if (isDrawing) {
        if (isShapeTool(activeTool)) {
            commitShape();
        }
        stopDrawing();
    }

    if (isSelecting) {
        isSelecting = false;
        selectionDraft = null;
        lassoPoints = [];
    }

    if (isPanning) {
        stopPan();
    }

    if (isTransformingSelection) {
        isTransformingSelection = false;
        hideTransformHint();
        setCanvasCursorOverride(null);
        hoverTransformHandle = null;
    }

    hideEyedropperZoom();
    renderScene();
    renderOverlay();
}

async function startPlaybackPreview() {
    if (playbackStopping) return;
    if (isPlaybackRunning()) {
        pausePlaybackPreview();
        return;
    }

    if (playbackMode === PLAYBACK_PAUSED) {
        playbackMode = PLAYBACK_PLAYING;
        setPlaybackPreviewVisible(true);
        syncEditorInteractionLockUi();
        updatePlaybackControlsState();
        playbackAudioPlay({ seekToFrameStart: false });
        emitPlaybackSignal('anim-playback');
        startPlaybackLoop();
        return;
    }

    if (isSwitchingFrame || isSaving || isAutosaving) return;

    const savedOk = await saveCurrentFrame();
    if (!savedOk && hasUnsavedChanges) return;

    const ordered = getOrderedTimelineIndexes();
    if (!ordered.length) return;

    cancelLiveCanvasInteractionsForPlayback();
    primePlaybackCurrentFrameCache();
    playbackFrameOrder = ordered;
    playbackFramePosition = ordered.indexOf(currentFrameIndex);
    if (playbackFramePosition < 0) {
        playbackFramePosition = 0;
    }
    const startFrameIndex = playbackFrameOrder[playbackFramePosition];

    playbackStartFrameIndex = currentFrameIndex;
    playbackMode = PLAYBACK_PLAYING;
    setPlaybackPreviewVisible(true);
    syncEditorInteractionLockUi();
    updatePlaybackControlsState();
    await renderPlaybackFrameByIndex(startFrameIndex);
    if (!isPlaybackSessionActive()) return;
    prefetchPlaybackFrameImages(playbackFrameOrder);
    playbackAudioPlay({ seekToFrameStart: true });
    emitPlaybackSignal('anim-playback-start');
    startPlaybackLoop();
}

function pausePlaybackPreview() {
    if (!isPlaybackRunning()) return;
    playbackMode = PLAYBACK_PAUSED;
    stopPlaybackLoop();
    playbackAudioPause();
    syncEditorInteractionLockUi();
    updatePlaybackControlsState();
    emitPlaybackSignal('anim-playback');
}

async function stopPlaybackPreview(options = {}) {
    if (!isPlaybackSessionActive() && !playbackStopping) return;
    void options;

    playbackStopping = true;
    playbackMode = PLAYBACK_IDLE;
    stopPlaybackLoop();
    playbackAudioStop();
    syncEditorInteractionLockUi();
    updatePlaybackControlsState();

    playbackFrameOrder = [];
    playbackFramePosition = -1;
    playbackStartFrameIndex = null;
    playbackStepInFlight = false;
    playbackStopping = false;
    setPlaybackPreviewVisible(false);
    setPlaybackMarkerFrame(null);
    syncEditorInteractionLockUi();
    updatePlaybackControlsState();

    emitPlaybackSignal('anim-playback-stop');
}

function bindPlaybackEvents() {
    if (!playbackControls) return;

    playbackLoopEnabled = Boolean(playbackLoopToggle && playbackLoopToggle.checked);
    syncProjectFpsUi();
    updatePlaybackControlsState();

    if (playbackPlayButton) {
        playbackPlayButton.addEventListener('click', () => {
            if (isPlaybackRunning()) {
                pausePlaybackPreview();
                return;
            }
            void startPlaybackPreview();
        });
    }

    if (playbackStopButton) {
        playbackStopButton.addEventListener('click', () => {
            void stopPlaybackPreview({ restoreStartFrame: true });
        });
    }

    if (playbackLoopToggle) {
        playbackLoopToggle.addEventListener('change', () => {
            playbackLoopEnabled = Boolean(playbackLoopToggle.checked);
            updatePlaybackControlsState();
        });
    }

    if (playbackFpsInput) {
        playbackFpsInput.addEventListener('change', () => {
            void commitPlaybackFpsInputValue();
        });
        playbackFpsInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                playbackFpsInput.blur();
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                playbackFpsInput.value = String(projectFps);
                playbackFpsInput.blur();
            }
        });
    }
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
        button.draggable = !shouldDisableTimelineControls();
        let frameTitle = `Frame ${frame.index}`;

        const number = document.createElement('span');
        number.className = 'timeline-frame__number';
        number.textContent = String(frame.index);
        button.appendChild(number);

        if (frame.preview_url) {
            const img = document.createElement('img');
            img.className = 'timeline-frame__img';
            img.alt = `Frame ${frame.index}`;
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

        const lock = getFrameLock(frame.id);
        if (lock) {
            const isMine = isLockOwnedByCurrentSession(lock);
            button.classList.add('timeline-frame--locked');
            if (isMine) {
                button.classList.add('timeline-frame--locked-self');
            }
            frameTitle += isMine
                ? ' • Editing in this session'
                : ` • Locked by ${lock.display_name}`;

            const lockBadge = document.createElement('span');
            lockBadge.className = 'timeline-frame__lock';
            if (isMine) {
                lockBadge.classList.add('timeline-frame__lock--self');
            }
            lockBadge.textContent = isMine ? 'Editing' : 'Locked';
            button.appendChild(lockBadge);
        }

        button.title = frameTitle;

        timelineStrip.appendChild(button);
    });

    timelineStrip.scrollLeft = previousScroll;
    setTimelineControlsDisabled(isSwitchingFrame || isSaving || isAutosaving);
    setPlaybackMarkerFrame(playbackMarkerFrameIndex);
    updatePlaybackControlsState();
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

    const cacheIndex = Number.isFinite(frameIndex) && frameIndex > 0
        ? frameIndex
        : (storedByIndex && Number.isFinite(Number(storedByIndex.index)) ? Number(storedByIndex.index) : null);
    if (Number.isFinite(cacheIndex) && cacheIndex > 0) {
        const cacheEntry = getPlaybackFrameCacheEntry(cacheIndex);
        if (cacheEntry) {
            cacheEntry.imageUrl = previewUrl ? normalizeAssetUrl(previewUrl) : '';
            cacheEntry.image = null;
            cacheEntry.promise = null;
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
            img.alt = `Frame ${frameIndex || ''}`.trim();
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
            throw new Error('Could not load frames.');
        }
        timelineFrames = Array.isArray(data.frames) ? data.frames : [];
        playbackFrameImageCache.clear();
        syncCurrentFrameIdFromTimeline();
        renderTimelineFrames();
    } catch (error) {
        console.error('Timeline loading error', error);
    }
}

async function loadFrameByIndex(targetIndex) {
    const index = Number(targetIndex);
    if (!Number.isFinite(index) || index <= 0) return false;
    const previousFrameId = currentFrameId;

    const url = getFrameDetailUrl(index);
    if (!url) return false;

    isSwitchingFrame = true;
    setTimelineControlsDisabled(true);

    try {
        const response = await fetch(url, { credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Could not load the frame.');
        }

        currentFrameIndex = index;
        currentFrameId = data.frame && data.frame.id ? Number(data.frame.id) : currentFrameId;

        const hasPersistedData = Boolean(data.frame && (data.frame.preview_url || data.frame.content_json));
        currentFramePreviewUrl = (data.frame && data.frame.preview_url) ? data.frame.preview_url : '';
        currentFrameContentJson = (data.frame && data.frame.content_json) ? data.frame.content_json : '';
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
        await hydrateSavedFrame();
        fillBackgroundLayerIfNeeded();

        setActiveTimelineIndex(currentFrameIndex);
        if (isPlaybackSessionActive()) {
            setPlaybackMarkerFrame(currentFrameIndex);
        }
        updateSaveButtonState();
        updatePlaybackControlsState();
        updateHistoryPanel();
        prefetchOnionFramesForCurrent();
        requestOnionSkinRender();
        notifyCurrentFramePresence();
        syncCurrentFrameLock(previousFrameId);
        return true;
    } catch (error) {
        console.error('Frame loading error', error);
        setSaveStatus('Could not load the frame.', 'error');
        setSaveIndicator('error');
        return false;
    } finally {
        isSwitchingFrame = false;
        setTimelineControlsDisabled(false);
        renderTimelineFrames();
    }
}

async function switchToFrameIndex(targetIndex) {
    if (shouldDisableTimelineNavigation()) return;
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
    if (shouldDisableTimelineControls()) return;
    if (!frameCreateUrl) return;
    if (isSwitchingFrame) return;

    setTimelineControlsDisabled(true);

    const shouldDuplicate = Boolean(options.duplicate);
    const savedOk = await saveCurrentFrame();
    if (!savedOk && hasUnsavedChanges) {
        setTimelineControlsDisabled(false);
        return;
    }

    const clientRequestId = createProjectEventRequestId();
    rememberLocalProjectEventRequest(clientRequestId);

    try {
        const payload = shouldDuplicate
            ? { duplicate_from_index: currentFrameIndex, client_request_id: clientRequestId }
            : { client_request_id: clientRequestId };
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
            throw new Error('Could not create the frame.');
        }

        timelineFrames = Array.isArray(data.frames) ? data.frames : timelineFrames;
        playbackFrameImageCache.clear();
        currentFrameIndex = Number(data.active_index) || currentFrameIndex;
        currentFrameId = data.frame && data.frame.id ? Number(data.frame.id) : currentFrameId;
        renderTimelineFrames();
        await loadFrameByIndex(currentFrameIndex);
    } catch (error) {
        forgetLocalProjectEventRequest(clientRequestId);
        console.error('Frame creation error', error);
        setSaveStatus('Could not create the frame.', 'error');
        setSaveIndicator('error');
    } finally {
        setTimelineControlsDisabled(false);
    }
}

async function deleteCurrentFrameOnServer() {
    if (shouldDisableTimelineControls()) return;
    if (isSwitchingFrame) return;
    const deleteUrl = getFrameDeleteUrl(currentFrameIndex);
    if (!deleteUrl) return;

    const confirmDelete = window.confirm(`Delete frame ${currentFrameIndex}?`);
    if (!confirmDelete) return;

    setTimelineControlsDisabled(true);

    const savedOk = await saveCurrentFrame();
    if (!savedOk && hasUnsavedChanges) {
        setTimelineControlsDisabled(false);
        return;
    }

    const clientRequestId = createProjectEventRequestId();
    rememberLocalProjectEventRequest(clientRequestId);

    try {
        const response = await fetch(deleteUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ client_request_id: clientRequestId }),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Could not delete the frame.');
        }

        timelineFrames = Array.isArray(data.frames) ? data.frames : [];
        playbackFrameImageCache.clear();
        const nextIndex = Number(data.active_index) || 1;
        currentFrameId = null;
        resetOnionFrameCache();
        renderTimelineFrames();
        await loadFrameByIndex(nextIndex);
    } catch (error) {
        forgetLocalProjectEventRequest(clientRequestId);
        console.error('Frame deletion error', error);
        setSaveStatus('Could not delete the frame.', 'error');
        setSaveIndicator('error');
    } finally {
        setTimelineControlsDisabled(false);
    }
}

async function saveFrameOrder(orderedIds) {
    if (shouldDisableTimelineControls()) return;
    if (!frameReorderUrl) return;
    if (!Array.isArray(orderedIds) || orderedIds.length < 2) return;

    const clientRequestId = createProjectEventRequestId();
    rememberLocalProjectEventRequest(clientRequestId);

    try {
        const response = await fetch(frameReorderUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                ordered_ids: orderedIds,
                client_request_id: clientRequestId,
            }),
        });
        const data = await response.json();
        if (!response.ok || !data || !data.ok) {
            throw new Error('Could not save frame order.');
        }

        const activeId = currentFrameId;
        timelineFrames = Array.isArray(data.frames) ? data.frames : timelineFrames;
        playbackFrameImageCache.clear();
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
        forgetLocalProjectEventRequest(clientRequestId);
        console.error('Frame order save error', error);
    }
}

function bindTimelineEvents() {
    if (addFrameButton) {
        addFrameButton.addEventListener('click', () => {
            if (shouldDisableTimelineControls()) return;
            createFrameOnServer({ duplicate: false });
        });
    }

    if (duplicateFrameButton) {
        duplicateFrameButton.addEventListener('click', () => {
            if (shouldDisableTimelineControls()) return;
            createFrameOnServer({ duplicate: true });
        });
    }

    if (deleteFrameButton) {
        deleteFrameButton.addEventListener('click', () => {
            if (shouldDisableTimelineControls()) return;
            deleteCurrentFrameOnServer();
        });
    }

    if (!timelineStrip) return;

    timelineStrip.addEventListener('click', (event) => {
        if (shouldDisableTimelineNavigation()) return;
        const item = event.target.closest('.timeline-frame');
        if (!item) return;
        const index = Number(item.dataset.frameIndex);
        if (!Number.isFinite(index) || index <= 0) return;
        switchToFrameIndex(index);
    });

    timelineStrip.addEventListener('dragstart', (event) => {
        if (shouldDisableTimelineControls()) {
            event.preventDefault();
            return;
        }
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
        if (shouldDisableTimelineControls()) return;
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
        if (shouldDisableTimelineControls()) return;
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
    if (flattenCanvas.width !== projectFrameWidth) {
        flattenCanvas.width = projectFrameWidth;
    }
    if (flattenCanvas.height !== projectFrameHeight) {
        flattenCanvas.height = projectFrameHeight;
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
        flattenCtx.drawImage(sourceCanvas, 0, 0, flattenCanvas.width, flattenCanvas.height);
    });
    flattenCtx.globalAlpha = 1;
    return flattenCanvas.toDataURL('image/png');
}

function getOrderedLayersForStorage() {
    return [...layers].sort((a, b) => {
        if (a.order !== b.order) {
            return a.order - b.order;
        }
        return a.id - b.id;
    });
}

function getLayerSourceCanvasForStorage(layer, activeCompositeCanvas = null) {
    if (!layer) return null;
    if (activeCompositeCanvas && layer.id === activeLayerId) {
        return activeCompositeCanvas;
    }
    return layer.bufferCanvas || null;
}

function buildFrameContentPayload() {
    if (!canvas || !layers.length) return null;
    const activeCompositeCanvas = hasFloatingSelection() ? getActiveLayerCompositeCanvas() : null;
    const orderedLayers = getOrderedLayersForStorage();
    const activeLayerIndex = orderedLayers.findIndex((layer) => layer.id === activeLayerId);
    const currentActiveLayer = getLayerById(activeLayerId);
    return {
        version: 1,
        width: canvas.width,
        height: canvas.height,
        active_layer_id: activeLayerId,
        active_layer_order: currentActiveLayer ? currentActiveLayer.order : null,
        active_layer_index: activeLayerIndex >= 0 ? activeLayerIndex : null,
        layers: orderedLayers.map((layer, index) => {
            ensureLayerCanvases(layer);
            const sourceCanvas = getLayerSourceCanvasForStorage(layer, activeCompositeCanvas);
            return {
                id: layer.id,
                order: layer.order,
                index,
                image_data: sourceCanvas ? sourceCanvas.toDataURL('image/png') : '',
            };
        }),
    };
}

function parseFrameContentPayload(rawValue) {
    if (!rawValue || typeof rawValue !== 'string') return null;
    try {
        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.layers)) {
            return null;
        }
        return parsed;
    } catch (error) {
        console.warn('Could not parse frame content_json', error);
        return null;
    }
}

function clearAllLayerBuffers() {
    layers.forEach((layer) => {
        ensureLayerCanvases(layer);
        if (!layer.bufferCtx || !layer.bufferCanvas) return;
        clearCanvas(layer.bufferCtx, layer.bufferCanvas);
    });
}

function resolveStoredActiveLayer(payload, orderedLayers) {
    const activeLayerById = getLayerById(Number(payload && payload.active_layer_id));
    if (activeLayerById) {
        return activeLayerById;
    }

    const targetOrder = Number(payload && payload.active_layer_order);
    if (Number.isFinite(targetOrder)) {
        const activeLayerByOrder = orderedLayers.find((layer) => layer.order === targetOrder);
        if (activeLayerByOrder) {
            return activeLayerByOrder;
        }
    }

    const targetIndex = Number(payload && payload.active_layer_index);
    if (Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < orderedLayers.length) {
        return orderedLayers[targetIndex];
    }

    return orderedLayers.length ? orderedLayers[orderedLayers.length - 1] : null;
}

function resolveStoredLayerTarget(entry, orderedLayers, usedLayerIds, fallbackIndex) {
    const entryId = Number(entry && entry.id);
    if (Number.isFinite(entryId)) {
        const layerById = getLayerById(entryId);
        if (layerById && !usedLayerIds.has(layerById.id)) {
            return layerById;
        }
    }

    const entryOrder = Number(entry && entry.order);
    if (Number.isFinite(entryOrder)) {
        const layerByOrder = orderedLayers.find(
            (layer) => layer.order === entryOrder && !usedLayerIds.has(layer.id),
        );
        if (layerByOrder) {
            return layerByOrder;
        }
    }

    const entryIndex = Number(entry && entry.index);
    const targetIndex = Number.isInteger(entryIndex) ? entryIndex : fallbackIndex;
    if (targetIndex >= 0 && targetIndex < orderedLayers.length) {
        const layerByIndex = orderedLayers[targetIndex];
        if (layerByIndex && !usedLayerIds.has(layerByIndex.id)) {
            return layerByIndex;
        }
    }

    return orderedLayers.find((layer) => !usedLayerIds.has(layer.id)) || null;
}

async function restoreLayersFromContentPayload(payload, expectedToken) {
    if (!payload || !Array.isArray(payload.layers) || !layers.length) return false;

    const orderedLayers = getOrderedLayersForStorage();
    const usedLayerIds = new Set();
    const mappedEntries = payload.layers.map((entry, index) => {
        const layer = resolveStoredLayerTarget(entry, orderedLayers, usedLayerIds, index);
        if (layer) {
            usedLayerIds.add(layer.id);
        }
        return { entry, layer };
    });

    const loadedEntries = await Promise.all(mappedEntries.map(async ({ entry, layer }) => {
        if (!layer || !entry || !entry.image_data) {
            return { layer, image: null };
        }
        try {
            const image = await loadImageAsync(entry.image_data);
            return { layer, image };
        } catch (error) {
            console.warn('Could not restore the layer from content_json', error);
            return { layer, image: null };
        }
    }));

    if (expectedToken !== frameHydrationToken) {
        return false;
    }

    clearAllLayerBuffers();
    loadedEntries.forEach(({ layer, image }) => {
        if (!layer || !image) return;
        ensureLayerCanvases(layer);
        if (!layer.bufferCtx || !layer.bufferCanvas) return;
        layer.bufferCtx.drawImage(image, 0, 0, layer.bufferCanvas.width, layer.bufferCanvas.height);
    });

    const restoredActiveLayer = resolveStoredActiveLayer(payload, orderedLayers);
    if (restoredActiveLayer) {
        activeLayerId = restoredActiveLayer.id;
    }
    updateActiveLayerPointers();
    applyAllLayerStyles();
    renderLayerList();
    renderScene();
    renderOverlay();
    syncOverlayPlacement();

    return loadedEntries.some(({ image }) => Boolean(image)) || payload.layers.length === 0;
}

function finalizeHydratedFrameState() {
    if (!lastSavedAt) {
        lastSavedAt = new Date();
    }
    setSaveIndicator('saved');
    setSaveStatus('Saved', 'saved');
    updateLastSavedLabel();
    updateSaveButtonState();
    ensureHistoryBaseline();
}

function drawImageOnLayer(layer, image, options = {}) {
    if (!layer || !layer.bufferCtx || !layer.bufferCanvas) return;
    clearCanvas(layer.bufferCtx, layer.bufferCanvas);
    if (options.fillWhite) {
        layer.bufferCtx.fillStyle = '#ffffff';
        layer.bufferCtx.fillRect(0, 0, layer.bufferCanvas.width, layer.bufferCanvas.height);
    }
    drawFrameImageToContext(
        layer.bufferCtx,
        image,
        0,
        0,
        layer.bufferCanvas.width,
        layer.bufferCanvas.height,
    );
    renderScene();
}

async function hydrateSavedFrame() {
    if (!canvas || !layers.length) return;
    const expectedToken = ++frameHydrationToken;

    const savedAt = parseSavedDate(currentFrameUpdatedAt);
    if (savedAt) {
        lastSavedAt = savedAt;
    }

    const contentPayload = parseFrameContentPayload(currentFrameContentJson);
    if (contentPayload) {
        const restored = await restoreLayersFromContentPayload(contentPayload, expectedToken);
        if (expectedToken !== frameHydrationToken) return;
        if (restored) {
            finalizeHydratedFrameState();
            return;
        }
    }

    clearAllLayerBuffers();
    renderScene();
    renderOverlay();
    syncOverlayPlacement();

    if (!currentFramePreviewUrl) {
        if (lastSavedAt) {
            setSaveIndicator('saved');
            setSaveStatus('Saved', 'saved');
            updateLastSavedLabel();
        }
        ensureHistoryBaseline();
        return;
    }

    try {
        const image = await loadImageAsync(normalizeAssetUrl(currentFramePreviewUrl));
        if (expectedToken !== frameHydrationToken) return;
        const backgroundLayer = getBackgroundLayer();
        if (backgroundLayer) {
            drawImageOnLayer(backgroundLayer, image);
        }
        finalizeHydratedFrameState();
    } catch (error) {
        if (expectedToken !== frameHydrationToken) return;
        console.warn('Could not load the saved frame', error);
        setSaveIndicator('error');
        setSaveStatus('Could not load the saved frame.', 'error');
        ensureHistoryBaseline();
    }
}

/**
 * Build the current frame payload for saving.
 */
function getCurrentFramePayload() {
    const flattened = flattenLayers();
    const frameContent = buildFrameContentPayload();
    if (flattened && frameContent) {
        return {
            image_data: flattened,
            content_json: frameContent,
        };
    }
    return null;
}

/**
 * Send the current frame to the server.
 */
async function saveCurrentFrame(options = {}) {
    if (isCurrentFrameReadOnly()) {
        return false;
    }
    if (!frameSaveUrlTemplate) {
        setSaveStatus('Frame save URL was not found.', 'error');
        setSaveIndicator('error');
        return false;
    }

    if (isSaving || isAutosaving) return false;
    if (!hasUnsavedChanges) return true;

    const saveUrl = getFrameSaveUrl(currentFrameIndex);
    if (!saveUrl) {
        setSaveStatus('Frame save URL was not found.', 'error');
        setSaveIndicator('error');
        return false;
    }

    const payload = getCurrentFramePayload();
    if (!payload) {
        setSaveStatus('There is no data to save.', 'error');
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
    setSaveStatus('Saving...', 'saving');
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
            const errorMessage = data && data.error ? data.error : 'Could not save the frame.';
            throw new Error(errorMessage);
        }

        hasUnsavedChanges = false;
        lastSavedAt = new Date();
        currentFrameContentJson = payload.content_json
            ? JSON.stringify(payload.content_json)
            : currentFrameContentJson;
        if (data.frame) {
            currentFramePreviewUrl = data.frame.preview_url || currentFramePreviewUrl || '';
            currentFrameUpdatedAt = data.frame.updated_at || currentFrameUpdatedAt || '';
            updateTimelineFramePreview(data.frame);
        }
        setSaveStatus('Saved', 'saved');
        setSaveIndicator('saved');
        updateLastSavedLabel();
        return true;
    } catch (error) {
        console.error('Frame save error', error);
        let errorText = 'Could not save the frame.';
        if (error instanceof Error && error.message) {
            errorText = error.message;
        }
        if (errorText === 'Failed to fetch') {
            errorText = 'Could not reach the server.';
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
// Canvas event binding
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
    if (isEditingLocked()) return;
    const activeTool = getEffectiveTool();
    // Middle mouse button: temporary panning without switching tools.
    if (event.button === 1) {
        event.preventDefault();
        if (isTransformingSelection) return;
        startPan(event);
        return;
    }

    if (event.button !== 0 && event.button !== 2) return;
    const isRightButton = event.button === 2;
    if (isRightButton) {
        event.preventDefault();
    }
    const allowRightButton = activeTool === TOOL_BRUSH
        || activeTool === TOOL_FILL
        || activeTool === TOOL_EYEDROPPER
        || isShapeTool(activeTool);
    if (isRightButton && !allowRightButton) return;
    activePointerButton = event.button;
    if (isTransformingSelection) return;
    if (isSpacePressed) {
        startPan(event);
        return;
    }
    if (activeTool === TOOL_PAN) {
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
    if (activeTool === TOOL_SELECT) {
        if (isRightButton) return;
        logCoordDebug('select-down', event);
        if (selection && tryStartSelectionTransformAt(x, y, event)) {
            return;
        }
        if (selection || hasFloatingSelection()) {
            resolveActiveSelectionForNewGesture();
        }
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

    if (activeTool === TOOL_EYEDROPPER) {
        updateEyedropperZoom(event);
        pickColorAt(x, y, { secondary: isRightButton });
        hideEyedropperZoom();
        setTool(TOOL_BRUSH);
        return;
    }

    if (selection && !isPointInSelection(x, y, selection)) {
        return;
    }

    if (activeTool === TOOL_FILL) {
        beginLayerHistory(getToolHistoryLabel(TOOL_FILL));
        const didFill = floodFill(x, y, { color: getColorByMouseButton(activePointerButton) });
        if (didFill) {
            markUnsavedChanges();
            commitLayerHistory();
        } else {
            cancelPendingHistory();
        }
        return;
    }

    if (activeTool === TOOL_BRUSH || activeTool === TOOL_ERASER || isShapeTool(activeTool)) {
        startDrawing(x, y, activeTool);
    }
}

function handlePointerMove(event) {
    if (isEditingLocked()) return;
    const activeTool = getEffectiveTool();
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
    if (activeTool === TOOL_EYEDROPPER) {
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
    if (isEditingLocked()) return;
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
        // If panning started with the middle mouse button, stop only on its release.
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
    if (isEditingLocked()) return;
    setAutoPanSelectionHover(false);
    hideEyedropperZoom();
    hideTransformHint();
    setCanvasCursorOverride(null);
    hoverTransformHandle = null;
}

function handleCanvasContextMenu(event) {
    if (!event) return;
    if (isEditingLocked()) return;
    const activeTool = getEffectiveTool();
    const shouldPrevent = activeTool === TOOL_BRUSH
        || activeTool === TOOL_ERASER
        || activeTool === TOOL_FILL
        || isShapeTool(activeTool)
        || activeTool === TOOL_EYEDROPPER
        || activeTool === TOOL_SELECT;
    if (shouldPrevent) {
        event.preventDefault();
    }
}

function handleWindowPointerDown(event) {
    if (isEditingLocked()) {
        pendingCanvasStartFromOutside = null;
        return;
    }
    if (!event) return;
    if (event.button !== 0) return;

    const target = event.target && event.target.nodeType === 1
        ? event.target
        : (event.target && event.target.parentElement ? event.target.parentElement : null);
    const startedOnCanvas = Boolean(target && target === canvas);

    // If the press started directly on the canvas, the regular mousedown handler handles it.
    if (startedOnCanvas) {
        pendingCanvasStartFromOutside = { allow: false };
        return;
    }

    const startedInsideEditor = Boolean(editorRoot && target && editorRoot.contains(target));
    const startedInsideCanvasWrapper = Boolean(canvasWrapper && target && canvasWrapper.contains(target));

    const startedOnOverlayPanel = Boolean(
        (toolbarPanel && target && toolbarPanel.contains(target))
        || (layersPanel && target && layersPanel.contains(target))
        || (historyPanel && target && historyPanel.contains(target))
        || (onionPanel && target && onionPanel.contains(target)),
    );

    const startedOnInteractive = Boolean(
        (target && isTextInputElement(target))
        || (target && target.closest && target.closest('button, a, input, select, textarea, [role="button"]'))
        || (target && target.closest && target.closest('.editor-toolbar, .timeline-wrapper, .anim-header')),
    );

    const allowStart = !startedOnOverlayPanel
        && !startedOnInteractive
        && (startedInsideCanvasWrapper || !startedInsideEditor);

    pendingCanvasStartFromOutside = { allow: allowStart };
}

function tryStartCanvasInteractionFromOutside(event) {
    if (isEditingLocked()) return false;
    if (!event || !canvas) return false;
    if (isDrawing || isSelecting || isPanning || isTransformingSelection) return false;
    if (isDraggingToolbarPanel || isDraggingLayersPanel || isDraggingHistoryPanel || isDraggingOnionPanel || isOpacityDragging) return false;

    const buttons = typeof event.buttons === 'number' ? event.buttons : 0;
    const leftDown = (buttons & 1) === 1;
    if (!leftDown) {
        pendingCanvasStartFromOutside = null;
        return false;
    }

    // If mousedown happened inside the window and we know it was on UI, do not start.
    // If mousedown was missed entirely (for example it started outside the window), allow it.
    if (pendingCanvasStartFromOutside && pendingCanvasStartFromOutside.allow !== true) {
        return false;
    }

    // Only start when the cursor is actually over the canvas, not over UI panels.
    const topEl = document.elementFromPoint(event.clientX, event.clientY);
    if (topEl !== canvas) return false;

    pendingCanvasStartFromOutside = null;
    handlePointerDown(event);
    return true;
}

function handleWindowPointerMove(event) {
    if (isEditingLocked()) return;
    if (!isDrawing && !isSelecting && !isPanning && !isTransformingSelection) {
        tryStartCanvasInteractionFromOutside(event);
        return;
    }
    handlePointerMove(event);
}

function handleCanvasDoubleClick(event) {
    if (isEditingLocked()) return;
    if (!selection || isSelecting || isPanning || isTransformingSelection) return;
    const { x, y } = getCanvasCoords(event);
    if (!isPointInSelection(x, y, selection)) {
        clearSelection();
    }
}

function handleWheel(event) {
    if (isEditingLockedByPlayback()) return;
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
    const rawDrawWidth = naturalWidth * fitScale;
    const rawDrawHeight = naturalHeight * fitScale;
    const rawPasteX = centerX - rawDrawWidth / 2;
    const rawPasteY = centerY - rawDrawHeight / 2;
    const alignedBounds = alignRasterBoundsToPixelGrid(rawPasteX, rawPasteY, rawDrawWidth, rawDrawHeight);
    const pasteX = alignedBounds.x;
    const pasteY = alignedBounds.y;
    const drawWidth = alignedBounds.width;
    const drawHeight = alignedBounds.height;

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
        console.warn('Could not paste the image from the clipboard.');
    };
    image.src = url;
}

async function getClipboardImageDimensions(file) {
    if (!file) return null;

    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(file);
            const dimensions = {
                width: bitmap.width,
                height: bitmap.height,
            };
            if (typeof bitmap.close === 'function') {
                bitmap.close();
            }
            return dimensions;
        } catch (error) {
            // Fall back to Image below.
        }
    }

    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve({
                width: image.naturalWidth || image.width || 0,
                height: image.naturalHeight || image.height || 0,
            });
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        image.src = url;
    });
}

async function doesClipboardImageMatchSelection(file) {
    const clipboardMeta = selectionClipboard ? selectionClipboard.systemImage : null;
    if (!clipboardMeta || !file) return false;
    if (clipboardMeta.type && file.type && clipboardMeta.type !== file.type) return false;
    if (clipboardMeta.size && file.size && clipboardMeta.size !== file.size) return false;
    const dimensions = await getClipboardImageDimensions(file);
    if (!dimensions) return false;
    return dimensions.width === clipboardMeta.width && dimensions.height === clipboardMeta.height;
}

async function handlePaste(event) {
    if (isEditingLocked()) return;
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
            if (await doesClipboardImageMatchSelection(file) && selectionClipboard) {
                pasteSelectionFromClipboard();
            } else {
                pasteImageFile(file);
            }
        }
        return;
    }

    if (selectionClipboard) {
        event.preventDefault();
        pasteSelectionFromClipboard();
    }
}

function handleKeyDown(event) {
    if (event.code === 'Escape' && toolSettingsPopover && !toolSettingsPopover.hidden) {
        closeToolSettingsPopover();
    }

    if (isExportModalOpen()) {
        if (event.code === 'Escape') {
            event.preventDefault();
            closeExportModal();
        }
        return;
    }

    if (isEditingLockedByPlayback()) {
        if (event.code === 'Space') {
            event.preventDefault();
            if (isPlaybackRunning()) {
                pausePlaybackPreview();
            } else {
                void startPlaybackPreview();
            }
            return;
        }
        if (event.code === 'Escape') {
            event.preventDefault();
            void stopPlaybackPreview({ restoreStartFrame: true });
            return;
        }
        return;
    }

    if (isCurrentFrameReadOnly()) {
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
            const didCopy = copySelectionToClipboard();
            if (didCopy) {
                void copySelectionImageToSystemClipboard(selectionClipboard);
            }
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
    if ((event.code === 'Delete' || event.code === 'Backspace') && !isTextInputElement(event.target)) {
        if (selection) {
            event.preventDefault();
            deleteSelectionContent();
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
 * Bind mouse handlers to the canvas.
 */
function bindCanvasEvents() {
    if (!canvas) return;

    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('mouseup', handlePointerUp);
    canvas.addEventListener('mouseleave', handlePointerLeave);
    canvas.addEventListener('dblclick', handleCanvasDoubleClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', handleCanvasContextMenu);

    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('mousemove', handleWindowPointerMove);
    window.addEventListener('mousedown', handleWindowPointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('paste', handlePaste);
}

// =======================
// Toolbar UI binding
// =======================

/**
 * Bind handlers to tool buttons and color/size controls.
 */
function bindToolbarEvents() {
    if (toolbar) {
        toolbar.addEventListener('click', (event) => {
            if (isEditingLocked()) return;
            const modeButton = event.target.closest('[data-select-mode]');
            if (modeButton) {
                const modeName = modeButton.dataset.selectMode;
                if (!modeName) return;
                setSelectionMode(modeName);
                setTool(TOOL_SELECT);
                const selectButton = getToolButtonByName(TOOL_SELECT);
                if (selectButton) {
                    openToolSettingsPopover(selectButton, { forceVisible: true });
                }
                return;
            }

            const toolButton = event.target.closest('[data-tool]');
            if (!toolButton) return;
            const toolName = toolButton.dataset.tool;
            if (!toolName || !TOOL_SET.has(toolName)) return;
            setTool(toolName);
            const hasSettings = applyToolSettingsVisibility(toolName);
            if (hasSettings) {
                openToolSettingsPopover(toolButton);
            } else {
                closeToolSettingsPopover();
            }
        });

        toolbar.addEventListener('contextmenu', (event) => {
            if (isEditingLocked()) return;
            const toolButton = event.target.closest('[data-tool]');
            if (!toolButton) return;
            const toolName = toolButton.dataset.tool;
            if (!toolName || !TOOL_SET.has(toolName)) return;
            event.preventDefault();
            setTool(toolName);
            openToolSettingsPopover(toolButton, { forceVisible: true });
        });
    }

    if (toolSettingsPopover) {
        toolSettingsPopover.addEventListener('mousedown', () => {
            if (!isToolSettingsPopoverOpen() || isExportModalOpen()) return;
            setActiveEditorPopup('tool-settings');
        });

        toolSettingsPopover.addEventListener('click', (event) => {
            if (isEditingLocked()) return;
            const modeButton = event.target.closest('[data-select-mode]');
            if (!modeButton) return;
            const modeName = modeButton.dataset.selectMode;
            if (!modeName) return;
            setSelectionMode(modeName);
            setTool(TOOL_SELECT);
            const selectButton = getToolButtonByName(TOOL_SELECT);
            if (selectButton) {
                openToolSettingsPopover(selectButton, { forceVisible: true });
            }
        });

        toolSettingsPopover.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }

    document.addEventListener('mousedown', (event) => {
        if (!toolSettingsPopover || toolSettingsPopover.hidden) return;
        const target = event.target;
        if (!target || target.nodeType !== 1) return;
        if (toolSettingsPopover.contains(target)) return;
        if (toolbar && toolbar.contains(target)) return;
        closeToolSettingsPopover();
    });

    window.addEventListener('resize', () => {
        if (!toolSettingsPopover || toolSettingsPopover.hidden || !toolSettingsAnchorButton) return;
        positionToolSettingsPopover(toolSettingsAnchorButton);
    });

    if (toolbarPanel) {
        toolbarPanel.addEventListener('scroll', () => {
            if (!toolSettingsPopover || toolSettingsPopover.hidden || !toolSettingsAnchorButton) return;
            positionToolSettingsPopover(toolSettingsAnchorButton);
        });
    }

    if (colorInput) {
        colorInput.addEventListener('input', (event) => {
            if (isEditingLocked()) return;
            setColor(event.target.value);
        });
    }

    if (secondaryColorInput) {
        secondaryColorInput.addEventListener('input', (event) => {
            if (isEditingLocked()) return;
            setColor(event.target.value, { secondary: true });
        });
    }

    if (sizeInput) {
        sizeInput.addEventListener('input', (event) => {
            if (isEditingLocked()) return;
            const value = parseInt(event.target.value, 10) || 1;
            setBrushSize(value);
        });
    }

    if (opacityInput) {
        opacityInput.addEventListener('input', (event) => {
            if (isEditingLocked()) return;
            setBrushOpacity(event.target.value);
        });
    }

    if (blurInput) {
        blurInput.addEventListener('input', (event) => {
            if (isEditingLocked()) return;
            setBrushBlur(event.target.value);
        });
    }

    if (wandSensitivityInput) {
        wandSensitivityInput.addEventListener('input', (event) => {
            if (isEditingLocked()) return;
            const value = parseInt(event.target.value, 10);
            if (!Number.isNaN(value)) {
                wandTolerance = clamp(value, 0, 255);
            }
        });
    }
}

// =======================
// Layers UI binding
// =======================

function bindLayerEvents() {
    if (addLayerButton) {
        addLayerButton.addEventListener('click', () => {
            if (isEditingLocked()) return;
            createLayer();
        });
    }

    if (!layersList) return;

    layersList.addEventListener('pointerdown', (event) => {
        if (isEditingLocked()) return;
        if (event.target.matches('input[type="range"]')) {
            isOpacityDragging = true;
            beginFullHistory('layer_opacity_action');
        }
    });

    layersList.addEventListener('click', async (event) => {
        if (isEditingLocked()) return;
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
        if (isEditingLocked()) return;
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
        if (isEditingLocked()) return;
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
        if (isEditingLocked()) {
            event.preventDefault();
            return;
        }
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
        if (isEditingLocked()) return;
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
        if (isEditingLocked()) return;
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
        // localStorage may be unavailable (private mode, blocked storage, etc.).
    }
}

function normalizeLoadedPanelPosition(position) {
    if (!position) return { position: null, didMigrate: false };
    if (position.container === PANEL_POSITION_CONTAINER) {
        return { position: { left: position.left, top: position.top }, didMigrate: false };
    }
    // Legacy values from before the drag area was expanded were relative to `.canvas-wrapper`.
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

    const storedToolsPos = loadPanelPosition('tools');
    const normalizedTools = normalizeLoadedPanelPosition(storedToolsPos);
    if (toolbarPanel && normalizedTools.position) {
        applyPanelPosition(toolbarPanel, normalizedTools.position);
        if (normalizedTools.didMigrate) {
            storePanelPosition('tools', normalizedTools.position);
        }
    }

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

function startToolbarPanelDrag(event) {
    if (!toolbarPanel || !toolbarPanelHeader || !editorMain) return;
    if (event.button !== 0) return;
    if (event.target.closest('button, input, select, textarea, a')) return;
    event.preventDefault();

    const mainRect = editorMain.getBoundingClientRect();
    const panelRect = toolbarPanel.getBoundingClientRect();
    toolbarPanelOffsetX = event.clientX - panelRect.left;
    toolbarPanelOffsetY = event.clientY - panelRect.top;

    const left = panelRect.left - mainRect.left;
    const top = panelRect.top - mainRect.top;
    toolbarPanel.style.left = `${left}px`;
    toolbarPanel.style.top = `${top}px`;
    toolbarPanel.style.right = 'auto';
    toolbarPanel.style.bottom = 'auto';
    isDraggingToolbarPanel = true;
    toolbarPanel.classList.add('is-dragging');
}

function updateToolbarPanelDrag(event) {
    if (!isDraggingToolbarPanel || !toolbarPanel || !editorMain) return;
    const mainRect = editorMain.getBoundingClientRect();
    const panelWidth = toolbarPanel.offsetWidth;
    const panelHeight = toolbarPanel.offsetHeight;
    const maxLeft = Math.max(0, mainRect.width - panelWidth);
    const maxTop = Math.max(0, mainRect.height - panelHeight);
    const nextLeft = clamp(event.clientX - mainRect.left - toolbarPanelOffsetX, 0, maxLeft);
    const nextTop = clamp(event.clientY - mainRect.top - toolbarPanelOffsetY, 0, maxTop);
    toolbarPanel.style.left = `${nextLeft}px`;
    toolbarPanel.style.top = `${nextTop}px`;
    if (toolSettingsPopover && !toolSettingsPopover.hidden && toolSettingsAnchorButton) {
        positionToolSettingsPopover(toolSettingsAnchorButton);
    }
}

function stopToolbarPanelDrag() {
    if (!isDraggingToolbarPanel) return;
    isDraggingToolbarPanel = false;
    if (toolbarPanel) {
        toolbarPanel.classList.remove('is-dragging');
        savePanelPosition('tools', toolbarPanel);
    }
}

function bindToolbarPanelDrag() {
    if (!toolbarPanelHeader) return;
    toolbarPanelHeader.addEventListener('mousedown', startToolbarPanelDrag);
    window.addEventListener('mousemove', updateToolbarPanelDrag);
    window.addEventListener('mouseup', stopToolbarPanelDrag);
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
// Save UI binding
// =======================

function bindSaveEvents() {
    if (!saveButton) return;

    saveButton.addEventListener('click', () => {
        saveCurrentFrame();
    });
}

// =======================
// Export modal
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
    if (exportFpsField) {
        exportFpsField.hidden = !isGif;
    }
    if (exportFpsInput) {
        exportFpsInput.disabled = !isGif;
    }
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
    syncPopupBackdropState();
    if (getSelectedExportFormat() === 'gif' && exportFpsInput) {
        exportFpsInput.focus();
        exportFpsInput.select();
    } else if (exportResolutionSelect) {
        exportResolutionSelect.focus();
    }
}

function closeExportModal() {
    if (!exportModal) return;
    if (isExporting) return;
    exportModal.hidden = true;
    syncPopupBackdropState();
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
        setExportError('Export URL was not found.');
        return;
    }

    const format = getSelectedExportFormat();
    const resolution = exportResolutionSelect ? exportResolutionSelect.value : 'original';
    let fps = projectFps;
    if (format === 'gif') {
        const fpsRaw = exportFpsInput ? parseInt(exportFpsInput.value, 10) : projectFps;
        if (!Number.isFinite(fpsRaw) || fpsRaw <= 0) {
            setExportError('Enter a valid FPS value (1-60).');
            return;
        }
        fps = clamp(fpsRaw, 1, 60);
        if (exportFpsInput) {
            exportFpsInput.value = String(fps);
        }
    }

    // Quick client-side guardrails; the server still validates everything.
    const totalFrames = Array.isArray(timelineFrames) ? timelineFrames.length : 0;
    if (format === 'gif' && totalFrames && totalFrames > 250) {
        setExportError(`Too many frames for GIF export (${totalFrames}). Try PNG sequence export instead.`);
        return;
    }
    if (format === 'png_zip' && totalFrames && totalFrames > 2000) {
        setExportError(`Too many frames for export (${totalFrames}). Reduce the frame count.`);
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
            throw new Error('Could not save the current frame before export.');
        }

        const payload = {
            format,
            resolution,
        };
        if (format === 'gif') {
            payload.fps = fps;
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
            const fallback = 'Could not export the project.';
            throw new Error(serverMessage || fallback);
        }

        const downloadUrl = data.download_url || '';
        const filename = data.filename || '';
        if (!downloadUrl) {
            throw new Error('The server did not return a download link.');
        }

        setExportProgressVisible(false);
        setExportControlsDisabled(false);
        setExportResult(downloadUrl, filename);
        triggerDownload(downloadUrl);
    } catch (error) {
        console.error('Export error', error);
        let errorText = 'Could not export the project.';
        if (error instanceof Error && error.message) {
            errorText = error.message;
        }
        if (errorText === 'Failed to fetch') {
            errorText = 'Could not reach the server.';
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

    if (editorPopupBackdrop) {
        editorPopupBackdrop.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        editorPopupBackdrop.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const activePopup = getResolvedActiveEditorPopupId();
            if (activePopup === 'tool-settings') {
                closeToolSettingsPopover();
                return;
            }
            if (activePopup === 'onion') {
                setOnionEnabled(false);
            }
        });
    }

    exportModal.addEventListener('click', (event) => {
        const closeTarget = event.target && event.target.closest('[data-export-action="close"]');
        if (closeTarget || event.target === exportModal) {
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
// Autosave and timers
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
// Editor initialization
// =======================

/**
 * Main entry point. Set up the canvas and toolbar.
 */
async function initEditor() {
    if (!canvas || !overlayCanvas) {
        console.warn('Editor canvas was not found');
        return;
    }

    syncCanvasStageUi();
    syncCanvasSizes();
    hydratePanelPositions();
    bindTimelineEvents();
    bindPlaybackEvents();
    await loadTimelineFrames();
    initOnionSkin();
    syncEditorLayout();
    await loadFrameByIndex(currentFrameIndex);
    connectProjectPresence();

    // Apply initial values.
    setTool(currentTool);
    setColor(currentColor);
    setColor(secondaryColor, { secondary: true });
    setBrushSize(currentSize);
    setBrushOpacity(brushOpacity);
    setBrushBlur(brushBlur);
    setSelectionMode(selectionMode);

    bindCanvasEvents();
    bindToolbarEvents();
    bindToolbarPanelDrag();
    bindLayerEvents();
    bindLayersPanelDrag();
    bindHistoryPanelDrag();
    bindHistoryEvents();
    bindSaveEvents();
    bindExportEvents();
    bindCanvasStageEvents();
    syncEditorInteractionLockUi();
    updatePlaybackControlsState();
    hydratePanelPositions();
    startLastSavedTicker();
    window.addEventListener('beforeunload', disconnectProjectPresence);
    window.addEventListener('resize', syncEditorLayout);
}

// Run after the script loads.
initEditor().catch((error) => {
    console.error('Editor initialization error', error);
});