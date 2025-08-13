/**
 * 
 * amz_integration_module.js
 * @NApiVersion 2.1
 *
 * OAuth Helper Module
 * Provides a function to generate an OAuth 1.0 Authorization header
 */
define(['N/log',,'N/crypto','N/https','N/encode'],

    (log,crypto,https,encode) => {


        function generateOAuthHeader(url, method, consumerKey, consumerSecret, token, tokenSecret,accountId) {
            try {
                var https_method  = method;
                var BaseUrl = url;
                var token_id =token;
                var token_secret = tokenSecret;
                var consumer_key = consumerKey;
                var consumer_secret = consumerSecret;
                var realm = accountId;
                var nonce = [...Array(32)].map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62))).join('');
                var timeStamp = Math.floor(Date.now() / 1000);
                var params = {
                    oauth_consumer_key: consumer_key,
                    oauth_nonce: nonce,
                    oauth_signature_method: 'HMAC-SHA256',
                    oauth_timestamp: timeStamp,
                    oauth_token: token_id,
                    oauth_version: '1.0',
                    script: '4014',
                    deploy: '1'
                };

                var sortedKeys = Object.keys(params).sort();
                log.debug('sortedKeys', sortedKeys);
                const paramString = sortedKeys.map(k => (k) + '=' + (params[k])).join('&');
                log.debug('paramString', paramString);
                var encodedparamString = encodeURIComponent(paramString);
                log.debug('encodedparamString', encodedparamString);
                var baseString = https_method + '&' + encodeURIComponent(BaseUrl) + '&' + encodedparamString;
                log.debug('baseString', baseString);
                var signingKey = consumer_secret + '&' + token_secret;
                var secretKey = crypto.createSecretKey({
                    secret: 'custsecret_amz_invoice_connector',
                    encoding: encode.Encoding.UTF_8
                });
                log.debug('secretKey', secretKey);
                var hmac = crypto.createHmac({
                    algorithm: crypto.HashAlg.SHA256,
                    key: secretKey
                });

                hmac.update({
                    input: baseString,
                    inputEncoding: encode.Encoding.UTF_8
                });
                log.debug('hmac', hmac);
                var signature = hmac.digest({
                    outputEncoding: encode.Encoding.BASE_64
                });

                log.debug('Signature', signature);
                var oauth_signature = encodeURIComponent(signature);
                log.debug('oauth_signature', oauth_signature);

                //authorization header
                var oauthHeader = 'OAuth realm="' + realm + '",';
                oauthHeader = oauthHeader + 'oauth_consumer_key="' + consumer_key + '",';
                oauthHeader = oauthHeader + 'oauth_token="' + token_id + '",';
                oauthHeader = oauthHeader + 'oauth_signature_method="HMAC-SHA256",';
                oauthHeader = oauthHeader + 'oauth_timestamp="' + timeStamp + '",';
                oauthHeader = oauthHeader + 'oauth_nonce="' + nonce + '",';
                oauthHeader = oauthHeader + 'oauth_version="1.0",';
                oauthHeader = oauthHeader + 'oauth_signature="' + oauth_signature + '"';
                log.debug('oauthHeader', oauthHeader);

                return oauthHeader;
            } catch (e) {
                log.error('generateOAuthHeader Error', e);
                return '';
            }
        }

        return {
            generateOAuthHeader
        };
    });

