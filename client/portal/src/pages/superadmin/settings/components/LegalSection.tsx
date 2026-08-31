import { Scale } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorAlert } from "@/shared/lib/api";

import {
  fetchPrivacyPolicyURL,
  fetchTermsURL,
  updatePrivacyPolicyURL,
  updateTermsURL,
} from "../api";

function isValidOptionalURL(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^https?:\/\//i.test(trimmed);
}

/**
 * Links to the operator's own Terms of Service and Privacy Policy. Harp cannot
 * ship these: the documents describe how a particular organization handles
 * applicant data, so only that organization can write them.
 */
export function LegalSection() {
  const [privacyURL, setPrivacyURL] = useState("");
  const [termsURL, setTermsURL] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const privacyInvalid = !isValidOptionalURL(privacyURL);
  const termsInvalid = !isValidOptionalURL(termsURL);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const [privacyRes, termsRes] = await Promise.all([
        fetchPrivacyPolicyURL(controller.signal),
        fetchTermsURL(controller.signal),
      ]);
      if (controller.signal.aborted) return;

      if (privacyRes.status === 200 && privacyRes.data) {
        setPrivacyURL(privacyRes.data.url);
      } else {
        errorAlert(privacyRes);
      }
      if (termsRes.status === 200 && termsRes.data) {
        setTermsURL(termsRes.data.url);
      } else {
        errorAlert(termsRes);
      }
      setLoading(false);
    }
    load();
    return () => controller.abort();
  }, []);

  async function save() {
    if (privacyInvalid || termsInvalid) {
      toast.error("Links must start with http:// or https://");
      return;
    }

    setSaving(true);
    const [privacyRes, termsRes] = await Promise.all([
      updatePrivacyPolicyURL(privacyURL.trim()),
      updateTermsURL(termsURL.trim()),
    ]);

    if (privacyRes.status === 200 && termsRes.status === 200) {
      toast.success("Legal links saved.");
    } else {
      errorAlert(privacyRes.status === 200 ? termsRes : privacyRes);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3 rounded-md bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label className="text-sm font-medium text-zinc-100">Legal</Label>
          <p className="text-xs text-zinc-500">
            Your organization&apos;s Terms of Service and Privacy Policy. The
            sign-in page tells hackers they agree to these, and shows that
            notice only once at least one link is set.
          </p>
        </div>
        <Scale className="size-5 shrink-0 text-zinc-500" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="terms-url" className="text-xs text-zinc-400">
          Terms of Service URL
        </Label>
        <Input
          id="terms-url"
          value={termsURL}
          onChange={(e) => setTermsURL(e.target.value)}
          placeholder="https://your-hackathon.com/terms"
          disabled={loading || saving}
          className="h-8 border-zinc-700 bg-zinc-800 text-sm font-light text-zinc-100"
        />
        {termsInvalid && (
          <p className="text-xs text-red-400">
            Must start with http:// or https://
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="privacy-url" className="text-xs text-zinc-400">
          Privacy Policy URL
        </Label>
        <Input
          id="privacy-url"
          value={privacyURL}
          onChange={(e) => setPrivacyURL(e.target.value)}
          placeholder="https://your-hackathon.com/privacy"
          disabled={loading || saving}
          className="h-8 border-zinc-700 bg-zinc-800 text-sm font-light text-zinc-100"
        />
        {privacyInvalid && (
          <p className="text-xs text-red-400">
            Must start with http:// or https://
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-zinc-500">
          Leave a field empty to hide that link.
        </p>
        <Button
          size="sm"
          onClick={save}
          disabled={loading || saving || privacyInvalid || termsInvalid}
          className="cursor-pointer bg-white text-black hover:bg-zinc-200"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
