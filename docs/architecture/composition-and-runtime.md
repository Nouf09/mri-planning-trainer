# Composition and runtime

Where state lives, how configuration enters, and how failure is contained.

## The composition root

`src/pages/Index.tsx` is the single composition root. It resolves runtime
configuration **once**, owns the session state, and passes already-resolved values
downward as explicit props.

```
Index.tsx
  ├── engineKind    = resolveImagingEngineKind()          ← reads the URL, once
  ├── planningMode  = resolveEffectivePlanningMode(...)    ← reads the URL, once
  ├── planningBounds = resolvePlanningBounds(engineKind, volumeGeometry, …)
  ├── session/params/planning  ← usePlanningSession
  ├── volumePosition           ← useVolumePosition
  ├── imagingCapabilities      ← set by the axial MedicalViewport only
  └── previewState/selectSlice  ← useObliqueStack
        │
        ├─► MedicalViewport ×3   engineKind, planningMode, session, bounds,
        │                        highlightedSliceIndex, callbacks
        ├─► ObliqueStackViewport  previewState, onSelectSlice
        └─► ParametersPanel       params, planningMode, callbacks
```

This was not always true. Configuration used to be resolved in four places — the
root plus each of three viewports — each independently re-reading the URL. All
four agreed only by coincidence of the current truth table, which is exactly the
kind of latent divergence that surfaces later as two parts of the workspace
disagreeing. Now `MedicalViewport` receives `engineKind` and `planningMode` as
required typed props and contains no resolver call.

Six assertions in `components/planning-mode-composition.test.ts` keep it that way:
`MedicalViewport` neither imports nor calls the resolvers; it declares both values
as typed props; it hands the resolved kind to `useImagingEngine`; `Index` is the
single `resolveEffectivePlanningMode` call site and passes both props down;
`useImagingEngine` requires an injected kind and never reads the URL; and no other
composition-layer file recomputes the effective mode.

`useImagingEngine(kind)` takes a **required** parameter. It previously had a
URL-reading default, which silently rescued a test harness that had forgotten to
pass props — the removal exposed that gap immediately. A hidden fallback is worse
than a compile error.

## Runtime configuration

Two independent, query-gated modes, both resolved only in `imaging-config.ts` —
the only module in the application that reads `window.location`:

| Setting | Default | Opt in | Notes |
| --- | --- | --- | --- |
| Imaging engine | `jpg` | `?engine=niivue` | Falls back to `jpg` without WebGL2 |
| Planning mode | `legacy` | `?planning=world` | Also requires known planning bounds |

`resolveEffectivePlanningMode(requested, engineKind, hasPlanningBounds)` is the
gate that matters: world planning needs an image source whose physical extent is
known. Without bounds the request is refused and the legacy overlay is used,
because drawing a knowingly mis-scaled prescription over real anatomy is worse
than drawing a simpler correct one.

Anything unrecognised resolves to the default, and both resolvers are wrapped in
`try`/`catch` so a hostile or absent `location` cannot break startup.

Note the asymmetry: the oblique stack preview requires **both**
`engineKind === "niivue"` and `planningMode === "world"`. So the preview — and any
anatomical label in it — can only ever appear with a real volume loaded. The JPG
synthetic world never produces one. That gating is load-bearing for the
trustworthiness of those labels; the reasoning is recorded in
[docs/mri-sources/slice-orientation.md](../mri-sources/slice-orientation.md).

## State ownership

| State | Owner | Why there |
| --- | --- | --- |
| Scan params, planning centre, protocol, case | `usePlanningSession` (in `Index`) | Planning-domain state, one owner |
| Crosshair position | `useVolumePosition` (in `Index`) | Shared by three viewports; must be single-valued |
| Volume geometry | `Index`, set by viewports | Feeds `planningBounds`, which gates world mode |
| Imaging capabilities | `Index`, set by the **axial** viewport only | One runtime sampling owner |
| Selected slice index | `useObliqueStack` | Local to the preview; nothing else needs it |
| Engine + overlay instances | `useImagingEngine`, memoised per viewport | Stable identity across renders |
| Rendered slice cache | `useObliqueStack` ref, keyed by descriptor identity | Not render state; must survive re-render without causing one |

**No store and no React context for application state.** The application shell
mounts library providers only. Every value above has exactly one owner and
travels by explicit props — see [decisions.md](decisions.md).

Two of those library providers are worth knowing about. `TooltipProvider` backs
the shadcn tooltip primitives. `QueryClientProvider` is **mounted but unused**:
there is no `useQuery`, `useMutation`, or `queryClient` usage anywhere in the
application. It is retained scaffolding from the project template, not part of
the current application-state architecture — see [decisions.md](decisions.md) §16.

Derived values are **not** stored. The signed anatomical position of the selected
slice, for instance, is computed during render from the two pieces of state the
component already has. Storing it would create a second thing to keep in sync for
no gain.

## Discriminated state, everywhere

Every asynchronous or fallible thing is a status union, never a `loading: boolean`
plus an optional `error`:

```ts
type ObliqueStackState =
  | { status: "hidden" }
  | { status: "waiting-for-volume" }
  | { status: "unsupported"; message: string }
  | { status: "invalid";     message: string }
  | { status: "error";       message: string }
  | { status: "ready"; sliceCount; selectedIndex; offsetMm; offsetDirection; image; fromCache };
```

The payoff is that impossible combinations cannot be represented, and the
compiler enumerates the cases a renderer must handle. `hidden` and
`waiting-for-volume` are distinct states, not both "not ready", because they mean
different things to the user.

## Error containment

Three independent layers, each for a different class of failure. They do not
overlap, and that separation is deliberate.

**Expected imaging states — modelled as data.** A volume that is loading,
unsupported, sheared, or absent produces a status value and a placeholder message
in the affected viewport. Nothing throws, and the rest of the workspace keeps
working.

**Environment capability — resolved before use.** `hasWebGL2()` decides engine
selection up front, so a missing WebGL context is a configuration outcome rather
than a runtime error.

**Unexpected render errors — `WorkspaceErrorBoundary`.** A class boundary in
`App.tsx`, wrapping the router *inside* the providers so the fallback still has
tooltip and toast context. It catches what would otherwise unmount the whole tree
and leave a blank page, logs the error and component stack to `console.error` for
developers, and shows a calm recovery panel with a reload action. No stack traces
appear in the UI.

The boundary is a net for defects, **not** a replacement for the first two layers.
It must never become the mechanism by which normal imaging states are handled — a
caught exception loses the specific, actionable message that a status union
carries.

## Routing

Two routes: `/` renders the workspace, `*` renders `NotFound`. The router exists
for the 404 path and for future expansion; the trainer is effectively a
single-page workspace, which is why no route-level code splitting or data loading
exists.
