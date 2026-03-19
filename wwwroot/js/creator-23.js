//URL Params
// noinspection EqualityComparisonWithCoercionJS

var params = new URLSearchParams(window.location.search);
const debugging = true;
if (debugging) {
    //alert('debugging - 4.0');
    document.querySelectorAll('.debugging').forEach(element => element.classList.remove('hidden'));
}

/**
 * Writes verbose logs only when debug mode is enabled.
 * @param {...any} args
 */
function logDebug(...args) {
    if (debugging) {
        console.log(...args);
    }
}

/**
 * Writes warning logs only when debug mode is enabled.
 * @param {...any} args
 */
function logWarn(...args) {
    if (debugging) {
        console.warn(...args);
    }
}

/**
 * Writes error logs to the console.
 * @param {...any} args
 */
function logError(...args) {
    console.error(...args);
}

// fixUri, setImageUrl, LEGACY_BASE_WIDTH/HEIGHT, LEGACY_HIGH_RES_SCALE → creator-23.constants.js

function getStandardWidth() {
    return parseInt(localStorage.getItem('standardCardWidth')) || DEFAULT_CARD_WIDTH;
}

function getStandardHeight() {
    return parseInt(localStorage.getItem('standardCardHeight')) || DEFAULT_CARD_HEIGHT;
}

// Trackers for bulk download
window.ImageLoadTracker = {
    promises: [],
    isTracking: false,

    // Call this to start a new tracking session.
    start: function () {
        this.promises = [];
        this.isTracking = true;
    },

    // Call this to end the session.
    stop: function () {
        this.isTracking = false;
        this.promises = [];
    },

    /**
     * Creates a promise that resolves when the image from 'src' is loaded.
     * Adds this promise to the tracking array.
     * @param {string} src - The source URL of the image to load.
     */
    track: function (src) {
        // Only track if a session is active and the src is valid.
        if (!this.isTracking || !src || src.includes('blank.png')) {
            return;
        }

        const promise = new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            // Resolve the promise on load.
            img.onload = () => resolve(img);
            // Also resolve on error to prevent Promise.all from failing on a single broken image.
            // The app's own error handlers will manage displaying a blank image.
            img.onerror = () => {
                logWarn(`Could not load tracked image: ${src}`);
                resolve(null);
            };
            img.src = src;
        });
        this.promises.push(promise);
    },

    /**
     * Returns a single promise that resolves when all tracked images have finished loading.
     */
    waitForAll: function () {
        return Promise.all(this.promises);
    }
};
window.FontLoadTracker = {
    fonts: new Set(),
    isTracking: false,

    // Call this to start a new font tracking session.
    start: function () {
        this.fonts.clear();
        this.isTracking = true;
    },

    // Call this to end the session.
    stop: function () {
        this.isTracking = false;
        this.fonts.clear();
    },

    /**
     * Adds a font family to the set of required fonts for the current card.
     * @param {string} fontFamily - The name of the font family to track (e.g., 'belerenbsc').
     */
    track: function (fontFamily) {
        if (this.isTracking && fontFamily) {
            this.fonts.add(fontFamily);
        }
    },

    /**
     * Uses the document.fonts API to wait for all tracked fonts to be loaded and ready.
     * @returns {Promise} A promise that resolves when all fonts in the set are available.
     */
    waitForAll: function () {
        if (this.fonts.size === 0) {
            return Promise.resolve(); // No fonts to wait for.
        }

        const fontPromises = [];
        // The document.fonts.load() method checks if a font is ready for use.
        // It requires a size (e.g., '12px'), but the family name is the crucial part.
        for (const font of this.fonts) {
            fontPromises.push(document.fonts.load(`12px ${font}`));
        }

        logDebug('Waiting for fonts to load:', Array.from(this.fonts));
        return Promise.all(fontPromises);
    }
};

//card object
var card = {
    width: getStandardWidth(),
    height: getStandardHeight(),
    marginX: 0,
    marginY: 0,
    frames: [],
    artSource: fixUri('/img/blank.png'),
    artX: 0,
    artY: 0,
    artZoom: 1,
    artRotate: 0,
    setSymbolSource: fixUri('/img/blank.png'),
    setSymbolX: 0,
    setSymbolY: 0,
    setSymbolZoom: 1,
    watermarkSource: fixUri('/img/blank.png'),
    watermarkX: 0,
    watermarkY: 0,
    watermarkZoom: 1,
    watermarkLeft: 'none',
    watermarkRight: 'none',
    watermarkOpacity: 0.4,
    version: '',
    manaSymbols: []
};
window.cardDrawingPromiseResolver = null;
//core images/masks
const black = new Image();
black.crossOrigin = 'anonymous';
black.src = fixUri('/img/black.png');
const blank = new Image();
blank.crossOrigin = 'anonymous';
blank.src = fixUri('/img/blank.png');
const right = new Image();
right.crossOrigin = 'anonymous';
right.src = fixUri('/img/frames/maskRightHalf.png');
const middle = new Image();
middle.crossOrigin = 'anonymous';
middle.src = fixUri('/img/frames/maskMiddleThird.png');
const corner = new Image();
corner.crossOrigin = 'anonymous';
corner.src = fixUri('/img/frames/cornerCutout.png');
const serial = new Image();
serial.crossOrigin = 'anonymous';
serial.src = fixUri('/img/frames/serial.png');
//art
art = new Image();
art.crossOrigin = 'anonymous';
art.src = blank.src;
art.onerror = function () {
    if (!this.src.includes('/img/blank.png')) {
        this.src = fixUri('/img/blank.png');
    }
}
art.onload = artEdited;
//set symbol
setSymbol = new Image();
setSymbol.crossOrigin = 'anonymous';
setSymbol.src = blank.src;
setSymbol.onerror = function () {
    if (this.src.includes('gatherer.wizards.com')) {
        notify('<a target="_blank" href="http' + this.src.split('http')[2] + '">Loading the set symbol from Gatherer failed. Please check this link to see if it exists. If it does, it may be necessary to manually download and upload the image.</a>', 5);
    }
    if (!this.src.includes('/img/blank.png')) {
        this.src = fixUri('/img/blank.png');
    }
}
setSymbol.onload = setSymbolEdited;
//watermark
watermark = new Image();
watermark.crossOrigin = 'anonymous';
watermark.src = blank.src;
watermark.onerror = function () {
    if (!this.src.includes('/img/blank.png')) {
        this.src = fixUri('/img/blank.png');
    }
}
watermark.onload = watermarkEdited;
//preview canvas
var previewCanvas = document.querySelector('#previewCanvas');
var previewContext = previewCanvas.getContext('2d');
var canvasList = [];
//frame/mask picker stuff
var availableFrames = [];
var selectedFrame = null;
var selectedFrameIndex = 0;
var selectedMaskIndex = 0;
var selectedTextIndex = 0;
var replacementMasks = {};
var customCount = 0;
var lastFrameClick = null;
var lastMaskClick = null;
//for imports
var scryfallArt;
var scryfallCard;
//for text
var drawTextBetweenFrames = false;
var redrawFrames = false;
var savedTextXPosition = 0;
var savedTextXPosition2 = 0;
var savedRollYPosition = null;
var savedFont = null;
var savedTextContents = {};
//for misc
var date = new Date();
card.infoYear = date.getFullYear();
document.querySelector("#info-year").value = card.infoYear;
//to avoid rerunning special scripts (planeswalker, saga, etc...)

var loadedVersions = [];
var suppressProfilePlacementOverlay = false;

//Card Object managament
async function resetCardIrregularities(options = {}) {
    if (Array.isArray(options)) {
        options = {canvas: options};
    }

    var {
        canvas = [getStandardWidth(), getStandardHeight(), 0, 0],
        marginScale = null,
        useSelectedProfileMarginScale = false,
        resetOthers = true
    } = options;
    //misc details
    logWarn('Resetting card irregularities. This may cause some visual changes to the card, such as art cropping or margin changes, if you have made adjustments that differ from the default settings. If you have made such adjustments and want to keep them, please export your card before proceeding, as this action cannot be undone.');
    
    card.bottomInfoTranslate = {x: 0, y: 0};
    card.bottomInfoRotate = 0;
    card.bottomInfoZoom = 1;
    card.bottomInfoColor = 'white';
    replacementMasks = {};
    //rotation
    if (card.landscape) {
        // previewContext.scale(card.width/card.height, card.height/card.width);
        // previewContext.rotate(Math.PI / 2);
        // previewContext.translate(0, -card.width / 2);
        previewContext.setTransform(1, 0, 0, 1, 0, 0);
        card.landscape = false;
    }
    //card size
    var nextWidth = Number(canvas[0]);
    var nextHeight = Number(canvas[1]);
    var nextMarginX = Number(canvas[2]);
    var nextMarginY = Number(canvas[3]);

    if (!Number.isFinite(nextWidth)) {
        nextWidth = getStandardWidth();
    }
    if (!Number.isFinite(nextHeight)) {
        nextHeight = getStandardHeight();
    }
    if (!Number.isFinite(nextMarginX)) {
        nextMarginX = 0;
    }
    if (!Number.isFinite(nextMarginY)) {
        nextMarginY = 0;
    }

    if (useSelectedProfileMarginScale) {
        marginScale = getSelectedCardSizeMarginScale();
        if (marginScale === null) {
            logWarn('No profile selected or marginScale unavailable. Trying to select default profile...');
            // Fallback: try to select the first/default profile
            var selectEl = document.querySelector('#settings-card-size-profile');
            if (selectEl && selectEl.options && selectEl.options.length > 0) {
                // Find first non-empty option
                for (var i = 0; i < selectEl.options.length; i++) {
                    if (selectEl.options[i].value) {
                        selectEl.value = selectEl.options[i].value;
                        logDebug('Auto-selected profile:', selectEl.options[i].value);
                        marginScale = getSelectedCardSizeMarginScale();
                        break;
                    }
                }
            }
            if (marginScale === null) {
                logError('Could not get marginScale. Falling back to 0% margins.');
            }
        }
    }

    if (marginScale != null) {
        if (typeof marginScale === 'number' && Number.isFinite(marginScale)) {
            nextMarginX = marginScale;
            nextMarginY = marginScale;
        } else {
            var marginX = Number(marginScale.x);
            var marginY = Number(marginScale.y);
            var uniform = Number(marginScale.uniform);

            if (Number.isFinite(marginX)) {
                nextMarginX = marginX;
            } else if (Number.isFinite(uniform)) {
                nextMarginX = uniform;
            }

            if (Number.isFinite(marginY)) {
                nextMarginY = marginY;
            } else if (Number.isFinite(uniform)) {
                nextMarginY = uniform;
            }
        }
    }

    card.width = nextWidth;
    card.height = nextHeight;
    card.marginX = nextMarginX;
    card.marginY = nextMarginY;
    var expectedCanvasWidth = Math.round(card.width * (1 + 2 * card.marginX));
    var expectedCanvasHeight = Math.round(card.height * (1 + 2 * card.marginY));
    logWarn(`Card size set to ${card.width} × ${card.height} px with margins ${(card.marginX * 100).toFixed(2)}% (X) and ${(card.marginY * 100).toFixed(2)}% (Y). Canvas will be ${expectedCanvasWidth} × ${expectedCanvasHeight} px.`);
    //canvases
    canvasList.forEach(name => {
        if (window[name + 'Canvas'].width != Math.round(card.width * (1 + 2 * card.marginX)) || window[name + 'Canvas'].height != Math.round(card.height * (1 + 2 * card.marginY))) {
            sizeCanvas(name);
        }
    });
    if (resetOthers) {
        setBottomInfoStyle();
        //onload
        card.onload = null;

        card.hideBottomInfoBorder = false;
        card.showsFlavorBar = true;
    }
}

async function setBottomInfoStyle() {
    if (document.querySelector('#enableNewCollectorStyle').checked) {
        await loadBottomInfo({
            midLeft: {
                text: '{elemidinfo-set} \u2022 {elemidinfo-language}  {savex}{fontbelerenbsc}{fontsize' + scaleHeight(0.001) + '}{upinline' + scaleHeight(0.0005) + '}\uFFEE{savex2}{elemidinfo-artist}',
                x: 0.0647,
                y: 0.9548,
                width: 0.8707,
                height: 0.0171,
                oneLine: true,
                font: 'gothammedium',
                size: 0.0171,
                color: card.bottomInfoColor,
                outlineWidth: 0.003
            },
            topLeft: {
                text: '{elemidinfo-rarity} {kerning3}{elemidinfo-number}{kerning0}',
                x: 0.0647,
                y: 0.9377,
                width: 0.8707,
                height: 0.0171,
                oneLine: true,
                font: 'gothammedium',
                size: 0.0171,
                color: card.bottomInfoColor,
                outlineWidth: 0.003
            },
            note: {text: '{loadx}{elemidinfo-note}', x: 0.0647, y: 0.9377, width: 0.8707, height: 0.0171, oneLine: true, font: 'gothammedium', size: 0.0171, color: card.bottomInfoColor, outlineWidth: 0.003},
            bottomLeft: {text: 'NOT FOR SALE', x: 0.0647, y: 0.9719, width: 0.8707, height: 0.0143, oneLine: true, font: 'gothammedium', size: 0.0143, color: card.bottomInfoColor, outlineWidth: 0.003},
            wizards: {
                name: 'wizards',
                text: '{ptshift0,0.0172}\u2122 & \u00a9 {elemidinfo-year} Wizards of the Coast',
                x: 0.0647,
                y: 0.9377,
                width: 0.8707,
                height: 0.0167,
                oneLine: true,
                font: 'mplantin',
                size: 0.0162,
                color: card.bottomInfoColor,
                align: 'right',
                outlineWidth: 0.003
            },
            bottomRight: {text: '{ptshift0,0.0172}CardConjurer.com', x: 0.0647, y: 0.9548, width: 0.8707, height: 0.0143, oneLine: true, font: 'mplantin', size: 0.0143, color: card.bottomInfoColor, align: 'right', outlineWidth: 0.003}
        });
    } else {
        await loadBottomInfo({
            midLeft: {
                text: '{elemidinfo-set} \u2022 {elemidinfo-language}  {savex}{fontbelerenbsc}{fontsize' + scaleHeight(0.001) + '}{upinline' + scaleHeight(0.0005) + '}\uFFEE{savex2}{elemidinfo-artist}',
                x: 0.0647,
                y: 0.9548,
                width: 0.8707,
                height: 0.0171,
                oneLine: true,
                font: 'gothammedium',
                size: 0.0171,
                color: card.bottomInfoColor,
                outlineWidth: 0.003
            },
            topLeft: {text: '{elemidinfo-number}', x: 0.0647, y: 0.9377, width: 0.8707, height: 0.0171, oneLine: true, font: 'gothammedium', size: 0.0171, color: card.bottomInfoColor, outlineWidth: 0.003},
            note: {text: '{loadx2}{elemidinfo-note}', x: 0.0647, y: 0.9377, width: 0.8707, height: 0.0171, oneLine: true, font: 'gothammedium', size: 0.0171, color: card.bottomInfoColor, outlineWidth: 0.003},
            rarity: {text: '{loadx}{elemidinfo-rarity}', x: 0.0647, y: 0.9377, width: 0.8707, height: 0.0171, oneLine: true, font: 'gothammedium', size: 0.0171, color: card.bottomInfoColor, outlineWidth: 0.003},
            bottomLeft: {text: 'NOT FOR SALE', x: 0.0647, y: 0.9719, width: 0.8707, height: 0.0143, oneLine: true, font: 'gothammedium', size: 0.0143, color: card.bottomInfoColor, outlineWidth: 0.003},
            wizards: {
                name: 'wizards',
                text: '{ptshift0,0.0172}\u2122 & \u00a9 {elemidinfo-year} Wizards of the Coast',
                x: 0.0647,
                y: 0.9377,
                width: 0.8707,
                height: 0.0167,
                oneLine: true,
                font: 'mplantin',
                size: 0.0162,
                color: card.bottomInfoColor,
                align: 'right',
                outlineWidth: 0.003
            },
            bottomRight: {text: '{ptshift0,0.0172}CardConjurer.com', x: 0.0647, y: 0.9548, width: 0.8707, height: 0.0143, oneLine: true, font: 'mplantin', size: 0.0143, color: card.bottomInfoColor, align: 'right', outlineWidth: 0.003}
        });
    }
}

//Canvas management
function sizeCanvas(name, width = Math.round(card.width * (1 + 2 * card.marginX)), height = Math.round(card.height * (1 + 2 * card.marginY))) {
    if (!window[name + 'Canvas']) {
        window[name + 'Canvas'] = document.createElement('canvas');
        window[name + 'Context'] = window[name + 'Canvas'].getContext('2d');
        canvasList[canvasList.length] = name;
    }
    window[name + 'Canvas'].width = width;
    window[name + 'Canvas'].height = height;
    if (name == 'line') { //force true to view all canvases - must restore to name == 'line' for proper kerning adjustments
        window[name + 'Canvas'].style = 'width: 20rem; height: 28rem; border: 1px solid red;';
        const label = document.createElement('div');
        label.innerHTML = name + '<br>If you can see this and don\'t want to, please clear your cache.';
        label.appendChild(window[name + 'Canvas']);
        label.classList = 'fake-hidden'; //Comment this out to view canvases
        document.body.appendChild(label);
    }
}

//create main canvases
sizeCanvas('card');
sizeCanvas('frame');
sizeCanvas('frameMasking');
sizeCanvas('frameCompositing');
sizeCanvas('text');
sizeCanvas('paragraph');
sizeCanvas('line');
sizeCanvas('watermark');
sizeCanvas('bottomInfo');
sizeCanvas('guidelines');
sizeCanvas('profileOverlay');
sizeCanvas('prePT');

//Scaling
function scaleX(input) {
    return Math.round((input + card.marginX) * card.width);
}

function scaleWidth(input) {
    return Math.round(input * card.width);
}

function scaleY(input) {
    return Math.round((input + card.marginY) * card.height);
}

function scaleHeight(input) {
    return Math.round(input * card.height);
}

// ── Canvas Size Settings ──────────────────────────────────────────────────────
async function applyStandardCardSize() {
    var wEl = document.querySelector('#settings-card-width');
    var hEl = document.querySelector('#settings-card-height');
    var w = parseInt(wEl && wEl.value) || getStandardWidth();
    var h = parseInt(hEl && hEl.value) || getStandardHeight();
    var shouldReapplyMarginFrame = !!(card && card.margins);
    var previousMarginScale = shouldReapplyMarginFrame
        ? {x: Number(card.marginX), y: Number(card.marginY)}
        : null;
    if (w < MIN_CANVAS_SIZE || h < MIN_CANVAS_SIZE) {
        notify('Width and height must be at least ' + MIN_CANVAS_SIZE + ' px.', 4);
        return;
    }
    localStorage.setItem('standardCardWidth', w);
    localStorage.setItem('standardCardHeight', h);
    if (shouldReapplyMarginFrame) {
        var marginFrameReapplied = await applyMarginFrameSizing({
            forceEnable: true,
            fallbackMarginScale: previousMarginScale
        });
        if (marginFrameReapplied) {
            notify('Canvas size set to ' + w + ' × ' + h + ' px and the margin frame was reapplied.', 3);
            return;
        }
    }
    card.width = w;
    card.height = h;
    card.marginX = 0;
    card.marginY = 0;
    canvasList.forEach(name => sizeCanvas(name));
    drawFrames();
    drawTextBuffer();
    bottomInfoEdited();
    watermarkEdited();
    notify('Canvas size set to ' + w + ' × ' + h + ' px.', 3);
}

function resetStandardCardSize() {
    localStorage.setItem('standardCardWidth', DEFAULT_CARD_WIDTH);
    localStorage.setItem('standardCardHeight', DEFAULT_CARD_HEIGHT);
    var wEl = document.querySelector('#settings-card-width');
    var hEl = document.querySelector('#settings-card-height');
    if (wEl) {
        wEl.value = DEFAULT_CARD_WIDTH;
    }
    if (hEl) {
        hEl.value = DEFAULT_CARD_HEIGHT;
    }
    applyStandardCardSize();
}

function saveCardSizeSettings() {
    var cb = document.querySelector('#settings-load-override-size');
    localStorage.setItem('loadCardUseStandardSize', cb ? cb.checked : false);
}

async function applyMarginFrameSizing(options = {}) {
    var forceEnable = !!options.forceEnable;
    var fallbackMarginScale = options.fallbackMarginScale;

    if (!card || (!forceEnable && !card.margins)) {
        return false;
    }

    await ensureCardSizeProfilesAvailable();

    var selectedMarginScale = getSelectedCardSizeMarginScale();
    var effectiveFallbackMarginScale = null;
    if (fallbackMarginScale != null) {
        var fallbackX = Number(fallbackMarginScale.x);
        var fallbackY = Number(fallbackMarginScale.y);
        var fallbackUniform = Number(fallbackMarginScale.uniform);
        if (Number.isFinite(fallbackX) || Number.isFinite(fallbackY) || Number.isFinite(fallbackUniform)) {
            effectiveFallbackMarginScale = fallbackMarginScale;
        }
    }

    var effectiveMarginScale = selectedMarginScale || effectiveFallbackMarginScale;
    if (effectiveMarginScale == null) {
        logWarn('Margin frame could not be reapplied because no margin scale was available.');
        return false;
    }

    await resetCardIrregularities({
        canvas: [getStandardWidth(), getStandardHeight(), 0, 0],
        marginScale: effectiveMarginScale,
        resetOthers: false
    });

    card.margins = true;

    var changedArtBounds = false;
    if (card.artBounds) {
        if (card.artBounds.width == 1) {
            card.artBounds.width += 0.044;
            changedArtBounds = true;
        }
        if (card.artBounds.x == 0) {
            card.artBounds.x = -0.044;
            card.artBounds.width += 0.044;
            changedArtBounds = true;
        }
        if (card.artBounds.height == 1) {
            card.artBounds.height += 1 / 35;
            changedArtBounds = true;
        }
        if (card.artBounds.y == 0) {
            card.artBounds.y = -1 / 35;
            card.artBounds.height += 1 / 35;
            changedArtBounds = true;
        }
    }

    if (changedArtBounds) {
        autoFitArt();
    }

    var cardVersion = String(card.version || '');
    if (cardVersion.includes('planeswalker')) {
        planeswalkerEdited();
    }
    if (cardVersion.includes('saga')) {
        sagaEdited();
    }
    if (cardVersion.includes('class') && !cardVersion.includes('classic')) {
        classEdited();
    }
    if (cardVersion.includes('station')) {
        stationEdited();
    }

    drawTextBuffer();
    drawFrames();
    bottomInfoEdited();
    watermarkEdited();
    drawNewGuidelines();
    return true;
}

var cardSizeProfilesByName = Object.create(null);

function getSelectedCardSizeProfile() {
    var selectEl = document.querySelector('#settings-card-size-profile');
    if (!selectEl || !selectEl.value) {
        return null;
    }
    return cardSizeProfilesByName[selectEl.value] || null;
}

function getSelectedCardSizeMarginScale() {
    var profile = getSelectedCardSizeProfile();
    if (!profile) {
        return null;
    }

    // Fallback: if no marginScale property, calculate it from cut/bleed sizes
    if (!profile.marginScale && profile.cut && profile.bleed) {
        var x = (profile.bleed.width - profile.cut.width) / profile.cut.width;
        var y = (profile.bleed.height - profile.cut.height) / profile.cut.height;
        if (Number.isFinite(x) && Number.isFinite(y)) {
            logDebug('Calculated marginScale from cut/bleed sizes:', {x: x, y: y});
            return {x: x, y: y};
        }
    }

    if (!profile.marginScale) {
        logWarn('No marginScale found in profile:', profile.name);
        return null;
    }

    // Try to extract x and y values
    var x = Number(profile.marginScale.x);
    var y = Number(profile.marginScale.y);
    
    // If x or y are not finite, try the uniform value
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        var uniform = Number(profile.marginScale.uniform);
        if (Number.isFinite(uniform)) {
            logDebug('Using uniform marginScale:', uniform);
            return {x: uniform, y: uniform};
        }
        logWarn('Invalid marginScale values in profile:', profile.name, profile.marginScale);
        return null;
    }

    return {x: x, y: y};
}

/**
 * Logs detailed margin scale math for the selected profile (for debugging).
 */
function debugMarginScaleForSelected() {
    var profile = getSelectedCardSizeProfile();
    if (!profile) {
        logError('No profile selected');
        return;
    }

    var marginScale = getSelectedCardSizeMarginScale();
    if (!marginScale) {
        logError('Profile has no margin scale');
        return;
    }

    var cut = profile.cut || {};
    var bleed = profile.bleed || {};
    // JS sizeCanvas formula: cut * (1 + 2 * marginScale)
    var expectedBleedX = cut.width * (1 + 2 * marginScale.x);
    var expectedBleedY = cut.height * (1 + 2 * marginScale.y);

    logDebug('=== Margin Scale Debug for: ' + profile.name + ' ===');
    logDebug('Cut Size:', cut.width, '×', cut.height);
    logDebug('Bleed Size (expected):', bleed.width, '×', bleed.height);
    logDebug('JS formula: sizeCanvas uses cut × (1 + 2×margin)');
    logDebug('MarginScaleX:', marginScale.x.toFixed(6), '→', cut.width, '× (1 + 2×' + marginScale.x.toFixed(6) + ') =', Math.round(expectedBleedX), '(expected ' + bleed.width + ')');
    logDebug('MarginScaleY:', marginScale.y.toFixed(6), '→', cut.height, '× (1 + 2×' + marginScale.y.toFixed(6) + ') =', Math.round(expectedBleedY), '(expected ' + bleed.height + ')');
    logDebug('Match:', (Math.abs(expectedBleedX - bleed.width) < 2 && Math.abs(expectedBleedY - bleed.height) < 2) ? '✓ YES' : '✗ NO (BUG!)');
    if (profile.debug) {
        logDebug('Server debug:', profile.debug);
    }
}

function onCardSizeProfileChanged() {
    var selectEl = document.querySelector('#settings-card-size-profile');
    var wEl = document.querySelector('#settings-card-width');
    var hEl = document.querySelector('#settings-card-height');

    if (!selectEl) {
        return;
    }

    var selectedName = selectEl.value;
    var profile = cardSizeProfilesByName[selectedName];

    if (!profile) {
        return;
    }

    localStorage.setItem(LS_CARD_SIZE_PROFILE, selectedName);

    var selectedSize = profile.cut;
    if (!selectedSize) {
        return;
    }

    if (wEl) {
        wEl.value = selectedSize.width;
    }
    if (hEl) {
        hEl.value = selectedSize.height;
    }

    // Keep legacy width/height storage in sync for existing load/save behavior.
    localStorage.setItem('standardCardWidth', selectedSize.width);
    localStorage.setItem('standardCardHeight', selectedSize.height);

    if (document.querySelector('#show-profile-placement-overlay')?.checked) {
        drawCard();
    }
}

async function loadCardSizeProfiles() {
    var selectEl = document.querySelector('#settings-card-size-profile');
    if (!selectEl) {
        return;
    }

    try {
        var response = await fetch(CARD_SIZE_PROFILES_ENDPOINT, {
            method: 'GET',
            headers: {'Accept': 'application/json'}
        });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }

        var payload = await response.json();
        var profiles = Array.isArray(payload && payload.profiles) ? payload.profiles : [];
        
        logDebug('Loaded profiles from API:', profiles);

        cardSizeProfilesByName = Object.create(null);
        selectEl.innerHTML = '';

        profiles.forEach(function(profile) {
            if (!profile || !profile.name || !profile.cut || !profile.bleed) {
                logDebug('Skipping invalid profile:', profile);
                return;
            }

            cardSizeProfilesByName[profile.name] = profile;
            logDebug('Stored profile:', profile.name, {cut: profile.cut, bleed: profile.bleed, marginScale: profile.marginScale});

            var option = document.createElement('option');
            option.value = profile.name;
            option.textContent = profile.name + ' (' + profile.cut.width + ' x ' + profile.cut.height + ')';
            selectEl.appendChild(option);
        });

        var fallbackName = payload && payload.defaultProfileName;
        var savedName = localStorage.getItem(LS_CARD_SIZE_PROFILE);
        var initialName = savedName && cardSizeProfilesByName[savedName]
            ? savedName
            : (fallbackName && cardSizeProfilesByName[fallbackName]
                ? fallbackName
                : (selectEl.options.length > 0 ? selectEl.options[0].value : ''));

        if (initialName) {
            selectEl.value = initialName;
            localStorage.setItem(LS_CARD_SIZE_PROFILE, initialName);
            onCardSizeProfileChanged();
        } else {
            var emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = 'No profiles available';
            selectEl.appendChild(emptyOption);
        }
    } catch (error) {
        logError('Could not load card size profiles:', error);
        selectEl.innerHTML = '';
        var option = document.createElement('option');
        option.value = '';
        option.textContent = 'Profile list unavailable';
        selectEl.appendChild(option);
    }
}

function initCardSizeSettings() {
    var w = localStorage.getItem('standardCardWidth') || DEFAULT_CARD_WIDTH;
    var h = localStorage.getItem('standardCardHeight') || DEFAULT_CARD_HEIGHT;
    var wEl = document.querySelector('#settings-card-width');
    var hEl = document.querySelector('#settings-card-height');
    var cb = document.querySelector('#settings-load-override-size');
    if (wEl) {
        wEl.value = w;
    }
    if (hEl) {
        hEl.value = h;
    }
    if (cb) {
        cb.checked = localStorage.getItem('loadCardUseStandardSize') === 'true';
    }

    loadCardSizeProfiles();
}

// ─────────────────────────────────────────────────────────────────────────────

//Other nifty functions
function getElementIndex(element) {
    return Array.prototype.indexOf.call(element.parentElement.children, element);
}

function getCardName() {
    if (card.text == undefined || card.text.title == undefined) {
        return 'unnamed';
    }
    var imageName = card.text.title.text || 'unnamed';
    if (card.text.nickname) {
        imageName += ' (' + card.text.nickname.text + ')';
    }
    return imageName.replace(/\{[^}]+}/g, '');
}

function getInlineCardName() {
    if (card.text == undefined || card.text.title == undefined) {
        return 'unnamed';
    }
    var imageName = card.text.title.text || 'unnamed';
    if (card.text.nickname) {
        imageName = card.text.nickname.text;
    }
    return imageName.replace(/\{[^}]+}/g, '');
}

//UI
function toggleCreatorTabs(event, target) {
    Array.from(document.querySelector('#creator-menu-sections').children).forEach(element => element.classList.add('hidden'));
    document.querySelector('#creator-menu-' + target).classList.remove('hidden');
    selectSelectable(event);
}

function selectSelectable(event) {
    var eventTarget = event.target.closest('.selectable');
    Array.from(eventTarget.parentElement.children).forEach(element => element.classList.remove('selected'));
    eventTarget.classList.add('selected');
}

function dragStart(event) {
    Array.from(document.querySelectorAll('.dragging')).forEach(element => element.classList.remove('dragging'));
    event.target.closest('.draggable').classList.add('dragging');
}

function dragEnd(event) {
    Array.from(document.querySelectorAll('.dragging')).forEach(element => element.classList.remove('dragging'));
}

function touchMove(event) {
    if (event.target.nodeName != 'H4') {
        event.preventDefault();
    }
    var clientX = event.touches[0].clientX;
    var clientY = event.touches[0].clientY;
    Array.from(document.querySelector('.dragging').parentElement.children).forEach(element => {
        var elementBounds = element.getBoundingClientRect();
        if (clientY > elementBounds.top && clientY < elementBounds.bottom) {
            dragOver(element, false);
        }
    })
}

function dragOver(event, drag = true) {
    var eventTarget;
    if (drag) {
        eventTarget = event.target.closest('.draggable');
    } else {
        eventTarget = event;
    }
    var movingElement = document.querySelector('.dragging');
    if (document.querySelector('.dragging') && !eventTarget.classList.contains('dragging') && eventTarget.parentElement == movingElement.parentElement) {
        var parentElement = eventTarget.parentElement;
        var elements = document.createDocumentFragment();
        var movingElementPassed = false;
        var movingElementOldIndex = -1;
        var movingElementNewIndex = -1;
        Array.from(parentElement.children).forEach((element, index) => {
            if (element == eventTarget) {
                movingElementNewIndex = index;
                if (movingElementPassed) {
                    elements.appendChild(element.cloneNode(true));
                    elements.appendChild(movingElement.cloneNode(true));
                } else {
                    elements.appendChild(movingElement.cloneNode(true));
                    elements.appendChild(element.cloneNode(true));
                }
            } else if (element != movingElement) {
                elements.appendChild(element.cloneNode(true));
            } else {
                movingElementOldIndex = index;
                movingElementPassed = true;
            }
        });
        Array.from(elements.children).forEach(element => {
            element.ondragstart = dragStart;
            element.ontouchstart = dragStart;
            element.ondragend = dragEnd;
            element.ontouchend = dragEnd;
            element.ondragover = dragOver;
            element.ontouchmove = touchMove;
            element.onclick = frameElementClicked;
            element.children[3].onclick = removeFrame;
        })
        parentElement.innerHTML = null;
        parentElement.appendChild(elements);
        if (movingElementNewIndex >= 0) {
            var originalMovingElement = card.frames[movingElementOldIndex];
            card.frames.splice(movingElementOldIndex, 1);
            card.frames.splice(movingElementNewIndex, 0, originalMovingElement);
            drawFrames();
        }
    }
}

//Set Symbols
// setSymbolAliases Map → creator-23.constants.js

//Mana Symbols
// mana Map, loadManaSymbols() init calls, loadManaSymbols function,
// getManaSymbol, findManaSymbolIndex → creator-23.constants.js

//FRAME TAB
function drawFrames() {
    frameContext.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
    var frameToDraw = card.frames.slice().reverse();
    var haveDrawnPrePTCanvas = false;
    frameToDraw.forEach(item => {
        if (item.image) {
            if (!haveDrawnPrePTCanvas && drawTextBetweenFrames && item.name.includes('Power/Toughness')) {
                haveDrawnPrePTCanvas = true;
                frameContext.globalCompositeOperation = 'source-over';
                frameContext.globalAlpha = 1;
                frameContext.drawImage(prePTCanvas, 0, 0, frameCanvas.width, frameCanvas.height);
            }
            frameContext.globalCompositeOperation = item.mode || 'source-over';
            frameContext.globalAlpha = item.opacity / 100 || 1;
            if (item.opacity == 0) {
                frameContext.globalAlpha = 0;
            }
            var bounds = item.bounds || {};
            var ogBounds = item.ogBounds || bounds;
            frameX = Math.round(scaleX(bounds.x || 0));
            frameY = Math.round(scaleY(bounds.y || 0));
            frameWidth = Math.round(scaleWidth(bounds.width || 1));
            frameHeight = Math.round(scaleHeight(bounds.height || 1));
            frameMaskingContext.globalCompositeOperation = 'source-over';
            frameMaskingContext.drawImage(black, 0, 0, frameMaskingCanvas.width, frameMaskingCanvas.height);
            frameMaskingContext.globalCompositeOperation = 'source-in';
            item.masks.forEach(mask => frameMaskingContext.drawImage(mask.image, scaleX((bounds.x || 0) - (ogBounds.x || 0) - ((ogBounds.x || 0) * ((bounds.width || 1) / (ogBounds.width || 1) - 1))), scaleY((bounds.y || 0) - (ogBounds.y || 0) - ((ogBounds.y || 0) * ((bounds.height || 1) / (ogBounds.height || 1) - 1))), scaleWidth((bounds.width || 1) / (ogBounds.width || 1)), scaleHeight((bounds.height || 1) / (ogBounds.height || 1))));
            if (item.preserveAlpha) { //preserves alpha, and blends colors using an alpha that only cares about the mask(s), and the user-set opacity value
                //draw the image onto a separate canvas to view its unaltered state
                frameCompositingContext.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
                frameCompositingContext.drawImage(item.image, frameX, frameY, frameWidth, frameHeight);
                //create pixel arrays for the existing image, new image, and alpha mask
                var existingData = frameContext.getImageData(0, 0, frameCanvas.width, frameCanvas.height)
                var existingPixels = existingData.data;
                var newPixels = frameCompositingContext.getImageData(0, 0, frameCanvas.width, frameCanvas.height).data;
                var maskPixels = frameMaskingContext.getImageData(0, 0, frameCanvas.width, frameCanvas.height).data;
                const functionalAlphaMultiplier = frameContext.globalAlpha / 255;
                //manually blends colors, basing blending-alpha on the masks and desired draw-opacity, but preserving alpha
                for (var i = 0; i < existingPixels.length; i += 4) {
                    const functionalAlpha = maskPixels[i + 3] * functionalAlphaMultiplier //functional alpha = alpha ignoring source image
                    if (newPixels[i + 3] > 0) { //Only blend if the new image has alpha
                        existingPixels[i] = existingPixels[i] * (1 - functionalAlpha) + newPixels[i] * functionalAlpha; //RED
                        existingPixels[i + 1] = existingPixels[i + 1] * (1 - functionalAlpha) + newPixels[i + 1] * functionalAlpha; //GREEN
                        existingPixels[i + 2] = existingPixels[i + 2] * (1 - functionalAlpha) + newPixels[i + 2] * functionalAlpha; //BLUE
                    }
                }
                frameContext.putImageData(existingData, 0, 0);
            } else {
                //mask the image
                frameMaskingContext.drawImage(item.image, frameX, frameY, frameWidth, frameHeight);
                //color overlay
                if (item.colorOverlayCheck) {
                    frameMaskingContext.globalCompositeOperation = 'source-in';
                    frameMaskingContext.fillStyle = item.colorOverlay;
                    frameMaskingContext.fillRect(0, 0, frameMaskingCanvas.width, frameMaskingCanvas.height);
                }
                //HSL adjustments
                if (item.hslHue || item.hslSaturation || item.hslLightness) {
                    hsl(frameMaskingCanvas, item.hslHue || 0, item.hslSaturation || 0, item.hslLightness || 0);
                }
                //erase mode
                if (item.erase) {
                    frameContext.globalCompositeOperation = 'destination-out';
                }
                frameContext.drawImage(frameMaskingCanvas, 0, 0, frameCanvas.width, frameCanvas.height);
            }
        }
    });
    if (!haveDrawnPrePTCanvas && drawTextBetweenFrames) {
        haveDrawnPrePTCanvas = true;
        frameContext.globalCompositeOperation = 'source-over';
        frameContext.globalAlpha = 1;
        frameContext.drawImage(prePTCanvas, 0, 0, frameCanvas.width, frameCanvas.height);
    }
    drawCard();
}

function loadFramePacks(framePackOptions = []) {
    document.querySelector('#selectFramePack').innerHTML = null;
    framePackOptions.forEach(item => {
        var framePackOption = document.createElement('option');
        framePackOption.innerHTML = item.name;
        if (item.value == 'disabled') {
            framePackOption.disabled = true;
        } else {
            framePackOption.value = item.value;
        }
        document.querySelector('#selectFramePack').appendChild(framePackOption);
    });
    loadScript("/js/frames/pack" + document.querySelector('#selectFramePack').value + ".js");
}

function loadFramePack(frameOptions = availableFrames) {
    resetDoubleClick();
    document.querySelector('#frame-picker').innerHTML = null;
    frameOptions.forEach(item => {
        var frameOption = document.createElement('div');
        frameOption.classList = 'frame-option hidden';
        frameOption.onclick = frameOptionClicked;
        var frameOptionImage = document.createElement('img');
        frameOption.appendChild(frameOptionImage);
        frameOptionImage.onload = function () {
            this.parentElement.classList.remove('hidden');
        }
        if (!item.noThumb && !item.src.includes('/img/black.png')) {
            frameOptionImage.src = fixUri(item.src.replace('.png', 'Thumb.png').replace('.svg', 'Thumb.png'));
        } else {
            frameOptionImage.src = fixUri(item.src);
        }
        document.querySelector('#frame-picker').appendChild(frameOption);

    })
    document.querySelector('#mask-picker').innerHTML = '';
    document.querySelector('#frame-picker').children[0].click();
    if (localStorage.getItem('autoLoadFrameVersion') == 'true') {
        document.querySelector('#loadFrameVersion').click();
    }
}

function autoLoadFrameVersion() {
    localStorage.setItem('autoLoadFrameVersion', document.querySelector('#autoLoadFrameVersion').checked);
}

function frameOptionClicked(event) {
    const button = doubleClick(event, 'frame');
    const clickedFrameOption = event.target.closest('.frame-option');
    const newFrameIndex = getElementIndex(clickedFrameOption);
    if (newFrameIndex != selectedFrameIndex || document.querySelector('#mask-picker').innerHTML == '') {
        resetDoubleClick();
        Array.from(document.querySelectorAll('.frame-option.selected')).forEach(element => element.classList.remove('selected'));
        clickedFrameOption.classList.add('selected');
        selectedFrameIndex = newFrameIndex;
        if (!availableFrames[selectedFrameIndex].noDefaultMask) {
            document.querySelector('#mask-picker').innerHTML = '<div class="mask-option" onclick="maskOptionClicked(event)"><img src="' + black.src + '"><p>No Mask</p></div>';
        } else {
            document.querySelector('#mask-picker').innerHTML = '';
        }
        document.querySelector('#selectedPreview').innerHTML = '(Selected: ' + availableFrames[selectedFrameIndex].name + ', No Mask)';
        if (availableFrames[selectedFrameIndex].masks) {
            availableFrames[selectedFrameIndex].masks.forEach(item => {
                const maskOption = document.createElement('div');
                maskOption.classList = 'mask-option hidden';
                maskOption.onclick = maskOptionClicked;
                const maskOptionImage = document.createElement('img');
                maskOption.appendChild(maskOptionImage);
                maskOptionImage.onload = function () {
                    this.parentElement.classList.remove('hidden');
                }
                maskOptionImage.src = fixUri(item.src.replace('.png', 'Thumb.png').replace('.svg', 'Thumb.png'));
                const maskOptionLabel = document.createElement('p');
                maskOptionLabel.innerHTML = item.name;
                maskOption.appendChild(maskOptionLabel);
                document.querySelector('#mask-picker').appendChild(maskOption);
            });
        }
        const firstChild = document.querySelector('#mask-picker').firstChild;
        firstChild.classList.add('selected');
        firstChild.click();
    } else if (button) {
        button.click();
        resetDoubleClick();
    }
}

function maskOptionClicked(event) {
    var button = doubleClick(event, 'mask');
    const clickedMaskOption = event.target.closest('.mask-option');
    (document.querySelector('.mask-option.selected').classList || document.querySelector('body').classList).remove('selected');
    clickedMaskOption.classList.add('selected');
    const newMaskIndex = getElementIndex(clickedMaskOption)
    if (newMaskIndex != selectedMaskIndex) {
        button = null;
    }
    selectedMaskIndex = newMaskIndex;
    var selectedMaskName = 'No Mask'
    if (selectedMaskIndex > 0) {
        selectedMaskName = availableFrames[selectedFrameIndex].masks[selectedMaskIndex - 1].name;
    }
    document.querySelector('#selectedPreview').innerHTML = '(Selected: ' + availableFrames[selectedFrameIndex].name + ', ' + selectedMaskName + ')';
    if (button) {
        button.click();
        resetDoubleClick();
    }
}

function resetDoubleClick() {
    lastFrameClick, lastMaskClick = null, null;
}

function doubleClick(event, maskOrFrame) {
    const currentClick = (new Date()).getTime();
    var lastClick = null;
    if (maskOrFrame == 'mask') {
        lastClick = lastMaskClick;
        lastMaskClick = currentClick;
    } else {
        lastClick = lastFrameClick + 0;
        lastFrameClick = currentClick;
    }
    if (lastClick && lastClick + 500 > currentClick) {
        var buttonID = null;
        if (event.shiftKey) {
            buttonID = '#addToRightHalf';
        } else if (event.ctrlKey) {
            buttonID = '#addToLeftHalf';
        } else if (event.altKey) {
            buttonID = '#addToMiddleThird';
        } else {
            buttonID = '#addToFull';
        }
        return document.querySelector(buttonID);
    }
    return null;
}

function cardFrameProperties(colors, manaCost, typeLine, power, style) {
    var colors = colors.map(color => color.toUpperCase())
    if ([
        ['U', 'W'],
        ['B', 'W'],
        ['R', 'B'],
        ['G', 'B'],
        ['B', 'U'],
        ['R', 'U'],
        ['G', 'R'],
        ['W', 'R'],
        ['W', 'G'],
        ['U', 'G']
    ].map(arr => JSON.stringify(arr) === JSON.stringify(colors)).includes(true)) {
        colors.reverse();
    }

    var isHybrid = manaCost.includes('/');

    var rules;
    if (style == 'Seventh') {
        if (typeLine.includes('Land')) {
            if (colors.length == 0 || colors.length > 2) {
                rules = 'L';
            } else {
                rules = colors[0] + 'L';
            }
        } else {
            if (colors.length == 1) {
                rules = colors[0];
            } else if (colors.length >= 2) {
                rules = 'M';
            } else if (typeLine.includes("Artifact")) {
                rules = 'A';
            } else {
                rules = 'C';
            }
        }

    } else {
        if (typeLine.includes('Land')) {
            if (colors.length == 0) {
                rules = 'L';
            } else if (colors.length > 2) {
                rules = 'ML';
            } else {
                rules = colors[0] + 'L';
            }
        } else if (colors.length > 2) {
            if (style == 'Etched' && typeLine.includes('Artifact')) {
                rules = 'A';
            } else {
                rules = 'M';
            }
        } else if (colors.length != 0) {
            rules = colors[0];
        } else if (style == 'Borderless' && !typeLine.includes('Artifact')) {
            rules = 'C';
        } else {
            rules = 'A';
        }
    }

    var rulesRight;
    if (colors.length == 2) {
        if (typeLine.includes('Land')) {
            rulesRight = colors[1] + 'L';
        } else if (style != 'Seventh') {
            rulesRight = colors[1];
        }
    }

    var pinline = rules;
    var pinlineRight = rulesRight;

    if (style == 'Seventh' && typeLine.includes('Land') && colors.length >= 2) {
        pinline = 'L';
        pinlineRight = null;
    }

    var typeTitle;
    if (colors.length >= 2) {
        if (isHybrid || typeLine.includes('Land')) {
            if (colors.length >= 3) {
                typeTitle = 'M';
            } else {
                typeTitle = 'L';
            }
        } else {
            typeTitle = 'M';
        }
    } else if (typeLine.includes('Land')) {
        if (colors.length == 0) {
            typeTitle = 'L';
        } else if (style == 'Etched') {
            if (colors.length > 2) {
                typeTitle = 'M';
            } else if (colors.length == 1) {
                typeTitle = colors[0];
            } else {
                typeTitle = 'L';
            }
        } else {
            typeTitle = colors[0] + 'L';
        }
    } else if (colors.length == 1) {
        typeTitle = colors[0];
    } else if (style == 'Borderless' && !typeLine.includes('Artifact')) {
        typeTitle = 'C';
    } else {
        typeTitle = 'A';
    }

    var pt;
    if (power) {
        if (typeLine.includes('Vehicle')) {
            pt = 'V';
        } else if (typeTitle == 'L') {
            pt = 'C';
        } else {
            pt = typeTitle;
        }
    }

    var frame;
    if (style == 'Seventh') {
        if (typeLine.includes('Land')) {
            frame = 'L'
        } else {
            frame = pinline;
        }
    } else if (typeLine.includes('Land')) {
        if (style == 'Etched') {
            if (colors.length > 2) {
                frame = 'M';
            } else if (colors.length > 0) {
                frame = colors[0];
            } else {
                frame = 'L';
            }
        } else {
            frame = 'L';
        }
    } else if (typeLine.includes('Vehicle')) {
        frame = 'V';
    } else if (typeLine.includes('Artifact')) {
        frame = 'A';
    } else if (colors.length > 2) {
        frame = 'M';
    } else if (colors.length == 2) {
        if (isHybrid || style == 'Etched') {
            frame = colors[0];
        } else {
            frame = 'M';
        }
    } else if (colors.length == 1) {
        frame = colors[0];
    } else {
        frame = 'L';
    }

    var frameRight;
    if (!(typeLine.includes('Vehicle') || typeLine.includes('Artifact'))) {
        if (colors.length == 2 && (isHybrid || style == 'Etched')) {
            frameRight = colors[1];
        }
    }

    return {
        'pinline': pinline,
        'pinlineRight': pinlineRight,
        'rules': rules,
        'rulesRight': rulesRight,
        'typeTitle': typeTitle,
        'pt': pt,
        'frame': frame,
        'frameRight': frameRight
    }
}

function setAutoframeNyx(value) {
    localStorage.setItem('autoframe-always-nyx', document.querySelector('#autoframe-always-nyx').checked);
    setAutoFrame();
}

var autoFramePack;

function autoFrame() {
    var frame = document.querySelector('#autoFrame').value;
    if (frame == 'false') {
        autoFramePack = null;
        return;
    }

    var colors = [];
    if (card.text.type.text.toLowerCase().includes('land')) {
        var rules = card.text.rules.text;
        var flavorIndex = rules.indexOf('{flavor}');
        if (flavorIndex == -1) {
            flavorIndex = rules.indexOf('{oldflavor}');
        }
        if (flavorIndex != -1) {
            rules = rules.substring(0, flavorIndex);
        }

        var lines = rules.split('\n');

        lines.forEach(function (line) {
            var addIndex = line.indexOf('Add');
            var length = 3;
            if (addIndex == -1) {
                addIndex = line.toLowerCase().indexOf(' add');
                length = 4;
            }
            if (addIndex != -1) {
                var upToAdd = line.substring(addIndex + length).toLowerCase();
                ['W', 'U', 'B', 'R', 'G'].forEach(function (color) {
                    if (upToAdd.includes('{' + color.toLowerCase() + '}')) {
                        colors.push(color);
                    }
                });
            }
        });

        if (!colors.includes('W') && (rules.toLowerCase().includes('plains') || card.text.type.text.toLowerCase().includes('plains'))) {
            colors.push('W');
        }
        if (!colors.includes('U') && (rules.toLowerCase().includes('island') || card.text.type.text.toLowerCase().includes('island'))) {
            colors.push('U');
        }
        if (!colors.includes('B') && (rules.toLowerCase().includes('swamp') || card.text.type.text.toLowerCase().includes('swamp'))) {
            colors.push('B');
        }
        if (!colors.includes('R') && (rules.toLowerCase().includes('mountain') || card.text.type.text.toLowerCase().includes('mountain'))) {
            colors.push('R');
        }
        if (!colors.includes('G') && (rules.toLowerCase().includes('forest') || card.text.type.text.toLowerCase().includes('forest'))) {
            colors.push('G');
        }

        if (rules.toLowerCase().includes('search') && colors.length == 0) {
            // TODO: This doesn't match Bog Wreckage
            if (rules.includes('into your hand') || (rules.includes('tapped') && !(rules.toLowerCase().includes('enters the battlefield tapped')) && !(rules.toLowerCase().includes('untap')))) {
                colors = [];
            } else if (colors.length == 0) {
                colors = ['W', 'U', 'B', 'R', 'G'];
            }
        }

        if (rules.includes('any color') || rules.includes('any one color') || rules.includes('choose a color') || rules.includes('any combination of colors')) {
            colors = ['W', 'U', 'B', 'R', 'G'];
        }


    } else {
        colors = [...new Set(card.text.mana.text.toUpperCase().split('').filter(char => ['W', 'U', 'B', 'R', 'G'].includes(char)))];
    }

    var group;
    if (frame == 'M15Regular-1') {
        autoM15Frame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
        group = 'Standard-3';
    } else if (frame == 'M15RegularNew') {
        autoM15NewFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
        group = 'Accurate';
    } else if (frame == 'M15Eighth') {
        autoM15EighthFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
        group = 'Custom';
    } else if (frame == 'M15EighthUB') {
        autoM15EighthUBFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
        group = 'Custom';
    } else if (frame == 'UB') {
        autoUBFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
        group = 'Showcase-5';
    } else if (frame == 'UBNew') {
        autoUBNewFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
        group = 'Accurate';
    } else if (frame == 'FullArtNew') {
        autoFullArtNewFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
        group = 'Accurate';
    } else if (frame == 'Circuit') {
        autoCircuitFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
        group = 'Custom';
    } else if (frame == 'Etched') {
        group = 'Showcase-5';
        autoEtchedFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
    } else if (frame == 'Praetors') {
        group = 'Showcase-5';
        autoPhyrexianFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
    } else if (frame == 'Seventh') {
        group = 'Misc-2';
        autoSeventhEditionFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
    } else if (frame == 'M15BoxTopper') {
        group = 'Showcase-5';
        autoExtendedArtFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text, false);
    } else if (frame == 'M15ExtendedArtShort') {
        group = 'Showcase-5';
        autoExtendedArtFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text, true);
    } else if (frame == '8th') {
        group = 'Misc-2';
        auto8thEditionFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
    } else if (frame == 'Borderless') {
        group = 'Showcase-5';
        autoBorderlessFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
    } else if (frame == 'BorderlessUB') {
        group = 'Showcase-5';
        autoBorderlessUBFrame(colors, card.text.mana.text, card.text.type.text, card.text.pt.text);
        frame = 'Borderless';
    }

    if (autoFramePack != frame) {
        loadScript('/js/frames/pack' + frame + '.js');
        autoFramePack = frame;
    }
}

async function autoUBFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension') || frame.name.includes('Gray Holo Stamp') || frame.name.includes('Gold Holo Stamp'));

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power);

    var style = false;
    if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }

    // Set frames

    if (type_line.toLowerCase().includes('legendary')) {
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeUBFrameByLetter(properties.pinlineRight, 'Inner Crown', true, style));
            }
            frames.push(makeUBFrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }

        if (properties.pinlineRight) {
            frames.push(makeUBFrameByLetter(properties.pinlineRight, 'Crown', true, style));
        }
        frames.push(makeUBFrameByLetter(properties.pinline, "Crown", false, style));
        frames.push(makeUBFrameByLetter(properties.pinline, "Crown Border Cover", false, style));
    }
    if (properties.pinlineRight) {
        frames.push(makeUBFrameByLetter(properties.pinlineRight, 'Stamp', true, style));
    }
    frames.push(makeUBFrameByLetter(properties.pinline, "Stamp", false, style));
    if (properties.pt) {
        frames.push(makeUBFrameByLetter(properties.pt, 'PT', false, style));
    }
    if (properties.pinlineRight) {
        frames.push(makeUBFrameByLetter(properties.pinlineRight, 'Pinline', true, style));
    }
    frames.push(makeUBFrameByLetter(properties.pinline, 'Pinline', false, style));
    frames.push(makeUBFrameByLetter(properties.typeTitle, 'Type', false, style));
    frames.push(makeUBFrameByLetter(properties.typeTitle, 'Title', false, style));
    if (properties.pinlineRight) {
        frames.push(makeUBFrameByLetter(properties.rulesRight, 'Rules', true, style));
    }
    frames.push(makeUBFrameByLetter(properties.rules, 'Rules', false, style));
    if (properties.frameRight) {
        frames.push(makeUBFrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(makeUBFrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(makeUBFrameByLetter(properties.frame, 'Border', false, style));

    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoUBNewFrame(colors, mana_cost, type_line, power) {
    autoM15NewFrame(colors, mana_cost, type_line, power, 'ub');
}

async function autoFullArtNewFrame(colors, mana_cost, type_line, power) {
    autoM15NewFrame(colors, mana_cost, type_line, power, 'fullart');
}

async function autoCircuitFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension') || frame.name.includes('Gray Holo Stamp') || frame.name.includes('Gold Holo Stamp'));

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power);

    // Set frames

    if (type_line.toLowerCase().includes('legendary')) {
        if (properties.pinlineRight) {
            frames.push(makeCircuitFrameByLetter(properties.pinlineRight, 'Crown', true));
        }
        frames.push(makeCircuitFrameByLetter(properties.pinline, "Crown", false));
        frames.push(makeCircuitFrameByLetter(properties.pinline, "Crown Border Cover", false));
    }
    if (properties.pt) {
        frames.push(makeCircuitFrameByLetter(properties.pt, 'PT', false));
    }
    if (properties.pinlineRight) {
        frames.push(makeCircuitFrameByLetter(properties.pinlineRight, 'Pinline', true));
    }
    frames.push(makeCircuitFrameByLetter(properties.pinline, 'Pinline', false));
    frames.push(makeCircuitFrameByLetter(properties.typeTitle, 'Type', false));
    frames.push(makeCircuitFrameByLetter(properties.typeTitle, 'Title', false));
    if (properties.pinlineRight) {
        frames.push(makeCircuitFrameByLetter(properties.rulesRight, 'Rules', true));
    }
    frames.push(makeCircuitFrameByLetter(properties.rules, 'Rules', false));
    if (properties.frameRight) {
        frames.push(makeCircuitFrameByLetter(properties.frameRight, 'Frame', true));
    }
    frames.push(makeCircuitFrameByLetter(properties.frame, 'Frame', false));
    frames.push(makeCircuitFrameByLetter(properties.frame, 'Border', false));

    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoM15Frame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    var style = 'regular';
    if (type_line.toLowerCase().includes('snow')) {
        style = 'snow';
    } else if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }

    // Set frames
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeM15FrameByLetter(properties.pinlineRight, 'Inner Crown', true, style));
            }
            frames.push(makeM15FrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }

        if (properties.pinlineRight) {
            frames.push(makeM15FrameByLetter(properties.pinlineRight, 'Crown', true, style));
        }
        frames.push(makeM15FrameByLetter(properties.pinline, "Crown", false, style));
        frames.push(makeM15FrameByLetter(properties.pinline, "Crown Border Cover", false, style));
    }
    if (properties.pt) {
        frames.push(makeM15FrameByLetter(properties.pt, 'PT', false, style));
    }
    if (properties.pinlineRight) {
        frames.push(makeM15FrameByLetter(properties.pinlineRight, 'Pinline', true, style));
    }
    frames.push(makeM15FrameByLetter(properties.pinline, 'Pinline', false, style));
    frames.push(makeM15FrameByLetter(properties.typeTitle, 'Type', false, style));
    frames.push(makeM15FrameByLetter(properties.typeTitle, 'Title', false, style));
    if (properties.pinlineRight) {
        frames.push(makeM15FrameByLetter(properties.rulesRight, 'Rules', true, style));
    }
    frames.push(makeM15FrameByLetter(properties.rules, 'Rules', false, style));
    if (properties.frameRight) {
        frames.push(makeM15FrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(makeM15FrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(makeM15FrameByLetter(properties.frame, 'Border', false, style));

    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoM15NewFrame(colors, mana_cost, type_line, power, style = 'regular') {
    var frames;
    if (style == 'ub') {
        frames = card.frames.filter(frame => frame.name.includes('Extension') || frame.name.includes('Gray Holo Stamp'));
    } else {
        frames = card.frames.filter(frame => frame.name.includes('Extension'));
    }

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    if (style == 'ub') {
        if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
            style = 'ubnyx';
        }
    } else if (style != 'fullart') {
        if (type_line.toLowerCase().includes('snow')) {
            style = 'snow';
        } else if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
            style = 'Nyx';
        }
    }

    // Set frames
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx' || style == 'ubnyx') {
            if (properties.pinlineRight) {
                frames.push(makeM15NewFrameByLetter(properties.pinlineRight, 'Inner Crown', true, style));
            }

            frames.push(makeM15NewFrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }

        if (properties.pinlineRight) {
            frames.push(makeM15NewFrameByLetter(properties.pinlineRight, 'Crown', true, style));
        }
        frames.push(makeM15NewFrameByLetter(properties.pinline, "Crown", false, style));
        frames.push(makeM15NewFrameByLetter(properties.pinline, "Crown Border Cover", false, style));
    }

    if (style == 'ub' || style == 'ubnyx') {
        if (properties.pinlineRight) {
            frames.push(makeM15NewFrameByLetter(properties.pinlineRight, 'Stamp', true, style));
        }
        frames.push(makeM15NewFrameByLetter(properties.pinline, "Stamp", false, style));
    }

    if (properties.pt) {
        frames.push(makeM15NewFrameByLetter(properties.pt, 'PT', false, style));
    }
    if (properties.pinlineRight) {
        frames.push(makeM15NewFrameByLetter(properties.pinlineRight, 'Pinline', true, style));
    }
    frames.push(makeM15NewFrameByLetter(properties.pinline, 'Pinline', false, style));
    frames.push(makeM15NewFrameByLetter(properties.typeTitle, 'Type', false, style));
    frames.push(makeM15NewFrameByLetter(properties.typeTitle, 'Title', false, style));
    if (properties.pinlineRight) {
        frames.push(makeM15NewFrameByLetter(properties.rulesRight, 'Rules', true, style));
    }
    frames.push(makeM15NewFrameByLetter(properties.rules, 'Rules', false, style));
    if (properties.frameRight) {
        frames.push(makeM15NewFrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(makeM15NewFrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(makeM15NewFrameByLetter(properties.frame, 'Border', false, style));

    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoM15EighthFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    var style = 'regular';
    if (type_line.toLowerCase().includes('snow')) {
        style = 'snow';
    } else if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }

    // Set frames
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeM15FrameByLetter(properties.pinlineRight, 'Inner Crown', true, style));
            }
            frames.push(makeM15FrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }

        if (properties.pinlineRight) {
            frames.push(makeM15FrameByLetter(properties.pinlineRight, 'Crown', true, style));
        }
        frames.push(makeM15FrameByLetter(properties.pinline, "Crown", false, style));
        frames.push(makeM15FrameByLetter(properties.pinline, "Crown Border Cover", false, style));
    }
    if (properties.pt) {
        frames.push(makeM15EighthFrameByLetter(properties.pt, 'PT', false, style));
    }
    if (properties.pinlineRight) {
        frames.push(makeM15EighthFrameByLetter(properties.pinlineRight, 'Pinline', true, style));
    }
    frames.push(makeM15EighthFrameByLetter(properties.pinline, 'Pinline', false, style));
    frames.push(makeM15EighthFrameByLetter(properties.typeTitle, 'Type', false, style));
    frames.push(makeM15EighthFrameByLetter(properties.typeTitle, 'Title', false, style));
    if (properties.pinlineRight) {
        frames.push(makeM15EighthFrameByLetter(properties.rulesRight, 'Rules', true, style));
    }
    frames.push(makeM15EighthFrameByLetter(properties.rules, 'Rules', false, style));
    if (properties.frameRight) {
        frames.push(makeM15EighthFrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(makeM15EighthFrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(makeM15EighthFrameByLetter(properties.frame, 'Border', false, style));

    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoM15EighthUBFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    var style = 'regular';
    if (type_line.toLowerCase().includes('snow')) {
        style = 'snow';
    } else if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }

    // Set frames
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeM15EighthUBFrameByLetter(properties.pinlineRight, 'Inner Crown', true, style));
            }
            frames.push(makeM15EighthUBFrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }

        if (properties.pinlineRight) {
            frames.push(makeM15EighthUBFrameByLetter(properties.pinlineRight, 'Crown', true, style));
        }
        frames.push(makeM15EighthUBFrameByLetter(properties.pinline, "Crown", false, style));
        frames.push(makeM15EighthUBFrameByLetter(properties.pinline, "Crown Border Cover", false, style));
    }
    if (properties.pt) {
        frames.push(makeM15EighthUBFrameByLetter(properties.pt, 'PT', false, style));
    }
    if (properties.pinlineRight) {
        frames.push(makeM15EighthUBFrameByLetter(properties.pinlineRight, 'Pinline', true, style));
    }
    frames.push(makeM15EighthUBFrameByLetter(properties.pinline, 'Pinline', false, style));
    frames.push(makeM15EighthUBFrameByLetter(properties.typeTitle, 'Type', false, style));
    frames.push(makeM15EighthUBFrameByLetter(properties.typeTitle, 'Title', false, style));
    if (properties.pinlineRight) {
        frames.push(makeM15EighthUBFrameByLetter(properties.rulesRight, 'Rules', true, style));
    }
    frames.push(makeM15EighthUBFrameByLetter(properties.rules, 'Rules', false, style));
    if (properties.frameRight) {
        frames.push(makeM15EighthUBFrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(makeM15EighthUBFrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(makeM15EighthUBFrameByLetter(properties.frame, 'Border', false, style));

    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoBorderlessFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power, 'Borderless');
    var style = 'regular';
    if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }

    // Set frames
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeBorderlessFrameByLetter(properties.pinlineRight, 'Inner Crown', true));
            }
            frames.push(makeM15FrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }

        if (properties.pinlineRight) {
            frames.push(makeBorderlessFrameByLetter(properties.pinlineRight, 'Crown', true, style));
        }
        frames.push(makeBorderlessFrameByLetter(properties.pinline, "Crown", false, style));
        frames.push(makeBorderlessFrameByLetter(properties.pinline, "Legend Crown Outline", false))
        frames.push(makeBorderlessFrameByLetter(properties.pinline, "Crown Border Cover", false));
    }
    if (properties.pt) {
        frames.push(makeBorderlessFrameByLetter(properties.pt, 'PT', false));
    }
    if (properties.pinlineRight) {
        frames.push(makeBorderlessFrameByLetter(properties.pinlineRight, 'Pinline', true));
    }
    frames.push(makeBorderlessFrameByLetter(properties.pinline, 'Pinline', false));
    frames.push(makeBorderlessFrameByLetter(properties.typeTitle, 'Type', false));
    frames.push(makeBorderlessFrameByLetter(properties.typeTitle, 'Title', false));
    frames.push(makeBorderlessFrameByLetter(properties.rules, 'Rules', false));
    frames.push(makeBorderlessFrameByLetter(properties.frame, 'Border', false));

    // if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
    // 	card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    // }

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoBorderlessUBFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power, 'Borderless');
    var style = 'regular';
    if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }

    // Set frames
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeUBFrameByLetter(properties.pinlineRight, 'Inner Crown', true));
            }
            frames.push(makeUBFrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }

        if (properties.pinlineRight) {
            frames.push(makeBorderlessFrameByLetter(properties.pinlineRight, 'Crown', true, style, true));
        }
        frames.push(makeBorderlessFrameByLetter(properties.pinline, "Crown", false, style, true));
        frames.push(makeBorderlessFrameByLetter(properties.pinline, "Legend Crown Outline", false))
        frames.push(makeBorderlessFrameByLetter(properties.pinline, "Crown Border Cover", false));
    }
    if (properties.pinlineRight) {
        frames.push(makeUBFrameByLetter(properties.pinlineRight, 'Stamp', true, style));
    }
    frames.push(makeUBFrameByLetter(properties.pinline, "Stamp", false, style));
    if (properties.pt) {
        frames.push(makeBorderlessFrameByLetter(properties.pt, 'PT', false));
    }
    if (properties.pinlineRight) {
        frames.push(makeBorderlessFrameByLetter(properties.pinlineRight, 'Pinline', true));
    }
    frames.push(makeBorderlessFrameByLetter(properties.pinline, 'Pinline', false));
    frames.push(makeBorderlessFrameByLetter(properties.typeTitle, 'Type', false));
    frames.push(makeBorderlessFrameByLetter(properties.typeTitle, 'Title', false));
    frames.push(makeBorderlessFrameByLetter(properties.rules, 'Rules', false));
    frames.push(makeBorderlessFrameByLetter(properties.frame, 'Border', false));

    // if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
    // 	card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    // }

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function auto8thEditionFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    var style = 'regular';
    if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }

    // Set frames
    if (properties.pt) {
        frames.push(make8thEditionFrameByLetter(properties.pt, 'PT', false, style));
    }
    if (properties.pinlineRight) {
        frames.push(make8thEditionFrameByLetter(properties.pinlineRight, 'Pinline', true, style));
    }
    frames.push(make8thEditionFrameByLetter(properties.pinline, 'Pinline', false, style));
    frames.push(make8thEditionFrameByLetter(properties.typeTitle, 'Type', false, style));
    frames.push(make8thEditionFrameByLetter(properties.typeTitle, 'Title', false, style));
    if (properties.pinlineRight) {
        frames.push(make8thEditionFrameByLetter(properties.rulesRight, 'Rules', true, style));
    }
    frames.push(make8thEditionFrameByLetter(properties.rules, 'Rules', false, style));
    if (properties.frameRight) {
        frames.push(make8thEditionFrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(make8thEditionFrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(make8thEditionFrameByLetter(properties.frame, 'Border', false, style));

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoExtendedArtFrame(colors, mana_cost, type_line, power, short) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    var style = 'regular';
    if (type_line.toLowerCase().includes('snow')) {
        style = 'snow';
    } else if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }

    // Set frames
    if (type_line.includes('Legendary')) {
        frames.push(makeExtendedArtFrameByLetter(properties.pinline, "Crown Outline", false, style, short));

        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeExtendedArtFrameByLetter(properties.pinlineRight, 'Inner Crown', true, style, short));
            }
            frames.push(makeExtendedArtFrameByLetter(properties.pinline, 'Inner Crown', false, style, short));
        }

        if (properties.pinlineRight) {
            frames.push(makeExtendedArtFrameByLetter(properties.pinlineRight, 'Crown', true, style, short));
        }
        frames.push(makeExtendedArtFrameByLetter(properties.pinline, "Crown", false, style, short));
        frames.push(makeExtendedArtFrameByLetter(properties.pinline, "Crown Border Cover", false, style, short));
    } else {
        frames.push(makeExtendedArtFrameByLetter(properties.pinline, "Title Cutout", false, style, short));
    }
    if (properties.pt) {
        frames.push(makeExtendedArtFrameByLetter(properties.pt, 'PT', false, style, short));
    }
    if (properties.pinlineRight) {
        frames.push(makeExtendedArtFrameByLetter(properties.pinlineRight, 'Pinline', true, style, short));
    }
    frames.push(makeExtendedArtFrameByLetter(properties.pinline, 'Pinline', false, style, short));
    frames.push(makeExtendedArtFrameByLetter(properties.typeTitle, 'Type', false, style, short));
    frames.push(makeExtendedArtFrameByLetter(properties.typeTitle, 'Title', false, style, short));
    if (properties.pinlineRight) {
        frames.push(makeExtendedArtFrameByLetter(properties.rulesRight, 'Rules', true, style, short));
    }
    frames.push(makeExtendedArtFrameByLetter(properties.rules, 'Rules', false, style, short));
    if (properties.frameRight) {
        frames.push(makeExtendedArtFrameByLetter(properties.frameRight, 'Frame', true, style, short));
    }
    frames.push(makeExtendedArtFrameByLetter(properties.frame, 'Frame', false, style, short));
    frames.push(makeExtendedArtFrameByLetter(properties.frame, 'Border', false, style, short));

    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoEtchedFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power, 'Etched');
    var style = 'regular';
    if (type_line.toLowerCase().includes('snow')) {
        style = 'snow';
    } else if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }

    // Set frames

    if (type_line.includes('Legendary')) {
        if (style == 'Nyx') {
            if (properties.frameRight) {
                frames.push(makeEtchedFrameByLetter(properties.pinlineRight, 'Inner Crown', true));
            }
            frames.push(makeEtchedFrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }

        if (properties.frameRight) {
            frames.push(makeEtchedFrameByLetter(properties.frameRight, 'Crown', true));
        }
        frames.push(makeEtchedFrameByLetter(properties.frame, "Crown", false));
        frames.push(makeEtchedFrameByLetter(properties.frame, "Crown Border Cover", false));
    }
    if (properties.pt) {
        frames.push(makeEtchedFrameByLetter(properties.pt, 'PT', false));
    }
    frames.push(makeEtchedFrameByLetter(properties.typeTitle, 'Type', false));
    frames.push(makeEtchedFrameByLetter(properties.typeTitle, 'Title', false));
    if (properties.pinlineRight) {
        frames.push(makeEtchedFrameByLetter(properties.rulesRight, 'Rules', true));
    }
    frames.push(makeEtchedFrameByLetter(properties.rules, 'Rules', false));
    if (properties.frameRight) {
        frames.push(makeEtchedFrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(makeEtchedFrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(makeEtchedFrameByLetter(properties.frame, 'Border', false));

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoPhyrexianFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power, 'Phyrexian');

    // Set frames

    if (type_line.toLowerCase().includes('legendary')) {
        if (properties.pinlineRight) {
            frames.push(makePhyrexianFrameByLetter(properties.pinlineRight, 'Crown', true));
        }
        frames.push(makePhyrexianFrameByLetter(properties.pinline, "Crown", false));
    }
    if (properties.pt) {
        frames.push(makePhyrexianFrameByLetter(properties.pt, 'PT', false));
    }
    if (properties.pinlineRight) {
        frames.push(makePhyrexianFrameByLetter(properties.pinlineRight, 'Pinline', true));
    }
    frames.push(makePhyrexianFrameByLetter(properties.pinline, 'Pinline', false));
    frames.push(makePhyrexianFrameByLetter(properties.typeTitle, 'Type', false));
    frames.push(makePhyrexianFrameByLetter(properties.typeTitle, 'Title', false));
    if (properties.pinlineRight) {
        frames.push(makePhyrexianFrameByLetter(properties.rulesRight, 'Rules', true));
    }
    frames.push(makePhyrexianFrameByLetter(properties.rules, 'Rules', false));
    if (properties.frameRight) {
        frames.push(makePhyrexianFrameByLetter(properties.frameRight, 'Frame', true));
    }
    frames.push(makePhyrexianFrameByLetter(properties.frame, 'Frame', false));
    frames.push(makePhyrexianFrameByLetter(properties.frame, 'Border', false));

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoSeventhEditionFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension') || frame.name.includes('DCI Star'));

    //clear the draggable frames
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;

    var properties = cardFrameProperties(colors, mana_cost, type_line, power, 'Seventh');

    // Set frames
    frames.push(makeSeventhEditionFrameByLetter(properties.pinline, 'Pinline', false));
    if (properties.rulesRight) {
        frames.push(makeSeventhEditionFrameByLetter(properties.rulesRight, 'Rules', true));
    }
    frames.push(makeSeventhEditionFrameByLetter(properties.rules, 'Rules', false));
    frames.push(makeSeventhEditionFrameByLetter(properties.frame, 'Frame', false));
    frames.push(makeSeventhEditionFrameByLetter(properties.pinline, 'Textbox Pinline', false));
    frames.push(makeSeventhEditionFrameByLetter(properties.frame, 'Border', false));

    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

function makeM15FrameByLetter(letter, mask = false, maskToRightHalf = false, style = 'regular') {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land'
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    } else if (letter == 'L' && style == 'Nyx') {
        style = 'regular'
        ;
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/crowns/m15Crown' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.1667,
                'width': 0.9454,
                'x': 0.0274,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' ' + mask + ' (' + style + ')',
            'src': '/img/frames/m15/innerCrowns/m15InnerCrown' + letter + style + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0239,
                'width': 0.672,
                'x': 0.164,
                'y': 0.0239
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/regular/m15PT' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 0.8848
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/m15/' + style.toLowerCase() + '/m15Frame' + letter + '.png',
    }

    if (style == 'snow') {
        frame.src = frame.src.replace('m15Frame' + letter, letter.toLowerCase());
    } else {
        if (letter.includes('L') && letter.length > 1) {
            frame.src = frame.src.replace(('m15Frame' + letter), 'l' + letter[0].toLowerCase())
        }

        if (style == 'Nyx') {
            frame.src = frame.src.replace('.png', 'Nyx.png');
        }
    }

    if (mask) {
        frame.masks = [
            {
                'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeM15NewFrameByLetter(letter, mask = false, maskToRightHalf = false, style = 'regular') {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land',
        'WE': 'White Enchantment',
        'UE': 'Blue Enchantment',
        'BE': 'Black Enchantment',
        'RE': 'Red Enchantment',
        'GE': 'Green Enchantment',
        'ME': 'Multicolored Enchantment',
        'AE': 'Artifact Enchantment'
    }

    if (style == 'ubnyx') {
        letter += 'E'
        if (mask == "Inner Crown") {
            style = 'nyx';
        } else {
            style = 'ub';
        }
    }

    if (letter.length == 2) {
        letter = letter.split("").reverse().join("");
    }

    if ((mask == 'Crown' || mask == 'PT' || mask.includes('Stamp')) && (letter.includes('L') || letter.includes('E')) && letter.length > 1) {
        letter = letter[1];
    }

    var frameName = frameNames[letter.split("").reverse().join("")];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {x: 0, y: 0, width: 1, height: 137 / 2814}
        }
    }

    if (mask == "Crown") {
        var framePath = '';
        if (style == 'ub') {
            framePath = 'ub/';
        }
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/' + framePath + 'crowns/new/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {x: 44 / 2010, y: 53 / 2814, width: 1922 / 2010, height: 493 / 2814}
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' ' + mask + ' (' + style + ')',
            'src': '/img/frames/m15/innerCrowns/new/' + style.toLowerCase() + '/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {x: 329 / 2010, y: 70 / 2814, width: 1353 / 2010, height: 64 / 2814}
        };
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    } else if (mask == "Stamp") {
        if (style == 'ub') {
            var frame = {
                'name': frameName + ' Holo Stamp',
                'src': '/img/frames/m15/new/ub/stamp/' + letter.toLowerCase() + '.png',
                'masks': [],
                'bounds': {x: 857 / 2015, y: 2534 / 2814, width: 299 / 2015, height: 137 / 2814}
            }
            if (maskToRightHalf) {
                frame.masks.push({
                    'src': '/img/frames/maskRightHalf.png',
                    'name': 'Right Half'
                });
            }
            return frame;
        }
    }

    if (mask == 'PT') {
        var path = '/img/frames/m15/regular/m15PT';
        if (style == 'ub') {
            path = '/img/frames/m15/ub/pt/';
            letter = letter.toLowerCase();
        }
        return {
            'name': frameName + ' Power/Toughness',
            'src': path + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 0.8848
            }
        }
    }

    var stylePath = '';
    if (style != 'regular') {
        stylePath = style.toLowerCase() + '/';
    }
    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/m15/new/' + stylePath + letter.toLowerCase() + '.png',
    }

    // if (letter.includes('L') && letter.length > 1) {
    // 	frame.src = frame.src.replace(('m15Frame' + letter), 'l' + letter[0].toLowerCase())
    // }

    if (mask) {
        frame.masks = [
            {
                'src': '/img/frames/m15/new/' + mask.toLowerCase() + '.png',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeM15EighthFrameByLetter(letter, mask = false, maskToRightHalf = false, style = 'regular') {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land'
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/crowns/m15Crown' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.1667,
                'width': 0.9454,
                'x': 0.0274,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' ' + mask + ' (' + style + ')',
            'src': '/img/frames/m15/innerCrowns/m15InnerCrown' + letter + style + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0239,
                'width': 0.672,
                'x': 0.164,
                'y': 0.0239
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/regular/m15PT' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 1901 / 2100
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/custom/m15-eighth/' + style.toLowerCase() + '/' + letter.toLowerCase() + '.png',
    }

    if (style != 'regular') {
        frame.name = style.charAt(0).toUpperCase() + style.slice(1) + ' ' + frame.name;
    }

    if (mask) {
        if (mask.toLowerCase() == 'border' || mask.toLowerCase() == 'frame') {
            frame.masks = [
                {
                    'src': '/img/frames/custom/m15-eighth/regular/' + mask + '.png',
                    'name': mask
                }
            ]
        } else {
            frame.masks = [
                {
                    'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                    'name': mask
                }
            ]
        }

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeM15EighthUBFrameByLetter(letter, mask = false, maskToRightHalf = false, style = false) {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land',
        'WE': 'White Enchantment',
        'UE': 'Blue Enchantment',
        'BE': 'Black Enchantment',
        'RE': 'Red Enchantment',
        'GE': 'Green Enchantment',
        'ME': 'Multicolored Enchantment',
        'AE': 'Artifact Enchantment'
    };

    if (style == 'Nyx') {
        letter = letter + 'E';
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && (letter.includes('L') || letter.includes('E')) && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/ub/crowns/m15Crown' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.1667,
                'width': 0.9454,
                'x': 0.0274,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' ' + mask + ' (' + style + ')',
            'src': '/img/frames/m15/innerCrowns/m15InnerCrown' + letter + style + 'UB.png',
            'masks': [],
            'bounds': {
                'height': 0.0239,
                'width': 0.672,
                'x': 0.164,
                'y': 0.0239
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/ub/pt/' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 1901 / 2100
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/custom/m15-eighth/ub/' + letter.toLowerCase() + '.png',
    }

    if (mask) {
        if (mask.toLowerCase() == 'border' || mask.toLowerCase() == 'frame') {
            frame.masks = [
                {
                    'src': '/img/frames/custom/m15-eighth/regular/' + mask + '.png',
                    'name': mask
                }
            ]
        } else {
            frame.masks = [
                {
                    'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                    'name': mask
                }
            ]
        }

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeBorderlessFrameByLetter(letter, mask = false, maskToRightHalf = false, style, universesBeyond = false) {
    letter = letter.toUpperCase();

    var isVehicle = letter == 'V';

    if (letter == 'V') {
        letter = 'A';
    }

    if (letter == 'ML') {
        letter = 'M';
    } else if (letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless'
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Legend Crown Outline") {
        return {
            'name': 'Legend Crown Outline',
            'src': '/img/frames/m15/crowns/m15CrownFloatingOutline.png',
            'masks': [],
            'bounds': {
                'height': 0.1062,
                'width': 0.944,
                'x': 0.028,
                'y': 0.0172
            }
        };
    }

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'erase': true,
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Crown") {
        var src = '/img/frames/m15/crowns/m15Crown' + letter + 'Floating.png';
        if (universesBeyond) {
            src = '/img/frames/m15/ub/crowns/floating/' + letter + '.png';
        }
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': src,
            'masks': [],
            'bounds': {
                'height': 0.1024,
                'width': 0.9387,
                'x': 0.0307,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' ' + mask + ' (' + style + ')',
            'src': '/img/frames/m15/innerCrowns/m15InnerCrown' + letter + style + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0239,
                'width': 0.672,
                'x': 0.164,
                'y': 0.0239
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/borderless/pt/' + (isVehicle ? 'v' : letter.toLowerCase()) + '.png',
            'masks': [],
            'bounds': {
                'height': 0.066666666666,
                'width': 0.182666666666,
                'x': 0.764,
                'y': 0.8861904761904762
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/m15/borderless/m15GenericShowcaseFrame' + letter + '.png',
    }

    if (letter.includes('L') && letter.length > 1) {
        frame.src = frame.src.replace(('m15GenericShowcaseFrame' + letter), 'l' + letter[0].toLowerCase())
    }

    if (mask) {
        if (mask == 'Pinline') {
            frame.masks = [
                {
                    'src': '/img/frames/m15/genericShowcase/m15GenericShowcaseMask' + mask + '.png',
                    'name': mask
                }
            ];
        } else {
            frame.masks = [
                {
                    'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                    'name': mask
                }
            ];
        }

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function make8thEditionFrameByLetter(letter, mask = false, maskToRightHalf = false, style = 'regular') {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land'
    }

    if (mask == 'PT') {
        if (letter.length > 1) {
            letter = letter[0];
        } else if (letter == 'C') {
            letter = 'L';
        }
    }

    if (letter == 'V') {
        letter = 'A';
    }

    var frameName = frameNames[letter];

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/8th/pt/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {x: 1461 / 2010, y: 2481 / 2814, width: 414 / 2010, height: 218 / 2814}
        }
    }

    var stylePath = style == 'Nyx' ? 'nyx/' : '';

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/8th/' + stylePath + letter.toLowerCase() + '.png',
    }

    if (letter.includes('L') && letter.length > 1) {
        frame.src = frame.src.replace(('m15Frame' + letter), 'l' + letter[0].toLowerCase())
    }

    if (mask) {
        frame.masks = [
            {
                'src': '/img/frames/8th/' + mask.toLowerCase() + '.png',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeExtendedArtFrameByLetter(letter, mask = false, maskToRightHalf = false, style = 'regular', short = false) {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land'
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Legend Crown Outline") {
        return {
            'name': 'Legend Crown Outline',
            'src': '/img/frames/m15/crowns/m15CrownFloatingOutline.png',
            'masks': [],
            'bounds': {
                'height': 0.1062,
                'width': 0.944,
                'x': 0.028,
                'y': 0.0172
            }
        };
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/crowns/m15Crown' + letter + 'Floating.png',
            'masks': [],
            'bounds': {
                'height': 0.1024,
                'width': 0.9387,
                'x': 0.0307,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Crown Outline") {
        var frame = {
            'name': 'Legend Crown Outline',
            'src': '/img/frames/m15/crowns/m15CrownFloatingOutline.png',
            'masks': [],
            'bounds': {
                'height': 0.1062,
                'width': 0.944,
                'x': 0.028,
                'y': 0.0172
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + '(' + style + ')' + mask,
            'src': '/img/frames/m15/innerCrowns/m15InnerCrown' + letter + style + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0239,
                'width': 0.672,
                'x': 0.164,
                'y': 0.0239
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/regular/m15PT' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 0.8848
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame'
    }

    if (style != 'regular') {
        frame.src = '/img/frames/extended/regular/' + style.toLowerCase() + '/' + letter.toLowerCase() + '.png';
        if (short) {
            frame.src = frame.src.replace('/regular/', '/shorter/');
        }
    } else if (short) {
        frame.src = '/img/frames/m15/boxTopper/short/' + letter.toLowerCase() + '.png';
    } else {
        frame.src = '/img/frames/m15/boxTopper/m15BoxTopperFrame' + letter + '.png';
    }

    if (mask) {
        if (mask == 'Title Cutout') {
            if (short) {
                frame.masks = [
                    {
                        'src': '/img/frames/extended/shorter/titleCutout.png',
                        'name': 'Title Cutout'
                    }
                ]
            } else {
                frame.masks = [
                    {
                        'src': '/img/frames/m15/boxTopper/m15BoxTopperTitleCutout.png',
                        'name': 'Title Cutout'
                    }
                ]
            }
        } else if (short && ['Frame', 'Rules', 'Type', 'Pinline'].includes(mask)) {
            var extension = mask == 'Type' ? '.png' : '.svg';

            frame.masks = [
                {
                    'src': '/img/frames/m15/boxTopper/short/' + mask.toLowerCase().replace('rules', 'text') + extension,
                    'name': mask
                }
            ]
        } else {
            frame.masks = [
                {
                    'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                    'name': mask
                }
            ]
        }

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeUBFrameByLetter(letter, mask = false, maskToRightHalf = false, style = false) {
    letter = letter.toUpperCase();

    if (letter == 'C') {
        letter = 'L';
    }

    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land',
        'WE': 'White Enchantment',
        'UE': 'Blue Enchantment',
        'BE': 'Black Enchantment',
        'RE': 'Red Enchantment',
        'GE': 'Green Enchantment',
        'ME': 'Multicolored Enchantment',
        'AE': 'Artifact Enchantment'
    };

    if (style == 'Nyx') {
        letter = letter + 'E';
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && (letter.includes('L') || letter.includes('E')) && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/ub/crowns/m15Crown' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.1667,
                'width': 0.9454,
                'x': 0.0274,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    } else if (mask == "Stamp") {
        var frame = {
            'name': frameName + ' Holo Stamp',
            'src': '/img/frames/m15/ub/regular/stamp/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0486,
                'width': 0.1494,
                'x': 0.4254,
                'y': 0.9005
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' ' + mask + ' (' + style + ')',
            'src': '/img/frames/m15/innerCrowns/m15InnerCrown' + letter + style + 'UB.png',
            'masks': [],
            'bounds': {
                'height': 0.0239,
                'width': 0.672,
                'x': 0.164,
                'y': 0.0239
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/ub/pt/' + (letter == 'L' ? 'C' : letter).toLowerCase() + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 0.8848
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/m15/ub/regular/' + letter.toLowerCase() + '.png',
    }

    if (mask) {
        frame.masks = [
            {
                'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeCircuitFrameByLetter(letter, mask = false, maskToRightHalf = false) {
    letter = letter.toUpperCase();

    if (letter == 'C') {
        letter = 'L';
    }

    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land'
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/ub/crowns/m15Crown' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.1667,
                'width': 0.9454,
                'x': 0.0274,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/ub/pt/' + (letter == 'L' ? 'C' : letter).toLowerCase() + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 0.8848
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/custom/circuit/' + letter.toLowerCase() + '.png',
    }

    if (mask) {
        frame.masks = [
            {
                'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeEtchedFrameByLetter(letter, mask = false, maskToRightHalf = false, style = 'regular') {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle'
    }

    if (mask == 'PT' && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    if (letter == 'ML') {
        letter = 'M';
    } else if (letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    } else if (letter == 'V' && mask == 'Crown') {
        letter = 'A';
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Cover',
            'src': '/img/frames/etched/regular/crowns/cover.svg',
            'masks': [],
            'bounds': {}
        }
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/etched/regular/crowns/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {
                'height': 0.092,
                'width': 0.9387,
                'x': 0.0307,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' Inner Crown',
            'src': '/img/frames/etched/regular/innerCrowns/' + style.toLowerCase() + '/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {x: 244 / 1500, y: 51 / 2100, width: 1012 / 1500, height: 64 / 2100}
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/etched/regular/pt/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 0.8848
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/etched/regular/' + letter.toLowerCase() + '.png',
    }

    if (style != 'regular') {
        frame.src = frame.src.replace('/regular/', '/regular/' + style.toLowerCase() + '/');
        frame.name = frame.name += ' (' + style + ')';
    }

    if (mask) {
        frame.masks = [
            {
                'src': '/img/frames/etched/regular/' + mask.toLowerCase() + '.svg',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makePhyrexianFrameByLetter(letter, mask = false, maskToRightHalf = false) {
    if (letter == 'C' || letter == 'V') {
        letter = 'L';
    }

    if (mask == 'Rules') {
        mask = 'Rules Text';
    }

    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land'
    }

    if (mask == 'PT' && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    if (letter == 'ML') {
        letter = 'M';
    } else if (letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legendary Crown',
            'src': '/img/frames/m15/praetors/' + letter.toLowerCase() + 'Crown.png',
            'masks': [],
            'bounds': {
                'height': 100 / 2100,
                'width': 1,
                'x': 0,
                'y': 0
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/praetors/' + letter.toLowerCase() + 'pt.png',
            'masks': [],
            'bounds': {
                'height': 0.0772,
                'width': 0.212,
                'x': 0.746,
                'y': 0.8858
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/m15/praetors/' + letter.toLowerCase() + '.png',
    }

    if (mask == 'Type' || mask == 'Title') {
        frame.masks = [
            {
                'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else if (mask) {
        var extension = "png";
        var name = mask.toLowerCase();
        if (mask == 'Frame') {
            extension = 'svg';
        } else if (mask == 'Rules Text') {
            extension = 'svg';
            name = 'text';
        }

        frame.masks = [
            {
                'src': '/img/frames/m15/praetors/' + name + '.' + extension,
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeSeventhEditionFrameByLetter(letter, mask = false, maskToRightHalf = false) {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land'
    }

    if (letter == 'V') {
        letter = 'A';
    }

    if (letter == 'ML') {
        letter = 'L';
    }

    var frameName = frameNames[letter];

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/seventh/regular/' + letter.toLowerCase() + '.png'
    };

    if (mask) {
        if (mask == 'Textbox Pinline') {
            frame.masks = [
                {
                    'src': '/img/frames/seventh/regular/trim.svg',
                    'name': 'Textbox Pinline'
                }
            ]
        } else {
            frame.masks = [
                {
                    'src': '/img/frames/seventh/regular/' + mask.toLowerCase() + '.svg',
                    'name': mask
                }
            ]
        }

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

async function addFrame(additionalMasks = [], loadingFrame = false) {
    var frameToAdd = JSON.parse(JSON.stringify(availableFrames[selectedFrameIndex]));
    var maskThumbnail = true;
    if (!loadingFrame) {
        // The frame is being added manually by the user, so we must process which mask(s) they have selected
        var noDefaultMask = 0;
        if (frameToAdd.noDefaultMask) {
            noDefaultMask = 1;
        }
        if (frameToAdd.masks && selectedMaskIndex + noDefaultMask > 0) {
            frameToAdd.masks = frameToAdd.masks.slice(selectedMaskIndex - 1 + noDefaultMask, selectedMaskIndex + noDefaultMask);
        } else {
            frameToAdd.masks = [];
            maskThumbnail = false;
        }
        additionalMasks.forEach(item => {
            if (item.name in replacementMasks) {
                const replacement = replacementMasks[item.name];
                if (typeof replacement === 'string') {
                    // String value: just replace the src
                    item.src = replacement;
                } else if (typeof replacement === 'object') {
                    // Object value: merge properties
                    Object.assign(item, replacement);
                }
            }
            frameToAdd.masks.push(item);
        });
        // Check if any mask has preserveAlpha and transfer it to the frame
        frameToAdd.masks.forEach(mask => {
            if (mask.preserveAlpha) {
                frameToAdd.preserveAlpha = true;
            }
        });
        // Likewise, we now add any complementary frames
        if ('complementary' in frameToAdd && frameToAdd.masks.length == 0) {
            if (typeof frameToAdd.complementary == 'number') {
                frameToAdd.complementary = [frameToAdd.complementary];
            } else if (typeof frameToAdd.complementary == 'string') {
                availableFrames.forEach((availableFrame, index, availableFrames) => {
                    if (availableFrame.name == frameToAdd.complementary) {
                        frameToAdd.complementary = [index];
                    }
                })
            }
            const realFrameIndex = selectedFrameIndex;
            for (const index of frameToAdd.complementary) {
                selectedFrameIndex = index;
                await addFrame();
            }
            selectedFrameIndex = realFrameIndex;
        }
    } else {
        frameToAdd = loadingFrame;
        if (frameToAdd.masks.length == 0 || (frameToAdd.masks[0].src.includes('/img/frames/mask'))) {
            maskThumbnail = false;
        }
    }
    frameToAdd.masks.forEach(item => {
        item.image = new Image();
        item.image.crossOrigin = 'anonymous';
        item.image.src = blank.src;
        item.image.onload = drawFrames;
        ImageLoadTracker.track(fixUri(item.src));
        item.image.src = fixUri(item.src);
    });
    frameToAdd.image = new Image();
    frameToAdd.image.crossOrigin = 'anonymous'
    frameToAdd.image.src = blank.src;
    frameToAdd.image.onload = drawFrames;
    if ('stretch' in frameToAdd) {
        stretchSVG(frameToAdd);
    } else {
        ImageLoadTracker.track(fixUri(frameToAdd.src));
        frameToAdd.image.src = fixUri(frameToAdd.src);
    }
    if (!loadingFrame) {
        card.frames.unshift(frameToAdd);
    }
    var frameElement = document.createElement('div');
    frameElement.classList = 'draggable frame-element';
    frameElement.draggable = 'true';
    frameElement.ondragstart = dragStart;
    frameElement.ondragend = dragEnd;
    frameElement.ondragover = dragOver;
    frameElement.ontouchstart = dragStart;
    frameElement.ontouchend = dragEnd;
    frameElement.ontouchmove = touchMove;
    frameElement.onclick = frameElementClicked;
    var frameElementImage = document.createElement('img');
    if (frameToAdd.noThumb || frameToAdd.src.includes('/img/black.png')) {
        frameElementImage.src = fixUri(frameToAdd.src);
    } else {
        frameElementImage.src = fixUri(frameToAdd.src.replace('.png', 'Thumb.png'));
    }
    frameElement.appendChild(frameElementImage);
    var frameElementMask = document.createElement('img');
    if (maskThumbnail) {
        frameElementMask.src = fixUri(frameToAdd.masks[0].src.replace('.png', 'Thumb.png'));
    } else {
        frameElementMask.src = black.src;
    }
    frameElement.appendChild(frameElementMask);
    var frameElementLabel = document.createElement('h4');
    frameElementLabel.innerHTML = frameToAdd.name;
    frameToAdd.masks.forEach(item => frameElementLabel.innerHTML += ', ' + item.name);
    frameElement.appendChild(frameElementLabel);
    var frameElementClose = document.createElement('h4');
    frameElementClose.innerHTML = 'X';
    frameElementClose.classList = 'frame-element-close';
    frameElementClose.onclick = removeFrame;
    frameElement.appendChild(frameElementClose);
    document.querySelector('#frame-list').prepend(frameElement);
    bottomInfoEdited();
}

function removeFrame(event) {
    card.frames.splice(getElementIndex(event.target.parentElement), 1);
    event.target.parentElement.remove();
    drawFrames();
    bottomInfoEdited();
}

function frameElementClicked(event) {
    if (!event.target.classList.contains('frame-element-close')) {
        var selectedFrameElement = event.target.closest('.frame-element');
        selectedFrame = card.frames[Array.from(selectedFrameElement.parentElement.children).indexOf(selectedFrameElement)];
        document.querySelector('#frame-element-editor').classList.add('opened');
        selectedFrame.bounds = selectedFrame.bounds || {};
        if (selectedFrame.ogBounds == undefined) {
            selectedFrame.ogBounds = JSON.parse(JSON.stringify(selectedFrame.bounds));
        }
        // Basic manipulations
        document.querySelector('#frame-editor-x').value = scaleWidth(selectedFrame.bounds.x || 0);
        document.querySelector('#frame-editor-x').onchange = (event) => {
            selectedFrame.bounds.x = (event.target.value / card.width);
            drawFrames();
        }
        document.querySelector('#frame-editor-y').value = scaleHeight(selectedFrame.bounds.y || 0);
        document.querySelector('#frame-editor-y').onchange = (event) => {
            selectedFrame.bounds.y = (event.target.value / card.height);
            drawFrames();
        }
        document.querySelector('#frame-editor-width').value = scaleWidth(selectedFrame.bounds.width || 1);
        document.querySelector('#frame-editor-width').onchange = (event) => {
            selectedFrame.bounds.width = (event.target.value / card.width);
            drawFrames();
        }
        document.querySelector('#frame-editor-height').value = scaleHeight(selectedFrame.bounds.height || 1);
        document.querySelector('#frame-editor-height').onchange = (event) => {
            selectedFrame.bounds.height = (event.target.value / card.height);
            drawFrames();
        }
        document.querySelector('#frame-editor-opacity').value = selectedFrame.opacity || 100;
        document.querySelector('#frame-editor-opacity').onchange = (event) => {
            selectedFrame.opacity = event.target.value;
            drawFrames();
        }
        document.querySelector('#frame-editor-erase').checked = selectedFrame.erase || false;
        document.querySelector('#frame-editor-erase').onchange = (event) => {
            selectedFrame.erase = event.target.checked;
            drawFrames();
        }
        document.querySelector('#frame-editor-alpha').checked = selectedFrame.preserveAlpha || false;
        document.querySelector('#frame-editor-alpha').onchange = (event) => {
            selectedFrame.preserveAlpha = event.target.checked;
            drawFrames();
        }
        document.querySelector('#frame-editor-color-overlay-check').checked = selectedFrame.colorOverlayCheck || false;
        document.querySelector('#frame-editor-color-overlay-check').onchange = (event) => {
            selectedFrame.colorOverlayCheck = event.target.checked;
            drawFrames();
        }
        document.querySelector('#frame-editor-color-overlay').value = selectedFrame.colorOverlay || false;
        document.querySelector('#frame-editor-color-overlay').onchange = (event) => {
            selectedFrame.colorOverlay = event.target.value;
            drawFrames();
        }
        document.querySelector('#frame-editor-hsl-hue').value = selectedFrame.hslHue || 0;
        document.querySelector('#frame-editor-hsl-hue-slider').value = selectedFrame.hslHue || 0;
        document.querySelector('#frame-editor-hsl-hue').onchange = (event) => {
            selectedFrame.hslHue = event.target.value;
            drawFrames();
        }
        document.querySelector('#frame-editor-hsl-hue-slider').onchange = (event) => {
            selectedFrame.hslHue = event.target.value;
            drawFrames();
        }
        document.querySelector('#frame-editor-hsl-saturation').value = selectedFrame.hslSaturation || 0;
        document.querySelector('#frame-editor-hsl-saturation-slider').value = selectedFrame.hslSaturation || 0;
        document.querySelector('#frame-editor-hsl-saturation').onchange = (event) => {
            selectedFrame.hslSaturation = event.target.value;
            drawFrames();
        }
        document.querySelector('#frame-editor-hsl-saturation-slider').onchange = (event) => {
            selectedFrame.hslSaturation = event.target.value;
            drawFrames();
        }
        document.querySelector('#frame-editor-hsl-lightness').value = selectedFrame.hslLightness || 0;
        document.querySelector('#frame-editor-hsl-lightness-slider').value = selectedFrame.hslLightness || 0;
        document.querySelector('#frame-editor-hsl-lightness').onchange = (event) => {
            selectedFrame.hslLightness = event.target.value;
            drawFrames();
        }
        document.querySelector('#frame-editor-hsl-lightness-slider').onchange = (event) => {
            selectedFrame.hslLightness = event.target.value;
            drawFrames();
        }
        // Removing masks
        const selectMaskElement = document.querySelector('#frame-editor-masks');
        selectMaskElement.innerHTML = null;
        const maskOptionNone = document.createElement('option');
        maskOptionNone.disabled = true;
        maskOptionNone.innerHTML = 'None Selected';
        selectMaskElement.appendChild(maskOptionNone);
        selectedFrame.masks.forEach(mask => {
            const maskOption = document.createElement('option');
            maskOption.innerHTML = mask.name;
            selectMaskElement.appendChild(maskOption);
        });
        selectMaskElement.selectedIndex = 0;
    }
}

function frameElementMaskRemoved() {
    const selectElement = document.querySelector('#frame-editor-masks');
    const selectedOption = selectElement.value;
    if (selectedOption != 'None Selected') {
        selectElement.remove(selectElement.selectedIndex);
        selectElement.selectedIndex = 0;
        selectedFrame.masks.forEach(mask => {
            if (mask.name == selectedOption) {
                selectedFrame.masks = selectedFrame.masks.filter(item => item.name != selectedOption);
                drawFrames();
            }
        });
    }
}

function uploadMaskOption(imageSource) {
    const uploadedMask = {name: `Uploaded Image (${customCount})`, src: imageSource, noThumb: true, image: new Image()};
    customCount++;
    selectedFrame.masks.push(uploadedMask);
    uploadedMask.image.onload = drawFrames;
    uploadedMask.image.src = imageSource;
}

function uploadFrameOption(imageSource) {
    const uploadedFrame = {name: `Uploaded Image (${customCount})`, src: imageSource, noThumb: true};
    customCount++;
    availableFrames.push(uploadedFrame);
    loadFramePack();
}

async function uploadFrameFilesToServer(filesRaw) {
    await uploadFilesToServerByKind(filesRaw, 'frames', uploadFrameOption, '', refreshFrameLibrarySelect);
}

async function refreshFrameLibrarySelect() {
    const select = document.querySelector('#frame-library-select');
    if (!select) {
        return;
    }

    select.innerHTML = '<option value="" selected="selected">None selected</option>';

    try {
        const response = await fetch('/api/assets/sources/frames');
        if (!response.ok) {
            throw new Error('Failed to load frame list (' + response.status + ')');
        }

        const items = await response.json();
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.url;
            option.innerText = item.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Could not load uploaded frames:', error);
        const option = document.createElement('option');
        option.value = '';
        option.innerText = 'Failed to load uploaded frames';
        select.appendChild(option);
    }
}

function selectFrameLibrarySource(element) {
    if (!element || !element.value) {
        return;
    }
    uploadFrameOption(element.value);
}

function hsl(canvas, inputH, inputS, inputL) {
    //adjust inputs
    var hue = parseInt(inputH) / 360;
    var saturation = parseInt(inputS) / 100;
    var lightness = parseInt(inputL) / 100;
    //create needed objects
    var context = canvas.getContext('2d')
    var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    var pixels = imageData.data;
    //for every pixel...
    for (var i = 0; i < pixels.length; i += 4) {
        //grab rgb
        var r = pixels[i];
        var g = pixels[i + 1];
        var b = pixels[i + 2];
        //convert to hsl
        var res = rgbToHSL(r, g, b);
        h = res[0];
        s = res[1];
        l = res[2];
        //make adjustments
        h += hue;
        while (h > 1) {
            h--;
        }
        s = Math.min(Math.max(s + saturation, 0), 1);
        l = Math.min(Math.max(l + lightness, 0), 1);
        //convert back to rgb
        res = hslToRGB(h, s, l);
        r = res[0];
        g = res[1];
        b = res[2];
        //and reassign
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
    }
    //then put the new image data back
    context.putImageData(imageData, 0, 0);
}

function croppedCanvas(oldCanvas, sensitivity = 0) {
    var oldContext = oldCanvas.getContext('2d');
    var newCanvas = document.createElement('canvas');
    var newContext = newCanvas.getContext('2d');
    var pixels = oldContext.getImageData(0, 0, oldCanvas.width, oldCanvas.height).data;
    var pixX = [];
    var pixY = [];
    for (var x = 0; x < oldCanvas.width; x += 1) {
        for (var y = 0; y < oldCanvas.height; y += 1) {
            if (pixels[(y * oldCanvas.width + x) * 4 + 3] > sensitivity) {
                pixX.push(x);
                pixY.push(y);
            }
        }
    }
    pixX.sort(function (a, b) {
        return a - b
    });
    pixY.sort(function (a, b) {
        return a - b
    });
    var n = pixX.length - 1;
    var newWidth = 1 + pixX[n] - pixX[0];
    var newHeight = 1 + pixY[n] - pixY[0];
    newCanvas.width = newWidth;
    newCanvas.height = newHeight;
    newContext.putImageData(oldCanvas.getContext('2d').getImageData(pixX[0], pixY[0], newWidth, newHeight), 0, 0);
    return newCanvas;
}

/*
shoutout to https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion for providing the hsl-rgb conversion algorithms
*/
function rgbToHSL(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return [h, s, l];
}

function hslToRGB(h, s, l) {
    var r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

//TEXT TAB
var writingText;
var autoFrameTimer;

function loadTextOptions(textObject, replace = true) {
    var oldCardText = card.text || {};
    Object.entries(oldCardText).forEach(item => {
        savedTextContents[item[0]] = oldCardText[item[0]].text;
    });
    if (replace) {
        card.text = textObject;
    } else {
        Object.keys(textObject).forEach(key => {
            card.text[key] = textObject[key];
        });
    }
    document.querySelector('#text-options').innerHTML = null;
    Object.entries(card.text).forEach(item => {
        if (oldCardText[item[0]]) {
            card.text[item[0]].text = oldCardText[item[0]].text;
        } else if (savedTextContents[item[0]]) {
            card.text[item[0]].text = savedTextContents[item[0]];
        }
        var textOptionElement = document.createElement('h4');
        textOptionElement.innerHTML = item[1].name;
        textOptionElement.classList = 'selectable text-option'
        textOptionElement.onclick = textOptionClicked;
        document.querySelector('#text-options').appendChild(textOptionElement);
    });
    document.querySelector('#text-options').firstChild.click();
    drawTextBuffer();
    drawNewGuidelines();
}

function textOptionClicked(event) {
    selectedTextIndex = getElementIndex(event.target);
    document.querySelector('#text-editor').value = Object.entries(card.text)[selectedTextIndex][1].text;
    document.querySelector('#text-editor-font-size').value = Object.entries(card.text)[selectedTextIndex][1].fontSize;
    selectSelectable(event);
}

function textboxEditor() {
    var selectedTextbox = card.text[Object.keys(card.text)[selectedTextIndex]];
    document.querySelector('#textbox-editor').classList.add('opened');
    document.querySelector('#textbox-editor-x').value = scaleWidth(selectedTextbox.x || 0);
    document.querySelector('#textbox-editor-x').onchange = (event) => {
        selectedTextbox.x = (event.target.value / card.width);
        textEdited();
    }
    document.querySelector('#textbox-editor-y').value = scaleHeight(selectedTextbox.y || 0);
    document.querySelector('#textbox-editor-y').onchange = (event) => {
        selectedTextbox.y = (event.target.value / card.height);
        textEdited();
    }
    document.querySelector('#textbox-editor-width').value = scaleWidth(selectedTextbox.width || 1);
    document.querySelector('#textbox-editor-width').onchange = (event) => {
        selectedTextbox.width = (event.target.value / card.width);
        textEdited();
    }
    document.querySelector('#textbox-editor-height').value = scaleHeight(selectedTextbox.height || 1);
    document.querySelector('#textbox-editor-height').onchange = (event) => {
        selectedTextbox.height = (event.target.value / card.height);
        textEdited();
    }
}

function textEdited() {
    card.text[Object.keys(card.text)[selectedTextIndex]].text = curlyQuotes(document.querySelector('#text-editor').value);
    drawTextBuffer();
    autoFrameBuffer();
}

function fontSizedEdited() {
    card.text[Object.keys(card.text)[selectedTextIndex]].fontSize = document.querySelector('#text-editor-font-size').value;
    drawTextBuffer();
}

function drawTextBuffer() {
    clearTimeout(writingText);
    writingText = setTimeout(drawText, DEBOUNCE_TEXT_MS);
}

function autoFrameBuffer() {
    clearTimeout(autoFrameTimer);
    autoFrameTimer = setTimeout(autoFrame, DEBOUNCE_AUTOFRAME_MS);
}

async function drawText() {
    textContext.clearRect(0, 0, textCanvas.width, textCanvas.height);
    prePTContext.clearRect(0, 0, prePTCanvas.width, prePTCanvas.height);
    drawTextBetweenFrames = false;
    for (var textObject of Object.entries(card.text)) {
        await writeText(textObject[1], textContext);

    }
    if (drawTextBetweenFrames || redrawFrames) {
        drawFrames();
        if (!drawTextBetweenFrames) {
            redrawFrames = false;
        }
    } else {
        drawCard();
    }
}

var justifyWidth = JUSTIFY_WIDTH_DEFAULT;
let manaSymbolsToRender = [];

function writeText(textObject, targetContext) {
    manaSymbolsToRender = [];
    //Most bits of info about text loaded, with defaults when needed
    var textX = scaleX(textObject.x) || scaleX(0);
    var textY = scaleY(textObject.y) || scaleY(0);
    var textWidth = scaleWidth(textObject.width) || scaleWidth(1);
    var textHeight = scaleHeight(textObject.height) || scaleHeight(1);
    var startingTextSize = scaleHeight(textObject.size) || scaleHeight(0.038);
    var textFontHeightRatio = TEXT_FONT_HEIGHT_RATIO;
    var textBounded = textObject.bounded || true;
    var textOneLine = textObject.oneLine || false;
    var textManaCost = textObject.manaCost || false;
    var textAllCaps = textObject.allCaps || false;
    var textManaSpacing = scaleWidth(textObject.manaSpacing) || 0;
    //Buffers the canvases accordingly
    var canvasMargin = TEXT_CANVAS_MARGIN;
    paragraphCanvas.width = textWidth + 2 * canvasMargin;
    paragraphCanvas.height = textHeight + 2 * canvasMargin;
    lineCanvas.width = textWidth + 2 * canvasMargin;
    lineCanvas.height = startingTextSize + 2 * canvasMargin;
    //Preps the text string
    var splitString = TEXT_SPLIT_STRING;
    var rawText = textObject.text
    if (document.querySelector('#hide-reminder-text').checked && textObject.name && textObject.name != 'Title' && textObject.name != 'Type' && textObject.name != 'Mana Cost' && textObject.name != 'Power/Toughness') {
        var rulesText = rawText;
        var flavorText = '';
        var flavorIndex = rawText.indexOf('{flavor}') || rawText.indexOf('///');
        if (flavorIndex >= 0) {
            flavorText = rawText.substring(flavorIndex);
            rulesText = rawText.substring(0, flavorIndex);
        }

        rulesText = rulesText.replace(/ ?{i}\([^)]+\){\/i}/g, '');

        rawText = rulesText + flavorText;
    } else if (document.querySelector('#italicize-reminder-text').checked && textObject.name && textObject.name != 'Title' && textObject.name != 'Type' && textObject.name != 'Mana Cost' && textObject.name != 'Power/Toughness') {
        var rulesText = rawText;
        var flavorText = '';
        var flavorIndex = rawText.indexOf('{flavor}') || rawText.indexOf('///');
        if (flavorIndex >= 0) {
            flavorText = rawText.substring(flavorIndex);
            rulesText = rawText.substring(0, flavorIndex);
        }

        rulesText = rulesText.replace(/\(([^)]+)\)/g, '{i}($1){/i}');

        rawText = rulesText + flavorText;
    }
    if (textAllCaps) {
        rawText = rawText.toUpperCase();
    }
    if ((textObject.name == 'wizards' || textObject.name == 'copyright') && params.get('copyright') != null && (params.get('copyright') != '' || card.margins)) {
        rawText = params.get('copyright'); //so people using CC for custom card games without WotC's IP can customize their copyright info
        if (rawText == 'none') {
            rawText = '';
        }
    }
    if (rawText.toLowerCase().includes('{cardname}') || rawText.toLowerCase().includes('~')) {
        rawText = rawText.replace(/{cardname}|~/ig, getInlineCardName());
    }
    if (document.querySelector('#info-artist').value == '') {
        rawText = rawText.replace('\uFFEE{savex2}{elemidinfo-artist}', '');
    }
    if (rawText.includes('///')) {
        rawText = rawText.replace(/\/\/\//g, '{flavor}');
    }
    if (rawText.includes('//')) {
        rawText = rawText.replace(/\/\//g, '{lns}');
    }

    if (card.version == 'pokemon') {
        rawText = rawText.replace(/{flavor}/g, '{oldflavor}{fontsize-20}{fontgillsansbolditalic}');
    } else if (card.version == 'dossier') {
        rawText = rawText.replace(/{flavor}(.*)/g, function (v) {
            return '{/indent}{lns}{bar}{lns}{fixtextalign}' + v.replace(/{flavor}/g, '').toUpperCase();
        });
    } else if (!card.showsFlavorBar) {
        rawText = rawText.replace(/{flavor}/g, '{oldflavor}');
    }

    if (textObject.font == 'saloongirl') {
        rawText = rawText.replace(/\*/g, '{fontbelerenbsc}*{fontsaloongirl}');
    }
    rawText = rawText.replace(/ - /g, ' — ');
    var splitText = rawText.replace(/\n/g, '{line}').replace(/{-}/g, '\u2014').replace(/{divider}/g, '{/indent}{lns}{bar}{lns}{fixtextalign}');
    if (rawText.trim().startsWith('{flavor}') || rawText.trim().startsWith('{oldflavor}')) {
        splitText = splitText.replace(/{flavor}/g, '{i}').replace(/{oldflavor}/g, '{i}');
    } else {
        splitText = splitText.replace(/{flavor}/g, '{/indent}{lns}{bar}{lns}{fixtextalign}{i}').replace(/{oldflavor}/g, '{/indent}{lns}{lns}{up30}{i}');
    }
    splitText = splitText.replace(/{/g, splitString + '{').replace(/}/g, '}' + splitString).replace(/ /g, splitString + ' ' + splitString).split(splitString);

    splitText = splitText.filter(item => item);
    if (textObject.manaCost) {
        splitText = splitText.filter(item => item != ' ');
    }
    if (textObject.vertical) {
        newSplitText = [];
        splitText.forEach((item, index) => {
            if (item.includes('{') && item.includes('}')) {
                newSplitText.push(item, '{lns}');
            } else if (item == ' ') {
                newSplitText.push(`{down${scaleHeight(0.01)}}`);
            } else {
                item.split('').forEach(char => {
                    if (char == '’') {
                        newSplitText.push(`{right${startingTextSize * 0.6}}`, '’', '{lns}', `{up${startingTextSize * 0.75}}`);
                    } else if (textManaCost && index == splitText.length - 1) {
                        newSplitText.push(char);
                    } else {
                        newSplitText.push(char, '{lns}');
                    }
                });
                // newSplitText = newSplitText.concat(item.split(''));
            }
        });
        splitText = newSplitText;
    }
    // if (textManaCost && textObject.arcStart > 0) {
    // 	splitText.reverse();
    // }
    splitText.push('');
    //Manages the redraw loop
    var drawingText = true;
    //Repeatedly tries to draw the text at smaller and smaller sizes until it fits
    outerloop: while (drawingText) {
        //Rest of the text info loaded that may have been changed by a previous attempt at drawing the text
        var textColor = textObject.color || 'black';
        if (textObject.conditionalColor != undefined) {
            var codeParams = textObject.conditionalColor.split(":");
            const tagParts = codeParams[0].split(",");
            const colorToApply = codeParams[1];

            for (let part of tagParts) {

                // Split into frame name + mask rules
                const [rawFrameName, ...maskRuleParts] = part.split("*");
                const frameName = rawFrameName.replace(/_/g, " ").toLowerCase();

                const positiveMasks = [];
                const negativeMasks = [];

                for (let rule of maskRuleParts) {
                    if (!rule) continue;
                    if (rule.startsWith("!")) {
                        negativeMasks.push(rule.substring(1).replace(/_/g, " ").toLowerCase());
                    } else {
                        positiveMasks.push(rule.replace(/_/g, " ").toLowerCase());
                    }
                }

                const matchingFrames = card.frames.filter(f =>
                    f.name.toLowerCase().includes(frameName)
                );

                for (const frame of matchingFrames) {
                    const masks = frame.masks || [];

                    // --------------------------------------
                    // SPECIAL RULE:
                    // If NO masks → always match immediately
                    // --------------------------------------
                    if (masks.length === 0) {
                        textColor = colorToApply;
                        lineContext.fillStyle = textColor;
                        continue;
                    }

                    const maskNames = masks.map(m => m.name.toLowerCase());

                    // --- Positive mask rules -------------------------
                    let passesPositive = true;

                    if (positiveMasks.length > 0) {
                        passesPositive = positiveMasks.every(pos =>
                            maskNames.some(mask => mask.includes(pos))
                        );
                    }

                    if (!passesPositive) continue;

                    // --- Negative mask rules -------------------------
                    let passesNegative = true;

                    if (negativeMasks.length > 0) {
                        passesNegative = negativeMasks.every(neg =>
                            !maskNames.some(mask => mask.includes(neg))
                        );
                    }

                    if (!passesNegative) continue;

                    // All conditions passed
                    textColor = colorToApply;
                }
            }
        }
        var textFont = textObject.font || 'mplantin';
        FontLoadTracker.track(textFont);
        var textAlign = textObject.align || 'left';
        var textJustify = textObject.justify || 'left';
        var textShadowColor = textObject.shadow || 'black';
        var textShadowOffsetX = scaleWidth(textObject.shadowX) || 0;
        var textShadowOffsetY = scaleHeight(textObject.shadowY) || 0;
        var textShadowBlur = scaleHeight(textObject.shadowBlur) || 0;
        var textArcRadius = scaleHeight(textObject.arcRadius) || 0;
        var manaSymbolColor = textObject.manaSymbolColor || null;
        var textRotation = textObject.rotation || 0;
        if (textArcRadius > 0) {
            //Buffers the canvases accordingly
            var canvasMargin = TEXT_CANVAS_MARGIN + textArcRadius;
            paragraphCanvas.width = textWidth + 2 * canvasMargin;
            paragraphCanvas.height = textHeight + 2 * canvasMargin;
            lineCanvas.width = textWidth + 2 * canvasMargin;
            lineCanvas.height = startingTextSize + 2 * canvasMargin;
        }
        var textArcStart = textObject.arcStart || 0;
        //Variables for tracking text position/size/font
        var currentX = 0;
        var startingCurrentX = 0;
        var currentY = 0;
        var lineY = 0;
        var newLine = false;
        var textFontExtension = '';
        var textFontStyle = textObject.fontStyle || '';
        var manaPlacementCounter = 0;
        var realTextAlign = textAlign;
        savedRollYPosition = null;
        var savedRollColor = 'black';
        var drawToPrePTCanvas = false;
        var widestLineWidth = 0;
        //variables that track various... things?
        var textSize = startingTextSize;
        var newLineSpacing = (textObject.lineSpacing || 0) * textSize;
        var ptShift = [0, 0];
        var permaShift = [0, 0];
        var fillJustify = false;
        //Finish prepping canvases
        paragraphContext.clearRect(0, 0, paragraphCanvas.width, paragraphCanvas.height);
        lineContext.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
        lineContext.letterSpacing = (scaleWidth(textObject.kerning) || 0) + 'px';
        // if (textFont == 'goudymedieval') {
        // 	lineCanvas.style.letterSpacing = '3.5px';
        // }
        textSize += parseInt(textObject.fontSize || '0');
        lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
        lineContext.fillStyle = textColor;
        lineContext.shadowColor = textShadowColor;
        lineContext.shadowOffsetX = textShadowOffsetX;
        lineContext.shadowOffsetY = textShadowOffsetY;
        lineContext.shadowBlur = textShadowBlur;
        lineContext.strokeStyle = textObject.outlineColor || 'black';
        var textOutlineWidth = scaleHeight(textObject.outlineWidth) || 0;
        var textLineCap = textObject.lineCap || 'round';
        var textLineJoin = textObject.lineJoin || 'round';
        var hideBottomInfoBorder = card.hideBottomInfoBorder || false;
        if (hideBottomInfoBorder && ['midLeft', 'topLeft', 'note', 'bottomLeft', 'wizards', 'bottomRight', 'rarity'].includes(textObject.name)) {
            textOutlineWidth = 0;
        }
        lineContext.lineWidth = textOutlineWidth;
        lineContext.lineCap = textLineCap;
        lineContext.lineJoin = textLineJoin;
        //Begin looping through words/codes
        for (word of splitText) {
            var wordToWrite = word;
            if (wordToWrite.includes('{') && wordToWrite.includes('}') || textManaCost || savedFont) {
                var possibleCode = wordToWrite.toLowerCase().replace('{', '').replace('}', '');
                wordToWrite = null;
                if (possibleCode == 'line') {
                    newLine = true;
                    startingCurrentX = 0;
                    newLineSpacing = textSize * 0.35;
                } else if (possibleCode == 'lns' || possibleCode == 'linenospace') {
                    newLine = true;
                } else if (possibleCode == 'bullet' || possibleCode == '•') {
                    wordToWrite = '•';
                } else if (possibleCode == 'bar') {
                    var barWidth = textWidth * 0.96;
                    var barHeight = scaleHeight(0.03);
                    var barImageName = 'bar';
                    var barDistance = 0;
                    realTextAlign = textAlign;
                    textAlign = 'left';
                    if (card.version == 'cartoony') {
                        barImageName = 'cflavor';
                        barWidth = scaleWidth(0.8547);
                        barHeight = scaleHeight(0.0458);
                        barDistance = -0.23;
                        newLineSpacing = textSize * -0.23;
                        textSize -= scaleHeight(0.0086);
                    }
                    lineContext.drawImage(getManaSymbol(barImageName).image, canvasMargin + (textWidth - barWidth) / 2, canvasMargin + barDistance * textSize, barWidth, barHeight);
                } else if (possibleCode == 'i') {
                    if (textFont == 'gilllsans' || textFont == 'neosans') {
                        textFontExtension = 'italic';
                    } else if (textFont == 'mplantin') {
                        textFontExtension = 'i';
                        textFontStyle = textFontStyle.replace('italic ', '');
                    } else {
                        textFontExtension = '';
                        if (!textFontStyle.includes('italic')) {
                            textFontStyle += 'italic ';
                        }
                    }
                    lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
                } else if (possibleCode == '/i') {
                    textFontExtension = '';
                    textFontStyle = textFontStyle.replace('italic ', '');
                    lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
                } else if (possibleCode == 'bold') {
                    if (textFont == 'gillsans') {
                        textFontExtension = 'bold';
                    } else {
                        if (!textFontStyle.includes('bold')) {
                            textFontStyle += 'bold ';
                        }
                    }
                    lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
                } else if (possibleCode == '/bold') {
                    if (textFont == 'gillsans') {
                        textFontExtension = '';
                    } else {
                        textFontStyle = textFontStyle.replace('bold ', '');
                    }
                    lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
                } else if (possibleCode == 'left') {
                    textAlign = 'left';
                } else if (possibleCode == 'center') {
                    textAlign = 'center';
                } else if (possibleCode == 'right') {
                    textAlign = 'right';
                } else if (possibleCode == 'justify-left') {
                    textJustify = 'left';
                } else if (possibleCode == 'justify-center') {
                    textJustify = 'center';
                } else if (possibleCode == 'justify-right') {
                    textJustify = 'right';
                } else if (possibleCode.includes('conditionalcolor')) {
                    const codeParams = possibleCode.split(":");
                    const tagParts = codeParams[1].split(",");
                    const colorToApply = codeParams[2];

                    for (let part of tagParts) {

                        // Split into frame name + mask rules
                        const [rawFrameName, ...maskRuleParts] = part.split("*");
                        const frameName = rawFrameName.replace(/_/g, " ").toLowerCase();

                        const positiveMasks = [];
                        const negativeMasks = [];

                        for (let rule of maskRuleParts) {
                            if (!rule) continue;
                            if (rule.startsWith("!")) {
                                negativeMasks.push(rule.substring(1).replace(/_/g, " ").toLowerCase());
                            } else {
                                positiveMasks.push(rule.replace(/_/g, " ").toLowerCase());
                            }
                        }

                        const matchingFrames = card.frames.filter(f =>
                            f.name.toLowerCase().includes(frameName)
                        );

                        for (const frame of matchingFrames) {
                            const masks = frame.masks || [];

                            // --------------------------------------
                            // SPECIAL RULE:
                            // If NO masks → always match immediately
                            // --------------------------------------
                            if (masks.length === 0) {
                                textColor = colorToApply;
                                lineContext.fillStyle = textColor;
                                continue;
                            }

                            const maskNames = masks.map(m => m.name.toLowerCase());

                            // --- Positive mask rules -------------------------
                            let passesPositive = true;

                            if (positiveMasks.length > 0) {
                                passesPositive = positiveMasks.every(pos =>
                                    maskNames.some(mask => mask.includes(pos))
                                );
                            }

                            if (!passesPositive) continue;

                            // --- Negative mask rules -------------------------
                            let passesNegative = true;

                            if (negativeMasks.length > 0) {
                                passesNegative = negativeMasks.every(neg =>
                                    !maskNames.some(mask => mask.includes(neg))
                                );
                            }

                            if (!passesNegative) continue;

                            // All conditions passed
                            textColor = colorToApply;
                            lineContext.fillStyle = textColor;
                        }
                    }
                } else if (possibleCode.includes('fontcolor')) {
                    textColor = possibleCode.replace('fontcolor', '');
                    lineContext.fillStyle = textColor;
                } else if (possibleCode.includes('fontsize')) {
                    if (possibleCode.slice(-2) === "pt") {
                        textSize = (parseInt(possibleCode.replace('fontsize', '').replace('pt', '')) * 600 / 72) || 0;
                    } else {
                        textSize += parseInt(possibleCode.replace('fontsize', '')) || 0;
                    }
                    lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
                } else if (possibleCode.includes('font') || savedFont) {
                    textFont = word.replace('{font', '').replace('}', '');
                    if (savedFont) {
                        textFont = savedFont;
                        wordToWrite = word;
                    }
                    FontLoadTracker.track(textFont);
                    textFontExtension = '';
                    textFontStyle = '';
                    lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
                    savedFont = null;
                } else if (possibleCode.includes('outlinecolor')) {
                    lineContext.strokeStyle = possibleCode.replace('outlinecolor', '');
                } else if (possibleCode.includes('outline')) {
                    textOutlineWidth = parseInt(possibleCode.replace('outline', ''));
                    lineContext.lineWidth = textOutlineWidth;
                } else if (possibleCode.includes('linecap')) {
                    lineContext.lineCap = possibleCode.replace('linecap', '').trim();
                } else if (possibleCode.includes('linejoin')) {
                    lineContext.lineJoin = possibleCode.replace('linejoin', '').trim();
                } else if (possibleCode.includes('upinline')) {
                    lineY -= parseInt(possibleCode.replace('upinline', '')) || 0;
                } else if (possibleCode.substring(0, 2) == 'up' && possibleCode != 'up') {
                    currentY -= parseInt(possibleCode.replace('up', '')) || 0;
                } else if (possibleCode.includes('down')) {
                    currentY += parseInt(possibleCode.replace('down', '')) || 0;
                } else if (possibleCode.includes('left')) {
                    currentX -= parseInt(possibleCode.replace('left', '')) || 0;
                } else if (possibleCode.includes('right')) {
                    currentX += parseInt(possibleCode.replace('right', '')) || 0;
                } else if (possibleCode.includes('shadow')) {
                    if (possibleCode.includes('color')) {
                        textShadowColor = possibleCode.replace('shadowcolor', '');
                        lineContext.shadowColor = textShadowColor;
                    } else if (possibleCode.includes('blur')) {
                        textShadowBlur = parseInt(possibleCode.replace('shadowblur', '')) || 0;
                        lineContext.shadowBlur = textShadowBlur
                    } else if (possibleCode.includes('shadowx')) {
                        textShadowOffsetX = parseInt(possibleCode.replace('shadowx', '')) || 0;
                        lineContext.shadowOffsetX = textShadowOffsetX;
                    } else if (possibleCode.includes('shadowy')) {
                        textShadowOffsetY = parseInt(possibleCode.replace('shadowy', '')) || 0;
                        lineContext.shadowOffsetY = textShadowOffsetY;
                    } else {
                        textShadowOffsetX = parseInt(possibleCode.replace('shadow', '')) || 0;
                        textShadowOffsetY = textShadowOffsetX;
                        lineContext.shadowOffsetX = textShadowOffsetX;
                        lineContext.shadowOffsetY = textShadowOffsetY;
                    }
                } else if (possibleCode == 'planechase') {
                    var planechaseHeight = textSize * 1.8;
                    lineContext.drawImage(getManaSymbol('chaos').image, currentX + canvasMargin, canvasMargin, planechaseHeight * 1.2, planechaseHeight);
                    currentX += planechaseHeight * 1.3;
                    startingCurrentX += planechaseHeight * 1.3;
                } else if (possibleCode == 'indent') {
                    startingCurrentX += currentX;
                    currentY -= 10;
                } else if (possibleCode == '/indent') {
                    startingCurrentX = 0;
                } else if (possibleCode.includes('elemid')) {
                    if (document.querySelector('#' + word.replace('{elemid', '').replace('}', ''))) {
                        wordToWrite = document.querySelector('#' + word.replace('{elemid', '').replace('}', '')).value || '';
                    }
                    if (word.includes('set')) {
                        var bottomTextSubstring = card.bottomInfo.midLeft.text.substring(0, card.bottomInfo.midLeft.text.indexOf('  {savex}')).replace('{elemidinfo-set}', document.querySelector('#info-set').value || '').replace('{elemidinfo-language}', document.querySelector('#info-language').value || '');
                        justifyWidth = lineContext.measureText(bottomTextSubstring).width;
                    } else if (word.includes('number') && wordToWrite.includes('/') && !['pokemon', '8thPlaytest'].includes(card.version)) {
                        fillJustify = true;
                        wordToWrite = Array.from(wordToWrite).join(' ');
                    }
                } else if (possibleCode == 'savex') {
                    savedTextXPosition = currentX;
                } else if (possibleCode == 'loadx') {
                    if (savedTextXPosition > currentX) {
                        currentX = savedTextXPosition;
                    }
                } else if (possibleCode == 'savex2') {
                    savedTextXPosition2 = currentX;
                } else if (possibleCode == 'loadx2') {
                    if (savedTextXPosition2 > currentX) {
                        currentX = savedTextXPosition2;
                    }
                } else if (possibleCode.includes('ptshift')) {
                    if (card.frames.findIndex(element => element.name.toLowerCase().includes('power/toughness')) >= 0 || card.version.includes('planeswalker') || ['commanderLegends', 'm21', 'mysticalArchive', 'customDualLands', 'feuerAmeiseKaldheim'].includes(card.version)) {
                        ptShift[0] = scaleWidth(parseFloat(possibleCode.replace('ptshift', '').split(',')[0]));
                        ptShift[1] = scaleHeight(parseFloat(possibleCode.split(',')[1]));
                    }
                } else if (possibleCode.includes('rollcolor')) {
                    savedRollColor = possibleCode.replace('rollcolor', '') || 'black';
                } else if (possibleCode.includes('roll')) {
                    drawTextBetweenFrames = true;
                    redrawFrames = true;
                    drawToPrePTCanvas = true;
                    if (savedRollYPosition == null) {
                        savedRollYPosition = currentY;
                    } else {
                        savedRollYPosition = -1;
                    }
                    savedFont = textFont;
                    lineContext.font = textFontStyle + textSize + 'px ' + 'belerenb' + textFontExtension;
                    wordToWrite = possibleCode.replace('roll', '');
                } else if (possibleCode.includes('permashift')) {
                    permaShift = [parseFloat(possibleCode.replace('permashift', '').split(',')[0]), parseFloat(possibleCode.split(',')[1])];
                } else if (possibleCode.includes('arcradius')) {
                    textArcRadius = parseInt(possibleCode.replace('arcradius', '')) || 0;
                } else if (possibleCode.includes('arcstart')) {
                    textArcStart = parseFloat(possibleCode.replace('arcstart', '')) || 0;
                } else if (possibleCode.includes('rotate')) {
                    textRotation = parseInt(possibleCode.replace('rotate', '')) % 360;
                } else if (possibleCode === 'manacolordefault') {
                    manaSymbolColor = null;
                } else if (possibleCode.includes('manacolor')) {
                    manaSymbolColor = possibleCode.replace('manacolor', '') || 'white';
                } else if (possibleCode.includes('fixtextalign')) {
                    textAlign = realTextAlign;
                } else if (possibleCode.includes('kerning')) {
                    lineContext.letterSpacing = possibleCode.replace('kerning', '') + 'px';
                    lineContext.font = lineContext.font; //necessary for the letterspacing update to be recognized
                } else if (getManaSymbol(possibleCode.replaceAll('/', '')) != undefined || getManaSymbol(possibleCode.replaceAll('/', '').split('').reverse().join('')) != undefined) {
                    var possibleCode = possibleCode.replaceAll('/', '');
                    var manaSymbol;
                    // Add symbol to render queue without drawing immediately
                    if (textObject.manaPrefix &&
                        (getManaSymbol(textObject.manaPrefix + possibleCode) != undefined || getManaSymbol(textObject.manaPrefix + possibleCode.split('').reverse().join('')) != undefined)) {
                        manaSymbol = getManaSymbol(textObject.manaPrefix + possibleCode) || getManaSymbol(textObject.manaPrefix + possibleCode.split('').reverse().join(''));
                    } else {
                        if (possibleCode == 'brush' && textColor == 'white') {
                            possibleCode = 'whitebrush';
                        }
                        manaSymbol = getManaSymbol(possibleCode) || getManaSymbol(possibleCode.split('').reverse().join(''));
                    }

                    var origManaSymbolColor = manaSymbolColor;
                    if (manaSymbol.matchColor && !manaSymbolColor && textColor !== 'black') {
                        manaSymbolColor = textColor;
                    }

                    var manaSymbolSpacing = textSize * 0.04 + textManaSpacing;
                    var manaSymbolWidth = manaSymbol.width * textSize * 0.78;
                    var manaSymbolHeight = manaSymbol.height * textSize * 0.78;
                    var manaSymbolX = currentX + canvasMargin + manaSymbolSpacing;
                    var manaSymbolY = canvasMargin + textSize * 0.34 - manaSymbolHeight / 2;
                    if (textObject.manaPlacement) {
                        manaSymbolX = scaleWidth(textObject.manaPlacement.x[manaPlacementCounter] || 0) + canvasMargin;
                        manaSymbolY = canvasMargin;
                        currentY = scaleHeight(textObject.manaPlacement.y[manaPlacementCounter] || 0);
                        manaPlacementCounter++;
                        newLine = true;
                    } else if (textObject.manaLayout) {
                        var layoutOption = 0;
                        var manaSymbolCount = splitText.length - 1;
                        while (textObject.manaLayout[layoutOption].max < manaSymbolCount && layoutOption < textObject.manaLayout.length - 1) {
                            layoutOption++;
                        }
                        var manaLayout = textObject.manaLayout[layoutOption];
                        if (manaLayout.pos[manaPlacementCounter] == undefined) {
                            manaLayout.pos[manaPlacementCounter] = [0, 0];
                        }
                        manaSymbolX = scaleWidth(manaLayout.pos[manaPlacementCounter][0] || 0) + canvasMargin;
                        manaSymbolY = canvasMargin;
                        currentY = scaleHeight(manaLayout.pos[manaPlacementCounter][1] || 0);
                        manaPlacementCounter++;
                        manaSymbolWidth *= manaLayout.size;
                        manaSymbolHeight *= manaLayout.size;
                        newLine = true;
                    }
                    if (textObject.manaImageScale) {
                        currentX -= (textObject.manaImageScale - 1) * manaSymbolWidth;
                        manaSymbolX -= (textObject.manaImageScale - 1) / 2 * manaSymbolWidth;
                        manaSymbolY -= (textObject.manaImageScale - 1) / 2 * manaSymbolHeight;
                        manaSymbolWidth *= textObject.manaImageScale;
                        manaSymbolHeight *= textObject.manaImageScale;
                    }
                    var backImage = null;
                    if (manaSymbol.backs) {
                        backImage = getManaSymbol('back' + Math.floor(Math.random() * manaSymbol.backs) + manaSymbol.back).image;
                    }
                    // Add to render queue
                    manaSymbolsToRender.push({
                        symbol: manaSymbol,
                        x: manaSymbolX,
                        y: manaSymbolY,
                        width: manaSymbolWidth,
                        height: manaSymbolHeight,
                        hasOutline: textOutlineWidth > 0,
                        color: manaSymbolColor,
                        radius: textArcRadius,
                        arcStart: textArcStart,
                        currentX: currentX,
                        backImage: backImage,
                        outlineWidth: textOutlineWidth,
                        shadowColor: textShadowColor,
                        shadowOffsetX: textShadowOffsetX,
                        shadowOffsetY: textShadowOffsetY,
                        shadowBlur: textShadowBlur
                    });
                    currentX += manaSymbolWidth + manaSymbolSpacing * 2;

                    manaSymbolColor = origManaSymbolColor;
                } else {
                    wordToWrite = word;
                }
            }

            function renderManaSymbols() {
                if (manaSymbolsToRender.length === 0) return;

                // Detect Safari browser
                var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

                // Check if any symbols actually need outlines
                var hasAnyOutlines = manaSymbolsToRender.some(symbolData => symbolData.hasOutline);

                if (!hasAnyOutlines) {
                    // Simple path: no outlines needed, just draw symbols normally
                    manaSymbolsToRender.forEach(symbolData => {
                        var imageToUse = symbolData.symbol.image;
                        var backImageToUse = symbolData.backImage;

                        // For Safari, create a combined canvas first, then apply shadow
                        if (isSafari && (symbolData.symbol.image.src?.includes('.svg') || (backImageToUse?.src?.includes('.svg')))) {
                            // Create a combined canvas for both symbols
                            var combinedCanvas = document.createElement('canvas');
                            combinedCanvas.width = symbolData.width;
                            combinedCanvas.height = symbolData.height;
                            var combinedContext = combinedCanvas.getContext('2d');

                            // Draw back image first (if exists)
                            if (symbolData.symbol.backs && backImageToUse) {
                                combinedContext.drawImage(backImageToUse, 0, 0, symbolData.width, symbolData.height);
                            }

                            // Draw main symbol on top
                            combinedContext.drawImage(symbolData.symbol.image, 0, 0, symbolData.width, symbolData.height);

                            // Now use the combined canvas as the image source
                            imageToUse = combinedCanvas;
                            backImageToUse = null; // Don't draw back separately since it's already combined
                        }

                        if (symbolData.radius > 0) {
                            if (symbolData.symbol.backs && backImageToUse) {
                                lineContext.drawImageArc(backImageToUse, symbolData.x, symbolData.y,
                                    symbolData.width, symbolData.height, symbolData.radius,
                                    symbolData.arcStart, symbolData.currentX);
                            }
                            lineContext.drawImageArc(imageToUse, symbolData.x, symbolData.y,
                                symbolData.width, symbolData.height, symbolData.radius,
                                symbolData.arcStart, symbolData.currentX);
                        } else if (symbolData.color) {
                            lineContext.fillImage(imageToUse, symbolData.x, symbolData.y,
                                symbolData.width, symbolData.height, symbolData.color);
                        } else {
                            if (symbolData.symbol.backs && backImageToUse) {
                                lineContext.drawImage(backImageToUse, symbolData.x, symbolData.y,
                                    symbolData.width, symbolData.height);
                            }
                            lineContext.drawImage(imageToUse, symbolData.x, symbolData.y,
                                symbolData.width, symbolData.height);
                        }
                    });

                    manaSymbolsToRender = [];
                    return; // This exits the function completely - no complex rendering
                }

                // Complex path: outlines needed, do multi-pass rendering
                // This code should ONLY run when hasAnyOutlines is true
                var outlineCanvas = lineCanvas.cloneNode();
                var outlineContext = outlineCanvas.getContext('2d');
                var symbolCanvas = lineCanvas.cloneNode();
                var symbolContext = symbolCanvas.getContext('2d');
                symbolContext.shadowColor = lineContext.shadowColor;
                symbolContext.shadowOffsetX = lineContext.shadowOffsetX;
                symbolContext.shadowOffsetY = lineContext.shadowOffsetY;
                symbolContext.shadowBlur = lineContext.shadowBlur;

                // Save existing text content
                var tempCanvas = lineCanvas.cloneNode();
                var tempContext = tempCanvas.getContext('2d');
                tempContext.drawImage(lineCanvas, 0, 0);
                // Clear the line context
                lineContext.clearRect(0, 0, lineCanvas.width, lineCanvas.height);

                // First pass: Draw outlines only
                manaSymbolsToRender.forEach(symbolData => {
                    if (!symbolData.hasOutline) return;
                    outlineContext.fillStyle = 'black';
                    outlineContext.beginPath();
                    var centerX = symbolData.x + symbolData.width / 2;
                    var centerY = symbolData.y + symbolData.height / 2;
                    var baseRadius = Math.max(symbolData.width, symbolData.height) / 2;
                    // Fix: Use half the outline width to match text rendering behavior
                    var outlineRadius = baseRadius + (symbolData.outlineWidth || 0) / 2;
                    outlineContext.arc(centerX, centerY + (symbolData.radius ?? 0), outlineRadius, 0, 2 * Math.PI);
                    outlineContext.fill();
                });
                // Transfer outlines to main canvas
                lineContext.drawImage(outlineCanvas, 0, 0);

                // Restore text content on top of outlines
                lineContext.drawImage(tempCanvas, 0, 0);

                // Second pass: Draw mana symbols
                manaSymbolsToRender.forEach(symbolData => {
                    var imageToUse = symbolData.symbol.image;
                    var backImageToUse = symbolData.backImage;

                    // For Safari, create a combined canvas first, then apply shadow
                    if (isSafari && (symbolData.symbol.image.src?.includes('.svg') || (backImageToUse?.src?.includes('.svg')))) {
                        // Create a combined canvas for both symbols
                        var combinedCanvas = document.createElement('canvas');
                        combinedCanvas.width = symbolData.width;
                        combinedCanvas.height = symbolData.height;
                        var combinedContext = combinedCanvas.getContext('2d');

                        // Draw back image first (if exists)
                        if (symbolData.symbol.backs && backImageToUse) {
                            combinedContext.drawImage(backImageToUse, 0, 0, symbolData.width, symbolData.height);
                        }

                        // Draw main symbol on top
                        combinedContext.drawImage(symbolData.symbol.image, 0, 0, symbolData.width, symbolData.height);

                        // Now use the combined canvas as the image source
                        imageToUse = combinedCanvas;
                        backImageToUse = null; // Don't draw back separately since it's already combined
                    }

                    if (symbolData.radius > 0) {
                        if (symbolData.symbol.backs && backImageToUse) {
                            symbolContext.drawImageArc(backImageToUse, symbolData.x, symbolData.y,
                                symbolData.width, symbolData.height, symbolData.radius,
                                symbolData.arcStart, symbolData.currentX);
                        }
                        symbolContext.drawImageArc(imageToUse, symbolData.x, symbolData.y,
                            symbolData.width, symbolData.height, symbolData.radius,
                            symbolData.arcStart, symbolData.currentX);
                    } else if (symbolData.color) {
                        symbolContext.fillImage(imageToUse, symbolData.x, symbolData.y,
                            symbolData.width, symbolData.height, symbolData.color);
                    } else {
                        if (symbolData.symbol.backs && backImageToUse) {
                            symbolContext.drawImage(backImageToUse, symbolData.x, symbolData.y,
                                symbolData.width, symbolData.height);
                        }
                        symbolContext.drawImage(imageToUse, symbolData.x, symbolData.y,
                            symbolData.width, symbolData.height);
                    }
                });

                // Draw symbols on top of text
                lineContext.drawImage(symbolCanvas, 0, 0);

                manaSymbolsToRender = [];
            }

            if (wordToWrite && lineContext.font.endsWith('belerenb')) {
                wordToWrite = wordToWrite.replace(/f(?:\s|$)/g, '\ue006').replace(/h(?:\s|$)/g, '\ue007').replace(/m(?:\s|$)/g, '\ue008').replace(/n(?:\s|$)/g, '\ue009').replace(/k(?:\s|$)/g, '\ue00a');
            }

            //if the word goes past the max line width, go to the next line
            if (wordToWrite && lineContext.measureText(wordToWrite).width + currentX >= textWidth && textArcRadius == 0) {
                if (textOneLine && startingTextSize > 1) {
                    //doesn't fit... try again at a smaller text size?
                    startingTextSize -= 1;
                    continue outerloop;
                }
                newLine = true;
            }
            //if we need a new line, go to the next line
            if ((newLine && !textOneLine) || splitText.indexOf(word) == splitText.length - 1) {
                var horizontalAdjust = 0
                if (textAlign == 'center') {
                    horizontalAdjust = (textWidth - currentX) / 2;
                } else if (textAlign == 'right') {
                    horizontalAdjust = textWidth - currentX;
                }
                if (currentX > widestLineWidth) {
                    widestLineWidth = currentX;
                }
                if (manaSymbolsToRender.length > 0) {
                    renderManaSymbols();
                }
                paragraphContext.drawImage(lineCanvas, horizontalAdjust, currentY);
                lineY = 0;
                lineContext.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
                // boxes for 'roll a d20' cards
                if (savedRollYPosition != null && (newLineSpacing != 0 || !(newLine && !textOneLine))) {
                    if (savedRollYPosition != -1) {
                        paragraphContext.globalCompositeOperation = 'destination-over';
                        paragraphContext.globalAlpha = 0.25;
                        paragraphContext.fillStyle = savedRollColor;
                        paragraphContext.fillRect(canvasMargin - textSize * 0.1, savedRollYPosition + canvasMargin - textSize * 0.28, paragraphCanvas.width - 2 * canvasMargin + textSize * 0.2, currentY - savedRollYPosition + textSize * 1.3);
                        paragraphContext.globalCompositeOperation = 'source-over';
                        paragraphContext.globalAlpha = 1;
                        savedRollYPosition = -1;
                    } else {
                        savedRollYPosition = null;
                    }
                }
                //reset
                currentX = startingCurrentX;
                currentY += textSize + newLineSpacing;
                newLineSpacing = (textObject.lineSpacing || 0) * textSize;
                newLine = false;
            }
            //if there's a word to write, it's not a space on a new line, and it's allowed to write words, then we write the word
            if (wordToWrite && (currentX != startingCurrentX || wordToWrite != ' ') && !textManaCost) {
                var justifySettings = {
                    maxSpaceSize: 6,
                    minSpaceSize: 0
                };

                if (textArcRadius > 0) {
                    lineContext.fillTextArc(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY, textArcRadius, textArcStart, currentX, textOutlineWidth);
                } else {
                    if (textOutlineWidth >= 1) {
                        if (fillJustify) {
                            lineContext.strokeJustifyText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY, justifyWidth, justifySettings);
                        } else {
                            lineContext.strokeText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY);
                        }
                    }
                    if (fillJustify) {
                        lineContext.fillJustifyText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY, justifyWidth, justifySettings);
                    } else {
                        lineContext.fillText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY);
                    }
                }

                if (fillJustify) {
                    currentX += lineContext.measureJustifiedText(wordToWrite, justifyWidth, justifySettings);
                } else {
                    currentX += lineContext.measureText(wordToWrite).width;
                }
            }
            if (currentY > textHeight && textBounded && !textOneLine && startingTextSize > 1 && textArcRadius == 0) {
                //doesn't fit... try again at a smaller text size?
                startingTextSize -= 1;
                continue outerloop;
            }
            if (splitText.indexOf(word) == splitText.length - 1) {
                //should manage vertical centering here
                var verticalAdjust = 0;
                if (!textObject.noVerticalCenter) {
                    verticalAdjust = (textHeight - currentY + textSize * 0.15) / 2;
                }
                var finalHorizontalAdjust = 0;
                const horizontalAdjustUnit = (textWidth - widestLineWidth) / 2;
                if (textJustify == 'right' && textAlign != 'right') {
                    finalHorizontalAdjust = 2 * horizontalAdjustUnit;
                    if (textAlign == 'center') {
                        finalHorizontalAdjust = horizontalAdjustUnit;
                    }
                } else if (textJustify == 'center' && textAlign != 'center') {
                    finalHorizontalAdjust = horizontalAdjustUnit;
                    if (textAlign == 'right') {
                        finalHorizontalAdjust = -horizontalAdjustUnit;
                    }
                }
                var trueTargetContext = targetContext;
                if (drawToPrePTCanvas) {
                    trueTargetContext = prePTContext;
                }
                if (textRotation) {
                    trueTargetContext.save();
                    trueTargetContext
                    const shapeX = textX + ptShift[0];
                    const shapeY = textY + ptShift[1];
                    trueTargetContext.translate(shapeX, shapeY);
                    trueTargetContext.rotate(Math.PI * textRotation / 180);
                    trueTargetContext.drawImage(paragraphCanvas, permaShift[0] - canvasMargin + finalHorizontalAdjust, verticalAdjust - canvasMargin + permaShift[1]);
                    trueTargetContext.restore();
                } else {
                    trueTargetContext.drawImage(paragraphCanvas, textX - canvasMargin + ptShift[0] + permaShift[0] + finalHorizontalAdjust, textY - canvasMargin + verticalAdjust + ptShift[1] + permaShift[1]);
                }
                drawingText = false;
            }
        }
    }
}

CanvasRenderingContext2D.prototype.fillTextArc = function (text, x, y, radius, startRotation, distance = 0, outlineWidth = 0) {
    this.save();
    this.translate(x - distance + scaleWidth(0.5), y + radius);
    this.rotate(startRotation + widthToAngle(distance, radius));
    for (var i = 0; i < text.length; i++) {
        var letter = text[i];
        if (outlineWidth >= 1) {
            this.strokeText(letter, 0, -radius);
        }
        this.fillText(letter, 0, -radius);
        this.rotate(widthToAngle(this.measureText(letter).width, radius));
    }
    this.restore();
}
CanvasRenderingContext2D.prototype.drawImageArc = function (image, x, y, width, height, radius, startRotation, distance = 0) {
    this.save();
    this.translate(x - distance + scaleWidth(0.5), y + radius);
    this.rotate(startRotation + widthToAngle(distance, radius));
    this.drawImage(image, 0, -radius, width, height);
    this.restore();
}
CanvasRenderingContext2D.prototype.fillImage = function (image, x, y, width, height, color = 'white', margin = 10) {
    var canvas = document.createElement('canvas');
    canvas.width = width + margin * 2;
    canvas.height = height + margin * 2;
    var context = canvas.getContext('2d');
    context.drawImage(image, margin, margin, width, height);
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = pinlineColors(color);
    context.fillRect(0, 0, width + margin * 2, height + margin * 2);
    this.drawImage(canvas, x - margin, y - margin, width + margin * 2, height + margin * 2);
}

const FILL = 0; //const to indicate filltext render
const STROKE = 1;
const MEASURE = 2;
var maxSpaceSize = 3; // Multiplier for max space size. If greater then no justification applied
var minSpaceSize = 0.5; // Multiplier for minimum space size
function renderTextJustified(ctx, text, x, y, width, renderType) {
    var splitChar = " ";

    var words, wordsWidth, count, spaces, spaceWidth, adjSpace, renderer, i, textAlign, useSize, totalWidth;
    textAlign = ctx.textAlign;
    ctx.textAlign = "left";
    wordsWidth = 0;
    words = text.split(splitChar).map(word => {
        var w = ctx.measureText(word).width;
        wordsWidth += w;
        return {
            width: w,
            word: word
        };
    });
    // count = num words, spaces = number spaces, spaceWidth normal space size
    // adjSpace new space size >= min size. useSize Reslting space size used to render
    count = words.length;
    spaces = count - 1;
    spaceWidth = ctx.measureText(splitChar).width;
    adjSpace = Math.max(spaceWidth * minSpaceSize, (width - wordsWidth) / spaces);
    useSize = adjSpace > spaceWidth * maxSpaceSize ? spaceWidth : adjSpace;
    totalWidth = wordsWidth + useSize * spaces;
    if (renderType === MEASURE) { // if measuring return size
        ctx.textAlign = textAlign;
        return totalWidth;
    }
    renderer = renderType === FILL ? ctx.fillText.bind(ctx) : ctx.strokeText.bind(ctx); // fill or stroke
    switch (textAlign) {
        case "right":
            x -= totalWidth;
            break;
        case "end":
            x += width - totalWidth;
            break;
        case "center": // intentional fall through to default
            x -= totalWidth / 2;
        default:
    }
    if (useSize === spaceWidth) { // if space size unchanged
        renderer(text, x, y);
    } else {
        for (i = 0; i < count; i += 1) {
            renderer(words[i].word, x, y);
            x += words[i].width;
            x += useSize;
        }
    }
    ctx.textAlign = textAlign;
}

// Parse vet and set settings object.
function justifiedTextSettings(settings) {
    var min, max;
    var vetNumber = (num, defaultNum) => {
        num = num !== null && num !== null && !isNaN(num) ? num : defaultNum;
        if (num < 0) {
            num = defaultNum;
        }
        return num;
    }
    if (settings === undefined || settings === null) {
        return;
    }
    max = vetNumber(settings.maxSpaceSize, maxSpaceSize);
    min = vetNumber(settings.minSpaceSize, minSpaceSize);
    if (min > max) {
        return;
    }
    minSpaceSize = min;
    maxSpaceSize = max;
}

CanvasRenderingContext2D.prototype.fillJustifyText = function (text, x, y, width, settings) {
    justifiedTextSettings(settings);
    renderTextJustified(this, text, x, y, width, FILL);
}
CanvasRenderingContext2D.prototype.strokeJustifyText = function (text, x, y, width, settings) {
    justifiedTextSettings(settings);
    renderTextJustified(this, text, x, y, width, STROKE);
}
CanvasRenderingContext2D.prototype.measureJustifiedText = function (text, width, settings) {
    justifiedTextSettings(settings);
    renderTextJustified(this, text, 0, 0, width, MEASURE);
}

function widthToAngle(width, radius) {
    return width / radius;
}

function curlyQuotes(input) {
    return input.replace(/ '/g, ' ‘').replace(/^'/, '‘').replace(/'/g, '’').replace(/ "/g, ' “').replace(/" /g, '” ').replace(/\."/, '.”').replace(/"$/, '”').replace(/"\)/g, '”)').replace(/"/g, '“');
}

function pinlineColors(color) {
    return color.replace('white', '#fcfeff').replace('blue', '#0075be').replace('black', '#272624').replace('red', '#ef3827').replace('green', '#007b43')
}

async function addTextbox(textboxType) {
    if (textboxType == 'Nickname' && !card.text.nickname && card.text.title) {
        await loadTextOptions({
            nickname: {
                name: 'Nickname',
                text: card.text.title.text,
                x: 0.14,
                y: 0.1129,
                width: 0.72,
                height: 0.0243,
                oneLine: true,
                font: 'mplantini',
                size: 0.0229,
                color: 'white',
                shadowX: 0.0014,
                shadowY: 0.001,
                align: 'center'
            }
        }, false);
        var nickname = card.text.title;
        nickname.name = 'Nickname';
        card.text.title = card.text.nickname;
        card.text.title.name = 'Title';
        card.text.nickname = nickname;
    } else if (textboxType == 'Power/Toughness' && !card.text.pt) {
        loadTextOptions({pt: {name: 'Power/Toughness', text: '', x: 0.7928, y: 0.902, width: 0.1367, height: 0.0372, size: 0.0372, font: 'belerenbsc', oneLine: true, align: 'center'}}, false);
    } else if (textboxType == 'DateStamp' && !card.text.dateStamp) {
        loadTextOptions({
            dateStamp: {
                name: 'Date Stamp',
                text: '',
                x: 0.11,
                y: 0.5072,
                width: 0.78,
                height: 0.0286,
                size: 0.0286,
                font: 'belerenb',
                oneLine: true,
                align: 'right',
                color: '#ffd35b',
                shadowX: -0.0007,
                shadowY: -0.001
            }
        }, false);
    }
}

//ART TAB
function uploadArt(imageSource, otherParams) {
    ImageLoadTracker.track(imageSource);
    art.src = imageSource;
    if (otherParams && otherParams == 'autoFit') {
        art.onload = function () {
            autoFitArt();
            art.onload = artEdited;
        };
    }
}

async function uploadArtFilesToServer(filesRaw, otherParams = '') {
    await uploadFilesToServerByKind(filesRaw, 'art', uploadArt, otherParams, refreshArtLibrarySelect, true);
}

async function uploadFilesToServerByKind(filesRaw, kind, destination, otherParams = '', refreshCallback = null, artDuplicateCheck = false) {
    var files = ([...filesRaw]);
    if (files.length > 9) {
        if (!confirm('You are uploading ' + files.length + ' images. Would you like to continue?')) {
            return;
        }
    }

    for (const file of files) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('nameHint', file.name);

            const response = await fetch('/api/assets/upload/' + kind, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                if (artDuplicateCheck && response.status == 409) {
                    notify('This art already exists on the server (same file hash).', 5);
                    continue;
                }
                throw new Error('Upload failed with status ' + response.status);
            }

            const result = await response.json();
            destination(result.url, otherParams);
        } catch (error) {
            console.error(kind + ' upload failed:', error);
            notify('Upload failed. Falling back to local browser upload for this file.', 5);
            var reader = new FileReader();
            reader.onloadend = function () {
                destination(reader.result, otherParams);
            }
            reader.onerror = function () {
                destination('/img/blank.png', otherParams);
            }
            reader.readAsDataURL(file);
        }
    }

    if (refreshCallback) {
        refreshCallback();
    }
}

async function refreshArtLibrarySelect() {
    const select = document.querySelector('#art-library-select');
    if (!select) {
        return;
    }

    select.innerHTML = '<option value="" selected="selected">None selected</option>';

    try {
        const response = await fetch('/api/assets/art-sources');
        if (!response.ok) {
            throw new Error('Failed to load art list (' + response.status + ')');
        }

        const items = await response.json();
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.url;
            option.innerText = item.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Could not load art sources:', error);
        const option = document.createElement('option');
        option.value = '';
        option.innerText = 'Failed to load saved art list';
        select.appendChild(option);
    }
}

function selectArtLibrarySource(element) {
    if (!element || !element.value) {
        return;
    }
    uploadArt(element.value, document.querySelector('#art-update-autofit').checked ? 'autoFit' : '');
}

async function pasteArt() {
    try {
        const clipboardItems = await navigator.clipboard.read();

        for (const item of clipboardItems) {
            for (const type of item.types) {
                if (type.startsWith('image/')) {
                    const blob = await item.getType(type);

                    const url = URL.createObjectURL(blob);

                    uploadArt(url, document.querySelector("#art-update-autofit").checked ? "autoFit" : "");
                    // document.getElementById('preview').src = url;
                    return;
                }
            }
        }

        notify('No image found in clipboard!');
    } catch (err) {
        console.error('Failed to read clipboard: ', err);
        notify('Clipboard access not allowed or no image available.');
    }
}

function artEdited() {
    card.artSource = art.src;
    card.artX = document.querySelector('#art-x').value / card.width;
    card.artY = document.querySelector('#art-y').value / card.height;
    card.artZoom = document.querySelector('#art-zoom').value / 100;
    card.artRotate = document.querySelector('#art-rotate').value;
    drawCard();
}

function autoFitArt() {
    document.querySelector('#art-rotate').value = 0;
    if (art.width / art.height > scaleWidth(card.artBounds.width) / scaleHeight(card.artBounds.height)) {
        document.querySelector('#art-y').value = Math.round(scaleY(card.artBounds.y) - scaleHeight(card.marginY));
        document.querySelector('#art-zoom').value = (scaleHeight(card.artBounds.height) / art.height * 100).toFixed(1);
        document.querySelector('#art-x').value = Math.round(scaleX(card.artBounds.x) - (document.querySelector('#art-zoom').value / 100 * art.width - scaleWidth(card.artBounds.width)) / 2 - scaleWidth(card.marginX));
    } else {
        document.querySelector('#art-x').value = Math.round(scaleX(card.artBounds.x) - scaleWidth(card.marginX));
        document.querySelector('#art-zoom').value = (scaleWidth(card.artBounds.width) / art.width * 100).toFixed(1);
        document.querySelector('#art-y').value = Math.round(scaleY(card.artBounds.y) - (document.querySelector('#art-zoom').value / 100 * art.height - scaleHeight(card.artBounds.height)) / 2 - scaleHeight(card.marginY));
    }
    artEdited();
}

function centerArtX() {
    document.querySelector('#art-rotate').value = 0;
    if (art.width / art.height > scaleWidth(card.artBounds.width) / scaleHeight(card.artBounds.height)) {
        document.querySelector('#art-x').value = Math.round(scaleX(card.artBounds.x) - (document.querySelector('#art-zoom').value / 100 * art.width - scaleWidth(card.artBounds.width)) / 2 - scaleWidth(card.marginX));
    } else {
        document.querySelector('#art-x').value = Math.round(scaleX(card.artBounds.x) - scaleWidth(card.marginX));
    }
    artEdited();
}

function centerArtY() {
    document.querySelector('#art-rotate').value = 0;
    document.querySelector('#art-y').value = Math.round(scaleY(card.artBounds.y) - (document.querySelector('#art-zoom').value / 100 * art.height - scaleHeight(card.artBounds.height)) / 2 - scaleHeight(card.marginY));
    artEdited();
}

function artFromScryfall(scryfallResponse) {
    scryfallArt = []
    const artIndex = document.querySelector('#art-index');
    artIndex.innerHTML = null;
    var optionIndex = 0;
    scryfallResponse.forEach(card => {
        if (card.image_uris && (card.object == 'card' || card.type_line != 'Card') && card.artist) {
            scryfallArt.push(card);
            var option = document.createElement('option');
            option.innerHTML = `${card.name} (${card.set.toUpperCase()} - ${card.artist})`;
            option.value = optionIndex;
            artIndex.appendChild(option);
            optionIndex++;
        }
    });

    if (document.querySelector('#importAllPrints').checked) {
        // If importing unique prints, the art should change to match the unique print selected.

        // First we find the illustration ID of the imported print
        var illustrationID = scryfallCard[document.querySelector('#import-index').value].illustration_id;

        // Find all unique arts for that card
        var artIllustrations = scryfallArt.map(card => card.illustration_id);

        // Find the art that matches the selected print
        var index = artIllustrations.indexOf(illustrationID);
        if (index < 0) {
            // Couldn't find art
            index = 0;
        }

        // Use that art
        artIndex.value = index;
    }

    changeArtIndex();
}

function changeArtIndex() {
    const artIndexValue = document.querySelector('#art-index').value;
    if (artIndexValue != 0 || artIndexValue == '0') {
        const scryfallCardForArt = scryfallArt[artIndexValue];
        uploadArt(scryfallCardForArt.image_uris.art_crop, 'autoFit');
        artistEdited(scryfallCardForArt.artist);
        if (params.get('mtgpics') != null) {
            imageURL(`https://www.mtgpics.com/pics/art/${scryfallCardForArt.set.toLowerCase()}/${("00" + scryfallCardForArt.collector_number).slice(-3)}.jpg`, tryMTGPicsArt);
        }
    }
}

function tryMTGPicsArt(src) {
    var attemptedImage = new Image();
    attemptedImage.onload = function () {
        if (this.complete) {
            art.onload = function () {
                autoFitArt();
                art.onload = artEdited;
            };
            art.src = this.src;
        }
    }
    attemptedImage.src = src;
}

function initDraggableArt() {
    previewCanvas.onmousedown = artStartDrag;
    previewCanvas.onmousemove = artDrag;
    previewCanvas.onmouseout = artStopDrag;
    previewCanvas.onmouseup = artStopDrag;
    draggingArt = false;
    lastArtDragTime = 0;
}

function artStartDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    startX = parseInt(e.clientX);
    startY = parseInt(e.clientY);
    draggingArt = true;
}

function artDrag(e) {
    var target = document.querySelector('#drag-target-setSymbol').checked ? "setSymbol" : "art";
    var canRotate = target == "art";
    var edited = target == "art" ? artEdited : setSymbolEdited;

    e.preventDefault();
    e.stopPropagation();
    if (draggingArt && Date.now() > lastArtDragTime + 25) {
        lastArtDragTime = Date.now();
        if (e.shiftKey || e.ctrlKey) {
            startX = parseInt(e.clientX);
            const endY = parseInt(e.clientY);
            if (e.ctrlKey && canRotate) {
                document.querySelector(`#${target}-rotate`).value = Math.round((parseFloat(document.querySelector(`#${target}-rotate`).value) - (startY - endY) / 10) % 360 * 10) / 10;
            } else {
                document.querySelector(`#${target}-zoom`).value = Math.round((parseFloat(document.querySelector(`#${target}-zoom`).value) * (1.002 ** (startY - endY))) * 10) / 10;
            }
            startY = endY;
            edited();
        } else {
            const endX = parseInt(e.clientX);
            const endY = parseInt(e.clientY);
            var changeX = (endX - startX) * 2;
            var changeY = (endY - startY) * 2;
            if (card.landscape) {
                const temp = changeX;
                changeX = -changeY;
                changeY = temp;
            }
            document.querySelector(`#${target}-x`).value = parseInt(document.querySelector(`#${target}-x`).value) + changeX;
            document.querySelector(`#${target}-y`).value = parseInt(document.querySelector(`#${target}-y`).value) + changeY;
            startX = endX;
            startY = endY;
            edited();
        }

    }
}

function artStopDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (draggingArt) {
        draggingArt = false;
    }
}

//SET SYMBOL TAB
function uploadSetSymbol(imageSource, otherParams) {
    ImageLoadTracker.track(imageSource);
    setSymbol.src = imageSource;
    if (otherParams && otherParams == 'resetSetSymbol') {
        setSymbol.onload = function () {
            resetSetSymbol();
            setSymbol.onload = setSymbolEdited;
        };
    }
}

async function uploadSetSymbolFilesToServer(filesRaw, otherParams = 'resetSetSymbol') {
    await uploadFilesToServerByKind(filesRaw, 'set-symbols', uploadSetSymbol, otherParams, refreshSetSymbolLibrarySelect);
}

async function refreshSetSymbolLibrarySelect() {
    const select = document.querySelector('#set-symbol-library-select');
    if (!select) {
        return;
    }

    select.innerHTML = '<option value="" selected="selected">None selected</option>';

    try {
        const response = await fetch('/api/assets/sources/set-symbols');
        if (!response.ok) {
            throw new Error('Failed to load set symbol list (' + response.status + ')');
        }

        const items = await response.json();
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.url;
            option.innerText = item.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Could not load uploaded set symbols:', error);
        const option = document.createElement('option');
        option.value = '';
        option.innerText = 'Failed to load uploaded set symbols';
        select.appendChild(option);
    }
}

function selectSetSymbolLibrarySource(element) {
    if (!element || !element.value) {
        return;
    }
    uploadSetSymbol(element.value, 'resetSetSymbol');
}

function setSymbolEdited() {
    card.setSymbolSource = setSymbol.src;
    if (document.querySelector('#lockSetSymbolURL').checked) {
        localStorage.setItem('lockSetSymbolURL', card.setSymbolSource);
    }
    localStorage.setItem('set-symbol-source', document.querySelector('#set-symbol-source').value);
    card.setSymbolX = document.querySelector('#setSymbol-x').value / card.width;
    card.setSymbolY = document.querySelector('#setSymbol-y').value / card.height;
    card.setSymbolZoom = document.querySelector('#setSymbol-zoom').value / 100;
    drawCard();
}

function resetSetSymbol() {
    if (card.setSymbolBounds == undefined) {
        return;
    }
    document.querySelector('#setSymbol-x').value = Math.round(scaleX(card.setSymbolBounds.x));
    document.querySelector('#setSymbol-y').value = Math.round(scaleY(card.setSymbolBounds.y));
    var setSymbolZoom;
    if (setSymbol.width / setSymbol.height > scaleWidth(card.setSymbolBounds.width) / scaleHeight(card.setSymbolBounds.height)) {
        setSymbolZoom = (scaleWidth(card.setSymbolBounds.width) / setSymbol.width * 100).toFixed(1);
    } else {
        setSymbolZoom = (scaleHeight(card.setSymbolBounds.height) / setSymbol.height * 100).toFixed(1);
    }
    document.querySelector('#setSymbol-zoom').value = setSymbolZoom;
    if (card.setSymbolBounds.horizontal == 'center') {
        document.querySelector('#setSymbol-x').value = Math.round(scaleX(card.setSymbolBounds.x) - (setSymbol.width * setSymbolZoom / 100) / 2 - scaleWidth(card.marginX));
    } else if (card.setSymbolBounds.horizontal == 'right') {
        document.querySelector('#setSymbol-x').value = Math.round(scaleX(card.setSymbolBounds.x) - (setSymbol.width * setSymbolZoom / 100) - scaleWidth(card.marginX));
    }
    if (card.setSymbolBounds.vertical == 'center') {
        document.querySelector('#setSymbol-y').value = Math.round(scaleY(card.setSymbolBounds.y) - (setSymbol.height * setSymbolZoom / 100) / 2 - scaleHeight(card.marginY));
    } else if (card.setSymbolBounds.vertical == 'bottom') {
        document.querySelector('#setSymbol-y').value = Math.round(scaleY(card.setSymbolBounds.y) - (setSymbol.height * setSymbolZoom / 100) - scaleHeight(card.marginY));
    }
    setSymbolEdited();
}

function fetchSetSymbol() {
    var setCode = document.querySelector('#set-symbol-code').value.toLowerCase() || 'cmd';
    if (document.querySelector('#lockSetSymbolCode').checked) {
        localStorage.setItem('lockSetSymbolCode', setCode);
    }
    var setRarity = document.querySelector('#set-symbol-rarity').value.toLowerCase().replace('uncommon', 'u').replace('common', 'c').replace('rare', 'r').replace('mythic', 'm') || 'c';
    if (['a22', 'a23', 'j22', 'hlw'].includes(setCode.toLowerCase())) {
        uploadSetSymbol(fixUri(`/img/setSymbols/custom/${setCode.toLowerCase()}-${setRarity}.png`), 'resetSetSymbol');
    } else if (['cc', 'logan', 'joe'].includes(setCode.toLowerCase())) {
        uploadSetSymbol(fixUri(`/img/setSymbols/custom/${setCode.toLowerCase()}-${setRarity}.svg`), 'resetSetSymbol');
    } else if (document.querySelector("#set-symbol-source").value == 'gatherer') {
        if (setSymbolAliases.has(setCode.toLowerCase())) setCode = setSymbolAliases.get(setCode.toLowerCase());
        uploadSetSymbol('http://gatherer.wizards.com/Handlers/Image.ashx?type=symbol&set=' + setCode + '&size=large&rarity=' + setRarity, 'resetSetSymbol');
    } else if (document.querySelector("#set-symbol-source").value == 'hexproof') {
        if (setSymbolAliases.has(setCode.toLowerCase())) setCode = setSymbolAliases.get(setCode.toLowerCase());
        var hexproofUrl = 'https://api.hexproof.io/symbols/set/' + setCode + '/' + setRarity;
        // Use CORS proxy for hexproof.io
        if (params.get('noproxy') == null) {
            hexproofUrl = 'https://corsproxy.io/?url=' + encodeURIComponent(hexproofUrl);
        }
        uploadSetSymbol(hexproofUrl, 'resetSetSymbol');
    } else {
        var extension = 'svg';
        if (['xxxx'].includes(setCode.toLowerCase())) {
            extension = 'png';
        }
        if (setSymbolAliases.has(setCode.toLowerCase())) setCode = setSymbolAliases.get(setCode.toLowerCase());
        uploadSetSymbol(fixUri(`/img/setSymbols/official/${setCode.toLowerCase()}-${setRarity}.` + extension), 'resetSetSymbol');
    }
}

function lockSetSymbolCode() {
    var savedValue = '';
    if (document.querySelector('#lockSetSymbolCode').checked) {
        savedValue = document.querySelector('#set-symbol-code').value;
    }
    localStorage.setItem('lockSetSymbolCode', savedValue);
}

function lockSetSymbolURL() {
    var savedValue = '';
    if (document.querySelector('#lockSetSymbolURL').checked) {
        savedValue = card.setSymbolSource;
    }
    localStorage.setItem('lockSetSymbolURL', savedValue);
}

//WATERMARK TAB
function uploadWatermark(imageSource, otherParams) {
    ImageLoadTracker.track(imageSource);
    watermark.src = imageSource;
    if (otherParams && otherParams == 'resetWatermark') {
        watermark.onload = function () {
            resetWatermark();
            watermark.onload = watermarkEdited;
        };
    }
}

async function uploadWatermarkFilesToServer(filesRaw, otherParams = 'resetWatermark') {
    await uploadFilesToServerByKind(filesRaw, 'watermarks', uploadWatermark, otherParams, refreshWatermarkLibrarySelect);
}

async function refreshWatermarkLibrarySelect() {
    const select = document.querySelector('#watermark-library-select');
    if (!select) {
        return;
    }

    select.innerHTML = '<option value="" selected="selected">None selected</option>';

    try {
        const response = await fetch('/api/assets/sources/watermarks');
        if (!response.ok) {
            throw new Error('Failed to load watermark list (' + response.status + ')');
        }

        const items = await response.json();
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.url;
            option.innerText = item.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Could not load uploaded watermarks:', error);
        const option = document.createElement('option');
        option.value = '';
        option.innerText = 'Failed to load uploaded watermarks';
        select.appendChild(option);
    }
}

function selectWatermarkLibrarySource(element) {
    if (!element || !element.value) {
        return;
    }
    uploadWatermark(element.value, 'resetWatermark');
}

function watermarkLeftColor(c) {
    card.watermarkLeft = c;
    watermarkEdited();
}

function watermarkRightColor(c) {
    card.watermarkRight = c;
    watermarkEdited();
}

function watermarkEdited() {
    card.watermarkSource = watermark.src;
    card.watermarkX = document.querySelector('#watermark-x').value / card.width;
    card.watermarkY = document.querySelector('#watermark-y').value / card.height;
    card.watermarkZoom = document.querySelector('#watermark-zoom').value / 100;
    if (card.watermarkLeft == "none" && document.querySelector('#watermark-left').value != "none") {
        card.watermarkLeft = document.querySelector('#watermark-left').value;
    }
    // card.watermarkLeft = document.querySelector('#watermark-left').value;
    // card.watermarkRight =  document.querySelector('#watermark-right').value;
    card.watermarkOpacity = document.querySelector('#watermark-opacity').value / 100;
    watermarkContext.globalCompositeOperation = 'source-over';
    watermarkContext.globalAlpha = 1;
    watermarkContext.clearRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
    if (card.watermarkLeft != 'none' && !card.watermarkSource.includes('/blank.png') && card.watermarkZoom > 0) {
        if (card.watermarkRight != 'none') {
            watermarkContext.drawImage(right, scaleX(0), scaleY(0), scaleWidth(1), scaleHeight(1));
            watermarkContext.globalCompositeOperation = 'source-in';
            if (card.watermarkRight == 'default') {
                watermarkContext.drawImage(watermark, scaleX(card.watermarkX), scaleY(card.watermarkY), watermark.width * card.watermarkZoom, watermark.height * card.watermarkZoom);
            } else {
                watermarkContext.fillStyle = card.watermarkRight;
                watermarkContext.fillRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
            }
            watermarkContext.globalCompositeOperation = 'destination-over';
        }
        if (card.watermarkLeft == 'default') {
            watermarkContext.drawImage(watermark, scaleX(card.watermarkX), scaleY(card.watermarkY), watermark.width * card.watermarkZoom, watermark.height * card.watermarkZoom);
        } else {
            watermarkContext.fillStyle = card.watermarkLeft;
            watermarkContext.fillRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
        }
        watermarkContext.globalCompositeOperation = 'destination-in';
        watermarkContext.drawImage(watermark, scaleX(card.watermarkX), scaleY(card.watermarkY), watermark.width * card.watermarkZoom, watermark.height * card.watermarkZoom);
        watermarkContext.globalAlpha = card.watermarkOpacity;
        watermarkContext.fillRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
    }
    drawCard();
}

function resetWatermark() {
    var watermarkZoom;
    if (watermark.width / watermark.height > scaleWidth(card.watermarkBounds.width) / scaleHeight(card.watermarkBounds.height)) {
        watermarkZoom = (scaleWidth(card.watermarkBounds.width) / watermark.width * 100).toFixed(1);
    } else {
        watermarkZoom = (scaleHeight(card.watermarkBounds.height) / watermark.height * 100).toFixed(1);
    }
    document.querySelector('#watermark-zoom').value = watermarkZoom;
    document.querySelector('#watermark-x').value = Math.round(scaleX(card.watermarkBounds.x) - watermark.width * watermarkZoom / 200 - scaleWidth(card.marginX));
    document.querySelector('#watermark-y').value = Math.round(scaleY(card.watermarkBounds.y) - watermark.height * watermarkZoom / 200 - scaleHeight(card.marginY));
    watermarkEdited();
}

//svg cropper
function getSetSymbolWatermark(url, targetImage = watermark) {
    if (!url.includes('/')) {
        url = 'https://cdn.jsdelivr.net/npm/keyrune/svg/' + url + '.svg';
    }
    xhttp = new XMLHttpRequest();
    xhttp.open('GET', url, true);
    xhttp.overrideMimeType('image/svg+xml');
    xhttp.onload = function (event) {
        if (this.readyState == 4 && this.status == 200) {
            var svg = document.body.appendChild(xhttp.responseXML.documentElement);
            var box = svg.getBBox(svg);
            svg.setAttribute('viewBox', [box.x, box.y, box.width, box.height].join(' '));
            svg.setAttribute('width', box.width);
            svg.setAttribute('height', box.height);
            uploadWatermark('data:image/svg+xml,' + encodeURIComponent(svg.outerHTML), 'resetWatermark');
            svg.remove();
        } else if (this.status == 404) {
            throw new Error('Improper Set Code');
        }
    }
    xhttp.send();
}

//Bottom Info Tab
async function loadBottomInfo(textObjects = []) {
    await bottomInfoContext.clearRect(0, 0, bottomInfoCanvas.width, bottomInfoCanvas.height);
    card.bottomInfo = null;
    card.bottomInfo = textObjects;
    await bottomInfoEdited();
    bottomInfoEdited();
}

async function bottomInfoEdited() {
    await bottomInfoContext.clearRect(0, 0, bottomInfoCanvas.width, bottomInfoCanvas.height);
    card.infoNumber = document.querySelector('#info-number').value;
    card.infoRarity = document.querySelector('#info-rarity').value;
    card.infoSet = document.querySelector('#info-set').value;
    card.infoLanguage = document.querySelector('#info-language').value;
    card.infoArtist = document.querySelector('#info-artist').value;
    card.infoYear = document.querySelector('#info-year').value;
    card.infoNote = document.querySelector('#info-note').value;

    if (document.querySelector('#enableCollectorInfo').checked) {
        for (var textObject of Object.entries(card.bottomInfo)) {
            if (["NOT FOR SALE", "Wizards of the Coast", "CardConjurer.com", "cardconjurer.com"].some(v => textObject[1].text.includes(v))) {
                continue;
            } else {
                textObject[1].name = textObject[0];
                await writeText(textObject[1], bottomInfoContext);
            }

        }
    }

    drawCard();
}

async function serialInfoEdited() {
    card.serialNumber = document.querySelector('#serial-number').value;
    card.serialTotal = document.querySelector('#serial-total').value;
    card.serialX = document.querySelector('#serial-x').value;
    card.serialY = document.querySelector('#serial-y').value;
    card.serialScale = document.querySelector('#serial-scale').value;

    drawCard();
}

async function resetSerial() {
    card.serialX = scaleX(SERIAL_DEFAULT_X / SERIAL_REFERENCE_WIDTH);
    card.serialY = scaleY(SERIAL_DEFAULT_Y / SERIAL_REFERENCE_HEIGHT);
    card.serialScale = 1.0;

    document.querySelector('#serial-x').value = card.serialX;
    document.querySelector('#serial-y').value = card.serialY;
    document.querySelector('#serial-scale').value = card.serialScale;

    drawCard();
}

function artistEdited(value) {
    document.querySelector('#art-artist').value = value;
    document.querySelector('#info-artist').value = value;
    bottomInfoEdited();
}

function toggleStarDot() {
    for (var key of Object.keys(card.bottomInfo)) {
        var text = card.bottomInfo[key].text
        if (text.includes('*')) {
            card.bottomInfo[key].text = text.replace('*', ' \u2022 ');
        } else {
            card.bottomInfo[key].text = text.replace(' \u2022 ', '*');
        }
    }
    defaultCollector.starDot = !defaultCollector.starDot;
    bottomInfoEdited();
}

function enableNewCollectorInfoStyle() {
    localStorage.setItem('enableNewCollectorStyle', document.querySelector('#enableNewCollectorStyle').checked);
    setBottomInfoStyle();
    bottomInfoEdited();
}

function enableCollectorInfo() {
    localStorage.setItem('enableCollectorInfo', document.querySelector('#enableCollectorInfo').checked);
    bottomInfoEdited();
}

function enableImportCollectorInfo() {
    localStorage.setItem('enableImportCollectorInfo', document.querySelector('#enableImportCollectorInfo').checked);
}

function setAutoFrame() {
    var value = document.querySelector('#autoFrame').value;
    localStorage.setItem('autoFrame', value);

    if (value !== 'false') {
        document.querySelector('#autoLoadFrameVersion').checked = true;
        localStorage.setItem('autoLoadFrameVersion', 'true');
    }

    autoFrame();
}

function setAutofit() {
    localStorage.setItem('autoFit', document.querySelector('#art-update-autofit').checked);
}

function removeDefaultCollector() {
    defaultCollector = {}; //{number: year, rarity:'P', setCode:'MTG', lang:'EN', starDot:false};
    localStorage.removeItem('defaultCollector'); //localStorage.setItem('defaultCollector', JSON.stringify(defaultCollector));
}

function setDefaultCollector() {
    starDot = defaultCollector.starDot;
    defaultCollector = {
        number: document.querySelector('#info-number').value,
        rarity: document.querySelector('#info-rarity').value,
        setCode: document.querySelector('#info-set').value,
        lang: document.querySelector('#info-language').value,
        note: document.querySelector('#info-note').value,
        starDot: starDot
    };
    localStorage.setItem('defaultCollector', JSON.stringify(defaultCollector));
}

function drawSetSymbol(cardContext, setSymbol, bounds) {
    if (!bounds) return;

    const symbolWidth = setSymbol.width * card.setSymbolZoom;
    const symbolHeight = setSymbol.height * card.setSymbolZoom;
    const x = scaleX(card.setSymbolX);
    const y = scaleY(card.setSymbolY);

    if (bounds.outlineWidth && bounds.outlineWidth > 0) {
        // Create temp canvas for outlined symbol
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // Scale the outline width the same way text outlines are scaled
        const outlineWidth = scaleHeight(bounds.outlineWidth);
        const margin = outlineWidth * 2;
        tempCanvas.width = symbolWidth + margin;
        tempCanvas.height = symbolHeight + margin;

        // Setup stroke style (similar to text outline system)
        tempCtx.strokeStyle = bounds.outlineColor || 'black';
        tempCtx.lineWidth = outlineWidth;
        tempCtx.lineJoin = bounds.lineJoin || 'round';
        tempCtx.lineCap = bounds.lineCap || 'round';

        // First pass: Draw outline by stroking the symbol multiple times in a circle pattern
        const outlineSteps = Math.max(8, Math.ceil(outlineWidth * 2));
        for (let i = 0; i < outlineSteps; i++) {
            const angle = (i / outlineSteps) * Math.PI * 2;
            const offsetX = Math.cos(angle) * (outlineWidth / 2);
            const offsetY = Math.sin(angle) * (outlineWidth / 2);

            tempCtx.globalCompositeOperation = 'source-over';
            tempCtx.drawImage(setSymbol,
                outlineWidth + offsetX,
                outlineWidth + offsetY,
                symbolWidth,
                symbolHeight);

            // Apply the outline color
            tempCtx.globalCompositeOperation = 'source-in';
            tempCtx.fillStyle = bounds.outlineColor || 'black';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.globalCompositeOperation = 'destination-over';
        }

        // Second pass: Draw the original symbol on top
        tempCtx.globalCompositeOperation = 'source-over';
        tempCtx.drawImage(setSymbol, outlineWidth, outlineWidth, symbolWidth, symbolHeight);

        // Draw to main canvas
        cardContext.drawImage(tempCanvas,
            x - outlineWidth,
            y - outlineWidth,
            tempCanvas.width,
            tempCanvas.height);
    } else {
        // Draw main symbol without outline (simple path)
        cardContext.drawImage(setSymbol, x, y, symbolWidth, symbolHeight);
    }
}

//DRAWING THE CARD (putting it all together)
function drawCard() {
    // reset
    cardContext.globalCompositeOperation = 'source-over';
    cardContext.clearRect(0, 0, cardCanvas.width, cardCanvas.height);
    // art
    cardContext.save();
    cardContext.translate(scaleX(card.artX), scaleY(card.artY));
    cardContext.rotate(Math.PI / 180 * (card.artRotate || 0));
    if (document.querySelector('#grayscale-art').checked) {
        cardContext.filter = 'grayscale(1)';
    }
    cardContext.drawImage(art, 0, 0, art.width * card.artZoom, art.height * card.artZoom);
    cardContext.restore();
    // frame elements
    if (card.version.includes('planeswalker') && typeof planeswalkerPreFrameCanvas !== "undefined") {
        cardContext.drawImage(planeswalkerPreFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    }
    cardContext.drawImage(frameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    if (card.version.toLowerCase().includes('planeswalker') && typeof planeswalkerPostFrameCanvas !== "undefined") {
        cardContext.drawImage(planeswalkerPostFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    } else if (card.version.toLowerCase().includes('planeswalker') && typeof planeswalkerCanvas !== "undefined") {
        cardContext.drawImage(planeswalkerCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    } else if (card.version.toLowerCase().includes('station') && typeof stationPreFrameCanvas !== "undefined") {
        cardContext.drawImage(stationPreFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    }
    if (card.version.toLowerCase().includes('station') && typeof stationPostFrameCanvas !== "undefined") {
        cardContext.drawImage(stationPostFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    } else if (card.version.toLowerCase().includes('qrcode') && typeof qrCodeCanvas !== "undefined") {
        cardContext.drawImage(qrCodeCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    } // REMOVE/DELETE PLANESWALKERCANVAS AFTER A FEW WEEKS
    // guidelines
    if (document.querySelector('#show-guidelines').checked) {
        cardContext.drawImage(guidelinesCanvas, scaleX(card.marginX) / 2, scaleY(card.marginY) / 2, cardCanvas.width, cardCanvas.height);
    }
    // watermark
    cardContext.drawImage(watermarkCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    // custom elements for sagas, classes, and dungeons
    if (card.version.toLowerCase().includes('saga') && typeof sagaCanvas !== "undefined") {
        cardContext.drawImage(sagaCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    } else if (card.version.includes('class') && !card.version.includes('classic') && typeof classCanvas !== "undefined") {
        cardContext.drawImage(classCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    } else if (card.version.toLowerCase().includes('dungeon') && typeof dungeonCanvas !== "undefined") {
        cardContext.drawImage(dungeonCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    }
    // text
    cardContext.drawImage(textCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    // set symbol
    if (card.setSymbolBounds) {
        drawSetSymbol(cardContext, setSymbol, card.setSymbolBounds);
    }
    // serial
    if (card.serialNumber || card.serialTotal) {
        var x = parseInt(card.serialX) || SERIAL_DEFAULT_X;
        var y = parseInt(card.serialY) || SERIAL_DEFAULT_Y;
        var scale = parseFloat(card.serialScale) || 1.0;

        cardContext.drawImage(serial, scaleX(x / SERIAL_REFERENCE_WIDTH), scaleY(y / SERIAL_REFERENCE_HEIGHT), scaleWidth(SERIAL_STAMP_WIDTH / SERIAL_REFERENCE_WIDTH) * scale, scaleHeight(SERIAL_STAMP_HEIGHT / SERIAL_REFERENCE_HEIGHT) * scale);

        var number = {
            name: "Number",
            text: '{kerning3}' + card.serialNumber || '',
            x: (x + (SERIAL_NUMBER_INNER_X * scale)) / SERIAL_REFERENCE_WIDTH,
            y: (y + (SERIAL_TEXT_INNER_Y * scale)) / SERIAL_REFERENCE_HEIGHT,
            width: (SERIAL_TEXT_FIELD_WIDTH * scale) / SERIAL_REFERENCE_WIDTH,
            height: (SERIAL_TEXT_FIELD_HEIGHT * scale) / SERIAL_REFERENCE_HEIGHT,
            oneLine: true,
            font: 'gothambold',
            color: 'white',
            size: (SERIAL_TEXT_FIELD_HEIGHT * scale) / SERIAL_REFERENCE_WIDTH,
            align: 'center'
        };

        var total = {
            name: "Number",
            text: '{kerning3}' + card.serialTotal || '',
            x: (x + (SERIAL_TOTAL_INNER_X * scale)) / SERIAL_REFERENCE_WIDTH,
            y: (y + (SERIAL_TEXT_INNER_Y * scale)) / SERIAL_REFERENCE_HEIGHT,
            width: (SERIAL_TEXT_FIELD_WIDTH * scale) / SERIAL_REFERENCE_WIDTH,
            height: (SERIAL_TEXT_FIELD_HEIGHT * scale) / SERIAL_REFERENCE_HEIGHT,
            oneLine: true,
            font: 'gothambold',
            color: 'white',
            size: (SERIAL_TEXT_FIELD_HEIGHT * scale) / SERIAL_REFERENCE_WIDTH,
            align: 'center'
        };

        writeText(number, cardContext);
        writeText(total, cardContext);
    }
    // bottom info
    if (card.bottomInfoTranslate) {
        cardContext.save();
        cardContext.rotate(Math.PI / 180 * (card.bottomInfoRotate || 0));
        cardContext.translate(card.bottomInfoTranslate.x || 0, card.bottomInfoTranslate.y || 0);
        cardContext.drawImage(bottomInfoCanvas, 0, 0, cardCanvas.width * (card.bottomInfoZoom || 1), cardCanvas.height * (card.bottomInfoZoom || 1));
        cardContext.restore();
    } else {
        cardContext.drawImage(bottomInfoCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    }


    // cutout the corners
    cardContext.globalCompositeOperation = 'destination-out';
    if (!card.noCorners && (card.marginX == 0 && card.marginY == 0)) {
        var w = card.version == 'battle' ? 2100 : getStandardWidth();

        cardContext.drawImage(corner, 0, 0, scaleWidth(CORNER_CUTOUT_SIZE / w), scaleWidth(CORNER_CUTOUT_SIZE / w));
        cardContext.rotate(Math.PI / 2);
        cardContext.drawImage(corner, 0, -card.width, scaleWidth(CORNER_CUTOUT_SIZE / w), scaleWidth(CORNER_CUTOUT_SIZE / w));
        cardContext.rotate(Math.PI / 2);
        cardContext.drawImage(corner, -card.width, -card.height, scaleWidth(CORNER_CUTOUT_SIZE / w), scaleWidth(CORNER_CUTOUT_SIZE / w));
        cardContext.rotate(Math.PI / 2);
        cardContext.drawImage(corner, -card.height, 0, scaleWidth(CORNER_CUTOUT_SIZE / w), scaleWidth(CORNER_CUTOUT_SIZE / w));
        cardContext.rotate(Math.PI / 2);
    }

    // Restore normal compositing after corner punch-out so overlays draw with their real colors.
    cardContext.globalCompositeOperation = 'source-over';

    // selected profile cut/safe placement overlay
    if (!suppressProfilePlacementOverlay && document.querySelector('#show-profile-placement-overlay')?.checked) {
        drawProfilePlacementOverlay();
        cardContext.drawImage(profileOverlayCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    }

    // show preview
    previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewContext.drawImage(cardCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

    if (window.cardDrawingPromiseResolver) {
        window.cardDrawingPromiseResolver();
        window.cardDrawingPromiseResolver = null;
    }
}

//DOWNLOADING
async function downloadCard(alt = false, jpeg = false) {
    if (card.infoArtist.replace(/ /g, '') == '' && !card.artSource.includes('/img/blank.png') && !card.artZoom == 0) {
        notify('You must credit an artist before downloading!', 5);
        return;
    }

    const format = jpeg ? 'jpeg' : 'png';
    const imageName = getCardName() + '.' + (jpeg ? 'jpeg' : 'png');
    const selectedProfile = getSelectedCardSizeProfile();
    const cardSizeProfileName = selectedProfile && selectedProfile.name ? selectedProfile.name : null;
    const printToggle = document.querySelector('#download-print-image');
    const isPrintImage = !!(printToggle && printToggle.checked);

    const previousOverlaySuppression = suppressProfilePlacementOverlay;
    suppressProfilePlacementOverlay = true;
    drawCard();

    try {
        // Alt mode: open a live preview in a new tab — no server round-trip needed
        if (alt) {
            const dataURL = cardCanvas.toDataURL('image/png');
            const newWindow = window.open('about:blank');
            setTimeout(function () {
                newWindow.document.body.appendChild(newWindow.document.createElement('img')).src = dataURL;
                newWindow.document.querySelector('img').style = 'max-height:100vh;max-width:100vw;';
                newWindow.document.body.style = 'padding:0;margin:0;text-align:center;background-color:#888;';
                newWindow.document.title = imageName;
            }, 0);
            return;
        }

        // Always send lossless PNG from the canvas. Base64 adds no quality loss —
        // it is a pure ASCII re-encoding of the same bytes. ImageSharp re-encodes
        // to the target format server-side, embedding card JSON as PNG iTXt / JPEG XMP metadata.
        const imageBase64 = cardCanvas.toDataURL('image/png').split(',')[1];

        // Strip non-serialisable Image objects from frames before sending
        const cardToSend = JSON.parse(JSON.stringify(card));
        cardToSend.frames.forEach(f => {
            delete f.image;
            (f.masks || []).forEach(m => delete m.image);
        });

        const response = await fetch('/api/card-image/render', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                imageBase64,
                cardJson: cardToSend,
                fileName: getCardName(),
                format,
                cardSizeProfileName,
                isPrintImage
            })
        });

        if (!response.ok) {
            throw new Error('Server render returned HTTP ' + response.status);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const dl = document.createElement('a');
        dl.download = imageName;
        dl.href = url;
        document.body.appendChild(dl);
        dl.click();
        dl.remove();
        URL.revokeObjectURL(url);

    } catch (err) {
        // Graceful fallback: download directly from the canvas if the server is unreachable
        logError('Server-side render failed, using direct canvas download:', err);
        notify('Server render unavailable — downloading directly from canvas.', 3);
        const dataURL = jpeg
            ? cardCanvas.toDataURL('image/jpeg', JPEG_FALLBACK_QUALITY)
            : cardCanvas.toDataURL('image/png');
        const dl = document.createElement('a');
        dl.download = imageName;
        dl.href = dataURL;
        document.body.appendChild(dl);
        dl.click();
        dl.remove();
    } finally {
        suppressProfilePlacementOverlay = previousOverlaySuppression;
        drawCard();
    }
}

async function bulkDownloadZip() {
    // 1. Initial checks for libraries and saved cards.
    if (typeof JSZip === 'undefined') {
        notify('Required library (JSZip) has not loaded yet. Please wait a moment and try again.', 5);
        return;
    }
    const cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
    if (!cardKeys || cardKeys.length === 0) {
        notify('No saved cards found to download.', 3);
        return;
    }

    let fileHandle = null;
    let useStreaming = false;

    // 2. Trigger the file picker immediately to capture the user gesture.
    if (window.showSaveFilePicker) {
        try {
            notify('Please choose a location to save your ZIP file.', 15);
            fileHandle = await window.showSaveFilePicker({
                suggestedName: BULK_ZIP_FILENAME,
                types: [{
                    description: 'ZIP file',
                    accept: {'application/zip': ['.zip']},
                }],
            });
            useStreaming = true;
        } catch (err) {
            // This error occurs if the user clicks "Cancel" in the save dialog.
            if (err.name === 'AbortError') {
                notify('Save operation cancelled.', 3);
                return; // Exit the function entirely if the user cancels.
            }
            // If another error occurs, fall back to the in-memory method.
            logError("Could not get file handle, falling back to in-memory method:", err);
        }
    }

    // 3. Save the current state and prepare the zip object.
    notify(`Preparing to process ${cardKeys.length} cards...`, 10);
    const zip = new JSZip();
    const tempKey = '__temp_current_card_state__';
    const cardToSave = JSON.parse(JSON.stringify(card));
    cardToSave.frames.forEach(frame => {
        delete frame.image;
        frame.masks.forEach(mask => delete mask.image);
    });
    localStorage.setItem(tempKey, JSON.stringify(cardToSave));

    // 4. Loop through each saved card to render and add it to the zip object.
    for (const [index, key] of cardKeys.entries()) {
        try {
            notify(`Processing card ${index + 1} of ${cardKeys.length}: ${key}`, 1);

            ImageLoadTracker.start();
            FontLoadTracker.start();
            await loadCard(key);
            await drawText();

            const imagePromise = ImageLoadTracker.waitForAll();
            const fontPromise = FontLoadTracker.waitForAll();
            await Promise.all([imagePromise, fontPromise]);

            drawCard();

            const imageName = getCardName() + '.png';
            const imageData = cardCanvas.toDataURL('image/png').split(',')[1];

            zip.file(imageName, imageData, {base64: true});
            logDebug(`Zipped: ${imageName}`);

        } catch (error) {
            logError(`Failed to process and zip card "${key}":`, error);
            notify(`Skipping card "${key}" due to an error.`, 3);
        } finally {
            ImageLoadTracker.stop();
            FontLoadTracker.stop();
        }
    }

    // 5. Generate and save the ZIP file using the appropriate method.
    try {
        if (useStreaming && fileHandle) {
            // Ideal Path: Manually pump the JSZip stream to the WritableStream.
            notify('Saving ZIP file to disk...', 10);
            const writable = await fileHandle.createWritable();

            await new Promise((resolve, reject) => {
                const stream = zip.generateInternalStream({type: 'uint8array', streamFiles: true});

                stream
                    .on('data', (chunk) => {
                        writable.write(chunk).catch(reject);
                    })
                    .on('end', () => {
                        writable.close().then(resolve).catch(reject);
                    })
                    .on('error', (err) => {
                        reject(err);
                    })
                    .resume();
            });
            notify('ZIP file saved successfully!', 5);

        } else {
            // Fallback Path: For browsers without streaming support.
            notify('Streaming not supported. Building ZIP in memory... This may be slow or fail.', 10);
            const content = await zip.generateAsync({type: 'blob'});

            const downloadElement = document.createElement('a');
            downloadElement.href = URL.createObjectURL(content);
            downloadElement.download = BULK_ZIP_FILENAME;
            document.body.appendChild(downloadElement);
            downloadElement.click();
            document.body.removeChild(downloadElement);
        }
    } catch (err) {
        logError('Failed to generate or save ZIP file:', err);
        notify('An error occurred while saving the ZIP file.', 5);
    }

    // 6. Restore the user's original card state.
    await loadCard(tempKey);
    localStorage.removeItem(tempKey);
    logDebug('Bulk download process finished. User state restored.');
}

//IMPORT/SAVE TAB
function importCard(cardObject) {
    logDebug('Import card called. Card count:', Array.isArray(cardObject) ? cardObject.length : 0);
    scryfallCard = cardObject;
    const importIndex = document.querySelector('#import-index');
    importIndex.innerHTML = null;
    var optionIndex = 0;
    cardObject.forEach(card => {
        if (card.type_line && card.type_line != 'Card') {
            var option = document.createElement('option');
            var name = card.printed_name || card.name;
            if (card.flavor_name) {
                name += " (" + card.flavor_name + ")";
            } else if (card.printed_name) {
                name += " (" + card.name + ")";
            }
            var title = `${name} `;
            if (document.querySelector('#importAllPrints').checked) {
                title += `(${card.set.toUpperCase()} #${card.collector_number})`;
            } else {
                title += `(${card.type_line})`
            }
            option.innerHTML = title;
            option.value = optionIndex;
            importIndex.appendChild(option);
        }
        optionIndex++;
    });
    changeCardIndex();
}

async function pasteCardText() {
    try {
        const text = await navigator.clipboard.readText();
        logDebug('Clipboard text read for import. Length:', text ? text.length : 0);
        const card = scryfallCardFromText(text);
        importCard([card]);
    } catch (err) {
        logError('Failed to read clipboard text: ', err);
        notify('Clipboard access failed. Did you click the button?');
    }
}

function scryfallCardFromText(text) {
    var lines = text.trim().split("\n");

    if (lines.count == 0) {
        return {};
    }

    lines = lines.map(item => item.trim()).filter(item => item != "");

    var name = lines.shift();
    var manaCost;
    var manaCostStartIndex = name.indexOf("{");
    if (manaCostStartIndex > 0) {
        manaCost = name.substring(manaCostStartIndex).trim();
        name = name.substring(0, manaCostStartIndex).trim();
    }

    var cardObject = {
        "name": name,
        "lang": "en"
    };

    if (manaCost !== undefined) {
        cardObject.mana_cost = manaCost;
    }

    if (lines.count == 0) {
        return cardObject;
    }

    cardObject.type_line = lines.shift().trim();

    if (lines.count == 0) {
        return cardObject;
    }

    var regex = /[0-9+\-*]+\/[0-9+*]+/
    var match = lines[lines.length - 1].match(regex);
    if (match) {
        var pt = match[0].split("/");
        cardObject.power = pt[0];
        cardObject.toughness = pt[1];
        lines.pop();
    }

    if (lines.count == 0) {
        return cardObject;
    }

    cardObject.oracle_text = lines.join("\n");

    return cardObject;
}

function parseSagaAbilities(text) {
    const stepsMap = {};

    // Remove reminder text
    const abilityText = text.replace(/^\(.*?\)\s*/, '');

    // Match "I — ability" or "I, II — ability"
    const regex = /([IVX, ]+)\s+—\s+([^]+?)(?=(?:\n[IVX, ]+\s+—|$))/g;

    let match;
    while ((match = regex.exec(abilityText)) !== null) {
        const stepsRaw = match[1].split(',').map(s => s.trim());
        const ability = match[2].trim();

        for (const step of stepsRaw) {
            stepsMap[step] = ability;
        }
    }

    // Lore step order
    const loreOrder = Array.from({length: 24}, (_, i) => romanNumeral(i + 1));

    // Track deduplicated abilities in order with count of steps
    const abilityMap = new Map();

    for (const step of loreOrder) {
        const ability = stepsMap[step];
        if (!ability) continue;

        if (abilityMap.has(ability)) {
            abilityMap.get(ability).steps += 1;
        } else {
            abilityMap.set(ability, {ability, steps: 1});
        }
    }

    return Array.from(abilityMap.values());
}

function extractSagaReminderText(text) {
    const match = text.match(/^\([^)]*\)/);
    return match ? match[0] : null;
}

function parseClassAbilities(text) {
    const lines = text.split('\n'); // Split text into lines
    const abilities = [];
    let reminderText = '';
    let currentLevel = 1;

    // Check if the first line is reminder text
    if (lines[0].startsWith('(')) {
        reminderText = lines.shift(); // Extract reminder text
    }

    // Process each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check for "{cost}: Level X" format
        const levelMatch = line.match(/^(\{.*?}):\s*Level \d+/); // Match cost and level
        if (levelMatch) {
            const cost = `${levelMatch[1]}:`; // Extract cost (e.g., "{G}")
            const ability = lines[i + 1]?.trim() || ''; // Get the next line as ability text
            abilities.push({cost, ability});
            i++; // Skip the next line since it's already processed
            currentLevel++;
        } else if (abilities.length === 0) {
            // Handle the first level's ability text without "Level" heading
            abilities.push({cost: '', ability: line});
        }
    }

    // Prepend reminder text to the first ability if it exists
    if (reminderText && abilities.length > 0) {
        abilities[0].ability = `${reminderText}{lns}{bar}{lns}${abilities[0].ability}`;
    }

    return abilities;
}

function parseMultiFacedCards(card) {
    let [frontFace, backFace] = card.card_faces ?? []

    if (card.object === "card_face") {
        // Battle cards: find faces from scryfallCard array
        frontFace = card;
        backFace = scryfallCard.find(face =>
            face.object === "card_face" &&
            face.name !== card.name
        );
    }

    if (!frontFace || !backFace) {
        console.error('Could not find both faces for multi-faced card');
        return null;
    }

    // Single processing logic for both types
    const faces = {
        front: {
            name: frontFace.name || '',
            type: frontFace.type_line || '',
            rules: frontFace.oracle_text || '',
            mana: frontFace.mana_cost || '',
            pt: frontFace.power ? `${frontFace.power}/${frontFace.toughness}` : '',
            defense: frontFace.defense || '',
            flavor: frontFace.flavor_text || ''
        },
        back: {
            name: backFace.name || '',
            type: backFace.type_line || '',
            rules: backFace.oracle_text || '',
            mana: backFace.mana_cost || '',
            pt: backFace.power ? `${backFace.power}/${backFace.toughness}` : '',
            defense: backFace.defense || '',
            flavor: backFace.flavor_text || ''
        }
    };

    return faces;
}

function parseLevelerCard(card) {
    if (card.layout !== 'leveler' || !card.oracle_text) {
        console.error('Not a valid leveler card');
        return null;
    }

    const oracleText = card.oracle_text;

    // Parse the oracle text sections
    const sections = oracleText.split('\n');

    // Find level up cost (first line)
    const levelUpMatch = sections[0].match(/Level up (.+?) \((.+?)\)/);
    const levelUpCost = levelUpMatch ? levelUpMatch[1] : '';
    const levelUpReminder = levelUpMatch ? levelUpMatch[2] : '';

    // Find level ranges and their content
    const levelSections = [];
    let currentSection = null;

    for (let i = 1; i < sections.length; i++) {
        const line = sections[i];

        // Check if this line defines a level range
        const levelMatch = line.match(/^LEVEL (.+)$/);
        if (levelMatch) {
            if (currentSection) {
                levelSections.push(currentSection);
            }
            currentSection = {
                levelRange: levelMatch[1],
                content: []
            };
        } else if (currentSection && line.trim()) {
            currentSection.content.push(line);
        }
    }

    // Add the last section if it exists
    if (currentSection) {
        levelSections.push(currentSection);
    }

    // Extract data for each level
    const parsedData = {
        layout: 'leveler', // Add this line for consistency
        name: card.name || '',
        type: card.type_line || '',
        mana: card.mana_cost || '',
        basePT: card.power && card.toughness ? `${card.power}/${card.toughness}` : '',
        levelUpCost: levelUpCost,
        levelUpText: `Level up ${levelUpCost} {i}(${levelUpReminder}){/i}`,
        levels: []
    };

    // Process each level section
    levelSections.forEach(section => {
        const levelData = {
            range: section.levelRange,
            pt: '',
            abilities: []
        };

        // Look for P/T in the content (usually looks like "2/3")
        const ptMatch = section.content.find(line => /^\d+\/\d+$/.test(line.trim()));
        if (ptMatch) {
            levelData.pt = ptMatch.trim();
            // Remove P/T from abilities
            levelData.abilities = section.content.filter(line => line.trim() !== ptMatch.trim());
        } else {
            levelData.abilities = section.content;
        }

        // Join abilities into a single text block
        levelData.rulesText = levelData.abilities.join('\n');

        parsedData.levels.push(levelData);
    });

    return parsedData;
}

function parsePrototypeLayout(card) {
    if (card.layout !== 'prototype' || !card.oracle_text) {
        console.error('Not a valid prototype card');
        return null;
    }

    const oracleText = card.oracle_text;

    // Match the entire prototype line: "Prototype {1}{U}{U} — 2/1 (reminder text)"
    const prototypeMatch = oracleText.match(/^Prototype (.+?) — (\d+)\/(\d+) \((.+?)\)/);

    if (!prototypeMatch) {
        console.error('Could not parse prototype information');
        return null;
    }

    const prototypeCost = prototypeMatch[1];
    const prototypePower = prototypeMatch[2];
    const prototypeToughness = prototypeMatch[3];
    const prototypeReminder = prototypeMatch[4];

    // Split by newlines and remove the first line (which contains the prototype)
    const lines = oracleText.split('\n');
    const mainRules = lines.slice(1).join('\n').trim();

    return {
        layout: 'prototype',
        name: card.name || '',
        type: card.type_line || '',
        mana: card.mana_cost || '',
        basePT: card.power && card.toughness ? `${card.power}/${card.toughness}` : '',
        rules: mainRules,
        prototype: {
            cost: prototypeCost,
            pt: `${prototypePower}/${prototypeToughness}`,
            reminderText: `Prototype ${prototypeCost} — ${prototypePower}/${prototypeToughness} {i}(${prototypeReminder}){/i}`
        }
    };
}

function parseMutateLayout(card) {
    if (card.layout !== 'mutate' || !card.oracle_text) {
        console.error('Not a valid mutate card');
        return null;
    }

    const oracleText = card.oracle_text;

    // Match the mutate line: "Mutate {3}{B} (reminder text)"
    const mutateMatch = oracleText.match(/^Mutate (.+?) \((.+?)\)/);

    if (!mutateMatch) {
        console.error('Could not parse mutate information');
        return null;
    }

    const mutateCost = mutateMatch[1];
    const mutateReminder = mutateMatch[2];

    // Split by newlines and remove the first line (which contains the mutate)
    const lines = oracleText.split('\n');
    const mainRules = lines.slice(1).join('\n').trim();

    return {
        layout: 'mutate',
        name: card.name || '',
        type: card.type_line || '',
        mana: card.mana_cost || '',
        basePT: card.power && card.toughness ? `${card.power}/${card.toughness}` : '',
        rules: mainRules,
        mutate: {
            cost: mutateCost,
            reminderText: `Mutate ${mutateCost} {i}(${mutateReminder}){/i}`
        }
    };
}

function parseVanguardLayout(card) {
    if (card.layout !== 'vanguard' || !card.oracle_text) {
        console.error('Not a valid vanguard card');
        return null;
    }

    return {
        layout: 'vanguard',
        name: card.name || '',
        type: card.type_line || '',
        rules: card.oracle_text || '',
        flavor: card.flavor_text || '',
        handModifier: card.hand_modifier || '',
        lifeModifier: card.life_modifier || ''
    };
}

function parseRollAbilities(text) {
    // Check if this is a roll card
    if (!text.toLowerCase().includes('roll a d20')) {
        return null;
    }

    let modifiedText = text;
    const lines = text.split('\n');

    // Skip the first line ("Roll a d20.")
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();

        // Match patterns like "1—9 | ability" or "20 | ability"
        const rollMatch = line.match(/^(\d+(?:—\d+)?)\s*\|\s*(.+)$/);
        if (rollMatch) {
            const range = rollMatch[1];
            const ability = rollMatch[2];

            // Replace the line with the roll tag format
            const newLine = `{roll${range}} ${ability}`;
            modifiedText = modifiedText.replace(line, newLine);
        }
    }

    return modifiedText;
}

function parseStationCard(oracleText) {
    if (!oracleText || !oracleText.includes('Station')) {
        return null;
    }

    // Split the oracle text by STATION markers to get the pre-station text
    const parts = oracleText.split(/STATION \d+\+/);

    // The first part is the pre-station text (before any STATION abilities)
    let preStationText = parts[0].trim();

    // Format station reminder text with italics
    preStationText = preStationText.replace(/Station (\([^)]+\))/g, 'Station {i}$1{/i}');

    // Updated regex to match new scryfall format: "10+ | ability text"
    const stationRegex = /(\d+\+)\s*\|\s*([^\n]+)/g;
    const stationAbilities = [];

    let match;
    while ((match = stationRegex.exec(oracleText)) !== null) {
        stationAbilities.push({
            number: match[1], // e.g., "1+", "8+"
            text: match[2].trim()
        });
    }

    return {
        preStationText: preStationText,
        stationAbilities: stationAbilities
    };
}

function changeCardIndex() {
    let cardToImport = scryfallCard[document.querySelector('#import-index').value];
    // Add debug logging for card Layout detection
    logDebug('Card layout:', cardToImport.layout);
    logDebug('Card version:', card.version);

    if (cardToImport.set == "plst") {
        var components = cardToImport.collector_number.split('-');
        cardToImport.set = components[0];
        cardToImport.collector_number = components[1];
    }
    // Clear all existing text fields to prevent old data from persisting BUT preserve Multi Face reminder text if we're using a Multi Face frame
    var savedFuseReminderText = '';
    var savedDescriptiveTexts = {};
    if (card.text && card.text.reminder && (card.version === 'fuse' || card.version === 'room')) {
        savedFuseReminderText = card.text.reminder.text;
    }
    // Save descriptive texts for vanguard
    if (card.text) {
        // Save static descriptive texts that shouldn't be overwritten
        const descriptiveFields = ['left', 'right'];
        descriptiveFields.forEach(field => {
            if (card.text[field] && card.text[field].text) {
                savedDescriptiveTexts[field] = card.text[field].text;
            }
        });

        // Clear all text fields
        Object.keys(card.text).forEach(key => {
            card.text[key].text = '';
        });

        // Restore descriptive texts
        Object.keys(savedDescriptiveTexts).forEach(field => {
            if (card.text[field]) {
                card.text[field].text = savedDescriptiveTexts[field];
            }
        });
    }

    // Update reminder text from imported card if available
    var importedReminderText = '';
    if (cardToImport.oracle_text) {
        // Extract reminder text from oracle text (text in parentheses)
        var reminderMatch = cardToImport.oracle_text.match(/\([^)]+\)/);
        if (reminderMatch) {
            importedReminderText = reminderMatch[0];
        }
    }

    // Restore reminder text: use imported if available, otherwise use saved
    if (card.text && card.text.reminder && (card.version === 'fuse' || card.version === 'room')) {
        card.text.reminder.text = importedReminderText || savedFuseReminderText;
    }

    //text
    var langFontCode = "";
    if (cardToImport.lang == "ph") {
        langFontCode = "{fontphyrexian}"
    }
    // Handle Multi Faced Card Layouts
    const multiFacedVersions = ['flip', 'split', 'fuse', 'aftermath', 'adventure', 'omen', 'room', 'battle', 'transform', 'modal'];
    const isMultiFacedVersion = multiFacedVersions.some(keyword => card.version.toLowerCase().includes(keyword));
    if (['flip', 'modal_dfc', 'transform', 'split', 'adventure'].includes(cardToImport.layout) && isMultiFacedVersion) {
        const flipData = parseMultiFacedCards(cardToImport);
        if (!flipData) {
            console.error('Failed to parse Multi Faced card data');
            return;
        }

        // Add artist info
        if (cardToImport.artist) {
            artistEdited(cardToImport.artist);
        }

        // Handle art loading 
        if (cardToImport.image_uris?.art_crop) {
            uploadArt(cardToImport.image_uris.art_crop, 'autoFit');
        }

        // Handle set symbol
        if (!document.querySelector('#lockSetSymbolCode').checked) {
            document.querySelector('#set-symbol-code').value = cardToImport.set;
            document.querySelector('#set-symbol-rarity').value = cardToImport.rarity.slice(0, 1);
            if (!document.querySelector('#lockSetSymbolURL').checked) {
                fetchSetSymbol();
            }
        }

        // Multi Faced card handling
        // Update text fields based on card version
        //Front Face (standard handling for all multi-faced cards)
        if (card.text?.title && card.text?.mana) {
            card.text.title.text = langFontCode + flipData.front.name;
            card.text.type.text = langFontCode + flipData.front.type;
            card.text.rules.text = langFontCode + flipData.front.rules;
            if (flipData.front.flavor) {
                card.text.rules.text += '{flavor}' + curlyQuotes(flipData.front.flavor.replace('\n', '{lns}'));
            }
            card.text.mana.text = flipData.front.mana || '';

            // Handle PT vs Defense based on card version
            if (card.version === 'battle') {
                // For battles, only the defense field is unique
                if (card.text.defense) {
                    card.text.defense.text = flipData.front.defense || '';
                }
            } else {
                // For other multi-faced cards, use standard PT
                if (card.text.pt) {
                    card.text.pt.text = flipData.front.pt || '';
                }
            }
        }

        // Handle MDFC cards separately (they use flipsideType and flipSideReminder)
        if (cardToImport.layout === 'modal_dfc' && card.text?.flipsideType && card.text?.flipSideReminder) {
            card.text.flipsideType.text = langFontCode + flipData.back.type;
            card.text.flipSideReminder.text = langFontCode + flipData.back.rules;
        }
        //Back Face (standard handling for other multi-faced cards)
        else if (card.text?.title2 && card.text?.mana2) {
            card.text.title2.text = langFontCode + flipData.back.name;
            // Skip importing back type for room cards AND battle cards
            if (!cardToImport.type_line?.toLowerCase().includes('room')) {
                card.text.type2.text = langFontCode + flipData.back.type;
            }
            card.text.rules2.text = langFontCode + flipData.back.rules;
            if (flipData.back.flavor) {
                card.text.rules2.text += '{flavor}' + curlyQuotes(flipData.back.flavor.replace('\n', '{lns}'));
            }
            card.text.mana2.text = flipData.back.mana || '';
            if (card.text.pt2) {
                card.text.pt2.text = flipData.back.pt || '';
            }
        }

        // Handle pt2 for battle and transform front faces (cards without title2/mana2)
        if ((card.version === 'battle' || card.version.includes('transform') || card.version.includes('Transform')) && card.text?.pt2) {
            card.text.pt2.text = flipData.back.pt || '';
        }

        if ((card.version.includes('transform') || card.version.includes('Transform')) && card.text?.reminder && flipData.back.pt) {
            card.text.reminder.text = flipData.back.pt;
        }

        textEdited();
    }

    // Handle Unique Layouts (Leveler, Prototype, Mutate, and Vanguard)
    else if (['leveler', 'prototype', 'mutate', 'vanguard'].includes(cardToImport.layout) && ['leveler', 'prototype', 'mutate', 'vanguard'].includes(card.version)) {
        let uniqueData;

        if (cardToImport.layout === 'leveler') {
            uniqueData = parseLevelerCard(cardToImport);
        } else if (cardToImport.layout === 'prototype') {
            uniqueData = parsePrototypeLayout(cardToImport);
        } else if (cardToImport.layout === 'mutate') {
            uniqueData = parseMutateLayout(cardToImport);
        } else if (cardToImport.layout === 'vanguard') {
            uniqueData = parseVanguardLayout(cardToImport);
        }

        // Add artist info
        if (cardToImport.artist) {
            artistEdited(cardToImport.artist);
        }

        // Handle art loading 
        if (cardToImport.image_uris?.art_crop) {
            uploadArt(cardToImport.image_uris.art_crop, 'autoFit');
        }

        // Handle set symbol
        if (!document.querySelector('#lockSetSymbolCode').checked) {
            document.querySelector('#set-symbol-code').value = cardToImport.set;
            document.querySelector('#set-symbol-rarity').value = cardToImport.rarity.slice(0, 1);
            if (!document.querySelector('#lockSetSymbolURL').checked) {
                fetchSetSymbol();
            }
        }

        // Populate text fields based on layout
        if (card.text?.title) {
            card.text.title.text = langFontCode + uniqueData.name;
            card.text.type.text = langFontCode + uniqueData.type;
            card.text.mana.text = uniqueData.mana;

            // Base P/T
            if (card.text.pt) {
                card.text.pt.text = uniqueData.basePT;
            }

            if (uniqueData.layout === 'leveler') {
                card.text.levelup.text = langFontCode + uniqueData.levelUpText;

                // Level 1-2 data
                if (uniqueData.levels[0]) {
                    const level1Data = uniqueData.levels[0];
                    if (card.text.level2) {
                        card.text.level2.text = `LEVEL\n{fontsize${scaleHeight(0.0162)}}${level1Data.range}`;
                    }
                    if (card.text.rules2) {
                        card.text.rules2.text = langFontCode + level1Data.rulesText;
                    }
                    if (card.text.pt2) {
                        card.text.pt2.text = level1Data.pt;
                    }
                }

                // Level 3+ data
                if (uniqueData.levels[1]) {
                    const level2Data = uniqueData.levels[1];
                    if (card.text.level3) {
                        card.text.level3.text = `LEVEL\n{fontsize${scaleHeight(0.0162)}}${level2Data.range}`;
                    }
                    if (card.text.rules3) {
                        card.text.rules3.text = langFontCode + level2Data.rulesText;
                    }
                    if (card.text.pt3) {
                        card.text.pt3.text = level2Data.pt;
                    }
                }
            } else if (uniqueData.layout === 'prototype') {
                if (card.text.rules2) {
                    card.text.rules2.text = langFontCode + uniqueData.rules;
                }
                if (card.text.prototype) {
                    card.text.prototype.text = langFontCode + uniqueData.prototype.reminderText;
                }
                if (card.text.mana2) {
                    card.text.mana2.text = uniqueData.prototype.cost;
                }
                if (card.text.pt2) {
                    card.text.pt2.text = uniqueData.prototype.pt;
                }
            } else if (uniqueData.layout === 'mutate') {
                if (card.text.rules2) {
                    card.text.rules2.text = langFontCode + uniqueData.rules;
                }
                if (card.text.mutate) {
                    card.text.mutate.text = langFontCode + uniqueData.mutate.reminderText;
                }
            } else if (uniqueData.layout === 'vanguard') {
                if (card.text.ability) {
                    card.text.ability.text = langFontCode + uniqueData.rules;
                }
                if (card.text.flavor) {
                    card.text.flavor.text = langFontCode + uniqueData.flavor;
                }
                if (card.text.leftval) {
                    card.text.leftval.text = uniqueData.handModifier;
                }
                if (card.text.rightval) {
                    card.text.rightval.text = uniqueData.lifeModifier;
                }
            }
        }

        textEdited();
    } else if (cardToImport.oracle_text && cardToImport.oracle_text.includes('Station') && card.version.includes('station')) {

        // Clear existing station fields
        if (card.text) {
            ['ability0', 'ability1', 'ability2'].forEach(field => {
                if (card.text[field]) card.text[field].text = '';
            });
        }

        // Clear station badge values immediately
        if (card.station?.badgeValues) {
            card.station.badgeValues[1] = '';
            card.station.badgeValues[2] = '';
        }

        const stationData = parseStationCard(cardToImport.oracle_text);
        const name = (cardToImport.printed_name || cardToImport.name || '').replace(/^A-/, '{alchemy}');

        // Populate basic text fields
        const basicFields = [
            ['title', curlyQuotes(name)],
            ['type', cardToImport.type_line],
            ['mana', cardToImport.mana_cost || ''],
            ['pt', cardToImport.power && cardToImport.toughness ? `${cardToImport.power}/${cardToImport.toughness}` : '']
        ];

        basicFields.forEach(([field, value]) => {
            if (card.text?.[field]) card.text[field].text = langFontCode + value;
        });

        // Station ability placement logic
        if (stationData) {
            // Better regex to separate pre-text from Station reminder text
            let preText = '';
            let reminderText = '';

            if (stationData.preStationText) {
                // Look for Station reminder text (either already italicized or not)
                const stationReminderMatch = stationData.preStationText.match(/(.*?)(Station \{i}\([^)]+\)\{\/i}|Station \([^)]+\))/s);

                if (stationReminderMatch) {
                    preText = stationReminderMatch[1].trim();

                    // Format the reminder text with italics if not already done
                    if (stationReminderMatch[2].includes('{i}')) {
                        reminderText = stationReminderMatch[2];
                    } else {
                        reminderText = stationReminderMatch[2].replace(/Station (\([^)]+\))/, 'Station {i}$1{/i}');
                    }
                } else {
                    // If no Station reminder found, treat entire text as pre-text
                    preText = stationData.preStationText.trim();
                }
            }

            const numAbilities = stationData.stationAbilities.length;

            // AUTO-CHECK DISABLE FIRST SQUARE FOR SINGLE ABILITIES
            const shouldDisableFirstSquare = numAbilities === 1;

            // Define placement scenarios as configuration
            const scenarios = {
                // [hasPreText, numAbilities]: [ability0, ability1, ability2, badgeSlots]
                [false + ',' + 1]: ['', reminderText, stationData.stationAbilities[0]?.text, [null, stationData.stationAbilities[0]?.number]],
                [true + ',' + 1]: [preText, reminderText, stationData.stationAbilities[0]?.text, [null, stationData.stationAbilities[0]?.number]],
                [false + ',' + 2]: [reminderText, stationData.stationAbilities[0]?.text, stationData.stationAbilities[1]?.text, [stationData.stationAbilities[0]?.number, stationData.stationAbilities[1]?.number]],
                [true + ',' + 2]: [preText + (reminderText ? '\n' + reminderText : ''), stationData.stationAbilities[0]?.text, stationData.stationAbilities[1]?.text, [stationData.stationAbilities[0]?.number, stationData.stationAbilities[1]?.number]]
            };

            const scenario = scenarios[Boolean(preText) + ',' + numAbilities];
            if (scenario) {
                const [ability0, ability1, ability2, badges] = scenario;

                // Set abilities
                [ability0, ability1, ability2].forEach((text, i) => {
                    if (text && card.text[`ability${i}`]) {
                        card.text[`ability${i}`].text = langFontCode + text;
                    }
                });

                // Set disable first square checkbox and station setting
                setTimeout(() => {
                    const disableCheckbox = document.querySelector('#station-disable-first-ability');
                    if (disableCheckbox) {
                        disableCheckbox.checked = shouldDisableFirstSquare;
                    }
                    if (card.station) {
                        card.station.disableFirstAbility = shouldDisableFirstSquare;
                    }

                    // SET STATION-SPECIFIC UI VALUES FOR SINGLE ABILITY IMPORTS
                    if (shouldDisableFirstSquare && !Boolean(preText) && card.station?.importSettings?.singleAbility) {
                        // Get version-specific settings or fall back to default
                        const versionOverrides = card.station.importSettings.versionOverrides || {};
                        const versionSettings = versionOverrides[card.version] || card.station.importSettings.singleAbility;

                        // Set Y offset
                        const yOffsetInput = document.querySelector('#station-square-y');
                        if (yOffsetInput) {
                            yOffsetInput.value = versionSettings.yOffset;
                            if (card.station.squares && card.station.squares[1]) {
                                card.station.squares[1].y = versionSettings.yOffset + 76;
                            }
                        }

                        // Set first square height
                        const height1Input = document.querySelector('#station-square-height-1');
                        if (height1Input) {
                            height1Input.value = versionSettings.height1;
                            if (card.station.squares && card.station.squares[1]) {
                                card.station.squares[1].height = versionSettings.height1;
                            }
                        }
                    }


                    // Clear DOM inputs first
                    ['#station-badge-value-1', '#station-badge-value-2'].forEach(selector => {
                        const input = document.querySelector(selector);
                        if (input) input.value = '';
                    });

                    // Set new badge values
                    badges.forEach((badge, i) => {
                        if (badge) {
                            const input = document.querySelector(`#station-badge-value-${i + 1}`);
                            if (input) input.value = badge;
                            if (card.station?.badgeValues) card.station.badgeValues[i + 1] = badge;
                        }
                    });

                    // Force station redraw after all values are set
                    setTimeout(() => {
                        if (typeof stationEdited === 'function') {
                            stationEdited();
                        }
                    }, DEBOUNCE_STATION_REDRAW_MS);
                }, DEBOUNCE_STATION_IMPORT_MS);
            }
        }

        textEdited();
    }

    var name = cardToImport.printed_name || cardToImport.name || '';
    if (name.startsWith('A-')) {
        name = name.replace('A-', '{alchemy}');
    }

    if (card.text.title) {
        if (card.version == 'wanted') {
            var subtitle = '';
            var index = name.indexOf(', ');

            if (index > 0) {
                card.text.subtitle.text = langFontCode + curlyQuotes(name.substring(index + 2));
                card.text.title.text = langFontCode + curlyQuotes(name.substring(0, index + 1));
            } else {
                card.text.title.text = langFontCode + curlyQuotes(name);
                card.text.subtitle.text = '';
            }
        } else {
            card.text.title.text = langFontCode + curlyQuotes(name);
        }
    }

    if (card.text.nickname) {
        card.text.nickname.text = cardToImport.flavor_name || '';
    }
    if (card.text.mana) {
        card.text.mana.text = cardToImport.mana_cost || '';
    }
    if (card.text.type) {
        card.text.type.text = langFontCode + cardToImport.type_line || '';
    }

    // ITALIC_EXEMPTIONS → creator-23.constants.js
    const italicExemptions = ITALIC_EXEMPTIONS;
    if (cardToImport.oracle_text) {
        const hasRoll = cardToImport.oracle_text.toLowerCase().includes('roll a d20');
        const hasNumberedAbilities = /\d+(?:—\d+)?\s*\|\s*.+/.test(cardToImport.oracle_text);
        const rollText = parseRollAbilities(cardToImport.oracle_text);
        if (rollText) {
            // Use the modified text with roll tags for further processing
            var rulesText = rollText.replace(/(?:\((?:.*?)\)|[^"\n]+(?= — ))/g, function (a) {
                if (italicExemptions.includes(a) || (cardToImport.keywords && cardToImport.keywords.indexOf('Spree') != -1 && a.startsWith('+'))) {
                    return a;
                }
                return '{i}' + a + '{/i}';
            });
        } else {
            // Regular processing for non-roll cards
            var rulesText = (cardToImport.oracle_text || '').replace(/(?:\((?:.*?)\)|[^"\n]+(?= — ))/g, function (a) {
                if (italicExemptions.includes(a) || (cardToImport.keywords && cardToImport.keywords.indexOf('Spree') != -1 && a.startsWith('+'))) {
                    return a;
                }
                return '{i}' + a + '{/i}';
            });
        }
        // Handle loyalty ability brackets - separate from roll handling, applies to ALL cards
        const isCleaveSpell = rulesText.toLowerCase().includes('cleave') ||
            (cardToImport.keywords && cardToImport.keywords.includes('Cleave'));

        if (!isCleaveSpell) {
            // Replace loyalty ability brackets [+1], [-2], etc. with curly brackets
            // Also convert em dash (−) to regular hyphen (-)
            rulesText = rulesText.replace(/\[([+\-−]\d+)]/g, function (match, number) {
                return '{' + number.replace('\u2212', '-') + '}';
            });
        }
    } else {
        var rulesText = '';
    }
    rulesText = curlyQuotes(rulesText).replace(/{Q}/g, '{untap}').replace(/{\u221E}/g, "{inf}").replace(/• /g, '• {indent}');
    rulesText = rulesText.replace('(If this card is your chosen companion, you may put it into your hand from outside the game for {3} any time you could cast a sorcery.)', '(If this card is your chosen companion, you may put it into your hand from outside the game for {3} as a sorcery.)')

    if (card.text.rules) {
        if (card.version == 'pokemon') {
            if (cardToImport.type_line.toLowerCase().includes('creature')) {
                card.text.rules.text = langFontCode + rulesText;
                card.text.rulesnoncreature.text = '';

                card.text.middleStatTitle.text = 'power';
                card.text.rightStatTitle.text = 'toughness';

            } else if (cardToImport.type_line.toLowerCase().includes('planeswalker')) {
                card.text.rules.text = langFontCode + rulesText;
                card.text.rulesnoncreature.text = '';

                card.text.pt.text = '{' + (cardToImport.loyalty || '' + '}');

                card.text.middleStatTitle.text = '';
                card.text.rightStatTitle.text = 'loyalty';
            } else if (cardToImport.type_line.toLowerCase().includes('battle')) {
                card.text.rules.text = langFontCode + rulesText;
                card.text.rulesnoncreature.text = '';

                card.text.pt.text = '{' + (cardToImport.defense || '' + '}');

                card.text.middleStatTitle.text = '';
                card.text.rightStatTitle.text = 'defense';
            } else {
                card.text.rulesnoncreature.text = langFontCode + rulesText;
                card.text.rules.text = '';

                card.text.middleStatTitle.text = '';
                card.text.rightStatTitle.text = '';
            }

        } else {
            card.text.rules.text = langFontCode + rulesText;
        }

        if (cardToImport.flavor_text) {
            var flavorText = cardToImport.flavor_text;
            var flavorTextCounter = 1;
            while (flavorText.includes('*') || flavorText.includes('"')) {
                if (flavorTextCounter % 2) {
                    flavorText = flavorText.replace('*', '{/i}');
                    flavorText = flavorText.replace('"', '\u201c');
                } else {
                    flavorText = flavorText.replace('*', '{i}');
                    flavorText = flavorText.replace('"', '\u201d');
                }
                flavorTextCounter++;
            }

            if (card.version == 'pokemon') {
                if (cardToImport.type_line.toLowerCase().includes('creature')) {
                    card.text.rules.text += '{flavor}';
                    card.text.rules.text += curlyQuotes(flavorText.replace('\n', '{lns}'));
                } else {
                    card.text.rules.text += '{flavor}';
                    card.text.rulesnoncreature.text += curlyQuotes(flavorText.replace('\n', '{lns}'));
                }

            } else {
                card.text.rules.text += '{flavor}';
                card.text.rules.text += curlyQuotes(flavorText.replace('\n', '{lns}'));
            }


        }
    } else if (card.text.case) {
        rulesText = rulesText.replace(/(\r\n|\r|\n)/g, '//{bar}//');
        card.text.case.text = langFontCode + rulesText;
    }

    if (card.text.pt) {
        if (card.version == 'invocation') {
            card.text.pt.text = cardToImport.power + '\n' + cardToImport.toughness || '';
        } else if (card.version == 'pokemon') {
            card.text.middleStat.text = '{' + (cardToImport.power || '') + '}';
            card.text.pt.text = '{' + (cardToImport.toughness || '') + '}';

            if (card.text.middleStat && card.text.middleStat.text == '{}') {
                card.text.middleStat.text = '';
            }
        } else {
            card.text.pt.text = cardToImport.power + '/' + cardToImport.toughness || '';
        }
    }
    if (card.text.pt && card.text.pt.text == undefined + '/' + undefined) {
        card.text.pt.text = '';
    }
    if (card.text.pt && card.text.pt.text == undefined + '\n' + undefined) {
        card.text.pt.text = '';
    }
    if (card.text.pt && card.text.pt.text == '{}') {
        card.text.pt.text = '';
    }
    if (card.version.includes('planeswalker')) {
        card.text.loyalty.text = cardToImport.loyalty || '';
        var planeswalkerAbilities = cardToImport.oracle_text.split('\n');
        // Replace loyalty ability brackets [+1], [-2], etc. with curly brackets for each ability
        planeswalkerAbilities = planeswalkerAbilities.map(ability => {
            return ability.replace(/\[([+\-−]\d+)]/g, function (match, number) {
                return '{' + number.replace('\u2212', '-') + '}';
            });
        });
        while (planeswalkerAbilities.length > 4) {
            var newAbility = planeswalkerAbilities[planeswalkerAbilities.length - 2] + '\n' + planeswalkerAbilities.pop();
            planeswalkerAbilities[planeswalkerAbilities.length - 1] = newAbility;
        }
        for (var i = 0; i < 4; i++) {
            if (planeswalkerAbilities[i]) {
                var planeswalkerAbility = planeswalkerAbilities[i].replace(': ', 'splitstring').split('splitstring');
                if (!planeswalkerAbility[1]) {
                    planeswalkerAbility = ['', planeswalkerAbility[0]];
                }
                card.text['ability' + i].text = planeswalkerAbility[1].replace('(', '{i}(').replace(')', '){/i}');
                if (card.version == 'planeswalkerTall' || card.version == 'planeswalkerCompleated') {
                    document.querySelector('#planeswalker-height-' + i).value = Math.round(scaleHeight(0.3572) / planeswalkerAbilities.length);
                } else {
                    document.querySelector('#planeswalker-height-' + i).value = Math.round(scaleHeight(0.2915) / planeswalkerAbilities.length);
                }
                document.querySelector('#planeswalker-cost-' + i).value = planeswalkerAbility[0].replace('\u2212', '-');
            } else {
                card.text['ability' + i].text = '';
                document.querySelector('#planeswalker-height-' + i).value = 0;
            }
        }
        planeswalkerEdited();
    } else if (card.version.includes('saga')) {
        if (card.text.rules2) {
            const combinedText = [cardToImport.flavor_text, ...(cardToImport.keywords || [])]
                .filter(Boolean)
                .join('\n');
            card.text.rules2.text = combinedText;
        }
        const abilities = parseSagaAbilities(cardToImport.oracle_text);
        for (let i = 0; i < abilities.length; i++) {
            card.text[`ability${i}`].text = abilities[i].ability.replace('(', '{i}(').replace(')', '){/i}');
        }
        card.text.reminder.text = `{i}${extractSagaReminderText(cardToImport.oracle_text)}{/i}`;
        card.saga = {...card.saga, abilities: abilities.map(a => a.steps).concat(Array.from({length: 4 - abilities.length}, () => 0)), count: abilities.length};
        updateAbilityHeights()
    } else if (card.version.toLowerCase().includes('class') && !card.version.includes('classicshifted') && typeof classCanvas !== "undefined") {
        if (card.text.flavor) {
            // future support classes with flavor text
            card.text.flavor.text = cardToImport.flavor_text || '';
        }
        const abilities = parseClassAbilities(cardToImport.oracle_text);
        for (let i = 0; i < abilities.length; i++) {
            const {cost, ability} = abilities[i];
            if (cost) {
                card.text[`level${i}a`].text = abilities[i].cost.replace('\u2212', '-');
            }
            if (i !== 0) {
                card.text[`level${i}b`].text = `Level ${i + 1}`;
            }
            card.text[`level${i}c`].text = ability.replace('(', '{i}(').replace(')', '){/i}');
        }
        card.class = {...card.class, abilities: abilities.map(a => a.cost).concat(Array.from({length: 4 - abilities.length}, () => '')), count: abilities.length};
    } else if (card.version.includes('battle')) {
        card.text.defense.text = cardToImport.defense || '';
    }
    document.querySelector('#text-editor').value = card.text[Object.keys(card.text)[selectedTextIndex]].text;
    document.querySelector('#text-editor-font-size').value = 0;
    //font size
    Object.keys(card.text).forEach(key => {
        card.text[key].fontSize = 0;
    });
    textEdited();
    //collector's info
    if (localStorage.getItem('enableImportCollectorInfo') == 'true') {
        document.querySelector('#info-number').value = cardToImport.collector_number || "";
        document.querySelector('#info-rarity').value = (cardToImport.rarity || "")[0].toUpperCase();
        document.querySelector('#info-set').value = (cardToImport.set || "").toUpperCase();
        document.querySelector('#info-language').value = (cardToImport.lang || "").toUpperCase();
        var setXhttp = new XMLHttpRequest();
        setXhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                var setObject = JSON.parse(this.responseText)
                if (document.querySelector('#enableNewCollectorStyle').checked) {
                    var number = document.querySelector('#info-number').value;

                    while (number.length < 4) {
                        number = '0' + number;
                    }

                    document.querySelector('#info-number').value = number;

                    bottomInfoEdited();
                } else if (setObject.printed_size) {
                    var number = document.querySelector('#info-number').value;

                    while (number.length < 3) {
                        number = '0' + number;
                    }

                    var printedSize = setObject.printed_size;
                    while (printedSize.length < 3) {
                        printedSize = '0' + printedSize;
                    }

                    if (parseInt(number) <= parseInt(printedSize)) {
                        document.querySelector('#info-number').value = number + "/" + printedSize;
                    } else {
                        document.querySelector('#info-number').value = number;
                    }


                    bottomInfoEdited();
                }
            }
        }
        setXhttp.open('GET', "https://api.scryfall.com/sets/" + cardToImport.set, true);
        try {
            setXhttp.send();
        } catch {
            console.log('Scryfall API search failed.')
        }
    }
    //art
    document.querySelector('#art-name').value = cardToImport.name;
    fetchScryfallData(cardToImport.name, artFromScryfall, 'art');
    if (document.querySelector('#importAllPrints').checked) {
        document.querySelector('#art-index').value = document.querySelector('#import-index').value;
        changeArtIndex();
    }
    //set symbol
    if (!document.querySelector('#lockSetSymbolCode').checked) {
        document.querySelector('#set-symbol-code').value = cardToImport.set;
    }
    document.querySelector('#set-symbol-rarity').value = cardToImport.rarity.slice(0, 1);
    if (!document.querySelector('#lockSetSymbolURL').checked) {
        fetchSetSymbol();
    }
}

var _serverSavedCards = [];

function getLocalCardKeys() {
    var cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
    if (!Array.isArray(cardKeys)) {
        cardKeys = [];
        localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
    }
    return cardKeys;
}

function populateSavedCardSelect(selector, items, placeholder, getValue = item => item, getLabel = item => item, selectedValue = '') {
    var select = document.querySelector(selector);
    if (!select) {
        return;
    }
    select.innerHTML = null;
    var placeholderOption = document.createElement('option');
    placeholderOption.selected = true;
    placeholderOption.disabled = true;
    placeholderOption.innerHTML = items.length === 0 ? placeholder : 'None selected';
    select.appendChild(placeholderOption);
    items.forEach(item => {
        var option = document.createElement('option');
        option.value = getValue(item);
        option.innerHTML = getLabel(item);
        select.appendChild(option);
    });
    if (selectedValue && items.some(item => getValue(item) == selectedValue)) {
        select.value = selectedValue;
    }
}

function loadAvailableCards(cardKeys = getLocalCardKeys()) {
    cardKeys = Array.isArray(cardKeys) ? cardKeys.slice().sort() : [];
    localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
    populateSavedCardSelect('#load-card-options', cardKeys, 'No local cards saved');
    refreshValidationTabIfVisible();
}

var CARD_SIZE_VALIDATION_TOLERANCE_PX = 2;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function ensureCardSizeProfilesAvailable() {
    if (Object.keys(cardSizeProfilesByName).length > 0) {
        return true;
    }

    await loadCardSizeProfiles();
    return Object.keys(cardSizeProfilesByName).length > 0;
}

function getKnownCardSizeProfiles() {
    return Object.values(cardSizeProfilesByName || {});
}

function approximatelyEqualPixels(left, right, tolerance = CARD_SIZE_VALIDATION_TOLERANCE_PX) {
    return Math.abs(Number(left) - Number(right)) <= tolerance;
}

function sizeMatchesProfile(size, width, height, tolerance = CARD_SIZE_VALIDATION_TOLERANCE_PX) {
    return !!size
        && approximatelyEqualPixels(size.width, width, tolerance)
        && approximatelyEqualPixels(size.height, height, tolerance);
}

function getCardSizeMetrics(cardData) {
    var cutWidth = Math.round(Number(cardData && cardData.width) || 0);
    var cutHeight = Math.round(Number(cardData && cardData.height) || 0);
    var marginX = Number(cardData && cardData.marginX) || 0;
    var marginY = Number(cardData && cardData.marginY) || 0;
    var bleedWidth = Math.round(cutWidth * (1 + 2 * marginX));
    var bleedHeight = Math.round(cutHeight * (1 + 2 * marginY));

    return {
        cutWidth: cutWidth,
        cutHeight: cutHeight,
        marginX: marginX,
        marginY: marginY,
        bleedWidth: bleedWidth,
        bleedHeight: bleedHeight,
        hasMargins: marginX > 0 || marginY > 0
    };
}

function getProfileNames(profiles) {
    return (profiles || []).map(function(profile) {
        return profile.name;
    });
}

function inferCardSizeValidation(cardData) {
    var metrics = getCardSizeMetrics(cardData);
    var profiles = getKnownCardSizeProfiles();

    if (metrics.cutWidth <= 0 || metrics.cutHeight <= 0) {
        return {
            invalid: true,
            status: 'Missing dimensions',
            metrics: metrics,
            cutMatches: [],
            bleedMatches: [],
            exactMatches: [],
            details: 'Saved card is missing a usable width or height.'
        };
    }

    var cutMatches = profiles.filter(function(profile) {
        return sizeMatchesProfile(profile.cut, metrics.cutWidth, metrics.cutHeight);
    });
    var bleedMatches = profiles.filter(function(profile) {
        return sizeMatchesProfile(profile.bleed, metrics.bleedWidth, metrics.bleedHeight);
    });
    var exactMatches = cutMatches.filter(function(profile) {
        return bleedMatches.some(function(bleedProfile) {
            return bleedProfile.name === profile.name;
        });
    });

    if (!metrics.hasMargins && cutMatches.length > 0) {
        return {
            invalid: false,
            status: 'Matches cut size',
            metrics: metrics,
            cutMatches: cutMatches,
            bleedMatches: bleedMatches,
            exactMatches: cutMatches,
            details: 'Card matches a known cut-size profile.'
        };
    }

    if (metrics.hasMargins && exactMatches.length > 0) {
        return {
            invalid: false,
            status: 'Matches cut + bleed',
            metrics: metrics,
            cutMatches: cutMatches,
            bleedMatches: bleedMatches,
            exactMatches: exactMatches,
            details: 'Card matches a known profile including calculated bleed size.'
        };
    }

    var status = 'No known profile';
    var details = 'Card dimensions do not match any known cut or bleed size.';
    if (cutMatches.length > 0 && bleedMatches.length === 0) {
        status = 'Cut matches only';
        details = 'The saved width/height match a known profile, but the calculated bleed size does not.';
    } else if (cutMatches.length === 0 && bleedMatches.length > 0) {
        status = 'Bleed matches only';
        details = 'The calculated size with margin matches a known profile, but the saved width/height do not.';
    } else if (cutMatches.length > 0 && bleedMatches.length > 0 && exactMatches.length === 0) {
        status = 'Mixed profile match';
        details = 'Cut and calculated bleed each match known profiles, but not the same one.';
    }

    return {
        invalid: true,
        status: status,
        metrics: metrics,
        cutMatches: cutMatches,
        bleedMatches: bleedMatches,
        exactMatches: exactMatches,
        details: details
    };
}

function renderValidationResults(summarySelector, resultsSelector, sourceLabel, entries) {
    var summaryEl = document.querySelector(summarySelector);
    var resultsEl = document.querySelector(resultsSelector);
    if (!summaryEl || !resultsEl) {
        return;
    }

    var items = Array.isArray(entries) ? entries : [];
    var invalidEntries = items.filter(function(entry) {
        return entry && entry.validation && entry.validation.invalid;
    });
    var validCount = items.length - invalidEntries.length;

    summaryEl.textContent = items.length === 0
        ? 'No ' + sourceLabel.toLowerCase() + ' cards found.'
        : items.length + ' checked · ' + validCount + ' matched known profiles · ' + invalidEntries.length + ' need review';

    resultsEl.innerHTML = '';
    if (items.length === 0) {
        resultsEl.innerHTML = '<p class="validation-result-empty">No ' + escapeHtml(sourceLabel.toLowerCase()) + ' cards found.</p>';
        return;
    }
    if (invalidEntries.length === 0) {
        resultsEl.innerHTML = '<p class="validation-result-empty">All ' + escapeHtml(sourceLabel.toLowerCase()) + ' cards match known card size profiles.</p>';
        return;
    }

    invalidEntries.forEach(function(entry) {
        var validation = entry.validation;
        var metrics = validation.metrics;
        var card = document.createElement('div');
        card.className = 'validation-result-card invalid';

        var cutMatches = getProfileNames(validation.cutMatches);
        var bleedMatches = getProfileNames(validation.bleedMatches);

        card.innerHTML = '' +
            '<div class="validation-result-header">' +
                '<h5>' + escapeHtml(entry.name) + '</h5>' +
                '<span class="validation-status-badge invalid">' + escapeHtml(validation.status) + '</span>' +
            '</div>' +
            '<div class="validation-metrics">' +
                '<div class="validation-metric"><span>Width × height</span><strong>' + escapeHtml(metrics.cutWidth + ' × ' + metrics.cutHeight + ' px') + '</strong></div>' +
                '<div class="validation-metric"><span>Calculated with margin</span><strong>' + escapeHtml(metrics.bleedWidth + ' × ' + metrics.bleedHeight + ' px') + '</strong></div>' +
                '<div class="validation-metric"><span>Margins</span><strong>' + escapeHtml((metrics.marginX * 100).toFixed(2) + '% × ' + (metrics.marginY * 100).toFixed(2) + '%') + '</strong></div>' +
            '</div>' +
            '<p>' + escapeHtml(validation.details) + '</p>' +
            '<p>Cut matches: ' + escapeHtml(cutMatches.length ? cutMatches.join(', ') : 'None') + '</p>' +
            '<p>Size with margin matches: ' + escapeHtml(bleedMatches.length ? bleedMatches.join(', ') : 'None') + '</p>';

        resultsEl.appendChild(card);
    });
}

async function refreshLocalValidation() {
    var summaryEl = document.querySelector('#validation-local-summary');
    if (summaryEl) {
        summaryEl.textContent = 'Validating local cards...';
    }

    if (!(await ensureCardSizeProfilesAvailable())) {
        var resultsEl = document.querySelector('#validation-local-results');
        if (summaryEl) {
            summaryEl.textContent = 'Card size profiles are unavailable, so validation cannot run.';
        }
        if (resultsEl) {
            resultsEl.innerHTML = '<p class="validation-result-empty">Validation unavailable until known card size profiles load.</p>';
        }
        return;
    }

    var keys = getLocalCardKeys().slice().sort();
    var entries = [];
    keys.forEach(function(key) {
        try {
            var data = readLocalCardData(key);
            if (!data) {
                return;
            }
            entries.push({
                name: key,
                validation: inferCardSizeValidation(data)
            });
        } catch (error) {
            entries.push({
                name: key,
                validation: {
                    invalid: true,
                    status: 'Unreadable card',
                    metrics: {cutWidth: 0, cutHeight: 0, bleedWidth: 0, bleedHeight: 0, marginX: 0, marginY: 0},
                    cutMatches: [],
                    bleedMatches: [],
                    exactMatches: [],
                    details: 'Failed to read saved card JSON: ' + error
                }
            });
        }
    });

    renderValidationResults('#validation-local-summary', '#validation-local-results', 'Local', entries);
}

async function refreshServerValidation() {
    var summaryEl = document.querySelector('#validation-server-summary');
    if (summaryEl) {
        summaryEl.textContent = 'Validating server cards...';
    }

    if (!(await ensureCardSizeProfilesAvailable())) {
        var resultsEl = document.querySelector('#validation-server-results');
        if (summaryEl) {
            summaryEl.textContent = 'Card size profiles are unavailable, so validation cannot run.';
        }
        if (resultsEl) {
            resultsEl.innerHTML = '<p class="validation-result-empty">Validation unavailable until known card size profiles load.</p>';
        }
        return;
    }

    if (!_serverSavedCards.length) {
        await refreshServerAvailableCards('', {skipValidationRefresh: true});
    }

    var summaries = (_serverSavedCards || []).slice();
    var entries = await Promise.all(summaries.map(async function(summary) {
        var name = summary.displayName || summary.legacyKey || summary.id;
        try {
            var details = await fetchServerSavedCard(summary.id);
            return {
                name: name,
                validation: inferCardSizeValidation(details.cardJson)
            };
        } catch (error) {
            return {
                name: name,
                validation: {
                    invalid: true,
                    status: 'Unreadable server card',
                    metrics: {cutWidth: 0, cutHeight: 0, bleedWidth: 0, bleedHeight: 0, marginX: 0, marginY: 0},
                    cutMatches: [],
                    bleedMatches: [],
                    exactMatches: [],
                    details: 'Failed to load server card JSON: ' + error
                }
            };
        }
    }));

    renderValidationResults('#validation-server-summary', '#validation-server-results', 'Server', entries);
}

async function loadValidationTab() {
    await Promise.all([refreshLocalValidation(), refreshServerValidation()]);
}

function refreshValidationTabIfVisible() {
    var validationSection = document.querySelector('#creator-menu-validation');
    if (validationSection && !validationSection.classList.contains('hidden')) {
        loadValidationTab();
    }
}

function serializeCurrentCardState() {
    var cardToSave = JSON.parse(JSON.stringify(card));
    cardToSave.frames.forEach(frame => {
        delete frame.image;
        frame.masks.forEach(mask => delete mask.image);
    });
    return cardToSave;
}

function readLocalCardData(selectedCardKey) {
    if (!selectedCardKey) {
        return null;
    }
    var raw = localStorage.getItem(selectedCardKey);
    return raw ? JSON.parse(raw) : null;
}

function getSelectedServerCardSummary() {
    var select = document.querySelector('#server-card-options');
    if (!select || !select.value) {
        return null;
    }
    return _serverSavedCards.find(item => item.id == select.value) || null;
}

async function refreshServerAvailableCards(selectedId = '', options = {}) {
    var skipValidationRefresh = !!options.skipValidationRefresh;
    var select = document.querySelector('#server-card-options');
    if (!select) {
        return;
    }
    select.innerHTML = '<option selected="selected" disabled>Loading server cards...</option>';
    try {
        var response = await fetch('/api/cards');
        if (!response.ok) {
            throw new Error('Failed to load server cards (' + response.status + ')');
        }
        _serverSavedCards = await response.json();
        populateSavedCardSelect('#server-card-options', _serverSavedCards, 'No server cards saved', item => item.id, item => item.displayName, selectedId);
    } catch (error) {
        console.error('Could not load server saved cards:', error);
        _serverSavedCards = [];
        populateSavedCardSelect('#server-card-options', [], 'Server cards unavailable');
    }

    if (!skipValidationRefresh) {
        refreshValidationTabIfVisible();
    }
}

async function loadServerAvailableCards(selectedId = '') {
    await refreshServerAvailableCards(selectedId);
}

async function ensureCardFontsLoaded(cardToLoad) {
    if (!document.fonts || !cardToLoad || !cardToLoad.text) {
        return;
    }

    const fontFamilies = new Set();
    Object.values(cardToLoad.text).forEach(textObject => {
        if (!textObject) {
            return;
        }
        if (textObject.font) {
            fontFamilies.add(String(textObject.font));
        }
        if (textObject.text) {
            const matches = String(textObject.text).match(/\{font([^}]+)}/g) || [];
            matches.forEach(match => {
                const family = match.replace('{font', '').replace('}', '');
                if (family) {
                    fontFamilies.add(family);
                }
            });
        }
    });

    const loaders = [];
    fontFamilies.forEach(family => {
        loaders.push(document.fonts.load(`16px ${family}`));
        loaders.push(document.fonts.load(`16px "${family}"`));
    });

    try {
        await Promise.all(loaders);
        await document.fonts.ready;
    } catch (error) {
        console.warn('Some fonts did not report loaded status during card load:', error);
    }
}

function importChanged() {
    var unique = document.querySelector('#importAllPrints').checked ? 'prints' : '';
    fetchScryfallData(document.querySelector("#import-name").value, importCard, unique);
}

function saveCard(saveFromFile) {
    var cardKeys = JSON.parse(localStorage.getItem('cardKeys')) || [];
    var cardKey, cardToSave;
    if (saveFromFile) {
        cardKey = saveFromFile.key;
    } else {
        cardKey = getCardName();
    }
    if (!saveFromFile) {
        cardKey = prompt('Enter the name you would like to save your card under:', cardKey);
        if (!cardKey) {
            return null;
        }
    }
    cardKey = cardKey.trim();
    if (cardKeys.includes(cardKey)) {
        if (!confirm('Would you like to overwrite your card previously saved as "' + cardKey + '"?\n(Clicking "cancel" will affix a version number)')) {
            var originalCardKey = cardKey;
            var cardKeyNumber = 1;
            while (cardKeys.includes(cardKey)) {
                cardKey = originalCardKey + ' (' + cardKeyNumber + ')';
                cardKeyNumber++;
            }
        }
    }
    if (saveFromFile) {
        cardToSave = saveFromFile.data;
    } else {
        cardToSave = serializeCurrentCardState();
    }
    try {
        localStorage.setItem(cardKey, JSON.stringify(cardToSave));
        if (!cardKeys.includes(cardKey)) {
            cardKeys.push(cardKey);
            cardKeys.sort();
            localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
            loadAvailableCards(cardKeys);
        }
    } catch (error) {
        notify('You have exceeded your 5MB of local storage, and your card has failed to save. If you would like to continue saving cards, please download all saved cards, then delete all saved cards to free up space.<br><br>Local storage is most often exceeded by uploading large images directly from your computer. If possible/convenient, using a URL avoids the need to save these large images.<br><br>Apologies for the inconvenience.');
    }
}

async function saveServerCard() {
    var selectedSummary = getSelectedServerCardSummary();
    var shouldOverwrite = false;
    if (selectedSummary) {
        shouldOverwrite = confirm('Would you like to overwrite the selected server card "' + selectedSummary.displayName + '"?\n\nClick Cancel to create a new server card instead.');
    }
    var defaultName = selectedSummary ? selectedSummary.displayName : getCardName();
    var displayName = prompt('Enter the name you would like to save your server card under:', defaultName);
    if (!displayName) {
        return null;
    }
    displayName = displayName.trim();
    if (!displayName) {
        return null;
    }
    try {
        var response = await fetch('/api/cards', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                id: shouldOverwrite && selectedSummary ? selectedSummary.id : null,
                displayName: displayName,
                legacyKey: shouldOverwrite && selectedSummary ? selectedSummary.legacyKey : null,
                cardJson: serializeCurrentCardState()
            })
        });
        if (!response.ok) {
            throw new Error('Save failed (' + response.status + ')');
        }
        var saved = await response.json();
        await refreshServerAvailableCards(saved.id);
        notify('Server card saved as "' + saved.displayName + '".', 4);
        return saved;
    } catch (error) {
        console.error('Failed to save card to server:', error);
        notify('Saving the card to the server failed.', 5);
        return null;
    }
}

async function sendLocalCardToServer() {
    var cardKey = document.querySelector('#load-card-options')?.value;
    if (!cardKey) {
        notify('Select a local card first.', 3);
        return;
    }
    var localCard = readLocalCardData(cardKey);
    if (!localCard) {
        notify('Could not read the selected local card.', 4);
        return;
    }
    try {
        var response = await fetch('/api/cards', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                displayName: cardKey,
                legacyKey: cardKey,
                cardJson: localCard
            })
        });
        if (!response.ok) {
            throw new Error('Send failed (' + response.status + ')');
        }
        var saved = await response.json();
        await refreshServerAvailableCards(saved.id);
        notify('Local card sent to the server as "' + saved.displayName + '".', 4);
    } catch (error) {
        console.error('Failed to send local card to server:', error);
        notify('Sending the local card to the server failed.', 5);
    }
}

async function sendAllLocalCardsToServer() {
    var cardKeys = getLocalCardKeys();
    if (!cardKeys.length) {
        notify('No local cards found to send.', 3);
        return;
    }
    var cards = cardKeys.map(key => {
        var data = readLocalCardData(key);
        return data ? {key: key, data: data} : null;
    }).filter(Boolean);
    if (!cards.length) {
        notify('No readable local cards were found to send.', 4);
        return;
    }
    try {
        var response = await fetch('/api/cards/import-local', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({cards: cards})
        });
        if (!response.ok) {
            throw new Error('Bulk send failed (' + response.status + ')');
        }
        var result = await response.json();
        await refreshServerAvailableCards();
        notify(result.importedCount + ' local card(s) sent to the server.', 4);
    } catch (error) {
        console.error('Failed to send all local cards to server:', error);
        notify('Sending local cards to the server failed.', 5);
    }
}

async function fetchServerSavedCard(selectedCardId) {
    if (!selectedCardId) {
        return null;
    }
    var response = await fetch('/api/cards/' + encodeURIComponent(selectedCardId));
    if (!response.ok) {
        throw new Error('Load failed (' + response.status + ')');
    }
    return await response.json();
}

async function loadCardData(cardData, label = 'selected card') {
    //clear the draggable frames
    document.querySelector('#frame-list').innerHTML = null;
    //clear the existing card, then replace it with the new JSON
    card = {};
    card = cardData ? JSON.parse(JSON.stringify(cardData)) : null;
    //if the card was loaded properly...
    if (card) {
        var shouldReapplyMarginFrame = false;
        var previousMarginScale = null;
        var overriddenLoadedCardSize = null;
        // Apply standard canvas size override if the setting is enabled.
        // All card positions are stored as 0–1 fractions, so they scale
        // proportionally with no extra work needed.
        if (localStorage.getItem('loadCardUseStandardSize') === 'true') {
            var originalLoadedWidth = Number(card.width);
            var originalLoadedHeight = Number(card.height);
            var selectedWidth = getStandardWidth();
            var selectedHeight = getStandardHeight();
            shouldReapplyMarginFrame = !!card.margins;
            if (shouldReapplyMarginFrame) {
                previousMarginScale = {x: Number(card.marginX), y: Number(card.marginY)};
            }
            if (Number.isFinite(originalLoadedWidth) && Number.isFinite(originalLoadedHeight)
                && (originalLoadedWidth !== selectedWidth || originalLoadedHeight !== selectedHeight)) {
                overriddenLoadedCardSize = {
                    oldWidth: originalLoadedWidth,
                    oldHeight: originalLoadedHeight,
                    newWidth: selectedWidth,
                    newHeight: selectedHeight
                };
            }
            card.width = selectedWidth;
            card.height = selectedHeight;
            card.marginX = 0;
            card.marginY = 0;
        }
        //load values from card into html inputs
        document.querySelector('#info-number').value = card.infoNumber;
        document.querySelector('#info-rarity').value = card.infoRarity;
        document.querySelector('#info-set').value = card.infoSet;
        document.querySelector('#info-language').value = card.infoLanguage;
        document.querySelector('#info-note').value = card.infoNote;
        document.querySelector('#info-year').value = card.infoYear || date.getFullYear();
        artistEdited(card.infoArtist);
        document.querySelector('#text-editor').value = card.text[Object.keys(card.text)[selectedTextIndex]].text;
        document.querySelector('#text-editor-font-size').value = card.text[Object.keys(card.text)[selectedTextIndex]].fontSize || 0;
        loadTextOptions(card.text);
        document.querySelector('#art-x').value = scaleX(card.artX) - scaleWidth(card.marginX);
        document.querySelector('#art-y').value = scaleY(card.artY) - scaleHeight(card.marginY);
        document.querySelector('#art-zoom').value = card.artZoom * 100;
        document.querySelector('#art-rotate').value = card.artRotate || 0;
        uploadArt(card.artSource);
        document.querySelector('#setSymbol-x').value = scaleX(card.setSymbolX) - scaleWidth(card.marginX);
        document.querySelector('#setSymbol-y').value = scaleY(card.setSymbolY) - scaleHeight(card.marginY);
        document.querySelector('#setSymbol-zoom').value = card.setSymbolZoom * 100;
        uploadSetSymbol(card.setSymbolSource);
        document.querySelector('#watermark-x').value = scaleX(card.watermarkX) - scaleWidth(card.marginX);
        document.querySelector('#watermark-y').value = scaleY(card.watermarkY) - scaleHeight(card.marginY);
        document.querySelector('#watermark-zoom').value = card.watermarkZoom * 100;
        // document.querySelector('#watermark-left').value = card.watermarkLeft;
        // document.querySelector('#watermark-right').value = card.watermarkRight;
        document.querySelector('#watermark-opacity').value = card.watermarkOpacity * 100;
        document.getElementById("rounded-corners").checked = !card.noCorners;
        uploadWatermark(card.watermarkSource);
        document.querySelector('#serial-number').value = card.serialNumber;
        document.querySelector('#serial-total').value = card.serialTotal;
        document.querySelector('#serial-x').value = card.serialX;
        document.querySelector('#serial-y').value = card.serialY;
        document.querySelector('#serial-scale').value = card.serialScale;
        serialInfoEdited();

        card.frames.reverse();
        for (const item of card.frames) {
            await addFrame([], item);
        }
        card.frames.reverse();
        if (card.onload) {
            await loadScript(card.onload);
        }
        await Promise.all(card.manaSymbols.map(item => loadScript(item)));
        //canvases
        var canvasesResized = false;
        canvasList.forEach(name => {
            if (window[name + 'Canvas'].width != card.width * (1 + card.marginX) || window[name + 'Canvas'].height != card.height * (1 + card.marginY)) {
                sizeCanvas(name);
                canvasesResized = true;
            }
        });
        if (canvasesResized) {
            drawTextBuffer();
            drawFrames();
            bottomInfoEdited();
            watermarkEdited();
        }

        if (shouldReapplyMarginFrame) {
            await applyMarginFrameSizing({
                forceEnable: true,
                fallbackMarginScale: previousMarginScale
            });
        }

        if (overriddenLoadedCardSize) {
            notify(
                'Loaded card size changed from '
                + overriddenLoadedCardSize.oldWidth + ' × ' + overriddenLoadedCardSize.oldHeight
                + ' px to '
                + overriddenLoadedCardSize.newWidth + ' × ' + overriddenLoadedCardSize.newHeight
                + ' px because "Use selected size profile when loading cards" is enabled.',
                5
            );
        }

        // Force font-dependent text redraw after loaded card fonts are available.
        FontLoadTracker.start();
        clearTimeout(writingText);
        await drawText();
        await ensureCardFontsLoaded(card);
        await FontLoadTracker.waitForAll();
        await drawText();
        setTimeout(drawText, 120);
        FontLoadTracker.stop();
    } else {
        notify(label + ' failed to load.', 5)
    }
}

async function loadCard(selectedCardKey) {
    await loadCardData(readLocalCardData(selectedCardKey), selectedCardKey);
}

async function loadServerCard(selectedCardId) {
    if (!selectedCardId) {
        return;
    }
    try {
        var serverCard = await fetchServerSavedCard(selectedCardId);
        await loadCardData(serverCard.cardJson, serverCard.displayName || serverCard.legacyKey || serverCard.id);
    } catch (error) {
        console.error('Failed to load server card:', error);
        notify('Loading the server card failed.', 5);
    }
}

function deleteCard() {
    var keyToDelete = document.querySelector('#load-card-options').value;
    if (keyToDelete) {
        var cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
        cardKeys.splice(cardKeys.indexOf(keyToDelete), 1);
        cardKeys.sort();
        localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
        localStorage.removeItem(keyToDelete);
        loadAvailableCards(cardKeys);
    }
}

async function deleteServerCard() {
    var selectedSummary = getSelectedServerCardSummary();
    if (!selectedSummary) {
        notify('Select a server card first.', 3);
        return;
    }
    if (!confirm('Delete the server card "' + selectedSummary.displayName + '"? This cannot be undone.')) {
        return;
    }
    try {
        var response = await fetch('/api/cards/' + encodeURIComponent(selectedSummary.id), {
            method: 'DELETE'
        });
        if (!response.ok && response.status != 404) {
            throw new Error('Delete failed (' + response.status + ')');
        }
        await refreshServerAvailableCards();
        notify('Server card deleted.', 4);
    } catch (error) {
        console.error('Failed to delete server card:', error);
        notify('Deleting the server card failed.', 5);
    }
}

function deleteSavedCards() {
    if (confirm('WARNING:\n\nALL of your saved cards will be deleted! If you would like to save these cards, please make sure you have downloaded them first. There is no way to undo this.\n\n(Press "OK" to delete your cards)')) {
        var cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
        cardKeys.forEach(key => localStorage.removeItem(key));
        localStorage.setItem('cardKeys', JSON.stringify([]));
        loadAvailableCards([]);
    }
}

async function downloadSavedCards() {
    var cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
    if (cardKeys) {
        var allSavedCards = [];
        cardKeys.forEach(item => {
            allSavedCards.push({key: item, data: JSON.parse(localStorage.getItem(item))});
        });
        var download = document.createElement('a');
        download.href = URL.createObjectURL(new Blob([JSON.stringify(allSavedCards)], {type: 'text'}));
        download.download = 'saved-cards.cardconjurer';
        document.body.appendChild(download);
        await download.click();
        download.remove();
    }
}

function uploadSavedCards(event) {
    var reader = new FileReader();
    reader.onload = function () {
        JSON.parse(reader.result).forEach(item => saveCard(item));
    }
    reader.readAsText(event.target.files[0]);
}

async function sendServerCardToLocal() {
    var selectedSummary = getSelectedServerCardSummary();
    if (!selectedSummary) {
        notify('Select a server card first.', 3);
        return;
    }
    try {
        var serverCard = await fetchServerSavedCard(selectedSummary.id);
        saveCard({
            key: selectedSummary.displayName || selectedSummary.legacyKey || selectedSummary.id,
            data: serverCard.cardJson
        });
        notify('Server card copied to local storage.', 4);
    } catch (error) {
        console.error('Failed to copy server card to local storage:', error);
        notify('Copying the server card to local storage failed.', 5);
    }
}

//TUTORIAL TAB
function loadTutorialVideo() {
    var video = document.querySelector('.video > iframe');
    if (video.src == '') {
        video.src = 'https://www.youtube-nocookie.com/embed/e4tnOiub41g?rel=0';
    }
}

// GUIDELINES
function drawNewGuidelines() {
    // clear
    guidelinesContext.clearRect(0, 0, guidelinesCanvas.width, guidelinesCanvas.height);
    // set opacity
    guidelinesContext.globalAlpha = 0.25;
    // textboxes
    guidelinesContext.fillStyle = 'blue';
    Object.entries(card.text).forEach(item => {
        guidelinesContext.fillRect(scaleX(item[1].x || 0), scaleY(item[1].y || 0), scaleWidth(item[1].width || 1), scaleHeight(item[1].height || 1));
    });
    // art
    guidelinesContext.fillStyle = 'green';
    guidelinesContext.fillRect(scaleX(card.artBounds.x), scaleY(card.artBounds.y), scaleWidth(card.artBounds.width), scaleHeight(card.artBounds.height));
    // watermark
    guidelinesContext.fillStyle = 'yellow';
    var watermarkWidth = scaleWidth(card.watermarkBounds.width);
    var watermarkHeight = scaleHeight(card.watermarkBounds.height);
    guidelinesContext.fillRect(scaleX(card.watermarkBounds.x) - watermarkWidth / 2, scaleY(card.watermarkBounds.y) - watermarkHeight / 2, watermarkWidth, watermarkHeight);
    // set symbol
    var setSymbolX = scaleX(card.setSymbolBounds.x);
    var setSymbolY = scaleY(card.setSymbolBounds.y);
    var setSymbolWidth = scaleWidth(card.setSymbolBounds.width);
    var setSymbolHeight = scaleHeight(card.setSymbolBounds.height);
    if (card.setSymbolBounds.vertical == 'center') {
        setSymbolY -= setSymbolHeight / 2;
    } else if (card.setSymbolBounds.vertical == 'bottom') {
        setSymbolY -= setSymbolHeight;
    }
    if (card.setSymbolBounds.horizontal == 'center') {
        setSymbolX -= setSymbolWidth / 2;
    } else if (card.setSymbolBounds.horizontal == 'right') {
        setSymbolX -= setSymbolWidth;
    }
    guidelinesContext.fillStyle = 'red';
    guidelinesContext.fillRect(setSymbolX, setSymbolY, setSymbolWidth, setSymbolHeight);
    // grid
    guidelinesContext.globalAlpha = 1;
    guidelinesContext.beginPath();
    guidelinesContext.strokeStyle = 'gray';
    guidelinesContext.lineWidth = 1;
    const boxPadding = 25;
    for (var x = 0; x <= card.width; x += boxPadding) {
        guidelinesContext.moveTo(x, 0);
        guidelinesContext.lineTo(x, card.height);
    }
    for (var y = 0; y <= card.height; y += boxPadding) {
        guidelinesContext.moveTo(0, y);
        guidelinesContext.lineTo(card.width, y);
    }
    guidelinesContext.stroke();
    //center lines
    guidelinesContext.beginPath();
    guidelinesContext.strokeStyle = 'black';
    guidelinesContext.lineWidth = 3;
    guidelinesContext.moveTo(card.width / 2, 0);
    guidelinesContext.lineTo(card.width / 2, card.height);
    guidelinesContext.moveTo(0, card.height / 2);
    guidelinesContext.lineTo(card.width, card.height / 2);
    guidelinesContext.stroke();
    //draw to card
    drawCard();
}

function addRoundedRectPath(ctx, x, y, width, height, radius) {
    var r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function strokeRoundedRectGuide(ctx, x, y, width, height, radius, outlineColor, lineColor, outlineWidth, lineWidth) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineWidth;
    addRoundedRectPath(ctx, x, y, width, height, radius);
    ctx.stroke();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    addRoundedRectPath(ctx, x, y, width, height, radius);
    ctx.stroke();
    ctx.restore();
}

function drawProfilePlacementOverlay() {
    if (!profileOverlayCanvas || !profileOverlayContext) {
        return;
    }

    // Keep the overlay canvas in lockstep with the card canvas.
    sizeCanvas('profileOverlay', cardCanvas.width, cardCanvas.height);
    profileOverlayContext.clearRect(0, 0, profileOverlayCanvas.width, profileOverlayCanvas.height);

    var profile = getSelectedCardSizeProfile();
    if (!profile || !profile.bleed || !profile.cut || !profile.safe) {
        return;
    }

    var bleedW = Number(profile.bleed.width);
    var bleedH = Number(profile.bleed.height);
    var cutW = Number(profile.cut.width);
    var cutH = Number(profile.cut.height);
    var safeW = Number(profile.safe.width);
    var safeH = Number(profile.safe.height);

    if (!Number.isFinite(bleedW) || !Number.isFinite(bleedH) || bleedW <= 0 || bleedH <= 0) {
        return;
    }

    // Mode-aware rendering:
    // - CUT mode: draw safe only
    // - BLEED mode: draw cut + safe
    // Prefer dimension matching (more robust across load paths), then fall back to margins.
    var overlayW = profileOverlayCanvas.width;
    var overlayH = profileOverlayCanvas.height;
    var bleedSizeMatches = approximatelyEqualPixels(overlayW, bleedW, 2) && approximatelyEqualPixels(overlayH, bleedH, 2);
    var cutSizeMatches = approximatelyEqualPixels(overlayW, cutW, 2) && approximatelyEqualPixels(overlayH, cutH, 2);
    var hasMargins = card.marginX > 0.0001 || card.marginY > 0.0001;
    var isBleedMode = bleedSizeMatches || (!cutSizeMatches && hasMargins);

    var cutXScaled;
    var cutYScaled;
    var cutWScaled;
    var cutHScaled;
    var safeXScaled;
    var safeYScaled;
    var safeWScaled;
    var safeHScaled;

    if (isBleedMode) {
        var scaleXOverlay = profileOverlayCanvas.width / bleedW;
        var scaleYOverlay = profileOverlayCanvas.height / bleedH;

        var cutX = (bleedW - cutW) / 2;
        var cutY = (bleedH - cutH) / 2;
        var safeX = (bleedW - safeW) / 2;
        var safeY = (bleedH - safeH) / 2;

        cutXScaled = cutX * scaleXOverlay;
        cutYScaled = cutY * scaleYOverlay;
        cutWScaled = cutW * scaleXOverlay;
        cutHScaled = cutH * scaleYOverlay;

        safeXScaled = safeX * scaleXOverlay;
        safeYScaled = safeY * scaleYOverlay;
        safeWScaled = safeW * scaleXOverlay;
        safeHScaled = safeH * scaleYOverlay;

        var cutCornerRadius = Math.min(cutWScaled, cutHScaled) * 0.03;

        var cutLineWidth = Math.max(2, Math.round(Math.min(profileOverlayCanvas.width, profileOverlayCanvas.height) * 0.0025));
        strokeRoundedRectGuide(
            profileOverlayContext,
            cutXScaled,
            cutYScaled,
            cutWScaled,
            cutHScaled,
            cutCornerRadius,
            'rgba(0, 0, 0, 1)',
            'rgba(0, 255, 255, 1)',
            cutLineWidth + 2,
            cutLineWidth);
    } else {
        // In cut mode, the visible canvas is already cut-size; only safe guide should be shown.
        cutWScaled = profileOverlayCanvas.width;
        cutHScaled = profileOverlayCanvas.height;
        safeWScaled = cutW <= 0 ? cutWScaled : cutWScaled * (safeW / cutW);
        safeHScaled = cutH <= 0 ? cutHScaled : cutHScaled * (safeH / cutH);
        safeXScaled = (cutWScaled - safeWScaled) / 2;
        safeYScaled = (cutHScaled - safeHScaled) / 2;
    }

    var safeCornerRadius = Math.min(safeWScaled, safeHScaled) * 0.02;

    // Draw safe guide.
    var safeLineWidth = Math.max(2, Math.round(Math.min(profileOverlayCanvas.width, profileOverlayCanvas.height) * 0.002));
    strokeRoundedRectGuide(
        profileOverlayContext,
        safeXScaled,
        safeYScaled,
        safeWScaled,
        safeHScaled,
        safeCornerRadius,
        'rgba(0, 0, 0, 1)',
        'rgba(255, 165, 0, 1)',
        safeLineWidth + 2,
        safeLineWidth);
}

//HIGHLIGHT TRANSPARENCIES
function toggleCardBackgroundColor(highlight) {
    if (highlight) {
        previewCanvas.style["background-color"] = "#ff007fff";
    } else {
        previewCanvas.style["background-color"] = "#0000";
    }
}

//Rounded Corners
function setRoundedCorners(value) {
    card.noCorners = !value;
    drawCard();
}

//Various loaders
function imageURL(url, destination, otherParams) {
    var imageurl = url;
    // If an image URL does not have HTTP in it, assume it's a local file in the repo local_art directory.
    if (!url.includes('http')) {
        imageurl = '/local_art/' + url;
    } else if (params.get('noproxy') != '') {
        //CORS PROXY LINKS
        //Previously: https://cors.bridged.cc/
        imageurl = 'https://corsproxy.io/?url=' + encodeURIComponent(url);
    }
    destination(imageurl, otherParams);
}

async function imageLocal(event, destination, otherParams) {
    var reader = new FileReader();
    reader.onload = function () {
        destination(reader.result, otherParams);
    }
    reader.onerror = function () {
        destination('/img/blank.png', otherParams);
    }
    await reader.readAsDataURL(event.target.files[0]);
}

function loadScript(scriptPath) {
    return new Promise((resolve, reject) => {
        var script = document.createElement('script');
        script.setAttribute('type', 'text/javascript');
        script.onload = resolve;
        script.onerror = function () {
            notify('A script failed to load, likely due to an update. Please reload your page. Sorry for the inconvenience.');
            reject();
        }
        script.setAttribute('src', scriptPath);
        document.querySelectorAll('head')[0].appendChild(script);
    });
}

// Stretchable SVGs
function stretchSVG(frameObject) {
    xhr = new XMLHttpRequest();
    xhr.open('GET', fixUri(frameObject.src), true);
    xhr.overrideMimeType('image/svg+xml');
    xhr.onload = function (e) {
        if (this.readyState == 4 && this.status == 200) {
            frameObject.image.src = 'data:image/svg+xml;charset=utf-8,' + stretchSVGReal((new XMLSerializer).serializeToString(this.responseXML.documentElement), frameObject);
        }
    }
    xhr.send();
}

function stretchSVGReal(data, frameObject) {
    var returnData = data;
    frameObject.stretch.forEach(stretch => {
        const change = stretch.change;
        const targets = stretch.targets;
        const name = stretch.name;
        const oldData = returnData.split(name + '" d="')[1].split('" style=')[0];
        var newData = '';
        const listData = oldData.split(/(?=[clmz])/gi);
        for (i = 0; i < listData.length; i++) {
            const item = listData[i];
            if (targets.includes(i) || targets.includes(-i)) {
                let sign = 1;
                if (i != 0 && targets.includes(-i)) {
                    sign = -1
                }

                if (item[0] == 'C' || item[0] == 'c') {
                    newCoords = [];
                    item.slice(1).split(' ').forEach(pair => {
                        coords = pair.split(',');
                        newCoords.push((scaleWidth(change[0]) * sign + parseFloat(coords[0])) + ',' + (scaleHeight(change[1]) * sign + parseFloat(coords[1])));
                    });
                    newData += item[0] + newCoords.join(' ');
                } else {
                    const coords = item.slice(1).split(/[, ]/);
                    newData += item[0] + (scaleWidth(change[0]) * sign + parseFloat(coords[0])) + ',' + (scaleHeight(change[1]) * sign + parseFloat(coords[1]))
                }
            } else {
                newData += item;
            }
        }
        returnData = returnData.replace(oldData, newData);
    });
    return returnData;
}

function processScryfallCard(card, responseCards) {
    if ('card_faces' in card) {
        card.card_faces.forEach(face => {
            face.set = card.set;
            face.rarity = card.rarity;
            face.collector_number = card.collector_number;
            face.lang = card.lang;
            face.layout = card.layout; // Add layout from parent card
            if (card.lang != 'en' || face.printed_name) {
                face.oracle_text = face.printed_text || face.oracle_text;
                face.name = face.printed_name || face.name;
                face.type_line = face.printed_type_line || face.type_line;
            }
            responseCards.push(face);
            if (!face.image_uris) {
                face.image_uris = card.image_uris;
            }
        });
    } else {
        if (card.lang != 'en' || card.printed_name) {
            card.oracle_text = card.printed_text || card.oracle_text;
            card.name = card.printed_name || card.name;
            card.type_line = card.printed_type_line || card.type_line;
        }
        // Ensure layout is set even for single-faced cards
        if (!card.layout) {
            card.layout = 'normal';
        }
        responseCards.push(card);
    }
}

function fetchScryfallCardByID(scryfallID, callback = console.log) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            responseCards = [];
            importedCards = [JSON.parse(this.responseText)];
            importedCards.forEach(card => {
                processScryfallCard(card, responseCards);
            });
            callback(responseCards);
        } else if (this.readyState == 4 && this.status == 404 && !unique && cardName != '') {
            notify(`No card found for "${cardName}" in ${cardLanguageSelect.options[cardLanguageSelect.selectedIndex].text}.`, 5);
        }
    }
    xhttp.open('GET', 'https://api.scryfall.com/cards/' + scryfallID, true);
    try {
        xhttp.send();
    } catch {
        console.log('Scryfall API search failed.')
    }
}

function fetchScryfallCardByCodeNumber(code, number, callback = console.log) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            responseCards = [];
            importedCards = [JSON.parse(this.responseText)];
            importedCards.forEach(card => {
                processScryfallCard(card, responseCards);
            });
            callback(responseCards);
        } else if (this.readyState == 4 && this.status == 404 && !unique && cardName != '') {
            notify('No card found for ' + code + ' #' + number, 5);
        }
    }
    xhttp.open('GET', 'https://api.scryfall.com/cards/' + code + '/' + number, true);
    try {
        xhttp.send();
    } catch {
        console.log('Scryfall API search failed.')
    }
}

//SCRYFALL STUFF MAY BE CHANGED IN THE FUTURE
function fetchScryfallData(cardName, callback = console.log, unique = '') {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            responseCards = [];
            importedCards = JSON.parse(this.responseText).data;
            importedCards.forEach(card => {
                processScryfallCard(card, responseCards);
            });
            callback(responseCards);
        } else if (this.readyState == 4 && this.status == 404 && !unique && cardName != '') {
            notify(`No cards found for "${cardName}" in ${cardLanguageSelect.options[cardLanguageSelect.selectedIndex].text}.`, 5);
        }
    }
    cardLanguageSelect = document.querySelector('#import-language');
    var cardLanguage = `lang%3D${cardLanguageSelect.value}`;
    var uniqueArt = '';
    if (unique) {
        uniqueArt = '&unique=' + unique;
    }
    var url = `https://api.scryfall.com/cards/search?order=released&include_extras=true${uniqueArt}&q=name%3D${cardName.replace(/ /g, '_')}%20${cardLanguage}`;
    xhttp.open('GET', url, true);
    try {
        xhttp.send();
    } catch {
        console.log('Scryfall API search failed.')
    }
}

function toggleTextTag(tag) {
    var element = document.getElementById('text-editor');

    var text = element.value;

    var start = element.selectionStart;
    var end = element.selectionEnd;
    var selection = text.substring(start, end);

    var openTag = '{' + tag + '}';
    var closeTag = '{/' + tag + '}';

    var prefix = text.substring(0, start);
    var suffix = text.substring(end);

    if (prefix.endsWith(openTag) && suffix.startsWith(closeTag)) {
        prefix = prefix.substring(0, prefix.length - openTag.length);
        suffix = suffix.substring(closeTag.length);
    } else if (selection.startsWith(openTag) && selection.endsWith(closeTag)) {
        selection = selection.substring(openTag.length, selection.length - closeTag.length);
    } else {
        selection = openTag + selection + closeTag;
    }

    element.value = prefix + selection + suffix;

    textEdited();
}

function toggleHighRes() {
    localStorage.setItem('high-res', document.querySelector('#high-res').checked);
    drawCard();
}

// INITIALIZATION

// auto load frame version (user defaults)
if (!localStorage.getItem('autoLoadFrameVersion')) {
    localStorage.setItem('autoLoadFrameVersion', document.querySelector('#autoLoadFrameVersion').checked);
}
document.querySelector('#autoLoadFrameVersion').checked = 'true' == localStorage.getItem('autoLoadFrameVersion');
// document.querySelector('#high-res').checked = 'true' == localStorage.getItem('high-res');

// collector info (user defaults)
var defaultCollector = JSON.parse(localStorage.getItem('defaultCollector') || '{}');
if ('number' in defaultCollector) {
    document.querySelector('#info-number').value = defaultCollector.number;
    document.querySelector('#info-note').value = defaultCollector.note;
    document.querySelector('#info-rarity').value = defaultCollector.rarity;
    document.querySelector('#info-set').value = defaultCollector.setCode;
    document.querySelector('#info-language').value = defaultCollector.lang;
    if (defaultCollector.starDot) {
        setTimeout(function () {
            defaultCollector.starDot = false;
            toggleStarDot();
        }, 500);
    }
} else {
    document.querySelector('#info-number').value = date.getFullYear();
}
if (!localStorage.getItem('enableImportCollectorInfo')) {
    localStorage.setItem('enableImportCollectorInfo', 'false');
} else {
    document.querySelector('#enableImportCollectorInfo').checked = (localStorage.getItem('enableImportCollectorInfo') == 'true');
}
if (!localStorage.getItem('enableNewCollectorStyle')) {
    localStorage.setItem('enableNewCollectorStyle', 'false');
} else {
    document.querySelector('#enableNewCollectorStyle').checked = (localStorage.getItem('enableNewCollectorStyle') == 'true');
}
if (!localStorage.getItem('enableCollectorInfo')) {
    localStorage.setItem('enableCollectorInfo', 'true');
} else {
    document.querySelector('#enableCollectorInfo').checked = (localStorage.getItem('enableCollectorInfo') == 'true');
}
if (!localStorage.getItem('autoFrame')) {
    localStorage.setItem('autoFrame', 'false');
} else {
    var autoFrameSelect = document.querySelector('#autoFrame');
    if (autoFrameSelect) {
        autoFrameSelect.value = localStorage.getItem('autoFrame');
    }
}
if (!localStorage.getItem('autoframe-always-nyx')) {
    localStorage.setItem('autoframe-always-nyx', 'false');
}
var autoFrameNyxCheckbox = document.querySelector('#autoframe-always-nyx');
if (autoFrameNyxCheckbox) {
    autoFrameNyxCheckbox.checked = localStorage.getItem('autoframe-always-nyx') == 'true';
}
if (!localStorage.getItem('autoFit')) {
    localStorage.setItem('autoFit', 'true');
} else {
    var autoFitCheckbox = document.querySelector('#art-update-autofit');
    if (autoFitCheckbox) {
        autoFitCheckbox.checked = localStorage.getItem('autoFit') == 'true';
    }
}

// lock set symbol code (user defaults)
if (!localStorage.getItem('lockSetSymbolCode')) {
    localStorage.setItem('lockSetSymbolCode', '');
}
if (localStorage.getItem('set-symbol-source')) {
    document.querySelector('#set-symbol-source').value = localStorage.getItem('set-symbol-source');
}
document.querySelector('#lockSetSymbolCode').checked = '' != localStorage.getItem('lockSetSymbolCode');
if (document.querySelector('#lockSetSymbolCode').checked) {
    document.querySelector('#set-symbol-code').value = localStorage.getItem('lockSetSymbolCode');
    fetchSetSymbol();
}

// lock set symbol url (user defaults)
if (!localStorage.getItem('lockSetSymbolURL')) {
    localStorage.setItem('lockSetSymbolURL', '');
}
document.querySelector('#lockSetSymbolURL').checked = '' != localStorage.getItem('lockSetSymbolURL');
if (document.querySelector('#lockSetSymbolURL').checked) {
    setSymbol.src = localStorage.getItem('lockSetSymbolURL');
}

//bind inputs together
bindInputs('#frame-editor-hsl-hue', '#frame-editor-hsl-hue-slider');
bindInputs('#frame-editor-hsl-saturation', '#frame-editor-hsl-saturation-slider');
bindInputs('#frame-editor-hsl-lightness', '#frame-editor-hsl-lightness-slider');
bindInputs('#show-guidelines', '#show-guidelines-2', true);

// Load / init whatever
loadScript('/js/frames/groupStandard-3.js');
loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
loadAvailableCards();
loadServerAvailableCards();
initDraggableArt();
refreshArtLibrarySelect();
refreshFrameLibrarySelect();
refreshSetSymbolLibrarySelect();
refreshWatermarkLibrarySelect();
initCardSizeSettings();

// =====================
// ASSET LIBRARY TAB
// =====================
var _assetLibraryKind = 'art';
var _assetLibraryItems = [];
var _assetLibrarySelected = new Set();

function switchAssetKind(kind) {
    _assetLibraryKind = kind;
    _assetLibrarySelected.clear();
    document.querySelectorAll('[id^="asset-kind-tab-"]').forEach(tab => tab.classList.remove('selected'));
    const activeTab = document.querySelector('#asset-kind-tab-' + kind);
    if (activeTab) {
        activeTab.classList.add('selected');
    }
    loadAssetLibrary();
}

async function loadAssetLibrary() {
    const gallery = document.querySelector('#asset-gallery');
    const status = document.querySelector('#asset-library-status');
    if (!gallery || !status) {
        return;
    }
    _assetLibrarySelected.clear();
    gallery.innerHTML = '';
    status.textContent = 'Loading...';

    try {
        const endpoint = _assetLibraryKind === 'art'
            ? '/api/assets/art-sources'
            : '/api/assets/sources/' + _assetLibraryKind;
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        _assetLibraryItems = await response.json();
    } catch (err) {
        console.error('Asset library load failed:', err);
        status.textContent = 'Failed to load files.';
        return;
    }

    if (_assetLibraryItems.length === 0) {
        status.textContent = '0 files';
        const empty = document.createElement('p');
        empty.className = 'asset-gallery-empty';
        empty.textContent = 'No uploaded files yet for this type.';
        gallery.appendChild(empty);
        return;
    }

    status.textContent = _assetLibraryItems.length + ' file(s)';
    _assetLibraryItems.forEach(item => gallery.appendChild(buildAssetGalleryItem(item)));
}

function buildAssetGalleryItem(item) {
    const cell = document.createElement('div');
    cell.className = 'asset-gallery-item';
    cell.onclick = () => toggleAssetSelection(item.url, cell);

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'asset-check';
    check.onclick = (e) => {
        e.stopPropagation();
        toggleAssetSelection(item.url, cell);
    };
    cell.appendChild(check);

    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.name;
    img.loading = 'lazy';
    img.onerror = function () {
        this.style.opacity = '0.3';
        this.src = '/img/blank.png';
    };
    cell.appendChild(img);

    const name = document.createElement('span');
    name.className = 'asset-name';
    name.textContent = item.name;
    cell.appendChild(name);

    return cell;
}

function toggleAssetSelection(url, cell) {
    const check = cell.querySelector('.asset-check');
    if (_assetLibrarySelected.has(url)) {
        _assetLibrarySelected.delete(url);
        cell.classList.remove('selected');
        if (check) {
            check.checked = false;
        }
    } else {
        _assetLibrarySelected.add(url);
        cell.classList.add('selected');
        if (check) {
            check.checked = true;
        }
    }
    const status = document.querySelector('#asset-library-status');
    if (status) {
        status.textContent = _assetLibraryItems.length + ' file(s), ' + _assetLibrarySelected.size + ' selected';
    }
}

function assetLibrarySelectAll() {
    _assetLibrarySelected.clear();
    document.querySelectorAll('#asset-gallery .asset-gallery-item').forEach((cell, i) => {
        const url = _assetLibraryItems[i]?.url;
        if (url) {
            _assetLibrarySelected.add(url);
        }
        cell.classList.add('selected');
        const check = cell.querySelector('.asset-check');
        if (check) {
            check.checked = true;
        }
    });
    const status = document.querySelector('#asset-library-status');
    if (status) {
        status.textContent = _assetLibraryItems.length + ' file(s), ' + _assetLibrarySelected.size + ' selected';
    }
}

function assetLibraryDeselectAll() {
    _assetLibrarySelected.clear();
    document.querySelectorAll('#asset-gallery .asset-gallery-item').forEach(cell => {
        cell.classList.remove('selected');
        const check = cell.querySelector('.asset-check');
        if (check) {
            check.checked = false;
        }
    });
    const status = document.querySelector('#asset-library-status');
    if (status) {
        status.textContent = _assetLibraryItems.length + ' file(s)';
    }
}

async function assetLibraryDeleteSelected() {
    if (_assetLibrarySelected.size === 0) {
        notify('No files selected.', 3);
        return;
    }
    if (!confirm('Delete ' + _assetLibrarySelected.size + ' selected file(s)? This cannot be undone.')) {
        return;
    }

    const urls = [..._assetLibrarySelected];
    let deleted = 0;
    let failed = 0;
    for (const url of urls) {
        try {
            const response = await fetch('/api/assets/' + _assetLibraryKind, {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({url})
            });
            if (response.ok || response.status === 404) {
                deleted++;
            } else {
                failed++;
            }
        } catch (err) {
            console.error('Delete failed for', url, err);
            failed++;
        }
    }

    notify(deleted + ' file(s) deleted' + (failed > 0 ? ', ' + failed + ' failed.' : '.'), 4);
    await loadAssetLibrary();

    if (_assetLibraryKind === 'art') {
        refreshArtLibrarySelect();
    } else if (_assetLibraryKind === 'frames') {
        refreshFrameLibrarySelect();
    } else if (_assetLibraryKind === 'set-symbols') {
        refreshSetSymbolLibrarySelect();
    } else if (_assetLibraryKind === 'watermarks') {
        refreshWatermarkLibrarySelect();
    }
}

async function assetLibraryUpload(filesRaw) {
    if (!filesRaw || filesRaw.length === 0) {
        return;
    }
    const files = [...filesRaw];
    const isDuplicate = _assetLibraryKind === 'art';
    let uploaded = 0;
    let dupes = 0;
    let failed = 0;

    for (const file of files) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('nameHint', file.name);
            const response = await fetch('/api/assets/upload/' + _assetLibraryKind, {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                uploaded++;
            } else if (isDuplicate && response.status === 409) {
                dupes++;
            } else {
                throw new Error('HTTP ' + response.status);
            }
        } catch (err) {
            console.error('Upload failed:', err);
            failed++;
        }
    }

    const parts = [];
    if (uploaded > 0) {
        parts.push(uploaded + ' uploaded');
    }
    if (dupes > 0) {
        parts.push(dupes + ' duplicate(s) skipped');
    }
    if (failed > 0) {
        parts.push(failed + ' failed');
    }
    notify(parts.join(', ') + '.', 4);
    await loadAssetLibrary();

    if (_assetLibraryKind === 'art') {
        refreshArtLibrarySelect();
    } else if (_assetLibraryKind === 'frames') {
        refreshFrameLibrarySelect();
    } else if (_assetLibraryKind === 'set-symbols') {
        refreshSetSymbolLibrarySelect();
    } else if (_assetLibraryKind === 'watermarks') {
        refreshWatermarkLibrarySelect();
    }
}

function assetLibraryUploadDrop(filesRaw) {
    assetLibraryUpload(filesRaw);
}
