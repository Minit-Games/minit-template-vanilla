const audioContexts = new Set();
const mediaElements = new Set();
// These sets contain only items whose state was changed by the visibility
// handler, so an item that was already paused or suspended is not resumed.
const suspendedByVisibility = new Set();
const pausedByVisibility = new Set();
// Tracks contexts whose suspend() call (from the hide path) hasn't settled
// yet. The show path leaves these alone instead of untracking them, so the
// in-flight suspend()'s own callback below can resume the context once it
// settles rather than leaving it stuck suspended with nothing left to retry
// it — see the show-path loop for the corresponding read of this set.
const suspendingByVisibility = new Set();
let listenerInstalled = false;
// Audio sources not explicitly registered here are intentionally unaffected.
export function registerAudioContext(context) {
    audioContexts.add(context);
}
export function registerAudioElement(element) {
    mediaElements.add(element);
}
function handleVisibilityChange() {
    if (document.hidden) {
        for (const context of audioContexts) {
            if (context.state === "running" && !suspendedByVisibility.has(context)) {
                suspendedByVisibility.add(context);
                suspendingByVisibility.add(context);
                void context.suspend().then(() => {
                    suspendingByVisibility.delete(context);
                    // The tab may have already become visible again
                    // while suspend() was in flight; if so, and nothing
                    // else already resumed it, resume now instead of
                    // leaving the context stuck suspended. Check
                    // context.state (not just set membership) so we
                    // don't resume a context the show path already
                    // resumed while this suspend() was still pending.
                    // Only clear tracking once resume() actually
                    // succeeds so a rejection is retried on the next
                    // visibility toggle instead of being silently
                    // dropped.
                    if (!document.hidden && context.state === "suspended") {
                        void context.resume().then(() => suspendedByVisibility.delete(context), () => { });
                    }
                }, () => {
                    suspendingByVisibility.delete(context);
                    suspendedByVisibility.delete(context);
                });
            }
        }
        for (const element of mediaElements) {
            if (!element.paused && !pausedByVisibility.has(element)) {
                pausedByVisibility.add(element);
                element.pause();
            }
        }
        return;
    }
    for (const context of suspendedByVisibility) {
        if (context.state === "suspended") {
            // Keep tracking on rejection so the next visibility toggle
            // retries the resume() instead of leaving it silently suspended.
            void context.resume().then(() => suspendedByVisibility.delete(context), () => { });
        }
        else if (!suspendingByVisibility.has(context)) {
            // Not suspended, and no suspend() call still in flight for it —
            // something else already resumed it independently, so stop
            // tracking it.
            suspendedByVisibility.delete(context);
        }
        // Otherwise suspend() is still in flight for this context; leave it
        // tracked. Deleting it here would drop it while visible — the
        // in-flight suspend()'s own callback (above) resumes it once that
        // settles.
    }
    for (const element of pausedByVisibility) {
        if (element.paused) {
            // Keep tracking on rejection so the next visibility toggle
            // retries the play() instead of leaving it silently paused.
            void element.play().then(() => pausedByVisibility.delete(element), () => { });
        }
        else {
            pausedByVisibility.delete(element);
        }
    }
}
export function installAudioVisibilityListener() {
    if (listenerInstalled) {
        return;
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    listenerInstalled = true;
}
