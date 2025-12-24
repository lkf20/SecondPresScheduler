-- Seed data for reference tables

-- Insert Days of Week
INSERT INTO days_of_week (name, day_number, display_order) VALUES
  ('Sunday', 0, 0),
  ('Monday', 1, 1),
  ('Tuesday', 2, 2),
  ('Wednesday', 3, 3),
  ('Thursday', 4, 4),
  ('Friday', 5, 5),
  ('Saturday', 6, 6)
ON CONFLICT (name) DO NOTHING;

-- Insert Time Slots
-- Note: Adjust default_start_time and default_end_time based on your actual schedule
INSERT INTO time_slots (code, name, default_start_time, default_end_time, display_order) VALUES
  ('EM', 'Early Morning', '07:00:00', '09:00:00', 1),
  ('AM', 'Morning', '09:00:00', '12:00:00', 2),
  ('LB', 'Lunch Bunch', '12:00:00', '13:00:00', 3),
  ('AC', 'After Care', '13:00:00', '17:00:00', 4)
ON CONFLICT (code) DO NOTHING;

