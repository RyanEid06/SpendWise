import { MonthlyBudget } from '../types';
import { LocalDataStore } from '../utils/localDataStore';

export interface BudgetRepository {
  list(): MonthlyBudget[];
  upsert(monthKey: string, startingAmount: number, updatedAt: number): Promise<void>;
}

export class LocalBudgetRepository implements BudgetRepository {
  list(): MonthlyBudget[] {
    return LocalDataStore.getBudgets();
  }

  upsert(monthKey: string, startingAmount: number, updatedAt: number): Promise<void> {
    return LocalDataStore.upsertBudget(monthKey, startingAmount, updatedAt);
  }
}

export const budgetRepository: BudgetRepository = new LocalBudgetRepository();
