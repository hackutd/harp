"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProxyObject = void 0;
function getProxyObject(orig) {
    var ret = __assign(__assign({}, orig), { _call: function (_, __) {
            throw new Error("This function should only be called through the recipe object");
        } });
    var keys = Object.keys(ret);
    var _loop_1 = function (k) {
        if (k !== "_call") {
            ret[k] = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return this._call(k, args);
            };
        }
    };
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var k = keys_1[_i];
        _loop_1(k);
    }
    return ret;
}
exports.getProxyObject = getProxyObject;
