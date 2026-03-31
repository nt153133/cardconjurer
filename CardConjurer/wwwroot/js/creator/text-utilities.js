/**
 * text-utilities.js - Text formatting and manipulation utilities
 * Handles text truncation, preview display, and other text processing
 */

/**
 * Truncates text to a maximum length, appending ellipsis if truncated.
 * @param {*} value - The value to truncate (will be converted to string)
 * @param {number} maxLength - Maximum length before truncation (default: 96)
 * @returns {string} The truncated text
 */
function truncateInfoText(value, maxLength = 96) {
    var text = String(value || '');
    if (text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength - 3) + '...';
}

/**
 * Updates the preview info display with current card size, name, and art URL.
 * Displays in the creator sidebar information box.
 */
function updateCreatorPreviewInfo() {
    var sizeEl = document.querySelector('#creator-info-size');
    var nameEl = document.querySelector('#creator-info-loaded-name');
    var artEl = document.querySelector('#creator-info-art-url');
    if (!sizeEl || !nameEl || !artEl) {
        return;
    }

    var width = Number(card && card.width) || 0;
    var height = Number(card && card.height) || 0;
    sizeEl.textContent = width + ' x ' + height + ' px';

    nameEl.textContent = _currentLoadedCardName || 'Not loaded';
    nameEl.title = _currentLoadedCardName || '';

    var artUrl = card && card.artSource ? String(card.artSource) : '/img/blank.png';
    artEl.textContent = truncateInfoText(artUrl);
    artEl.title = artUrl;
}

/**
 * Reloads the page after confirming the user wants to discard unsaved changes.
 */
function createNewCardFromPreview() {
    if (!confirm('Create a new card? Unsaved changes will be lost.')) {
        return;
    }
    window.location.reload();
}


