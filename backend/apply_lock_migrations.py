#!/usr/bin/env python3
"""Apply document_locks and task_locks migrations"""
from database import Database

db = Database()

# Apply document_locks migration
print("Applying document_locks migration...")
with open('migrations/019_document_locks.sql', 'r') as f:
    sql = f.read()
    db.execute_update(sql)
print("✓ document_locks table created")

# Apply task_locks migration
print("Applying task_locks migration...")
with open('migrations/020_task_locks.sql', 'r') as f:
    sql = f.read()
    db.execute_update(sql)
print("✓ task_locks table created")

print("\n✅ All migrations applied successfully!")
