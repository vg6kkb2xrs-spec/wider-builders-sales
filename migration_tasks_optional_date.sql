-- Task management: make due_datetime optional.
-- Run this in the Supabase SQL editor BEFORE merging the feature.
-- Without it, adding a task with no date (a plain to-do) fails the NOT NULL constraint.
ALTER TABLE tasks ALTER COLUMN due_datetime DROP NOT NULL;
