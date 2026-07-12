-- ============================================
-- BookSmart Database Schema
-- Migration 011: Create User Feedback Table
-- ============================================

-- Create user_feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
-- Users can only insert their own feedback
CREATE POLICY "Users can insert their own feedback" ON user_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback" ON user_feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Add index for user_id and created_at
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at);
