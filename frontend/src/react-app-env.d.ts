/// <reference types="react-scripts" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_FINNHUB_API_KEY: string;
  // add more env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
