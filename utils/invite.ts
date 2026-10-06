import { Share } from 'react-native';

/** Plain-text invite, same idea as Android's "Join my Pal group … using code #…". */
export function shareInvite(group: { name: string; code: string }) {
  return Share.share({ message: `Join my PAl "${group.name}" on PalZee with code #${group.code}` });
}
