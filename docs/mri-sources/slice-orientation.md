# Slice orientation, offsets, and anatomical direction

Recorded 2026-07-25 (Phases 11B and 11C). Classification rules are described in
[README.md](README.md).

## Why this file exists

The stack preview labels the selected slice with a signed millimetre offset and
an anatomical reading of where that slice sits. Both statements are claims about
the patient, so the reasoning behind them is written down rather than inferred
from the code later.

## Two different statements, deliberately kept apart

These were conflated in the first version of the header, which read a negative
offset as though it were positive. They are now separate:

**A. Direction of increasing offset — a property of the prescription.**
`directionFromNormal(normal)` names the axes the normal points along. It is the
same for every slice in a stack, and it is what the stack runtime publishes as
`offsetDirection`. Phase 11B defined it and Phase 11C left it untouched.

**B. Signed anatomical position — a property of the selected slice.**
`positionForOffset(direction, offsetMm)` names where one slice sits relative to
the prescription centre. A positive offset reads as A; a negative offset reads as
A's per-axis opposite, in the same component order; a zero offset is the centre
itself. This is what the header shows, derived during render — no runtime state,
cache, or descriptor carries it.

## Claims

| # | Claim | Type | Source | How verified |
| --- | --- | --- | --- | --- |
| 1 | NIfTI-1 `sform`/`qform` map voxel indices into a space where +x is Right, +y Anterior, +z Superior (RAS+) | Authoritative fact | [NIfTI-1 FAQ](https://nifti.nimh.nih.gov/nifti-1/documentation/faq/), [nibabel: Working with NIfTI images](https://nipy.org/nibabel/nifti_images.html) | Quoted the specification |
| 2 | `sform_code` / `qform_code` record what the coordinates mean; `unknown` means orientation is not meaningfully defined, and sform is preferred over qform when both are set | Authoritative fact | [Recommended usage of qform and sform](https://nifti.nimh.nih.gov/nifti-1/documentation/nifti1fields/nifti1fields_pages/qsform_brief_usage) | Quoted the specification |
| 3 | DICOM's patient coordinate system is LPS: +x to the patient's left, +y posterior, +z toward the head | Authoritative fact | [DICOM PS3.3 C.7.6.2 Image Plane Module](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.6.2.html) | Quoted the standard |
| 4 | Anatomical axes are labelled by the opposed pairs L/R, P/A, I/S | Authoritative fact | [nibabel `orientations.py`](https://github.com/nipy/nibabel/blob/master/nibabel/orientations.py) — default label pairs | Read the source |
| 5 | A direction is reduced to letters by taking each component's dominant axis, with the sign choosing the letter, and ties resolved by a stable ordering | Implementation convention | [nibabel `io_orientation` / `aff2axcodes`](https://github.com/nipy/nibabel/blob/master/nibabel/orientations.py) | Read the source |
| 6 | Oblique directions are conventionally written as ordered multi-letter codes, letters appended by decreasing magnitude above a small epsilon | Implementation convention | [Cornerstone3D `getOrientationStringLPS.ts`](https://github.com/cornerstonejs/cornerstone3D/blob/main/packages/tools/src/utilities/orientation/getOrientationStringLPS.ts) (`MIN = 0.0001`) | Read the source |
| 7 | Cornerstone3D's letters are **LPS**, so the sign of every axis is opposite to ours; its mapping must not be transcribed into this RAS-ordered codebase | Implementation convention | same as 6 | Compared against claim 3 |
| 8 | Niivue's `frac2mmOrtho` is built by replacing the rotation of the RAS-permuted affine with a positive diagonal, anchored to the RAS origin — so it is axis-aligned, RAS-ordered, never axis-flipped | Implementation convention | `@niivue/niivue@0.69.0`, `dist/index.js` (`oform` construction) | Read the pinned dependency source |
| 9 | Niivue's `oblique_angle` is the worst-case deviation of the affine columns from the world axes ("degrees from plumb"), snapped to 0 below 0.01° | Implementation convention | same as 8 | Read the pinned dependency source |
| 10 | This project's world space diverges from true scanner RAS by at most 1°, because the sampler refuses larger source obliquity (and 0.1° shear) | Implementation convention | `niivue-volume-sampler.ts` (`MAX_SUPPORTED_SOURCE_OBLIQUITY_DEG`, `MAX_SUPPORTED_SOURCE_SHEAR_DEG`), `volume-geometry.ts` | Read the code; consistent with 8 and 9 |
| 11 | The bundled MNI152 volume is exactly RAS+: a diagonal, positive affine with `sform_code = 2` (ALIGNED_ANAT), zero obliquity and zero shear | Authoritative fact about our asset | `public/volumes/mni152.nii.gz` | Decompressed and parsed the NIfTI-1 header: `srow_x = (0.737, 0, 0, −75.763)`, `srow_y = (0, 0.737, 0, −110.763)`, `srow_z = (0, 0, 0.737, −71.763)` |
| 12 | In world planning mode the prescription normal is `(sin b, −sin a·cos b, cos a·cos b)` for tiltRead `a` and tiltPhase `b`, both clamped to ±45°, because every basis derives from `AXIAL` | Authoritative fact about our code | `prescription-orientation.ts`, `orientation.ts` | Derived, then confirmed numerically against `rotateAroundAxis` |
| 13 | A positive slice offset therefore always advances superior-ward: the normal's superior component is never below 0.5 | Authoritative fact about our code | claim 12 | Swept 32,761 samples across the full ±45°×±45° domain; minimum z = 0.5000, zero samples with z ≤ 0 |
| 14 | The normal is nonetheless dominated by Right/Left in about 7.6% of that domain (up to 60° off superior at ±45°/±45°), and Anterior/Posterior never dominates | Authoritative fact about our code | same sweep | 2,492 of 32,761 samples; 284 exact ties on the ±45° boundaries |
| 15 | Because of 14, a bare "Superior" label would be imprecise and "Mostly superior" would be false in that region; the label is therefore derived per prescription and lists every axis it travels along | Product decision | Phase 11B | Decided with the sweep in hand |
| 16 | Label format: `Slice N / M · ±X.X mm · S-R`, letters strongest first, with the words in the element's title | Product decision | Phase 11B | Approved before implementation |
| 17 | Equal components keep a stable x, y, z order rather than an arbitrary one | Product decision | Phase 11B, following claim 5 | Covered by a test |
| 18 | Sagittal and coronal *prescriptions* do not exist; `CORONAL` and `SAGITTAL` are viewport cameras only | Authoritative fact about our code | `orientation.ts`, `MedicalViewport.tsx` | Searched every usage |
| 19 | A slice centre is `prescriptionCentre + normal · offsetMm`, so a negative offset is a displacement along `−normal`: the same axes read the other way, with magnitudes and therefore component order unchanged | Authoritative fact about our code | `selected-slice-position.ts`, `prescription-to-reslice-request.ts` | Asserted as a property test: `directionFromNormal(−n)` equals `oppositeDirection(directionFromNormal(n))` for cardinal, two-axis and three-axis normals |
| 20 | Opposed anatomical directions are inverted per letter, preserving letter order: `R-S-P` becomes `L-I-A`, never `A-I-L` | Implementation convention | [Cornerstone3D `invertOrientationStringLPS.ts`](https://github.com/cornerstonejs/cornerstone3D/blob/main/packages/tools/src/utilities/orientation/invertOrientationStringLPS.ts) (MIT) | Read the source as a reference only; see the adaptation note below |
| 21 | A zero offset is the prescription centre, and negative zero resolves there with no special case, since `-0 === 0` and `-0 > 0` is false | Authoritative fact (language semantics) | ECMAScript equality and relational comparison | Asserted directly in tests |
| 22 | Centre is detected as exactly zero, with no tolerance | Product decision | Phase 11C | Justified by claim 23 |
| 23 | An odd-count stack produces an exactly zero centre offset in floating point, and the smallest reachable non-zero offset is 0.25 mm, which never displays as `0.0 mm` | Authoritative fact about our code | `prescription-math.ts`; `ParametersPanel.tsx` ranges (`sliceThickness` min 0.5, `sliceGap` min 0) | Swept odd counts across thickness/gap combinations: every centre offset was exactly 0; minimum even-count offset was 0.25 mm |
| 24 | Wording: the centre reads `Centre`; elsewhere the header shows axis letters, with the words in the element's title as "Selected slice is … of the prescription centre" | Product decision | Phase 11C | Approved before implementation; British spelling matches `centreSliceIndex` and "Planned centre slice" already in the codebase |

## Reference reading, and what was not copied

Cornerstone3D's `invertOrientationStringLPS` (MIT, confirmed via the GitHub API)
was read as a reference for claim 20. Its code was **not** adapted. It works in
LPS with `H`/`F` for head and foot, where this codebase is RAS with `S`/`I`; it
chains `String.replace` calls through a lowercase intermediate; and it passes
unmapped characters through unchanged. `oppositeDirection` is independently
written: it derives the opposed pairs from the axis data already used to name a
direction, so the pairs are stated once, and it returns null for any letter this
module did not produce rather than treating it as anatomical.

## Standing assumptions and their expiry conditions

These hold today. Each names what would break it.

**A. One fixed volume, verified RAS+.** `DEFAULT_VOLUME_SOURCE` is the only image
a volume engine ever loads, and there is no file picker or upload path in the
application. Claim 11 therefore covers every reachable state, which is why the
anatomical labels can be trusted.

> **Expires if** the trainer gains volume loading, a second bundled volume, or
> any user-supplied image. At that point claims 11 and 13 no longer cover every
> state and this file must be revisited before the labels are shown for it.

**B. `sform_code` and `qform_code` are not read.** The pipeline reads
`dimsRAS`, `pixDimsRAS`, `extentsMinOrtho`/`extentsMaxOrtho`, `oblique_angle`
and `maxShearDeg`, and nothing else. So the application **cannot currently
detect a volume whose orientation is undefined** (claim 2). That is harmless
while assumption A holds, because the one volume has a defined code.

> **Required before arbitrary volumes are loaded:** read the form code and
> suppress the anatomical direction label when it is `unknown`, rather than
> naming an axis that the file never established. The millimetre offset stays
> valid in that case — it is a distance along the prescription normal and makes
> no anatomical claim.

**C. The base plane is axial, tilts are clamped to ±45°.** Claim 13 depends on
both. A derived label survives a change here; a hard-coded one would not, which
is the main reason the direction is computed from the normal at runtime.

> **Expires if** `orientationFromAngles` gains another base plane or
> `MAX_ORIENTATION_ANGLE_DEG` grows beyond 90°, at which point a positive offset
> could point inferior and claim 13 must be re-derived.

**D. Centre means exactly zero.** `positionForOffset` compares `offsetMm === 0`
with no tolerance, which is safe because of claim 23: an odd stack's centre
offset cancels to exact zero, and the smallest non-zero offset any reachable
parameter combination can produce is 0.25 mm. So the word `Centre` and the
number `0.0 mm` can never contradict each other.

> **Expires if** `sliceThickness`'s minimum drops below 0.1 mm, or slice offsets
> stop being derived by exact arithmetic about the centre. Either would let a
> non-zero offset display as `0.0 mm`, at which point centre detection must move
> to the same rounding the readout uses rather than gaining a hidden epsilon.

## Where this is implemented

- `src/features/imaging/domain/anatomical-direction.ts` — the pure mapping from a
  world direction to ordered anatomical letters (`directionFromNormal`, statement
  A), plus the opposed reading and the signed position for one slice
  (`oppositeDirection`, `positionForOffset`, statement B). No React, no Niivue,
  no planning imports, and no imports at all.
- `src/features/imaging/reslice/runtime/use-oblique-stack.ts` — reads the
  prescription normal once per descriptor and publishes the direction.
- `src/features/imaging/components/ObliqueStackViewport.tsx` — presentation only:
  it derives the signed position during render, formats the millimetres, and
  spells the position out in the title.

## Unresolved

- Whether a three-letter code (`S-R-P`) is the clearest presentation for steeply
  oblique prescriptions, or whether clinical "oblique axial" style naming would
  teach better. Deferred: the code is correct and complete, the nomenclature
  question is cosmetic.
- Whether the residual ≤1° source obliquity should ever be surfaced to the
  learner. Currently it is gated and silent.
