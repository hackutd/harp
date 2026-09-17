package db

import (
	"database/sql"
	"log"
	"time"

	"github.com/hackutd/harp/internal/store"
)

const insertReviewQuery = `
	INSERT INTO application_reviews (
		application_id, admin_id, vote, travel_vote, notes, assigned_at, reviewed_at
	) VALUES ($1, $2, $3, $4, $5, $6, $7)
	ON CONFLICT (application_id, admin_id) DO NOTHING
`

// reviewPlan says how many reviewers an application has and how many of them
// have actually voted. The split across the submitted bucket is what keeps the
// three admin review queues non-empty at once:
//
//	20..34  no reviewers        -> GET /admin/reviews/next has work to hand out
//	35..54  assigned, no votes  -> GET /admin/reviews/pending is non-empty
//	55..79  partially voted     -> reviews_completed is between 0 and the threshold
//	80..199 fully voted         -> the decided list has real vote tallies
func reviewPlan(i int, p appPlan) (assigned, voted int) {
	switch {
	case p.Status == "draft":
		return 0, 0
	case i < 35:
		return 0, 0
	case i < 55:
		return 2, 0
	case i < 80:
		return 3, 1 + rng.Intn(2)
	default:
		return 3, 3
	}
}

// voteFor makes most reviewers agree with the application's final status while
// letting roughly one in six dissent, so accept_votes/reject_votes/waitlist_votes
// are not all 0-or-N and sorting by them produces a real ordering.
func voteFor(status string) store.ReviewVote {
	all := []store.ReviewVote{store.ReviewVoteAccept, store.ReviewVoteReject, store.ReviewVoteWaitlist}

	if chance(17) {
		return pick(all)
	}

	switch status {
	case "accepted":
		return store.ReviewVoteAccept
	case "rejected":
		return store.ReviewVoteReject
	case "waitlisted":
		return store.ReviewVoteWaitlist
	default:
		return pick(all)
	}
}

// travelVoteFor mirrors the travel decision with the same dissent rate. Reviews
// on applications that never requested travel leave the column NULL, which is
// what the vote-count trigger keys off.
func travelVoteFor(travelStatus string) *bool {
	switch travelStatus {
	case "approved":
		return ptr(!chance(20))
	case "rejected":
		return ptr(chance(20))
	case "pending":
		return ptr(chance(55))
	default:
		return nil
	}
}

// seedReviews writes application_reviews only. The seven denormalized counters
// on applications (accept_votes, reject_votes, waitlist_votes, reviews_assigned,
// reviews_completed, travel_yes_votes, travel_no_votes) are maintained by
// trg_update_vote_counts (migration 000011) and must not be written here.
func seedReviews(db *sql.DB, staffIDs []string, apps []seededApp, tl timeline) {
	tx := mustBegin(db)

	count := 0
	for _, app := range apps {
		assigned, voted := reviewPlan(app.Index, app.plan)
		if assigned == 0 {
			continue
		}
		if assigned > len(staffIDs) {
			assigned = len(staffIDs)
		}

		perm := rng.Perm(len(staffIDs))
		for j := 0; j < assigned; j++ {
			assignedAt := between(tl.appDue, tl.appDue.Add(48*time.Hour))

			var vote *store.ReviewVote
			var travelVote *bool
			var notes *string
			var reviewedAt *time.Time

			if j < voted {
				vote = ptr(voteFor(app.plan.Status))
				travelVote = travelVoteFor(app.plan.TravelStatus)
				reviewedAt = ptr(between(assignedAt, tl.decisions))
				if chance(70) {
					notes = ptr(pick(reviewNotePool))
				}
			}

			mustExec(tx, "insert review", insertReviewQuery,
				app.ID, staffIDs[perm[j]], vote, travelVote, notes, assignedAt, reviewedAt)
			count++
		}
	}

	mustCommit(tx, "application reviews")
	log.Printf("  inserted %d application reviews", count)
}
