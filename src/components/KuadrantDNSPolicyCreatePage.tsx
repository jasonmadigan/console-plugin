import * as React from 'react';
import Helmet from 'react-helmet';
import {
  PageSection,
  Title,
  TextInput,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Form,
  Radio,
  Button,
  ExpandableSection,
  ButtonVariant,
  ActionGroup,
  AlertVariant,
  Alert,
  AlertGroup,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import './kuadrant.css';
import {
  k8sCreate,
  ResourceYAMLEditor,
  useActiveNamespace,
} from '@openshift-console/dynamic-plugin-sdk';
import { useHistory } from 'react-router-dom';
import { LoadBalancing, HealthCheck, DNSPolicy } from './dnspolicy/types';
import LoadBalancingField from './dnspolicy/LoadBalancingField';
import HealthCheckField from './dnspolicy/HealthCheckField';
import getModelFromResource from '../utils/getModelFromResource';
import { Gateway } from './gateway/types';
import GatewaySelect from './gateway/GatewaySelect';
import { removeUndefinedFields, convertMatchLabelsArrayToObject } from '../utils/modelUtils';

const KuadrantDNSPolicyCreatePage: React.FC = () => {
  const { t } = useTranslation('plugin__console-plugin-template');
  const [createView, setCreateView] = React.useState<'form' | 'yaml'>('form');
  const [policy, setPolicy] = React.useState('');
  const [selectedGateway, setSelectedGateway] = React.useState<Gateway>({
    name: '',
    namespace: '',
  });
  const [routingStrategy, setRoutingStrategy] = React.useState<'simple' | 'loadbalanced'>('simple');
  const [loadBalancing, setLoadBalancing] = React.useState<LoadBalancing>({
    geo: { defaultGeo: '' },
    weighted: { defaultWeight: 0 },
  });
  const [healthCheck, setHealthCheck] = React.useState<HealthCheck>({
    endpoint: '',
    failureThreshold: null,
    port: null,
    protocol: 'HTTP',
  });
  const [isCreateButtonDisabled, setIsCreateButtonDisabled] = React.useState(true);

  // Use the active namespace from the OpenShift Console
  const [selectedNamespace] = useActiveNamespace();
  const history = useHistory(); // Use history for navigation

  // Initialize the YAML resource object based on form state
  const [yamlResource, setYamlResource] = React.useState(() => {
    return removeUndefinedFields({
      apiVersion: 'kuadrant.io/v1alpha1',
      kind: 'DNSPolicy',
      metadata: {
        name: policy,
        namespace: selectedNamespace, // Use active namespace
      },
      spec: {
        routingStrategy,
        targetRef: {
          group: 'gateway.networking.k8s.io',
          kind: 'Gateway',
          name: selectedGateway.name,
          namespace: selectedGateway.namespace,
        },
        loadBalancing: routingStrategy === 'loadbalanced' ? loadBalancing : undefined,
        healthCheck: healthCheck.endpoint ? healthCheck : undefined,
      },
    });
  });

  React.useEffect(() => {
    const updatedYamlResource = {
      apiVersion: 'kuadrant.io/v1alpha1',
      kind: 'DNSPolicy',
      metadata: {
        name: policy,
        namespace: selectedNamespace, // Now using the active namespace
      },
      spec: {
        routingStrategy,
        targetRef: {
          group: 'gateway.networking.k8s.io',
          kind: 'Gateway',
          name: selectedGateway.name,
          namespace: selectedGateway.namespace,
        },
        loadBalancing:
          routingStrategy === 'loadbalanced'
            ? {
                ...loadBalancing,
                weighted: {
                  ...loadBalancing.weighted,
                  custom: loadBalancing.weighted.custom?.map((customWeight) => ({
                    ...customWeight,
                    selector: {
                      ...customWeight.selector,
                      matchLabels: convertMatchLabelsArrayToObject(
                        customWeight.selector.matchLabels || [],
                      ),
                    },
                  })),
                },
              }
            : undefined,
        healthCheck: healthCheck.endpoint ? healthCheck : undefined,
      },
    };

    setYamlResource(removeUndefinedFields(updatedYamlResource)); // Clean undefined values

    const isFormValid = policy && selectedNamespace && selectedGateway.name;
    setIsCreateButtonDisabled(!isFormValid); // Update the button state
  }, [policy, selectedNamespace, selectedGateway, routingStrategy, loadBalancing, healthCheck]);

  const [errorAlertMsg, setErrorAlertMsg] = React.useState('');

  const handleCreateViewChange = (value: 'form' | 'yaml') => {
    setCreateView(value);
  };

  const handlePolicyChange = (_event, policy: string) => {
    setPolicy(policy);
  };

  const handleSubmit = async () => {
    if (isCreateButtonDisabled) return;
    setErrorAlertMsg('');

    const dnsPolicy: DNSPolicy = {
      apiVersion: 'kuadrant.io/v1alpha1',
      kind: 'DNSPolicy',
      metadata: {
        name: policy,
        namespace: selectedNamespace,
      },
      spec: {
        routingStrategy,
        targetRef: {
          group: 'gateway.networking.k8s.io',
          kind: 'Gateway',
          name: selectedGateway.name,
          namespace: selectedGateway.namespace,
        },
        loadBalancing: routingStrategy === 'loadbalanced' ? loadBalancing : undefined,
        healthCheck: healthCheck.endpoint ? healthCheck : undefined,
      },
    };

    try {
      await k8sCreate({
        model: getModelFromResource(dnsPolicy),
        data: dnsPolicy,
        ns: selectedNamespace,
      });
      history.push('/kuadrant/all-namespaces/policies/dns');
    } catch (error) {
      console.error(t('Error creating DNSPolicy'), { error });
      setErrorAlertMsg(error.message);
    }
  };

  const handleCancel = () => {
    history.push('/kuadrant/all-namespaces/policies');
  };

  return (
    <>
      <Helmet>
        <title data-test="example-page-title">{t('Create DNSPolicy')}</title>
      </Helmet>
      <PageSection variant="light" className="pf-m-no-padding">
        <div className="co-m-nav-title">
          <Title headingLevel="h1">{t('Create DNSPolicy')}</Title>
          <p className="help-block co-m-pane__heading-help-text">
            <div>
              {t(
                'DNSPolicy configures how North-South based traffic should be balanced and reach the gateways',
              )}
            </div>
          </p>
        </div>
        <FormGroup
          className="kuadrant-editor-toggle"
          role="radiogroup"
          isInline
          hasNoPaddingTop
          fieldId="create-type-radio-group"
          label="Create via:"
        >
          <Radio
            name="create-type-radio"
            label="Form"
            id="create-type-radio-form"
            isChecked={createView === 'form'}
            onChange={() => handleCreateViewChange('form')}
          />
          <Radio
            name="create-type-radio"
            label="YAML"
            id="create-type-radio-yaml"
            isChecked={createView === 'yaml'}
            onChange={() => handleCreateViewChange('yaml')}
          />
        </FormGroup>
      </PageSection>
      {createView === 'form' ? (
        <PageSection variant="light">
          <Form className="co-m-pane__form">
            <div>
              <FormGroup label={t('Policy Name')} isRequired fieldId="policy-name">
                <TextInput
                  isRequired
                  type="text"
                  id="policy-name"
                  name="policy-name"
                  value={policy}
                  onChange={handlePolicyChange}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t('Unique name of the DNS Policy')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <GatewaySelect selectedGateway={selectedGateway} onChange={setSelectedGateway} />
              <ExpandableSection toggleText={t('Routing Strategy')}>
                <FormGroup
                  role="radiogroup"
                  isInline
                  fieldId="routing-strategy"
                  label={t('Routing Strategy to use')}
                  isRequired
                  aria-labelledby="routing-strategy-label"
                >
                  <Radio
                    name="routing-strategy"
                    label="Simple"
                    id="routing-strategy-simple"
                    isChecked={routingStrategy === 'simple'}
                    onChange={() => setRoutingStrategy('simple')}
                  />
                  <Radio
                    name="routing-strategy"
                    label="Load Balanced"
                    id="routing-strategy-loadbalanced"
                    isChecked={routingStrategy === 'loadbalanced'}
                    onChange={() => setRoutingStrategy('loadbalanced')}
                  />
                </FormGroup>
                {routingStrategy === 'loadbalanced' && (
                  <LoadBalancingField loadBalancing={loadBalancing} onChange={setLoadBalancing} />
                )}
              </ExpandableSection>
              <ExpandableSection toggleText={t('Health Check')}>
                <HealthCheckField healthCheck={healthCheck} onChange={setHealthCheck} />
              </ExpandableSection>
            </div>

            {errorAlertMsg != '' && (
              <AlertGroup className="kuadrant-alert-group">
                <Alert title={t('Error creating DNSPolicy')} variant={AlertVariant.danger} isInline>
                  {errorAlertMsg}
                </Alert>
              </AlertGroup>
            )}

            <ActionGroup>
              <Button
                variant={ButtonVariant.primary}
                onClick={handleSubmit}
                isDisabled={isCreateButtonDisabled}
              >
                {t('Create DNSPolicy')}
              </Button>
              <Button variant={ButtonVariant.secondary} onClick={handleCancel}>
                {t('Cancel')}
              </Button>
            </ActionGroup>
          </Form>
        </PageSection>
      ) : (
        <ResourceYAMLEditor initialResource={yamlResource} create />
      )}
    </>
  );
};

export default KuadrantDNSPolicyCreatePage;
