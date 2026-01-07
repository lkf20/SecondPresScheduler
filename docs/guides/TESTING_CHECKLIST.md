# Scheduler App - Testing Checklist

## Overview
This checklist will help you systematically test all features of the Scheduler web application.

---

## 1. Authentication & Navigation ✅

- [ ] Login page loads at `http://localhost:3001/login`
- [ ] Can log in with your Supabase credentials
- [ ] After login, redirects to `/dashboard`
- [ ] Dashboard shows 6 quick action cards
- [ ] Sidebar navigation is visible and functional
- [ ] Header shows your email and logout button
- [ ] Logout works and redirects to login page

---

## 2. Settings (Reference Data) ⚙️

**Start here!** Other features depend on this data.

### Classes
- [ ] Go to **Settings → Classes**
- [ ] Click "Add Class"
- [ ] Create a class (e.g., "Infants", "Toddler A", "Toddler B")
- [ ] Save and verify it appears in the list
- [ ] Test search/filter functionality
- [ ] Click on a class name to edit
- [ ] Update the class name
- [ ] Delete a class (with confirmation)

### Classrooms
- [ ] Go to **Settings → Classrooms**
- [ ] Click "Add Classroom"
- [ ] Create a classroom (e.g., "Yellow Room", capacity: 12)
- [ ] Save and verify it appears in the list
- [ ] Test search functionality
- [ ] Click on a classroom name to edit
- [ ] Update classroom name and capacity
- [ ] Delete a classroom (with confirmation)

### Time Slots
- [ ] Go to **Settings → Time Slots**
- [ ] Verify time slots from seed data are visible (EM, AM, LB, AC)
- [ ] Click on a time slot code to edit
- [ ] Update time slot details (name, start time, end time, display order)
- [ ] Add a new time slot if needed
- [ ] Delete a time slot (with confirmation)

---

## 3. Teachers Management 👨‍🏫

- [ ] Go to **Teachers**
- [ ] Click "Add Teacher"
- [ ] Fill out the form:
  - First Name, Last Name (required)
  - Email (required)
  - Display Name (optional)
  - Phone (optional)
  - Active checkbox
- [ ] Save and verify the teacher appears in the list
- [ ] Test search functionality
- [ ] Click on a teacher name to view/edit
- [ ] Test editing a teacher (update name, email, etc.)
- [ ] Test deleting a teacher (with confirmation)
- [ ] Verify active/inactive status displays correctly

---

## 4. Subs Management 👩‍🏫

- [ ] Go to **Subs**
- [ ] Click "Add Sub"
- [ ] Fill out the form (same fields as teachers)
- [ ] Save and verify the sub appears in the list
- [ ] Test search functionality
- [ ] Click on a sub name to view/edit
- [ ] Test editing a sub
- [ ] Test deleting a sub (with confirmation)
- [ ] Verify active/inactive status displays correctly

---

## 5. Time Off Requests 📅

- [ ] Go to **Time Off**
- [ ] Click "Add Time Off"
- [ ] Fill out the form:
  - Select a teacher
  - Start date and end date
  - Time slot (optional, or "All Day")
  - Notes (optional)
- [ ] Save and verify it appears in the list
- [ ] Test filtering by teacher or date range
- [ ] Verify time off requests display correctly

---

## 6. Other Features (Placeholders) 🚧

These show "coming soon" messages but should load without errors:

- [ ] **Sub Finder** — placeholder page loads
- [ ] **Assignments** — placeholder page loads
- [ ] **Validation** — placeholder page loads
- [ ] **Reports** — placeholder pages load:
  - Weekly Schedule
  - Weekly Schedule with Subs
  - Sub Availability

---

## 7. Database Connectivity 🔌

- [ ] Check browser console (F12 → Console) for errors
- [ ] Check terminal for server errors
- [ ] Verify data persists after page refresh
- [ ] Verify created records appear in Supabase Dashboard:
  - Go to Supabase Dashboard → Table Editor
  - Check `classes`, `classrooms`, `time_slots`, `staff` tables
  - Verify your test data is there

---

## 8. Error Handling 🛡️

- [ ] Test with invalid form data (should show validation errors)
- [ ] Test with missing required fields
- [ ] Test network errors (disconnect internet, should show error message)
- [ ] Verify error messages are user-friendly
- [ ] Verify forms don't submit with invalid data

---

## 9. UI/UX Testing 🎨

- [ ] All pages load without layout issues
- [ ] Navigation is smooth and responsive
- [ ] Forms are easy to use
- [ ] Buttons and links are clearly clickable
- [ ] Search functionality works on all list pages
- [ ] Tables are sortable where indicated
- [ ] Pagination works (if you have more than 10 items)
- [ ] Mobile responsiveness (test on different screen sizes)

---

## Quick Test Sequence (Recommended Order)

1. ✅ **Settings → Classes** → Add "Infants"
2. ✅ **Settings → Classrooms** → Add "Yellow Room"
3. ✅ **Settings → Time Slots** → Verify existing slots
4. ✅ **Teachers** → Add a test teacher
5. ✅ **Subs** → Add a test sub
6. ✅ **Time Off** → Add a time off request
7. ✅ **Verify in Supabase Dashboard** → Check all tables have data

---

## Expected Behavior

### ✅ If Everything Works:
- You can create teachers, subs, classes, and classrooms
- Data persists in Supabase
- Navigation works smoothly
- Forms validate correctly
- Edit and delete functions work

### ⚠️ If You See Errors:

**"Failed to load..." messages:**
- Database tables may not exist → Run migrations in Supabase
- RLS policies may be blocking → Check migration 004 was applied

**Empty lists:**
- Normal if no data yet
- Try adding some test data

**Network errors:**
- Check Supabase connection
- Verify environment variables are set
- Check RLS policies allow your operations

**404 errors:**
- Page may not exist → Check if route file exists
- Navigation link may be incorrect

---

## Notes

- **Database migrations must be applied** before testing data operations
- **RLS policies** must allow authenticated users to INSERT/UPDATE/DELETE
- All **reference data** (classes, classrooms, timeslots) should be set up before testing scheduling features
- The app is currently in **proof-of-concept** phase - some features are placeholders

---

## Next Steps After Testing

Once basic CRUD operations work:
1. Test teacher schedule management (when implemented)
2. Test sub availability management (when implemented)
3. Test Sub Finder algorithm (when implemented)
4. Test assignment workflow (when implemented)
5. Test validation and reports (when implemented)

---

**Last Updated:** After initial app setup and RLS policy fixes



