import os
import uuid
import datetime as dt
from qdrant_client.models import PointStruct
from app.core import SessionLocal, hash_password, make_token, UPLOAD_DIR
from app.models import User, Course, Source, Chunk, Mastery, Quiz, ChatSession, ChatMessage, EvalCase
from app.providers import LocalEmbeddingProvider, ensure_collection, upsert

def seed():
    db = SessionLocal()
    existing_user = db.query(User).filter_by(email="demo@example.com").first()
    if existing_user:
        print("Demo user already exists. Updating demo assets...")
        u = existing_user
    else:
        u = User(email="demo@example.com", password_hash=hash_password("password123"))
        db.add(u)
        db.commit()

    # Course
    c = db.query(Course).filter_by(owner_id=u.id, name="Biology 101: Cell Structure").first()
    if not c:
        c = Course(owner_id=u.id, name="Biology 101: Cell Structure")
        db.add(c)
        db.commit()

    # Real PDF File
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    pdf_path = os.path.join(UPLOAD_DIR, "demo_cell_biology.pdf")
    
    # Create simple valid PDF if not exists
    if not os.path.exists(pdf_path):
        from fpdf import FPDF
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        pdf.cell(200, 10, txt="Cell Biology Basics: Structure and Function", ln=1, align='C')
        pdf.multi_cell(0, 10, txt="The cell is the basic structural and functional unit of all known organisms. The plasma membrane or cell membrane surrounds the cytoplasm of a cell, protecting its integrity.")
        pdf.add_page()
        pdf.multi_cell(0, 10, txt="The mitochondrion is a double-membrane-bound organelle found in most eukaryotic organisms. Mitochondria generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy, commonly referred to as the powerhouse of the cell.")
        pdf.add_page()
        pdf.multi_cell(0, 10, txt="The cell nucleus is a membrane-bound organelle found in eukaryotic cells. It contains most of the cell's genetic material, organized as multiple long linear DNA molecules in complex with a large variety of proteins, such as histones, to form chromosomes.")
        pdf.output(pdf_path)

    # Source
    s = db.query(Source).filter_by(course_id=c.id, name="Cell_Biology_Basics.pdf").first()
    if not s:
        s = Source(
            course_id=c.id, 
            name="Cell_Biology_Basics.pdf", 
            source_type="pdf", 
            path=pdf_path, 
            status="COMPLETED", 
            pages=3
        )
        db.add(s)
        db.commit()
    else:
        s.path = pdf_path
        s.status = "COMPLETED"
        s.pages = 3
        db.commit()

    # Chunks & Qdrant Points
    chunk_data = [
        (1, "The cell is the basic structural and functional unit of all known organisms. The plasma membrane or cell membrane surrounds the cytoplasm of a cell, protecting its integrity."),
        (2, "The mitochondrion is a double-membrane-bound organelle found in most eukaryotic organisms. Mitochondria generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy, commonly referred to as the powerhouse of the cell."),
        (3, "The cell nucleus is a membrane-bound organelle found in eukaryotic cells. It contains most of the cell's genetic material, organized as multiple long linear DNA molecules in complex with a large variety of proteins, such as histones, to form chromosomes.")
    ]
    
    emb = LocalEmbeddingProvider()
    vecs = emb.embed([t for _, t in chunk_data])
    ensure_collection(len(vecs[0]))
    
    points = []
    for (page, text), v in zip(chunk_data, vecs):
        points.append(PointStruct(id=str(uuid.uuid4()), vector=v, payload={
            "course_id": c.id, "source_id": s.id, "source_name": s.name,
            "page": page, "text": text
        }))
    upsert(points)

    existing_chunks = db.query(Chunk).filter_by(source_id=s.id).all()
    if not existing_chunks:
        rows = []
        for (page, text) in chunk_data:
            rows.append(Chunk(id=str(uuid.uuid4()), source_id=s.id, course_id=c.id, page=page, text=text))
        db.add_all(rows)
        db.commit()

    # Mastery
    db.query(Mastery).filter_by(user_id=u.id, course_id=c.id).delete()
    m1 = Mastery(user_id=u.id, course_id=c.id, concept="Mitochondria", p=0.85, attempts=3, correct=3, source_id=s.id, source_name=s.name, page=2)
    m2 = Mastery(user_id=u.id, course_id=c.id, concept="Nucleus", p=0.45, attempts=3, correct=1, source_id=s.id, source_name=s.name, page=3)
    m3 = Mastery(user_id=u.id, course_id=c.id, concept="Cell Membrane", p=0.75, attempts=4, correct=3, source_id=s.id, source_name=s.name, page=1)
    db.add_all([m1, m2, m3])
    
    # Quiz
    existing_quiz = db.query(Quiz).filter_by(user_id=u.id, course_id=c.id).first()
    if not existing_quiz:
        q = Quiz(
            user_id=u.id, course_id=c.id, 
            questions=[
                {"question": "What is the powerhouse of the cell?", "options": ["Nucleus", "Ribosome", "Mitochondria", "Lysosome"], "correct_index": 2, "concept": "Mitochondria", "explanation": "Mitochondria generate ATP.", "difficulty": "easy", "source": {"source_id": s.id, "source_name": s.name, "page": 2}},
                {"question": "Where is the genetic material stored in a eukaryotic cell?", "options": ["Mitochondria", "Nucleus", "Ribosome", "Cytoplasm"], "correct_index": 1, "concept": "Nucleus", "explanation": "The nucleus contains DNA chromosomes.", "difficulty": "medium", "source": {"source_id": s.id, "source_name": s.name, "page": 3}}
            ],
            answers=[2, 1], score=1.0
        )
        db.add(q)
    
    # Chat
    existing_chat = db.query(ChatSession).filter_by(user_id=u.id, course_id=c.id).first()
    if not existing_chat:
        sess = ChatSession(user_id=u.id, course_id=c.id)
        db.add(sess)
        db.commit()
        
        msg1 = ChatMessage(session_id=sess.id, role="user", content="What does the nucleus do?")
        msg2 = ChatMessage(session_id=sess.id, role="assistant", content="The nucleus controls and regulates the activities of the cell and carries the genes.", citations=[{"n": 1, "source_id": s.id, "source_name": s.name, "page": 3, "excerpt": "The cell nucleus is a membrane-bound organelle..."}])
        db.add_all([msg1, msg2])
        db.commit()

    # Evaluation cases
    db.query(EvalCase).filter_by(course_id=c.id).delete()
    ec1 = EvalCase(course_id=c.id, question="What organelle is the powerhouse of the cell?", expected_source=s.name, expected_page=2)
    ec2 = EvalCase(course_id=c.id, question="Where are histones and DNA chromosomes located?", expected_source=s.name, expected_page=3)
    ec3 = EvalCase(course_id=c.id, question="What membrane protects the integrity of the cytoplasm?", expected_source=s.name, expected_page=1)
    ec4 = EvalCase(course_id=c.id, question="Who won the 2022 World Cup?", expected_source="", expected_page=None)
    db.add_all([ec1, ec2, ec3, ec4])
    db.commit()
    
    print("Demo seed data created with real PDF and indexed Qdrant points! Login with demo@example.com / password123")
    db.close()

if __name__ == "__main__":
    seed()

