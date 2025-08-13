/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/https', 'N/crypto', 'N/encode', 'N/url', 'N/record', 'N/log'],

  (https, crypto, encode, url, record, log) => {


    /**
     * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
     * @param {Object} inputContext
     * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
     *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
     * @param {Object} inputContext.ObjectRef - Object that references the input data
     * @typedef {Object} ObjectRef
     * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
     * @property {string} ObjectRef.type - Type of the record instance that contains the input data
     * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
     * @since 2015.2
     */


    const getInputData = () => {
      return { "test": "hii" };
    };



    /**
     * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
     * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
     * context.
     * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
     *     is provided automatically based on the results of the getInputData stage.
     * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
     *     function on the current key-value pair
     * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
     *     pair
     * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
     *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
     * @param {string} mapContext.key - Key to be processed during the map stage
     * @param {string} mapContext.value - Value to be processed during the map stage
     * @since 2015.2
     */

    const map = (mapContext) => {
      try {

        var https_method = "POST";
        var BaseUrl = "https://td3012313.restlets.api.netsuite.com/app/site/hosting/restlet.nl";
        var token_id = 'c57a0148b60d35679c3fe9adbe75dea6a7a3c152b56f823a35acfb846f087970';
        var token_secret = '0c1b7fd949290038427da5fd4c47ba9cfb6b495f56a6c19a87da65558afda259';
        var consumer_key = '9086483b8c5af65e516453a1dcd739b3807429b63dee19ea73a456395cce91f0';
        var consumer_secret = '9bb09b2db9f1ff264cc55a625ebacc8f6c6d2b17feddcda713d5ba261549902f';
        var nonce = [...Array(32)].map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62))).join('');
        var timeStamp = Math.floor(Date.now() / 1000);
        var realm = "TD3012313";

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
        var response = https.post({
          url: 'https://td3012313.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=4014&deploy=1',
          headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Authorization': oauthHeader
          },
          body: JSON.stringify({ foo: 'bar' })
        });
        log.debug('response', response);

      } catch (ex) {
        log.debug(ex.name, ex.message);
      }

    }

    /**
     * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
     * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
     * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
     *     provided automatically based on the results of the map stage.
     * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
     *     reduce function on the current group
     * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
     * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
     *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
     * @param {string} reduceContext.key - Key to be processed during the reduce stage
     * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
     *     for processing
     * @since 2015.2
     */
    const reduce = (reduceContext) => {

    }


    /**
     * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
     * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
     * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
     * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
     *     script
     * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
     * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
     *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
     * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
     * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
     * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
     *     script
     * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
     * @param {Object} summaryContext.inputSummary - Statistics about the input stage
     * @param {Object} summaryContext.mapSummary - Statistics about the map stage
     * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
     * @since 2015.2
     */
    const summarize = (summaryContext) => {

    }

    return { getInputData, map, reduce, summarize }

  });
