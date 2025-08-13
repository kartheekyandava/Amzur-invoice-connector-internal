/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/task', 'N/ui/serverWidget', 'N/ui/message'], function(task, serverWidget, message) {

    function onRequest(context) {
        const request = context.request;
        const response = context.response;

        if (request.method === 'GET') {
            const customerId = request.parameters.customerId;
          log.debug('customerId',customerId);

            const mrTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_amz_mr_to_send_bulk_invoice',
                deploymentId: 'customdeploy_amz_mr_cus_leve_invo_to_sen',
                params: {
                    custscript_amz_customer_id: customerId
                }
            });

            const taskId = mrTask.submit();

            // Show a confirmation message
            response.write(`<html><body>
                <h3>Map/Reduce task submitted! Task ID: ${taskId}</h3>
                <a href="/app/common/entity/custjob.nl?id=${customerId}">Go Back to Customer</a>
            </body></html>`);
        }
    }

    return {
        onRequest
    };
});
