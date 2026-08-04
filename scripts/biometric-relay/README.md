# Biometric attendance relay (Windows)

## Why this exists

The ZKTeco terminal's firmware only accepts an **IP address** as its Cloud Server — it has no
"Enable Domain Name" support on this unit. The ERP runs on Vercel, which offers **no fixed inbound
IP** (Static IPs are Pro/Enterprise, $100/mo, and are *outbound only* — they can't receive traffic).

So the salon PC becomes the fixed address the device can reach. It listens on port `8001` and
forwards every `/iclock/*` request to `https://app.qasralsharsalon.com`, preserving the query
string (`SN`, `table`) and body that the ADMS protocol relies on.

```
Fingerprint terminal ──▶ salon PC :8001 ──▶ https://app.qasralsharsalon.com/iclock/*
   (LAN, plain HTTP)        (relay)              (Vercel, HTTPS)
```

## Install (once)

1. Copy `setup-relay.bat` to the salon PC.
2. **Right-click → Run as administrator.**
3. Note the **IPv4 address** it prints at the end.

It downloads [Caddy](https://caddyserver.com) (a small, widely used reverse proxy), writes the
config, opens port 8001 in Windows Firewall, and adds itself to Startup so it survives reboots.
Re-running it is safe — it just repairs and restarts.

## Then on the fingerprint machine

Menu → Comm. / Network → Cloud Server Setting:

| Setting | Value |
|---|---|
| Server Mode | `ADMS` |
| Server Address | the PC's IPv4 address (e.g. `192.168.1.50`) |
| Server Port | `8001` |
| Enable Proxy Server | `OFF` |

Save, restart the terminal, then do one test scan.

## Important: give the PC a fixed local IP

If the PC's IP changes (DHCP lease), the device stops syncing. Either:

- **Router DHCP reservation** for the PC's MAC (preferred — nothing to configure on Windows), or
- a static IP in Windows network settings.

## Resilience

The terminal buffers punches locally and re-sends anything unacknowledged, and the ingest endpoint
uses `skipDuplicates` — so if the PC is off or the relay is down, **no attendance data is lost**;
it syncs when the relay comes back.

## Verify it's working

On the PC, in a browser: `http://localhost:8001/iclock/cdata?SN=TEST` → expect a response (not a
connection error). A `401` is correct and healthy: it means the request reached the ERP, which
rejected an unknown serial.

Then confirm real punches are landing:

```sql
SELECT "deviceSn", "pin", "punchedAt" FROM "AttendancePunch" ORDER BY "punchedAt" DESC LIMIT 5;
```

## Dev follow-up after the first successful scan

1. Read the device serial from the punch rows (or Menu → System Info).
2. Set `BIOMETRIC_DEVICE_SNS=<serial>` on the **qasr-alshar-erp** Vercel project (locks ingest to
   that device — the allowlist is open only while it's unset), then redeploy.
3. Map each staff member's `biometricPin` in `/erp/attendance`; punches stay unattributed until then.
