/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/https', 'N/record', 'N/crypto', 'N/search', 'N/encode', 'N/redirect'],

    (https, record, crypto, search, encode, redirect) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var invoiceId;
            try {
                log.debug('scriptContext', scriptContext);
                var request = scriptContext.request;
                var response = scriptContext.response;
                var params = request.parameters;

                if (request.method === 'GET' && params.recordId) {
                    invoiceId = params.recordId;
                    var invRec = record.load({ type: record.Type.INVOICE, id: invoiceId });
                    log.debug('invRec', invRec);
                    var invtotal = invRec.getValue('total');

                    var customer = invRec.getValue('entity');
                    log.debug('customer', customer);
                    var poNumber = invRec.getValue('otherrefnum');
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
                                   search.createColumn({ name: "custrecord_amz_secret_key_id" })
                                   


                                ]
                        }).run().getRange(0, 1);
                        if (customrecord_amz_customer_credentialsSearchObj.length > 0) {
                            log.debug('customrecord_amz_customer_credentialsSearchObj', customrecord_amz_customer_credentialsSearchObj);
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
                            if (poNumber) {
                                var oauthHeader = generateOAuthHeader(poQueryURL, https_method, consumer_key, consumer_secret, token_id, token_secret, realm,secretKey);
                                var data = {
                                    "q": "SELECT transaction.id,item.itemid,item,transactionline.closedate,transaction.amountunbilled,transactionline.linesequencenumber,transaction.status,transactionline.quantity,transactionline.rate,transactionline.quantitybilled,transactionline.amount FROM transaction JOIN transactionline ON transaction.id = transactionline.transaction JOIN item ON transactionline.item = item.id WHERE recordtype = 'purchaseorder' AND tranid ='" + poNumber + "'"
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
                                        } else {
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
                                    } else {
                                        record.submitFields({
                                            type: record.Type.INVOICE,
                                            id: invoiceId,
                                            values: {
                                                custbody_amz_invoice_error: "There is no pending amount for this PO",
                                            },
                                            options: {
                                                enableSourcing: false,
                                                ignoreMandatoryFields: true
                                            }
                                        });
                                        redirect.toRecord({
                                            type: record.Type.INVOICE,
                                            id: invoiceId,
                                        });
                                    }

                                }
                            } else {
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

                }


            } catch (ex) {
                log.error(ex.name, ex.message);
                record.submitFields({
                    type: record.Type.INVOICE,
                    id: invoiceId,
                    values: {
                        custbody_amz_invoice_error: ex.message

                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
                redirect.toRecord({
                    type: record.Type.INVOICE,
                    id: invoiceId,
                });
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

        function createJSONDateFromInvoiceFormPO(itemData, invRec) {
            try {
                var invRec = invRec;
                var itemData = itemData;
                log.debug('itemData', itemData);
                log.debug('itemData', itemData.length);

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
                                item: itemData[j].item,
                            });
                        } else {
                            if (!itemData[j].closedate) {
                                items.push({
                                    orderline: parseInt(itemData[j].linesequencenumber),
                                    quantity: 0,
                                    rate: 0
                                });
                            }

                        }
                    }
                }

                /*var amountRemaining = totalInvamount;
                log.debug('amountRemaining', amountRemaining);

                for (var i = 0; i < itemData.length; i++) {
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
            } catch (e) {
                log.error('generateOAuthHeader Error', e);
                return '';
            }
        }
        function generateNonce(length = 32) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            return [...Array(length)].map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        }


        return { onRequest }

    });