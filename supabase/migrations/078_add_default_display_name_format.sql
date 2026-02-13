ALTER TABLE schedule_settings
  ADD COLUMN IF NOT EXISTS default_display_name_format TEXT NOT NULL DEFAULT 'first_last_initial';
