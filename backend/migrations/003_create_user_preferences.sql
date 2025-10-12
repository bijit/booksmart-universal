-- ============================================
-- BookSmart Database Schema
-- Migration 003: Create user_preferences table
-- ============================================

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_view TEXT DEFAULT 'card', -- 'card', 'list', 'folder'
  items_per_page INTEGER DEFAULT 20,
  auto_tag BOOLEAN DEFAULT true,
  theme TEXT DEFAULT 'light', -- 'light', 'dark', 'auto'
  settings JSONB DEFAULT '{}'::jsonb, -- Additional flexible settings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for updated_at
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE user_preferences IS 'Stores user-specific preferences and settings';
COMMENT ON COLUMN user_preferences.settings IS 'JSONB field for flexible additional settings';
