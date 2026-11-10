import os
from typing import Any, Dict, List, Optional
import requests
from dotenv import load_dotenv
from fastapi import HTTPException

# Load environment variables from .env
load_dotenv()

GITHUB_API_BASE_URL = "https://api.github.com"


def get_headers() -> Dict[str, str]:
    """
    Construct GitHub API headers with optional authorization token.
    """
    token = os.getenv("GITHUB_TOKEN", "").strip()
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "github-wrapped-app",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def fetch_github_user(username: str) -> Dict[str, Any]:
    """
    Fetch public GitHub profile for a user.
    """
    url = f"{GITHUB_API_BASE_URL}/users/{username}"
    try:
        response = requests.get(url, headers=get_headers(), timeout=10)
    except requests.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to connect to GitHub API: {str(e)}",
        )

    if response.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail=f"GitHub user '{username}' not found",
        )
    if response.status_code in (403, 429):
        message = response.json().get("message", "API rate limit exceeded")
        raise HTTPException(
            status_code=429,
            detail=f"GitHub API rate limit exceeded ({message}). Consider setting GITHUB_TOKEN in backend/.env",
        )
    if not response.ok:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"GitHub API error: {response.text}",
        )

    return response.json()


def fetch_github_repos(username: str, max_repos: int = 100) -> List[Dict[str, Any]]:
    """
    Fetch repositories for a GitHub user (up to max_repos).
    """
    url = f"{GITHUB_API_BASE_URL}/users/{username}/repos"
    params = {
        "per_page": min(max_repos, 100),
        "sort": "updated",
        "type": "owner",
    }
    try:
        response = requests.get(
            url, headers=get_headers(), params=params, timeout=10
        )
    except requests.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to connect to GitHub API for repositories: {str(e)}",
        )

    if not response.ok:
        # If user repos fail after user profile succeeded, return empty list gracefully
        return []

    return response.json()


def get_user_wrapped_stats(username: str) -> Dict[str, Any]:
    """
    Aggregate stats required for GitHub Wrapped and cards.
    """
    user_data = fetch_github_user(username)
    repos = fetch_github_repos(username)

    total_stars = 0
    total_forks = 0
    language_counts: Dict[str, int] = {}
    top_repo: Optional[Dict[str, Any]] = None
    max_repo_stars = -1

    for repo in repos:
        if repo.get("fork", False):
            # Skip forked repositories for authentic owner stats
            continue

        stars = repo.get("stargazers_count", 0)
        forks = repo.get("forks_count", 0)
        total_stars += stars
        total_forks += forks

        lang = repo.get("language")
        if lang:
            language_counts[lang] = language_counts.get(lang, 0) + 1

        if stars > max_repo_stars:
            max_repo_stars = stars
            top_repo = {
                "name": repo.get("name"),
                "stars": stars,
                "description": repo.get("description"),
                "html_url": repo.get("html_url"),
                "language": lang,
            }

    # Calculate top languages
    total_languages_counted = sum(language_counts.values())
    sorted_languages = sorted(
        language_counts.items(), key=lambda item: item[1], reverse=True
    )
    top_languages = []
    for lang, count in sorted_languages[:5]:
        percentage = (
            round((count / total_languages_counted) * 100, 1)
            if total_languages_counted > 0
            else 0
        )
        top_languages.append(
            {
                "name": lang,
                "count": count,
                "percentage": percentage,
            }
        )

    # Joined year
    created_at = user_data.get("created_at", "")
    joined_year = created_at[:4] if len(created_at) >= 4 else "N/A"

    return {
        "username": user_data.get("login", username),
        "name": user_data.get("name") or user_data.get("login", username),
        "avatar_url": user_data.get("avatar_url", ""),
        "bio": user_data.get("bio") or "",
        "public_repos": user_data.get("public_repos", len(repos)),
        "followers": user_data.get("followers", 0),
        "following": user_data.get("following", 0),
        "total_stars": total_stars,
        "total_forks": total_forks,
        "joined_year": joined_year,
        "top_languages": top_languages,
        "top_repo": top_repo,
    }

