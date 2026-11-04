import { browserWindow } from "../utils.js";
import { getConfigValue } from "./config.js";
function isMotionQuality(value) {
    return value === "full" || value === "reduced";
}
function isDeviceTier(value) {
    return value === "low" || value === "medium" || value === "high" || value === "unknown";
}
export function prefersReducedMotion() {
    if (typeof window === "undefined")
        return false;
    const override = getConfigValue("reducedMotion");
    if (override === "1" || override === "true")
        return true;
    if (override === "0" || override === "false")
        return false;
    const sdkWindow = browserWindow();
    const hostValue = sdkWindow.minit?.prefersReducedMotion;
    if (typeof hostValue === "boolean")
        return hostValue;
    return typeof sdkWindow.matchMedia === "function"
        ? sdkWindow.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
}
export function getMotionQuality() {
    if (typeof window === "undefined")
        return "full";
    const override = getConfigValue("motionQuality");
    if (isMotionQuality(override))
        return override;
    const hostValue = browserWindow().minit?.motionQuality;
    if (isMotionQuality(hostValue))
        return hostValue;
    return prefersReducedMotion() ? "reduced" : "full";
}
export function getDeviceTier() {
    if (typeof window === "undefined")
        return "unknown";
    const override = getConfigValue("deviceTier");
    if (isDeviceTier(override))
        return override;
    const hostValue = browserWindow().minit?.deviceTier;
    return isDeviceTier(hostValue) ? hostValue : "unknown";
}
