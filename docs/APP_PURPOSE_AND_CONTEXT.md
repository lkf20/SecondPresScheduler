# App Purpose and Context

Use this document when making product, UX, or architectural decisions. It keeps intent centralized so contributors and AI agents can align changes with the app's goals. If a decision conflicts with this document, either update this file intentionally or revisit the change.

**Quick reference:** Single source of truth; baseline-first (permanent + flex define structure; subs are overlays). No silent data changes—inactive means visible but not selectable. Clarity and low cognitive load over feature density. Default: simpler, clearer, less magical.

---

## Key Terms

Use these terms consistently in the app and in documentation.

| Term                               | Definition                                                                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Baseline**                       | Structural staffing defined by permanent and flex staff; the foundation the weekly schedule is built on. Sub assignments are overlays on top of it.                    |
| **Class Group**                    | A grouping typically by age within a classroom. A classroom can have multiple class groups; used for staffing ratios and coverage.                                     |
| **Confirmed**                      | A status meaning the assignment is actually in place—no silent mismatch between "confirmed" and reality.                                                               |
| **Flex (flex staff)**              | Often semester-based staff; more stable than subs. Often college students; schedules change each semester. Can be used as subs in a pinch even if not marked as a sub. |
| **Inactive**                       | Not selectable for new assignments going forward; remains visible when referenced in history (no silent deletion).                                                     |
| **Overlay**                        | A temporary layer on top of baseline (e.g. sub assignment, flex assignment for a date range). Weekly schedule = baseline + overlays.                                   |
| **Permanent staff**                | Fixed structural staffing; part of the baseline.                                                                                                                       |
| **Preferred vs Required (ratios)** | Required = minimum staffing needed; Preferred = target staffing. Prefer to meet preferred when possible.                                                               |
| **Sub (substitute)**               | Temporary coverage for an absence. A sub can also be permanent or flex.                                                                                                |
| **Time off**                       | An absence request that creates coverage gaps, filled via Sub Finder or flex assignment.                                                                               |

---

## Who It's For

### Primary Users

- School Directors
- Assistant Directors
- Administrative staff responsible for scheduling and substitute coverage

### Environment

- Early childhood / preschool setting
- Single school (for now), potentially multi-school in the future
- ~60–70 staff total
- **Permanent teachers**
- **Flex staff** (generally semester-based and semi-permanent)
- **Substitute teachers** (who can also be Permanent or Flex staff)
- 14 classrooms
- 12 Class Groups (classrooms can have multiple Class Groups). Class Groups generally defined by age
- Complex staffing ratios and coverage needs, based on age

### User Context

- Users are busy, often making decisions quickly.
- Scheduling changes often happen in real time.
- Subs are needed on a daily basis.
- Director values giving teachers and staff flexibility in their schedules.
- Flex staff are generally college students whose schedules change each semester.
- In a pinch, Flex staff can also be used as Subs (even if not marked as a sub).
- Prefer to meet Preferred class ratios when possible.
- They are not technical.
- They value clarity, speed, and trustworthiness over advanced features.

---

## What Problem It Solves

This app replaces manual and spreadsheet-based scheduling systems.

It solves:

1. **Time-consuming substitute coordination**
   - Tracking who was contacted
   - Who responded
   - Who is available
   - Avoiding double booking
   - Finding the best sub combination for a time-off request

2. **Lack of visibility into staffing gaps**
   - Required vs preferred staffing
   - Understaffed classrooms
   - Flex capacity

3. **Baseline vs daily reality mismatch**
   - Permanent and flex staff define the baseline
   - Time off creates gaps
   - Sub Finder resolves those gaps
   - Weekly schedule reflects actual coverage

4. **Cognitive overload**
   - The director should not have to mentally track:
     - Who is out
     - Who is covering
     - Where there is flexibility
     - Whether ratios are satisfied

5. **A single source of truth** rather than multiple printed documents.

6. **A track record of what has been changed and by whom** so that changes are visible and fixable. The technical contract for audit logging is [AUDIT_LOG_CONTRACT.md](contracts/AUDIT_LOG_CONTRACT.md).

7. **Source for printing schedules and availability** that can be posted across the school.

---

## Core Product Principles

1. **Baseline is foundational**
   - Permanent + flex staff define structural staffing.
   - Sub assignments are temporary overlays.
   - Weekly schedule reflects reality layered on baseline.

2. **Status should reflect reality**
   - Confirmed means assigned.
   - No silent state mismatches.
   - No ambiguous logic.

3. **Avoid silent data changes**
   - Inactive items remain visible if referenced.
   - System never erases historical context.
   - Users explicitly remove assignments.

4. **Operational clarity > feature density**
   - Fewer states, clearer states.
   - Avoid badge overload.
   - Make urgent problems obvious.

5. **Keep UI consistent** (e.g. colors mean the same thing everywhere).

---

## Key User Flows and Priorities

These define "done right."

### 1. Absence → Coverage Flow (Critical Path)

Director creates a time off request.

1. Creates time off request for a teacher
2. Reviews affected shifts.
3. Opens Sub Finder.
4. Sees recommended subs.
5. Contacts subs.
6. Assigns confirmed sub(s).
7. Weekly schedule updates.
8. Staffing badge reflects new state.

**Requirements:**

- No double booking.
- Clear contact status.
- Confirmed must have assigned shift.
- Changes reflected immediately in staffing view.

### 2. Baseline Staffing Setup

Director defines semester structure.

1. Configures class groups, classrooms, days, time slots.
2. Assigns permanent staff.
3. Assigns flex staff (often term-based).
4. Reviews staffing ratios.

**Requirements:**

- Clear distinction between permanent and flex.
- No conflict between baseline and time off logic.
- Flex behaves closer to baseline than sub.

### 3. Weekly Operational Review

Director reviews current week in Dashboard and in Weekly Schedule.

1. Scans Upcoming Time Off
2. Scans Upcoming Subs
3. Scans Understaffed classrooms and Surplus classrooms
4. Makes adjustments (assign flex, find sub).

**Requirements:**

- Fast visual scanning.
- Clear state hierarchy.
- Above-preferred visible but not alarming.

### 4. Flex Assignment (Term-Oriented)

Director assigns flex staff for semester.

1. Selects slot in Weekly Schedule.
2. Assigns flex with date range.
3. Avoids double booking.
4. Sees impact on staffing calculations.

**Flex is:**

- More stable than sub.
- Often semester-based.
- Sometimes used as operational buffer.

### 5. Activity Log (Accountability)

Admin reviews what changed and by whom.

1. Sees global feed.
2. Filters by category (time off, sub assignment, baseline change).
3. Filters by actor.

**Purpose:**

- Prevent confusion.
- Support multi-admin coordination.
- Preserve trust.
- Facilitate undoing a mistake.

The audit log is implemented to satisfy [AUDIT_LOG_CONTRACT.md](contracts/AUDIT_LOG_CONTRACT.md).

---

## Non-Goals (Out of Scope for Now)

These are intentionally excluded for current stage:

- Payroll integration
- Time tracking
- Parent-facing features
- Mobile native app
- Staff self-service portal
- Messaging platform replacement
- Multi-school tenancy (future consideration)
- Automated sub matching with external databases
- Complex optimization algorithms
- AI-driven scheduling

This is an operational scheduling tool, not an HR platform.

**Future AI capability:** The app will include an AI chat interface that will enable the Director to provide simple commands such as "Assign time-off for Meg S. from Feb 4 to Feb 8 for all shifts." We need to build the app to support this capability in the future.

---

## Tone and Expectations

### Tone

- Professional
- Calm
- Clear
- Minimal jargon
- Direct but not technical
- No corporate buzzwords

### Error Messaging

- Actionable
- Specific
- Non-blaming
- No silent failures

### UI Philosophy

- Clean and structured
- Low cognitive load
- Avoid visual noise
- Prioritize operational scanning
- Make urgent states obvious
- Do not overwhelm with excessive badges or states

### Data Philosophy

- Never silently delete referenced data
- Inactive means "not selectable going forward"
- Confirmed must reflect actual assignment
- Baseline + overlay model is consistent everywhere

---

## Design Guardrails

- If a feature increases complexity without increasing clarity, reconsider it.
- If a state cannot be explained clearly in one sentence, simplify it.
- If a director would need training to understand it, it's too complex.
- Visual hierarchy matters more than feature richness.
- Avoid introducing new states unless absolutely necessary.
- When principles tension (e.g. clarity vs. showing every detail), prefer data integrity and operational clarity; when still unsure, ask.

---

## Future Evolution (Not Required Yet)

These may be introduced later:

- Schedule Terms (Fall/Spring)
- Multi-school support
- Advanced reporting
- Optimization suggestions
- Conversion from sub → flex suggestion
- Term duplication tools
- AI chat to make changes in the app

But current architecture should not assume them prematurely.

---

## Decision Check

When making changes, ask:

- Does this increase clarity?
- Does this align with baseline-first model?
- Does this reduce director cognitive load?
- Does this preserve data integrity?
- Does this introduce avoidable complexity?

If unsure, default to:

**Simpler, clearer, less magical.**
