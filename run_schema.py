from dotenv import load_dotenv
import os
from sqlalchemy import create_engine, text

load_dotenv(override=True)

database_url = os.getenv("DATABASE_URL")

if not database_url:
    raise RuntimeError("DATABASE_URL is missing from .env")

engine = create_engine(database_url)

with open("schema.sql", "r", encoding="utf-8") as f:
    sql = f.read()

# Remove SQL comment lines first
lines = []
for line in sql.splitlines():
    if not line.strip().startswith("--"):
        lines.append(line)

sql = "\n".join(lines)

# Split into individual SQL statements
statements = [
    statement.strip()
    for statement in sql.split(";")
    if statement.strip()
]

with engine.begin() as conn:
    for statement in statements:
        first_line = statement.splitlines()[0][:80]
        print("Executing:", first_line)
        conn.execute(text(statement))

print("\nSCHEMA CREATED SUCCESSFULLY")