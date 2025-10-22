from cryptography.fernet import Fernet
import os

class SimpleEncryption:
    """Simple encryption service for password vault"""
    
    def __init__(self):
        # Get encryption key from env
        key = os.getenv('VAULT_ENCRYPTION_KEY')
        if not key:
            # Generate new key if not exists
            key = Fernet.generate_key().decode()
            print(f"\n⚠️  VAULT_ENCRYPTION_KEY not found in .env")
            print(f"Add this line to /apps/markd-v1/app/backend/.env:")
            print(f"VAULT_ENCRYPTION_KEY={key}\n")
            raise ValueError("VAULT_ENCRYPTION_KEY not configured")
        
        self.fernet = Fernet(key.encode() if isinstance(key, str) else key)
    
    def encrypt(self, text: str) -> str:
        """Encrypt text and return base64 string"""
        if not text:
            return ""
        return self.fernet.encrypt(text.encode()).decode()
    
    def decrypt(self, encrypted_text: str) -> str:
        """Decrypt base64 string and return text"""
        if not encrypted_text:
            return ""
        return self.fernet.decrypt(encrypted_text.encode()).decode()

# Singleton instance
encryption = SimpleEncryption()
