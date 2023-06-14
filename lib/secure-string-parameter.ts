import {Construct} from 'constructs';
import {RemovalPolicy, Stack} from 'aws-cdk-lib';
import {AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId} from 'aws-cdk-lib/custom-resources';
import {PolicyStatement} from 'aws-cdk-lib/aws-iam';

export interface SecureStringParameterProps {
  parameterName: string;
  value: string;
  keyId: string,
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
    const stack = Stack.of(scope);
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
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          actions: [
            'ssm:GetParameter',
          ],
          resources: [
            `arn:aws:ssm:${stack.region}:${stack.account}:parameter${parameterName}`,
          ],
        }),
        new PolicyStatement({
          actions: [
            'kms:Decrypt',
          ],
          resources: [
            `arn:aws:kms:${stack.region}:${stack.account}:key/*`,
          ],
        }),
      ]),
    });
    return resource.getResponseField('Parameter.Value');
  }


  constructor(scope: Construct, id: string, props: SecureStringParameterProps) {
    super(scope, id);

    const stack = Stack.of(scope);

    new AwsCustomResource(this, `${id}CustomResource`, {
      onCreate: {
        service: 'SSM',
        action: 'putParameter',
        parameters: {
          Name: props.parameterName,
          Value: props.value,
          Type: 'SecureString',
          KeyId: props.keyId,
        },
        physicalResourceId: PhysicalResourceId.of(Date.now().toString()),
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
          KeyId: props.keyId,
          Overwrite: true,
        },
      },
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          actions: [
            'ssm:PutParameter',
            'ssm:DeleteParameter',
          ],
          resources: [
            `arn:aws:ssm:${stack.region}:${stack.account}:parameter${props.parameterName}`,
          ],
        }),
        new PolicyStatement({
          actions: [
            'kms:Encrypt',
          ],
          resources: [
            `arn:aws:kms:${stack.region}:${stack.account}:key/${props.keyId}`,
          ],
        }),
      ]),
      removalPolicy: props.removalPolicy ?? RemovalPolicy.DESTROY,
    });
  }
}

