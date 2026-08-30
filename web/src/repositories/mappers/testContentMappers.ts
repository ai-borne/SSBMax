import { OIRQuestion, PPDTContext, TATSet, WATBatch, SRTBatch, BatchDocument, GPEImage } from '../../types/testContent';

/**
 * Passes through Firestore-stored image URLs, dropping any stray `gs://` value.
 *
 * `gs://` paths used to be rewritten to `https://storage.googleapis.com/...`, but that
 * host isn't in web's CSP `img-src` allowlist (only `firebasestorage.googleapis.com`
 * is) and requires a `firebaseStorageDownloadTokens` value this client doesn't have —
 * so a resolvable, CSP-compliant URL can't be built here. Upload scripts now write a
 * pre-resolved `firebasestorage.googleapis.com` download-token URL directly, so a
 * `gs://` value at this point means an un-backfilled placeholder; returning '' lets
 * each caller's own no-image fallback take over instead of emitting a CSP-blocked img.
 */
export function normalizeStorageUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('gs://')) return '';
  return trimmed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Maps WAT batch documents, supporting polymorphic payload schemas.
 */
export function mapDocToWATBatch(id: string, data?: Record<string, unknown>): WATBatch {
  if (!data) {
    return {
      id,
      words: ['LEADERSHIP', 'COURAGE', 'HONESTY', 'CHALLENGE', 'TEAMWORK', 'SUCCESS'],
      displayDurationSeconds: 15
    };
  }

  const rawWords = data.words ?? data.wordList ?? data.items ?? [];
  const words: string[] = Array.isArray(rawWords)
    ? rawWords
        .map((item: unknown) => {
          if (typeof item === 'string') return item.trim();
          const record = asRecord(item);
          if (record) return asString(record.word ?? record.text ?? record.title).trim();
          return String(item ?? '');
        })
        .filter(Boolean)
    : [];

  return {
    id: asString(data.id, id),
    words: words.length > 0 ? words : ['LEADERSHIP', 'COURAGE', 'HONESTY', 'CHALLENGE', 'TEAMWORK', 'SUCCESS'],
    displayDurationSeconds: typeof data.displayDurationSeconds === 'number' ? data.displayDurationSeconds : 15
  };
}

/**
 * Maps SRT batch documents, supporting polymorphic payload schemas.
 */
export function mapDocToSRTBatch(id: string, data?: Record<string, unknown>): SRTBatch {
  if (!data) {
    return {
      id,
      situations: [
        'He was going to appear for an exam and saw a road accident victim. He...',
        'While leading a trekking expedition, one of his teammates injured his leg severely. He...',
        'He was tasked to organize a college cultural fest with limited funds. He...'
      ],
      totalTimeMinutes: 30
    };
  }

  const rawSituations = data.situations ?? data.situationList ?? data.items ?? [];
  const situations: string[] = Array.isArray(rawSituations)
    ? rawSituations
        .map((item: unknown) => {
          if (typeof item === 'string') return item.trim();
          const record = asRecord(item);
          if (record) return asString(record.situation ?? record.text ?? record.description).trim();
          return String(item ?? '');
        })
        .filter(Boolean)
    : [];

  return {
    id: asString(data.id, id),
    situations: situations.length > 0 ? situations : [
      'He was going to appear for an exam and saw a road accident victim. He...',
      'While leading a trekking expedition, one of his teammates injured his leg severely. He...',
      'He was tasked to organize a college cultural fest with limited funds. He...'
    ],
    totalTimeMinutes: typeof data.totalTimeMinutes === 'number' ? data.totalTimeMinutes : 30
  };
}

/**
 * Maps TAT slide sets, normalizing URLs and appending the 12th blank card per SSB protocol.
 */
export function mapDocToTATSet(id: string, data?: Record<string, unknown>): TATSet {
  if (!data) {
    const fallbackUrls = [
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80'
    ];
    while (fallbackUrls.length < 11) {
      fallbackUrls.push(fallbackUrls[fallbackUrls.length % fallbackUrls.length]);
    }
    fallbackUrls.push('blank');
    return {
      id,
      setName: 'TAT Practice Set 1',
      imageUrls: fallbackUrls,
      imageIds: fallbackUrls.map((_, i) => `tat-img-${i + 1}`),
      slideDurationSeconds: 240,
      totalSlides: 12
    };
  }

  const rawItems = data.imageUrls ?? data.slides ?? data.images ?? [];
  let entries: { url: string; contentId: string | null }[] = Array.isArray(rawItems)
    ? rawItems
        .map((item: unknown) => {
          const record = asRecord(item);
          const url = typeof item === 'string' ? item : asString(record?.url ?? record?.imageUrl);
          const rawId = record?.id;
          return {
            url: normalizeStorageUrl(url),
            contentId: rawId ? String(rawId) : null
          };
        })
        .filter((e) => Boolean(e.url))
    : [];

  if (entries.length === 0) {
    entries = [
      { url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80', contentId: null },
      { url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80', contentId: null }
    ];
  }
  if (entries.length < 12) {
    while (entries.length < 11) {
      entries.push(entries[entries.length % entries.length]);
    }
    if (entries.length === 11) {
      entries.push({ url: 'blank', contentId: 'blank' });
    }
  }

  const imageUrls = entries.map((e) => e.url);
  const imageIds = entries.map((e, i) => e.contentId || `tat-img-${i + 1}`);

  return {
    id: asString(data.id, id),
    setName: asString(data.setName ?? data.title, 'TAT Practice Set 1'),
    imageUrls,
    imageIds,
    slideDurationSeconds: typeof data.slideDurationSeconds === 'number' ? data.slideDurationSeconds : 240,
    totalSlides: imageUrls.length
  };
}

/**
 * Maps PPDT context documents with storage URL normalization.
 */
export function mapDocToPPDTContext(id: string, data?: Record<string, unknown>): PPDTContext {
  if (!data) {
    return {
      id,
      title: 'PPDT Practice Image',
      imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=600&q=80',
      viewingTimeSeconds: 30,
      writingTimeSeconds: 240,
      instructions: ['Observe the picture for 30 seconds.', 'Identify characters and write a constructive story in 4 minutes.']
    };
  }

  let item: Record<string, unknown> = data;
  const images = data.images;
  if (Array.isArray(images) && images.length > 0) {
    const found = images.find((img: unknown) => {
      const record = asRecord(img);
      return record && (record.id === id || record.imageUrl === id);
    });
    if (found) {
      item = asRecord(found) ?? data;
    } else {
      const randomIndex = Math.floor(Math.random() * images.length);
      item = asRecord(images[randomIndex]) ?? data;
    }
  }

  const rawUrl = asString(item.imageUrl ?? item.image ?? item.url ?? data.imageUrl ?? data.image);
  const imageUrl = normalizeStorageUrl(rawUrl) || 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=600&q=80';

  const writingTimeSeconds = typeof item.writingTimeSeconds === 'number'
    ? item.writingTimeSeconds
    : typeof item.writingTimeMinutes === 'number'
    ? item.writingTimeMinutes * 60
    : 240;

  const rawContext = asRecord(item.context ?? item.imageContext ?? data.context ?? data.imageContext);
  const imageContext = rawContext ? {
    sceneDescription: asString(rawContext.sceneDescription),
    coreElements: Array.isArray(rawContext.coreElements) ? rawContext.coreElements : [],
    ambiguousElements: Array.isArray(rawContext.ambiguousElements) ? rawContext.ambiguousElements : [],
    expectedThemes: Array.isArray(rawContext.expectedThemes) ? rawContext.expectedThemes : [],
    penalizedThemes: Array.isArray(rawContext.penalizedThemes) ? rawContext.penalizedThemes : [],
    primaryOLQs: Array.isArray(rawContext.primaryOLQs) ? rawContext.primaryOLQs : [],
    deviationTolerance: asString(rawContext.deviationTolerance, 'MEDIUM'),
    exemplarGoodHints: Array.isArray(rawContext.exemplarGoodHints) ? rawContext.exemplarGoodHints : [],
    exemplarBadHints: Array.isArray(rawContext.exemplarBadHints) ? rawContext.exemplarBadHints : []
  } : undefined;

  return {
    id: asString(item.id ?? data.id, id),
    title: asString(item.title ?? item.imageDescription ?? data.title ?? data.setName, 'PPDT Image Test'),
    imageUrl,
    viewingTimeSeconds: typeof item.viewingTimeSeconds === 'number' ? item.viewingTimeSeconds : 30,
    writingTimeSeconds,
    instructions: Array.isArray(data.instructions)
      ? data.instructions
      : ['Observe the picture for 30 seconds.', 'Identify characters and write a constructive story in 4 minutes.'],
    imageContext
  };
}

/**
 * Maps OIR question batch documents, performing anti-cheating answer key sanitization.
 */
export function mapDocToOIRBatch(id: string, data?: Record<string, unknown>, batchIndex = 0): BatchDocument<OIRQuestion> {
  if (!data) {
    return { id: `batch_${batchIndex}`, batchIndex, totalItems: 0, items: [] };
  }

  const rawItems = data.questions ?? data.items ?? data.questionList ?? [];
  const items: OIRQuestion[] = Array.isArray(rawItems)
    ? rawItems.map((raw: unknown, index: number) => {
        const q = asRecord(raw) ?? {};
        const questionNumber = typeof q.questionNumber === 'number' ? q.questionNumber : index + 1;
        const type: 'VERBAL' | 'NON_VERBAL' = q.type === 'NON_VERBAL' || q.questionType === 'NON_VERBAL' ? 'NON_VERBAL' : 'VERBAL';
        const rawImg = asString(q.questionImageUrl ?? q.imageUrl ?? q.image);
        const imageUrl = normalizeStorageUrl(rawImg) || undefined;

        const options: string[] = Array.isArray(q.options)
          ? q.options.map((opt: unknown) => {
              if (typeof opt === 'string') return opt.trim();
              const record = asRecord(opt);
              if (record) return asString(record.text ?? record.label ?? record.value ?? record.id).trim();
              return String(opt ?? '');
            }).filter(Boolean)
          : [];

        // Anti-cheating: explicitly pick only safe client fields
        return {
          id: String(q.id ?? `oir_${batchIndex}_${questionNumber}`),
          questionNumber,
          questionText: asString(q.questionText ?? q.text ?? q.question),
          options: options.length > 0 ? options : ['Option A', 'Option B', 'Option C', 'Option D'],
          imageUrl,
          type
        };
      })
    : [];

  return {
    id: asString(data.id, id) || `batch_${batchIndex}`,
    batchIndex: typeof data.batchIndex === 'number' ? data.batchIndex : batchIndex,
    totalItems: items.length,
    items
  };
}

/**
 * Maps GPE (Group Planning Exercise) scenario batch documents, performing anti-cheating
 * `solution` stripping -- same pattern as OIR's correctAnswerId (see GitLiveGPEImageCacheManager).
 */
export function mapDocToGPEBatch(id: string, data?: Record<string, unknown>, batchIndex = 0): BatchDocument<GPEImage> {
  if (!data) {
    return { id: `batch_${batchIndex}`, batchIndex, totalItems: 0, items: [] };
  }

  const rawItems = data.images ?? data.items ?? [];
  const items: GPEImage[] = Array.isArray(rawItems)
    ? rawItems.map((raw: unknown, index: number) => {
        const img = asRecord(raw) ?? {};
        // Anti-cheating: explicitly pick only safe client fields -- `solution` never included.
        return {
          id: String(img.id ?? `gpe_${batchIndex}_${index + 1}`),
          imageUrl: normalizeStorageUrl(asString(img.imageUrl ?? img.image)),
          scenario: asString(img.scenario),
          imageDescription: asString(img.imageDescription),
          resources: Array.isArray(img.resources) ? img.resources.map((r: unknown) => String(r)) : [],
          viewingTimeSeconds: typeof img.viewingTimeSeconds === 'number' ? img.viewingTimeSeconds : 30,
          planningTimeSeconds: typeof img.planningTimeSeconds === 'number' ? img.planningTimeSeconds : 300,
          minCharacters: typeof img.minCharacters === 'number' ? img.minCharacters : undefined,
          maxCharacters: typeof img.maxCharacters === 'number' ? img.maxCharacters : undefined,
          category: typeof img.category === 'string' ? img.category : undefined,
          difficulty: typeof img.difficulty === 'string' ? img.difficulty : undefined
        };
      })
    : [];

  return {
    id: asString(data.id, id) || `batch_${batchIndex}`,
    batchIndex: typeof data.batchIndex === 'number' ? data.batchIndex : batchIndex,
    totalItems: items.length,
    items
  };
}
