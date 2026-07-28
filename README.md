# ReactTabulator

**English** | [한국어](./README.ko.md)

A React wrapper component around [Tabulator](https://tabulator.info). Provides quick filter (Fuse.js),
column settings (show/hide + localStorage persistence), range selection/clipboard, edited-cell highlighting, and more as options.

This folder is **self-contained** and can be copied as-is into any other React project.
(Uses only relative paths and npm package imports — no project path aliases.)

## Motivation

The goal is to provide the spreadsheet-grade UX that business screens need — range selection/clipboard,
cell editing with change highlighting, transactional updates (`applyTransaction`), and row animations
(`animateRows`) — without the license cost of commercial grids such as AG Grid Enterprise.
It uses the MIT-licensed [Tabulator](https://tabulator.info) as the engine and fills the gaps
(React integration, toolbar UI, FLIP animations, localization, etc.) with custom implementations.


## Peer dependencies

The target project must have the following packages installed.

```bash
pnpm add react react-dom ahooks fuse.js tabulator-tables react-tiny-popover
```

| Package | Purpose |
| --- | --- |
| `react`, `react-dom` | React 18/19 (uses createRoot, useInsertionEffect) |
| `ahooks` | quick filter debounce (useDebounceFn) |
| `fuse.js` | quick filter fuzzy search |
| `tabulator-tables` | table core + base CSS |
| `react-tiny-popover` | column-settings popover (zero-dep) |

> **No antd / @ant-design/icons dependency.** UI (Button/Checkbox/Switch/Divider/Input) comes from local primitives, icons are inline SVG,
> and color/spacing tokens are provided by local default tokens (`./tokens`, Ant Design light tone).

### Dark mode / custom theme sync (optional)
If your app uses antd, you can inject antd tokens to sync the theme (the component itself stays antd-free):

```tsx
import { theme } from "antd";
const { token } = theme.useToken();
const { antdTabulator } = useAntdTabulatorTheme(token); // inject antd tokens instead of defaults
```

## Usage

```tsx
import { ReactTabulator, reactFormatter, useAntdTabulatorTheme } from "@/components/react-tabulator";

function Example({ rows }: { rows: any[] }) {
  const { antdTabulator } = useAntdTabulatorTheme(); // antd-tone theme class

  const columns = [
    { title: "Code", field: "code", width: 150 },
    { title: "Name", field: "name" },
    { title: "Status", field: "status", editor: "input" }, // edit via double-click / Enter
    { title: "Hidden", field: "memo", visible: false },
  ];

  return (
    <ReactTabulator
      idField="code"
      className={antdTabulator}
      data={rows}
      columns={columns}
      persistKey="example:columns"                 // key for persisting column visibility/width/order
      headerToolbar={{ quickFilter: { enabled: true }, columnSettingButton: { enabled: true } }}
      options={{ layout: "fitDataStretch", height: "400px" }}
    />
  );
}
```

## Main Props

| Prop | Type | Description |
| --- | --- | --- |
| `idField` | `string` | **(required)** Field name that uniquely identifies each row (replaces `options.index`) |
| `data` | `any[]` | Row data (incrementally updated via `replaceData` on change) |
| `columns` | `ColumnDefinition[]` | Tabulator column definitions (group columns supported) |
| `options` | `object` | Tabulator options (merged over the defaults) |
| `events` | `Record<string, fn>` | Tabulator event handlers |
| `className` / `style` | | Applied to the container |
| `onRef` | `(ref) => void` | Passes the Tabulator instance ref |
| `persistKey` | `string` | Persist/restore column visibility/width/order in localStorage |
| `rowNumber` | `boolean` | Show the row-number (global sequence) column. Default `true`; `false` hides it |
| `options.rowHeader` | `object \| false` | **Deep-merged with the default row-number column definition** so you can override only specific properties (e.g. `{ resizable: true, width: 80 }`). The global-sequence formatter is preserved. `false` hides the column. Row numbers use fixed-width digits (`rt-tabular-nums`) by default; set `{ cssClass: "rt-mono" }` for a full monospace font. Thousands separators (comma) are on by default — disable with `{ thousandsSeparator: false }` |
| `headerToolbar` | `HeaderToolbarConfig` | Top header toolbar (hidden when unset) |
| `flashOnChange` | `boolean` | Flash cells whose value changed on data update. Default `false`. See [Real-time updates / animations](#real-time-updates--animations) |
| `flashDuration` | `number` | Flash duration (ms). Default `800` |
| `coalesceUpdates` | `boolean` | Coalesce data updates via rAF (max one render per frame). Default `false` |
| `animateRows` | `boolean` | Slide rows smoothly when reordering changes their position (FLIP). Default `true` |
| `animateRowsDuration` | `number` | Row-move animation duration (ms). Default `250` |
| `animateCols` | `boolean` | Slide remaining columns smoothly when showing/hiding a column (FLIP). Default `true` |
| `animateColsDuration` | `number` | Column-move animation duration (ms). Default `250` |
| `autoSelectFirstCell` | `boolean` | Auto-select the first cell on initial render. Default `false` (no selection shown until the user clicks the table) |
| `locale` | `string \| boolean` | Display language. A locale string such as `"ko"` / `true` (auto-detect browser language) / unset = English. Switches instantly at runtime. See [Localization](#localization-i18n) |
| `statusBar` | `StatusBarConfig` | Bottom status bar (range aggregation). With `{ enabled: true }`, selecting a cell range shows **Count/Sum/Average/Min/Max** (AG Grid Status Bar equivalent). Numeric stats are based on numeric cells and appear when 2+ cells are selected. Cell edits and data updates refresh instantly |

### `HeaderToolbarConfig`

Each item is specified as a **config object** (`{ enabled?: boolean, ...options }`). When a config object is given, `enabled` defaults to `true`; per-button extension options are added to each config interface.

| Field | Type | Description |
| --- | --- | --- |
| `quickFilter` | `QuickFilterConfig` | Search input on the header left (shown when unset). Options: `enabled`, `keys`, `placeholder`, `debounce`, `exact` |
| `columnSettingButton` | `ColumnSettingButtonConfig` | Built-in column-settings UI on the header right (show/hide + save switch). The save switch appears when `persistKey` is set. Hidden when unset. Options: `enabled`, `label` |
| `addButton` | `AddButtonConfig` | Add-row (+) button. Hidden when unset. Options: `enabled`, `label` |
| `deleteButton` | `DeleteButtonConfig` | Delete-row (−) button. Hidden when unset. Options: `enabled`, `label` |
| `resetButton` | `ResetButtonConfig` | Reset button. Hidden when unset. Discards all local changes (cell edits, added rows, delete marks) and **restores the initial (init) data**, also resetting sorting, the quick filter, and the page position. The confirmation dialog appears **only when there are local changes** (add/delete/edit); with no changes, sorting/filter/page are reset silently. When the parent sends new `data`, that becomes the new baseline. While enabled, a snapshot (clone) is kept on every data arrival — consider the cost on very large / high-frequency screens. Options: `enabled`, `label` |

```tsx
headerToolbar={{
  quickFilter: { enabled: true, exact: true, placeholder: "Search code/name" },
  columnSettingButton: { enabled: true },
  addButton: { enabled: true, label: "New row" },   // override the button text via label
  deleteButton: { enabled: true },
  resetButton: { enabled: true },
}}
```

## Set Filter (Excel-style value filter)

A unique-value checkbox filter equivalent to AG Grid Enterprise's Set Filter. Set `setFilter: true` on a column definition to show a funnel icon in its header.

```tsx
const columns = [
  { title: "Category", field: "category", setFilter: true },
  { title: "Status", field: "status", setFilter: true },
];
```

- Clicking the icon opens a popup with the column's **unique-value checkbox list** (with a value search input and select-all). Changes apply immediately.
- null/undefined values are grouped under "(Blanks)". If there are more than 1,000 unique values, the overflow is truncated with a notice (performance guard).
- Combines with the quick filter as **AND**; the header icon is highlighted in the primary color while a filter is active.
- Cleared together with other filters by the reset (resetButton) and add (addButton) flows. Texts follow the locale dictionary (`setFilter*` keys).

## Localization (i18n)

Uses Tabulator's built-in [Localize module](https://tabulator.info/docs/6.5/localize) as-is. Core UI strings (paginator, loading/error overlay, headerFilter placeholder) and wrapper toolbar strings (search placeholder, add/delete, column settings) switch together.

```tsx
<ReactTabulator idField="id" data={rows} columns={cols} locale="ko" />
```

- **The default (unset) language is English**, and a `"ko"` (Korean) dictionary is bundled. Region-suffixed locales such as `"ko-kr"` fall back to `"ko"` via prefix matching. `locale={true}` auto-detects the browser language.
- **Runtime switching**: changing the `locale` prop calls `setLocale` internally and switches instantly without a rebuild (easy to wire to app language state such as i18next). Calling `setLocale()` directly on the instance obtained via `onRef` works the same way.
- **Extending/overriding dictionaries**: pass `options.langs` to deep-merge into the built-in dictionaries (user entries win). Wrapper strings live under the `reactTabulator` namespace.

```tsx
<ReactTabulator
  idField="id" data={rows} columns={cols} locale="ja"
  options={{
    langs: {
      ja: {
        reactTabulator: { quickFilterPlaceholder: "検索", addRow: "追加", deleteRow: "削除",
                          columnSetting: "列設定", persistColumns: "列設定を保存" },
        pagination: { first: "最初", prev: "前", next: "次", last: "最後" },
      },
    },
  }}
/>
```

- Missing translation keys automatically fall back to the default (English) strings. See the `WRAPPER_LANGS` export and the `ReactTabulatorLangTexts` type for the full key list.
- Precedence: explicit prop (e.g. `quickFilter.placeholder`) > locale dictionary > default (English).

## Default behavior (DEFAULT_OPTIONS)

- Sorting: click the icon, 3-step toggle (asc → desc → off)
- "All" option in the page-size selector: include `-1` (or Tabulator's native `true`) as in `options.paginationSizeSelector: [20, 50, 100, -1]` to show an "All" entry that displays every row on a single page (virtual scrolling retained). The label follows the locale dictionary (`pagination.all`)
- Fast-scroll mitigation: the vertical render buffer is automatically expanded to 2× the viewport (an explicit `options.renderVerticalBuffer` takes precedence), reducing blank flashes while dragging the scrollbar
- Range selection + clipboard copy/paste (spreadsheet style)
- Select a whole column: `Alt + left click` (Windows) / `Option + left click` (Mac)
- `editor` cells enter edit mode only via double-click or Enter; changed cells are highlighted
- Row-number (rowHeader) column shows the global sequence

## Extended API & row add / delete management (`addButton` / `deleteButton`)

With `headerToolbar: { addButton: { enabled: true }, deleteButton: { enabled: true } }`, the toolbar provides basic add/delete features.
- **`+` (add)**: creates a new row as the **first row** of the table (light blue background; managed internally via the `_isNew` flag). If sorting, the quick filter, or the page position is not in its initial state (which would make the new row invisible), a confirmation dialog notifies the user and then **resets them all** before adding. Cancelling aborts the add.
- **`-` (delete)**: toggles the deleted state of the selected range (or selected rows). Existing rows get a strikethrough (managed via the `_isDeleted` flag); new rows (`_isNew`) are removed entirely.

### Transactional updates (`applyTransaction`)

Provides an AG Grid–style, high-performance transaction API to add/update/delete multiple rows at once (batch arrays). External components can call it directly on the instance received via `onRef`.

```tsx
// Multiple changes in one transaction (optimized for performance and consistency)
const result = tableRef.current.applyTransaction({
  add: [{ name: "New item" }, { name: "Item 2" }], // batch add (auto-assigns the _isNew flag)
  update: [{ id: 1, _isDeleted: true }],           // soft-delete existing items by ID (strikethrough)
  remove: [document1, document2],                  // hard delete
});
```

The full lists of added/deleted rows (diff) can be extracted with the APIs below and sent to your backend:
```tsx
const addedData = tableRef.current.getNewRowsData();
const deletedData = tableRef.current.getDeletedRowsData();
```

![Sample](./img.png)

## Real-time updates / animations

Options for smoothly presenting frequent data updates, sorting, and column toggles. Tabulator has no native options for these, so they are implemented with the **FLIP technique**.

### `animateRows` (default `true`)

Slides rows from their old position to the new one when reordering changes their position (similar to AG Grid `animateRows`).

```tsx
<ReactTabulator idField="id" data={rows} columns={cols} animateRows animateRowsDuration={250} />
```

- **Behavior**: rows whose position changed after `updateData`/sorting glide to their new position
- **Cooldown**: to keep animations from overlapping under high-frequency updates, a new slide starts only after the previous one finishes (≥ `animateRowsDuration`) → prevents reflow storms and always plays to completion
- **Limitation (virtual scrolling)**: only rows visible in the viewport **both before and after** the update are animated (rows moving out of the viewport/page apply instantly). AG Grid has the same limitation.

### `animateCols` (default `true`)

Slides the columns that shift left/right when showing/hiding a column from the column-settings menu.

```tsx
<ReactTabulator idField="id" data={rows} columns={cols} headerToolbar={{ columnSettingButton: { enabled: true } }} animateCols />
```

- **Behavior**: hiding a column slides the columns on its right to the left; showing one slides them right
- **The target column itself** appears/disappears instantly — the other columns make room by sliding
- **Frozen columns** (e.g. ID/code) are excluded since their position is fixed

### `flashOnChange` (default `false`) / `coalesceUpdates` (default `false`)

- `flashOnChange`: briefly highlights cells whose value changed (numeric increase = green, decrease/non-numeric = red → fade to transparent). Adjust duration with `flashDuration` (default 800 ms). Rows are matched by `options.index` (default `"id"`), so a **stable id** is required.
- `coalesceUpdates`: even if the `data` prop changes multiple times within one frame, updates are merged via `requestAnimationFrame` into **at most one update/render per frame**. Greatly reduces re-render overhead for high-frequency (tens of Hz) real-time updates (little effect at low frequency).

> When values change via `updateData` while sorting is active, the table automatically re-sorts if a sort-key field changed, keeping order and row numbers consistent with the current display order.

## Helpers

- `reactFormatter(<Cell />)`: a formatter that renders a React component inside a Tabulator cell. The component receives `cell`/`value`/`rowData` props.
- `useAntdTabulatorTheme()`: returns the antd-tone theme class name (`{ antdTabulator }`). Pass it via `className`.
- Cell utility classes (when using the theme class): set `cssClass: "rt-mono"` on a column definition to apply a **monospace font** to that column (header + cells; for code/identifier columns — the font is replaceable via the `fontFamilyCode` token). `cssClass: "rt-tabular-nums"` keeps the current font but makes **digits fixed-width** so numbers align (for numeric columns).

```tsx
const columns = [
  { title: "Code", field: "code", cssClass: "rt-mono" },          // monospace font
  { title: "Amount", field: "amount", cssClass: "rt-tabular-nums" }, // aligned digits
];
```
- `createSparkChartFormatter(options)`: creates a lightweight canvas-based spark chart (bar/line) formatter. See [Spark charts](#spark-charts-createsparkchartformatter).
- `createSparkBarFormatter(options)`: backward-compatible convenience for `createSparkChartFormatter({ type: "bar" })`.

## Spark charts (createSparkChartFormatter)

No React/chart-library dependency. Creates a single canvas per cell and draws immediately, so cost stays low even with many rows.
Pass the return value as a column's `formatter`. Supports `type: "bar"` (default) or `type: "line"` (sparkline).

```tsx
import { createSparkChartFormatter } from "@/components/react-tabulator";

const columns = [
  // bars (default)
  { title: "Trend", field: "trend", formatter: createSparkChartFormatter() },
  // filled line + dots
  { title: "Sales", field: "sales", formatter: createSparkChartFormatter({ type: "line", fill: true, showDots: true }) },
];
```

### Common options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | `"bar" \| "line"` | `"bar"` | Chart type |
| `accessor` | `(cell) => number[]` | `cell => cell.getValue() ?? []` | Extracts the value array from the cell (omit if the field is already `number[]`) |
| `width` / `height` | `number` (px) | `90` / `22` | Canvas size (fit to column width / row height) |
| `color` | `string \| (v,i,arr)=>string` | `"#1677ff"` | bar = fill color / line = line & dot color (per-value if a function) |
| `domain` | `"auto" \| [min,max]` | `"auto"` | Normalization basis. `"auto"` = per-cell min–max; fixed = comparable across rows (out-of-range values clamped) |
| `padding` | `number` (px) | `1` | Edge padding (keeps marks from clipping) |
| `trackColor` | `string` | none | Background track. bar = behind slots / line = whole canvas background |

### `type: "bar"` only

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `gap` | `number` (px) | `1` | Gap between bars |
| `minBarHeight` | `number` (px) | `1` | Minimum height for the smallest bar (0 = hide the min-value bar) |

### `type: "line"` only

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `lineWidth` | `number` (px) | `1.5` | Line thickness |
| `fill` | `boolean \| string` | `false` | Area under the line. `true` = line color at alpha 0.15 / string = specified color |
| `showDots` | `boolean` | `false` | Draw a dot at each data point |
| `dotRadius` | `number` (px) | `1.5` | Dot radius (with `showDots`) |

### Examples

```tsx
// line sparkline
createSparkChartFormatter({ type: "line" })

// decrease = red / increase or flat = green (per-segment color for lines)
createSparkChartFormatter({
  type: "line",
  color: (v, i, arr) => (i > 0 && v < arr[i - 1] ? "#ff4d4f" : "#52c41a"),
})

// fixed scale for cross-row height comparison
createSparkChartFormatter({ type: "bar", domain: [0, 100] })

// when values are nested in an object
createSparkChartFormatter({ accessor: cell => cell.getValue()?.points ?? [] })
```

> **Notes**
> - If `color` is a **function**, lines use per-segment colors (based on the segment's starting value); a string draws a solid continuous line.
> - `fill: true` uses a representative color (default `#1677ff` unless a string) even when `color` is a function. To pin the fill color, pass a string like `fill: "rgba(...)"`.
> - With `domain: "auto"`, each cell has its own scale, so comparing heights across rows is meaningless. For comparison, fix it to `[min, max]`.

## TODO / Roadmap

- [ ] **Row DOM recycling in the virtual renderer** — Tabulator's vertical virtual renderer (`_virtualRenderFill`) destroys all rendered row DOM and recreates it at the new position whenever a scroll jump exceeds the buffer, which exposes a blank area while dragging the scrollbar (AG Grid avoids this by recycling row/cell DOM from a pool and keeping existing rows until replaced). The proper fix is to introduce row DOM reuse into the renderer — an engine-level change, so contributing to / filing an issue with **Tabulator upstream** is preferred over a local monkey-patch. Current mitigation: render buffer expanded to 2× the viewport. (Skeleton stripes were tried and removed — the lines showed through the translucent frost-veil cells.)

## Implementation scope — native wrapping vs custom

This section distinguishes what this wrapper simply passes through to native Tabulator features (wrapping) from what is implemented with custom logic because Tabulator lacks it.

### Wrapped Tabulator natives (option pass-through)

- Pagination (`pagination`/`paginationSize`), layout (`layout`), column moving (`movableColumns`)
- Range selection/clipboard (`selectableRange`, `clipboard*`), cell editing (`editor`/`editTriggerEvent`)
- Built-in formatters: `money`, `star`, `progress`, `tickCross`
- Group columns (nested `columns`), sorting (`sorter`/`headerSortTristate`), row numbers (`rowHeader`)
- The persistence engine itself (`persistence`/`persistenceID` — save/restore behavior)
- Data/column update APIs (`replaceData`/`setColumns`)


### Implemented in this wrapper (custom)

| Item | Description | Why custom |
| --- | --- | --- |
| React lifecycle bridge | Build once → incremental updates via `replaceData`/`setColumns`, StrictMode-safe cleanup | React integration for vanilla Tabulator |
| `reactFormatter` | Renders React components in cells via `createRoot` | Tabulator formatters support HTML/DOM only |
| Quick filter | Fuzzy/substring search across all rows via Fuse.js → applied with `setFilter`, input UI + debounce (ahooks) | Combined all-column fuzzy search is not built in |
| Built-in column-settings UI | Show/hide checkboxes + recursive parent/child group rendering + save-switch popover | Tabulator provides no such UI (persistence has no UI) |
| Row add/delete (add/delete) UI | Toolbar buttons for adding new rows (light blue) and toggling deletion of existing ones (strikethrough), with extraction APIs | Complex UI state sync and rendering optimization |
| headerToolbar layout | Single box for the top header (left: quick filter, right: column settings/row actions) | Not a Tabulator feature |
| Header click/double-click split | Click = sort cycle, Alt+click = select whole column (`addRange`) | Natively, click mixes sorting and selection |
| Sort icons (↑/↓/↕ SVG) | Custom SVG via `headerSortElement` + height/color CSS | Replaces the default triangles |
| Persist on/off gating | Custom `persistenceReaderFunc`/`WriterFunc` + save flag; bulk key removal per type when off | Native persistence is always on |
| Edited-cell highlighting | Compares against the initial value in `cellEdited` → adds a class + light red CSS | Tabulator has no changed-cell indicator |
| antd-tone theme | `useAntdTabulatorTheme` — injects token-based CSS via `useInsertionEffect` (scoped class) | Custom theme instead of the default |
| antd-free token system | Default tokens in `tokens.ts` + injection option | Own design values |
| CSS details | Opaque frozen-cell backgrounds, zebra stripes, rowHeader styling, header+table single box, flex fill, sort/link/range highlight colors | All custom CSS |
| Global row numbers | `getPosition + (page-1)*pageSize` | Native `rownum` restarts at 1 per page |

> Summary: engine behaviors (sorting, filtering, editing, paging, persistence, range, formatters) mostly wrap natives;
> React integration, UI (toolbar/column settings/primitives/popover), Fuse search, interaction splitting (click/double-click, manual sort), theme/tokens, cell highlighting, sort icons, and row numbering are custom.
