// Keep captured module factories free of vm2's injected try/catch hooks when
// wuJs writes them back through Function.prototype.toString(). node:vm provides
// execution timeouts, but it is not a security boundary.
const vm = require("vm");

const DEFAULT_TIMEOUT_MS = 10_000;

function readIntegerSetting(name, fallback, minimum, maximum) {
    const raw = process.env[name];
    if (raw === undefined || raw === "") return fallback;

    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
    }
    return value;
}

function sandboxSettings() {
    return {
        timeout: readIntegerSetting("WXAPP_VM_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, 100, 60_000)
    };
}

function createVM(sandbox = {}, options = {}) {
    if (!sandbox.global) sandbox.global = sandbox;
    vm.createContext(sandbox);
    return {
        run(code, opts = {}) {
            return vm.runInContext(code, sandbox, {
                ...sandboxSettings(),
                ...options,
                ...opts
            });
        },
        get sandbox() {
            return sandbox;
        }
    };
}

module.exports = {
    DEFAULT_TIMEOUT_MS,
    createVM,
    readIntegerSetting,
    sandboxSettings
};
