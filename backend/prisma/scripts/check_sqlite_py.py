import sqlite3
import os

db_path = 'prisma/dev.db'

if not os.path.exists(db_path):
    print(f"Error: {db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

tables = ['Voter', 'DocumentType', 'VoterDocument', 'Token', 'Officer', 'Booth', 'AuditLog', 'FingerprintTemplate']

print("--- RAW SQLITE CONTENT CHECK ---")

for table in tables:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"- {table}: {count} records")
    except sqlite3.OperationalError as e:
        print(f"- {table}: Table missing or error ({e})")

conn.close()
