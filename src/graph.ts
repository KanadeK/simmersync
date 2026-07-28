import type { NormalizedTask } from "./types.js";

export function topologicalOrder(tasks: NormalizedTask[]): string[] | null {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const indegree = new Map<string, number>();
  const ready: NormalizedTask[] = [];

  for (const task of tasks) {
    indegree.set(task.id, task.dependencies.length);
    if (task.dependencies.length === 0) {
      ready.push(task);
    }
  }
  ready.sort(compareTasks);

  const ordered: string[] = [];
  while (ready.length > 0) {
    const current = ready.shift();
    if (!current) {
      break;
    }
    ordered.push(current.id);
    for (const successorId of current.successors) {
      const next = (indegree.get(successorId) ?? 0) - 1;
      indegree.set(successorId, next);
      if (next === 0) {
        const successor = byId.get(successorId);
        if (successor) {
          ready.push(successor);
          ready.sort(compareTasks);
        }
      }
    }
  }

  return ordered.length === tasks.length ? ordered : null;
}

function compareTasks(a: NormalizedTask, b: NormalizedTask): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}
