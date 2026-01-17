-- Create transporter status enum
CREATE TYPE transporter_status_type AS ENUM (
    'available',
    'assigned',
    'accepted',
    'en_route',
    'with_patient',
    'on_break',
    'off_unit',
    'offline'
);

-- Create transporter_status table
CREATE TABLE transporter_status (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status transporter_status_type NOT NULL DEFAULT 'offline',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index
CREATE INDEX idx_transporter_status_user_id ON transporter_status(user_id);
CREATE INDEX idx_transporter_status_status ON transporter_status(status);

-- Create trigger for updated_at
CREATE TRIGGER update_transporter_status_updated_at
    BEFORE UPDATE ON transporter_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
