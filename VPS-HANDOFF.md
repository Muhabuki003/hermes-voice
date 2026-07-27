# Handoff prompt — Hermes voice backend (run this in the VPS Claude Code session)

Fix two things in the Hermes voice backend:

**1. Replace the ephemeral Cloudflare quick tunnel with a persistent named tunnel.**
The backend is currently exposed via `cloudflared tunnel --url ...`, which prints a random `trycloudflare.com` URL that changes every restart and doesn't survive reboots or crashes. Replace it with a named Cloudflare Tunnel bound to a fixed hostname:
- `cloudflared tunnel login`, then `cloudflared tunnel create hermes-api`
- Add a DNS route: `cloudflared tunnel route dns hermes-api hermes-api.<your-domain>`
- Write a `config.yml` pointing the tunnel at the local backend port
- Install it as a persistent service: `cloudflared service install`, so it starts on boot and restarts on failure
- Also run the backend process itself under a process supervisor with auto-restart (systemd unit with `Restart=always`, or pm2/docker `--restart unless-stopped` — whatever fits how it's currently run) so a crash or VPS reboot doesn't silently kill the API
- Confirm the backend keeps returning the same `{ response, audio_url }` JSON shape at the new stable URL, and that CORS still allows the Cloudflare Pages frontend origin
- Report back the final stable hostname (e.g. `https://hermes-api.<your-domain>/api/hermes/voice`) — the frontend repo's proxy needs to be pointed at it

**2. Switch the edge-tts voice to British, and slow the pacing.**
- Change the voice to `en-GB-RyanNeural` (currently whatever default/US voice is set)
- Set the edge-tts `rate` parameter to roughly `-8%` to `-12%` (slightly slower than neutral) — this is the main lever edge-tts exposes for natural, unhurried, ChatGPT-style pacing, since its neural voices already handle punctuation-based pausing reasonably well on their own
- Leave pitch at default (`+0Hz`)
- Keep the change as a single named constant/config value (voice + rate) so it's a one-line swap later if the sound isn't right (alternatives to note in a comment: `en-GB-SoniaNeural` for a female voice, `en-GB-ThomasNeural` / `en-GB-LibbyNeural` as other options)
