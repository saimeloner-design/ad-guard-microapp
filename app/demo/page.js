import { HomePage } from '../home';

// Demo con campañas de Meta de ejemplo en su propia URL, para compartirla (p. ej. desde /beta o Instagram).
export const metadata = {
  title: 'AdsGuard · Demo',
  description: 'Mira cómo AdsGuard revisa campañas de Facebook e Instagram, con datos de ejemplo.',
};

export default function DemoPage() {
  return <HomePage demo />;
}
