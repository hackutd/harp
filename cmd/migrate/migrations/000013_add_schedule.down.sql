DROP INDEX IF EXISTS idx_schedule_start_time;
DROP TRIGGER IF EXISTS trg_schedule_updated_at ON schedule;
DROP TABLE IF EXISTS schedule;
