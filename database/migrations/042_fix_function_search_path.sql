-- Pin search_path on update_updated_at_column() to silence the Supabase linter
-- warning `function_search_path_mutable`. The function only uses NEW and built-ins,
-- so an empty search_path is safe and prevents schema-hijack attacks where a user
-- with CREATE rights on an earlier schema could shadow built-in names.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';
