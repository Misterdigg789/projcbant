import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />

        {/* Botpress webchat widget - floating chat button (toggle with NEXT_PUBLIC_BOTPRESS_WIDGET=false to disable) */}
        {process.env.NEXT_PUBLIC_BOTPRESS_WIDGET !== 'false' && (
          <>
            <script src="https://cdn.botpress.cloud/webchat/v3.5/inject.js" />
            <script src="https://files.bpcontent.cloud/2025/06/14/17/20250614171821-RZO5DCSV.js" defer />
          </>
        )}
      </body>
    </html>
  )
}
