import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { ClipPayload } from '../../services/encoding';
import { gradients } from '../../theme/tokens';
import { usePlayableUrl, useThumbnail } from './media';

/**
 * Lays a clip out inside its box. Clips recorded portrait carry rotation=270 and are turned to
 * fill a landscape card, the way Setlog and the native Android app display hourly logs.
 */
function RotatedFill({ rotation, children }: { rotation: number; children: React.ReactNode }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const sideways = rotation % 180 !== 0;
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box.w > 0 && (
        <View
          style={
            sideways
              ? {
                  position: 'absolute',
                  width: box.h,
                  height: box.w,
                  left: (box.w - box.h) / 2,
                  top: (box.h - box.w) / 2,
                  transform: [{ rotate: `${rotation}deg` }],
                }
              : StyleSheet.absoluteFill
          }
        >
          {children}
        </View>
      )}
    </View>
  );
}

function Player({ uri, muted, loop }: { uri: string; muted: boolean; loop: boolean }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = loop;
    p.muted = muted;
    p.play();
  });
  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} surfaceType="textureView" />;
}

export function MomentMedia({
  clip,
  playing = false,
  muted = true,
  loop = true,
  style,
  radius = 18,
  showPlayBadge = false,
}: {
  clip: ClipPayload;
  playing?: boolean;
  muted?: boolean;
  loop?: boolean;
  style?: ViewStyle;
  radius?: number;
  showPlayBadge?: boolean;
}) {
  const thumb = useThumbnail(clip.videoUrl);
  const playable = usePlayableUrl(playing ? clip.videoUrl : null);
  const rotation = clip.rotation || 0;

  return (
    <View style={[{ overflow: 'hidden', borderRadius: radius, backgroundColor: '#1A1530' }, style]}>
      {!thumb && <LinearGradient colors={gradients.dusk} style={StyleSheet.absoluteFill} />}
      <RotatedFill rotation={rotation}>
        {thumb && <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />}
        {playing && playable && <Player uri={playable} muted={muted || clip.isMuted} loop={loop} />}
      </RotatedFill>
      {playing && !playable && <ActivityIndicator color="#FFFFFF" style={StyleSheet.absoluteFill} />}
      {showPlayBadge && !playing && (
        <View style={styles.badge}>
          <Ionicons name="play" size={14} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
