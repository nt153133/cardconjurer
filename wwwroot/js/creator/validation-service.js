// Creator validation service: card-size profile validation, validation rendering,
// and bulk local saved-card profile normalization for local + server card stores.

class CreatorValidationService {
    constructor() {
        this.CARD_SIZE_VALIDATION_TOLERANCE_PX = 2;
        this._lastLocalValidationEntries = [];
    }

    async ensureCardSizeProfilesAvailable() {
        if (Object.keys(cardSizeProfilesByName).length > 0) {
            return true;
        }

        await loadCardSizeProfiles();
        return Object.keys(cardSizeProfilesByName).length > 0;
    }

    getKnownCardSizeProfiles() {
        return Object.values(cardSizeProfilesByName || {});
    }

    approximatelyEqualPixels(left, right, tolerance = this.CARD_SIZE_VALIDATION_TOLERANCE_PX) {
        return Math.abs(Number(left) - Number(right)) <= tolerance;
    }

    sizeMatchesProfile(size, width, height, tolerance = this.CARD_SIZE_VALIDATION_TOLERANCE_PX) {
        return !!size
            && this.approximatelyEqualPixels(size.width, width, tolerance)
            && this.approximatelyEqualPixels(size.height, height, tolerance);
    }

    getCardSizeMetrics(cardData) {
        var cutWidth = Math.round(Number(cardData && cardData.width) || 0);
        var cutHeight = Math.round(Number(cardData && cardData.height) || 0);
        var marginX = Number(cardData && cardData.marginX) || 0;
        var marginY = Number(cardData && cardData.marginY) || 0;
        var bleedWidth = Math.round(cutWidth * (1 + 2 * marginX));
        var bleedHeight = Math.round(cutHeight * (1 + 2 * marginY));

        return {
            cutWidth: cutWidth,
            cutHeight: cutHeight,
            marginX: marginX,
            marginY: marginY,
            bleedWidth: bleedWidth,
            bleedHeight: bleedHeight,
            hasMargins: marginX > 0 || marginY > 0
        };
    }

    getProfileNames(profiles) {
        return (profiles || []).map(function(profile) {
            return profile.name;
        });
    }

    inferCardSizeValidation(cardData) {
        var metrics = this.getCardSizeMetrics(cardData);
        var profiles = this.getKnownCardSizeProfiles();

        if (metrics.cutWidth <= 0 || metrics.cutHeight <= 0) {
            return {
                invalid: true,
                status: 'Missing dimensions',
                metrics: metrics,
                cutMatches: [],
                bleedMatches: [],
                exactMatches: [],
                details: 'Saved card is missing a usable width or height.'
            };
        }

        var service = this;
        var cutMatches = profiles.filter(function(profile) {
            return service.sizeMatchesProfile(profile.cut, metrics.cutWidth, metrics.cutHeight);
        });
        var bleedMatches = profiles.filter(function(profile) {
            return service.sizeMatchesProfile(profile.bleed, metrics.bleedWidth, metrics.bleedHeight);
        });
        var exactMatches = cutMatches.filter(function(profile) {
            return bleedMatches.some(function(bleedProfile) {
                return bleedProfile.name === profile.name;
            });
        });

        if (!metrics.hasMargins && cutMatches.length > 0) {
            return {
                invalid: false,
                status: 'Matches cut size',
                metrics: metrics,
                cutMatches: cutMatches,
                bleedMatches: bleedMatches,
                exactMatches: cutMatches,
                details: 'Card matches a known cut-size profile.'
            };
        }

        if (metrics.hasMargins && exactMatches.length > 0) {
            return {
                invalid: false,
                status: 'Matches cut + bleed',
                metrics: metrics,
                cutMatches: cutMatches,
                bleedMatches: bleedMatches,
                exactMatches: exactMatches,
                details: 'Card matches a known profile including calculated bleed size.'
            };
        }

        var status = 'No known profile';
        var details = 'Card dimensions do not match any known cut or bleed size.';
        if (cutMatches.length > 0 && bleedMatches.length === 0) {
            status = 'Cut matches only';
            details = 'The saved width/height match a known profile, but the calculated bleed size does not.';
        } else if (cutMatches.length === 0 && bleedMatches.length > 0) {
            status = 'Bleed matches only';
            details = 'The calculated size with margin matches a known profile, but the saved width/height do not.';
        } else if (cutMatches.length > 0 && bleedMatches.length > 0 && exactMatches.length === 0) {
            status = 'Mixed profile match';
            details = 'Cut and calculated bleed each match known profiles, but not the same one.';
        }

        return {
            invalid: true,
            status: status,
            metrics: metrics,
            cutMatches: cutMatches,
            bleedMatches: bleedMatches,
            exactMatches: exactMatches,
            details: details
        };
    }

    getLocalValidationEntries() {
        var keys = window.creatorCardStorage.getLocalCardKeys().slice().sort();
        var entries = [];
        var service = this;
        keys.forEach(function(key) {
            try {
                var data = window.creatorCardStorage.readLocalCardData(key);
                if (!data) {
                    return;
                }
                entries.push({
                    key: key,
                    name: key,
                    data: data,
                    validation: service.inferCardSizeValidation(data)
                });
            } catch (error) {
                entries.push({
                    key: key,
                    name: key,
                    data: null,
                    validation: {
                        invalid: true,
                        status: 'Unreadable card',
                        metrics: {cutWidth: 0, cutHeight: 0, bleedWidth: 0, bleedHeight: 0, marginX: 0, marginY: 0},
                        cutMatches: [],
                        bleedMatches: [],
                        exactMatches: [],
                        details: 'Failed to read saved card JSON: ' + error
                    }
                });
            }
        });
        return entries;
    }

    normalizeMarginScale(marginScale) {
        if (marginScale == null) {
            return null;
        }
        if (typeof marginScale === 'number' && Number.isFinite(marginScale)) {
            return {x: marginScale, y: marginScale};
        }

        var x = Number(marginScale.x);
        var y = Number(marginScale.y);
        var uniform = Number(marginScale.uniform);

        if (!Number.isFinite(x) && Number.isFinite(uniform)) {
            x = uniform;
        }
        if (!Number.isFinite(y) && Number.isFinite(uniform)) {
            y = uniform;
        }

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }

        return {x: x, y: y};
    }

    applySelectedProfileSizeToSavedCard(cardData, profile, normalizedMarginScale) {
        if (!cardData || !profile || !profile.cut) {
            return cardData;
        }

        cardData.width = Number(profile.cut.width);
        cardData.height = Number(profile.cut.height);

        var shouldKeepMargins = !!cardData.margins || (Number(cardData.marginX) || 0) > 0 || (Number(cardData.marginY) || 0) > 0;
        if (shouldKeepMargins && normalizedMarginScale) {
            cardData.marginX = normalizedMarginScale.x;
            cardData.marginY = normalizedMarginScale.y;
            cardData.margins = true;
        } else {
            cardData.marginX = 0;
            cardData.marginY = 0;
            cardData.margins = false;
        }

        return cardData;
    }

    async updateLocalSavedCardsToSelectedProfile(includeOnlyInvalid) {
        if (!(await this.ensureCardSizeProfilesAvailable())) {
            notify('Validation cannot update saved cards until size profiles are available.', 5);
            return;
        }

        var selectedProfile = getSelectedCardSizeProfile();
        if (!selectedProfile || !selectedProfile.cut) {
            notify('Select a card size profile on the Frame tab first.', 4);
            return;
        }

        var normalizedMarginScale = this.normalizeMarginScale(getSelectedCardSizeMarginScale());
        var entries = includeOnlyInvalid && this._lastLocalValidationEntries.length
            ? this._lastLocalValidationEntries.slice()
            : this.getLocalValidationEntries();
        this._lastLocalValidationEntries = entries;

        var targetEntries = entries.filter(function(entry) {
            if (!entry || !entry.key || !entry.data) {
                return false;
            }
            return includeOnlyInvalid ? !!(entry.validation && entry.validation.invalid) : true;
        });

        if (!targetEntries.length) {
            notify(includeOnlyInvalid ? 'No invalid local cards need review.' : 'No readable local cards were found to update.', 4);
            await this.refreshLocalValidation();
            return;
        }

        var updatedCount = 0;
        var failedKeys = [];
        var service = this;
        targetEntries.forEach(function(entry) {
            try {
                var updatedData = service.applySelectedProfileSizeToSavedCard(JSON.parse(JSON.stringify(entry.data)), selectedProfile, normalizedMarginScale);
                localStorage.setItem(entry.key, JSON.stringify(updatedData));
                updatedCount++;
            } catch (error) {
                console.error('Failed to update local card to selected profile:', entry.key, error);
                failedKeys.push(entry.key);
            }
        });

        await this.refreshLocalValidation();

        if (failedKeys.length) {
            notify(
                'Updated ' + updatedCount + ' local card(s), but failed to update: ' + failedKeys.join(', '),
                5
            );
            return;
        }

        notify(
            (includeOnlyInvalid ? 'Updated invalid local cards' : 'Updated all local cards')
            + ' to ' + selectedProfile.name + ' (' + updatedCount + ' total).',
            4
        );
    }

    async setInvalidLocalCardsToSelectedProfile() {
        await this.updateLocalSavedCardsToSelectedProfile(true);
    }

    async setAllLocalCardsToSelectedProfile() {
        await this.updateLocalSavedCardsToSelectedProfile(false);
    }

    renderValidationResults(summarySelector, resultsSelector, sourceLabel, entries) {
        var summaryEl = document.querySelector(summarySelector);
        var resultsEl = document.querySelector(resultsSelector);
        if (!summaryEl || !resultsEl) {
            return;
        }

        var items = Array.isArray(entries) ? entries : [];
        var invalidEntries = items.filter(function(entry) {
            return entry && entry.validation && entry.validation.invalid;
        });
        var validCount = items.length - invalidEntries.length;

        summaryEl.textContent = items.length === 0
            ? 'No ' + sourceLabel.toLowerCase() + ' cards found.'
            : items.length + ' checked · ' + validCount + ' matched known profiles · ' + invalidEntries.length + ' need review';

        resultsEl.innerHTML = '';
        if (items.length === 0) {
            resultsEl.innerHTML = '<p class="validation-result-empty">No ' + escapeHtml(sourceLabel.toLowerCase()) + ' cards found.</p>';
            return;
        }
        if (invalidEntries.length === 0) {
            resultsEl.innerHTML = '<p class="validation-result-empty">All ' + escapeHtml(sourceLabel.toLowerCase()) + ' cards match known card size profiles.</p>';
            return;
        }

        var service = this;
        invalidEntries.forEach(function(entry) {
            var validation = entry.validation;
            var metrics = validation.metrics;
            var cardNode = document.createElement('div');
            cardNode.className = 'validation-result-card invalid';

            var cutMatches = service.getProfileNames(validation.cutMatches);
            var bleedMatches = service.getProfileNames(validation.bleedMatches);

            cardNode.innerHTML = '' +
                '<div class="validation-result-header">' +
                    '<h5>' + escapeHtml(entry.name) + '</h5>' +
                    '<span class="validation-status-badge invalid">' + escapeHtml(validation.status) + '</span>' +
                '</div>' +
                '<div class="validation-metrics">' +
                    '<div class="validation-metric"><span>Width × height</span><strong>' + escapeHtml(metrics.cutWidth + ' × ' + metrics.cutHeight + ' px') + '</strong></div>' +
                    '<div class="validation-metric"><span>Calculated with margin</span><strong>' + escapeHtml(metrics.bleedWidth + ' × ' + metrics.bleedHeight + ' px') + '</strong></div>' +
                    '<div class="validation-metric"><span>Margins</span><strong>' + escapeHtml((metrics.marginX * 100).toFixed(2) + '% × ' + (metrics.marginY * 100).toFixed(2) + '%') + '</strong></div>' +
                '</div>' +
                '<div class="validation-result-body">' +
                    '<p class="validation-result-details">' + escapeHtml(validation.details) + '</p>' +
                    '<div class="validation-result-row"><span class="validation-result-label">Cut matches</span><span>' + escapeHtml(cutMatches.length ? cutMatches.join(', ') : 'None') + '</span></div>' +
                    '<div class="validation-result-row"><span class="validation-result-label">Size with margin matches</span><span>' + escapeHtml(bleedMatches.length ? bleedMatches.join(', ') : 'None') + '</span></div>' +
                '</div>';

            resultsEl.appendChild(cardNode);
        });
    }

    async refreshLocalValidation() {
        var summaryEl = document.querySelector('#validation-local-summary');
        if (summaryEl) {
            summaryEl.textContent = 'Validating local cards...';
        }

        if (!(await this.ensureCardSizeProfilesAvailable())) {
            var resultsEl = document.querySelector('#validation-local-results');
            if (summaryEl) {
                summaryEl.textContent = 'Card size profiles are unavailable, so validation cannot run.';
            }
            if (resultsEl) {
                resultsEl.innerHTML = '<p class="validation-result-empty">Validation unavailable until known card size profiles load.</p>';
            }
            return;
        }

        var entries = this.getLocalValidationEntries();
        this._lastLocalValidationEntries = entries;

        this.renderValidationResults('#validation-local-summary', '#validation-local-results', 'Local', entries);
    }

    async refreshServerValidation() {
        var summaryEl = document.querySelector('#validation-server-summary');
        if (summaryEl) {
            summaryEl.textContent = 'Validating server cards...';
        }

        if (!(await this.ensureCardSizeProfilesAvailable())) {
            var resultsEl = document.querySelector('#validation-server-results');
            if (summaryEl) {
                summaryEl.textContent = 'Card size profiles are unavailable, so validation cannot run.';
            }
            if (resultsEl) {
                resultsEl.innerHTML = '<p class="validation-result-empty">Validation unavailable until known card size profiles load.</p>';
            }
            return;
        }

        if (!(window._serverSavedCards || []).length) {
            await window.creatorCardStorage.refreshServerAvailableCards('', {skipValidationRefresh: true});
        }

        var summaries = (window._serverSavedCards || []).slice();
        var service = this;
        var entries = await Promise.all(summaries.map(async function(summary) {
            var name = summary.displayName || summary.legacyKey || summary.id;
            try {
                var details = await window.creatorCardStorage.fetchServerSavedCard(summary.id);
                return {
                    name: name,
                    validation: service.inferCardSizeValidation(details.cardJson)
                };
            } catch (error) {
                return {
                    name: name,
                    validation: {
                        invalid: true,
                        status: 'Unreadable server card',
                        metrics: {cutWidth: 0, cutHeight: 0, bleedWidth: 0, bleedHeight: 0, marginX: 0, marginY: 0},
                        cutMatches: [],
                        bleedMatches: [],
                        exactMatches: [],
                        details: 'Failed to load server card JSON: ' + error
                    }
                };
            }
        }));

        this.renderValidationResults('#validation-server-summary', '#validation-server-results', 'Server', entries);
    }

    async loadValidationTab() {
        await Promise.all([this.refreshLocalValidation(), this.refreshServerValidation()]);
    }

    refreshValidationTabIfVisible() {
        var validationSection = document.querySelector('#creator-menu-validation');
        if (validationSection && !validationSection.classList.contains('hidden')) {
            this.loadValidationTab();
        }
    }
}

window.creatorValidationService = window.creatorValidationService || new CreatorValidationService();

