-- Create floor enum
CREATE TYPE floor_type AS ENUM ('FCC1', 'FCC4', 'FCC5', 'FCC6');

-- Create priority enum
CREATE TYPE priority_type AS ENUM ('routine', 'stat');

-- Create request status enum
CREATE TYPE request_status AS ENUM (
    'pending',
    'assigned',
    'accepted',
    'en_route',
    'with_patient',
    'complete',
    'cancelled'
);

-- Create transport_requests table
CREATE TABLE transport_requests (
    id SERIAL PRIMARY KEY,
    origin_floor floor_type NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    patient_initials VARCHAR(3),
    destination VARCHAR(100) NOT NULL DEFAULT 'Atrium',
    priority priority_type NOT NULL DEFAULT 'routine',
    special_needs JSONB NOT NULL DEFAULT '[]',
    special_needs_notes TEXT,
    notes TEXT,
    status request_status NOT NULL DEFAULT 'pending',
    created_by INTEGER NOT NULL REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    en_route_at TIMESTAMP WITH TIME ZONE,
    with_patient_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX idx_transport_requests_status ON transport_requests(status);
CREATE INDEX idx_transport_requests_created_at ON transport_requests(created_at);
CREATE INDEX idx_transport_requests_assigned_to ON transport_requests(assigned_to);
CREATE INDEX idx_transport_requests_priority ON transport_requests(priority);
CREATE INDEX idx_transport_requests_origin_floor ON transport_requests(origin_floor);
