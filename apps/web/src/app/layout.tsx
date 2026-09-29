import './globals.css';
import { AccessibilityBar } from '../components/AccessibilityBar';
import { NavigationHeader } from '../components/NavigationHeader';
import { Footer } from '../components/Footer';

export const metadata = {
  title: 'Capacity Connect | MoES / IMD prototype',
  description: 'Digital capacity-building and learning management portal for India Meteorological Department (MoES), SIH 26075',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">
        <AccessibilityBar />
        <NavigationHeader />
        <main className="flex-1 bg-slate-50">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
