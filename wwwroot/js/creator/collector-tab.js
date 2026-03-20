// Collector tab logic: collector text layout/style, bottom-info rendering,
// serial controls, collector defaults, and collector UI toggle handlers.

async function setBottomInfoStyle() {
    if (document.querySelector('#enableNewCollectorStyle').checked) {
        await loadBottomInfo({
            midLeft: {
                text: '{elemidinfo-set} \u2022 {elemidinfo-language}  {savex}{fontbelerenbsc}{fontsize' + scaleHeight(0.001) + '}{upinline' + scaleHeight(0.0005) + '}\uFFEE{savex2}{elemidinfo-artist}',
                x: 0.0647,
                y: 0.9548,
                width: 0.8707,
                height: 0.0171,
                oneLine: true,
                font: 'gothammedium',
                size: 0.0171,
                color: card.bottomInfoColor,
                outlineWidth: 0.003
            },
            topLeft: {
                text: '{elemidinfo-rarity} {kerning3}{elemidinfo-number}{kerning0}',
                x: 0.0647,
                y: 0.9377,
                width: 0.8707,
                height: 0.0171,
                oneLine: true,
                font: 'gothammedium',
                size: 0.0171,
                color: card.bottomInfoColor,
                outlineWidth: 0.003
            },
            note: {text: '{loadx}{elemidinfo-note}', x: 0.0647, y: 0.9377, width: 0.8707, height: 0.0171, oneLine: true, font: 'gothammedium', size: 0.0171, color: card.bottomInfoColor, outlineWidth: 0.003},
            bottomLeft: {text: 'NOT FOR SALE', x: 0.0647, y: 0.9719, width: 0.8707, height: 0.0143, oneLine: true, font: 'gothammedium', size: 0.0143, color: card.bottomInfoColor, outlineWidth: 0.003},
            wizards: {
                name: 'wizards',
                text: '{ptshift0,0.0172}\u2122 & \u00a9 {elemidinfo-year} Wizards of the Coast',
                x: 0.0647,
                y: 0.9377,
                width: 0.8707,
                height: 0.0167,
                oneLine: true,
                font: 'mplantin',
                size: 0.0162,
                color: card.bottomInfoColor,
                align: 'right',
                outlineWidth: 0.003
            },
            bottomRight: {text: '{ptshift0,0.0172}CardConjurer.com', x: 0.0647, y: 0.9548, width: 0.8707, height: 0.0143, oneLine: true, font: 'mplantin', size: 0.0143, color: card.bottomInfoColor, align: 'right', outlineWidth: 0.003}
        });
    } else {
        await loadBottomInfo({
            midLeft: {
                text: '{elemidinfo-set} \u2022 {elemidinfo-language}  {savex}{fontbelerenbsc}{fontsize' + scaleHeight(0.001) + '}{upinline' + scaleHeight(0.0005) + '}\uFFEE{savex2}{elemidinfo-artist}',
                x: 0.0647,
                y: 0.9548,
                width: 0.8707,
                height: 0.0171,
                oneLine: true,
                font: 'gothammedium',
                size: 0.0171,
                color: card.bottomInfoColor,
                outlineWidth: 0.003
            },
            topLeft: {text: '{elemidinfo-number}', x: 0.0647, y: 0.9377, width: 0.8707, height: 0.0171, oneLine: true, font: 'gothammedium', size: 0.0171, color: card.bottomInfoColor, outlineWidth: 0.003},
            note: {text: '{loadx2}{elemidinfo-note}', x: 0.0647, y: 0.9377, width: 0.8707, height: 0.0171, oneLine: true, font: 'gothammedium', size: 0.0171, color: card.bottomInfoColor, outlineWidth: 0.003},
            rarity: {text: '{loadx}{elemidinfo-rarity}', x: 0.0647, y: 0.9377, width: 0.8707, height: 0.0171, oneLine: true, font: 'gothammedium', size: 0.0171, color: card.bottomInfoColor, outlineWidth: 0.003},
            bottomLeft: {text: 'NOT FOR SALE', x: 0.0647, y: 0.9719, width: 0.8707, height: 0.0143, oneLine: true, font: 'gothammedium', size: 0.0143, color: card.bottomInfoColor, outlineWidth: 0.003},
            wizards: {
                name: 'wizards',
                text: '{ptshift0,0.0172}\u2122 & \u00a9 {elemidinfo-year} Wizards of the Coast',
                x: 0.0647,
                y: 0.9377,
                width: 0.8707,
                height: 0.0167,
                oneLine: true,
                font: 'mplantin',
                size: 0.0162,
                color: card.bottomInfoColor,
                align: 'right',
                outlineWidth: 0.003
            },
            bottomRight: {text: '{ptshift0,0.0172}CardConjurer.com', x: 0.0647, y: 0.9548, width: 0.8707, height: 0.0143, oneLine: true, font: 'mplantin', size: 0.0143, color: card.bottomInfoColor, align: 'right', outlineWidth: 0.003}
        });
    }
}

async function loadBottomInfo(textObjects = []) {
    await bottomInfoContext.clearRect(0, 0, bottomInfoCanvas.width, bottomInfoCanvas.height);
    card.bottomInfo = null;
    card.bottomInfo = textObjects;
    await bottomInfoEdited();
    bottomInfoEdited();
}

async function bottomInfoEdited() {
    await bottomInfoContext.clearRect(0, 0, bottomInfoCanvas.width, bottomInfoCanvas.height);
    card.infoNumber = document.querySelector('#info-number').value;
    card.infoRarity = document.querySelector('#info-rarity').value;
    card.infoSet = document.querySelector('#info-set').value;
    card.infoLanguage = document.querySelector('#info-language').value;
    card.infoArtist = document.querySelector('#info-artist').value;
    card.infoYear = document.querySelector('#info-year').value;
    card.infoNote = document.querySelector('#info-note').value;

    if (document.querySelector('#enableCollectorInfo').checked) {
        for (var textObject of Object.entries(card.bottomInfo)) {
            if (['NOT FOR SALE', 'Wizards of the Coast', 'CardConjurer.com', 'cardconjurer.com'].some(v => textObject[1].text.includes(v))) {
                continue;
            } else {
                textObject[1].name = textObject[0];
                await writeText(textObject[1], bottomInfoContext);
            }
        }
    }

    drawCard();
}

async function serialInfoEdited() {
    card.serialNumber = document.querySelector('#serial-number').value;
    card.serialTotal = document.querySelector('#serial-total').value;
    card.serialX = document.querySelector('#serial-x').value;
    card.serialY = document.querySelector('#serial-y').value;
    card.serialScale = document.querySelector('#serial-scale').value;

    drawCard();
}

async function resetSerial() {
    card.serialX = scaleX(SERIAL_DEFAULT_X / SERIAL_REFERENCE_WIDTH);
    card.serialY = scaleY(SERIAL_DEFAULT_Y / SERIAL_REFERENCE_HEIGHT);
    card.serialScale = 1.0;

    document.querySelector('#serial-x').value = card.serialX;
    document.querySelector('#serial-y').value = card.serialY;
    document.querySelector('#serial-scale').value = card.serialScale;

    drawCard();
}

function artistEdited(value) {
    document.querySelector('#art-artist').value = value;
    document.querySelector('#info-artist').value = value;
    bottomInfoEdited();
}

function toggleStarDot() {
    for (var key of Object.keys(card.bottomInfo)) {
        var text = card.bottomInfo[key].text;
        if (text.includes('*')) {
            card.bottomInfo[key].text = text.replace('*', ' \u2022 ');
        } else {
            card.bottomInfo[key].text = text.replace(' \u2022 ', '*');
        }
    }
    defaultCollector.starDot = !defaultCollector.starDot;
    bottomInfoEdited();
}

function enableNewCollectorInfoStyle() {
    localStorage.setItem('enableNewCollectorStyle', document.querySelector('#enableNewCollectorStyle').checked);
    setBottomInfoStyle();
    bottomInfoEdited();
}

function enableCollectorInfo() {
    localStorage.setItem('enableCollectorInfo', document.querySelector('#enableCollectorInfo').checked);
    bottomInfoEdited();
}

function enableImportCollectorInfo() {
    localStorage.setItem('enableImportCollectorInfo', document.querySelector('#enableImportCollectorInfo').checked);
}

function removeDefaultCollector() {
    defaultCollector = {};
    localStorage.removeItem('defaultCollector');
}

function setDefaultCollector() {
    starDot = defaultCollector.starDot;
    defaultCollector = {
        number: document.querySelector('#info-number').value,
        rarity: document.querySelector('#info-rarity').value,
        setCode: document.querySelector('#info-set').value,
        lang: document.querySelector('#info-language').value,
        note: document.querySelector('#info-note').value,
        starDot: starDot
    };
    localStorage.setItem('defaultCollector', JSON.stringify(defaultCollector));
}

