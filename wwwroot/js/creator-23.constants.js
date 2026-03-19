/**
 * @file creator-23.constants.js
 * Centralised constants, URI utilities, and the mana-symbol registry for
 * the Card Conjurer creator.  This file MUST be loaded before creator-23.js.
 */

// ── URI Utilities ─────────────────────────────────────────────────────────────

/**
 * Resolves a relative asset URI.  The body is intentionally a passthrough;
 * the CDN-prefix logic below is preserved as a comment for future use.
 * @param {string} input - The raw URI to resolve.
 * @returns {string} The resolved URI.
 */
function fixUri(input) {
	/* --- CDN PREFIX (disabled for self-hosted build) ---
	var prefix = 'https://card-conjurer.storage.googleapis.com';
	if (input.includes(prefix) || input.includes('http') || input.includes('data:image') || window.location.href.includes('localhost')) {
		return input;
	}
	return prefix + input;
	*/
	return input;
}

/**
 * Sets an image's src via {@link fixUri} and marks it as cross-origin anonymous.
 * @param {HTMLImageElement} image - The image element to update.
 * @param {string} source - The raw source URL.
 */
function setImageUrl(image, source) {
	image.crossOrigin = 'anonymous';
	image.src = fixUri(source);
}

// ── Canvas / Card Dimension Defaults ─────────────────────────────────────────

/** Legacy baseline width before user-resizable canvas was introduced. */
const LEGACY_BASE_WIDTH = 1500;

/** Legacy baseline height before user-resizable canvas was introduced. */
const LEGACY_BASE_HEIGHT = 2100;

/** Scale factor applied to produce the old "high-res" size (1500×2100 → 2010×2814). */
const LEGACY_HIGH_RES_SCALE = 1.34;

/** Default canvas width stored in localStorage and used on first load. */
const DEFAULT_CARD_WIDTH = 2010;

/** Default canvas height stored in localStorage and used on first load. */
const DEFAULT_CARD_HEIGHT = 2814;

/** Minimum accepted value (px) for canvas width or height in the settings UI. */
const MIN_CANVAS_SIZE = 100;

/** API endpoint that returns predefined card-size profiles. */
const CARD_SIZE_PROFILES_ENDPOINT = '/api/card-image/size-profiles';

/** localStorage key for the selected card-size profile name. */
const LS_CARD_SIZE_PROFILE = 'selectedCardSizeProfile';

// ── Text Rendering ────────────────────────────────────────────────────────────

/**
 * Pixel padding added around both axes of each temporary text canvas so that
 * glyphs near the edge are never clipped.
 */
const TEXT_CANVAS_MARGIN = 300;

/**
 * The fraction of a text em-square that constitutes the cap-height.
 * Used to align rendered glyphs vertically within their bounding box.
 */
const TEXT_FONT_HEIGHT_RATIO = 0.7;

/**
 * Default width passed to the justify-text helper when a line's width has not
 * yet been measured.  Overwritten at runtime during each line render.
 */
const JUSTIFY_WIDTH_DEFAULT = 90;

/**
 * A deliberately unusual string used as a temporary token when splitting and
 * re-joining raw oracle text for per-word rendering.
 */
const TEXT_SPLIT_STRING = '6GJt7eL8';

// ── Timing / Debounce ─────────────────────────────────────────────────────────

/** Milliseconds to wait after the last keystroke before re-rendering text. */
const DEBOUNCE_TEXT_MS = 500;

/**
 * Milliseconds to wait after a text or frame change before re-running the
 * automatic frame-version detection.
 */
const DEBOUNCE_AUTOFRAME_MS = 500;

/**
 * Milliseconds before station-card import synchronises DOM checkboxes and
 * badge value inputs with the loaded card state.
 */
const DEBOUNCE_STATION_IMPORT_MS = 100;

/** Milliseconds before forcing a station canvas redraw after import DOM sync. */
const DEBOUNCE_STATION_REDRAW_MS = 50;

// ── Serial Number Geometry ────────────────────────────────────────────────────
// All pixel values are defined relative to the SERIAL_REFERENCE_WIDTH ×
// SERIAL_REFERENCE_HEIGHT coordinate space (2010 × 2814).

/** Reference canvas width against which all serial pixel co-ordinates are expressed. */
const SERIAL_REFERENCE_WIDTH = 2010;

/** Reference canvas height against which all serial pixel co-ordinates are expressed. */
const SERIAL_REFERENCE_HEIGHT = 2814;

/** Default X origin (px, in reference space) for the serial stamp image. */
const SERIAL_DEFAULT_X = 172;

/** Default Y origin (px, in reference space) for the serial stamp image. */
const SERIAL_DEFAULT_Y = 1383;

/** Width (px, in reference space) of the serial stamp sprite. */
const SERIAL_STAMP_WIDTH = 464;

/** Height (px, in reference space) of the serial stamp sprite. */
const SERIAL_STAMP_HEIGHT = 143;

/** X offset from the stamp origin to the start of the "number" text field. */
const SERIAL_NUMBER_INNER_X = 30;

/** X offset from the stamp origin to the start of the "total" text field. */
const SERIAL_TOTAL_INNER_X = 251;

/** Y offset from the stamp origin to the baseline of both serial text fields. */
const SERIAL_TEXT_INNER_Y = 52;

/** Width (px, reference space) of each serial text field. */
const SERIAL_TEXT_FIELD_WIDTH = 190;

/** Height (px, reference space) of each serial text field (also used as font size). */
const SERIAL_TEXT_FIELD_HEIGHT = 55;

// ── Corner Cutout ─────────────────────────────────────────────────────────────

/**
 * Side length (px, in reference space) of each rounded corner cutout sprite.
 * Scaled proportionally to the current canvas width at draw time.
 */
const CORNER_CUTOUT_SIZE = 59;

// ── Export / Download ─────────────────────────────────────────────────────────

/**
 * Quality value (0–1) passed to {@link HTMLCanvasElement.toDataURL} when
 * exporting JPEG in the local-canvas fallback path.
 * The server-side path always receives lossless PNG; this only applies when
 * the server is unreachable.
 */
const JPEG_FALLBACK_QUALITY = 0.8;

/** Default file name (without extension) suggested when saving a bulk ZIP. */
const BULK_ZIP_FILENAME = 'CardConjurer_Bulk.zip';

// ── Import / Parsing ──────────────────────────────────────────────────────────

/**
 * Oracle-text tokens that should NOT be wrapped in italic markup during
 * Scryfall import, even though they typically appear before an em-dash.
 * @type {readonly string[]}
 */
const ITALIC_EXEMPTIONS = Object.freeze([
	'Boast', 'Cycling', 'Visit', 'Prize',
	'I', 'II', 'III', 'IV',
	'I, II', 'II, III', 'III, IV',
	'I, II, III', 'II, III, IV', 'I, II, III, IV',
	'• Khans', '• Dragons', '• Mirran', '• Phyrexian',
	'Prototype', 'Companion', 'To solve', 'Solved',
]);

// ── Set Symbol Aliases ────────────────────────────────────────────────────────

/**
 * Maps collector/set codes that Scryfall uses to the code the symbol-fetch
 * endpoint actually expects.
 * @type {Map<string, string>}
 */
const setSymbolAliases = new Map([
	['anb', 'ana'],
	['tsb', 'tsp'],
	['pmei', 'sld'],
]);

// ── Mana Symbol Registry ──────────────────────────────────────────────────────

/**
 * Global registry of all mana/cost symbols.  Keyed by symbol name (e.g. 'w',
 * 'wu', '+1').  Populated at startup by {@link loadManaSymbols}.
 * @type {Map<string, object>}
 */
const mana = new Map();

// Standard single-pip and generic symbols
loadManaSymbols([
	'0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
	'10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
	'w', 'u', 'b', 'r', 'g', 'c', 'x', 'y', 'z',
	't', 'untap', 's', 'oldtap', 'originaltap',
	'purple', 'inf', 'alchemy',
]);

// Phyrexian / energy / acorn — served from a subdirectory
loadManaSymbols(/* matchColor= */ true, ['e', 'a', 'p']);

// Hybrid, Phyrexian-hybrid, and colourless-hybrid symbols (1.2 × 1.2 scale)
loadManaSymbols([
	'wu', 'wb', 'ub', 'ur', 'br', 'bg', 'rg', 'rw', 'gw', 'gu',
	'2w', '2u', '2b', '2r', '2g',
	'wp', 'up', 'bp', 'rp', 'gp', 'h',
	'wup', 'wbp', 'ubp', 'urp', 'brp', 'bgp', 'rgp', 'rwp', 'gwp', 'gup',
	'purplew', 'purpleu', 'purpleb', 'purpler', 'purpleg',
	'2purple', 'purplep',
	'cw', 'cu', 'cb', 'cr', 'cg',
], [1.2, 1.2]);

// Divider bars (referenced by filename including extension)
loadManaSymbols(['bar.png', 'whitebar.png']);

// Brush strokes used for flavour / watermark overlays
loadManaSymbols(['brush', 'whitebrush'], [2.85, 2.85]);

// Five-colour wedge / shard symbols (1.2 × 1.2 scale)
loadManaSymbols([
	'xxbgw', 'xxbrg', 'xxgub', 'xxgwu', 'xxrgw',
	'xxrwu', 'xxubr', 'xxurg', 'xxwbr', 'xxwub',
], [1.2, 1.2]);

// Planechase chaos symbol (matchColor path, 1.2 × 1.0 scale)
loadManaSymbols(/* matchColor= */ true, ['chaos'], [1.2, 1]);

// Token indicator (0.8 × 1.0)
loadManaSymbols(/* matchColor= */ true, ['tk'], [0.8, 1]);

// Planeswalker spark icon (0.6 × 1.2)
loadManaSymbols(/* matchColor= */ true, ['planeswalker'], [0.6, 1.2]);

// Loyalty ability cost counters (+N / -N, 1.6 × 1.0)
loadManaSymbols(/* matchColor= */ true, [
	'+1', '+2', '+3', '+4', '+5', '+6', '+7', '+8', '+9',
	'-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8', '-9', '+0',
], [1.6, 1]);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers one or more mana symbols in the global {@link mana} Map and
 * pre-loads their images.
 *
 * Signature overloads
 * -------------------
 * ```
 * loadManaSymbols(paths)
 * loadManaSymbols(paths, size)
 * loadManaSymbols(true, paths)
 * loadManaSymbols(true, paths, size)
 * ```
 *
 * @param {boolean|Array} matchColor
 *   When `true`, the symbol images are served from a colour-matched
 *   subdirectory instead of the default `/img/manaSymbols/` root.
 *   Pass the path array directly as the first argument to use the default.
 * @param {Array}  manaSymbolPaths
 *   Array of symbol paths/names to register.  Each element may be:
 *   - a plain string (e.g. `'w'`, `'wu'`, `'bar.png'`), or
 *   - an array `[path, backSuffix, backCount]` for symbols that have
 *     alternate "back" art variants.
 * @param {[number, number]} [size=[1,1]]
 *   `[width, height]` scale multipliers applied when rendering this symbol
 *   relative to the current text size.
 */
function loadManaSymbols(matchColor, manaSymbolPaths, size = [1, 1]) {
	if (typeof matchColor === 'object') {
		// Shift arguments when matchColor is omitted (defaults to false).
		size = manaSymbolPaths || [1, 1];
		manaSymbolPaths = matchColor;
		matchColor = false;
	}

	manaSymbolPaths.forEach(item => {
		/** @type {{name:string, path:string, matchColor:boolean, width:number, height:number, image:HTMLImageElement, back?:string, backs?:number}} */
		var manaSymbol = {};

		if (typeof item === 'string') {
			manaSymbol.name = item.split('.')[0];
			manaSymbol.path = item;
		} else {
			manaSymbol.name = item[0].split('.')[0];
			manaSymbol.path = item[0];
		}

		// Strip any leading directory segments from the name.
		if (manaSymbol.name.includes('/')) {
			const parts = manaSymbol.name.split('/');
			manaSymbol.name = parts[parts.length - 1];
		}

		if (typeof item !== 'string') {
			manaSymbol.back  = item[1];
			manaSymbol.backs = item[2];
			for (var i = 0; i < item[2]; i++) {
				loadManaSymbols([manaSymbol.path.replace(manaSymbol.name, 'back' + i + item[1])]);
			}
		}

		manaSymbol.matchColor = matchColor;
		manaSymbol.width      = size[0];
		manaSymbol.height     = size[1];
		manaSymbol.image      = new Image();
		manaSymbol.image.crossOrigin = 'anonymous';

		var manaSymbolPath = '/img/manaSymbols/' + manaSymbol.path;
		if (!manaSymbolPath.includes('.png')) {
			manaSymbolPath += '.svg';
		}
		manaSymbol.image.src = fixUri(manaSymbolPath);

		mana.set(manaSymbol.name, manaSymbol);
	});
}

/**
 * Looks up a mana symbol by name in the global registry.
 * @param {string} key - The symbol name (e.g. `'w'`, `'wu'`, `'+1'`).
 * @returns {object|undefined} The symbol descriptor, or `undefined` if not found.
 */
function getManaSymbol(key) {
	return mana.get(key);
}

/**
 * @deprecated Use {@link getManaSymbol} directly.
 * @param {string} string - The symbol name to look up.
 * @returns {object|number} The symbol descriptor, or -1 if not found.
 */
function findManaSymbolIndex(string) {
	return mana.get(string) ?? -1;
}
