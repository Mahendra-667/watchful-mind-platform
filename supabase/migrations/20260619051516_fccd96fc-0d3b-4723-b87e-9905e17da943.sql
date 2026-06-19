-- Tighten realtime.messages policies: scope channel topic to the authenticated user.
-- Channel naming convention: "incidents:{auth.uid()}"
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;

CREATE POLICY "Users can read own realtime channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'incidents:' || auth.uid()::text
);

CREATE POLICY "Users can send to own realtime channel"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = 'incidents:' || auth.uid()::text
);
