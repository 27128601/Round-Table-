import type { AgentId } from './prompts';
import type { Source } from './anthropic';

export interface SessionRow {
  id: string;
  user_id: string;
  title: string;
  idea_text: string;
  attachments: { name: string; markdown: string }[];
  lang: 'en' | 'zh';
  message_count: number;
  status: 'active' | 'wrapped_up';
  created_at: string;
  updated_at: string;
}

export interface AgentStep {
  agentId: AgentId;
  status: 'complete' | 'failed';
  text?: string;
  sources?: Source[];
  error?: string;
}

export interface RoundRow {
  id: string;
  session_id: string;
  round_index: number;
  kind: 'initial' | 'reaction' | 'standalone';
  grounding_status: 'not_attempted' | 'complete' | 'failed';
  grounding_result: { text: string; sources: Source[] } | null;
  initial_takes: AgentStep[];
  alignment_status: 'not_attempted' | 'complete' | 'failed';
  alignment_result: string | null;
  tactics: AgentStep[];
  billed: boolean;
  created_at: string;
}

export interface HumanTurnRow {
  id: string;
  session_id: string;
  round_id: string | null;
  questions: { agentId: string; question: string }[];
  answers: { agentId: string; answer: string }[];
  general_note: string | null;
  created_at: string;
}

export interface AgentThreadRow {
  id: string;
  session_id: string;
  agent_id: string;
  founder_message: string;
  agent_reply: string | null;
  created_at: string;
}

export interface PlanRow {
  id: string;
  session_id: string;
  title: string | null;
  steps: string[];
  risk: string | null;
  validate: string | null;
  created_at: string;
}

export interface SessionDetail {
  session: SessionRow;
  rounds: RoundRow[];
  humanTurns: HumanTurnRow[];
  agentThreads: AgentThreadRow[];
  plans: PlanRow[];
}
