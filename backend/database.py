import pymysql
from dotenv import load_dotenv
import os
from typing import Dict, List, Optional, Any

load_dotenv()

class Database:
    def __init__(self):
        self.config = {
            'host': os.getenv('MYSQL_HOST', os.getenv('DB_HOST', 'localhost')),
            'port': int(os.getenv('MYSQL_PORT', os.getenv('DB_PORT', '3306'))),
            'user': os.getenv('MYSQL_USER', os.getenv('DB_USER', 'markd-v2')),
            'password': os.getenv('MYSQL_PASSWORD', os.getenv('DB_PASSWORD', '')),
            'database': os.getenv('MYSQL_DATABASE', os.getenv('DB_NAME', 'markd-v2')),
            'charset': 'utf8mb4',
            'cursorclass': pymysql.cursors.DictCursor
        }

    def get_connection(self):
        """Get database connection"""
        return pymysql.connect(**self.config)

    def execute_query(self, query: str, params: tuple = None) -> List[Dict]:
        """Execute SELECT query and return results"""
        conn = self.get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(query, params or ())
                return cursor.fetchall()
        finally:
            conn.close()

    def execute_update(self, query: str, params: tuple = None) -> int:
        """Execute INSERT/UPDATE/DELETE query and return affected rows"""
        conn = self.get_connection()
        try:
            with conn.cursor() as cursor:
                affected = cursor.execute(query, params or ())
                conn.commit()
                return affected
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def execute_insert(self, query: str, params: tuple = None) -> str:
        """Execute INSERT query and return last insert id"""
        conn = self.get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(query, params or ())
                conn.commit()
                return cursor.lastrowid
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

# Global database instance
db = Database()