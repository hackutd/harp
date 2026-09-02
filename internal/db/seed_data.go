package db

// Static content pools. Everything here is deliberately hand-written rather
// than generated so the seeded database reads like a plausible hackathon
// instead of lorem ipsum -- the super admin screens are being reviewed by eye.

var (
	firstNames = []string{
		"Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hank",
		"Ivy", "Jack", "Karen", "Leo", "Mia", "Noah", "Olivia", "Paul",
		"Quinn", "Ruby", "Sam", "Tina", "Uma", "Victor", "Wendy", "Xander",
		"Yara", "Zane", "Aria", "Blake", "Cora", "Derek",
	}
	lastNames = []string{
		"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
		"Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
		"Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
		"Lee", "Perez", "White", "Harris", "Sanchez", "Clark", "Ramirez",
		"Lewis", "Robinson", "Walker",
	}
	universities = []string{
		"UT Dallas", "UT Austin", "Texas A&M", "Rice University", "SMU",
		"UNT", "Texas Tech", "Baylor", "UT Arlington", "University of Houston",
		"Georgia Tech", "Purdue University", "Arizona State University",
	}
	majors = []string{
		"Computer Science", "Software Engineering", "Electrical Engineering",
		"Data Science", "Mathematics", "Information Technology", "Cybersecurity",
		"Mechanical Engineering", "Physics", "Business Analytics",
	}
	// levels must stay inside the level_of_study options in application_schema
	// (migration 000006), otherwise the admin detail view renders a value the
	// select cannot represent.
	levels         = []string{"Freshman", "Sophomore", "Junior", "Senior", "Graduate", "PhD", "Other"}
	genders        = []string{"Male", "Female", "Non-binary", "Prefer not to say"}
	races          = []string{"Asian", "White", "Black or African American", "Prefer not to say", "Two or more races"}
	ethnicities    = []string{"Hispanic or Latino", "Not Hispanic or Latino", "Prefer not to say"}
	shirtSizes     = []string{"XS", "S", "M", "L", "XL", "XXL"}
	expLevels      = []string{"Beginner", "Intermediate", "Advanced", "Expert"}
	heardFrom      = []string{"Social Media", "Friend", "Professor", "Career Fair", "Website", "Email", "MLH Newsletter"}
	countries      = []string{"United States", "India", "Canada", "Mexico", "United Kingdom", "Nigeria"}
	dietaryOptions = []string{"Vegan", "Vegetarian", "Halal", "Nuts", "Fish", "Wheat", "Dairy", "Eggs", "No Beef", "No Pork"}

	accommodationPool = []string{
		"I use a wheelchair and will need step-free access to the venue.",
		"Please seat me near an outlet — my laptop battery is unreliable.",
		"I am hard of hearing; captions on the opening ceremony would help.",
		"No accommodations needed, thanks!",
	}

	// One pool per short answer so the four questions do not read identically
	// across every row -- reviewers scan these side by side.
	saq1Pool = []string{
		"I want to ship something end-to-end in a weekend instead of leaving it in a branch.",
		"My campus club keeps talking about hackathons and I finally want to see one from the inside.",
		"I have been learning backend work alone all semester and I want to build with other people.",
		"I am switching majors into CS and this feels like the fastest way to find out if I like it.",
		"Last year I watched the demos online and decided I would be on the other side of that table.",
	}
	saq2Pool = []string{
		"Two so far. The main lesson was that scoping down on Saturday morning is worth more than any framework.",
		"None yet, so everything I know about this comes from side projects and a lot of documentation.",
		"Four. I learned to write the README first — it forces the team to agree on what we are building.",
		"One, and we lost a whole night to a merge conflict. Now I branch early and rebase often.",
		"Three. The biggest one was learning to demo: a working screen beats a clever architecture.",
	}
	saq3Pool = []string{
		"How teams actually divide work when the clock is the constraint rather than the spec.",
		"I want to get past tutorials and find out what breaks when real users touch a thing I wrote.",
		"Enough of the deployment story to put something on the internet without a teammate holding my hand.",
		"How to ask for help from a mentor efficiently instead of grinding on a bug for four hours.",
		"Whether I actually enjoy building under pressure, which is hard to learn from coursework.",
	}
	saq4Pool = []string{
		"The hardware lab — I have never soldered anything and would like to change that.",
		"Sponsor office hours. I want to hear what these teams are actually building day to day.",
		"Honestly, the 2am stretch where everyone gets punchy and the ideas get better.",
		"The workshops on deployment and the closing demos.",
		"Meeting people from other schools; my program is small and a bit insular.",
	}

	travelOrigins = []string{
		"Houston, TX", "Austin, TX", "San Antonio, TX", "Lubbock, TX",
		"Oklahoma City, OK", "Baton Rouge, LA", "Phoenix, AZ", "Atlanta, GA",
		"Chicago, IL", "Monterrey, Mexico",
	}
	travelModes   = []string{"Car", "Bus", "Train", "Flight", "Other"}
	travelCosts   = []string{"45", "82.50", "120", "185.50", "240", "310.75", "420", "560", "685.25", "1250"}
	travelHasTeam = []string{"Yes", "No"}
	travelWhyPool = []string{
		"I am a first-generation student and the flight is roughly a month of my part-time pay.",
		"Driving up is affordable but the gas and one hotel night still comes out of my tuition savings.",
		"My school gives no travel funding and this is the closest major hackathon to me.",
		"I would be splitting a rental with three teammates; reimbursement is what makes it possible at all.",
		"Bus fare is manageable but I would have to skip a shift to make the trip.",
	}
	travelRSVPModes = []string{"Driving", "Flying", "Bus", "Train", "Other"}
	airlines        = []string{"Southwest", "American", "Delta", "United", "Spirit"}
	paymentMethods  = []string{"Zelle", "Venmo", "PayPal"}
	travelNotePool  = []string{
		"Landing Friday at 4pm, should make opening ceremony.",
		"Driving overnight with two teammates, we will arrive early Saturday.",
		"Please let me know if receipts need to be itemized.",
		"",
	}

	discordHandles = []string{
		"pixelfox", "nightbuild", "quietcompiler", "sudoku_dev", "greenthread",
		"latency", "forkbomb", "tabspaces", "runtime_err", "coldbrew",
	}

	reviewNotePool = []string{
		"Strong technical background, clear fit for the intermediate track.",
		"Light on experience but the short answers are genuine — worth a spot.",
		"Great short answers, obviously passionate about learning.",
		"Solid hackathon history, has shipped before.",
		"Application is thin; answers are one line each.",
		"Impressive project portfolio linked from the GitHub.",
		"Second-year, no hackathons yet, but the motivation reads real.",
		"Duplicate-sounding answers, possibly templated. Flagging for a second look.",
		"Local student, low travel burden, easy yes.",
		"Would accept if we have room after the first wave.",
	}
)

// sponsorLogos are 24x24 solid-colour PNGs, base64 encoded. Sponsor logos live
// in the logo_data column rather than object storage, so the seed has to carry
// real bytes -- these are the smallest thing that still renders as an image.
var sponsorLogos = map[string]string{
	"rose":   "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAH0lEQVR42mN4KOtBFcQwatCoQaMGjRo0atCoQQNvEADkOd2fdbfNAgAAAABJRU5ErkJggg==",
	"violet": "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAH0lEQVR42mOosXpLFcQwatCoQaMGjRo0atCoQQNvEAC+j67uULFlHgAAAABJRU5ErkJggg==",
	"amber":  "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAH0lEQVR42mP4Oo+bKohh1KBRg0YNGjVo1KBRgwbeIABKQqOuS67iTQAAAABJRU5ErkJggg==",
	"slate":  "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAH0lEQVR42mNIKemmCmIYNWjUoFGDRg0aNWjUoIE3CACIOx7uzlTgLAAAAABJRU5ErkJggg==",
	"orange": "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAH0lEQVR42mN4FcFDFcQwatCoQaMGjRo0atCoQQNvEAAbKu+fKKAp5QAAAABJRU5ErkJggg==",
	"blue":   "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAH0lEQVR42mNQTX5NFcQwatCoQaMGjRo0atCoQQNvEABZoULucEvZ+wAAAABJRU5ErkJggg==",
}

type seedSponsor struct {
	Name        string
	Tier        string
	Logo        string
	WebsiteURL  string
	Description string
}

// Tiers must match tierOptions in
// client/portal/src/pages/admin/sponsors/components/SponsorsTable.tsx, or the
// tier badge falls back to unstyled.
var sponsorTemplate = []seedSponsor{
	{"Meridian Systems", "Title", "rose", "https://example.com/meridian", "Title sponsor. Hosting the main stage and the closing demos."},
	{"Northwind Cloud", "Platinum", "violet", "https://example.com/northwind", "Cloud credits for every team plus a deployment workshop."},
	{"Copperline Robotics", "Platinum", "violet", "https://example.com/copperline", "Hardware lab, soldering irons, and far too many servo motors."},
	{"Bright Harbor Bank", "Gold", "amber", "https://example.com/brightharbor", "Fintech track sponsor and Saturday lunch."},
	{"Auralite Audio", "Gold", "amber", "https://example.com/auralite", "Running the accessibility track and lending out capture hardware."},
	{"Kestrel Analytics", "Silver", "slate", "https://example.com/kestrel", "Data track prizes and a Sunday morning office hour."},
	{"Foxglove Design", "Silver", "slate", "https://example.com/foxglove", "Design mentorship desk, open all weekend."},
	{"Tidewater Logistics", "Bronze", "orange", "https://example.com/tidewater", "Sponsoring the Friday night snack table."},
	{"Halcyon Security", "Bronze", "orange", "https://example.com/halcyon", "Capture-the-flag side event and swag."},
	{"Rowan Coffee Co.", "Standard", "blue", "https://example.com/rowan", "Cold brew, continuously, from Friday 6pm."},
}

type seedFAQ struct {
	Question string
	Answer   string
}

var faqTemplate = []seedFAQ{
	{"Who can apply?", "Any currently enrolled student, undergraduate or graduate, from any school. You do not need to be a computer science major."},
	{"Do I need a team?", "No. Roughly half of attendees arrive solo and form teams at the opening mixer. Teams cap at four people."},
	{"How much does it cost?", "Nothing. Admission, food, and swag are covered by our sponsors."},
	{"Is there travel reimbursement?", "Yes, on a case-by-case basis. Opt in on your application and tell us where you are travelling from; decisions go out with acceptances."},
	{"I have never been to a hackathon. Should I still apply?", "Absolutely. About a third of every cohort is first-time, and we run a beginner track with dedicated mentors."},
	{"What should I bring?", "Laptop, charger, a change of clothes, toiletries, and a student ID. A sleeping bag if you plan to nap on site."},
	{"Will there be somewhere to sleep?", "There is a designated quiet room with floor space. Bring your own sleeping bag and pillow."},
	{"What about food?", "Five catered meals across the weekend, plus snacks and coffee around the clock. Dietary restrictions are collected on the application."},
	{"Can I work on an existing project?", "No. All code must be written during the event, though you may use public libraries and pre-trained models."},
	{"How does judging work?", "Every team demos to at least three judges. Track prizes are judged separately by the sponsoring company."},
	{"What is the code of conduct?", "We follow the MLH Code of Conduct. Harassment of any kind ends your participation immediately."},
	{"I still have a question.", "Email the organizing team or find us in the event Discord — we answer faster there during the event."},
}

type seedScheduleItem struct {
	Name        string
	Description string
	Location    string
	Tags        []string
	// StartHour is hours after the event start; DurationMins is its length.
	StartHour    float64
	DurationMins int
}

// A 42-hour event running from Friday evening through Sunday midday, expressed
// as offsets from timeline.eventStart so it always straddles "now".
var scheduleTemplate = []seedScheduleItem{
	{"Check-In Opens", "Pick up your badge and swag bag in the atrium.", "Atrium", []string{"Logistics"}, 0, 120},
	{"Opening Ceremony", "Welcome, rules, prize categories, and sponsor introductions.", "Main Stage", []string{"Ceremony"}, 2, 45},
	{"Team Formation Mixer", "Arrive solo, leave with a team. Facilitated speed-matching.", "Atrium", []string{"Activity"}, 3, 60},
	{"Friday Dinner", "Tacos, including vegan and halal options.", "Dining Hall", []string{"Food"}, 4, 90},
	{"Workshop: Intro to AI Agents", "Build a tool-calling agent from scratch. No prior ML needed.", "Room 2.410", []string{"Workshop"}, 5, 90},
	{"Workshop: Git for Teams", "Branching, rebasing, and how not to lose your Saturday to a merge conflict.", "Room 2.412", []string{"Workshop"}, 5, 60},
	{"Sponsor Booths Open", "Meridian, Northwind, Copperline, and friends. Come collect stickers.", "Exhibit Hall", []string{"Sponsor"}, 6, 240},
	{"Hacking Begins", "The clock starts. 36 hours on it.", "Everywhere", []string{"Ceremony"}, 6, 15},
	{"Midnight Snack", "Pizza, obviously.", "Dining Hall", []string{"Food"}, 11, 60},
	{"Cup Stacking Tournament", "Low stakes, high drama. Winner takes a mechanical keyboard.", "Atrium", []string{"Activity"}, 12, 60},
	{"Quiet Room Opens", "Lights down, phones on silent. Bring your own sleeping bag.", "Room 1.204", []string{"Logistics"}, 13, 480},
	{"Saturday Breakfast", "Breakfast tacos and a great deal of coffee.", "Dining Hall", []string{"Food"}, 16, 90},
	{"Workshop: Deploying Your Demo", "Get your project on the internet before judging, not during it.", "Room 2.410", []string{"Workshop"}, 18, 75},
	{"Copperline Hardware Lab", "Soldering irons, servos, and someone who knows how to use them.", "Hardware Lab", []string{"Sponsor", "Workshop"}, 19, 180},
	{"Saturday Lunch", "Sandwich bar with gluten-free and vegan options.", "Dining Hall", []string{"Food"}, 21, 90},
	{"Foxglove Design Desk", "Bring your UI. Leave with opinions.", "Exhibit Hall", []string{"Sponsor"}, 22, 180},
	{"Capture the Flag", "Halcyon Security's side event. Beginner-friendly categories included.", "Room 2.520", []string{"Activity", "Sponsor"}, 23, 240},
	{"Workshop: Pitching in Three Minutes", "How to demo so judges remember you.", "Room 2.412", []string{"Workshop"}, 25, 60},
	{"Saturday Dinner", "Barbecue, with a substantial vegetarian spread.", "Dining Hall", []string{"Food"}, 27, 90},
	{"Late Night Karaoke", "Optional. Strongly encouraged.", "Main Stage", []string{"Activity"}, 30, 120},
	{"Sunday Breakfast", "Bagels and the last of the cold brew.", "Dining Hall", []string{"Food"}, 38, 60},
	{"Submissions Due", "Hard deadline. Devpost closes and does not reopen.", "Everywhere", []string{"Logistics"}, 39, 15},
	{"Judging Round One", "Every team demos to three judges at their table.", "Exhibit Hall", []string{"Ceremony"}, 39.5, 90},
	{"Track Judging", "Sponsor tracks judged separately by the sponsoring team.", "Exhibit Hall", []string{"Sponsor", "Ceremony"}, 40.5, 60},
	{"Closing Ceremony & Prizes", "Finalist demos on the main stage, then awards.", "Main Stage", []string{"Ceremony"}, 41.5, 45},
	{"Teardown", "Help us fold tables and we will love you forever.", "Everywhere", []string{"Logistics"}, 42, 60},
}
