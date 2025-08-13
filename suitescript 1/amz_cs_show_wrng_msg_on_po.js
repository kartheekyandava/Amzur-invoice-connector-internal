/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/ui/message'], function(message) {

    var warningMsg;

    function pageInit(context) {
       
    }

    function fieldChanged(context) {
        
    }

  function saveRecord(context) {
    try{
        var currentRecord = context.currentRecord;
        var poNumber = currentRecord.getValue({ fieldId: 'otherrefnum' });

        if (!poNumber) {
            alert('Missing PO Number');
        }

        return true;
    }catch(ex){
      log.error(ex.name,ex.message);
    }
    }

    return {
        pageInit: pageInit,
        //fieldChanged: fieldChanged,
        saveRecord: saveRecord
    };
});
