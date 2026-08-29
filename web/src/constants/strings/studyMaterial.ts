// Split out of common.ts in the Phase 8 sweep (docs/plans/write-the-phased-plan-wobbly-pancake.md)
// -- common.ts had crept past the 300-LOC cap; spread flatly into strings.ts so every existing
// `strings.studyMaterial.*` call site is unchanged.
export const studyMaterialStrings = {
  studyMaterial: {
    title: 'Free Study Material',
    allCategories: 'All Categories',
    readTime: '{min} min read',
    markAsRead: 'Mark as Read',
    completed: 'Completed',
    noMaterials: 'No study materials available at the moment.',
    loadError: 'Failed to load study materials.',
    offlineNotice: 'Viewing cached study material',
    softCtaTitle: 'Sign in to Save Your Progress',
    softCtaDesc: 'Study guides are free for everyone, no sign-in required. Sign in with Google to sync completed guides and your practice history across devices.',
    signInWithGoogle: 'Sign in with Google',
    day1Title: 'Day 1: Stage I Screening Test',
    day2Title: 'Day 2: Stage II Psychology Battery & PIQ',
    day3Title: 'Day 3 & 4: Stage II GTO Outdoor Tasks',
    day5Title: 'Day 5: Stage II Interview & Board Conference',
    skeletonLoading: 'Loading authentic SSB study materials...',
    contentLoading: 'Loading study material...',
    postAuthResuming: 'Resuming your session to open study guide...',
    offlineFallbackBanner: 'Operating in offline mode. Showing cached study materials.'
  }
} as const;
