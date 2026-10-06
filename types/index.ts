export interface User {
  id: string;
  email: string;
  displayName: string;
  isPasskeyRegistered: boolean;
  authProvider?: string;
  avatarUrl?: string | null;
}

export enum UserRouteState {
  NEW_USER = 'NEW_USER',
  RETURNING_USER = 'RETURNING_USER',
  ERROR = 'ERROR',
}

export interface PalItem {
  name: string;
  size: string;
  code: string;
  isVlog: boolean;
  isCreator: boolean;
}

export interface SubmissionDbItem {
  id?: string | number;
  palCode: string;
  userId: string;
  userDisplayName: string;
  imageUrl: string;
  createdAt: string;
}

export interface MessageDbItem {
  id?: string | number;
  palCode: string;
  senderId: string;
  senderDisplayName: string;
  content: string;
  createdAt: string;
}

export interface UserPalMapping {
  id?: string | number;
  palCode: string;
  userId: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
  createdAt?: string;
}

export interface ActivePalState {
  palCode: string;
  submissions: SubmissionDbItem[];
  messages: MessageDbItem[];
  members: string[]; // formatted: "userId|||displayName|||avatarUrl"
  dailyHourHistory: Record<number, SubmissionDbItem[]>;
  activeHourSubmissions: Record<string, SubmissionDbItem>;
  exportData: Record<number, SubmissionDbItem[]>;
  memberCount: number;
}

export interface UserProfile {
  id: string;
  username: string;
  avatarUri?: string;
  themeColor?: string;
}

export interface PalMessage {
  id: string;
  videoUri: string;
  timestamp: string | number | Date;
  sender: UserProfile;
  caption?: string;
  chatTitle?: string;
}
