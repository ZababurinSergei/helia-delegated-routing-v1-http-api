import { PassThrough } from 'node:stream';
import { setMaxListeners } from '@libp2p/interface';
import { peerIdFromCID } from '@libp2p/peer-id';
import { CID } from 'multiformats/cid';
export default function getPeersV1(fastify, helia) {
    const route = {
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
                const { peerId: cidStr } = request.params;
                const peerCid = CID.parse(cidStr);
                peerId = peerIdFromCID(peerCid);
            }
            catch (err) {
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
            }
            else {
                return reply
                    .header('Content-Type', 'application/json')
                    .send({
                        Peers: [peerRecord]
                    });
            }
        }
    }

    fastify.get('/routing/v1/peers/:peerId', async (req, res) => {
        await route.handler(req, res)
        // res.status(200).sendFile(path.join(__dirname, 'env.json'))
    })
    // fastify.route();
}
//# sourceMappingURL=get.js.map