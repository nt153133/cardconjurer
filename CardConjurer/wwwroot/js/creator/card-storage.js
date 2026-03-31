// Card storage service for Creator: localStorage CRUD, server card CRUD/sync,
// and saved-card dropdown management while preserving legacy global handlers.

class CreatorCardStorageService {
    getLocalCardKeys() {
        var cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
        if (!Array.isArray(cardKeys)) {
            cardKeys = [];
            localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
        }
        return cardKeys;
    }

    populateSavedCardSelect(selector, items, placeholder, getValue = item => item, getLabel = item => item, selectedValue = '') {
        var select = document.querySelector(selector);
        if (!select) {
            return;
        }
        select.innerHTML = null;
        var placeholderOption = document.createElement('option');
        placeholderOption.selected = true;
        placeholderOption.disabled = true;
        placeholderOption.innerHTML = items.length === 0 ? placeholder : 'None selected';
        select.appendChild(placeholderOption);
        items.forEach(item => {
            var option = document.createElement('option');
            option.value = getValue(item);
            option.innerHTML = getLabel(item);
            select.appendChild(option);
        });
        if (selectedValue && items.some(item => getValue(item) == selectedValue)) {
            select.value = selectedValue;
        }
    }

    loadAvailableCards(cardKeys = this.getLocalCardKeys()) {
        cardKeys = Array.isArray(cardKeys) ? cardKeys.slice().sort() : [];
        localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
        this.populateSavedCardSelect('#load-card-options', cardKeys, 'No local cards saved');
        if (typeof refreshValidationTabIfVisible === 'function') {
            refreshValidationTabIfVisible();
        }
    }

    serializeCurrentCardState() {
        var cardToSave = JSON.parse(JSON.stringify(card));
        cardToSave.frames.forEach(frame => {
            delete frame.image;
            frame.masks.forEach(mask => delete mask.image);
        });
        return cardToSave;
    }

    readLocalCardData(selectedCardKey) {
        if (!selectedCardKey) {
            return null;
        }
        var raw = localStorage.getItem(selectedCardKey);
        return raw ? JSON.parse(raw) : null;
    }

    getSelectedServerCardSummary() {
        var select = document.querySelector('#server-card-options');
        if (!select || !select.value) {
            return null;
        }
        return (window._serverSavedCards || []).find(item => item.id == select.value) || null;
    }

    async refreshServerAvailableCards(selectedId = '', options = {}) {
        var skipValidationRefresh = !!options.skipValidationRefresh;
        var select = document.querySelector('#server-card-options');
        if (!select) {
            return;
        }
        select.innerHTML = '<option selected="selected" disabled>Loading server cards...</option>';
        try {
            var response = await fetch('/api/cards');
            if (!response.ok) {
                throw new Error('Failed to load server cards (' + response.status + ')');
            }
            window._serverSavedCards = await response.json();
            this.populateSavedCardSelect('#server-card-options', window._serverSavedCards, 'No server cards saved', item => item.id, item => item.displayName, selectedId);
        } catch (error) {
            console.error('Could not load server saved cards:', error);
            window._serverSavedCards = [];
            this.populateSavedCardSelect('#server-card-options', [], 'Server cards unavailable');
        }

        if (!skipValidationRefresh && typeof refreshValidationTabIfVisible === 'function') {
            refreshValidationTabIfVisible();
        }
    }

    async loadServerAvailableCards(selectedId = '') {
        await this.refreshServerAvailableCards(selectedId);
    }

    saveCard(saveFromFile) {
        var cardKeys = JSON.parse(localStorage.getItem('cardKeys')) || [];
        var cardKey;
        var cardToSave;
        if (saveFromFile) {
            cardKey = saveFromFile.key;
        } else {
            cardKey = getCardName();
        }
        if (!saveFromFile) {
            cardKey = prompt('Enter the name you would like to save your card under:', cardKey);
            if (!cardKey) {
                return null;
            }
        }
        cardKey = cardKey.trim();
        if (cardKeys.includes(cardKey)) {
            if (!confirm('Would you like to overwrite your card previously saved as "' + cardKey + '"?\n(Clicking "cancel" will affix a version number)')) {
                var originalCardKey = cardKey;
                var cardKeyNumber = 1;
                while (cardKeys.includes(cardKey)) {
                    cardKey = originalCardKey + ' (' + cardKeyNumber + ')';
                    cardKeyNumber++;
                }
            }
        }
        if (saveFromFile) {
            cardToSave = saveFromFile.data;
        } else {
            cardToSave = this.serializeCurrentCardState();
        }
        try {
            localStorage.setItem(cardKey, JSON.stringify(cardToSave));
            if (!cardKeys.includes(cardKey)) {
                cardKeys.push(cardKey);
                cardKeys.sort();
                localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
                this.loadAvailableCards(cardKeys);
            }
        } catch (error) {
            notify('You have exceeded your 5MB of local storage, and your card has failed to save. If you would like to continue saving cards, please download all saved cards, then delete all saved cards to free up space.<br><br>Local storage is most often exceeded by uploading large images directly from your computer. If possible/convenient, using a URL avoids the need to save these large images.<br><br>Apologies for the inconvenience.');
        }
    }

    async saveServerCard() {
        var selectedSummary = this.getSelectedServerCardSummary();
        var shouldOverwrite = false;
        if (selectedSummary) {
            shouldOverwrite = confirm('Would you like to overwrite the selected server card "' + selectedSummary.displayName + '"?\n\nClick Cancel to create a new server card instead.');
        }
        var defaultName = selectedSummary ? selectedSummary.displayName : getCardName();
        var displayName = prompt('Enter the name you would like to save your server card under:', defaultName);
        if (!displayName) {
            return null;
        }
        displayName = displayName.trim();
        if (!displayName) {
            return null;
        }
        try {
            var response = await fetch('/api/cards', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    id: shouldOverwrite && selectedSummary ? selectedSummary.id : null,
                    displayName: displayName,
                    legacyKey: shouldOverwrite && selectedSummary ? selectedSummary.legacyKey : null,
                    cardJson: this.serializeCurrentCardState()
                })
            });
            if (!response.ok) {
                throw new Error('Save failed (' + response.status + ')');
            }
            var saved = await response.json();
            await this.refreshServerAvailableCards(saved.id);
            notify('Server card saved as "' + saved.displayName + '".', 4);
            return saved;
        } catch (error) {
            console.error('Failed to save card to server:', error);
            notify('Saving the card to the server failed.', 5);
            return null;
        }
    }

    async sendLocalCardToServer() {
        var cardKey = document.querySelector('#load-card-options')?.value;
        if (!cardKey) {
            notify('Select a local card first.', 3);
            return;
        }
        var localCard = this.readLocalCardData(cardKey);
        if (!localCard) {
            notify('Could not read the selected local card.', 4);
            return;
        }
        try {
            var response = await fetch('/api/cards', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    displayName: cardKey,
                    legacyKey: cardKey,
                    cardJson: localCard
                })
            });
            if (!response.ok) {
                throw new Error('Send failed (' + response.status + ')');
            }
            var saved = await response.json();
            await this.refreshServerAvailableCards(saved.id);
            notify('Local card sent to the server as "' + saved.displayName + '".', 4);
        } catch (error) {
            console.error('Failed to send local card to server:', error);
            notify('Sending the local card to the server failed.', 5);
        }
    }

    async sendAllLocalCardsToServer() {
        var cardKeys = this.getLocalCardKeys();
        if (!cardKeys.length) {
            notify('No local cards found to send.', 3);
            return;
        }
        var cards = cardKeys.map(key => {
            var data = this.readLocalCardData(key);
            return data ? {key: key, data: data} : null;
        }).filter(Boolean);
        if (!cards.length) {
            notify('No readable local cards were found to send.', 4);
            return;
        }
        try {
            var response = await fetch('/api/cards/import-local', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({cards: cards})
            });
            if (!response.ok) {
                throw new Error('Bulk send failed (' + response.status + ')');
            }
            var result = await response.json();
            await this.refreshServerAvailableCards();
            notify(result.importedCount + ' local card(s) sent to the server.', 4);
        } catch (error) {
            console.error('Failed to send all local cards to server:', error);
            notify('Sending local cards to the server failed.', 5);
        }
    }

    async fetchServerSavedCard(selectedCardId) {
        if (!selectedCardId) {
            return null;
        }
        var response = await fetch('/api/cards/' + encodeURIComponent(selectedCardId));
        if (!response.ok) {
            throw new Error('Load failed (' + response.status + ')');
        }
        return await response.json();
    }

    async loadCard(selectedCardKey) {
        await loadCardData(this.readLocalCardData(selectedCardKey), selectedCardKey);
    }

    async loadServerCard(selectedCardId) {
        if (!selectedCardId) {
            return;
        }
        try {
            var serverCard = await this.fetchServerSavedCard(selectedCardId);
            await loadCardData(serverCard.cardJson, serverCard.displayName || serverCard.legacyKey || serverCard.id);
        } catch (error) {
            console.error('Failed to load server card:', error);
            notify('Loading the server card failed.', 5);
        }
    }

    deleteCard() {
        var keyToDelete = document.querySelector('#load-card-options').value;
        if (!keyToDelete) {
            return;
        }
        var cardKeys = this.getLocalCardKeys();
        cardKeys.splice(cardKeys.indexOf(keyToDelete), 1);
        cardKeys.sort();
        localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
        localStorage.removeItem(keyToDelete);
        this.loadAvailableCards(cardKeys);
    }

    async deleteServerCard() {
        var selectedSummary = this.getSelectedServerCardSummary();
        if (!selectedSummary) {
            notify('Select a server card first.', 3);
            return;
        }
        if (!confirm('Delete the server card "' + selectedSummary.displayName + '"? This cannot be undone.')) {
            return;
        }
        try {
            var response = await fetch('/api/cards/' + encodeURIComponent(selectedSummary.id), {
                method: 'DELETE'
            });
            if (!response.ok && response.status != 404) {
                throw new Error('Delete failed (' + response.status + ')');
            }
            await this.refreshServerAvailableCards();
            notify('Server card deleted.', 4);
        } catch (error) {
            console.error('Failed to delete server card:', error);
            notify('Deleting the server card failed.', 5);
        }
    }

    deleteSavedCards() {
        if (!confirm('WARNING:\n\nALL of your saved cards will be deleted! If you would like to save these cards, please make sure you have downloaded them first. There is no way to undo this.\n\n(Press "OK" to delete your cards)')) {
            return;
        }
        var cardKeys = this.getLocalCardKeys();
        cardKeys.forEach(key => localStorage.removeItem(key));
        localStorage.setItem('cardKeys', JSON.stringify([]));
        this.loadAvailableCards([]);
    }

    async downloadSavedCards() {
        var cardKeys = this.getLocalCardKeys();
        if (!cardKeys.length) {
            return;
        }
        var allSavedCards = [];
        cardKeys.forEach(item => {
            allSavedCards.push({key: item, data: JSON.parse(localStorage.getItem(item))});
        });
        var download = document.createElement('a');
        download.href = URL.createObjectURL(new Blob([JSON.stringify(allSavedCards)], {type: 'text'}));
        download.download = 'saved-cards.cardconjurer';
        document.body.appendChild(download);
        await download.click();
        download.remove();
    }

    uploadSavedCards(event) {
        var storage = this;
        var reader = new FileReader();
        reader.onload = function() {
            JSON.parse(reader.result).forEach(item => storage.saveCard(item));
        };
        reader.readAsText(event.target.files[0]);
    }

    async sendServerCardToLocal() {
        var selectedSummary = this.getSelectedServerCardSummary();
        if (!selectedSummary) {
            notify('Select a server card first.', 3);
            return;
        }
        try {
            var serverCard = await this.fetchServerSavedCard(selectedSummary.id);
            this.saveCard({
                key: selectedSummary.displayName || selectedSummary.legacyKey || selectedSummary.id,
                data: serverCard.cardJson
            });
            notify('Server card copied to local storage.', 4);
        } catch (error) {
            console.error('Failed to copy server card to local storage:', error);
            notify('Copying the server card to local storage failed.', 5);
        }
    }
}

window.creatorCardStorage = window.creatorCardStorage || new CreatorCardStorageService();

