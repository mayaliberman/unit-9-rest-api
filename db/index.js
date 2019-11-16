'use strict';
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'fsjstd-restapi.db'
});
const models = {}; 
(async () => {
    await sequelize.authenticate();

    try {
        console.log('Connection successful');
        fs
            .readdirSync(path.join(__dirname, 'models'))
            .forEach((file) => {
                console.log(`Importing database model file ${file}`);
                const model = sequelize.import(path.join(__dirname, 'models', file));
                models[model.name] = model;
            });

        Object.keys(models).forEach((modelName) => {
            if (models[modelName].associate) {
                console.log(`Configuring the association for the ${modelName} model...`);
                models[modelName].associate(models);
            }
        });
    } catch (err) {
        console.log('Sorry there was a problem connecting')
    }

})();

// sequelize
//     .authenticate()
//     .then(() => {
//         console.log('Connection has been established successfully.');
       

//     })
//     .catch(err => {
//         console.error('Unable to connect to the database:', err);
//     });

  

module.exports = {
    sequelize,
    Sequelize,
    models,
}