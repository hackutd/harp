import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import {
  createTrack as apiCreateTrack,
  deleteTrack as apiDeleteTrack,
  fetchTrackEditPermission,
  fetchTracks,
  updateTrack as apiUpdateTrack,
  uploadTrackLogo,
} from "./api";
import type { Track, TrackPayload } from "./types";

function sortByOrder(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => a.display_order - b.display_order);
}

export interface TracksState {
  tracks: Track[];
  canEdit: boolean;
  loading: boolean;
  saving: boolean;

  fetch: (signal?: AbortSignal) => Promise<void>;
  createTrack: (payload: TrackPayload) => Promise<string | null>;
  updateTrack: (id: string, payload: TrackPayload) => Promise<boolean>;
  deleteTrack: (id: string) => Promise<boolean>;
  uploadLogo: (
    trackId: string,
    file: File,
  ) => Promise<{ success: boolean } | null>;
}

export const useTracksStore = create<TracksState>((set) => ({
  tracks: [],
  canEdit: false,
  loading: false,
  saving: false,

  fetch: async (signal?: AbortSignal) => {
    set({ loading: true });

    const [listRes, permRes] = await Promise.all([
      fetchTracks(signal),
      fetchTrackEditPermission(signal),
    ]);

    if (signal?.aborted) return;

    const tracks =
      listRes.status === 200 && listRes.data
        ? sortByOrder(listRes.data.tracks)
        : [];
    const canEdit =
      permRes.status === 200 && permRes.data ? permRes.data.enabled : false;

    set({ tracks, canEdit, loading: false });
  },

  createTrack: async (payload: TrackPayload) => {
    set({ saving: true });
    const res = await apiCreateTrack(payload);
    if (res.status === 201 && res.data) {
      const created = res.data;
      set((state) => ({
        tracks: sortByOrder([...state.tracks, created]),
        saving: false,
      }));
      return created.id;
    }
    errorAlert(res);
    set({ saving: false });
    return null;
  },

  updateTrack: async (id: string, payload: TrackPayload) => {
    set({ saving: true });
    const res = await apiUpdateTrack(id, payload);
    if (res.status === 200 && res.data) {
      const updated = res.data;
      set((state) => ({
        tracks: sortByOrder(
          state.tracks.map((t) => (t.id === id ? updated : t)),
        ),
        saving: false,
      }));
      return true;
    }
    errorAlert(res);
    set({ saving: false });
    return false;
  },

  deleteTrack: async (id: string) => {
    set({ saving: true });
    const res = await apiDeleteTrack(id);
    if (res.status === 204) {
      set((state) => ({
        tracks: state.tracks.filter((t) => t.id !== id),
        saving: false,
      }));
      return true;
    }
    errorAlert(res);
    set({ saving: false });
    return false;
  },

  uploadLogo: async (trackId: string, file: File) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await uploadTrackLogo(trackId, base64, file.type);
    if (res.status === 200 && res.data) {
      const updated = res.data;
      set((state) => ({
        tracks: state.tracks.map((t) => (t.id === trackId ? updated : t)),
      }));
      return { success: true };
    }
    errorAlert(res);
    return null;
  },
}));
