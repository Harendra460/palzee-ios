import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Field, GradientButton, IconButton, PzText } from '../components/pz';
import { usePalzeeStore } from '../stores/palzeeStore';
import { useTheme } from '../theme/tokens';

export default function EditProfile() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = usePalzeeStore();
  const [name, setName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (!res.canceled && res.assets[0]) setAvatar(res.assets[0].uri);
  };

  const save = async () => {
    if (name.trim().length < 2) return Alert.alert('Your name', 'Please enter your name.');
    setSaving(true);
    try {
      await updateProfile({ displayName: name.trim(), bio, ...(avatar !== undefined ? { avatarLocalUri: avatar } : {}) });
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const shownAvatar = avatar === undefined ? user?.avatarUrl : avatar;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: insets.top + 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <PzText variant="title">Edit profile</PzText>
          <IconButton name="close" label="Close" onPress={() => router.back()} />
        </View>

        <Pressable onPress={pick} style={{ alignSelf: 'center', marginVertical: 24 }} accessibilityRole="button" accessibilityLabel="Change photo">
          <Avatar name={name || 'Me'} uri={shownAvatar} seed={user?.id} size={110} />
          <View style={{ position: 'absolute', right: 2, bottom: 2, width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.bg }}>
            <Ionicons name="camera" size={16} color="#FFFFFF" />
          </View>
        </Pressable>
        {shownAvatar && (
          <Pressable onPress={() => setAvatar(null)} style={{ alignSelf: 'center', marginTop: -12, marginBottom: 16 }}>
            <PzText variant="label" color="danger">Remove photo</PzText>
          </Pressable>
        )}

        <View style={{ gap: 12 }}>
          <Field label="Full Name" icon="person-outline" value={name} onChangeText={setName} maxLength={40} />
          <Field label="Bio" icon="sparkles-outline" value={bio} onChangeText={setBio} maxLength={120} placeholder="Turning everyday moments into memories." />
        </View>
        <GradientButton label="Save" trailingIcon={null} onPress={save} loading={saving} style={{ marginTop: 28 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
