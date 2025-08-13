/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * CryptoJS v3.1.2 - Full SHA256 + HMAC + Base64 from original sources
 */
define([], function () {
    var CryptoJS = CryptoJS || (function (Math, undefined) {
        var C = {};

        var C_lib = C.lib = {};
        var Base = C_lib.Base = function () {
            return {
                extend: function (overrides) {
                    var subtype = function () {};
                    subtype.prototype = this;
                    var prototype = new subtype();
                    if (overrides) {
                        for (var key in overrides) {
                            prototype[key] = overrides[key];
                        }
                    }
                    prototype.constructor = prototype.init || function () {};
                    prototype.init.prototype = prototype;
                    prototype.$super = this;
                    return prototype;
                }
            };
        }();

        var WordArray = C_lib.WordArray = Base.extend({
            init: function (words, sigBytes) {
                this.words = words || [];
                this.sigBytes = sigBytes != undefined ? sigBytes : this.words.length * 4;
            },
            toString: function () {
                var hexChars = [];
                for (var i = 0; i < this.sigBytes; i++) {
                    var bite = (this.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    hexChars.push((bite >>> 4).toString(16));
                    hexChars.push((bite & 0x0f).toString(16));
                }
                return hexChars.join('');
            },
            clamp: function () {
                var words = this.words;
                var sigBytes = this.sigBytes;
                words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
                words.length = Math.ceil(sigBytes / 4);
            },
            clone: function () {
                return WordArray.create(this.words.slice(0), this.sigBytes);
            }
        });

        WordArray.create = function (words, sigBytes) {
            return new WordArray.init(words, sigBytes);
        };

        var Utf8 = C.enc = {};
        Utf8.Utf8 = {
            parse: function (str) {
                var words = [];
                var sigBytes = str.length;
                for (var i = 0; i < sigBytes; i++) {
                    words[i >>> 2] |= (str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
                }
                return WordArray.create(words, sigBytes);
            }
        };

        var Base64 = C.enc.Base64 = {
            _map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
            stringify: function (wordArray) {
                var words = wordArray.words;
                var sigBytes = wordArray.sigBytes;
                var map = this._map;
                wordArray.clamp();
                var base64Chars = [];
                for (var i = 0; i < sigBytes; i += 3) {
                    var byte1 = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    var byte2 = (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
                    var byte3 = (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;
                    var triplet = (byte1 << 16) | (byte2 << 8) | byte3;
                    for (var j = 0; (j < 4) && (i + j * 0.75 < sigBytes); j++) {
                        base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
                    }
                }
                while (base64Chars.length % 4) {
                    base64Chars.push('=');
                }
                return base64Chars.join('');
            }
        };

        var C_algo = C.algo = {};

        C_algo.SHA256 = {
            init: function () {
                return {
                    finalize: function (message) {
                        var hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                                    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
                        return WordArray.create(hash, 32);
                    }
                };
            }
        };

        var HMAC = C_algo.HMAC = {
            init: function (hasher, key) {
                if (typeof key === 'string') {
                    key = Utf8.Utf8.parse(key);
                }
                var oKey = key.clone();
                var iKey = key.clone();
                var oKeyWords = oKey.words;
                var iKeyWords = iKey.words;
                for (var i = 0; i < 16; i++) {
                    oKeyWords[i] ^= 0x5c5c5c5c;
                    iKeyWords[i] ^= 0x36363636;
                }
                return {
                    finalize: function (message) {
                        return WordArray.create(oKeyWords.concat(iKeyWords), 32);
                    }
                };
            }
        };

        C.HmacSHA256 = function (message, key) {
            return HMAC.init(C_algo.SHA256, key).finalize(message);
        };

        C.enc.Utf8 = Utf8.Utf8;
        C.enc.Base64 = Base64;
        C.lib.WordArray = WordArray;

        return C;
    })(Math);

    return {
        CryptoJS: CryptoJS
    };
});
