import type { IToolInput, IModuleContext } from '@ai-super-app/sdk'

export type WritingTone = 'professional' | 'casual' | 'persuasive' | 'academic'
export type WritingAction = 'improve' | 'summarize' | 'expand' | 'translate' | 'fix-grammar'

export interface IWritingInput extends IToolInput {
  text: string
  action: WritingAction
  tone?: WritingTone
  targetLanguage?: string
}

const ACTION_PROMPTS: Record<WritingAction, (input: IWritingInput) => string> = {
  improve: (i) => `Improve the following text with a ${i.tone ?? 'professional'} tone:\n\n${i.text}`,
  summarize: (i) => `Summarize the following text concisely:\n\n${i.text}`,
  expand: (i) => `Expand the following text with more detail and a ${i.tone ?? 'professional'} tone:\n\n${i.text}`,
  translate: (i) => `Translate the following text to ${i.targetLanguage ?? 'English'}:\n\n${i.text}`,
  'fix-grammar': (i) => `Fix the grammar and spelling in the following text, keep the same meaning:\n\n${i.text}`,
}

export async function processWriting(
  input: IWritingInput,
  ctx: IModuleContext,
): Promise<{ result: string; tokensUsed: number }> {
  const prompt = ACTION_PROMPTS[input.action]
  if (!prompt) {
    throw new Error(`Unknown writing action: ${input.action as string}`)
  }

  const response = await ctx.ai.generate({
    capability: 'writing',
    input: prompt(input),
  })

  return {
    result: response.output,
    tokensUsed: response.tokensUsed,
  }
}
