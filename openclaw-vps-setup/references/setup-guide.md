# OpenClaw VPS Setup — Command Reference

This file contains the exact commands and configurations for each phase. Claude executes these via SSH — the user only acts when explicitly told.

All IP addresses in examples use placeholders: `<PUBLIC_IP>` for the server's public IPv4, `<TAILSCALE_IP>` for the Tailscale address (typically 100.x.x.x).

## Phase 0: Provision the VPS

### What to tell the user (they do this in Hetzner Cloud dashboard)

1. Go to https://console.hetzner.cloud
2. Create a new project (or use existing)
3. Click "Add Server"
4. **Location**: Choose closest to the user. Options: Falkenstein (DE), Nuremberg (DE), Helsinki (FI), Ashburn (US-East), Hillsboro (US-West), Singapore (SG)
5. **Image**: Debian 12 or Debian 13
6. **Type**: Shared vCPU → CX33 (4 vCPU, 8 GB RAM, 80 GB SSD disk)
   - Cost: approximately €7.50/month
7. **SSH Key**: If user has one, add it. If not, skip (we'll use password initially then switch to Tailscale SSH)
8. **Root password**: Generate a strong random one. Tell the user to save it in a password manager.
9. Click Create & Buy

After creation, the user provides Claude with:
- The public IPv4 address
- The root password

Claude then connects via SSH: `ssh root@<PUBLIC_IP>` and handles everything from here.

---

## Phase 1: VPS Initial Hardening

Claude executes all commands via SSH as root initially, then switches to the non-root user.

### 1a. Update system

```bash
apt update && apt upgrade -y
```

If prompted about restarting services, accept the defaults. If a kernel update happened:

```bash
reboot
```

Wait ~30 seconds, reconnect.

### 1b. Install Tailscale VPN

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

Then bring Tailscale up with SSH enabled:

```bash
tailscale up --ssh
```

This prints an auth URL. **Tell the user:** "I need you to open this URL in your browser and log in with your Tailscale account (Google, Microsoft, GitHub, or email)."

After auth completes, Claude gets the Tailscale IP:

```bash
tailscale ip -4
```

Returns something like `100.x.x.x`. Save this — it's used for all further configuration.

Verify Tailscale is running:

```bash
tailscale status
```

### 1c. Create non-root user

Ask the user for their preferred username first (suggest "openclaw" as default).

```bash
adduser <USERNAME>
```

Follow the prompts — set a strong password, other fields can be left blank.

Add to sudo group:

```bash
usermod -aG sudo <USERNAME>
```

### 1d. Harden SSH configuration

**⚠️ BEFORE editing SSH config, verify Tailscale connectivity.**

Test that the Tailscale connection works:

```bash
tailscale status
```

Edit SSH config:

```bash
nano /etc/ssh/sshd_config
```

Find and change these lines (or add if not present):

```
# Bind SSH only to the Tailscale interface
ListenAddress <TAILSCALE_IP>

# Disable root login
PermitRootLogin no

# Disable password authentication (Tailscale SSH handles auth)
PasswordAuthentication no
```

Replace `<TAILSCALE_IP>` with the actual Tailscale IP from step 1b.

Validate the config before restarting:

```bash
sshd -t
```

If no errors, restart SSH:

```bash
systemctl restart ssh
```

**Tell the user:** "I've locked down SSH. The public IP no longer accepts connections. From now on, only Tailscale can reach the server. If anything goes wrong, you can use Hetzner's web console (VNC) from the dashboard."

### 1e. Configure firewall (UFW)

```bash
# Install UFW if not present
apt install ufw -y

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow Tailscale's WireGuard port
ufw allow 41641/udp comment 'Tailscale'

# Do NOT add any rule for port 22/tcp — SSH stays behind Tailscale

# Enable the firewall
ufw enable
```

Verify:

```bash
ufw status verbose
```

Expected output:
```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)

To                         Action      From
--                         ------      ----
41641/udp                  ALLOW IN    Anywhere
41641/udp (v6)             ALLOW IN    Anywhere (v6)
```

**Optional**: Tell user they can also add a Hetzner Cloud Firewall via the dashboard for defense-in-depth.

### 1f. Install Tailscale on local devices

**Tell the user:**
1. Download Tailscale on their Mac/PC: https://tailscale.com/download
2. Download on their phone (iOS/Android) if desired
3. Sign in with the SAME account they used for the server
4. Verify: `tailscale status` should list both devices

---

## Phase 2: OpenClaw Installation

⚠️ From this point, all commands run as the non-root user.

```bash
su - <USERNAME>
```

### 2a. Install OpenClaw

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

During installation, choose these options:
- **Configuration**: Manual (not auto — we want control over every setting)
- **Gateway type**: Local gateway (not cloud)
- **Gateway bind address**: `127.0.0.1` (loopback only — critical for security)
- **Token authentication**: Enable
- **Tailscale exposure**: OFF (we handle network security at OS level)
- **Gateway token**: Auto-generate (save the generated token securely)

### 2b. Configure LLM model

⚠️⚠️⚠️ **CRITICAL: Claude subscription tokens are PROHIBITED** ⚠️⚠️⚠️

**NEVER configure OpenClaw with `claude setup token` or any Claude subscription token — this WILL result in a PERMANENT Anthropic account ban.** Claude subscription access (Pro, Team, Enterprise) is licensed for personal interactive use only. Powering an autonomous agent with it is a Terms of Service violation that results in permanent account termination. There are no exceptions or workarounds.

**Available LLM providers:**

**Option A: Anthropic API key** (recommended for Claude models)
```bash
openclaw config set model.provider anthropic
openclaw config set model.api_key <THEIR_API_KEY>
```

**Option B: OpenAI API key**
```bash
openclaw config set model.provider openai
openclaw config set model.api_key <THEIR_API_KEY>
```

**Option C: ChatGPT Plus/Pro subscription via OpenAI Codex OAuth** (at user's own risk)

This uses the PKCE (Proof Key for Code Exchange) OAuth flow to authenticate with the user's ChatGPT Plus/Pro subscription.

⚠️ **Risk disclaimer**: As of the time this skill was created, this method is known to work with OpenClaw. However, the user proceeds at their own risk — OpenAI's Terms of Service may change at any time, and using a subscription token for an autonomous agent could potentially lead to account restrictions. Recommend the user reviews OpenAI's current ToS before choosing this option.

The wizard path is: `openclaw onboard` → select auth method → `openai-codex`

What happens under the hood (PKCE flow):
1. OpenClaw generates a PKCE verifier/challenge pair and a random state token
2. It constructs an authorization URL: `https://auth.openai.com/oauth/authorize?...` with the challenge, state, and redirect URI
3. It tries to capture the callback on `http://127.0.0.1:1455/auth/callback`
4. **If the callback can't bind** (common on headless VPS without a browser): the user must complete the auth in their browser and then paste the redirect URL or authorization code back into the terminal
5. OpenClaw exchanges the code at `https://auth.openai.com/oauth/token`
6. It extracts the accountId from the access token and stores `{ access_token, refresh_token, expires_at, accountId }`

Since the VPS has no browser, the typical flow is:
1. Run `openclaw onboard` and select `openai-codex`
2. Copy the auth URL and give it to the user
3. User opens the URL in their browser, logs in, authorizes
4. The browser redirects to `http://127.0.0.1:1455/auth/callback?code=...` which won't load (since that's the VPS localhost, not the user's machine)
5. User copies the full redirect URL from the browser address bar
6. Paste it into the terminal to complete the exchange

**Option D: OpenRouter API key**
```bash
openclaw config set model.provider openrouter
openclaw config set model.api_key <THEIR_API_KEY>
```

**Model tiering** (if using API keys): Configure expensive model for planning and cheaper model for execution. Check `openclaw config list` for available model settings.

### 2c. Set API spending limits

**Tell the user** to set these on their provider's dashboard:
- **Anthropic**: console.anthropic.com → Settings → Spending Limits
- **OpenAI**: platform.openai.com → Settings → Billing → Usage limits
- **OpenRouter**: openrouter.ai → Settings → Credits

Recommend: $50-100/month as starting limit, with email alerts at 50% and 80%.

For Codex OAuth users: spending is tied to their existing ChatGPT subscription — monitor usage directly on OpenAI's dashboard.

---

## Phase 3: Telegram Bot Setup

### 3a. Create the bot

**Tell the user** to do this on their phone/desktop Telegram:

1. Open Telegram, search for `@BotFather`
2. Send `/newbot`
3. Choose a display name (e.g., "My OpenClaw Bot")
4. Choose a username (must end in "bot", e.g., "myopenclaw_bot")
5. BotFather gives them a token like `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`
6. User provides this token to Claude

### 3b. Configure Telegram in OpenClaw

Claude runs:

```bash
openclaw config set telegram.bot_token <BOT_TOKEN>
```

Then start pairing:

```bash
openclaw telegram pair
```

**Tell the user:**
1. Open the bot chat in Telegram
2. Send `/start` or the pairing code shown in the terminal
3. Approve the pairing when prompted

### 3c. Enable voice mode (optional)

Claude installs Whisper:

```bash
sudo apt install -y python3-pip ffmpeg
pip3 install openai-whisper --break-system-packages
```

Configure:

```bash
openclaw config set voice.enabled true
openclaw config set voice.provider whisper_local
```

Tell user to test by sending a voice message to the bot.

---

## Phase 4: Configuration & Skills

Claude does all configuration via SSH.

### 4a. Memory system

```bash
openclaw config set compaction.memory_flush.enabled true
openclaw config set memory_search.experimental.session_memory true
openclaw install qmd
```

### 4b. Heartbeat

```bash
openclaw config set heartbeat.interval 1800
```

### 4c. Identity and user files

```bash
openclaw config show identity
openclaw config set identity.user_name "<USER_NAME>"
openclaw config set identity.timezone "<TIMEZONE>"
```

### 4d. Skills

List and review each skill with the user:

```bash
openclaw skills list
openclaw skills info <SKILL_NAME>
openclaw skills enable <SKILL_NAME>
```

**Skills that need separate accounts:**
- **GitHub**: Separate bot GitHub account with its own PAT
  ```bash
  openclaw config set github.token <BOT_GITHUB_PAT>
  ```
- **Google Drive**: Separate Google account, not personal
- **Email**: Forwarding address, not primary email

### 4e. Gateway dashboard access

The gateway is bound to loopback (127.0.0.1:18789), accessible only via SSH tunnel.

**Tell the user** to run on their LOCAL machine:

```bash
ssh -N -L 18789:127.0.0.1:18789 <USERNAME>@<TAILSCALE_IP>
```

Then open http://localhost:18789 in a browser. Enter the gateway token when prompted.

Shortcut for `~/.ssh/config` on user's machine:

```
Host openclaw
    HostName <TAILSCALE_IP>
    User <USERNAME>
    LocalForward 18789 127.0.0.1:18789
```

Then just: `ssh -N openclaw`
