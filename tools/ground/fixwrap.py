# A seamless latent decoded as is (A) gets wrong borders: the VAE decodes each edge against nothing. So each batch is decoded three
# times — as made (A), rolled by a half (B) and by a quarter (C) — and the picture is put together from whichever of the three is
# far from its own edges at each pixel: A inside, B along the borders, C where B's own edges (the middle lines) cross the borders.
import numpy as np
from PIL import Image, ImageFilter
def _lines(n, at, w=40, feather=12):
    # 1 near the given rows/columns (wrapping), 0 elsewhere, softened
    m = np.zeros((n, n), np.float32)
    for a in at:
        for k in range(-w, w + 1):
            m[(a + k) % n, :] = 1; m[:, (a + k) % n] = 1
    big = np.tile(m, (3, 3))  # (blur on a 3x3 tiling so the softening wraps too)
    big = np.array(Image.fromarray((big * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(feather))).astype(np.float32) / 255
    return big[n:2 * n, n:2 * n][..., None]
def _load(p, roll, n=None):
    a = np.array(Image.open(p).convert('RGB')).astype(np.float32); n = a.shape[0]
    return np.roll(a, (-int(round(roll * n)), -int(round(roll * n))), (0, 1))
def join(a_path, b_path, c_path=None):
    A = _load(a_path, 0); n = A.shape[0]; B = _load(b_path, 0.5)
    badA = _lines(n, [0]); badB = _lines(n, [n // 2])
    wA = 1 - badA
    if c_path:
        C = _load(c_path, 0.25)
        wB = (1 - wA) * (1 - badB); wC = 1 - wA - wB
        out = A * wA + B * wB + C * wC
    else:
        out = A * wA + B * (1 - wA)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
def wrap_err(im):
    # mean step across the wrap (left-right and top-bottom edges) against the mean step between neighbouring pixels inside
    a = np.array(im).astype(np.float32)
    e = np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0] - a[-1]).mean(); i = np.abs(a[:, 1] - a[:, 0]).mean() + np.abs(a[1] - a[0]).mean()
    return e / 2, i / 2
