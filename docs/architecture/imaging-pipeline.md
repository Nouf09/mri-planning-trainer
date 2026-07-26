# Imaging pipeline

`features/imaging` is the only domain that spans pure mathematics and browser
rendering, so it is the only one with internal layers. They are ordered by what
each is allowed to know; see [layers-and-boundaries.md](layers-and-boundaries.md)
for the enforced import rules.

```
adapters/    engines + samplers        ← the only place a library is imported
   │
   ▼
domain/      value types, capability contracts, anatomical reading
   │
   ├──► reslice/          pure oblique sampling engine
   │       └── runtime/   descriptors, scheduling, caching, React hooks
   │
   ├──► projection/       world → view plane → viewport pixels
   │       └── overlays/  canvas drawing from already-projected input
   │
   └──► components/       preview viewports
```

## Engines

Two engines behind one interface. `create-imaging-engine.ts` is the selection
boundary:

```ts
switch (kind) {
  case "jpg":    return createLegacyJpgEngine();
  case "niivue": return hasWebGL2() ? createNiivueEngine() : createLegacyJpgEngine();
  default:       return createLegacyJpgEngine();
}
```

Any kind that cannot be constructed degrades to a working viewport rather than
failing. A volume engine is selected only when the environment can actually
render one, so `hasWebGL2()` is checked *before* construction rather than
discovered as an exception afterwards.

`useVolumeEngine` drives the `mount → load → ready | error → dispose` lifecycle
and exposes it as a discriminated status. Failures are per-viewport state, not
thrown — see [composition-and-runtime.md](composition-and-runtime.md).

## Capability surfacing

The problem: the reslice runtime needs to sample a real volume, but nothing above
`adapters/` may see `NVImage`.

The solution is a capability object built inside the adapter and passed upward as
pure data:

```ts
interface ImagingRuntimeCapabilities {
  volumeIdentity: string;
  geometry: VolumeGeometry;
  volumeSampler: VolumeSamplerCapability | null;  // null when unavailable
}
```

Three constraints hold this together:

- **Only the axial viewport surfaces capabilities.** `MedicalViewport` returns
  early for other planes, so there is exactly one runtime sampling owner and no
  ambiguity about which of three engine instances is authoritative.
- **`NVImage` never crosses the boundary.** The sampler accepts a structural
  `NiivueImageLike` (`frac2mmOrtho` plus `getValue`), which is also what makes it
  unit-testable without WebGL.
- **`createSampler()` is deferred.** The capability exposes a factory, not a
  sampler, so the obliquity and shear gates run when a sampler is actually needed
  and their refusal is a value rather than an exception.

## The reslice engine

`reslice/` is pure: no React, no canvas, no Niivue. Its contract with the outside
world is one interface:

```ts
interface VolumeSampler {
  volumeId: string;
  dimensions: [number, number, number];
  worldToVoxel(x: number, y: number, z: number, out: MutableVec3): boolean;
  getVoxel(x: number, y: number, z: number): number | null;
}
```

Anything satisfying it can be resliced — a real volume, or the synthetic volumes
in `reslice/testing/synthetic-volume.ts`. That is what makes the engine testable
against analytically known data.

The stages:

| Module | Role |
| --- | --- |
| `prescription-to-reslice-request.ts` | Restates a prescription as an `ObliqueSliceRequest`. A pure copy: no screen coordinates, no world-to-voxel work |
| `oblique-slice-request.ts` | Validates the request; `RequestValidation` distinguishes malformed from unsupported |
| `reslice-volume.ts` | Walks the output grid, samples, returns a `ReslicedSlice` |
| `interpolation.ts` | Nearest-neighbour and trilinear |
| `intensity-mapping.ts` | `toGrayscale` maps raw intensities through an `IntensityWindow` |

`ReslicedSlice` keeps intensities **unnormalised** (`Float32Array`) and carries a
separate `alpha` channel where 0 marks samples that fell outside the volume. That
keeps "no data" visually distinct from "genuine low signal", and keeps display
mapping a separate concern from sampling. Buffers are freshly allocated per call
and never alias sampler storage.

Outcomes are discriminated: `ok` | `invalid-request` | `volume-mismatch`. The
`volumeId` check exists so a stale request can never sample a newly loaded
volume.

## Preview runtime

`reslice/runtime/` orchestrates. It is where laziness, caching, and cancellation
live — and it is deliberately separate from the engine so that the engine stays
trivially testable.

**Descriptor.** `buildStackDescriptor(prescription, capabilities)` runs the gates
once, reads `sliceOffsetsMm`, computes output dimensions, and produces a
`StackDescriptor` with an **identity string** capturing every rendering-affecting
input: volume identity, output dimensions, intensity window, prescription centre,
orientation, slice count, and the offsets themselves.

**Cache.** One `Map<index, image>` per descriptor identity. When the identity
changes the cache is replaced wholesale, so it is impossible to serve an image
rendered for a different prescription. Because the identity already contains the
offsets, cache invalidation needs no separate bookkeeping.

**Scheduler.** `createPreviewScheduler` coalesces work into a single
`requestAnimationFrame` and guards publication with a monotonic generation
counter. A render whose generation is stale cannot paint over a newer selection —
the concrete failure this prevents is a slow slice landing after the user has
already scrolled past it. A `Deferrer` seam allows deterministic tests without
timers.

**Hooks.** `use-oblique-stack.ts` is the only stateful part: it holds
`selectedIndex`, rebuilds the descriptor only when the prescription or capability
changes, resets to `centreSliceIndex(count) = floor(count/2)` on a new stack, and
publishes a discriminated `ObliqueStackState` (`hidden` | `waiting-for-volume` |
`unsupported` | `invalid` | `error` | `ready`).

Navigation changes `selectedIndex` and nothing else. It never touches the
prescription, the descriptor, or the cache.

**Slices are planes, not slabs.** Each rendered image is the plane at that
slice's centre offset; `sliceThickness` affects spacing only. No integration
across the slice profile is performed, and the code says so where it could be
mistaken.

## Projection and overlays

`projection/` converts geometry to pixels; `overlays/` draws already-projected
pixels and performs no geometry of its own. The split exists so that hit-testing
and drawing consume the identical `ProjectionResult` — the interactive regions are
the painted ones by construction. Details in
[coordinate-spaces.md](coordinate-spaces.md).

`quad.ts` holds the shared pixel-space predicates (`pointInConvexQuad`,
`quadArea`, `topEdgeIndex`, `quadOutwardNormal`), so renderer and hit-tester agree
on where a handle is.

## Painting

`oblique-preview-painter.ts` is the narrowest module in the pipeline: it converts
`{ gray, alpha }` into `ImageData` and blits it. An architecture test asserts it
contains no reslice, no intensity mapping, and no affine work. `imageRendering:
pixelated` is set on the canvas; the current implementation suggests this is to
keep the sampled grid visible rather than smoothed away by browser interpolation,
though that rationale is inferred from the code rather than stated in it.

## Anatomical reading

`domain/anatomical-direction.ts` maps a world direction to anatomical letters. It
imports nothing at all.

| Function | Answers |
| --- | --- |
| `directionFromNormal(normal)` | Which axes does *increasing offset* advance along? A property of the prescription |
| `oppositeDirection(direction)` | The same axes read the other way, order preserved |
| `positionForOffset(direction, offsetMm)` | Where does *this slice* sit relative to the centre? A property of the slice |

The distinction between the first and the third is not cosmetic: conflating them
labelled negative offsets with the positive direction, which read as anatomically
backwards. Both statements, the RAS letter conventions, and the opposed-pair
mapping are recorded with sources in
[docs/mri-sources/slice-orientation.md](../mri-sources/slice-orientation.md).
