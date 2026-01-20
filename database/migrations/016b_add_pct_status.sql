-- 016b: Add PCT status to request_status enum
-- Must be separate migration because PostgreSQL requires commit before using new enum value

ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'transferred_to_pct';
