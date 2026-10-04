import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import OnboardingScreen from './(auth)/onboarding';
import HomeScreen from './(main)/home';
import { sessionStore } from '../utils/sessionStore';
import { authService } from '../services/authService';
import { cameraWarmupStore } from '../utils/cameraWarmupStore';
import { User } from '../types';

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedThemeColor, setSelectedThemeColor] = useState('blue');
  const [autoOpenCreateModal, setAutoOpenCreateModal] = useState(false);

  useEffect(() => {
    async function initSession() {
      try {
        cameraWarmupStore.checkAndWarmupPermissions().catch(() => {});
        const user = await Promise.race([
          sessionStore.getUser(),
          new Promise<null>((res) => setTimeout(() => res(null), 800)),
        ]);
        const randomColor = sessionStore.getRandomThemeColor();
        setCurrentUser(user);
        setSelectedThemeColor(randomColor);
      } catch (e) {
        console.warn('Session init error:', e);
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, []);

  const handleAuthSuccess = async (user: User) => {
    await sessionStore.saveUser(user);
    setAutoOpenCreateModal(true);
    setCurrentUser(user);
  };

  const handleThemeColorChange = async (color: string) => {
    setSelectedThemeColor(color);
    await sessionStore.saveThemeColor(color);
  };

  const handleSignOut = async () => {
    if (currentUser?.id) {
      await authService.signOut();
    }
    await sessionStore.clearUser();
    setCurrentUser(null);
    setAutoOpenCreateModal(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF5232" />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <OnboardingScreen
        onAuthSuccess={handleAuthSuccess}
        themeColor={selectedThemeColor}
      />
    );
  }

  return (
    <HomeScreen
      user={currentUser}
      selectedThemeColor={selectedThemeColor}
      onSelectedThemeColorChange={handleThemeColorChange}
      onSignOut={handleSignOut}
      autoOpenCreateModal={autoOpenCreateModal}
    />
  );
}
