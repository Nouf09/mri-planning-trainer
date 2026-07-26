# Planning model

`features/planning` is the sole origin of every world coordinate.

The **domain layer is framework-free**: no React, no canvas, no DOM. React
appears only in `hooks/use-planning-session.ts`, which adapts the domain to
component state.

Its only dependency outside itself is `features/imaging/domain`, the shared
value-type kernel — `VolumePosition`, `WorldBounds`, `AnatomicalPlane`, and the
`boundsSize` helper. It depends on no other part of imaging: not `reslice/`, not
`projection/`, not `overlays/`, not `adapters/`, not `components/`. See
[layers-and-boundaries.md](layers-and-boundaries.md) for the full invariant.

## The prescription

```ts
interface Prescription {
  center: VolumePosition;        // world millimetres
  orientation: PlaneOrientation; // read / phase / normal basis
  fovRead: number;
  fovPhase: number;
  sliceThickness: number;
  sliceGap: number;
  sliceCount: number;
}
```

Everything is in physical millimetres. There are no pixel offsets and no
screen-space values, which is what lets the same object drive editing,
projection, and reslicing without conversion at the boundaries.

## Orientation is a complete basis

```ts
interface PlaneOrientation {
  normal: Vec3;
  readDirection: Vec3;   // in-plane horizontal (view u)
  phaseDirection: Vec3;  // in-plane vertical  (view v)
}
```

A normal alone cannot say which way is horizontal within the plane, so read and
phase directions are carried explicitly. The invariant is
`normal = readDirection × phaseDirection`, checked by `isOrthonormalOrientation`,
which also rejects a left-handed frame rather than silently accepting a mirrored
basis.

In-plane rotation is **baked into the basis** by `withInPlaneRotation` rather
than stored alongside it, so the angle never exists in two places.

### Angles in, basis out

`orientationFromAngles` is the only way a world-mode prescription basis is built:

```
AXIAL  ──tiltReadDeg about read──►  ──tiltPhaseDeg about new phase──►
       ──inPlaneDeg about new normal──►  orthonormalize  ──►  PlaneOrientation | null
```

Three properties of this design matter:

- **Scalars are stored, not a matrix.** Angles are serializable, resettable, and
  cannot accumulate drift the way a repeatedly-mutated matrix would.
- **The order is fixed** and documented, because rotation composition is not
  commutative.
- **Every angle is clamped to ±45°** (`MAX_ORIENTATION_ANGLE_DEG`), keeping the
  composition well-conditioned.

Two consequences are load-bearing elsewhere. First, the base plane is always
`AXIAL`: `CORONAL` and `SAGITTAL` exist only as *viewport* cameras
(`VIEW_ORIENTATION_BY_PLANE`) and are never prescription orientations. Second,
with both tilts clamped to ±45°, the normal's superior component never drops
below 0.5, so a positive slice offset always advances superior-ward — a fact the
header labels rely on, recorded with its derivation in the
[source ledger](../mri-sources/slice-orientation.md).

The function returns `null` for a degenerate or non-right-handed result rather
than repairing it. Callers keep the previous valid orientation.

## Slice geometry

Four small functions in `prescription-math.ts`, and they are the only place slice
positions are computed:

| Function | Meaning |
| --- | --- |
| `sliceSpacingMm` | `thickness + gap` — centre-to-centre distance |
| `sliceOffsetsMm` | Signed offsets of every slice centre from the prescription centre, along the normal |
| `coverageMm` | Total slab extent: `count·thickness + (count−1)·gap` |
| `projectToViewPlane` | The prescription expressed in a view plane's millimetre basis |

`sliceOffsetsMm` is symmetric about the centre: `first = −((count−1)/2)·spacing`.
For an odd count the middle slice lands on **exactly** 0.0 in floating point,
because `−a + a` cancels exactly — which is why centre detection needs no epsilon
anywhere in the stack. For an even count there is no zero offset.

`selectedSliceCenter(prescription, index)` composes the two: the world position of
one slice is `center + normal · sliceOffsetsMm[index]`. It returns `null` for an
index that names no slice rather than extrapolating.

**This is the single source of truth for slice positions.** The imaging domain
reads these values; it never recomputes them. An architecture test asserts that
the stack builder contains no `sliceThickness`/`sliceGap`/`sliceCount` arithmetic
of its own.

## Session state

`planning-session.ts` assembles a `PlanningSession` — patient, study, and the
active sequence with its prescription. `activeSequence(session)` is the accessor
the composition root uses.

`use-planning-session.ts` is the only React-aware module in the feature and the
only stateful part. It holds the scan parameters, the planning centre, the selected protocol
and case, and the auto-adjust-slice-count behaviour, exposing narrow updaters
(`updateParam`, `updateOrientation`, `updatePlanning`, `selectProtocol`,
`selectCase`, `toggleAutoAdjustSliceCount`) rather than a setter for the whole
object. State is plain React state owned by `Index.tsx` — see
[decisions.md](decisions.md) for why there is no store.

## Guidance

`features/guidance` reads a prescription and reports on it: `coverage.ts` measures
slab extent against a target, `planning-guidance.ts` and `planning-feedback.ts`
turn that into labelled `good`/`warn` items. It is pure, it depends on planning,
and nothing depends on it except the panels that display its output. It never
modifies a prescription — feedback is advice, not correction.
