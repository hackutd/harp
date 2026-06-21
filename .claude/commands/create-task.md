# Create Task

Create a new task in both ClickUp (Tech list) and GitHub Issues, then link them together.

## User Mapping

Use these mappings to resolve assignees across platforms. **Edit the PLACEHOLDER values below with real usernames.**

| Name     | GitHub Username  | ClickUp Name/Email                  |
| -------- | ---------------- | ----------------------------------- |
| Me       | balebbae         | caleb.bae@acmutd.co                 |
| Anish    | anishalle        | anish.alle@acmutd.co                |
| Arnav    | axv2655          | arnav.vedula@acmutd.co              |
| Jagadeep | jagadeep298218   | jagadeep.kalluri@acmutd.co          |
| Noel     | NoelVarghese2006 | noel.varghese@acmutd.co             |
| Sree     | 5sansiva         | sreevasan.sivasubramanian@acmutd.co |
| Tharun   | tharunthunder    | tharun.sevvel@acmutd.co             |

## Instructions

You are creating a task. Follow these steps exactly:

### Step 1: Gather task details

Ask the user for:

- **Task name** (required)
- **Description** (required)
- **Priority** — urgent, high, normal, or low (default: normal)
- **Labels** — e.g. enhancement, bug, good first issue (default: enhancement)

### Step 2: Ask for assignee

Use the AskUserQuestion tool to ask who this task should be assigned to. The options are:

- Me
- Anish
- Arnav
- Jagadeep
- Noel
- Sree
- Tharun
- No one

### Step 3: Resolve the assignee

Using the user mapping table above, resolve the selected name to:

- A **GitHub username** for the `--assignee` flag on `gh issue create`
- A **ClickUp name/email** for the `clickup_resolve_assignees` / `clickup_create_task` assignee field

If "No one" is selected, skip assignment on both platforms.

### Step 4: Create the GitHub issue

Run:

```
gh issue create --title "<task name>" --body "<description>" --label "<labels>" [--assignee "<github_username>"]
```

Capture the resulting issue URL and number.

### Step 5: Create the ClickUp task

Use the `clickup_create_task` tool with:

- **list_id:** `901710506578` (Tech list in HackUTD)
- **name:** the task name
- **description:** the task description, with the GitHub issue URL appended at the bottom
- **priority:** the selected priority
- **assignees:** the resolved ClickUp user ID (use `clickup_resolve_assignees` first), or omit if "No one"

### Step 6: Link them together

Use `clickup_create_task_comment` on the newly created ClickUp task to add a comment:

```
GitHub Issue: <issue_url>
```

### Step 7: Confirm

Tell the user the task was created with links to both the ClickUp task and the GitHub issue.
