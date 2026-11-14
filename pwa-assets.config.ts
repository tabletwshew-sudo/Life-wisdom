import {
  createAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

// Generates favicons, PWA icons, the iPhone home-screen icon and
// iPhone/iPad splash screens from public/logo.svg at build time.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#7B61FF' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#7B61FF' } },
    appleSplashScreens: createAppleSplashScreens(
      {
        padding: 0.35,
        resizeOptions: { background: '#F7F5FF', fit: 'contain' },
        darkResizeOptions: { background: '#14121F', fit: 'contain' },
        linkMediaOptions: { log: false, addMediaScreen: true, xhtml: false },
        png: { compressionLevel: 9, quality: 70 },
      },
      // One device per unique screen size.
      [
        'iPhone 17 Pro Max',
        'iPhone 17 Pro',
        'iPhone Air',
        'iPhone 15 Pro Max',
        'iPhone 16',
        'iPhone 14',
        'iPhone 14 Plus',
        'iPhone 13 mini',
        'iPhone 11 Pro Max',
        'iPhone 11',
        'iPhone 8 Plus',
        'iPhone SE 4.7"',
        'iPhone SE 4"',
        'iPad Pro 12.9"',
        'iPad Pro 11"',
        'iPad Air 10.9"',
        'iPad Air 13"',
        'iPad 10.2"',
        'iPad mini 8.3"',
      ],
    ),
  },
  images: ['public/logo.svg'],
})
