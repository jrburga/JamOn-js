# JamOn-js Feature Planning

This folder contains design documents for planned features. Each doc covers user stories, UI/UX, state changes, new assets, and network protocol changes.

---

## Feature Documents

| Feature | Doc | Theme |
|---|---|---|
| Arpeggiator | [arpeggiator.md](./arpeggiator.md) | Live performance |
| Scale Locking | [scale-locking.md](./scale-locking.md) | Live performance |
| Variable Pattern Lengths | [variable-pattern-lengths.md](./variable-pattern-lengths.md) | Composition |
| Overdub / Pattern Versioning | [overdub.md](./overdub.md) | Composition |
| Arrangement / Scheduling Layer | [arrangement-layer.md](./arrangement-layer.md) | Composition |
| Per-Pattern Effects | [per-pattern-effects.md](./per-pattern-effects.md) | Sound design |
| Drum Kit Redesign | [drum-kit-redesign.md](./drum-kit-redesign.md) | Sound design |
| Session Persistence & Export | [session-persistence-export.md](./session-persistence-export.md) | Sharing |
| Mobile-Friendly Design | [mobile-design.md](./mobile-design.md) | Platform |

---

## Dependency Map

Some features build on others. The recommended implementation order if pursuing multiple features:

```
Scale Locking          ──┐
Variable Lengths       ──┤──► Arpeggiator   (benefits from scale + length)
                          │
Drum Kit Redesign      ──┤──► Per-Pattern Effects   (effects chain built on redesigned IM)
                          │
Variable Lengths       ──┤──► Arrangement Layer      (needs phrase_length in scene)
                          │
Overdub                ──┤──► Session Persistence    (version chain preserved in save file)
Per-Pattern Effects    ──┘
```

**Safe to build independently** (no cross-dependencies):
- Scale Locking
- Drum Kit Redesign
- Session Persistence (basic save/load works without effects or overdub)
- **Mobile Design** — CSS/layout layer only; touch input in Track.jsx is independent of all audio features

---

## Performance Track vs. Composition Track

Features group naturally into two development directions:

### Performance Track (make live jamming more expressive)
1. **Scale Locking** — anyone can play in key
2. **Arpeggiator** — automated melodic sequences
3. **Drum Kit Redesign** — real sounds, named lanes

### Composition Track (make the output more intentional)
1. **Variable Pattern Lengths** — musical phrase variety
2. **Per-Pattern Effects** — shape the mix
3. **Arrangement Layer** — structure the jam into a track
4. **Overdub** — refine patterns iteratively
5. **Session Persistence & Export** — save and share the result

---

## Shared Infrastructure Changes

Several features require the same underlying additions. Build these once, reuse across features:

| Infrastructure | Required by |
|---|---|
| `phrase_length` in `on_scene_change` | Variable Lengths, Arrangement Layer |
| `scale_key` + `scale_type` in `on_scene_change` | Scale Locking, Arpeggiator |
| `offsetBars` on Pattern | Arrangement Layer, Variable Lengths (playback loop) |
| `effects` on Pattern | Per-Pattern Effects, Session Persistence |
| `version` + `overrides_id` on Pattern | Overdub, Session Persistence |
| Sampler-based drum channel in `InstrumentManager` | Drum Kit Redesign, Audio Export |
| `velocity` on Note | Drum Kit Redesign, Arpeggiator (accent support) |
