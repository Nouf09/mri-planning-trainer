# Architectural decisions

Why the significant choices were made, and what would justify revisiting them.
Each entry states the decision, the reasoning, and — where it matters — the
expiry condition. Domain claims about MRI and coordinates live in
[docs/mri-sources](../mri-sources/README.md); this file covers engineering.

---

### 1. Feature-based modular monolith, no backend

**Decision.** Organise by domain (`planning`, `imaging`, `guidance`, `protocols`,
`training-cases`) rather than by technical kind, and keep everything in the
browser.

**Why.** The natural seams in this problem are domains, not layers: slice geometry
changes together, rendering changes together. There is no patient data to store
and no computation that needs a server, so a backend would add deployment surface
and privacy obligations for nothing.

---

### 2. World-space (millimetre) prescription model

**Decision.** Describe the prescription in physical millimetres with a full
orientation basis, not as pixel offsets plus an angle.

**Why.** One model then drives editing, projection, and reslicing without
conversion at each boundary, and slice geometry is expressed in the same units
clinicians use. The earlier legacy model — a centre in normalised viewport
coordinates plus a single angulation — cannot represent a doubly-oblique plane at
all.

**Consequence.** Legacy planning still exists as the default and as the fallback
when physical extent is unknown. Two overlay renderers therefore coexist
(`planning-overlay-renderer` and `prescription-overlay-renderer`), which is
accepted duplication in service of never drawing a mis-scaled prescription.

---

### 3. One shared world space, obliquity removed but measured

**Decision.** Plan and sample in Niivue's orthogonal millimetre frame
(`"niivue-ortho-mm"`), not in true scanner RAS. Keep `matRAS`/`mm2vox` unused.

**Why.** Mixing two frames in one pipeline is the classic way to introduce an
invisible rotation. Using one frame everywhere makes the pipeline auditable; the
difference from true RAS is reported in `obliquity` rather than discarded, and
bounded by a gate.

**Expiry.** If support for genuinely oblique acquisitions is added, this decision
must be reopened deliberately — not by widening the gate, but by deciding how the
tilt is represented end to end.

---

### 4. Refuse unsupported source volumes rather than approximate them

**Decision.** Gate source obliquity and voxel shear at fixed thresholds, refuse
anything beyond, and show a placeholder message. The canonical values live in the
gate table in [coordinate-spaces.md](coordinate-spaces.md#safety-gates); they are
deliberately not repeated here.

**Why.** For a training tool, plausible-but-wrong anatomy is the worst outcome: it
teaches confidently incorrect spatial relationships. A refusal is honest and
visible. The two gates are independent and separately named because they are
different pathologies.

---

### 5. The `VolumeSampler` interface as the engine's only contract

**Decision.** The reslice engine consumes a four-member interface, not a volume
type.

**Why.** It keeps the engine pure and testable against synthetic volumes with
analytically known values, and it keeps `NVImage` inside `adapters/`.
`worldToVoxel` takes an `out` parameter and returns a boolean because it runs once
per output pixel; allocating there is measurable.

---

### 6. Explicit props, no store, no context

**Decision.** Pass resolved values down as typed props. No Zustand, no Redux, no
React context for application state.

**Why.** The dependency graph is shallow and the number of shared values is small:
one session, one crosshair, one capability, one selected index. Explicit props
make data flow greppable and let the type system catch a missing value at compile
time — which it did, when a required prop replaced a hidden URL-reading default
and immediately exposed an incomplete test harness. A store would hide exactly
that class of mistake.

**Expiry.** If a genuinely cross-cutting concern appears with many unrelated
consumers, revisit. Prop-drilling depth alone is not sufficient reason.

---

### 7. Resolve runtime configuration once, at the composition root

**Decision.** `Index.tsx` is the only place that resolves engine kind and planning
mode; viewports receive them as required props.

**Why.** They were previously resolved in four places, each independently
re-reading the URL. All four agreed only because the current truth table happens
to map both engine kinds identically — a coincidence, not a guarantee. Six
composition tests now prevent regression.

---

### 8. Discriminated status unions, never `loading` plus optional `error`

**Decision.** Model every fallible or asynchronous thing as a `status` union.

**Why.** Impossible states become unrepresentable and the compiler enumerates the
cases a renderer must handle. It also forces genuinely different situations —
`hidden` versus `waiting-for-volume`, `unsupported` versus `invalid` — to stay
distinct instead of collapsing into one vague "not ready".

---

### 9. Lazy, cached, generation-guarded slice rendering

**Decision.** Render one slice on demand, cache per descriptor identity, coalesce
into one `requestAnimationFrame`, and guard publication with a generation counter.

**Why.** Eagerly rendering a 30-slice stack wastes work the user may never look
at. The identity string makes cache invalidation automatic and total: any
rendering-affecting change produces a new identity and discards the cache
wholesale, so a stale image cannot be served for a changed prescription. The
generation guard prevents a slow render landing after the user has scrolled past
it.

**Accepted cost.** First render of an uncached slice is a synchronous resample on
the main thread — measured at ~24 ms warm at 256² during Phase 10D on a
development machine, and not re-measured since. Treat that as a historical
data point, not a current guaranteed property.

A Worker was considered and deferred. The apparent constraint was that moving
sampling off the main thread would require either duplicating the volume across
the thread boundary or restructuring the `VolumeSampler` contract, which was not
judged worthwhile while the cost stayed under the frame budget. That reasoning is
reconstructed from the code and the phase record rather than quoted from a
written decision at the time.

---

### 10. Slices are planes, not slabs

**Decision.** Each rendered image is the plane at that slice's centre offset.
`sliceThickness` affects spacing only; no integration across the slice profile.

**Why.** Slab averaging is a separate feature with its own correctness questions
(profile shape, weighting). Conflating it with positioning would make both harder
to reason about. The code says so wherever it could be mistaken.

---

### 11. Preserve validated modules as references rather than refactoring them

**Decision.** The single-slice preview modules (`build-oblique-preview.ts`,
`use-oblique-preview.ts`, `ObliquePreviewViewport.tsx`) are kept byte-identical
even though the multi-slice stack superseded them in the live application.

**Why.** They are a numerically validated reference: an integration test asserts
that the stack's centre slice reproduces their output byte-for-byte. That makes
them a regression oracle for the whole reslice path, which is worth more than the
deleted duplication would save. An architecture test asserts they remain present
and that the app routes through the stack.

**Expiry.** Remove them only together with the equivalence test that depends on
them, and only with a replacement oracle.

---

### 12. Anatomical labels derived at runtime, not hard-coded

**Decision.** Derive the anatomical direction from the prescription normal rather
than assuming a fixed label such as "Superior".

**Why.** "Positive offset is superior" is *true* in the current model but only
because the base plane is axial and tilts are clamped to ±45°. It is also
misleading in the ~7.6 % of that space where the normal is dominated by
right/left. A derived label is correct across the whole space and survives a
change to the orientation model that a hard-coded one would silently break.

**Precondition, recorded.** The labels are trustworthy because exactly one fixed,
verified RAS+ volume can load. The pipeline does not read `sform_code`/`qform_code`
and so cannot detect an orientation-undefined volume — which must be addressed
before arbitrary volume loading is added. See the
[source ledger](../mri-sources/slice-orientation.md).

---

### 13. Separate "direction of increasing offset" from "position of this slice"

**Decision.** Two functions with two meanings: `directionFromNormal` describes the
prescription; `positionForOffset` describes one selected slice.

**Why.** Showing the first next to a signed offset read as anatomically backwards
for every negative slice — half of every stack. They are genuinely different
statements about different subjects, so they are different functions, and the
signed one is derived in presentation because no runtime state needs it.

---

### 14. Centre detected as exactly zero, with no epsilon

**Decision.** `offsetMm === 0` means the prescription centre. No tolerance.

**Why.** `sliceOffsetsMm` is symmetric about the centre, so an odd-count stack's
middle offset cancels to exact floating-point zero. The smallest non-zero offset
any reachable parameter combination can produce is 0.25 mm, which never displays
as `0.0 mm` — so the word and the number cannot contradict each other. Negative
zero resolves correctly with no special case, since `-0 === 0` and `-0 > 0` is
false. An epsilon would be an invented threshold hiding a real invariant.

**Expiry.** If the minimum slice thickness drops below 0.1 mm, centre detection
must move to the same rounding the readout uses.

---

### 15. Keep the JPG engine

**Decision.** Retain the legacy JPG engine as the default rather than making the
volume engine mandatory.

**Why.** It is the WebGL2 fallback, the offline-safe default, and the fast path for
tests that need a viewport without a volume. Making Niivue mandatory would couple
the whole workspace to a WebGL context being available.

---

### 16. Retain unused template scaffolding

**Decision.** Leave the 49 generated UI primitives and their dependencies in
place, rather than pruning to the handful actually imported. The same applies to
`QueryClientProvider`: it is mounted in `App.tsx`, but there is **no `useQuery`,
`useMutation`, or `queryClient` usage anywhere in the application**. It is
retained scaffolding, not part of the current application-state architecture.

**Why.** Removal is only safe in file-plus-dependency pairs, it touches the
dependency graph broadly, and it delivers no user-visible or correctness benefit.
It is recorded as known dead weight rather than pretended away — an audit
enumerates it precisely.

Counts are a repository snapshot at commit `8a86653`.

---

### 17. A source ledger for domain claims

**Decision.** Record every MRI and coordinate claim in `docs/mri-sources/`,
classified as authoritative fact, implementation convention, product decision, or
unresolved ambiguity — with how it was verified and what would expire it.

**Why.** In this domain the difference between "the specification says so", "this
library happens to do so", and "we chose this" is the difference between a safe
change and a wrong one, and that difference is invisible in code six months later.
Verification is recorded as an action ("parsed the header", "read the pinned
dependency source"), never as "well known".
