from app.core import hash_password, verify_password, make_token, read_token
from app.ingestion import chunk_text

def test_password_roundtrip():
    h = hash_password("secret123"); assert verify_password("secret123", h) and not verify_password("x", h)
def test_token():
    assert read_token(make_token("abc")) == "abc"
def test_chunking_overlap():
    assert len(list(chunk_text("a " * 1000))) > 1
