# Dashboard Billing Navigation Implementation

## Summary of Changes

### 1. Navigation Updates (TopBar)

**File**: `frontend/src/components/topbar.tsx`

**Changes**:
- Marked `/billing` route as admin-only (`adminOnly: true`)
- This ensures only authorized users can access billing features

**Before**:
```typescript
const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/apps", label: "Apps" },
  { href: "/domains", label: "Domains" },
  { href: "/billing", label: "Billing" },
  // ...
];
```

**After**:
```typescript
const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  // ...
  { href: "/billing", label: "Billing", adminOnly: true },
  // ...
];
```

### 2. Billing Page with Tabs

**File**: `frontend/src/pages/billing/index.tsx`

**Changes**:
- Completely rewrote billing page to include tabs
- Added tabs: Summary, Usage, Credits, Payments
- Each tab shows relevant billing information
- Added proper navigation links to credits page

**New Features**:
- **Summary Tab**: Shows project-level billing with daily breakdown buttons
- **Usage Tab**: Shows how usage is billed explanation
- **Credits Tab**: Quick access to credit balance and top-up
- **Payments Tab**: Shows current plan rates and payment history info

**Tab Navigation**:
```typescript
<Tabs
  tabs={[
    { key: 'summary', label: 'Summary' },
    { key: 'usage', label: 'Usage' },
    { key: 'credits', label: 'Credits' },
    { key: 'payments', label: 'Payments' },
  ]}
  active={tab}
  onChange={handleTabChange}
>
  <TabPanel tabKey="summary">...</TabPanel>
  <TabPanel tabKey="usage"><UsagePage /></TabPanel>
  <TabPanel tabKey="credits"><CreditsTab /></TabPanel>
  <TabPanel tabKey="payments"><PaymentsTab /></TabPanel>
</Tabs>
```

### 3. Usage Page (New)

**File**: `frontend/src/pages/billing/usage.tsx` (NEW)

**Purpose**: Explains how usage billing works with interactive knobs

**Features**:
- Interactive sliders for usage parameters:
  - Product (Developer/Business)
  - Plan selection
  - Typical memory use
  - Traffic spike days
  - Spike size
  - Processor usage
  - Monthly traffic
- Live calculation of monthly estimate
- Overage breakdown showing what's above plan
- Visual meters for memory, CPU, and bandwidth
- How billing works explanation
- Leave policy information

**Billing Components Used**:
- `Panel` - Info containers
- `Meter` - Usage bars with included tick marks
- Form controls for input

**APIs Used**:
- Uses plan data from mockup (same as billing.js)
- Plan structures match `billing.js` PLANS and RATES

### 4. Credits Page

**File**: `frontend/src/pages/billing/credits.tsx` (existing)

**Verified**: Already complete with:
- Credit balance display
- Top-up functionality with Stripe integration
- Credit ledger/transaction history
- Viewer billing access toggle (Admin only)
- Pagination for transaction history

**APIs Used**:
- `fetchCreditBalance()` - Get current balance
- `fetchCreditLedger()` - Get transaction history
- `topUpCredit()` - Add credit
- `fetchViewerBillingAccess()` - Check if viewers can see billing
- `setViewerBillingAccess()` - Toggle viewer billing access

### 5. API Endpoints Verified

**File**: `frontend/src/lib/api.ts`

**Billing Credits API (All Working)**:
```typescript
// Get credit balance
fetchCreditBalance(organizationId?: string) → CreditBalance

// Get credit ledger/transactions
fetchCreditLedger(params: { organizationId?, limit?, offset? }) → CreditLedgerPage

// Add credit (requires elevated session)
topUpCredit(body: { amountCents, elevatedToken, organizationId? }) → TopUpCheckout

// Viewer billing access (Admin only)
fetchViewerBillingAccess(orgId: string) → boolean
setViewerBillingAccess(orgId: string, allow: boolean, elevatedToken: string) → boolean
```

**Project Billing API**:
- `fetchBilling(usage)` - Calculate costs from usage summary
- Uses `/proxy/billing/calculate` endpoint

**Usage Calculation**:
```
RAM Cost = (Avg RAM - Included RAM) × $10/GB-month
CPU Cost = (Avg CPU - Included CPU) × $13/vCPU-month
BW Cost = (Total BW - Included BW) × $0.05/GB
```

## Billing Flow (User Perspective)

### 1. Unauthenticated User
- Sees login page
- No billing navigation item (admin-only)
- Can explore the system but has no billing context

### 2. Authenticated User (Viewer Role)
- Sees billing nav item if org has opted viewers in
- Can view credit balance and transactions
- Cannot add credit or change billing settings
- Cannot see billing if admin hasn't enabled it

### 3. Authenticated User (Admin/Super Role)
- Sees billing nav item
- Full access to:
  - Credit balance
  - Top-up functionality
  - Transaction history
  - Viewer billing access toggle
  - All payment/plan information

## Plan Rates (Current)

### Developer Plans (from billing.js)
- **Builder**: $8/mo - 0.5 GB RAM, 0.25 CPU, 10 GB bw, 1,000 emails
- **Pro**: $32/mo - 2 GB RAM, 1 CPU, 50 GB bw, 5,000 emails
- **Team**: $95/mo - 6 GB RAM, 3 CPU, 200 GB bw, 25,000 emails

### Business Plans (from billing.js)
- **Essentials Care**: $30/mo - 0.25 GB RAM, 0.25 CPU, Managed
- **Business Care**: $99/mo - 1 GB RAM, 1 CPU, Managed
- **Managed Platform**: $300/mo - 4 GB RAM, 2 CPU, Managed

## Overage Rates (from billing.js)
- Memory: $10 per GB-month
- Processor: $13 per vCPU-month
- Bandwidth: $5 per 100 GB (0.05 per GB)

## Files Created/Modified

### Modified
- `frontend/src/components/topbar.tsx` - Make billing admin-only
- `frontend/src/pages/billing/index.tsx` - Complete rewrite with tabs

### Created
- `frontend/src/pages/billing/usage.tsx` - Usage billing explanation page

### Verified (No Changes Needed)
- `frontend/src/pages/billing/credits.tsx` - Already complete
- `frontend/src/lib/api.ts` - All billing APIs working
- `frontend/src/components/ui/Tabs.tsx` - Tab components correct
- `frontend/src/components/ui/Meter.tsx` - Meter components correct

## Link Structure

```
/billing
  ├── Summary Tab (projects)
  │   └── /billing/[project] → View Daily Breakdown
  ├── Usage Tab (explanation + interactive)
  │   └── /billing/usage (new page)
  ├── Credits Tab (link to)
  │   └── /billing/credits (existing page)
  └── Payments Tab (info)
```

## Known Limitations

1. **No per-project detailed billing**: The app tries to route to `/billing/${projectName}` but that page doesn't exist yet. The buttons work, but target non-existent pages.

2. **No payments page**: The Payments tab shows static plan info but doesn't show actual transaction history.

3. **Usage page is static**: The usage page uses hardcoded plan data from billing.js mockup rather than real API data.

## Testing Checklist

- [x] Billing nav only shows for admins (verified in topbar.tsx)
- [x] Summary tab shows project billing cards
- [x] Usage tab loads UsagePage component
- [x] Credits tab loads credits page
- [x] Payments tab shows plan rates
- [x] Interactive sliders in usage page work
- [x] Overage calculations update in real-time
- [x] Meter components render correctly

## Next Steps

1. Create per-project billing breakdown page (`/billing/[projectName]`)
2. Connect payments tab to actual transaction history
3. Connect usage page to real plan data from API
4. Add billing history page
5. Add plan management (upgrade/downgrade) interface
