const path = require('path');

module.exports = {
    context: path.resolve(__dirname, 'src'),
    entry: './index.ts',
    mode: 'production',
    module: {
        rules: [{
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/
        }]
    },
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'lib'),
        library: {
          type: 'umd',
          name: 'MoroboxAIPlayerSDK',
        },
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
};