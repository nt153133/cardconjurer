/**
 * Asset Library service: shared server calls and select helpers for art/frames/set-symbols/watermarks.
 */
class CreatorAssetLibraryService {
    constructor() {
        this.kind = 'art';
        this.items = [];
        this.selected = new Set();
    }

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

    async switchAssetKind(kind) {
        this.kind = kind;
        this.selected.clear();
        document.querySelectorAll('[id^="asset-kind-tab-"]').forEach(tab => tab.classList.remove('selected'));
        const activeTab = document.querySelector('#asset-kind-tab-' + kind);
        if (activeTab) {
            activeTab.classList.add('selected');
        }
        await this.loadAssetLibrary();
    }

    async loadAssetLibrary() {
        const gallery = document.querySelector('#asset-gallery');
        const status = document.querySelector('#asset-library-status');
        if (!gallery || !status) {
            return;
        }

        this.selected.clear();
        gallery.innerHTML = '';
        status.textContent = 'Loading...';

        try {
            this.items = await this.fetchSources(this.kind);
        } catch (err) {
            console.error('Asset library load failed:', err);
            status.textContent = 'Failed to load files.';
            return;
        }

        if (this.items.length === 0) {
            status.textContent = '0 files';
            const empty = document.createElement('p');
            empty.className = 'asset-gallery-empty';
            empty.textContent = 'No uploaded files yet for this type.';
            gallery.appendChild(empty);
            return;
        }

        status.textContent = this.items.length + ' file(s)';
        this.items.forEach(item => gallery.appendChild(this.buildAssetGalleryItem(item)));
    }

    buildAssetGalleryItem(item) {
        const cell = document.createElement('div');
        cell.className = 'asset-gallery-item';
        cell.onclick = () => this.toggleAssetSelection(item.url, cell);

        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'asset-check';
        check.onclick = (e) => {
            e.stopPropagation();
            this.toggleAssetSelection(item.url, cell);
        };
        cell.appendChild(check);

        const img = document.createElement('img');
        img.src = item.url;
        img.alt = item.name;
        img.loading = 'lazy';
        img.onerror = function () {
            this.style.opacity = '0.3';
            this.src = '/img/blank.png';
        };
        cell.appendChild(img);

        const name = document.createElement('span');
        name.className = 'asset-name';
        name.textContent = item.name;
        cell.appendChild(name);

        return cell;
    }

    toggleAssetSelection(url, cell) {
        const check = cell.querySelector('.asset-check');
        if (this.selected.has(url)) {
            this.selected.delete(url);
            cell.classList.remove('selected');
            if (check) {
                check.checked = false;
            }
        } else {
            this.selected.add(url);
            cell.classList.add('selected');
            if (check) {
                check.checked = true;
            }
        }

        const status = document.querySelector('#asset-library-status');
        if (status) {
            status.textContent = this.items.length + ' file(s), ' + this.selected.size + ' selected';
        }
    }

    selectAll() {
        this.selected.clear();
        document.querySelectorAll('#asset-gallery .asset-gallery-item').forEach((cell, i) => {
            const url = this.items[i] && this.items[i].url;
            if (url) {
                this.selected.add(url);
            }
            cell.classList.add('selected');
            const check = cell.querySelector('.asset-check');
            if (check) {
                check.checked = true;
            }
        });

        const status = document.querySelector('#asset-library-status');
        if (status) {
            status.textContent = this.items.length + ' file(s), ' + this.selected.size + ' selected';
        }
    }

    deselectAll() {
        this.selected.clear();
        document.querySelectorAll('#asset-gallery .asset-gallery-item').forEach(cell => {
            cell.classList.remove('selected');
            const check = cell.querySelector('.asset-check');
            if (check) {
                check.checked = false;
            }
        });

        const status = document.querySelector('#asset-library-status');
        if (status) {
            status.textContent = this.items.length + ' file(s)';
        }
    }

    getRefreshMap() {
        return {
            art: () => refreshArtLibrarySelect(),
            frames: () => refreshFrameLibrarySelect(),
            'set-symbols': () => refreshSetSymbolLibrarySelect(),
            watermarks: () => refreshWatermarkLibrarySelect()
        };
    }

    async deleteSelected() {
        if (this.selected.size === 0) {
            notify('No files selected.', 3);
            return;
        }
        if (!confirm('Delete ' + this.selected.size + ' selected file(s)? This cannot be undone.')) {
            return;
        }

        const urls = [...this.selected];
        let deleted = 0;
        let failed = 0;
        for (const url of urls) {
            try {
                const isDeleted = await this.deleteByKind(this.kind, url);
                if (isDeleted) {
                    deleted++;
                } else {
                    failed++;
                }
            } catch (err) {
                console.error('Delete failed for', url, err);
                failed++;
            }
        }

        notify(deleted + ' file(s) deleted' + (failed > 0 ? ', ' + failed + ' failed.' : '.'), 4);
        await this.loadAssetLibrary();

        const refresh = this.getRefreshMap()[this.kind];
        if (refresh) {
            await refresh();
        }
    }

    async uploadForCurrentKind(filesRaw) {
        if (!filesRaw || filesRaw.length === 0) {
            return;
        }

        const files = [...filesRaw];
        const isDuplicate = this.kind === 'art';
        let uploaded = 0;
        let dupes = 0;
        let failed = 0;

        for (const file of files) {
            try {
                const result = await this.uploadRawToKind(this.kind, file, isDuplicate);
                if (result.status === 'ok') {
                    uploaded++;
                } else if (result.status === 'duplicate') {
                    dupes++;
                } else {
                    throw new Error('HTTP ' + result.code);
                }
            } catch (err) {
                console.error('Upload failed:', err);
                failed++;
            }
        }

        const parts = [];
        if (uploaded > 0) {
            parts.push(uploaded + ' uploaded');
        }
        if (dupes > 0) {
            parts.push(dupes + ' duplicate(s) skipped');
        }
        if (failed > 0) {
            parts.push(failed + ' failed');
        }

        notify(parts.join(', ') + '.', 4);
        await this.loadAssetLibrary();

        const refresh = this.getRefreshMap()[this.kind];
        if (refresh) {
            await refresh();
        }
    }

    getKind() {
        return this.kind;
    }

    getItems() {
        return this.items;
    }

    getSelectedCount() {
        return this.selected.size;
    }
}

window.CreatorAssetLibraryService = CreatorAssetLibraryService;
window.creatorAssetLibrary = window.creatorAssetLibrary || new CreatorAssetLibraryService();
