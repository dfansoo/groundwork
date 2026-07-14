import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private static instance: PrismaService | null = null;

  constructor() {
    // Reuse existing instance in development (for hot-reloading)
    if (process.env.NODE_ENV !== 'production' && PrismaService.instance) {
      return PrismaService.instance;
    }

    // Create PostgreSQL connection pool
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    
    // Create Prisma adapter with the pool
    const adapter = new PrismaPg(pool);
    
    // Initialize PrismaClient with the adapter (required in Prisma 7+)
    super({ adapter });
    
    // Store instance globally in development to prevent multiple instances
    if (process.env.NODE_ENV !== 'production') {
      PrismaService.instance = this;
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await this.$disconnect();
      await app.close();
    });
  }
} 