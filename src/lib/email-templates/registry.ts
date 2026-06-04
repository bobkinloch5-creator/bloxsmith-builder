import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as welcomeTemplate } from './welcome'

/**
 * Template registry — maps template names to their React Email components.
 * Add a new template by importing it above and registering it here.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcomeTemplate,
}
