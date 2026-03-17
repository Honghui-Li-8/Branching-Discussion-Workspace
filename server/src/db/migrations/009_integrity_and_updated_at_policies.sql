CREATE OR REPLACE FUNCTION set_row_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_set_updated_at ON workspaces;
CREATE TRIGGER workspaces_set_updated_at
BEFORE UPDATE ON workspaces
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS nodes_set_updated_at ON nodes;
CREATE TRIGGER nodes_set_updated_at
BEFORE UPDATE ON nodes
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS external_reference TEXT;

ALTER TABLE credit_transactions
DROP CONSTRAINT IF EXISTS credit_transactions_idempotency_key_not_empty;

ALTER TABLE credit_transactions
ADD CONSTRAINT credit_transactions_idempotency_key_not_empty
CHECK (idempotency_key IS NULL OR btrim(idempotency_key) <> '');

ALTER TABLE credit_transactions
DROP CONSTRAINT IF EXISTS credit_transactions_external_reference_not_empty;

ALTER TABLE credit_transactions
ADD CONSTRAINT credit_transactions_external_reference_not_empty
CHECK (external_reference IS NULL OR btrim(external_reference) <> '');

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_user_idempotency_uq
  ON credit_transactions(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_external_reference_uq
  ON credit_transactions(external_reference)
  WHERE external_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION prevent_direct_credit_balance_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  allow_credit_edit TEXT;
BEGIN
  allow_credit_edit := current_setting('app.allow_credit_balance_update', true);

  IF NEW.credit_balance <> OLD.credit_balance
    AND COALESCE(allow_credit_edit, 'off') <> 'on' THEN
    RAISE EXCEPTION
      'Direct updates to users.credit_balance are blocked. Write a credit_transactions entry instead.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_credit_balance_updates ON users;
CREATE TRIGGER users_guard_credit_balance_updates
BEFORE UPDATE OF credit_balance ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_direct_credit_balance_edits();

CREATE OR REPLACE FUNCTION sync_user_credit_balance_from_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM set_config('app.allow_credit_balance_update', 'on', true);
    UPDATE users
    SET credit_balance = credit_balance + NEW.amount
    WHERE id = NEW.user_id;
    PERFORM set_config('app.allow_credit_balance_update', 'off', true);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id = OLD.user_id THEN
      PERFORM set_config('app.allow_credit_balance_update', 'on', true);
      UPDATE users
      SET credit_balance = credit_balance + (NEW.amount - OLD.amount)
      WHERE id = NEW.user_id;
      PERFORM set_config('app.allow_credit_balance_update', 'off', true);
    ELSE
      PERFORM set_config('app.allow_credit_balance_update', 'on', true);
      UPDATE users
      SET credit_balance = credit_balance - OLD.amount
      WHERE id = OLD.user_id;
      PERFORM set_config('app.allow_credit_balance_update', 'off', true);

      PERFORM set_config('app.allow_credit_balance_update', 'on', true);
      UPDATE users
      SET credit_balance = credit_balance + NEW.amount
      WHERE id = NEW.user_id;
      PERFORM set_config('app.allow_credit_balance_update', 'off', true);
    END IF;

    RETURN NEW;
  END IF;

  PERFORM set_config('app.allow_credit_balance_update', 'on', true);
  UPDATE users
  SET credit_balance = credit_balance - OLD.amount
  WHERE id = OLD.user_id;
  PERFORM set_config('app.allow_credit_balance_update', 'off', true);
  RETURN OLD;
END;
$$;
