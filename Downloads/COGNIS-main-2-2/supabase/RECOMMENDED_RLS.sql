-- Defense-in-depth Row Level Security policies.
--
-- The app currently does ALL database access through the Next.js API
-- routes using the Supabase service-role key (see src/lib/supabaseAdmin.ts),
-- which bypasses RLS entirely. Authorization is enforced in application
-- code (auth.getUser() + ownership checks) instead.
--
-- That's fine as long as the anon key is never used to query these tables
-- directly from the browser. Enabling RLS below costs nothing and protects
-- you if that ever changes (e.g. someone adds a client-side Supabase query
-- later and forgets these tables are otherwise wide open to the anon key).
--
-- Run this in the Supabase SQL editor. Adjust table/column names if yours differ.

alter table assessments enable row level security;
alter table questions enable row level security;
alter table attempts enable row level security;

-- Recruiters can only see/manage their own assessments.
create policy "recruiters manage own assessments"
  on assessments
  for all
  using (auth.uid() = recruiter_id)
  with check (auth.uid() = recruiter_id);

-- Questions are readable by anyone (candidates need them to take the exam)
-- but only writable by the owning recruiter. If you want stricter public
-- read access, remove the public select policy and go through the API
-- route only (which already strips correct_answer/expected_output).
create policy "questions readable by anyone"
  on questions
  for select
  using (true);

create policy "recruiters manage questions on own assessments"
  on questions
  for insert
  with check (
    exists (
      select 1 from assessments
      where assessments.id = questions.assessment_id
      and assessments.recruiter_id = auth.uid()
    )
  );

-- Attempts: no direct anon/public access at all — everything goes through
-- the API routes, which apply their own field-level redaction for
-- candidates vs. recruiters (see src/app/api/attempts/[id]/route.ts).
create policy "recruiters view attempts for own assessments"
  on attempts
  for select
  using (
    exists (
      select 1 from assessments
      where assessments.id = attempts.assessment_id
      and assessments.recruiter_id = auth.uid()
    )
  );
