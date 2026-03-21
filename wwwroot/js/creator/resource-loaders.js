/**
 * resource-loaders.js - Lightweight image/script loader helpers used by Creator UI and frame packs.
 */

/**
 * Resolves a user-entered image URL, optionally proxying remote images.
 * If the value is not an absolute HTTP(S) URL, it is treated as a local_art path.
 * @param {string} url
 * @param {Function} destination
 * @param {*} otherParams
 */
function imageURL(url, destination, otherParams) {
    var imageurl = url;
    // If an image URL does not have HTTP in it, assume it's a local file in the repo local_art directory.
    if (!url.includes('http')) {
        imageurl = '/local_art/' + url;
    } else if (params.get('noproxy') != '') {
        //CORS PROXY LINKS
        //Previously: https://cors.bridged.cc/
        imageurl = 'https://corsproxy.io/?url=' + encodeURIComponent(url);
    }
    destination(imageurl, otherParams);
}

/**
 * Reads a local file input as a data URL and passes it to the provided destination.
 * @param {Event} event
 * @param {Function} destination
 * @param {*} otherParams
 */
async function imageLocal(event, destination, otherParams) {
    var reader = new FileReader();
    reader.onload = function () {
        destination(reader.result, otherParams);
    };
    reader.onerror = function () {
        destination('/img/blank.png', otherParams);
    };
    await reader.readAsDataURL(event.target.files[0]);
}

/**
 * Dynamically loads a script and resolves when it has finished loading.
 * @param {string} scriptPath
 * @returns {Promise<void>}
 */
function loadScript(scriptPath) {
    return new Promise((resolve, reject) => {
        var script = document.createElement('script');
        script.setAttribute('type', 'text/javascript');
        script.onload = resolve;
        script.onerror = function () {
            notify('A script failed to load, likely due to an update. Please reload your page. Sorry for the inconvenience.');
            reject();
        };
        script.setAttribute('src', scriptPath);
        document.querySelectorAll('head')[0].appendChild(script);
    });
}

/**
 * Fetches an SVG frame by XHR, applies stretch transforms, and assigns the result as a data URL.
 * @param {object} frameObject - The frame descriptor with .src, .stretch, and .image properties
 */
function stretchSVG(frameObject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', fixUri(frameObject.src), true);
    xhr.overrideMimeType('image/svg+xml');
    xhr.onload = function () {
        if (this.readyState == 4 && this.status == 200) {
            frameObject.image.src = 'data:image/svg+xml;charset=utf-8,' +
                stretchSVGReal((new XMLSerializer()).serializeToString(this.responseXML.documentElement), frameObject);
        }
    };
    xhr.send();
}

/**
 * Applies per-path stretch deltas to serialized SVG data and returns the modified string.
 * @param {string} data - Serialized SVG markup
 * @param {object} frameObject - Frame descriptor containing a .stretch array of transform descriptors
 * @returns {string} Modified SVG markup
 */
function stretchSVGReal(data, frameObject) {
    var returnData = data;
    frameObject.stretch.forEach(stretch => {
        const change   = stretch.change;
        const targets  = stretch.targets;
        const name     = stretch.name;
        const oldData  = returnData.split(name + '" d="')[1].split('" style=')[0];
        var newData    = '';
        const listData = oldData.split(/(?=[clmz])/gi);
        for (var i = 0; i < listData.length; i++) {
            const item = listData[i];
            if (targets.includes(i) || targets.includes(-i)) {
                let sign = 1;
                if (i !== 0 && targets.includes(-i)) { sign = -1; }
                if (item[0] === 'C' || item[0] === 'c') {
                    var newCoords = [];
                    item.slice(1).split(' ').forEach(pair => {
                        var coords = pair.split(',');
                        newCoords.push(
                            (scaleWidth(change[0]) * sign + parseFloat(coords[0])) + ',' +
                            (scaleHeight(change[1]) * sign + parseFloat(coords[1]))
                        );
                    });
                    newData += item[0] + newCoords.join(' ');
                } else {
                    const coords = item.slice(1).split(/[, ]/);
                    newData += item[0] +
                        (scaleWidth(change[0]) * sign + parseFloat(coords[0])) + ',' +
                        (scaleHeight(change[1]) * sign + parseFloat(coords[1]));
                }
            } else {
                newData += item;
            }
        }
        returnData = returnData.replace(oldData, newData);
    });
    return returnData;
}
