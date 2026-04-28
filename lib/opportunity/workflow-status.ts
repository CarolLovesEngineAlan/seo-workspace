import type {
  PipelineStatus,
  ProductionStage,
  WorkflowStatus,
} from "@/lib/types/opportunity";

type WorkflowState = {
  pipelineStatus: PipelineStatus;
  productionStage: ProductionStage;
};

const WORKFLOW_SNAPSHOTS: Record<WorkflowStatus, WorkflowState> = {
  pending: {
    pipelineStatus: "inbox",
    productionStage: "none",
  },
  brief_done: {
    pipelineStatus: "in_queue",
    productionStage: "brief",
  },
  draft_done: {
    pipelineStatus: "in_production",
    productionStage: "draft",
  },
  ready_to_upload: {
    pipelineStatus: "in_production",
    productionStage: "qa",
  },
  published: {
    pipelineStatus: "shipped",
    productionStage: "done",
  },
};

const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  pending: "待生产",
  brief_done: "Brief 完成",
  draft_done: "初稿完成",
  ready_to_upload: "待上传",
  published: "已发布",
};

const WORKFLOW_NEXT: Record<WorkflowStatus, WorkflowStatus | null> = {
  pending: "brief_done",
  brief_done: "draft_done",
  draft_done: "ready_to_upload",
  ready_to_upload: "published",
  published: null,
};

export const WORKFLOW_STATUS_ORDER: WorkflowStatus[] = [
  "pending",
  "brief_done",
  "draft_done",
  "ready_to_upload",
  "published",
];

export function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return (
    value === "pending" ||
    value === "brief_done" ||
    value === "draft_done" ||
    value === "ready_to_upload" ||
    value === "published"
  );
}

export function deriveWorkflowStatus(input: WorkflowState): WorkflowStatus {
  if (input.pipelineStatus === "shipped" || input.productionStage === "done") {
    return "published";
  }

  if (input.productionStage === "qa") {
    return "ready_to_upload";
  }

  if (input.productionStage === "draft") {
    return "draft_done";
  }

  if (input.productionStage === "brief") {
    return "brief_done";
  }

  return "pending";
}

export function getWorkflowSnapshot(status: WorkflowStatus): WorkflowState {
  const snapshot = WORKFLOW_SNAPSHOTS[status];
  return {
    pipelineStatus: snapshot.pipelineStatus,
    productionStage: snapshot.productionStage,
  };
}

export function getWorkflowStatusLabel(status: WorkflowStatus): string {
  return WORKFLOW_LABELS[status];
}

export function getNextWorkflowStatus(
  status: WorkflowStatus
): WorkflowStatus | null {
  return WORKFLOW_NEXT[status];
}

export function canTransitionWorkflow(
  current: WorkflowStatus,
  target: WorkflowStatus
): boolean {
  return current === target || WORKFLOW_NEXT[current] === target;
}

export function canGenerateBriefFromStatus(status: WorkflowStatus): boolean {
  return status === "pending";
}

export function canGenerateDraftFromStatus(status: WorkflowStatus): boolean {
  return status === "brief_done";
}

export function canMarkReadyToUploadFromStatus(
  status: WorkflowStatus
): boolean {
  return status === "draft_done";
}

export function canMarkPublishedFromStatus(status: WorkflowStatus): boolean {
  return status === "ready_to_upload";
}

export function isPublishedWorkflowStatus(status: WorkflowStatus): boolean {
  return status === "published";
}
