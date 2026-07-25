# Slice orientation, offsets, and anatomical direction

Recorded 2026-07-25 (Phase 11B). Classification rules are described in
[README.md](README.md).

## Why this file exists

The stack preview labels the selected slice with a signed millimetre offset and
the anatomical axes a positive offset advances along. Both statements are claims
about the patient, so the reasoning behind them is written down rather than
inferred from the code later.

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

## Where this is implemented

- `src/features/imaging/domain/anatomical-direction.ts` — the pure mapping from a
  world direction to ordered anatomical letters. No React, no Niivue, no
  planning imports.
- `src/features/imaging/reslice/runtime/use-oblique-stack.ts` — reads the
  prescription normal once per descriptor and publishes the direction.
- `src/features/imaging/components/ObliqueStackViewport.tsx` — presentation only:
  formatting and the spelled-out title.

## Unresolved

- Whether a three-letter code (`S-R-P`) is the clearest presentation for steeply
  oblique prescriptions, or whether clinical "oblique axial" style naming would
  teach better. Deferred: the code is correct and complete, the nomenclature
  question is cosmetic.
- Whether the residual ≤1° source obliquity should ever be surfaced to the
  learner. Currently it is gated and silent.
