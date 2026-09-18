import sqlite3
from typing import Dict, Any, List
from pathlib import Path
import os

# Use a local sqlite db in the backend folder
DB_PATH = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) / "verifin.db"

def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create tables based on schema described in flow.md
    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            filename TEXT,
            file_type TEXT,
            size INTEGER,
            page_count INTEGER,
            created_at TEXT,
            status TEXT
        );

        CREATE TABLE IF NOT EXISTS document_chunks (
            id TEXT PRIMARY KEY,
            document_id TEXT,
            page_number INTEGER,
            text TEXT,
            embedding_reference TEXT,
            FOREIGN KEY (document_id) REFERENCES documents (id)
        );

        CREATE TABLE IF NOT EXISTS verification_sessions (
            id TEXT PRIMARY KEY,
            document_id TEXT,
            llm_output TEXT,
            overall_score REAL,
            risk_level TEXT,
            created_at TEXT,
            status TEXT,
            FOREIGN KEY (document_id) REFERENCES documents (id)
        );

        CREATE TABLE IF NOT EXISTS claims (
            id TEXT PRIMARY KEY,
            verification_id TEXT,
            claim_text TEXT,
            claim_type TEXT,
            source_sentence TEXT,
            status TEXT,
            confidence REAL,
            risk_level TEXT,
            FOREIGN KEY (verification_id) REFERENCES verification_sessions (id)
        );

        CREATE TABLE IF NOT EXISTS evidence (
            id TEXT PRIMARY KEY,
            claim_id TEXT,
            document_id TEXT,
            page_number INTEGER,
            text TEXT,
            similarity_score REAL,
            FOREIGN KEY (claim_id) REFERENCES claims (id),
            FOREIGN KEY (document_id) REFERENCES documents (id)
        );

        CREATE TABLE IF NOT EXISTS nli_results (
            id TEXT PRIMARY KEY,
            claim_id TEXT,
            evidence_id TEXT,
            entailment_score REAL,
            contradiction_score REAL,
            neutral_score REAL,
            final_label TEXT,
            FOREIGN KEY (claim_id) REFERENCES claims (id),
            FOREIGN KEY (evidence_id) REFERENCES evidence (id)
        );

        CREATE TABLE IF NOT EXISTS attention_results (
            id TEXT PRIMARY KEY,
            claim_id TEXT,
            attention_score REAL,
            diagnostic_level TEXT,
            FOREIGN KEY (claim_id) REFERENCES claims (id)
        );
    ''')
    conn.commit()
    conn.close()

# Initialize on import
init_db()
