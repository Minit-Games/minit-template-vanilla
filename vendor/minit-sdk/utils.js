// The core exports read the window through here, so this thrown literal keeps the "[MinitSDK]"
// bundle fingerprint alive after minifiers strip console calls.
export function browserWindow() {
    if (typeof window === "undefined") {
        throw new Error("[MinitSDK] requires a browser window");
    }
    return window;
}
export function getEnvironment() {
    return browserWindow().minit?.environment || "testing";
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
