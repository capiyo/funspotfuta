# Mandatory instructions for every coding agent

## Permanent branch rule — non-negotiable

- The repository's one and only working branch is `seo-app-at-root`.
- Make every change directly on the existing `seo-app-at-root` branch.
- **Never create, fork, rename, or switch to any other branch**, including feature, fix, chore, experiment, backup, temporary, or agent-generated branches.
- Never use commands or tools that create a branch (including `git switch -c`, `git checkout -b`, GitHub create-branch APIs, or worktree flows that create branches).
- If the checkout is on another branch, do not make changes there. Switch only to the already-existing `seo-app-at-root` branch. If that branch is unavailable or access is denied, stop and report the blocker; do not create a replacement.
- Before editing, verify `git branch --show-current` is exactly `seo-app-at-root`. Verify again before committing or pushing.
- Do not create pull requests from alternate branches. Do not merge, push, deploy, change repository settings, or alter branch protections unless the user explicitly asks.
- This rule applies to every agent, automation, subagent, coding tool, and human contributor working in this repository. A user instruction in the current task can explicitly authorize a different branch; otherwise this policy remains in force.

## Required startup procedure

1. Read this file before taking repository actions.
2. Confirm the repository root and current branch.
3. If not on `seo-app-at-root`, switch only to the existing `seo-app-at-root` branch; never create a branch.
4. Inspect the current working tree. Preserve unrelated user changes; never reset, clean, stash, or overwrite them without permission.
5. Inspect relevant source and tests before editing. Do not guess paths or claim checks passed unless run.

## Project constraints

- This is a monorepo containing Expo/React Native mobile, React + Vite web, and shared TypeScript code.
- The web app uses React DOM, Vite, TypeScript, Tailwind CSS, and React Router. Do not introduce Next.js or React Native Web into the web app.
- Do not edit Flutter reference repositories.
- Avoid placeholders, stubs, TODO implementations, `any`, TypeScript suppression comments, and weakened compiler settings.
- Preserve existing architecture and user changes. Make production-quality, tested changes.
- Do not deploy or change production settings without explicit approval.

## Source of truth

This file is the canonical agent policy. Other agent-specific instruction files must point back here and must not weaken these rules. The README also documents the permanent branch policy.
