# Modal Coordination

Use one shared queue for every blocking modal that can appear from the global shell or a route module:

```js
await window.HiddenRoomModalQueue.enqueue(() => openModalAndReturnPromise());
```

Rules:

- Do not create a second modal queue, rely on competing `z-index` values, or open a blocking modal with an unrelated `setTimeout`.
- The task passed to `enqueue` must return a Promise that resolves on completion, cancellation, logout, or route teardown. Always release DOM, body scroll locking, listeners, and focus state in cleanup.
- Queue mandatory gates in this order: account onboarding, profile completeness, legal consent, then feature or informational prompts. A route module must wait for the shared profile/onboarding promise before showing invitations or feature dialogs.
- Legal dialogs use `openLegalAcceptanceGate`; it delegates to the shared queue when `site.js` is present. Keep the fallback legal-only queue for pages that do not load the global shell.
- Give each modal one stable `id`, `role="dialog"`, `aria-modal="true"`, a labelled heading, keyboard escape behavior where cancellation is allowed, and focus restoration.
- If a modal is route-local, unregister it through `window.HiddenRoomApp` lifecycle cleanup so SPA navigation cannot leave a stale promise or overlay behind.

The current shared coordinator is defined by `site.js` as `window.HiddenRoomModalQueue`. It is intentionally FIFO; call sites enforce business priority by awaiting prerequisites before enqueueing later prompts.
