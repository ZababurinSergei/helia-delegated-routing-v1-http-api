import { setMaxListeners } from '@libp2p/interface';
import { peerIdFromCID } from '@libp2p/peer-id';
import { peerIdToRoutingKey } from 'ipns';
import { ipnsValidator } from 'ipns/validator';
import { CID } from 'multiformats/cid';
import getRawBody from 'raw-body';
export default function putIpnsV1(fastify, helia) {
    fastify.addContentTypeParser('application/vnd.ipfs.ipns-record', function (request, payload, done) {
        getRawBody(payload)
            .then(buff => { done(null, buff); })
            .catch(err => { done(err); });
    });

    let route = {
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
            // @ts-expect-error request.body does not have a type
            const body = request.body;
            await ipnsValidator(peerIdToRoutingKey(peerId), body);
            await helia.routing.put(peerIdToRoutingKey(peerId), body, {
                signal: controller.signal
            });
            return reply.send();
        }
    }

    fastify.get('/routing/v1/ipns/:name', async (req, res) => {
        await route.handler(req, res)
        // res.status(200).sendFile(path.join(__dirname, 'env.json'))
    })
}
//# sourceMappingURL=put.js.map