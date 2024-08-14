import { bitswap, trustlessGateway } from '@helia/block-brokers';
import { createHeliaHTTP } from '@helia/http';
import { delegatedHTTPRouting, httpGatewayRouting } from '@helia/routers';
import { FsBlockstore } from 'blockstore-fs';
import { LevelDatastore } from 'datastore-level';
import { createHelia } from 'helia';
import { DELEGATED_ROUTING_V1_HOST, FILE_BLOCKSTORE_PATH, FILE_DATASTORE_PATH, TRUSTLESS_GATEWAYS, USE_BITSWAP, USE_DELEGATED_ROUTING, USE_LIBP2P, USE_TRUSTLESS_GATEWAYS } from './constants.js';
import { getCustomLibp2p } from './get-custom-libp2p.js';
export async function getCustomHelia() {
    const datastore = await configureDatastore();
    if (USE_LIBP2P || USE_BITSWAP) {
        return createHelia({
            libp2p: await getCustomLibp2p({ datastore }),
            blockstore: await configureBlockstore(),
            datastore,
            blockBrokers: configureBlockBrokers(),
            routers: configureRouters()
        });
    }
    return createHeliaHTTP({
        blockstore: await configureBlockstore(),
        datastore,
        blockBrokers: configureBlockBrokers(),
        routers: configureRouters()
    });
}
async function configureBlockstore() {
    if (FILE_BLOCKSTORE_PATH != null && FILE_BLOCKSTORE_PATH !== '') {
        const fs = new FsBlockstore(FILE_BLOCKSTORE_PATH);
        await fs.open();
        return fs;
    }
}
async function configureDatastore() {
    if (FILE_DATASTORE_PATH != null && FILE_DATASTORE_PATH !== '') {
        const db = new LevelDatastore(FILE_DATASTORE_PATH);
        await db.open();
        return db;
    }
}
function configureBlockBrokers() {
    const blockBrokers = [];
    if (USE_BITSWAP) {
        blockBrokers.push(bitswap());
    }
    if (USE_TRUSTLESS_GATEWAYS) {
        blockBrokers.push(trustlessGateway());
    }
    return blockBrokers;
}
function configureRouters() {
    const routers = [];
    if (TRUSTLESS_GATEWAYS != null) {
        routers.push(httpGatewayRouting({
            gateways: TRUSTLESS_GATEWAYS
        }));
    }
    if (USE_DELEGATED_ROUTING) {
        routers.push(delegatedHTTPRouting(DELEGATED_ROUTING_V1_HOST));
    }
    return routers;
}
//# sourceMappingURL=get-custom-helia.js.map