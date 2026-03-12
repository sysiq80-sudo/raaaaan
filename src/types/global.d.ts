/// <reference types="google.maps" />

declare namespace NodeJS {
  interface Timeout {}
  interface Timer {}
}

declare const process: {
  env: {
    NODE_ENV: string;
    [key: string]: string | undefined;
  };
};
