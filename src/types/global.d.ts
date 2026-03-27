/// <reference types="google.maps" />

// Browser environment shims
declare const process: {
  env: {
    NODE_ENV: string;
    [key: string]: string | undefined;
  };
};
