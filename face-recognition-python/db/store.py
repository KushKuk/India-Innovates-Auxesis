import sqlite3
import numpy as np
import io

class EmbeddingStore:
    def __init__(self, db_path='embeddings.db'):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute('''CREATE TABLE IF NOT EXISTS embeddings 
                        (voter_id TEXT PRIMARY KEY, vector BLOB)''')
        conn.commit()
        conn.close()

    def save_embedding(self, voter_id, vector):
        # Convert numpy array to bytes
        vector_bytes = vector.tobytes()
        conn = sqlite3.connect(self.db_path)
        conn.execute("INSERT OR REPLACE INTO embeddings (voter_id, vector) VALUES (?, ?)",
                     (voter_id, vector_bytes))
        conn.commit()
        conn.close()

    def get_embedding(self, voter_id):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("SELECT vector FROM embeddings WHERE voter_id = ?", (voter_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return np.frombuffer(row[0], dtype=np.float32)
        return None

store = EmbeddingStore()
