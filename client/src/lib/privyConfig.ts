
export const privyConfig = {
  appId: 'cm4winhli04jg1tvq07cb8942',
  config: {
    loginMethods: ['email', 'telegram', 'wallet'],
    appearance: {
      theme: 'light',
      accentColor: '#7440ff',
      logo: '/assets/bantahblue.svg',
    },
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
    },
    telegram: {
      botUsername: import.meta.env?.VITE_TELEGRAM_BOT_USERNAME || '@bantah_bot',
    },
  },
};
