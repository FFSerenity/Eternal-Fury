# Generated models kept for later (not loaded by the game yet)

- `axe_wolf.glb` — the wolf-head rune axe from ComfyUI's Pixal3D template (its own sample image), slimmed with
  `WEAPON=1 ERR=0.01 node tools/slim-gen3d.mjs <raw.glb> <out.glb> 12000 1024`: 12k triangles, 1024 WebP maps, stood up like the
  hero weapons (handle +y, blade +x, origin at the grip). Waiting for the axe style. Note: hero weapons share one material today
  (heroGrip's MAT_W), so a generated weapon will need its own.
