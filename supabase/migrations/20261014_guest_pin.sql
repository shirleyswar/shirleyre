-- One guest PIN for 14 Oct 2026.
-- Expires 2026-10-14 19:00:00 UTC (2:00 PM CDT).
-- Stores SHA-256 hex only. Plaintext is not in this file.
-- Safe to re-run: existing rows are left alone, including used_at.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.guest_pins (
  id text PRIMARY KEY,
  pin_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CONSTRAINT guest_pins_hash_hex CHECK (pin_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS public.guest_pin_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  client_ip text NOT NULL DEFAULT ''
);

ALTER TABLE public.guest_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_pin_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.guest_pins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.guest_pin_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_guest_pin(candidate text, client_ip text DEFAULT '')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  updated_id text;
  recent_count int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('guest_pin_redeem'));

  IF candidate IS NULL OR candidate !~ '^[0-9]{6}$' THEN
    RETURN false;
  END IF;

  -- Wrong guesses only. A flood cannot walk the 6-digit space before expiry.
  -- The cap is global, so a direct RPC call cannot dodge it by inventing an IP.
  SELECT count(*) INTO recent_count
  FROM public.guest_pin_attempts
  WHERE created_at > now() - interval '10 minutes';

  IF recent_count >= 80 THEN
    RETURN false;
  END IF;

  UPDATE public.guest_pins
  SET used_at = now()
  WHERE pin_hash = encode(extensions.digest(convert_to(candidate, 'UTF8'), 'sha256'), 'hex')
    AND used_at IS NULL
    AND expires_at > now()
  RETURNING id INTO updated_id;

  IF updated_id IS NOT NULL THEN
    RETURN true;
  END IF;

  INSERT INTO public.guest_pin_attempts (client_ip)
  VALUES (left(coalesce(client_ip, ''), 64));

  RETURN false;
END;
$fn$;

REVOKE ALL ON FUNCTION public.redeem_guest_pin(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_guest_pin(text, text) TO anon, authenticated, service_role;

INSERT INTO public.guest_pins (id, pin_hash, expires_at, used_at)
VALUES
  (
    'consultant-2026-10-14',
    '4cf57693c9a3cb61c606c1ccf305edd4d3027c8a858e3c0ccb323937506892b0',
    timestamptz '2026-10-14 19:00:00+00',
    NULL
  ),
  (
    'premarked-test',
    '9737a94d72e9343eb0f1583f5e46e078e97fabeb9f467935a7ea79495c8bab4b',
    timestamptz '2026-10-14 19:00:00+00',
    timestamptz '2026-10-14 15:00:00+00'
  ),
  (
    'expired-test',
    '514baf50d16a28e2aa8bf66a36995fbc92f88200addf7a7c963842d0f6bfb9c4',
    timestamptz '2026-10-14 15:00:00+00',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- Proves redeem, second-use rejection, and expiry against a throwaway row.
-- The sample never leaves this transaction.
DO $self$
DECLARE
  sample text;
  sample_hash text;
  ok boolean;
  spins int := 0;
BEGIN
  DELETE FROM public.guest_pins WHERE id = 'selftest';

  LOOP
    spins := spins + 1;
    IF spins > 20 THEN
      RAISE EXCEPTION 'guest pin self-test could not draw a free sample';
    END IF;
    sample := lpad((floor(random() * 1000000))::int::text, 6, '0');
    sample_hash := encode(extensions.digest(convert_to(sample, 'UTF8'), 'sha256'), 'hex');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.guest_pins WHERE pin_hash = sample_hash
    );
  END LOOP;

  INSERT INTO public.guest_pins (id, pin_hash, expires_at)
  VALUES ('selftest', sample_hash, now() + interval '1 hour');

  ok := public.redeem_guest_pin(sample, 'migration');
  IF ok IS NOT TRUE THEN
    RAISE EXCEPTION 'guest pin self-test did not redeem a fresh row';
  END IF;

  ok := public.redeem_guest_pin(sample, 'migration');
  IF ok IS NOT FALSE THEN
    RAISE EXCEPTION 'guest pin self-test redeemed a used row';
  END IF;

  UPDATE public.guest_pins
  SET used_at = NULL, expires_at = now() - interval '1 minute'
  WHERE id = 'selftest';

  ok := public.redeem_guest_pin(sample, 'migration');
  IF ok IS NOT FALSE THEN
    RAISE EXCEPTION 'guest pin self-test redeemed an expired row';
  END IF;

  DELETE FROM public.guest_pins WHERE id = 'selftest';
END
$self$;

COMMIT;

NOTIFY pgrst, 'reload schema';
