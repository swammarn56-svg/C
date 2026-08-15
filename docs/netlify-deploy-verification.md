# Netlify deployment verification

On 2026-08-15, the connected Netlify project `swammarn` confirmed that production deployment `main@5edf5b9` was published in 25 seconds. The project is configured for automatic publishing from the `main` branch of `https://github.com/swammarn56-svg/C`.

The live production URL is `https://swammarn.netlify.app` and the published deployment permalink is `https://6a80d42d4810d90008e44c45--swammarn.netlify.app`.

## Historical Purchase normalization

The legacy-In coverage audit returned no uncovered rows after the normalization. The published Production ledger confirmed that August 1 Purchase-derived In values are restored; for example, Flour displays `40,000 g`, Eggs `30,000 g`, and Butter `25,000 g`. The August 1 Flour closing balance of `34,849 g` also appeared as the August 2 Flour opening balance, confirming carryforward remains intact.

## Published ledger UI

The production deployment shows no per-row Save button, no Opening-reason input, no Purchase-helper text in the In column, and no repeated Import/Export panel on the daily ledger pages. Production and Packaging display the original CSV sequence; the first Packaging entries are `S`, `C`, `O`, `D`, `Nco`, and `Cc`. The Item Dashboard’s Production tab shows the same source sequence beginning with `ဂျုံ`, `ကြက်ဥ`, `Butter`, and `W.Sugar`.

More → Import/Export was also checked live. It provides a dedicated Date control, a Table selector with Purchase, Production, Packaging, and Sales options, XLSX and CSV templates, XLSX and CSV exports, and one XLSX/CSV import action.

For the sticky Name column, the published Packaging table was tested in a simulated narrow `320px` container with an `1100px` table. The table had true horizontal overflow (`scrollLeft: 300`), while the first Name cell remained at the same left edge as the table container (`16px`) with `position: sticky` and `z-index: 2`.
