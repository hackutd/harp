import { useEffect } from "react";
import { Link } from "react-router";

import { DirectoryCard } from "./components/DirectoryCard";
import { DirectoryGate, DirectoryHeader } from "./components/DirectoryShell";
import { useDirectoryStore } from "./store";

function ContactsList() {
  const contacts = useDirectoryStore((s) => s.contacts);
  const loading = useDirectoryStore((s) => s.contactsLoading);
  const busy = useDirectoryStore((s) => s.busy);
  const fetchContacts = useDirectoryStore((s) => s.fetchContacts);
  const poke = useDirectoryStore((s) => s.poke);
  const toggleContact = useDirectoryStore((s) => s.toggleContact);

  useEffect(() => {
    const controller = new AbortController();
    fetchContacts(controller.signal);
    return () => controller.abort();
  }, [fetchContacts]);

  if (loading && contacts.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/50">Loading...</p>
    );
  }
  if (contacts.length === 0) {
    return (
      <div className="py-16 text-center text-sm font-light text-white/60">
        <p>No contacts yet.</p>
        <p className="mt-1">
          Bookmark or poke people from{" "}
          <Link to="/app/directory" className="text-[#21FFF0] hover:underline">
            Who's Attending
          </Link>{" "}
          and they'll land here. Only you can see this list.
        </p>
      </div>
    );
  }

  const matched = contacts.filter((c) => c.matched).length;
  return (
    <>
      <p className="mt-4 text-xs font-light text-white/50">
        {contacts.length} saved
        {matched > 0 && ` · ${matched} matched`}. Only you can see this list.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contacts.map((card) => (
          <DirectoryCard
            key={card.user_id}
            card={card}
            busy={busy[card.user_id]}
            onPoke={poke}
            onToggleContact={toggleContact}
          />
        ))}
      </div>
    </>
  );
}

export default function ContactsPage() {
  return (
    <div className="mx-auto min-h-svh max-w-2xl px-5 pt-4 pb-6 text-white md:max-w-5xl md:px-8 md:pt-6">
      <DirectoryGate>
        {() => (
          <>
            <DirectoryHeader title="My contacts" active="contacts" />
            <ContactsList />
          </>
        )}
      </DirectoryGate>
    </div>
  );
}
