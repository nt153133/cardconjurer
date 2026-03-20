# CHANGELOG

All notable product-facing changes should be added here.

## Unreleased

### Added
- Import/Save: added `Download All Images (Print Bleed)` button that bulk-renders all saved cards through the server renderer with `isPrintImage: true` and saves them as a ZIP.
- Validation workflow in Creator: added a `Validation` tab and local/server validation result sections wired to existing validation logic.
- Validation bulk-fix actions: added buttons to update invalid local cards or all local saved cards to the currently selected size profile.

### Changed
- Frame tab UI and autoFrame logic extracted into modular files: `frameTab.js` (frame picker UI), `autoFrameLogic.js` (frame type selection), `autoFrameVariants.js` (frame-specific variants), `autoFrameHelpers.js` (frame layer builders) for improved maintainability.
- Creator preview info strip: added an under-canvas box showing current size, loaded saved name, and art URL, plus a `Create New` action button.
- Card size profile controls in Frame: restored profile selector, width/height inputs, apply/reset actions, and load override toggle.
- Print download option: added `Download print version (includes bleed)` toggle and wired it to server render payload.
- Git history import: added card import normalization service (`f763650`, `feat(import-normalization)`).
- Git history import: implemented server-side asset upload functionality (`21882f4`, `feat(assets)`).
- Git history import: added endpoints for listing uploaded assets (`afba760`, `feat(assets)`).
- Git history import: implemented asset library management features (`ed99014`, `feat(asset-library)`).
- Git history import: implemented card storage and management features (`945ae03`, `feat(cards)`).
- Git history import: implemented card image rendering endpoints and service (`752ffd8`, `feat(card-image)`).
- Git history import: added standard card size settings and related canvas functionality (`580a5f3`, `feat(canvas)`).
- Git history import: enhanced Docker configuration to support asset management flows (`cfe7b82`, `feat(docker)`).
- Git history import: added card size profile management and processing for rendering (`89829f9`, `feat(card-image)`).

### Changed
- Creator script structure: started hybrid split by moving core draw/guideline/profile-overlay/rounded-corner rendering functions into `wwwroot/js/creator/rendering.js` while keeping current inline handlers via global bridge.
- Creator script structure: split local/server saved-card management into `wwwroot/js/creator/card-storage.js` (`CreatorCardStorageService`) and converted `creator-23.js` storage functions to compatibility delegates.
- Creator script structure: split validation/profile-match logic into `wwwroot/js/creator/validation-service.js` (`CreatorValidationService`) and converted `creator-23.js` validation functions to compatibility delegates.
- Creator script structure: moved Set Symbol tab behavior and `drawSetSymbol(...)` into `wwwroot/js/creator/set-symbol-tab.js` and kept existing tab handlers unchanged.
- Creator script structure: moved Watermark tab behavior (upload/select/edit/reset and set-code SVG watermark import) into `wwwroot/js/creator/watermark-tab.js`.
- Creator script structure: moved Collector tab behavior (bottom info style/rendering, serial controls, artist sync, and collector defaults/toggles) into `wwwroot/js/creator/collector-tab.js`.
- Creator script structure: applied safe Frame-tab follow-up split (`wwwroot/js/creator/frameTab.js`) as namespaced picker helpers only, avoiding runtime overrides like `addFrame(...)`.
- Creator script structure: centralized asset server upload/list/select operations into `wwwroot/js/creator/asset-library.js` and delegated art/frame/set-symbol/watermark library calls to it.
- Import/Save download and upload controls regrouped into paired action cards: image downloads (both normal and print-bleed) on one side, cards-file download and upload on the other.
- Frame options layout: grouped `Rounded Corners`, `Guidelines`, and `Transparencies` on one line and added `Show Cut/Safe Overlay` toggle.
- Validation review output now renders as spaced flowing cards with structured details instead of dense unseparated text.
- Profile placement overlay behavior: mode-aware rendering now draws safe only in cut mode, and cut + safe in bleed mode.
- Download rendering behavior: profile overlay remains visible in editor preview but is suppressed during output generation.
- Card-size updates now automatically reapply an active Margin frame after `Apply card size` and load-with-selected-size-profile flows.
- Loading with `Use selected size profile when loading cards` now notifies when a card's saved size is overridden to the selected profile size.

### Fixed
- Text editing no longer throws on missing textbox font sizes, and autoframe no longer reloads frame packs on each keystroke when key text fields are absent.
- Creator startup stability: guarded optional DOM lookups (`#autoFrame`, `#autoframe-always-nyx`, `#art-update-autofit`) to prevent null-reference crashes.
- Restored grouped Import/Save local-vs-server action card markup and frame helper grid class after partial revert.
- Frame tab behavior: restored frame preview rendering, frame-list labels, drag/reorder, and frame settings interactions by avoiding conflicting `addFrame(...)` overrides.
