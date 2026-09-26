import { CategoryInfo } from '../types';

export const DEFAULT_CATEGORIES: CategoryInfo[] = [
  { name: 'Food', iconEmoji: '🍔', color: '#F97316', bgColor: 'rgba(249, 115, 22, 0.15)' },
  { name: 'Groceries', iconEmoji: '🛒', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.15)' },
  { name: 'Transportation', iconEmoji: '🚗', color: '#0EA5E9', bgColor: 'rgba(14, 165, 233, 0.15)' },
  { name: 'Shopping', iconEmoji: '🛍️', color: '#EC4899', bgColor: 'rgba(236, 72, 153, 0.15)' },
  { name: 'Entertainment', iconEmoji: '🎬', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.15)' },
  { name: 'Bills', iconEmoji: '📄', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  { name: 'Subscriptions', iconEmoji: '📱', color: '#6366F1', bgColor: 'rgba(99, 102, 241, 0.15)' },
  { name: 'Health', iconEmoji: '💊', color: '#14B8A6', bgColor: 'rgba(20, 184, 166, 0.15)' },
  { name: 'Education', iconEmoji: '📚', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.15)' },
  { name: 'Electronics', iconEmoji: '💻', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  { name: 'Travel', iconEmoji: '✈️', color: '#06B6D4', bgColor: 'rgba(6, 182, 212, 0.15)' },
  { name: 'Other', iconEmoji: '🏷️', color: '#64748B', bgColor: 'rgba(100, 116, 139, 0.15)' }
];

export function getCategoryInfo(name: string): CategoryInfo {
  const found = DEFAULT_CATEGORIES.find(
    (c) => c.name.toLowerCase() === name.trim().toLowerCase()
  );
  if (found) return found;
  return {
    name,
    iconEmoji: '🏷️',
    color: '#64748B',
    bgColor: 'rgba(100, 116, 139, 0.15)'
  };
}
