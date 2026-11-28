# Top-down orthographic shot of the camp's painted ground only (no props, no units, flat light): python3 topdown.py out.png [size] [urlextra]
import asyncio, sys, base64
from playwright.async_api import async_playwright
async def main():
    size = int(sys.argv[2]) if len(sys.argv) > 2 else 2048
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1000, 'height': 800})
        await pg.add_init_script("if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('graveTamerLang', 'zh'); sessionStorage.setItem('seeded', '1'); }")
        await pg.goto('http://localhost:8765/index.html?mode=pact&rs=1&paint=1' + (sys.argv[3] if len(sys.argv) > 3 else ''))
        await pg.wait_for_function('window.__gt && __gt.A.ready && __gt.G.floor', timeout=90000)
        await pg.click('#bStart'); await pg.wait_for_timeout(3000)
        url = await pg.evaluate(f"""(() => {{
          const T = __gt.THREE, r = __gt.renderer, sc = __gt.scene, keep = [];
          __gt.G.floor.group.traverse(o => {{ if (o.isMesh && o.material && o.material.uniforms && (o.material.uniforms.uSplat || o.material.uniforms.uStone)) keep.push(o); }});
          sc.traverse(o => {{ o.visible = false; }}); for (const k of keep) {{ let q = k; while (q) {{ q.visible = true; q = q.parent; }} }}
          for (const k of keep) {{ const u = k.material.uniforms; if (!u.uTone || !u.uAmb) continue; u.uAmb.value.setRGB(0.97, 0.97, 0.97); u.uTone.value.set(1, 1); u.uLight.value.set(-999, 0, -999); for (const t of u.uTL.value) t.w = 0; }}
          const cam = new T.OrthographicCamera(-13, 13, 13, -13, 0.1, 100); cam.up.set(0, 0, -1); cam.position.set(20, 50, 20); cam.lookAt(20, 0, 20); cam.updateMatrixWorld();
          r.setPixelRatio(1); r.setSize({size}, {size}, false); r.setClearColor(0x000000); r.render(sc, cam);
          return r.domElement.toDataURL('image/png'); }})()""")
        open(sys.argv[1], 'wb').write(base64.b64decode(url.split(',')[1]))
        await b.close()
asyncio.run(main())
