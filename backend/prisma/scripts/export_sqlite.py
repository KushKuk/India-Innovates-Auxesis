import sqlite3
import json
import os

db_path = 'prisma/dev.db'
backup_path = 'prisma/backup_sqlite.json'

if not os.path.exists(db_path):
    print(f"Error: {db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row  # Return rows as dictionaries
cursor = conn.cursor()

# Map Prisma model names to SQLite table names
models = {
    'voter': 'Voter',
    'documentType': 'DocumentType',
    'voterDocument': 'VoterDocument',
    'token': 'Token',
    'officer': 'Officer',
    'booth': 'Booth',
    'auditLog': 'AuditLog',
    'fingerprintTemplate': 'FingerprintTemplate'
}

export_data = {}

print("Starting data export from SQLite using Python...")

for prisma_model, table_name in models.items():
    try:
        cursor.execute(f'SELECT * FROM "{table_name}"')
        rows = [dict(row) for row in cursor.fetchall()]
        export_data[prisma_model] = rows
        print(f"- Exported {len(rows)} rows from {table_name}")
    except sqlite3.OperationalError as e:
        print(f"- Skipping {table_name}: {e}")

with open(backup_path, 'w', encoding='utf-8') as f:
    json.dump(export_data, f, indent=2, default=str)

print(f"\nSUCCESS: Backup saved to {backup_path}")
conn.close()
