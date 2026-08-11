export const testRunnerStrings = {
  stimulus: {
    stimulusTypeSuffix: 'STIMULUS'
  },
  response: {
    selectOptionLabel: 'Select Response Option',
    writeResponseLabel: 'Write Your Response Action',
    presetChipsLabel: '1-Tap Preset Quick Actions:',
    textareaPlaceholder: 'Type your response here...'
  },
  grid: {
    paletteTitle: 'Question Palette',
    totalSuffix: 'Total',
    closeDrawer: 'Close Question Palette',
    legendCurrent: 'Current',
    legendAnswered: 'Answered',
    legendFlagged: 'Flagged',
    legendUnanswered: 'Unanswered'
  },
  bottomBar: {
    prev: 'Prev',
    flag: 'Flag',
    flagged: 'Flagged',
    next: 'Next',
    submitTest: 'Submit Test'
  },
  header: {
    exit: 'Exit',
    exitAriaLabel: 'Exit Test Mode',
    offlineAutoSave: 'IndexedDB Auto-Save'
  }
} as const;
