/**
 * shell-helpers.js - Lightweight creator shell/UI helpers.
 * Keeps inline Razor handlers and frame-pack scripts working while reducing creator-23.js size.
 */

/**
 * Returns the index of an element among its siblings.
 * @param {Element} element
 * @returns {number}
 */
function getElementIndex(element) {
    return Array.prototype.indexOf.call(element.parentElement.children, element);
}

/**
 * Builds the saved/exported card name from the current card title and nickname.
 * @returns {string}
 */
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

/**
 * Builds the inline display name for UI surfaces that prefer nickname-first behavior.
 * @returns {string}
 */
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

/**
 * Shows a creator tab section and marks its tab as selected.
 * @param {Event} event
 * @param {string} target
 */
function toggleCreatorTabs(event, target) {
    Array.from(document.querySelector('#creator-menu-sections').children).forEach(element => element.classList.add('hidden'));
    document.querySelector('#creator-menu-' + target).classList.remove('hidden');
    selectSelectable(event);
}

/**
 * Marks the clicked selectable control as selected within its siblings.
 * @param {Event} event
 */
function selectSelectable(event) {
    var eventTarget = event.target.closest('.selectable');
    Array.from(eventTarget.parentElement.children).forEach(element => element.classList.remove('selected'));
    eventTarget.classList.add('selected');
}

/**
 * Lazily loads the tutorial video only when the tab is opened.
 */
function loadTutorialVideo() {
    var video = document.querySelector('.video > iframe');
    if (video.src == '') {
        video.src = 'https://www.youtube-nocookie.com/embed/e4tnOiub41g?rel=0';
    }
}

/**
 * Highlights preview transparency areas with a magenta background.
 * @param {boolean} highlight
 */
function toggleCardBackgroundColor(highlight) {
    if (highlight) {
        previewCanvas.style['background-color'] = '#ff007fff';
    } else {
        previewCanvas.style['background-color'] = '#0000';
    }
}

