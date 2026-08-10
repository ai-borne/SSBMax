import { OIRQuestion, PPDTContext, TATSet, WATBatch, SRTBatch, BatchDocument } from '../../types/testContent';

/**
 * Normalizes gs:// Google Cloud Storage URLs to HTTPS URLs accessible via web client.
 */
export function normalizeStorageUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('gs://')) {
    const noGs = trimmed.slice(5);
    const slashIdx = noGs.indexOf('/');
    if (slashIdx !== -1) {
      const bucket = noGs.slice(0, slashIdx);
      const path = noGs.slice(slashIdx + 1);
      return `https://storage.googleapis.com/${bucket}/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
    }
  }
  return trimmed;
}

/**
 * Maps WAT batch documents, supporting polymorphic payload schemas.
 */
export function mapDocToWATBatch(id: string, data?: Record<string, any>): WATBatch {
  if (!data) {
    return {
      id,
      words: ['LEADERSHIP', 'COURAGE', 'HONESTY', 'CHALLENGE', 'TEAMWORK', 'SUCCESS'],
      displayDurationSeconds: 15
    };
  }

  const rawWords = data.words || data.wordList || data.items || [];
  const words: string[] = Array.isArray(rawWords)
    ? rawWords
        .map((item: any) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') return (item.word || item.text || item.title || '').trim();
          return String(item || '');
        })
        .filter(Boolean)
    : [];

  return {
    id: data.id || id,
    words: words.length > 0 ? words : ['LEADERSHIP', 'COURAGE', 'HONESTY', 'CHALLENGE', 'TEAMWORK', 'SUCCESS'],
    displayDurationSeconds: typeof data.displayDurationSeconds === 'number' ? data.displayDurationSeconds : 15
  };
}

/**
 * Maps SRT batch documents, supporting polymorphic payload schemas.
 */
export function mapDocToSRTBatch(id: string, data?: Record<string, any>): SRTBatch {
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

  const rawSituations = data.situations || data.situationList || data.items || [];
  const situations: string[] = Array.isArray(rawSituations)
    ? rawSituations
        .map((item: any) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') return (item.situation || item.text || item.description || '').trim();
          return String(item || '');
        })
        .filter(Boolean)
    : [];

  return {
    id: data.id || id,
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
export function mapDocToTATSet(id: string, data?: Record<string, any>): TATSet {
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
      slideDurationSeconds: 240,
      totalSlides: 12
    };
  }

  const rawUrls = data.imageUrls || data.slides || data.images || [];
  let imageUrls: string[] = Array.isArray(rawUrls)
    ? rawUrls
        .map((item: any) => {
          const urlStr = typeof item === 'string' ? item : item?.url || item?.imageUrl || '';
          return normalizeStorageUrl(urlStr);
        })
        .filter(Boolean)
    : [];

  if (imageUrls.length > 0 && imageUrls.length < 12) {
    while (imageUrls.length < 11) {
      imageUrls.push(imageUrls[imageUrls.length % imageUrls.length]);
    }
    if (imageUrls.length === 11) {
      imageUrls.push('blank');
    }
  } else if (imageUrls.length === 0) {
    imageUrls = [
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80'
    ];
    while (imageUrls.length < 11) {
      imageUrls.push(imageUrls[imageUrls.length % imageUrls.length]);
    }
    imageUrls.push('blank');
  }

  return {
    id: data.id || id,
    setName: data.setName || data.title || 'TAT Practice Set 1',
    imageUrls,
    slideDurationSeconds: typeof data.slideDurationSeconds === 'number' ? data.slideDurationSeconds : 240,
    totalSlides: imageUrls.length
  };
}

/**
 * Maps PPDT context documents with storage URL normalization.
 */
export function mapDocToPPDTContext(id: string, data?: Record<string, any>): PPDTContext {
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

  let item: any = data;
  if (Array.isArray(data.images) && data.images.length > 0) {
    const found = data.images.find((img: any) => img.id === id || img.imageUrl === id);
    item = found || data.images[0];
  }

  const rawUrl = item.imageUrl || item.image || item.url || data.imageUrl || data.image || '';
  const imageUrl = normalizeStorageUrl(rawUrl) || 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=600&q=80';

  const writingTimeSeconds = typeof item.writingTimeSeconds === 'number'
    ? item.writingTimeSeconds
    : typeof item.writingTimeMinutes === 'number'
    ? item.writingTimeMinutes * 60
    : 240;

  return {
    id: item.id || data.id || id,
    title: item.title || item.imageDescription || data.title || data.setName || 'PPDT Image Test',
    imageUrl,
    viewingTimeSeconds: typeof item.viewingTimeSeconds === 'number' ? item.viewingTimeSeconds : 30,
    writingTimeSeconds,
    instructions: Array.isArray(data.instructions)
      ? data.instructions
      : ['Observe the picture for 30 seconds.', 'Identify characters and write a constructive story in 4 minutes.']
  };
}

/**
 * Maps OIR question batch documents, performing anti-cheating answer key sanitization.
 */
export function mapDocToOIRBatch(id: string, data?: Record<string, any>, batchIndex = 0): BatchDocument<OIRQuestion> {
  if (!data) {
    return { id: `batch_${batchIndex}`, batchIndex, totalItems: 0, items: [] };
  }

  const rawItems = data.questions || data.items || data.questionList || [];
  const items: OIRQuestion[] = Array.isArray(rawItems)
    ? rawItems.map((q: any, index: number) => {
        const questionNumber = typeof q.questionNumber === 'number' ? q.questionNumber : index + 1;
        const type: 'VERBAL' | 'NON_VERBAL' = q.type === 'NON_VERBAL' || q.questionType === 'NON_VERBAL' ? 'NON_VERBAL' : 'VERBAL';
        const rawImg = q.imageUrl || q.image || '';
        const imageUrl = normalizeStorageUrl(rawImg) || undefined;

        const options: string[] = Array.isArray(q.options)
          ? q.options.map((opt: any) => {
              if (typeof opt === 'string') return opt.trim();
              if (opt && typeof opt === 'object') return (opt.text || opt.label || opt.value || opt.id || '').trim();
              return String(opt || '');
            }).filter(Boolean)
          : [];

        // Anti-cheating: explicitly pick only safe client fields
        return {
          id: String(q.id || `oir_${batchIndex}_${questionNumber}`),
          questionNumber,
          questionText: String(q.questionText || q.text || q.question || ''),
          options: options.length > 0 ? options : ['Option A', 'Option B', 'Option C', 'Option D'],
          imageUrl,
          type
        };
      })
    : [];

  return {
    id: data.id || id || `batch_${batchIndex}`,
    batchIndex: typeof data.batchIndex === 'number' ? data.batchIndex : batchIndex,
    totalItems: items.length,
    items
  };
}
