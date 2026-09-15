import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib'
import { StringParameter } from 'aws-cdk-lib/aws-ssm'
import type { Construct } from 'constructs'

export interface FeasibilityStackProps extends StackProps {
  /** Logical environment name, e.g. `feasibility`, `staging`. Drives naming only. */
  environmentName: string
}

/**
 * A-T1 proof stack: the smallest deployable unit that exercises the CDK
 * toolchain end to end — bootstrap assumptions, naming, environment
 * configuration, and `cdk synth` — with one cost-free resource and no IAM
 * surface. Phase B (B01) replaces this with the real topology; nothing here
 * is meant to survive that.
 */
export class FeasibilityStack extends Stack {
  constructor(scope: Construct, id: string, props: FeasibilityStackProps) {
    super(scope, id, props)

    const parameter = new StringParameter(this, 'EnvironmentName', {
      parameterName: `/trellis/${props.environmentName}/environment`,
      stringValue: props.environmentName,
      description: 'Trellis environment marker written by the A-T1 feasibility stack.',
    })

    new CfnOutput(this, 'EnvironmentParameterName', {
      value: parameter.parameterName,
      description: 'SSM parameter holding the environment name.',
    })
  }
}
