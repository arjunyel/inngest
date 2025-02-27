package devserver

import (
	"context"

	"github.com/inngest/inngest/pkg/cqrs"
	"github.com/inngest/inngest/pkg/execution"
	"github.com/inngest/inngest/pkg/execution/queue"
	"github.com/inngest/inngest/pkg/execution/state"
	"github.com/inngest/inngest/pkg/pubsub"
	"github.com/oklog/ulid/v2"
)

type lifecycle struct {
	execution.NoopLifecyceListener

	sm         state.Manager
	cqrs       cqrs.Manager
	pb         pubsub.Publisher
	eventTopic string
}

func (l lifecycle) OnFunctionScheduled(
	ctx context.Context,
	id state.Identifier,
	item queue.Item,
	s state.State,
) {
	_ = l.cqrs.InsertFunctionRun(ctx, cqrs.FunctionRun{
		RunID:         id.RunID,
		RunStartedAt:  ulid.Time(id.RunID.Time()),
		FunctionID:    id.WorkflowID,
		EventID:       id.EventID,
		Cron:          s.CronSchedule(),
		OriginalRunID: id.OriginalRunID,
	})

	if id.BatchID != nil {
		executedTime := ulid.Time(id.RunID.Time())

		batch := cqrs.NewEventBatch(
			cqrs.WithEventBatchID(*id.BatchID),
			cqrs.WithEventBatchAccountID(id.AccountID),
			cqrs.WithEventBatchWorkspaceID(id.WorkspaceID),
			cqrs.WithEventBatchAppID(id.AppID),
			cqrs.WithEventBatchFunctionID(id.WorkflowID),
			cqrs.WithEventBatchRunID(id.RunID),
			cqrs.WithEventBatchEventIDs(id.EventIDs),
			cqrs.WithEventBatchExecutedTime(executedTime),
		)

		if batch.IsMulti() {
			_ = l.cqrs.InsertEventBatch(ctx, *batch)
		}
	}
}
