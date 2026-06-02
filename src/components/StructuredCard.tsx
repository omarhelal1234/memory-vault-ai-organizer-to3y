import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image } from 'react-native';
import type {
  StructuredData,
  RecipeData,
  ArticleData,
  ProductData,
  RepoData,
  MovieData,
  TravelData,
  IdeaData,
  ReelData,
  ExtractedLink,
} from '../types';

// ---------------------------------------------------------------------------
// Small shared building blocks
// ---------------------------------------------------------------------------

const Pill = ({ icon, label }: { icon?: string; label: string }) => (
  <View style={styles.pill}>
    <Text style={styles.pillText}>
      {icon ? `${icon} ` : ''}
      {label}
    </Text>
  </View>
);

const Meta = ({ items }: { items: (string | undefined)[] }) => {
  const shown = items.filter(Boolean) as string[];
  if (shown.length === 0) return null;
  return (
    <View style={styles.metaRow}>
      {shown.map((m, i) => (
        <Pill key={`${m}-${i}`} label={m} />
      ))}
    </View>
  );
};

const Field = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
};

const Bullets = ({ label, items }: { label: string; items?: string[] }) => {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((it, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{it}</Text>
        </View>
      ))}
    </View>
  );
};

// Treat every URL coming from the model / DB as untrusted. Allow only http(s);
// prepend https:// to bare domains; reject javascript:/data:/mailto:/etc.
const safeUrl = (url?: string): string | null => {
  if (!url) return null;
  const t = url.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(t)) return `https://${t}`;
  return null;
};

const open = (url?: string) => {
  const safe = safeUrl(url);
  if (safe) Linking.openURL(safe).catch(() => {});
};

const OpenButton = ({ label, url }: { label: string; url?: string }) => {
  const safe = safeUrl(url);
  if (!safe) return null;
  return (
    <TouchableOpacity style={styles.cta} onPress={() => open(safe)}>
      <Text style={styles.ctaText}>{label} ↗</Text>
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// Per-category cards
// ---------------------------------------------------------------------------

const RecipeCard = ({ d }: { d: RecipeData }) => {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const toggle = (i: number) => setChecked((c) => ({ ...c, [i]: !c[i] }));
  return (
    <View>
      {d.title ? <Text style={styles.cardTitle}>{d.title}</Text> : null}
      <Meta items={[d.cuisine, d.servings && `🍽 ${d.servings}`, d.total_time && `⏱ ${d.total_time}`, d.prep_time && `Prep ${d.prep_time}`, d.cook_time && `Cook ${d.cook_time}`]} />

      {d.ingredients && d.ingredients.length > 0 ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Ingredients</Text>
          {d.ingredients.map((ing, i) => (
            <TouchableOpacity key={i} style={styles.checkRow} onPress={() => toggle(i)}>
              <Text style={styles.checkbox}>{checked[i] ? '☑' : '☐'}</Text>
              <Text style={[styles.checkText, checked[i] && styles.checkTextDone]}>{ing}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {d.steps && d.steps.length > 0 ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Steps</Text>
          {d.steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Field label="Notes" value={d.notes} />
      <OpenButton label="Open source recipe" url={d.source_url} />
    </View>
  );
};

const ArticleCard = ({ d }: { d: ArticleData }) => (
  <View>
    {d.headline ? <Text style={styles.cardTitle}>{d.headline}</Text> : null}
    <Meta items={[d.site, d.author && `✍ ${d.author}`, d.reading_time && `📖 ${d.reading_time}`, d.published]} />
    <Bullets label="TL;DR" items={d.tldr} />
    <Bullets label="Key points" items={d.key_points} />
    <OpenButton label="Read article" url={d.url} />
  </View>
);

const ProductCard = ({ d }: { d: ProductData }) => (
  <View>
    {d.product ? <Text style={styles.cardTitle}>{d.product}</Text> : null}
    <Meta items={[d.brand, d.price && `💰 ${d.price}`, d.retailer]} />
    <Bullets label="Pros" items={d.pros} />
    <Bullets label="Cons" items={d.cons} />
    <OpenButton label="View product" url={d.url} />
  </View>
);

const RepoCard = ({ d }: { d: RepoData }) => (
  <View>
    {(d.owner || d.name) ? (
      <Text style={styles.cardTitle}>{[d.owner, d.name].filter(Boolean).join(' / ')}</Text>
    ) : null}
    <Meta items={[d.language, d.stars && `⭐ ${d.stars}`]} />
    <Field label="What it does" value={d.description} />
    <Field label="Use it for" value={d.use_case} />
    <OpenButton label="Open repo" url={d.url} />
  </View>
);

const MovieCard = ({ d }: { d: MovieData }) => (
  <View>
    {d.title ? <Text style={styles.cardTitle}>{d.title}</Text> : null}
    <Meta items={[d.year, d.genre, d.director && `🎬 ${d.director}`]} />
    <Field label="Synopsis" value={d.synopsis} />
    <Field label="Why save it" value={d.why_save} />
    <Field label="Where to watch" value={d.where_to_watch} />
  </View>
);

const TravelCard = ({ d }: { d: TravelData }) => {
  const mapUrl = d.map_query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.map_query)}`
    : undefined;
  return (
    <View>
      {d.place ? <Text style={styles.cardTitle}>{d.place}</Text> : null}
      <Meta items={[[d.region, d.country].filter(Boolean).join(', ') || undefined, d.best_season && `☀ ${d.best_season}`, d.est_budget && `💰 ${d.est_budget}`]} />
      <Bullets label="Highlights" items={d.highlights} />
      <OpenButton label="Open in Maps" url={mapUrl} />
    </View>
  );
};

const IdeaCard = ({ d, spark }: { d: IdeaData; spark?: number | null }) => (
  <View>
    {d.headline ? <Text style={styles.cardTitle}>{d.headline}</Text> : null}
    {d.one_liner ? <Text style={styles.ideaOneLiner}>{d.one_liner}</Text> : null}
    {typeof spark === 'number' ? <SparkBar score={spark} /> : null}
    <Field label="Problem it solves" value={d.problem} />
    <Field label="Who it's for" value={d.audience} />
    {d.next_action ? (
      <View style={styles.nextAction}>
        <Text style={styles.nextActionLabel}>▶ Next action</Text>
        <Text style={styles.nextActionText}>{d.next_action}</Text>
      </View>
    ) : null}
    {d.ten_x ? (
      <View style={styles.tenX}>
        <Text style={styles.tenXLabel}>🚀 Make it 10×</Text>
        <Text style={styles.tenXText}>{d.ten_x}</Text>
      </View>
    ) : null}
    <Bullets label="Related" items={d.related} />
  </View>
);

const ReelCard = ({ d }: { d: ReelData }) => {
  const thumb = safeUrl(d.thumbnail_url);
  return (
    <View>
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.reelThumb} resizeMode="cover" />
      ) : null}
      {d.title ? <Text style={styles.cardTitle}>{d.title}</Text> : null}
      <Meta items={[d.platform && `📱 ${d.platform}`, d.author && `@ ${d.author}`]} />
      <Field label="What it's about" value={d.summary} />
      {d.caption ? <Field label="Caption" value={d.caption} /> : null}
      <Bullets label="Worth doing / learning" items={d.action_items} />
      <OpenButton label="Watch" url={d.url} />
    </View>
  );
};

export const SparkBar = ({ score }: { score: number }) => {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 70 ? '#F59E0B' : pct >= 40 ? '#6366F1' : '#9CA3AF';
  return (
    <View style={styles.sparkWrap}>
      <View style={styles.sparkHeader}>
        <Text style={styles.sparkLabel}>⚡ Spark score</Text>
        <Text style={[styles.sparkValue, { color }]}>{pct}</Text>
      </View>
      <View style={styles.sparkTrack}>
        <View style={[styles.sparkFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export const StructuredCard = ({
  data,
  sparkScore,
}: {
  data?: StructuredData | null;
  sparkScore?: number | null;
}) => {
  if (!data || !data.kind) return null;
  let body: React.ReactNode = null;
  switch (data.kind) {
    case 'recipe': body = <RecipeCard d={data} />; break;
    case 'article': body = <ArticleCard d={data} />; break;
    case 'product': body = <ProductCard d={data} />; break;
    case 'repo': body = <RepoCard d={data} />; break;
    case 'movie': body = <MovieCard d={data} />; break;
    case 'travel': body = <TravelCard d={data} />; break;
    case 'idea': body = <IdeaCard d={data} spark={sparkScore} />; break;
    case 'reel': body = <ReelCard d={data} />; break;
    default: return null;
  }
  return <View style={styles.card}>{body}</View>;
};

export const ExtractedLinks = ({ links }: { links?: ExtractedLink[] | null }) => {
  if (!links || links.length === 0) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.sectionLabel}>Links</Text>
      {links.map((l, i) => (
        <TouchableOpacity key={l.url || i} style={styles.linkRow} onPress={() => open(l.url)}>
          <Text style={styles.linkIcon}>🔗</Text>
          <Text style={styles.linkText} numberOfLines={1}>
            {l.label || l.url}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#EEF0F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  reelThumb: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12, backgroundColor: '#E9ECEF' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  pill: { backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, color: '#4F46E5', fontWeight: '600' },

  field: { marginTop: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  fieldValue: { fontSize: 15, color: '#1F2937', lineHeight: 21 },

  bulletRow: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { fontSize: 15, color: '#6366F1', marginRight: 8, lineHeight: 21 },
  bulletText: { flex: 1, fontSize: 15, color: '#1F2937', lineHeight: 21 },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5 },
  checkbox: { fontSize: 18, color: '#6366F1', marginRight: 10, lineHeight: 22 },
  checkText: { flex: 1, fontSize: 15, color: '#1F2937', lineHeight: 22 },
  checkTextDone: { color: '#9CA3AF', textDecorationLine: 'line-through' },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  stepNumText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 15, color: '#1F2937', lineHeight: 22 },

  ideaOneLiner: { fontSize: 16, color: '#4B5563', fontStyle: 'italic', marginBottom: 12, lineHeight: 22 },
  nextAction: { marginTop: 14, backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: '#10B981' },
  nextActionLabel: { fontSize: 12, fontWeight: '800', color: '#047857', marginBottom: 4 },
  nextActionText: { fontSize: 15, color: '#065F46', lineHeight: 21 },
  tenX: { marginTop: 12, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  tenXLabel: { fontSize: 12, fontWeight: '800', color: '#B45309', marginBottom: 4 },
  tenXText: { fontSize: 15, color: '#92400E', lineHeight: 21 },

  sparkWrap: { marginVertical: 10 },
  sparkHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sparkLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  sparkValue: { fontSize: 18, fontWeight: '900' },
  sparkTrack: { height: 8, borderRadius: 4, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  sparkFill: { height: 8, borderRadius: 4 },

  cta: { marginTop: 16, backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#495057', marginBottom: 6, textTransform: 'uppercase' },
  linkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  linkIcon: { fontSize: 14, marginRight: 8 },
  linkText: { flex: 1, fontSize: 14, color: '#4F46E5', fontWeight: '500' },
});
