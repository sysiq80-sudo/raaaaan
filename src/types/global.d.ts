/* eslint-disable @typescript-eslint/no-empty-interface */
/// <reference types="google.maps" />

// Ensure process.env works in browser context
declare const process: {
  env: {
    NODE_ENV: string;
    [key: string]: string | undefined;
  };
};

// Force browser setTimeout/setInterval signatures (return number, not NodeJS.Timeout)
// This resolves conflicts when @types/node is pulled in transitively
declare global {
  function setTimeout(handler: TimerHandler, timeout?: number, ...arguments: any[]): number;
  function clearTimeout(id: number | undefined): void;
  function setInterval(handler: TimerHandler, timeout?: number, ...arguments: any[]): number;
  function clearInterval(id: number | undefined): void;
}

export {};
