import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedTestRunner } from '../../../src/components/testRunners/UnifiedTestRunner';
import { OIRTestViewModel } from '../../../src/viewmodels/OIRTestViewModel';
import { PsychologyTestViewModel } from '../../../src/viewmodels/PsychologyTestViewModel';
import { strings } from '../../../src/constants/strings';

class MockContentRepository {
  async getOIRQuestions() {
    return {
      batchId: 'oir-1',
      items: [
        {
          id: 'q1',
          questionNumber: 1,
          questionText: 'Find the odd number out',
          options: ['2', '4', '5', '8'],
          type: 'verbal' as const
        }
      ]
    };
  }

  async getTATSet() {
    return {
      id: 'tat-1',
      title: 'TAT Set 1',
      imageUrls: ['https://example.com/slide1.jpg'],
      slideDurationSeconds: 60
    };
  }

  async getWATBatch() {
    return {
      id: 'wat-1',
      title: 'WAT Batch 1',
      words: ['LEADER'],
      displayDurationSeconds: 15
    };
  }

  async getSRTBatch() {
    return {
      id: 'srt-1',
      title: 'SRT Batch 1',
      situations: ['He was on a train when a fire broke out. He...']
    };
  }

  async getPPDTContext() {
    return {
      id: 'ppdt-1',
      imageUrl: 'https://example.com/ppdt.jpg',
      viewingTimeSeconds: 30,
      writingTimeSeconds: 270
    };
  }
}

describe('TestRunners Components Suite', () => {
  let mockRepo: MockContentRepository;

  beforeEach(() => {
    mockRepo = new MockContentRepository();
  });

  it('renders missing ViewModel error fallback for OIR', () => {
    render(<UnifiedTestRunner testType="OIR" userId="user-123" />);
    expect(screen.getByText(new RegExp(strings.common.error))).toBeInTheDocument();
  });

  it('renders missing ViewModel error fallback for Psychology tests', () => {
    render(<UnifiedTestRunner testType="TAT" userId="user-123" />);
    expect(screen.getByText(new RegExp(strings.common.error))).toBeInTheDocument();
  });

  it('renders OIR MCQ runner and allows option selection', async () => {
    const vm = new OIRTestViewModel(mockRepo as any);
    render(<UnifiedTestRunner testType="OIR" oirViewModel={vm} userId="user-123" />);

    const optionBtn = await screen.findByText('2');
    expect(optionBtn).toBeInTheDocument();
    fireEvent.click(optionBtn);

    expect(vm.getState().answers['q1']).toBe(0);
  });

  it('renders TAT slide viewer and records candidate response', async () => {
    const vm = new PsychologyTestViewModel('TAT', mockRepo as any);
    render(<UnifiedTestRunner testType="TAT" psychologyViewModel={vm} userId="user-123" />);

    expect(await screen.findByText(strings.psychology.tatTitle)).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText(strings.psychology.writeResponsePlaceholder);
    fireEvent.change(textarea, { target: { value: 'A brave soldier...' } });

    expect(vm.getState().responses['tat-img-1']).toBe('A brave soldier...');
  });

  it('renders WAT word viewer with word prompt', async () => {
    const vm = new PsychologyTestViewModel('WAT', mockRepo as any);
    render(<UnifiedTestRunner testType="WAT" psychologyViewModel={vm} userId="user-123" />);

    expect(await screen.findByText('LEADER')).toBeInTheDocument();
  });

  it('renders SRT card viewer with situation text', async () => {
    const vm = new PsychologyTestViewModel('SRT', mockRepo as any);
    render(<UnifiedTestRunner testType="SRT" psychologyViewModel={vm} userId="user-123" />);

    expect(await screen.findByText(/He was on a train when a fire broke out/)).toBeInTheDocument();
  });

  it('renders PPDT canvas viewer with perception details', async () => {
    const vm = new PsychologyTestViewModel('PPDT', mockRepo as any);
    render(<UnifiedTestRunner testType="PPDT" psychologyViewModel={vm} userId="user-123" />);

    expect(await screen.findByText(strings.psychology.ppdtTitle)).toBeInTheDocument();
  });

  it('triggers exit modal and handles exit confirmation for OIR runner', async () => {
    const vm = new OIRTestViewModel(mockRepo as any);
    const handleExit = vi.fn();
    const { OIRTestRunner } = await import('../../../src/components/testRunners/OIRTestRunner');
    
    render(<OIRTestRunner viewModel={vm} userId="user-123" onExitTest={handleExit} />);
    
    const exitBtns = await screen.findAllByText(strings.exitTest.exitButton);
    fireEvent.click(exitBtns[0]);

    expect(screen.getByText(strings.exitTest.confirmTitle)).toBeInTheDocument();
    const modalConfirmBtns = screen.getAllByText(strings.exitTest.confirmButton);
    fireEvent.click(modalConfirmBtns[modalConfirmBtns.length - 1]);

    expect(handleExit).toHaveBeenCalledTimes(1);
  });

  it('triggers exit modal and handles exit confirmation for Psychology runner', async () => {
    const vm = new PsychologyTestViewModel('TAT', mockRepo as any);
    const handleExit = vi.fn();
    const { PsychologyTestRunner } = await import('../../../src/components/testRunners/PsychologyTestRunner');
    
    render(<PsychologyTestRunner viewModel={vm} userId="user-123" onExitTest={handleExit} />);
    
    const exitBtns = await screen.findAllByText(strings.exitTest.exitButton);
    fireEvent.click(exitBtns[0]);

    expect(screen.getByText(strings.exitTest.confirmTitle)).toBeInTheDocument();
    const modalConfirmBtns = screen.getAllByText(strings.exitTest.confirmButton);
    fireEvent.click(modalConfirmBtns[modalConfirmBtns.length - 1]);

    expect(handleExit).toHaveBeenCalledTimes(1);
  });
});
