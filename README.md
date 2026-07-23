# MRI Planning Trainer

An interactive, browser-based training simulator for **MRI slice planning**. It reproduces the core interaction of a clinical planning workstation — laying out a slice prescription over orthogonal anatomical views — and adds a live, geometrically faithful preview of the planned acquisition, so students can build intuition for how a prescription maps onto the volume it will scan.

> ⚠️ **Educational use only.** This application is a teaching tool. It does not process real patient studies, produces no diagnostic output, and must **never** be used for clinical decision-making. All imagery is synthetic or reference data.

---

## Overview

Planning an MRI acquisition means positioning a stack of slices — its field of view, thickness, spacing, count, and angulation — over the patient's anatomy in three orthogonal planes. This project lets a learner do exactly that against sagittal, coronal, and axial views, and then see:

- **where the prescribed slices actually fall** inside the volume, via a browsable multi-slice preview that reslices arbitrary oblique planes, and
- **how the selected slice cross-references** back onto the three source views through reference lines.

Alongside the geometry, the trainer surfaces clinical framing: a catalog of scan protocols, a set of clinical training cases, and real-time planning guidance that flags coverage and prescription problems as the layout changes.

The application runs entirely in the browser with no backend.

---

## Features

- **Three-plane planning workspace** — sagittal, coronal, and axial viewports with an interactive prescription overlay. The slice group can be moved, resized, and rotated directly on the canvas, with crosshair and scroll-wheel navigation through the volume.
- **World-space prescription model** — the prescription is described in physical millimetres with a full orientation basis (read / phase / normal directions), rather than as pixel offsets, so the same geometry drives editing, projection, and reslicing.
- **Multi-slice oblique stack preview** — a dedicated read-only viewport renders the planned acquisition as a browsable stack. Each slice is the oblique plane at its own centre offset, sampled on demand and cached, navigable by slider, mouse wheel, and keyboard.
- **Cross-referenced slice indicator** — the currently selected preview slice is drawn as a reference line back into the three source views, showing where it intersects the volume.
- **Pure oblique reslicing engine** — a framework-agnostic core samples an arbitrary plane from a volume through a small `VolumeSampler` contract, with both nearest-neighbour and trilinear interpolation and out-of-bounds handling.
- **Real-time planning guidance** — coverage and prescription checks evaluate the current layout (optionally against a selected clinical case) and report actionable feedback.
- **Protocols & clinical cases** — a protocol sidebar and a clinical case panel provide realistic context (symptoms, clinical question, suggested sequences) for planning practice.
- **Scan parameter controls** — field of view, slice thickness, gap and count, angulation, and sequence parameters (TR / TE / flip angle).
- **Optional volume-rendering engine** — an opt-in [Niivue](https://github.com/niivue/niivue) engine can load a reference volume and expose it to the reslicing pipeline, with safety gates that refuse source volumes too oblique or sheared to sample faithfully.

---

## Architecture

The codebase is a **feature-based modular monolith** with strict, one-directional layer boundaries. Two principles are enforced throughout (and asserted by dedicated architecture tests):

- **Planning owns geometry.** All world coordinates — slice positions, orientation, field of view — originate in the planning domain and are never re-derived elsewhere.
- **Imaging owns rendering.** Sampling, projection, and canvas drawing live in the imaging domain and consume planning geometry without duplicating it.

### Architecture Overview

The prescription is authored in the source viewports and flows outward as world-space geometry. Planning feeds two independent imaging paths in parallel: projection (which draws the editable overlay and the cross-reference lines) and the reslice runtime (which samples the planned planes for the previews).

```
                Medical Viewports
             (Sagittal · Coronal · Axial)
                       │
                       ▼
              Planning (World Space)
             prescription geometry, in mm
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
   Projection Engine           Reslice Runtime
   world → view plane          descriptor + sampling
          │                         │
          ▼               ┌─────────┴─────────┐
   Overlay Rendering      ▼                   ▼
   (prescription +   Oblique Preview     Oblique Stack
    reference lines)  (single slice)     (multi-slice)
```

### Domains

| Domain | Responsibility |
| --- | --- |
| `features/planning` | The prescription model, orientation math, slice geometry, and planning session state. Pure, framework-free domain logic. |
| `features/imaging` | Everything that turns geometry into pixels: the reslicing engine, volume samplers, projection/overlay renderers, imaging engines, and the preview runtime. |
| `features/guidance` | Coverage analysis and planning feedback that grades a prescription. |
| `features/protocols` | The protocol catalog and presets. |
| `features/training-cases` | Clinical training cases used to frame planning tasks. |

### Imaging pipeline

The imaging domain is layered so that a pure core can be tested in isolation and reused across engines:

- **`reslice/`** — the interpolation-level engine: request modelling, nearest/trilinear sampling, intensity windowing, and the `VolumeSampler` abstraction. No React, no canvas.
- **`reslice/runtime/`** — the preview orchestration: building slice/stack descriptors, a generation-guarded render scheduler, and the React hooks that drive the live previews.
- **`projection/` & `overlays/`** — projecting the world-space prescription into each view plane and drawing the editable overlay and reference lines.
- **`adapters/`** — concrete imaging engines. A default **JPG** engine backs the standard workspace; an opt-in **Niivue** engine loads a real volume and surfaces a sampler capability to the reslicing pipeline.

### Runtime configuration

Two independent, query-parameter-gated modes let the newer capabilities be exercised without changing the default experience:

- **Imaging engine** — defaults to the JPG engine; `?engine=niivue` opts into the volume engine.
- **Planning mode** — defaults to `legacy` planning; `?planning=world` opts into the world-space prescription workflow (which also requires an image source whose physical extent is known).

---

## Technology Stack

- **Language** — TypeScript (strict)
- **UI** — React 18, React Router
- **Build tooling** — Vite 5 (SWC React plugin)
- **Styling** — Tailwind CSS 3, [shadcn/ui](https://ui.shadcn.com) primitives on Radix UI
- **Volume rendering** — [@niivue/niivue](https://github.com/niivue/niivue)
- **State/data** — TanStack Query, React Hook Form, Zod
- **Testing** — Vitest 3, Testing Library, jsdom
- **Linting** — ESLint 9, typescript-eslint

---

## Project Structure

```
src/
├── App.tsx / main.tsx       # App entry: providers + router
├── pages/                   # Route entry points (Index, NotFound)
├── components/              # Composite UI: viewports, panels, sidebar (+ ui/ primitives)
├── features/
│   ├── planning/            # Prescription model, geometry, session state
│   ├── imaging/             # Reslicing, projection, overlays, engines
│   │   ├── reslice/         # Pure oblique reslicing engine (+ runtime/)
│   │   ├── projection/      # World → view-plane projection
│   │   ├── overlays/        # Prescription overlay + reference lines
│   │   └── adapters/        # JPG and Niivue imaging engines
│   ├── guidance/            # Coverage + planning feedback
│   ├── protocols/           # Protocol catalog and presets
│   └── training-cases/      # Clinical training cases
├── services/                # Reserved scaffolding (api/, storage/)
├── shared/ · lib/ · hooks/  # Cross-cutting utilities
└── test/                    # Test setup
public/
└── volumes/                 # Reference volume (MNI152)
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm

### Installation

```sh
git clone https://github.com/Nouf09/mri-planning-trainer.git
cd mri-planning-trainer
npm install
```

### Development

```sh
npm run dev
```

The app is served at **http://localhost:8080**.

To exercise the volume engine and world-space planning, append the query flags:

```
http://localhost:8080/?engine=niivue&planning=world
```

### Build

```sh
npm run build        # production build
npm run build:dev    # development-mode build
npm run preview      # preview the production build locally
```

### Testing & Linting

```sh
npm run test         # run the full test suite once
npm run test:watch   # run tests in watch mode
npm run lint         # lint the codebase
```

The suite covers the pure domain logic, the reslicing engine (including numeric cross-validation against a real headless Niivue volume), and architecture boundary checks that keep the layer contracts honest.

---

## Capabilities & Limitations

**What it does today**

- Interactive three-plane slice planning with a world-space prescription model.
- On-demand oblique reslicing of a volume, with a browsable multi-slice preview and cross-reference lines.
- Live planning guidance, protocol context, and clinical training cases.

**Current limitations**

- **Not diagnostic.** The trainer works with synthetic and reference data and produces no clinical output.
- **World planning requires known physical geometry.** When a source cannot report its own physical extent, the workspace falls back to the legacy overlay rather than draw a mis-scaled prescription.
- **Near-orthogonal source volumes only.** The reslicing engine deliberately refuses volumes beyond a small obliquity/shear tolerance instead of sampling them incorrectly.
- **Opt-in advanced modes.** The Niivue engine and world-space planning are enabled via query flags; the default experience uses the JPG engine and legacy planning.
- **Reslicing is single-threaded** and renders one plane per slice (no slab averaging); the first render of an uncached slice costs one resample, after which it is cached.

---

## Roadmap

Directions under consideration, building on the current foundation:

- Physical-geometry reporting for loaded volumes, so world-space planning works directly on real data.
- Broader tolerance and correction for oblique / sheared source volumes.
- Off-main-thread reslicing to lower first-render latency.
- Richer slice rendering (e.g. slab / projection modes).
- Assessment and scoring of a trainee's prescription against a target.

---

## Disclaimer

This software is provided for **education and training only**. It is **not** a medical device, is **not** cleared or approved by any regulatory authority, and must **not** be used for clinical diagnosis, treatment planning, or any patient-care decision. No warranty is made as to the accuracy or fitness of any output.

---

## Author

Built and maintained by [**Nouf**](https://github.com/Nouf09).

Contributions, issues, and suggestions are welcome via the project's GitHub repository.
