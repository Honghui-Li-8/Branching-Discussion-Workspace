TRUNCATE TABLE public.branches, public.discussions RESTART IDENTITY CASCADE;

INSERT INTO public.discussions (title, status)
VALUES
  ('Kickoff discussion', 'open'),
  ('Roadmap debate', 'open'),
  ('Release notes', 'closed');

INSERT INTO public.branches (discussion_id, parent_branch_id, content)
SELECT d.id, NULL, 'Root branch for ' || d.title
FROM public.discussions d
WHERE d.title IN ('Kickoff discussion', 'Roadmap debate', 'Release notes');
