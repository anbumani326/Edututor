import os, re, uuid
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, HttpUrl
from . import core
from .core import Base, engine, SessionLocal
from .models import User, Course, Source, ChatSession, ChatMessage
from .providers import OllamaLLMProvider, LocalEmbeddingProvider, search
from .ingestion import ingest_pdf, ingest_youtube

Base.metadata.create_all(engine)

app = FastAPI(title="EduTutor AI")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
                   allow_methods=["*"], allow_headers=["*"])

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def current_user(authorization: str = Header(""), db=Depends(get_db)) -> User:
    try:
        user = db.get(User, core.read_token(authorization.removeprefix("Bearer ")))
    except Exception:
        user = None
    if not user: raise HTTPException(401, "Not authenticated")
    return user

def own_course(cid: str, user: User, db) -> Course:
    c = db.get(Course, cid)
    if not c or c.owner_id != user.id: raise HTTPException(404, "Course not found")
    return c

class Creds(BaseModel):
    email: EmailStr
    password: str
class CourseIn(BaseModel):
    name: str
class YoutubeIn(BaseModel):
    url: HttpUrl
class ChatIn(BaseModel):
    question: str
    session_id: str | None = None
    source_id: str | None = None

@app.post("/auth/register")
def register(b: Creds, db=Depends(get_db)):
    if len(b.password) < 8: raise HTTPException(422, "Password must be at least 8 characters")
    if db.query(User).filter_by(email=b.email.lower()).first(): raise HTTPException(409, "Email already registered")
    u = User(email=b.email.lower(), password_hash=core.hash_password(b.password)); db.add(u); db.commit()
    return {"token": core.make_token(u.id)}

@app.post("/auth/login")
def login(b: Creds, db=Depends(get_db)):
    u = db.query(User).filter_by(email=b.email.lower()).first()
    if not u or not core.verify_password(b.password, u.password_hash): raise HTTPException(401, "Invalid credentials")
    return {"token": core.make_token(u.id)}

@app.get("/auth/me")
def me(u: User = Depends(current_user)): return {"id": u.id, "email": u.email}

@app.get("/courses")
def courses(u=Depends(current_user), db=Depends(get_db)):
    return [{"id": c.id, "name": c.name} for c in db.query(Course).filter_by(owner_id=u.id)]

@app.post("/courses")
def create_course(b: CourseIn, u=Depends(current_user), db=Depends(get_db)):
    c = Course(owner_id=u.id, name=b.name.strip()); db.add(c); db.commit(); return {"id": c.id, "name": c.name}

@app.put("/courses/{cid}")
def rename_course(cid: str, b: CourseIn, u=Depends(current_user), db=Depends(get_db)):
    c = own_course(cid, u, db); c.name = b.name.strip(); db.commit(); return {"id": c.id, "name": c.name}

@app.delete("/courses/{cid}")
def delete_course(cid: str, u=Depends(current_user), db=Depends(get_db)):
    db.delete(own_course(cid, u, db)); db.commit(); return {"ok": True}

@app.post("/courses/{cid}/sources")
async def upload(cid: str, bg: BackgroundTasks, file: UploadFile = File(...), u=Depends(current_user), db=Depends(get_db)):
    own_course(cid, u, db)
    filename_lower = (file.filename or "").lower()
    is_pdf = filename_lower.endswith(".pdf")
    is_video = filename_lower.endswith((".mp4", ".mov", ".mkv", ".webm"))
    is_pptx = filename_lower.endswith((".pptx", ".ppt"))
    
    if not is_pdf and not is_video and not is_pptx:
        raise HTTPException(415, "Only PDF, PPTX, and MP4/MOV/MKV/WEBM videos are supported")
    
    data = await file.read()
    if len(data) > core.MAX_UPLOAD_SIZE: raise HTTPException(413, "File too large")
    if is_pdf and not data.startswith(b"%PDF"): raise HTTPException(415, "Not a valid PDF")
    
    os.makedirs(core.UPLOAD_DIR, exist_ok=True)
    ext = ".pdf" if is_pdf else ".pptx" if is_pptx else os.path.splitext(filename_lower)[1]
    path = os.path.join(core.UPLOAD_DIR, f"{uuid.uuid4()}{ext}")
    open(path, "wb").write(data)
    name = re.sub(r"[^\w .\-]", "_", os.path.basename(file.filename))
    
    source_type = "pdf" if is_pdf else "pptx" if is_pptx else "video"
    s = Source(course_id=cid, name=name, path=path, source_type=source_type)
    db.add(s)
    db.commit()
    
    if is_pdf:
        bg.add_task(ingest_pdf, s.id)
    elif is_pptx:
        from .ingestion import ingest_pptx
        bg.add_task(ingest_pptx, s.id)
    else:
        from .ingestion import ingest_local_video
        bg.add_task(ingest_local_video, s.id)
        
    return {"id": s.id, "name": s.name, "status": s.status}

@app.post("/courses/{cid}/youtube")
def add_youtube(cid: str, b: YoutubeIn, bg: BackgroundTasks, u=Depends(current_user), db=Depends(get_db)):
    own_course(cid, u, db)
    s = Source(course_id=cid, name="YouTube Video", path=str(b.url), source_type="youtube"); db.add(s); db.commit()
    bg.add_task(ingest_youtube, s.id)
    return {"id": s.id, "name": s.name, "status": s.status}

@app.get("/courses/{cid}/sources")
def sources(cid: str, u=Depends(current_user), db=Depends(get_db)):
    own_course(cid, u, db)
    return [{"id": s.id, "name": s.name, "type": s.source_type, "status": s.status, "pages": s.pages, "error": s.error, "metadata": s.metadata_json}
            for s in db.query(Source).filter_by(course_id=cid)]

@app.get("/sources/{sid}/file")
def source_file(sid: str, u=Depends(current_user), db=Depends(get_db)):
    s = db.get(Source, sid)
    if not s: raise HTTPException(404, "Not found")
    own_course(s.course_id, u, db)
    if s.source_type == "pdf":
        media_type = "application/pdf"
    elif s.source_type == "pptx":
        media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    else:
        media_type = "video/mp4"
    return FileResponse(s.path, media_type=media_type)

@app.get("/sources/{sid}/meta")
def source_meta(sid: str, u=Depends(current_user), db=Depends(get_db)):
    s = db.get(Source, sid)
    if not s: raise HTTPException(404, "Not found")
    own_course(s.course_id, u, db)
    return {"id": s.id, "type": s.source_type, "path": s.path, "metadata": s.metadata_json}

SYSTEM = ("You are EduTutor AI. Answer using only the provided course material. Do not invent facts or citations. "
          "Cite with [n] matching the numbered excerpts. If the material is insufficient, say the answer is not "
          "supported by the uploaded material. Clearly label any outside knowledge as outside knowledge.")

@app.get("/courses/{cid}/chat/sessions")
def chat_sessions(cid: str, u=Depends(current_user), db=Depends(get_db)):
    own_course(cid, u, db)
    sessions = db.query(ChatSession).filter_by(course_id=cid, user_id=u.id).order_by(ChatSession.created_at.desc()).all()
    return [{"id": s.id, "created_at": s.created_at} for s in sessions]

@app.get("/courses/{cid}/chat/sessions/{session_id}")
def chat_session_messages(cid: str, session_id: str, u=Depends(current_user), db=Depends(get_db)):
    own_course(cid, u, db)
    session = db.get(ChatSession, session_id)
    if not session or session.user_id != u.id or session.course_id != cid:
        raise HTTPException(404, "Session not found")
    history = db.query(ChatMessage).filter_by(session_id=session.id).order_by(ChatMessage.created_at.asc()).all()
    return [{"id": m.id, "role": m.role, "content": m.content, "citations": m.citations or [], "created_at": m.created_at} for m in history]

@app.post("/courses/{cid}/chat")
def chat(cid: str, b: ChatIn, u=Depends(current_user), db=Depends(get_db)):
    own_course(cid, u, db)
    
    if b.session_id:
        session = db.get(ChatSession, b.session_id)
        if not session or session.user_id != u.id or session.course_id != cid:
            raise HTTPException(404, "Session not found")
    else:
        session = ChatSession(user_id=u.id, course_id=cid)
        db.add(session)
        db.commit()

    history = db.query(ChatMessage).filter_by(session_id=session.id).order_by(ChatMessage.created_at.asc()).all()[-10:]
    hist_msgs = [{"role": m.role, "content": m.content} for m in history]

    hits = [h for h in search(LocalEmbeddingProvider().embed([b.question])[0], cid, source_id=b.source_id) if h.score >= core.MIN_RETRIEVAL_SCORE]
    if not hits and not hist_msgs:
        ans = "I couldn't find enough information in your course material to answer this confidently."
        db.add(ChatMessage(session_id=session.id, role="user", content=b.question))
        db.add(ChatMessage(session_id=session.id, role="assistant", content=ans, citations=[]))
        db.commit()
        return {"answer": ans, "citations": [], "session_id": session.id}
    
    ctx = []
    for i, h in enumerate(hits):
        p = h.payload
        loc = f"slide {p.get('slide')}" if p.get("slide") else f"page {p.get('page')}" if p.get("page") else f"timestamp {round(p.get('timestamp_start', 0))}s"
        ctx.append(f"[{i+1}] ({p['source_name']}, {loc})\n{p['text']}")
    ctx = "\n\n".join(ctx)
    user_msg = ChatMessage(session_id=session.id, role="user", content=b.question, retrieved_source_ids=None)
    db.add(user_msg)
    
    try:
        user_prompt = f"Course material:\n{ctx}\n\nQuestion: {b.question}" if hits else b.question
        ans = OllamaLLMProvider().chat(SYSTEM, user_prompt, history=hist_msgs)
    except Exception:
        db.rollback()
        raise HTTPException(503, "AI Tutor is temporarily unavailable. Make sure Ollama is running.")
    
    cites = [{"n": i+1, "source_id": h.payload["source_id"], "source_name": h.payload["source_name"],
              "page": h.payload.get("page"), "slide": h.payload.get("slide"),
              "timestamp_start": h.payload.get("timestamp_start"),
              "timestamp_end": h.payload.get("timestamp_end"),
              "excerpt": h.payload["text"][:240], "score": round(h.score, 3)} for i, h in enumerate(hits)]

    asst_msg = ChatMessage(session_id=session.id, role="assistant", content=ans, retrieved_source_ids=[c["source_id"] for c in cites], citations=cites)
    db.add(asst_msg)
    db.commit()

    return {"answer": ans, "citations": cites, "session_id": session.id}

from . import quiz as _quiz
_quiz.register(app, get_db, current_user, own_course)

from . import evaluation as _ev
_ev.register(app, get_db, current_user, own_course)
