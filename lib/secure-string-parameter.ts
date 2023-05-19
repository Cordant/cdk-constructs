import {Construct} from 'constructs';
import {RemovalPolicy} from 'aws-cdk-lib';
import {Key} from 'aws-cdk-lib/aws-kms';
import {AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId} from 'aws-cdk-lib/custom-resources';

export interface SecureStringParameterProps {
  parameterName: string;
  value: string;
  key: Key,
  removalPolicy?: RemovalPolicy;
}

/**
 * Creates a secure string parameter in SSM Parameter Store.
 */
export class SecureStringParameter extends Construct {
  /**
   * Returns the decrypted value for the latest version of the secure string parameter.
   */
  static valueForSecureStringParameter(scope: Construct, id: string, parameterName: string): string {
    const resource = new AwsCustomResource(scope, `${id}GetParameter`, {
      onCreate: {
        service: 'SSM',
        action: 'getParameter',
        parameters: {
          Name: parameterName,
          WithDecryption: true,
        },
        physicalResourceId: PhysicalResourceId.of(Date.now().toString()), // Update physical id to always fetch the latest version
      },
      onUpdate: {
        service: 'SSM',
        action: 'getParameter',
        parameters: {
          Name: parameterName,
          WithDecryption: true,
        },
        physicalResourceId: PhysicalResourceId.of(Date.now().toString()), // Update physical id to always fetch the latest version
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
    return resource.getResponseField('Parameter.Value');
  }


  constructor(scope: Construct, id: string, props: SecureStringParameterProps) {
    super(scope, id);

    new AwsCustomResource(this, `${id}CustomResource`, {
      onCreate: {
        service: 'SSM',
        action: 'putParameter',
        parameters: {
          Name: props.parameterName,
          Value: props.value,
          Type: 'SecureString',
          KeyId: props.key.keyId,
        },
      },
      onDelete: {
        service: 'SSM',
        action: 'deleteParameter',
        parameters: {
          Name: props.parameterName,
        },
      },
      onUpdate: {
        service: 'SSM',
        action: 'putParameter',
        parameters: {
          Name: props.parameterName,
          Value: props.value,
          Type: 'SecureString',
          KeyId: props.key.keyId,
          Overwrite: true,
        },
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
      removalPolicy: props.removalPolicy ?? RemovalPolicy.DESTROY,
    });
  }
}

