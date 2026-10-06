// Firebase Messaging (FCM topic push) and Google Sign-In are wired for Android only. iOS push needs
// an APNs key + GoogleService-Info.plist and Google Sign-In needs an iOS client ID first; until
// those exist, keep them out of the committed ios/ project so the iOS build is unchanged.
module.exports = {
  dependencies: {
    '@react-native-firebase/app': { platforms: { ios: null } },
    '@react-native-firebase/messaging': { platforms: { ios: null } },
    '@react-native-google-signin/google-signin': { platforms: { ios: null } },
  },
};
