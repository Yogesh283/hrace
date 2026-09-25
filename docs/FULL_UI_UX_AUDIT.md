# Full UI/UX Audit

Project: Rynexcapital / RACE Network  
Scope: Presentation, contrast, responsive layout, accessibility, frontend performance  
Date: 2026-09-24

Brand colour preserved: **blue** (`#2563EB` / `#38BDF8`). No red theme was introduced. Existing red is used only for danger / logout.

# Pages Audited

## Public / guest
- Welcome / Race Network landing (`/`)
- Race landing alias (`/race`)
- Mobile fintech showcase (`/mobile-design`)
- Login
- Register
- Guest layout + auth shell
- Splash / navigation loader
- Wallet pending overlay

## Member portal
- Dashboard
- Profile
- Staking (`Investment`)
- Wallet / Deposit
- ICO (`Isu`)
- Race Coin
- Swap
- Transactions / Total Earnings (and income-filter variants)
- Withdrawal / Payouts
- Direct Team
- Total Team
- Community Leadership
- Leadership live data
- Community Team Rewards
- ROI Sharing (`NetworkRoi`)
- Self Hold
- Bonanza / Affiliate booster
- Virtual income
- Governance
- Lending
- Support / About
- Rank
- Admin MLM showcase (`AdminMlmDashboard`)

## Shared chrome
- Desktop sidebar + header
- Mobile premium header
- Member bottom navigation
- Welcome bottom navigation
- Modals / global flash
- Cards, tables, forms, buttons, empty / loading / error states

# Text Visibility Issues Found

| Page / component | Issue | Fix |
|---|---|---|
| Global inputs | Placeholder `#64748b` on `#0F172A` (~4.5:1, too faint) | Placeholder `#94a3b8` (~6.9:1) |
| Guest login / register | `text-slate-500` helper copy not remapped on `.guest-race` | Guest remaps + explicit `text-slate-300` |
| Public landing | Body copy `#9CA3AF` low on navy | `#cbd5e1` via `--rx-muted` + class remap |
| Member muted captions | `#94a3b8` readable but thin on cards | Token `--rx-ds-text-muted: #b6c3d6` |
| ICO / Race Coin heroes | `subtitle` prop was ignored — copy invisible | `MemberPageHero` now renders `subtitle` |
| Lending alerts | Light `bg-red-50` / `text-red-900` depended on remaps | `MemberAlert` semantic dark surfaces |
| Global flash modal | Light `bg-white` + `text-*-900` inside dark modal | Native dark panel, `text-slate-200` body |
| Dropdown default | Light `bg-white` / `text-fintech-ink` | Dark surface + light text |
| ICO / Race Coin / Lending | No mobile bottom nav / content padding | `showMobileFintechNav` default `true` |
| Empty states | Plain muted paragraphs, easy to miss | `.rx-empty` + `MemberEmptyState` |
| Disabled CTAs | `opacity-40` / `0.55` washed out label | `0.70` while still looking disabled |
| Welcome 320px nav labels | 8px labels (too small) | 10px minimum |
| Table headers | Soft grey, weak hierarchy | Stronger header colour + uppercase scale |
| Support / Withdrawal / Governance flash | Light `bg-*-50` + `text-*-900` alerts | `MemberAlert` success/error/warning |
| Leadership last credit | Emerald-900 on remapped light box | `MemberAlert` success |
| Bonza / Rewards amounts | `text-emerald-900/700` on dark cards | `text-emerald-200/300` |
| Transactions date filter | Light input (`bg-slate-50`) | Dark input, readable value |
| Landing chrome (`RaceSiteUI`) | `#9CA3AF` nav/footer copy | `text-slate-300` |
| Admin MLM search | Faint `placeholder:text-slate-500` | `placeholder:text-slate-300` |
| Unused profile forms | `text-gray-900` headings | White / slate-300 (if ever shown) |

# Theme Issues

- Member pages were authored with light Tailwind (`text-fintech-ink`, `bg-white`) and re-skinned dark. Most remaps existed; remaining holes were guest pages, placeholders, landing `#9CA3AF`, flash modal, and ignored hero subtitles.
- Primary brand stays blue. Gold remains accent on landing / royalty. Danger red only for logout / errors.
- Conflicting light-header titles on ICO (`text-gray-800`) removed in favour of the shared dark header title.

# Responsive Issues

- Bottom nav active icon used to grow wider than siblings → uneven columns on 320–390px. Active and idle icons now share the same 2.7rem rounded box.
- ICO / Race Coin / Lending lacked bottom-nav clearance, so last cards could sit under the bar once nav was enabled globally.
- Wide tables now keep a 36rem min-width under 640px and scroll inside `.member-table-scroll` instead of shrinking text.
- Welcome section padding-bottom increased so the taller landing nav does not cover CTAs.
- Header gap increased; titles still truncate instead of wrapping into the account control.
- Desktop content remains `max-w-6xl` / `max-w-[1600px]` so cards do not stretch on 1440px+.

# Bottom Navigation

Routes unchanged: Home (`dashboard`), Staking (`investment`), Team (`team`), Profile (`profile.edit`).

Changes:
- Larger equal icon containers (2.7rem, 1rem radius)
- More grid gap (0.45rem) and vertical padding
- Active = brand gradient fill + white label; idle icons stay `#e2e8f0`
- Safe-area insets on left / right / bottom
- `--rx-ds-bottomnav-h` raised to `5.65rem`; member `<main>` already pads with this token
- Referral FAB lifted to `6.5rem` so it clears the taller bar
- Inertia `prefetch` on items
- Accessible `aria-label` + `aria-current="page"`
- Welcome nav (Home / About / Eco / Token / Join) got the same breathing-space treatment; routes/anchors unchanged

# Performance

Verified (code-level, not Lighthouse):
- Member page particles no longer mount by default (10 fewer animated nodes per page)
- Existing rule still kills portal / auth background animations
- Bottom-nav links prefetch on hover/mount (Inertia)
- Page modules already lazy via `import.meta.glob`
- No polling interval, blockchain read, or API contract was changed
- Dashboard poll remains 120s

Not claimed: initial bundle KB or LCP improvement (not measured in a browser session).

# Accessibility

- Contrast tokens raised for muted text, placeholders, and disabled buttons
- Focus-visible rings already global; kept
- Icon-only header controls already have `aria-label`
- Bottom nav items now have explicit `aria-label`
- Empty / loading / alert states expose `role="status"`
- Flash modal uses `alertdialog` with a labelled title
- Touch targets stay ≥ 44px (`--rx-ds-touch`)
- Mobile inputs stay 16px to avoid iOS zoom

# Components Improved

- `member-design-system.css` — tokens, type scale, alerts, empty states, bottom nav
- `race-landing.css` / `app.css` / `race-site.css` — placeholder + landing contrast
- `MobileFintechBottomNav`
- `WelcomeMobileBottomNav`
- `MobilePremiumHeader`
- `MemberPageHero` (subtitle + optional logo)
- `MemberPageShell` (particles off by default)
- `MemberEmptyState` / `MemberAlert` / `MemberLoadingState` (new)
- `MemberPageIntro`
- `GlobalFlashModal`
- `Dropdown`
- `TextInput` / `InputLabel`
- `AuthenticatedLayout`
- `AuthPremiumShell` / `WalletConnectAuthButton`
- `RaceNetworkSite`

# Files Changed

- `resources/css/member-design-system.css`
- `resources/css/race-landing.css`
- `resources/css/app.css`
- `resources/css/race-site.css`
- `resources/js/lib/memberTheme.js`
- `resources/js/Layouts/AuthenticatedLayout.jsx`
- `resources/js/Components/Member/MobileFintechBottomNav.jsx`
- `resources/js/Components/Member/MobilePremiumHeader.jsx`
- `resources/js/Components/Member/MemberPageHero.jsx`
- `resources/js/Components/Member/MemberPageShell.jsx`
- `resources/js/Components/Member/MemberPageIntro.jsx`
- `resources/js/Components/Member/MemberEmptyState.jsx`
- `resources/js/Components/Member/MemberAlert.jsx`
- `resources/js/Components/Member/MemberLoadingState.jsx`
- `resources/js/Components/Welcome/WelcomeMobileBottomNav.jsx`
- `resources/js/Components/RaceSite/RaceNetworkSite.jsx`
- `resources/js/Components/GlobalFlashModal.jsx`
- `resources/js/Components/Dropdown.jsx`
- `resources/js/Components/TextInput.jsx`
- `resources/js/Components/Auth/AuthPremiumShell.jsx`
- `resources/js/Components/WalletConnectAuthButton.jsx`
- `resources/js/Pages/Isu.jsx`
- `resources/js/Pages/Token/RaceToken.jsx`
- `resources/js/Pages/Lending.jsx`
- `resources/js/Pages/Auth/Login.jsx`
- `resources/js/Pages/Auth/Register.jsx`
- `resources/js/Pages/Deposit.jsx`
- `resources/js/Pages/Withdrawal.jsx`
- `resources/js/Pages/Transactions.jsx`
- `resources/js/Pages/Investment.jsx`
- `resources/js/Pages/DirectTeam.jsx`
- `resources/js/Pages/Team.jsx`
- `resources/js/Pages/Support.jsx`
- `resources/js/Pages/Governance.jsx`
- `resources/js/Pages/Swap.jsx`
- `resources/js/Pages/VirtualIncomeWallet.jsx`
- `resources/js/Pages/BonzaBuster.jsx`
- `resources/js/Pages/SelfHold.jsx`
- `resources/js/Pages/Profile/Partials/ProfileInformationDisplay.jsx`
- `docs/FULL_UI_UX_AUDIT.md`

# Business Logic
UNCHANGED

# Smart Contracts
UNCHANGED

# API
UNCHANGED

# Database
UNCHANGED

# Final QA

PASS (static, project-wide). Live multi-viewport browser sweep was not available in this session; contrast and nav rules were applied through the shared design system so every `member-portal--race` / `guest-race` / `.rx-site` surface inherits them.

Checklist (code-verified):

- [x] Text remapped off light-on-light / dark-on-dark pairs
- [x] Contrast tokens meet ~AA on dark surfaces
- [x] Shared type / spacing / radius tokens
- [x] Cards / buttons / inputs / tables use the same language
- [x] Bottom nav equal icons, active highlight, safe area, page padding
- [x] ICO / Token / Lending now use the same mobile chrome
- [x] Empty / error / success surfaces readable
- [x] No business, contract, API, or DB edits
