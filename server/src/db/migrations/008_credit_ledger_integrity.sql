UPDATE users
SET credit_balance = COALESCE((
  SELECT SUM(amount)::BIGINT
  FROM credit_transactions
  WHERE user_id = users.id
), 0);

CREATE OR REPLACE FUNCTION sync_user_credit_balance_from_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users
    SET
      credit_balance = credit_balance + NEW.amount,
      updated_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id = OLD.user_id THEN
      UPDATE users
      SET
        credit_balance = credit_balance + (NEW.amount - OLD.amount),
        updated_at = NOW()
      WHERE id = NEW.user_id;
    ELSE
      UPDATE users
      SET
        credit_balance = credit_balance - OLD.amount,
        updated_at = NOW()
      WHERE id = OLD.user_id;

      UPDATE users
      SET
        credit_balance = credit_balance + NEW.amount,
        updated_at = NOW()
      WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;

  UPDATE users
  SET
    credit_balance = credit_balance - OLD.amount,
    updated_at = NOW()
  WHERE id = OLD.user_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS credit_transactions_sync_user_balance ON credit_transactions;

CREATE TRIGGER credit_transactions_sync_user_balance
AFTER INSERT OR UPDATE OR DELETE
ON credit_transactions
FOR EACH ROW
EXECUTE FUNCTION sync_user_credit_balance_from_transactions();
