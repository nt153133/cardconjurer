/**
 * Asset Library service: shared server calls and select helpers for art/frames/set-symbols/watermarks.
 */
class CreatorAssetLibraryService {
    getSourcesEndpoint(kind) {
        return kind === 'art' ? '/api/assets/art-sources' : '/api/assets/sources/' + kind;
    }
    async fetchSources(kind) {
        const response = await fetch(this.getSourcesEndpoint(kind));
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return await response.json();
    }
    async uploadFilesToServerByKind(filesRaw, kind, destination, otherParams = '', refreshCallback = null, artDuplicateCheck = false) {
        const files = [...(filesRaw || [])];
        if (files.length === 0) {
            return;
        }
        if (files.length > 9 && !confirm('You are uploading ' + files.length + ' images. Would you like to continue?')) {
            return;
        }
        for (const file of files) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('nameHint', file.name);
                const response = await fetch('/api/assets/upload/' + kind, {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) {
                    if (artDuplicateCheck && response.status === 409) {
                        notify('This art already exists on the server (same file hash).', 5);
                        continue;
                    }
                    throw new Error('Upload failed with status ' + response.status);
                }
                const result = await response.json();
                destination(result.url, otherParams);
            } catch (error) {
                console.error(kind + ' upload failed:', error);
                notify('Upload failed. Falling back to local browser upload for this file.', 5);
                const reader = new FileReader();
                reader.onloadend = function () {
                    destination(reader.result, otherParams);
                };
                reader.onerror = function () {
                    destination('/img/blank.png', otherParams);
                };
                reader.readAsDataURL(file);
            }
        }
        if (refreshCallback) {
            await refreshCallback();
        }
    }
    async refreshLibrarySelect(selectSelector, kind, options = {}) {
        const select = document.querySelector(selectSelector);
        if (!select) {
            return;
        }
        const noneText = options.noneText || 'None selected';
        const errorText = options.errorText || ('Failed to load ' + kind + ' list');
        select.innerHTML = '<option value="" selected="selected">' + noneText + '</option>';
        try {
            const items = await this.fetchSources(kind);
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.url;
                option.innerText = item.name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Could not load uploaded ' + kind + ':', error);
            const option = document.createElement('option');
            option.value = '';
            option.innerText = errorText;
            select.appendChild(option);
        }
    }
    async deleteByKind(kind, url) {
        const response = await fetch('/api/assets/' + kind, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({url})
        });
        return response.ok || response.status === 404;
    }

    async uploadRawToKind(kind, file, allowDuplicateSkip = false) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('nameHint', file.name);
        const response = await fetch('/api/assets/upload/' + kind, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            return {status: 'ok'};
        }
        if (allowDuplicateSkip && response.status === 409) {
            return {status: 'duplicate'};
        }
        return {status: 'error', code: response.status};
    }

    selectLibrarySource(element, onSelect) {
        if (!element || !element.value) {
            return;
        }
        onSelect(element.value);
    }
}
window.CreatorAssetLibraryService = CreatorAssetLibraryService;
window.creatorAssetLibrary = window.creatorAssetLibrary || new CreatorAssetLibraryService();
