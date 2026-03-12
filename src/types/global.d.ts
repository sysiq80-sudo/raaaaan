/// <reference types="google.maps" />

// Use ReturnType to avoid NodeJS.Timeout vs number conflicts
type TimerId = ReturnType<typeof setTimeout>;

declare namespace NodeJS {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Timeout extends Number {}
  interface Timer {}
}

declare const process: {
  env: {
    NODE_ENV: string;
    [key: string]: string | undefined;
  };
};
