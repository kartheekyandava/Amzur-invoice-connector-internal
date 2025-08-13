/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/runtime', 'N/format', 'N/log'],
/**
 * @param {record} record
 * @param {search} search
 * @param {runtime} runtime
 * @param {format} format
 * @param {log} log
 */
function(record, search, runtime, format, log) {
    const SPARAM_ACCOUNT = 'custscript_account';
    const SPARAM_JOURNAL = 'custscript_je';
    const SPARAM_FROMDATE = 'custscript_fromdate';
    const SPARAM_TODATE = 'custscript_todate';
    const SPARAM_CASHACCOUNT = 'custscript_cashaccount';

    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData() {
        log.debug({title: 'getInputData', details: 'getInputData'});

        let oCurrentScript = runtime.getCurrentScript();

        let idAccounts = oCurrentScript.getParameter({name: SPARAM_ACCOUNT});
        let idAccountsArr = idAccounts.split(", ").map(function(str) {
            return parseInt(str, 10);
        });
        log.audit({title: 'idAccounts', details: idAccounts});
        log.audit({title: 'idAccountsArr', details: idAccountsArr});

        let idJE = oCurrentScript.getParameter({name: SPARAM_JOURNAL});
        let idJEArr = idJE.split(", ").map(function(str) {
            return parseInt(str, 10);
        });
        log.audit({title: 'idAccounts', details: idAccounts});
        log.audit({title: 'idJEArr', details: idJEArr});

        let dFromDate = oCurrentScript.getParameter({name: SPARAM_FROMDATE});
        log.debug({title: 'dFromDate', details: dFromDate});

        let dToDate = oCurrentScript.getParameter({name: SPARAM_TODATE});
        log.debug({title: 'dToDate', details: dToDate});

        let sFromDate = null;
        let sToDate = null;

        if (dFromDate) {
            sFromDate = format.format({
                value: dFromDate, 
                type: format.Type.DATE
            });
        }

        if (dToDate) {
            sToDate = format.format({
                value: dToDate, 
                type: format.Type.DATE
            });
        }

        log.debug({title: 'sFromDate', details: sFromDate});
        log.debug({title: 'sToDate', details: sToDate});


        let aFilter = [
            ['account', search.Operator.ANYOF, idAccountsArr]
        ];

        if (idJE) {
            aFilter.push('AND');
            aFilter.push(['internalid', search.Operator.ANYOF, idJEArr])
        }

        if(sFromDate && !sToDate) {
            aFilter.push('AND');
            aFilter.push(['trandate', search.Operator.ONORAFTER, sFromDate]);
        } else if(sToDate && !sFromDate) {
            aFilter.push('AND');
            aFilter.push(['trandate', search.Operator.ONORBEFORE, sToDate]);
        } else if (sFromDate && sToDate){
            aFilter.push('AND');
            aFilter.push(['trandate', search.Operator.WITHIN, [sFromDate, sToDate]]);
        }
        
        return search.create({
            type: search.Type.JOURNAL_ENTRY,
            filters: aFilter,
            columns: [
                'lineuniquekey'
            ]
        });
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
        log.debug({title: 'map', details: 'map'});

        try {
            let recJE = JSON.parse(context.value);
            let idJE = recJE.id;
            log.debug({title: 'recJE', details: JSON.stringify(recJE)});
            
            let idLine = recJE.values['lineuniquekey'];
            context.write({
                key: idJE,
                value: idLine
            });
        } catch (ex) { 
            log.error({ title: 'MAP ERROR', details: ex }); 
        }
    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {
        log.debug({title: 'reduce', details: 'reduce'});

        
        let oCurrentScript = runtime.getCurrentScript();
        let idCashAccount = oCurrentScript.getParameter({name: SPARAM_CASHACCOUNT});
        try {
            let aValues = context.values;
            let idJE = context.key;
            
            let recJE = record.load({
                type: record.Type.JOURNAL_ENTRY,
                id: idJE,
                isDynamic: true
            });
            let fTotal = 0;

            let idChangeAmtLine = null;
            let idAccount = null;

            let fChangeAmtAmtCredit = null;

            let aValuesSort = aValues.sort((a, b) => (parseInt(b) - parseInt(a)));

            aValuesSort.forEach(function (oValueContext) {
                let idLineUniqueKey = JSON.parse(oValueContext);
                log.debug({title: 'idLine', details: idLineUniqueKey});

                let idLine = recJE.findSublistLineWithValue({
                    sublistId: 'line',
                    fieldId: 'lineuniquekey',
                    value: idLineUniqueKey
                });

                let fAmt = recJE.getSublistValue({
                    sublistId: 'line',
                    fieldId: 'debit',
                    line: idLine
                });
                log.debug({title: 'fAmt', details: fAmt});
                
                recJE.removeLine({
                    sublistId: 'line',
                    line: idLine
                });
                
                search.create({
                    type: search.Type.ACCOUNT,
                    filters: [
                        ['parent', search.Operator.ANYOF, idCashAccount], "OR", 
                        ['internalid', search.Operator.ANYOF, idCashAccount]
                    ]
                }).run().each((oResult) => {
                    idAccount = oResult.id;

                    idChangeAmtLine = recJE.findSublistLineWithValue({
                        sublistId: 'line',
                        fieldId: 'account',
                        value: idAccount
                    });

                    if (idChangeAmtLine == '-1'){
                        return true;
                    } else {
                        return false;
                    }
                });
                log.debug({title: 'idChangeAmtLine', details: idChangeAmtLine});

                if (idChangeAmtLine != '-1') {
                    fChangeAmtAmtCredit = recJE.getSublistValue({
                        sublistId: 'line',
                        fieldId: 'credit',
                        line: idChangeAmtLine
                    });
                    log.debug({title: 'fChangeAmtAmtCredit', details: fChangeAmtAmtCredit});


                    if (parseFloat(fChangeAmtAmtCredit) > 0) {
                        fTotal +=  parseFloat(fAmt);
                    } else {
                        if (fTotal == 0) {
                            let fChangeAmtAmt = recJE.getSublistValue({
                                sublistId: 'line',
                                fieldId: 'debit',
                                line: idChangeAmtLine
                            });
                            log.debug({title: 'fChangeAmtAmt', details: fChangeAmtAmt});
            
                            fTotal = parseFloat(fChangeAmtAmt) + parseFloat(fAmt);

                        } else {
                            fTotal +=  parseFloat(fAmt);
                        }
                    }
                }
                
                log.debug({title: 'fAmt', details: fAmt});
                log.debug({title: 'fTotal', details: fTotal});
            });

            if (parseFloat(fChangeAmtAmtCredit) > 0) {
                recJE.selectNewLine({
                    sublistId: 'line'
                });
            } else {
                recJE.selectLine({
                    sublistId: 'line',
                    line: idChangeAmtLine
                });
            }
            
            recJE.setCurrentSublistValue({
                sublistId: 'line',
                fieldId: 'account',
                value: idAccount,
            });
            
            recJE.setCurrentSublistValue({
                sublistId: 'line',
                fieldId: 'debit',
                value: fTotal.toFixed(2)
            });
        
            recJE.commitLine({
                sublistId: 'line'
            });
            recJE.save();
        } catch (ex) { 
            log.error({ title: 'REDUCE ERROR', details: ex }); 
        }
    }


    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {

    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
    
});
