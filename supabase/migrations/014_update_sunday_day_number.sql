-- Update Sunday's day_number from 0 to 7 so it sorts last (Monday-Sunday order)
UPDATE days_of_week
SET day_number = 7, display_order = 7
WHERE day_number = 0 AND name = 'Sunday';

