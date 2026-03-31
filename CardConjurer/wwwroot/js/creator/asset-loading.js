/**
 * ImageLoadTracker.js - Manages loading and waiting for images
 * Used during bulk download operations to ensure all card images are loaded
 */
window.ImageLoadTracker = {
    promises: [],
    isTracking: false,

    /**
     * Call this to start a new tracking session.
     */
    start: function () {
        this.promises = [];
        this.isTracking = true;
    },

    /**
     * Call this to end the session.
     */
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

/**
 * FontLoadTracker - Manages loading and waiting for fonts
 * Uses document.fonts API to ensure all custom fonts are available before rendering
 */
window.FontLoadTracker = {
    fonts: new Set(),
    isTracking: false,

    /**
     * Call this to start a new font tracking session.
     */
    start: function () {
        this.fonts.clear();
        this.isTracking = true;
    },

    /**
     * Call this to end the session.
     */
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

