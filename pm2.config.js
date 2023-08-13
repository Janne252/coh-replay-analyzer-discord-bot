const packageJson = require('./package.json')

module.exports = {
    apps: [{
        name: packageJson.name,
        script: packageJson.main,
        instances: 1,
        source_map_support: true,
        env_production: {
           NODE_ENV: "production"
        },
    }]
}
