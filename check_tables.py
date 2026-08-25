from dotenv import load_dotenv
import os
from sqlalchemy import create_engine, text

load_dotenv(override=True)

engine = create_engine(os.getenv("DATABASE_URL"))

with engine.connect() as conn:
    tables = conn.execute(
        text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
    ).scalars().all()

print("Tables found:")
for table in tables:
    print(" -", table)