/**
 * Frame Tab UI helpers (safe split): namespaced picker/mask interactions only.
 * This file intentionally avoids overriding runtime globals like addFrame.
 */
(function () {
    const state = {
        selectedFrameIndex: 0,
        selectedMaskIndex: 0,
        lastFrameClick: null,
        lastMaskClick: null
    };

    function getFrames() {
        return window.availableFrames || [];
    }

    function loadFramePacks(framePackOptions = []) {
        const select = document.querySelector('#selectFramePack');
        if (!select) {
            return;
        }
        select.innerHTML = null;
        framePackOptions.forEach(item => {
            const option = document.createElement('option');
            option.innerHTML = item.name;
            if (item.value === 'disabled') {
                option.disabled = true;
            } else {
                option.value = item.value;
            }
            select.appendChild(option);
        });
        loadScript('/js/frames/pack' + select.value + '.js');
    }

    function loadFramePack(frameOptions = getFrames()) {
        resetDoubleClick();
        const framePicker = document.querySelector('#frame-picker');
        const maskPicker = document.querySelector('#mask-picker');
        if (!framePicker || !maskPicker) {
            return;
        }

        framePicker.innerHTML = null;
        frameOptions.forEach(item => {
            const frameOption = document.createElement('div');
            frameOption.classList = 'frame-option hidden';
            frameOption.onclick = frameOptionClicked;
            const img = document.createElement('img');
            frameOption.appendChild(img);
            img.onload = function () {
                this.parentElement.classList.remove('hidden');
            };
            if (!item.noThumb && !item.src.includes('/img/black.png')) {
                img.src = fixUri(item.src.replace('.png', 'Thumb.png').replace('.svg', 'Thumb.png'));
            } else {
                img.src = fixUri(item.src);
            }
            framePicker.appendChild(frameOption);
        });

        maskPicker.innerHTML = '';
        if (framePicker.children.length > 0) {
            framePicker.children[0].click();
        }
        if (localStorage.getItem('autoLoadFrameVersion') === 'true') {
            document.querySelector('#loadFrameVersion')?.click();
        }
    }

    function autoLoadFrameVersion() {
        localStorage.setItem('autoLoadFrameVersion', document.querySelector('#autoLoadFrameVersion')?.checked ? 'true' : 'false');
    }

    function frameOptionClicked(event) {
        const button = doubleClick(event, 'frame');
        const clicked = event.target.closest('.frame-option');
        if (!clicked) {
            return;
        }

        const frames = getFrames();
        const newIndex = getElementIndex(clicked);
        const maskPicker = document.querySelector('#mask-picker');
        if (!maskPicker) {
            return;
        }

        if (newIndex !== state.selectedFrameIndex || maskPicker.innerHTML === '') {
            resetDoubleClick();
            Array.from(document.querySelectorAll('.frame-option.selected')).forEach(el => el.classList.remove('selected'));
            clicked.classList.add('selected');
            state.selectedFrameIndex = newIndex;

            if (!frames[state.selectedFrameIndex]?.noDefaultMask) {
                const noMask = document.createElement('div');
                noMask.className = 'mask-option';
                noMask.onclick = maskOptionClicked;
                const noMaskImage = document.createElement('img');
                noMaskImage.src = black.src;
                noMaskImage.alt = 'No Mask';
                const noMaskLabel = document.createElement('p');
                noMaskLabel.textContent = 'No Mask';
                noMask.appendChild(noMaskImage);
                noMask.appendChild(noMaskLabel);
                maskPicker.innerHTML = '';
                maskPicker.appendChild(noMask);
            } else {
                maskPicker.innerHTML = '';
            }

            const selectedPreview = document.querySelector('#selectedPreview');
            if (selectedPreview && frames[state.selectedFrameIndex]) {
                selectedPreview.innerHTML = '(Selected: ' + frames[state.selectedFrameIndex].name + ', No Mask)';
            }

            if (frames[state.selectedFrameIndex]?.masks) {
                frames[state.selectedFrameIndex].masks.forEach(item => {
                    const option = document.createElement('div');
                    option.classList = 'mask-option hidden';
                    option.onclick = maskOptionClicked;
                    const img = document.createElement('img');
                    option.appendChild(img);
                    img.onload = function () { this.parentElement.classList.remove('hidden'); };
                    img.src = fixUri(item.src.replace('.png', 'Thumb.png').replace('.svg', 'Thumb.png'));
                    const label = document.createElement('p');
                    label.innerHTML = item.name;
                    option.appendChild(label);
                    maskPicker.appendChild(option);
                });
            }

            const firstChild = maskPicker.firstChild;
            if (firstChild) {
                firstChild.classList.add('selected');
                firstChild.click();
            }
        } else if (button) {
            button.click();
            resetDoubleClick();
        }
    }

    function maskOptionClicked(event) {
        let button = doubleClick(event, 'mask');
        const clicked = event.target.closest('.mask-option');
        if (!clicked) {
            return;
        }

        (document.querySelector('.mask-option.selected')?.classList || document.body.classList).remove('selected');
        clicked.classList.add('selected');
        const newIndex = getElementIndex(clicked);
        if (newIndex !== state.selectedMaskIndex) {
            button = null;
        }
        state.selectedMaskIndex = newIndex;

        const frames = getFrames();
        let selectedMaskName = 'No Mask';
        if (state.selectedMaskIndex > 0 && frames[state.selectedFrameIndex]?.masks) {
            selectedMaskName = frames[state.selectedFrameIndex].masks[state.selectedMaskIndex - 1].name;
        }
        const selectedPreview = document.querySelector('#selectedPreview');
        if (selectedPreview && frames[state.selectedFrameIndex]) {
            selectedPreview.innerHTML = '(Selected: ' + frames[state.selectedFrameIndex].name + ', ' + selectedMaskName + ')';
        }

        if (button) {
            button.click();
            resetDoubleClick();
        }
    }

    function resetDoubleClick() {
        state.lastFrameClick = null;
        state.lastMaskClick = null;
    }

    function doubleClick(event, maskOrFrame) {
        const currentClick = Date.now();
        let lastClick = null;
        if (maskOrFrame === 'mask') {
            lastClick = state.lastMaskClick;
            state.lastMaskClick = currentClick;
        } else {
            lastClick = state.lastFrameClick;
            state.lastFrameClick = currentClick;
        }

        if (lastClick && lastClick + 500 > currentClick) {
            let buttonID = '#addToFull';
            if (event.shiftKey) {
                buttonID = '#addToRightHalf';
            } else if (event.ctrlKey) {
                buttonID = '#addToLeftHalf';
            } else if (event.altKey) {
                buttonID = '#addToMiddleThird';
            }
            return document.querySelector(buttonID);
        }
        return null;
    }

    window.CreatorFrameTab = {
        state,
        loadFramePacks,
        loadFramePack,
        autoLoadFrameVersion,
        frameOptionClicked,
        maskOptionClicked,
        resetDoubleClick,
        doubleClick
    };
})();
