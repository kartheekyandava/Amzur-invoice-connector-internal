/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/https', 'N/record', 'N/crypto', 'N/search', 'N/encode', 'N/ui/serverWidget','N/url'],

    (https, record, crypto, search, encode, serverWidget,url) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {
            try {
                var form = scriptContext.form;
                var invRec = scriptContext.newRecord;
                var poCheck = invRec.getValue('otherrefnum');
                
                if (scriptContext.type == "view") {
                    if (poCheck) {
                        var output = url.resolveScript({
                            scriptId: 'customscript_amz_su_to_validate_po',
                            deploymentId: 'customdeploy_amz_su_to_validate_po',
                            params: { custom_invid: scriptContext.newRecord.id }
                        });
                        log.debug('poCheck', poCheck);
                        scriptContext.form.addButton({
                            id: 'custpage_po_check',
                            label: 'PO Check',
                            functionName: 'require([],function(){ function openPDF(){window.open("' + output + '","_self")};openPDF(); })'
                        });
                    }


                }
            } catch (ex) {
                log.error(ex.name, ex.message);
            }

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
            try {
                var invRec = record.load({ type: record.Type.INVOICE, id: scriptContext.newRecord.id });
                log.debug('invRec', invRec);
                var customer = invRec.getValue('entity');
                var poNumber = invRec.getValue('otherrefnum');
                log.debug('poNumber', poNumber);
                log.debug('customer', customer)
                var invSuc = invRec.getValue('custbody_amz_invoice_send_succ');
                if (customer && poNumber && !invSuc) {
                    var customrecord_amz_customer_credentialsSearchObj = search.create({
                        type: "customrecord_amz_customer_credentials",
                        filters:
                            [
                                ["custrecord_amz_customer", "anyof", customer]
                            ],
                        columns:
                            [
                                search.createColumn({ name: "custrecord_amz_account_id", label: "Account ID" }),
                                search.createColumn({ name: "custrecord_amz_consumer_key", label: "Consumer Key" }),
                                search.createColumn({ name: "custrecord_amz_cinsumer_secret", label: "Consumer Secret" }),
                                search.createColumn({ name: "custrecord_amz_token_id", label: "Token Id" }),
                                search.createColumn({ name: "custrecord_amz_token_secret", label: "Token Secret" }),
                                search.createColumn({ name: "custrecord_amz_po_end_point", label: "PO END POINT" }),
                                search.createColumn({ name: "custrecord_amz_secret_key_id"}),

                            ]
                    }).run().getRange(0, 1);

                    if (customrecord_amz_customer_credentialsSearchObj.length > 0) {
                        log.debug('customrecord_amz_customer_credentialsSearchObj', customrecord_amz_customer_credentialsSearchObj);
                        var https_method = "POST";
                        var BaseUrl = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_po_end_point');
                        var token_id = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_token_id');
                        var token_secret = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_token_secret');
                        var consumer_key = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_consumer_key');
                        var consumer_secret = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_cinsumer_secret');
                        var realm = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_account_id');
                        var secretKey = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_secret_key_id');
                        var oauthHeader = generateOAuthHeader(BaseUrl, https_method, consumer_key, consumer_secret, token_id, token_secret, realm,secretKey);
                        log.debug('oauthHeader', oauthHeader);
                        var data = {
                            "q": "SELECT id,entity,amountunbilled,status FROM transaction WHERE recordtype = 'purchaseorder' AND tranid ='" + poNumber + "'"
                        }
                        log.debug('data', data);
                        var response = https.post({
                            url: BaseUrl,
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': '*/*',
                                'Prefer': 'transient',
                                'Authorization': oauthHeader
                            },
                            body: JSON.stringify(data)
                        });
                        log.debug('response', response);
                        if (response.code == '200') {
                            var responseBody = JSON.parse(response.body);
                            log.debug('responseBody', responseBody);
                            var count = responseBody.count;
                            log.debug('count', count);
                            if (count == 0) {
                                invRec.setValue('custbody_amz_po_validation_check', 2);
                            } else {
                                var total = invRec.getValue('total');
                                var items = responseBody.items;

                                var unBilledAmount = items[0].amountunbilled;
                                unBilledAmount = Math.abs(unBilledAmount);
                                log.debug('unBilledAmount', unBilledAmount);
                                if (total > unBilledAmount) {
                                    invRec.setValue('custbody_amz_po_validation_check', 3);
                                } else if (total < unBilledAmount) {
                                    invRec.setValue('custbody_amz_po_validation_check', 1);
                                }
                              invRec.setValue('custbody_amz_po_information_target_sys', "entityid:"+items[0].entity+";"+"\n"+"amountunbilled:"+items[0].amountunbilled+";"+"\n"+"POID:"+items[0].id+";"+"\n"+"status:"+items[0].status);

                            }
                            invRec.save();
                        }

                    }
                }
            } catch (ex) {
                log.error(ex.name, ex.messaeg);
            }

        }

        function generateOAuthHeader(url, method, consumerKey, consumerSecret, token, tokenSecret, accountId,secretKeyValue) {
            try {
                var https_method = method;
                var BaseUrl = url;
                var token_id = token;
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
                    oauth_version: '1.0'
                };

                var sortedKeys = Object.keys(params).sort();
                //log.debug('sortedKeys', sortedKeys);
                const paramString = sortedKeys.map(k => (k) + '=' + (params[k])).join('&');
                //log.debug('paramString', paramString);
                var encodedparamString = encodeURIComponent(paramString);
                //log.debug('encodedparamString', encodedparamString);
                var baseString = https_method + '&' + encodeURIComponent(BaseUrl) + '&' + encodedparamString;
                //log.debug('baseString', baseString);
                var signingKey = consumer_secret + '&' + token_secret;
                var secretKey = crypto.createSecretKey({
                    secret: secretKeyValue,
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

        return { beforeLoad, beforeSubmit,afterSubmit} 

    });
