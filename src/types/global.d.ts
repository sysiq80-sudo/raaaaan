/// <reference types="google.maps" />

// Browser environment shims
declare const process: {
  env: {
    NODE_ENV: string;
    [key: string]: string | undefined;
  };
};

// Ensure NodeJS.Timeout is compatible with number for clearTimeout
declare namespace NodeJS {
  // Make Timeout assignable to number parameter
  type Timeout = ReturnType<typeof globalThis.setTimeout>;
  type Timer = ReturnType<typeof globalThis.setInterval>;
}
