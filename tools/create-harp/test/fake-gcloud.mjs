#!/usr/bin/env node
// A stateful stand-in for gcloud used by the tests. It keeps a JSON state file
// (FAKE_GCLOUD_STATE), appends every invocation to a log, and answers the
// subset of commands create-harp uses — so the real, mutating code path can be
// exercised without touching Google Cloud.

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const stateFile = process.env.FAKE_GCLOUD_STATE;
const state = JSON.parse(readFileSync(stateFile, "utf8"));
const argv = process.argv.slice(2);
appendFileSync(stateFile + ".log", JSON.stringify(argv) + "\n");

const flags = {};
const pos = [];
for (const a of argv) {
  if (a.startsWith("--")) {
    const i = a.indexOf("=");
    if (i === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, i)] = a.slice(i + 1);
  } else pos.push(a);
}
const cmd = pos.join(" ");
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));
const out = (v) => {
  process.stdout.write(typeof v === "string" ? v : JSON.stringify(v));
  save();
  process.exit(0);
};
const fail = (msg, code = 1) => {
  process.stderr.write(`ERROR: ${msg}\n`);
  save();
  process.exit(code);
};
const project = () => state.projects[flags.project];
const num = () => project()?.projectNumber;
const enabled = (p, api) => (state.projects[p]?.services ?? []).includes(api);

if (flags.version) out("Google Cloud SDK 999.0.0 (fake)\n");
if (cmd === "config get-value account") out(state.account + "\n");
if (cmd === "auth print-access-token") out("fake-token\n");

if (cmd.startsWith("projects describe")) {
  const p = state.projects[pos[2]];
  p ? out({ projectId: pos[2], name: p.name, projectNumber: p.projectNumber, lifecycleState: "ACTIVE" }) : fail("not found");
}
if (cmd.startsWith("projects create")) {
  state.projects[pos[2]] = { name: flags.name, projectNumber: "123456789012", services: [], iam: [], billing: null };
  out("");
}
if (cmd.startsWith("billing projects describe")) {
  const p = state.projects[pos[3]];
  if (!p) fail("not found");
  out({ billingEnabled: Boolean(p.billing), billingAccountName: p.billing ? `billingAccounts/${p.billing}` : "" });
}
if (cmd === "billing accounts list") out([{ name: "billingAccounts/AAAAAA-BBBBBB-CCCCCC", displayName: "Test billing", open: true }]);
if (cmd.startsWith("billing projects link")) {
  state.projects[pos[3]].billing = flags["billing-account"];
  out("");
}
if (cmd === "services list") {
  if (!project()) fail("not found");
  out((project().services ?? []).join("\n"));
}
if (cmd.startsWith("services enable")) {
  if (!project()?.billing) fail("FAILED_PRECONDITION: billing account required");
  project().services.push(...pos.slice(2));
  out("");
}
if (cmd.startsWith("iam service-accounts describe")) {
  enabled(flags.project, "run.googleapis.com") ? out({ email: pos[3], disabled: false }) : fail("NOT_FOUND");
}
if (cmd.startsWith("projects get-iam-policy")) {
  const p = state.projects[pos[2]];
  const bindings = {};
  for (const [role, member] of p.iam) (bindings[role] ??= []).push(member);
  out({ bindings: Object.entries(bindings).map(([role, members]) => ({ role, members })) });
}
if (cmd.startsWith("projects add-iam-policy-binding")) {
  const p = state.projects[pos[2]];
  if (flags.member.includes("@cloudbuild.gserviceaccount.com")) fail("INVALID_ARGUMENT: Service account does not exist.");
  p.iam.push([flags.role, flags.member]);
  out("");
}
if (cmd.startsWith("storage buckets describe")) {
  const b = state.buckets[pos[3]];
  if (b) out({ name: pos[3], projectNumber: b.projectNumber });
  if (pos[3] === "gs://taken-bucket") fail("does not have storage.buckets.get access");
  fail(`${pos[3]} not found: 404.`);
}
if (cmd.startsWith("storage buckets create")) {
  state.buckets[pos[3]] = { projectNumber: num(), flags };
  out("");
}
if (cmd.startsWith("storage buckets update")) {
  state.buckets[pos[3]].cors = JSON.parse(readFileSync(flags["cors-file"], "utf8"));
  out("");
}
if (cmd.startsWith("secrets describe")) project()?.secrets?.[pos[2]] ? out({ name: pos[2] }) : fail("NOT_FOUND");
if (cmd.startsWith("secrets create")) {
  (project().secrets ??= {})[pos[2]] = { versions: [], iam: [] };
  out("");
}
if (cmd.startsWith("secrets versions add")) {
  const data = readFileSync(0, "utf8");
  project().secrets[pos[3]].versions.push(data);
  out("");
}
if (cmd.startsWith("secrets versions list")) out(project().secrets[pos[3]].versions.map((_, i) => `${i + 1}`).join("\n"));
if (cmd.startsWith("secrets get-iam-policy")) {
  out({ bindings: project().secrets[pos[2]].iam.map(([role, m]) => ({ role, members: [m] })) });
}
if (cmd.startsWith("secrets add-iam-policy-binding")) {
  project().secrets[pos[2]].iam.push([flags.role, flags.member]);
  out("");
}
if (cmd.startsWith("artifacts repositories describe")) project()?.ar?.[pos[3]] ? out({ name: pos[3] }) : fail("NOT_FOUND");
if (cmd.startsWith("artifacts repositories create")) {
  (project().ar ??= {})[pos[3]] = { cleanup: null };
  out("");
}
if (cmd.startsWith("artifacts repositories set-cleanup-policies")) {
  project().ar[pos[3]].cleanup = JSON.parse(readFileSync(flags.policy, "utf8"));
  out("");
}
if (cmd.startsWith("run services describe")) {
  const s = project()?.run?.[pos[3]];
  if (!s) fail("NOT_FOUND");
  out({
    spec: {
      template: {
        spec: {
          containers: [
            {
              image: s.image,
              env: [
                ...Object.entries(s.env).map(([name, value]) => ({ name, value })),
                ...(s.secrets ? [{ name: "SENDGRID_API_KEY", valueFrom: { secretKeyRef: { name: "SENDGRID_API_KEY", key: "latest" } } }] : []),
              ],
            },
          ],
        },
      },
    },
  });
}
if (cmd.startsWith("run deploy")) {
  if (state.secretGrantLag > 0) {
    state.secretGrantLag -= 1;
    fail("spec.template.spec.containers[0].env[21].value_from.secret_key_ref.name: Permission denied on secret: projects/1/secrets/SENDGRID_API_KEY/versions/latest for Revision service account");
  }
  const env = JSON.parse(readFileSync(flags["env-vars-file"], "utf8"));
  (project().run ??= {})[pos[2]] = { image: flags.image, env, secrets: flags["set-secrets"] ?? null, flags };
  out("");
}
if (cmd.startsWith("builds triggers describe")) {
  const t = project()?.triggers?.[pos[3]];
  t
    ? out({
        id: t.id,
        name: pos[3],
        resourceName: `projects/${flags.project}/locations/global/triggers/${t.id}`,
        createTime: "2026-01-01T00:00:00Z",
        substitutions: t.substitutions,
      })
    : fail("NOT_FOUND");
}
if (cmd.startsWith("builds triggers create github")) {
  if (!state.githubConnected) {
    fail("(gcloud.builds.triggers.create.github) FAILED_PRECONDITION: Repository mapping does not exist. Please visit https://console.cloud.google.com/cloud-build/triggers;region=global/connect?project=x to connect a repository to your project");
  }
  const substitutions = Object.fromEntries(flags.substitutions.split(",").map((kv) => kv.split("=")));
  (project().triggers ??= {})[flags.name] = {
    id: "trig-0001",
    flags,
    substitutions,
    config: readFileSync(flags["inline-config"], "utf8"),
  };
  out("trig-0001\n");
}
if (cmd.startsWith("builds triggers update github")) {
  fail("(gcloud.builds.triggers.update.github) INVALID_ARGUMENT: Request contains an invalid argument.");
}
if (cmd.startsWith("builds triggers import")) {
  const def = JSON.parse(readFileSync(flags.source, "utf8"));
  if (def.createTime) fail("INVALID_ARGUMENT: createTime is output only");
  const t = project().triggers[def.name];
  t.substitutions = def.substitutions;
  t.imports = (t.imports ?? 0) + 1;
  out("");
}
if (cmd.startsWith("builds triggers run")) out({ name: "operations/build/x", metadata: { build: { id: "build-0001" } } });
if (cmd.startsWith("builds describe")) out("SUCCESS\n");

fail(`fake gcloud: unhandled command: ${argv.join(" ")}`, 2);
