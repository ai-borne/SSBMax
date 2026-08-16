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
  },
  gtoCapture: {
    responseLabel: 'Your Written Response',
    charCountSuffix: 'characters',
    submitButton: 'Submit for AI Evaluation',
    submittingButton: 'Submitting...',
    submittedMessage: 'Submitted for evaluation. Check your OLQ dashboard once analysis completes.',
    groundworkNotice: 'Response saved. AI evaluation for this task type is not available yet.',
    errorPrefix: 'Failed to submit: '
  },
  result: {
    analyzing: 'Analyzing your response...',
    failed: 'Evaluation failed. Please try submitting again.',
    notFound: 'Submission not found.'
  },
  interviewCapture: {
    responseLabel: 'Your Answer',
    placeholder: 'Type your interview response here...',
    charCountSuffix: 'characters',
    submitButton: 'Submit Answer',
    submittingButton: 'Submitting...',
    submittedMessage: 'Answer submitted for evaluation.',
    unavailableNotice: 'Interview session orchestration is not live yet -- capture is available for practice, but responses are not sent for evaluation.',
    errorPrefix: 'Failed to submit: '
  }
} as const;
