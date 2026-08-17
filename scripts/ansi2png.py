#!/usr/bin/env python3
"""ANSI -> PNG terminal renderer for screenshots.

Reads ANSI text (xterm-256 SGR + 16-color) on stdin and writes a PNG to argv[1].
Used to turn `tmux capture-pane -p` output into docs/screenshots/*.png.

Requires Pillow and the DejaVu Sans Mono font (shipped on most Linux distros).

    tmux capture-pane -p -t shot | python3 scripts/ansi2png.py out.png
"""
import sys
import re
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
SIZE = 15
BG = (13, 17, 23)  # dark terminal background

# xterm-256 palette (16 base + 6x6x6 cube + 24 grayscale).
def _cube(v):
    return 0 if v == 0 else 55 + v * 40

PAL = {}
_BASE = [
    (0, 0, 0), (128, 0, 0), (0, 128, 0), (128, 128, 0),
    (0, 0, 128), (128, 0, 128), (0, 128, 128), (192, 192, 192),
    (128, 128, 128), (255, 0, 0), (0, 255, 0), (255, 255, 0),
    (0, 0, 255), (255, 0, 255), (0, 255, 255), (255, 255, 255),
]
for i in range(16):
    PAL[i] = _BASE[i]
for r in range(6):
    for g in range(6):
        for b in range(6):
            PAL[16 + 36 * r + 6 * g + b] = (_cube(r), _cube(g), _cube(b))
for g in range(24):
    v = 8 + g * 10
    PAL[232 + g] = (v, v, v)

CSI = re.compile(r"\x1b\[[0-9;]*m")

def parse_ansi(text):
    """Return list of lines; each line is a list of (char, fg, bg, bold)."""
    lines = [[]]
    fg = bg = None
    bold = False
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == "\x1b":
            m = CSI.match(text, i)
            if m:
                seq = m.group(0)
                for code in seq[2:-1].split(";"):
                    if code in ("", "0"):
                        fg = bg = None
                        bold = False
                    elif code == "1":
                        bold = True
                    elif code == "22":
                        bold = False
                    elif code == "39":
                        fg = None
                    elif code == "49":
                        bg = None
                    elif code.startswith("38;5;"):
                        fg = int(code.split(";")[-1])
                    elif code.startswith("48;5;"):
                        bg = int(code.split(";")[-1])
                    elif 30 <= int(code) <= 37:
                        fg = int(code) - 30
                    elif 90 <= int(code) <= 97:
                        fg = int(code) - 90 + 8
                    elif 40 <= int(code) <= 47:
                        bg = int(code) - 40
                i = m.end()
                continue
        if ch == "\n":
            lines.append([])
        else:
            lines[-1].append((ch, fg, bg, bold))
        i += 1
    return lines

def render(text, out):
    lines = parse_ansi(text)
    font = ImageFont.truetype(FONT, SIZE)
    fontb = ImageFont.truetype(FONT_BOLD, SIZE)
    cw = font.getlength("M")  # monospace advance width
    ch_h = SIZE + 4
    maxw = max((len(l) for l in lines), default=0)
    W = int(maxw * cw) + 24
    H = len(lines) * ch_h + 16
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    y = 8
    for line in lines:
        x = 8
        for (ch, fg, bg, bold) in line:
            bcol = PAL.get(bg, BG) if bg is not None else BG
            d.rectangle([x, y, x + cw, y + ch_h - 2], fill=bcol)
            col = PAL.get(fg, (230, 230, 230)) if fg is not None else (230, 230, 230)
            f = fontb if bold else font
            d.text((x, y), ch, font=f, fill=col)
            x += cw
        y += ch_h
    img.save(out)
    print(f"wrote {out} ({W}x{H})")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: ansi2png.py <output.png> (ANSI on stdin)")
    render(sys.stdin.read(), sys.argv[1])
