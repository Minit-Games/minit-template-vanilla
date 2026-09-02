import { USER_DATA_PARAM_KEY } from "./userData.js";
export function getConfig() {
    const urlParams = new URLSearchParams(window.location.search);
    const config = {};
    urlParams.forEach((value, key) => {
        if (key === USER_DATA_PARAM_KEY)
            return;
        config[key] = value;
    });
    return config;
}
export function getConfigValue(key, defaultValue) {
    // `userData` key is reserved — never expose it through getConfigValue.
    if (key === USER_DATA_PARAM_KEY) {
        if (defaultValue === undefined)
            return undefined;
        return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const value = urlParams.get(key);
    if (value !== null) {
        return value;
    }
    if (defaultValue === undefined) {
        return undefined;
    }
    return typeof defaultValue === 'function'
        ? defaultValue()
        : defaultValue;
}
// Backward-compat aliases
export const getDropConfig = getConfig;
export { getConfigValue as getDropConfigValue };
