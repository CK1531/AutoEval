# GradeOps


<img width="400" height="60" alt="Screen Recording 2026-06-15 115048" src="https://github.com/user-attachments/assets/dcefeea0-19fc-4fb7-b35b-aebda57ec98f" />

GradeOps is an AI assisted platform for grading handwritten exams. It reads scanned scripts with a vision language model, scores each answer against a structured rubric with a second model, and then routes every result through a human reviewer before grades are released. This repository is a monorepo that holds both halves of the system: the React frontend and the FastAPI backend.

The two projects were developed separately and combined here with their full commit histories preserved, each under its own top level directory.
> **Read the full Technical Report:** [GradeOps Report](./docs/gradeops-report.pdf)

## Repository Layout

```
gradeops/
├── frontend/     React dashboards for instructors and teaching assistants
├── backend/      FastAPI grading engine and REST API
├── .gitignore
└── README.md     You are here
```

Each project keeps its own detailed README:

* Frontend setup and architecture: [`frontend/README.md`](frontend/README.md)
* Backend setup and architecture: [`backend/README.md`](backend/README.md)

## How It Works

A typical exam flows through the system like this. An instructor creates an exam with a rubric and uploads the student scripts as PDFs. The backend reads each script using Google Gemini's vision-language capabilities for OCR, then passes the extracted answers back to Gemini, which scores them against the rubric and produces structured feedback with a confidence reading. LangGraph orchestrates this pipeline as a state machine, and when a script is ready for human judgment it pauses and saves its state to disk. A teaching assistant then opens the review queue in the frontend, where each answer is shown alongside its rubric, the AI score, and the reasoning. The reviewer approves, overrides, or flags each one, and the finalized result is written back. Once review is complete, the instructor releases the grades.

## Architecture at a Glance

**Frontend.** A React application built with Vite. It provides a public landing page, authentication, an instructor portal for exams, uploads, rubrics, and grades, and a teaching assistant portal centered on a fast, keyboard friendly review queue. Styling is driven entirely by a shared design token file, and motion is handled through a small set of reusable presets. The interface talks to the backend through a single Axios client that carries the session cookie.

**Backend.** A FastAPI REST API driving an asynchronous grading pipeline. At its core is a LangGraph state machine orchestrating concurrent Gemini OCR, structured rubric scoring, and a human-in-the-loop pause via an `aiosqlite` checkpointer. Exam completions trigger a background Map-Reduce similarity engine (vector embeddings + LLM) to flag plagiarism. Application data is persisted in PostgreSQL, secured by role-based HTTP-only cookie sessions.


## Tech Stack

**Frontend**
* React 19 with Vite 8
* React Router v7 for client side routing and role based guards
* Axios for API calls, configured to send the session cookie
* Framer Motion for animation
* Three.js through @react-three/fiber and drei for the landing visuals
* Bootstrap, React Bootstrap, and react-pro-sidebar
* Inline styles driven by a custom token system

**Backend**
* FastAPI on Python
* LangGraph for the grading state machine, with LangChain provider integrations
* Google Gemini for rubric scoring and for OCR (separate)
* Google Generative AI Embeddings (gemini-embedding-001) and Scikit-learn for the cross-submission cosine similarity matrix
* PostgreSQL for application data, aiosqlite for LangGraph checkpoints, and local JSON for non-blocking similarity flag storage
* SQLAlchemy as the ORM, PyJWT and pwdlib for auth, and PyMuPDF for reading PDFs

## Quick Start

You will run the two services side by side: the backend on port 8000 and the frontend on port 5173.

### 1. Start the backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS and Linux
source venv/bin/activate

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your PostgreSQL credentials, a secret key (`openssl rand -hex 32`), your model API keys, and `COOKIE_SECURE="false"` for local development. Create the database:

```sql
CREATE DATABASE gradeops_db;
```

Then run the server:

```bash
uvicorn app.main:app --reload
```

The API is available at http://localhost:8000, with interactive docs at http://localhost:8000/docs.

### 2. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app runs at http://localhost:5173.

> Open the app through `localhost`, not `127.0.0.1`. The backend's CORS policy and the session cookie are bound to the `localhost` origin, and the browser treats `127.0.0.1` as a different origin. Using `127.0.0.1` will block API requests and prevent the login cookie from being sent.

## Development Notes

* The frontend and backend are independent applications that communicate over HTTP. Run both for a complete local environment.
* Auth is cookie based. The backend issues an httponly session cookie on login, and the frontend sends it automatically. For this to work over plain HTTP in development, keep `COOKIE_SECURE="false"` in the backend environment.
* The LangGraph state machine utilizes an asynchronous checkpointer (AsyncSqliteSaver) backed by SQLite (checkpoints.db), ensuring all pending human-in-the-loop reviews safely survive server restarts without blocking the main event loop.

## Further Reading

For full details, including the complete feature set, design system, data shapes, and endpoint reference, see the per project READMEs in [`frontend/`](frontend/README.md) and [`backend/`](backend/README.md).
