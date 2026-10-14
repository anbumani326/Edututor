import os, hashlib, hmac, secrets, datetime as dt
import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./edututor.db")
QDRANT_URL = os.getenv("QDRANT_URL", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-change-me")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", 500 * 1024 * 1024))
MIN_RETRIEVAL_SCORE = float(os.getenv("MIN_RETRIEVAL_SCORE", "0.30"))

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

def hash_password(pw: str) -> str:
    salt = secrets.token_hex(16)
    return salt + "$" + hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex()

def verify_password(pw: str, stored: str) -> bool:
    salt, h = stored.split("$")
    return hmac.compare_digest(h, hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex())

def make_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "exp": dt.datetime.utcnow() + dt.timedelta(days=7)}, JWT_SECRET, "HS256")

def read_token(token: str) -> str:
    return jwt.decode(token, JWT_SECRET, ["HS256"])["sub"]
