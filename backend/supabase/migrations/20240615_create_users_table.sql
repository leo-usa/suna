-- Migration: Create users table for user profiles
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY,
    name text
); 