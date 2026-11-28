DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tableowner = current_user
      AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated;', tbl.tablename);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_verified_email_unique_idx"
  ON public."User" (LOWER(email))
  WHERE "emailVerifiedAt" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_verified_phone_unique_idx"
  ON public."User" (phone)
  WHERE "phoneVerifiedAt" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "BankAccount_user_default_unique_idx"
  ON public."BankAccount" ("userId")
  WHERE "isDefault" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "Address_user_default_delivery_unique_idx"
  ON public."Address" ("userId")
  WHERE "isDefault" = true AND label <> 'FARM';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'BankAccount_channel_fields_check'
      AND conrelid = 'public."BankAccount"'::regclass
  ) THEN
    ALTER TABLE public."BankAccount"
      ADD CONSTRAINT "BankAccount_channel_fields_check"
      CHECK (
        ("payoutChannel" = 'BANK' AND "accountNumber" IS NOT NULL AND "ifscCode" IS NOT NULL)
        OR
        ("payoutChannel" = 'UPI' AND "upiVpa" IS NOT NULL)
      );
  END IF;
END $$;
