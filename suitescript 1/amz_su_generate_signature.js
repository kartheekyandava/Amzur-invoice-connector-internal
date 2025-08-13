/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/https', 'N/crypto', 'N/encode', 'N/log'],
    function (https, crypto, encode, log) {

        function onRequest(context) {
          try{
            if (context.request.method === 'POST') {
               var https_method = "POST";
                var consumerKey = '9086483b8c5af65e516453a1dcd739b3807429b63dee19ea73a456395cce91f0';
                var consumerSecret = '9bb09b2db9f1ff264cc55a625ebacc8f6c6d2b17feddcda713d5ba261549902f';
                var token = 'c57a0148b60d35679c3fe9adbe75dea6a7a3c152b56f823a35acfb846f087970';
                var tokenSecret = '0c1b7fd949290038427da5fd4c47ba9cfb6b495f56a6c19a87da65558afda259';
              var nonce = generateNonce();
                var realm = 'TD3012313';
                var BaseUrl = 'https://td3012313.suitetalk.api.netsuite.com/services/rest/record/v1/vendorbill';
                var method = 'POST';

                var timeStamp = Math.floor(Date.now() / 1000);
                var params = {
                    oauth_consumerKey: consumerKey,
                    oauth_nonce: nonce,
                    oauth_signature_method: 'HMAC-SHA256',
                    oauth_timeStamp: timeStamp,
                    oauth_token: token,
                    oauth_version: '1.0'
                };

                var sortedKeys = Object.keys(params).sort();
                //log.debug('sortedKeys', sortedKeys);
                const paramString = sortedKeys.map(k => (k) + '=' + (params[k])).join('&');
                //log.debug('paramString', paramString);
                var encodedparamString = encodeURIComponent(paramString);
                //log.debug('encodedparamString', encodedparamString);
                var baseString = https_method + '&' + encodeURIComponent(BaseUrl).replace('!', '%21') + '&' + encodedparamString;
                log.debug('baseString', baseString);
                var signingKey = consumerSecret + '&' + tokenSecret;
                log.debug('signingKey', signingKey);
                var secretKey = crypto.createSecretKey({
                    secret: 'custsecret_amz_invoice_connector',
                    encoding: encode.Encoding.UTF_8
                });
                //log.debug('secretKey', secretKey);
                var hmac = crypto.createHmac({
                    algorithm: crypto.HashAlg.SHA256,
                    key: secretKey
                });

                hmac.update({
                    input: baseString,
                    inputEncoding: encode.Encoding.UTF_8
                });
                //log.debug('hmac', hmac);
                var signature = hmac.digest({
                    outputEncoding: encode.Encoding.BASE_64
                });

                //log.debug('Signature', signature);
                var oauth_signature = encodeURIComponent(signature);
                log.debug('oauth_signature', oauth_signature);

                //authorization header
                var oauthHeader = 'OAuth realm="' + realm + '",';
                oauthHeader = oauthHeader + 'oauth_consumerKey="' + consumerKey + '",';
                oauthHeader = oauthHeader + 'oauth_token="' + token + '",';
                oauthHeader = oauthHeader + 'oauth_signature_method="HMAC-SHA256",';
                oauthHeader = oauthHeader + 'oauth_timeStamp="' + timeStamp + '",';
                oauthHeader = oauthHeader + 'oauth_nonce="' + nonce + '",';
                oauthHeader = oauthHeader + 'oauth_version="1.0",';
                oauthHeader = oauthHeader + 'oauth_signature="' + oauth_signature + '"';
                log.debug('oauthHeader', oauthHeader);
            }
        }catch(ex){
            log.error(ex.name,ex.message);
        }
        }

        function generateNonce(length = 32) {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            var nonce = '';
            for (var i = 0; i < length; i++) {
                nonce += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return nonce;
        }

        function createBaseString(method, url, params) {
            var sortedKeys = Object.keys(params).sort();
            var paramString = sortedKeys.map(function (key) {
                return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
            }).join('&');
            return [
                method.toUpperCase(),
                encodeURIComponent(url),
                encodeURIComponent(paramString)
            ].join('&');
        }

        return {
            onRequest: onRequest
        };
    });
