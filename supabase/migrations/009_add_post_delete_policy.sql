-- Add DELETE policy for posts table
-- Users can only delete their own posts

CREATE POLICY "Allow users to delete their own posts" ON posts
  FOR DELETE USING (auth.uid()::text = user_id);
