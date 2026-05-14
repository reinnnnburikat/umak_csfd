import path from 'node:path';
import type { PrismaConfig } from 'prisma';

export default {
  earlyAccess: true,
  schema: path.join(__dirname, 'schema.prisma'),

  migrate: {
    async url() {
      return process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
    },
  },
} satisfies PrismaConfig;
