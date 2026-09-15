import { App } from 'aws-cdk-lib'
import { FeasibilityStack } from '../lib/feasibility-stack.js'

// Region: `cdk.json` context first (overridable with `-c region=…`), then
// `CDK_DEFAULT_REGION`. The CLI always sets that variable — it falls back to
// us-east-1 when no profile is configured — so env-first would make the
// committed default dead and the synth depend on whose profile is active.
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
