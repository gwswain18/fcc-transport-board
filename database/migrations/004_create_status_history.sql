-- Create status_history table
CREATE TABLE status_history (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES transport_requests(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    from_status request_status,
    to_status request_status NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_status_history_request_id ON status_history(request_id);
CREATE INDEX idx_status_history_timestamp ON status_history(timestamp);
