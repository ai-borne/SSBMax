import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchSelectorModal } from '../../../src/components/practice/BatchSelectorModal';
import { TestSimulatorCard } from '../../../src/components/practice/TestSimulatorCard';
import { TestSimulatorConfig } from '../../../src/components/practice/ssbTestConfigs';

describe('BatchSelectorModal & Dynamic Batch Selector Unit Tests', () => {
  const mockBatches = [
    { id: 'batch_0', name: 'OIR Batch 1 (50 Qs)', itemCount: 50 },
    { id: 'batch_1', name: 'OIR Batch 2 (50 Qs)', itemCount: 50 },
    { id: 'batch_2', name: 'OIR Batch 3 (50 Qs)', itemCount: 50 }
  ];

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <BatchSelectorModal
        isOpen={false}
        moduleTitle="OIR"
        batches={mockBatches}
        selectedBatchId="batch_0"
        onSelectBatch={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders batch options and highlights active selection when isOpen is true', () => {
    render(
      <BatchSelectorModal
        isOpen={true}
        moduleTitle="OIR"
        batches={mockBatches}
        selectedBatchId="batch_1"
        onSelectBatch={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('batch-selector-modal')).toBeInTheDocument();
    expect(screen.getByText('OIR Batch 1 (50 Qs)')).toBeInTheDocument();
    expect(screen.getByText('OIR Batch 2 (50 Qs)')).toBeInTheDocument();

    const batch1Chip = screen.getByTestId('batch-chip-batch_1');
    expect(batch1Chip.className).toContain('bg-sky-500');
  });

  it('invokes onSelectBatch and onClose when a 1-tap batch chip is clicked', () => {
    const onSelectBatch = vi.fn();
    const onClose = vi.fn();

    render(
      <BatchSelectorModal
        isOpen={true}
        moduleTitle="WAT"
        batches={mockBatches}
        selectedBatchId="batch_0"
        onSelectBatch={onSelectBatch}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByTestId('batch-chip-batch_2'));
    expect(onSelectBatch).toHaveBeenCalledWith('batch_2');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders Live Batch Count Pill and Batch Selector Chip on TestSimulatorCard', () => {
    const mockTest: TestSimulatorConfig = {
      id: 'wat',
      testTypeId: 'wat',
      dayNumber: '2',
      stageBadge: 'Stage II',
      title: 'WAT Test',
      shortCode: 'WAT',
      description: 'Word association test',
      requiredTier: 'FREE',
      timeLimit: '15m'
    };


    const onLaunch = vi.fn();

    render(
      <TestSimulatorCard
        test={mockTest}
        userTier="FREE"
        onLaunch={onLaunch}
      />
    );

    expect(screen.getByTestId('launch-button-wat')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('launch-button-wat'));
    expect(onLaunch).toHaveBeenCalledWith('wat');
  });
});
