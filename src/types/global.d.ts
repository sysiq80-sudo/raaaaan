/// <reference types="google.maps" />

declare const process: {
  env: {
    NODE_ENV: string;
    [key: string]: string | undefined;
  };
};

// Fix NodeJS.Timeout vs number conflict for setTimeout/setInterval
declare namespace NodeJS {
  type Timeout = number;
  type Timer = number;
}
