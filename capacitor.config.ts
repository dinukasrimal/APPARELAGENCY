import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.apparelflow.agency',
  appName: 'apparel-agency-flow',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#ffffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#999999"
    },
    Camera: {
      permissions: ['camera']
    },
    Geolocation: {
      permissions: ['location']
    }
  },
  android: {
    permissions: [
      'android.permission.CAMERA',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.INTERNET',
      'android.permission.ACCESS_WIFI_STATE'
    ]
  }
};

export default config;
