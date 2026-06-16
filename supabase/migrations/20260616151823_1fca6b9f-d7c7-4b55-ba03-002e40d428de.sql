-- Restrict Realtime channel subscriptions to authenticated users only.
-- Per-row protection is already enforced by RLS on public.incidents, so authenticated
-- subscribers will only receive incident rows where auth.uid() = user_id.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users can read realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users can send realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);
