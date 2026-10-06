import { Redirect } from 'expo-router';
import { usePalzeeStore } from '../stores/palzeeStore';

export default function Index() {
  const user = usePalzeeStore((s) => s.user);
  return <Redirect href={user ? '/(tabs)/home' : '/(onboarding)/welcome'} />;
}
