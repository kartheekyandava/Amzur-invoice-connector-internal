/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/https', 'N/record', 'N/crypto', 'N/search', 'N/encode', 'N/runtime'],

    (https, record, crypto, search, encode, runtime) => {
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

        const getInputData = (inputContext) => {
            try {
                var scriptObj = runtime.getCurrentScript();
                const customerId = runtime.getCurrentScript().getParameter({
                    name: 'custscript_amz_customer_id'
                });

                if (scriptObj.deploymentId == "customdeploy_amz_mr_cus_leve_invo_to_sen") {

                    if (customerId) {
                        log.debug('Customerid', customerId);
                        return search.create({
                            type: "invoice",
                            settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                            filters:
                                [
                                    ["type", "anyof", "CustInvc"],
                                    "AND",
                                    ["status", "anyof", "CustInvc:A"],
                                    "AND",
                                    ["mainline", "is", "T"],
                                    "AND",
                                    ["name", "anyof", customerId],
                                    "AND",
                                    ["custbody_amz_invoice_send_succ", "is", "F"],
                                    "AND",
                                    ["custbody_amz_po_validation_check", "anyof", "1"]
                                ],
                            columns:
                                [
                                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                                    search.createColumn({ name: "entity", label: "Name" })
                                ]
                        });
                    }

                }
                if (scriptObj.deploymentId == "customdeploy_amz_mr_to_send_bulk_invoice") {
                    return search.create({
                        type: "invoice",
                        settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                        filters:
                            [
                                ["type", "anyof", "CustInvc"],
                                "AND",
                                ["status", "anyof", "CustInvc:A"],
                                "AND",
                                ["mainline", "is", "T"],
                                "AND",
                                ["name", "anyof", customerId],
                                "AND",
                                ["custbody_amz_invoice_send_succ", "is", "F"],
                                "AND",
                                ["custbody_amz_po_validation_check", "anyof", "1"]
                            ],
                        columns:
                            [
                                search.createColumn({ name: "internalid", label: "Internal ID" }),
                                search.createColumn({ name: "entity", label: "Name" })
                            ]
                    });
                }

            } catch (ex) {
                log.error(ex.name, ex.message);
            }
        }

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
                var context = JSON.parse(mapContext.value).values;
                log.debug('context', context);
                var internalId = context.internalid.value;
                //log.debug('internalId', internalId);
                var customer = context.entity.value;
                //log.debug('customer', customer);
                mapContext.write({
                    key: { customer: customer, internalId: internalId },
                    value: {
                        internalId: internalId
                    }

                })

            } catch (ex) {
                log.error(ex.name, ex.message);
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
            var customer, invoiceID;
            try {
                var scriptObj = runtime.getCurrentScript();
                var reduceKey = JSON.parse(reduceContext.key);
                log.debug('reduceKey', reduceKey);
                var reduceValues = reduceContext.values;
                var data = reduceValues.map(function (e) { return JSON.parse(e); })
                log.debug('data', data);
                var dataToSend = [];
                customer = reduceKey.customer;
                invoiceID = reduceKey.internalId;
                log.debug('customer', customer);
                log.debug('invoiceID', invoiceID);
                if (customer) {
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
                                search.createColumn({ name: "custrecord_amz_https_post", label: "Invoice END POINT" }),
                                search.createColumn({ name: "custrecord_amz_po_transform_as_bill" }),
                                search.createColumn({ name: "custrecord_amz_secret_key_id"}),


                            ]
                    }).run().getRange(0, 1);
                    if (customrecord_amz_customer_credentialsSearchObj.length > 0) {
                        var https_method = "POST";
                        var poQueryURL = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_po_end_point');
                        var token_id = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_token_id');
                        var token_secret = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_token_secret');
                        var consumer_key = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_consumer_key');
                        var consumer_secret = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_cinsumer_secret');
                        var realm = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_account_id');
                        var poTransformUrl = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_po_transform_as_bill');
                        var vendorBillurl = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_https_post');
                        var secretKey = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_secret_key_id');
                        var oauthHeader = generateOAuthHeader(poQueryURL, https_method, consumer_key, consumer_secret, token_id, token_secret, realm,secretKey);
                        log.debug('oauthHeader', oauthHeader);
                        log.debug('poTransformUrl', poTransformUrl);
                        var invRec = record.load({
                            type: record.Type.INVOICE,
                            id: invoiceID
                        });
                        log.debug('invRec', invRec);
                        var invtotal = invRec.getValue('total');
                        var poNumber = invRec.getValue('otherrefnum');
                        if (poNumber) {
                            var data = {
                                "q": "SELECT transaction.id,transactionline.closedate,transaction.amountunbilled,transactionline.linesequencenumber,transaction.status,transactionline.quantity,transactionline.rate,transactionline.quantitybilled,transactionline.amount FROM transaction JOIN transactionline ON transaction.id = transactionline.transaction JOIN item ON transactionline.item = item.id WHERE recordtype = 'purchaseorder' AND tranid ='" + poNumber + "'"
                            }
                            var response = https.post({
                                url: poQueryURL,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': '*/*',
                                    'Prefer': 'transient',
                                    'Authorization': oauthHeader
                                },
                                body: JSON.stringify(data)
                            });
                            log.debug('response', response);
                            var invoiceData;
                            if (response.code == '200') {
                                var responseBody = JSON.parse(response.body);
                                log.debug('responseBody', responseBody);
                                var count = responseBody.count;
                                log.debug('count', count);
                                var items = responseBody.items;
                                log.debug('items', items.length);
                                var unBilledAmount = Math.abs(items[0].amountunbilled);
                                log.debug('unBilledAmount', unBilledAmount);
                                if (unBilledAmount > 0) {
                                    if (unBilledAmount == invtotal) {
                                        invoiceData = {};
                                    } else {
                                        invoiceData = createJSONDateFromInvoiceFormPO(items, invRec);
                                    }
                                    var poId = items[0].id;
                                    var poTransformUrlMain = poTransformUrl.replace('id', poId);
                                    var pooauthHeader = generateOAuthHeader(poTransformUrlMain, https_method, consumer_key, consumer_secret, token_id, token_secret, realm,secretKey);
                                    log.debug('pooauthHeader', pooauthHeader);
                                    log.debug('invoiceData', poTransformUrlMain);
                                    var invResponse = https.post({
                                        url: poTransformUrlMain,
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Accept': '*/*',
                                            'Authorization': pooauthHeader
                                        },
                                        body: JSON.stringify(invoiceData)
                                    });
                                    log.debug('invResponse', invResponse);
                                    if (invResponse.code == "204") {
                                        var headersValue = invResponse.headers;
                                        var location = headersValue.location.split('/');
                                        log.debug('location', location);
                                        var billID = location[location.length - 1];
                                        log.debug('billID', billID);
                                        record.submitFields({
                                            type: record.Type.INVOICE,
                                            id: invoiceID,
                                            values: {
                                                custbody_amz_bill_message: "Bill ID:" + billID,
                                                custbody_amz_invoice_send_succ: true,
                                                custbody_amz_invoice_error: ''

                                            },
                                            options: {
                                                enableSourcing: false,
                                                ignoreMandatoryFields: true
                                            }
                                        });
                                    } else if (invResponse.code == '400') {
                                        var invRequestBody = JSON.parse(invResponse.body);
                                        log.debug('invRequestBody', invRequestBody);
                                        var errorDetails = invRequestBody["o.errorDetails"];
                                        record.submitFields({
                                            type: record.Type.INVOICE,
                                            id: invoiceID,
                                            values: {
                                                custbody_amz_bill_message: "Error Msg:" + errorDetails,
                                            },
                                            options: {
                                                enableSourcing: false,
                                                ignoreMandatoryFields: true
                                            }
                                        });
                                    } else {
                                        var errRec = record.create({ type: 'customrecord_amz_customer_connection_err' });
                                        errRec.setValue('custrecord_amz_response_error_msg', JSON.parse(invResponse.body));
                                        errRec.setValue('custrecord_amz_transaction_date', new Date());
                                        errRec.setValue('custrecord_amz_customer_main', invoiceID);
                                        errRec.save();
                                    }


                                } else {
                                    record.submitFields({
                                        type: record.Type.INVOICE,
                                        id: invoiceID,
                                        values: {
                                            custbody_amz_invoice_error: "There is no pending amount for this PO",
                                        },
                                        options: {
                                            enableSourcing: false,
                                            ignoreMandatoryFields: true
                                        }
                                    });

                                }

                            } else {
                                var errRec = record.create({ type: 'customrecord_amz_customer_connection_err' });
                                errRec.setValue('custrecord_amz_response_error_msg', JSON.parse(response.body));
                                errRec.setValue('custrecord_amz_transaction_date', new Date());
                                errRec.setValue('custrecord_amz_customer_main', invoiceID);
                                errRec.save();
                            }
                        }else {
                                var oauthHeader = generateOAuthHeader(vendorBillurl, https_method, consumer_key, consumer_secret, token_id, token_secret, realm,secretKey);
                                var invInformation = createJSONFromInvoice(customrecord_amz_customer_credentialsSearchObj, poQueryURL, invRec);
                                log.debug('invInformation', invInformation);
                                var invResponse = https.post({
                                    url: vendorBillurl,
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Accept': '*/*',
                                        'Authorization': oauthHeader
                                    },
                                    body: JSON.stringify(invInformation)
                                });
                                log.debug('invResponse', invResponse);
                                if (invResponse.code == '204') {
                                    var headersValue = invResponse.headers;
                                    var location = headersValue.location.split('/');
                                    log.debug('location', location);
                                    var billID = location[location.length - 1];
                                    log.debug('billID', billID);
                                    record.submitFields({
                                        type: record.Type.INVOICE,
                                        id: invoiceId,
                                        values: {
                                            custbody_amz_bill_message: "Bill ID:" + billID,
                                            custbody_amz_invoice_send_succ: true,
                                            custbody_amz_invoice_error: ''

                                        },
                                        options: {
                                            enableSourcing: false,
                                            ignoreMandatoryFields: true
                                        }
                                    });
                                } else if (invResponse.code == '400') {
                                    var invRequestBody = JSON.parse(invResponse.body);
                                    log.debug('invRequestBody', invRequestBody);

                                    record.submitFields({
                                        type: record.Type.INVOICE,
                                        id: invoiceId,
                                        values: {
                                            custbody_amz_bill_message: invRequestBody["o:errorDetails"],
                                        },
                                        options: {
                                            enableSourcing: false,
                                            ignoreMandatoryFields: true
                                        }
                                    });
                                }
                                else {
                                    var errRec = record.create({ type: 'customrecord_amz_customer_connection_err' });
                                    errRec.setValue('custrecord_amz_response_error_msg', JSON.parse(invResponse.body));
                                    errRec.setValue('custrecord_amz_transaction_date', new Date());
                                    errRec.setValue('custrecord_amz_customer_main', invoiceID);
                                    errRec.save();
                                }

                                redirect.toRecord({
                                    type: record.Type.INVOICE,
                                    id: invoiceId,
                                });

                            }





                    }
                }


            } catch (ex) {
                log.error(ex.name, ex.message);
                record.submitFields({
                    type: record.Type.INVOICE,
                    id: invoiceID,
                    values: {
                        custbody_amz_invoice_error: ex.message,
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });


            }
        }

        function createJSONDateFromInvoiceFormPO(itemData, invRec) {
            try {
                var invRec = invRec;
                var itemData = itemData;
                var totalInvamount = invRec.getValue('total');
                var transtionNumber = invRec.getValue('tranid');
                var lineCount = invRec.getLineCount('item');
                log.debug('lineCount', lineCount);
                var items = [];
                var invoiceData = {
                    tranid: transtionNumber,
                    memo: transtionNumber,
                    item: { items }
                };

                var amountRemaining = totalInvamount;
                log.debug('amountRemaining', amountRemaining);

                for (var i = 0; i < lineCount; i++) {
                    var itemName = invRec.getSublistValue('item', 'custcol_amz_targeted_system_item', i);
                    log.debug('itemName', itemName);
                    for (var j = 0; j < itemData.length; j++) {
                        var item_name = itemData[j].itemid;
                        log.debug('item_name', item_name);
                        if (itemName == item_name) {
                            items.push({
                                orderline: parseInt(itemData[j].linesequencenumber),
                                quantity: invRec.getSublistValue('item', 'quantity', i),
                                amount: invRec.getSublistValue('item', 'amount', i),
                                item: itemData[j].item
                            });
                        } else {
                            if (!itemData[j].closedate) {
                                items.push({
                                    orderline: parseInt(itemData[j].linesequencenumber),
                                    quantity: 0
                                });
                            }

                        }
                    }
                }

                /* for (var i = 0; i < itemData.length; i++) {
                     var line = itemData[i];
                     var quantity = line.quantity;
                     var quantityBilled = line.quantitybilled;
                     var rate = line.rate;
                     var orderline = parseInt(line.linesequencenumber);
 
                     var remainingQuantity = quantity - quantityBilled;
                     var remainingAmount = remainingQuantity * rate;
 
                     log.debug('Line ' + orderline, { remainingQuantity, remainingAmount, amountRemaining });
                     if (remainingQuantity > 0) {
                         if (remainingAmount >= amountRemaining) {
                             var calculatedQuantity = parseFloat(amountRemaining) / rate;
                             log.debug('quantity', calculatedQuantity);
                             items.push({
                                 orderline: orderline,
                                 quantity: calculatedQuantity,
                             });
                             // Fill all remaining lines with 0 quantity and 0 amount
                             for (var j = i + 1; j < itemData.length; j++) {
                                 items.push({
                                     orderline: parseInt(itemData[j].linesequencenumber),
                                     quantity: 0
                                 });
                             }
 
                             break;
 
                         } else if (remainingAmount <= amountRemaining) {
                             items.push({
                                 orderline: orderline,
                                 quantity: remainingQuantity,
                             });
                             amountRemaining = amountRemaining - remainingAmount;
                             if (amountRemaining == "0") {
                                 break
                             }
 
                         }
                     }
 
 
 
                 }*/
                log.debug('invoiceData', invoiceData);

                return invoiceData;
            } catch (ex) {
                log.error(ex.name, ex);
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
                var nonce = generateNonce();//[...Array(32)].map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62))).join('');
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
                var baseString = https_method + '&' + encodeURIComponent(BaseUrl).replace('!', '%21') + '&' + encodedparamString;
                log.debug('baseString', baseString);
                var signingKey = consumer_secret + '&' + token_secret;
                log.debug('signingKey', signingKey);
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
                //log.debug('hmac', hmac);
                var signature = hmac.digest({
                    outputEncoding: encode.Encoding.BASE_64
                });

                //log.debug('Signature', signature);
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
                //log.debug('oauthHeader', oauthHeader);

                return oauthHeader;
            } catch (ex) {
                log.error('generateOAuthHeader Error', ex);
                return '';
            }
        }

        function createJSONFromInvoice(customrecord_amz_customer_credentialsSearchObj, poQueryURL, invRec) {
            try {
                var invRec = invRec;
                var customrecord_amz_customer_credentialsSearchObj = customrecord_amz_customer_credentialsSearchObj;

                var https_method = "POST";
                var poQueryURL = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_po_end_point');
                var token_id = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_token_id');
                var token_secret = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_token_secret');
                var consumer_key = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_consumer_key');
                var consumer_secret = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_cinsumer_secret');
                var realm = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_account_id');
                var secretKey = customrecord_amz_customer_credentialsSearchObj[0].getValue('custrecord_amz_secret_key_id');
                var poQueryURL = poQueryURL;


                var items = [];
                var vendorId, vendorLocation;
                if (invRec.getText('entity')) {
                    var oauthHeader = generateOAuthHeader(poQueryURL, https_method, consumer_key, consumer_secret, token_id, token_secret, realm,secretKey);
                    var vendorData = {
                        "q": "SELECT id, entityid, companyname FROM vendor WHERE entityid  ='" + invRec.getText('entity') + "'"
                    };

                    var vendorResponse = https.post({
                        url: poQueryURL,
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': '*/*',
                            'Prefer': 'transient',
                            'Authorization': oauthHeader
                        },
                        body: JSON.stringify(vendorData)
                    });
                    log.debug('Vendorresponse', vendorResponse);
                    if (vendorResponse.code == '200') {
                        var responseBody = JSON.parse(vendorResponse.body);
                        var entityitems = responseBody.items;
                        log.debug('entityitems', entityitems);
                        vendorId = entityitems.length > 0 ? entityitems[0].id : '';

                    }

                }

                if (invRec.getText('location')) {
                    var oauthHeader = generateOAuthHeader(poQueryURL, https_method, consumer_key, consumer_secret, token_id, token_secret, realm,secretKey);
                    var locationData = {
                        "q": "SELECT id FROM location WHERE name  ='" + invRec.getText('location') + "'"
                    };

                    var location_response = https.post({
                        url: poQueryURL,
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': '*/*',
                            'Prefer': 'transient',
                            'Authorization': oauthHeader
                        },
                        body: JSON.stringify(locationData)
                    });
                    log.debug('location_response', location_response);
                    if (location_response.code == '200') {
                        var responseBody = JSON.parse(location_response.body);
                        var locationitems = responseBody.items;
                        log.debug('items', locationitems);
                        vendorLocation = locationitems.length > 0 ? locationitems[0].id : '';
                    }
                }
                var invoiceData = {
                    entity: vendorId,
                    tranid: invRec.getValue('trainid'),
                    memo: invRec.getValue('memo'),
                    location: vendorLocation,
                    item: { items }
                };

                var lineCount = invRec.getLineCount('item');
                for (var i = 0; i < lineCount; i++) {
                    var itemName = invRec.getSublistValue('item', 'custcol_amz_targeted_system_item', i);
                    log.debug('itemName', itemName);
                    var itemid;

                    if (itemName) {
                        var oauthHeader = generateOAuthHeader(poQueryURL, https_method, consumer_key, consumer_secret, token_id, token_secret, realm,secretKey);
                        var itemData = {
                            "q": "SELECT id FROM item WHERE itemid  ='" + itemName + "'"
                        };

                        var item_response = https.post({
                            url: poQueryURL,
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': '*/*',
                                'Prefer': 'transient',
                                'Authorization': oauthHeader
                            },
                            body: JSON.stringify(itemData)
                        });
                        log.debug('item_response', item_response);
                        if (item_response.code == '200') {
                            var responseBody = JSON.parse(item_response.body);
                            var itemsData = responseBody.items;
                            log.debug('items', itemsData);
                            itemid = itemsData.length > 0 ? itemsData[0].id : '';

                            items.push({
                                item: itemid,
                                quantity: invRec.getSublistValue('item', 'quantity', i),
                                rate: invRec.getSublistValue('item', 'rate', i),
                                amount: invRec.getSublistValue('item', 'amount', i),
                            });
                        }

                    }


                }
                log.debug('invoiceData', invoiceData);
                return invoiceData;

            } catch (ex) {
                log.error(ex.name, ex.message);
            }
        }
        function generateNonce(length = 32) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            return [...Array(length)].map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
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

        return {
            getInputData, map,
            reduce,
            summarize
        }

    });