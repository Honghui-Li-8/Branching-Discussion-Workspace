import type { TreeNode } from '../types/tree'

export const mockTree: TreeNode = {
  id: 'root',
  title: 'Should I build this project now?',
  status: 'Exploring',
  messages: [
    {
      id: 'm-root-1',
      role: 'user',
      content:
        'I have four weeks and want a project that shows judgment, architecture decisions, and disciplined scope. I am deciding whether this should be built now or postponed.',
    },
    {
      id: 'm-root-2',
      role: 'assistant',
      content:
        'The key decision seems to be whether this creates visible signal quickly enough without dragging you into a long UI-heavy build that hides backend depth.',
    },
    {
      id: 'm-root-3',
      role: 'user',
      content:
        'I care more about technical narrative than visual polish. I need something I can demo in interviews and explain through tradeoffs, constraints, and branch-level conclusions.',
    },
    {
      id: 'm-root-4',
      role: 'assistant',
      content:
        'Then we should test three branch questions: practical value, MVP feasibility, and interview signal. If those converge, building now is justified; if they do not, we should narrow.',
    },
    {
      id: 'm-root-5',
      role: 'user',
      content:
        'That framing works. I want each branch to produce one explicit conclusion that can be approved and fed back into the parent so the final decision is traceable.',
    },
  ],
  children: [
    {
      id: 'value',
      title: 'Personal value vs team value',
      status: 'Exploring',
      messages: [
        {
          id: 'm-value-1',
          role: 'user',
          content: 'This feels personally useful, but unclear as a team tool right now.',
        },
        {
          id: 'm-value-2',
          role: 'assistant',
          content:
            'Current evidence points to strong personal value and weak immediate team pull.',
        },
      ],
      children: [
        {
          id: 'solo',
          title: 'Personal productivity gain',
          status: 'Approved',
          messages: [
            {
              id: 'm-solo-1',
              role: 'assistant',
              content: 'Strong reusable workflow for your own planning and reflection.',
            },
          ],
        },
        {
          id: 'team',
          title: 'Immediate team necessity',
          status: 'Open',
          messages: [
            {
              id: 'm-team-1',
              role: 'user',
              content: 'No immediate team demand this month.',
            },
          ],
        },
      ],
    },
    {
      id: 'scope',
      title: 'Can MVP fit in 4 weeks?',
      status: 'Open',
      messages: [
        {
          id: 'm-scope-1',
          role: 'user',
          content:
            'I can ship if I keep retrieval simple and avoid overbuilding collaboration features.',
        },
        {
          id: 'm-scope-2',
          role: 'assistant',
          content:
            'A shell + node conversation + approval flow is realistic; analytics and sharing are not.',
        },
      ],
      children: [
        {
          id: 'ui-cut',
          title: 'Can tree view stay lightweight?',
          status: 'Approved',
          messages: [
            {
              id: 'm-uicut-1',
              role: 'assistant',
              content: 'Yes. Keep one canvas with cards, links, and minimal controls.',
            },
          ],
        },
        {
          id: 'backend-cut',
          title: 'What backend can be deferred?',
          status: 'Exploring',
          messages: [
            {
              id: 'm-backendcut-1',
              role: 'user',
              content: 'Background automation and external indexing can be delayed.',
            },
          ],
        },
      ],
    },
    {
      id: 'signal',
      title: 'Will this create strong interview signal?',
      status: 'Exploring',
      messages: [
        {
          id: 'm-signal-1',
          role: 'assistant',
          content:
            'Signal is strongest when you can explain why decisions changed after child-node conclusions.',
        },
      ],
      children: [
        {
          id: 'demo-depth',
          title: 'Depth of technical walkthrough quality',
          status: 'Open',
          messages: [
            {
              id: 'm-demodepth-1',
              role: 'user',
              content: 'Need clear explanation of context boundaries and retrieval choices.',
            },
          ],
        },
        {
          id: 'public-proof',
          title: 'How visible is the decision process artifact?',
          status: 'Approved',
          messages: [
            {
              id: 'm-publicproof-1',
              role: 'assistant',
              content:
                'Screenshots plus branch history provide concrete proof of reasoning process.',
            },
          ],
        },
      ],
    },
  ],
}
