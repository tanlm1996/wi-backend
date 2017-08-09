module.exports.exportData= function (inputStream,cbForResult,option) {
    XLSX = require('xlsx');
    var fs = require('fs');
    var tempfile = require('tempfile')('.xlsx');


    var arrData = [];
    var lineReader = require('readline').createInterface({
        // input: require('fs').createReadStream('ECGR.txt')
        input: inputStream
    });


    lineReader.on('line', function (line) {
        var arrXY = line.split(/\s+/g).slice(1, 2);
        arrData.push(arrXY);
    });
    lineReader.on('close', function () {
        var ws = XLSX.utils.aoa_to_sheet(arrData);
        var wb = {SheetNames: [], Sheets: {}};
        wb.SheetNames.push("curve");
        wb.Sheets["curve"] = ws;
        XLSX.writeFile(wb, tempfile);
        cbForResult(200,tempfile);
    });
};
