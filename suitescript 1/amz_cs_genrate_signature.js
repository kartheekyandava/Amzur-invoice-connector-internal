/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/https', 'N/url'],
    function (https, url) {

        function fieldChanged(context) {
          try{
            if (context.fieldId === 'otherrefnum') {

                var suiteletUrl = url.resolveScript({
                    scriptId: 'customscript_amz_su_generate_signature',
                    deploymentId: 'customdeploy_amz_su_generate_signature',
                    returnExternalUrl: false
                });

                var response = https.post({
                    url: suiteletUrl,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ action: 'triggerOAuthPost' })
                });

                alert('Response Code: ' + response.code + '\nResponse: ' + response.body);
            }
        }catch(ex){
            log.error(ex.name,ex.message);
        }
        }

        return {
            fieldChanged: fieldChanged
        };
    });
