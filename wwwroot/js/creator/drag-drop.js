/**
 * drag-drop.js - Frame list drag-and-drop and touch-reorder event handlers.
 * Functions here are assigned programmatically to frame list elements in creator-23.js.
 * Dependencies (frameElementClicked, removeFrame, drawFrames, card.frames) remain global in creator-23.js.
 */

/**
 * Marks the dragged element and clears any previous drag state.
 * @param {DragEvent|TouchEvent} event
 */
function dragStart(event) {
    Array.from(document.querySelectorAll('.dragging')).forEach(element => element.classList.remove('dragging'));
    event.target.closest('.draggable').classList.add('dragging');
}

/**
 * Clears the dragging marker when a drag gesture ends.
 * @param {DragEvent|TouchEvent} event
 */
function dragEnd(event) {
    Array.from(document.querySelectorAll('.dragging')).forEach(element => element.classList.remove('dragging'));
}

/**
 * Handles touch-based reordering by delegating to dragOver for the element under the finger.
 * @param {TouchEvent} event
 */
function touchMove(event) {
    if (event.target.nodeName != 'H4') {
        event.preventDefault();
    }
    var clientY = event.touches[0].clientY;
    Array.from(document.querySelector('.dragging').parentElement.children).forEach(element => {
        var elementBounds = element.getBoundingClientRect();
        if (clientY > elementBounds.top && clientY < elementBounds.bottom) {
            dragOver(element, false);
        }
    });
}

/**
 * Reorders the frame list when a draggable element is moved over another.
 * Rebuilds the DOM list and updates card.frames to match the new order, then redraws.
 * @param {DragEvent|Element} event - A DragEvent (drag=true) or the target element directly (drag=false)
 * @param {boolean} drag - Whether the first argument is a DragEvent
 */
function dragOver(event, drag = true) {
    var eventTarget;
    if (drag) {
        eventTarget = event.target.closest('.draggable');
    } else {
        eventTarget = event;
    }
    var movingElement = document.querySelector('.dragging');
    if (!movingElement || eventTarget.classList.contains('dragging') || eventTarget.parentElement !== movingElement.parentElement) {
        return;
    }

    var parentElement = eventTarget.parentElement;
    var elements = document.createDocumentFragment();
    var movingElementPassed = false;
    var movingElementOldIndex = -1;
    var movingElementNewIndex = -1;

    Array.from(parentElement.children).forEach((element, index) => {
        if (element === eventTarget) {
            movingElementNewIndex = index;
            if (movingElementPassed) {
                elements.appendChild(element.cloneNode(true));
                elements.appendChild(movingElement.cloneNode(true));
            } else {
                elements.appendChild(movingElement.cloneNode(true));
                elements.appendChild(element.cloneNode(true));
            }
        } else if (element !== movingElement) {
            elements.appendChild(element.cloneNode(true));
        } else {
            movingElementOldIndex = index;
            movingElementPassed = true;
        }
    });

    Array.from(elements.children).forEach(element => {
        element.ondragstart  = dragStart;
        element.ontouchstart = dragStart;
        element.ondragend    = dragEnd;
        element.ontouchend   = dragEnd;
        element.ondragover   = dragOver;
        element.ontouchmove  = touchMove;
        element.onclick      = frameElementClicked;
        element.children[3].onclick = removeFrame;
    });

    parentElement.innerHTML = null;
    parentElement.appendChild(elements);

    if (movingElementNewIndex >= 0) {
        var originalMovingElement = card.frames[movingElementOldIndex];
        card.frames.splice(movingElementOldIndex, 1);
        card.frames.splice(movingElementNewIndex, 0, originalMovingElement);
        drawFrames();
    }
}

