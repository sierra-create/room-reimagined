/*
  # Create Space Organizer Schema

  1. New Tables
    - `spaces`
      - `id` (uuid, primary key) - Unique space identifier
      - `user_id` (uuid, foreign key to auth.users) - Owner of the space
      - `name` (text) - User-provided name for the space
      - `room_type` (text) - Type of room (bedroom, kitchen, garage, office, etc.)
      - `original_image_url` (text) - URL of the uploaded original photo
      - `rearranged_image_url` (text, nullable) - URL of the AI-rearranged version
      - `analysis` (jsonb, nullable) - AI analysis of the space (clutter score, issues, suggestions)
      - `status` (text) - Processing status: 'uploaded', 'analyzing', 'rearranging', 'complete', 'error'
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

    - `suggestions`
      - `id` (uuid, primary key) - Unique suggestion identifier
      - `space_id` (uuid, foreign key to spaces) - Associated space
      - `category` (text) - Category: 'rearrangement', 'product', 'declutter', 'storage', 'tip'
      - `title` (text) - Short title of the suggestion
      - `description` (text) - Detailed description/reasoning
      - `priority` (integer) - Priority ranking (1 = highest)
      - `product_url` (text, nullable) - Shopping link for product suggestions
      - `price_range` (text, nullable) - Estimated price range (e.g. "$20-50")
      - `search_query` (text, nullable) - Search query for shopping sites
      - `image_url` (text, nullable) - Product image URL
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on both tables
    - Users can only CRUD their own spaces
    - Users can only read suggestions for their own spaces
    - No public access

  3. Indexes
    - Index on spaces.user_id for fast user queries
    - Index on suggestions.space_id for fast space lookup
*/

CREATE TABLE IF NOT EXISTS spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT '',
  room_type text NOT NULL DEFAULT 'other',
  original_image_url text NOT NULL DEFAULT '',
  rearranged_image_url text,
  analysis jsonb,
  status text NOT NULL DEFAULT 'uploaded',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spaces"
  ON spaces FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own spaces"
  ON spaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own spaces"
  ON spaces FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own spaces"
  ON spaces FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid REFERENCES spaces(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL DEFAULT 'tip',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  priority integer NOT NULL DEFAULT 0,
  product_url text,
  price_range text,
  search_query text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view suggestions for own spaces"
  ON suggestions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spaces
      WHERE spaces.id = suggestions.space_id
      AND spaces.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create suggestions for own spaces"
  ON suggestions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spaces
      WHERE spaces.id = suggestions.space_id
      AND spaces.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete suggestions for own spaces"
  ON suggestions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spaces
      WHERE spaces.id = suggestions.space_id
      AND spaces.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_spaces_user_id ON spaces(user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_space_id ON suggestions(space_id);
