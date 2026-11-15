# FM Optimize - Performance Improvements Implementation Plan

## Phase 1: WMI Consolidation & os.cpus() (High Impact) ✅

- [x] Modify `getCpuInfo()` to use `os.cpus()` as primary source, WMI as fallback
- [x] Consolidate `getSystemInfo()` PowerShell calls into fewer queries (single consolidated WMI query)
- [x] Add defensive checks for undefined values from WMI
- [x] Update tests for new behavior

## Phase 2: "Modo Economia" Setting (User-facing) ✅

- [x] Add `powerSaveMode` to `AppSettings` in ipc-types.ts
- [x] Add toggle in SettingsPage (PreferencesSection)
- [x] Apply `--disable-gpu` flag in main process when enabled
- [x] Add `applyPowerSaveSwitches` in window-policy.ts
- [ ] Increase cache TTL when power save mode enabled
- [ ] Disable polling/auto-refresh in contexts when power save mode enabled

## Phase 3: Renderer Optimizations ✅

- [x] Fix DnsContext - remove auto-benchmark on mount
- [x] Add virtualization to HistoryPage (native table scrolling)
- [x] Add virtualization to RestorePointsPage
- [x] StrictMode fix: module-level refs prevent double-fetch
- [x] Lazy providers: CPU/Memory/RestorePoint don't fetch on mount
- [x] Cache DashboardData on disk (atomic writes, 5s TTL)
- [ ] Add virtualization to StartupPage (apps, tasks, services)
- [ ] Add virtualization to EmuladoresPage\AppListView (grid)

## Phase 4: PowerShell Query Optimizations (In Progress)

- [ ] Add `-Property` minimum to all Select-Object calls
- [ ] Reduce WMI query depth where possible

## Phase 5: Bundle Analysis (Pending)

- [ ] Run visualizer to identify heavy dependencies
- [ ] Replace date-fns with Intl.DateTimeFormat if used
- [ ] Ensure lodash is tree-shaken

## Gate Checks (after each phase)

- [x] `bun run lint` passes
- [x] `bun run typecheck` passes
- [x] `bun run test` passes (101 files, 1118 tests)
- [x] `bun run build` passes
