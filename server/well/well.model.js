"use strict";

let ResponseJSON = require('../response');
let ErrorCodes = require('../../error-codes').CODES;
let hashDir = require('../utils/data-tool').hashDir;
let config = require('config');
let fs = require('fs');
let asyncEach = require('async/each');
let fsExtra = require('fs-extra');
let asyncSeries = require('async/series');
let checkPermisson = require('../utils/permission/check-permisison');


let wellHeaders = [
    {header: "NULL", value: -9999, unit: '', description: ""},
    {header: "WELL", value: '', unit: '', description: ""},
    {header: "UWI", value: '', unit: '', description: ""},
    {header: "API", value: '', unit: '', description: ""},
    {header: "LATI", value: '', unit: '', description: ""},
    {header: "LONG", value: '', unit: '', description: ""},
    {header: "E", value: '', unit: '', description: ""},
    {header: "N", value: '', unit: '', description: ""},
    {header: "KB", value: '', unit: '', description: ""},
    {header: "GL", value: '', unit: '', description: ""},
    {header: "ID", value: '', unit: '', description: ""},
    {header: "NAME", value: '', unit: '', description: ""},
    {header: "COMP", value: '', unit: '', description: ""},
    {header: "OPERATOR", value: '', unit: '', description: ""},
    {header: "AUTHOR", value: '', unit: '', description: ""},
    {header: "DATE", value: '', unit: '', description: ""},
    {header: "LOGDATE", value: '', unit: '', description: ""},
    {header: "SRVC", value: '', unit: '', description: ""},
    {header: "GDAT", value: '', unit: '', description: ""},
    {header: "LIC", value: '', unit: '', description: ""},
    {header: "CNTY", value: '', unit: '', description: ""},
    {header: "STATE", value: '', unit: '', description: ""},
    {header: "PROV", value: '', unit: '', description: ""},
    {header: "CTRY", value: '', unit: '', description: ""},
    {header: "LOC", value: '', unit: '', description: ""},
    {header: "FLD", value: '', unit: '', description: ""},
    {header: "PROJ", value: '', unit: '', description: ""},
    {header: "CODE", value: '', unit: '', description: ""},
    {header: "AREA", value: '', unit: '', description: ""},
    {header: "TYPE", value: '', unit: '', description: ""},
    {header: "STATUS", value: '', unit: '', description: ""},
    {header: "WTYPE", value: '', unit: '', description: ""},
    {header: "FLUID", value: '', unit: '', description: ""},
    {header: "BLOCK", value: '', unit: '', description: ""}
];

function createNewWell(wellInfo, done, dbConnection) {
    let Well = dbConnection.Well;
    Well.sync()
        .then(
            function () {
                let well = Well.build(wellInfo);
                well.save()
                    .then(function (well) {
                        wellHeaders.forEach(hd => {
                            dbConnection.WellHeader.create({
                                idWell: well.idWell,
                                header: hd.header,
                                value: hd.header === "NAME" || hd.header === "WELL" ? well.name : hd.value,
                                unit: hd.unit,
                                description: hd.description
                            });
                        });
                        done(ResponseJSON(ErrorCodes.SUCCESS, "Create new well success", well.toJSON()));
                    })
                    .catch(function (err) {
                        // console.log(err);
                        if (err.name === "SequelizeUniqueConstraintError") {
                            dbConnection.Well.findOne({
                                where: {
                                    name: wellInfo.name,
                                    idProject: wellInfo.idProject
                                }
                            }).then(w => {
                                done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Well's name already exists!", w));
                            });
                        } else {
                            done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, err.message, err.message));
                        }
                    });
            },
            function () {
                done(ResponseJSON(ErrorCodes.ERROR_SYNC_TABLE, "Connect to database fail or create table not success"));
            }
        )

}

function getWellList(payload, done, dbConnection) {
    let forward = true;
    try {
        let a = payload.forward.toString();
        forward = a === 'true';
    } catch (e) {
        forward = true;
    }
    console.log(forward);
    let start = payload.start || 0;
    let limit = payload.limit || 50;
    let match = payload.match || '';
    let match1 = '%' + match;
    let match2 = '%' + match + "%";
    let match3 = match + "%";
    const Op = require('sequelize').Op;
    let options = {
        where: {
            idProject: payload.idProject,
            name: {[Op.or]: [{[Op.like]: match1}, {[Op.like]: match2}, {[Op.like]: match3}]}
        },
        include: {
            model: dbConnection.WellHeader,
            attributes: ['header', 'value']
        },
        order: ['idWell'],
        limit: limit
    }
    if (forward) {
        options.where.idWell = {
            [Op.gt]: start
        }
    } else {
        options.where.idWell = {
            [Op.lt]: start
        },
            options.order = [['idWell', 'DESC']]
    }
    // dbConnection.Well.findAll(options).then(wells => {
    dbConnection.Well.findAll({
        where: {idProject: payload.idProject},
        include: {model: dbConnection.WellHeader}
    }).then(wells => {
        done(ResponseJSON(ErrorCodes.SUCCESS, "Successful", wells));
    }).catch(err => {
        done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Error", err.message));
    });
}

function editWell(wellInfo, done, dbConnection, username) {
    dbConnection.Well.findByPk(wellInfo.idWell).then(well => {
        if (well) {
            if (wellInfo.name && well.name.toUpperCase() !== wellInfo.name.toUpperCase()) {
                let oldWellName = well.name;
                well.name = wellInfo.name;
                well.idGroup = wellInfo.idGroup;
                well.updatedBy = wellInfo.updatedBy;
                well.save()
                    .then(function () {
                        dbConnection.Project.findByPk(well.idProject).then(function (project) {
                            dbConnection.Dataset.findAll({
                                where: {idWell: well.idWell},
                                paranoid: false
                            }).then(function (datasets) {
                                asyncEach(datasets, function (dataset, nextDataset) {
                                    dbConnection.Curve.findAll({
                                        where: {idDataset: dataset.idDataset},
                                        paranoid: false
                                    }).then(function (curves) {
                                        asyncEach(curves, function (curve, next) {
                                            let path = hashDir.createPath(process.env.BACKEND_CURVE_BASE_PATH || config.curveBasePath, username + project.name + oldWellName + dataset.name + curve.name, curve.name + '.txt');
                                            let newPath = hashDir.createPath(process.env.BACKEND_CURVE_BASE_PATH || config.curveBasePath, username + project.name + wellInfo.name + dataset.name + curve.name, curve.name + '.txt');
                                            let copy = fs.createReadStream(path).pipe(fs.createWriteStream(newPath));
                                            copy.on('close', function () {
                                                hashDir.deleteFolder(process.env.BACKEND_CURVE_BASE_PATH || config.curveBasePath, username + project.name + oldWellName + dataset.name + curve.name);
                                                next();
                                            });
                                            copy.on('error', function (err) {
                                                next(err);
                                            });
                                        }, function (err) {
                                            if (err) nextDataset(err);
                                            nextDataset();
                                        });
                                    });
                                }, function (err) {
                                    if (err) {
                                        if (err.name === "SequelizeUniqueConstraintError") {
                                            done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Well's name already exists"));
                                        } else {
                                            done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, err.message, err.message));
                                        }
                                    }
                                    done(ResponseJSON(ErrorCodes.SUCCESS, "Successful", well));
                                });
                            });
                        });
                    })
                    .catch(function (err) {
                        done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, err.message, err.name));
                    });
            } else {
                Object.assign(well, wellInfo).save()
                    .then(function () {
                        done(ResponseJSON(ErrorCodes.SUCCESS, "Edit Well success", well));
                    })
                    .catch(function (err) {
                        if (err.name === "SequelizeUniqueConstraintError") {
                            done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Well's name already exists"));
                        } else {
                            done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, err.message, err.message));
                        }
                    });
            }
        } else {
            done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "No well found!"));
        }
    }).catch(err => {
        done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Error", err.message));
    });
}

function deleteWell(wellInfo, done, dbConnection) {
    let Well = dbConnection.Well;
    Well.findByPk(wellInfo.idWell)
        .then(function (well) {
            well.setDataValue('updatedBy', wellInfo.updatedBy);
            well.destroy({permanently: true, force: true})
                .then(function () {
                    done(ResponseJSON(ErrorCodes.SUCCESS, "Well is deleted", well));
                })
                .catch(function (err) {
                    done(ResponseJSON(ErrorCodes.ERROR_DELETE_DENIED, err.message, err.message));
                })
        })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS, "Well not found for delete"));
        })
}

function getWellInfo(well, done, dbConnection) {
    let Well = dbConnection.Well;
    Well.findByPk(well.idWell, {include: [{model: dbConnection.Dataset}]})
        .then(function (well) {
            let wellObj = well.toJSON();
            asyncSeries([
                function (cb) {
                    dbConnection.Dataset.findAll({where: {idWell: well.idWell}}).then(datasets => {
                        let datasetArr = [];
                        asyncEach(datasets, function (dataset, nextDataset) {
                            let datasetObj = dataset.toJSON();
                            dbConnection.Curve.findAll({
                                where: {idDataset: dataset.idDataset},
                            }).then(curves => {
                                datasetObj.curves = curves;
                                datasetArr.push(datasetObj);
                                nextDataset();
                            });
                        }, function () {
                            cb(null, datasetArr);
                        });
                    });
                },
                function (cb) {
                    dbConnection.ZoneSet.findAll({
                        where: {idWell: well.idWell},
                        include: {model: dbConnection.Zone, include: {model: dbConnection.ZoneTemplate}}
                    }).then(zonesets => {
                        cb(null, zonesets);
                    });
                },
                function (cb) {
                    dbConnection.WellHeader.findAll({where: {idWell: well.idWell}}).then(headers => {
                        cb(null, headers);
                    });
                },
                function (cb) {
                    dbConnection.MarkerSet.findAll({
                        where: {idWell: well.idWell},
                        include: {model: dbConnection.Marker, include: {model: dbConnection.MarkerTemplate}}
                    }).then(markersets => {
                        cb(null, markersets);
                    });
                },
                function (cb) {
                    dbConnection.ImageSet.findAll({
                        where: {idWell: well.idWell},
                        include: {model: dbConnection.Image}
                    }).then(imagesets => {
                        cb(null, imagesets);
                    });
                }
            ], function (err, result) {
                wellObj.datasets = result[0];
                wellObj.zone_sets = result[1];
                wellObj.well_headers = result[2];
                wellObj.marker_sets = result[3];
                wellObj.image_sets = result[4];
                done(ResponseJSON(ErrorCodes.SUCCESS, "Successfull", wellObj));
            });
        })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS, "Well not found for get info"));
        });
}

function getWellFullInfo(well, done, dbConnection) {
    let Well = dbConnection.Well;
    Well.findByPk(well.idWell).then(function (well) {
        let wellObj = well.toJSON();
        asyncSeries([
            function (cb) {
                dbConnection.Dataset.findAll({where: {idWell: well.idWell}}).then(datasets => {
                    let datasetArr = [];
                    asyncEach(datasets, function (dataset, nextDataset) {
                        let datasetObj = dataset.toJSON();
                        dbConnection.Curve.findAll({
                            where: {idDataset: dataset.idDataset},
                        }).then(curves => {
                            datasetObj.curves = curves;
                            datasetArr.push(datasetObj);
                            nextDataset();
                        });
                    }, function () {
                        cb(null, datasetArr);
                    });
                });
            },
            function (cb) {
                dbConnection.ZoneSet.findAll({
                    where: {idWell: well.idWell},
                    include: {model: dbConnection.Zone}
                }).then(zonesets => {
                    cb(null, zonesets);
                });
            },
            // function (cb) {
            //     dbConnection.CombinedBox.findAll({where: {idWell: well.idWell}}).then(combined_boxes => {
            //         cb(null, combined_boxes);
            //     });
            // },
            function (cb) {
                dbConnection.WellHeader.findAll({where: {idWell: well.idWell}}).then(headers => {
                    cb(null, headers);
                });
            }
        ], function (err, result) {
            wellObj.datasets = result[0];
            wellObj.zone_sets = result[1];
            // wellObj.combined_boxes = result[2];
            wellObj.well_headers = result[2];
            done(ResponseJSON(ErrorCodes.SUCCESS, "Successfull", wellObj));
        });
    })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS, "Well not found for get info"));
        });
}

function getWellInfoByName(well, done, dbConnection) {
    let Well = dbConnection.Well;
    Well.find({
        where: {
            name: well.name,
            idProject: well.idProject
        },
        include: [{all: true}]
    }).then(function (well) {
        let wellObj = well.toJSON();
        asyncSeries([
            function (cb) {
                dbConnection.Dataset.findAll({where: {idWell: well.idWell}}).then(datasets => {
                    let datasetArr = [];
                    asyncEach(datasets, function (dataset, nextDataset) {
                        let datasetObj = dataset.toJSON();
                        dbConnection.Curve.findAll({
                            where: {idDataset: dataset.idDataset},
                        }).then(curves => {
                            datasetObj.curves = curves;
                            datasetArr.push(datasetObj);
                            nextDataset();
                        });
                    }, function () {
                        cb(null, datasetArr);
                    });
                });
            },
            function (cb) {
                dbConnection.ZoneSet.findAll({
                    where: {idWell: well.idWell},
                    include: {model: dbConnection.Zone}
                }).then(zonesets => {
                    cb(null, zonesets);
                });
            },
            function (cb) {
                dbConnection.WellHeader.findAll({where: {idWell: well.idWell}}).then(headers => {
                    cb(null, headers);
                });
            }
        ], function (err, result) {
            wellObj.datasets = result[0];
            wellObj.zone_sets = result[1];
            wellObj.well_headers = result[2];
            done(ResponseJSON(ErrorCodes.SUCCESS, "Successfull", wellObj));
        });
    })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS, "Well not found for get info"));
        });
}

async function exportToProject(info, done, dbConnection, username) {
    let idDesProject = info.idDesProject;
    let fullWellData = await dbConnection.Well.findByPk(info.idWell, {
        include: {
            model: dbConnection.Dataset,
            include: dbConnection.Curve
        }
    });
    let srcProject = await dbConnection.Project.findByPk(fullWellData.idProject);
    let desProject = await dbConnection.Project.findByPk(idDesProject);
    dbConnection.Well.create({
        name: fullWellData.name,
        topDepth: fullWellData.topDepth,
        bottomDepth: fullWellData.bottomDepth,
        step: fullWellData.step,
        idProject: idDesProject
    }).then(well => {
        asyncEach(fullWellData.datasets, function (dataset, nextDataset) {
            dbConnection.Dataset.create({
                name: dataset.name,
                datasetLabel: dataset.datasetLabel,
                datasetKey: dataset.datasetKey,
                idWell: well.idWell
            }).then(newDataset => {
                asyncEach(dataset.curves, function (curve, nextCurve) {
                    dbConnection.Curve.create({
                        name: curve.name,
                        unit: curve.unit,
                        idDataset: newDataset.idDataset,
                        idFamily: curve.idFamily
                    }).then(newCurve => {
                        let oldPath = hashDir.createPath(process.env.BACKEND_CURVE_BASE_PATH || config.curveBasePath, username + srcProject.name + fullWellData.name + dataset.name + curve.name, curve.name + '.txt');
                        let cpPath = hashDir.createPath(process.env.BACKEND_CURVE_BASE_PATH || config.curveBasePath, username + desProject.name + well.name + newDataset.name + newCurve.name, newCurve.name + '.txt');
                        fsExtra.copy(oldPath, cpPath, function (err) {
                            if (err) {
                                console.log("Copy file error ", err);
                            }
                            console.log("Done : ", cpPath);
                            nextCurve();
                        });
                    });
                }, function () {
                    nextDataset();
                    //done all curve
                });
            });
        }, function () {
            //done all dataset
            done(ResponseJSON(ErrorCodes.SUCCESS, "", well));
        });
    }).catch(err => {
        done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Well's name already exists", well));
        console.log(err);
    });
}

function getWellHeader(idWell, done, dbConnection) {
    dbConnection.WellHeader.findAll({where: {idWell: idWell}}).then(headers => {
        done(ResponseJSON(ErrorCodes.SUCCESS, "Successful", headers));
    });
}

function updateWellHeader(payload, done, dbConnection) {
    checkPermisson(payload.updatedBy, 'well.update', function (pass) {
        if (pass) {
            if (payload.idWellHeader) {
                dbConnection.WellHeader.findByPk(payload.idWellHeader).then((header) => {
                    Object.assign(header, payload).save().then((rs) => {
                        done(ResponseJSON(ErrorCodes.SUCCESS, "Successful", rs));
                    }).catch(err => {
                        console.log(err);
                        done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Error", err.message));
                    })
                });
            } else {
                dbConnection.WellHeader.findOrCreate({
                    where: {
                        idWell: payload.idWell,
                        header: payload.header
                    }, defaults: {
                        header: payload.header,
                        value: payload.value,
                        idWell: payload.idWell,
                        unit: payload.unit,
                        description: payload.description
                    }
                }).then(rs => {
                    if (rs[1]) {
                        done(ResponseJSON(ErrorCodes.SUCCESS, "Successful created new header", rs[0]));
                        //created
                    } else {
                        //found
                        rs[0].header = payload.header;
                        rs[0].value = payload.value;
                        rs[0].unit = payload.unit;
                        rs[0].description = payload.description;
                        rs[0].save().then(() => {
                            done(ResponseJSON(ErrorCodes.SUCCESS, "Successful update header", rs[0]));
                        }).catch(err => {
                            done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Error " + err.message, err));
                        });
                    }
                }).catch(err => {
                    done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Error " + err.message, err));
                });
            }
        } else {
            done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Well: Do not have permission", "Well: Do not have permission"));
        }
    })
}

function bulkUpdateWellHeader(headers, idWell, mode='override', done, dbConnection) {
    /*
    mode presents the way well headers will be updated
    mode = 'override': override all
    mode = 'ignore_if_exists': do not override if the headers already exist
    mode = 'no_delete': override the header if new value is not null
    default value for mode is 'override'
     */
    let response = [];

    asyncEach(headers, function (header, next) {
        dbConnection.WellHeader.findOrCreate({
            where: {idWell: idWell, header: header.header},
            defaults: {
                idWell: idWell,
                header: header.header,
                value: header.value,
                description: header.description,
                unit: header.unit
            }
        }).then(rs => {
            if (rs[1]) {
                //create
                response.push({header: rs[0], result: "CREATED"});
                next();
            } else if ((header.value.length > 0 && mode == 'no_delete')
                || mode == 'override'){
                // found
                // update the well property if new property has not null value
                rs[0].value = header.value;
                rs[0].unit = header.unit;
                rs[0].description = header.description;
                rs[0].save().then(() => {
                    response.push({header: header, result: "UPDATED"});
                    next();
                }).catch(err => {
                    response.push({header: header, result: "ERROR : " + err.message});
                    next();
                });
            }
            else {
                // ignore if the property of new well has the NULL value
                next()
            }
        }).catch(err => {
            console.log(err);
            response.push({header: header, result: "Error " + err});
            next();
        })
    }, function () {
        done(ResponseJSON(ErrorCodes.SUCCESS, "Successful", response));
    });
}

function deleteWellHeader(payload, done, dbConnection) {
    dbConnection.WellHeader.findByPk(payload.idWellHeader).then(wh => {
        if (wh) {
            wh.destroy().then(() => {
                done(ResponseJSON(ErrorCodes.SUCCESS, "Done", wh));
            }).catch(err => {
                done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, err.message, err));
            })
        } else {
            done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "No well header found by id"));
        }
    });
}

module.exports = {
    createNewWell: createNewWell,
    editWell: editWell,
    deleteWell: deleteWell,
    getWellInfo: getWellInfo,
    getWellInfoByName: getWellInfoByName,
    exportToProject: exportToProject,
    getWellHeader: getWellHeader,
    updateWellHeader: updateWellHeader,
    bulkUpdateWellHeader: bulkUpdateWellHeader,
    getWellList: getWellList,
    getWellFullInfo: getWellFullInfo,
    deleteWellHeader: deleteWellHeader
};