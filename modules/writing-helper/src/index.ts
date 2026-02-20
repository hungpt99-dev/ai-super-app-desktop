import { defineModule, Permission } from '@ai-super-app/sdk'
import { processWriting } from './tools.js'
import type { IWritingInput } from './tools.js'

/**
 * Writing Helper Module.
 *
 * Provides AI writing tools: improve, summarize, expand, translate, fix-grammar.
 * Automatically activated by the AI Orchestrator for writing-related requests.
 */
export default defineModule({
  manifest: {
    name: 'writing-helper',
    version: '1.0.0',
    minCoreVersion: '1.0.0',
    maxCoreVersion: '2.x',
    permissions: [
      Permission.AiGenerate,
      Permission.UiNotify,
    ],
    description: 'AI-powered writing assistant — improve, summarize, translate and more',
    author: 'AI SuperApp Team',
  },

  tools: [
    {
      name: 'process_writing',
      description:
        'Process text with AI: improve, summarize, expand, translate, or fix grammar. ' +
        'Input: { text: string, action: "improve"|"summarize"|"expand"|"translate"|"fix-grammar", tone?: string, targetLanguage?: string }',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text to process' },
          action: {
            type: 'string',
            enum: ['improve', 'summarize', 'expand', 'translate', 'fix-grammar'],
          },
          tone: {
            type: 'string',
            enum: ['professional', 'casual', 'persuasive', 'academic'],
          },
          targetLanguage: { type: 'string' },
        },
        required: ['text', 'action'],
      },
      run: (input, ctx) => processWriting(input as IWritingInput, ctx),
    },
  ],

  async onActivate(ctx) {
    ctx.ui.notify({
      title: 'Writing Helper',
      body: 'Writing assistant is ready. Ask me to improve, summarize, or translate text!',
      level: 'info',
    })
  },
})
