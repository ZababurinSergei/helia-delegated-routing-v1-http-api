import path from 'path';
import process from 'process';
import cors from 'cors';
import Enqueue from 'express-enqueue';
import compression from 'compression';
import * as dotenv from 'dotenv';
import express from 'express';
// import { createHelia } from 'helia'
import {setMaxListeners} from "@libp2p/interface";
import {CID} from "multiformats/cid";
import {PassThrough} from "node:stream";
import {peerIdFromCID} from "@libp2p/peer-id";
import {peerIdToRoutingKey} from "ipns";
import {ipnsValidator} from "ipns/validator";

import {getCustomHelia} from "./src/get-custom-helia.js";

let __dirname = process.cwd();
dotenv.config();

const helia = await getCustomHelia()
const MAX_PROVIDERS = 100

async function nonStreamingHandler(cid, helia, options) {
    const providers = []

    try {
        for await (const prov of helia.routing.findProviders(cid, options)) {
            providers.push({
                Schema: 'peer',
                ID: prov.id.toString(),
                Addrs: prov.multiaddrs.map(ma => ma.toString())
            })

            if (providers.length === MAX_PROVIDERS) {
                break
            }
        }
    } catch (err) {
        if (providers.length === 0) {
            throw err
        }
    }

    return {Providers: providers}
}

export const modules = async (app) => {
    console.log('helia: ');


    const ipns = {
        get: {
            method: 'GET',
            url: '/routing/v1/ipns/:name',
            schema: {
                // request needs to have a querystring with a `name` parameter
                params: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string'
                        }
                    },
                    required: ['name']
                }
            },
            handler: async (request, reply) => {
                let peerId;
                const controller = new AbortController();
                setMaxListeners(Infinity, controller.signal);
                request.on('close', () => {
                    controller.abort();
                });
                try {
                    // PeerId must be encoded as a Libp2p-key CID.
                    const {name: cidStr} = request.params;
                    const peerCid = CID.parse(cidStr);
                    peerId = peerIdFromCID(peerCid);
                } catch (err) {
                    console.error('could not parse CID from params', err);
                    reply.status(422)
                    reply.type('text/html')
                    return reply.send('Unprocessable Entity');
                }
                try {
                    const rawRecord = await helia.routing.get(peerIdToRoutingKey(peerId), {
                        signal: controller.signal
                    });

                    reply.set('Content-Type', 'application/vnd.ipfs.ipns-record')
                    return await reply.send(Buffer.from(rawRecord, 0, rawRecord.byteLength));
                    // one cannot simply send rawRecord https://github.com/fastify/fastify/issues/5118

                } catch (err) {
                    if (err.code === 'ERR_NOT_FOUND' || err.errors?.[0].code === 'ERR_NOT_FOUND') {
                        reply.status(404)
                        return reply.send('Record not found');
                    }
                    throw err;
                }
            }
        },
        put: {
            method: 'PUT',
            url: '/routing/v1/ipns/:name',
            schema: {
                // request needs to have a querystring with a `name` parameter
                params: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string'
                        }
                    },
                    required: ['name']
                }
            },
            handler: async (request, reply) => {
                console.log('!!!! ==================================== !!!!')
                let peerId;
                const controller = new AbortController();
                setMaxListeners(Infinity, controller.signal);
                request.on('close', () => {
                    controller.abort();
                });
                try {
                    // PeerId must be encoded as a Libp2p-key CID.
                    const {name: cidStr} = request.params;
                    const peerCid = CID.parse(cidStr);
                    peerId = peerIdFromCID(peerCid);
                } catch (err) {
                    console.error('could not parse CID from params', err);
                    reply.status(422)
                    reply.type('text/html')
                    return reply.send('Unprocessable Entity');
                }
                // @ts-expect-error request.body does not have a type
                const body = request.body;
                await ipnsValidator(peerIdToRoutingKey(peerId), body);
                await helia.routing.put(peerIdToRoutingKey(peerId), body, {
                    signal: controller.signal
                });
                return reply.send();
            }
        }
    }

    const peers = {
        method: 'GET',
        url: '/routing/v1/peers/:peerId',
        schema: {
            // request needs to have a querystring with a `name` parameter
            params: {
                type: 'object',
                properties: {
                    peerId: {
                        type: 'string'
                    }
                },
                required: ['peerId']
            }
        },
        handler: async (request, reply) => {
            let peerId;
            const controller = new AbortController();
            setMaxListeners(Infinity, controller.signal);
            request.on('close', () => {
                controller.abort();
            });
            try {
                const {peerId: cidStr} = request.params;
                const peerCid = CID.parse(cidStr);
                peerId = peerIdFromCID(peerCid);
            } catch (err) {
                console.error('could not parse CID from params', err);
                reply.status(422)
                reply.type('text/html')
                return reply.send('Unprocessable Entity');
            }
            const peerInfo = await helia.routing.findPeer(peerId, {
                signal: controller.signal
            });
            const peerRecord = {
                Schema: 'peer',
                ID: peerInfo.id.toString(),
                Addrs: peerInfo.multiaddrs.map(ma => ma.toString())
            };
            if (request.headers.accept?.includes('application/x-ndjson') === true) {
                const stream = new PassThrough();
                stream.push(JSON.stringify(peerRecord) + '\n');
                stream.end();
                // these are .thenables but not .catchables?
                reply.header('Content-Type', 'application/x-ndjson')
                return reply.send(stream);
            } else {
                return reply
                    .header('Content-Type', 'application/json')
                    .send({
                        Peers: [peerRecord]
                    });
            }
        }
    }

    const providers = {
        method: 'GET',
        url: '/routing/v1/providers/:cid',
        schema: {
            // request needs to have a querystring with a `name` parameter
            params: {
                type: 'object',
                properties: {
                    cid: {
                        type: 'string'
                    }
                },
                required: ['cid']
            }
        },
        handler: async (request, reply) => {
            try {
                let cid;
                const controller = new AbortController();
                setMaxListeners(Infinity, controller.signal);
                request.on('close', () => {
                    controller.abort();
                });
                try {
                    const {cid: cidStr} = request.params;
                    cid = CID.parse(cidStr);
                } catch (err) {
                    console.error('could not parse CID from params', err);
                    reply.status(422)
                    reply.type('text/html');
                    return reply.send('Unprocessable Entity');
                }
                // console.log('request.headers: ', request.headers)
                console.log('--------------------------------------', 'application/x-ndjson' in request.headers)
                if ('application/x-ndjson' in request.headers === true) {
                    const stream = new PassThrough();
                    // wait until we have the first result
                    const iterable = streamingHandler(cid, helia, {
                        signal: controller.signal
                    });
                    const result = await iterable.next();
                    // if we have a value, send the value in a stream
                    if (result.done !== true) {
                        stream.push(JSON.stringify(result.value) + '\n');
                        // iterate over the rest of the results
                        void Promise.resolve().then(async () => {
                            for await (const prov of iterable) {
                                stream.push(JSON.stringify(prov) + '\n');
                            }
                        })
                            .catch(err => {
                                console.error('could send stream of providers', err);
                            })
                            .finally(() => {
                                stream.end();
                            });
                        return reply
                            .header('Content-Type', 'application/x-ndjson')
                            .send(stream);
                    }
                } else {
                    const result = await nonStreamingHandler(cid, helia, {
                        signal: controller.signal
                    });
                    if (result.Providers.length > 0) {
                        return reply.header('Content-Type', 'application/json').send(result);
                    }
                }
                reply.send({status: 'not found'});
            } catch (e) {
                console.error(e)
            }
        }
    }

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

    app.use(await cors({credentials: true}));
    app.use(queue.getMiddleware());

    app.use((req, res, next) => {
        console.log(`gateway: ${req.method}: ${req.path}`);
        next();
    });

    app.put('/routing/v1/ipns/:name', async (req, res) => {
        await ipns.put.handler(req, res)
    })

    app.get('/routing/v1/ipns/:name', async (req, res) => {
        await ipns.get.handler(req, res)
    })

    app.get('/routing/v1/peers/:peerId', async (req, res) => {
        await peers.handler(req, res)
    })

    app.get('/routing/v1/providers/:cid', async (req, res) => {
        await providers.handler(req, res)
    })

    app.get(`/env.json`, async (req, res) => {
        res.status(200).sendFile(path.join(__dirname, 'env.json'))
    })

    app.get(`/env.mjs`, async (req, res) => {
        res.status(200).sendFile(path.join(__dirname, 'env.mjs'))
    })

    app.get(`/`, async (req, res) => {
        console.log('11111111111111111111111')
        return res.status(200).sendFile(path.join(__dirname, '/docs/index.html'));
    });

    app.get(`/*`, async (req, res) => {
        console.log('33333333333333333333')
        return res.status(200).sendFile(path.join(__dirname, '/docs/index.html'));
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