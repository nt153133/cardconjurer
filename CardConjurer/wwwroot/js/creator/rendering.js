// Creator rendering domain (hybrid migration)
// This file is loaded before creator-23.js and exposes render functions on window.
// noinspection JSUnresolvedReference

function drawCard() {
    // reset
    cardContext.globalCompositeOperation = 'source-over';
    cardContext.clearRect(0, 0, cardCanvas.width, cardCanvas.height);
    // art
    cardContext.save();
    cardContext.translate(scaleX(card.artX), scaleY(card.artY));
    cardContext.rotate(Math.PI / 180 * (card.artRotate || 0));
    if (document.querySelector('#grayscale-art').checked) {
        cardContext.filter = 'grayscale(1)';
    }
    cardContext.drawImage(art, 0, 0, art.width * card.artZoom, art.height * card.artZoom);
    cardContext.restore();
    // frame elements
    if (card.version.includes('planeswalker') && typeof planeswalkerPreFrameCanvas !== 'undefined') {
        cardContext.drawImage(planeswalkerPreFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    }
    cardContext.drawImage(frameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    if (card.version.toLowerCase().includes('planeswalker') && typeof planeswalkerPostFrameCanvas !== 'undefined') {
        cardContext.drawImage(planeswalkerPostFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    } else if (card.version.toLowerCase().includes('planeswalker') && typeof planeswalkerCanvas !== 'undefined') {
        cardContext.drawImage(planeswalkerCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    } else if (card.version.toLowerCase().includes('station') && typeof stationPreFrameCanvas !== 'undefined') {
        cardContext.drawImage(stationPreFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    }
    if (card.version.toLowerCase().includes('station') && typeof stationPostFrameCanvas !== 'undefined') {
        cardContext.drawImage(stationPostFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    } else if (card.version.toLowerCase().includes('qrcode') && typeof qrCodeCanvas !== 'undefined') {
        cardContext.drawImage(qrCodeCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    } // REMOVE/DELETE PLANESWALKERCANVAS AFTER A FEW WEEKS
    // guidelines
    if (document.querySelector('#show-guidelines').checked) {
        cardContext.drawImage(guidelinesCanvas, scaleX(card.marginX) / 2, scaleY(card.marginY) / 2, cardCanvas.width, cardCanvas.height);
    }
    // watermark
    cardContext.drawImage(watermarkCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    // custom elements for sagas, classes, and dungeons
    if (card.version.toLowerCase().includes('saga') && typeof sagaCanvas !== 'undefined') {
        cardContext.drawImage(sagaCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    } else if (card.version.includes('class') && !card.version.includes('classic') && typeof classCanvas !== 'undefined') {
        cardContext.drawImage(classCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    } else if (card.version.toLowerCase().includes('dungeon') && typeof dungeonCanvas !== 'undefined') {
        cardContext.drawImage(dungeonCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    }
    // text
    cardContext.drawImage(textCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    // set symbol
    if (card.setSymbolBounds) {
        drawSetSymbol(cardContext, setSymbol, card.setSymbolBounds);
    }
    // serial
    if (card.serialNumber || card.serialTotal) {
        var x = parseInt(card.serialX) || SERIAL_DEFAULT_X;
        var y = parseInt(card.serialY) || SERIAL_DEFAULT_Y;
        var scale = parseFloat(card.serialScale) || 1.0;

        cardContext.drawImage(serial, scaleX(x / SERIAL_REFERENCE_WIDTH), scaleY(y / SERIAL_REFERENCE_HEIGHT), scaleWidth(SERIAL_STAMP_WIDTH / SERIAL_REFERENCE_WIDTH) * scale, scaleHeight(SERIAL_STAMP_HEIGHT / SERIAL_REFERENCE_HEIGHT) * scale);

        var number = {
            name: 'Number',
            text: '{kerning3}' + card.serialNumber || '',
            x: (x + (SERIAL_NUMBER_INNER_X * scale)) / SERIAL_REFERENCE_WIDTH,
            y: (y + (SERIAL_TEXT_INNER_Y * scale)) / SERIAL_REFERENCE_HEIGHT,
            width: (SERIAL_TEXT_FIELD_WIDTH * scale) / SERIAL_REFERENCE_WIDTH,
            height: (SERIAL_TEXT_FIELD_HEIGHT * scale) / SERIAL_REFERENCE_HEIGHT,
            oneLine: true,
            font: 'gothambold',
            color: 'white',
            size: (SERIAL_TEXT_FIELD_HEIGHT * scale) / SERIAL_REFERENCE_WIDTH,
            align: 'center'
        };

        var total = {
            name: 'Number',
            text: '{kerning3}' + card.serialTotal || '',
            x: (x + (SERIAL_TOTAL_INNER_X * scale)) / SERIAL_REFERENCE_WIDTH,
            y: (y + (SERIAL_TEXT_INNER_Y * scale)) / SERIAL_REFERENCE_HEIGHT,
            width: (SERIAL_TEXT_FIELD_WIDTH * scale) / SERIAL_REFERENCE_WIDTH,
            height: (SERIAL_TEXT_FIELD_HEIGHT * scale) / SERIAL_REFERENCE_HEIGHT,
            oneLine: true,
            font: 'gothambold',
            color: 'white',
            size: (SERIAL_TEXT_FIELD_HEIGHT * scale) / SERIAL_REFERENCE_WIDTH,
            align: 'center'
        };

        writeText(number, cardContext);
        writeText(total, cardContext);
    }
    // bottom info
    if (card.bottomInfoTranslate) {
        cardContext.save();
        cardContext.rotate(Math.PI / 180 * (card.bottomInfoRotate || 0));
        cardContext.translate(card.bottomInfoTranslate.x || 0, card.bottomInfoTranslate.y || 0);
        cardContext.drawImage(bottomInfoCanvas, 0, 0, cardCanvas.width * (card.bottomInfoZoom || 1), cardCanvas.height * (card.bottomInfoZoom || 1));
        cardContext.restore();
    } else {
        cardContext.drawImage(bottomInfoCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    }

    // cutout the corners
    cardContext.globalCompositeOperation = 'destination-out';
    if (!card.noCorners && (card.marginX == 0 && card.marginY == 0)) {
        // CORNER_CUTOUT_SIZE is a fraction of the standard-width card (59/2010).
        // Dividing by getStandardWidth() converts the pixel reference (w) back to a
        // fraction so scaleWidth() produces the correct pixel size for any card resolution.
        var w = card.version == 'battle' ? 2100 : getStandardWidth();
        var cornerSize = scaleWidth(CORNER_CUTOUT_SIZE * w / getStandardWidth());

        cardContext.drawImage(corner, 0, 0, cornerSize, cornerSize);
        cardContext.rotate(Math.PI / 2);
        cardContext.drawImage(corner, 0, -card.width, cornerSize, cornerSize);
        cardContext.rotate(Math.PI / 2);
        cardContext.drawImage(corner, -card.width, -card.height, cornerSize, cornerSize);
        cardContext.rotate(Math.PI / 2);
        cardContext.drawImage(corner, -card.height, 0, cornerSize, cornerSize);
        cardContext.rotate(Math.PI / 2);
    }

    // Restore normal compositing after corner punch-out so overlays draw with their real colors.
    cardContext.globalCompositeOperation = 'source-over';

    // selected profile cut/safe placement overlay
    if (!suppressProfilePlacementOverlay && document.querySelector('#show-profile-placement-overlay')?.checked) {
        drawProfilePlacementOverlay();
        cardContext.drawImage(profileOverlayCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
    }

    // show preview
    previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewContext.drawImage(cardCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
    updateCreatorPreviewInfo();

    if (window.cardDrawingPromiseResolver) {
        window.cardDrawingPromiseResolver();
        window.cardDrawingPromiseResolver = null;
    }
}

function drawNewGuidelines() {
    // clear
    guidelinesContext.clearRect(0, 0, guidelinesCanvas.width, guidelinesCanvas.height);
    // set opacity
    guidelinesContext.globalAlpha = 0.25;
    // textboxes
    guidelinesContext.fillStyle = 'blue';
    Object.entries(card.text).forEach(item => {
        guidelinesContext.fillRect(scaleX(item[1].x || 0), scaleY(item[1].y || 0), scaleWidth(item[1].width || 1), scaleHeight(item[1].height || 1));
    });
    // art
    guidelinesContext.fillStyle = 'green';
    guidelinesContext.fillRect(scaleX(card.artBounds.x), scaleY(card.artBounds.y), scaleWidth(card.artBounds.width), scaleHeight(card.artBounds.height));
    // watermark
    guidelinesContext.fillStyle = 'yellow';
    var watermarkWidth = scaleWidth(card.watermarkBounds.width);
    var watermarkHeight = scaleHeight(card.watermarkBounds.height);
    guidelinesContext.fillRect(scaleX(card.watermarkBounds.x) - watermarkWidth / 2, scaleY(card.watermarkBounds.y) - watermarkHeight / 2, watermarkWidth, watermarkHeight);
    // set symbol
    var setSymbolX = scaleX(card.setSymbolBounds.x);
    var setSymbolY = scaleY(card.setSymbolBounds.y);
    var setSymbolWidth = scaleWidth(card.setSymbolBounds.width);
    var setSymbolHeight = scaleHeight(card.setSymbolBounds.height);
    if (card.setSymbolBounds.vertical == 'center') {
        setSymbolY -= setSymbolHeight / 2;
    } else if (card.setSymbolBounds.vertical == 'bottom') {
        setSymbolY -= setSymbolHeight;
    }
    if (card.setSymbolBounds.horizontal == 'center') {
        setSymbolX -= setSymbolWidth / 2;
    } else if (card.setSymbolBounds.horizontal == 'right') {
        setSymbolX -= setSymbolWidth;
    }
    guidelinesContext.fillStyle = 'red';
    guidelinesContext.fillRect(setSymbolX, setSymbolY, setSymbolWidth, setSymbolHeight);
    // grid
    guidelinesContext.globalAlpha = 1;
    guidelinesContext.beginPath();
    guidelinesContext.strokeStyle = 'gray';
    guidelinesContext.lineWidth = 1;
    const boxPadding = 25;
    for (var x = 0; x <= card.width; x += boxPadding) {
        guidelinesContext.moveTo(x, 0);
        guidelinesContext.lineTo(x, card.height);
    }
    for (var y = 0; y <= card.height; y += boxPadding) {
        guidelinesContext.moveTo(0, y);
        guidelinesContext.lineTo(card.width, y);
    }
    guidelinesContext.stroke();
    //center lines
    guidelinesContext.beginPath();
    guidelinesContext.strokeStyle = 'black';
    guidelinesContext.lineWidth = 3;
    guidelinesContext.moveTo(card.width / 2, 0);
    guidelinesContext.lineTo(card.width / 2, card.height);
    guidelinesContext.moveTo(0, card.height / 2);
    guidelinesContext.lineTo(card.width, card.height / 2);
    guidelinesContext.stroke();
    //draw to card
    drawCard();
}

function addRoundedRectPath(ctx, x, y, width, height, radius) {
    var r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function strokeRoundedRectGuide(ctx, x, y, width, height, radius, outlineColor, lineColor, outlineWidth, lineWidth) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineWidth;
    addRoundedRectPath(ctx, x, y, width, height, radius);
    ctx.stroke();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    addRoundedRectPath(ctx, x, y, width, height, radius);
    ctx.stroke();
    ctx.restore();
}

function drawProfilePlacementOverlay() {
    if (!profileOverlayCanvas || !profileOverlayContext) {
        return;
    }

    // Keep the overlay canvas in lockstep with the card canvas.
    sizeCanvas('profileOverlay', cardCanvas.width, cardCanvas.height);
    profileOverlayContext.clearRect(0, 0, profileOverlayCanvas.width, profileOverlayCanvas.height);

    var profile = getSelectedCardSizeProfile();
    if (!profile || !profile.bleed || !profile.cut || !profile.safe) {
        return;
    }

    var bleedW = Number(profile.bleed.width);
    var bleedH = Number(profile.bleed.height);
    var cutW = Number(profile.cut.width);
    var cutH = Number(profile.cut.height);
    var safeW = Number(profile.safe.width);
    var safeH = Number(profile.safe.height);

    if (!Number.isFinite(bleedW) || !Number.isFinite(bleedH) || bleedW <= 0 || bleedH <= 0) {
        return;
    }

    // Mode-aware rendering:
    // - CUT mode: draw safe only
    // - BLEED mode: draw cut + safe
    // Prefer dimension matching (more robust across load paths), then fall back to margins.
    var overlayW = profileOverlayCanvas.width;
    var overlayH = profileOverlayCanvas.height;
    var bleedSizeMatches = approximatelyEqualPixels(overlayW, bleedW, 2) && approximatelyEqualPixels(overlayH, bleedH, 2);
    var cutSizeMatches = approximatelyEqualPixels(overlayW, cutW, 2) && approximatelyEqualPixels(overlayH, cutH, 2);
    var hasMargins = card.marginX > 0.0001 || card.marginY > 0.0001;
    var isBleedMode = bleedSizeMatches || (!cutSizeMatches && hasMargins);

    var cutXScaled;
    var cutYScaled;
    var cutWScaled;
    var cutHScaled;
    var safeXScaled;
    var safeYScaled;
    var safeWScaled;
    var safeHScaled;

    if (isBleedMode) {
        var scaleXOverlay = profileOverlayCanvas.width / bleedW;
        var scaleYOverlay = profileOverlayCanvas.height / bleedH;

        var cutX = (bleedW - cutW) / 2;
        var cutY = (bleedH - cutH) / 2;
        var safeX = (bleedW - safeW) / 2;
        var safeY = (bleedH - safeH) / 2;

        cutXScaled = cutX * scaleXOverlay;
        cutYScaled = cutY * scaleYOverlay;
        cutWScaled = cutW * scaleXOverlay;
        cutHScaled = cutH * scaleYOverlay;

        safeXScaled = safeX * scaleXOverlay;
        safeYScaled = safeY * scaleYOverlay;
        safeWScaled = safeW * scaleXOverlay;
        safeHScaled = safeH * scaleYOverlay;

        var cutCornerRadius = Math.min(cutWScaled, cutHScaled) * 0.03;

        var cutLineWidth = Math.max(2, Math.round(Math.min(profileOverlayCanvas.width, profileOverlayCanvas.height) * 0.0025));
        strokeRoundedRectGuide(
            profileOverlayContext,
            cutXScaled,
            cutYScaled,
            cutWScaled,
            cutHScaled,
            cutCornerRadius,
            'rgba(0, 0, 0, 1)',
            'rgba(0, 255, 255, 1)',
            cutLineWidth + 2,
            cutLineWidth);
    } else {
        // In cut mode, the visible canvas is already cut-size; only safe guide should be shown.
        cutWScaled = profileOverlayCanvas.width;
        cutHScaled = profileOverlayCanvas.height;
        safeWScaled = cutW <= 0 ? cutWScaled : cutWScaled * (safeW / cutW);
        safeHScaled = cutH <= 0 ? cutHScaled : cutHScaled * (safeH / cutH);
        safeXScaled = (cutWScaled - safeWScaled) / 2;
        safeYScaled = (cutHScaled - safeHScaled) / 2;
    }

    var safeCornerRadius = Math.min(safeWScaled, safeHScaled) * 0.02;

    // Draw safe guide.
    var safeLineWidth = Math.max(2, Math.round(Math.min(profileOverlayCanvas.width, profileOverlayCanvas.height) * 0.002));
    strokeRoundedRectGuide(
        profileOverlayContext,
        safeXScaled,
        safeYScaled,
        safeWScaled,
        safeHScaled,
        safeCornerRadius,
        'rgba(0, 0, 0, 1)',
        'rgba(255, 165, 0, 1)',
        safeLineWidth + 2,
        safeLineWidth);
}

function setRoundedCorners(value) {
    card.noCorners = !value;
    drawCard();
}

window.drawCard = drawCard;
window.drawNewGuidelines = drawNewGuidelines;
window.drawProfilePlacementOverlay = drawProfilePlacementOverlay;
window.setRoundedCorners = setRoundedCorners;

