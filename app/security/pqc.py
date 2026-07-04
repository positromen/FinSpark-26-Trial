"""Post-quantum crypto provider abstraction.

Everything else in Prahari calls only these five functions; the underlying
provider (liboqs-python today) is swappable behind them.

Algorithms (NIST-standardized):
  KEM:       ML-KEM-768  (FIPS 203, a.k.a. Kyber)
  Signature: ML-DSA-65   (FIPS 204, a.k.a. Dilithium)
"""
import oqs

KEM_ALG = "ML-KEM-768"
SIG_ALG = "ML-DSA-65"

PROVIDER = f"liboqs {oqs.oqs_version()}"


def kem_keypair() -> tuple[bytes, bytes]:
    """Generate an ML-KEM-768 keypair -> (public_key, secret_key)."""
    with oqs.KeyEncapsulation(KEM_ALG) as kem:
        public_key = kem.generate_keypair()
        return public_key, kem.export_secret_key()


def kem_encapsulate(public_key: bytes) -> tuple[bytes, bytes]:
    """Encapsulate against a public key -> (kem_ciphertext, shared_secret[32])."""
    with oqs.KeyEncapsulation(KEM_ALG) as kem:
        return kem.encap_secret(public_key)


def kem_decapsulate(secret_key: bytes, kem_ciphertext: bytes) -> bytes:
    """Recover the 32-byte shared secret using the KEM secret key."""
    with oqs.KeyEncapsulation(KEM_ALG, secret_key=secret_key) as kem:
        return kem.decap_secret(kem_ciphertext)


def sig_keypair() -> tuple[bytes, bytes]:
    """Generate an ML-DSA-65 keypair -> (public_key, secret_key)."""
    with oqs.Signature(SIG_ALG) as sig:
        public_key = sig.generate_keypair()
        return public_key, sig.export_secret_key()


def sign(secret_key: bytes, message: bytes) -> bytes:
    """ML-DSA-65 signature over message."""
    with oqs.Signature(SIG_ALG, secret_key=secret_key) as sig:
        return sig.sign(message)


def verify(public_key: bytes, message: bytes, signature: bytes) -> bool:
    """Verify an ML-DSA-65 signature."""
    with oqs.Signature(SIG_ALG) as sig:
        return sig.verify(message, signature, public_key)
