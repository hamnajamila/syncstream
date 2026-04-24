export type TaskType = 'task' | 'meeting' | 'quiz';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description?: string;
  deadline: any; // Firestore Timestamp
  type: TaskType;
  status: 'pending' | 'completed';
  priority: Priority;
  ownerId: string;
  boardId: string;
  createdAt: any;
  updatedAt?: any;
}

export interface Board {
  id: string;
  name: string;
  category: 'University' | 'Home' | 'Work' | 'Institute' | 'Other';
  ownerId: string;
  createdAt: any;
}
