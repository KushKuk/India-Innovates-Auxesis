import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { encryptionExtension } from './extensions/encryption.extension';
import { EncryptionService } from '../common/encryption/encryption.service';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private _baseClient: PrismaClient;
  private _extendedClient: any;

  constructor(private encryptionService: EncryptionService) {
    // DIAGNOSTIC: Bypassing the Postgres Adapter to rule it out as the source of the crash
    // const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // const adapter = new PrismaPg(pool);
    
    // Create the base client using standard URL connection
    this._baseClient = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
    
    // Create the extended client (with encryption)
    this._extendedClient = this._baseClient.$extends(encryptionExtension(this.encryptionService));
  }

  /**
   * Expose the extended client. 
   * This client includes the encryption middleware.
   */
  get client() {
    return this._extendedClient;
  }

  /**
   * Expose the base client.
   * Useful for simple lookups or when extensions cause serialization issues.
   */
  get base() {
    return this._baseClient;
  }

  async onModuleInit() {
    await this._baseClient.$connect();
  }

  async onModuleDestroy() {
    await this._baseClient.$disconnect();
  }
}
