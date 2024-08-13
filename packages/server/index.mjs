import path from 'path';
import process from 'process';
import cors from 'cors';
import Enqueue from 'express-enqueue';
import compression from 'compression';
import * as dotenv from 'dotenv';
import express from 'express';
import { createDelegatedRoutingV1HttpApiServer } from './node/src/index.js'
import { createHelia } from 'helia'

let __dirname = process.cwd();
dotenv.config();

export const modules = async (app) => {
    console.log('__dirname', __dirname);
    const helia = await createHelia()

    let whitelist = ["*"]

    let corsOptions = {
        origin: function (origin, callback) {
            if (whitelist.indexOf(origin) !== -1 || whitelist.includes('*')) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        }
    };

    app.use(compression());
    app.use(express.json());

    const queue = new Enqueue({
        concurrentWorkers: 4,
        maxSize: 200,
        timeout: 30000
    });

    app.use(await cors({ credentials: true }));
    app.use(queue.getMiddleware());

    app.use((req, res, next) => {
        console.log(`gateway: ${req.method}: ${req.path}`);
        next();
    });

    createDelegatedRoutingV1HttpApiServer(helia, app)

    app.get(`/env.json`, async (req, res) => {
        res.status(200).sendFile(path.join(__dirname, 'env.json'))
    })

    app.get(`/env.mjs`, async (req, res) => {
        res.status(200).sendFile(path.join(__dirname, 'env.mjs'))
    })

    app.get(`/`, async (req, res) => {
        res.status(200).sendFile(path.join(__dirname, '/docs/index.html'));
    });

    app.get(`/*`, async (req, res) => {
        res.status(200).sendFile(path.join(__dirname, '/docs/index.html'));
    });

    app.use(express.static(`${__dirname}/docs`));

    app.post(`/*`, async (req, res) => {
        console.log('==== POST ====', req.path);
    });

    app.put(`/*`, async (req, res) => {
        console.log('==== PUT ====', req.path);
    });

    app.delete(`/*`, async (req, res) => {
        console.log('==== DELETE ====', req.path);
    });

    app.use(queue.getErrorMiddleware());

    return app
}

export default {
    description: 'server welcomebook'
};