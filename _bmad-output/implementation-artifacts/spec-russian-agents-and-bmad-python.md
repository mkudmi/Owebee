---
title: 'Russian agent communication and BMAD Python runtime'
type: 'chore'
created: '2026-07-01'
status: 'in-review'
baseline_commit: '790839e3bbbeec46a5dee432ac8103452ce7b259'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Project agents currently inherit English communication settings, while BMAD customization scripts run through Apple's Python 3.9 and fail because the standard-library `tomllib` module requires Python 3.11 or newer.

**Approach:** Establish Russian as the project-wide agent communication language, align BMAD configuration with that rule, and make the already-installed Homebrew Python 3.12 the default interactive `python3` runtime. Use its standard-library `tomllib` rather than installing an unrelated compatibility package.

## Boundaries & Constraints

**Always:** Preserve all existing uncommitted work. Keep source-code identifiers, commands, paths, logs, and quoted external text in their original form where translation would reduce precision. Require Python 3.11 or newer for BMAD scripts and prefer `uv run` when invoking them explicitly.

**Ask First:** Installing or upgrading additional Homebrew packages; replacing the existing Python 3.12 installation; changing application dependencies or source code.

**Never:** Revert unrelated working-tree changes, edit generated skill defaults under `.agents/skills`, install a package named `tomllib` into system Python 3.9, or claim success without running the BMAD customization resolver.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Agent interaction | A new agent session starts in the repository | The agent responds to the user in Russian | Preserve technical literals instead of mistranslating them |
| BMAD workflow | The resolver is invoked through `python3` or `uv run` | Customization TOML is parsed successfully | Report the selected interpreter and import failure if `tomllib` is unavailable |
| Existing shell profile | Homebrew initialization already exists | Python 3.12 `libexec/bin` is added once and precedes `/usr/bin` | Avoid duplicate PATH entries |

</frozen-after-approval>

## Code Map

- `AGENTS.md` -- repository-wide instructions for agent language and BMAD Python usage.
- `_bmad/bmm/config.yaml` -- BMAD communication and document language settings.
- `/Users/mku/.zprofile` -- login-shell PATH initialization selecting Homebrew Python 3.12.
- `_bmad/scripts/resolve_customization.py` -- unchanged verification target that imports stdlib `tomllib`.

## Tasks & Acceptance

**Execution:**
- [x] `AGENTS.md` -- add concise repository-wide instructions requiring Russian responses and precise handling of technical literals.
- [x] `_bmad/bmm/config.yaml` -- set communication and document output languages to Russian so BMAD workflows agree with repository instructions.
- [x] `/Users/mku/.zprofile` -- prepend the installed Python 3.12 `libexec/bin` directory after Homebrew shell initialization.
- [x] `_bmad/scripts/resolve_customization.py` -- run unchanged through both the selected `python3` and `uv run`.

**Acceptance Criteria:**
- Given a future agent operating in this repository, when it reads project instructions, then it is explicitly required to communicate with the user in Russian.
- Given a BMAD skill activation, when its configuration is loaded, then both communication and generated document language resolve to Russian.
- Given a fresh login shell, when `python3` is resolved, then it reports Python 3.12 or newer and `import tomllib` succeeds.
- Given the sprint-status skill path, when the customization resolver runs, then it exits successfully and emits the resolved workflow JSON.
- Given the existing dirty worktree, when implementation completes, then unrelated modified and untracked files remain unchanged.

## Spec Change Log

## Verification

**Commands:**
- `zsh -lic 'command -v python3 && python3 --version && python3 -c "import tomllib; print(tomllib.__name__)"'` -- expected: Homebrew Python 3.12+ and `tomllib`.
- `zsh -lic 'python3 _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-sprint-status --key workflow'` -- expected: exit code 0 and resolved JSON.
- `uv run _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-sprint-status --key workflow` -- expected: exit code 0 and equivalent resolved JSON.
- `git diff -- AGENTS.md _bmad/bmm/config.yaml` -- expected: only the approved repository instruction and language changes.
