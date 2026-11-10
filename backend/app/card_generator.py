import io
import math
from typing import Any, Dict, List, Tuple
import requests
from PIL import Image, ImageDraw, ImageFont

# Dimensions
CARD_WIDTH = 800
CARD_HEIGHT = 500

# Color Palette
BG_COLOR = (13, 17, 23)           # GitHub Dark Canvas #0d1117
SURFACE_COLOR = (22, 27, 34)      # Card surface #161b22
SURFACE_BORDER = (48, 54, 61)     # Border #30363d
ACCENT_GREEN = (63, 185, 80)      # GitHub green #3fb950
ACCENT_BLUE = (88, 166, 255)      # GitHub blue #58a6ff
ACCENT_PURPLE = (163, 113, 247)   # GitHub purple #a371f7
ACCENT_ORANGE = (210, 153, 34)    # GitHub orange #d29922
TEXT_PRIMARY = (240, 246, 252)    # White/primary text #f0f6fc
TEXT_SECONDARY = (139, 148, 158)  # Muted secondary text #8b949e
TEXT_TERTIARY = (110, 118, 129)   # Dark muted text #6e7681

# Language Color Mapping
LANGUAGE_COLORS: Dict[str, Tuple[int, int, int]] = {
    "Python": (53, 114, 165),
    "JavaScript": (241, 224, 90),
    "TypeScript": (49, 120, 198),
    "HTML": (227, 76, 38),
    "CSS": (86, 61, 124),
    "Rust": (222, 165, 132),
    "Go": (0, 173, 216),
    "C++": (243, 75, 125),
    "C": (85, 85, 85),
    "C#": (23, 134, 0),
    "Java": (176, 114, 25),
    "Ruby": (112, 21, 22),
    "PHP": (79, 93, 149),
    "Swift": (240, 81, 56),
    "Kotlin": (169, 123, 255),
    "Dart": (0, 180, 171),
    "Shell": (137, 224, 81),
}


def get_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    """
    Attempt to load high quality TrueType fonts from common Linux/Debian paths,
    falling back to standard default font if unavailable.
    """
    candidates = (
        [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
        if bold
        else [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ]
    )

    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue

    # Fallback default
    return ImageFont.load_default()


def fetch_avatar_image(avatar_url: str, size: int = 80) -> Image.Image:
    """
    Fetch the user avatar and render it into a smooth circular image.
    If fetching fails, returns a stylish placeholder avatar.
    """
    img = None
    if avatar_url:
        try:
            resp = requests.get(avatar_url, timeout=4)
            if resp.status_code == 200:
                raw_img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
                img = raw_img.resize((size * 2, size * 2), Image.Resampling.LANCZOS)
        except Exception:
            img = None

    if img is None:
        # Create fallback avatar
        img = Image.new("RGBA", (size * 2, size * 2), color=(30, 41, 59, 255))
        draw_fb = ImageDraw.Draw(img)
        draw_fb.ellipse(
            [(0, 0), (size * 2, size * 2)],
            fill=(51, 65, 85, 255),
        )

    # Circular mask with antialiasing
    mask = Image.new("L", (size * 2, size * 2), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse([(0, 0), (size * 2, size * 2)], fill=255)

    circular_avatar = Image.new("RGBA", (size * 2, size * 2), (0, 0, 0, 0))
    circular_avatar.paste(img, (0, 0), mask=mask)
    return circular_avatar.resize((size, size), Image.Resampling.LANCZOS)


def draw_ambient_glow(img: Image.Image) -> None:
    """
    Add stylish ambient color glows in the corners for a Wrapped aesthetic.
    """
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Top right purple/indigo glow
    center_tr = (CARD_WIDTH - 60, 40)
    for r in range(260, 0, -20):
        alpha = int(22 * (1 - r / 260))
        draw.ellipse(
            [
                (center_tr[0] - r, center_tr[1] - r),
                (center_tr[0] + r, center_tr[1] + r),
            ],
            fill=(137, 87, 229, alpha),
        )

    # Bottom left emerald glow
    center_bl = (50, CARD_HEIGHT - 30)
    for r in range(220, 0, -20):
        alpha = int(18 * (1 - r / 220))
        draw.ellipse(
            [
                (center_bl[0] - r, center_bl[1] - r),
                (center_bl[0] + r, center_bl[1] + r),
            ],
            fill=(35, 134, 54, alpha),
        )

    img.alpha_composite(overlay)


def format_number(val: int) -> str:
    """Format large numbers with k / M or comma separators."""
    if val >= 1_000_000:
        return f"{val / 1_000_000:.1f}M"
    if val >= 10_000:
        return f"{val / 1_000:.1f}k"
    return f"{val:,}"


def generate_wrapped_card(stats: Dict[str, Any]) -> io.BytesIO:
    """
    Generate an 800x500 Wrapped-style image card with dark-mode styling,
    avatar, stats, and language breakdown.
    """
    # Create base canvas with RGBA
    card = Image.new("RGBA", (CARD_WIDTH, CARD_HEIGHT), BG_COLOR + (255,))
    draw_ambient_glow(card)

    draw = ImageDraw.Draw(card)

    # Outer border & subtle container
    margin = 20
    border_radius = 24
    draw.rounded_rectangle(
        [(margin, margin), (CARD_WIDTH - margin, CARD_HEIGHT - margin)],
        radius=border_radius,
        outline=SURFACE_BORDER,
        width=2,
    )

    # Fonts
    font_badge = get_font(12, bold=True)
    font_name = get_font(24, bold=True)
    font_username = get_font(15, bold=False)
    font_stat_val = get_font(26, bold=True)
    font_stat_label = get_font(12, bold=False)
    font_section_title = get_font(14, bold=True)
    font_lang_item = get_font(12, bold=False)
    font_footer = get_font(11, bold=False)

    # 1. Header / Top Pill
    # "GITHUB WRAPPED" pill badge
    pill_x, pill_y = 44, 42
    pill_w, pill_h = 160, 28
    draw.rounded_rectangle(
        [(pill_x, pill_y), (pill_x + pill_w, pill_y + pill_h)],
        radius=14,
        fill=SURFACE_COLOR,
        outline=(56, 139, 253, 100),
        width=1,
    )
    # Glowing neon dot
    dot_x, dot_y = pill_x + 14, pill_y + 14
    draw.ellipse([(dot_x - 4, dot_y - 4), (dot_x + 4, dot_y + 4)], fill=ACCENT_GREEN)
    draw.text((pill_x + 28, pill_y + 6), "GITHUB WRAPPED", fill=TEXT_PRIMARY, font=font_badge)

    # Right side: Joined Year
    joined_year = stats.get("joined_year", "N/A")
    joined_text = f"MEMBER SINCE {joined_year}" if joined_year != "N/A" else "DEVELOPER STATS"
    draw.text((CARD_WIDTH - 44 - 170, pill_y + 7), joined_text, fill=TEXT_SECONDARY, font=font_badge)

    # 2. User Profile Section
    avatar_size = 76
    avatar_x, avatar_y = 44, 88
    avatar = fetch_avatar_image(stats.get("avatar_url", ""), size=avatar_size)

    # Outer ring around avatar
    draw.ellipse(
        [
            (avatar_x - 3, avatar_y - 3),
            (avatar_x + avatar_size + 3, avatar_y + avatar_size + 3),
        ],
        outline=ACCENT_BLUE,
        width=2,
    )
    card.paste(avatar, (avatar_x, avatar_y), mask=avatar)

    # User Info (Name + Username + Bio)
    user_name = stats.get("name") or stats.get("username", "GitHub User")
    if len(user_name) > 24:
        user_name = user_name[:22] + "..."
    user_login = f"@{stats.get('username', '')}"

    text_start_x = avatar_x + avatar_size + 20
    draw.text((text_start_x, avatar_y + 8), user_name, fill=TEXT_PRIMARY, font=font_name)
    draw.text((text_start_x, avatar_y + 42), user_login, fill=ACCENT_BLUE, font=font_username)

    # 3. Metric Stats Grid (3 boxes: Repos, Stars, Followers)
    stats_y = 186
    stat_box_w = 224
    stat_box_h = 90
    gap = 20

    metrics = [
        ("Repositories", format_number(stats.get("public_repos", 0)), "📦", ACCENT_BLUE),
        ("Total Stars", format_number(stats.get("total_stars", 0)), "⭐", ACCENT_ORANGE),
        ("Followers", format_number(stats.get("followers", 0)), "👥", ACCENT_PURPLE),
    ]

    for idx, (label, val, icon, accent_col) in enumerate(metrics):
        box_x = 44 + idx * (stat_box_w + gap)
        # Background card
        draw.rounded_rectangle(
            [(box_x, stats_y), (box_x + stat_box_w, stats_y + stat_box_h)],
            radius=16,
            fill=SURFACE_COLOR,
            outline=SURFACE_BORDER,
            width=1,
        )

        # Subtle top accent strip
        draw.line(
            [(box_x + 16, stats_y), (box_x + 60, stats_y)],
            fill=accent_col,
            width=2,
        )

        # Icon + Value
        draw.text((box_x + 18, stats_y + 18), f"{icon}  {val}", fill=TEXT_PRIMARY, font=font_stat_val)
        draw.text((box_x + 20, stats_y + 56), label.upper(), fill=TEXT_SECONDARY, font=font_stat_label)

    # 4. Top Languages Section
    top_langs: List[Dict[str, Any]] = stats.get("top_languages", [])
    lang_section_y = 296
    draw.text((44, lang_section_y), "TOP LANGUAGES", fill=TEXT_PRIMARY, font=font_section_title)

    # Language progress breakdown bar
    bar_x = 44
    bar_y = lang_section_y + 26
    bar_w = CARD_WIDTH - 88
    bar_h = 14

    draw.rounded_rectangle(
        [(bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h)],
        radius=7,
        fill=(22, 27, 34),
        outline=SURFACE_BORDER,
        width=1,
    )

    if top_langs:
        current_x = bar_x
        for lang_item in top_langs:
            lang_name = lang_item.get("name", "Other")
            pct = lang_item.get("percentage", 0)
            segment_w = max(int((pct / 100.0) * bar_w), 2)
            color = LANGUAGE_COLORS.get(lang_name, (88, 166, 255))

            draw.rectangle(
                [(current_x, bar_y), (min(current_x + segment_w, bar_x + bar_w), bar_y + bar_h)],
                fill=color,
            )
            current_x += segment_w

        # Language badges list under the bar
        badge_y = bar_y + 26
        bx = 44
        for lang_item in top_langs[:5]:
            lang_name = lang_item.get("name", "Other")
            pct = lang_item.get("percentage", 0)
            color = LANGUAGE_COLORS.get(lang_name, (88, 166, 255))

            # Dot
            draw.ellipse([(bx, badge_y + 4), (bx + 8, badge_y + 12)], fill=color)
            label = f"{lang_name} ({pct}%)"
            draw.text((bx + 14, badge_y), label, fill=TEXT_SECONDARY, font=font_lang_item)
            bx += (len(label) * 8) + 24
    else:
        draw.text(
            (44, bar_y + 26),
            "No public language data available for this user.",
            fill=TEXT_TERTIARY,
            font=font_lang_item,
        )

    # 5. Footer divider & branding
    footer_y = CARD_HEIGHT - 52
    draw.line([(44, footer_y), (CARD_WIDTH - 44, footer_y)], fill=(33, 38, 45), width=1)
    draw.text(
        (44, footer_y + 12),
        "⚡ Generated by GitHub Wrapped",
        fill=TEXT_TERTIARY,
        font=font_footer,
    )
    draw.text(
        (CARD_WIDTH - 44 - 150, footer_y + 12),
        f"github.com/{stats.get('username', '')}",
        fill=TEXT_TERTIARY,
        font=font_footer,
    )

    # Convert to RGB and save as PNG bytes
    output_buffer = io.BytesIO()
    card_rgb = card.convert("RGB")
    card_rgb.save(output_buffer, format="PNG", quality=95, optimize=True)
    output_buffer.seek(0)
    return output_buffer

