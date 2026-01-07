# Scheduler App - TODO Tracker

This document tracks items to update, fix, or implement in the Scheduler App.

## How to Use

- Add new items to the appropriate category section below
- Mark completed items with ✅
- Move items between categories as priorities change
- Use the checkbox format `- [ ]` for easy tracking

---

## 🐛 Bug

Issues that need to be fixed.

- [ ] Handle duplicate display names - determine what to do when multiple staff members have the same display name
- [ ] Fix timezone issue causing dates to shift by one day in sub finder (dates stored as DATE type are being parsed as UTC, causing day shift in local timezones)

---

## 🚀 Near Term Feature

Features to implement soon (within the next few weeks).

- [ ] Display name options - offer display name format options (e.g., "First Name Last Initial") with ability to apply to all staff or just the current instance
- [x] Create profile entry for current user - manually create profile entry linking auth user to school (needed for testing audit logging and override functionality) ✅ Added API endpoint and UI page at /setup/profile
- [ ] Enhanced profile creation UI - create thorough profile creation process where users add their name, select a role, choose/assign school, and provide other necessary information (expand beyond the basic auto-creation)
- [ ] User onboarding UI - create UI flow for onboarding new users, collecting necessary information (name, role, school assignment)
- [ ] School management UI - add ability to create new schools and manage school settings
- [ ] Timezone settings - add timezone configuration section to Settings to allow schools to set their timezone, ensuring dates are displayed and processed correctly

---

## 🔮 Future Feature

Features for later consideration (beyond the next few weeks).

- [ ] For each section of the weekly schedule side panel, add ability to apply to every day or every time slot
- [ ] Create multiple baseline weekly schedules (e.g., Spring 2026 Schedule) and see a history of weekly schedules
- [ ] Specify enrollment by class grouping (e.g., Toddler A (2), Toddler B (3)) instead of a single enrollment value
- [ ] Preserve application state when navigating between sections - maintain user context (e.g., selected absence, sub finder filters, selected shifts) when switching to dashboard or other sections and returning, so users don't lose their work in progress

---

## 🧪 Testing

Test cases to add or testing improvements.

- [x] Add tests for handling deleting or deactivating class groups, classrooms, teachers, and subs

---

## Completed Items

Items that have been finished (moved here for reference).

<!-- Move completed items here and mark with ✅ -->

---

## Notes

_Add any additional notes, context, or reminders here._

