"""Genera icons/icon{16,48,128}.png sin dependencias: escudo verde con reloj."""
import struct, zlib, os

def png_chunk(typ, data):
    c = struct.pack(">I", len(data)) + typ + data
    c += struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
    return c

def save_png(path, size, pixels):
    def row(y):
        out = b"\x00"
        for x in range(size):
            out += bytes(pixels[y][x])
        return out
    raw = b"".join(row(y) for y in range(size))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", zlib.compress(raw)) + png_chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "wb").write(png)

def draw(size):
    px = [[(244, 241, 234)] * size for _ in range(size)]
    cx = cy = size / 2
    for y in range(size):
        for x in range(size):
            # círculo verde (cabeza del "reloj-enfoque")
            dx, dy = x - cx, y - cy
            d = (dx * dx + dy * dy) ** 0.5
            r = size * 0.44
            if d <= r:
                # anillo exterior más oscuro
                if d > r * 0.82:
                    px[y][x] = (29, 92, 54)
                else:
                    px[y][x] = (47, 125, 79)
    # manecillas blancas: vertical (12) y diagonal (4h)
    for i in range(int(size * 0.30)):
        px[int(cy - i)][int(cx)] = (255, 255, 255)
        x2 = int(cx + i * 0.7); y2 = int(cy + i * 0.7)
        if 0 <= x2 < size and 0 <= y2 < size:
            px[y2][x2] = (255, 255, 255)
    return px

for s in (16, 48, 128):
    save_png(f"icons/icon{s}.png", s, draw(s))
print("icons ok")
