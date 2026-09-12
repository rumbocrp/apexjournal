import { invokeCommand } from './client';
import {
  Case,
  CreateCaseInput,
  UpdateCaseInput,
  CaseDetail,
  Milestone,
  CreateMilestoneInput,
} from '../types';

export const casesApi = {
  list: () => invokeCommand<Case[]>('case_list'),
  create: (input: CreateCaseInput) => invokeCommand<Case>('case_create', { input }),
  update: (id: string, input: UpdateCaseInput) => invokeCommand<Case>('case_update', { id, input }),
  getDetail: (id: string) => invokeCommand<CaseDetail>('case_get_detail', { id }),
  createMilestone: (input: CreateMilestoneInput) => invokeCommand<Milestone>('milestone_create', { input }),
  toggleMilestone: (id: string, completed: boolean) =>
    invokeCommand<Milestone>('milestone_toggle', { id, completed }),
};
