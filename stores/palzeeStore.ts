import { AppState } from 'react-native';
import { create } from 'zustand';
import { User } from '../types';
import { authService } from '../services/authService';
import { palsService, PalGroup } from '../services/palsService';
import { momentsService, Moment, NewMoment } from '../services/momentsService';
import { subscribeToPalzeeChanges } from '../services/realtimeService';
import { pushService } from '../services/pushService';
import { storageService } from '../services/storageService';
import { firstNameOf, VLOG_PAL_CODE } from '../services/encoding';

interface PalzeeState {
  user: User | null;
  groups: PalGroup[];
  feed: Moment[];
  pendingUploads: number;
  loading: boolean;
  error: string | null;

  /** Restores the Supabase session (call once at startup). Returns the signed-in user, if any. */
  restoreSession(): Promise<User | null>;
  /** Starts data sync for a freshly signed-in user. */
  signedIn(user: User): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;

  refresh(): Promise<void>;
  createGroup(name: string, size: number): Promise<PalGroup>;
  joinGroup(code: string): Promise<PalGroup | null>;
  leaveGroup(code: string): Promise<void>;
  deleteGroup(code: string): Promise<void>;
  /** Posts a capture to the selected groups and/or the personal vlog ('vlog'). */
  postMoment(targets: string[], moment: NewMoment): Promise<void>;
  updateProfile(changes: { displayName?: string; avatarLocalUri?: string | null }): Promise<void>;
}

let teardown: (() => void) | null = null;

/** Debounce realtime bursts (e.g. a group delete cascades through several tables). */
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRefresh(run: () => void) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(run, 400);
}

function profileOf(user: User) {
  return { userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl ?? null };
}

export const usePalzeeStore = create<PalzeeState>((set, get) => ({
  user: null,
  groups: [],
  feed: [],
  pendingUploads: 0,
  loading: false,
  error: null,

  async restoreSession() {
    const user = await authService.currentUser();
    if (user) await get().signedIn(user);
    return user;
  },

  async signedIn(user) {
    teardown?.();
    set({ user, error: null });

    const unsubRealtime = subscribeToPalzeeChanges(user.id, () => scheduleRefresh(() => void get().refresh()));
    const unsubQueue = momentsService.onQueueChange(async () =>
      set({ pendingUploads: await momentsService.pendingCount() })
    );
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void momentsService.drainQueue();
        void get().refresh();
      }
    });
    teardown = () => {
      unsubRealtime();
      unsubQueue();
      appStateSub.remove();
    };

    void pushService.syncSubscriptions();
    void momentsService.drainQueue();
    await get().refresh();
  },

  async signOut() {
    teardown?.();
    teardown = null;
    await authService.signOut();
    set({ user: null, groups: [], feed: [], pendingUploads: 0 });
  },

  async deleteAccount() {
    const { user } = get();
    if (!user) return;
    teardown?.();
    teardown = null;
    await authService.softDeleteAccount(user.id);
    set({ user: null, groups: [], feed: [], pendingUploads: 0 });
  },

  async refresh() {
    const { user } = get();
    if (!user) return;
    set({ loading: true });
    try {
      const { groups } = await palsService.listGroups(user.id);
      const since = new Date(Date.now() - 8 * 24 * 3600 * 1000);
      const [feed, pendingUploads] = await Promise.all([
        momentsService.listFeed(
          groups.map((g) => g.code),
          since
        ),
        momentsService.pendingCount(),
      ]);
      set({ groups, feed, pendingUploads, error: null });
    } catch (e: any) {
      set({ error: e?.message ?? 'Could not load your pals.' });
    } finally {
      set({ loading: false });
    }
  },

  async createGroup(name, size) {
    const user = get().user!;
    const group = await palsService.createGroup(name, size, profileOf(user));
    set({ groups: [...get().groups, group] });
    return group;
  },

  async joinGroup(code) {
    const user = get().user!;
    const group = await palsService.joinGroup(code, profileOf(user));
    if (group && !get().groups.some((g) => g.code === group.code)) {
      set({ groups: [...get().groups, group] });
      void get().refresh();
    }
    return group;
  },

  async leaveGroup(code) {
    await palsService.leaveGroup(code, get().user!.id);
    set({ groups: get().groups.filter((g) => g.code !== code), feed: get().feed.filter((m) => m.palCode !== code) });
  },

  async deleteGroup(code) {
    await palsService.deleteGroup(code);
    set({ groups: get().groups.filter((g) => g.code !== code), feed: get().feed.filter((m) => m.palCode !== code) });
  },

  async postMoment(targets, moment) {
    const user = get().user!;
    await momentsService.post(targets.length ? targets : [VLOG_PAL_CODE], moment, {
      userId: user.id,
      firstName: firstNameOf(user.displayName),
      avatarUrl: user.avatarUrl ?? null,
    });
    set({ pendingUploads: await momentsService.pendingCount() });
  },

  async updateProfile({ displayName, avatarLocalUri }) {
    const user = get().user!;
    let avatarUrl = user.avatarUrl ?? null;
    if (avatarLocalUri !== undefined) {
      avatarUrl = avatarLocalUri ? await storageService.uploadAvatar(avatarLocalUri) : null;
    }
    await authService.updateProfileMetadata({ displayName, avatarUrl });
    await palsService.updateMyProfile(user.id, { displayName, avatarUrl });
    set({ user: { ...user, displayName: displayName ?? user.displayName, avatarUrl } });
  },
}));
