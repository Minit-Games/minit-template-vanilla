export function getEnvironment() {
    return window.minit?.environment || "testing";
}
export function isApp() {
    return getEnvironment() === "app";
}
export function isTestEnvironment() {
    return getEnvironment() === "testing";
}
export function callApiFunction(callback, testMessage) {
    if (isTestEnvironment()) {
        const message = typeof testMessage === "string" ? testMessage : testMessage();
        console.log(`[MinitSDK]`, message);
    }
    else {
        callback();
    }
}
// Backward-compat aliases
export const getDropEnvironment = getEnvironment;
