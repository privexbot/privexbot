# PrivexBot Frontend

## Overview
React 19 + TypeScript + Vite. Tailwind + shadcn/ui. React Flow for the chatflow visual editor. React Query for data fetching. Zustand for client state.

## Pages

### Top-level (`src/pages/`)
- **Public marketing**: `LandingPage`, `AboutPage`, `HelpPage`, `PrivacyPage`, `FAQsPage`, `PricingPage`.
- **Auth**: `LoginPage`, `NewLoginPage`, `SigninPage`, `SignupPage`, `NewSignupPage`, `PasswordResetPage`, `AuthTestPage`.
- **Public chat**: `chat/PublicChatPage.tsx` (route `/chat/:workspaceSlug/:botSlug`).
- **App**: `Dashboard`, `OrganizationsPage`, `ProfilePage`, `Credentials.tsx` (`/settings/credentials`).
- **Studio / Chatflows**: `StudioPage`, `ChatflowBuilder.tsx`, `chatflows/detail.tsx` (`/studio/:chatflowId`).
- **Chatbots**: `chatbots/{create,detail,edit}.tsx`.
- **Knowledge Bases**: `knowledge-bases/{index,create,detail,edit,rechunk,documents,document-edit,document-view,analytics,pipeline-monitor,processing}.tsx`.
- **Leads**: `leads/{index,detail}.tsx`.
- **Activities / Analytics**: `ActivitiesPage`, `AnalyticsPage`.
- **Marketplace** (`MarketplacePage.tsx`): browses + clones chatflow templates.
- **Referrals** (`ReferralsPage.tsx`): personal referral code, share link, invites table.
- **Billing** (`BillingsPage.tsx`): plan tier, live usage, manual upgrade dialog.
- **Documentation** (`DocumentationPage.tsx`): placeholder.
- **Admin** (`admin/{AdminDashboard,AdminOrganizations,AdminOrgDetail,AdminUsers,AdminUserDetail,AdminAnalytics}.tsx`): staff-only routes.

### Chatflow detail link convention
The chatflow detail page is mounted at **`/studio/:chatflowId`** (NOT `/chatflows/...`). Notification links and any other navigation must use this path. The `/chatflows/builder/:draftId` route is the editor.

## Routes (from `src/components/App/App.tsx`)
- Public: `/`, `/about`, `/help`, `/privacy`, `/faqs`, `/pricing`, `/signin`, `/login`, `/signup`, `/password-reset`, `/auth/test`, `/chat/:workspaceSlug/:botSlug`.
- Protected: `/dashboard`, `/organizations`, `/chatbots(/...)`, `/studio(/:chatflowId)`, `/chatflows/builder(/:draftId)`, `/knowledge-bases(/...)`, `/activities`, `/leads(/:leadId)`, `/analytics`, `/billings`, `/profile`, `/settings/credentials`, `/marketplace`, `/referrals`, `/documentation`.
- Admin (staff-only): `/admin`, `/admin/organizations(/:orgId)`, `/admin/users(/:userId)`, `/admin/analytics`.

KB creation (`/knowledge-bases/create`) is open to any authenticated workspace member — the BetaAccessGate has been removed.

## Chatflow Builder Architecture
`src/pages/ChatflowBuilder.tsx` is the visual editor:
- Inline node visual components (BaseNode wrapper + per-type styling)
- `NODE_CATEGORIES` defining the drag palette (4 categories, 17 types)
- `nodeTypes` mapping for React Flow (17 entries)
- `renderNodeConfig()` switch with config panels for the 16 configurable types
- Auto-save (1s debounce) → `PATCH /chatflows/drafts/{id}`
- Validation, deploy via `<ChannelSelector>` dialog → `chatflowDraftApi.finalize`

### Node data flow
```
Config panel field changes → debounced (300ms) →
  handleNodeConfigChange() → updates node.data.config →
  auto-save mutation (1s) → PATCH /chatflows/drafts/{id}
```
Config lives at `node.data.config`. The backend reads via `node.get("data", {}).get("config", ...)`.

### Node Types (17 total, 4 categories)
- **Flow Control**: trigger, condition, loop, response
- **AI & Knowledge**: llm, kb, memory
- **Data & Integration**: http, variable, code, database
- **Actions & Automation**: webhook, email, notification, handoff, lead_capture, calendly

Trigger has no config component (no fields to configure). The other 16 types have one each in `src/components/chatflow/configs/{Type}NodeConfig.tsx`.

### Config component contract
```ts
interface Props {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}
```
Pattern: useState per field → useCallback emit → useEffect with 300ms debounce.

### Visual node components
Defined inline in `ChatflowBuilder.tsx` using `BaseNode`. Trigger has no input handle, response has no output handle, condition has two output handles (true / false).

### Deploy flow
1. Validate: trigger node exists, response node exists, no orphaned nodes.
2. Open `ChannelSelector` dialog (6 channels: website, telegram, discord, slack, whatsapp, zapier).
3. Call `chatflowDraftApi.finalize(draftId, {channels})`. Nodes/edges already saved in the draft.
4. Show success modal with API key (one-time), then navigate to studio.

## File Structure
```
src/
  pages/                   # see "Pages" section above
  components/
    chatflow/
      configs/             # 16 config panel components (named exports)
      nodes/               # standalone node components (kept for reference, not used by builder)
      ReactFlowCanvas.tsx, NodePalette.tsx, NodeConfigPanel.tsx  # alternative canvas/palette (not used by builder)
    deployment/            # ChannelSelector + per-channel deploy UI
    layout/                # DashboardLayout, NotificationBell, sidebar
    shared/                # CredentialSelector, EmbedCode, ComingSoon, etc.
    auth/, kb/, admin/, ui/  # subsystems and shadcn primitives
  api/
    auth, chatbot, chatflow, credentials, kb-client, leads, analytics,
    billing, referrals, templates, notifications, organization, workspace,
    user, dashboard, files, beta, admin
  store/
    workspace-store, notification-store, kb-store, chatbot-store, draft-store
  hooks/
    useAutoSave, useDraftValidation, useDraftPreview, use-toast, ...
  contexts/
    AuthContext, AppContext, ThemeContext
  config/
    env.ts                 # window.ENV_CONFIG → import.meta.env → localhost defaults
```

## Conventions
- Config panel components use named exports: `export function FooNodeConfig(...)`.
- Debounce: 300ms for config changes, 1000ms for auto-save.
- All UI primitives from shadcn (`@/components/ui/`); icons from `lucide-react`.
- API calls via `@/lib/api-client` (axios with auth interceptor + handleApiError helper).
- Toasts via `@/hooks/use-toast`.

## OAuth + Credential Picker Behavior
- `CredentialSelector` (in chatflow node configs) and `Credentials.tsx` both POST to `/credentials/oauth/authorize` and follow `redirect_url`. Direct browser navigation is intentionally not supported — the backend needs the JWT in the Authorization header.
- Slack is treated separately: redirect to `/webhooks/slack/install` (Slack uses a shared-bot OAuth install flow and produces a `SlackWorkspaceDeployment`, not a `Credential` row).
- `google` is the only OAuth provider used for Drive/Docs/Sheets. There is no `google_drive` provider.

## Marketplace / Referrals / Billing
- **Marketplace** (`/marketplace`): lists templates from `GET /templates`, "Use this template" calls `POST /templates/{id}/clone` and navigates to `/chatflows/builder/{draft_id}`.
- **Referrals** (`/referrals`): per-user code generated lazily by `GET /referrals/me`. Share link is `${FRONTEND_URL}/signup?ref=<code>`. The signup pages (`NewSignupPage`, `SigninPage`'s verify-and-signup branch) read `?ref=…` and forward `referral_code` to the backend.
- **Billing** (`/billings`): pulls `GET /billing/plan` (current tier + usage breakdown) and `GET /billing/plans` (all tiers for the upgrade dialog). Self-serve checkout (Stripe) is not in-tree yet — non-staff `/billing/upgrade` calls return 402 with a "contact support" message.
