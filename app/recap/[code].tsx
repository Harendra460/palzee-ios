import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, IconButton, PzText } from '../../components/pz';
import { MomentMedia } from '../../components/moments/MomentMedia';
import { resolvePlayableUrl } from '../../components/moments/media';
import { Moment, momentsService } from '../../services/momentsService';
import { usePalzeeStore } from '../../stores/palzeeStore';
import { VideoExporter } from '../../modules/video-exporter';
import { ensureMediaSavePermission } from '../../utils/mediaSave';
import { hourLabel, isInPalDay, palDayRange, relativeHour } from '../../utils/palDay';

const MAX_TILES = 6;

type Segment = { key: string; label: string; moments: Moment[] };

/**
 * Daily recap (Setlog's "하루로그"): for a PAl, every logged hour of the pal day plays as a
 * split screen of everyone's clip for that hour; for "all"/"mine" clips play one after another.
 */
export default function Recap() {
  const { code, day, start } = useLocalSearchParams<{ code: string; day?: string; start?: string }>();
  const insets = useSafeAreaInsets();
  const { user, feed, groups } = usePalzeeStore();
  const offset = Number(day ?? 0);
  const isGroup = code !== 'all' && code !== 'mine';
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const since = palDayRange(offset).start;
      const source = isGroup ? await momentsService.listMoments(code!, { since }) : feed.filter((m) => code === 'all' || m.userId === user?.id);
      setMoments(source.filter((m) => !m.pending && isInPalDay(m.createdAt, offset)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
    })().catch((e) => Alert.alert('Could not load recap', e.message));
  }, [code, offset, isGroup, feed, user?.id]);

  const segments: Segment[] = useMemo(() => {
    if (!moments) return [];
    if (!isGroup) return moments.map((m) => ({ key: m.id, label: hourLabel(m.createdAt), moments: [m] }));
    const byHour = new Map<number, Moment[]>();
    for (const m of moments) byHour.set(relativeHour(m.createdAt), [...(byHour.get(relativeHour(m.createdAt)) ?? []), m]);
    return [...byHour.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([h, list]) => ({ key: String(h), label: hourLabel(list[0].createdAt), moments: list.slice(0, MAX_TILES) }));
  }, [moments, isGroup]);

  useEffect(() => {
    if (start && segments.length) {
      const i = segments.findIndex((s) => s.moments.some((m) => m.id === start));
      if (i >= 0) setIndex(i);
    }
  }, [start, segments]);

  const current = segments[index];
  useEffect(() => {
    if (!current || paused) return;
    const ms = Math.max(...current.moments.map((m) => m.clip.durationMs || 2000)) + 300;
    const t = setTimeout(() => setIndex((i) => (i + 1 < segments.length ? i + 1 : i)), ms);
    return () => clearTimeout(t);
  }, [current, paused, segments.length]);

  const title = isGroup ? groups.find((g) => g.code === code)?.name ?? 'PAl' : code === 'mine' ? 'My day' : 'All PAls';

  const save = async () => {
    if (!VideoExporter || !moments?.length) return Alert.alert('Export unavailable', 'This build cannot export videos.');
    if (!(await ensureMediaSavePermission())) return;
    setExporting(true);
    try {
      const dir = `${FileSystem.cacheDirectory}recap_export/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const paths: string[] = [];
      for (const m of moments) {
        const target = `${dir}${m.id}.mp4`;
        if (!(await FileSystem.getInfoAsync(target)).exists) {
          await FileSystem.downloadAsync(await resolvePlayableUrl(m.clip.videoUrl), target);
        }
        paths.push(target);
      }
      const uri = await VideoExporter.exportSlideshowVideo(
        paths,
        moments.map((m) => (isGroup ? `${m.authorName}${m.clip.caption ? ` · ${m.clip.caption}` : ''}` : m.clip.caption)),
        moments.map((m) => hourLabel(m.createdAt))
      );
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Your recap is in your gallery.');
    } catch (e: any) {
      Alert.alert('Could not export', e?.message ?? 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const cols = current && current.moments.length > 3 ? 2 : 1;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={[styles.bars, { top: insets.top + 6 }]}>
        {segments.map((s, i) => (
          <View key={s.key} style={[styles.bar, { backgroundColor: i <= index ? '#FFFFFF' : 'rgba(255,255,255,0.3)' }]} />
        ))}
      </View>
      <View style={[styles.header, { top: insets.top + 16 }]}>
        <View style={{ flex: 1 }}>
          <PzText variant="subheading" color="#FFFFFF">{title}</PzText>
          <PzText variant="caption" color="rgba(255,255,255,0.75)">{current ? current.label : ''}</PzText>
        </View>
        {exporting ? (
          <ActivityIndicator color="#FFFFFF" style={{ marginRight: 12 }} />
        ) : (
          <IconButton name="download-outline" color="#FFFFFF" label="Save recap video" onPress={save} />
        )}
        <IconButton name="close" color="#FFFFFF" label="Close" onPress={() => router.back()} />
      </View>

      {!moments ? (
        <ActivityIndicator color="#FFFFFF" style={{ flex: 1 }} />
      ) : !current ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <PzText variant="heading" color="#FFFFFF" align="center">Nothing logged this day yet</PzText>
        </View>
      ) : (
        <Pressable
          style={{ flex: 1, justifyContent: 'center', paddingTop: insets.top + 70, paddingBottom: insets.bottom + 20 }}
          onPressIn={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
          onPress={(e) => {
            const x = e.nativeEvent.locationX;
            setIndex((i) => (x < 120 ? Math.max(0, i - 1) : Math.min(segments.length - 1, i + 1)));
          }}
        >
          <View style={[styles.grid, { flexDirection: cols === 2 ? 'row' : 'column' }]}>
            {current.moments.map((m, i) => (
              <View key={m.id} style={{ width: cols === 2 ? '50%' : '100%', padding: 3 }}>
                <MomentMedia clip={m.clip} playing muted={i !== 0} loop={false} style={{ aspectRatio: 16 / 10 }} radius={10} />
                <View style={styles.tag}>
                  <Avatar name={m.authorName} uri={m.authorAvatarUrl} seed={m.userId} size={20} />
                  <PzText variant="caption" color="#FFFFFF" numberOfLines={1} style={{ marginLeft: 6, flexShrink: 1 }}>
                    {m.authorName}
                    {m.clip.caption ? ` · ${m.clip.caption}` : ''}
                  </PzText>
                </View>
              </View>
            ))}
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { position: 'absolute', left: 10, right: 10, flexDirection: 'row', gap: 3, zIndex: 2 },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  header: { position: 'absolute', left: 16, right: 6, flexDirection: 'row', alignItems: 'center', zIndex: 2 },
  grid: { flexWrap: 'wrap', paddingHorizontal: 6 },
  tag: { position: 'absolute', left: 10, bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center' },
});
