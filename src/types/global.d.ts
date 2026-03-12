/// <reference types="google.maps" />

declare const process: {
  env: {
    NODE_ENV: string;
    [key: string]: string | undefined;
  };
};

// Override setTimeout/clearTimeout to always return number (browser environment)
declare function setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): number;
declare function clearTimeout(id: number | undefined): void;
declare function setInterval(callback: (...args: any[]) => void, ms?: number, ...args: any[]): number;
declare function clearInterval(id: number | undefined): void;
