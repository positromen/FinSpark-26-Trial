"""Quantum-safe credential vault.

Each secret is encrypted with AES-256-GCM under a fresh key; that key is the
shared secret produced by ML-KEM-768 encapsulation against the vault's public
key. Decryption requires the vault's KEM secret key to decapsulate — so even a
recorded-today/decrypted-later quantum adversary can't recover the credentials.
"""
import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy.orm import Session as OrmSession

from app.models.entities import VaultItem
from app.security import keys, pqc


def store_secret(db: OrmSession, name: str, secret: str) -> VaultItem:
    """Encrypt and persist a credential; replaces any existing item of the same name."""
    vault_pub, _ = keys.vault_keypair()
    kem_ct, shared_secret = pqc.kem_encapsulate(vault_pub)  # 32 bytes -> AES-256 key
    nonce = os.urandom(12)
    ciphertext = AESGCM(shared_secret).encrypt(nonce, secret.encode(), name.encode())

    item = db.query(VaultItem).filter_by(name=name).first()
    if item is None:
        item = VaultItem(name=name)
        db.add(item)
    item.ciphertext = base64.b64encode(ciphertext).decode()
    item.nonce = base64.b64encode(nonce).decode()
    item.kem_ciphertext = base64.b64encode(kem_ct).decode()
    db.commit()
    return item


def get_secret(db: OrmSession, name: str) -> str:
    """Decapsulate + decrypt a stored credential."""
    item = db.query(VaultItem).filter_by(name=name).first()
    if item is None:
        raise KeyError(f"no vault item named '{name}'")
    _, vault_sec = keys.vault_keypair()
    shared_secret = pqc.kem_decapsulate(vault_sec, base64.b64decode(item.kem_ciphertext))
    plaintext = AESGCM(shared_secret).decrypt(
        base64.b64decode(item.nonce), base64.b64decode(item.ciphertext), name.encode())
    return plaintext.decode()
