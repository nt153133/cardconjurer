/**
 * Frame Tab UI Module
 * Handles all Frame tab interactions: frame picker, mask picker, frame pack loading,
 * frame additions to card, and frame library management. Does NOT handle autoFrame logic.
 */

// Frame picker state
var availableFrames = [];
var selectedFrameIndex = 0;
var selectedMaskIndex = 0;
var replacementMasks = {};
var lastFrameClick = null;
var lastMaskClick = null;

/**
 * Loads a set of frame pack options into the #selectFramePack dropdown.
 * @param {Array} framePackOptions - Array of {name, value} objects
 */
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

/**
 * Populates the frame picker UI with available frame options.
 * @param {Array} frameOptions - Array of frame objects (default: availableFrames)
 */
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

/**
 * Toggles the auto-load-frame-version setting.
 */
function autoLoadFrameVersion() {
    localStorage.setItem('autoLoadFrameVersion', document.querySelector('#autoLoadFrameVersion').checked);
}

/**
 * Handles click on a frame option in the frame picker.
 */
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

/**
 * Handles click on a mask option in the mask picker.
 */
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

/**
 * Resets double-click tracking variables.
 */
function resetDoubleClick() {
    lastFrameClick, lastMaskClick = null, null;
}

/**
 * Detects double-click on frame or mask and returns the corresponding button element if double-clicked.
 * Modifier keys determine which button is returned (full, right half, left half, middle third).
 * @param {Event} event - The click event
 * @param {string} maskOrFrame - Either 'mask' or 'frame'
 * @returns {Element|null} - Button element if double-clicked, null otherwise
 */
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

/**
 * Adds a frame (and optionally masks) to the card. Updates the card object and frame list UI.
 * @param {Array} additionalMasks - Optional array of mask objects to apply
 * @param {Object} loadingFrame - Optional frame object being loaded (vs user-selected)
 */
async function addFrame(additionalMasks = [], loadingFrame = false) {
    var selectedFrame = availableFrames[selectedFrameIndex];
    var masks = [];
    if (selectedMaskIndex != 0 && selectedFrame.masks && selectedFrame.masks[selectedMaskIndex - 1]) {
        masks.push(selectedFrame.masks[selectedMaskIndex - 1]);
    }

    masks = masks.concat(additionalMasks);

    var frame = JSON.parse(JSON.stringify(selectedFrame));
    frame.masks = masks;

    if (frame.name) {
        var index = card.frames.length;
        card.frames.push(frame);

        var frameElement = document.createElement('div');
        frameElement.classList = 'frame-option';
        frameElement.id = 'frame-list-element-' + index;

        var img = document.createElement('img');
        if (!frame.noThumb) {
            img.src = fixUri(frame.src.replace('.png', 'Thumb.png').replace('.svg', 'Thumb.png'));
        } else {
            img.src = fixUri(frame.src);
        }

        var title = document.createElement('p');
        title.innerHTML = frame.name;
        title.style.wordBreak = 'break-word';

        frameElement.appendChild(img);
        frameElement.appendChild(title);

        frameElement.onclick = async function () {
            await openFrameElementEditor(index);
        }

        frameElement.addEventListener('dragstart', function (e) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
            dragElement = frameElement;
        });

        frameElement.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        frameElement.addEventListener('drop', async function (e) {
            e.preventDefault();
            if (dragElement && dragElement != frameElement) {
                var fromIndex = parseInt(dragElement.id.replace('frame-list-element-', ''));
                var toIndex = parseInt(frameElement.id.replace('frame-list-element-', ''));

                var temp = card.frames[fromIndex];
                card.frames[fromIndex] = card.frames[toIndex];
                card.frames[toIndex] = temp;

                dragElement.id = 'frame-list-element-' + toIndex;
                frameElement.id = 'frame-list-element-' + fromIndex;

                drawCard();
            }
        });

        frameElement.draggable = true;

        document.querySelector('#frame-list').appendChild(frameElement);
    }

    drawCard();
}

/**
 * Uploads frame files from user to server.
 * @param {FileList} filesRaw - Files selected by user
 */
async function uploadFrameFilesToServer(filesRaw) {
    assetLibraryUpload(filesRaw);
    _assetLibraryKind = 'frames';
}

/**
 * Refreshes the frame library select dropdown with available uploaded frames.
 */
async function refreshFrameLibrarySelect() {
    var selectElement = document.querySelector('#frame-library-select');
    selectElement.innerHTML = '<option selected="selected">Loading uploaded frames...</option>';
    await loadAssetLibrary();

    var frameLibraryItems = assetLibrary.frames || [];

    selectElement.innerHTML = '<option value="" selected="selected">Choose a frame image...</option>';
    frameLibraryItems.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item.url;
        option.innerHTML = item.name;
        selectElement.appendChild(option);
    });
}

/**
 * Selects a frame from the library and prepares it for upload.
 * @param {Element} selectElement - The select dropdown element
 */
function selectFrameLibrarySource(selectElement) {
    if (selectElement.value) {
        imageURL(selectElement.value, uploadFrameOption);
        selectElement.value = '';
    }
}

