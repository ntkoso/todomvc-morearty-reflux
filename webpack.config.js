var webpack = require('webpack');

module.exports = {
    entry: [
        './js/app'
    ],
    output: {
        path: __dirname,
        filename: './build/bundle.js'
    },
    plugins: [
    ],
    resolve: {
        extensions: ['', '.js']
    },
    module: {
        loaders: [
            { test: /\.js$/, loaders: ['jsx'] }
        ]
    }
};
