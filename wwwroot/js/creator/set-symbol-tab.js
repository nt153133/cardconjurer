// Set Symbol tab logic: set symbol source loading, uploaded source selection,
// symbol positioning/reset behavior, set-code fetching, and lock persistence.

function uploadSetSymbol(imageSource, otherParams) {
    ImageLoadTracker.track(imageSource);
    setSymbol.src = imageSource;
    if (otherParams && otherParams == 'resetSetSymbol') {
        setSymbol.onload = function () {
            resetSetSymbol();
            setSymbol.onload = setSymbolEdited;
        };
    }
}

async function uploadSetSymbolFilesToServer(filesRaw, otherParams = 'resetSetSymbol') {
    await uploadFilesToServerByKind(filesRaw, 'set-symbols', uploadSetSymbol, otherParams, refreshSetSymbolLibrarySelect);
}

async function refreshSetSymbolLibrarySelect() {
    await creatorAssetLibrary.refreshLibrarySelect('#set-symbol-library-select', 'set-symbols', {
        noneText: 'None selected',
        errorText: 'Failed to load uploaded set symbols'
    });
}

function selectSetSymbolLibrarySource(element) {
    creatorAssetLibrary.selectLibrarySource(element, (url) => {
        uploadSetSymbol(url, 'resetSetSymbol');
    });
}

function setSymbolEdited() {
    card.setSymbolSource = setSymbol.src;
    if (document.querySelector('#lockSetSymbolURL').checked) {
        localStorage.setItem('lockSetSymbolURL', card.setSymbolSource);
    }
    localStorage.setItem('set-symbol-source', document.querySelector('#set-symbol-source').value);
    card.setSymbolX = document.querySelector('#setSymbol-x').value / card.width;
    card.setSymbolY = document.querySelector('#setSymbol-y').value / card.height;
    card.setSymbolZoom = document.querySelector('#setSymbol-zoom').value / 100;
    drawCard();
}

function resetSetSymbol() {
    if (card.setSymbolBounds == undefined) {
        return;
    }
    document.querySelector('#setSymbol-x').value = Math.round(scaleX(card.setSymbolBounds.x));
    document.querySelector('#setSymbol-y').value = Math.round(scaleY(card.setSymbolBounds.y));
    var setSymbolZoom;
    if (setSymbol.width / setSymbol.height > scaleWidth(card.setSymbolBounds.width) / scaleHeight(card.setSymbolBounds.height)) {
        setSymbolZoom = (scaleWidth(card.setSymbolBounds.width) / setSymbol.width * 100).toFixed(1);
    } else {
        setSymbolZoom = (scaleHeight(card.setSymbolBounds.height) / setSymbol.height * 100).toFixed(1);
    }
    document.querySelector('#setSymbol-zoom').value = setSymbolZoom;
    if (card.setSymbolBounds.horizontal == 'center') {
        document.querySelector('#setSymbol-x').value = Math.round(scaleX(card.setSymbolBounds.x) - (setSymbol.width * setSymbolZoom / 100) / 2 - scaleWidth(card.marginX));
    } else if (card.setSymbolBounds.horizontal == 'right') {
        document.querySelector('#setSymbol-x').value = Math.round(scaleX(card.setSymbolBounds.x) - (setSymbol.width * setSymbolZoom / 100) - scaleWidth(card.marginX));
    }
    if (card.setSymbolBounds.vertical == 'center') {
        document.querySelector('#setSymbol-y').value = Math.round(scaleY(card.setSymbolBounds.y) - (setSymbol.height * setSymbolZoom / 100) / 2 - scaleHeight(card.marginY));
    } else if (card.setSymbolBounds.vertical == 'bottom') {
        document.querySelector('#setSymbol-y').value = Math.round(scaleY(card.setSymbolBounds.y) - (setSymbol.height * setSymbolZoom / 100) - scaleHeight(card.marginY));
    }
    setSymbolEdited();
}

function fetchSetSymbol() {
    var setCode = document.querySelector('#set-symbol-code').value.toLowerCase() || 'cmd';
    if (document.querySelector('#lockSetSymbolCode').checked) {
        localStorage.setItem('lockSetSymbolCode', setCode);
    }
    var setRarity = document.querySelector('#set-symbol-rarity').value.toLowerCase().replace('uncommon', 'u').replace('common', 'c').replace('rare', 'r').replace('mythic', 'm') || 'c';
    if (['a22', 'a23', 'j22', 'hlw'].includes(setCode.toLowerCase())) {
        uploadSetSymbol(fixUri(`/img/setSymbols/custom/${setCode.toLowerCase()}-${setRarity}.png`), 'resetSetSymbol');
    } else if (['cc', 'logan', 'joe'].includes(setCode.toLowerCase())) {
        uploadSetSymbol(fixUri(`/img/setSymbols/custom/${setCode.toLowerCase()}-${setRarity}.svg`), 'resetSetSymbol');
    } else if (document.querySelector('#set-symbol-source').value == 'gatherer') {
        if (setSymbolAliases.has(setCode.toLowerCase())) {
            setCode = setSymbolAliases.get(setCode.toLowerCase());
        }
        uploadSetSymbol('http://gatherer.wizards.com/Handlers/Image.ashx?type=symbol&set=' + setCode + '&size=large&rarity=' + setRarity, 'resetSetSymbol');
    } else if (document.querySelector('#set-symbol-source').value == 'hexproof') {
        if (setSymbolAliases.has(setCode.toLowerCase())) {
            setCode = setSymbolAliases.get(setCode.toLowerCase());
        }
        var hexproofUrl = 'https://api.hexproof.io/symbols/set/' + setCode + '/' + setRarity;
        // Use CORS proxy for hexproof.io
        if (params.get('noproxy') == null) {
            hexproofUrl = 'https://corsproxy.io/?url=' + encodeURIComponent(hexproofUrl);
        }
        uploadSetSymbol(hexproofUrl, 'resetSetSymbol');
    } else {
        var extension = 'svg';
        if (['xxxx'].includes(setCode.toLowerCase())) {
            extension = 'png';
        }
        if (setSymbolAliases.has(setCode.toLowerCase())) {
            setCode = setSymbolAliases.get(setCode.toLowerCase());
        }
        uploadSetSymbol(fixUri(`/img/setSymbols/official/${setCode.toLowerCase()}-${setRarity}.` + extension), 'resetSetSymbol');
    }
}

function lockSetSymbolCode() {
    var savedValue = '';
    if (document.querySelector('#lockSetSymbolCode').checked) {
        savedValue = document.querySelector('#set-symbol-code').value;
    }
    localStorage.setItem('lockSetSymbolCode', savedValue);
}

function lockSetSymbolURL() {
    var savedValue = '';
    if (document.querySelector('#lockSetSymbolURL').checked) {
        savedValue = card.setSymbolSource;
    }
    localStorage.setItem('lockSetSymbolURL', savedValue);
}

function drawSetSymbol(cardContext, setSymbol, bounds) {
    if (!bounds) {
        return;
    }

    const symbolWidth = setSymbol.width * card.setSymbolZoom;
    const symbolHeight = setSymbol.height * card.setSymbolZoom;
    const x = scaleX(card.setSymbolX);
    const y = scaleY(card.setSymbolY);

    if (bounds.outlineWidth && bounds.outlineWidth > 0) {
        // Create temp canvas for outlined symbol
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // Scale the outline width the same way text outlines are scaled
        const outlineWidth = scaleHeight(bounds.outlineWidth);
        const margin = outlineWidth * 2;
        tempCanvas.width = symbolWidth + margin;
        tempCanvas.height = symbolHeight + margin;

        // Setup stroke style (similar to text outline system)
        tempCtx.strokeStyle = bounds.outlineColor || 'black';
        tempCtx.lineWidth = outlineWidth;
        tempCtx.lineJoin = bounds.lineJoin || 'round';
        tempCtx.lineCap = bounds.lineCap || 'round';

        // First pass: Draw outline by stroking the symbol multiple times in a circle pattern
        const outlineSteps = Math.max(8, Math.ceil(outlineWidth * 2));
        for (let i = 0; i < outlineSteps; i++) {
            const angle = (i / outlineSteps) * Math.PI * 2;
            const offsetX = Math.cos(angle) * (outlineWidth / 2);
            const offsetY = Math.sin(angle) * (outlineWidth / 2);

            tempCtx.globalCompositeOperation = 'source-over';
            tempCtx.drawImage(setSymbol,
                outlineWidth + offsetX,
                outlineWidth + offsetY,
                symbolWidth,
                symbolHeight);

            // Apply the outline color
            tempCtx.globalCompositeOperation = 'source-in';
            tempCtx.fillStyle = bounds.outlineColor || 'black';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.globalCompositeOperation = 'destination-over';
        }

        // Second pass: Draw the original symbol on top
        tempCtx.globalCompositeOperation = 'source-over';
        tempCtx.drawImage(setSymbol, outlineWidth, outlineWidth, symbolWidth, symbolHeight);

        // Draw to main canvas
        cardContext.drawImage(tempCanvas,
            x - outlineWidth,
            y - outlineWidth,
            tempCanvas.width,
            tempCanvas.height);
    } else {
        // Draw main symbol without outline (simple path)
        cardContext.drawImage(setSymbol, x, y, symbolWidth, symbolHeight);
    }
}

