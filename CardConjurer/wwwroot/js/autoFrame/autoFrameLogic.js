/**
 * Auto Frame Logic Module
 * Handles the autoFrame decision logic: color detection, frame type selection,
 * and dispatching to specific autoFrame variant functions.
 * Does NOT handle frame variant implementations (those are in autoFrameVariants.js).
 */

var autoFramePack;

function ensureAutoFrameHelpersLoaded() {
    var required = window.autoFrameHelperNames || [
        'makeM15FrameByLetter',
        'makeM15NewFrameByLetter',
        'makeM15EighthFrameByLetter',
        'makeM15EighthUBFrameByLetter',
        'makeBorderlessFrameByLetter',
        'make8thEditionFrameByLetter',
        'makeExtendedArtFrameByLetter',
        'makeUBFrameByLetter',
        'makeCircuitFrameByLetter',
        'makeEtchedFrameByLetter',
        'makePhyrexianFrameByLetter',
        'makeSeventhEditionFrameByLetter'
    ];

    var missing = required.filter(name => typeof window[name] !== 'function');
    if (missing.length > 0) {
        var message = 'Auto Frame helpers are not loaded yet. Please reload the page.';
        if (typeof notify === 'function') {
            notify(message, 5);
        }
        console.warn(message, missing);
        return false;
    }

    return true;
}

/**
 * Determines frame properties (colors, styles) for a card based on mana cost, type line, and rules text.
 * Used by autoFrame variants to select appropriate frame layers and styles.
 * @param {Array} colors - Array of color letters (W, U, B, R, G)
 * @param {string} manaCost - Mana cost text (e.g., "{2}{W}{B}")
 * @param {string} typeLine - Card type line
 * @param {string} power - Power/toughness (if present)
 * @param {string} style - Optional style modifier (e.g., 'Seventh', 'Etched', 'Borderless')
 * @returns {Object} Properties object with pinline, rules, typeTitle, pt, frame, etc.
 */
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

/**
 * Toggles the "always use Nyx frames" setting for enchantments.
 */
function setAutoframeNyx(value) {
    localStorage.setItem('autoframe-always-nyx', document.querySelector('#autoframe-always-nyx').checked);
    autoFrame();
}

/**
 * Main autoFrame dispatcher. Detects card colors and selects appropriate frame variant.
 * Parses mana cost, type line, and rules text to determine card colors.
 * For lands, reads the rules text to identify color production.
 */
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

    if (!ensureAutoFrameHelpersLoaded()) {
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

    if (frame == 'M15Regular-1') {
        autoM15Frame(colors, manaText, typeText, ptText);
    } else if (frame == 'M15RegularNew') {
        autoM15NewFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'M15Eighth') {
        autoM15EighthFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'M15EighthUB') {
        autoM15EighthUBFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'UB') {
        autoUBFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'UBNew') {
        autoUBNewFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'FullArtNew') {
        autoFullArtNewFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'Circuit') {
        autoCircuitFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'Etched') {
        autoEtchedFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'Praetors') {
        autoPhyrexianFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'Seventh') {
        autoSeventhEditionFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'M15BoxTopper') {
        autoExtendedArtFrame(colors, manaText, typeText, ptText, false);
    } else if (frame == 'M15ExtendedArtShort') {
        autoExtendedArtFrame(colors, manaText, typeText, ptText, true);
    } else if (frame == '8th') {
        auto8thEditionFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'Borderless') {
        autoBorderlessFrame(colors, manaText, typeText, ptText);
    } else if (frame == 'BorderlessUB') {
        autoBorderlessUBFrame(colors, manaText, typeText, ptText);
        frame = 'Borderless';
    }
}

