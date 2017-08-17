const express = require('express');
const router = express.Router();
var models = require('../models');
var bodyParser = require('body-parser');
var User = models.User;
var ResponseJSON = require('../response');
var ErrorCodes = require('../../error-codes').CODES;
var jwt = require('jsonwebtoken');

router.use(bodyParser.json());
router.post('/authenticate', function (req, res) {
    User.findOne({where: {userName: req.body.userName}})
        .then(function (user) {
            if (!user) {
                res.send(ResponseJSON(ErrorCodes.SUCCESS,"Authentiactation success"))
            }else {
                if (user.password!=req.body.password) {
                    res.send(ResponseJSON(ErrorCodes.SUCCESS,"Wrong password. Authenticate fail"))
                }else {
                    var token = jwt.sign(req.body, 'secretKey', {expiresIn: '1h'});
                    res.send(ResponseJSON(ErrorCodes.SUCCESS, "Success",token));
                }
            }
        });

});
