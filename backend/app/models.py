import uuid, datetime as dt
from sqlalchemy import String, Integer, Text, ForeignKey, DateTime, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column
from .core import Base

def uid(): return str(uuid.uuid4())
def now(): return dt.datetime.utcnow()

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

class Course(Base):
    __tablename__ = "courses"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

class Source(Base):
    __tablename__ = "sources"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    name: Mapped[str] = mapped_column(String)
    source_type: Mapped[str] = mapped_column(String, default="pdf")
    path: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="PENDING")  # PENDING|PROCESSING|COMPLETED|FAILED
    pages: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str] = mapped_column(String, default="")
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

class Chunk(Base):
    __tablename__ = "knowledge_chunks"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"), index=True)
    course_id: Mapped[str] = mapped_column(String, index=True)
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)  # real PDF page, 1-based
    slide: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timestamp_start: Mapped[float | None] = mapped_column(Float, nullable=True)
    timestamp_end: Mapped[float | None] = mapped_column(Float, nullable=True)
    text: Mapped[str] = mapped_column(Text)
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    frame_path: Mapped[str | None] = mapped_column(String, nullable=True)
    segment_id: Mapped[str | None] = mapped_column(String, nullable=True)

class Quiz(Base):
    __tablename__ = "quizzes"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    questions: Mapped[list] = mapped_column(JSON)
    answers: Mapped[list | None] = mapped_column(JSON, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

class Mastery(Base):
    __tablename__ = "student_mastery"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    concept: Mapped[str] = mapped_column(String)
    p: Mapped[float] = mapped_column(Float)  # P(known), updated by Bayesian Knowledge Tracing
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    source_id: Mapped[str] = mapped_column(String, default="")
    source_name: Mapped[str] = mapped_column(String, default="")
    page: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

class EvalCase(Base):
    __tablename__ = "evaluation_cases"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    question: Mapped[str] = mapped_column(String)
    expected_source: Mapped[str] = mapped_column(String, default="")
    expected_page: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = unsupported question

class EvalRun(Base):
    __tablename__ = "evaluation_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    metrics: Mapped[dict] = mapped_column(JSON)
    details: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

class ChatSession(Base):
    __tablename__ = 'chat_sessions'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey('courses.id'), index=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

class ChatMessage(Base):
    __tablename__ = 'chat_messages'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey('chat_sessions.id'), index=True)
    role: Mapped[str] = mapped_column(String)  # 'user' or 'assistant'
    content: Mapped[str] = mapped_column(Text)
    retrieved_source_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    citations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)
