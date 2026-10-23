from pwdlib import PasswordHash

hasher = PasswordHash.recommended()
DUMMY_HASH = hasher.hash("dummy_password")

def hash_password(password:str):
    return hasher.hash(password)

def verify_password(plain_password:str, hashed_password: str):
    return hasher.verify(plain_password, hashed_password)