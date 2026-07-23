-- Migration 048: Shift end provenance + manager edits
-- end_reason records HOW a shift was closed so reports can distinguish
-- trusted ends from inferred ones:
--   'user'           - transporter ended their own shift
--   'supervisor'     - force-ended from the dispatcher/supervisor board
--   'manager'        - manager ended the user's session (Active Users tab)
--   'auto_logout'    - nightly sweep, transporter still online (sweep time)
--   'auto_truncated' - nightly sweep, transporter gone: end backdated to
--                      their last recorded activity
--   'manager_edit'   - shift times corrected by a manager
-- edited_by/edited_at mark manager corrections (full old/new values are in
-- audit_logs).

ALTER TABLE shift_logs
  ADD COLUMN IF NOT EXISTS end_reason TEXT,
  ADD COLUMN IF NOT EXISTS edited_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
