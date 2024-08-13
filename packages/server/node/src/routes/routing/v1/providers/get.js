import { PassThrough } from 'node:stream';
import { setMaxListeners } from '@libp2p/interface';
import { CID } from 'multiformats/cid';
import path from "path";
const MAX_PROVIDERS = 100;
export default function getProvidersV1(fastify, helia) {
    const route = {
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
            let cid;
            const controller = new AbortController();
            setMaxListeners(Infinity, controller.signal);
            request.on('close', () => {
                controller.abort();
            });
            try {
                const { cid: cidStr } = request.params;
                cid = CID.parse(cidStr);
            }
            catch (err) {
                console.error('could not parse CID from params', err);
                reply.status(422)
                reply.type('text/html');
                return reply.send('Unprocessable Entity');
            }
            console.log('request.headers: ', request.headers)
            if (request.headers.accept?.includes('application/x-ndjson') === true) {
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
                            fastify.log.error('could send stream of providers', err);
                        })
                        .finally(() => {
                            stream.end();
                        });
                    return reply
                        .header('Content-Type', 'application/x-ndjson')
                        .send(stream);
                }
            }
            else {
                const result = await nonStreamingHandler(cid, helia, {
                    signal: controller.signal
                });
                if (result.Providers.length > 0) {
                    return reply.header('Content-Type', 'application/json').send(result);
                }
            }
            reply.callNotFound();
        }
    }

    fastify.get('/routing/v1/providers/:cid', async (req, res) => {
        await route.handler(req, res)
        // res.status(200).sendFile(path.join(__dirname, 'env.json'))
    })

    // fastify.route({
    //     method: 'GET',
    //     url: '/routing/v1/providers/:cid',
    //     schema: {
    //         // request needs to have a querystring with a `name` parameter
    //         params: {
    //             type: 'object',
    //             properties: {
    //                 cid: {
    //                     type: 'string'
    //                 }
    //             },
    //             required: ['cid']
    //         }
    //     },
    //     handler: async (request, reply) => {
    //         let cid;
    //         const controller = new AbortController();
    //         setMaxListeners(Infinity, controller.signal);
    //         request.raw.on('close', () => {
    //             controller.abort();
    //         });
    //         try {
    //             const { cid: cidStr } = request.params;
    //             cid = CID.parse(cidStr);
    //         }
    //         catch (err) {
    //             fastify.log.error('could not parse CID from params', err);
    //             return reply.code(422).type('text/html').send('Unprocessable Entity');
    //         }
    //         if (request.headers.accept?.includes('application/x-ndjson') === true) {
    //             const stream = new PassThrough();
    //             // wait until we have the first result
    //             const iterable = streamingHandler(cid, helia, {
    //                 signal: controller.signal
    //             });
    //             const result = await iterable.next();
    //             // if we have a value, send the value in a stream
    //             if (result.done !== true) {
    //                 stream.push(JSON.stringify(result.value) + '\n');
    //                 // iterate over the rest of the results
    //                 void Promise.resolve().then(async () => {
    //                     for await (const prov of iterable) {
    //                         stream.push(JSON.stringify(prov) + '\n');
    //                     }
    //                 })
    //                     .catch(err => {
    //                     fastify.log.error('could send stream of providers', err);
    //                 })
    //                     .finally(() => {
    //                     stream.end();
    //                 });
    //                 return reply
    //                     .header('Content-Type', 'application/x-ndjson')
    //                     .send(stream);
    //             }
    //         }
    //         else {
    //             const result = await nonStreamingHandler(cid, helia, {
    //                 signal: controller.signal
    //             });
    //             if (result.Providers.length > 0) {
    //                 return reply.header('Content-Type', 'application/json').send(result);
    //             }
    //         }
    //         reply.callNotFound();
    //     }
    // });
}
async function* streamingHandler(cid, helia, options) {
    let provs = 0;
    for await (const prov of helia.routing.findProviders(cid, options)) {
        yield {
            Schema: 'peer',
            ID: prov.id.toString(),
            Addrs: prov.multiaddrs.map(ma => ma.toString())
        };
        provs++;
        if (provs > MAX_PROVIDERS) {
            break;
        }
    }
}
async function nonStreamingHandler(cid, helia, options) {
    const providers = [];
    try {
        for await (const prov of helia.routing.findProviders(cid, options)) {
            providers.push({
                Schema: 'peer',
                ID: prov.id.toString(),
                Addrs: prov.multiaddrs.map(ma => ma.toString())
            });
            if (providers.length === MAX_PROVIDERS) {
                break;
            }
        }
    }
    catch (err) {
        if (providers.length === 0) {
            throw err;
        }
    }
    return { Providers: providers };
}
//# sourceMappingURL=get.js.map