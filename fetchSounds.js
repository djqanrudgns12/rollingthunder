const https = require('https');

const categories = {
  cartoon: ['cartoon_boing', 'slip_and_fall', 'pop', 'clown_horn', 'slide_whistle_up', 'slide_whistle_down', 'swoosh', 'twang', 'spring_bounce', 'wood_block', 'cowbell'],
  impacts: ['wood_hit_metal', 'crash', 'smash', 'metal_clang', 'punch', 'slap', 'thud', 'glass_shatter', 'boulder_drop'],
  magic: ['magical_ping', 'fairy_dust', 'magic_sweep', 'wand_sparkle', 'spell_cast', 'chime', 'glissando'],
  science_fiction: ['sci_fi_hovercraft_pass_by', 'sci_fi_door_open', 'sci_fi_laser_gun', 'sci_fi_sweep', 'sci_fi_pulse', 'alien_blaster', 'robot_movement', 'force_field', 'teleport'],
  doors: ['wood_door_close_heavy', 'door_slam_heavy', 'metal_door_slam', 'creaky_door', 'sliding_door'],
  foley: ['metal_click', 'plastic_click', 'wood_click', 'switch', 'button_press'],
  water: ['water_drop', 'splash_small', 'water_plunge', 'bubbles'],
  tools: ['ratchet_turn', 'hammer_hit']
};

async function checkUrl(url) {
  return new Promise(resolve => {
    https.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

async function run() {
  const valid = [];
  for (const [cat, files] of Object.entries(categories)) {
    for (const f of files) {
      const url = `https://actions.google.com/sounds/v1/${cat}/${f}.ogg`;
      const ok = await checkUrl(url);
      if (ok) {
        valid.push(url);
      }
    }
  }
  console.log(JSON.stringify(valid, null, 2));
}
run();
