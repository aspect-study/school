// Remakes web/assets/sounds/world/ from the clips the user picked by ear for wardrobe 3b and 3c
// (docs/superpowers/specs/2026-10-07-world-sounds-design.md and 2026-10-07-ride-sounds-design.md). Each clip is cut to
// the part she heard, sped up the way the audition's speed buttons did (speed and pitch together), and saved as a
// small mono mp3.
// Needs a temporary ffmpeg that never goes in the project:
//   npm i --prefix <scratch folder> ffmpeg-static
//   node tools/world-sounds.js <scratch folder>/node_modules/ffmpeg-static/ffmpeg.exe
// Credits: Kenney sounds are CC0 (kenney.nl, Impact Sounds and RPG Audio); Mixkit sounds are under the Mixkit Sound
// Effects Free License (mixkit.co/license), ids below.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');

const OUT = path.join(__dirname, '..', 'web', 'assets', 'sounds', 'world');
const KENNEY = {
  impact: 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
  rpg: 'https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip'
};

// rate: speed (and pitch) up; cut: keep the first seconds of the source.
const PICKS = {
  'step-grass.mp3': { mixkit: 1920, name: 'Grass step' },
  'step-stone-1.mp3': { kenney: 'impact', entry: 'Audio/footstep_concrete_000.ogg' },
  'step-stone-2.mp3': { kenney: 'impact', entry: 'Audio/footstep_concrete_001.ogg' },
  'step-stone-3.mp3': { kenney: 'impact', entry: 'Audio/footstep_concrete_002.ogg' },
  'step-stone-4.mp3': { kenney: 'impact', entry: 'Audio/footstep_concrete_003.ogg' },
  'step-stone-5.mp3': { kenney: 'impact', entry: 'Audio/footstep_concrete_004.ogg' },
  'pet-chick.mp3': { mixkit: 67, name: 'Melodic songbird chirp' },
  'pet-kitten.mp3': { mixkit: 91, name: 'Cartoon little cat meow' },
  'pet-puppy.mp3': { mixkit: 741, name: 'Happy puppy barks', rate: 1.25, cut: 1.5 },
  'pet-hamster.mp3': { mixkit: 2873, name: 'Creepy little creature', rate: 1.5 },
  'pet-duckling.mp3': { mixkit: 1014, name: 'Rubber duck squeak' },
  'pet-bunny.mp3': { mixkit: 2210, name: 'Cartoon character cute sneeze' },
  'pop.mp3': { mixkit: 2364, name: 'Hard pop click' },
  'pet-piglet.mp3': { mixkit: 3, name: 'Pig grunting', rate: 1.25, cut: 1.4 },
  'pet-parrot.mp3': { mixkit: 18, name: 'Toy whistler bird sound' },
  'pet-carabao.mp3': { mixkit: 1744, name: 'Cow moo', rate: 1.25 },
  'pet-penguin.mp3': { mixkit: 1882, name: 'Bath duck squeeze' },
  'pet-fox.mp3': { mixkit: 2872, name: 'Funny little creature laughing', rate: 1.5 },
  'pet-tarsier.mp3': { mixkit: 102, name: 'Cartoon baby monkey laugh' },
  'pet-panda.mp3': { mixkit: 2268, name: 'Cartoon vocal yawn' },
  'pet-unicorn.mp3': { mixkit: 1762, name: 'Stallion horse neigh', rate: 1.25 },
  'treat.mp3': { mixkit: 2244, name: 'Chewing something crunchy' },
  'throw.mp3': { mixkit: 1491, name: 'Arrow whoosh' },
  'land.mp3': { kenney: 'impact', entry: 'Audio/impactSoft_medium_000.ogg' },
  'dig.mp3': { mixkit: 1494, name: 'Sand swish' },
  'drop.mp3': { mixkit: 3088, name: 'Tv remote control or plastic toy drop' },
  'spin-whistle.mp3': { mixkit: 2647, name: 'Spinning whistle toy' },
  'trick-land.mp3': { mixkit: 2255, name: 'Cartoon positive sound' },
  'use-balloon.mp3': { mixkit: 3072, name: 'Annoying ballon sounds' },
  'use-bubblewand.mp3': { mixkit: 2999, name: 'Magic bubbles spell' },
  'use-pamaypay.mp3': { mixkit: 1489, name: 'Air woosh' },
  'use-teddy.mp3': { mixkit: 2816, name: 'Clown squeaky toy' },
  'use-bouquet.mp3': { mixkit: 864, name: 'Fairy bell bless' },
  'use-umbrella.mp3': { kenney: 'rpg', entry: 'Audio/cloth3.ogg' },
  'use-ribbonwand.mp3': { mixkit: 1463, name: 'Spellcaster fairy swoosh' },
  'use-drum.mp3': { mixkit: 560, name: 'Toy drums and bell ding' },
  'use-parol.mp3': { mixkit: 2820, name: 'Magic marimba' },
  'use-ukulele.mp3': { mixkit: 2328, name: 'Guitar stroke up' },
  'use-magicwand.mp3': { mixkit: 3062, name: 'Magic wand sparkle' },
  'use-trophy.mp3': { mixkit: 523, name: 'Animated small group applause' },
  'emote-wave.mp3': { mixkit: 861, name: 'Fairy message notification' },
  'emote-clap.mp3': { mixkit: 480, name: 'Clapping fast' },
  'emote-cheer.mp3': { mixkit: 515, name: 'Girls crowd cheer, scream, and applause', cut: 2.5 },
  'emote-bow.mp3': { mixkit: 2344, name: 'Magic notification ring' },
  'emote-heart.mp3': { mixkit: 2194, name: 'Cartoon friendly kiss' },
  'emote-giggle.mp3': { mixkit: 2265, name: 'Happy child laughing' },
  'emote-relax.mp3': { mixkit: 3109, name: 'Relaxing bell chime' },
  'emote-dance.mp3': { mixkit: 2881, name: 'Funny cartoon melody' },
  'emote-cartwheel.mp3': { mixkit: 2888, name: 'Funny video game slide' },
  'emote-hero.mp3': { mixkit: 555, name: 'Achievement win drums' },
  'ride-start.mp3': { mixkit: 2043, name: 'Player jumping in a video game' },
  'swing.mp3': { kenney: 'rpg', entry: 'Audio/creak2.ogg' },
  'seesaw-bump.mp3': { kenney: 'impact', entry: 'Audio/impactWood_light_000.ogg' },
  'merry-start.mp3': { mixkit: 2649, name: 'Spinning magic sound' },
  'merry-slow.mp3': { mixkit: 2822, name: 'Clockwork mechanism sound' },
  'ride-land.mp3': { mixkit: 2070, name: 'Light impact on the ground' }
};

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' → ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

// One file out of a zip, read from its central directory.
function unzip(buf, name) {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('not a zip');
  let p = buf.readUInt32LE(end + 16);
  for (let i = buf.readUInt16LE(end + 10); i > 0; i--) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28);
    const skip = nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    if (buf.toString('utf8', p + 46, p + 46 + nameLen) === name) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return method === 0 ? data : zlib.inflateRawSync(data);
    }
    p += 46 + skip;
  }
  throw new Error(name + ' is not in the zip');
}

function sampleRate(ffmpeg, file) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = /(\d+) Hz/.exec(r.stderr || '');
  if (!m) throw new Error('no sample rate for ' + file);
  return Number(m[1]);
}

function encode(ffmpeg, src, out, pick) {
  const filters = [];
  if (pick.cut) filters.push('atrim=0:' + pick.cut, 'afade=t=out:st=' + (pick.cut - 0.06).toFixed(2) + ':d=0.06');
  if (pick.rate) filters.push('asetrate=' + Math.round(sampleRate(ffmpeg, src) * pick.rate));
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', src];
  if (filters.length) args.push('-af', filters.join(','));
  args.push('-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', out);
  const r = spawnSync(ffmpeg, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('ffmpeg failed on ' + out + ': ' + r.stderr);
}

async function main() {
  const ffmpeg = process.argv[2];
  if (!ffmpeg || !fs.existsSync(ffmpeg)) throw new Error('usage: node tools/world-sounds.js <path to ffmpeg>');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'world-sounds-'));
  const zips = {};
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (!PICKS[f]) fs.unlinkSync(path.join(OUT, f));
  let total = 0;
  for (const [file, pick] of Object.entries(PICKS)) {
    let src;
    if (pick.kenney) {
      zips[pick.kenney] = zips[pick.kenney] || await download(KENNEY[pick.kenney]);
      src = path.join(tmp, path.basename(pick.entry));
      fs.writeFileSync(src, unzip(zips[pick.kenney], pick.entry));
    } else {
      src = path.join(tmp, pick.mixkit + '.mp3');
      fs.writeFileSync(src, await download('https://assets.mixkit.co/active_storage/sfx/' + pick.mixkit + '/' + pick.mixkit + '-preview.mp3'));
    }
    const out = path.join(OUT, file);
    encode(ffmpeg, src, out, pick);
    total += fs.statSync(out).size;
    console.log(file.padEnd(22), (fs.statSync(out).size / 1024).toFixed(1) + ' KB');
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(Object.keys(PICKS).length + ' files, ' + (total / 1024).toFixed(0) + ' KB in all');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
