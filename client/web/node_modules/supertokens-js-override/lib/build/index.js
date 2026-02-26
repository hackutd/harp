"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverrideableBuilder = void 0;
var getProxyObject_1 = require("./getProxyObject");
var OverrideableBuilder = /** @class */ (function () {
    function OverrideableBuilder(originalImplementation) {
        this.layers = [originalImplementation];
        this.proxies = [];
    }
    OverrideableBuilder.prototype.override = function (overrideFunc) {
        var proxy = (0, getProxyObject_1.getProxyObject)(this.layers[0]);
        var layer = overrideFunc(proxy, this);
        for (var _i = 0, _a = Object.keys(this.layers[0]); _i < _a.length; _i++) {
            var key = _a[_i];
            if (layer[key] === proxy[key] || key === "_call") {
                delete layer[key];
            }
            else if (layer[key] === undefined) {
                layer[key] = null;
            }
        }
        this.layers.push(layer);
        this.proxies.push(proxy);
        return this;
    };
    OverrideableBuilder.prototype.build = function () {
        var _this = this;
        if (this.result) {
            return this.result;
        }
        this.result = {};
        for (var _i = 0, _a = this.layers; _i < _a.length; _i++) {
            var layer = _a[_i];
            for (var _b = 0, _c = Object.keys(layer); _b < _c.length; _b++) {
                var key = _c[_b];
                var override = layer[key];
                if (override !== undefined) {
                    if (override === null) {
                        this.result[key] = undefined;
                    }
                    else if (typeof override === "function") {
                        this.result[key] = override.bind(this.result);
                    }
                    else {
                        this.result[key] = override;
                    }
                }
            }
        }
        var _loop_1 = function (proxyInd) {
            var proxy = this_1.proxies[proxyInd];
            proxy._call = function (fname, args) {
                for (var i = proxyInd; i >= 0; --i) {
                    var func = _this.layers[i][fname];
                    if (func !== undefined && func !== null) {
                        return func.bind(_this.result).apply(void 0, args);
                    }
                }
            };
        };
        var this_1 = this;
        for (var proxyInd = 0; proxyInd < this.proxies.length; ++proxyInd) {
            _loop_1(proxyInd);
        }
        return this.result;
    };
    return OverrideableBuilder;
}());
exports.OverrideableBuilder = OverrideableBuilder;
exports.default = OverrideableBuilder;
