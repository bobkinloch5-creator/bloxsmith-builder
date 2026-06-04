import React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'BloxSmith'

interface WelcomeProps {
  name?: string
  appUrl?: string
}

const WelcomeEmail = ({ name, appUrl = 'https://bloxsmith.pro' }: WelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — let's build something awesome.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `Welcome, ${name}!` : `Welcome to ${SITE_NAME}!`}
        </Heading>
        <Text style={text}>
          Thanks for joining {SITE_NAME}. You're all set to generate Roblox-ready
          3D models, scripts, animations, and more with our AI builder.
        </Text>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={appUrl} style={button}>
            Open {SITE_NAME}
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          Need help? Just reply to this email — we read every message.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: `Welcome to ${SITE_NAME}`,
  displayName: 'Welcome email',
  previewData: { name: 'Jane', appUrl: 'https://bloxsmith.pro' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 16px' }
const button = {
  backgroundColor: '#14f195',
  color: '#0f172a',
  padding: '12px 22px',
  borderRadius: '10px',
  fontWeight: 700,
  textDecoration: 'none',
  fontSize: '14px',
}
const hr = { borderColor: '#e2e8f0', margin: '28px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: 0 }
