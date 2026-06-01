const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

export default {
  expo: {
    name: "HitchLink",
    slug: "hitchlink_mobileApp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    scheme: "HitchLink",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.HitchLink.app",
      config: {
        googleMapsApiKey,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "HitchLink uses your location to show your position on the map and share ETA with your dispatcher.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "HitchLink uses your location to share live position and ETA with your dispatcher while you drive.",
        NSCameraUsageDescription:
          "HitchLink uses your camera to capture proof of delivery photos.",
        NSPhotoLibraryUsageDescription:
          "HitchLink accesses your photo library to attach delivery proof images.",
        NSMicrophoneUsageDescription:
          "HitchLink uses your microphone to record voice messages for your dispatcher.",
        UIBackgroundModes: ["remote-notification", "audio"],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.HitchLink.app",
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_MEDIA_IMAGES",
        "RECORD_AUDIO",
      ],
    },
    web: {
      bundler: "metro",
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "da84094d-9cb8-4847-9416-984dd766ba83",
      },
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
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
            "HitchLink uses your location to share live position and ETA with your dispatcher while you drive.",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#0193ab",
          androidMode: "default",
          androidCollapsedTitle: "HitchLink",
        },
      ],
      "expo-image-picker",
      [
        "expo-audio",
        {
          microphonePermission:
            "HitchLink uses your microphone to record voice messages for your dispatcher.",
        },
      ],
    ],
  },
};
