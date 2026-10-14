import os
import sys
import time
import subprocess
import httpx
from fpdf import FPDF

BASE = "http://localhost:8000"

def generate_pdf():
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt="Neural Networks and Deep Learning", ln=1, align='C')
    pdf.multi_cell(0, 10, txt="Deep learning models, particularly neural networks, heavily rely on the mathematical foundation of systems of linear equations. Each layer in a neural network computes transformations by multiplying input vectors with weight matrices. This allows the network to learn complex patterns.")
    pdf.output("test_dl.pdf")
    return "test_dl.pdf"

def wait_for_ready(c, cid, expected_count=2, timeout=120):
    start = time.time()
    while time.time() - start < timeout:
        r = c.get(f"/courses/{cid}/sources")
        sources = r.json()
        if len(sources) >= expected_count and all(s["status"] == "COMPLETED" for s in sources):
            return True
        elif any(s["status"] == "ERROR" for s in sources):
            print("Error processing a source:", sources)
            return False
        time.sleep(2)
    return False

def test_cross_source():
    c = httpx.Client(base_url=BASE, timeout=600)
    
    # 1. Login
    email = f"cross_{int(time.time())}@example.com"
    r = c.post("/auth/register", json={"email": email, "password": "password123"})
    if r.status_code == 409:
        r = c.post("/auth/login", json={"email": email, "password": "password123"})
    token = r.json()["token"]
    c.headers.update({"Authorization": f"Bearer {token}"})

    # 2. Create Course
    r = c.post("/courses", json={"name": "Math for Deep Learning"})
    cid = r.json()["id"]
    print("Course created:", cid)

    # 3. Create and Upload PDF
    pdf_path = generate_pdf()
    print("Uploading PDF...")
    with open(pdf_path, "rb") as f:
        r = c.post(f"/courses/{cid}/sources", files={"file": ("test_dl.pdf", f, "application/pdf")})
    assert r.status_code == 200
    pdf_id = r.json()["id"]

    # 4. Upload Video
    print("Uploading Video...")
    if not os.path.exists("real_test_video.mp4"):
        print("Downloading MIT 18.06 Lecture using ffmpeg...")
        subprocess.run([
            "ffmpeg", "-y", "-i", "https://archive.org/download/MIT18.06S05_MP4/01.mp4",
            "-t", "120", "-c", "copy", "real_test_video.mp4"
        ], check=True)
        
    with open("real_test_video.mp4", "rb") as f:
        r = c.post(f"/courses/{cid}/sources", files={"file": ("real_test_video.mp4", f, "video/mp4")})
    assert r.status_code == 200
    vid_id = r.json()["id"]

    # 5. Wait for both to be READY
    print("Waiting for processing...")
    assert wait_for_ready(c, cid, 2, 240)
    print("Both sources are READY.")

    # 6. Ask Cross-Source Question
    print("Asking cross-source question...")
    q = "According to the PDF about neural networks, how are the concepts discussed in the 18.06 video lecture (like systems of equations or matrices) applied?"
    r = c.post(f"/courses/{cid}/chat", json={"question": q})
    assert r.status_code == 200
    resp = r.json()
    
    print("\nQuestion:", q)
    print("Answer:", resp["answer"])
    
    # Check citations
    sources_cited = {cit["source_name"] for cit in resp["citations"]}
    print("Citations from:", sources_cited)
    
    # Assert that BOTH sources are cited
    assert "test_dl.pdf" in sources_cited, "PDF was not cited!"
    assert "real_test_video.mp4" in sources_cited, "Video was not cited!"
    print("\nCROSS-SOURCE VALIDATION PASSED! Both sources were combined successfully.")

if __name__ == '__main__':
    test_cross_source()
