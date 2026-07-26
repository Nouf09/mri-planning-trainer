# Coordinate spaces

This is the hardest part of the codebase to hold in your head, and the part where
a plausible-looking change does the most damage. A mistake here produces images
that look reasonable and are anatomically wrong.

Domain facts referenced below — RAS conventions, the NIfTI affine, what the
bundled volume actually contains — are recorded with sources in
[docs/mri-sources/slice-orientation.md](../mri-sources/slice-orientation.md).
This document describes only how the code moves between spaces.

## The spaces

| Space | Unit | Where it appears |
| --- | --- | --- |
| **World (ortho-mm)** | millimetres | The shared planning space. `Prescription.center`, orientation bases, `WorldBounds`, crosshair positions |
| **Fractional** | 0–1 per axis | Internal to the sampler, between the inverse affine and voxel indices |
| **RAS voxel** | continuous index | Sampler output; what `getVoxel` consumes after rounding |
| **View plane (mm)** | millimetres | `projectToViewPlane` output: a prescription expressed in one viewport's own basis |
| **Viewport pixels** | pixels | `ProjectionResult`; what renderers draw with |
| **Patient anatomical** | — | Never separately modelled; see below |

## The one space that matters

Everything shared — planning, sampling, positions — lives in a single world
space, named `"niivue-ortho-mm"` on `VolumeGeometry`. Its contract, stated on the
type itself:

> RAS-ordered and axis-aligned, but obliquity has been removed from it, so it is
> deliberately not labelled RAS. The rotation that separates it from true scanner
> coordinates is reported in `obliquity` rather than discarded.

That wording is precise and worth preserving. The space is **RAS-ordered**: +x
runs toward the patient's right, +y anterior, +z superior, in that order and with
those signs. It is **not** true scanner RAS, because the acquisition tilt has been
removed. The difference is measured, not ignored, and it is bounded — see the
gates below.

Because the space is RAS-ordered, a direction expressed in it *can* be read
anatomically. That is what `imaging/domain/anatomical-direction.ts` does. Because
it is not exactly RAS, the divergence must stay small enough for that reading to
hold, which is what the obliquity gate guarantees.

## Forward path: world millimetres to an intensity

```
Prescription (world mm)
  │  prescriptionToResliceRequest — a pure restatement, no coordinate work
  ▼
ObliqueSliceRequest (centre, read/phase/normal, FOV, offset)
  │  resliceVolume walks the output grid: centre + u·read + v·phase + offset·normal
  ▼
world mm per output pixel
  │  sampler.worldToVoxel(x, y, z, out)   ← inverse frac2mmOrtho, then frac·dims − 0.5
  ▼
continuous RAS voxel
  │  nearest or trilinear interpolation over getVoxel
  ▼
intensity  →  toGrayscale(window)  →  ObliquePreviewImage  →  canvas
```

Two details in `worldToVoxel` are load-bearing:

- **`frac · dims − 0.5`** converts a fractional coordinate to a *continuous*
  voxel index. The half-voxel shift places integer indices at voxel centres. Drop
  it and every image shifts by half a voxel.
- **The signature takes an `out` parameter** and returns a boolean rather than
  allocating a vector. It runs once per output pixel — hundreds of thousands of
  times per slice — so allocation here shows up directly in frame time.

`getVoxel` returns the sampler's own scalar verbatim. Niivue's `getValue` already
owns axis permutation and `scl_slope`/`scl_inter` rescaling, so the adapter must
not apply either a second time.

## Projection path: world millimetres to viewport pixels

A separate, independent path — it never touches the sampler.

```
Prescription + view plane
  │  projectToViewPlane (planning): express the prescription in the view's mm basis
  ▼
PrescriptionPlanarProjection (centre, outline, half-axes, normal step, alignment)
  │  createFittedCamera: fit planning bounds to the viewport
  ▼
projectPrescription (imaging): to pixels
  ▼
ProjectionResult { mode, outline, sliceOutlines[], normalStepPx, isVisible }
  │
  ├─► prescription overlay (editable FOV, slab lines, handles)
  └─► reference line: sliceOutlines[selectedIndex]
```

Orthographic projection is affine, so a rectangular slice group becomes a
parallelogram in any other plane. `ProjectedQuad` therefore stores **four
corners** rather than a width, height and angle — a rotated rectangle seen from
another plane cannot be described by those three numbers.

`sliceOutlines` holds one quad per slice, in the same order as `sliceOffsetsMm`.
The selected-slice reference line is simply `sliceOutlines[selectedIndex]`: no
second projection, no new geometry. Drawing and hit-testing share one
`ProjectionResult`, so the interactive regions are the painted ones by
construction.

## Safety gates

The world space is only trustworthy for a source volume that is already close to
axis-aligned. `createNiivueVolumeSampler` refuses anything else, before
constructing a sampler:

| Gate | Limit | Measures |
| --- | --- | --- |
| `MAX_SUPPORTED_SOURCE_OBLIQUITY_DEG` | 1.0° | Acquisition tilt: how far the voxel axes deviate from the world axes |
| `MAX_SUPPORTED_SOURCE_SHEAR_DEG` | 0.1° | Rhomboidal (non-orthogonal) voxel geometry |

They are gated **independently and named separately** because they are different
pathologies: a tilted-but-cubic grid and a plumb-but-sheared grid fail for
unrelated reasons, and a change to one threshold must not move the other.

`ORTHOGONAL_TOLERANCE_DEG` (1°, in `projection-model.ts`) is a third, unrelated
constant — it classifies a *prescription plane* against a *viewport* for
descriptive purposes. Its value coincides with the obliquity gate; the two must
never share a symbol.

A refused volume produces a placeholder message, never pixels. Showing
approximately-correct anatomy is worse than showing none.

## Deliberately unused

`matRAS` and `mm2vox` — Niivue's true-RAS affine and its inverse — are **not**
used anywhere in the application. The pipeline works in the ortho frame
throughout. This is intentional: mixing the two frames in one pipeline is the
classic way to introduce an invisible rotation. The only place `matRAS` appears
is inside Niivue itself, upstream of `frac2mmOrtho`.

## Rules for changing this area

1. A value's space must be evident from its type or its name. `VolumePosition`
   means world millimetres; a bare `{x, y, z}` in a renderer means pixels.
2. Never convert between spaces outside the module that owns the conversion.
   There is exactly one world-to-voxel implementation and exactly one
   world-to-pixel implementation.
3. Never widen a gate to make a dataset load. The gate is the reason the
   remaining coordinate assumptions are sound.
4. If you add a space, add it to the table above and say what is trustworthy in
   it.
