# TODO

- [ ] Add `item.mode` compositing parity in `RenderV2` (`CardRenderV2Service.DrawFramesAsync`) to mirror JS `globalCompositeOperation` behavior from `drawFrames()`.
- [ ] Fix `DrawArtAsync` cut-space parity by scaling art placement from cut dimensions plus margins (not bleed canvas dimensions) to match JS `drawCard()`.
