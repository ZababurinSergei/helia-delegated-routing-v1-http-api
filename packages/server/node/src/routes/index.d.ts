/**
 * @packageDocumentation
 *
 * Configure your existing Fastify instance with routes that conform to the
 * [Routing V1 HTTP API](https://specs.ipfs.tech/routing/http-routing-v1/) spec.
 *
 * @example
 *
 * ```typescript
 * import fastify from 'fastify'
 * import cors from '@fastify/cors'
 * import { createHelia } from 'helia'
 * import routes from '@helia/routing-v1-http-api-server/routes'
 *
 * const server = fastify({
 *  // fastify options
 * })
 * await server.register(cors, {
 *   origin: '*',
 *   methods: ['GET', 'OPTIONS'],
 *   strictPreflight: false
 * })
 *
 * const helia = await createHelia()
 *
 * // configure Routing V1 HTTP API routes
 * routes(server, helia)
 *
 * await server.listen({
 *   // fastify listen options
 * })
 *
 * // now make http requests
 * ```
 */
import type { Helia } from '@helia/interface';
import type { FastifyInstance } from 'fastify';
export default function routes(fastify: FastifyInstance, helia: Helia): void;
//# sourceMappingURL=index.d.ts.map