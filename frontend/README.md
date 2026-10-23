# GradeOps Frontend

GradeOps is an AI assisted grading platform for handwritten exams. This repository holds the React frontend: the interface where instructors author exams and rubrics, and where teaching assistants review the AI's evaluations before scores are released. The grading itself runs in a separate service.

> Looking for the grading engine? The FastAPI orchestration backend lives in the [GradeOps Backend repository](https://github.com/exharmonic/grade-ops).

## Overview

The frontend is organized around two roles. Instructors create exams, upload student scripts, and manage rubrics and grades. Teaching assistants work through a review queue of AI graded answers, approving, overriding, or flagging each one. A human always signs off before a grade is final, so the interface is built to make that review fast and clear.

Visually the app uses a single dark theme with cyan and emerald accents, driven entirely by a shared token file rather than a CSS framework. Animation is handled through a small set of reusable motion presets so transitions feel consistent from page to page.

## Features

### Authentication and access control
The app supports two roles, instructor and teaching assistant, and gates every page accordingly. Sessions are authenticated with an httponly cookie issued by the backend, which the Axios client sends automatically on each request. On load, the app restores the current user by calling the backend rather than reading anything from local storage, so no token is ever exposed to JavaScript. Unauthenticated visitors are redirected to the login page.

### Instructor portal
Instructors get an overview with summary statistics, an exam manager for creating exams with structured rubrics, and tools to edit a rubric in place or remove an exam. Student scripts are added through a drag and drop upload that accepts multiple PDFs at once and starts the backend grading pipeline. A grades view shows each student's AI score against the maximum and lets the instructor release results.

### Teaching assistant review portal
The TA experience opens on a list of exams that still have scripts waiting for review, each showing how many are pending. Selecting an exam opens its review queue, which can be filtered by status. For each script the reviewer sees the question and its rubric, the OCR extracted answer with a confidence reading, the AI's awarded score and confidence, a per criterion breakdown of how the rubric was matched, and a similarity flag when the answer resembles other submissions. From there the reviewer can approve the AI's decision, override the score with a required reason, or flag the script for a senior grader. Progress through the session is tracked as they go, and the whole flow can be driven from the keyboard using A to approve, O to override, F to flag, and the arrow keys to move between scripts.

### Empty states
When the backend returns nothing to grade, the dashboard shows a clear empty state instead of placeholder content, so a reviewer always knows whether their queue is genuinely empty.

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | [React 19](https://react.dev/) with functional components and hooks |
| Build tool | [Vite 8](https://vite.dev/) |
| Routing | [React Router v7](https://reactrouter.com/) |
| HTTP client | [Axios](https://axios-http.com/), configured to send the session cookie |
| Animation | [Framer Motion](https://www.framer.com/motion/) |
| Landing visuals | [Three.js](https://threejs.org/) via [@react-three/fiber](https://r3f.docs.pmnd.rs/) and [drei](https://github.com/pmndrs/drei) |
| UI components | [Bootstrap 5](https://getbootstrap.com/), [React Bootstrap](https://react-bootstrap.netlify.app/), and [react-pro-sidebar](https://github.com/azouaoui-med/react-pro-sidebar) |
| Icons | [lucide-react](https://lucide.dev/) plus custom inline SVGs in the dashboards |
| Styling | Inline styles driven by a custom design token system |
| Linting | [ESLint](https://eslint.org/) |

## Design System

Everything about the look and feel comes from one tokens file at `src/tokens.js`, which keeps the interface consistent without a styling framework.

The base theme is a near black background with two accent colors, cyan and emerald, used for primary actions and positive states. Surfaces, borders, and text are defined as a small layered scale so contrast stays predictable across components. Motion is standardized through three presets, `SPRING`, `SPRING_LG`, and `EASE_EXPO`, which are imported wherever an animation is needed. Typography pairs Geist for interface text with Geist Mono for identifiers, codes, and metrics.

## Architecture

### Routing and access control
Routing is handled on the client. `App.jsx` wraps protected pages in a guard that checks the current user's role before rendering, and redirects anyone without the right role.

| Path | View | Access |
| --- | --- | --- |
| `/` | Landing page (`Home.jsx`) | Public |
| `/login`, `/register` | Authentication | Public |
| `/dashboard` | Role router (`Dashboard.jsx`) | Authenticated |
| `/instructor`, `/instructor/exams`, `/instructor/grades` | Instructor portal | Instructor |
| `/ta`, `/ta/progress`, `/ta/completed`, `/ta/flagged` | TA review portal | Teaching assistant |

### Authentication and session
The Axios instance in `src/services/api.jsx` is preconfigured with the backend base URL and `withCredentials: true` so the session cookie travels with every request. `src/context/UserContext.jsx` exposes the current user along with login and logout helpers. On mount it asks the backend who the user is and restores the session from that response, and logout clears the cookie through the backend. The credential itself stays in an httponly cookie and is never held in client side storage.

### State management
Authentication and role live in React Context. Everything else is local component state managed with the standard hooks. Memoized callbacks and effects keep the review interface responsive as the reviewer moves quickly through the queue.

### Shared component library
Common building blocks live in `src/components/ui.jsx`. These include a magnetic button with primary, ghost, white, and danger variants, a floating label text input with a cyan focus glow, a custom animated select, and small primitives such as a loading spinner and a status dot.

### Custom hooks
A handful of small hooks support the experience: an animated counter for the instructor statistic cards, a breakpoint hook that reports mobile and tablet sizes from a resize listener, and a scroll trigger hook used for reveal animations on the landing page.

### Sidebar
The sidebar in `src/components/Sidebar.jsx` adapts to screen size. It shows a full labeled rail on desktop, a compact icon only rail on tablet, and a hamburger drawer on mobile. Its navigation is role aware, showing instructor sections or TA sections as appropriate, and the active item is indicated by a pill that animates smoothly between entries.

## Pages

| Page | Description |
| --- | --- |
| `Home.jsx` | Landing page with a scroll driven hero, a Three.js particle backdrop, a feature walkthrough, and inline login and register |
| `Login.jsx` | Split layout login with show or hide password and live API integration |
| `Register.jsx` | Registration with a password strength meter and per field validation |
| `Dashboard.jsx` | Role based router that sends each user to the correct portal |
| `InstructorDashboard.jsx` | Overview, exam management with upload and rubric editing, and grades |
| `TADashboard.jsx` | Exam landing page plus the review queue and the in progress, completed, and flagged views |

## Backend Integration

All requests go through the Axios instance in `src/services/api.jsx`, which sends the session cookie automatically.

| Method and path | Purpose |
| --- | --- |
| `POST /login/` | Authenticate and receive the session cookie |
| `POST /register/` | Create an account |
| `GET /users/me` | Restore the current session |
| `GET /users/logout` | Clear the session cookie |
| `GET /exams/` | List the instructor's exams |
| `POST /exams/` | Create an exam from a title and rubric |
| `PATCH /exams/:id/` | Update an exam's rubric |
| `DELETE /exams/:id/` | Remove an exam |
| `POST /upload/` | Upload student PDFs for an exam |
| `GET /upload/instructor_exams` | Data for the grades table |
| `GET /exams/to-grade` | Exams that have scripts awaiting review |
| `GET /exams/:id/queue` | The review queue for one exam |
| `POST /upload/:id/review` | Finalize a reviewed submission |

## Key Data Shapes

```js
// Exam
{ id, title, uploaded, scripts, graded, status, rubric }

// Rubric
{ exam, questions: [{ id, text, points, keywords: [], partial_credit }] }

// Review queue item
{
  id, submission_id, studentId, questionRef, questionText, status, timeAgo,
  confidence, aiScore, maxScore, ocrConfidence, ocrText, aiJustification,
  rubric: [{ name, maxPoints, keywords: [] }],
  rubricMatch: [{ name, awarded, max, status }],   // status: full, partial, or none
  similarityFlag: { count, papers: [] }            // optional
}
```

## Getting Started

### Prerequisites
You will need [Node.js](https://nodejs.org/en) version 18 or newer with npm. To exercise authentication, uploads, and grading, you also need the [GradeOps Backend](https://github.com/exharmonic/grade-ops) running locally.

### 1. Clone the repository
```bash
git clone https://github.com/exharmonic/gradeops-frontend
cd gradeops-frontend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure the API URL
The Axios client is defined in `src/services/api.jsx` and points at the backend:
```js
baseURL: "http://localhost:8000",
withCredentials: true,
```
If your backend runs on a different host or port, update `baseURL`. Keep `withCredentials: true`, since it is required for the session cookie to be sent.

### 4. Start the development server
```bash
npm run dev
```
The app runs at http://localhost:5173.

> Use `localhost`, not `127.0.0.1`. The backend's CORS policy and the session cookie are bound to the `localhost` origin, and the browser treats `127.0.0.1` as a different origin. Visiting the app through `127.0.0.1` will block API requests and stop the login cookie from being sent, so always open http://localhost:5173.

### 5. Run the backend
Start the GradeOps Backend on http://localhost:8000 so the frontend has something to talk to. For local development over plain HTTP, set `COOKIE_SECURE="false"` in the backend's environment so the session cookie is stored and returned.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across the project |

## Project Structure

```
src/
├── App.jsx                 Routes and role based route guards
├── main.jsx                Application entry
├── services/
│   └── api.jsx             Axios instance with the session cookie enabled
├── context/
│   └── UserContext.jsx     Authentication state and session restore
├── components/
│   ├── Sidebar.jsx         Responsive, role aware sidebar
│   └── ui.jsx              Shared buttons, inputs, and primitives
├── pages/
│   ├── Home.jsx
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── Dashboard.jsx
│   ├── InstructorDashboard.jsx
│   └── TADashboard.jsx     Exam landing page and review queue
├── tokens.js               Design tokens and animation presets
└── style.css
```