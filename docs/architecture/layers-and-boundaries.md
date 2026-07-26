# Layers and boundaries

Two rules govern the entire codebase. Almost every structural decision follows
from them, and both are enforced by tests rather than by convention.

## Rule 1 — Planning owns geometry

Every world coordinate originates in `features/planning` and is never
re-derived. Slice positions come from `sliceOffsetsMm(prescription)` and nowhere
else; the orientation basis comes from `orientationFromAngles`; the selected
slice's world position comes from `selectedSliceCenter`.

When the imaging domain needs a slice position it *reads* one. It does not
recompute `thickness + gap`, and it does not keep its own copy. `build-oblique-stack.ts`
reads `sliceOffsetsMm(prescription)` verbatim into its descriptor, and a test
asserts that the file contains no spacing arithmetic of its own.

The reason is that duplicated geometry drifts silently. Two places that both
compute slice spacing will eventually disagree by a rounding rule or an
off-by-one, and the symptom will appear as a subtly mis-registered image rather
than as an error.

## Rule 2 — Imaging owns rendering

Sampling, projection, canvas drawing, and engine lifecycles live in
`features/imaging`. Planning never imports a renderer, never touches a canvas,
and has no idea a viewport exists. `features/planning` contains no React
component and no DOM reference.

The corollary that matters in review: a pull request that adds geometry to a
renderer, or rendering to the planning domain, is wrong even if it works.

## Dependency direction

`features/imaging/domain` is a **shared value-type kernel**. It holds the types
both domains need to speak about the same world — `VolumePosition`,
`WorldBounds`, `AnatomicalPlane`, `VolumeGeometry` — and it contains no
rendering, no sampling, and no engine code.

```
                 ┌──────────────────────┐
                 │  imaging/domain      │   shared value-type kernel
                 │  (positions, bounds, │
                 │   planes, geometry)  │
                 └──────────┬───────────┘
                     ▲              ▲
        planning ────┘              └──── imaging: reslice, projection,
        guidance ──► planning              overlays, adapters, hooks,
                        ▲                  components
                        └──────────────────┘
                          consumes planning types
                                 │
                                 ▼
                        components / pages
```

The invariant, stated precisely:

- **Planning may depend on `imaging/domain`.** It does: `Prescription` and
  `prescription-math` use `VolumePosition` and `WorldBounds`, and
  `prescription-math` imports `boundsSize` as a value. This is a dependency on
  shared vocabulary, not on rendering.
- **Planning must not depend on any other part of imaging** — not `reslice/`,
  `projection/`, `overlays/`, `adapters/`, `hooks/`, or `components/`.
- **Imaging's rendering and runtime layers must not own planning rules.** They
  consume planning types (`Prescription`, `PlaneOrientation`, `Vec3`) and read
  planning-derived values; they never define slice geometry or orientation
  behaviour.

So the relationship is not a one-way stack. It is a shared kernel with two
domains above it, and a rule about which of them may own which rules.

React is confined to components and hooks. Within `reslice/runtime/` it appears
only in the two orchestration hooks (`use-oblique-preview.ts`,
`use-oblique-stack.ts`) — asserted by an architecture test — which exist
precisely to keep React out of the pure runtime beneath them. Elsewhere it
appears in the imaging hooks, `use-planning-session.ts`, and the components.

## Purity gradient inside `features/imaging`

Layers are ordered by what they are allowed to know:

| Layer | May import | Must not import |
| --- | --- | --- |
| `domain/` | Pure types only | React, canvas, Niivue |
| `reslice/` | Planning types, `domain/` | React, canvas, Niivue, projection, renderers |
| `reslice/runtime/` | `reslice/`, `domain/` | Niivue, `NVImage`; React only in the two hooks |
| `projection/` | Planning types, `domain/` | React, canvas, Niivue |
| `overlays/` | `projection/`, `domain/` | Geometry, reslicing, sampling, hit-testing |
| `adapters/` | Everything above, plus its own library | — |
| `components/` | Everything | Reslicing or geometry of their own |

`adapters/` is the containment boundary for third-party libraries. Niivue is
imported in exactly one folder, and `NVImage` never crosses out of it: the
sampler declares a structural `NiivueImageLike` interface instead of accepting
the library type, so everything above the adapter is testable without a WebGL
context.

## What is machine-enforced

Six boundary-enforcement test files read the source as text and assert boundaries
that types alone cannot express: **five** named `*architecture*.test.ts`, **plus**
`components/planning-mode-composition.test.ts`, which enforces the same kind of
rule under a different filename convention. They are cheap, they fail loudly, and
they have caught real regressions.

**`reslice/architecture.test.ts`** — the reslice engine depends on the planning
domain for pure types only.

**`reslice/runtime/architecture.test.ts`** — no preview module imports Niivue or
mentions `NVImage`; React appears only in the two orchestration hooks; the
painter performs no reslice, mapping, or affine work; the engine core imports no
React or canvas types.

**`adapters/niivue/reslice-adapter.architecture.test.ts`** — no reslice
production file imports Niivue; the sampler uses a structural image type rather
than the library type; it imports no React, canvas, DOM, or WebGL; it depends on
no renderer or projection code; only the integration test imports Niivue in that
area; the constructed object matches the `VolumeSampler` contract.

**`reslice/runtime/oblique-stack.architecture.test.ts`** — the stack imports no
Niivue; it computes no planning geometry, taking positions from `sliceOffsetsMm`;
it reuses the existing reslice pipeline rather than a second one; the component
performs no reslice or geometry; the Phase 10C reference modules remain present;
the live app routes through the stack.

**`overlays/reference-line.architecture.test.ts`** — the renderer does no
geometry, reslicing, sampling, or hit-testing; the world-position helper reuses
`sliceOffsetsMm`; the viewport draws the reference line from the shared
projection outline and adds no second projection.

Plus **`components/planning-mode-composition.test.ts`**, which enforces the
single composition root — see [composition-and-runtime.md](composition-and-runtime.md).

## The one module with no imports at all

`imaging/domain/anatomical-direction.ts` imports nothing. It declares its own
structural `DirectionVector` rather than borrowing planning's `Vec3`, so the
anatomical letter mapping (sourced in
[docs/mri-sources/slice-orientation.md](../mri-sources/slice-orientation.md)) has
zero coupling in either direction. That is the purity ceiling of the codebase and
a useful template for new domain helpers.
