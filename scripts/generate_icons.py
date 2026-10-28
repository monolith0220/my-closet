"""Generate simple maskable PNG app icons with only the Python standard library."""

from pathlib import Path
import math
import struct
import zlib


ROOT = Path(__file__).resolve().parents[1] / "public"


def distance_to_segment(x, y, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - ax - t * dx, y - ay - t * dy)


def is_hanger(x, y):
    width = 0.018
    segments = [
        (0.50, 0.395, 0.28, 0.595),
        (0.28, 0.595, 0.72, 0.595),
        (0.72, 0.595, 0.50, 0.395),
        (0.50, 0.395, 0.50, 0.365),
    ]
    if any(distance_to_segment(x, y, *segment) <= width for segment in segments):
        return True
    # The top hook is an open circular arc.
    dx, dy = x - 0.50, y - 0.315
    angle = math.atan2(dy, dx)
    radius = math.hypot(dx, dy)
    return abs(radius - 0.055) <= width and not (-0.1 < angle < 1.5)


def chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def write_icon(size):
    rows = bytearray()
    for iy in range(size):
        rows.append(0)  # PNG filter: none
        for ix in range(size):
            white = 0
            for dy in (0.25, 0.75):
                for dx in (0.25, 0.75):
                    white += is_hanger((ix + dx) / size, (iy + dy) / size)
            ratio = white / 4
            rows.extend(round(background * (1 - ratio) + 255 * ratio) for background in (29, 37, 34))
    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")
    (ROOT / f"icon-{size}.png").write_bytes(data)


for icon_size in (192, 512):
    write_icon(icon_size)
