## GitHub Copilot Chat

- Extension: 0.37.6 (prod)
- VS Code: 1.109.3 (b6a47e94e326b5c209d118cf0f994d6065585705)
- OS: win32 10.0.26200 x64
- GitHub Account: sysiq80-sudo

## Network

User Settings:
```json
  "http.systemCertificatesNode": false,
  "github.copilot.advanced.debug.useElectronFetcher": true,
  "github.copilot.advanced.debug.useNodeFetcher": false,
  "github.copilot.advanced.debug.useNodeFetchFetcher": true
```

Connecting to https://api.github.com:
- DNS ipv4 Lookup: 140.82.121.5 (41 ms)
- DNS ipv6 Lookup: Error (15 ms): getaddrinfo ENOTFOUND api.github.com
- Proxy URL: None (1 ms)
- Electron fetch (configured): HTTP 200 (75 ms)
- Node.js https: HTTP 200 (228 ms)
- Node.js fetch: HTTP 200 (73 ms)

Connecting to https://api.githubcopilot.com/_ping:
- DNS ipv4 Lookup: 140.82.112.22 (14 ms)
- DNS ipv6 Lookup: Error (12 ms): getaddrinfo ENOTFOUND api.githubcopilot.com
- Proxy URL: None (11 ms)
- Electron fetch (configured): HTTP 200 (551 ms)
- Node.js https: HTTP 200 (524 ms)
- Node.js fetch: HTTP 200 (513 ms)

Connecting to https://copilot-proxy.githubusercontent.com/_ping:
- DNS ipv4 Lookup: 20.250.119.64 (87 ms)
- DNS ipv6 Lookup: Error (74 ms): getaddrinfo ENOTFOUND copilot-proxy.githubusercontent.com
- Proxy URL: None (1 ms)
- Electron fetch (configured): HTTP 200 (397 ms)
- Node.js https: HTTP 200 (409 ms)
- Node.js fetch: HTTP 200 (429 ms)

Connecting to https://mobile.events.data.microsoft.com: HTTP 404 (113 ms)
Connecting to https://dc.services.visualstudio.com: HTTP 404 (729 ms)
Connecting to https://copilot-telemetry.githubusercontent.com/_ping: HTTP 200 (524 ms)
Connecting to https://copilot-telemetry.githubusercontent.com/_ping: HTTP 200 (546 ms)
Connecting to https://default.exp-tas.com: HTTP 400 (515 ms)

Number of system certificates: 42

## Documentation

In corporate networks: [Troubleshooting firewall settings for GitHub Copilot](https://docs.github.com/en/copilot/troubleshooting-github-copilot/troubleshooting-firewall-settings-for-github-copilot).
