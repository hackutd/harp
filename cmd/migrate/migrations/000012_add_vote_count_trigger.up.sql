-- Function to update application vote counts when a review is inserted/updated/deleted
CREATE OR REPLACE FUNCTION update_application_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- New assignment
        UPDATE applications
        SET reviews_assigned = reviews_assigned + 1,
            updated_at = now()
        WHERE id = NEW.application_id;

        -- If vote is already set on insert
        IF NEW.vote IS NOT NULL THEN
            UPDATE applications
            SET reviews_completed = reviews_completed + 1,
                accept_votes = accept_votes + CASE WHEN NEW.vote = 'accept' THEN 1 ELSE 0 END,
                reject_votes = reject_votes + CASE WHEN NEW.vote = 'reject' THEN 1 ELSE 0 END,
                waitlist_votes = waitlist_votes + CASE WHEN NEW.vote = 'waitlist' THEN 1 ELSE 0 END,
                updated_at = now()
            WHERE id = NEW.application_id;
        END IF;

        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- First vote
        IF OLD.vote IS NULL AND NEW.vote IS NOT NULL THEN
            UPDATE applications
            SET reviews_completed = reviews_completed + 1,
                accept_votes = accept_votes + CASE WHEN NEW.vote = 'accept' THEN 1 ELSE 0 END,
                reject_votes = reject_votes + CASE WHEN NEW.vote = 'reject' THEN 1 ELSE 0 END,
                waitlist_votes = waitlist_votes + CASE WHEN NEW.vote = 'waitlist' THEN 1 ELSE 0 END,
                updated_at = now()
            WHERE id = NEW.application_id;
        -- Vote += 1
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
        -- Vote removed
        ELSIF OLD.vote IS NOT NULL AND NEW.vote IS NULL THEN
            UPDATE applications
            SET reviews_completed = reviews_completed - 1,
                accept_votes = accept_votes - CASE WHEN OLD.vote = 'accept' THEN 1 ELSE 0 END,
                reject_votes = reject_votes - CASE WHEN OLD.vote = 'reject' THEN 1 ELSE 0 END,
                waitlist_votes = waitlist_votes - CASE WHEN OLD.vote = 'waitlist' THEN 1 ELSE 0 END,
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
            updated_at = now()
        WHERE id = OLD.application_id;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain denormalized counts
DROP TRIGGER IF EXISTS trg_update_vote_counts ON application_reviews;
CREATE TRIGGER trg_update_vote_counts
AFTER INSERT OR UPDATE OR DELETE ON application_reviews
FOR EACH ROW
EXECUTE FUNCTION update_application_vote_counts();
