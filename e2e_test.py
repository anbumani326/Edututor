import httpx, os, time

BASE = "http://localhost:8000"

def test():
    c = httpx.Client(base_url=BASE, timeout=300)
    
    # 1. Register
    email = f"test_{int(time.time())}@example.com"
    r = c.post("/auth/register", json={"email": email, "password": "password123"})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    c.headers["Authorization"] = f"Bearer {token}"
    
    # 2. Create Course
    r = c.post("/courses", json={"name": "End to End Test Course"})
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    print(f"Course created: {cid}")
    
    # 3. Create dummy PDF
    pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 53 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(The powerhouse of the cell is the mitochondria.) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000220 00000 n \n0000000324 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n412\n%%EOF\n"
    with open("test.pdf", "wb") as f:
        f.write(pdf_content)
        
    # 4. Upload PDF
    r = c.post(f"/courses/{cid}/sources", files={"file": ("test.pdf", open("test.pdf", "rb"), "application/pdf")})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    print(f"Source uploaded: {sid}")
    
    # Wait for processing
    while True:
        r = c.get(f"/courses/{cid}/sources")
        s = next(x for x in r.json() if x["id"] == sid)
        print(f"Status: {s['status']}")
        if s["status"] == "COMPLETED": break
        if s["status"] == "FAILED": raise Exception("Processing failed: " + s.get("error", ""))
        time.sleep(2)
        
    # 5. Chat Session
    print("Testing chat...")
    r = c.post(f"/courses/{cid}/chat", json={"question": "What is the powerhouse of the cell?"})
    assert r.status_code == 200, r.text
    data = r.json()
    print("A:", data["answer"])
    print("Citations:", len(data["citations"]))
    assert len(data["citations"]) > 0
    
    sess_id = data["session_id"]
    print("Session ID:", sess_id)
    
    # 6. Chat Follow-up
    r = c.post(f"/courses/{cid}/chat", json={"question": "Can you explain that more simply?", "session_id": sess_id})
    assert r.status_code == 200, r.text
    data = r.json()
    print("A2:", data["answer"])
    assert data["session_id"] == sess_id
    print("End-to-end test passed!")

if __name__ == '__main__':
    test()