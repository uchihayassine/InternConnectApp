# InternConnect - AI University Companion

InternConnect is an Agentic RAG platform that helps international students at FH Dortmund navigate campus bureaucracy. Answers are grounded in verified university documents stored as vectors, then classified so the guide can route location and emergency questions differently from everyday ones.

## Tech stack

- React and Vite
- FastAPI
- Supabase with pgvector
- Google Gemini Flash for answers and Gemini embeddings for retrieval

## Setup

From the project root:

```powershell
cd frontend
npm install
cd ..\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Fill in `backend\.env` with your Gemini API key and the Supabase project URL and service role key. Do not commit that file.

In the Supabase SQL Editor, run `backend\schema.sql`. That creates the `campus_documents` table and the `match_documents` search function.

## Run

Start the API from `backend` with the virtual environment activated:

```powershell
uvicorn main:app --reload --port 8001
```

The React app posts chat requests to `http://127.0.0.1:8001/chat`.

In a second terminal, seed the vector database, then start the frontend:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python ingest.py
```

```powershell
cd frontend
npm run dev
```

Open the URL Vite prints, usually `http://127.0.0.1:5173`.
