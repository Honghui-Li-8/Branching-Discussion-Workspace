TRUNCATE TABLE public.credit_transactions, public.messages, public.nodes, public.workspaces, public.users RESTART IDENTITY CASCADE;

INSERT INTO public.users (id, auth_user_id, email, display_name, credit_balance)
VALUES
  (
    '00000000-0000-0000-0000-000000009001',
    'seed:owner',
    'seed.owner@example.com',
    'Seed Owner',
    0
  );

INSERT INTO public.workspaces (id, title, author_user_id, root_node_id)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'MVP Branching Decisions',
    '00000000-0000-0000-0000-000000009001',
    '00000000-0000-0000-0000-000000000101'
  );

INSERT INTO public.nodes (
  id,
  workspace_id,
  author_user_id,
  parent_node_id,
  depth,
  type,
  title,
  status,
  confidence,
  summary,
  conclusion,
  rationale
)
VALUES
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000009001',
    '00000000-0000-0000-0000-000000000101',
    0,
    'decision',
    'Choose architecture strategy',
    'exploring',
    'medium',
    'Root decision for MVP architecture direction.',
    NULL,
    NULL
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000009001',
    '00000000-0000-0000-0000-000000000101',
    1,
    'question',
    'Should we optimize for speed or extensibility first?',
    'open',
    'medium',
    'Primary tradeoff question under the root decision.',
    NULL,
    NULL
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000009001',
    '00000000-0000-0000-0000-000000000102',
    2,
    'option',
    'Prioritize speed for first release',
    'exploring',
    'high',
    'Ship a narrow feature set quickly, then iterate.',
    NULL,
    NULL
  ),
  (
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000009001',
    '00000000-0000-0000-0000-000000000102',
    2,
    'constraint',
    'Team has one backend engineer',
    'approved',
    'high',
    'Capacity constraint limits initial architecture complexity.',
    'Keep initial scope tight.',
    'Lower implementation risk for MVP.'
  );

INSERT INTO public.messages (node_id, author_user_id, role, content)
VALUES
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000009001',
    'system',
    'Workspace initialized with root decision node.'
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000009001',
    'user',
    'I need us to decide the first version tradeoff this week.'
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000009001',
    'assistant',
    'Speed-first can reduce unknowns and provide feedback sooner.'
  );

INSERT INTO public.credit_transactions (user_id, amount, type, reason)
VALUES
  (
    '00000000-0000-0000-0000-000000009001',
    500,
    'grant',
    'Seed startup grant'
  );
