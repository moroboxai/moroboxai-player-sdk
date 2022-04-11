import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
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
          type: 'module'
        },
    },
    experiments: {
        outputModule: true
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
};