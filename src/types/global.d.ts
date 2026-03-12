/// <reference types="google.maps" />

declare const process: {
  env: {
    NODE_ENV: string;
    [key: string]: string | undefined;
  };
};

// Fix NodeJS.Timeout vs number conflict between @types/node and lib.dom
declare function clearTimeout(id: any): void;
declare function clearInterval(id: any): void;
