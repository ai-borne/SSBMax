import React from 'react';
import { OIRTestViewModel } from '../../viewmodels/OIRTestViewModel';
import { PsychologyTestViewModel } from '../../viewmodels/PsychologyTestViewModel';
import { OIRMCQRunner } from './sub/OIRMCQRunner';
import { TATSlideViewer } from './sub/TATSlideViewer';
import { WATWordViewer } from './sub/WATWordViewer';
import { SRTCardViewer } from './sub/SRTCardViewer';
import { PPDTCanvasViewer } from './sub/PPDTCanvasViewer';
import { strings } from '../../constants/strings';
import { AlertCircle } from 'lucide-react';

export type SupportedTestType = 'OIR' | 'TAT' | 'WAT' | 'SRT' | 'PPDT';

interface UnifiedTestRunnerProps {
  testType: SupportedTestType;
  oirViewModel?: OIRTestViewModel;
  psychologyViewModel?: PsychologyTestViewModel;
  userId: string;
  isOnline?: boolean;
}

export const UnifiedTestRunner: React.FC<UnifiedTestRunnerProps> = ({
  testType,
  oirViewModel,
  psychologyViewModel,
  userId,
  isOnline = true
}) => {
  if (testType === 'OIR') {
    if (!oirViewModel) {
      return (
        <div className="p-6 bg-red-900/20 border border-red-700/50 rounded-xl text-red-300 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
          <span>{strings.common.error}: OIR ViewModel missing</span>
        </div>
      );
    }
    return <OIRMCQRunner viewModel={oirViewModel} userId={userId} isOnline={isOnline} />;
  }

  if (!psychologyViewModel) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-700/50 rounded-xl text-red-300 flex items-center">
        <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
        <span>{strings.common.error}: Psychology ViewModel missing for {testType}</span>
      </div>
    );
  }

  switch (testType) {
    case 'TAT':
      return <TATSlideViewer viewModel={psychologyViewModel} userId={userId} isOnline={isOnline} />;
    case 'WAT':
      return <WATWordViewer viewModel={psychologyViewModel} userId={userId} isOnline={isOnline} />;
    case 'SRT':
      return <SRTCardViewer viewModel={psychologyViewModel} userId={userId} isOnline={isOnline} />;
    case 'PPDT':
      return <PPDTCanvasViewer viewModel={psychologyViewModel} userId={userId} isOnline={isOnline} />;
    default:
      return (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
          Unsupported test type
        </div>
      );
  }
};
