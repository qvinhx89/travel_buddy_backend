import { prisma } from './config/database';
import { env } from './config/env';
import { app } from './app';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Travel Buddy backend running on http://0.0.0.0:${env.PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
