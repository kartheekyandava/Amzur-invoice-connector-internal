/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * Universal Issue Ticket – supports **dynamic file attachments**
 */

/*
 * CHANGE LOG
 * ----------
 * 2025-06-23  CJ  Added dynamic file attachment support with a visible "+ Add another file" button
 *                using client script to show/hide up to MAX_ATTACHMENTS upload fields.
 */

define([
    'N/ui/serverWidget',
    'N/record',
    'N/email',
    'N/runtime',
    'N/file',
    'N/log'
],
function (serverWidget, record, email, runtime, file, log) {

    const MAX_ATTACHMENTS = 5;

    const DEPT_ADMIN_EMAILS = {
        'Warehouse': 'jahnavichandaka88@gmail.com',
        'Sales': 'sales.admin@swag.com',
        'Accounting': 'accounting.admin@swag.com',
        'Operations': 'operations.admin@swag.com',
        'IT/Technical': 'it.admin@swag.com',
        'Executive Management': 'exec.admin@swag.com',
        'Customer Support': 'support.admin@swag.com',
        'Marketing': 'marketing.admin@swag.com',
        'Other': 'sysadmin@swag.com'
    };

    function onRequest (context) {
        if (context.request.method === 'GET') {
            buildForm(context.response);
        } else {
            handlePost(context.request, context.response);
        }
    }

    function buildForm (response) {
        const form = serverWidget.createForm({ title: 'Universal Issue Ticket' });

        const fldEmpName = form.addField({ id: 'custpage_emp_name', type: serverWidget.FieldType.SELECT, label: 'Employee Name', source: 'employee' });
        fldEmpName.isMandatory = true;

        form.addField({ id: 'custpage_emp_id', type: serverWidget.FieldType.TEXT, label: 'Employee ID' });

        const fldEmpEmail = form.addField({ id: 'custpage_emp_email', type: serverWidget.FieldType.EMAIL, label: 'Employee Email' });
        fldEmpEmail.helpText = 'Required if the employee has a corporate email address.';

        const fldDept = form.addField({ id: 'custpage_department', type: serverWidget.FieldType.SELECT, label: 'Department' });
        ['Warehouse','Sales','Accounting','Operations','IT/Technical','Executive Management','Customer Support','Marketing','Other']
            .forEach(function (dept) { fldDept.addSelectOption({ value: dept, text: dept }); });
        fldDept.isMandatory = true;

        form.addField({ id: 'custpage_role', type: serverWidget.FieldType.TEXT, label: 'Role / Job Title' });

        const fldTitle = form.addField({ id: 'custpage_issue_title', type: serverWidget.FieldType.TEXT, label: 'Issue Title' });
        fldTitle.isMandatory = true;

        const fldDesc = form.addField({ id: 'custpage_issue_desc', type: serverWidget.FieldType.LONGTEXT, label: 'Issue Description' });
        fldDesc.isMandatory = true;

        const fldModule = form.addField({ id: 'custpage_app_module', type: serverWidget.FieldType.SELECT, label: 'Application / Module' });
        ['Warehouse Mobile System','Financial Module','Sales Module','Operations','Reports & Dashboards','HR/Payroll','General Access/Login Issues','Other']
            .forEach(function (mod) { fldModule.addSelectOption({ value: mod, text: mod }); });

        const fldPriority = form.addField({ id: 'custpage_priority', type: serverWidget.FieldType.SELECT, label: 'Priority' });
        [['Critical','1'],['High','2'],['Medium','3'],['Low','4']].forEach(function (arr) { fldPriority.addSelectOption({ value: arr[0], text: arr[0] }); });
        fldPriority.defaultValue = 'Medium';

        const fldDateTime = form.addField({ id: 'custpage_occurrence_dt', type: serverWidget.FieldType.DATETIMETZ, label: 'Date / Time of Occurrence' });
        fldDateTime.defaultValue = new Date();

        form.addField({
            id: 'custpage_attachment_note',
            type: serverWidget.FieldType.INLINEHTML,
            label: ' '
        }).defaultValue = `
            <div style="padding:10px 0;font-weight:bold;">Upload up to ${MAX_ATTACHMENTS} attachments:</div>
            <div id="attachment-container"></div>
            <button type="button" onclick="addAttachmentField()">+ Add another file</button>
            <script>
                let attachmentCount = 0;
                const max = ${MAX_ATTACHMENTS};
                function addAttachmentField() {
                    if (attachmentCount >= max) return;
                    attachmentCount++;
                    const div = document.createElement('div');
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.name = 'custpage_attachment_' + attachmentCount;
                    input.id = 'custpage_attachment_' + attachmentCount;
                    div.appendChild(input);
                    document.getElementById('attachment-container').appendChild(div);
                }
                document.addEventListener('DOMContentLoaded', addAttachmentField);
            </script>`;

        form.addField({ id: 'custpage_addl_comments', type: serverWidget.FieldType.LONGTEXT, label: 'Additional Comments' });

        form.addSubmitButton({ label: 'Submit Ticket' });

        response.writePage(form);
    }

    function handlePost (request, response) {
        const p = request.parameters;

        const ticketRec = record.create({ type: 'customrecord_universal_ticket', isDynamic: true });

        ticketRec.setValue({ fieldId: 'custrecord_emp_name',  value: p.custpage_emp_name  });
        ticketRec.setValue({ fieldId: 'custrecord_emp_id',    value: p.custpage_emp_id    });
        ticketRec.setValue({ fieldId: 'custrecord_emp_email', value: p.custpage_emp_email });
        ticketRec.setValue({ fieldId: 'custrecord_emp_dept',  value: p.custpage_department });
        ticketRec.setValue({ fieldId: 'custrecord_emp_role',  value: p.custpage_role       });
        ticketRec.setValue({ fieldId: 'custrecord_issue_title', value: p.custpage_issue_title });
        ticketRec.setValue({ fieldId: 'custrecord_issue_desc',  value: p.custpage_issue_desc  });
        ticketRec.setValue({ fieldId: 'custrecord_app_module',  value: p.custpage_app_module  });
        ticketRec.setValue({ fieldId: 'custrecord_priority',    value: p.custpage_priority    });
        ticketRec.setValue({ fieldId: 'custrecord_addl_comments', value: p.custpage_addl_comments });

        const ticketId = ticketRec.save();
        log.audit('Ticket Created', 'Ticket ID ' + ticketId);

        if (request.files) {
            Object.keys(request.files).forEach(function (fieldId) {
                if (fieldId.indexOf('custpage_attachment_') === 0) {
                    const uploader = request.files[fieldId];
                    if (uploader && uploader.size) {
                        try {
                            const fileId = saveAndAttachFile(uploader, ticketId);
                            log.debug('File attached', 'Field ' + fieldId + ' ➜ File ID ' + fileId);
                        } catch (e) {
                            log.error('File attach error (' + fieldId + ')', e);
                        }
                    }
                }
            });
        }

        const recipientEmail = DEPT_ADMIN_EMAILS[p.custpage_department] || DEPT_ADMIN_EMAILS['Other'];
      // Parameter on the script deployment: custscript_ticket_email_author
      const AUTHOR_FALLBACK = runtime.getCurrentScript().getParameter('custscript_author') || 3; // 3 = Administrator

      const authorId = runtime.getCurrentUser().id || 0;
      log.debug('user',runtime.getCurrentUser());
      log.debug('authorId',authorId);
      //var authorId = runtime.getCurrentUser().id || 0;     // mutable
   if (authorId <= 0) {                                 // 0 / –4 / null → public visitor
       authorId = AUTHOR_FALLBACK;                      // safe to overwrite
  }
      
      try {
            email.send({
                author: authorId,
                recipients: recipientEmail,
                subject: 'New Ticket #' + ticketId + ' – ' + p.custpage_issue_title,
                body: buildEmailBody(p, ticketId)
            });
        } catch (e) {
            log.error('Email Error', e);
        }

        const form = serverWidget.createForm({ title: 'Ticket Submitted' });
        form.addField({ id: 'custpage_conf_msg', type: serverWidget.FieldType.INLINEHTML, label: ' ' })
            .defaultValue = '<div style="font-size:14px;padding:16px;">Thank you! Your ticket <strong>#' + ticketId + '</strong> has been submitted successfully.</div>';
        response.writePage(form);
    }

    function saveAndAttachFile (uploader, ticketId) {
        const savedFile = file.create({
            name: uploader.name,
            fileType: uploader.fileType,
            contents: uploader.getContents(),
            folder: -15
        });
        const fileId = savedFile.save();

        record.attach({
            record: { type: 'file', id: fileId },
            to: { type: 'customrecord_universal_ticket', id: ticketId }
        });

        return fileId;
    }

    function buildEmailBody (p, ticketId) {
        return '<h3>New Universal Issue Ticket #' + ticketId + '</h3>' +
            '<p><strong>Employee:</strong> ' + p.custpage_emp_name + ' (' + p.custpage_emp_id + ')</p>' +
            '<p><strong>Email:</strong> ' + p.custpage_emp_email + '</p>' +
            '<p><strong>Department:</strong> ' + p.custpage_department + '</p>' +
            '<p><strong>Role:</strong> ' + p.custpage_role + '</p>' +
            '<p><strong>Title:</strong> ' + p.custpage_issue_title + '</p>' +
            '<p><strong>Description:</strong><br/>' + p.custpage_issue_desc + '</p>' +
            '<p><strong>Application / Module:</strong> ' + p.custpage_app_module + '</p>' +
            '<p><strong>Priority:</strong> ' + p.custpage_priority + '</p>' +
            '<p><strong>Date / Time:</strong> ' + p.custpage_occurrence_dt + '</p>' +
            (p.custpage_addl_comments ? ('<p><strong>Additional Comments:</strong><br/>' + p.custpage_addl_comments + '</p>') : '') +
            '<p><em>This message was sent automatically by the Universal Ticket Suitelet.</em></p>';
    }

    return { onRequest: onRequest };

});
