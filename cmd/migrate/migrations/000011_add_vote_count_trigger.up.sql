-- NOTE: travel_vote (000038) and travel_yes_votes/travel_no_votes (000037) are
-- referenced here but created in later migrations. PL/pgSQL resolves NEW/OLD
-- field references at runtime, and no application_reviews rows are written
-- between migrations, so this is safe on a fresh migrate-up.
CREATE OR REPLACE FUNCTION update_application_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE applications
        SET reviews_assigned = reviews_assigned + 1,
            updated_at = now()
        WHERE id = NEW.application_id;

        IF NEW.vote IS NOT NULL THEN
            UPDATE applications
            SET reviews_completed = reviews_completed + 1,
                accept_votes = accept_votes + CASE WHEN NEW.vote = 'accept' THEN 1 ELSE 0 END,
                reject_votes = reject_votes + CASE WHEN NEW.vote = 'reject' THEN 1 ELSE 0 END,
                waitlist_votes = waitlist_votes + CASE WHEN NEW.vote = 'waitlist' THEN 1 ELSE 0 END,
                updated_at = now()
            WHERE id = NEW.application_id;
        END IF;

        IF NEW.travel_vote IS NOT NULL THEN
            UPDATE applications
            SET travel_yes_votes = travel_yes_votes + CASE WHEN NEW.travel_vote THEN 1 ELSE 0 END,
                travel_no_votes = travel_no_votes + CASE WHEN NOT NEW.travel_vote THEN 1 ELSE 0 END,
                updated_at = now()
            WHERE id = NEW.application_id;
        END IF;

        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.vote IS NULL AND NEW.vote IS NOT NULL THEN
            UPDATE applications
            SET reviews_completed = reviews_completed + 1,
                accept_votes = accept_votes + CASE WHEN NEW.vote = 'accept' THEN 1 ELSE 0 END,
                reject_votes = reject_votes + CASE WHEN NEW.vote = 'reject' THEN 1 ELSE 0 END,
                waitlist_votes = waitlist_votes + CASE WHEN NEW.vote = 'waitlist' THEN 1 ELSE 0 END,
                updated_at = now()
            WHERE id = NEW.application_id;
        ELSIF OLD.vote IS NOT NULL AND NEW.vote IS NOT NULL AND OLD.vote <> NEW.vote THEN
            UPDATE applications
            SET accept_votes = accept_votes
                    - CASE WHEN OLD.vote = 'accept' THEN 1 ELSE 0 END
                    + CASE WHEN NEW.vote = 'accept' THEN 1 ELSE 0 END,
                reject_votes = reject_votes
                    - CASE WHEN OLD.vote = 'reject' THEN 1 ELSE 0 END
                    + CASE WHEN NEW.vote = 'reject' THEN 1 ELSE 0 END,
                waitlist_votes = waitlist_votes
                    - CASE WHEN OLD.vote = 'waitlist' THEN 1 ELSE 0 END
                    + CASE WHEN NEW.vote = 'waitlist' THEN 1 ELSE 0 END,
                updated_at = now()
            WHERE id = NEW.application_id;
        ELSIF OLD.vote IS NOT NULL AND NEW.vote IS NULL THEN
            UPDATE applications
            SET reviews_completed = reviews_completed - 1,
                accept_votes = accept_votes - CASE WHEN OLD.vote = 'accept' THEN 1 ELSE 0 END,
                reject_votes = reject_votes - CASE WHEN OLD.vote = 'reject' THEN 1 ELSE 0 END,
                waitlist_votes = waitlist_votes - CASE WHEN OLD.vote = 'waitlist' THEN 1 ELSE 0 END,
                updated_at = now()
            WHERE id = NEW.application_id;
        END IF;

        IF OLD.travel_vote IS DISTINCT FROM NEW.travel_vote THEN
            UPDATE applications
            SET travel_yes_votes = travel_yes_votes
                    - CASE WHEN OLD.travel_vote IS TRUE THEN 1 ELSE 0 END
                    + CASE WHEN NEW.travel_vote IS TRUE THEN 1 ELSE 0 END,
                travel_no_votes = travel_no_votes
                    - CASE WHEN OLD.travel_vote IS FALSE THEN 1 ELSE 0 END
                    + CASE WHEN NEW.travel_vote IS FALSE THEN 1 ELSE 0 END,
                updated_at = now()
            WHERE id = NEW.application_id;
        END IF;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE applications
        SET reviews_assigned = reviews_assigned - 1,
            reviews_completed = reviews_completed - CASE WHEN OLD.vote IS NOT NULL THEN 1 ELSE 0 END,
            accept_votes = accept_votes - CASE WHEN OLD.vote = 'accept' THEN 1 ELSE 0 END,
            reject_votes = reject_votes - CASE WHEN OLD.vote = 'reject' THEN 1 ELSE 0 END,
            waitlist_votes = waitlist_votes - CASE WHEN OLD.vote = 'waitlist' THEN 1 ELSE 0 END,
            travel_yes_votes = travel_yes_votes - CASE WHEN OLD.travel_vote IS TRUE THEN 1 ELSE 0 END,
            travel_no_votes = travel_no_votes - CASE WHEN OLD.travel_vote IS FALSE THEN 1 ELSE 0 END,
            updated_at = now()
        WHERE id = OLD.application_id;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_vote_counts
AFTER INSERT OR UPDATE OR DELETE ON application_reviews
FOR EACH ROW EXECUTE FUNCTION update_application_vote_counts();
