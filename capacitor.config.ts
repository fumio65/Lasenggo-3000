import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lasenggo3000.app',
  appName: 'Lasenggo',
  webDir: 'dist',
  // app/animated-splash: native splash stays up until the web app
  // explicitly hides it (SplashScreen.hide(), called from AppSplash.jsx
  // the instant it mounts) -- with launchAutoHide left on, Capacitor's
  // default 3s auto-hide timer could fire mid-handoff and show a blank
  // flash before the web splash paints, or hide the native one while the
  // web one is still animating. backgroundColor matches the native
  // splash.png's own fill so there's no color seam even in the single
  // frame before React mounts.
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#191310',
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
