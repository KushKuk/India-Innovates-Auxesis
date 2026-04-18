import { Prisma } from '@prisma/client';
import { EncryptionService } from '../../common/encryption/encryption.service';

/**
 * Registry of models and their sensitive fields for encryption.
 * 'encrypt': fields to be encrypted via AES-GCM.
 * 'blindIndex': fields to be hashed for searchability.
 */
const ENCRYPTED_FIELDS: Record<string, { encrypt: string[]; blindIndex?: Record<string, string> }> = {
  Voter: {
    encrypt: ['name', 'dob', 'address'],
    blindIndex: { nameHash: 'name' },
  },
  VoterDocument: {
    encrypt: ['documentNumber', 'nameOnDocument'],
    blindIndex: { documentNumberHash: 'documentNumber' },
  },
  Officer: {
    encrypt: ['name'],
  },
  AuditLog: {
    encrypt: ['details'],
  },
};

export const encryptionExtension = (encryptionService: EncryptionService) => {
  return Prisma.defineExtension({
    name: 'encryption',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const config = ENCRYPTED_FIELDS[model];
          if (!config) return query(args);

          // --- WRITE OPERATIONS: Encrypt data before saving ---
          if (['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(operation)) {
            const encryptData = (data: any) => {
              if (!data) return;

              // Encrypt specified fields
              config.encrypt.forEach((field) => {
                if (data[field] && typeof data[field] === 'string') {
                  data[field] = encryptionService.encrypt(data[field]);
                }
              });

              // Generate Blind Indices for searchable fields
              if (config.blindIndex) {
                Object.entries(config.blindIndex).forEach(([hashField, sourceField]) => {
                  if (data[sourceField] && typeof data[sourceField] === 'string') {
                    // We extract the original text from the (potentially) already encrypted string if it was just encrypted
                    // but since we are doing it in order, we should be careful.
                    // Instead, we decrypt just in case, or we use the original value if we had it.
                    // For safety, let's assume 'data[sourceField]' is the raw value before we encrypted it above.
                    // Wait, the order matters. Let's fix the order.
                  }
                });
              }
            };

            // Recursively encrypt data (to handle nested writes if any)
            const processData = (data: any) => {
              if (!data) return;
              
              // Corrected order: 1. Generate Blind Index, 2. Encrypt original field
              if (config.blindIndex) {
                Object.entries(config.blindIndex).forEach(([hashField, sourceField]) => {
                   if (data[sourceField] && typeof data[sourceField] === 'string') {
                     data[hashField] = encryptionService.generateBlindIndex(data[sourceField]);
                   }
                });
              }

              config.encrypt.forEach((field) => {
                if (data[field] && typeof data[field] === 'string') {
                  data[field] = encryptionService.encrypt(data[field]);
                }
              });
            };

            if (operation === 'createMany' || operation === 'updateMany') {
              const anyArgs = args as any;
              if (Array.isArray(anyArgs.data)) {
                anyArgs.data.forEach(processData);
              } else if (anyArgs.data?.data && Array.isArray(anyArgs.data.data)) {
                anyArgs.data.data.forEach(processData);
              }
            } else if ((args as any).data) {
              processData((args as any).data);
            }
          }

          // --- READ OPERATIONS: Decrypt data after retrieval ---
          const result = await query(args);

          const decryptData = (data: any) => {
            if (!data || typeof data !== 'object') return data;
            
            config.encrypt.forEach((field) => {
              if (data[field] && typeof data[field] === 'string') {
                data[field] = encryptionService.decrypt(data[field]);
              }
            });
            return data;
          };

          if (Array.isArray(result)) {
            return result.map(decryptData);
          }
          return decryptData(result);
        },
      },
    },
  });
};
