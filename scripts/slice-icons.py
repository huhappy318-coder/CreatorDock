#!/usr/bin/env python3
"""Cut the generated CreatorDock sprite into stable platform icon assets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


SPRITE_SIZE = 2048
TILE_SIZE = 512
PLATFORM_IDS = (
    "creator-dock",
    "xiaohongshu",
    "wechat-official-accounts",
    "wechat-channels",
    "bilibili",
    "douyin",
    "x-twitter",
    "kuaishou",
    "weibo",
    "zhihu",
    "toutiao",
    "baijiahao",
    "juejin",
    "csdn",
    "ai-writing",
    "custom",
)

ADDITIONAL_ICONS = {
    "qq-content": ("#2878ff", "Q"),
    "netease-media": ("#d93232", "N"),
    "sohu-media": ("#e54545", "S"),
    "yidian": ("#3478f6", "1"),
    "dayu": ("#3a80ef", "D"),
    "xigua": ("#ff4d37", "XG"),
    "jianshu": ("#ea6f5a", "JS"),
    "acfun": ("#fd4c5b", "AC"),
    "youtube": ("#ff0033", "YT"),
    "tiktok": ("#151515", "TT"),
    "instagram": ("#c13584", "IG"),
    "facebook-meta": ("#1877f2", "M"),
    "linkedin": ("#0a66c2", "IN"),
    "medium": ("#1a8917", "M"),
    "substack": ("#ff6719", "SS"),
    "wordpress": ("#21759b", "W"),
    "reddit": ("#ff4500", "R"),
    "pinterest": ("#bd081c", "P"),
    "twitch": ("#9146ff", "TW"),
    "threads": ("#161616", "TH"),
    "bluesky": ("#1684ff", "BS"),
}

ALL_ICON_IDS = PLATFORM_IDS + tuple(ADDITIONAL_ICONS)


def icon_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def generate_abstract_icon(path: Path, color: str, mark: str) -> None:
    image = Image.new("RGBA", (TILE_SIZE, TILE_SIZE), "#fff9ed")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle((34, 34, 478, 478), radius=112, fill=color, outline=(255, 255, 255, 150), width=5)
    draw.ellipse((86, 82, 426, 422), outline=(255, 255, 255, 70), width=30)
    draw.arc((134, 130, 378, 374), 205, 520, fill=(255, 255, 255, 135), width=24)
    font = icon_font(132 if len(mark) == 1 else 104)
    bounds = draw.textbbox((0, 0), mark, font=font)
    text_width = bounds[2] - bounds[0]
    text_height = bounds[3] - bounds[1]
    draw.text(((TILE_SIZE - text_width) / 2, (TILE_SIZE - text_height) / 2 - bounds[1]), mark, font=font, fill=(255, 255, 255, 245))
    image.save(path, format="PNG", optimize=True)


def slice_sprite(source: Path, output_dir: Path) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        if image.width != SPRITE_SIZE or image.height != SPRITE_SIZE:
            image = image.resize((SPRITE_SIZE, SPRITE_SIZE), Image.Resampling.LANCZOS)
            image.save(source, format="PNG", optimize=True)
        image = image.convert("RGBA")
        for index, platform_id in enumerate(PLATFORM_IDS):
            row, column = divmod(index, 4)
            left = column * TILE_SIZE
            top = row * TILE_SIZE
            tile = image.crop((left, top, left + TILE_SIZE, top + TILE_SIZE))
            tile.save(output_dir / f"{platform_id}.png", format="PNG", optimize=True)

    for platform_id, (color, mark) in ADDITIONAL_ICONS.items():
        generate_abstract_icon(output_dir / f"{platform_id}.png", color, mark)

    manifest = {platform_id: f"icons/platforms/{platform_id}.png" for platform_id in ALL_ICON_IDS}
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest


def check_output(output_dir: Path) -> None:
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"Missing icon manifest: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if tuple(manifest) != ALL_ICON_IDS:
        raise SystemExit("Icon manifest order does not match the fixed sprite and extension order.")
    for platform_id in ALL_ICON_IDS:
        path = output_dir / f"{platform_id}.png"
        if not path.is_file():
            raise SystemExit(f"Missing platform icon: {path}")
        with Image.open(path) as image:
            if image.size != (TILE_SIZE, TILE_SIZE):
                raise SystemExit(f"Unexpected icon size for {platform_id}: {image.size}")
            if image.mode != "RGBA":
                raise SystemExit(f"Unexpected icon mode for {platform_id}: {image.mode}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("public/icons/creator-dock-sprite.png"))
    parser.add_argument("--output-dir", type=Path, default=Path("public/icons/platforms"))
    parser.add_argument("--check", action="store_true", help="validate previously generated tiles")
    args = parser.parse_args()

    if args.check:
        check_output(args.output_dir)
        print(f"Validated {len(ALL_ICON_IDS)} icons at {args.output_dir}")
        return

    if not args.source.is_file():
        raise SystemExit(f"Sprite source not found: {args.source}")
    slice_sprite(args.source, args.output_dir)
    check_output(args.output_dir)
    print(f"Generated {len(ALL_ICON_IDS)} icons at {args.output_dir}")


if __name__ == "__main__":
    main()
