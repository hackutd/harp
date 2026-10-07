import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { HackerPageLoader } from "@/components/HackerPageLoader";
import { errorAlert } from "@/shared/lib/api";

import { linkDiscord } from "./api";
import { useDirectoryStore } from "./store";

// Discord redirects here after the identify consent screen.
export default function DiscordCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setMe = useDirectoryStore((s) => s.setMe);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get("code");
    const state = params.get("state");
    const done = () => navigate("/app/directory/card", { replace: true });

    if (!code || !state) {
      if (params.get("error")) toast("Discord linking was cancelled");
      done();
      return;
    }
    linkDiscord(code, state).then((res) => {
      if (res.status === 200 && res.data) {
        setMe(res.data);
        toast.success("Discord linked");
      } else {
        errorAlert(res);
      }
      done();
    });
  }, [params, navigate, setMe]);

  return <HackerPageLoader />;
}
