const { withAndroidManifest } = require('expo/config-plugins');

// expo-notifications writes Firebase's default notification channel/color/icon meta-data, and the
// @react-native-firebase/messaging library manifest declares the same keys with its own defaults,
// which fails the manifest merge. Declare the app's values with tools:replace so they win.
//
// The entries are created here (not just annotated) because plugin mods run in an order we don't
// control: on a clean prebuild this can run before expo-notifications adds them. When
// expo-notifications runs later it only updates the value attribute, so tools:replace survives.
const ENTRIES = [
  { name: 'com.google.firebase.messaging.default_notification_channel_id', attr: 'android:value', value: 'default_app_channel' },
  { name: 'com.google.firebase.messaging.default_notification_color', attr: 'android:resource', value: '@color/notification_icon_color' },
  { name: 'com.google.firebase.messaging.default_notification_icon', attr: 'android:resource', value: '@drawable/notification_icon' },
];

module.exports = function withFirebaseNotificationMetaOverride(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';
    const app = manifest.application?.[0];
    if (!app) return cfg;
    app['meta-data'] = app['meta-data'] || [];
    for (const entry of ENTRIES) {
      let meta = app['meta-data'].find((m) => m.$['android:name'] === entry.name);
      if (!meta) {
        meta = { $: { 'android:name': entry.name, [entry.attr]: entry.value } };
        app['meta-data'].push(meta);
      }
      meta.$['tools:replace'] = entry.attr;
    }
    return cfg;
  });
};
