-- Drop the old enum type and recreate with lowercase values
DROP TYPE IF EXISTS "vehicles_status_enum" CASCADE;

-- Create the new enum with lowercase values
CREATE TYPE "vehicles_status_enum" AS ENUM('pending', 'active', 'inactive', 'inspection_failed', 'maintenance', 'rented');

-- Add the status column back to vehicles table if it doesn't exist
ALTER TABLE "vehicles" 
ADD COLUMN IF NOT EXISTS "status" "vehicles_status_enum" DEFAULT 'pending';

-- Update the status column type
ALTER TABLE "vehicles" 
ALTER COLUMN "status" TYPE "vehicles_status_enum" 
USING "status"::text::"vehicles_status_enum";

-- Set default value
ALTER TABLE "vehicles" 
ALTER COLUMN "status" SET DEFAULT 'pending';

