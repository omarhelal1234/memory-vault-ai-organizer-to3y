import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  createNote,
  createLink,
  createImageMemory,
  processMyMemories,
} from '../lib/api';

type Kind = 'note' | 'link' | 'image';

// Recognize short-video links so we can tell the user it'll be auto-analyzed.
function detectPlatform(url: string): string | null {
  try {
    const host = new URL(url.trim()).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('tiktok.com')) return 'TikTok';
    if (host.includes('instagram.com')) return 'Instagram';
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be')
      return 'YouTube';
  } catch {
    // not a full URL yet
  }
  return null;
}

const CaptureScreen = ({ navigation }: any) => {
  const [kind, setKind] = useState<Kind>('note');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [image, setImage] = useState<{ uri: string; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
    }
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      if (kind === 'note') {
        if (!text.trim()) throw new Error('Write some note text.');
        await createNote(text.trim(), title.trim() || undefined);
      } else if (kind === 'link') {
        if (!url.trim()) throw new Error('Enter a URL.');
        await createLink(url.trim(), title.trim() || undefined);
      } else {
        if (!image) throw new Error('Pick an image first.');
        await createImageMemory(image.uri, image.mimeType, title.trim() || undefined);
      }

      // Kick off AI processing for this user's pending memories (best-effort).
      processMyMemories();

      navigation.goBack();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save memory.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tabs}>
        {(['note', 'link', 'image'] as Kind[]).map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.tab, kind === k && styles.tabActive]}
            onPress={() => setKind(k)}
          >
            <Text style={[styles.tabText, kind === k && styles.tabTextActive]}>
              {k === 'note' ? '📝 Note' : k === 'link' ? '🔗 Link / Reel' : '🖼️ Image'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Title (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Give it a title"
        value={title}
        onChangeText={setTitle}
        placeholderTextColor="#ADB5BD"
      />

      {kind === 'note' && (
        <>
          <Text style={styles.label}>Note</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="What do you want to remember?"
            value={text}
            onChangeText={setText}
            multiline
            placeholderTextColor="#ADB5BD"
          />
        </>
      )}

      {kind === 'link' && (
        <>
          <Text style={styles.label}>URL</Text>
          <TextInput
            style={styles.input}
            placeholder="Paste a link, TikTok, Reel or YouTube URL"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholderTextColor="#ADB5BD"
          />
          {detectPlatform(url) ? (
            <Text style={styles.detected}>
              📱 {detectPlatform(url)} detected — AI will pull the caption, author & thumbnail.
            </Text>
          ) : null}
        </>
      )}

      {kind === 'image' && (
        <>
          <Text style={styles.label}>Image</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" />
            ) : (
              <Text style={styles.imagePickerText}>Tap to choose an image</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={save}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save Memory</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>
        After saving, AI categorizes it in the background. Pull to refresh on Home.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 16 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E9ECEF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 14, color: '#6C757D', fontWeight: '600' },
  tabTextActive: { color: '#6366F1' },
  label: { fontSize: 14, fontWeight: '600', color: '#495057', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#212529',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  textarea: { height: 140, textAlignVertical: 'top' },
  imagePicker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  detected: { color: '#4F46E5', fontSize: 13, marginTop: -8, marginBottom: 16, fontWeight: '600' },
  imagePickerText: { color: '#ADB5BD', fontSize: 16 },
  preview: { width: '100%', height: '100%' },
  button: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  error: { color: '#DC2626', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  hint: { color: '#ADB5BD', fontSize: 13, textAlign: 'center', marginTop: 16 },
});

export default CaptureScreen;
