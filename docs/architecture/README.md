# Architecture

How the MRI Planning Trainer is put together, and why it is put together that
way. The root [README](../../README.md) describes what the application does;
these documents describe its internal structure and the constraints that keep it
coherent.

## Documents

| Document | Read it for |
| --- | --- |
| [layers-and-boundaries.md](layers-and-boundaries.md) | The two rules the whole codebase obeys, and how they are machine-enforced |
| [coordinate-spaces.md](coordinate-spaces.md) | Every coordinate space a value passes through, and what is trustworthy in each |
| [planning-model.md](planning-model.md) | The prescription: orientation, slice geometry, session state |
| [imaging-pipeline.md](imaging-pipeline.md) | Engines, capability surfacing, reslicing, the preview runtime, painting |
| [composition-and-runtime.md](composition-and-runtime.md) | Where state lives, how configuration enters, error containment |
| [testing-and-validation.md](testing-and-validation.md) | The test taxonomy and the validation gates a change must clear |
| [decisions.md](decisions.md) | Why the significant choices were made, and what would justify revisiting them |

Claims about MRI and coordinate conventions are recorded separately, with
sources, in [docs/mri-sources](../mri-sources/README.md). Architecture documents
describe structure; that ledger holds the domain facts the structure relies on.

## Shape of the system

A feature-based modular monolith. 135 production modules, no backend, no server
state. Five feature domains, three of them pure data-and-rules with no rendering
concerns at all.

> Counts in these documents are a **repository snapshot at commit `8a86653`**.
> They are accurate as recorded and will drift as the codebase changes; treat
> them as a sense of scale, not as a live figure.

```
                        Index.tsx  (composition root)
        resolves engine kind + planning mode once, owns session state
                                  │
   ┌───────────────┬──────────────┼───────────────┬────────────────┐
   ▼               ▼              ▼               ▼                ▼
ProtocolSidebar  ClinicalCase  MedicalViewport  ObliqueStack   ParametersPanel
                  Panel        (x3: sag/cor/ax)  Viewport
                                  │                 │
                                  ▼                 ▼
                        ┌──────────────────────────────────┐
                        │        features/imaging          │
                        │  adapters → capability → reslice │
                        │  projection → overlays → paint   │
                        └──────────────────────────────────┘
                                  ▲
                     consumes, never mutates
                                  │
                        ┌──────────────────────────────────┐
                        │       features/planning          │
                        │  prescription · orientation ·    │
                        │  slice geometry · session        │
                        └──────────────────────────────────┘
                                  │
                                  ▼
                        features/guidance · protocols · training-cases
```

## Domains

| Domain | Owns | Depends on |
| --- | --- | --- |
| `features/planning` | The prescription model, orientation math, slice geometry, planning session | `imaging/domain` only — the shared value-type kernel |
| `features/imaging` | Turning geometry into pixels: engines, samplers, reslicing, projection, overlays, preview runtime | Planning, for pure types |
| `features/guidance` | Coverage analysis and prescription feedback | Planning |
| `features/protocols` | Protocol catalogue and presets | Nothing |
| `features/training-cases` | Clinical cases that frame a planning task | Nothing |

`features/imaging/domain` is a **shared value-type kernel**, not a rendering
layer: `VolumePosition`, `WorldBounds`, `AnatomicalPlane` and friends are used by
both domains. Planning depends on that kernel and on nothing else in imaging.
The precise rule, and what it forbids, is in
[layers-and-boundaries.md](layers-and-boundaries.md).

`features/imaging` is the only domain with a subfolder structure, because it is
the only one that spans pure mathematics and browser rendering. Its layering is
described in [imaging-pipeline.md](imaging-pipeline.md).

## Reading order

If you are new to the codebase, read [layers-and-boundaries.md](layers-and-boundaries.md)
first — it explains the single distinction that makes the rest predictable — then
[coordinate-spaces.md](coordinate-spaces.md), which is where the genuine
difficulty of this domain lives.
