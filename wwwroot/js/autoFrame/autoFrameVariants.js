/**
 * Auto Frame Variants Module
 * Contains all specific autoFrame implementation functions for different frame types.
 * Each function applies the appropriate frame layers to the card based on its color properties.
 */

async function autoUBFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension') || frame.name.includes('Gray Holo Stamp') || frame.name.includes('Gold Holo Stamp'));
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    var style = false;
    if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }
    if (type_line.toLowerCase().includes('legendary')) {
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeUBFrameByLetter(properties.pinlineRight, 'Inner Crown', true, style));
            }
            frames.push(makeUBFrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }
        if (properties.pinlineRight) {
            frames.push(makeUBFrameByLetter(properties.pinlineRight, 'Crown', true, style));
        }
        frames.push(makeUBFrameByLetter(properties.pinline, "Crown", false, style));
        frames.push(makeUBFrameByLetter(properties.pinline, "Crown Border Cover", false, style));
    }
    if (properties.pinlineRight) {
        frames.push(makeUBFrameByLetter(properties.pinlineRight, 'Stamp', true, style));
    }
    frames.push(makeUBFrameByLetter(properties.pinline, "Stamp", false, style));
    if (properties.pt) {
        frames.push(makeUBFrameByLetter(properties.pt, 'PT', false, style));
    }
    if (properties.pinlineRight) {
        frames.push(makeUBFrameByLetter(properties.pinlineRight, 'Pinline', true, style));
    }
    frames.push(makeUBFrameByLetter(properties.pinline, 'Pinline', false, style));
    frames.push(makeUBFrameByLetter(properties.typeTitle, 'Type', false, style));
    frames.push(makeUBFrameByLetter(properties.typeTitle, 'Title', false, style));
    if (properties.pinlineRight) {
        frames.push(makeUBFrameByLetter(properties.rulesRight, 'Rules', true, style));
    }
    frames.push(makeUBFrameByLetter(properties.rules, 'Rules', false, style));
    if (properties.frameRight) {
        frames.push(makeUBFrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(makeUBFrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(makeUBFrameByLetter(properties.frame, 'Border', false, style));
    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoUBNewFrame(colors, mana_cost, type_line, power) {
    autoM15NewFrame(colors, mana_cost, type_line, power, 'ub');
}

async function autoFullArtNewFrame(colors, mana_cost, type_line, power) {
    autoM15NewFrame(colors, mana_cost, type_line, power, 'fullart');
}

async function autoCircuitFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension') || frame.name.includes('Gray Holo Stamp') || frame.name.includes('Gold Holo Stamp'));
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    if (type_line.toLowerCase().includes('legendary')) {
        if (properties.pinlineRight) {
            frames.push(makeCircuitFrameByLetter(properties.pinlineRight, 'Crown', true));
        }
        frames.push(makeCircuitFrameByLetter(properties.pinline, "Crown", false));
        frames.push(makeCircuitFrameByLetter(properties.pinline, "Crown Border Cover", false));
    }
    if (properties.pt) {
        frames.push(makeCircuitFrameByLetter(properties.pt, 'PT', false));
    }
    if (properties.pinlineRight) {
        frames.push(makeCircuitFrameByLetter(properties.pinlineRight, 'Pinline', true));
    }
    frames.push(makeCircuitFrameByLetter(properties.pinline, 'Pinline', false));
    frames.push(makeCircuitFrameByLetter(properties.typeTitle, 'Type', false));
    frames.push(makeCircuitFrameByLetter(properties.typeTitle, 'Title', false));
    if (properties.pinlineRight) {
        frames.push(makeCircuitFrameByLetter(properties.rulesRight, 'Rules', true));
    }
    frames.push(makeCircuitFrameByLetter(properties.rules, 'Rules', false));
    if (properties.frameRight) {
        frames.push(makeCircuitFrameByLetter(properties.frameRight, 'Frame', true));
    }
    frames.push(makeCircuitFrameByLetter(properties.frame, 'Frame', false));
    frames.push(makeCircuitFrameByLetter(properties.frame, 'Border', false));
    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoM15Frame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    var style = 'regular';
    if (type_line.toLowerCase().includes('snow')) {
        style = 'snow';
    } else if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeM15FrameByLetter(properties.pinlineRight, 'Inner Crown', true, style));
            }
            frames.push(makeM15FrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }
        if (properties.pinlineRight) {
            frames.push(makeM15FrameByLetter(properties.pinlineRight, 'Crown', true, style));
        }
        frames.push(makeM15FrameByLetter(properties.pinline, "Crown", false, style));
        frames.push(makeM15FrameByLetter(properties.pinline, "Crown Border Cover", false, style));
    }
    if (properties.pt) {
        frames.push(makeM15FrameByLetter(properties.pt, 'PT', false, style));
    }
    if (properties.pinlineRight) {
        frames.push(makeM15FrameByLetter(properties.pinlineRight, 'Pinline', true, style));
    }
    frames.push(makeM15FrameByLetter(properties.pinline, 'Pinline', false, style));
    frames.push(makeM15FrameByLetter(properties.typeTitle, 'Type', false, style));
    frames.push(makeM15FrameByLetter(properties.typeTitle, 'Title', false, style));
    if (properties.pinlineRight) {
        frames.push(makeM15FrameByLetter(properties.rulesRight, 'Rules', true, style));
    }
    frames.push(makeM15FrameByLetter(properties.rules, 'Rules', false, style));
    if (properties.frameRight) {
        frames.push(makeM15FrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(makeM15FrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(makeM15FrameByLetter(properties.frame, 'Border', false, style));
    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoM15NewFrame(colors, mana_cost, type_line, power, style = 'regular') {
    var frames;
    if (style == 'ub') {
        frames = card.frames.filter(frame => frame.name.includes('Extension') || frame.name.includes('Gray Holo Stamp'));
    } else {
        frames = card.frames.filter(frame => frame.name.includes('Extension'));
    }
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    if (style == 'ub') {
        if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
            style = 'ubnyx';
        }
    } else if (style != 'fullart') {
        if (type_line.toLowerCase().includes('snow')) {
            style = 'snow';
        } else if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
            style = 'Nyx';
        }
    }
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx' || style == 'ubnyx') {
            if (properties.pinlineRight) {
                frames.push(makeM15NewFrameByLetter(properties.pinlineRight, 'Inner Crown', true, style));
            }
            frames.push(makeM15NewFrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }
        if (properties.pinlineRight) {
            frames.push(makeM15NewFrameByLetter(properties.pinlineRight, 'Crown', true, style));
        }
        frames.push(makeM15NewFrameByLetter(properties.pinline, "Crown", false, style));
        frames.push(makeM15NewFrameByLetter(properties.pinline, "Crown Border Cover", false, style));
    }
    if (style == 'ub' || style == 'ubnyx') {
        if (properties.pinlineRight) {
            frames.push(makeM15NewFrameByLetter(properties.pinlineRight, 'Stamp', true, style));
        }
        frames.push(makeM15NewFrameByLetter(properties.pinline, "Stamp", false, style));
    }
    if (properties.pt) {
        frames.push(makeM15NewFrameByLetter(properties.pt, 'PT', false, style));
    }
    if (properties.pinlineRight) {
        frames.push(makeM15NewFrameByLetter(properties.pinlineRight, 'Pinline', true, style));
    }
    frames.push(makeM15NewFrameByLetter(properties.pinline, 'Pinline', false, style));
    frames.push(makeM15NewFrameByLetter(properties.typeTitle, 'Type', false, style));
    frames.push(makeM15NewFrameByLetter(properties.typeTitle, 'Title', false, style));
    if (properties.pinlineRight) {
        frames.push(makeM15NewFrameByLetter(properties.rulesRight, 'Rules', true, style));
    }
    frames.push(makeM15NewFrameByLetter(properties.rules, 'Rules', false, style));
    if (properties.frameRight) {
        frames.push(makeM15NewFrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(makeM15NewFrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(makeM15NewFrameByLetter(properties.frame, 'Border', false, style));
    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoM15EighthFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    var style = 'regular';
    if (type_line.toLowerCase().includes('snow')) {
        style = 'snow';
    } else if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeM15FrameByLetter(properties.pinlineRight, 'Inner Crown', true, style));
            }
            frames.push(makeM15FrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }
        if (properties.pinlineRight) {
            frames.push(makeM15FrameByLetter(properties.pinlineRight, 'Crown', true, style));
        }
        frames.push(makeM15FrameByLetter(properties.pinline, "Crown", false, style));
        frames.push(makeM15FrameByLetter(properties.pinline, "Crown Border Cover", false, style));
    }
    if (properties.pt) {
        frames.push(makeM15EighthFrameByLetter(properties.pt, 'PT', false, style));
    }
    if (properties.pinlineRight) {
        frames.push(makeM15EighthFrameByLetter(properties.pinlineRight, 'Pinline', true, style));
    }
    frames.push(makeM15EighthFrameByLetter(properties.pinline, 'Pinline', false, style));
    frames.push(makeM15EighthFrameByLetter(properties.typeTitle, 'Type', false, style));
    frames.push(makeM15EighthFrameByLetter(properties.typeTitle, 'Title', false, style));
    if (properties.pinlineRight) {
        frames.push(makeM15EighthFrameByLetter(properties.rulesRight, 'Rules', true, style));
    }
    frames.push(makeM15EighthFrameByLetter(properties.rules, 'Rules', false, style));
    if (properties.frameRight) {
        frames.push(makeM15EighthFrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(makeM15EighthFrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(makeM15EighthFrameByLetter(properties.frame, 'Border', false, style));
    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoM15EighthUBFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    var style = 'regular';
    if (type_line.toLowerCase().includes('snow')) {
        style = 'snow';
    } else if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeM15EighthUBFrameByLetter(properties.pinlineRight, 'Inner Crown', true, style));
            }
            frames.push(makeM15EighthUBFrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }
        if (properties.pinlineRight) {
            frames.push(makeM15EighthUBFrameByLetter(properties.pinlineRight, 'Crown', true, style));
        }
        frames.push(makeM15EighthUBFrameByLetter(properties.pinline, "Crown", false, style));
        frames.push(makeM15EighthUBFrameByLetter(properties.pinline, "Crown Border Cover", false, style));
    }
    if (properties.pt) {
        frames.push(makeM15EighthUBFrameByLetter(properties.pt, 'PT', false, style));
    }
    if (properties.pinlineRight) {
        frames.push(makeM15EighthUBFrameByLetter(properties.pinlineRight, 'Pinline', true, style));
    }
    frames.push(makeM15EighthUBFrameByLetter(properties.pinline, 'Pinline', false, style));
    frames.push(makeM15EighthUBFrameByLetter(properties.typeTitle, 'Type', false, style));
    frames.push(makeM15EighthUBFrameByLetter(properties.typeTitle, 'Title', false, style));
    if (properties.pinlineRight) {
        frames.push(makeM15EighthUBFrameByLetter(properties.rulesRight, 'Rules', true, style));
    }
    frames.push(makeM15EighthUBFrameByLetter(properties.rules, 'Rules', false, style));
    if (properties.frameRight) {
        frames.push(makeM15EighthUBFrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(makeM15EighthUBFrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(makeM15EighthUBFrameByLetter(properties.frame, 'Border', false, style));
    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoBorderlessFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power, 'Borderless');
    var style = 'regular';
    if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeBorderlessFrameByLetter(properties.pinlineRight, 'Inner Crown', true));
            }
            frames.push(makeM15FrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }
        if (properties.pinlineRight) {
            frames.push(makeBorderlessFrameByLetter(properties.pinlineRight, 'Crown', true, style));
        }
        frames.push(makeBorderlessFrameByLetter(properties.pinline, "Crown", false, style));
        frames.push(makeBorderlessFrameByLetter(properties.pinline, "Legend Crown Outline", false))
        frames.push(makeBorderlessFrameByLetter(properties.pinline, "Crown Border Cover", false));
    }
    if (properties.pt) {
        frames.push(makeBorderlessFrameByLetter(properties.pt, 'PT', false));
    }
    if (properties.pinlineRight) {
        frames.push(makeBorderlessFrameByLetter(properties.pinlineRight, 'Pinline', true));
    }
    frames.push(makeBorderlessFrameByLetter(properties.pinline, 'Pinline', false));
    frames.push(makeBorderlessFrameByLetter(properties.typeTitle, 'Type', false));
    frames.push(makeBorderlessFrameByLetter(properties.typeTitle, 'Title', false));
    frames.push(makeBorderlessFrameByLetter(properties.rules, 'Rules', false));
    frames.push(makeBorderlessFrameByLetter(properties.frame, 'Border', false));
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoBorderlessUBFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power, 'Borderless');
    var style = 'regular';
    if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeUBFrameByLetter(properties.pinlineRight, 'Inner Crown', true));
            }
            frames.push(makeUBFrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }
        if (properties.pinlineRight) {
            frames.push(makeBorderlessFrameByLetter(properties.pinlineRight, 'Crown', true, style, true));
        }
        frames.push(makeBorderlessFrameByLetter(properties.pinline, "Crown", false, style, true));
        frames.push(makeBorderlessFrameByLetter(properties.pinline, "Legend Crown Outline", false))
        frames.push(makeBorderlessFrameByLetter(properties.pinline, "Crown Border Cover", false));
    }
    if (properties.pinlineRight) {
        frames.push(makeUBFrameByLetter(properties.pinlineRight, 'Stamp', true, style));
    }
    frames.push(makeUBFrameByLetter(properties.pinline, "Stamp", false, style));
    if (properties.pt) {
        frames.push(makeBorderlessFrameByLetter(properties.pt, 'PT', false));
    }
    if (properties.pinlineRight) {
        frames.push(makeBorderlessFrameByLetter(properties.pinlineRight, 'Pinline', true));
    }
    frames.push(makeBorderlessFrameByLetter(properties.pinline, 'Pinline', false));
    frames.push(makeBorderlessFrameByLetter(properties.typeTitle, 'Type', false));
    frames.push(makeBorderlessFrameByLetter(properties.typeTitle, 'Title', false));
    frames.push(makeBorderlessFrameByLetter(properties.rules, 'Rules', false));
    frames.push(makeBorderlessFrameByLetter(properties.frame, 'Border', false));
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function auto8thEditionFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    var style = 'regular';
    if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }
    if (properties.pt) {
        frames.push(make8thEditionFrameByLetter(properties.pt, 'PT', false, style));
    }
    if (properties.pinlineRight) {
        frames.push(make8thEditionFrameByLetter(properties.pinlineRight, 'Pinline', true, style));
    }
    frames.push(make8thEditionFrameByLetter(properties.pinline, 'Pinline', false, style));
    frames.push(make8thEditionFrameByLetter(properties.typeTitle, 'Type', false, style));
    frames.push(make8thEditionFrameByLetter(properties.typeTitle, 'Title', false, style));
    if (properties.pinlineRight) {
        frames.push(make8thEditionFrameByLetter(properties.rulesRight, 'Rules', true, style));
    }
    frames.push(make8thEditionFrameByLetter(properties.rules, 'Rules', false, style));
    if (properties.frameRight) {
        frames.push(make8thEditionFrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(make8thEditionFrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(make8thEditionFrameByLetter(properties.frame, 'Border', false, style));
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoExtendedArtFrame(colors, mana_cost, type_line, power, short) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power);
    var style = 'regular';
    if (type_line.toLowerCase().includes('snow')) {
        style = 'snow';
    } else if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }
    if (type_line.includes('Legendary')) {
        frames.push(makeExtendedArtFrameByLetter(properties.pinline, "Crown Outline", false, style, short));
        if (style == 'Nyx') {
            if (properties.pinlineRight) {
                frames.push(makeExtendedArtFrameByLetter(properties.pinlineRight, 'Inner Crown', true, style, short));
            }
            frames.push(makeExtendedArtFrameByLetter(properties.pinline, 'Inner Crown', false, style, short));
        }
        if (properties.pinlineRight) {
            frames.push(makeExtendedArtFrameByLetter(properties.pinlineRight, 'Crown', true, style, short));
        }
        frames.push(makeExtendedArtFrameByLetter(properties.pinline, "Crown", false, style, short));
        frames.push(makeExtendedArtFrameByLetter(properties.pinline, "Crown Border Cover", false, style, short));
    } else {
        frames.push(makeExtendedArtFrameByLetter(properties.pinline, "Title Cutout", false, style, short));
    }
    if (properties.pt) {
        frames.push(makeExtendedArtFrameByLetter(properties.pt, 'PT', false, style, short));
    }
    if (properties.pinlineRight) {
        frames.push(makeExtendedArtFrameByLetter(properties.pinlineRight, 'Pinline', true, style, short));
    }
    frames.push(makeExtendedArtFrameByLetter(properties.pinline, 'Pinline', false, style, short));
    frames.push(makeExtendedArtFrameByLetter(properties.typeTitle, 'Type', false, style, short));
    frames.push(makeExtendedArtFrameByLetter(properties.typeTitle, 'Title', false, style, short));
    if (properties.pinlineRight) {
        frames.push(makeExtendedArtFrameByLetter(properties.rulesRight, 'Rules', true, style, short));
    }
    frames.push(makeExtendedArtFrameByLetter(properties.rules, 'Rules', false, style, short));
    if (properties.frameRight) {
        frames.push(makeExtendedArtFrameByLetter(properties.frameRight, 'Frame', true, style, short));
    }
    frames.push(makeExtendedArtFrameByLetter(properties.frame, 'Frame', false, style, short));
    frames.push(makeExtendedArtFrameByLetter(properties.frame, 'Border', false, style, short));
    if (card.text.pt && type_line.includes('Vehicle') && !card.text.pt.text.includes('fff')) {
        card.text.pt.text = '{fontcolor#fff}' + card.text.pt.text;
    }
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoEtchedFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power, 'Etched');
    var style = 'regular';
    if (type_line.toLowerCase().includes('snow')) {
        style = 'snow';
    } else if (type_line.toLowerCase().includes('enchantment creature') || type_line.toLowerCase().includes('enchantment artifact') || (document.querySelector('#autoframe-always-nyx').checked && type_line.toLowerCase().includes('enchantment'))) {
        style = 'Nyx';
    }
    if (type_line.includes('Legendary')) {
        if (style == 'Nyx') {
            if (properties.frameRight) {
                frames.push(makeEtchedFrameByLetter(properties.pinlineRight, 'Inner Crown', true));
            }
            frames.push(makeEtchedFrameByLetter(properties.pinline, 'Inner Crown', false, style));
        }
        if (properties.frameRight) {
            frames.push(makeEtchedFrameByLetter(properties.frameRight, 'Crown', true));
        }
        frames.push(makeEtchedFrameByLetter(properties.frame, "Crown", false));
        frames.push(makeEtchedFrameByLetter(properties.frame, "Crown Border Cover", false));
    }
    if (properties.pt) {
        frames.push(makeEtchedFrameByLetter(properties.pt, 'PT', false));
    }
    frames.push(makeEtchedFrameByLetter(properties.typeTitle, 'Type', false));
    frames.push(makeEtchedFrameByLetter(properties.typeTitle, 'Title', false));
    if (properties.pinlineRight) {
        frames.push(makeEtchedFrameByLetter(properties.rulesRight, 'Rules', true));
    }
    frames.push(makeEtchedFrameByLetter(properties.rules, 'Rules', false));
    if (properties.frameRight) {
        frames.push(makeEtchedFrameByLetter(properties.frameRight, 'Frame', true, style));
    }
    frames.push(makeEtchedFrameByLetter(properties.frame, 'Frame', false, style));
    frames.push(makeEtchedFrameByLetter(properties.frame, 'Border', false));
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoPhyrexianFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension'));
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power, 'Phyrexian');
    if (type_line.toLowerCase().includes('legendary')) {
        if (properties.pinlineRight) {
            frames.push(makePhyrexianFrameByLetter(properties.pinlineRight, 'Crown', true));
        }
        frames.push(makePhyrexianFrameByLetter(properties.pinline, "Crown", false));
    }
    if (properties.pt) {
        frames.push(makePhyrexianFrameByLetter(properties.pt, 'PT', false));
    }
    if (properties.pinlineRight) {
        frames.push(makePhyrexianFrameByLetter(properties.pinlineRight, 'Pinline', true));
    }
    frames.push(makePhyrexianFrameByLetter(properties.pinline, 'Pinline', false));
    frames.push(makePhyrexianFrameByLetter(properties.typeTitle, 'Type', false));
    frames.push(makePhyrexianFrameByLetter(properties.typeTitle, 'Title', false));
    if (properties.pinlineRight) {
        frames.push(makePhyrexianFrameByLetter(properties.rulesRight, 'Rules', true));
    }
    frames.push(makePhyrexianFrameByLetter(properties.rules, 'Rules', false));
    if (properties.frameRight) {
        frames.push(makePhyrexianFrameByLetter(properties.frameRight, 'Frame', true));
    }
    frames.push(makePhyrexianFrameByLetter(properties.frame, 'Frame', false));
    frames.push(makePhyrexianFrameByLetter(properties.frame, 'Border', false));
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

async function autoSeventhEditionFrame(colors, mana_cost, type_line, power) {
    var frames = card.frames.filter(frame => frame.name.includes('Extension') || frame.name.includes('DCI Star'));
    card.frames = [];
    document.querySelector('#frame-list').innerHTML = null;
    var properties = cardFrameProperties(colors, mana_cost, type_line, power, 'Seventh');
    frames.push(makeSeventhEditionFrameByLetter(properties.pinline, 'Pinline', false));
    if (properties.rulesRight) {
        frames.push(makeSeventhEditionFrameByLetter(properties.rulesRight, 'Rules', true));
    }
    frames.push(makeSeventhEditionFrameByLetter(properties.rules, 'Rules', false));
    frames.push(makeSeventhEditionFrameByLetter(properties.frame, 'Frame', false));
    frames.push(makeSeventhEditionFrameByLetter(properties.pinline, 'Textbox Pinline', false));
    frames.push(makeSeventhEditionFrameByLetter(properties.frame, 'Border', false));
    card.frames = frames;
    card.frames.reverse();
    await card.frames.forEach(item => addFrame([], item));
    card.frames.reverse();
}

