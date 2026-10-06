import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton, IconButton, PzText } from '../components/pz';
import { usePalzeeStore } from '../stores/palzeeStore';
import { VLOG_PAL_CODE } from '../services/encoding';
import { ensureMediaSavePermission } from '../utils/mediaSave';
import * as MediaLibrary from 'expo-media-library';
import { fonts, radius, useTheme } from '../theme/tokens';

const LENGTHS = [2, 3, 5, 10] as const;
const CAPTION_MAX = 100;

type Captured = { uri: string; durationMs: number; rotation: number; facing: 'back' | 'front' };

/**
 * The UI is locked to portrait, so a clip filmed with the phone sideways is stored with the
 * rotation needed to show it upright in a landscape card (90 or 270, like the Android app).
 */
function rotationFromGravity(x: number): number {
  if (x > 0.6) return 90;
  if (x < -0.6) return 270;
  return 0;
}

function useGravityX() {
  const x = useRef(0);
  useEffect(() => {
    Accelerometer.setUpdateInterval(200);
    // Android reports the reaction to gravity (opposite sign to iOS); normalise to iOS.
    const sign = Platform.OS === 'android' ? -1 : 1;
    const sub = Accelerometer.addListener((d) => (x.current = sign * d.x));
    return () => sub.remove();
  }, []);
  return x;
}

function Preview({ captured, onRetake }: { captured: Captured; onRetake: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { groups, postMoment } = usePalzeeStore();
  const [caption, setCaption] = useState('');
  const [muted, setMuted] = useState(false);
  const [targets, setTargets] = useState<Set<string>>(() => new Set(groups.length ? groups.map((g) => g.code) : [VLOG_PAL_CODE]));
  const [sending, setSending] = useState(false);
  const player = useVideoPlayer(captured.uri, (p) => {
    p.loop = true;
    p.play();
  });
  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  const sideways = captured.rotation % 180 !== 0;
  const toggle = (code: string) =>
    setTargets((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  const send = async () => {
    if (targets.size === 0) return Alert.alert('Choose where to post', 'Pick at least one PAl, or My Vlog.');
    setSending(true);
    try {
      await postMoment([...targets], {
        localUri: captured.uri,
        caption: caption.trim(),
        durationMs: captured.durationMs,
        rotation: captured.rotation,
        isMuted: muted,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Could not post', e?.message ?? 'Please try again.');
      setSending(false);
    }
  };

  const save = async () => {
    if (!(await ensureMediaSavePermission())) return;
    await MediaLibrary.saveToLibraryAsync(captured.uri).then(
      () => Alert.alert('Saved', 'The clip is in your gallery.'),
      (e) => Alert.alert('Could not save', e.message)
    );
  };

  const options = [{ code: VLOG_PAL_CODE, name: 'My Vlog' }, ...groups.map((g) => ({ code: g.code, name: g.name }))];

  return (
    <View style={{ flex: 1, backgroundColor: c.camera, paddingTop: insets.top + 8 }}>
      <View style={styles.topRow}>
        <IconButton name="close" color="#FFFFFF" label="Retake" onPress={onRetake} />
        <View style={{ flexDirection: 'row' }}>
          <IconButton name={muted ? 'volume-mute' : 'volume-high'} color="#FFFFFF" label={muted ? 'Unmute' : 'Mute'} onPress={() => setMuted((m) => !m)} />
          <IconButton name="download-outline" color="#FFFFFF" label="Save to gallery" onPress={save} />
        </View>
      </View>

      <View style={[styles.previewBox, { aspectRatio: 16 / 10 }]}>
        <View
          style={
            sideways
              ? { position: 'absolute', width: '62.5%', height: '160%', left: '18.75%', top: '-30%', transform: [{ rotate: `${captured.rotation}deg` }] }
              : StyleSheet.absoluteFill
          }
        >
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} surfaceType="textureView" />
        </View>
      </View>

      <TextInput
        value={caption}
        onChangeText={(t) => setCaption(t.slice(0, CAPTION_MAX))}
        placeholder="Add a caption…"
        placeholderTextColor="rgba(255,255,255,0.5)"
        style={styles.caption}
        cursorColor="#FFFFFF"
        maxLength={CAPTION_MAX}
        returnKeyType="done"
      />

      <PzText variant="label" color="rgba(255,255,255,0.7)" style={{ marginHorizontal: 20, marginTop: 18, marginBottom: 10 }}>
        Send to
      </PzText>
      <View style={styles.targets}>
        {options.map((o) => {
          const on = targets.has(o.code);
          return (
            <Pressable
              key={o.code}
              onPress={() => toggle(o.code)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[styles.target, { backgroundColor: on ? c.primary : 'rgba(255,255,255,0.12)' }]}
            >
              {on && <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />}
              <PzText variant="label" color="#FFFFFF">{o.name}</PzText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />
      <GradientButton label="Send" trailingIcon="arrow-up" onPress={send} loading={sending} style={{ marginHorizontal: 20, marginBottom: insets.bottom + 16 }} />
    </View>
  );
}

/** Mockup camera screen with Setlog's short-clip capture. */
export default function Camera() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const gravityX = useGravityX();
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);
  const [length, setLength] = useState<(typeof LENGTHS)[number]>(2);
  const [timer, setTimer] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (camPerm && !camPerm.granted && camPerm.canAskAgain) void requestCam();
    if (micPerm && !micPerm.granted && micPerm.canAskAgain) void requestMic();
  }, [camPerm, micPerm, requestCam, requestMic]);

  const record = async () => {
    if (!camera.current || recording || !ready) return;
    const rotation = rotationFromGravity(gravityX.current);
    setRecording(true);
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: length * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    const started = Date.now();
    const stopTimer = setTimeout(() => camera.current?.stopRecording(), length * 1000);
    try {
      const res = await camera.current.recordAsync({ maxDuration: length + 1 });
      if (res?.uri) setCaptured({ uri: res.uri, durationMs: Math.min(Date.now() - started, length * 1000), rotation, facing });
    } catch (e: any) {
      Alert.alert('Recording failed', e?.message ?? 'Please try again.');
    } finally {
      clearTimeout(stopTimer);
      setRecording(false);
      progress.stopAnimation();
    }
  };

  const onShutter = () => {
    if (!timer) return void record();
    let n = 3;
    setCountdown(n);
    const tick = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n === 0) {
        clearInterval(tick);
        void record();
      }
    }, 1000);
  };

  if (captured) {
    return (
      <>
        <StatusBar style="light" />
        <Preview captured={captured} onRetake={() => setCaptured(null)} />
      </>
    );
  }

  if (camPerm && !camPerm.granted) {
    return (
      <View style={[styles.fill, { backgroundColor: c.camera, alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Ionicons name="camera-outline" size={44} color="#FFFFFF" />
        <PzText variant="heading" color="#FFFFFF" align="center" style={{ marginTop: 12 }}>Camera access needed</PzText>
        <PzText variant="body" color="rgba(255,255,255,0.7)" align="center" style={{ marginTop: 6, marginBottom: 24 }}>
          Allow camera access in Settings to log moments.
        </PzText>
        <GradientButton label="Allow camera" onPress={requestCam} style={{ alignSelf: 'stretch' }} />
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <PzText variant="label" color="#FFFFFF">Not now</PzText>
        </Pressable>
      </View>
    );
  }

  const ringWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[styles.fill, { backgroundColor: c.camera }]}>
      <StatusBar style="light" />
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
        mute={!micPerm?.granted}
        enableTorch={torch}
        onCameraReady={() => setReady(true)}
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 110 }}
        pointerEvents="none"
      />
      <View style={[styles.topRow, { position: 'absolute', top: insets.top + 8, left: 0, right: 0 }]}>
        <IconButton name="close" color="#FFFFFF" label="Close camera" onPress={() => router.back()} />
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <IconButton name={torch ? 'flash' : 'flash-off'} color="#FFFFFF" label="Flash" onPress={() => setTorch((t) => !t)} />
          <IconButton name="camera-reverse-outline" color="#FFFFFF" label="Flip camera" onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} />
        </View>
      </View>

      <View style={[styles.rail, { top: insets.top + 120 }]}>
        <Pressable onPress={() => setTimer((t) => !t)} style={styles.railItem} accessibilityLabel="Countdown timer" accessibilityState={{ selected: timer }}>
          <Ionicons name="timer-outline" size={22} color={timer ? '#FFD84D' : '#FFFFFF'} />
          <PzText variant="caption" color={timer ? '#FFD84D' : '#FFFFFF'} style={{ fontSize: 10, marginTop: 2 }}>3s</PzText>
        </Pressable>
      </View>

      {countdown > 0 && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <PzText style={{ fontFamily: fonts.extrabold, fontSize: 96, color: '#FFFFFF' }}>{countdown}</PzText>
        </View>
      )}

      {recording && (
        <View style={[styles.progressTrack, { top: insets.top + 2 }]}>
          <Animated.View style={[styles.progressFill, { width: ringWidth }]} />
        </View>
      )}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.modes}>
          {LENGTHS.map((l) => (
            <Pressable key={l} onPress={() => !recording && setLength(l)} hitSlop={8} accessibilityRole="tab" accessibilityState={{ selected: l === length }}>
              <PzText variant="bodyStrong" color={l === length ? '#FFFFFF' : 'rgba(255,255,255,0.55)'}>{l}s</PzText>
              {l === length && <View style={styles.modeDot} />}
            </Pressable>
          ))}
        </View>
        <View style={styles.shutterRow}>
          <IconButton name="images-outline" color="#FFFFFF" size={26} label="Memories" onPress={() => router.replace('/(tabs)/memories')} />
          <Pressable
            onPress={onShutter}
            disabled={recording || countdown > 0 || !ready}
            accessibilityRole="button"
            accessibilityLabel={`Record a ${length} second moment`}
            style={[styles.shutter, { borderColor: recording ? '#FF4D73' : '#FFFFFF' }]}
          >
            <View style={[styles.shutterInner, { backgroundColor: recording ? '#FF4D73' : 'transparent', transform: [{ scale: recording ? 0.55 : 1 }] }]} />
          </Pressable>
          <IconButton name="people-outline" color="#FFFFFF" size={26} label="PAls" onPress={() => router.replace('/(tabs)/pals')} />
        </View>
        <PzText variant="caption" color="rgba(255,255,255,0.65)" align="center" style={{ marginTop: 10 }}>
          Turn your phone sideways for a landscape log
        </PzText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  rail: { position: 'absolute', right: 14, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 22, paddingVertical: 8, paddingHorizontal: 6 },
  railItem: { alignItems: 'center', paddingVertical: 6 },
  progressTrack: { position: 'absolute', left: 16, right: 16, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#FF4D73' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.25)' },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginBottom: 18 },
  modeDot: { alignSelf: 'center', width: 18, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', marginTop: 4 },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31 },
  previewBox: { marginHorizontal: 16, marginTop: 16, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  caption: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#FFFFFF',
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  target: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 34, borderRadius: 17 },
});
