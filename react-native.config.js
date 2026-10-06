// Firebase Messaging (FCM topic push) and Google Sign-In are Android-only for now: iOS push needs
// an APNs key + GoogleService-Info.plist, and native Google Sign-In needs an iOS client ID (iOS
// uses Supabase browser OAuth instead).
//
// Two switches keep them out of the iOS app and must stay in sync:
//  - package.json `expo.autolinking.ios.exclude` stops Expo autolinking from adding their pods;
//  - this file stops React Native codegen from registering their Fabric components (otherwise the
//    generated RCTThirdPartyComponentsProvider references a class that isn't linked and crashes).
const iosOnlyDisabled = { platforms: { ios: null } };

module.exports = {
  dependencies: {
    '@react-native-firebase/app': iosOnlyDisabled,
    '@react-native-firebase/messaging': iosOnlyDisabled,
    '@react-native-google-signin/google-signin': iosOnlyDisabled,
  },
};
