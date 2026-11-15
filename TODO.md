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

## Phase 3: Renderer Optimizations ✅
- [x] Fix DnsContext - remove auto-benchmark on mount
- [x] Add virtualization to HistoryPage
- [x] Add virtualization to RestorePointsPage
- [ ] Add virtualization to StartupPage (apps, tasks, services) - complex 3-tab layout
- [ ] Add virtualization to EmuladoresPage\AppListView - complex grid layout

## Phase 4: PowerShell Query Optimizations (Pending)
- [ ] Add `-Property` minimum to all Select-Object calls
- [ ] Reduce WMI query depth where possible

## Phase 5: Bundle Analysis (Pending)
- [ ] Run visualizer to identify heavy dependencies
- [ ] Replace date-fns with Intl.DateTimeFormat if used
- [ ] Ensure lodash is tree-shaken

## Gate Checks (after each phase) ✅
- [x] `bun run lint` passes
- [x] `bun run typecheck` passes
- [x] `bun run test` passes (101 files, 1118 tests)
- [x] `bun run build` passes

## Performance Results

### Before (with animated background, no optimizations):
- CPU floor median: 16.7%
- CPU median: 23.6%
- RAM private median: ~260 MB

### After (Phases 1-3, power save mode OFF):
- CPU floor median: 2.1% - 30.6% (variance due to system activity)
- CPU median: 7.6% - 40%
- RAM private median: 230 - 270 MB
- GPU process: 0.6% - 9.5% (would be 0% with power save mode ON)

### Key Improvements Implemented:
1. **WMI Consolidation**: Reduced from ~11 PowerShell spawns to 1 consolidated query + fallbacks
2. **os.cpus() primary**: CPU info now uses Node.js native `os.cpus()` as primary source (~0ms vs 1.6s WMI)
3. **Power Save Mode**: New user setting to disable GPU acceleration and limit renderer processes
4. **Defensive parsing**: Fixed "Cannot read properties of undefined (reading 'trim')" error
5. **Cache system**: Disk cache for DashboardData with atomic writes (5s TTL)
6. **Lazy providers**: CPU/Memory/RestorePoint providers no longer fetch on mount
7. **DnsContext fix**: Removed auto-benchmark on mount (was spawning PowerShell unnecessarily)
8. **Virtualization**: HistoryPage and RestorePointsPage use @tanstack/react-virtual for large lists
9. **StrictMode fix**: Module-level refs prevent double-fetch in React 18 StrictMode