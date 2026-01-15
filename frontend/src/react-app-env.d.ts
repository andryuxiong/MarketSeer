/// <reference types="react-scripts" />

interface ImportMetaEnv {
  readonly REACT_APP_API_URL: string;
  readonly REACT_APP_FINNHUB_API_KEY: string;
  // add more env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
