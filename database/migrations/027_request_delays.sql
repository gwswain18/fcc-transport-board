-- Request delays table for tracking multiple delay reasons per request
CREATE TABLE IF NOT EXISTS request_delays (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES transport_requests(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    custom_note TEXT,
    phase TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_request_delays_request_id ON request_delays(request_id);
CREATE INDEX idx_request_delays_user_id ON request_delays(user_id);
