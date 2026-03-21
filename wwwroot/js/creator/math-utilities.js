/**
 * math-utilities.js - Canvas scaling and card sizing utility functions
 * Handles conversion between card coordinates and canvas pixel coordinates
 */

/**
 * Scales an X coordinate from card space to canvas space, accounting for margins.
 * @param {number} input - The X coordinate in card space
 * @returns {number} The scaled X coordinate in canvas pixels
 */
function scaleX(input) {
    return Math.round((input + card.marginX) * card.width);
}

/**
 * Scales a width value from card space to canvas space.
 * @param {number} input - The width in card space
 * @returns {number} The scaled width in canvas pixels
 */
function scaleWidth(input) {
    return Math.round(input * card.width);
}

/**
 * Scales a Y coordinate from card space to canvas space, accounting for margins.
 * @param {number} input - The Y coordinate in card space
 * @returns {number} The scaled Y coordinate in canvas pixels
 */
function scaleY(input) {
    return Math.round((input + card.marginY) * card.height);
}

/**
 * Scales a height value from card space to canvas space.
 * @param {number} input - The height in card space
 * @returns {number} The scaled height in canvas pixels
 */
function scaleHeight(input) {
    return Math.round(input * card.height);
}

/**
 * Ensures an offscreen canvas/context pair exists and sizes it for the current card.
 * @param {string} name - The base canvas name used for window globals like cardCanvas/cardContext
 * @param {number} width - The width in pixels (defaults to bleed size: cut width + 2*margin)
 * @param {number} height - The height in pixels (defaults to bleed size: cut height + 2*margin)
 */
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


