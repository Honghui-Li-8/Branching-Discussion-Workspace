import { App } from 'aws-cdk-lib'
import { FeasibilityStack } from '../lib/feasibility-stack.js'

// Region: `cdk.json` context (overridable with `-c region=…`). The CLI always
// sets `CDK_DEFAULT_REGION` — falling back to us-east-1 with no profile — so
// env-first would make the committed default dead and the synth depend on
// whose profile is active. The env fallback below is defensive: it is reached
// only if the `region` key is removed from cdk.json.
// Account: `CDK_DEFAULT_ACCOUNT` only; never written into the repo. Synth
// needs no credentials. The resolved environment is printed on every run.
const app = new App()
const environmentName = (app.node.tryGetContext('environment') as string | undefined) ?? 'feasibility'
const region = (app.node.tryGetContext('region') as string | undefined) ?? process.env.CDK_DEFAULT_REGION
const account = process.env.CDK_DEFAULT_ACCOUNT

console.error(
  `[infra] environment=${environmentName} region=${region ?? '<unresolved>'} account=${account ? '<from env>' : '<agnostic>'}`,
)

new FeasibilityStack(app, `Trellis-${environmentName}-Feasibility`, {
  environmentName,
  env: { account, region },
})
