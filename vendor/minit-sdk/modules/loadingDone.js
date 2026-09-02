import { callApiFunction, isTestEnvironment } from "../utils.js";
let _loadingDonePosted = false;
export function loadingDone() {
    if (_loadingDonePosted) {
        return;
    }
    _loadingDonePosted = true;
    if (isTestEnvironment()) {
        return;
    }
    callApiFunction(() => { window.minit?.loadingDone(); }, 'loadingDone');
}
