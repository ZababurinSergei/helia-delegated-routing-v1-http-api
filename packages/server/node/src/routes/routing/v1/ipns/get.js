import { setMaxListeners } from '@libp2p/interface';
import { peerIdFromCID } from '@libp2p/peer-id';
import { peerIdToRoutingKey } from 'ipns';
import { CID } from 'multiformats/cid';
export default function getIpnsV1(fastify, helia) {
    const route = {
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
                const { name: cidStr } = request.params;
                const peerCid = CID.parse(cidStr);
                peerId = peerIdFromCID(peerCid);
            }
            catch (err) {
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

            }
            catch (err) {
                if (err.code === 'ERR_NOT_FOUND' || err.errors?.[0].code === 'ERR_NOT_FOUND') {
                    reply.status(404)
                    return reply.send('Record not found');
                }
                throw err;
            }
        }
    }

    // fastify.route();

    fastify.get('/routing/v1/ipns/:name', async (req, res) => {
        await route.handler(req, res)
        // res.status(200).sendFile(path.join(__dirname, 'env.json'))
    })
}
//# sourceMappingURL=get.js.map