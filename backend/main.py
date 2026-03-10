from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import sqlite3
import json
import os
import secrets
from datetime import datetime
from parser import parse_crossword_xml

app = FastAPI(title="Shavian Crosswords")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBasic()

DB_PATH = os.environ.get("DB_PATH", "crosswords.db")
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "shavian")

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS crosswords (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            title     TEXT    NOT NULL,
            author    TEXT,
            published TEXT    NOT NULL,
            width     INTEGER NOT NULL,
            height    INTEGER NOT NULL,
            data      TEXT    NOT NULL   -- full JSON blob
        )
    """)
    conn.commit()
    conn.close()

init_db()

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def require_admin(credentials: HTTPBasicCredentials = Depends(security)):
    ok_user = secrets.compare_digest(credentials.username, ADMIN_USER)
    ok_pass = secrets.compare_digest(credentials.password, ADMIN_PASS)
    if not (ok_user and ok_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/api/crosswords")
def list_crosswords(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT id, title, author, published, width, height FROM crosswords ORDER BY published DESC"
    ).fetchall()
    return [dict(r) for r in rows]

@app.get("/api/crosswords/{cid}")
def get_crossword(cid: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute("SELECT * FROM crosswords WHERE id = ?", (cid,)).fetchone()
    if not row:
        raise HTTPException(404, "Crossword not found")
    result = dict(row)
    result["data"] = json.loads(result["data"])
    return result

@app.post("/api/crosswords", dependencies=[Depends(require_admin)])
async def upload_crossword(file: UploadFile = File(...), db: sqlite3.Connection = Depends(get_db)):
    content = await file.read()
    try:
        puzzle = parse_crossword_xml(content)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse XML: {e}")

    db.execute(
        "INSERT INTO crosswords (title, author, published, width, height, data) VALUES (?,?,?,?,?,?)",
        (
            puzzle["title"],
            puzzle["author"],
            datetime.utcnow().isoformat(),
            puzzle["width"],
            puzzle["height"],
            json.dumps(puzzle),
        ),
    )
    db.commit()
    return {"status": "ok", "title": puzzle["title"]}

@app.delete("/api/crosswords/{cid}", dependencies=[Depends(require_admin)])
def delete_crossword(cid: int, db: sqlite3.Connection = Depends(get_db)):
    db.execute("DELETE FROM crosswords WHERE id = ?", (cid,))
    db.commit()
    return {"status": "ok"}

# ---------------------------------------------------------------------------
# Serve frontend
# ---------------------------------------------------------------------------

FRONTEND = os.path.join(os.path.dirname(__file__), "..", "frontend")

app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND, "static")), name="static")

@app.get("/", response_class=HTMLResponse)
def homepage():
    return FileResponse(os.path.join(FRONTEND, "templates", "index.html"))

@app.get("/crossword/{cid}", response_class=HTMLResponse)
def solver_page(cid: int):
    return FileResponse(os.path.join(FRONTEND, "templates", "solver.html"))

@app.get("/admin", response_class=HTMLResponse)
def admin_page():
    return FileResponse(os.path.join(FRONTEND, "templates", "admin.html"))
