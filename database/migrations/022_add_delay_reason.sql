-- Add delay_reason column to transport_requests for cycle time alert explanations
ALTER TABLE transport_requests ADD COLUMN delay_reason TEXT;
