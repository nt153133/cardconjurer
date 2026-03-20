/**
 * Auto Frame Helpers Module
 * Contains all makeXxxFrameByLetter() helper functions that convert color letters
 * to frame layer objects with appropriate masks and bounds.
 */function makeM15FrameByLetter(letter, mask = "", maskToRightHalf = false, style = 'regular') {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land'
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    } else if (letter == 'L' && style == 'Nyx') {
        style = 'regular'
        ;
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/crowns/m15Crown' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.1667,
                'width': 0.9454,
                'x': 0.0274,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' ' + mask + ' (' + style + ')',
            'src': '/img/frames/m15/innerCrowns/m15InnerCrown' + letter + style + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0239,
                'width': 0.672,
                'x': 0.164,
                'y': 0.0239
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/regular/m15PT' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 0.8848
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/m15/' + style.toLowerCase() + '/m15Frame' + letter + '.png',
    }

    if (style == 'snow') {
        frame.src = frame.src.replace('m15Frame' + letter, letter.toLowerCase());
    } else {
        if (letter.includes('L') && letter.length > 1) {
            frame.src = frame.src.replace(('m15Frame' + letter), 'l' + letter[0].toLowerCase())
        }

        if (style == 'Nyx') {
            frame.src = frame.src.replace('.png', 'Nyx.png');
        }
    }

    if (mask) {
        frame.masks = [
            {
                'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeM15NewFrameByLetter(letter, mask = "", maskToRightHalf = false, style = 'regular') {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land',
        'WE': 'White Enchantment',
        'UE': 'Blue Enchantment',
        'BE': 'Black Enchantment',
        'RE': 'Red Enchantment',
        'GE': 'Green Enchantment',
        'ME': 'Multicolored Enchantment',
        'AE': 'Artifact Enchantment'
    }

    if (style == 'ubnyx') {
        letter += 'E'
        if (mask == "Inner Crown") {
            style = 'nyx';
        } else {
            style = 'ub';
        }
    }

    if (letter.length == 2) {
        letter = letter.split("").reverse().join("");
    }

    if ((mask == 'Crown' || mask == 'PT' || mask.includes('Stamp')) && (letter.includes('L') || letter.includes('E')) && letter.length > 1) {
        letter = letter[1];
    }

    var frameName = frameNames[letter.split("").reverse().join("")];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {x: 0, y: 0, width: 1, height: 137 / 2814}
        }
    }

    if (mask == "Crown") {
        var framePath = '';
        if (style == 'ub') {
            framePath = 'ub/';
        }
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/' + framePath + 'crowns/new/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {x: 44 / 2010, y: 53 / 2814, width: 1922 / 2010, height: 493 / 2814}
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' ' + mask + ' (' + style + ')',
            'src': '/img/frames/m15/innerCrowns/new/' + style.toLowerCase() + '/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {x: 329 / 2010, y: 70 / 2814, width: 1353 / 2010, height: 64 / 2814}
        };
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    } else if (mask == "Stamp") {
        if (style == 'ub') {
            var frame = {
                'name': frameName + ' Holo Stamp',
                'src': '/img/frames/m15/new/ub/stamp/' + letter.toLowerCase() + '.png',
                'masks': [],
                'bounds': {x: 857 / 2015, y: 2534 / 2814, width: 299 / 2015, height: 137 / 2814}
            }
            if (maskToRightHalf) {
                frame.masks.push({
                    'src': '/img/frames/maskRightHalf.png',
                    'name': 'Right Half'
                });
            }
            return frame;
        }
    }

    if (mask == 'PT') {
        var path = '/img/frames/m15/regular/m15PT';
        if (style == 'ub') {
            path = '/img/frames/m15/ub/pt/';
            letter = letter.toLowerCase();
        }
        return {
            'name': frameName + ' Power/Toughness',
            'src': path + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 0.8848
            }
        }
    }

    var stylePath = '';
    if (style != 'regular') {
        stylePath = style.toLowerCase() + '/';
    }
    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/m15/new/' + stylePath + letter.toLowerCase() + '.png',
    }

    // if (letter.includes('L') && letter.length > 1) {
    // 	frame.src = frame.src.replace(('m15Frame' + letter), 'l' + letter[0].toLowerCase())
    // }

    if (mask) {
        frame.masks = [
            {
                'src': '/img/frames/m15/new/' + mask.toLowerCase() + '.png',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeM15EighthFrameByLetter(letter, mask = "", maskToRightHalf = false, style = 'regular') {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land'
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/crowns/m15Crown' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.1667,
                'width': 0.9454,
                'x': 0.0274,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' ' + mask + ' (' + style + ')',
            'src': '/img/frames/m15/innerCrowns/m15InnerCrown' + letter + style + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0239,
                'width': 0.672,
                'x': 0.164,
                'y': 0.0239
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/regular/m15PT' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 1901 / 2100
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/custom/m15-eighth/' + style.toLowerCase() + '/' + letter.toLowerCase() + '.png',
    }

    if (style != 'regular') {
        frame.name = style.charAt(0).toUpperCase() + style.slice(1) + ' ' + frame.name;
    }

    if (mask) {
        if (mask.toLowerCase() == 'border' || mask.toLowerCase() == 'frame') {
            frame.masks = [
                {
                    'src': '/img/frames/custom/m15-eighth/regular/' + mask + '.png',
                    'name': mask
                }
            ]
        } else {
            frame.masks = [
                {
                    'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                    'name': mask
                }
            ]
        }

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeM15EighthUBFrameByLetter(letter, mask = "", maskToRightHalf = false, style = false) {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land',
        'WE': 'White Enchantment',
        'UE': 'Blue Enchantment',
        'BE': 'Black Enchantment',
        'RE': 'Red Enchantment',
        'GE': 'Green Enchantment',
        'ME': 'Multicolored Enchantment',
        'AE': 'Artifact Enchantment'
    };

    if (style == 'Nyx') {
        letter = letter + 'E';
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && (letter.includes('L') || letter.includes('E')) && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/ub/crowns/m15Crown' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.1667,
                'width': 0.9454,
                'x': 0.0274,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' ' + mask + ' (' + style + ')',
            'src': '/img/frames/m15/innerCrowns/m15InnerCrown' + letter + style + 'UB.png',
            'masks': [],
            'bounds': {
                'height': 0.0239,
                'width': 0.672,
                'x': 0.164,
                'y': 0.0239
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/ub/pt/' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 1901 / 2100
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/custom/m15-eighth/ub/' + letter.toLowerCase() + '.png',
    }

    if (mask) {
        if (mask.toLowerCase() == 'border' || mask.toLowerCase() == 'frame') {
            frame.masks = [
                {
                    'src': '/img/frames/custom/m15-eighth/regular/' + mask + '.png',
                    'name': mask
                }
            ]
        } else {
            frame.masks = [
                {
                    'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                    'name': mask
                }
            ]
        }

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeBorderlessFrameByLetter(letter, mask = "", maskToRightHalf = false, style, universesBeyond = false) {
    letter = letter.toUpperCase();

    var isVehicle = letter == 'V';

    if (letter == 'V') {
        letter = 'A';
    }

    if (letter == 'ML') {
        letter = 'M';
    } else if (letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless'
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Legend Crown Outline") {
        return {
            'name': 'Legend Crown Outline',
            'src': '/img/frames/m15/crowns/m15CrownFloatingOutline.png',
            'masks': [],
            'bounds': {
                'height': 0.1062,
                'width': 0.944,
                'x': 0.028,
                'y': 0.0172
            }
        };
    }

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'erase': true,
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Crown") {
        var src = '/img/frames/m15/crowns/m15Crown' + letter + 'Floating.png';
        if (universesBeyond) {
            src = '/img/frames/m15/ub/crowns/floating/' + letter + '.png';
        }
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': src,
            'masks': [],
            'bounds': {
                'height': 0.1024,
                'width': 0.9387,
                'x': 0.0307,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' ' + mask + ' (' + style + ')',
            'src': '/img/frames/m15/innerCrowns/m15InnerCrown' + letter + style + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0239,
                'width': 0.672,
                'x': 0.164,
                'y': 0.0239
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/borderless/pt/' + (isVehicle ? 'v' : letter.toLowerCase()) + '.png',
            'masks': [],
            'bounds': {
                'height': 0.066666666666,
                'width': 0.182666666666,
                'x': 0.764,
                'y': 0.8861904761904762
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/m15/borderless/m15GenericShowcaseFrame' + letter + '.png',
    }

    if (letter.includes('L') && letter.length > 1) {
        frame.src = frame.src.replace(('m15GenericShowcaseFrame' + letter), 'l' + letter[0].toLowerCase())
    }

    if (mask) {
        if (mask == 'Pinline') {
            frame.masks = [
                {
                    'src': '/img/frames/m15/genericShowcase/m15GenericShowcaseMask' + mask + '.png',
                    'name': mask
                }
            ];
        } else {
            frame.masks = [
                {
                    'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                    'name': mask
                }
            ];
        }

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function make8thEditionFrameByLetter(letter, mask = "", maskToRightHalf = false, style = 'regular') {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land'
    }

    if (mask == 'PT') {
        if (letter.length > 1) {
            letter = letter[0];
        } else if (letter == 'C') {
            letter = 'L';
        }
    }

    if (letter == 'V') {
        letter = 'A';
    }

    var frameName = frameNames[letter];

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/8th/pt/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {x: 1461 / 2010, y: 2481 / 2814, width: 414 / 2010, height: 218 / 2814}
        }
    }

    var stylePath = style == 'Nyx' ? 'nyx/' : '';

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/8th/' + stylePath + letter.toLowerCase() + '.png',
    }

    if (letter.includes('L') && letter.length > 1) {
        frame.src = frame.src.replace(('m15Frame' + letter), 'l' + letter[0].toLowerCase())
    }

    if (mask) {
        frame.masks = [
            {
                'src': '/img/frames/8th/' + mask.toLowerCase() + '.png',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeExtendedArtFrameByLetter(letter, mask = "", maskToRightHalf = false, style = 'regular', short = false) {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land'
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Legend Crown Outline") {
        return {
            'name': 'Legend Crown Outline',
            'src': '/img/frames/m15/crowns/m15CrownFloatingOutline.png',
            'masks': [],
            'bounds': {
                'height': 0.1062,
                'width': 0.944,
                'x': 0.028,
                'y': 0.0172
            }
        };
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/crowns/m15Crown' + letter + 'Floating.png',
            'masks': [],
            'bounds': {
                'height': 0.1024,
                'width': 0.9387,
                'x': 0.0307,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Crown Outline") {
        var frame = {
            'name': 'Legend Crown Outline',
            'src': '/img/frames/m15/crowns/m15CrownFloatingOutline.png',
            'masks': [],
            'bounds': {
                'height': 0.1062,
                'width': 0.944,
                'x': 0.028,
                'y': 0.0172
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + '(' + style + ')' + mask,
            'src': '/img/frames/m15/innerCrowns/m15InnerCrown' + letter + style + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0239,
                'width': 0.672,
                'x': 0.164,
                'y': 0.0239
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/regular/m15PT' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 0.8848
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame'
    }

    if (style != 'regular') {
        frame.src = '/img/frames/extended/regular/' + style.toLowerCase() + '/' + letter.toLowerCase() + '.png';
        if (short) {
            frame.src = frame.src.replace('/regular/', '/shorter/');
        }
    } else if (short) {
        frame.src = '/img/frames/m15/boxTopper/short/' + letter.toLowerCase() + '.png';
    } else {
        frame.src = '/img/frames/m15/boxTopper/m15BoxTopperFrame' + letter + '.png';
    }

    if (mask) {
        if (mask == 'Title Cutout') {
            if (short) {
                frame.masks = [
                    {
                        'src': '/img/frames/extended/shorter/titleCutout.png',
                        'name': 'Title Cutout'
                    }
                ]
            } else {
                frame.masks = [
                    {
                        'src': '/img/frames/m15/boxTopper/m15BoxTopperTitleCutout.png',
                        'name': 'Title Cutout'
                    }
                ]
            }
        } else if (short && ['Frame', 'Rules', 'Type', 'Pinline'].includes(mask)) {
            var extension = mask == 'Type' ? '.png' : '.svg';

            frame.masks = [
                {
                    'src': '/img/frames/m15/boxTopper/short/' + mask.toLowerCase().replace('rules', 'text') + extension,
                    'name': mask
                }
            ]
        } else {
            frame.masks = [
                {
                    'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                    'name': mask
                }
            ]
        }

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeUBFrameByLetter(letter, mask = "", maskToRightHalf = false, style = false) {
    letter = letter.toUpperCase();

    if (letter == 'C') {
        letter = 'L';
    }

    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land',
        'WE': 'White Enchantment',
        'UE': 'Blue Enchantment',
        'BE': 'Black Enchantment',
        'RE': 'Red Enchantment',
        'GE': 'Green Enchantment',
        'ME': 'Multicolored Enchantment',
        'AE': 'Artifact Enchantment'
    };

    if (style == 'Nyx') {
        letter = letter + 'E';
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && (letter.includes('L') || letter.includes('E')) && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/ub/crowns/m15Crown' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.1667,
                'width': 0.9454,
                'x': 0.0274,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    } else if (mask == "Stamp") {
        var frame = {
            'name': frameName + ' Holo Stamp',
            'src': '/img/frames/m15/ub/regular/stamp/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0486,
                'width': 0.1494,
                'x': 0.4254,
                'y': 0.9005
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' ' + mask + ' (' + style + ')',
            'src': '/img/frames/m15/innerCrowns/m15InnerCrown' + letter + style + 'UB.png',
            'masks': [],
            'bounds': {
                'height': 0.0239,
                'width': 0.672,
                'x': 0.164,
                'y': 0.0239
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/ub/pt/' + (letter == 'L' ? 'C' : letter).toLowerCase() + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 0.8848
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/m15/ub/regular/' + letter.toLowerCase() + '.png',
    }

    if (mask) {
        frame.masks = [
            {
                'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeCircuitFrameByLetter(letter, mask = "", maskToRightHalf = false) {
    letter = letter.toUpperCase();

    if (letter == 'C') {
        letter = 'L';
    }

    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land',
        'ML': 'Multicolored Land'
    }

    if ((mask.includes('Crown') || mask == 'PT' || mask.includes('Stamp')) && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Border Cover',
            'src': '/img/black.png',
            'masks': [],
            'bounds': {
                'height': 0.0177,
                'width': 0.9214,
                'x': 0.0394,
                'y': 0.0277
            }
        }
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/m15/ub/crowns/m15Crown' + letter + '.png',
            'masks': [],
            'bounds': {
                'height': 0.1667,
                'width': 0.9454,
                'x': 0.0274,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/ub/pt/' + (letter == 'L' ? 'C' : letter).toLowerCase() + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 0.8848
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/custom/circuit/' + letter.toLowerCase() + '.png',
    }

    if (mask) {
        frame.masks = [
            {
                'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeEtchedFrameByLetter(letter, mask = "", maskToRightHalf = false, style = 'regular') {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle'
    }

    if (mask == 'PT' && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    if (letter == 'ML') {
        letter = 'M';
    } else if (letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    } else if (letter == 'V' && mask == 'Crown') {
        letter = 'A';
    }

    var frameName = frameNames[letter];

    if (mask == "Crown Border Cover") {
        return {
            'name': 'Legend Crown Cover',
            'src': '/img/frames/etched/regular/crowns/cover.svg',
            'masks': [],
            'bounds': {}
        }
    }

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legend Crown',
            'src': '/img/frames/etched/regular/crowns/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {
                'height': 0.092,
                'width': 0.9387,
                'x': 0.0307,
                'y': 0.0191
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == "Inner Crown") {
        var frame = {
            'name': frameName + ' Inner Crown',
            'src': '/img/frames/etched/regular/innerCrowns/' + style.toLowerCase() + '/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {x: 244 / 1500, y: 51 / 2100, width: 1012 / 1500, height: 64 / 2100}
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/etched/regular/pt/' + letter.toLowerCase() + '.png',
            'masks': [],
            'bounds': {
                'height': 0.0733,
                'width': 0.188,
                'x': 0.7573,
                'y': 0.8848
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/etched/regular/' + letter.toLowerCase() + '.png',
    }

    if (style != 'regular') {
        frame.src = frame.src.replace('/regular/', '/regular/' + style.toLowerCase() + '/');
        frame.name = frame.name += ' (' + style + ')';
    }

    if (mask) {
        frame.masks = [
            {
                'src': '/img/frames/etched/regular/' + mask.toLowerCase() + '.svg',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makePhyrexianFrameByLetter(letter, mask = "", maskToRightHalf = false) {
    if (letter == 'C' || letter == 'V') {
        letter = 'L';
    }

    if (mask == 'Rules') {
        mask = 'Rules Text';
    }

    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land'
    }

    if (mask == 'PT' && letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    if (letter == 'ML') {
        letter = 'M';
    } else if (letter.includes('L') && letter.length > 1) {
        letter = letter[0];
    }

    var frameName = frameNames[letter];

    if (mask == "Crown") {
        var frame = {
            'name': frameName + ' Legendary Crown',
            'src': '/img/frames/m15/praetors/' + letter.toLowerCase() + 'Crown.png',
            'masks': [],
            'bounds': {
                'height': 100 / 2100,
                'width': 1,
                'x': 0,
                'y': 0
            }
        }
        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
        return frame;
    }

    if (mask == 'PT') {
        return {
            'name': frameName + ' Power/Toughness',
            'src': '/img/frames/m15/praetors/' + letter.toLowerCase() + 'pt.png',
            'masks': [],
            'bounds': {
                'height': 0.0772,
                'width': 0.212,
                'x': 0.746,
                'y': 0.8858
            }
        }
    }

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/m15/praetors/' + letter.toLowerCase() + '.png',
    }

    if (mask == 'Type' || mask == 'Title') {
        frame.masks = [
            {
                'src': '/img/frames/m15/regular/m15Mask' + mask + '.png',
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else if (mask) {
        var extension = "png";
        var name = mask.toLowerCase();
        if (mask == 'Frame') {
            extension = 'svg';
        } else if (mask == 'Rules Text') {
            extension = 'svg';
            name = 'text';
        }

        frame.masks = [
            {
                'src': '/img/frames/m15/praetors/' + name + '.' + extension,
                'name': mask
            }
        ]

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}

function makeSeventhEditionFrameByLetter(letter, mask = "", maskToRightHalf = false) {
    letter = letter.toUpperCase();
    var frameNames = {
        'W': 'White',
        'U': 'Blue',
        'B': 'Black',
        'R': 'Red',
        'G': 'Green',
        'M': 'Multicolored',
        'A': 'Artifact',
        'L': 'Land',
        'C': 'Colorless',
        'V': 'Vehicle',
        'WL': 'White Land',
        'UL': 'Blue Land',
        'BL': 'Black Land',
        'RL': 'Red Land',
        'GL': 'Green Land'
    }

    if (letter == 'V') {
        letter = 'A';
    }

    if (letter == 'ML') {
        letter = 'L';
    }

    var frameName = frameNames[letter];

    var frame = {
        'name': frameName + ' Frame',
        'src': '/img/frames/seventh/regular/' + letter.toLowerCase() + '.png'
    };

    if (mask) {
        if (mask == 'Textbox Pinline') {
            frame.masks = [
                {
                    'src': '/img/frames/seventh/regular/trim.svg',
                    'name': 'Textbox Pinline'
                }
            ]
        } else {
            frame.masks = [
                {
                    'src': '/img/frames/seventh/regular/' + mask.toLowerCase() + '.svg',
                    'name': mask
                }
            ]
        }

        if (maskToRightHalf) {
            frame.masks.push({
                'src': '/img/frames/maskRightHalf.png',
                'name': 'Right Half'
            });
        }
    } else {
        frame.masks = [];
    }

    return frame;
}


