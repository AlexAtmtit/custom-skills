# Security Verification Checklist

This checklist is MANDATORY. Every test must pass before the setup is considered complete. If any test fails, stop and fix it before continuing.

Guide the user through each test, explain what you're checking and what the expected result is. Celebrate each pass — it builds confidence that the security is real.

---

## Test 1: Public SSH is Blocked

**What we're verifying:** Nobody on the public internet can reach SSH on this server.

**How to test** (run from the user's LOCAL machine, with Tailscale disconnected or using a different network):

```bash
# Try SSH via public IP — this MUST fail (timeout or connection refused)
ssh -o ConnectTimeout=5 openclaw@<PUBLIC_IP>
```

**Expected result:** Connection times out or is refused. No prompt appears.

**If it fails (connection succeeds):** SSH is still listening on the public interface. Check:
```bash
# On the server:
ss -tlnp | grep sshd
```
The output should show sshd listening ONLY on the Tailscale IP, not on `0.0.0.0` or the public IP.

Fix: Re-edit `/etc/ssh/sshd_config` and verify `ListenAddress` is set to the Tailscale IP only.

---

## Test 2: Tailscale SSH Works

**What we're verifying:** The private VPN tunnel provides reliable access.

**How to test** (from user's LOCAL machine, with Tailscale connected):

```bash
# Connect via Tailscale IP — this MUST succeed
ssh openclaw@<TAILSCALE_IP>
```

**Expected result:** Login succeeds. The user gets a shell prompt.

**If it fails:**
- Check Tailscale is running on both devices: `tailscale status`
- Check both devices are on the same Tailnet (same account)
- Check firewall allows UDP 41641: `sudo ufw status`

---

## Test 3: Root Login is Disabled

**What we're verifying:** Even if someone knows the root password, they can't log in remotely.

**How to test:**

```bash
# Try root login via Tailscale — this MUST fail
ssh root@<TAILSCALE_IP>
```

**Expected result:** "Permission denied" or similar rejection. No shell.

**If it fails:** Re-check `/etc/ssh/sshd_config` for `PermitRootLogin no` and restart SSH.

Also verify on the server:

```bash
grep -i "PermitRootLogin" /etc/ssh/sshd_config
```

Should output: `PermitRootLogin no`

---

## Test 4: Firewall Rules are Correct

**What we're verifying:** Only explicitly allowed traffic gets through.

**How to test** (on the server):

```bash
sudo ufw status verbose
```

**Expected output:**
```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)

To                         Action      From
--                         ------      ----
41641/udp                  ALLOW IN    Anywhere
41641/udp (v6)             ALLOW IN    Anywhere (v6)
```

**What to check:**
- ✅ Status is `active`
- ✅ Default incoming is `deny`
- ✅ Default outgoing is `allow`
- ✅ Only UDP 41641 is allowed in (for Tailscale)
- ❌ There should be NO rule for TCP 22 (SSH port)
- ❌ There should be NO rule for TCP 18789 (gateway port)
- ❌ There should be NO rule for `Anywhere` on TCP

**If extra rules exist:** Remove them:
```bash
sudo ufw delete allow <PORT>/<PROTOCOL>
```

---

## Test 5: OpenClaw Runs as Non-Root

**What we're verifying:** The bot process doesn't have root privileges. If compromised, damage is limited.

**How to test** (on the server):

```bash
# Check what user the OpenClaw process runs as
ps aux | grep -i openclaw | grep -v grep
```

**Expected result:** The USER column shows `openclaw` (or whatever non-root username was chosen). It should NOT show `root`.

**Additional check:**

```bash
# Verify the non-root user cannot sudo without password
sudo -l -U openclaw
```

This should require a password prompt (which the bot doesn't know).

Also verify the OpenClaw home directory ownership:

```bash
ls -la /home/openclaw/.openclaw/ 2>/dev/null || ls -la /home/openclaw/
```

Files should be owned by `openclaw`, not `root`.

---

## Test 6: Gateway is Loopback-Only

**What we're verifying:** The OpenClaw web dashboard is not accessible from the network — only via SSH tunnel.

**How to test** (on the server):

```bash
# Check what address the gateway listens on
ss -tlnp | grep 18789
```

**Expected result:** Shows `127.0.0.1:18789` — NOT `0.0.0.0:18789` or `*:18789`.

**Remote test** (from user's LOCAL machine, without SSH tunnel):

```bash
# Try to reach gateway via public IP — MUST fail
curl -s --connect-timeout 5 http://<PUBLIC_IP>:18789

# Try to reach gateway via Tailscale IP — MUST also fail (it's loopback-only)
curl -s --connect-timeout 5 http://<TAILSCALE_IP>:18789
```

**Expected result:** Both attempts fail (timeout or connection refused).

**Test that SSH tunnel works:**

```bash
# Set up the tunnel (on LOCAL machine)
ssh -N -L 18789:127.0.0.1:18789 openclaw@<TAILSCALE_IP> &

# Now access via tunnel — MUST work
curl -s http://localhost:18789
```

**Expected result:** Returns the gateway dashboard HTML or a JSON response.

**If the gateway listens on 0.0.0.0:** Reconfigure OpenClaw gateway to bind to 127.0.0.1 only.

---

## Test 7: Tailscale Disconnect = Total Isolation

**What we're verifying:** Without the VPN active, the server is completely unreachable.

**How to test** (on user's LOCAL machine):

1. Disconnect Tailscale: `tailscale down` (or toggle off in the app)
2. Try to reach the server:

```bash
# SSH via public IP — MUST fail
ssh -o ConnectTimeout=5 openclaw@<PUBLIC_IP>

# SSH via Tailscale IP — MUST fail (Tailscale is down)
ssh -o ConnectTimeout=5 openclaw@<TAILSCALE_IP>

# HTTP to gateway via public IP — MUST fail
curl -s --connect-timeout 5 http://<PUBLIC_IP>:18789
```

3. Reconnect Tailscale: `tailscale up`
4. Verify access is restored: `ssh openclaw@<TAILSCALE_IP>`

**Expected result:** All connection attempts fail while Tailscale is disconnected. Access restores immediately after reconnecting.

---

## Test 8: Telegram Bot Responds

**What we're verifying:** The bot is alive and processing messages through Telegram.

**How to test:**

1. Open Telegram on user's device
2. Open the bot chat
3. Send a test message (e.g., "Hello, are you there?")
4. The bot should respond within a few seconds

**If no response:**
- Check OpenClaw is running: `systemctl status openclaw` or `ps aux | grep openclaw`
- Check logs: `openclaw logs` or `journalctl -u openclaw -f`
- Verify the Telegram bot token is correctly configured
- Check the server has internet access: `curl -s https://api.telegram.org`

---

## Test 9: Password Authentication is Disabled

**What we're verifying:** SSH only accepts Tailscale-based authentication, not passwords.

**How to test:**

```bash
# Try to force password auth — MUST fail
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no openclaw@<TAILSCALE_IP>
```

**Expected result:** "Permission denied (publickey)" or similar. No password prompt appears.

**Verify on server:**

```bash
grep -i "PasswordAuthentication" /etc/ssh/sshd_config
```

Should output: `PasswordAuthentication no`

---

## Test 10: No Unnecessary Services Exposed

**What we're verifying:** Only the services we need are running and listening.

**How to test** (on the server):

```bash
# List all listening TCP ports
ss -tlnp
```

**Expected result:** You should see:
- `127.0.0.1:18789` — OpenClaw gateway (loopback only) ✅
- `<TAILSCALE_IP>:22` — SSH (Tailscale-only) ✅
- Possibly `127.0.0.1:*` for internal services ✅

You should NOT see:
- `0.0.0.0:22` — SSH on all interfaces ❌
- `0.0.0.0:18789` — Gateway on all interfaces ❌
- `0.0.0.0:<ANY_PORT>` — Any service listening on all interfaces ❌

```bash
# Also check UDP
ss -ulnp
```

**If unexpected services are listening on 0.0.0.0:** Investigate each one and either reconfigure to loopback or disable if not needed.

---

## Security Summary Document

After all tests pass, provide this summary to the user:

```
╔══════════════════════════════════════════════════════════╗
║          OPENCLAW VPS SECURITY SUMMARY                   ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Server: <PUBLIC_IP> (Hetzner CX33)                      ║
║  Specs: 4 vCPU / 8 GB RAM / 80 GB SSD                   ║
║  Tailscale IP: <TAILSCALE_IP>                            ║
║  User: openclaw (non-root)                               ║
║                                                          ║
║  SECURITY LAYERS:                                        ║
║  ✅ SSH bound to Tailscale IP only                       ║
║  ✅ Root login disabled                                  ║
║  ✅ Password authentication disabled                     ║
║  ✅ UFW firewall active (deny all, allow Tailscale)      ║
║  ✅ OpenClaw gateway on loopback only (127.0.0.1)        ║
║  ✅ Bot runs as non-root user                            ║
║  ✅ Token authentication enabled on gateway              ║
║  ✅ Voice processing runs locally (no external API)      ║
║  ✅ No Claude subscription tokens (= account ban)        ║
║                                                          ║
║  ACCESS METHODS:                                         ║
║  • SSH: ssh openclaw@<TAILSCALE_IP>                      ║
║  • Dashboard: ssh -N -L 18789:127.0.0.1:18789           ║
║    openclaw@<TAILSCALE_IP> → http://localhost:18789      ║
║  • Bot: via Telegram                                     ║
║                                                          ║
║  ONGOING RULES:                                          ║
║  • NEVER use Claude subscription tokens (= ban)          ║
║  • ChatGPT Plus OAuth: at your own risk                  ║
║  • Never connect primary email to the bot                ║
║  • Use separate accounts for all integrations            ║
║  • Review API spending weekly                            ║
║  • Run apt update && apt upgrade periodically            ║
║  • Audit skills before enabling (check data flow)        ║
║  • Review Tailscale device list for unknown entries       ║
║                                                          ║
║  VERIFICATION DATE: <TODAY'S DATE>                       ║
║  ALL 10 SECURITY TESTS: PASSED ✅                        ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

## Emergency Recovery

If the user gets locked out:

1. **Hetzner Web Console**: Go to Hetzner Cloud Dashboard → Server → Console (VNC). This gives direct access regardless of SSH/Tailscale status.
2. **From the console**, check Tailscale: `tailscale status`
3. If Tailscale is down: `tailscale up --ssh`
4. If SSH config is broken: edit `/etc/ssh/sshd_config` from the console and restart SSH
5. If firewall is blocking everything: `ufw disable` temporarily, fix rules, re-enable

Always keep the Hetzner dashboard credentials safe — it's the last-resort access method.
