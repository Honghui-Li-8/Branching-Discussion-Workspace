import type { TreeNode } from '../types/tree'

export const mockTree: TreeNode = {
  id: 'root',
  title: 'Should I build this project now?',
  status: 'Exploring',
  folded: false,
  messages: [
    {
      id: 'm-root-1',
      role: 'user',
      content:
        'I have four weeks and want a project that shows technical judgment and clean decision logic.',
    },
    {
      id: 'm-root-2',
      role: 'assistant',
      content:
        'Let us break this into value, scope, interview signal, and delivery risks with explicit branch conclusions.',
    },
  ],
  children: [
    {
      id: 'value',
      title: 'Personal value vs team value',
      status: 'Exploring',
      folded: false,
      messages: [
        {
          id: 'm-value-1',
          role: 'user',
          content: 'Personal value feels obvious but team pull is uncertain.',
        },
      ],
      children: [
        {
          id: 'solo',
          title: 'Personal productivity gain',
          status: 'Approved',
          folded: false,
          messages: [
            {
              id: 'm-solo-1',
              role: 'assistant',
              content: 'This can become your own reusable planning and reflection workspace.',
            },
          ],
          children: [
            {
              id: 'habit-loop',
              title: 'Weekly decision habit loop',
              status: 'Exploring',
              folded: true,
              messages: [
                {
                  id: 'm-habit-1',
                  role: 'user',
                  content:
                    'If this becomes a weekly ritual, the project keeps paying off after interviews.',
                },
              ],
              children: [
                {
                  id: 'friction-log',
                  title: 'Capture friction points from each branch session',
                  status: 'Open',
                  folded: true,
                  messages: [
                    {
                      id: 'm-friction-1',
                      role: 'assistant',
                      content:
                        'Track where branching felt slow so next iteration improves navigation and context flow.',
                    },
                  ],
                },
              ],
            },
            {
              id: 'time-saved',
              title: 'Measured time saved per planning cycle',
              status: 'Open',
              folded: true,
              messages: [
                {
                  id: 'm-time-1',
                  role: 'user',
                  content: 'Need a simple before/after estimate to validate personal ROI.',
                },
              ],
            },
          ],
        },
        {
          id: 'team',
          title: 'Immediate team necessity',
          status: 'Open',
          folded: true,
          messages: [
            {
              id: 'm-team-1',
              role: 'user',
              content: 'No urgent demand from a team this month.',
            },
          ],
        },
        {
          id: 'adoption-path',
          title: 'Possible adoption path if team interest appears',
          status: 'Exploring',
          folded: true,
          messages: [
            {
              id: 'm-adopt-1',
              role: 'assistant',
              content:
                'If shared usage appears, start with read-only views before adding collaboration features.',
            },
          ],
          children: [
            {
              id: 'champion-model',
              title: 'Single champion rollout model',
              status: 'Open',
              folded: true,
              messages: [
                {
                  id: 'm-champion-1',
                  role: 'assistant',
                  content:
                    'One champion can curate decisions and demonstrate value before wider rollout.',
                },
              ],
            },
            {
              id: 'rollout-note',
              title: 'Onboarding note template',
              status: 'Approved',
              folded: false,
              messages: [
                {
                  id: 'm-rollout-1',
                  role: 'user',
                  content: 'Simple one-page onboarding note is enough for now.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'scope',
      title: 'Can MVP fit in 4 weeks?',
      status: 'Open',
      folded: false,
      messages: [
        {
          id: 'm-scope-1',
          role: 'assistant',
          content:
            'Keep core loop only: tree, scoped node discussion, approval, and upward carry.',
        },
      ],
      children: [
        {
          id: 'ui-cut',
          title: 'Can tree UI stay lightweight?',
          status: 'Approved',
          folded: false,
          messages: [
            {
              id: 'm-uicut-1',
              role: 'assistant',
              content: 'Yes. A single canvas and card actions is enough for MVP.',
            },
          ],
          children: [
            {
              id: 'node-density',
              title: 'Node density readability at medium zoom',
              status: 'Open',
              folded: false,
              messages: [
                {
                  id: 'm-density-1',
                  role: 'user',
                  content: 'Need to check readability once tree exceeds thirty visible nodes.',
                },
              ],
            },
            {
              id: 'mobile-pass',
              title: 'Mobile fallback behavior',
              status: 'Exploring',
              folded: false,
              messages: [
                {
                  id: 'm-mobile-1',
                  role: 'assistant',
                  content: 'Stack side panels and keep tree pan/scroll behavior on small screens.',
                },
              ],
            },
          ],
        },
        {
          id: 'backend-cut',
          title: 'What backend can be deferred?',
          status: 'Exploring',
          folded: true,
          messages: [
            {
              id: 'm-backendcut-1',
              role: 'user',
              content: 'Background automation and external indexing can wait.',
            },
          ],
        },
        {
          id: 'api-boundary',
          title: 'Minimum API boundaries',
          status: 'Exploring',
          folded: false,
          messages: [
            {
              id: 'm-api-1',
              role: 'assistant',
              content:
                'Define only workspace, node, and message contracts needed for the composition loop.',
            },
          ],
          children: [
            {
              id: 'read-model',
              title: 'Read model for tree hydration',
              status: 'Approved',
              folded: true,
              messages: [
                {
                  id: 'm-readmodel-1',
                  role: 'assistant',
                  content: 'One aggregate query for root with shallow children is enough initially.',
                },
              ],
            },
            {
              id: 'write-pipeline',
              title: 'Write pipeline for message + summary updates',
              status: 'Open',
              folded: true,
              messages: [
                {
                  id: 'm-write-1',
                  role: 'user',
                  content:
                    'Need to ensure summary updates do not block user message writes under load.',
                },
              ],
            },
            {
              id: 'audit-log',
              title: 'Decision change audit trail',
              status: 'Open',
              folded: true,
              messages: [
                {
                  id: 'm-audit-1',
                  role: 'assistant',
                  content: 'Store approved conclusions with timestamp and parent context snapshot.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'signal',
      title: 'Will this create strong interview signal?',
      status: 'Exploring',
      folded: true,
      messages: [
        {
          id: 'm-signal-1',
          role: 'assistant',
          content:
            'Signal increases when you can explain why parent direction changed after branch approvals.',
        },
      ],
      children: [
        {
          id: 'demo-depth',
          title: 'Depth of technical walkthrough quality',
          status: 'Open',
          folded: true,
          messages: [
            {
              id: 'm-demodepth-1',
              role: 'user',
              content: 'Need clear stories for context scoping, retrieval, and approval mechanics.',
            },
          ],
        },
        {
          id: 'public-proof',
          title: 'Visibility of decision process artifact',
          status: 'Approved',
          folded: true,
          messages: [
            {
              id: 'm-publicproof-1',
              role: 'assistant',
              content:
                'Screenshots plus branch logs make the reasoning process concrete for reviewers.',
            },
          ],
          children: [
            {
              id: 'repo-tour',
              title: 'Repository walkthrough checklist',
              status: 'Approved',
              folded: false,
              messages: [
                {
                  id: 'm-repotour-1',
                  role: 'assistant',
                  content: 'Prepare an architecture-first walkthrough script with three demo checkpoints.',
                },
              ],
            },
            {
              id: 'before-after',
              title: 'Before/after decision examples',
              status: 'Open',
              folded: true,
              messages: [
                {
                  id: 'm-beforeafter-1',
                  role: 'user',
                  content: 'Collect examples where child conclusions changed root direction.',
                },
              ],
            },
          ],
        },
        {
          id: 'hiring-story',
          title: 'Hiring narrative clarity',
          status: 'Exploring',
          folded: true,
          messages: [
            {
              id: 'm-hiring-1',
              role: 'assistant',
              content:
                'Your narrative should show prioritization, uncertainty handling, and deliberate scope cuts.',
            },
          ],
          children: [
            {
              id: 'resume-bullet',
              title: 'Resume bullet phrasing',
              status: 'Approved',
              folded: false,
              messages: [
                {
                  id: 'm-resume-1',
                  role: 'user',
                  content: 'Need a concise bullet that emphasizes decision composition and retrieval design.',
                },
              ],
            },
            {
              id: 'portfolio-video',
              title: 'Short portfolio walkthrough video',
              status: 'Open',
              folded: true,
              messages: [
                {
                  id: 'm-video-1',
                  role: 'assistant',
                  content: 'A 2–3 minute guided run can drastically improve reviewer comprehension.',
                },
              ],
            },
            {
              id: 'interview-script',
              title: 'Interview Q&A script',
              status: 'Exploring',
              folded: false,
              messages: [
                {
                  id: 'm-script-1',
                  role: 'assistant',
                  content:
                    'Prepare answers for branching heuristics, context isolation, and human approval checkpoints.',
                },
              ],
              children: [
                {
                  id: 'qna-bank',
                  title: 'Q&A bank with difficult tradeoff prompts',
                  status: 'Open',
                  folded: true,
                  messages: [
                    {
                      id: 'm-qna-1',
                      role: 'user',
                      content:
                        'Need five difficult prompts around scaling, confidence, and uncertain conclusions.',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'risk',
      title: 'Execution and sustainability risks',
      status: 'Exploring',
      folded: false,
      messages: [
        {
          id: 'm-risk-1',
          role: 'assistant',
          content:
            'Biggest risks are burnout, schedule slip, and novelty overreach beyond MVP boundaries.',
        },
      ],
      children: [
        {
          id: 'burnout-risk',
          title: 'Burnout risk during four-week sprint',
          status: 'Open',
          folded: false,
          messages: [
            {
              id: 'm-burnout-1',
              role: 'user',
              content: 'Need strict daily cap to avoid late sprint fatigue.',
            },
          ],
        },
        {
          id: 'schedule-slip',
          title: 'Schedule slip contingency',
          status: 'Exploring',
          folded: false,
          messages: [
            {
              id: 'm-slip-1',
              role: 'assistant',
              content: 'Define hard fallback scope before week three.',
            },
          ],
          children: [
            {
              id: 'buffer-plan',
              title: 'One-week contingency buffer',
              status: 'Approved',
              folded: false,
              messages: [
                {
                  id: 'm-buffer-1',
                  role: 'assistant',
                  content: 'Reserve final week for stabilization and demo narrative polish.',
                },
              ],
            },
            {
              id: 'fallback-scope',
              title: 'Fallback MVP scope if milestones slip',
              status: 'Open',
              folded: true,
              messages: [
                {
                  id: 'm-fallback-1',
                  role: 'user',
                  content: 'If needed, drop advanced retrieval ranking and keep simple local search.',
                },
              ],
            },
          ],
        },
        {
          id: 'novelty-risk',
          title: 'Novelty risk from over-designing interactions',
          status: 'Exploring',
          folded: true,
          messages: [
            {
              id: 'm-novelty-1',
              role: 'assistant',
              content:
                'Avoid novelty UI work unless it directly improves branch clarity or approval flow.',
            },
          ],
        },
      ],
    },
  ],
}
