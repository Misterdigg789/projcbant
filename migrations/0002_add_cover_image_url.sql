-- Add cover_image_url column to challenges table
-- This allows storing base64-encoded cover images for admin-created challenges

ALTER TABLE challenges 
ADD COLUMN cover_image_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN challenges.cover_image_url IS 'Base64-encoded cover image data URL for admin-created challenges';
