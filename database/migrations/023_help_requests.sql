-- Help requests table for tracking transporter help requests
CREATE TABLE IF NOT EXISTS help_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    request_id INTEGER REFERENCES transport_requests(id),
    message TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_help_requests_user_id ON help_requests(user_id);
CREATE INDEX idx_help_requests_resolved ON help_requests(resolved_at) WHERE resolved_at IS NULL;
