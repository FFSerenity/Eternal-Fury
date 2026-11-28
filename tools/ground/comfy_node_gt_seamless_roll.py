"""gt_seamless_roll — two small nodes for making tileable (seamless) textures with DiT image models.

GT Seamless Roll (model patch): every time the diffusion model is called, the latent is rolled (wrapped around) by a random
offset first and the prediction rolled back after. The wrap-around seam lands somewhere new on every step, so the model paints
the texture's opposite edges to continue into each other. Works for transformer models (Qwen Image etc.) that circular padding
cannot make seamless.

GT Latent Roll: rolls a latent by a fraction of its size (e.g. 0.5, 0.5), to check or to decode the seam area in the middle.

Written for the Grave Tamer / Eternal Fury ground textures (Nov 2026). Safe to delete: nothing else uses it.
"""
import math
import random
import torch
import comfy.patcher_extension


class GTSeamlessRoll:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "model": ("MODEL",),
            "seed": ("INT", {"default": 0, "min": 0, "max": 2**31 - 1}),
            "multiple": ("INT", {"default": 2, "min": 1, "max": 16, "tooltip": "offsets are multiples of this (keep the model's patch grid)"}),
            "passes": ("INT", {"default": 3, "min": 1, "max": 3, "tooltip": "1: one random roll per step (fast, can leave faint lines where the last steps' seams were). "
                                                                          "3: three rolls a third apart each step, blended so no pixel is taken from near its own seam (3x slower, clean)"}),
            "sharp": ("FLOAT", {"default": 4.0, "min": 1.0, "max": 16.0, "step": 0.5, "tooltip": "with 3 passes: how much each pixel favours the one roll it is farthest from a seam in "
                                                                                          "(1 = soft average, a little blurry; higher = crisper)"}),
        }}
    RETURN_TYPES = ("MODEL",)
    FUNCTION = "patch"
    CATEGORY = "model/patch"

    def patch(self, model, seed, multiple, passes, sharp=4.0):
        m = model.clone()
        rng = random.Random(seed)
        win_cache = {}

        def window(n, s, device, dtype):
            # 0 at this roll's seam, 1 halfway round from it (sin^2 of the position in the rolled frame)
            key = (n, s, device, dtype)
            if key not in win_cache:
                r = (torch.arange(n, device=device, dtype=torch.float32) + s) % n
                win_cache[key] = torch.sin(math.pi * (r + 0.5) / n) ** 2  # (float32: the weights get small)
            return win_cache[key]

        def wrapper(executor, *args, **kwargs):
            x = args[0]
            H, W = x.shape[-2], x.shape[-1]
            by = rng.randrange(0, max(1, H // multiple)) * multiple
            bx = rng.randrange(0, max(1, W // multiple)) * multiple
            if passes == 1:
                out = executor(torch.roll(x, shifts=(by, bx), dims=(-2, -1)), *args[1:], **kwargs)
                return torch.roll(out, shifts=(-by, -bx), dims=(-2, -1))
            acc, wsum = None, None
            for i in range(passes):
                sy = (by + round(i * H / passes / multiple) * multiple) % H
                sx = (bx + round(i * W / passes / multiple) * multiple) % W
                out = torch.roll(executor(torch.roll(x, shifts=(sy, sx), dims=(-2, -1)), *args[1:], **kwargs), shifts=(-sy, -sx), dims=(-2, -1))
                w = (window(H, sy, out.device, out.dtype)[:, None] * window(W, sx, out.device, out.dtype)[None, :]) ** sharp
                acc = out.float() * w if acc is None else acc + out.float() * w
                wsum = w if wsum is None else wsum + w
            return (acc / wsum.clamp(min=1e-12)).to(out.dtype)

        m.add_wrapper_with_key(comfy.patcher_extension.WrappersMP.DIFFUSION_MODEL, "gt_seamless_roll", wrapper)
        return (m,)


class GTLatentRoll:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "samples": ("LATENT",),
            "x": ("FLOAT", {"default": 0.5, "min": -1.0, "max": 1.0, "step": 0.05}),
            "y": ("FLOAT", {"default": 0.5, "min": -1.0, "max": 1.0, "step": 0.05}),
        }}
    RETURN_TYPES = ("LATENT",)
    FUNCTION = "roll"
    CATEGORY = "latent/transform"

    def roll(self, samples, x, y):
        s = samples["samples"]
        H, W = s.shape[-2], s.shape[-1]
        out = dict(samples)
        out["samples"] = torch.roll(s, shifts=(int(round(y * H)), int(round(x * W))), dims=(-2, -1))
        out.pop("noise_mask", None)
        return (out,)


NODE_CLASS_MAPPINGS = {"GTSeamlessRoll": GTSeamlessRoll, "GTLatentRoll": GTLatentRoll}
NODE_DISPLAY_NAME_MAPPINGS = {"GTSeamlessRoll": "GT Seamless Roll", "GTLatentRoll": "GT Latent Roll"}
