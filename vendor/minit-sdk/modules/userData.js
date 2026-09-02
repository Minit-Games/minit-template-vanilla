/**
 * Returns the single-slot userData value for this player.
 *
 * The host injects `window.minit.userData` as a primitive `string | undefined`.
 * This function reads it directly — no JSON parsing is performed in the SDK.
 *
 * **Local-dev fallback:** when `window.minit.userData` is `undefined` or `null` (i.e. no
 * host has injected it), the SDK falls back to the `?userData=<value>` URL param.
 * This lets creators test userData locally during `npm run dev` without a host app.
 * A host-injected string value (including `""`) wins over the URL param.
 *
 * Returns `undefined` when:
 * - Running outside a browser (SSR / test environment without `window`).
 * - `window.minit` or `window.minit.userData` is absent or `null` AND the `?userData`
 *   URL param is also absent.
 *
 * Returns `""` if the stored value is the empty string (distinct from `undefined`).
 */
export function getUserData() {
    if (typeof window === "undefined")
        return undefined;
    const value = window.minit?.userData;
    // Only fall back to URL params when the host has NOT injected userData at all.
    // null and undefined both mean "no injection"; any string (even "") means
    // the host owns the slot, so we return it directly.
    if (value == null) {
        return getUserDataFromUrlParam();
    }
    return typeof value === "string" ? value : undefined;
}
/**
 * Reserved URL-param key for the userData local-dev fallback.
 * This exact key is read by {@link getUserDataFromUrlParam} and filtered out of
 * `getConfig()` / `getConfigValue()` so the two namespaces stay distinct.
 *
 * Exported so `config.ts` can import it — not re-exported from the package entry point.
 */
export const USER_DATA_PARAM_KEY = "userData";
/**
 * Reads `?userData=<value>` from the current URL search string and returns its value,
 * or `undefined` if not present.
 *
 * Only called from {@link getUserData}, which already guards against `window` being
 * undefined — this function can therefore assume a browser environment.
 */
function getUserDataFromUrlParam() {
    const value = new URLSearchParams(window.location.search).get(USER_DATA_PARAM_KEY);
    // URLSearchParams.get returns null when absent; normalise to undefined.
    return value !== null ? value : undefined;
}
