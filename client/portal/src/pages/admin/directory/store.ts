import { toast } from "sonner";
import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import { fetchDirectoryProfiles, moderateDirectoryProfile } from "./api";
import type { DirectoryAdminProfile } from "./types";

export interface DirectoryModerationState {
  profiles: DirectoryAdminProfile[];
  nextCursor: string | null;
  search: string;
  loading: boolean;
  loadingMore: boolean;
  saving: Record<string, boolean>;

  setSearch: (search: string) => void;
  fetchProfiles: (signal?: AbortSignal) => Promise<void>;
  fetchMore: () => Promise<void>;
  setModeration: (
    profile: DirectoryAdminProfile,
    hidden: boolean,
    reason?: string,
  ) => Promise<boolean>;
}

// Guards against a slow page landing after the search changed.
let listSeq = 0;

export const useDirectoryModerationStore = create<DirectoryModerationState>(
  (set, get) => {
    const setSaving = (id: string, value: boolean) =>
      set((s) => {
        const saving = { ...s.saving };
        if (value) saving[id] = true;
        else delete saving[id];
        return { saving };
      });

    return {
      profiles: [],
      nextCursor: null,
      search: "",
      loading: false,
      loadingMore: false,
      saving: {},

      setSearch: (search) => set({ search }),

      fetchProfiles: async (signal) => {
        const seq = ++listSeq;
        set({ loading: true, loadingMore: false });
        const res = await fetchDirectoryProfiles(get().search, null, signal);
        if (signal?.aborted || seq !== listSeq) return;
        if (res.status === 200 && res.data) {
          set({
            profiles: res.data.profiles,
            nextCursor: res.data.next_cursor,
            loading: false,
          });
        } else {
          set({ profiles: [], nextCursor: null, loading: false });
          errorAlert(res);
        }
      },

      fetchMore: async () => {
        const { nextCursor, loadingMore, search } = get();
        if (!nextCursor || loadingMore) return;
        const seq = listSeq;
        set({ loadingMore: true });
        const res = await fetchDirectoryProfiles(search, nextCursor);
        if (seq !== listSeq) {
          set({ loadingMore: false });
          return;
        }
        if (res.status === 200 && res.data) {
          const page = res.data;
          set((s) => {
            const seen = new Set(s.profiles.map((p) => p.user_id));
            return {
              profiles: [
                ...s.profiles,
                ...page.profiles.filter((p) => !seen.has(p.user_id)),
              ],
              nextCursor: page.next_cursor,
              loadingMore: false,
            };
          });
        } else {
          set({ loadingMore: false });
          errorAlert(res);
        }
      },

      setModeration: async (profile, hidden, reason) => {
        if (get().saving[profile.user_id]) return false;
        setSaving(profile.user_id, true);
        const trimmed = reason?.trim() || null;
        const res = await moderateDirectoryProfile(profile.user_id, {
          hidden,
          reason: hidden ? trimmed : null,
        });
        setSaving(profile.user_id, false);
        if (res.status !== 204 && res.status !== 200) {
          errorAlert(res);
          return false;
        }
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.user_id === profile.user_id
              ? {
                  ...p,
                  moderation_hidden_at: hidden
                    ? (p.moderation_hidden_at ?? new Date().toISOString())
                    : null,
                  moderation_reason: hidden ? trimmed : null,
                  moderation_hidden_by: hidden ? p.moderation_hidden_by : null,
                }
              : p,
          ),
        }));
        toast.success(
          hidden
            ? `Hid ${profile.display_name}'s card`
            : `Restored ${profile.display_name}'s card`,
        );
        return true;
      },
    };
  },
);
