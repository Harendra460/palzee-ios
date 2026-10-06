const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

// Ships the native Palzee Android launcher icons (light/dark adaptive + themed monochrome) and the
// notification drawables that FCM payloads reference by name (e.g. "ic_status_bar_silhouette").
// Files are prefixed pz_launcher_* so they never collide with the icons Expo generates.
const SOURCE_DIR = path.join('assets', 'android-launcher', 'res');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

module.exports = function withAndroidLauncherIcons(config) {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      copyDir(
        path.join(projectRoot, SOURCE_DIR),
        path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res')
      );
      return cfg;
    },
  ]);

  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:icon'] = '@mipmap/pz_launcher';
      app.$['android:roundIcon'] = '@mipmap/pz_launcher_round';
    }
    return cfg;
  });
};
