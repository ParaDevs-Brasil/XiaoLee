import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class EncryptionService:

    def __init__(self, master_key: str):
        if not master_key:
            raise ValueError("ENCRYPTION_KEY cannot be empty.")
        self._key = self._derive_key(master_key)
        self._fernet = Fernet(self._key)

    def _derive_key(self, master_key: str) -> bytes:
        salt = b'xiao-lee-salt_'
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        return base64.urlsafe_b64encode(kdf.derive(master_key.encode()))

    def encrypt(self, data: str) -> str:
        """Encrypts a string and returns it as a string."""
        if not isinstance(data, str):
            raise TypeError("Data to encrypt must be a string.")
        encrypted_data = self._fernet.encrypt(data.encode())
        return encrypted_data.decode()

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypts a string and returns it as a string."""
        if not isinstance(encrypted_data, str):
            raise TypeError("Encrypted data must be a string.")
        decrypted_data = self._fernet.decrypt(encrypted_data.encode())
        return decrypted_data.decode()
