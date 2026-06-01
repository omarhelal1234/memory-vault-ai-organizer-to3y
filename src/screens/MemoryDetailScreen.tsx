import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { getMemory, getSignedUrl } from '../lib/api';
import type { Memory } from '../types';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending AI analysis',
  processing: 'Processing…',
  completed: 'Analyzed',
  failed: 'Analysis failed',
};

const MemoryDetailScreen = ({ route }: any) => {
  const id: string | undefined = route?.params?.id;
  const [memory, setMemory] = useState<Memory | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) {
        setError('No memory selected.');
        setLoading(false);
        return;
      }
      try {
        const m = await getMemory(id);
        setMemory(m);
        if (m.storage_path) {
          setImageUrl(await getSignedUrl(m.storage_path));
        }
      } catch (e: any) {
        setError(e?.message ?? 'Could not load memory.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (error || !memory) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Memory not found.'}</Text>
      </View>
    );
  }

  const meta = memory.ai_metadata;
  const tags = meta?.suggested_tags ?? [];
  const categories = meta?.suggested_categories ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{memory.title || meta?.summary || 'Memory'}</Text>
      <Text style={styles.status}>
        {STATUS_LABEL[memory.processing_status] ?? memory.processing_status} • {memory.type}
      </Text>

      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      ) : null}

      {memory.url ? (
        <TouchableOpacity onPress={() => Linking.openURL(memory.url!)}>
          <Text style={styles.link}>{memory.url}</Text>
        </TouchableOpacity>
      ) : null}

      {memory.content_text ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Content</Text>
          <Text style={styles.body}>{memory.content_text}</Text>
        </View>
      ) : null}

      {meta?.summary ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AI Summary</Text>
          <Text style={styles.body}>{meta.summary}</Text>
        </View>
      ) : null}

      {(meta as any)?.transcript ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Transcript</Text>
          <Text style={styles.body}>{(meta as any).transcript}</Text>
        </View>
      ) : null}

      {categories.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Categories</Text>
          <View style={styles.chips}>
            {categories.map((c) => (
              <View key={c} style={[styles.chip, styles.chipCategory]}>
                <Text style={styles.chipCategoryText}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {tags.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tags</Text>
          <View style={styles.chips}>
            {tags.map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText}>#{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {memory.processing_status === 'pending' || memory.processing_status === 'processing' ? (
        <Text style={styles.hint}>
          AI hasn’t finished yet. Pull to refresh on the Home screen to update.
        </Text>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#212529', marginBottom: 4 },
  status: { fontSize: 13, color: '#6C757D', marginBottom: 16, textTransform: 'capitalize' },
  image: { width: '100%', height: 240, borderRadius: 12, marginBottom: 16, backgroundColor: '#E9ECEF' },
  link: { color: '#6366F1', fontSize: 15, marginBottom: 16, textDecorationLine: 'underline' },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#495057', marginBottom: 6, textTransform: 'uppercase' },
  body: { fontSize: 16, color: '#212529', lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#E9ECEF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, color: '#495057' },
  chipCategory: { backgroundColor: '#EEF2FF' },
  chipCategoryText: { fontSize: 13, color: '#6366F1', fontWeight: '600' },
  hint: { color: '#ADB5BD', fontSize: 13, textAlign: 'center', marginTop: 8 },
  error: { color: '#DC2626', fontSize: 15, textAlign: 'center', padding: 20 },
});

export default MemoryDetailScreen;
