//URL Params
// noinspection EqualityComparisonWithCoercionJS,ES6ConvertVarToLetConst,JSCheckFunctionSignatures,JSUnresolvedReference

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

// Asset loading trackers are defined in creator/asset-loading.js

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
var _currentLoadedCardName = '';

// Text utilities are defined in creator/text-utilities.js

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

// Collector tab logic moved to /js/creator/collector-tab.js.

// Canvas management utilities are defined in creator/math-utilities.js.

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

// Scaling utilities are defined in creator/math-utilities.js.

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

// General creator shell/UI helpers are defined in creator/shell-helpers.js.

// Frame list drag-and-drop helpers are defined in creator/drag-drop.js.
// dragStart, dragEnd, touchMove, dragOver

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
    var frame = document.querySelector('#autoFrame')?.value;
    if (!frame || frame == 'false') {
        autoFramePack = null;
        return;
    }

    // Guard: autoFrame requires key text fields to exist on the current card.
    // Without this, accessing .text on undefined throws before autoFramePack is
    // ever set, which causes loadScript to be called on every keystroke.
    if (!card.text || !card.text.type || !card.text.mana) {
        return;
    }

    // Read text fields with safe fallbacks so no field being missing can throw.
    var typeText  = card.text.type?.text  ?? '';
    var manaText  = card.text.mana?.text  ?? '';
    var rulesText = card.text.rules?.text ?? '';
    var ptText    = card.text.pt?.text    ?? '';

    var colors = [];
    if (typeText.toLowerCase().includes('land')) {
        var rules = rulesText;
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

        if (!colors.includes('W') && (rules.toLowerCase().includes('plains') || typeText.toLowerCase().includes('plains'))) {
            colors.push('W');
        }
        if (!colors.includes('U') && (rules.toLowerCase().includes('island') || typeText.toLowerCase().includes('island'))) {
            colors.push('U');
        }
        if (!colors.includes('B') && (rules.toLowerCase().includes('swamp') || typeText.toLowerCase().includes('swamp'))) {
            colors.push('B');
        }
        if (!colors.includes('R') && (rules.toLowerCase().includes('mountain') || typeText.toLowerCase().includes('mountain'))) {
            colors.push('R');
        }
        if (!colors.includes('G') && (rules.toLowerCase().includes('forest') || typeText.toLowerCase().includes('forest'))) {
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
        colors = [...new Set(manaText.toUpperCase().split('').filter(char => ['W', 'U', 'B', 'R', 'G'].includes(char)))];
    }

    // Load the pack script before calling the frame function.
    // Doing this first ensures autoFramePack is always set even if the
    // frame function throws, preventing the pack from being reloaded on
    // every subsequent keystroke.
    if (autoFramePack != frame) {
        loadScript('/js/frames/pack' + frame + '.js');
        autoFramePack = frame;
    }

    var group;
    if (frame == 'M15Regular-1') {
        autoM15Frame(colors, manaText, typeText, ptText);
        group = 'Standard-3';
    } else if (frame == 'M15RegularNew') {
        autoM15NewFrame(colors, manaText, typeText, ptText);
        group = 'Accurate';
    } else if (frame == 'M15Eighth') {
        autoM15EighthFrame(colors, manaText, typeText, ptText);
        group = 'Custom';
    } else if (frame == 'M15EighthUB') {
        autoM15EighthUBFrame(colors, manaText, typeText, ptText);
        group = 'Custom';
    } else if (frame == 'UB') {
        autoUBFrame(colors, manaText, typeText, ptText);
        group = 'Showcase-5';
    } else if (frame == 'UBNew') {
        autoUBNewFrame(colors, manaText, typeText, ptText);
        group = 'Accurate';
    } else if (frame == 'FullArtNew') {
        autoFullArtNewFrame(colors, manaText, typeText, ptText);
        group = 'Accurate';
    } else if (frame == 'Circuit') {
        autoCircuitFrame(colors, manaText, typeText, ptText);
        group = 'Custom';
    } else if (frame == 'Etched') {
        group = 'Showcase-5';
        autoEtchedFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'Praetors') {
        group = 'Showcase-5';
        autoPhyrexianFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'Seventh') {
        group = 'Misc-2';
        autoSeventhEditionFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'M15BoxTopper') {
        group = 'Showcase-5';
        autoExtendedArtFrame(colors, manaText, typeText, ptText, false);
    } else if (frame == 'M15ExtendedArtShort') {
        group = 'Showcase-5';
        autoExtendedArtFrame(colors, manaText, typeText, ptText, true);
    } else if (frame == '8th') {
        group = 'Misc-2';
        auto8thEditionFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'Borderless') {
        group = 'Showcase-5';
        autoBorderlessFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'BorderlessUB') {
        group = 'Showcase-5';
        autoBorderlessUBFrame(colors, manaText, typeText, ptText);
        frame = 'Borderless';
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

// Frame-by-letter helpers are now loaded from /js/autoFrame/autoFrameHelpers.js.

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
    await creatorAssetLibrary.refreshLibrarySelect('#frame-library-select', 'frames', {
        noneText: 'None selected',
        errorText: 'Failed to load uploaded frames'
    });
}

function selectFrameLibrarySource(element) {
    creatorAssetLibrary.selectLibrarySource(element, uploadFrameOption);
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
    document.querySelector('#text-editor-font-size').value = Object.entries(card.text)[selectedTextIndex][1].fontSize ?? 0;
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
    await creatorAssetLibrary.uploadFilesToServerByKind(
        filesRaw,
        kind,
        destination,
        otherParams,
        refreshCallback,
        artDuplicateCheck
    );
}

async function refreshArtLibrarySelect() {
    await creatorAssetLibrary.refreshLibrarySelect('#art-library-select', 'art', {
        noneText: 'None selected',
        errorText: 'Failed to load saved art list'
    });
}

function selectArtLibrarySource(element) {
    creatorAssetLibrary.selectLibrarySource(element, (url) => {
        uploadArt(url, document.querySelector('#art-update-autofit').checked ? 'autoFit' : '');
    });
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
// Set Symbol tab logic moved to /js/creator/set-symbol-tab.js.

//WATERMARK TAB
// Watermark tab logic moved to /js/creator/watermark-tab.js.

//COLLECTOR TAB
// Collector tab logic moved to /js/creator/collector-tab.js.

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

// Collector defaults moved to /js/creator/collector-tab.js.

// drawSetSymbol moved to /js/creator/set-symbol-tab.js.

//DRAWING THE CARD (putting it all together)
// drawCard moved to /js/creator/rendering.js during hybrid split.

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

async function bulkDownloadZip(isPrintImage = false) {
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

    const zipFileName = isPrintImage ? 'CardConjurer_Bulk_PrintBleed.zip' : BULK_ZIP_FILENAME;

    let fileHandle = null;
    let useStreaming = false;

    // 2. Trigger the file picker immediately to capture the user gesture.
    if (window.showSaveFilePicker) {
        try {
            notify('Please choose a location to save your ZIP file.', 15);
            fileHandle = await window.showSaveFilePicker({
                suggestedName: zipFileName,
                types: [{
                    description: 'ZIP file',
                    accept: {'application/zip': ['.zip']},
                }],
            });
            useStreaming = true;
        } catch (err) {
            if (err.name === 'AbortError') {
                notify('Save operation cancelled.', 3);
                return;
            }
            logError('Could not get file handle, falling back to in-memory method:', err);
        }
    }

    // 3. Save the current state and prepare the zip object.
    notify(`Preparing to process ${cardKeys.length} cards${isPrintImage ? ' (print bleed)' : ''}...`, 10);
    const zip = new JSZip();
    const tempKey = '__temp_current_card_state__';
    const cardToSave = JSON.parse(JSON.stringify(card));
    cardToSave.frames.forEach(frame => {
        delete frame.image;
        frame.masks.forEach(mask => delete mask.image);
    });
    localStorage.setItem(tempKey, JSON.stringify(cardToSave));

    // Suppress placement overlay so it never appears in any output frame.
    const previousOverlaySuppression = suppressProfilePlacementOverlay;
    suppressProfilePlacementOverlay = true;

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

            if (isPrintImage) {
                // Route through the server renderer so it can apply bleed cropping/embedding.
                const selectedProfile = getSelectedCardSizeProfile();
                const cardSizeProfileName = selectedProfile && selectedProfile.name ? selectedProfile.name : null;
                const imageBase64 = cardCanvas.toDataURL('image/png').split(',')[1];
                const cardJson = serializeCurrentCardState();

                const response = await fetch('/api/card-image/render', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        imageBase64: imageBase64,
                        cardJson: cardJson,
                        fileName: getCardName(),
                        format: 'png',
                        cardSizeProfileName: cardSizeProfileName,
                        isPrintImage: true
                    })
                });

                if (!response.ok) {
                    throw new Error('Server render returned HTTP ' + response.status);
                }

                const blob = await response.blob();
                zip.file(imageName, blob);
            } else {
                const imageData = cardCanvas.toDataURL('image/png').split(',')[1];
                zip.file(imageName, imageData, {base64: true});
            }

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
            notify('Streaming not supported. Building ZIP in memory... This may be slow or fail.', 10);
            const content = await zip.generateAsync({type: 'blob'});

            const downloadElement = document.createElement('a');
            downloadElement.href = URL.createObjectURL(content);
            downloadElement.download = zipFileName;
            document.body.appendChild(downloadElement);
            downloadElement.click();
            document.body.removeChild(downloadElement);
        }
    } catch (err) {
        logError('Failed to generate or save ZIP file:', err);
        notify('An error occurred while saving the ZIP file.', 5);
    }

    // 6. Restore the user's original card state and overlay suppression.
    suppressProfilePlacementOverlay = previousOverlaySuppression;
    await loadCard(tempKey);
    localStorage.removeItem(tempKey);
    drawCard();
    logDebug('Bulk download process finished. User state restored.');
}

async function bulkDownloadZipWithPrintBleed() {
    await bulkDownloadZip(true);
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
                const setCode = (card.set || '').toUpperCase();
                const collectorNumber = card.collector_number || '';
                title += `(${setCode} #${collectorNumber})`;
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
        const card = await scryfallCardFromText(text);
        importCard([card]);
    } catch (err) {
        logError('Failed to read clipboard text: ', err);
        notify('Clipboard access failed. Did you click the button?');
    }
}

var importParseController = null;

async function postImportNormalization(endpoint, body, allowNotFound = false, signal = null) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body),
            signal: signal
        });
        if (allowNotFound && response.status === 404) {
            return null;
        }
        if (!response.ok) {
            logError('Import normalization request failed:', endpoint, response.status);
            return null;
        }
        return await response.json();
    } catch (err) {
        if (err.name === 'AbortError') {
            logDebug('Import parse request cancelled:', endpoint);
            return null;
        }
        logError('Import normalization request error:', endpoint, err);
        return null;
    }
}

async function scryfallCardFromText(text, signal = null) {
    return await postImportNormalization('/api/import-normalization/from-text', {text}, false, signal) || {};
}

async function parseSagaData(text, signal = null) {
    return await postImportNormalization('/api/import-normalization/saga', {text}, false, signal) || {abilities: [], reminderText: null};
}

async function parseClassAbilities(text, signal = null) {
    const abilities = await postImportNormalization('/api/import-normalization/class', {text}, false, signal);
    return Array.isArray(abilities) ? abilities : [];
}

function normalizeLayoutData(layoutData) {
    if (!layoutData) {
        return null;
    }
    if (layoutData.basePT === undefined && layoutData.basePt !== undefined) {
        layoutData.basePT = layoutData.basePt;
    }
    return layoutData;
}

async function parseMultiFacedCards(card, signal = null) {
    return await postImportNormalization('/api/import-normalization/multi-faced', {
        card: card,
        contextCards: scryfallCard
    }, false, signal);
}

async function parseLayoutSpecific(card, signal = null) {
    return await postImportNormalization('/api/import-normalization/layout-specific', card, false, signal);
}

async function parseLevelerCard(card, signal = null) {
    const result = await parseLayoutSpecific(card, signal);
    return normalizeLayoutData(result && result.leveler);
}

async function parsePrototypeLayout(card, signal = null) {
    const result = await parseLayoutSpecific(card, signal);
    return normalizeLayoutData(result && result.prototype);
}

async function parseMutateLayout(card, signal = null) {
    const result = await parseLayoutSpecific(card, signal);
    return normalizeLayoutData(result && result.mutate);
}

async function parseVanguardLayout(card, signal = null) {
    const result = await parseLayoutSpecific(card, signal);
    return normalizeLayoutData(result && result.vanguard);
}

async function parseRollAbilities(text, signal = null) {
    const result = await postImportNormalization('/api/import-normalization/roll', {text}, false, signal);
    return result ? result.text : null;
}

async function parseStationCard(oracleText, signal = null) {
    return await postImportNormalization('/api/import-normalization/station', {text: oracleText}, true, signal);
}

async function changeCardIndex() {
    // Abort any in-flight parse requests from a previous import selection
    if (importParseController) {
        importParseController.abort();
    }
    importParseController = new AbortController();
    const signal = importParseController.signal;

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
        const flipData = await parseMultiFacedCards(cardToImport, signal);
        if (signal.aborted) return;

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
            document.querySelector('#set-symbol-rarity').value = (cardToImport.rarity || '').slice(0, 1);
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
            uniqueData = await parseLevelerCard(cardToImport, signal);
        } else if (cardToImport.layout === 'prototype') {
            uniqueData = await parsePrototypeLayout(cardToImport, signal);
        } else if (cardToImport.layout === 'mutate') {
            uniqueData = await parseMutateLayout(cardToImport, signal);
        } else if (cardToImport.layout === 'vanguard') {
            uniqueData = await parseVanguardLayout(cardToImport, signal);
        }

        if (signal.aborted) return;
        if (!uniqueData) {
            logError('Failed to parse unique layout data for imported card layout:', cardToImport.layout);
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
            document.querySelector('#set-symbol-rarity').value = (cardToImport.rarity || '').slice(0, 1);
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

        const stationData = await parseStationCard(cardToImport.oracle_text, signal);
        if (signal.aborted) return;
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
        const rollText = await parseRollAbilities(cardToImport.oracle_text, signal);
        if (signal.aborted) return;
        if (rollText) {
            // Use the modified text with roll tags for further processing
            var rulesText = rollText.replace(/(?:\((?:.*?)\)|[^"\n]+(?= — ))/g, function (a) {
                const hasBoldTag = a.toLowerCase().includes('{bold}') || a.toLowerCase().includes('{/bold}');
                if (hasBoldTag || italicExemptions.includes(a) || (cardToImport.keywords && cardToImport.keywords.indexOf('Spree') != -1 && a.startsWith('+'))) {
                    return a;
                }
                return '{i}' + a + '{/i}';
            });
        } else {
            // Regular processing for non-roll cards
            var rulesText = (cardToImport.oracle_text || '').replace(/(?:\((?:.*?)\)|[^"\n]+(?= — ))/g, function (a) {
                const hasBoldTag = a.toLowerCase().includes('{bold}') || a.toLowerCase().includes('{/bold}');
                if (hasBoldTag || italicExemptions.includes(a) || (cardToImport.keywords && cardToImport.keywords.indexOf('Spree') != -1 && a.startsWith('+'))) {
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
        const hasPower = cardToImport.power !== undefined && cardToImport.power !== null && cardToImport.power !== '';
        const hasToughness = cardToImport.toughness !== undefined && cardToImport.toughness !== null && cardToImport.toughness !== '';
        if (card.version == 'invocation') {
            card.text.pt.text = hasPower && hasToughness ? (cardToImport.power + '\n' + cardToImport.toughness) : '';
        } else if (card.version == 'pokemon') {
            card.text.middleStat.text = '{' + (cardToImport.power || '') + '}';
            card.text.pt.text = '{' + (cardToImport.toughness || '') + '}';

            if (card.text.middleStat && card.text.middleStat.text == '{}') {
                card.text.middleStat.text = '';
            }
        } else {
            card.text.pt.text = hasPower && hasToughness ? (cardToImport.power + '/' + cardToImport.toughness) : '';
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
        const sagaData = await parseSagaData(cardToImport.oracle_text, signal);
        if (signal.aborted) return;
        const abilities = sagaData.abilities || [];
        for (let i = 0; i < abilities.length; i++) {
            card.text[`ability${i}`].text = abilities[i].ability.replace('(', '{i}(').replace(')', '){/i}');
        }
        card.text.reminder.text = sagaData.reminderText ? `{i}${sagaData.reminderText}{/i}` : '';
        card.saga = {...card.saga, abilities: abilities.map(a => a.steps).concat(Array.from({length: 4 - abilities.length}, () => 0)), count: abilities.length};
        updateAbilityHeights()
    } else if (card.version.toLowerCase().includes('class') && !card.version.includes('classicshifted') && typeof classCanvas !== "undefined") {
        if (card.text.flavor) {
            // future support classes with flavor text
            card.text.flavor.text = cardToImport.flavor_text || '';
        }
        const abilities = await parseClassAbilities(cardToImport.oracle_text, signal);
        if (signal.aborted) return;
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
        const rarityFirst = (cardToImport.rarity || '').charAt(0).toUpperCase();
        document.querySelector('#info-number').value = cardToImport.collector_number || "";
        document.querySelector('#info-rarity').value = rarityFirst;
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
        if (cardToImport.set) {
            setXhttp.open('GET', "https://api.scryfall.com/sets/" + cardToImport.set, true);
            try {
                setXhttp.send();
            } catch {
                console.log('Scryfall API search failed.')
            }
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
    document.querySelector('#set-symbol-rarity').value = (cardToImport.rarity || '').slice(0, 1);
    if (!document.querySelector('#lockSetSymbolURL').checked) {
        fetchSetSymbol();
    }
}

var _serverSavedCards = window._serverSavedCards || [];

function getLocalCardKeys() {
    return window.creatorCardStorage.getLocalCardKeys();
}

function populateSavedCardSelect(selector, items, placeholder, getValue = item => item, getLabel = item => item, selectedValue = '') {
    return window.creatorCardStorage.populateSavedCardSelect(selector, items, placeholder, getValue, getLabel, selectedValue);
}

function loadAvailableCards(cardKeys = getLocalCardKeys()) {
    return window.creatorCardStorage.loadAvailableCards(cardKeys);
}

var CARD_SIZE_VALIDATION_TOLERANCE_PX = window.creatorValidationService.CARD_SIZE_VALIDATION_TOLERANCE_PX;
var _lastLocalValidationEntries = window.creatorValidationService._lastLocalValidationEntries;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function ensureCardSizeProfilesAvailable() {
    return await window.creatorValidationService.ensureCardSizeProfilesAvailable();
}

function getKnownCardSizeProfiles() {
    return window.creatorValidationService.getKnownCardSizeProfiles();
}

function approximatelyEqualPixels(left, right, tolerance = CARD_SIZE_VALIDATION_TOLERANCE_PX) {
    return window.creatorValidationService.approximatelyEqualPixels(left, right, tolerance);
}

function sizeMatchesProfile(size, width, height, tolerance = CARD_SIZE_VALIDATION_TOLERANCE_PX) {
    return window.creatorValidationService.sizeMatchesProfile(size, width, height, tolerance);
}

function getCardSizeMetrics(cardData) {
    return window.creatorValidationService.getCardSizeMetrics(cardData);
}

function getProfileNames(profiles) {
    return window.creatorValidationService.getProfileNames(profiles);
}

function inferCardSizeValidation(cardData) {
    return window.creatorValidationService.inferCardSizeValidation(cardData);
}

function getLocalValidationEntries() {
    return window.creatorValidationService.getLocalValidationEntries();
}

function normalizeMarginScale(marginScale) {
    return window.creatorValidationService.normalizeMarginScale(marginScale);
}

function applySelectedProfileSizeToSavedCard(cardData, profile, normalizedMarginScale) {
    return window.creatorValidationService.applySelectedProfileSizeToSavedCard(cardData, profile, normalizedMarginScale);
}

async function updateLocalSavedCardsToSelectedProfile(includeOnlyInvalid) {
    await window.creatorValidationService.updateLocalSavedCardsToSelectedProfile(includeOnlyInvalid);
    _lastLocalValidationEntries = window.creatorValidationService._lastLocalValidationEntries;
}

async function setInvalidLocalCardsToSelectedProfile() {
    await window.creatorValidationService.setInvalidLocalCardsToSelectedProfile();
    _lastLocalValidationEntries = window.creatorValidationService._lastLocalValidationEntries;
}

async function setAllLocalCardsToSelectedProfile() {
    await window.creatorValidationService.setAllLocalCardsToSelectedProfile();
    _lastLocalValidationEntries = window.creatorValidationService._lastLocalValidationEntries;
}

function renderValidationResults(summarySelector, resultsSelector, sourceLabel, entries) {
    return window.creatorValidationService.renderValidationResults(summarySelector, resultsSelector, sourceLabel, entries);
}

async function refreshLocalValidation() {
    await window.creatorValidationService.refreshLocalValidation();
    _lastLocalValidationEntries = window.creatorValidationService._lastLocalValidationEntries;
}

async function refreshServerValidation() {
    await window.creatorValidationService.refreshServerValidation();
}

async function loadValidationTab() {
    await window.creatorValidationService.loadValidationTab();
    _lastLocalValidationEntries = window.creatorValidationService._lastLocalValidationEntries;
}

function refreshValidationTabIfVisible() {
    return window.creatorValidationService.refreshValidationTabIfVisible();
}

function serializeCurrentCardState() {
    return window.creatorCardStorage.serializeCurrentCardState();
}

function readLocalCardData(selectedCardKey) {
    return window.creatorCardStorage.readLocalCardData(selectedCardKey);
}

function getSelectedServerCardSummary() {
    return window.creatorCardStorage.getSelectedServerCardSummary();
}

async function refreshServerAvailableCards(selectedId = '', options = {}) {
    await window.creatorCardStorage.refreshServerAvailableCards(selectedId, options);
    _serverSavedCards = window._serverSavedCards || [];
}

async function loadServerAvailableCards(selectedId = '') {
    await window.creatorCardStorage.loadServerAvailableCards(selectedId);
    _serverSavedCards = window._serverSavedCards || [];
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
    return window.creatorCardStorage.saveCard(saveFromFile);
}

async function saveServerCard() {
    return await window.creatorCardStorage.saveServerCard();
}

async function sendLocalCardToServer() {
    await window.creatorCardStorage.sendLocalCardToServer();
    _serverSavedCards = window._serverSavedCards || [];
}

async function sendAllLocalCardsToServer() {
    await window.creatorCardStorage.sendAllLocalCardsToServer();
    _serverSavedCards = window._serverSavedCards || [];
}

async function fetchServerSavedCard(selectedCardId) {
    return await window.creatorCardStorage.fetchServerSavedCard(selectedCardId);
}

async function loadCardData(cardData, label = 'selected card') {
    //clear the draggable frames
    document.querySelector('#frame-list').innerHTML = null;
    //clear the existing card, then replace it with the new JSON
    card = {};
    card = cardData ? JSON.parse(JSON.stringify(cardData)) : null;
    //if the card was loaded properly...
    if (card) {
        if (label && label !== 'selected card') {
            _currentLoadedCardName = String(label);
        }
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
    await window.creatorCardStorage.loadCard(selectedCardKey);
}

async function loadServerCard(selectedCardId) {
    await window.creatorCardStorage.loadServerCard(selectedCardId);
}

function deleteCard() {
    return window.creatorCardStorage.deleteCard();
}

async function deleteServerCard() {
    await window.creatorCardStorage.deleteServerCard();
    _serverSavedCards = window._serverSavedCards || [];
}

function deleteSavedCards() {
    return window.creatorCardStorage.deleteSavedCards();
}

async function downloadSavedCards() {
    await window.creatorCardStorage.downloadSavedCards();
}

function uploadSavedCards(event) {
    return window.creatorCardStorage.uploadSavedCards(event);
}

async function sendServerCardToLocal() {
    await window.creatorCardStorage.sendServerCardToLocal();
}

// Tutorial-tab helpers are defined in creator/shell-helpers.js.

// GUIDELINES
// drawNewGuidelines/drawProfilePlacementOverlay helpers moved to /js/creator/rendering.js.

// Transparency-highlight helpers are defined in creator/shell-helpers.js.

//Rounded Corners
// setRoundedCorners moved to /js/creator/rendering.js.

// Image/script loading helpers are defined in creator/resource-loaders.js.

// Stretchable SVGs
// SVG stretch helpers are defined in creator/resource-loaders.js.

async function fetchScryfallCardByID(scryfallID, callback = console.log) {
    try {
        const scryfallResponse = await fetch('https://api.scryfall.com/cards/' + scryfallID);
        if (scryfallResponse.status === 404) {
            notify(`No card found for Scryfall ID "${scryfallID}".`, 5);
            return;
        }
        if (!scryfallResponse.ok) {
            logError('Scryfall card fetch by ID failed with status:', scryfallResponse.status);
            return;
        }
        const card = await scryfallResponse.json();
        const normalizeResponse = await fetch('/api/import-normalization/process-scryfall-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(card)
        });
        if (!normalizeResponse.ok) {
            logError('Card normalization failed with status:', normalizeResponse.status);
            return;
        }
        callback(await normalizeResponse.json());
    } catch (err) {
        logError('Scryfall card fetch by ID failed:', err);
    }
}

async function fetchScryfallCardByCodeNumber(code, number, callback = console.log) {
    try {
        const scryfallResponse = await fetch(`https://api.scryfall.com/cards/${code}/${number}`);
        if (scryfallResponse.status === 404) {
            notify(`No card found for ${code} #${number}.`, 5);
            return;
        }
        if (!scryfallResponse.ok) {
            logError('Scryfall card fetch failed with status:', scryfallResponse.status);
            return;
        }
        const card = await scryfallResponse.json();
        const normalizeResponse = await fetch('/api/import-normalization/process-scryfall-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(card)
        });
        if (!normalizeResponse.ok) {
            logError('Card normalization failed with status:', normalizeResponse.status);
            return;
        }
        callback(await normalizeResponse.json());
    } catch (err) {
        logError('Scryfall card fetch failed:', err);
    }
}

async function fetchScryfallData(cardName, callback = console.log, unique = '') {
    cardLanguageSelect = document.querySelector('#import-language');
    const cardLanguage = `lang%3D${cardLanguageSelect.value}`;
    const uniqueArt = unique ? '&unique=' + unique : '';
    const url = `https://api.scryfall.com/cards/search?order=released&include_extras=true${uniqueArt}&q=name%3D${cardName.replace(/ /g, '_')}%20${cardLanguage}`;
    try {
        const scryfallResponse = await fetch(url);
        if (scryfallResponse.status === 404) {
            if (!unique && cardName !== '') {
                notify(`No cards found for "${cardName}" in ${cardLanguageSelect.options[cardLanguageSelect.selectedIndex].text}.`, 5);
            }
            return;
        }
        if (!scryfallResponse.ok) {
            logError('Scryfall search failed with status:', scryfallResponse.status);
            return;
        }
        const importedCards = (await scryfallResponse.json()).data;
        const normalizeResponse = await fetch('/api/import-normalization/process-scryfall-cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(importedCards)
        });
        if (!normalizeResponse.ok) {
            logError('Card normalization failed with status:', normalizeResponse.status);
            return;
        }
        callback(await normalizeResponse.json());
    } catch (err) {
        logError('Scryfall API search failed:', err);
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
updateCreatorPreviewInfo();

// =====================
// ASSET LIBRARY TAB
// =====================
function switchAssetKind(kind) {
    return creatorAssetLibrary.switchAssetKind(kind);
}

async function loadAssetLibrary() {
    return creatorAssetLibrary.loadAssetLibrary();
}

function assetLibrarySelectAll() {
    return creatorAssetLibrary.selectAll();
}

function assetLibraryDeselectAll() {
    return creatorAssetLibrary.deselectAll();
}

async function assetLibraryDeleteSelected() {
    return creatorAssetLibrary.deleteSelected();
}

async function assetLibraryUpload(filesRaw) {
    return creatorAssetLibrary.uploadForCurrentKind(filesRaw);
}

function assetLibraryUploadDrop(filesRaw) {
    assetLibraryUpload(filesRaw);
}
