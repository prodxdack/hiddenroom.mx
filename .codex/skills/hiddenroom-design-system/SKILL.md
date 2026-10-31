---
name: hiddenroom-design-system
description: Hidden Room design system guidance for hr-* tokens, global CSS, page chrome, responsive layouts, UI primitives, dashboard bridges, module styling, accessibility states, and visual consistency. Use when editing styles.css, portal/dashboard.css, media/store/tickets/kairen CSS, or migrating legacy classes to the shared design language.
---

# Hidden Room Design System

## Workflow

1. Start in `styles.css`; treat it as the identity source for tokens and shared primitives.
2. Use `hr-*` components and tokens before adding route-local CSS.
3. Keep local CSS as an adapter for module-specific layout or legacy compatibility.
4. Preserve dashboard `db-*` classes when logic or dynamic rendering depends on them.
5. Check responsive behavior at about 390px, 768px, and 1440px.
6. Avoid changing print rules for Tickets unless the task explicitly includes ticket print output.
7. For modal UI, preserve shared overlay layering and scroll-lock behavior; styling must not be used to solve simultaneous modal ownership. New blocking dialogs follow `window.HiddenRoomModalQueue` and the shared accessibility contract.

## Core Rules

- Use tokens from `:root`: `--hr-*`, `--red`, `--teal`, `--green`, `--magenta`, `--white`, spacing, z-index, motion, and radii.
- Use shared primitives: `hr-page`, `hr-section`, `hr-container`, `hr-grid`, `hr-stack`, `hr-cluster`, `hr-card`, `hr-btn`, `hr-icon-btn`, `hr-badge`, `hr-table-*`.
- Keep cards at or below the existing radius scale unless matching current module style.
- Preserve high-contrast dark brand foundation with red as primary accent and teal/green/magenta as semantic accents.
- Keep page-specific CSS scoped by page/module classes to avoid global regressions.

## Migration Notes

The design system status doc says Home, Media, Media Admin/CMS, Kairen, Store, Tickets, Portal shell, and Portal internal views are migrated to `styles.css` with opt-in `hr-*` classes. Minigames are pending internal migration and mostly share global chrome.

## References

Read `references/design-system.md` for token groups, migration cautions, and quick visual checks.
Read `../hiddenroom-frontend/references/modal-coordination.md` for modal lifecycle, focus, queue, and teardown rules.
