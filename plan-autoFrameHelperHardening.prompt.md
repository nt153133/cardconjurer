## Plan: AutoFrame helper hardening follow-up

Tighten the post-extraction AutoFrame path so missing helper load order fails safely (not with runtime `ReferenceError`), clean obvious helper-split leftovers, and record the fix in `CHANGELOG.md` only if behavior changes user-facing outcomes. The approach is to add a small dependency guard in the dispatcher, make helper availability explicit, remove low-value leftovers, then run quick static/smoke checks.

### Steps
1. Map current dependency edges across `Pages/Creator.cshtml`, `wwwroot/js/autoFrame/autoFrameLogic.js` (`autoFrame`), and `wwwroot/js/autoFrame/autoFrameVariants.js` (`autoUBFrame`, `autoCircuitFrame`, `autoM15Frame`).
2. Add a pre-dispatch guard in `wwwroot/js/autoFrame/autoFrameLogic.js` (e.g., `ensureAutoFrameHelpersLoaded`) that verifies required `make*FrameByLetter` globals, emits `notify(...)`, and exits early when missing.
3. Make helper readiness explicit in `wwwroot/js/autoFrame/autoFrameHelpers.js` via a sentinel/version on `window` and normalized exported helper names used by the guard.
4. Clean obvious split artifacts: fix helper file header/comment formatting in `wwwroot/js/autoFrame/autoFrameHelpers.js` and remove unused `group`/`frame` assignments in `wwwroot/js/autoFrame/autoFrameLogic.js`.
5. Add a concise `### Fixed` entry in `CHANGELOG.md` under `## Unreleased` if this changes runtime behavior (missing-helper handling, clearer failure mode).
6. Run quick checks: static diagnostics on touched files, grep for stray `function make.*FrameByLetter` definitions outside `wwwroot/js/autoFrame/autoFrameHelpers.js`, and a minimal creator smoke path for UB/Circuit autoframe invocation.

### Further Considerations
1. Keep duplicate AutoFrame variant implementations in `creator-23.js`, or start de-duplicating now (low risk now vs cleaner long-term)?
2. On missing helpers, should fallback be “notify and skip” or “attempt one-time `loadScript(...)` retry then notify”?
3. Changelog wording preference: user-facing reliability fix (`Fixed`) vs internal refactor follow-up (`Changed`)?

