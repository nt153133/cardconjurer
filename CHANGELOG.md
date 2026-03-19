# CHANGELOG

All notable product-facing changes should be added here.

## Unreleased

### Added
- Validation workflow in Creator: added a `Validation` tab and local/server validation result sections wired to existing validation logic.
- Card size profile controls in Frame: restored profile selector, width/height inputs, apply/reset actions, and load override toggle.
- Print download option: added `Download print version (includes bleed)` toggle and wired it to server render payload.

### Changed
- Frame options layout: grouped `Rounded Corners`, `Guidelines`, and `Transparencies` on one line and added `Show Cut/Safe Overlay` toggle.
- Profile placement overlay behavior: mode-aware rendering now draws safe only in cut mode, and cut + safe in bleed mode.
- Download rendering behavior: profile overlay remains visible in editor preview but is suppressed during output generation.

### Fixed
- Creator startup stability: guarded optional DOM lookups (`#autoFrame`, `#autoframe-always-nyx`, `#art-update-autofit`) to prevent null-reference crashes.
- Restored grouped Import/Save local-vs-server action card markup and frame helper grid class after partial revert.
