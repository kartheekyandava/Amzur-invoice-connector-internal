/**
*@NApiVersion 2.x
*@NScriptType Suitelet
*/
define(['N/ui/serverWidget', 'N/crypto', 'N/encode', 'N/runtime','N/record'],
function(ui, crypto, encode,runtime,record)
{
function onRequest(option)
{
if(option.request.method == 'GET')
{
var form = ui.createForm({
title: 'My credential form'
});

var field = form.addSecretKeyField({
id : 'mycredential',
label : 'Credential',
restrictToScriptIds : runtime.getCurrentScript().id,
restrictToCurrentUser : false
}).maxLength = 200;
field.defaultValue = 'ZFNbooKXMZefh97tr29N';
form.addSubmitButton();
option.response.writePage(form);


}
else
{

var form = ui.createForm({
title: 'My credential form'
});
var inputString = "YWJjZGVmZwo=";
var myGuid = option.request.parameters.mycredential;
log.debug("myGuid",myGuid);

var objRecord = record.create({
type: 'customrecord173',
isDynamic: true
});

objRecord.setValue({
fieldId: 'name',
value: myGuid
});
objRecord.setValue({
fieldId: 'custrecord12',
value: myGuid
});

var GUIDRec = objRecord.save();

// Create the key
var sKey = crypto.createSecretKey({
guid : myGuid,
encoding : encode.Encoding.UTF_8
});

try{
var hmacSHA256 = crypto.createHmac({
algorithm : 'SHA256',
key: sKey
});

hmacSHA256.update({
input : inputString,
inputEncoding : encode.Encoding.BASE_64
});

var digestSHA256 = hmacSHA256.digest({
outputEncoding : encode.Encoding.HEX
});
log.debug("digest",digestSHA256);

}
catch(e){
log.error(e.name);
}
option.response.write(digestSHA256);

}
}
return{
onRequest : onRequest
};
});