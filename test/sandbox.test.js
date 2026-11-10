const assert = require("node:assert/strict");
const test = require("node:test");

const {
    DEFAULT_TIMEOUT_MS,
    createVM,
    sandboxSettings
} = require("../wuSandbox.js");

test("uses documented sandbox defaults", () => {
    const oldTimeout = process.env.WXAPP_VM_TIMEOUT_MS;
    delete process.env.WXAPP_VM_TIMEOUT_MS;
    try {
        assert.deepEqual(sandboxSettings(), {timeout: DEFAULT_TIMEOUT_MS});
    } finally {
        if (oldTimeout === undefined) delete process.env.WXAPP_VM_TIMEOUT_MS;
        else process.env.WXAPP_VM_TIMEOUT_MS = oldTimeout;
    }
});

test("validates sandbox environment overrides", () => {
    const old = process.env.WXAPP_VM_TIMEOUT_MS;
    process.env.WXAPP_VM_TIMEOUT_MS = "not-a-number";
    try {
        assert.throws(() => sandboxSettings(), /WXAPP_VM_TIMEOUT_MS/);
    } finally {
        if (old === undefined) delete process.env.WXAPP_VM_TIMEOUT_MS;
        else process.env.WXAPP_VM_TIMEOUT_MS = old;
    }
});

test("stops non-terminating scripts", () => {
    assert.throws(() => createVM({}, {timeout: 20}).run("while (true) {}"), /timed out/);
});

test("preserves captured module source", () => {
    let source;
    const sandbox = createVM({define(_name, factory) { source = factory.toString(); }});
    sandbox.run('define("page.js", function() { return 42; });');
    assert.match(source, /return 42/);
    assert.doesNotMatch(source, /VM2_INTERNAL_STATE/);
});
