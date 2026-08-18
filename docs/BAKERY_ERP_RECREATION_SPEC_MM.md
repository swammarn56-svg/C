# Bakery ERP — Developer Recreation Specification

**Document purpose:** ဒီစာရွက်စာတမ်းသည် Bakery ERP ကို အခြား Developer တစ်ယောက်က ဖတ်ပြီး အလားတူ Web App ကို အစမှ ပြန်တည်ဆောက်နိုင်ရန် ရေးထားသော implementation specification ဖြစ်သည်။ ဒီ document သည် UI ပုံစံတစ်ခုတည်းကို မကူးဘဲ **လုပ်ငန်းစဉ်၊ data model၊ calculation၊ permission၊ date behavior နှင့် acceptance criteria** များကို သတ်မှတ်ထားသည်။

> အရေးကြီးသောဆုံးဖြတ်ချက် — လက်ရှိ project မှာ Ella/Gemini assistant ကို ဖယ်ရှားပြီးဖြစ်သည်။ ပြန်တည်ဆောက်မည့် version တွင် AI voice assistant မပါရ။ ERP data ကို user interface မှ တိုက်ရိုက်၊ တိကျ၊ စစ်ဆေးနိုင်သော workflow အဖြစ်သာ တည်ဆောက်ရမည်။

---

## ၁။ Product အကျဉ်းချုပ်

Bakery ERP သည် Bakery လုပ်ငန်း၏ **ကုန်ကြမ်းဝယ်ယူမှု၊ Production၊ Packaging၊ အရောင်းဆိုင်များ၊ Sales၊ Order၊ Recipe၊ Dashboard၊ Report၊ Import/Export နှင့် Administration** ကို နေ့စဉ်လုပ်ငန်းစဉ်အတိုင်း စီမံရန် အသုံးပြုသော authenticated internal web application ဖြစ်သည်။

System တစ်ခုလုံး၏ အဓိက rule သည် **Global Business Date တစ်ရက်တည်း** ဖြစ်ရမည်။ User က Business Date ကို 2026-08-16 သို့ ပြောင်းလဲလျှင် Dashboard၊ Purchase၊ Production၊ Packaging၊ Sales၊ Order နှင့် report ၏ Daily mode အားလုံးသည် ထိုနေ့ကို အသုံးပြုရမည်။ Page တစ်ခုချင်းစီတွင် ကိုယ်ပိုင် date state မထားရ။

### ၁.၁ အဓိက user roles

| Role | လုပ်နိုင်သည့်အရာ |
|---|---|
| `admin` | Item create/edit/deactivate/reactivate/reorder, shop နှင့် shop price စီမံခြင်း, recipe စီမံခြင်း, import/export, backup, audit log, daily ledger lock/reopen, user role ပြောင်းခြင်း |
| `user` | Purchase ထည့်/confirm/cancel, Production/Packaging/Sales daily input ပြင်ခြင်း, Order ထည့်ခြင်း, reports ကြည့်ခြင်း, search နှင့် export အသုံးပြုခြင်း |

Server-side တွင် permission ကို UI ဖြင့်သာ မကာကွယ်ရ။ Mutation တိုင်းတွင် authenticated user နှင့် role ကို စစ်ရမည်။ `admin` မဟုတ်သူက admin mutation ခေါ်လျှင် `FORBIDDEN` ပြန်ရမည်။

---

## ၂။ မဖြစ်မနေ ထိန်းသိမ်းရမည့် business rules

| Rule | သတ်မှတ်ချက် |
|---|---|
| Myanmar Unicode | Database, API, spreadsheet, search, table, notes, shop name, item name အားလုံး UTF-8/Unicode ကို မပျက်စေရ။ Zawgyi conversion မလုပ်ရ။ |
| Global date | App တစ်ခုလုံးသည် shared Business Date တစ်ခုကိုသာ အသုံးပြုရမည်။ |
| Date-effective item | Item အသစ်သည် `effectiveFrom` ရက်မှသာ ပေါ်ရမည်။ အရင်ရက်များတွင် မပေါ်ရ။ |
| Non-destructive delete | Item ကို hard delete မလုပ်ရ။ `inactiveFrom` သတ်မှတ်ပြီး ထိုရက်မှစ၍ မပေါ်အောင်လုပ်ရမည်။ အရင်နေ့ record/report မပျက်ရ။ |
| Carryforward | ယနေ့ Closing သည် နောက်နေ့ Opening ဖြစ်ရမည်။ ကြားထဲတွင် record ရှိသောနေ့များအတိုင်း chronological recalculation လုပ်ရမည်။ |
| Historical edit | 12 ရက်နေ့ record ပြင်လျှင် 13/14/15 ရက် downstream balances များကို ပြန်တွက်ရမည်။ 11 ရက်နှင့် အရင် record မထိရ။ |
| Purchase source | Confirmed Purchase သည် Production/Packaging `In` ၏ default source ဖြစ်ရမည်။ Cancelled Purchase သည် `In` မဟုတ်တော့ရ။ |
| Manual override | Production/Packaging `In` နှင့် `Issued`, Opening တို့ကို admin/user workflow အရ manual override လုပ်နိုင်ရမည်။ Override ဖျက်လျှင် auto value သို့ ပြန်ရမည်။ |
| Autosave | Daily ledger row တစ်ကြောင်းချင်း “Save” ခလုတ်ဖြင့် user ကို အတင်းသိမ်းခိုင်းမထားရ။ Field edit ပြီး debounce/queue ဖြင့် background autosave လုပ်ရမည်။ |
| Lock | Daily ledger ကို admin က lock လုပ်ထားလျှင် operational save မလုပ်ရ။ Admin က reopen လုပ်မှ ပြန်ပြင်နိုင်ရမည်။ |
| No AI writes | AI assistant မပါရ။ User action မဟုတ်သော database write မပြုရ။ |

---

## ၃။ Date နှင့် time architecture

### ၃.၁ Global Business Date

App root တွင် `BusinessDateContext` သို့မဟုတ် equivalent global store တစ်ခုတည်ဆောက်ရမည်။ Initial date သည် local business timezone အရ ယနေ့ဖြစ်နိုင်သော်လည်း database/API သို့ `YYYY-MM-DD` date-only string အဖြစ်ပို့ရမည်။ Date object ကို timezone အလိုက် မရောထွေးစေရ။

Global date ပြောင်းလဲသောအခါ—

1. URL/query state သို့မဟုတ် global store update လုပ်ရမည်။
2. Dashboard summary ပြန် query လုပ်ရမည်။
3. Purchase list သည် ရွေးထားသောနေ့နှင့်သာ filter ဖြစ်ရမည်။
4. Production daily ledger ပြန်တွက်ရမည်။
5. Packaging daily ledger ပြန်တွက်ရမည်။
6. Sales shop tabs အားလုံးသည် ရွေးထားသောနေ့ကို အသုံးပြုရမည်။
7. Order Table သည် ရွေးထားသောနေ့မှ sales items များကို ပြရမည်။
8. Reports Daily mode သည် Global Business Date ကို `from` နှင့် `to` နှစ်ခုလုံးအဖြစ် အသုံးပြုရမည်။

Date ပြောင်းချိန်တွင် old rows များကို ခဏထားပြနိုင်သော်လည်း selected date အဖြစ် မမှားပြရ။ Loading/error state ကို section အလိုက်ပြရမည်။ Page တစ်ခုလုံး blank ဖြစ်အောင် blocking spinner မသုံးသင့်ပါ။

### ၃.၂ Carryforward algorithm

Production နှင့် Packaging အတွက် item တစ်ခုချင်းစီကို ရွေးထားသော date အထိ chronological date sequence ဖြင့် loop လုပ်ရမည်။ Sequence တွင် selected date၊ purchase date၊ operation date၊ order date များ ပါဝင်ရမည်။

နေ့တိုင်းအတွက်—

```text
opening = previous_day_closing
if opening override exists:
    opening = opening override
in = confirmed_purchase_quantity_on_date
if in override exists:
    in = in override
issued = manual issued OR recipe-generated issued
return = saved return
 damage = saved damage
used = issued - return - damage
closing = opening + in + return - issued
```

`closing` ကို နောက်နေ့ `opening` အဖြစ် သယ်သွားရမည်။ Selected date မတိုင်မီ operation မရှိသေးလျှင် opening ကို 0 မှစရမည်။

Sales အတွက် `shop + sales item` key တစ်ခုချင်းစီဖြင့်—

```text
opening = previous closing for the same shop and item
produce = manual input
sell = manual input
closing = opening + produce - sell
```

အရင်နေ့ record ကို ပြင်လျှင် ထိုနေ့မှစ၍ နောက်နေ့များကို calculated read model အဖြစ် ပြန်တွက်ရမည်။ Daily snapshot ကို duplicate သိမ်းပြီး carryforward ပျက်စေသော design မလုပ်ရ။

---

## ၄။ Data model

အောက်ပါ table များသည် relational database တွင် အနည်းဆုံးရှိရမည့် entity များဖြစ်သည်။ PostgreSQL + Supabase ကို အသုံးပြုနိုင်သည်။ Text column အားလုံးသည် Unicode-safe ဖြစ်ရမည်။

### ၄.၁ `users`

| Field | Type | Rule |
|---|---|---|
| `id` | integer PK | Internal user id |
| `openId` | varchar unique | Supabase Auth user UUID သို့မဟုတ် stable external id |
| `name` | text | User display name |
| `email` | varchar | Login email |
| `role` | enum | `user` / `admin` |
| `loginMethod` | varchar | `supabase` |
| `lastSignedIn` | timestamptz | Last successful sign-in |
| `createdAt`, `updatedAt` | timestamptz | Audit metadata |

### ၄.၂ `items`

| Field | Type | Rule |
|---|---|---|
| `id` | integer PK | Item id |
| `name` | varchar | Myanmar Unicode အပါအဝင် item name |
| `code` | varchar nullable unique | Optional item code |
| `category` | varchar nullable | Optional grouping |
| `itemType` | enum | `production`, `packaging`, `sales` |
| `displayUnit` | enum | Weight item = `g`, piece item = `pcs` |
| `gramsPerDisplayUnit` | decimal | g display conversion; piece item အတွက် piece factor |
| `minStockGrams` | decimal | Low-stock threshold; piece item သည် base pcs အဖြစ်သုံးပါက naming ကို developer ရှင်းလင်းထားရမည် |
| `costPerUnit` | decimal nullable | **Sales item များအတွက်သာ** ပြရမည်/အသုံးပြုရမည် |
| `effectiveFrom` | date | Item ပေါ်စသည့်နေ့ |
| `inactiveFrom` | date nullable | ထိုနေ့မှစ၍ item မပေါ်တော့ရန် |
| `sortOrder` | integer | Item Dashboard အစီအစဉ် |
| `createdBy` | FK users | Creator |

Item တစ်ခုသည် operational list တစ်ခုတည်းတွင်သာ ရှိရမည်။ Production, Packaging, Sales ကို table တစ်ခုတည်းအဖြစ် မပြရ။ Backend filter နှင့် UI tab/group နှစ်ခုလုံးက item type ကို ခွဲထားရမည်။

`effectiveFrom <= selectedDate < inactiveFrom` ဖြစ်မှ active item ဟု သတ်မှတ်ရမည်။ `inactiveFrom` သည် item စတင်သည့်နေ့ထက် စော၍ မဖြစ်ရ။

### ၄.၃ `purchases`

| Field | Type | Rule |
|---|---|---|
| `purchaseDate` | date | Purchase သွင်းသည့် business date |
| `itemId` | FK items | Item |
| `inputQuantity` | decimal | User ထည့်သည့်မူရင်း quantity |
| `inputUnit` | enum | `g`, `kg`, `viss`, `pcs` |
| `quantityGrams` | decimal | Internal canonical/base quantity; piece semantics ကို project decision နှင့် မရောစေရ |
| `totalCost` | decimal | Purchase total cost |
| `unitCostPerGram` | decimal | `totalCost / quantityGrams` |
| `status` | enum | `draft`, `confirmed`, `cancelled` |
| `confirmedAt` | timestamp nullable | Confirmation time |
| `note` | text nullable | Optional note |

Confirmed Purchase သာ inventory `In`, monthly average cost, dashboard/report valuation ထဲဝင်ရမည်။ Cancelled Purchase သည် history အဖြစ်ကျန်ရမည်၊ inventory မှ ဖယ်ရမည်။

### ၄.၄ `operations`

Production နှင့် Packaging ကို table တစ်ခုထဲမှာ သိမ်းနိုင်သော်လည်း `operationType` ဖြင့် ခွဲရမည်။ UI တွင် Production နှင့် Packaging သီးခြား workspace/table ဖြစ်ရမည်။

| Field | Type | Rule |
|---|---|---|
| `operationDate` | date | Business date |
| `itemId` | FK items | operation type နှင့် item type ကိုက်ရမည် |
| `operationType` | enum | `production` / `packaging` |
| `issuedQtyGrams` | decimal | Manual/generation base issued |
| `issuedOverrideQtyGrams` | decimal nullable | Recipe generated value ကို override လုပ်ရန် |
| `returnQtyGrams` | decimal | Return |
| `damageQtyGrams` | decimal | Damage |
| `inOverrideQtyGrams` | decimal nullable | Purchase `In` ကို manual override |
| `openingOverrideQtyGrams` | decimal nullable | Opening ကို manual override |
| `openingReason` | text nullable | Optional reason; UI requirement အရ blank ခွင့်ရှိနိုင်သည် |
| `note` | text nullable | Optional note |

Unique key သည် `(operationDate, itemId, operationType)` ဖြစ်ရမည်။ Save သည် upsert ဖြစ်ရမည်။

### ၄.၅ Sales entities

`shops` တွင် shop name နှင့် active state ရှိရမည်။ `shopItemPrices` တွင် `(shopId, itemId)` တစ်ခုစီအတွက် active selling price ရှိရမည်။ Sales item မဟုတ်သော item ကို shop price သတ်မှတ်ခွင့်မရှိရ။

`salesEntries` တွင် `(saleDate, shopId, itemId)` unique ဖြစ်ရမည်။ Fields များမှာ `produceQtyGrams`, `sellQtyGrams`, `sellingPricePerUnit`, `openingOverrideQtyGrams`, `openingReason`, `note` ဖြစ်ရမည်။ Price ကို shop settings မှ lock/copy လုပ်ပြီး sale row တွင် snapshot သိမ်းရမည်၊ နောင် shop price ပြောင်းလဲခြင်းကြောင့် historical sales total မပြောင်းရ။

### ၄.၆ Recipes နှင့် Orders

`recipes` သည် recipe header ဖြစ်ပြီး `recipeLines` သည် component lines ဖြစ်သည်။ Recipe တွင် name, output sales item, output quantity, active flag, `effectiveFrom`, note ရှိရမည်။

`orders` တွင် business date, `salesItemId`, quantity, note ရှိရမည်။ `(orderDate, salesItemId)` unique ဖြစ်ရမည်။ Order Table တွင် Sales item အားလုံးပေါ်ရမည်၊ quantity နှင့် note ထည့်ပြီး save လုပ်ရမည်။

Recipe version ကို effective date ဖြင့် ထိန်းရမည်။ 2026-08-03 မှ recipe ပြင်လျှင် 2026-08-03 နှင့် နောက်ပိုင်း order များကို version အသစ်သုံးရမည်။ အရင်နေ့ orders/operations ကို recipe အသစ်ဖြင့် ပြန်မပြောင်းရ။

### ၄.၇ Control/audit entities

`dailyLocks` သည် `(businessDate, ledgerType)` unique ဖြင့် Production/Packaging/Sales daily lock ကို ထိန်းသည်။ `auditLogs` သည် action, entity type/id, business date, details JSON/text, actor, timestamp ကို သိမ်းသည်။ Purchase confirm/cancel၊ operation save/opening override၊ sales save/opening override၊ order save၊ daily lock/reopen တို့ကို audit ပြုလုပ်ရမည်။

---

## ၅။ Unit နှင့် valuation rules

Canonical constants နှင့် formulas ကို backend, frontend display, import/export, report တို့တွင် တစ်နေရာတည်းမှ reuse လုပ်ရမည်။

| Input unit | Weight inventory (`displayUnit = g`) | Piece inventory (`displayUnit = pcs`) |
|---|---:|---:|
| `g` | ×1 | မလက်ခံရ |
| `kg` | ×1000 | မလက်ခံရ |
| `viss` | ×1632.93 | မလက်ခံရ |
| `pcs` | မလက်ခံရ | မူရင်း pcs အတိုင်း |

> `VISS_TO_GRAMS = 1632.93` ကို source of truth အဖြစ် သတ်မှတ်ရမည်။ Piece-based inventory ကို grams သို့ အလိုအလျောက်မပြောင်းဘဲ pcs semantics ကို ထိန်းသိမ်းရမည်။ Project version များအကြား legacy `quantityGrams` column naming က piece data အတွက် ရှုပ်ထွေးနိုင်သဖြင့် UI/API contract တွင် `baseQuantity` နှင့် `baseUnit` ကို ရှင်းလင်းသုံးပါ။

### ၅.၁ Monthly average cost

Selected business date ၏ calendar month တစ်ခုတည်းအတွင်းရှိ **confirmed purchases** များမှသာ average cost တွက်ရမည်။

```text
averageCostPerBaseUnit(month, item)
  = sum(confirmed purchase totalCost in month)
    / sum(confirmed purchase quantity in base unit in month)
```

ယခင်လ average ကို နောက်လသို့ မဆွဲသွားရ။ Purchase မရှိသောလတွင် average cost သည် 0 သို့မဟုတ် explicit “No cost data” ဖြစ်ရမည်။ Damage value၊ used value၊ closing value တို့ကို report month နှင့်ကိုက်ညီသော cost ဖြင့်တွက်ရမည်။

Sales item အတွက် `costPerUnit` နှင့် `gramsPerDisplayUnit` ကိုအသုံးပြု၍ sell quantity နှင့် sales cost/margin တွက်ရမည်။ Production/Packaging item list မှာ cost per unit ကို မပြရ။

---

## ၆။ Screen နှင့် navigation specification

### ၆.၁ Login

Login page တွင် Bakery ERP title, short description, Email field, Password field, Sign in button ပါရမည်။ Supabase Auth သုံးရမည်။ Login success ဖြစ်လျှင် ERP shell သို့သွားရမည်။ Invalid credentials, network failure, timeout, missing configuration များကို တိကျသော message ပြရမည်။ Indefinite loading မဖြစ်ရ။

Production hosting တွင် mobile network က Supabase Auth endpoint ကို တိုက်ရိုက်မရောက်နိုင်သောအခြေအနေရှိလျှင် same-origin server proxy သုံးနိုင်သည်။ Proxy သည် email/password ကို server-side Supabase Auth endpoint သို့ပို့ပြီး session token ပြန်ပေးသည်။ Password ကို log, audit details, database, GitHub ထဲ မသိမ်းရ။ Success response ရရှိပြီး browser Supabase client တွင် `setSession` လုပ်ရမည်။

### ၆.၂ ERP shell နှင့် global controls

Authenticated shell ၏ header/top bar တွင်—

- Bakery ERP brand/title။
- Global Business Date selector။
- Navigation buttons သို့မဟုတ် sidebar: Dashboard, Item Dashboard, Purchase, Production, Packaging, Sales, Reports, More။
- Current user နှင့် sign out။
- Mobile view တွင် horizontal overflow မဖြစ်စေရန် responsive navigation။

User က date တစ်နေရာတွင်သာ ပြောင်းပြီး application တစ်ခုလုံးပြောင်းရမည်။ Date state တစ်ခုချင်းစီကို page component ထဲ duplicate မထားရ။

### ၆.၃ Dashboard

Dashboard သည် selected Business Date အတွက် အောက်ပါ metrics ပြရမည်။

| Metric | Calculation |
|---|---|
| Daily Purchase Total | ယနေ့ confirmed purchase quantity နှင့် total cost |
| Closing Total/Value | Production + Packaging closing quantity × current-month average cost |
| Damage Total/Value | Daily damage quantity × current-month average cost |
| Sales quantity/value | ယနေ့ sell quantity နှင့် revenue |
| Sales margin | Sales revenue − sales cost |
| Low stock | Closing < item minimum stock ဖြစ်သော item များ |

Low-stock rows တွင် item type, name, current closing, minimum stock, unit ပြရမည်။

### ၆.၄ Item Dashboard

Item Dashboard သည် item master data ကို အောက်ပါ operational group သုံးခုဖြင့် ခွဲပြရမည်။

1. Production items
2. Packaging items
3. Sales items

Admin သာ item create/edit/deactivate/reactivate/reorder လုပ်နိုင်ရမည်။ Create fields များမှာ name, code, category, type, display unit, grams-per-display-unit, minimum stock, Sales item ဖြစ်လျှင် cost per unit, effective-from date ဖြစ်ရမည်။

Item အသစ်ကို 2026-08-18 တွင် စတင်သတ်မှတ်လျှင် 2026-08-17 နှင့် အရင်နေ့များတွင် မပေါ်ရ။ Delete button သည် “Delete from date” ပုံစံဖြစ်ရမည်။ 2026-08-18 မှစ၍ inactive ဖြစ်သော်လည်း 2026-08-16 နှင့် 2026-08-17 history များ မပျက်ရ။

Drag-and-drop သို့မဟုတ် move up/down ဖြင့် `sortOrder` ပြောင်းနိုင်ရမည်။ Item Dashboard ၏ order သည် Production, Packaging, Sales daily table တွင်လည်း တူညီရမည်။ Name column ကို horizontal overflow ဖြစ်သည့် table များတွင် sticky လုပ်ရမည်။

### ၆.၅ Purchase

Purchase page သည် selected date ကိုသာပြရမည်။ Row/form fields များမှာ Item, input quantity, unit, total cost, status, note ဖြစ်ရမည်။ Weight item တွင် g/kg/viss ရွေးနိုင်ရပြီး piece item တွင် pcs သာရွေးနိုင်ရမည်။ Internal base quantity နှင့် unit cost ကို server ကတွက်ရမည်။

Purchase lifecycle:

```text
draft → confirmed → cancelled
```

Confirmed လုပ်သောအခါ Production/Packaging `In` တွင် အလိုအလျောက် ပါဝင်ရမည်။ Confirmed purchase ကို cancel လုပ်သောအခါ အဆိုပါနေ့နှင့် နောက်နေ့ carryforward အားလုံး ပြန်တွက်ရမည်။ Cancelled record ကို ဖျက်ပစ်မည့်အစား status နှင့် audit history အဖြစ် ထားရမည်။ Cancel reason optional ဖြစ်နိုင်သည်။

Purchase page တွင် `Reset to purchase`, unexplained duplicate Save control, hidden mutation စသည့် မရှင်းလင်းသော control မထားရ။ Autosave သို့မဟုတ် explicit create/confirm action ရှိလျှင် label ကို ရှင်းလင်းပြရမည်။

### ၆.၆ Production နှင့် Packaging

Production နှင့် Packaging သည် UI တွင် သီးခြား page/table ဖြစ်ရမည်။ Row တစ်ခုစီတွင် အနည်းဆုံး—

| Column | Meaning |
|---|---|
| Name | Item |
| Opening | Previous closing or manual opening override |
| In | Confirmed purchase total or manual `In` override |
| Issued | Recipe/order generated or manual override |
| Return | Returned amount |
| Damage | Damaged amount |
| Used | `Issued − Return − Damage` |
| Closing | `Opening + In + Return − Issued` |
| Note | Optional note |

Order + recipe ရှိလျှင် `Issued` ကို auto generate လုပ်ရမည်။ User သည် `Issued` ကို manual edit/override လုပ်နိုင်ရမည်။ `In` သည် Purchase မှ auto ဖြစ်သော်လည်း manual edit လုပ်နိုင်ရမည်။ Manual `In` override ဖျက်လျှင် Purchase-derived value သို့ပြန်ရမည်။ Opening override တွင် reason ကို optional ခွင့်ပြုနိုင်သော်လည်း audit သည် action နှင့် user ကို သိမ်းရမည်။

Row edit တစ်ခုချင်းပြီးတိုင်း page-wide loading မဖြစ်ရ။ Input ကို local state/optimistic cache ဖြင့် ချက်ချင်းပြပြီး background autosave လုပ်ရမည်။ Save မအောင်မြင်လျှင် row-level error နှင့် retry ပြရမည်။ Negative closing ဖြစ်လျှင် warning ပြနိုင်သော်လည်း business rule အရ လုံးဝမတားရမည်ဆိုလျှင် server validation သတ်မှတ်ချက်ကို ရှင်းလင်းထားရမည်။

### ၆.၇ Order Table

Order Table သည် Sale item အတွက် daily order entry ဖြစ်သည်။ Item Dashboard ၏ Sales group ထဲက active sales items အားလုံးကို selected date အတွက် ပြရမည်။ Column များမှာ Name, Qty, Note ဖြစ်ရမည်။

Order save ပြီးလျှင်—

1. Selected date order record သိမ်းရမည်။
2. ထို sales item အတွက် active recipe ကို `effectiveFrom <= orderDate` ဖြင့် ရွေးရမည်။
3. Recipe output quantity နှင့် order quantity ratio ဖြင့် component quantity တွက်ရမည်။
4. Production/Packaging component items ၏ `Issued` မှာ generated value ပေါ်ရမည်။
5. Manual Issued override ရှိလျှင် manual value က generated value ကို override လုပ်ရမည်။

Formula:

```text
componentIssued = orderQuantity
                  × recipeLineQuantity
                  / recipeOutputQuantity
```

### ၆.၈ Sales

Sales page သည် shop တစ်ခုချင်းစီအလိုက် tab/selector ဖြင့် ရွေးနိုင်ရမည်။ Sales items နှင့် shop price settings ကိုအသုံးပြု၍ daily table ပြရမည်။ Columns များမှာ Name, Opening, Produce, Sell, Closing, Shop, Unit Price, Total, Note ဖြစ်နိုင်သည်။

`Produce` နှင့် `Sell` သည် manual input ဖြစ်ရမည်။ `Opening` နှင့် `Closing` သည် auto ဖြစ်ရမည်။ User မှ opening override ခွင့်ပြုမည်ဆိုလျှင် row-level override field နှင့် optional reason ထည့်ရမည်။

```text
closing = opening + produce - sell
salesTotal = sell × sellingPricePerUnit
```

Shop-item price မသတ်မှတ်ထားလျှင် save ကို server-side reject လုပ်ရမည်။ Historical sale row တွင် အဲဒီနေ့ price snapshot သိမ်းထားရမည်။ Shop price အသစ်ပြောင်းခြင်းသည် အရင်နေ့ sales total မပြောင်းရ။

### ၆.၉ More

More ကို accordion တစ်ခုမဟုတ်ဘဲ destination buttons/cards ဖြင့် ပြသရမည်။ အနည်းဆုံး—

- Item Dashboard
- Shops & Prices
- Recipes
- Order Table
- Import / Export
- Audit Log
- Backup
- Admin Users / Role Management

More button ကိုနှိပ်လျှင် သက်ဆိုင်ရာ page/tool သို့ ရောက်ရမည်။ Helper explanation အရှည်ကြီးများကို table အပေါ်တွင် မထည့်ဘဲ tooltip/help drawer သို့ ရွှေ့နိုင်သည်။

### ၆.၁၀ Recipes

Admin သာ recipe create/edit/delete/activate/deactivate လုပ်နိုင်ရမည်။ Recipe editor တွင် name, output sales item, output quantity, effective-from, note နှင့် component line အများအပြား ပါရမည်။ Component တစ်ခုချင်းစီတွင် item နှင့် quantity grams ရှိရမည်။

Existing recipe ကို အနာဂတ် effective date ဖြင့် ပြင်လျှင် version အသစ် create လုပ်ရမည်။ အရင်နေ့ data ကို mutation မပြုရ။

### ၆.၁၁ Reports

Reports page တွင် `Daily` နှင့် `Date range` mode နှစ်ခုရှိရမည်။ Daily mode သည် Global Business Date နှင့် တိုက်ရိုက်ချိတ်ရမည်။ Date range mode တွင် from/to date ရွေးရမည်။ `from > to` ဖြစ်လျှင် error ပြရမည်။ Active item filter သည် လက်ရှိ report view နှင့်ကိုက်ညီသော item များကိုသာ ပြရမည်။

Tabs အနည်းဆုံး—

| Tab | Content |
|---|---|
| Purchases | Date, item, input/base quantity, unit, total cost, status |
| Production | Per-item opening, in, issued, return, damage, used, closing, value |
| Packaging | Production report နှင့်တူသော packaging data |
| Sales | Per-item quantity, revenue, price နှင့် shop breakdown |
| Damage | Item-wise damage quantity နှင့် average-cost damage value |

Date-range `perItem` payload တွင် opening, in, issued, return, closing, average cost, purchase quantity/cost, used quantity/value, damage quantity/value, produce, sell, sales value, closing value, sales-by-shop ပါရမည်။ Report export သည် လက်ရှိ filter/mode/data ကို XLSX အဖြစ် download လုပ်ရမည်။

### ၆.၁၂ Import / Export

Import/Export ကို Purchase, Production, Packaging, Sales page တစ်ခုချင်းစီတွင် ထပ်မတင်ဘဲ **More → Import / Export** တစ်နေရာတည်းတွင် စုစည်းရမည်။ User သည် date နှင့် table type ရွေးပြီး export/import လုပ်နိုင်ရမည်။

| Template | Required columns |
|---|---|
| Purchase | `Date`, `Item ID`, `Qty`, `Unit`, `Total Cost`, optional `Status`, `Note` |
| Production | `Date`, `Item ID`, `Issued g`, `Return g`, `Damage g`, optional overrides/note |
| Packaging | Production template နှင့်တူပြီး item type သည် packaging ဖြစ်ရမည် |
| Sales | `Date`, `Shop ID`, `Item ID`, `Produce g`, `Sell g`, optional `Price per Unit`, `Note` |
| Order | `Date`, `Sales Item ID`, `Qty`, `Note` |

Template download တွင် example row များပါလျှင် real customer data မဟုတ်ကြောင်း ရှင်းရမည်။ Production system သည် fabricated reviews/testimonials မထည့်ရ။ Myanmar Unicode XLSX ကို round-trip test လုပ်ရမည်။ CSV ထည့်လျှင် UTF-8 BOM ထည့်ပြီး Excel တွင် မြန်မာစာ မပျက်စေရ။

Import validation သည် server-side ဖြစ်ရမည်။ Invalid item id, date, unit, item type, negative quantity, unknown shop, inactive item, duplicate unique key များကို row-level error အဖြစ်ပြရမည်။ Valid rows များကို အကုန် rollback လုပ်မည့်အစား transactional import policy ကို developer က ရွေးပြီး UI တွင် ရှင်းလင်းပြရမည်။

### ၆.၁၃ Backup နှင့် Audit

Admin Backup သည် items, purchases, operations, orders, shops, shop prices, sales entries, recipes, recipe lines အားလုံးကို timestamp ပါသော JSON/XLSX backup အဖြစ် ထုတ်ပေးရမည်။ Restore feature ရှိလျှင် destructive overwrite မလုပ်မီ confirmation နှင့် backup snapshot လုပ်ရမည်။

Audit log တွင် date range, action, actor, entity, details filter များ ပါရမည်။ Password/token များကို audit details တွင် မထည့်ရ။

---

## ၇။ Backend/API contract အကြံပြုချက်

tRPC သို့မဟုတ် typed RPC သုံးပါ။ အနည်းဆုံး procedure namespaces များမှာ—

```text
auth.me
items.list / create / update / deactivate / reactivate / reorder
purchases.list / create / confirm / cancel
operations.daily / save
sales.daily / save
shops.list / save / prices / savePrice
recipes.list / save / delete
orders.daily / save
dashboard
reports.summary
search
daily.status / lock / reopen
audit.list
admin.users / setRole / backup
```

Input validation အတွက် Zod သုံးနိုင်သည်။ Date string သည် `YYYY-MM-DD` regex ဖြင့် validate ရမည်။ Numeric fields များသည် finite, non-negative/positive rules ဖြင့် validate ရမည်။ Server response သည် decimal values ကို consistent numeric/string convention ဖြင့် ပြန်ရမည်။ Frontend calculation နှင့် server calculation မတူစေရ။

Authenticated context flow:

```text
Browser Supabase session
  → Authorization: Bearer access_token
  → server verifies /auth/v1/user
  → maps auth UUID to local users.openId
  → upsert lastSignedIn
  → protectedProcedure context user
```

Supabase PostgreSQL connection တွင် production TLS issue မဖြစ်စေရန် connection string ထဲက conflicting `sslmode`, `sslrootcert`, `sslcert`, `sslkey` query parameters ကို normalize လုပ်ပြီး Node `pg` pool options တွင် explicit SSL policy သတ်မှတ်ရမည်။ Database errors ကို context layer တွင် အမြဲ swallow မလုပ်ဘဲ server log နှင့် user-facing retry/error state ရှိရမည်။

---

## ၈။ Frontend UX နှင့် performance

Daily ledger သည် mobile-first ဖြစ်ရမည်။ User သည် horizontal scroll လုပ်လျှင် Name column sticky ဖြစ်ရမည်။ Table row edit တွင် optimistic/local state ဖြင့် ချက်ချင်းပြပြီး mutation တစ်ခုချင်းစီကြောင့် entire page loading မဖြစ်ရ။

Query key များသည် `businessDate`, ledger type, shop id, report range, item filter တို့ကို တိတိကျကျ ပါရမည်။ Date ပြောင်းလဲသောအခါ stale query ကို selected date အဖြစ် မပြရ။ React query cache သုံးပြီး prior data ကို background refresh လုပ်နိုင်သည်။ Infinite refetch မဖြစ်စေရန် object/array query inputs များကို memoize/stabilize လုပ်ရမည်။

Loading/error state များကို page-wide blank state မဟုတ်ဘဲ section/row-level ပြရမည်။ Request timeout တွင် Retry button ပါရမည်။ Sign-in loading သည် indefinite မဖြစ်ရ။

PWA အတွက် manifest, secure origin, service worker ပါနိုင်သည်။ သို့သော် service worker သည် HTML/JS authentication bundle အဟောင်းကို အမြဲ cache မထားရ။ Deploy အသစ်ပြီးနောက် app shell version bump လုပ်ရမည်၊ navigation နှင့် executable script များကို network-first သုံးရမည်။

---

## ၉။ Security နှင့် data integrity

1. Supabase publishable key ကို frontend တွင်သုံးနိုင်သော်လည်း service-role key နှင့် database URL ကို server-only ထားရမည်။
2. `.env` နှင့် credentials များကို GitHub မတင်ရ။
3. Password, refresh token, API key များကို log, audit, error response, spreadsheet backup ထဲ မထည့်ရ။
4. Item/purchase/operation/sales delete သည် hard delete မဟုတ်ဘဲ status/effective-date/history-preserving design ဖြစ်ရမည်။
5. Purchase cancellation သည် downstream balances ကို deterministic ပြန်တွက်ရမည်။
6. Daily lock သည် server-side enforce ဖြစ်ရမည်။
7. Admin-only mutation များကို direct API call ဖြင့် bypass မလုပ်နိုင်ရ။
8. Import row အားလုံးကို validation ပြီးမှ database ထဲသိမ်းရမည်။
9. Myanmar Unicode normalization ကို မလိုအပ်ဘဲ destructive transform မလုပ်ရ။ Search တွင် case-insensitive matching သုံးနိုင်သော်လည်း user-entered string ကို မပျက်စေရ။

---

## ၁၀။ Testing plan နှင့် acceptance criteria

### ၁၀.၁ Unit tests

အောက်ပါ calculation tests များ မဖြစ်မနေရှိရမည်။

```text
normalize g/kg/viss correctly
reject pcs for weight items
preserve pcs for piece items
item effectiveFrom/inactiveFrom visibility
Used = Issued - Return - Damage
Closing = Opening + In + Return - Issued
Sales closing = Opening + Produce - Sell
Recipe issued = Order × Line / Output
Monthly average = month-local confirmed cost / month-local base quantity
```

### ၁၀.၂ Integration tests

- Confirmed Purchase တစ်ခုသည် same-day Production/Packaging In တွင် ပေါ်ရမည်။
- Purchase cancel ပြီးနောက် In ပျောက်ရမည်၊ နောက်နေ့ balances ပြန်တွက်ရမည်။
- 12 ရက် operation edit သည် 13/14/15 ကိုပြောင်းပြီး 11 ကိုမပြောင်းရ။
- Manual In override ရှိလျှင် Purchase auto value မသုံးရ။ Override null ပြန်လုပ်လျှင် auto value ပြန်သုံးရမည်။
- Order save သည် active effective recipe မှန်ကို အသုံးပြုပြီး Issued သို့ generated quantity ထည့်ရမည်။
- Recipe effective date အသစ်သည် အရင်နေ့ record ကို မပြောင်းရ။
- Shop price မရှိလျှင် Sales save reject ဖြစ်ရမည်။
- Daily lock ရှိလျှင် operational save reject ဖြစ်ရမည်။
- Admin မဟုတ်သူသည် admin mutation မခေါ်နိုင်ရ။
- Burmese item/shop/note ကို XLSX export/import round-trip လုပ်လျှင် စာမပျက်ရ။

### ၁၀.၃ Browser/mobile acceptance

| Test | Expected result |
|---|---|
| Login with valid Supabase account | Dashboard ပေါ်ရမည်၊ indefinite spinner မဖြစ်ရ |
| Invalid login | Fast, readable error; retry လုပ်နိုင်ရ |
| Change global date | All workspace data uses same selected date |
| Edit one ledger row | Row updates immediately; page-wide reload မဖြစ်ရ |
| Change date on slow network | Section loading/error state သာပြပြီး app blank မဖြစ်ရ |
| Sticky Name column | Horizontal scroll အတွင်း item name မြင်ရမည် |
| Install PWA | Secure origin တွင် manifest/service worker အလုပ်လုပ်ရမည် |
| Import Myanmar XLSX | မြန်မာစာမပျက်၊ row validation result ရှိရမည် |
| Export report | Selected filters/date mode နဲ့ကိုက်ညီသော file ထွက်ရမည် |

---

## ၁၁။ Recommended implementation order

Developer သည် feature များကို အောက်ပါအစီအစဉ်ဖြင့် တည်ဆောက်သင့်သည်။

1. PostgreSQL schema နှင့် Supabase Auth mapping တည်ဆောက်ပါ။
2. Global Business Date context နှင့် date-only API contract တည်ဆောက်ပါ။
3. Item lifecycle, item type, effective-date query filter နှင့် sort order တည်ဆောက်ပါ။
4. Shared calculation module ကို unit tests ဖြင့် အရင်ရေးပါ။
5. Purchase lifecycle နှင့် confirmed purchase source ကို တည်ဆောက်ပါ။
6. Production/Packaging carryforward read model နှင့် autosave mutation တည်ဆောက်ပါ။
7. Shops, prices, Sales daily ledger တည်ဆောက်ပါ။
8. Recipes နှင့် Order Table မှ Issued generation တည်ဆောက်ပါ။
9. Dashboard နှင့် reports တည်ဆောက်ပါ။
10. More tools: import/export, audit, lock, backup, user roles တည်ဆောက်ပါ။
11. PWA cache strategy နှင့် mobile table UX တည်ဆောက်ပါ။
12. Full regression, browser/mobile test, deployment smoke test ပြီးမှ production deploy လုပ်ပါ။

Feature တစ်ခုချင်းစီပြီးတိုင်း migration, API, UI, permission, error state, Unicode test, carryforward test နှင့် export/import test ကို စစ်ရမည်။

---

## ၁၂။ Hosting နှင့် deployment contract

Production host သည် **GitHub repository + Netlify** ဖြစ်ရမည်။ Manus preview/hosting သည် development preview အဖြစ်သာ သတ်မှတ်ရမည်၊ production URL မဟုတ်ရ။

Recommended flow:

```text
Local source change
  → pnpm test
  → pnpm check
  → pnpm build
  → GitHub main push
  → Netlify build/deploy
  → live URL smoke test
  → Supabase login + CRUD + report verification
```

Netlify environment variables များတွင် အနည်းဆုံး `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` သို့မဟုတ် `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` နှင့် server/runtime settings များ ပါရမည်။ Secret တန်ဖိုးများကို GitHub, source, screenshot, documentation ထဲ မရေးရ။

Netlify build ပြီးလျှင် `/`, `/api/trpc/auth.me`, same-origin auth endpoint, static assets, PWA manifest/service worker, server function logs များကို စစ်ရမည်။ HTTP 200 သာဖြင့် login အောင်မြင်သည်ဟု မသတ်မှတ်ရ။ Real authenticated session တစ်ခုဖြင့် dashboard ရောက်ကြောင်း စစ်ပြီးမှ deploy ကို အောင်မြင်သည်ဟု သတ်မှတ်ရမည်။

---

## ၁၃။ Source-of-truth file map

အောက်ပါ project files များသည် လက်ရှိ implementation ၏ အဓိက vocabulary နှင့် logic ကို ဖော်ပြသော source of truth များဖြစ်သည်။ အခြား Developer သည် မူရင်း project ကို ပြန်လည်လေ့လာပါက ဤအစီအစဉ်အတိုင်း ဖတ်သင့်သည်။

| File | အဓိကအကြောင်းအရာ |
|---|---|
| `drizzle/schema.ts` | PostgreSQL entities, enums, indexes, unique constraints |
| `shared/inventory.ts` | Unit normalization, carryforward formulas, recipe quantity, monthly cost |
| `server/routers/inventory.ts` | All protected/admin procedures and server-side workflow rules |
| `client/src/pages/BakeryERP.tsx` | Main shell, page composition, daily workflows, More tools |
| `client/src/pages/DetailedReports.tsx` | Daily/range report mode, item filters, export UX |
| `client/src/pages/RecipeManager.tsx` | Recipe version/editor behavior |
| `client/src/_core/hooks/useAuth.ts` | Session initialization, timeout, retry/error handling |
| `server/_core/supabaseAuth.ts` | Supabase token verification and local user mapping |
| `server/_core/supabaseAuthProxy.ts` | Same-origin password sign-in bridge when required by hosting/network |
| `client/public/sw.js` | PWA cache policy; must not serve stale auth bundle |
| `docs/WORKFLOW.md` | Concise workflow contract |
| `docs/FINAL_REQUIREMENTS_COVERAGE.md` | Existing coverage and known limitations to review |

---

## ၁၄။ Final definition of done

Website ကို အောက်ပါအချက်များအားလုံး ပြည့်မှသာ “copy-ready ERP” ဟု သတ်မှတ်ရမည်။

- Production, Packaging, Sales သုံးခုသည် data semantics နှင့် UI grouping အရ သီးခြားဖြစ်သည်။
- Global Business Date သည် system တစ်ခုလုံးတွင် တစ်ရက်တည်းဖြစ်သည်။
- Item lifecycle သည် effective date ဖြင့် history မပျက်စေဘဲ အလုပ်လုပ်သည်။
- Purchase confirm/cancel သည် ledger In နှင့် downstream carryforward ကို မှန်ကန်စွာ ပြောင်းသည်။
- Production/Packaging formulas နှင့် manual overrides မှန်သည်။
- Sales shop/item opening, produce, sell, closing, price, total မှန်သည်။
- Recipe/order သည် effective-date မှန်ကန်သော Issued generation ပြုလုပ်သည်။
- Dashboard နှင့် reports သည် selected date/range, item filter, shop breakdown, cost/value မှန်သည်။
- Import/export သည် date, unit, item type, Unicode validation ဖြင့် အလုပ်လုပ်သည်။
- Admin lock, audit, backup, role management ရှိသည်။
- Login တွင် timeout/error recovery ရှိပြီး real account session ဖြင့် dashboard ရောက်နိုင်သည်။
- 35+ automated tests, TypeScript check, production build, mobile browser checks ဖြင့် အတည်ပြုထားသည်။
- Production သည် GitHub + user-owned Netlify ကိုသာ အသုံးပြုပြီး secrets များ source ထဲ မပါ။

---

## References

[1]: `docs/WORKFLOW.md` — Bakery ERP Workflow Contract in the current project.
[2]: `drizzle/schema.ts` — Current PostgreSQL schema and enum definitions.
[3]: `shared/inventory.ts` — Canonical unit normalization and inventory formulas.
[4]: `server/routers/inventory.ts` — Current server-side inventory router and business rules.
[5]: `docs/FINAL_REQUIREMENTS_COVERAGE.md` — Current coverage notes and known implementation limitations.
[6]: `docs/live-auth-diagnosis.md` — Prior production authentication diagnosis and TLS context.
