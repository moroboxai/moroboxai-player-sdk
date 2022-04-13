import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import typescript from '@rollup/plugin-typescript';

const defaultNodeResolveConfig = {};
const nodeResolvePlugin = nodeResolve(defaultNodeResolveConfig);

const typescriptConfig = (outDir) => {
    return {
        "compilerOptions": {
            "module": "esnext",
            "esModuleInterop": true,
            "allowSyntheticDefaultImports": true,
            "target": "es6",
            "noImplicitAny": false,
            "moduleResolution": "node",
            "resolveJsonModule": true,
            "sourceMap": false,
            "declaration": true,
            "declarationDir": outDir,
            "outDir": outDir,
            "baseUrl": ".",
            "paths": {
                "*": ["node_modules/*", "src/types/*"]
            },
            "jsx": "react"
        },
        "include": ["src/**/*"],
        "exclude": []
    };    
}

const commonPlugins = (outDir) => [
  nodeResolvePlugin,
  typescript(typescriptConfig(outDir)),
  babel.default({
    presets: [['@babel/preset-env', { targets: '> 2%, not dead' }], '@babel/preset-react'],
    babelHelpers: 'bundled',
  }),
  commonjs(),
];

const developmentPlugins = (outDir) => [
  ...commonPlugins(outDir),
  replace({
    'process.env.NODE_ENV': JSON.stringify('development'),
    'preventAssignment': true
  }),
];

const productionPlugins = (outDir) => [
  ...commonPlugins(outDir),
  replace({
    'process.env.NODE_ENV': JSON.stringify('production'),
    'preventAssignment': true
  }),
  terser({ mangle: false }),
];

export default [
  {
    input: 'src/index.ts',
    output: {
      exports: 'named',
      dir: 'lib/cjs/',
      format: 'cjs',
      preserveModules: true,
    },
    plugins: commonPlugins('lib/cjs'),
  },
  {
    input: 'src/index.ts',
    output: {
      exports: 'named',
      dir: 'lib/es/',
      format: 'es',
      preserveModules: true,
    },
    plugins: commonPlugins('lib/es'),
  },
  {
    input: 'src/index.ts',
    output: {
      exports: 'named',
      file: 'lib/umd/moroboxai-player-sdk.js',
      format: 'umd',
      name: 'MoroboxAIPlayerSDK',
    },
    plugins: developmentPlugins('lib/umd'),
  },
  {
    input: 'src/index.ts',
    output: {
      exports: 'named',
      file: 'lib/umd/moroboxai-player-sdk.min.js',
      format: 'umd',
      name: 'MoroboxAIPlayerSDK',
    },
    plugins: productionPlugins('lib'),
  },
];