import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { FeasibilityStack } from '../lib/feasibility-stack.js'

describe('FeasibilityStack', () => {
  const synth = () => {
    const app = new App()
    const stack = new FeasibilityStack(app, 'Test', {
      environmentName: 'test',
      env: { region: 'us-east-2' },
    })
    return Template.fromStack(stack)
  }

  test('synthesizes exactly one SSM parameter and nothing else', () => {
    const template = synth()
    template.resourceCountIs('AWS::SSM::Parameter', 1)
    expect(Object.keys(template.toJSON().Resources as Record<string, unknown>)).toHaveLength(1)
  })

  test('names the parameter by environment and stores the environment name', () => {
    synth().hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/trellis/test/environment',
      Value: 'test',
      Type: 'String',
    })
  })

  test('declares no IAM resources', () => {
    const template = synth()
    template.resourceCountIs('AWS::IAM::Role', 0)
    template.resourceCountIs('AWS::IAM::Policy', 0)
  })
})
