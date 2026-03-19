# CHANGELOG

All notable product-facing changes should be added here.

## Unreleased

### Added
- Validation workflow in Creator: added a `Validation` tab and local/server validation result sections wired to existing validation logic.
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
- Frame options layout: grouped `Rounded Corners`, `Guidelines`, and `Transparencies` on one line and added `Show Cut/Safe Overlay` toggle.
- Profile placement overlay behavior: mode-aware rendering now draws safe only in cut mode, and cut + safe in bleed mode.
- Download rendering behavior: profile overlay remains visible in editor preview but is suppressed during output generation.
- Card-size updates now automatically reapply an active Margin frame after `Apply card size` and load-with-selected-size-profile flows.
- Loading with `Use selected size profile when loading cards` now notifies when a card's saved size is overridden to the selected profile size.

### Fixed
- Creator startup stability: guarded optional DOM lookups (`#autoFrame`, `#autoframe-always-nyx`, `#art-update-autofit`) to prevent null-reference crashes.
- Restored grouped Import/Save local-vs-server action card markup and frame helper grid class after partial revert.
