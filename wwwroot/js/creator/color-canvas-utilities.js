/**
 * color-canvas-utilities.js - Pure color math, canvas pixel manipulation, and minor text/geometry helpers.
 * All functions here are stateless utilities with no DOM or card-object dependencies.
 *
 * shoutout to https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
 * for the HSL⟷RGB conversion algorithms.
 */

/**
 * Applies HSL adjustment deltas to every pixel of a canvas in-place.
 * @param {HTMLCanvasElement} canvas
 * @param {number} inputH - Hue shift in degrees (-180 to 180)
 * @param {number} inputS - Saturation shift in percent (-100 to 100)
 * @param {number} inputL - Lightness shift in percent (-100 to 100)
 */
function hsl(canvas, inputH, inputS, inputL) {
    var hue = parseInt(inputH) / 360;
    var saturation = parseInt(inputS) / 100;
    var lightness = parseInt(inputL) / 100;
    var context = canvas.getContext('2d');
    var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    var pixels = imageData.data;
    for (var i = 0; i < pixels.length; i += 4) {
        var r = pixels[i];
        var g = pixels[i + 1];
        var b = pixels[i + 2];
        var res = rgbToHSL(r, g, b);
        var h = res[0];
        var s = res[1];
        var l = res[2];
        h += hue;
        while (h > 1) { h--; }
        s = Math.min(Math.max(s + saturation, 0), 1);
        l = Math.min(Math.max(l + lightness, 0), 1);
        res = hslToRGB(h, s, l);
        pixels[i]     = res[0];
        pixels[i + 1] = res[1];
        pixels[i + 2] = res[2];
    }
    context.putImageData(imageData, 0, 0);
}

/**
 * Returns a new canvas tightly cropped to the non-transparent pixels of the source.
 * @param {HTMLCanvasElement} oldCanvas
 * @param {number} sensitivity - Alpha threshold (0–255) below which pixels are ignored
 * @returns {HTMLCanvasElement}
 */
function croppedCanvas(oldCanvas, sensitivity = 0) {
    var oldContext = oldCanvas.getContext('2d');
    var newCanvas = document.createElement('canvas');
    var newContext = newCanvas.getContext('2d');
    var pixels = oldContext.getImageData(0, 0, oldCanvas.width, oldCanvas.height).data;
    var pixX = [];
    var pixY = [];
    for (var x = 0; x < oldCanvas.width; x++) {
        for (var y = 0; y < oldCanvas.height; y++) {
            if (pixels[(y * oldCanvas.width + x) * 4 + 3] > sensitivity) {
                pixX.push(x);
                pixY.push(y);
            }
        }
    }
    pixX.sort((a, b) => a - b);
    pixY.sort((a, b) => a - b);
    var n = pixX.length - 1;
    var newWidth  = 1 + pixX[n] - pixX[0];
    var newHeight = 1 + pixY[n] - pixY[0];
    newCanvas.width  = newWidth;
    newCanvas.height = newHeight;
    newContext.putImageData(oldContext.getImageData(pixX[0], pixY[0], newWidth, newHeight), 0, 0);
    return newCanvas;
}

/**
 * Converts an RGB triplet to HSL.
 * @param {number} r @param {number} g @param {number} b
 * @returns {[number, number, number]} [h, s, l] each in [0, 1]
 */
function rgbToHSL(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}

/**
 * Converts an HSL triplet to RGB.
 * @param {number} h @param {number} s @param {number} l  each in [0, 1]
 * @returns {[number, number, number]} [r, g, b] each in [0, 255]
 */
function hslToRGB(h, s, l) {
    var r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        var hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Converts typographic straight quotes to curly (smart) quotes.
 * @param {string} input
 * @returns {string}
 */
function curlyQuotes(input) {
    return input
        .replace(/ '/g, ' \u2018').replace(/^'/, '\u2018').replace(/'/g, '\u2019')
        .replace(/ "/g, ' \u201C').replace(/" /g, '\u201D ').replace(/\."/g, '.\u201D')
        .replace(/"$/, '\u201D').replace(/"\)/g, '\u201D)').replace(/"/g, '\u201C');
}

/**
 * Replaces CSS named colours with their Magic card hex equivalents for pinline rendering.
 * @param {string} color
 * @returns {string}
 */
function pinlineColors(color) {
    return color
        .replace('white', '#fcfeff')
        .replace('blue',  '#0075be')
        .replace('black', '#272624')
        .replace('red',   '#ef3827')
        .replace('green', '#007b43');
}

/**
 * Converts a chord width to the equivalent rotation angle for a given radius (arc text).
 * @param {number} width
 * @param {number} radius
 * @returns {number} angle in radians
 */
function widthToAngle(width, radius) {
    return width / radius;
}

