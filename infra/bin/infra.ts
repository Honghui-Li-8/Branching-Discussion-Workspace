import { App } from 'aws-cdk-lib'
import { FeasibilityStack } from '../lib/feasibility-stack.js'

// Account and region come from the environment (`CDK_DEFAULT_ACCOUNT` /
// `CDK_DEFAULT_REGION`, which the CDK CLI populates from the active AWS
// profile). The region falls back to `cdk.json` context so `cdk synth` works
// with no credentials at all; the account is never written into the repo.
const app = new App()
const environmentName = (app.node.tryGetContext('environment') as string | undefined) ?? 'feasibility'
const region = process.env.CDK_DEFAULT_REGION ?? (app.node.tryGetContext('region') as string | undefined)

new FeasibilityStack(app, `Trellis-${environmentName}-Feasibility`, {
  environmentName,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region },
})
