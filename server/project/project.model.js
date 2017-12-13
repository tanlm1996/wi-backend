// var models = require('../models');
// var Project = models.Project;
// var Well = models.Well;
var ErrorCodes = require('../../error-codes').CODES;
const ResponseJSON = require('../response');
var asyncLoop = require('async/each');

function createNewProject(projectInfo, done, dbConnection) {
    var Project = dbConnection.Project;
    Project.sync()
        .then(function () {
            return Project.create({
                name: projectInfo.name,
                location: genLocationOfNewProject(),
                company: projectInfo.company,
                department: projectInfo.department,
                description: projectInfo.description
            });
        })
        .then(function (project) {
            done(ResponseJSON(ErrorCodes.SUCCESS, "Create new project success", project));
        })
        .catch(function (err) {
            done(ResponseJSON(ErrorCodes.ERROR_FIELD_EMPTY, "Create new Project " + err.name));
        });
};

function editProject(projectInfo, done, dbConnection) {
    var Project = dbConnection.Project;
    Project.findById(projectInfo.idProject)
        .then(function (project) {
            project.name = projectInfo.name;
            project.company = projectInfo.company;
            project.department = projectInfo.department;
            project.description = projectInfo.description;
            project.save()
                .then(function () {
                    done(ResponseJSON(ErrorCodes.SUCCESS, "Edit Project success", projectInfo));
                })
                .catch(function (err) {
                    done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, err.name));
                })
        })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS, "Project not found for edit"));
        })
}

function getProjectInfo(project, done, dbConnection) {
    var Project = dbConnection.Project;
    Project.findById(project.idProject)
        .then(function (project) {
            if (!project) throw "not exits";
            done(ResponseJSON(ErrorCodes.SUCCESS, "Get info Project success", project));
        })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS, "Project not found for getInfo"));
        });
}

function getProjectList(owner, done, dbConnection) {
    var Project = dbConnection.Project;
    Project.all()
        .then(function (projects) {
            done(ResponseJSON(ErrorCodes.SUCCESS, "Get List Project success", projects));
        }).catch(err => {
        console.log(err);
        done(ResponseJSON(ErrorCodes.INTERNAL_SERVER_ERROR, "NO_DATABASE"));
    });
}

function deleteProject(projectInfo, done, dbConnection) {
    var Project = dbConnection.Project;
    Project.findById(projectInfo.idProject)
        .then(function (project) {
            project.destroy()
                .then(function () {
                    done(ResponseJSON(ErrorCodes.SUCCESS, "Deleted", project));
                })
                .catch(function (err) {
                    done(ResponseJSON(ErrorCodes.ERROR_DELETE_DENIED, err.errors[0].message));
                })

        })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS, "Project not found for delete"));
        });
}

function getProjectFullInfo(project, done, dbConnection) {
    let idProject = project.idProject;
    let response = new Object();
    dbConnection.Project.findById(idProject, {
        include: [{
            model: dbConnection.Well,
            include: [{
                model: dbConnection.Dataset,
                include: [{
                    model: dbConnection.Curve,
                    include: [{
                        model: dbConnection.Family,
                        as: "LineProperty"
                    }]
                }]
            }, {
                model: dbConnection.Plot
            }, {
                model: dbConnection.CrossPlot
            }, {
                model: dbConnection.Histogram
            }, {
                model: dbConnection.CombinedBox
            }]
        }, {
            model: dbConnection.Groups
        }]
    }).then(project => {
        response = project.toJSON();
        asyncLoop(response.wells, function (well, next) {
            dbConnection.ZoneSet.findAll({
                where: {idWell: well.idWell},
                include: {model: dbConnection.Zone}
            }).then(zs => {
                zs = JSON.parse(JSON.stringify(zs));
                response.wells[response.wells.indexOf(well)].zonesets = zs;
                next();
            });
        }, function () {
            done(ResponseJSON(ErrorCodes.SUCCESS, "Get full info Project success", response));
        });
    });
}

function _getProjectFullInfo(project, done, dbConnection) {
    // console.log("GET FULL INFO ", project);
    var Project = dbConnection.Project;
    Project.findById(project.idProject, {
        include: [{
            model: dbConnection.Well,
            include: [{
                model: dbConnection.Dataset,
                include: [{
                    model: dbConnection.Curve,
                    include: [{
                        model: dbConnection.Family,
                        as: "LineProperty"
                    }]
                }]
            }, {
                model: dbConnection.Plot
            }, {
                model: dbConnection.CrossPlot
            }, {
                model: dbConnection.Histogram
            }, {
                model: dbConnection.ZoneSet,
                include: [{
                    model: dbConnection.Zone
                }]
            }, {
                model: dbConnection.CombinedBox
            }]
        }, {
            model: dbConnection.Groups
        }]
    })
        .then(function (project) {
            if (!project) throw "not exists";
            done(ResponseJSON(ErrorCodes.SUCCESS, "Get full info Project success", project));
        })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS, "Project not found for full info"));
        });
}

function genLocationOfNewProject() {
    return "";
}

module.exports = {
    createNewProject: createNewProject,
    editProject: editProject,
    getProjectInfo: getProjectInfo,
    getProjectList: getProjectList,
    deleteProject: deleteProject,
    getProjectFullInfo: getProjectFullInfo
};
