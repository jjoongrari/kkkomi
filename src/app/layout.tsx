import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Квартирник Коми — угадай цену квартиры',
  description: '10 квартир в Республике Коми. Угадайте цену по фотографиям и проверьте своё чувство рынка.',
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/icon.svg` },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#012D6E', viewportFit: 'cover' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
