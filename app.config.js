const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

export default {
  expo: {
    name: "dispatchR",
    slug: "dispatchR_mobileApp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    scheme: "dispatchr",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#08090e",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.dispatchr.app",
      config: {
        googleMapsApiKey,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "DispatchR uses your location to show your position on the map and share ETA with your dispatcher.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "DispatchR uses your location to share live position and ETA with your dispatcher while you drive.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#08090e",
      },
      package: "com.dispatchr.app",
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
      permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    },
    web: {
      bundler: "metro",
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-document-picker",
        {
          iCloudContainerEnvironment: "Production",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "DispatchR uses your location to share live position and ETA with your dispatcher while you drive.",
        },
      ],
    ],
  },
};
