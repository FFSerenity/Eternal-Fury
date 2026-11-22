// Build the game's asset bundles from the KayKit packs (CC0, Kay Lousberg).
// Usage: node tools/build-assets.mjs <kaykit-dir>
// - characters: animations stripped, parts joined into one skinned mesh, quantized
// - anims.glb: one shared set of clips (all KayKit characters use the same rig)
// - props_*.glb: selected static models, one named node each, sharing the pack's atlas texture
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, join, quantize, resample, weld, mergeDocuments, unpartition, flatten, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const K = process.argv[2] || '/home/claude/kaykit';
const OUT = path.resolve('assets'); fs.mkdirSync(OUT, { recursive: true });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const COMPRESS = meshopt({ encoder: MeshoptEncoder, level: 'medium' });
// bones that only drive IK helpers (no vertices use them)
const HELPER = /IK|control-/;
function dropAnims(doc) { for (const a of doc.getRoot().listAnimations()) { for (const s of a.listSamplers()) s.dispose(); for (const c of a.listChannels()) c.dispose(); a.dispose(); } }
// gltf-transform's join() skips skinned meshes, so merge parts that share one skin + material by hand
function mergeSkinned(doc) {
  const nodes = doc.getRoot().listNodes().filter(n => n.getMesh() && n.getSkin()); if (nodes.length < 2) return;
  const SZ = { POSITION: 3, NORMAL: 3, TEXCOORD_0: 2, JOINTS_0: 4, WEIGHTS_0: 4 }, out = {}, idx = []; for (const k in SZ) out[k] = []; let base = 0, mat = null;
  for (const n of nodes) for (const p of n.getMesh().listPrimitives()) { mat = mat || p.getMaterial(); const cnt = p.getAttribute('POSITION').getCount();
    for (const k in SZ) { const a = p.getAttribute(k), el = new Array(SZ[k]).fill(0); if (a) for (let i = 0; i < cnt; i++) { a.getElement(i, el); for (let j = 0; j < SZ[k]; j++) out[k].push(el[j]); } else for (let i = 0; i < cnt * SZ[k]; i++) out[k].push(k === 'WEIGHTS_0' && i % 4 === 0 ? 1 : 0); }
    const ind = p.getIndices(); for (let i = 0; i < ind.getCount(); i++) idx.push(ind.getScalar(i) + base); base += cnt; }
  const buf = doc.getRoot().listBuffers()[0], T = { POSITION: 'VEC3', NORMAL: 'VEC3', TEXCOORD_0: 'VEC2', JOINTS_0: 'VEC4', WEIGHTS_0: 'VEC4' };
  const prim = doc.createPrimitive().setMaterial(mat).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(idx)).setBuffer(buf));
  for (const k in SZ) prim.setAttribute(k, doc.createAccessor().setType(T[k]).setArray(k === 'JOINTS_0' ? new Uint16Array(out[k]) : new Float32Array(out[k])).setBuffer(buf));
  const mesh = doc.createMesh('body').addPrimitive(prim); nodes[0].setMesh(mesh).setName('body'); for (const n of nodes.slice(1)) n.dispose();
}
const SK = `${K}/KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons`;
const AD = `${K}/KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures`;
const DG = `${K}/KayKit-Dungeon-Remastered-1.0/addons/kaykit_dungeon_remastered/Assets/gltf`;
const HB = `${K}/KayKit-Halloween-Bits-1.0/addons/kaykit_halloween_bits/Assets/gltf`;
const kb = f => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';

async function character(src, name) {
  const doc = await io.read(src);
  dropAnims(doc); await doc.transform(prune(), flatten()); mergeSkinned(doc);
  await doc.transform(weld(), dedup(), prune(), COMPRESS, unpartition());
  const out = `${OUT}/${name}.glb`; await io.write(out, doc);
  const prims = doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().length, 0);
  console.log(name.padEnd(16), kb(out), 'primitives', prims);
}
async function anims(src, keep) {
  const doc = await io.read(src), root = doc.getRoot();
  for (const a of root.listAnimations()) { if (!keep.includes(a.getName())) { for (const s of a.listSamplers()) s.dispose(); for (const c of a.listChannels()) c.dispose(); a.dispose(); continue; }
    for (const c of a.listChannels()) { const n = c.getTargetNode(); if (!n || HELPER.test(n.getName()) || c.getTargetPath() === 'scale') { c.getSampler().dispose(); c.dispose(); } } }
  for (const n of root.listNodes()) { if (n.getMesh()) n.setMesh(null); if (n.getSkin()) n.setSkin(null); }
  await doc.transform(resample({ tolerance: 0.0005 }), prune({ keepLeaves: true }), dedup(), COMPRESS, unpartition());
  const out = `${OUT}/anims.glb`; await io.write(out, doc);
  console.log('anims'.padEnd(16), kb(out), root.listAnimations().map(a => a.getName()).join(' '));
}
async function props(name, files) {
  const doc = new Document(); doc.createBuffer();
  for (const [key, f] of files) {
    const d = await io.read(f); const map = mergeDocuments(doc, d);
    // put the merged scene's top nodes under one node named after the prop
    const sc = map.get(d.getRoot().listScenes()[0]); const holder = doc.createNode(key);
    for (const n of sc.listChildren()) { sc.removeChild(n); holder.addChild(n); }
    sc.dispose();
    let main = doc.getRoot().listScenes()[0]; if (!main || main === sc) main = doc.getRoot().listScenes().find(s => !s.isDisposed()) || doc.createScene('props');
    main.addChild(holder);
  }
  const scenes = doc.getRoot().listScenes(); for (let i = 1; i < scenes.length; i++) { for (const n of scenes[i].listChildren()) { scenes[i].removeChild(n); scenes[0].addChild(n); } scenes[i].dispose(); }
  for (const b of doc.getRoot().listBuffers().slice(1)) b.dispose();
  const buf = doc.getRoot().listBuffers()[0]; for (const a of doc.getRoot().listAccessors()) a.setBuffer(buf);
  await doc.transform(dedup(), prune(), COMPRESS, unpartition());
  const out = `${OUT}/${name}.glb`; await io.write(out, doc);
  console.log(name.padEnd(16), kb(out), files.length, 'models,', doc.getRoot().listTextures().length, 'texture(s)');
}

const CL = `${SK}/Characters/gltf`;
await character(`${AD}/Characters/gltf/Mage.glb`, 'mage');
for (const [n, f] of [['sk_minion', 'Skeleton_Minion'], ['sk_warrior', 'Skeleton_Warrior'], ['sk_rogue', 'Skeleton_Rogue'], ['sk_mage', 'Skeleton_Mage']]) await character(`${CL}/${f}.glb`, n);
await anims(`${CL}/Skeleton_Minion.glb`, ['Idle', 'Idle_Combat', 'Unarmed_Idle', 'Walking_A', 'Walking_D_Skeletons', 'Running_A', 'Running_B',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Stab', '1H_Melee_Attack_Slice_Diagonal', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Spin', '1H_Ranged_Shoot', '2H_Ranged_Shoot',
  'Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Summon', 'Spellcasting', 'Spellcast_Long', 'Hit_A', 'Hit_B', 'Death_A', 'Death_A_Pose', 'Death_C_Skeletons', 'Death_C_Pose',
  'Death_C_Skeletons_Resurrect', 'Skeletons_Awaken_Floor', 'Skeletons_Inactive_Floor_Pose', 'Spawn_Ground_Skeletons', 'Taunt', 'Cheer',
  '1H_Melee_Attack_Jump_Chop', 'Dodge_Forward', 'Running_C']);
const SA = `${SK}/Assets/gltf`, AA = `${AD}/Assets/gltf`;
await props('weapons', [['sk_axe', `${SA}/Skeleton_Axe.gltf`], ['sk_blade', `${SA}/Skeleton_Blade.gltf`], ['sk_crossbow', `${SA}/Skeleton_Crossbow.gltf`], ['sk_staff', `${SA}/Skeleton_Staff.gltf`],
  ['sk_shield', `${SA}/Skeleton_Shield_Small_A.gltf`], ['sk_arrow', `${SA}/Skeleton_Arrow.gltf`], ['mage_staff', `${AA}/staff.gltf`], ['spellbook', `${AA}/spellbook_open.gltf`]]);
const dg = n => [n, fs.existsSync(`${DG}/${n}.gltf.glb`) ? `${DG}/${n}.gltf.glb` : `${DG}/${n}.glb`];
await props('dungeon', ['floor_tile_small', 'floor_tile_small_broken_A', 'floor_tile_small_broken_B', 'floor_tile_small_weeds_A', 'floor_tile_small_decorated', 'floor_dirt_small_A',
  'wall_half', 'pillar', 'torch_mounted', 'barrel_small', 'barrel_large', 'box_large', 'box_small', 'crates_stacked', 'chest', 'chest_gold', 'candle_lit', 'candle_triple', 'column',
  'banner_red', 'banner_patternA_blue', 'rubble_half', 'floor_tile_big_grate_open', 'trunk_large_A', 'table_medium_broken', 'keg', 'coin_stack_small',
  'floor_tile_small_weeds_B', 'floor_tile_large_rocks', 'floor_dirt_large', 'floor_dirt_large_rocky', 'floor_dirt_small_B', 'floor_dirt_small_C', 'floor_dirt_small_D', 'floor_dirt_small_weeds'].map(dg));
const hb = n => [n, `${HB}/${n}.gltf`];
await props('graveyard', ['crypt', 'fence', 'fence_broken', 'fence_pillar', 'fence_gate', 'grave_A', 'grave_B', 'gravestone', 'gravemarker_A', 'gravemarker_B', 'floor_dirt', 'floor_dirt_grave',
  'path_A', 'path_B', 'path_C', 'path_D', 'tree_dead_large', 'tree_dead_medium', 'tree_dead_small', 'tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_yellow_medium',
  'lantern_standing', 'post_lantern', 'arch_gate', 'shrine_candles', 'coffin', 'bench', 'pumpkin_orange_jackolantern', 'pumpkin_yellow_small', 'skull_candle', 'bone_A', 'bone_B', 'ribcage',
  'candle_triple', 'post_skull', 'tree_pine_yellow_large', 'tree_dead_large_decorated', 'grave_A_destroyed', 'lantern_hanging', 'pumpkin_yellow_jackolantern', 'candle_melted',
  'shrine', 'skull', 'bone_C', 'plaque_candles', 'floor_dirt_small', 'fence_pillar_broken', 'bench_decorated', 'coffin_decorated', 'tree_pine_orange_small', 'tree_pine_yellow_small'].map(hb));
