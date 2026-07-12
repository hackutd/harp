import { useNavigate } from "react-router-dom";
import { signOut } from "supertokens-auth-react/recipe/session";

import { AdminPortalButton } from "@/components/AdminPortalButton";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/shared/stores";

export default function ProfilePage() {
  const { user, clearUser } = useUserStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    clearUser();
    navigate("/", { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl px-5 pt-10 md:px-10">
      <h1 className="text-2xl font-semibold text-black">Profile</h1>
      {user?.email && (
        <p className="mt-2 text-sm font-light text-[#6B6B6B]">{user.email}</p>
      )}
      <div className="mt-6 flex items-center gap-2">
        <AdminPortalButton />
        <Button variant="outline" onClick={handleLogout}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
