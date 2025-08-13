/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

define(['N/record', 'N/log'], (record, log) => {

  const post = (requestBody) => {
    log.debug('requestBody', requestBody);
    const results = [];

    const bills = Array.isArray(requestBody) ? requestBody : [requestBody];
    log.debug('bills', bills);

    bills.forEach((billData, index) => {
      try {
        log.debug('billData', billData);

        const vendorBill = record.create({
          type: record.Type.VENDOR_BILL,
          isDynamic: true
        });

        vendorBill.setText({ fieldId: 'entity', text: billData.entity });
        vendorBill.setValue({ fieldId: 'trandate', value: new Date(billData.date) });
        vendorBill.setValue({ fieldId: 'memo', value: billData.tranId });
        vendorBill.setValue({ fieldId: 'usertotal', value: billData.total });
        vendorBill.setText({ fieldId: 'location', text: billData.location });

        if (billData.items && billData.items.length > 0) {
          billData.items.forEach((exp) => {
            log.debug('exp', exp);
            vendorBill.selectNewLine({ sublistId: 'item' });

            vendorBill.setCurrentSublistText({
              sublistId: 'item',
              fieldId: 'item',
              text: exp.item
            });

            vendorBill.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'quantity',
              value: exp.quantity
            });

            vendorBill.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'rate',
              value: exp.rate
            });

            vendorBill.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'amount',
              value: exp.amount
            });

            vendorBill.commitLine({ sublistId: 'item' });
          });
        }

        const billId = vendorBill.save();
        results.push({
          index: index + 1,
          success: true,
          billId: billId,
          invoiceid: billData.internalid || null
        });

      } catch (e) {
        results.push({
          index: index + 1,
          success: false,
          error: e.message,
          invoiceid: billData.internalid || null
        });
      }
    });

    return results;
  };

  return {
    post: post
  };
});
