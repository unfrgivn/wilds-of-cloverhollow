import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.unfrgivn.cloverhollow",
  appName: "Cloverhollow",
  webDir: process.env.CLOVERHOLLOW_WEB_DIR ?? "dist",
  backgroundColor: "#f8edcf",
  ios: {
    loggingBehavior: "debug",
    scrollEnabled: false,
    zoomEnabled: false,
    contentInset: "never",
  },
};

export default config;
