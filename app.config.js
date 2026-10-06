const fs = require('fs');
const path = require('path');

// Base config lives in app.json. Firebase (FCM topic push, see services/pushService.ts) is only
// enabled when google-services.json for com.finrein.pals is present: locally at the project root,
// or on EAS via a file environment variable named GOOGLE_SERVICES_JSON.
module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : undefined);

  if (!googleServicesFile) return config;

  return {
    ...config,
    android: { ...config.android, googleServicesFile },
    plugins: [...config.plugins, '@react-native-firebase/app', '@react-native-firebase/messaging'],
  };
};
