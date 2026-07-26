# Testing and validation

657 tests across 54 files, against 135 production modules — a repository
snapshot at commit `8a86653`. The ratio is deliberate: most of this codebase is
pure functions over geometry, which is the cheapest possible thing to test and
the most expensive thing to get wrong.

## Test taxonomy

| Kind | Count | What it proves | Example |
| --- | --- | --- | --- |
| **Domain unit** | most | A pure function's contract, including its failure values | `prescription-math`, `orientation`, `anatomical-direction` |
| **Numeric** | several | Sampling against analytically known data | `reslice-volume-trilinear`, `synthetic-volume` |
| **Hook** | several | Orchestration: caching, invalidation, cancellation | `use-oblique-stack` |
| **Component** | several | Rendered output and interaction, by accessible role | `ObliqueStackViewport` |
| **Integration** | 3 | The pipeline against a real headless volume | `oblique-stack.integration`, `niivue-volume-sampler.integration` |
| **Boundary enforcement** | 6 files | Import and layering rules types cannot express | see [layers-and-boundaries.md](layers-and-boundaries.md) |

The boundary-enforcement row counts **6** files: **5** named
`*architecture*.test.ts`, plus `components/planning-mode-composition.test.ts`,
which enforces the same kind of rule under a different filename convention. A
`find` for the filename pattern therefore returns 5, not 6.

## Testing philosophy

**Assert the failure value, not just the happy path.** Pure functions here return
`null` rather than throwing or inventing a value — a degenerate orientation, an
out-of-range slice index, a non-finite vector. Those returns are contract, so they
are tested as explicitly as the successes.

**Use real data where correctness is numeric.** `niivue-volume-sampler.integration.test.ts`
constructs an actual NIfTI-1 buffer (`testing/nifti-test-buffer.ts`) and drives a
real headless `NVImage` in jsdom, so the coordinate chain is validated against the
library's own behaviour rather than against a mock that encodes our assumptions.
Mocks cannot catch a misread affine.

**Use synthetic volumes where correctness is analytic.**
`reslice/testing/synthetic-volume.ts` builds gradient and coordinate-encoding
volumes whose exact value at any position is known in closed form, so
interpolation can be checked to floating-point tolerance.

**Prove properties, not just examples.** Where a relationship should hold
universally, assert the relationship. `directionFromNormal(−n)` must equal
`oppositeDirection(directionFromNormal(n))` for every representative normal —
which is what makes letter inversion demonstrably the same operation as
re-deriving from the negated vector, rather than a plausible-looking shortcut.
The anatomical claim being tested is recorded in
[docs/mri-sources/slice-orientation.md](../mri-sources/slice-orientation.md).

**Test seams instead of timers or globals.** The scheduler accepts a `Deferrer`;
the error boundary accepts an `onReload`. Tests inject deterministic
implementations rather than mutating `window.location` or waiting on
`requestAnimationFrame`.

**Query by accessible role.** Component tests use `getByRole`/`getByTitle`, so a
test failing means the accessibility surface changed too.

**Boundary tests read source text.** Rules such as "no Niivue below the
adapter", "within `reslice/runtime/`, React only in the two orchestration hooks",
and "positions come from `sliceOffsetsMm`" —
are not expressible in the type system, so they are asserted as regexes over file
contents. Crude, fast, and they have caught real regressions.

## Validation gates

Every change clears the same four gates, locally and in CI:

```
npm run typecheck    # tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.node.json --noEmit
npm run lint         # eslint .
npm run test         # vitest run
npm run build        # vite build
```

**`typecheck` deliberately names both projects.** The root `tsconfig.json` is a
solution file (`"files": []` plus references), so a bare `tsc --noEmit` at the
root type-checks **zero files** — it does not follow project references. That
invocation was the CI gate for a while and was green by emptiness; the real
checker immediately found a genuine defect the empty one had waved through. If you
touch this script, verify with `--listFilesOnly` that it still checks 200-plus
files.

**Lint has an accepted baseline** of 7 `react-refresh/only-export-components`
warnings in generated shadcn primitives, and **0 errors**. Errors are never
accepted, and `eslint-disable` is not used anywhere in the codebase — a rule that
needs suppressing is a design signal.

**The built CSS is compared, not assumed.** Any change that should not affect
styling is verified by rebuilding and comparing the CSS bundle's size and content
hash, and where bytes legitimately differ, by diffing the sorted rule set. This
has repeatedly caught a specific hazard: Tailwind's content scanner reads
`src/**/*.{ts,tsx}` as text, so a bare utility-shaped word in a **comment or test
string** — `static`, `ordinal`, `invert`, `grayscale`, `!outline` — generates a
spurious CSS rule. The fix is always to reword the comment. Documentation under
`docs/` is not scanned, so it is unaffected.

## CI

`.github/workflows/ci.yml`, on push and pull request to `main`: `ubuntu-latest`,
Node 22, npm cache keyed on the lockfile, then `npm ci` → `typecheck` → `lint` →
`test` → `build` → `npm audit --audit-level=high`.

The audit step is **non-blocking on purpose**. The remaining advisories are
major-version-gated (an eslint-chain cascade that is dev-tooling only, and a
React-Router advisory whose vulnerable code path — RSC server actions — this
client-only application cannot reach). A CI that is red for accepted, documented
debt teaches everyone to ignore red. The step stays so the debt is visible in
every run; it becomes blocking when the advisories can actually be cleared.

## Known flake

The heavy real-`NVImage` integration files are CPU-bound. On a loaded developer
machine, running them in parallel can starve the fast fake-sampler hook tests into
20-second timeouts — always in `use-oblique-stack.test.tsx`, and in different
tests from run to run, which is the signature of contention rather than a defect.
`vitest.config.ts` sets `testTimeout: 20000` for this reason. It has not been
observed on CI runners across the runs reviewed to date. Diagnose a timeout by
running the file in isolation before concluding anything about the code.

## Reproducibility

`package-lock.json` is the authority; CI uses `npm ci`, which fails on any
lock/manifest mismatch and can never silently re-resolve. bun lockfiles were
removed so there is exactly one package manager. The lock was once badly out of
date — recording a tree with neither Niivue nor a test runner — so a fresh clone
would have installed something that could not pass its own tests. If you change
dependencies, verify a clean `npm ci` followed by the full gate set.
