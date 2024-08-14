import * as esbuild from 'esbuild'
import fs from "fs"
import { copy } from 'esbuild-plugin-copy';
import cssModulesPlugin from "esbuild-css-modules-plugin";
import { polyfillNode } from "esbuild-plugin-polyfill-node";
import aliasPlugin from 'esbuild-plugin-path-alias';
import { glsl } from "esbuild-plugin-glsl";
import path from 'path';
import * as dotenv from 'dotenv'
dotenv.config()

const __dirname = path.join(path.dirname(process.argv[1]), './');

const isWatch = process.argv.includes("--watch");

let define = {}

for (const k in process.env) {
    if (k.startsWith('REACT_APP_') || k.startsWith('PUBLIC_URL') || k.startsWith('PORT')) {
        define[`process.env.${k}`] = JSON.stringify(process.env[k]);
    }
}

if (!fs.existsSync(path.resolve(__dirname, 'build'))) {
    fs.mkdirSync(path.resolve(__dirname, 'build'));
}

const entryPoints = [path.resolve(__dirname, './dist/src/index.js')]
const outdir = path.resolve(__dirname, 'build')
const outfile = path.resolve(__dirname, 'build/index.mjs')

console.time("⚡ [esbuild] Done");
try {
    const buildParams = {
        entryPoints: entryPoints,
        bundle: true,
        metafile: true,
        outfile: outfile,
        format: "esm",
        color: true,
        minify: true,
        sourcemap: true,
        mainFields : [ 'module' , 'main' ],
        plugins: [
            glsl({
                minify: true
            }),
            aliasPlugin({
                '@src': path.resolve(__dirname, './src')
            }),
            polyfillNode({
                process: true,
                buffer: true,
                define
            })
        ]
    }

    let result = await esbuild.build(buildParams)
    console.log('BUILD: SUCCESS', result)
    console.timeEnd("⚡ [esbuild] Done")
} catch (e) {
    console.timeEnd("⚡ [esbuild] Done")
    console.log('nk-error',e)
    process.exit(1)
}