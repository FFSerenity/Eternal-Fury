# GPT's sheet of ground patches (on white) -> assets/ground/skirts.png: a 4×2 atlas of 512² cells with see-through edges.
# The white is taken out by how far each pixel is from white (and the colour un-mixed from it); the patches are found as the blobs
# left, read in rows, each fitted into its cell. python3 skirts.py sheet.png out.png
import sys, numpy as np, cv2
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
al = np.clip((255 - a.min(2) - 45) / 50, 0, 1).astype(np.float32)
al = cv2.GaussianBlur(cv2.erode(al, np.ones((5, 5), np.uint8)), (5, 5), 0)
n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate((al > 0.05).astype(np.uint8), np.ones((25, 25), np.uint8)), 8)
blobs = sorted([st[i] for i in range(1, n) if st[i][4] > 5000], key=lambda s: (round(s[1] / 300), s[0]))
a0 = np.clip(al, 1e-3, 1)[..., None]; fg = np.clip((a - (1 - a0) * 255) / a0, 0, 255)
C = 512; atlas = np.zeros((2 * C, 4 * C, 4), np.uint8)
for k, (x, y, w, h, _) in enumerate(blobs[:8]):
    x0, y0, x1, y1 = max(0, x - 6), max(0, y - 6), min(a.shape[1], x + w + 6), min(a.shape[0], y + h + 6)
    im = Image.fromarray(np.dstack([fg[y0:y1, x0:x1], al[y0:y1, x0:x1] * 255]).astype(np.uint8), 'RGBA')
    s = min((C - 8) / im.width, (C - 8) / im.height); im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    cx, cy = (k % 4) * C + (C - im.width) // 2, (k // 4) * C + (C - im.height) // 2
    atlas[cy:cy + im.height, cx:cx + im.width] = np.asarray(im); print(k, 'depth/width', round(im.height / im.width, 3))
Image.fromarray(atlas, 'RGBA').save(sys.argv[2])
