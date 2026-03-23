# Multi-classroom `coverage_request_shifts` — dependency audit

Quick pass over call sites after **one time_off_shift → N coverage_request_shifts** (migration 121). Marked **safe** when per-classroom identity is already respected or the path is unrelated; **updated** when this change set adjusted behavior.

| Area                                                                        | Verdict     | Notes                                                                           |
| --------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `app/api/sub-finder/unassign-shifts/route.ts`                               | **safe**    | Uses `assignment_id` / `coverage_request_shift_id` where scoped; room-specific. |
| `app/api/sub-finder/coverage-request/[absence_id]/assigned-shifts/route.ts` | **safe**    | Returns rows per assignment / coverage shift.                                   |
| `lib/api/sub-assignments.ts`                                                | **safe**    | Joins on `coverage_request_shift_id` / classroom as before.                     |
| `lib/api/substitute-contacts.ts`                                            | **safe**    | Contact is per coverage request; shift overrides remain per shift id.           |
| `app/api/dashboard/data-health/route.ts`                                    | **safe**    | No change required; spot-check if new health rules added later.                 |
| `lib/utils/sub-combination.ts`                                              | **safe**    | Works off shift-level recommendation data with `classroom_id` where present.    |
| `app/api/dashboard/overview/route.ts`                                       | **safe**    | Counts shifts; more CRS rows = more granular coverage (intended).               |
| `lib/api/coverage-request-counters.ts`                                      | **safe**    | Counters reconciled in migration 121; trigger maintains on assign/unassign.     |
| `lib/hooks/use-sub-recommendations.ts`                                      | **safe**    | Per `coverage_request_shift` / shift payload.                                   |
| `components/sub-finder/hooks/useSubFinderData.ts`                           | **updated** | Maps `shift_label` / multi-room labels from API.                                |
| `app/api/sub-finder/find-subs/route.ts`                                     | **safe**    | Per-shift recommendations use classroom where provided.                         |
| `app/api/sub-finder/shift-overrides/route.ts`                               | **safe**    | Per `coverage_request_shift_id`.                                                |
| `lib/api/time-off.ts`                                                       | **safe**    | Creates person-level `time_off_shifts` only.                                    |
| `app/api/time-off-requests/route.ts`                                        | **safe**    | Lists requests; no per-room aggregation required.                               |
| `POST /api/assign-sub/shifts`                                               | **updated** | Logs `console.warn` when `keySimple` map fallback is used.                      |
| `GET /api/sub-finder/coverage-request/[absence_id]`                         | **updated** | Inserts per classroom; sets `time_off_shift_id`.                                |
| `components/assign-sub/AssignSubPanel.tsx`                                  | **updated** | Multi-room floater vs single-room UI; post-assign “still needs coverage”.       |
| `components/sub-finder/ContactSubPanel.tsx` / `CoverageSummary.tsx`         | **updated** | Optional `shift_label` for grouped line display.                                |
| `app/api/sub-finder/absences/route.ts`                                      | **updated** | `getClassroomsForShift` + `shift_label` for multi-room copy.                    |

Re-audit if new APIs join only on `(coverage_request_id, date, time_slot_id)` without `classroom_id`.
