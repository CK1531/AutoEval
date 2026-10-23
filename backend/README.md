# GradeOps Backend: AI Powered Grading Engine

GradeOps Backend is the grading engine behind the GradeOps platform. It pairs vision language models with a LangGraph agentic workflow to read handwritten exams, score them against structured rubrics, and coordinate a human review step before any grade is finalized. The service is built on FastAPI and exposes the REST API that the dashboards consume.

> Looking for the interface? The React based instructor and teaching assistant dashboards live in the [GradeOps Frontend repository](https://github.com/exharmonic/gradeops-frontend).

## Core Architecture

**Two stage AI pipeline.** Each script passes through two specialized models. NVIDIA Nemotron, a vision language model served through OpenRouter, handles high fidelity OCR of handwritten text and mathematical notation. Its output is then handed to Google Gemini, which scores the answer against a complex, nested JSON rubric and produces a structured result with per criterion reasoning.

**Role based access control.** The API enforces a clear privilege boundary between instructors and teaching assistants. Authentication state is carried in an httponly cookie, which keeps the session token out of reach of client side scripts and reduces exposure to cross site scripting.

**Stateful agentic orchestration.** LangGraph models the full grading lifecycle as a state machine. When a script reaches the point where a human needs to weigh in, the graph pauses and persists its state to disk through `SqliteSaver`, so the review queue survives across requests rather than living only in memory.

**Human in the loop synchronization.** A set of REST endpoints bridges the AI pipeline and the frontend. Teaching assistants can review, adjust, and finalize AI generated scores through these endpoints without interrupting the automated flow, and approved results are written back to the graph state.

**Asynchronous background processing.** The heavy OCR and grading work runs in FastAPI background tasks. Uploads return quickly while the models work in the background, which keeps the API responsive and lets dashboard metrics update as results land.

**Relational data layer.** Application data is stored through SQLAlchemy against PostgreSQL, with SQLite used separately for the LangGraph checkpoints. Queries are structured to aggregate batch grading statistics efficiently, which matters when an exam carries a large queue of scripts.

## Tech Stack

**Framework and language**
* FastAPI on Python

**AI and orchestration**
* LangGraph for the grading state machine
* LangChain provider integrations for the model calls

**Models**
* Google Gemini (`gemini-3.1-flash-lite`) for rubric reasoning and scoring
* NVIDIA Nemotron (`nvidia/nemotron-nano-12b-v2-vl:free`, served via OpenRouter) for OCR of handwritten answers

**Data**
* PostgreSQL for application data
* SQLite for LangGraph state checkpoints (`checkpoints.db`)
* SQLAlchemy as the ORM

**Auth and utilities**
* PyJWT for token signing and `pwdlib[argon2]` for password hashing
* PyMuPDF for reading uploaded exam PDFs

---

## Local Setup Guide

### 1. Clone the repository
Open your terminal and clone the repository to your local machine:
```bash
git clone https://github.com/exharmonic/grade-ops
cd grade-ops
```

### 2. Create a virtual environment

**Windows (PowerShell or CMD):**
```bash
python -m venv .venv
.venv\Scripts\activate
```

**Git Bash:**
```bash
source .venv/Scripts/activate
```

**macOS and Linux:**
```bash
source .venv/bin/activate
```

### 3. Install dependencies
With the virtual environment active, run:
```bash
pip install -r requirements.txt
```

### 4. Configure environment variables
For security, secrets are not committed to the repository. They are read from a `.env` file instead.

Copy `.env.example` to a new file named `.env`, then fill in your local PostgreSQL `user` and `password`, a secret key, your AI model API keys, and the cookie setting:

* `SQLALCHEMY_DATABASE_URL` points at your local PostgreSQL database.
* `SECRET_KEY` signs the session tokens.
* `ACCESS_TOKEN_EXPIRE_MINUTES` controls session lifetime.
* `COOKIE_SECURE` should be `"false"` for local development over plain HTTP, and `"true"` only when the API is served over HTTPS in production.

**Generating a secret key.** Run the following and copy the output into `SECRET_KEY`:
```bash
openssl rand -hex 32
```

### 5. Set up the database
Make sure your local PostgreSQL server is running, then create the database.

Using the SQL shell (psql):
```sql
CREATE DATABASE gradeops_db;
```
Alternatively, open pgAdmin and create a database named `gradeops_db` manually.

### 6. Run the FastAPI server
From your terminal, run:
```bash
uvicorn app.main:app --reload
```
The server starts on http://localhost:8000.

### 7. Verify the endpoints
Once the server is running, you can explore and test every endpoint through the automatically generated Swagger UI:

* Interactive API documentation: http://localhost:8000/docs

> Note on testing file uploads (`POST /upload/`): the built in Swagger UI has a known limitation when testing endpoints that accept several files at once, such as batch exam uploads. For those endpoints, use Postman, cURL, or the connected React frontend instead of Swagger UI.
