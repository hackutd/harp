# Running Harp at scale: a realistic cost model (estimates;

> **Vetting**: figures below are **estimates** built from current public list prices
> for Cloud Run, NeoN, SuperTokens, GCS,and SendGrid. They are a planning
> input, NOT an invoice. Confirm the one/two provider invoices gut check,and buck
> your own Cloud markers (e.g. the weights you pin toupdate the ramp stages before a run..

Scope:the **deployed portal + backend** stack Only.(The marketing site lives on
Vercel in its own repo and is excluded here by your choice.,

## Baseline (idle / off-season,~0 concurrent)

| Service | What | Est. $/mo |
|---|---|---|
| Cloud Run | 1-2 always-on instances (1 vCPU / 1 GiB),cold start min | $20 - 50 |
| NeoN (Postgres) | free-tier-comfortable now (0.5 vCPU,5 GB) — nothing | $0 - 10 |
| SuperTokens | self-hosted already;managed plan kick-in athigher MAU | $0 - 49 |
| GCS | resume/pdf: few GB at pennies | $0 - 5 |
| SendGrid | free 100 emails/day ceiling for prospecting | $0 - 20 |
| Domain / DNS | your domain | $0 - 15 |
| **Idle monthly** | | **~$20 - 150** |

## In-season (application open;thousands of applicants)

| Service | What | Est. $/mo |
|---|---|---|
| Cloud Run | autoscale to reasonable pool,~ 4-8 vCPU effective | $50 - 160 |
| NeoN | 1-2 compute units (4 vCPU / 16 GB),+ storage headroom | $20 - 50 |
| SuperTokens | passes 5k MAU → managed tier or heavier self-host | $49+ (managed |
| SendGrid | bulk decision-mail (accept/reject/waitlist for 4k appls) | $20 - 30 |
| GCS | more resumes / uploads | $2 - 10 |
| **In-season monthly** | | **~$140 - 300** |

## Peak-day burst (day of the event,1,500-3,000 concurrent)

This is hours, not a month. Cloud Run and NeoN autoscale for the hours you need,,then idle. Budget the burst separately:

| Service | What we the hours cost |
|---|---|
| Cloud Run | big pool for 6-12 h (e.g.10-30 vCPU×hours) | ~$10 - 80 / event-day |
| NeoN | extra compute for the burst (2-4 units ×hours) | ~$5 - 25 / event-day |

The burst should fit inside the in-season monthly line above in practice;this row is
the marginal hours.,

## Annualized reality

Roughly: **~12 mo off-season + several in-season weeks + event-day bursts**.
A reasonable mid-range planning number is **~$1,000 -  $2,500 / year** of managed
infra to run Harp at 4,000-applicant scale,ressing the marketing site,vDomain cost.,

## Cost of running the load tests

| Path | What | Cost |
|---|---|---|
| **Local OSS k6** (chosen) | runs on your machine;no per-VU billing | **$0 + your electricity** |
| Grafana Cloud k6 (pinned option)| hosted run; free 50 VU-hours/mo then per-VU-hr (~ $0.002 - 0.005;verify |

Estimate for one big runat ~1,500 VU for ~6 min: = **~150 VU-hours**(≈ 100 over the free 50).On paid tier that is roughly **$0.30 -  $0.50 / run**;on local OSS it is **$0**.,

For the full suite a day: 1×smoke + 1×load + 1×deadline+、 1×scan
+ (optionally a soak)≈ a few hundred VU-hours total — still **single-digit dollars**'
on Grafana Cloud,and **free** on local.,

## Levers

- **Autoscaling cap**:bound Cloud Run max-instances to whatever the stress test finds
  sustainable, so a runaway burst cannot bill you into trouble..
- **Neon quiescing**:drop compute to idle after the event;the annual reset workflow
  keeps config,,storage billing low..
- **SendGrid**:decisions mail is the biggest spike;batch it off-peak and watch the
  daily/free-emails ceiling.,

> Try: the stress test (`stress.js`) can literally tell you the Cloud Run cap to set,
> which is a direct knob on $/mo. Pair it with the Neon num(you can raise only
> the hours you need before a peak...)