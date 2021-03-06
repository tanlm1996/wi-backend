var express = require('express');
var router = express.Router();
var crossPlotModel = require('./cross-plot.model');


router.post('/cross-plot/info', function (req, res) {
	crossPlotModel.getCrossPlotInfo(req.body, function (status) {
		res.send(status);
	}, req.dbConnection)

});
router.post('/cross-plot/new', function (req, res) {
	crossPlotModel.createNewCrossPlot(req.body, function (status) {
		res.send(status);
	}, req.dbConnection)
});
router.post('/cross-plot/edit', function (req, res) {
	crossPlotModel.editCrossPlot(req.body, function (status) {
		res.send(status);
	}, req.dbConnection)
});
router.delete('/cross-plot/delete', function (req, res) {
	crossPlotModel.deleteCrossPlot(req.body, function (status) {
		res.send(status);
	}, req.dbConnection)
});
router.post('/cross-plot/duplicate', function (req, res) {
	crossPlotModel.duplicateCrossplot(req.body, function (status) {
		res.send(status);
	}, req.dbConnection);
});
router.post('/cross-plot/list', function (req, res) {
	crossPlotModel.listCrossPlot(req.body, function (status) {
		res.send(status)
	}, req.dbConnection);
});

module.exports = router;
