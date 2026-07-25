# MRI source ledger

Every MRI or orientation claim this project relies on is recorded here with its
source and its status, so a future maintainer can tell a specification-backed
fact from a decision we made.

## Files

| File | Covers |
| --- | --- |
| [slice-orientation.md](slice-orientation.md) | Coordinate spaces, RAS ordering, slice offset direction, anatomical labels |
| `protocol-selection.md` | *(not written yet)* protocol and sequence choices |
| `physics.md` | *(not written yet)* TR / TE / flip angle and contrast behaviour |

## How to add an entry

Add a row to the relevant file's table. Classify every claim as exactly one of:

- **Authoritative fact** — stated by a standard, specification, or primary
  reference. Cite it. This is the only class that may be treated as settled.
- **Implementation convention** — how a specific library or this codebase does
  it. Correct for that implementation, and not necessarily elsewhere. Cite the
  file and version.
- **Product decision** — a choice we made, with no external authority. Record
  who decided and why, so it can be revisited deliberately.
- **Unresolved ambiguity** — known to be undecided or undecidable from the
  available data. Never let one of these silently become a fact.

State how the claim was verified, not just that it was. "Parsed the header",
"read the pinned dependency source", and "quoted the specification" are
verifications; "well known" is not.

Where an entry depends on something that could change — a fixed asset, a version
pin, a gate threshold — record the **expiry condition**: what would have to
happen for the claim to stop holding.
