import type { FastifyInstance } from 'fastify';

export async function registerDeviceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/devices/:id', async (request, reply) => {
    const deviceId = String((request.params as { id?: string }).id ?? '');

    return reply.code(200).send({
      deviceId,
      status: 'placeholder',
    });
  });
}
