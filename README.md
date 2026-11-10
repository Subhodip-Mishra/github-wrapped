# GitHub Wrapped 🎁

A modern full-stack web application that queries GitHub's GraphQL API for calendar contributions, streaks, and repository metrics, renders an interactive Spotify-Wrapped style developer card, and exports it directly as high-resolution PNG using client-side DOM capture.

---

## Architecture & Monorepo Structure

```
github-wrapped/
├── backend/
│   ├── main.py              # FastAPI GraphQL client & stats calculation
│   ├── requirements.txt     # fastapi, uvicorn, httpx, python-dotenv
│   ├── .env                 # GITHUB_TOKEN=ghp_...
│   ├── .env.example         # Template for GITHUB_TOKEN
│   └── venv/                # Python virtual environment
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx       # Root layout & dark background styling
│   │   ├── page.tsx         # Wrapped landing page, gradient card & PNG export
│   │   └── globals.css      # Tailwind CSS directives
│   ├── .env.local           # NEXT_PUBLIC_API_URL=http://localhost:8000
│   ├── package.json         # Next.js scripts, html-to-image, lucide-react
│   ├── tsconfig.json        # TypeScript configuration
│   └── tailwind.config.ts   # Tailwind configuration
│
├── .gitignore
├── package.json             # Root monorepo dev scripts
└── README.md
```

---

## Part 1: Backend Setup (FastAPI & GraphQL)

### 1. Prerequisites
- Python 3.10+
- GitHub Personal Access Token (PAT) with public user access

### 2. Configure Token
In `backend/.env`:
```env
GITHUB_TOKEN=ghp_yourPersonalAccessTokenHere
```

### 3. Setup Virtual Environment & Run Backend

```bash
cd backend

# Create virtual environment (if not already created)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate
# (On Windows: .\venv\Scripts\activate)

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn main:app --reload --port 8000
```

- API Base URL: `http://localhost:8000`
- Interactive Swagger Docs: `http://localhost:8000/docs`
- Endpoint: `GET /api/wrapped/{username}?year=2024`

---

## Part 2: Frontend Setup (Next.js & html-to-image)

### 1. Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm

### 2. Install & Run Frontend

```bash
cd frontend

# Install dependencies (including html-to-image)
npm install

# Start Next.js development server
npm run dev
```

- Frontend Application: `http://localhost:3000`

---

## Features
- **GraphQL Contribution Calendar**: Pulls full 365-day contribution calendar directly from GitHub GraphQL API.
- **Developer Metrics**: Calculates `total_contributions`, `commits`, `pull_requests`, `issues`, `longest_streak`, `active_days`, `busiest_day`, `top_languages`, and `stars`.
- **Card Design**: Purple-to-indigo gradient with 2-column metrics grid.
- **Retina PNG Export**: Captures DOM card using `html-to-image` at `pixelRatio: 2` with `crossOrigin="anonymous"` to avoid canvas tainting.
- **Error Handling**: Handles 404 missing users, rate limits, and network errors gracefully.
