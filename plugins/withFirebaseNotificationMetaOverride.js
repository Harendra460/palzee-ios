const { withAndroidManifest } = require('expo/config-plugins');

// expo-notifications writes Firebase's default notification channel/color/icon meta-data, and the
// @react-native-firebase/messaging library manifest declares the same keys with its own defaults.
// Mark the app's entries tools:replace so the app values win the manifest merge.
const KEYS = {
  'com.google.firebase.messaging.default_notification_channel_id': 'android:value',
  'com.google.firebase.messaging.default_notification_color': 'android:resource',
  'com.google.firebase.messaging.default_notification_icon': 'android:resource',
};

module.exports = function withFirebaseNotificationMetaOverride(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';
    for (const meta of manifest.application?.[0]?.['meta-data'] ?? []) {
      const attr = KEYS[meta.$['android:name']];
      if (attr) meta.$['tools:replace'] = attr;
    }
    return cfg;
  });
};
