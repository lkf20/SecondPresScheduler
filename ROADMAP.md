# Scheduler App - Development Roadmap

This document outlines the high-level plan for building the complete Scheduler web application.

## Overview

The Scheduler App is a comprehensive substitute teacher scheduling system that replaces the Google Sheets-based solution. It provides a modern, flexible web interface for managing staff, schedules, time off requests, sub assignments, and reporting.

---

## Phase 1: Foundation & Core Setup ✅ COMPLETED

### Authentication & Infrastructure

- [x] Next.js 14 app setup with TypeScript
- [x] Supabase integration (database, auth)
- [x] Authentication flow (login, logout, session management)
- [x] Protected routes and middleware
- [x] Basic layout components (Header, Sidebar, AppLayout)

### Database Schema

- [x] Complete database schema design
- [x] All tables created (17 tables total)
- [x] Indexes for performance
- [x] Row Level Security (RLS) policies
- [x] Initial seed data

---

## Phase 2: Reference Data Management ✅ COMPLETED

### Settings Pages

- [x] Classes management (CRUD)
- [x] Classrooms management (CRUD)
- [x] Time Slots management (CRUD)
- [x] Settings navigation and layout

### Staff Management

- [x] Teachers management (CRUD)
- [x] Subs management (CRUD)
- [x] Staff role types (Permanent/Flexible)
- [x] Staff can be marked as both teacher and sub
- [x] Optional email fields

---

## Phase 3: Time Off & Availability 🚧 IN PROGRESS

### Time Off Requests

- [x] Time Off page structure
- [x] API routes for time off CRUD
- [ ] Time Off form (create/edit)
- [ ] Time Off list with filtering
- [ ] Date range selection
- [ ] Time slot selection (optional for all-day)
- [ ] Notes field

### Sub Availability

- [ ] Sub availability management page
- [ ] Weekly availability grid
- [ ] Exception dates (one-off availability changes)
- [ ] Availability by time slot
- [ ] API routes for availability CRUD

---

## Phase 4: Schedule Management 🔜 NEXT PRIORITY

### Teacher Schedules

- [ ] Teacher schedule creation/editing
- [ ] Weekly schedule view
- [ ] Schedule by day/time slot
- [ ] Class and classroom assignments
- [ ] Schedule validation rules
- [ ] Bulk schedule operations

### Class-Classroom Mappings

- [ ] Class-to-classroom mapping interface
- [ ] Day and time slot assignments
- [ ] Multiple classroom support per class

### Staffing Rules

- [ ] Staffing rules configuration
- [ ] Preferred vs required teachers
- [ ] Rules by class, day, and time slot
- [ ] Enrollment-based calculations

---

## Phase 5: Sub Finder & Assignment 🎯 HIGH PRIORITY

### Sub Finder Algorithm

- [ ] Sub Finder page implementation
- [ ] Algorithm to find available subs
- [ ] Qualification matching (class preferences)
- [ ] Availability checking
- [ ] Ranking/scoring system
- [ ] Multiple sub suggestions
- [ ] Contact sidebar integration

### Sub Assignments

- [ ] Manual sub assignment
- [ ] Assignment from Sub Finder results
- [ ] Partial shift assignments
- [ ] Assignment confirmation workflow
- [ ] Assignment history

### Sub Contact Log

- [ ] Contact tracking interface
- [ ] Contact status (called, confirmed, declined)
- [ ] Notes and timestamps
- [ ] Contact history per sub

---

## Phase 6: Reports & Analytics 📊 MEDIUM PRIORITY

### Schedule Reports

- [ ] Weekly regular schedule report
- [ ] Weekly schedule with subs report
- [ ] Printable formats
- [ ] PDF export

### Availability Reports

- [ ] Regular sub availability report
- [ ] Weekly sub availability report
- [ ] Availability by time slot

### Other Reports

- [ ] Time off summary
- [ ] Assignment history
- [ ] Staff utilization reports

---

## Phase 7: Validation & Quality Assurance 🔍 MEDIUM PRIORITY

### Schedule Validation

- [ ] Validation page/interface
- [ ] Staffing level validation
- [ ] Qualification checks
- [ ] Coverage validation
- [ ] Error reporting and resolution

### Data Integrity

- [ ] Constraint validation
- [ ] Data consistency checks
- [ ] Duplicate detection

---

## Phase 8: Advanced Features 🌟 FUTURE

### Preferences & Rules

- [ ] Classroom preferences (staff preferences)
- [ ] Class preferences (sub preferences)
- [ ] Advanced staffing rules
- [ ] Custom rule configurations

### Notifications & Alerts

- [ ] Email notifications for assignments
- [ ] Time off reminders
- [ ] Availability change alerts
- [ ] System notifications

### Calendar Integration

- [ ] Calendar view for schedules
- [ ] Calendar view for time off
- [ ] iCal export
- [ ] Google Calendar sync

### Mobile Optimization

- [ ] Mobile-responsive improvements
- [ ] Touch-friendly interfaces
- [ ] Mobile-specific workflows

### Analytics & Insights

- [ ] Dashboard analytics
- [ ] Usage statistics
- [ ] Trend analysis
- [ ] Performance metrics

---

## Phase 9: Polish & Optimization 🎨 ONGOING

### User Experience

- [ ] Loading states and skeletons
- [ ] Error handling improvements
- [ ] Success notifications
- [ ] Form validation enhancements
- [ ] Accessibility improvements

### Performance

- [ ] Query optimization
- [ ] Caching strategies
- [ ] Pagination improvements
- [ ] Lazy loading

### Testing

- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] User acceptance testing

---

## Technical Debt & Maintenance

### Code Quality

- [ ] TypeScript strict mode
- [ ] ESLint configuration
- [ ] Code formatting standards
- [ ] Component documentation

### Database

- [ ] Query optimization
- [ ] Index tuning
- [ ] Backup strategies
- [ ] Migration management

### Deployment

- [ ] Production environment setup
- [ ] CI/CD pipeline
- [ ] Environment configuration
- [ ] Monitoring and logging

---

## Current Status Summary

### ✅ Completed Features

- Authentication system
- Database schema and migrations
- Reference data management (Classes, Classrooms, Time Slots)
- Staff management (Teachers, Subs)
- Staff role types
- Basic UI components and layout

### 🚧 In Progress

- Time Off Requests (structure in place, forms needed)

### 🔜 Next Up

- Complete Time Off functionality
- Sub Availability management
- Teacher Schedule management

### 📋 Placeholder Pages (Need Implementation)

- Sub Finder
- Assignments
- Validation
- Reports (all report pages)

---

## Notes

- This roadmap is a living document and should be updated as priorities change
- Some features may be implemented in parallel
- User feedback may adjust the order of implementation
- Technical constraints may require adjustments to the plan

---

## Last Updated

December 2024
