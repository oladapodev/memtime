#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════════
#  ForkBot — GitHub App Setup Script
#  Run this script to set up secrets and deploy ForkBot.
#  It will guide you through each step.
# ════════════════════════════════════════════════════════════════

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

BASE_URL="https://forkbot-api.oladapo.workers.dev"

echo ""
echo -e "${BOLD}${CYAN}  ╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}  ║           ForkBot — GitHub App Setup            ║${NC}"
echo -e "${BOLD}${CYAN}  ╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${DIM}Your Worker is deployed at:${NC} ${BOLD}${BASE_URL}${NC}"
echo ""

# ──────────────────────────────────────────────────────────────
# STEP 0: Generate webhook secret
# ──────────────────────────────────────────────────────────────
echo -e "${BOLD}${YELLOW}[Step 0] Generate webhook secret${NC}"
echo -e "${DIM}  This will be used in both the GitHub App form and as a wrangler secret.${NC}"
echo ""

WEBHOOK_SECRET=$(openssl rand -hex 32)
echo -e "  ${GREEN}✓${NC} Your webhook secret: ${BOLD}${WEBHOOK_SECRET}${NC}"
echo -e "  ${DIM}  (save this — you'll need it below)${NC}"
echo ""

# ──────────────────────────────────────────────────────────────
# STEP 1: Create GitHub App
# ──────────────────────────────────────────────────────────────
echo -e "${BOLD}${YELLOW}[Step 1] Create a GitHub App${NC}"
echo ""
echo -e "  Go to: ${BOLD}https://github.com/settings/apps/new${NC}"
echo ""
echo -e "  Fill in these fields:"
echo ""
echo -e "  ┌─────────────────────────────────────────────────────────┐"
echo -e "  │ ${BOLD}GitHub App name${NC}           ForkBot                          │"
echo -e "  │ ${BOLD}Homepage URL${NC}              ${BASE_URL}          │"
echo -e "  │ ${BOLD}Callback URL${NC}               ${BASE_URL}/api/auth/callback  │"
echo -e "  └─────────────────────────────────────────────────────────┘"
echo ""
echo -e "  ⚠️  ${YELLOW}${BOLD}IMPORTANT:${NC}${YELLOW} Check the box${NC}"
echo -e "     ${BOLD}${YELLOW}☑  Request user authorization (OAuth) during installation${NC}"
echo -e "     ${DIM}    (This enables dashboard login. The setup URL field will${NC}"
echo -e "     ${DIM}     disappear — that's expected behavior.)${NC}"
echo ""
echo -e "  ┌─────────────────────────────────────────────────────────┐"
echo -e "  │ ${BOLD}Webhook${NC}                       ${GREEN}☑ Active${NC}                      │"
echo -e "  │ ${BOLD}Webhook URL${NC}               ${BASE_URL}/webhooks/github    │"
echo -e "  │ ${BOLD}Webhook secret${NC}             ${WEBHOOK_SECRET}  │"
echo -e "  └─────────────────────────────────────────────────────────┘"
echo ""
echo -e "  ${BOLD}Repository Permissions:${NC}"
echo ""
echo -e "    ${BOLD}Pull requests${NC}  →  ${GREEN}Read & write${NC}"
echo -e "    ${BOLD}Checks${NC}         →  ${GREEN}Read & write${NC}"
echo -e "    ${BOLD}Contents${NC}       →  ${GREEN}Read${NC}"
echo -e "    ${BOLD}Issues${NC}         →  ${GREEN}Read & write${NC}"
echo -e "    ${BOLD}Metadata${NC}       →  ${GREEN}Read${NC} (auto-granted)"
echo ""
echo -e "  ${BOLD}Subscribe to events:${NC}"
echo ""
echo -e "    ${GREEN}☑${NC} Pull requests"
echo -e "    ${GREEN}☑${NC} Issue comments"
echo -e "    ${GREEN}☑${NC} Installation"
echo -e "    ${GREEN}☑${NC} Installation repositories"
echo -e "    ${GREEN}☑${NC} Push"
echo ""
echo -e "  ${BOLD}Where can this app be installed?${NC}"
echo -e "    ${GREEN}☑${NC} Any account"
echo ""

# ──────────────────────────────────────────────────────────────
# STEP 2: After creation, collect secrets
# ──────────────────────────────────────────────────────────────
echo -e "${BOLD}${YELLOW}[Step 2] After clicking 'Create GitHub App'${NC}"
echo ""
echo -e "  You'll land on your app's settings page. Collect these values:"
echo ""
echo -e "  1. ${BOLD}App ID${NC} — shown at the top of the page"
echo -e "     ${DIM}    (looks like a number, e.g. 123456)${NC}"
echo ""
echo -e "  2. ${BOLD}Client ID${NC} — shown under 'Client ID'"
echo -e "     ${DIM}    (looks like Iv1.xxxxxxxxxxxx)${NC}"
echo ""
echo -e "  3. ${BOLD}Client Secret${NC} — click 'Generate a client secret'"
echo -e "     ${DIM}    (copy it immediately, it's shown once)${NC}"
echo ""
echo -e "  4. ${BOLD}Private Key${NC} — click 'Generate a private key'"
echo -e "     ${DIM}    (downloads a .pem file)${NC}"
echo ""

# ──────────────────────────────────────────────────────────────
# STEP 3: Set wrangler secrets
# ──────────────────────────────────────────────────────────────
echo -e "${BOLD}${YELLOW}[Step 3] Set secrets on Cloudflare${NC}"
echo ""
echo -e "  Run these commands one by one. Paste the value and press Enter."
echo ""

echo -e "  ${BOLD}1. GitHub App ID${NC}"
echo -e "  ${DIM}  $ bunx wrangler secret put GITHUB_APP_ID${NC}"
echo ""
echo -e "  ${BOLD}2. GitHub App Private Key${NC}"
echo -e "  ${DIM}  $ cat /path/to/your-app.pem | bunx wrangler secret put GITHUB_APP_PRIVATE_KEY${NC}"
echo -e "  ${DIM}  (paste the FULL .pem file content, then press Ctrl+D)${NC}"
echo ""
echo -e "  ${BOLD}3. Webhook Secret${NC}"
echo -e "  ${DIM}  $ echo '${WEBHOOK_SECRET}' | bunx wrangler secret put GITHUB_WEBHOOK_SECRET${NC}"
echo ""
echo -e "  ${BOLD}4. OAuth Client ID (for dashboard login)${NC}"
echo -e "  ${DIM}  $ bunx wrangler secret put GITHUB_OAUTH_CLIENT_ID${NC}"
echo ""
echo -e "  ${BOLD}5. OAuth Client Secret (for dashboard login)${NC}"
echo -e "  ${DIM}  $ bunx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET${NC}"
echo ""
echo -e "  ${BOLD}6. (Optional) AI API keys for AI-powered review${NC}"
echo -e "  ${DIM}  $ bunx wrangler secret put OPENAI_API_KEY${NC}"
echo -e "  ${DIM}  $ bunx wrangler secret put ANTHROPIC_API_KEY${NC}"
echo ""

# ──────────────────────────────────────────────────────────────
# STEP 4: Redeploy
# ──────────────────────────────────────────────────────────────
echo -e "${BOLD}${YELLOW}[Step 4] Redeploy with secrets${NC}"
echo ""
echo -e "  After setting all secrets, redeploy:"
echo ""
echo -e "  ${DIM}  $ cd /home/dev/Desktop/memtime${NC}"
echo -e "  ${DIM}  $ bun run build:web${NC}"
echo -e "  ${DIM}  $ cd apps/api && bunx wrangler deploy${NC}"
echo ""

# ──────────────────────────────────────────────────────────────
# STEP 5: Install and test
# ──────────────────────────────────────────────────────────────
echo -e "${BOLD}${YELLOW}[Step 5] Install on a repo & test${NC}"
echo ""
echo -e "  1. Go to ${BOLD}https://github.com/settings/apps/ForkBot/installations${NC}"
echo -e "     (or click 'Install App' in the sidebar of your app settings)"
echo ""
echo -e "  2. Select a repo and install ForkBot"
echo ""
echo -e "  3. Open a PR on that repo — ForkBot should comment automatically"
echo ""
echo -e "  4. Or test manually:"
echo -e "  ${DIM}    $ curl ${BASE_URL}/health${NC}"
echo ""

echo -e "${BOLD}${GREEN}  ✅ Done! ForkBot is ready to review PRs.${NC}"
echo ""
