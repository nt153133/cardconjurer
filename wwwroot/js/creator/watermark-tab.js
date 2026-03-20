// Watermark tab logic: watermark source loading, uploaded source selection,
// watermark color/placement rendering, reset behavior, and set-code SVG watermark import.

function uploadWatermark(imageSource, otherParams) {
    ImageLoadTracker.track(imageSource);
    watermark.src = imageSource;
    if (otherParams && otherParams == 'resetWatermark') {
        watermark.onload = function () {
            resetWatermark();
            watermark.onload = watermarkEdited;
        };
    }
}

async function uploadWatermarkFilesToServer(filesRaw, otherParams = 'resetWatermark') {
    await uploadFilesToServerByKind(filesRaw, 'watermarks', uploadWatermark, otherParams, refreshWatermarkLibrarySelect);
}

async function refreshWatermarkLibrarySelect() {
    await creatorAssetLibrary.refreshLibrarySelect('#watermark-library-select', 'watermarks', {
        noneText: 'None selected',
        errorText: 'Failed to load uploaded watermarks'
    });
}

function selectWatermarkLibrarySource(element) {
    creatorAssetLibrary.selectLibrarySource(element, (url) => {
        uploadWatermark(url, 'resetWatermark');
    });
}

function watermarkLeftColor(c) {
    card.watermarkLeft = c;
    watermarkEdited();
}

function watermarkRightColor(c) {
    card.watermarkRight = c;
    watermarkEdited();
}

function watermarkEdited() {
    card.watermarkSource = watermark.src;
    card.watermarkX = document.querySelector('#watermark-x').value / card.width;
    card.watermarkY = document.querySelector('#watermark-y').value / card.height;
    card.watermarkZoom = document.querySelector('#watermark-zoom').value / 100;
    if (card.watermarkLeft == 'none' && document.querySelector('#watermark-left').value != 'none') {
        card.watermarkLeft = document.querySelector('#watermark-left').value;
    }
    // card.watermarkLeft = document.querySelector('#watermark-left').value;
    // card.watermarkRight =  document.querySelector('#watermark-right').value;
    card.watermarkOpacity = document.querySelector('#watermark-opacity').value / 100;
    watermarkContext.globalCompositeOperation = 'source-over';
    watermarkContext.globalAlpha = 1;
    watermarkContext.clearRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
    if (card.watermarkLeft != 'none' && !card.watermarkSource.includes('/blank.png') && card.watermarkZoom > 0) {
        if (card.watermarkRight != 'none') {
            watermarkContext.drawImage(right, scaleX(0), scaleY(0), scaleWidth(1), scaleHeight(1));
            watermarkContext.globalCompositeOperation = 'source-in';
            if (card.watermarkRight == 'default') {
                watermarkContext.drawImage(watermark, scaleX(card.watermarkX), scaleY(card.watermarkY), watermark.width * card.watermarkZoom, watermark.height * card.watermarkZoom);
            } else {
                watermarkContext.fillStyle = card.watermarkRight;
                watermarkContext.fillRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
            }
            watermarkContext.globalCompositeOperation = 'destination-over';
        }
        if (card.watermarkLeft == 'default') {
            watermarkContext.drawImage(watermark, scaleX(card.watermarkX), scaleY(card.watermarkY), watermark.width * card.watermarkZoom, watermark.height * card.watermarkZoom);
        } else {
            watermarkContext.fillStyle = card.watermarkLeft;
            watermarkContext.fillRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
        }
        watermarkContext.globalCompositeOperation = 'destination-in';
        watermarkContext.drawImage(watermark, scaleX(card.watermarkX), scaleY(card.watermarkY), watermark.width * card.watermarkZoom, watermark.height * card.watermarkZoom);
        watermarkContext.globalAlpha = card.watermarkOpacity;
        watermarkContext.fillRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
    }
    drawCard();
}

function resetWatermark() {
    var watermarkZoom;
    if (watermark.width / watermark.height > scaleWidth(card.watermarkBounds.width) / scaleHeight(card.watermarkBounds.height)) {
        watermarkZoom = (scaleWidth(card.watermarkBounds.width) / watermark.width * 100).toFixed(1);
    } else {
        watermarkZoom = (scaleHeight(card.watermarkBounds.height) / watermark.height * 100).toFixed(1);
    }
    document.querySelector('#watermark-zoom').value = watermarkZoom;
    document.querySelector('#watermark-x').value = Math.round(scaleX(card.watermarkBounds.x) - watermark.width * watermarkZoom / 200 - scaleWidth(card.marginX));
    document.querySelector('#watermark-y').value = Math.round(scaleY(card.watermarkBounds.y) - watermark.height * watermarkZoom / 200 - scaleHeight(card.marginY));
    watermarkEdited();
}

// SVG cropper for Keyrune set-code based watermarks.
function getSetSymbolWatermark(url, targetImage = watermark) {
    if (!url.includes('/')) {
        url = 'https://cdn.jsdelivr.net/npm/keyrune/svg/' + url + '.svg';
    }
    xhttp = new XMLHttpRequest();
    xhttp.open('GET', url, true);
    xhttp.overrideMimeType('image/svg+xml');
    xhttp.onload = function(event) {
        if (this.readyState == 4 && this.status == 200) {
            var svg = document.body.appendChild(xhttp.responseXML.documentElement);
            var box = svg.getBBox(svg);
            svg.setAttribute('viewBox', [box.x, box.y, box.width, box.height].join(' '));
            svg.setAttribute('width', box.width);
            svg.setAttribute('height', box.height);
            uploadWatermark('data:image/svg+xml,' + encodeURIComponent(svg.outerHTML), 'resetWatermark');
            svg.remove();
        } else if (this.status == 404) {
            throw new Error('Improper Set Code');
        }
    };
    xhttp.send();
}

