'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@inngest/components/Button';
import { AlertModal } from '@inngest/components/Modal';
import * as Tooltip from '@radix-ui/react-tooltip';
import { RiArchive2Line, RiInboxUnarchiveLine } from '@remixicon/react';
import { toast } from 'sonner';
import { useMutation, useQuery } from 'urql';

import { useEnvironment } from '@/app/(organization-active)/(dashboard)/env/[environmentSlug]/environment-context';
import { graphql } from '@/gql';

const ArchiveFunctionDocument = graphql(`
  mutation ArchiveFunction($input: ArchiveWorkflowInput!) {
    archiveWorkflow(input: $input) {
      workflow {
        id
      }
    }
  }
`);

const GetFunctionArchivalDocument = graphql(`
  query GetFunctionArchival($slug: String!, $environmentID: ID!) {
    workspace(id: $environmentID) {
      workflow: workflowBySlug(slug: $slug) {
        id
        isArchived
        name
      }
    }
  }
`);

type ArchiveFunctionModalProps = {
  functionID: string | undefined;
  functionName: string;
  isArchived: boolean;
  isOpen: boolean;
  onClose: () => void;
};

function ArchiveFunctionModal({
  functionID,
  functionName,
  isArchived,
  isOpen,
  onClose,
}: ArchiveFunctionModalProps) {
  const [, archiveFunctionMutation] = useMutation(ArchiveFunctionDocument);
  const router = useRouter();

  function handleArchive() {
    if (functionID) {
      archiveFunctionMutation({
        input: {
          workflowID: functionID,
          archive: !isArchived,
        },
      }).then((result) => {
        if (result.error) {
          toast.error(
            `${functionName} could not be ${isArchived ? 'resumed' : 'archived'}: ${
              result.error.message
            }`
          );
        } else {
          toast.success(`${functionName} was successfully ${isArchived ? 'resumed' : 'archived'}`);
          router.refresh();
        }
      });
      onClose();
    }
  }

  return (
    <AlertModal
      className="w-1/3"
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleArchive}
      title={`Are you sure you want to ${isArchived ? 'unarchive' : 'archive'} this function?`}
    >
      {isArchived && (
        <p className="pt-4">
          Reactivate this function. This function will resume normal functionality and will be
          invoked as new events are received. Events received while archived will not be replayed.
        </p>
      )}
      {!isArchived && (
        <ul className="list-disc p-4 pb-0 leading-8">
          <li>Existing runs will continue to run to completion.</li>
          <li>No new runs will be queued or invoked.</li>
          <li>Events will continue to be received, but they will not trigger new runs.</li>
          <li>Archived functions and their logs can be viewed at any time.</li>
          <li>Archived functions will be unarchived when you resync your app.</li>
          <li>Functions can be unarchived at any time.</li>
        </ul>
      )}
    </AlertModal>
  );
}

type ArchiveFunctionProps = {
  functionSlug: string;
};

export default function ArchiveFunctionButton({ functionSlug }: ArchiveFunctionProps) {
  const [isArchivedFunctionModalVisible, setIsArchivedFunctionModalVisible] = useState(false);
  const environment = useEnvironment();

  const [{ data: version, fetching: isFetchingVersions }] = useQuery({
    query: GetFunctionArchivalDocument,
    variables: {
      environmentID: environment.id,
      slug: functionSlug,
    },
  });

  const fn = version?.workspace.workflow;

  if (!fn) {
    return null;
  }

  const { isArchived } = fn;

  return (
    <>
      <Tooltip.Provider>
        <Tooltip.Root delayDuration={0}>
          <Tooltip.Trigger asChild>
            <span tabIndex={0}>
              <Button
                icon={
                  isArchived ? (
                    <RiInboxUnarchiveLine className=" text-slate-300" />
                  ) : (
                    <RiArchive2Line className=" text-slate-300" />
                  )
                }
                btnAction={() => setIsArchivedFunctionModalVisible(true)}
                disabled={isFetchingVersions}
                label={isArchived ? 'Unarchive' : 'Archive'}
              />
            </span>
          </Tooltip.Trigger>
          <Tooltip.Content className="align-center rounded-md bg-slate-800 px-2 text-xs text-slate-300">
            {isArchived
              ? 'Reactivate function'
              : 'Deactivate this function and archive for historic purposes'}
            <Tooltip.Arrow className="fill-slate-800" />
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
      <ArchiveFunctionModal
        functionID={fn.id}
        functionName={fn.name || 'This function'}
        isOpen={isArchivedFunctionModalVisible}
        onClose={() => setIsArchivedFunctionModalVisible(false)}
        isArchived={isArchived}
      />
    </>
  );
}
