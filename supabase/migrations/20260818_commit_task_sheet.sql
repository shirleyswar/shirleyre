-- §13.2 commit_task_sheet RPC — atomic write for TaskDetailSheet CONFIRM action.
-- Creates/replaces the Postgres function used by the task sheet to apply due date,
-- list type, and optional note in one transaction.

CREATE TABLE IF NOT EXISTS task_note (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.commit_task_sheet(
  p_task_id   uuid,
  p_due_date  date,
  p_list_type text,   -- 'life' | 'entity' | null
  p_note_body text    -- null if no note
) RETURNS void AS $$
BEGIN
  UPDATE tasks
  SET due_date   = p_due_date,
      is_life    = (p_list_type = 'life'),
      is_entity  = (p_list_type = 'entity'),
      updated_at = now()
  WHERE id = p_task_id;

  IF p_note_body IS NOT NULL AND trim(p_note_body) != '' THEN
    INSERT INTO task_note (task_id, body, created_at)
    VALUES (p_task_id, trim(p_note_body), now());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.commit_task_sheet(uuid, date, text, text) TO anon, authenticated;
