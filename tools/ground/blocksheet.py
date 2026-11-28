# Blank sheet of path blocks for the person to draw cut lines on (each square = one 1 m path block, faint lines every 10 cm).
# python3 blocksheet.py out.png [count=16]
# The drawn sheet comes back to tools/ground/trace_blocks.py: each region the red lines close off inside a square is one stone.
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
B, GAP, COLS, TOP = 400, 70, 4, 190  # block px (= 1 m, 4 px/cm), gap between, columns, title band

def layout(count):
    """Pixel box (x0, y0) of each square — trace_blocks.py uses the same."""
    return [(GAP + (i % COLS) * (B + GAP), TOP + (i // COLS) * (B + GAP)) for i in range(count)]

def main(out, count=16):
    rows = (count + COLS - 1) // COLS
    W, H = GAP + COLS * (B + GAP), TOP + rows * (B + GAP)
    im = Image.new('RGB', (W, H), (255, 255, 255)); d = ImageDraw.Draw(im)
    f1, f2, f3 = ImageFont.truetype(FONT, 34), ImageFont.truetype(FONT, 22), ImageFont.truetype(FONT, 26)
    d.text((GAP, 22), '石头路方块 · 画切线', fill=(30, 30, 30), font=f1)
    d.text((GAP, 76), '每格 = 一个 1 m × 1 m 的方块，浅灰细线 = 10 cm。用红色画切线：线要画到方块边上或别的线上，把石头围成封闭的块。', fill=(60, 60, 60), font=f2)
    d.text((GAP, 108), '缝隙、做旧、切角都不用画，我来加。画几格用几格，空着的跳过。每个方块会转 4 个方向 × 镜像 = 8 种用法。', fill=(60, 60, 60), font=f2)
    for i, (x0, y0) in enumerate(layout(count)):
        for k in range(1, 10):
            g = (228, 228, 228); d.line([(x0 + k * B // 10, y0), (x0 + k * B // 10, y0 + B)], fill=g); d.line([(x0, y0 + k * B // 10), (x0 + B, y0 + k * B // 10)], fill=g)
        d.rectangle([x0 - 1, y0 - 1, x0 + B, y0 + B], outline=(60, 60, 60), width=3)
        d.text((x0, y0 - 36), str(i + 1), fill=(90, 90, 90), font=f3)
    im.save(out)

if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 16)
