/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React, { Fragment, useState, useEffect } from 'react';
import {
  EuiBadge,
  EuiInMemoryTable,
  EuiSpacer,
  EuiButton,
  EuiIcon,
  EuiEmptyPrompt,
  EuiTitle,
  EuiLink,
  EuiLoadingSpinner,
  EuiIconTip,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n/react';
import { useAppDependencies } from '../../../app_context';
import { loadAllActions, loadActionTypes, deleteActions } from '../../../lib/action_connector_api';
import { ConnectorAddFlyout, ConnectorEditFlyout } from '../../action_connector_form';
import { hasDeleteActionsCapability, hasSaveActionsCapability } from '../../../lib/capabilities';
import { DeleteModalConfirmation } from '../../../components/delete_modal_confirmation';
import { ActionsConnectorsContextProvider } from '../../../context/actions_connectors_context';
import { checkActionTypeEnabled } from '../../../lib/check_action_type_enabled';
import './actions_connectors_list.scss';
import { ActionConnector, ActionConnectorTableItem, ActionTypeIndex } from '../../../../types';

export const ActionsConnectorsList: React.FunctionComponent = () => {
  const { http, toastNotifications, capabilities, actionTypeRegistry } = useAppDependencies();
  const canDelete = hasDeleteActionsCapability(capabilities);
  const canSave = hasSaveActionsCapability(capabilities);

  const [actionTypesIndex, setActionTypesIndex] = useState<ActionTypeIndex | undefined>(undefined);
  const [actions, setActions] = useState<ActionConnector[]>([]);
  const [data, setData] = useState<ActionConnectorTableItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<ActionConnectorTableItem[]>([]);
  const [isLoadingActionTypes, setIsLoadingActionTypes] = useState<boolean>(false);
  const [isLoadingActions, setIsLoadingActions] = useState<boolean>(false);
  const [editFlyoutVisible, setEditFlyoutVisibility] = useState<boolean>(false);
  const [addFlyoutVisible, setAddFlyoutVisibility] = useState<boolean>(false);
  const [actionTypesList, setActionTypesList] = useState<Array<{ value: string; name: string }>>(
    []
  );
  const [editedConnectorItem, setEditedConnectorItem] = useState<
    ActionConnectorTableItem | undefined
  >(undefined);
  const [connectorsToDelete, setConnectorsToDelete] = useState<string[]>([]);

  useEffect(() => {
    loadActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setIsLoadingActionTypes(true);
        const actionTypes = await loadActionTypes({ http });
        const index: ActionTypeIndex = {};
        for (const actionTypeItem of actionTypes) {
          index[actionTypeItem.id] = actionTypeItem;
        }
        setActionTypesIndex(index);
      } catch (e) {
        toastNotifications.addDanger({
          title: i18n.translate(
            'xpack.triggersActionsUI.sections.actionsConnectorsList.unableToLoadActionTypesMessage',
            { defaultMessage: 'Unable to load action types' }
          ),
        });
      } finally {
        setIsLoadingActionTypes(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Avoid flickering before action types load
    if (typeof actionTypesIndex === 'undefined') {
      return;
    }
    // Update the data for the table
    const updatedData = actions.map(action => {
      return {
        ...action,
        actionType: actionTypesIndex[action.actionTypeId]
          ? actionTypesIndex[action.actionTypeId].name
          : action.actionTypeId,
      };
    });
    setData(updatedData);
    // Update the action types list for the filter
    const actionTypes = Object.values(actionTypesIndex)
      .map(actionType => ({
        value: actionType.id,
        name: `${actionType.name} (${getActionsCountByActionType(actions, actionType.id)})`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setActionTypesList(actionTypes);
  }, [actions, actionTypesIndex]);

  async function loadActions() {
    setIsLoadingActions(true);
    try {
      const actionsResponse = await loadAllActions({ http });
      setActions(actionsResponse.data);
    } catch (e) {
      toastNotifications.addDanger({
        title: i18n.translate(
          'xpack.triggersActionsUI.sections.actionsConnectorsList.unableToLoadActionsMessage',
          {
            defaultMessage: 'Unable to load connectors',
          }
        ),
      });
    } finally {
      setIsLoadingActions(false);
    }
  }

  async function editItem(connectorTableItem: ActionConnectorTableItem) {
    setEditedConnectorItem(connectorTableItem);
    setEditFlyoutVisibility(true);
  }

  const actionsTableColumns = [
    {
      field: 'name',
      'data-test-subj': 'connectorsTableCell-name',
      name: i18n.translate(
        'xpack.triggersActionsUI.sections.actionsConnectorsList.connectorsListTable.columns.nameTitle',
        {
          defaultMessage: 'Name',
        }
      ),
      sortable: false,
      truncateText: true,
      render: (value: string, item: ActionConnectorTableItem) => {
        const checkEnabledResult = checkActionTypeEnabled(
          actionTypesIndex && actionTypesIndex[item.actionTypeId]
        );

        const link = (
          <EuiLink
            data-test-subj={`edit${item.id}`}
            onClick={() => editItem(item)}
            key={item.id}
            disabled={actionTypesIndex ? !actionTypesIndex[item.actionTypeId].enabled : true}
          >
            {value}
          </EuiLink>
        );

        return checkEnabledResult.isEnabled ? (
          link
        ) : (
          <Fragment>
            {link}
            <EuiIconTip
              type="questionInCircle"
              content={checkEnabledResult.message}
              position="right"
            />
          </Fragment>
        );
      },
    },
    {
      field: 'actionType',
      'data-test-subj': 'connectorsTableCell-actionType',
      name: i18n.translate(
        'xpack.triggersActionsUI.sections.actionsConnectorsList.connectorsListTable.columns.actionTypeTitle',
        {
          defaultMessage: 'Type',
        }
      ),
      sortable: false,
      truncateText: true,
    },
    {
      field: 'referencedByCount',
      'data-test-subj': 'connectorsTableCell-referencedByCount',
      name: i18n.translate(
        'xpack.triggersActionsUI.sections.actionsConnectorsList.connectorsListTable.columns.referencedByCountTitle',
        { defaultMessage: 'Actions' }
      ),
      sortable: false,
      truncateText: true,
      render: (value: number, item: ActionConnectorTableItem) => {
        return (
          <EuiBadge color="hollow" key={item.id}>
            {value}
          </EuiBadge>
        );
      },
    },
    {
      field: '',
      name: '',
      actions: [
        {
          enabled: () => canDelete,
          'data-test-subj': 'deleteConnector',
          name: i18n.translate(
            'xpack.triggersActionsUI.sections.actionsConnectorsList.connectorsListTable.columns.actions.deleteActionName',
            { defaultMessage: 'Delete' }
          ),
          description: canDelete
            ? i18n.translate(
                'xpack.triggersActionsUI.sections.actionsConnectorsList.connectorsListTable.columns.actions.deleteActionDescription',
                { defaultMessage: 'Delete this connector' }
              )
            : i18n.translate(
                'xpack.triggersActionsUI.sections.actionsConnectorsList.connectorsListTable.columns.actions.deleteActionDisabledDescription',
                { defaultMessage: 'Unable to delete connectors' }
              ),
          type: 'icon',
          icon: 'trash',
          color: 'danger',
          onClick: (item: ActionConnectorTableItem) => setConnectorsToDelete([item.id]),
        },
      ],
    },
  ];

  const table = (
    <EuiInMemoryTable
      loading={isLoadingActions || isLoadingActionTypes}
      items={data}
      sorting={true}
      itemId="id"
      columns={actionsTableColumns}
      rowProps={(item: ActionConnectorTableItem) => ({
        className:
          !actionTypesIndex || !actionTypesIndex[item.actionTypeId].enabled
            ? 'actConnectorsList__tableRowDisabled'
            : '',
        'data-test-subj': 'connectors-row',
      })}
      cellProps={(item: ActionConnectorTableItem) => ({
        'data-test-subj': 'cell',
        className:
          !actionTypesIndex || !actionTypesIndex[item.actionTypeId].enabled
            ? 'actConnectorsList__tableCellDisabled'
            : '',
      })}
      data-test-subj="actionsTable"
      pagination={true}
      selection={
        canDelete
          ? {
              onSelectionChange(updatedSelectedItemsList: ActionConnectorTableItem[]) {
                setSelectedItems(updatedSelectedItemsList);
              },
            }
          : undefined
      }
      search={{
        filters: [
          {
            type: 'field_value_selection',
            field: 'actionTypeId',
            name: i18n.translate(
              'xpack.triggersActionsUI.sections.actionsConnectorsList.filters.actionTypeIdName',
              { defaultMessage: 'Type' }
            ),
            multiSelect: 'or',
            options: actionTypesList,
          },
        ],
        toolsLeft:
          selectedItems.length === 0 || !canDelete
            ? []
            : [
                <EuiButton
                  key="delete"
                  iconType="trash"
                  color="danger"
                  data-test-subj="bulkDelete"
                  onClick={() => {
                    setConnectorsToDelete(selectedItems.map((selected: any) => selected.id));
                  }}
                  title={
                    canDelete
                      ? undefined
                      : i18n.translate(
                          'xpack.triggersActionsUI.sections.actionsConnectorsList.buttons.deleteDisabledTitle',
                          { defaultMessage: 'Unable to delete connectors' }
                        )
                  }
                >
                  <FormattedMessage
                    id="xpack.triggersActionsUI.sections.actionsConnectorsList.buttons.deleteLabel"
                    defaultMessage="Delete {count}"
                    values={{
                      count: selectedItems.length,
                    }}
                  />
                </EuiButton>,
              ],
        toolsRight: [
          <EuiButton
            data-test-subj="createActionButton"
            key="create-action"
            fill
            iconType="plusInCircle"
            iconSide="left"
            onClick={() => setAddFlyoutVisibility(true)}
          >
            <FormattedMessage
              id="xpack.triggersActionsUI.sections.actionsConnectorsList.addActionButtonLabel"
              defaultMessage="Create connector"
            />
          </EuiButton>,
        ],
      }}
    />
  );

  const emptyPrompt = (
    <EuiEmptyPrompt
      data-test-subj="createFirstConnectorEmptyPrompt"
      title={
        <Fragment>
          <EuiIcon type="logoSlack" size="xl" className="actConnectorsList__logo" />
          <EuiIcon type="logoGmail" size="xl" className="actConnectorsList__logo" />
          <EuiIcon type="logoWebhook" size="xl" className="actConnectorsList__logo" />
          <EuiSpacer size="s" />
          <EuiTitle size="m">
            <h2>
              <FormattedMessage
                id="xpack.triggersActionsUI.sections.actionsConnectorsList.addActionEmptyTitle"
                defaultMessage="Create your first connector"
              />
            </h2>
          </EuiTitle>
        </Fragment>
      }
      body={
        <p>
          <FormattedMessage
            id="xpack.triggersActionsUI.sections.actionsConnectorsList.addActionEmptyBody"
            defaultMessage="Configure email, Slack, Elasticsearch, and third-party services that Kibana can trigger."
          />
        </p>
      }
      actions={
        <EuiButton
          data-test-subj="createFirstActionButton"
          key="create-action"
          fill
          iconType="plusInCircle"
          iconSide="left"
          onClick={() => setAddFlyoutVisibility(true)}
        >
          <FormattedMessage
            id="xpack.triggersActionsUI.sections.actionsConnectorsList.addActionButtonLabel"
            defaultMessage="Create connector"
          />
        </EuiButton>
      }
    />
  );

  const noPermissionPrompt = (
    <h2>
      <FormattedMessage
        id="xpack.triggersActionsUI.sections.actionsConnectorsList.noPermissionToCreateTitle"
        defaultMessage="No permissions to create connector"
      />
    </h2>
  );

  return (
    <section data-test-subj="actionsList">
      <DeleteModalConfirmation
        onDeleted={(deleted: string[]) => {
          if (selectedItems.length === 0 || selectedItems.length === deleted.length) {
            const updatedActions = actions.filter(
              action => action.id && !connectorsToDelete.includes(action.id)
            );
            setActions(updatedActions);
            setSelectedItems([]);
          }
          setConnectorsToDelete([]);
        }}
        onErrors={async () => {
          // Refresh the actions from the server, some actions may have beend deleted
          await loadActions();
          setConnectorsToDelete([]);
        }}
        onCancel={async () => {
          setConnectorsToDelete([]);
        }}
        apiDeleteCall={deleteActions}
        idsToDelete={connectorsToDelete}
        singleTitle={i18n.translate(
          'xpack.triggersActionsUI.sections.actionsConnectorsList.singleTitle',
          { defaultMessage: 'connector' }
        )}
        multipleTitle={i18n.translate(
          'xpack.triggersActionsUI.sections.actionsConnectorsList.multipleTitle',
          { defaultMessage: 'connectors' }
        )}
      />
      <EuiSpacer size="m" />
      {/* Render the view based on if there's data or if they can save */}
      {(isLoadingActions || isLoadingActionTypes) && <EuiLoadingSpinner size="xl" />}
      {data.length !== 0 && table}
      {data.length === 0 && canSave && !isLoadingActions && !isLoadingActionTypes && emptyPrompt}
      {data.length === 0 && !canSave && noPermissionPrompt}
      <ActionsConnectorsContextProvider
        value={{
          actionTypeRegistry,
          http,
          capabilities,
          toastNotifications,
          reloadConnectors: loadActions,
        }}
      >
        <ConnectorAddFlyout
          addFlyoutVisible={addFlyoutVisible}
          setAddFlyoutVisibility={setAddFlyoutVisibility}
        />
        {editedConnectorItem ? (
          <ConnectorEditFlyout
            key={editedConnectorItem.id}
            initialConnector={editedConnectorItem}
            editFlyoutVisible={editFlyoutVisible}
            setEditFlyoutVisibility={setEditFlyoutVisibility}
          />
        ) : null}
      </ActionsConnectorsContextProvider>
    </section>
  );
};

function getActionsCountByActionType(actions: ActionConnector[], actionTypeId: string) {
  return actions.filter(action => action.actionTypeId === actionTypeId).length;
}
