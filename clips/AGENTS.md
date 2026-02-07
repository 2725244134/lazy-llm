# CLIP (Core Logic Improvement Proposal)

This folder contains CLIPs: design/proposal documents that capture the *essential* changes of a
feature/refactor (data structures, boundaries, protocols), not the full implementation details.

written in Chinese

## Core idea

Code is cheap. Architecture is not.

In an LLM-assisted world, implementation is increasingly abundant. What remains scarce (and what
determines long-term quality) is the design of *data structures and their relationships*.

> Bad programmers worry about the code. Good programmers worry about data structures and their relationships.

A CLIP should prioritize:

- System architecture, extensibility, and stability (the decisions that shape future work)
- Data structures and their relationships (schemas, interfaces, boundaries, invariants)
- Product decisions and trade-offs (what we choose and why)
- Testability (what must be proven and how)

Prototypes are encouraged and can be developed in parallel with the CLIP. The CLIP is the
contract; code should converge to it before merging.

## When to write a CLIP

Write a CLIP when a change:

- Introduces or changes public APIs / IPC payloads / config formats / persisted data
- Changes module boundaries or layering rules
- Touches multiple subsystems (e.g. web UI + Tauri + storage) in a coupled way

Skip a CLIP for small, local changes (UI tweaks, small bug fixes) that do not create new
contracts.

## Naming and metadata

- File name: `clips/clip-<id>-<slug>.md`
- IDs are monotonic increasing integers (CLIP-0 is reserved for the process itself).
- Use front matter at the top:
  - `Author`
  - `Created` 
  - `Updated`
  - `Status`: `Draft` | `Implemented`
  - `Commits`: readable list of commit subjects or PR links (use `TBD` while in Draft)

## Status lifecycle

- `Draft`: early thinking; may change freely.
- `Implemented`: merged into `main` and validated.
  - Update `Commits` with readable commit subjects or PR links for the set of commits that implemented the CLIP.

## Branch workflow (prototype-first)

For a new CLIP:

1. Create a prototype branch (cheap and disposable):
   - Recommended: `clip-<id>-proto` or `proto/clip-<id>-<slug>`
2. "Ask an agent blindly" to generate a working prototype:
   - Provide only: goal + acceptance criteria + explicit non-goals.
   - Iterate quickly; rewrite if stuck.
3. In parallel, extract the *essential changes* into the CLIP:
   - Focus on structure/relationships; avoid line-by-line diffs.
4. Once the direction is clear, converge code to the CLIP and merge to `main`.
5. Mark the CLIP `Implemented` and fill `Commits` with readable commit subjects or PR links.

For a personal project, review can be "self-review" using the checklist below.

## Review checklist (what matters)

- Clear problem statement and non-goals
- New/changed schemas and interfaces are specified (examples welcome)
- Boundaries and dependency direction are explicit
- A test plan exists and is realistic

## CLIP template

```markdown
---
Author: <name>
Created: YYYY-MM-DD
Updated: YYYY-MM-DD
Status: Draft
Commits: TBD
---

# CLIP-<id>: <title>

## Problem statement

<What problem are we solving? Why now?>

## Non-goals

<What is explicitly out of scope?>

## Design

### Data structures

<New or changed types, schemas, interfaces>

### Boundaries and dependencies

<Module interactions, dependency direction, IPC payloads if applicable>

### Trade-offs

<Alternatives considered and why this approach was chosen>

## Test plan

<What must be proven and how?>

## Implementation notes

<Optional: hints for implementers, known pitfalls>
```

## Relationship with Git workflow

- CLIP branches follow the naming `clip-<id>-<slug>` or `clip-<id>-proto`.
- Checkpoint freely during prototyping; history hygiene is not required on the branch.
- Before merging to `main`, squash commits into a single clean commit (per main repo convention).
- Update the CLIP status to `Implemented` and link to the merge commit/PR.
