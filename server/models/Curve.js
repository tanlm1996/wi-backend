module.exports = function (sequelize, DataTypes) {
    return sequelize.define('curve',{
        idCurve:{
            type:DataTypes.INTEGER,
            autoIncrement:true,
            primaryKey:true
        },
        name:{
            type:DataTypes.STRING(50),
            allowNull:false
        },
        dataset:{
            type:DataTypes.STRING(250),
            allowNull:false
        },
        family:{
            type:DataTypes.STRING(250),
            allowNull:false
        },
        unit:{
            type:DataTypes.STRING(250),
            allowNull:false
        },

        iniValue:{
            type:DataTypes.STRING(250),
            allowNull:false
        }
    });
};
