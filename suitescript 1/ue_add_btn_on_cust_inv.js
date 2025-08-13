/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget', 'N/runtime','N/url'], function (serverWidget, runtime,url) {
    function beforeLoad(context) {
        var form = context.form;
        var type = context.type;
        var newRecord = context.newRecord;

        // Only show on view mode

        if (type === context.UserEventType.VIEW) {
            var recordType = newRecord.type;

            // Add button on Customer record
            if (recordType === 'customer') {
             
                form.addButton({
                    id: 'custpage_send_invoices',
                    label: 'Send Invoices',
                    functionName: 'onSendInvoicesClick'
                });
               form.clientScriptModulePath = 'SuiteScripts/amz_cs_send_invoices.js';
            }

            // Add button on Invoice record
            if (recordType === 'invoice') {
      
               var inv_status = newRecord.getValue('status');
               log.debug(inv_status);
      
               var inv_success = newRecord.getValue('custbody_amz_invoice_send_succ');
               log.debug(inv_success);

               var po_validation_chcek = newRecord.getValue('custbody_amz_po_validation_check');
               log.debug(po_validation_chcek);
               var poCheck = newRecord.getValue('otherrefnum');

          if(inv_status == "Open" && !inv_success && po_validation_chcek == '1' && poCheck){
                //log.debug('jhfcdj')
              var output = url.resolveScript({
        		    scriptId: 'customscript_amz_su_to_send_inv_cus_manu',
        		    deploymentId: 'customdeploy_amz_su_to_send_inv_cus_manu',
        		    params:{custom_invid : context.newRecord.id}
        		});
               form.clientScriptModulePath = 'SuiteScripts/amz_cs_send_invoices.js'; 
              
                form.addButton({
                    id: 'custpage_send_invoice',
                    label: 'Send Invoice',
                    functionName: 'onSendInvoiceClick'//'require([],function(){ function openPDF(){window.open("'+output+'","_self")};openPDF(); })'
                });
              }else if(inv_status == "Open" && !poCheck){
             var output = url.resolveScript({
        		    scriptId: 'customscript_amz_su_to_send_inv_cus_manu',
        		    deploymentId: 'customdeploy_amz_su_to_send_inv_cus_manu',
        		    params:{custom_invid : context.newRecord.id}
        		});
               form.clientScriptModulePath = 'SuiteScripts/amz_cs_send_invoices.js'; 
              
                form.addButton({
                    id: 'custpage_send_invoice',
                    label: 'Send Invoice',
                    functionName: 'onSendInvoiceClick'//'require([],function(){ function openPDF(){window.open("'+output+'","_self")};openPDF(); })'
                });
              }
          
            }
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
