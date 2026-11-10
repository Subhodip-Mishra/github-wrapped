import os
import time
from collections import Counter
from datetime import date
from typing import Any, Dict, List, Tuple

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()
TOKEN = os.getenv("GITHUB_TOKEN")

app = FastAPI(
    title="GitHub Wrapped API",
    description="Backend API using GitHub GraphQL to query contributions and repository stats.",
    version="2.2.0",
)

# CORS Middleware supporting configurable ALLOWED_ORIGINS (e.g. for Vercel deployment)
raw_allowed = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED = [orig.strip() for orig in raw_allowed.split(",") if orig.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED if ALLOWED else ["*"],
    allow_origin_regex=r".*" if not ALLOWED else None,
    allow_credentials=True if ALLOWED else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache: (username_lowercase, year) -> (timestamp, response_data)
CACHE: Dict[Tuple[str, int], Tuple[float, Dict[str, Any]]] = {}
TTL = 60 * 60  # 1 hour cache TTL

QUERY = """
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    name login avatarUrl createdAt
    followers { totalCount }
    following { totalCount }
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount weekday } }
      }
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false,
                 orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      nodes { name stargazerCount primaryLanguage { name color } }
    }
  }
}
"""

WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

# Fallback language colors if GitHub returns None
LANGUAGE_COLOR_MAP = {
    "TypeScript": "#3178c6",
    "JavaScript": "#f7df1e",
    "Python": "#3776ab",
    "HTML": "#e34f26",
    "CSS": "#563d7c",
    "Rust": "#dea584",
    "Go": "#00add8",
    "C++": "#f34b7d",
    "C": "#555555",
    "Java": "#b07219",
    "Ruby": "#701516",
    "PHP": "#4f5d95",
    "Swift": "#f05138",
    "Kotlin": "#a97bff",
    "Dart": "#00b4ab",
    "Shell": "#89e051",
}


def longest_streak(days: list) -> int:
    """Calculate the longest consecutive days streak with contributionCount > 0."""
    best = cur = 0
    for d in days:
        cur = cur + 1 if d.get("contributionCount", 0) > 0 else 0
        best = max(best, cur)
    return best


def determine_persona(top_lang: str, streak: int, total_contribs: int, busiest_day: str = "") -> str:
    """Generate a persona badge matching GitHub Wrapped aesthetic."""
    if streak >= 30:
        return "The marathoner"
    elif total_contribs >= 2000:
        return "The code machine"
    elif busiest_day in ("Saturday", "Sunday"):
        return "The weekend warrior"
    elif top_lang == "TypeScript":
        return "The night owl"
    elif top_lang == "Python":
        return "The data wizard"
    elif top_lang in ("Rust", "Go", "C++"):
        return "The systems guru"
    return "The night owl"


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "GitHub Wrapped GraphQL API",
        "endpoints": ["/api/wrapped/{username}", "/api/health"],
        "cached_entries": len(CACHE),
    }


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/wrapped/{username}")
async def wrapped(
    username: str,
    year: int = Query(default=None, description="Year to fetch wrapped stats for"),
):
    clean_username = username.strip()
    if not clean_username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    target_year = year if year is not None else date.today().year

    # 1. Check in-memory cache
    cache_key = (clean_username.lower(), target_year)
    hit = CACHE.get(cache_key)
    if hit and (time.time() - hit[0]) < TTL:
        return hit[1]

    token = os.getenv("GITHUB_TOKEN", TOKEN)
    if not token:
        raise HTTPException(
            status_code=500,
            detail="GITHUB_TOKEN is not configured in backend/.env. GitHub GraphQL API requires a token.",
        )

    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "github-wrapped-app",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                "https://api.github.com/graphql",
                headers=headers,
                json={
                    "query": QUERY,
                    "variables": {
                        "login": clean_username,
                        "from": f"{target_year}-01-01T00:00:00Z",
                        "to": f"{target_year}-12-31T23:59:59Z",
                    },
                },
            )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Network error communicating with GitHub API: {str(e)}",
        )

    if res.status_code == 401:
        raise HTTPException(
            status_code=401,
            detail="Invalid GitHub token in backend/.env. Please verify your Personal Access Token.",
        )

    if res.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="GitHub rate limit reached. Wait a minute and try again.",
        )

    data = res.json()

    # Check for GraphQL-level rate limit errors
    errors = data.get("errors") or []
    if any(e.get("type") == "RATE_LIMITED" for e in errors):
        raise HTTPException(
            status_code=429,
            detail="GitHub rate limit reached. Wait a minute and try again.",
        )

    user = (data.get("data") or {}).get("user")
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"GitHub user '{clean_username}' not found",
        )

    cc = user.get("contributionsCollection") or {}
    calendar = cc.get("contributionCalendar") or {}
    weeks = calendar.get("weeks") or []
    days = [d for w in weeks for d in w.get("contributionDays", [])]
    repo_data = user.get("repositories") or {}
    repos = repo_data.get("nodes", [])
    total_repos = repo_data.get("totalCount", len(repos))
    followers_count = (user.get("followers") or {}).get("totalCount", 0)

    # Calculate busiest weekday
    by_weekday: Counter = Counter()
    for d in days:
        by_weekday[d.get("weekday", 0)] += d.get("contributionCount", 0)

    if by_weekday and max(by_weekday.values()) > 0:
        busiest_idx = max(by_weekday, key=by_weekday.get)
        busiest_day = WEEKDAYS[busiest_idx]
    else:
        busiest_day = "None"

    # Aggregate languages with colors and calculate percentages
    lang_counter: Counter = Counter()
    lang_colors: Dict[str, str] = {}
    for r in repos:
        pl = r.get("primaryLanguage")
        if pl and pl.get("name"):
            name = pl["name"]
            lang_counter[name] += 1
            if pl.get("color"):
                lang_colors[name] = pl["color"]

    total_langs_count = sum(lang_counter.values())
    languages_breakdown: List[Dict[str, Any]] = []
    top_languages: List[str] = []

    for name, count in lang_counter.most_common(4):
        pct = round((count / total_langs_count) * 100, 1) if total_langs_count > 0 else 0
        color = lang_colors.get(name, LANGUAGE_COLOR_MAP.get(name, "#58a6ff"))
        languages_breakdown.append({
            "name": name,
            "count": count,
            "percentage": pct,
            "color": color,
        })
        top_languages.append(name)

    top_lang_name = top_languages[0] if top_languages else "Polyglot"
    total_contributions = calendar.get("totalContributions", 0)
    commits = cc.get("totalCommitContributions", 0)
    pull_requests = cc.get("totalPullRequestContributions", 0)
    issues = cc.get("totalIssueContributions", 0)
    streak = longest_streak(days)
    active_days = sum(1 for d in days if d.get("contributionCount", 0) > 0)
    stars = sum(r.get("stargazerCount", 0) for r in repos)
    top_repo = repos[0]["name"] if repos else None

    persona = determine_persona(top_lang_name, streak, total_contributions, busiest_day)

    result = {
        "name": user.get("name") or user.get("login"),
        "login": user.get("login"),
        "avatar": user.get("avatarUrl"),
        "created_at": user.get("createdAt"),
        "year": target_year,
        "persona": persona,
        "public_repos": total_repos,
        "total_repos": total_repos,
        "followers": followers_count,
        "total_contributions": total_contributions,
        "commits": commits,
        "pull_requests": pull_requests,
        "issues": issues,
        "longest_streak": streak,
        "active_days": active_days,
        "busiest_day": busiest_day,
        "top_languages": top_languages,
        "languages_breakdown": languages_breakdown,
        "stars": stars,
        "total_stars": stars,
        "top_repo": top_repo,
        "calendar_weeks": weeks,
    }

    # Store in cache
    CACHE[cache_key] = (time.time(), result)
    return result
