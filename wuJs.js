const wu = require("./wuLib.js");
const path = require("path");
const UglifyJS = require("uglify-js");
const esprima = require("esprima");
const {js_beautify} = require("js-beautify");
const {createVM} = require("./wuSandbox.js");

function jsBeautify(code) {
    return UglifyJS.minify(code, {mangle: false, compress: false, output: {beautify: true, comments: true}}).code;
}

function splitJs(name, cb, mainDir) {
    let isSubPkg = mainDir && mainDir.length > 0;
    let dir = path.dirname(name);
    if (isSubPkg) {
        dir = mainDir;
    }
    wu.get(name, code => {
        let needDelList = {};
        const captured = new Set();
        function captureDefine(moduleName, func) {
            captured.add(moduleName);
            let code = func.toString();
            code = code.slice(code.indexOf("{") + 1, code.lastIndexOf("}") - 1).trim();
            let bcode = code;
            if (code.startsWith('"use strict";') || code.startsWith("'use strict';")) code = code.slice(13);
            else if ((code.startsWith('(function(){"use strict";') || code.startsWith("(function(){'use strict';")) && code.endsWith("})();")) code = code.slice(25, -5);
            let res = jsBeautify(code);
            if (typeof res == "undefined") {
                console.log("Fail to delete 'use strict' in \"" + moduleName + "\".");
                res = jsBeautify(bcode);
            }
            console.log(dir, moduleName);
            needDelList[path.resolve(dir, moduleName)] = -8;
            wu.save(path.resolve(dir, moduleName), jsBeautify(res));
        }
        const vm = createVM({
                __wxConfig: {},
                require() {
                },
                define: captureDefine,
                definePlugin() {
                },
                requirePlugin() {
                }
        });
        if (isSubPkg) {
            code = code.slice(code.indexOf("define("));
        }
        console.log('splitJs: ' + name);
        try {
            vm.run(code);
        } catch (error) {
            // Recent app-service bundles execute their entry modules immediately
            // after registering them. The sandbox only needs the define() calls;
            // recover any calls after a failed bootstrap without running modules.
            const ast = esprima.parseScript(code, {range: true});
            const definitions = ast.body.filter(node => node.type === "ExpressionStatement"
                && node.expression.type === "CallExpression"
                && node.expression.callee.type === "Identifier"
                && node.expression.callee.name === "define");
            if (!definitions.length) throw error;
            let recovered = 0;
            const fallbackVm = createVM({define: captureDefine});
            for (const node of definitions) {
                const moduleName = node.expression.arguments[0]?.value;
                if (typeof moduleName !== "string" || captured.has(moduleName)) continue;
                fallbackVm.run(code.slice(node.range[0], node.range[1]));
                if (!captured.has(moduleName)) throw new Error(`define did not register ${moduleName}`);
                recovered++;
            }
            console.warn(`Skipped app bootstrap after extracting ${captured.size} modules (${recovered} recovered): ${error.message}`);
        }
        console.log("Splitting \"" + name + "\" done.");
        if (!needDelList[name]) needDelList[name] = 8;
        cb(needDelList);
    });
}

module.exports = {jsBeautify: jsBeautify, wxsBeautify: js_beautify, splitJs: splitJs};
if (require.main === module) {
    wu.commandExecute(splitJs, "Split and beautify weapp js file.\n\n<files...>\n\n<files...> js files to split and beautify.");
}
