/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */

define(['N/ui/message', 'N/https', 'N/url', 'N/currentRecord'], 
(message, https, url, currentRecord) => {
     function pageInit(context) {
    console.log('Page initialized');
  }
    let invBanner;

    function onSendInvoiceClick() {
       const rec = currentRecord.get();
        const recordId = rec.id;

        const suiteletUrl = url.resolveScript({
            scriptId: 'customscript_amz_su_to_send_inv_cus_manu',
            deploymentId: 'customdeploy_amz_su_to_send_inv_cus_manu',
            params: { recordId: recordId }
        });

        window.location.href = suiteletUrl;
    }

  function onSendInvoicesClick() {
        invBanner = message.create({
            title: 'Invoice Sending',
            message: 'Sending Invoice... please wait.',
            type: message.Type.CONFIRMATION
        });
        invBanner.show();

        const rec = currentRecord.get();
        log.debug('rec',rec);
        const customerId = rec.id;
    
        const suiteletUrl = url.resolveScript({
            scriptId: 'customscript_amz_su_trigger_mr_script', 
            deploymentId: 'customdeploy_amz_su_trigger_mr_script',
            params: {
                customerId: customerId
            }
        });

      https.get.promise({ url: suiteletUrl })
            .then(response => {
               setTimeout(() => {
                    if (invBanner) invBanner.hide();
                }, 5000);
                //alert('Invoice sent: ' + response.body);
            })
            .catch(error => {
                if (invBanner) invBanner.hide();
                alert('Error sending invoice: ' + error.message);
            });
    }


    return { pageInit, onSendInvoiceClick, onSendInvoicesClick };
});
