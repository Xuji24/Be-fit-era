-- community_posts.user_id was referencing auth.users, not public.profiles.
-- PostgREST needs the FK to point at profiles for the join to work.
ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
