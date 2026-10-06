import { Redirect, useLocalSearchParams } from 'expo-router';

/** Invite deep link (io.supabase.pals://join/<code>) opens the join sheet prefilled. */
export default function JoinLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/new-pal', params: { tab: 'join', code } }} />;
}
