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
import { getMemory, getSignedUrl, categoryIcon } from '../lib/api';
import { StructuredCard, ExtractedLinks } from '../components/StructuredCard';
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
  const category = memory.category ?? meta?.suggested_categories?.[0] ?? null;
  const hasStructured = !!memory.structured_data?.kind;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>{categoryIcon(category)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{memory.title || meta?.summary || 'Memory'}</Text>
          <Text style={styles.status}>
            {category ? `${category} • ` : ''}
            {STATUS_LABEL[memory.processing_status] ?? memory.processing_status}
          </Text>
        </View>
      </View>

      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      ) : null}

      {/* The rich, category-specific extraction is the star of the screen. */}
      <StructuredCard data={memory.structured_data} sparkScore={memory.spark_score} />

      <ExtractedLinks links={memory.extracted_links} />

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

      {/* Fall back to the plain summary only when there's no structured card. */}
      {!hasStructured && meta?.summary ? (
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
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  headerIcon: { fontSize: 34, lineHeight: 38 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#212529', marginBottom: 4 },
  status: { fontSize: 13, color: '#6C757D' },
  image: { width: '100%', height: 240, borderRadius: 12, marginBottom: 16, backgroundColor: '#E9ECEF' },
  link: { color: '#6366F1', fontSize: 15, marginBottom: 16, textDecorationLine: 'underline' },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#495057', marginBottom: 6, textTransform: 'uppercase' },
  body: { fontSize: 16, color: '#212529', lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#E9ECEF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, color: '#495057' },
  hint: { color: '#ADB5BD', fontSize: 13, textAlign: 'center', marginTop: 8 },
  error: { color: '#DC2626', fontSize: 15, textAlign: 'center', padding: 20 },
});

export default MemoryDetailScreen;
